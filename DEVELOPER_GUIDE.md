# Developer Guide

## Overview

This guide provides comprehensive information for developers working on the Social Snap Chrome extension. The extension has been refactored to follow modern software architecture principles with a clean, modular, and extensible design.

## Architecture Overview

### Core Principles

The extension follows these key architectural principles:

1. **Single Responsibility Principle**: Each class and module has one clear purpose
2. **Dependency Injection**: Services are injected rather than directly instantiated
3. **Interface Segregation**: Small, focused interfaces rather than large monolithic ones
4. **Open/Closed Principle**: Open for extension, closed for modification
5. **Separation of Concerns**: Clear boundaries between UI, business logic, and data layers

### Service-Oriented Architecture

The extension uses a service-oriented architecture with the following layers:

```
┌─────────────────────────────────────────────────────────────┐
│                        Popup UI Layer                       │
│  - ImageGridComponent, StatusDisplayComponent, etc.         │
├─────────────────────────────────────────────────────────────┤
│                    Service Layer                            │
│  - PopupService, ContentService, BackgroundService          │
├─────────────────────────────────────────────────────────────┤
│                 Platform Abstraction Layer                  │
│  - BasePlatformExtractor, PlatformRegistry                  │
├─────────────────────────────────────────────────────────────┤
│                    Core Services                            │
│  - MessageBus, ErrorHandler, Logger, DownloadManager        │
├─────────────────────────────────────────────────────────────┤
│                 Chrome Extension APIs                       │
│  - chrome.runtime, chrome.downloads, chrome.tabs           │
└─────────────────────────────────────────────────────────────┘
```

## Core Services

### MessageBusService

Handles all inter-component communication with type-safe message definitions.

**Key Features:**
- Request-response pattern with timeout handling
- Message subscription and routing
- Automatic error handling and retry logic
- Support for both sync and async messaging

**Usage Example:**
```javascript
// Send a message and wait for response
const response = await messageBus.send(
  createMessage(MessageTypes.EXTRACT_IMAGES, { url: currentUrl })
);

// Subscribe to messages
messageBus.subscribe(MessageTypes.DOWNLOAD_COMPLETE, (message) => {
  console.log('Download completed:', message.payload);
});
```

### ErrorHandlerService

Centralized error handling with custom error types and recovery strategies.

**Key Features:**
- Custom ExtensionError types with error codes
- Automatic error recovery strategies
- User-friendly error messages
- Error statistics and reporting

**Usage Example:**
```javascript
try {
  await riskyOperation();
} catch (error) {
  const result = await errorHandler.handleError(error, {
    context: 'image_extraction',
    platform: 'instagram'
  });

  if (result.shouldRetry) {
    // Retry the operation
  }
}
```

### LoggingService

Structured logging with different levels and context tracking.

**Key Features:**
- Multiple log levels (debug, info, warn, error)
- Contextual logging with metadata
- Performance tracking
- Log filtering and formatting

**Usage Example:**
```javascript
logger.info('Starting image extraction', {
  platform: 'threads',
  url: window.location.href,
  timestamp: Date.now()
});

logger.error('Extraction failed', {
  error: error.message,
  context: { platform, imageCount: 0 }
});
```

### DownloadManagerService

Enhanced download management with batch processing, retry logic, and progress tracking.

**Key Features:**
- Concurrent downloads with configurable limits
- Automatic retry with exponential backoff
- Real-time progress tracking
- Queue management with priority support

**Usage Example:**
```javascript
// Download single image
const result = await downloadManager.downloadSingle(imageData);

// Download batch with progress tracking
downloadManager.addProgressCallback((progress) => {
  console.log(`Progress: ${progress.percentage}%`);
});

const results = await downloadManager.downloadBatch(images);
```

## Platform System

### BasePlatformExtractor

Abstract base class that all platform extractors must extend. Provides common functionality and enforces interface contracts.

**Key Methods:**
- `extractImages()`: Main extraction method (must be implemented)
- `isSupported(url)`: Check if URL is supported
- `validatePage()`: Validate page readiness
- `createImageData()`: Create standardized image data objects
- `validateImageElement()`: Validate image elements

**Implementation Requirements:**
```javascript
export class MyPlatformExtractor extends BasePlatformExtractor {
  constructor(dependencies, config = {}) {
    super(dependencies, config);
  }

  get platformName() {
    return 'myplatform'; // Required
  }

  get supportedUrlPatterns() {
    return ['myplatform.com']; // Required
  }

  async extractImages() {
    // Required implementation
    this._startExtraction();

    const images = await this._performExtraction();

    return this._completeExtraction(images);
  }
}
```

### PlatformRegistry

Manages platform extractors and provides factory functionality for creating appropriate extractors based on URLs.

**Key Features:**
- Dynamic platform detection
- Extractor factory with dependency injection
- Platform capability querying
- Registration validation

**Usage Example:**
```javascript
// Register a platform
platformRegistry.register(
  'myplatform',
  MyPlatformExtractor,
  { name: 'My Platform', hostnames: ['myplatform.com'] },
  ['image_extraction', 'video_extraction']
);

// Create extractor for URL
const extractor = platformRegistry.createExtractor(url, dependencies);
```

## Adding New Platforms

### Step 1: Create Platform Extractor

Create a new file in `src/platforms/myplatform/MyPlatformExtractor.js`:

```javascript
/**
 * @fileoverview My Platform image extractor
 */

import { BasePlatformExtractor } from '../base/BasePlatformExtractor.js';
import { PLATFORMS } from '../../shared/constants/PlatformConstants.js';

/**
 * My Platform image extractor
 */
export class MyPlatformExtractor extends BasePlatformExtractor {
  /**
   * @param {Object} dependencies - Injected dependencies
   * @param {Object} [config={}] - Platform-specific configuration
   */
  constructor(dependencies, config = {}) {
    const defaultConfig = {
      selectors: {
        images: 'img[src*="myplatform"]',
        containers: '.post-content, .media-container'
      },
      extraction: {
        maxImages: 50,
        minImageWidth: 100,
        minImageHeight: 100
      }
    };

    super(dependencies, { ...defaultConfig, ...config });
  }

  /**
   * Platform name identifier
   * @type {string}
   */
  get platformName() {
    return PLATFORMS.MYPLATFORM;
  }

  /**
   * Supported URL patterns
   * @type {string[]}
   */
  get supportedUrlPatterns() {
    return ['myplatform.com', 'www.myplatform.com'];
  }

  /**
   * Extract images from the current page
   * @returns {Promise<import('../../core/interfaces/IPlatformExtractor.js').ImageData[]>}
   */
  async extractImages() {
    this._startExtraction();

    try {
      // Wait for page to be ready
      await this.waitForElement(this.config.selectors.containers[0], 5000);

      // Extract images using multiple strategies
      const imageElements = await this._extractWithMultipleStrategies();

      // Filter and validate images
      const validImages = this.filterValidImages(imageElements);

      // Convert to standardized image data
      const imageData = validImages.map((img, index) =>
        this.createImageData(img, index, {
          extractionStrategy: img._strategy || 'default'
        })
      );

      return this._completeExtraction(imageData);

    } catch (error) {
      await this.errorHandler?.handleError(error, {
        context: 'myplatform_extraction',
        platform: this.platformName,
        url: window.location.href
      });
      throw error;
    }
  }

  /**
   * Platform-specific page validation
   * @protected
   * @returns {Promise<boolean>}
   */
  async _validatePlatformSpecific() {
    // Check if we're on the right platform
    if (!window.location.hostname.includes('myplatform.com')) {
      return false;
    }

    // Check for required elements
    const hasContent = document.querySelector(this.config.selectors.containers[0]);
    return !!hasContent;
  }

  /**
   * Extract images using multiple strategies
   * @private
   * @returns {Promise<HTMLImageElement[]>}
   */
  async _extractWithMultipleStrategies() {
    const strategies = [
      () => this._extractFromContainers(),
      () => this._extractFromSelectors(),
      () => this._extractFallback()
    ];

    let allImages = [];

    for (const strategy of strategies) {
      try {
        const images = await strategy();
        if (images.length > 0) {
          allImages = [...allImages, ...images];
        }
      } catch (error) {
        this.logger?.warn('Extraction strategy failed', {
          strategy: strategy.name,
          error: error.message
        });
      }
    }

    // Remove duplicates
    return this._removeDuplicateImages(allImages);
  }

  /**
   * Extract from specific containers
   * @private
   * @returns {HTMLImageElement[]}
   */
  _extractFromContainers() {
    const images = [];

    this.config.selectors.containers.forEach(selector => {
      const container = document.querySelector(selector);
      if (container) {
        const containerImages = container.querySelectorAll('img');
        containerImages.forEach(img => {
          img._strategy = 'container';
          images.push(img);
        });
      }
    });

    return images;
  }

  /**
   * Extract using CSS selectors
   * @private
   * @returns {HTMLImageElement[]}
   */
  _extractFromSelectors() {
    const images = document.querySelectorAll(this.config.selectors.images);
    return Array.from(images).map(img => {
      img._strategy = 'selector';
      return img;
    });
  }

  /**
   * Fallback extraction method
   * @private
   * @returns {HTMLImageElement[]}
   */
  _extractFallback() {
    const allImages = document.querySelectorAll('img');
    return Array.from(allImages).filter(img => {
      const rect = img.getBoundingClientRect();
      const isVisible = rect.width > this.config.extraction.minImageWidth &&
                       rect.height > this.config.extraction.minImageHeight;

      if (isVisible) {
        img._strategy = 'fallback';
      }

      return isVisible;
    });
  }

  /**
   * Remove duplicate images based on src
   * @private
   * @param {HTMLImageElement[]} images
   * @returns {HTMLImageElement[]}
   */
  _removeDuplicateImages(images) {
    const seen = new Set();
    return images.filter(img => {
      const src = img.src || img.currentSrc;
      if (seen.has(src)) {
        return false;
      }
      seen.add(src);
      return true;
    });
  }
}
```

### Step 2: Add Platform Constants

Update `src/shared/constants/PlatformConstants.js`:

```javascript
export const PLATFORMS = {
  THREADS: 'threads',
  INSTAGRAM: 'instagram',
  FACEBOOK: 'facebook',
  MYPLATFORM: 'myplatform' // Add your platform
};

export const PLATFORM_CONFIGS = {
  // ... existing configs
  [PLATFORMS.MYPLATFORM]: {
    name: 'My Platform',
    hostnames: ['myplatform.com'],
    supportedUrlPatterns: [
      /^https?:\/\/(www\.)?myplatform\.com\/post\/[\w-]+/
    ],
    selectors: {
      images: 'img[src*="myplatform"]',
      containers: ['.post-content', '.media-container']
    },
    extraction: {
      maxImages: 50,
      minImageWidth: 100,
      minImageHeight: 100
    }
  }
};
```

### Step 3: Register Platform

Update the platform registration in `src/content/ContentService.js`:

```javascript
// In _initializePlatformRegistry method
this.platformRegistry.register(
  PLATFORMS.MYPLATFORM,
  MyPlatformExtractor,
  { name: 'My Platform', hostnames: ['myplatform.com'] },
  ['image_extraction', 'post_extraction']
);
```

### Step 4: Test Implementation

1. **Load Extension**: Load the extension in Chrome developer mode
2. **Navigate to Platform**: Go to a supported URL on your platform
3. **Test Extraction**: Click the extension icon and verify images are detected
4. **Test Download**: Try downloading individual and batch images
5. **Check Logs**: Monitor console logs for any errors or warnings

## Development Best Practices

### Code Style

1. **Use JSDoc Comments**: All public methods and classes must have comprehensive JSDoc documentation
2. **Follow Naming Conventions**: Use camelCase for variables/methods, PascalCase for classes
3. **Error Handling**: Always use the ErrorHandlerService for error management
4. **Logging**: Use the LoggingService with appropriate log levels
5. **Type Safety**: Use JSDoc type annotations for better IDE support

### Testing

1. **Unit Testing**: Test individual methods and classes in isolation
2. **Integration Testing**: Test component interactions and message flow
3. **Platform Testing**: Test each platform extractor on real websites
4. **Error Scenarios**: Test error handling and recovery mechanisms

### Performance

1. **Lazy Loading**: Load services and components only when needed
2. **Memory Management**: Properly cleanup event listeners and references
3. **DOM Queries**: Batch DOM queries and cache results when possible
4. **Async Operations**: Use async/await consistently and handle promises properly

### Security

1. **Content Security Policy**: Ensure all code complies with CSP requirements
2. **Input Validation**: Validate all user inputs and external data
3. **Permission Management**: Use minimal required permissions
4. **XSS Prevention**: Sanitize any dynamic content

## Debugging

### Chrome DevTools

1. **Extension Pages**: Use `chrome://extensions/` to access extension pages
2. **Background Script**: Debug service worker in the extension details
3. **Content Scripts**: Debug in the context of web pages
4. **Popup**: Right-click extension icon and select "Inspect popup"

### Logging

The extension provides comprehensive logging through the LoggingService:

```javascript
// Enable debug logging
logger.setLevel('debug');

// Log with context
logger.debug('Platform detection', {
  url: window.location.href,
  hostname: window.location.hostname,
  detected: platformName
});
```

### Error Tracking

Monitor errors through the ErrorHandlerService:

```javascript
// Get error statistics
const stats = errorHandler.getErrorStats();
console.log('Error statistics:', stats);

// Register custom error handler
errorHandler.registerHandler('MyCustomError', async (error, context) => {
  console.log('Custom error occurred:', error, context);
  return { shouldRetry: false, userMessage: 'Custom error message' };
});
```

## Contributing

### Pull Request Process

1. **Fork Repository**: Create a fork of the main repository
2. **Create Branch**: Create a feature branch for your changes
3. **Follow Standards**: Ensure code follows the established patterns and standards
4. **Add Tests**: Include appropriate tests for new functionality
5. **Update Documentation**: Update relevant documentation and JSDoc comments
6. **Submit PR**: Submit pull request with clear description of changes

### Code Review Checklist

- [ ] Code follows established architecture patterns
- [ ] All public methods have JSDoc documentation
- [ ] Error handling uses ErrorHandlerService
- [ ] Logging uses LoggingService with appropriate levels
- [ ] No direct DOM manipulation outside of utility functions
- [ ] Platform extractors extend BasePlatformExtractor
- [ ] Services use dependency injection
- [ ] Tests cover new functionality
- [ ] Documentation is updated

## Resources

### Key Files to Understand

1. **Core Interfaces**: `src/core/interfaces/` - Understand the contract definitions
2. **Base Classes**: `src/platforms/base/` - Understand the platform abstraction
3. **Service Container**: `src/core/services/ServiceContainer.js` - Understand dependency injection
4. **Message Types**: `src/core/types/MessageTypes.js` - Understand communication patterns
5. **Error Types**: `src/core/types/ErrorTypes.js` - Understand error handling

### External Documentation

- [Chrome Extension API](https://developer.chrome.com/docs/extensions/reference/)
- [Chrome Extension Manifest V3](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [JSDoc Documentation](https://jsdoc.app/)
- [Chrome DevTools](https://developer.chrome.com/docs/devtools/)

This guide provides the foundation for understanding and extending the Social Snap Chrome extension. For specific questions or issues, refer to the existing code examples and patterns established in the codebase.
