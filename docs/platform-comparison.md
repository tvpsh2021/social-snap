# Platform Comparison

A side-by-side comparison of how each platform's media extraction works.

## Supported Media Types

| Media Type | Instagram | Threads | Facebook | X.com |
|---|---|---|---|---|
| Single photo | Yes | Yes | Yes | Yes |
| Photo carousel | Yes | Yes | Yes | Yes |
| Single video | Yes | Yes | Yes (Reel) | Yes |
| Multiple videos | No | Yes | No | Yes |
| Mixed carousel (photos + videos) | Yes | Yes | Yes | Yes |
| GIF (MP4) | N/A | N/A | N/A | Yes |
| HLS video (yt-dlp fallback) | No | No | No | Yes |

## Video URL Resolution

| Aspect | Instagram | Threads | Facebook | X.com |
|---|---|---|---|---|
| URL in DOM | Blob URL (MSE) | Direct CDN URL in `video.src` | Blob URL (MSE) for carousel videos; `<script>` tags contain DASH manifest for Reels | Direct `src` for GIFs; no `src` for regular videos |
| Resolution method | `performance.getEntriesByType('resource')` scanning for `.mp4` on `fbcdn.net`/`cdninstagram.com` | Read `video.src` directly | Reel: DASH manifest parsing from SSR `<script>` tags. Carousel video: `chrome.webRequest.onBeforeRequest` passively collects `.mp4` URLs from `*.fbcdn.net`, parses `efg` query param (base64 JSON with `video_id` and `bitrate`) | Fetch API interception (`video_info.variants` from GraphQL/REST responses) |
| `video.play()` needed | Yes (`preload=none`) | No | Yes (carousel videos need play trigger to start MSE download) | No |
| GIF handling | N/A | N/A | N/A | Detect `tweet_video/` in `video.src`, download MP4 directly |
| Fallback | None | None | None | Performance entries, then tweet URL for yt-dlp |

## Carousel Navigation

| Aspect | Instagram | Threads | Facebook | X.com |
|---|---|---|---|---|
| Navigation required | Yes (click Next button) | No (all items in DOM) | Yes (click Next button) | Yes (click Next button) |
| Max attempts | 50 | N/A | 100 | 10 |
| Wait between slides | 1000ms | N/A | 1000ms | 1000ms |
| Items in DOM at once | 3 (sliding window) | All | 1 (swaps on click) | 2 initially, lazy-loaded |
| Next button selector | `button[tabindex="-1"]` (right-positioned) | N/A | `div[data-visualcompletion="ignore-dynamic"]:nth-of-type(2) .html-div` | `div[data-testid="Carousel-NavRight"] button` |

## Container Scoping

| Aspect | Instagram | Threads | Facebook | X.com |
|---|---|---|---|---|
| Root container | `<main>` element | `div[data-pressable-container="true"]` matched by post ID from URL | `div[role="main"]` | `div[role="dialog"]` (photo/video mode) or `article[data-testid="tweet"]` (plain tweet) |
| Boundary filter | "More posts from" text in `div`/`h2`/`span` | Skip first `img` (profile picture) | Image URL exclusion (`profile`, `icon`, `static`) | `div[aria-expanded="true"]` |

## Deduplication

| Aspect | Instagram | Threads | Facebook | X.com |
|---|---|---|---|---|
| Image dedup | `img.src` as map key | `img.src` as map key | src + currentSrc + Facebook image ID (`/\d+_\d+/` from URL) | `img.src` as map key |
| Video dedup | Cleaned URL (strip `bytestart`/`byteend`) + `efg` asset ID | N/A (direct `src`) | `video_id` from `efg` param (base64 JSON) | `video.poster` URL or element reference |

## Minimum Image Size

| Platform | Width | Height |
|---|---|---|
| Instagram | 150px | 150px |
| Threads | No minimum (uses `<picture>` wrapper as signal) | No minimum |
| Facebook | 200px | 200px |
| X.com | 150px (50px in carousel) | 150px (50px in carousel) |

## Architecture

| Aspect | Instagram | Threads | Facebook | X.com |
|---|---|---|---|---|
| World | Isolated | Isolated | Isolated + Background service worker (`webRequest` listener) | Isolated + MAIN world (fetch interceptor) |
| Async extraction | Yes (carousel navigation + `play()`) | No (synchronous) | Yes (carousel navigation + video URL collection via background) | Yes (carousel navigation + API interception) |
| External script | None | None | None (`background.js` handles `webRequest`) | `x-fetch-interceptor.js` patches `fetch` and `XMLHttpRequest` in MAIN world |
