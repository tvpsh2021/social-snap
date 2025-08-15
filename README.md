# Social Snap

Social Snap is a Chrome extension that allows you to download all images from Threads.com, Instagram.com, and Facebook.com posts with a single click.

## Features

- 🖼️ **Multi-Platform Support**: Works on Threads.com, Instagram.com, and Facebook.com
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

1. Navigate to any **individual post** on **Threads.com**, **Instagram.com**, or **Facebook.com**
   - ✅ Supported: `https://www.threads.com/@username/post/postId`
   - ✅ Supported: `https://www.instagram.com/p/postId/`
   - ✅ Supported: `https://www.facebook.com/photo/?fbid=photoId`
   - ❌ Not supported: Homepage feeds (`https://www.threads.com/`, `https://www.instagram.com/`, `https://www.facebook.com/`)
2. Click the extension icon in your browser toolbar
3. Wait for the extension to analyze images on the page
4. View thumbnail previews and total image count
5. **Batch download**: Click "Download All Images" button
6. **Single download**: Click any thumbnail to download that image
7. Images will be automatically downloaded to your default download folder with platform-specific filenames:
   - Threads: `threads_image_YYYYMMDDHHMMSS_1.jpg`
   - Instagram: `instagram_image_YYYYMMDDHHMMSS_1.jpg`
   - Facebook: `facebook_image_YYYYMMDDHHMMSS_1.jpg`

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

### ❌ Excluded URL Patterns

**Homepage/Feed Pages:**
- `https://www.threads.com/` - Threads homepage
- `https://www.instagram.com/` - Instagram homepage
- Any URL with query parameters on homepage (e.g., `?tab=following`)

**Profile Pages:**
- `https://www.threads.com/@username` - User profiles
- `https://www.instagram.com/username/` - User profiles

When you try to use the extension on unsupported pages, you'll see a helpful error message guiding you to navigate to an individual post.

## Technical Implementation

### Refactored Architecture (2024)

The extension has been completely refactored to follow modern software architecture principles with a clean, modular, and extensible design:

#### **Core Architecture Layers**
```
┌─────────────────────────────────────────────────────────────┐
│                        Popup UI Layer                       │
├─────────────────────────────────────────────────────────────┤
│                    Service Layer                            │
├─────────────────────────────────────────────────────────────┤
│                 Platform Abstraction Layer                  │
├─────────────────────────────────────────────────────────────┤
│                    Core Services                            │
├─────────────────────────────────────────────────────────────┤
│                 Chrome Extension APIs                       │
└─────────────────────────────────────────────────────────────┘
```

#### **Key Architectural Principles**
- **Single Responsibility**: Each module has one clear purpose
- **Dependency Injection**: Services are injected rather than directly instantiated
- **Interface Segregation**: Small, focused interfaces rather than large ones
- **Open/Closed Principle**: Open for extension, closed for modification

#### **Core Services**
- **MessageBusService**: Type-safe inter-component communication with request-response patterns
- **ErrorHandlerService**: Centralized error handling with custom error types and recovery strategies
- **LoggingService**: Structured logging with different levels and context tracking
- **ConfigurationService**: Centralized configuration management with validation
- **DownloadManagerService**: Enhanced download management with retry logic, progress tracking, and batch processing
- **NotificationService**: User feedback and notification management

#### **Platform System**
- **BasePlatformExtractor**: Abstract base class enforcing interface contracts and providing common functionality
- **PlatformRegistry**: Dynamic platform detection and factory system for creating extractors
- **ThreadsExtractor**: Specialized extractor for Threads.com with advanced comment filtering
- **InstagramExtractor**: Enhanced Instagram support with smart carousel navigation and lazy loading
- **FacebookExtractor**: Facebook post and photo extraction with album navigation
- **Extensible Design**: Easy to add new platforms through the registry system

#### **Enhanced Image Detection**
- **Multi-Strategy Extraction**: Each platform uses multiple extraction strategies for maximum reliability
- **Smart Filtering**: Advanced filtering to exclude UI elements, profile pictures, and comment images
- **High-Resolution Selection**: Automatic selection of highest quality images from srcset attributes
- **Metadata Preservation**: Comprehensive metadata tracking including extraction context and timing

#### **Advanced Download System**
- **Batch Processing**: Concurrent downloads with configurable limits
- **Retry Mechanism**: Automatic retry with exponential backoff for failed downloads
- **Progress Tracking**: Real-time progress updates with detailed statistics
- **Queue Management**: Sophisticated download queue with priority and status tracking
- **Error Recovery**: Comprehensive error handling with user-friendly messages

### Refactored File Structure
```
src/
├── core/                           # Core Infrastructure
│   ├── interfaces/                 # Interface definitions
│   │   ├── IPlatformExtractor.js   # Platform extractor interface
│   │   ├── IDownloadManager.js     # Download manager interface
│   │   ├── IMessageBus.js          # Message bus interface
│   │   ├── IErrorHandler.js        # Error handler interface
│   │   └── ILogger.js              # Logger interface
│   ├── services/                   # Core services
│   │   ├── MessageBusService.js    # Inter-component communication
│   │   ├── ErrorHandlerService.js  # Centralized error handling
│   │   ├── LoggingService.js       # Structured logging
│   │   ├── ConfigurationService.js # Configuration management
│   │   ├── NotificationService.js  # User notifications
│   │   └── ServiceContainer.js     # Dependency injection container
│   └── types/                      # Type definitions
│       ├── MessageTypes.js         # Message type definitions
│       ├── ImageTypes.js           # Image data types
│       ├── ErrorTypes.js           # Error type definitions
│       └── DownloadTypes.js        # Download-related types
├── platforms/                      # Platform-specific extractors
│   ├── base/                       # Base platform functionality
│   │   ├── BasePlatformExtractor.js # Abstract base class
│   │   └── PlatformRegistry.js     # Platform detection and factory
│   ├── threads/                    # Threads.com support
│   │   └── ThreadsExtractor.js     # Threads-specific extraction
│   ├── instagram/                  # Instagram.com support
│   │   └── InstagramExtractor.js   # Instagram-specific extraction
│   └── facebook/                   # Facebook.com support
│       └── FacebookExtractor.js    # Facebook-specific extraction
├── background/                     # Background service worker
│   ├── BackgroundService.js        # Main background service
│   ├── DownloadManagerService.js   # Enhanced download management
│   └── background-main.js          # Service worker entry point
├── content/                        # Content scripts
│   ├── ContentService.js           # Content script coordination
│   ├── ImageExtractionService.js   # Image extraction coordination
│   └── content-main.js             # Content script entry point
├── popup/                          # Popup interface
│   ├── components/                 # Modular UI components
│   │   ├── ImageGridComponent.js   # Image grid display
│   │   ├── StatusDisplayComponent.js # Status messages
│   │   ├── ProgressBarComponent.js # Download progress
│   │   └── NotificationDisplayComponent.js # Notifications
│   ├── services/                   # Popup business logic
│   │   └── PopupService.js         # Popup state management
│   ├── popup-main.js               # Popup controller
│   └── popup.html                  # Popup interface
└── shared/                         # Shared utilities
    ├── utils/                      # Utility functions
    │   ├── DOMUtils.js             # DOM manipulation utilities
    │   ├── URLUtils.js             # URL parsing and validation
    │   └── ValidationUtils.js      # Data validation utilities
    ├── constants/                  # Application constants
    │   └── PlatformConstants.js    # Platform-specific constants
    └── message-types.js            # Legacy message types (compatibility)
```

## Supported Platforms

| Platform | Status | Features |
|----------|--------|----------|
| **Threads.com** | ✅ Fully Supported | Smart comment filtering, position-based detection |
| **Instagram.com** | ✅ Fully Supported | Smart carousel navigation, lazy loading handling, profile picture filtering |
| **Facebook.com** | ✅ Fully Supported | Photo album navigation, individual photo extraction, automatic resolution detection |
| **X.com (Twitter)** | 🔄 Planned | Coming in future version |

## Notes

- Only supports Chrome browser (Manifest V3)
- Must be used on supported social media post pages
- Downloaded images are saved to browser's default download location
- Please respect copyright laws and only download images you have permission to use

## Troubleshooting

### Cannot Detect Images
- Ensure you are on a supported platform (Threads.com, Instagram.com, or Facebook.com) post page
- Wait for the page to fully load before opening the extension
- **For Instagram carousels**: The extension will automatically navigate through all images, which may take 10-30 seconds
- **For Facebook albums**: The extension will automatically navigate through photo albums
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

The refactored architecture makes adding new social media platforms straightforward through the platform registry system:

#### **Step-by-Step Guide**

1. **Create Platform Extractor**
   ```javascript
   // src/platforms/twitter/TwitterExtractor.js
   import { BasePlatformExtractor } from '../base/BasePlatformExtractor.js';
   import { PLATFORMS } from '../../shared/constants/PlatformConstants.js';

   export class TwitterExtractor extends BasePlatformExtractor {
     constructor(dependencies, config = {}) {
       super(dependencies, config);
     }

     get platformName() {
       return PLATFORMS.TWITTER;
     }

     get supportedUrlPatterns() {
       return ['twitter.com', 'x.com'];
     }

     async extractImages() {
       this._startExtraction();

       // Platform-specific extraction logic
       const images = await this._extractTwitterImages();

       return this._completeExtraction(images);
     }

     async _extractTwitterImages() {
       // Implementation for Twitter image extraction
       // Use this.logger, this.errorHandler, and this.config
       // Return array of HTMLImageElement
     }
   }
   ```

2. **Register Platform**
   ```javascript
   // In ContentService or initialization code
   this.platformRegistry.register(
     PLATFORMS.TWITTER,
     TwitterExtractor,
     { name: 'Twitter/X', hostnames: ['twitter.com', 'x.com'] },
     ['image_extraction', 'thread_extraction']
   );
   ```

3. **Add Platform Constants**
   ```javascript
   // src/shared/constants/PlatformConstants.js
   export const PLATFORMS = {
     // ... existing platforms
     TWITTER: 'twitter'
   };
   ```

4. **Test Implementation**
   - The platform will be automatically detected and used
   - All core services (logging, error handling, messaging) are available
   - No changes needed to popup, background, or other components

#### **Platform Extractor Benefits**
- **Automatic Integration**: Once registered, the platform works with all existing UI and download functionality
- **Built-in Services**: Access to logging, error handling, configuration, and messaging services
- **Common Utilities**: Image validation, DOM utilities, and extraction helpers provided by base class
- **Consistent Interface**: All platforms follow the same interface contract
- **Error Recovery**: Automatic error handling and user feedback through the error handler service
