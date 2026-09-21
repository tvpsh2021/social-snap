# Facebook Carousel Stops on a False Duplicate

**Date:** 2026-09-21  
**Affected platform:** Facebook  
**Affected component:** `FacebookPlatform.navigateCarousel()`

## Summary

A Facebook post containing 28 images consistently stopped extraction at image 18. The content script logged `Duplicate image detected` even though manually navigating the post showed that the images were different.

The download filenames were not the cause. Batch filenames already contain an incrementing index. The failure occurred earlier, while the content script was navigating and deduplicating carousel media.

## Root Causes

Two independent assumptions caused premature termination:

1. After clicking Next, the extractor waited a fixed 1000 ms and immediately inspected the DOM. If Facebook had not finished updating the route and image element, the previous image was interpreted as a duplicate and the carousel stopped.
2. Image deduplication used the first numeric segment of the Facebook CDN filename, parsed with `/\/(\d+)_\d+/`. Different photos can share this CDN filename prefix, so a later image could collide with an earlier image even when their Facebook photo IDs were different.

## Resolution

- Replaced the fixed delay with polling every 100 ms for up to 5000 ms.
- Require both the route identity and displayed media URL to change before collecting the next item.
- Use the page URL's `fbid` as the primary image deduplication key.
- Fall back to the CDN image ID or complete image URL only when `fbid` is unavailable.
- Prefer an image whose CDN ID matches the current `fbid`; otherwise select the largest visible candidate.
- Include the duplicate key in diagnostic logs.

## Regression Coverage

Added a carousel test that simulates:

- The Facebook route changing before the image DOM updates.
- Two different `fbid` values whose CDN filenames share the same first numeric segment.

The test verifies that both images are collected and that the current image is not treated as a duplicate while Facebook is still transitioning.

## Validation

- Facebook tests: 13 passed
- Full test suite: 98 passed
- ESLint: passed
- `git diff --check`: passed

The original 28-image Facebook post was manually retested and all images were extracted successfully.

## Related Files

- `src/content/content.js`
- `tests/content/facebook.test.js`
- `docs/facebook-extraction.md`
- `docs/platform-comparison.md`
