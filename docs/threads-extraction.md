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

1. Find the post container via `_findTargetContainer()`.
2. Query all `img`, `picture img`, and `video` elements inside the container.
3. Determine post type from what was found and build the media list.

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

Threads exposes the real CDN URL directly in `video.src`. No blob URL workaround or performance entry scanning is needed (unlike Instagram).

For each `<video>`:
- If `video.src` is empty, the video is skipped.
- The thumbnail is sourced from `coverImgs[index]`, where `coverImgs` is the list of `img` elements that are **not** inside a `<picture>`, with the first one (profile picture) removed.

This index-based pairing assumes Threads renders one cover image per video, in the same order.

---

## Post Type 5: Mixed Carousel (Photos + Videos)

**Condition:** `pictureImgs.length > 0` and `videos.length > 0`.

Both branches run. The result list contains photos first (from `pictureImgs`), followed by videos.

---

## Key Differences from Instagram

| Aspect | Threads | Instagram |
|---|---|---|
| Video URL | Direct CDN URL in `video.src` | Blob URL; real URL requires performance entry scanning |
| `video.play()` needed | No | Yes (preload=none) |
| Carousel navigation | Not needed (all items in DOM) | Must click Next button repeatedly |
| Container scoping | Post ID matched from URL | `<main>` element |
| Profile picture exclusion | Skip first `img` | Not needed (boundary element filter) |
| `<picture>` wrapper | Used for carousel images | Not used |

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
