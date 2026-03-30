# Facebook Media Extraction Logic

This document describes how the extension extracts media from Facebook posts.

## Supported Post Types

1. Single photo
2. Photo carousel (album)
3. Single video (Reel)
4. Mixed carousel (photos + videos)

---

## Architecture

Facebook extraction uses two components working together:

| Component | Location | Purpose |
|---|---|---|
| `content.js` (FacebookPlatform) | Content script (Isolated world) | DOM interaction, carousel navigation, DASH manifest parsing |
| `background.js` (webRequest listener) | Background service worker | Passively collects MP4 URLs from `*.fbcdn.net` network requests |

### Communication Flow

```
chrome.webRequest.onBeforeRequest (background.js)
    | passively collects .mp4 URLs with efg metadata
    v
fbVideoUrls Map (background.js)  videoId -> { url, bitrate }
    ^
    | content script queries via chrome.runtime.sendMessage
    |
content.js - FacebookPlatform
    | extractImages()
    v
background.js - stores media per tab
    |
    v
popup.js - displays grid, triggers downloads
```

---

## Entry Point: `extractImages()`

```
extractImages()
  |
  +-- isReelPage? (/reel/ in URL)
  |     YES --> _extractReelVideo()
  |
  +-- isVideoPage? (/videos/pcb.xxx/videoId in URL)
  |     YES --> _fetchVideoUrlFromBackground(videoId)
  |
  +-- isPhotoPage? (/photo in path or fbid= in query)
  |     |
  |     +-- navigation button found?
  |     |     YES --> navigateCarousel()
  |     |     NO  --> static single image detection
  |     |
  |
  +-- none of the above --> return []
```

---

## Post Type 1: Single Photo

**Trigger:** URL contains `/photo` or `fbid=`, no navigation button found.

**Extraction steps:**

1. Queries `div[role="main"] img`.
2. Filters by size: `width > 150px` and `height > 150px`.
3. Excludes images with URLs containing `profile`, `icon`, or `emoji`.
4. Returns the first valid match.

---

## Post Type 2: Photo Carousel (Album)

**Trigger:** URL contains `/photo` or `fbid=`, and a navigation button is found.

Facebook renders one photo at a time in the album viewer. The extension clicks through the album to collect all images.

### Navigation strategy

`navigateCarousel()` clicks `div[data-visualcompletion="ignore-dynamic"]:nth-of-type(2) .html-div` to advance. Configuration:

- Max attempts: 100
- Wait between slides: 1000ms
- Stops when: no Next button found, or duplicate image detected

### Image deduplication

Three dedup keys per image:
- `img.src`
- `img.currentSrc`
- Facebook image ID extracted via `/(\d+)_\d+/` regex from the URL

When a duplicate is found, navigation stops (the album has looped).

---

## Post Type 3: Reel Video

**Trigger:** URL matches `/reel/\d+`.

Facebook Reels are server-side rendered with DASH manifest data embedded in `<script>` tags. The extension parses this data directly from the HTML.

### DASH Manifest Parsing: `_extractVideoUrlFromDashManifest()`

1. Scans all `<script>` elements for text containing `dash_manifests`.
2. Locates the `manifest_xml` JSON string value within the script.
3. Unescapes the JSON string (`\u003C` to `<`, `\/` to `/`, etc.).
4. Extracts `<AdaptationSet contentType="video">` using regex.
5. Finds all `<Representation>` elements with their `bandwidth` attribute.
6. Picks the `<BaseURL>` from the highest bandwidth representation.
7. Unescapes `&amp;` in the URL.

**Why regex instead of DOMParser:** The manifest XML contains unescaped `&` characters in URLs, which breaks standard XML parsing.

---

## Post Type 4: Mixed Carousel (Photos + Videos)

**Trigger:** URL contains `/photo` or `fbid=`, navigation button found, and the carousel contains video slides.

When navigating through a carousel, some slides may be video pages. The URL changes from `/photo/?fbid=xxx` to `/userId/videos/pcb.xxx/videoId` when a video slide is reached.

### Video URL collection via webRequest

The background service worker passively monitors all requests to `*.fbcdn.net`:

1. `chrome.webRequest.onBeforeRequest` filters for URLs containing `.mp4`.
2. Each MP4 URL's `efg` query parameter is decoded (base64 JSON) to extract `video_id` and `bitrate`.
3. For each video ID, only the highest bitrate URL is kept.
4. The `bytestart` and `byteend` query parameters are stripped from stored URLs.

### Video slide handling in `navigateCarousel()`

At each carousel step, the content script checks the current URL:

- **Photo page:** `tryCollectImage()` runs (same as photo carousel).
- **Video page** (`/videos/pcb.\d+/\d+`): `tryCollectVideo()` runs:
  1. Extracts `videoId` from the URL.
  2. Triggers video playback via `video.play()` and clicking the play button overlay (`[aria-label*="Play"]`).
  3. Sends `fetchFbVideoUrl` message to background, retrying up to 5 times with 1s delay between attempts.
  4. Background responds with the cached MP4 URL for that video ID.

### Why playback trigger is needed

Facebook carousel videos don't autoplay. The MP4 segments are only requested when the user initiates playback. Calling `video.play()` and clicking the play button forces the browser to start MSE downloads, which the `webRequest` listener captures.

### Video deduplication

Video items are deduplicated by `videoId` extracted from the URL.

---

## URL Patterns

| URL Pattern | Type |
|---|---|
| `/photo/?fbid=xxx` | Single photo or carousel entry |
| `/username/photos/xxx` | Single photo or carousel entry |
| `/reel/xxx` | Reel video |
| `/userId/videos/pcb.xxx/videoId` | Carousel video slide |

---

## `efg` Parameter

Facebook CDN URLs carry an `efg` query parameter containing base64-encoded JSON. The decoded JSON includes:

- `video_id`: unique identifier for the video (used as cache key)
- `bitrate`: video bitrate in bps (used to select the best quality)

This parameter is present on MP4 segment requests from `*.fbcdn.net` and is the only reliable way to associate a network request with a specific video.

---

## Data Shape

Each extracted media item has this shape:

```js
{
  index: Number,        // 1-based position
  alt: String,          // 'Image' or 'Video'
  thumbnailUrl: String, // poster image URL (empty for carousel videos)
  fullSizeUrl: String,  // CDN URL of the media
  maxWidth: Number,     // 0 for videos; image width otherwise
  mediaType: String     // 'image' or 'video'
}
```
