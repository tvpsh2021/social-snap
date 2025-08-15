# Core Infrastructure

This directory contains the core infrastructure for the Social Snap Chrome extension refactor. It provides the foundational interfaces, types, and services that enable a modular, maintainable architecture.

## Directory Structure

```
src/core/
├── interfaces/          # Core interface definitions
│   ├── IPlatformExtractor.js    # Platform extractor interface
│   ├── IDownloadManager.js      # Download manager interface
│   ├── IMessageBus.js           # Message bus interface
│   ├── IErrorHandler.js         # Error handler interface
│   └── index.js                 # Interface exports
├── types/              # Type definitions and utilities
│   ├── MessageTypes.js          # Message type constants and utilities
│   ├── ImageTypes.js            # Image data types and utilities
│   ├── ErrorTypes.js            # Error types and custom error classes
│   └── index.js                 # Type exports
├── services/           # Core service implementations (to be implemented)
└── index.js           # Main core module exports
```

## Core Interfaces

### IPlatformExtractor
Defines the contract for platform-specific image extractors. Each social media platform (Threads, Instagram, Facebook) will implement this interface to provide consistent image extraction functionality.

**Key Methods:**
- `isSupported(url)` - Check if URL is supported by the platform
- `extractImages()` - Extract images from the current page
- `validatePage()` - Validate page is ready for extraction

### IDownloadManager
Defines the contract for download management operations, including single and batch downloads with progress tracking.

**Key Methods:**
- `downloadSingle(image)` - Download a single image
- `downloadBatch(images)` - Download multiple images
- `getDownloadProgress()` - Get current download progress

### IMessageBus
Defines the contract for inter-component communication within the extension, supporting both request-response and publish-subscribe patterns.

**Key Methods:**
- `send(message)` - Send message and wait for response
- `subscribe(type, handler)` - Subscribe to message type
- `unsubscribe(type, handler)` - Unsubscribe from message type

### IErrorHandler
Defines the contract for centralized error handling with support for custom error handlers and user-friendly error messages.

**Key Methods:**
- `handleError(error, context)` - Handle error with context
- `registerHandler(type, handler)` - Register custom error handler
- `logError(error, context)` - Log error without handling

## Type System

### Message Types
Standardized message types for communication between extension components:
- Image extraction messages (EXTRACT_IMAGES, IMAGES_EXTRACTED)
- Download messages (DOWNLOAD_SINGLE, DOWNLOAD_BATCH, DOWNLOAD_PROGRESS)
- Status messages (PING, PONG, STATUS_UPDATE)

### Image Types
Comprehensive image data structure with metadata:
- Image quality levels (THUMBNAIL, MEDIUM, HIGH, ORIGINAL)
- Supported formats (JPEG, PNG, WEBP, GIF, SVG)
- Validation utilities for image data

### Error Types
Custom error classes with error codes and severity levels:
- `ExtensionError` - Base error class with context
- `PlatformError` - Platform-specific errors
- `ExtractionError` - Image extraction errors
- `DownloadError` - Download-related errors
- `NetworkError` - Network communication errors
- `ValidationError` - Data validation errors

## JSDoc Annotations

All code uses comprehensive JSDoc annotations for TypeScript-like type safety:

```javascript
/**
 * Extract images from the current page
 * @returns {Promise<ImageData[]>} Array of extracted image data
 * @throws {ExtractionError} When extraction fails
 */
async extractImages() {
  // Implementation
}
```

## Usage Examples

### Implementing a Platform Extractor

```javascript
import { IPlatformExtractor } from '../core/interfaces/index.js';
import { createImageData } from '../core/types/index.js';

class ThreadsExtractor extends IPlatformExtractor {
  get platformName() {
    return 'threads';
  }

  isSupported(url) {
    return url.includes('threads.net');
  }

  async extractImages() {
    // Platform-specific extraction logic
    const images = [];
    // ... extraction code
    return images.map(img => createImageData({
      url: img.src,
      platform: this.platformName,
      // ... other properties
    }));
  }
}
```

### Using Message Types

```javascript
import { MessageTypes, createMessage } from '../core/types/index.js';

// Create a standardized message
const message = createMessage(
  MessageTypes.EXTRACT_IMAGES,
  { url: window.location.href }
);

// Send message via message bus
const response = await messageBus.send(message);
```

### Error Handling

```javascript
import { ExtractionError, ErrorCodes } from '../core/types/index.js';

try {
  const images = await extractor.extractImages();
} catch (error) {
  throw new ExtractionError(
    'Failed to extract images from page',
    ErrorCodes.IMAGE_EXTRACTION_FAILED,
    { url: window.location.href, platform: 'threads' }
  );
}
```

## Design Principles

1. **Interface Segregation**: Small, focused interfaces rather than large monolithic ones
2. **Dependency Injection**: Services are injected rather than directly instantiated
3. **Type Safety**: Comprehensive JSDoc annotations provide TypeScript-like type checking
4. **Error Handling**: Centralized error management with context and user-friendly messages
5. **Extensibility**: Easy to add new platforms and functionality without modifying core code

## Next Steps

The core infrastructure is now ready for implementation of:
1. Core services (MessageBusService, ErrorHandlerService, etc.)
2. Platform extractors using the base interfaces
3. Download management with progress tracking
4. Background and content script refactoring

This foundation ensures consistent, maintainable, and extensible code throughout the extension.
