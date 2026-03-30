# Instagram Media Extraction Logic

This document describes how the extension extracts media from Instagram posts, covering all supported post types.

## Supported Post Types

1. Single photo
2. Single video
3. Carousel (multiple items: photos, videos, or mixed)

---

## Entry Point: `extractImages()`

All extraction starts from `InstagramPlatform.extractImages()`. The method:

1. Waits 500ms for the page to settle (`INITIAL_WAIT`).
2. Queries the `<main>` element as the root container.
3. Detects whether the post is a carousel by checking for `ul li` inside `<main>`.
4. Delegates to the appropriate extraction path.

```
extractImages()
  |
  +-- isCarousel? (ul li found)
  |     YES --> _navigateCarousel()
  |
  +-- singleVideo? (video element found)
  |     YES --> _extractSingleVideoUrl()
  |
  +-- fallthrough --> _extractSingleImage()
```

---

## Post Type 1: Single Photo

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

## Post Type 2: Single Video

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

## Post Type 3: Carousel

**Detection:** `ul li` found inside `<main>`.

Carousels can contain any combination of photos and videos across up to 20 items.

### Navigation strategy

Instagram renders carousel items as `<li>` elements inside a `<ul>`. The currently visible item has `style="transform: translateX(0px)"`. Adjacent items are offset at non-zero translateX values.

The method clicks the "Next" button repeatedly, collecting media at each step, until no Next button is found or `MAX_ATTEMPTS` (50) is reached. After each click it waits 1000ms (`WAIT_TIME`).

### Visible item detection

At each navigation step, `collectCurrentlyVisibleMedia()` reads the current `<li>` children of the `<ul>`. The logic applies a positional rule:

- If there are 3 or more `<li>` elements and one has `translateX(0px)`, process `listItems[1]` (center item). Always also process `listItems[2]`.
- If there are fewer than 3 `<li>` elements and one has `translateX(0px)`, process only that `translateX(0px)` item.

The 3+ case covers the sliding window Instagram uses, where 3 items are in the DOM at a time: previous, current, and next. The fewer-than-3 case handles legacy posts (circa 2022) where a single image is wrapped in a `<ul>/<li>` structure with only 2 `<li>` elements.

### Photo items

For a `<li>` that contains an `img`:

1. Queries `img` inside the `<li>`.
2. Adds to `mediaMap` keyed by `img.src` to deduplicate.

### Video items

For a `<li>` that contains a `<video>`:

1. Checks if the blob URL has already been processed (`processedVideoBlobUrls` set) to avoid reprocessing the same video element.
2. Calls `getNewVideoUrl()`, which scans performance entries for `.mp4` URLs on `fbcdn.net` or `cdninstagram.com`, skipping already-collected URLs.
3. Deduplication uses two layers:
   - Clean URL (after stripping `bytestart`/`byteend` params) via `collectedVideoUrls`.
   - Asset ID from the `efg` URL parameter via `collectedVideoAssetIds`.
4. If no URL is found immediately (video not yet loaded):
   - Calls `video.play()`.
   - Waits 800ms.
   - Retries `getNewVideoUrl()`.
5. Thumbnail is extracted from `img[referrerpolicy]` inside the `<li>`.
6. Adds to `mediaMap` keyed by the clean video URL.

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
