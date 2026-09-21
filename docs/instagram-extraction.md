# Instagram Media Extraction Logic

This document describes how the extension extracts media from Instagram posts, covering all supported post types.

## Supported Post Types

1. Single photo
2. Single video
3. Carousel (multiple items: photos, videos, or mixed)

---

## Entry Point: `extractImages()`

All extraction starts from `InstagramPlatform.extractImages()`. The method:

1. Scans Instagram's `script[type="application/json"]` hydration payload for the current post shortcode.
2. If structured media data is present, extracts the complete post directly without navigating the carousel.
3. Otherwise, polls every 100ms for up to 10 seconds until `<main>` contains post media.
4. Waits 500ms for interaction handlers, checks hydration data once more, then falls back to DOM extraction.

If an extraction started while the Instagram tab was hidden and returned no media, the content script marks it for one retry when the tab becomes visible. Concurrent extraction runs are prevented by an in-page lock.

Auto-extraction starts as soon as the content script runs at `document_idle`; it does not wait for the page `load` event. Instagram can defer that event in a background tab while waiting for lazy subresources.

```
extractImages()
  |
  +-- embedded post data found?
  |     YES --> _extractEmbeddedMedia()
  |
  +-- wait for DOM and retry embedded data
  |
  +-- DOM fallback
        +-- carousel --> _navigateCarousel()
        +-- video --> _extractSingleVideoUrl()
        +-- image --> _extractSingleImage()
```

## Primary Path: Embedded Hydration Data

Instagram includes the current post response in an `application/json` script. The extractor recursively searches parsed payloads for an object whose `code` matches the shortcode in the current URL.

For carousel posts, the matching object contains the complete ordered `carousel_media` array, including slides that Instagram has not rendered into the DOM yet. Each item is converted as follows:

- Image: select the largest `image_versions2.candidates` entry by pixel area.
- Video: select the largest `video_versions` entry by pixel area and use the largest image candidate as its thumbnail.
- Single media: process the matching post object as a one-item list.

This path avoids synthetic Next-button clicks, works before visual carousel hydration, and normally returns every item immediately. DOM navigation remains a compatibility fallback when the payload format is unavailable or changes.

---

## DOM Fallback: Single Photo

**Detection:** no `<ul>` in `<main>`, no `<video>` element.

**Extraction steps:**

1. `_extractSingleImage()` queries all `img` elements inside `<main>`.
2. Filters out small images: must have `naturalWidth > 150` and `naturalHeight > 150`.
3. `_findBoundaryElement()` scans for a `div`/`h2`/`span` whose text starts with "More posts from". Any images appearing after this element in document order are excluded (they belong to the "related posts" section, not the current post).
4. Remaining images are returned as the result.

**Relevant selectors:**

| Selector | Purpose |
|---|---|
| `main` | Root container |
| `img` | Post image candidates |
| `div, h2, span` | Boundary element search |

---

## DOM Fallback: Single Video

**Detection:** no `<ul>` in `<main>`, but a `<video>` element is present.

Instagram uses MSE (Media Source Extensions), so the `<video>` element has `src="blob:https://www.instagram.com/..."`. The real CDN URL is never in the DOM.

**Extraction steps:**

1. `_extractSingleVideoUrl(videoElement)` calls `_findVideoUrlInPerformance()`.
2. `_findVideoUrlInPerformance()` scans `performance.getEntriesByType('resource')` for `.mp4` entries on `fbcdn.net` or `cdninstagram.com`.
3. If no entry is found (video has `preload="none"` and hasn't loaded yet):
   - Calls `videoElement.play()` to force the browser to start loading the video.
   - Waits 800ms for the network request to appear in performance entries.
   - Retries `_findVideoUrlInPerformance()`.
4. If a URL is found, queries `img[referrerpolicy]` inside the closest `[data-instancekey]` ancestor for the thumbnail.
5. Returns a single media item with `mediaType: 'video'`.

**Why `play()` is needed:** Instagram sets `preload="none"` on video elements. Until playback is triggered, the browser makes no network request and the CDN URL never appears in performance entries.

---

## DOM Fallback: Carousel

**Detection:** `ul li` found inside `<main>`.

Carousels can contain any combination of photos and videos across up to 20 items.

### Navigation strategy

Instagram renders carousel items as `<li>` elements inside a `<ul>`. The currently visible item has `style="transform: translateX(0px)"`. Adjacent items are offset at non-zero translateX values.

The method clicks the "Next" button repeatedly, collecting the currently visible media at each step, until no Next button is found or `MAX_ATTEMPTS` (50) is reached.

After each click, it polls every 100ms until the visible media identity changes, with a 5-second timeout. Fast transitions therefore continue immediately instead of always waiting one second, while slow transitions still have time to finish.

### Visible item detection

At each navigation step, `collectCurrentlyVisibleMedia()` reads the direct `<li>` children of the carousel `<ul>`. It selects the item whose inline transform is `translateX(0px)`. If that marker is unavailable, it falls back to the first item whose bounding rectangle intersects the viewport.

Only the visible item is collected. Preloaded adjacent items are not collected early because their media, especially videos, may not have finished loading or may not correspond to the current performance entry.

### Photo items

For a `<li>` that contains an `img`:

1. Queries `img` inside the `<li>`.
2. Adds to `mediaMap` keyed by `img.src` to deduplicate.

### Video items

For a `<li>` that contains a `<video>`:

1. Checks if the blob URL has already been successfully processed (`processedVideoBlobUrls` set) to avoid reprocessing the same video element.
2. Calls `getNewVideoUrl()`, which scans performance entries from newest to oldest for `.mp4` URLs on `fbcdn.net` or `cdninstagram.com`, skipping already-collected URLs and entries explicitly tagged as non-carousel media.
3. Deduplication uses two layers:
   - Clean URL (after stripping `bytestart`/`byteend` params) via `collectedVideoUrls`.
   - Asset ID from the `efg` URL parameter via `collectedVideoAssetIds`.
4. If no URL is found immediately (video not yet loaded):
   - Calls `video.play()`.
   - Polls every 100ms for up to 3 seconds.
5. Thumbnail is extracted from `img[referrerpolicy]` inside the `<li>`.
6. Adds to `mediaMap` keyed by the clean video URL.

The blob URL is marked as processed only after a matching CDN URL is found. A transient miss therefore remains eligible for retry rather than being permanently skipped.

### `efg` parameter

Instagram CDN URLs carry an `efg` query parameter containing URL-safe base64-encoded JSON. The decoded JSON includes:

- `xpv_asset_id`: unique asset identifier used for deduplication across different renditions of the same video.
- `vencodeTag`: contains `"carousel_item"` for carousel videos.

### `_cleanVideoUrl()`

Strips `bytestart` and `byteend` parameters from video URLs before using them as map keys. These params change between requests for the same video file (range requests), so stripping them ensures consistent deduplication.

### `_findNextButton()`

Queries `button[tabindex="-1"]` inside the post container. The real "Next" button is identified by having `computed style: right === "0px"` (it sits on the right edge of the carousel).

---

## CDN Domains

| Domain | Used for |
|---|---|
| `fbcdn.net` | Primary Instagram/Facebook CDN |
| `cdninstagram.com` | Alternative Instagram CDN |

Both domains must be checked. Missing `cdninstagram.com` will cause videos served from that domain to be silently skipped.

---

## Image Size Filter

All image candidates (single photo and carousel) must pass a minimum size check:

- `naturalWidth > 150` and `naturalHeight > 150`

This excludes icons, avatars, and decorative UI elements.

---

## Data Shape

Each extracted media item has this shape:

```js
{
  index: Number,        // 1-based position
  alt: String,          // image alt text, or 'Video' for videos
  thumbnailUrl: String, // poster/thumbnail image URL (may be empty for videos)
  fullSizeUrl: String,  // CDN URL of the media
  maxWidth: Number,     // 0 for videos; image width from srcset parsing otherwise
  mediaType: String     // 'image' or 'video'
}
```
