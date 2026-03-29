# X.com Media Extraction Logic

This document describes how the extension extracts media from X.com (Twitter) posts.

## Supported Post Types

1. Single photo
2. Single video
3. Single GIF
4. Photo carousel (multiple photos)
5. Multiple videos
6. Mixed carousel (photos + videos + GIFs)
7. HLS-only video (amplify_video, requires yt-dlp)

---

## Architecture: Two-World Design

X.com extraction uses two scripts running in different Chrome extension worlds:

| Script | World | Purpose |
|---|---|---|
| `x-fetch-interceptor.js` | MAIN | Patches `window.fetch` and `XMLHttpRequest` to intercept Twitter API responses containing `video_info.variants` |
| `content.js` (XPlatform) | Isolated | Reads the DOM, navigates carousels, and assembles the final media list |

The MAIN world script can access `window.fetch` directly (impossible from the isolated world). It communicates with the content script via `CustomEvent` on `document`.

### Communication Flow

```
x-fetch-interceptor.js (MAIN world)
    | dispatches CustomEvent: __socialSnapXVideo
    v
content.js - X_VIDEO_CACHE (isolated world)
    | XPlatform.extractImages()
    v
background.js - stores media per tab
    |
    v
popup.js - displays grid, triggers downloads
```

The content script can also request a full cache dump by dispatching `__socialSnapRequestVideos`. The interceptor responds with `__socialSnapXVideoCache`.

---

## Entry Point: `extractImages()`

`XPlatform.extractImages()` determines the extraction path based on the current URL and DOM state.

```
extractImages()
  |
  +-- Request video cache from MAIN world interceptor
  |
  +-- isPhotoMode? (URL contains /photo/ or /video/)
  |     |
  |     +-- mainDialog found?
  |     |     +-- isCarousel? (ul[role="list"] found)
  |     |     |     YES --> _navigateCarousel()
  |     |     |     NO  --> _extractSingleImage()
  |     |     |              \-- empty? --> check for GIF/video in dialog
  |     |     |
  |     |
  |     +-- no dialog --> return []
  |
  +-- not photo mode, no dialog
        --> _extractVideoFromTweetPage()
```

---

## Fetch Interceptor: `x-fetch-interceptor.js`

Patches both `window.fetch` and `XMLHttpRequest` to intercept Twitter API responses. Targets URLs matching `/graphql/`, `/i/api/`, `api.twitter.com`, or `api.x.com`.

When a response contains `video_info.variants`, the interceptor:

1. Filters for `video/mp4` variants and selects the highest bitrate.
2. Falls back to `application/x-mpegURL` (HLS) if no MP4 variant exists (common for `amplify_video`).
3. Extracts a video ID from the URL. Supported patterns:
   - `ext_tw_video/{id}/` -- regular uploaded videos
   - `amplify_video/{id}/` -- promoted/amplify videos
   - `tweet_video/{id}/` -- GIFs (ID is alphanumeric, not numeric)
4. Caches the result and dispatches a `__socialSnapXVideo` CustomEvent.

---

## Post Type 1: Single Photo

**Trigger:** URL contains `/photo/`, a `div[role="dialog"]` is present, no `ul[role="list"]` (not a carousel).

`_extractSingleImage()` queries `div[data-testid="swipe-to-dismiss"] img` inside the dialog. Each image must pass:

- Size filter: `width > 150px` and `height > 150px`
- Content check: `alt` is `"Image"` or `"画像"`, or `src` contains `twimg.com`

---

## Post Type 2: Single Video

**Trigger:** Plain tweet URL (no `/photo/` or `/video/`), no dialog present.

`_extractVideoFromTweetPage()` scans `article[data-testid="tweet"]` elements for a `video[poster]` element.

Video ID extraction from the poster URL supports three patterns:
- `amplify_video_thumb/{id}/`
- `ext_tw_video_thumb/{id}/`
- `tweet_video_thumb/{id}/`

Resolution priority:
1. **X_VIDEO_CACHE** -- populated by the fetch interceptor (most reliable for regular videos)
2. **Performance entries** -- `_findXVideoUrlFromPerformance()` scans `performance.getEntriesByType('resource')` for `video.twimg.com` URLs matching the video ID
3. **Tweet URL fallback** -- returns the tweet URL with `isHLS: true` so the user can use yt-dlp

---

## Post Type 3: GIF

**Trigger:** Same as single video (plain tweet URL, no dialog). Detected before the regular video path runs.

X.com renders GIFs as `<video>` elements with a direct `src` attribute pointing to an MP4 file. The URL pattern is `video.twimg.com/tweet_video/{alphanumericId}.mp4`.

Detection: check if `video.src` contains `tweet_video/`. If so, the MP4 URL is used directly as the download URL. No API interception or performance entry scanning is needed.

GIF characteristics that differ from regular videos:
- The `src` attribute is set directly on the `<video>` element (regular videos use MSE/blob URLs)
- The video ID is alphanumeric (e.g., `HDnBg4saQAAGQMX`), not purely numeric
- Poster URL uses `tweet_video_thumb/` prefix
- Always MP4, never HLS
- The `<video>` has `preload="auto"` and autoplays in a loop

GIF detection also runs in the dialog fallback path: if `_extractSingleImage()` returns empty within a dialog, the code checks for a `<video>` with a `tweet_video/` src.

---

## Post Type 4: Carousel

**Trigger:** URL contains `/photo/` or `/video/`, dialog is present, and `ul[role="list"]` exists inside the dialog.

### Lazy loading behavior

X.com initially renders only 2 `<li>` elements in the carousel. Additional items load as the user navigates. The extension clicks through the carousel to force all items to load.

### Navigation strategy

`_navigateCarousel()` uses `div[data-testid="Carousel-NavRight"] button` to advance slides. Configuration:
- Max attempts: 10
- Wait between slides: 1000ms
- Stops when: no Next button found, or no new media found after 3 navigation attempts

### Media collection per slide

At each step, `collectCurrentlyVisibleMedia()` collects both images and videos:

**Images:**
- Selector: `li[role="listitem"] img`
- Same validation as single image (alt text + twimg.com check)
- Minimum size: 50x50 (lower threshold for carousel thumbnails)
- Skips `img` elements inside a `<li>` that also contains a `<video>` (those are video poster thumbnails)
- Deduplication: `img.src` as map key

**Videos (including GIFs):**
- Selector: `li[role="listitem"] video`
- GIF detection runs first: if `video.src` contains `tweet_video/`, the MP4 is used directly
- Regular videos follow the same resolution chain as single video (cache, performance entries, tweet URL fallback)
- Deduplication: poster URL as map key, or video element reference

### Final ordering

After navigation completes, the method iterates all `li[role="listitem"]` elements in DOM order and matches each to a collected image or video. This preserves the original media order from the tweet.

Within each `<li>`, video is checked before image to avoid matching the poster `<img>` inside a video `<li>`.

---

## Boundary Filter

After extraction, a boundary filter excludes media that belongs to recommended/related content below the main tweet. The boundary element is `div[aria-expanded="true"]`, which X.com uses to separate the main tweet content from the reply thread.

For video items, the stored `videoElement` reference is used for DOM position comparison.

---

## SPA Navigation Detection

X.com is a Single Page Application. When the user navigates to a `/photo/` or `/video/` URL within the SPA, the page does not reload. A `MutationObserver` watches for dialog additions and re-triggers extraction when a photo/video dialog appears.

---

## Video URL Patterns

| URL Pattern | Type | ID Format | Example |
|---|---|---|---|
| `video.twimg.com/ext_tw_video/{id}/...` | Regular video | Numeric | `ext_tw_video/1234567890/` |
| `video.twimg.com/amplify_video/{id}/...` | Amplify/promoted video | Numeric | `amplify_video/1234567890/` |
| `video.twimg.com/tweet_video/{id}.mp4` | GIF | Alphanumeric | `tweet_video/HDnBg4saQAAGQMX.mp4` |

Thumbnail URL patterns mirror the video patterns with a `_thumb` suffix:
- `pbs.twimg.com/ext_tw_video_thumb/{id}/...`
- `pbs.twimg.com/amplify_video_thumb/{id}/...`
- `pbs.twimg.com/tweet_video_thumb/{id}.jpg`

---

## Data Shape

Each extracted media item has this shape:

```js
{
  index: Number,        // 1-based position
  alt: String,          // 'Image', 'Video', or 'GIF'
  thumbnailUrl: String, // poster/thumbnail image URL
  fullSizeUrl: String,  // CDN URL of the media (MP4 for videos/GIFs, image URL for photos)
  isHLS: Boolean,       // true if the URL is an HLS manifest (requires yt-dlp)
  maxWidth: Number,     // 0 for videos/GIFs; image width from srcset parsing otherwise
  mediaType: String     // 'image' or 'video'
}
```
