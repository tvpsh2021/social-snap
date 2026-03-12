# Social Snap

Social Snap is a Chrome extension that allows you to download all images from Threads.com, Instagram.com, Facebook.com, and X.com posts with a single click.

## Features

- 🖼️ **Multi-Platform Support**: Works on Threads.com, Instagram.com, Facebook.com, and X.com
- 🎯 **Smart URL Filtering**: Only activates on individual posts, ignores homepage/feed pages
- 🔍 Display image thumbnail previews
- 📊 Show total count of downloadable images
- ⬇️ Batch download all images with one click
- 🎯 Automatically select highest resolution images
- 📁 Auto-generate platform-specific filenames for downloaded images
- 🖱️ Click thumbnails to download individual images
- 🛡️ Smart filtering of comment section images (Threads)
- 📱 Support for Instagram CDN security parameters
- 🏗️ **Extensible Architecture**: Easy to add support for more platforms (X.com, Facebook, etc.)

## Installation

1. Download or clone this project to your local machine
2. Open Chrome browser
3. Navigate to `chrome://extensions/`
4. Enable "Developer mode" in the top right corner
5. Click "Load unpacked"
6. Select this project's folder
7. The extension will appear in your browser toolbar

## Usage

1. Navigate to any **individual post** on **Threads.com**, **Instagram.com**, **Facebook.com**, or **X.com**
   - ✅ Supported: `https://www.threads.com/@username/post/postId`
   - ✅ Supported: `https://www.instagram.com/p/postId/`
   - ✅ Supported: `https://www.facebook.com/photo/?fbid=photoId`
   - ✅ Supported: `https://x.com/username/status/statusId/photo/1` - Photo mode only
   - ❌ Not supported: Homepage feeds (`https://www.threads.com/`, `https://www.instagram.com/`, `https://www.facebook.com/`, `https://x.com/`)
2. Click the extension icon in your browser toolbar
3. Wait for the extension to analyze images on the page
4. View thumbnail previews and total image count
5. **Batch download**: Click "Download All Images" button
6. **Single download**: Click any thumbnail to download that image
7. Images will be automatically downloaded to your default download folder with platform-specific filenames:
   - Threads: `threads_image_YYYYMMDDHHMMSS_1.jpg`
   - Instagram: `instagram_image_YYYYMMDDHHMMSS_1.jpg`
   - Facebook: `facebook_image_YYYYMMDDHHMMSS_1.jpg`
   - X.com: `x_image_YYYYMMDDHHMMSS_1.jpg`

## Supported URLs

This extension **only works on individual posts**, not on homepage feeds or profile pages.

### ✅ Supported URL Patterns

**Threads.com:**
- `https://www.threads.com/@username/post/postId` - Standard post format
- `https://www.threads.com/t/postId` - Short post format

**Instagram.com:**
- `https://www.instagram.com/p/postId/` - Regular posts
- `https://www.instagram.com/reel/reelId/` - Reels

**Facebook.com:**
- `https://www.facebook.com/photo/?fbid=photoId` - Individual photos
- `https://www.facebook.com/username/photos/photoId` - User photos

**X.com:**
- `https://x.com/username/status/statusId/photo/1` - Photo mode view (carousel mode only)

### ❌ Excluded URL Patterns

**Homepage/Feed Pages:**
- `https://www.threads.com/` - Threads homepage
- `https://www.instagram.com/` - Instagram homepage
- `https://x.com/` - X.com homepage
- `https://x.com/home` - X.com home feed
- Any URL with query parameters on homepage (e.g., `?tab=following`)

**Profile Pages:**
- `https://www.threads.com/@username` - User profiles
- `https://www.instagram.com/username/` - User profiles

When you try to use the extension on unsupported pages, you'll see a helpful error message guiding you to navigate to an individual post.

## Technical Implementation

### Architecture
The extension uses a **platform-based architecture** where each social media platform has its own detection and extraction logic. All platform handlers are bundled into `content.js` with automatic platform detection based on URL patterns.

**Key Components:**
- **Content Script** (`content.js`): Platform detection, image extraction, and carousel navigation
- **Popup** (`popup.js`): User interface, image preview grid, and download triggers
- **Background Service** (`background.js`): Download management and inter-component messaging

### Image Detection
Each platform has specialized extraction logic:
- **Threads.com**: Uses `<picture>` tags with smart comment filtering
- **Instagram.com**: Smart carousel navigation with automatic Next button clicking
- **Facebook.com**: Photo album navigation with automatic resolution detection
- **X.com**: Photo mode carousel support (requires `/photo/` URL)

**Common features across all platforms:**
- Parses `srcset` attributes for highest resolution images
- Preserves CDN security parameters
- Filters out UI elements and profile pictures

### Download Mechanism
- Uses Chrome Downloads API for batch and single downloads
- Auto-generates platform-specific timestamped filenames
- Smart file extension detection from URL
- Adds intervals between downloads to avoid server stress

### File Structure
```
social-snap/
├── manifest.json              # Extension configuration (Manifest V3)
├── src/
│   ├── content/
│   │   └── content.js         # Content script - platform detection & image extraction
│   ├── popup/
│   │   ├── popup.html         # Popup interface
│   │   └── popup.js           # Popup controller & UI logic
│   └── background/
│       └── background.js      # Background service worker & download manager
├── assets/
│   ├── icons/                 # Extension icons (16px, 32px, 48px, 128px)
│   └── icon.svg               # Source icon
├── platform-samples/          # Sample HTML files for testing
├── README.md                  # Documentation
└── CONTRIBUTING.md            # Development guidelines
```

## Supported Platforms

| Platform | Status | Features |
|----------|--------|----------|
| **Threads.com** | ✅ Fully Supported | Smart comment filtering, position-based detection |
| **Instagram.com** | ✅ Fully Supported | Smart carousel navigation, lazy loading handling, profile picture filtering |
| **Facebook.com** | ✅ Fully Supported | Photo album navigation, individual photo extraction, automatic resolution detection |
| **X.com** | ✅ Fully Supported | Carousel navigation, dialog container detection, photo mode support |

## Notes

- Only supports Chrome browser (Manifest V3)
- Must be used on supported social media post pages
- Downloaded images are saved to browser's default download location
- Please respect copyright laws and only download images you have permission to use

## Troubleshooting

### Cannot Detect Images
- Ensure you are on a supported platform (Threads.com, Instagram.com, Facebook.com, or X.com) post page
- Wait for the page to fully load before opening the extension
- **For Instagram carousels**: The extension will automatically navigate through all images, which may take 10-30 seconds
- **For Facebook albums**: The extension will automatically navigate through photo albums
- **For X.com carousels**: The extension will automatically navigate through multi-image tweets
- Try refreshing the page and retry
- Check browser console for error messages

### Download Failed
- Check browser download permissions
- Ensure sufficient disk space
- Check network connection

## Documentation

This project maintains several documentation files to help developers and contributors. Please read the relevant documentation before starting development:

### 📚 Documentation Index

| File | Purpose | When to Read |
|------|---------|--------------|
| **[README.md](./README.md)** | Project overview, installation, and usage instructions | First time users and general project information |
| **[CONTRIBUTING.md](./CONTRIBUTING.md)** | Development guidelines, code standards, and contribution process | **Required reading before any development work** |
| **[.cursorrules](./.cursorrules)** | Cursor IDE specific development rules and standards | When using Cursor IDE for development |

### 🛠️ Development Setup

Before starting development, ensure you have the necessary tools:

```bash
# Install development dependencies
npm install

# Run code linting
npm run lint

# Auto-fix linting issues
npm run lint:fix
```

## Contributing

If you want to contribute to this project, please read our development guidelines first:

📖 **[CONTRIBUTING.md](./CONTRIBUTING.md)** - **REQUIRED READING** for all developers

**Key development standards summary:**
- All code, comments, documentation, and commit messages must be in English
- Use 2-space indentation (no tabs)
- Follow modern JavaScript development standards
- Use ESLint for code quality and consistency
- Use Conventional Commits format for commit messages
- Ensure code is tested before submission

**We welcome all forms of contributions:**
- 🐛 Bug reports and error reporting
- 💡 New feature suggestions
- 🔧 Fixing existing issues
- 📝 Documentation improvements
- 🧪 Adding test coverage

**For AI Assistants and Automated Tools:**
Please ensure you read and follow all documentation files listed above, especially CONTRIBUTING.md and .cursorrules, before making any code changes.

## Developer Information

This extension is developed using Chrome Extension Manifest V3, with main technologies including:
- Chrome Extensions API
- DOM manipulation and image analysis
- Chrome Downloads API
- Modern JavaScript (ES6+) with ES Modules
- Smart image filtering algorithms


### Adding New Platforms

The extension is designed to be extensible. When adding support for a new social media platform:

**Quick Checklist:**
1. **Content Script** (`src/content/content.js`): Add platform detection, URL patterns, and extraction logic
2. **⚠️ Background Script** (`src/background/background.js`): Update filename generation in `downloadAllImages()` and `downloadSingleImage()` methods
3. **Manifest** (`manifest.json`): Add host permissions and content script URL matches
4. **Documentation**: Update README.md with new platform information

**⚠️ Most Commonly Forgotten Step:**
Updating the platform name detection in `background.js` for filename generation, which results in `unknown_xxxxx.jpg` instead of `platformname_xxxxx.jpg`.

📖 **For detailed step-by-step instructions, see [CONTRIBUTING.md](./CONTRIBUTING.md#adding-new-platform-support).**
