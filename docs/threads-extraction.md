# Threads Media Extraction Logic

This document describes how the extension extracts media from Threads posts.

## Supported Post Types

1. Single photo
2. Plain image carousel (multiple photos)
3. Single video
4. Multiple videos
5. Mixed carousel (photos + videos)

---

## Entry Point: `extractImages()`

`ThreadsPlatform.extractImages()` is synchronous (no page navigation required). The flow:

1. Parse the post ID from the current URL and look up the post in embedded hydration data via `_extractEmbeddedMediaByCode()` (shared with Instagram, defined on `BasePlatform`). If found, return that media list.
2. Otherwise, fall back to DOM scraping: find the post container via `_findTargetContainer()`.
3. Query all `img`, `picture img`, and `video` elements inside the container.
4. Determine post type from what was found and build the media list.

---

## Primary Path: Embedded Hydration Data

Threads includes the current post in an `application/json` script with the same shape as Instagram: an object whose `code` equals the post ID, carrying `carousel_media`, `image_versions2.candidates`, and `video_versions`.

This path is required for videos. Threads plays videos through MSE, so `video.src` is a page-scoped `blob:` URL that `chrome.downloads` cannot fetch and that has no file extension. `video_versions` provides the direct `cdninstagram.com` MP4 URL. Item conversion rules are identical to Instagram (see `instagram-extraction.md`).

Some posts embed another post's media (`media_type: 19`). Their own object only carries a cover image in `image_versions2` and `video_versions: null`; the real media is in `text_post_app_info.linked_inline_media`. When that object has media, the parser uses it as the source instead of the outer post.

The payload is only present for the post that was server-rendered. After SPA navigation to a different post, the lookup by `code` returns nothing and extraction falls back to the DOM.

---

## Container Identification: `_findTargetContainer()`

Threads feeds render multiple posts on the same page, each wrapped in a `div[data-pressable-container="true"]`. The method needs to find the container that belongs to the current URL.

**Steps:**

1. Query all `div[data-pressable-container="true"]` elements on the page.
2. Parse the post ID from the current URL:
   - `/@username/post/{postId}`
   - `/t/{postId}`
3. Find the container that has an `<a href>` pointing to the post ID.
4. If no container matches (e.g., URL format is unexpected), fall back to the first container.

---

## Post Type Detection

After querying the container, three element sets are collected:

| Variable | Selector | Description |
|---|---|---|
| `allImgs` | `img` | Every img in the container |
| `pictureImgs` | `picture img` | Imgs wrapped in a `<picture>` element |
| `videos` | `video` | Video elements |

Threads uses `<picture>` as the wrapper for carousel/gallery images. Regular single images are rendered as plain `<img>` without a `<picture>` wrapper.

The first `img` in `allImgs` is always the user's profile picture, so it is skipped in paths that use `allImgs`.

```
pictureImgs.length > 0?
  YES --> add picture imgs as photos
  NO, videos.length === 0? --> add allImgs.slice(1) as single image(s)

videos.length > 0?
  YES --> pair each video with a cover image, add as videos
```

Note: the photo and video branches run independently, so a mixed carousel (photos + videos) adds both.

---

## Post Type 1: Single Photo

**Condition:** `pictureImgs.length === 0` and `videos.length === 0`.

Takes `allImgs.slice(1)` (skipping the profile picture at index 0). In practice this yields one image for a single-photo post.

---

## Post Type 2: Photo Carousel

**Condition:** `pictureImgs.length > 0`.

All `img` elements inside `<picture>` tags are collected as the carousel photos. No pagination or DOM navigation is needed: Threads renders all carousel items in the DOM simultaneously.

The `<picture>` wrapper is the reliable signal that distinguishes carousel images from the profile picture (which is a plain `<img>`).

---

## Post Type 3/4: Video Post

**Condition:** `videos.length > 0`.

This is the DOM fallback, used only when embedded data is unavailable.

For each `<video>`:
- If `video.src` is empty, the video is skipped.
- If `video.src` is a `blob:` URL (MSE playback), the video is skipped with a warning, because the blob cannot be downloaded.
- The thumbnail is sourced from `coverImgs[index]`, where `coverImgs` is the list of `img` elements that are **not** inside a `<picture>`, with the first one (profile picture) removed.

This index-based pairing assumes Threads renders one cover image per video, in the same order.

---

## Post Type 5: Mixed Carousel (Photos + Videos)

**Condition:** `pictureImgs.length > 0` and `videos.length > 0`.

Both branches run. The result list contains photos first (from `pictureImgs`), followed by videos.

---

## Data Shape

Each extracted media item has this shape:

```js
{
  index: Number,        // 1-based position
  alt: String,          // image alt text, or 'Video' for videos
  thumbnailUrl: String, // cover image URL for videos (may be empty)
  fullSizeUrl: String,  // CDN URL of the media
  maxWidth: Number,     // 0 for videos; image width from srcset parsing otherwise
  mediaType: String     // 'image' or 'video'
}
```

---

## Saved Post Action

For a saved Threads post, the popup shows **Unsave & Download All**. Unlike Instagram and X, Threads puts the Unsave action inside the post's More menu instead of exposing a persistent save control. `ThreadsPlatform` scopes the lookup to the post container matched from the current URL, briefly opens that container's More menu to inspect its `role="menuitem"` entries, then closes it. This avoids confusing the target post with reply menus on the same page.

The combined action starts every directly downloadable item first. After Chrome accepts all downloads, it reopens the target post's More menu and clicks Unsave.

The popup delegates this complete sequence to the background service worker. Closing the popup after starting the action does not prevent the content script from receiving the final Unsave request.

The control lookup recognizes the known English and Traditional Chinese accessibility labels. If Threads changes or localizes this DOM contract, the combined action stays hidden rather than risking a click on an unrelated control.
