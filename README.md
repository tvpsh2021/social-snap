# Social Snap

A Chrome extension for downloading images and videos from social media posts. Supports Threads, Instagram, Facebook, and X.com.

## Features

- Download all images from a post with one click
- Thumbnail preview grid with image count
- Click individual thumbnails to download single images
- Automatically selects highest resolution from `srcset`
- Auto-generates platform-specific filenames with timestamps
- Filters out profile pictures and comment section images
- Carousel/gallery navigation (auto-clicks through multi-image posts)

## Installation

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked" and select the project folder

## Usage

Navigate to an individual post on a supported platform, then click the extension icon.

- **Download all**: Click "Download All Images"
- **Download one**: Click any thumbnail

Files are saved to your default download location with names like `threads_image_20240101120000_1.jpg`.

## Supported URLs

The extension only activates on individual post pages, not feeds or profile pages.

**Threads**
- `https://www.threads.com/@username/post/postId`
- `https://www.threads.com/t/postId`

**Instagram**
- `https://www.instagram.com/p/postId/`
- `https://www.instagram.com/reel/reelId/`

**Facebook**
- `https://www.facebook.com/photo/?fbid=photoId`
- `https://www.facebook.com/username/photos/photoId`

**X.com**
- `https://x.com/username/status/statusId/photo/1` (photo mode only)

## Architecture

```
src/
  content/background.js   # Service worker — download management
  content/content.js       # Content script — platform detection & media extraction
  popup/popup.html         # Extension popup UI
  popup/popup.js           # Popup controller
```

Each platform has its own extraction logic inside `content.js`. Platform is detected from the current tab URL. The popup communicates with the content script via `chrome.tabs.sendMessage`, and the background worker handles all `chrome.downloads` calls.

Platform-specific notes:
- **Threads**: Reads `<picture>` tags, filters images by DOM position to exclude comment section
- **Instagram**: Auto-navigates carousel by clicking the Next button, handles lazy-loaded images
- **Facebook**: Navigates photo albums, detects highest resolution variant
- **X.com**: Handles photo mode carousel, scoped to dialog container

## Development

```bash
npm install     # Install dev dependencies
npm run lint    # Run ESLint
npm run lint:fix
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for code standards and how to add new platform support.

## Troubleshooting

**No images detected**
- Make sure you are on an individual post page, not a feed or profile
- Wait for the page to fully load before opening the popup
- For Instagram/Facebook carousels, the extension navigates automatically — this can take 10-30 seconds
- Refresh and try again if it still fails

**Download failed**
- Check Chrome's download permissions
- Check available disk space

## Notes

- Chrome only (Manifest V3)
- Respect copyright — only download content you have permission to use
