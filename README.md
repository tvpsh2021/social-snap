# Social Snap

A Chrome extension for downloading images and videos from social media posts. Supports Threads, Instagram, Facebook, and X.com.

## Features

- Download images and videos from a post with one click
- Thumbnail preview grid with media count
- Click individual thumbnails to download single items
- Automatically selects highest resolution available
- Auto-generates platform-specific filenames with timestamps
- Filters out profile pictures and UI elements
- Carousel/gallery navigation (auto-clicks through multi-media posts)

See [docs/platform-comparison.md](./docs/platform-comparison.md) for a detailed breakdown of supported media types per platform.

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
- `threads.com/@username/post/postId`
- `threads.com/t/postId`

**Instagram**
- `instagram.com/p/postId/`
- `instagram.com/username/p/postId/`
- `instagram.com/reel/reelId/`

**Facebook**
- `facebook.com/photo/?fbid=photoId`
- `facebook.com/username/photos/photoId`
- `facebook.com/reel/reelId`
- `facebook.com/userId/videos/pcb.xxx/videoId` (carousel video)

**X.com**
- `x.com/username/status/statusId` (video/GIF tweets)
- `x.com/username/status/statusId/photo/N`
- `x.com/username/status/statusId/video/N`

## Architecture

```
src/
  background/background.js        # Service worker: downloads, webRequest listener
  content/content.js               # Content script: platform detection & media extraction
  content/x-fetch-interceptor.js   # MAIN world script: X.com fetch/XHR interception
  popup/popup.html                 # Extension popup UI
  popup/popup.js                   # Popup controller
```

Each platform has its own extraction class inside `content.js`. Platform is detected from the current tab URL. The popup communicates with the background worker via `chrome.runtime.sendMessage`, and the background worker handles downloads and network request monitoring.

For platform-specific extraction details, see the docs:
- [Threads](./docs/threads-extraction.md)
- [Instagram](./docs/instagram-extraction.md)
- [Facebook](./docs/facebook-extraction.md)
- [X.com](./docs/x-extraction.md)

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
