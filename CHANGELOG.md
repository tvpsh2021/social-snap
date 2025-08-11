# Changelog

All notable changes to the Threads Image Downloader extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2025-08-11

### Added
- **Instagram Support**: Full support for Instagram.com posts and reels
  - Supports regular posts: `https://www.instagram.com/p/postId/`
  - Supports reels: `https://www.instagram.com/reel/reelId/`
  - Automatic carousel navigation to load all images in multi-image posts
  - Platform-specific filename prefixes: `instagram_image_YYYYMMDDHHMMSS_N.jpg`

- **Smart URL Filtering**: Only activates on individual posts, ignores homepage/feed pages
  - Homepage exclusion: Blocks execution on `https://www.threads.com/` and `https://www.instagram.com/`
  - Profile page exclusion: Blocks execution on user profile pages
  - Clear error messages guiding users to navigate to individual posts

- **Modular Architecture**: Complete code refactoring for maintainability
  - Platform-specific classes: `ThreadsPlatform`, `InstagramPlatform`
  - Base platform abstraction: `BasePlatform` class
  - Factory pattern: `PlatformFactory` for automatic platform detection
  - Extensible design for future platforms (X.com, Facebook.com, etc.)

### Changed
- **Major Version Bump**: 1.0.1 → 2.0.0 due to breaking changes and new platform support
- **File Structure**: Reorganized codebase into modular `src/` directory structure
- **Manifest Configuration**: Updated URL matching patterns to be more precise
- **Error Handling**: Enhanced error messages with platform-specific guidance

### Technical Implementation
- **Bundle System**: Created bundle files to avoid ES6 module issues in Chrome extensions
- **URL Validation**: Multi-layer validation (manifest-level and runtime-level)
- **Instagram Carousel**: Programmatic navigation through lazy-loaded carousel images
- **Platform Detection**: Automatic platform detection based on URL patterns

## [1.0.1] - 2025-08-11

### Fixed
- **Extension Icon Display**: Fixed issue where extension icon was not showing properly in Chrome toolbar
  - Updated manifest.json icon configuration to use proper PNG format instead of SVG
  - Created PNG icons in multiple sizes (16x16, 32x32, 48x48, 128x128) for optimal display
  - Corrected icon path references and directory structure
  - Added icon generator tool for future maintenance
- **Manifest Localization**: Translated remaining Chinese text in manifest.json to English
  - Extension description: "下載 Threads 貼文中的所有圖片" → "Download all images from Threads.com posts with a single click"
  - Action title: "下載 Threads 圖片" → "Download Threads Images"

### Changed
- Updated extension version from 1.0 to 1.0.1
- Updated package.json version to maintain consistency

## [1.0.0] - 2025-08-10

### Added
- Initial release of Threads Image Downloader
- **Core Features**:
  - Automatic detection of images in Threads posts
  - Thumbnail preview grid showing all available images
  - One-click batch download of all images
  - Individual image download by clicking thumbnails
  - Smart filtering to exclude comment section images
  - Support for Instagram CDN security parameters

- **Development Infrastructure**:
  - Comprehensive ESLint configuration with 2-space indentation
  - HTMLHint for HTML code quality
  - Prettier for consistent formatting
  - EditorConfig for cross-editor consistency
  - Complete CONTRIBUTING.md with development guidelines
  - Cursor IDE specific rules (.cursorrules)

- **Technical Implementation**:
  - Chrome Extension Manifest V3 compatibility
  - Content script for DOM analysis and image extraction
  - Background service worker for download management
  - Responsive popup interface with modern UI design
  - Intelligent image resolution detection and selection

- **Internationalization**:
  - Complete English translation of all code, comments, and UI
  - Professional technical documentation
  - English-only development standards

### Technical Details
- **Supported Sites**: threads.com
- **Image Sources**: Instagram CDN, Facebook CDN
- **File Formats**: JPG, PNG, WebP, GIF
- **Browser**: Chrome (Manifest V3)
- **Permissions**: activeTab, downloads, storage
- **Architecture**: Content Script + Background Service Worker + Popup UI
