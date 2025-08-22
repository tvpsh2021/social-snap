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

### Multi-Platform Architecture
- **BasePlatform**: Abstract base class for all platforms
- **ThreadsPlatform**: Specialized extractor for Threads.com
- **InstagramPlatform**: Specialized extractor for Instagram.com
- **FacebookPlatform**: Specialized extractor for Facebook.com
- **XPlatform**: Specialized extractor for X.com
- **PlatformFactory**: Automatically detects and creates appropriate platform instance
- **Extensible Design**: Easy to add new platforms

### Image Detection
- **Threads.com**:
  - Uses `<picture>` tags and `alt` attribute patterns (`可能是`)
  - Smart filtering of comment section images
  - Position-based detection for main post content
- **Instagram.com**:
  - **Smart Carousel Navigation**: Automatically navigates through all images in multi-image posts
  - Handles Instagram's lazy loading mechanism by programmatically clicking Next button
  - Detects images in main article containers and carousel/slideshow
  - Filters out profile pictures and UI elements
  - Supports all Instagram CDN image formats
- **X.com**:
  - **Photo Mode Required**: Only works in photo mode (URLs with `/photo/`)
  - **Carousel Support**: Automatically navigates through multi-image tweets
  - Detects images in dialog containers and carousel lists
  - Handles X.com's dynamic loading of images
  - Access photo mode by clicking on any image in a tweet
- **Common Features**:
  - Parses `srcset` attribute to find highest resolution versions
  - Preserves Instagram CDN security parameters

### Download Mechanism
- Uses Chrome Downloads API for batch downloading
- Auto-generates timestamped filenames
- Smart file extension detection
- Adds download intervals to avoid server stress
- Supports Instagram CDN security parameters

### File Structure
```
social-snap/
├── manifest.json                    # Extension configuration
├── src/                            # Source code directory
│   ├── content/                    # Content Scripts
│   │   ├── platforms/             # Platform-specific logic
│   │   │   ├── base-platform.js   # Base platform class
│   │   │   ├── threads-platform.js # Threads.com handler
│   │   │   └── instagram-platform.js # Instagram.com handler
│   │   ├── platform-factory.js    # Platform detection & creation
│   │   └── content-main.js         # Main content script
│   ├── popup/                      # Popup UI & Logic
│   │   ├── components/            # UI Components
│   │   │   ├── image-grid.js      # Image grid display
│   │   │   └── status-display.js   # Status messages
│   │   ├── popup-main.js          # Main popup controller
│   │   └── popup.html             # Popup interface
│   ├── background/                 # Background Scripts
│   │   ├── download-manager.js     # Download handling
│   │   └── background-main.js      # Main background service
│   └── shared/                     # Shared Modules
│       ├── constants.js            # App constants
│       ├── message-types.js        # Message type definitions
│       └── utils.js                # Utility functions
├── assets/                         # Static Assets
│   ├── icons/                     # Extension icons
│   └── icon.svg                   # Source icon
└── README.md                       # Documentation
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

### Modular Architecture

The extension follows a clean, modular architecture:

#### **Platform System**
- **BasePlatform**: Abstract base class defining the interface for all platforms
- **Platform-specific classes**: Each social media platform has its own handler (ThreadsPlatform, InstagramPlatform)
- **PlatformFactory**: Automatically detects and instantiates the correct platform handler

#### **Shared Modules**
- **Constants**: Centralized configuration and selectors
- **Utils**: Common utility functions used across modules
- **Message Types**: Standardized communication between extension components

#### **Component Structure**
- **Content Scripts**: Handle page analysis and image extraction
- **Popup Components**: Modular UI components for the extension popup
- **Background Services**: Manage downloads and inter-component communication

### Adding New Platforms

⚠️ **CRITICAL:** When adding new platform support, the most commonly forgotten step is updating the download filename generation in `src/background/background.js`, resulting in `unknown_xxxxx.jpg` filenames.

**Complete New Platform Checklist:**

1. **Content Script (`src/content/content.js`):**
   - Add platform constants and URL patterns
   - Create new Platform class extending `BasePlatform`
   - Update platform detection functions

2. **⚠️ Background Script (`src/background/background.js`) - DON'T FORGET:**
   - Update `downloadAllImages()` method with platform detection
   - Update `downloadSingleImage()` method with platform detection

3. **Manifest (`manifest.json`):**
   - Add host permissions and content script matches

4. **Documentation:**
   - Update README.md and other docs

**Example Background Script Update (Critical Step):**
```javascript
// In both downloadAllImages() and downloadSingleImage() methods:
if (tab.url.includes('threads.com')) {
  platformName = 'threads';
} else if (tab.url.includes('instagram.com')) {
  platformName = 'instagram';
} else if (tab.url.includes('facebook.com')) {
  platformName = 'facebook';
} else if (tab.url.includes('x.com')) {  // ← ADD THIS
  platformName = 'x';
}
```

**Testing Checklist:**
- ✅ Verify filename starts with correct platform name (not "unknown")
- ✅ Test image detection and extraction
- ✅ Test multi-image carousels if applicable

📖 **See [CONTRIBUTING.md](./CONTRIBUTING.md#adding-new-platform-support) for detailed development guidelines.**
