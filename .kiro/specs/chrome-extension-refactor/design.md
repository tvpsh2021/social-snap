# Design Document

## Overview

This design document outlines the refactoring approach for the Social Snap Chrome extension. The current extension supports downloading images from Threads, Instagram, and Facebook, but suffers from code duplication, inconsistent error handling, and a tightly coupled architecture. The refactored version will provide a clean, modular, and extensible foundation.

## Architecture

### High-Level Architecture

The refactored extension will follow a layered architecture with clear separation of concerns:

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

### Key Architectural Principles

1. **Single Responsibility**: Each module has one clear purpose
2. **Dependency Injection**: Services are injected rather than directly instantiated
3. **Interface Segregation**: Small, focused interfaces rather than large ones
4. **Open/Closed Principle**: Open for extension, closed for modification

## Components and Interfaces

### Core Interfaces

#### IPlatformExtractor
```javascript
interface IPlatformExtractor {
  platformName: string;
  isSupported(url: string): boolean;
  extractImages(): Promise<ImageData[]>;
  validatePage(): Promise<boolean>;
}
```

#### IDownloadManager
```javascript
interface IDownloadManager {
  downloadSingle(image: ImageData): Promise<DownloadResult>;
  downloadBatch(images: ImageData[]): Promise<DownloadResult[]>;
  getDownloadProgress(): DownloadProgress;
}
```

#### IMessageBus
```javascript
interface IMessageBus {
  send<T>(message: Message<T>): Promise<MessageResponse<T>>;
  subscribe<T>(messageType: string, handler: MessageHandler<T>): void;
  unsubscribe(messageType: string, handler: MessageHandler<T>): void;
}
```

### Refactored File Structure

```
src/
├── core/
│   ├── interfaces/
│   │   ├── IPlatformExtractor.js
│   │   ├── IDownloadManager.js
│   │   ├── IMessageBus.js
│   │   └── IErrorHandler.js
│   ├── services/
│   │   ├── MessageBusService.js
│   │   ├── ErrorHandlerService.js
│   │   ├── ConfigurationService.js
│   │   └── LoggingService.js
│   └── types/
│       ├── MessageTypes.js
│       ├── ImageTypes.js
│       └── ErrorTypes.js
├── platforms/
│   ├── base/
│   │   ├── BasePlatformExtractor.js
│   │   └── PlatformRegistry.js
│   ├── threads/
│   │   └── ThreadsExtractor.js
│   ├── instagram/
│   │   └── InstagramExtractor.js
│   └── facebook/
│       └── FacebookExtractor.js
├── background/
│   ├── BackgroundService.js
│   ├── DownloadManagerService.js
│   └── background-main.js
├── content/
│   ├── ContentService.js
│   ├── ImageExtractionService.js
│   └── content-main.js
├── popup/
│   ├── components/
│   │   ├── ImageGridComponent.js
│   │   ├── StatusDisplayComponent.js
│   │   └── ProgressBarComponent.js
│   ├── services/
│   │   └── PopupService.js
│   ├── popup-main.js
│   └── popup.html
└── shared/
    ├── utils/
    │   ├── DOMUtils.js
    │   ├── URLUtils.js
    │   └── ValidationUtils.js
    └── constants/
        ├── PlatformConstants.js
        ├── UIConstants.js
        └── ConfigConstants.js
```

## Data Models

### ImageData Model
```javascript
class ImageData {
  constructor({
    id,
    url,
    thumbnailUrl,
    alt,
    width,
    height,
    platform,
    extractedAt,
    metadata = {}
  }) {
    this.id = id;
    this.url = url;
    this.thumbnailUrl = thumbnailUrl;
    this.alt = alt;
    this.width = width;
    this.height = height;
    this.platform = platform;
    this.extractedAt = extractedAt;
    this.metadata = metadata;
  }
}
```

### Message Model
```javascript
class Message {
  constructor(type, payload, requestId = null) {
    this.type = type;
    this.payload = payload;
    this.requestId = requestId || this.generateRequestId();
    this.timestamp = Date.now();
  }
}
```

### Error Model
```javascript
class ExtensionError extends Error {
  constructor(message, code, context = {}) {
    super(message);
    this.name = 'ExtensionError';
    this.code = code;
    this.context = context;
    this.timestamp = Date.now();
  }
}
```

## Platform Abstraction Layer

### BasePlatformExtractor
The base class provides common functionality and enforces the interface contract:

```javascript
class BasePlatformExtractor {
  constructor(config, logger, errorHandler) {
    this.config = config;
    this.logger = logger;
    this.errorHandler = errorHandler;
  }

  // Abstract methods to be implemented by subclasses
  async extractImages() {
    throw new Error('extractImages must be implemented by subclass');
  }

  isSupported(url) {
    throw new Error('isSupported must be implemented by subclass');
  }

  // Common utility methods
  createImageData(element, index) {
    // Common image data creation logic
  }

  validateImageElement(element) {
    // Common validation logic
  }
}
```

### Platform Registry
Manages platform extractors and provides factory functionality:

```javascript
class PlatformRegistry {
  constructor() {
    this.extractors = new Map();
  }

  register(platformName, extractorClass) {
    this.extractors.set(platformName, extractorClass);
  }

  createExtractor(url) {
    for (const [name, ExtractorClass] of this.extractors) {
      const extractor = new ExtractorClass();
      if (extractor.isSupported(url)) {
        return extractor;
      }
    }
    throw new Error(`No extractor found for URL: ${url}`);
  }
}
```

## Error Handling

### Centralized Error Management
All errors will be handled through a centralized error handling service:

```javascript
class ErrorHandlerService {
  constructor(logger) {
    this.logger = logger;
    this.errorHandlers = new Map();
  }

  registerHandler(errorType, handler) {
    this.errorHandlers.set(errorType, handler);
  }

  async handleError(error, context = {}) {
    this.logger.error('Error occurred', { error, context });

    const handler = this.errorHandlers.get(error.constructor.name);
    if (handler) {
      return await handler(error, context);
    }

    return this.defaultErrorHandler(error, context);
  }
}
```

### Error Types
Define specific error types for different scenarios:

- `PlatformNotSupportedError`
- `ImageExtractionError`
- `DownloadError`
- `NetworkError`
- `ValidationError`

## Testing Strategy

### Unit Testing Approach
1. **Service Layer Testing**: Mock dependencies and test business logic
2. **Platform Extractor Testing**: Test each platform's extraction logic independently
3. **Message Bus Testing**: Test message routing and handling
4. **Error Handler Testing**: Test error scenarios and recovery

### Integration Testing
1. **End-to-End Workflow**: Test complete image extraction and download flow
2. **Cross-Platform Testing**: Ensure consistent behavior across platforms
3. **Message Flow Testing**: Test communication between extension components

### Testing Structure
```
tests/
├── unit/
│   ├── services/
│   ├── platforms/
│   └── utils/
├── integration/
│   ├── workflows/
│   └── messaging/
└── fixtures/
    ├── mock-pages/
    └── test-data/
```

## Migration Strategy

### Phase 1: Core Infrastructure
1. Create new file structure
2. Implement core interfaces and services
3. Set up error handling and logging
4. Implement message bus service

### Phase 2: Platform Refactoring
1. Refactor existing platform extractors to use new base class
2. Implement platform registry
3. Update platform-specific logic to use new interfaces

### Phase 3: Component Integration
1. Refactor background service to use new architecture
2. Update content script to use new services
3. Refactor popup to use new component structure

### Phase 4: Cleanup and Optimization
1. Remove unused code
2. Optimize performance
3. Update documentation
4. Final testing and validation

## Performance Considerations

### Memory Management
- Use WeakMap for temporary references
- Implement proper cleanup in service destructors
- Avoid memory leaks in event listeners

### Async Operations
- Use Promise-based APIs consistently
- Implement proper error handling for async operations
- Use async/await pattern for better readability

### DOM Operations
- Batch DOM queries where possible
- Use efficient selectors
- Implement debouncing for frequent operations

## Security Considerations

### Content Security Policy
- Ensure all code complies with CSP requirements
- Use proper script loading mechanisms
- Avoid inline scripts and styles

### Data Validation
- Validate all user inputs
- Sanitize URLs and file names
- Implement proper type checking

### Permission Management
- Use minimal required permissions
- Implement proper permission checking
- Handle permission errors gracefully
