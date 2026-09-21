# Instagram Background Tabs and Incomplete Carousel Extraction

**Date:** 2026-09-21  
**Affected platform:** Instagram  
**Affected component:** `InstagramPlatform.extractImages()` and auto-extraction lifecycle

## Summary

Instagram carousel extraction had two related failures:

1. A post opened in a background tab did not start extraction until the tab became visible.
2. After replacing the fixed carousel delay with media-change polling, a six-image post returned only its first image.

The second failure was reproduced on a live Instagram post. The content script found the first image and clicked Next, but the displayed media did not change before the five-second timeout.

## Root Causes

Several assumptions made the DOM navigation path unreliable:

1. Auto-extraction was registered inside a `window.load` listener. Instagram can defer page resources and the load event while a tab is hidden, so the content script could be present without starting extraction.
2. Carousel extraction depended on `HTMLElement.click()` advancing Instagram's React-controlled Next button. On the reproduced post, the programmatic click did not advance the carousel even though the button was present and matched the selector.
3. The first polling implementation collected only the currently visible slide. When the Next click failed, the timeout correctly stopped navigation but returned the one image already collected.
4. DOM navigation was unnecessary for current Instagram post pages. Their `script[type="application/json"]` hydration payload already contains the complete ordered `carousel_media` array, including slides that have not been rendered.

## Resolution

- Start auto-extraction as soon as the content script runs at `document_idle`; do not wait for `window.load`.
- Parse Instagram's embedded hydration JSON before attempting DOM extraction.
- Match the embedded post object to the shortcode in the current URL.
- For carousel posts, read the complete ordered `carousel_media` array.
- Select the largest image or video candidate by pixel area.
- Use the largest image candidate as the thumbnail for embedded videos.
- Keep DOM carousel navigation as a compatibility fallback when embedded data is unavailable.
- Before using the fallback, wait 500 ms for Instagram to attach interaction handlers.
- In the fallback path, poll every 100 ms for actual media changes instead of using a fixed one-second delay.
- Retry an empty extraction once when a tab that started hidden becomes visible.

## Video Reliability Improvements

The DOM fallback also received these safeguards:

- Poll for a video CDN request every 100 ms for up to three seconds.
- Mark a video blob URL as processed only after a CDN URL is found.
- Scan performance entries from newest to oldest.
- Ignore MP4 entries explicitly tagged as non-carousel media.
- Deduplicate videos by cleaned URL and the asset ID encoded in the `efg` parameter.

## Regression Coverage

Added Instagram tests covering:

- Delayed post DOM rendering.
- A six-image carousel extracted entirely from embedded data without rendered post DOM.
- Mixed image and video extraction from embedded data.
- Waiting for the visible slide to change after navigation.
- Delayed MP4 performance entries.
- Filtering MP4 resources explicitly tagged as non-carousel media.

## Validation

- Instagram tests: 14 passed
- Full test suite: 104 passed
- ESLint: passed
- `git diff --check`: passed
- Live inspection confirmed that the reproduced six-image post's hydration payload contained all six ordered media items.

The updated unpacked extension still requires a manual reload in `chrome://extensions` before browser retesting because existing tabs retain the previous content script.

## Related Files

- `src/content/content.js`
- `tests/content/helpers.js`
- `tests/content/instagram.test.js`
- `docs/instagram-extraction.md`
- `docs/platform-comparison.md`
- `README.md`
