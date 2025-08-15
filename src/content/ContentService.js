/**
 * @fileoverview Content service for improved platform integration
 * Handles content script initialization, platform detection, and coordination
 */

import { getServiceContainer } from '../core/services/ServiceContainer.js';
import { ExtensionError, ErrorCodes } from '../core/types/ErrorTypes.js';
import { MessageTypes, createMessage } from '../core/types/MessageTypes.js';
import { PlatformRegistry } from '../platforms/base/PlatformRegistry.js';
import { FacebookExtractor } from '../platforms/facebook/FacebookExtractor.js';
import { InstagramExtractor } from '../platforms/instagram/InstagramExtractor.js';
import { ThreadsExtractor } from '../platforms/threads/ThreadsExtractor.js';
import { PLATFORMS } from '../shared/constants/PlatformConstants.js';

/**
 * Content service for managing content script functionality
 */
export class ContentService {
  /**
   * Create content service
   * @param {Object} dependencies - Injected dependencies
   * @param {import('../core/interfaces/ILogger.js').ILogger} dependencies.logger - Logger service
   * @param {import('../core/interfaces/IErrorHandler.js').IErrorHandler} dependencies.errorHandler - Error handler service
   * @param {import('../core/interfaces/IMessageBus.js').IMessageBus} dependencies.messageBus - Message bus service
   */
  constructor({ logger, errorHandler, messageBus }) {
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.messageBus = messageBus;

    this.platformRegistry = null;
    this.currentExtractor = null;
    this.isInitialized = false;
    this.currentUrl = window.location.href;

    // Bind methods to preserve context
    this._handleMessage = this._handleMessage.bind(this);
    this._handleUrlChange = this._handleUrlChange.bind(this);

    this.logger?.info('ContentService created', { url: this.currentUrl });
  }

  /**
   * Initialize the content service
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      this.logger?.info('Initializing ContentService');

      // Initialize platform registry
      await this._initializePlatformRegistry();

      // Set up message handlers
      this._setupMessageHandlers();

      // Set up URL change detection
      this._setupUrlChangeDetection();

      // Detect and initialize current platform
      await this._initializeCurrentPlatform();

      this.isInitialized = true;
      this.logger?.info('ContentService initialized successfully');

      // Notify background that content script is ready
      await this._notifyContentReady();

    } catch (error) {
      const wrappedError = new ExtensionError(
        'Failed to initialize ContentService',
        ErrorCodes.INITIALIZATION_ERROR,
        { originalError: error.message, url: this.currentUrl }
      );

      await this.errorHandler?.handleError(wrappedError);
      throw wrappedError;
    }
  }

  /**
   * Cleanup the content service
   * @returns {Promise<void>}
   */
  async cleanup() {
    try {
      this.logger?.info('Cleaning up ContentService');

      // Cleanup current extractor
      if (this.currentExtractor && typeof this.currentExtractor.cleanup === 'function') {
        await this.currentExtractor.cleanup();
      }

      // Remove message handlers
      if (this.messageBus) {
        this.messageBus.unsubscribe(MessageTypes.EXTRACT_IMAGES, this._handleMessage);
        this.messageBus.unsubscribe(MessageTypes.GET_PAGE_INFO, this._handleMessage);
        this.messageBus.unsubscribe(MessageTypes.VALIDATE_PAGE, this._handleMessage);
      }

      // Remove URL change detection
      this._cleanupUrlChangeDetection();

      this.isInitialized = false;
      this.currentExtractor = null;

      this.logger?.info('ContentService cleaned up successfully');

    } catch (error) {
      this.logger?.error('Error during ContentService cleanup', { error: error.message });
    }
  }

  /**
   * Get current platform information
   * @returns {Object} Platform information
   */
  getCurrentPlatformInfo() {
    return {
      url: this.currentUrl,
      platform: this.currentExtractor?.platformName || null,
      isSupported: this.currentExtractor !== null,
      capabilities: this.currentExtractor ? this._getExtractorCapabilities() : []
    };
  }

  /**
   * Check if current page is supported
   * @returns {boolean} True if current page is supported
   */
  isCurrentPageSupported() {
    return this.currentExtractor !== null;
  }

  /**
   * Get current extractor instance
   * @returns {import('../platforms/base/BasePlatformExtractor.js').BasePlatformExtractor|null} Current extractor or null
   */
  getCurrentExtractor() {
    return this.currentExtractor;
  }

  /**
   * Initialize platform registry and register extractors
   * @private
   * @returns {Promise<void>}
   */
  async _initializePlatformRegistry() {
    try {
      this.platformRegistry = new PlatformRegistry({
        logger: this.logger,
        errorHandler: this.errorHandler
      });

      // Register platform extractors
      this.platformRegistry.register(
        PLATFORMS.THREADS,
        ThreadsExtractor,
        { name: 'Threads', hostnames: ['threads.net'] },
        ['image_extraction', 'carousel_navigation']
      );

      this.platformRegistry.register(
        PLATFORMS.INSTAGRAM,
        InstagramExtractor,
        { name: 'Instagram', hostnames: ['instagram.com'] },
        ['image_extraction', 'carousel_navigation', 'story_extraction']
      );

      this.platformRegistry.register(
        PLATFORMS.FACEBOOK,
        FacebookExtractor,
        { name: 'Facebook', hostnames: ['facebook.com'] },
        ['image_extraction', 'post_extraction']
      );

      this.logger?.info('Platform registry initialized', {
        registeredPlatforms: this.platformRegistry.getRegisteredPlatforms()
      });

    } catch (error) {
      throw new ExtensionError(
        'Failed to initialize platform registry',
        ErrorCodes.INITIALIZATION_ERROR,
        { originalError: error.message }
      );
    }
  }

  /**
   * Set up message handlers for communication with other components
   * @private
   * @returns {void}
   */
  _setupMessageHandlers() {
    if (!this.messageBus) {
      this.logger?.warn('Message bus not available, skipping message handler setup');
      return;
    }

    // Subscribe to message types
    this.messageBus.subscribe(MessageTypes.EXTRACT_IMAGES, this._handleMessage);
    this.messageBus.subscribe(MessageTypes.GET_PAGE_INFO, this._handleMessage);
    this.messageBus.subscribe(MessageTypes.VALIDATE_PAGE, this._handleMessage);

    this.logger?.debug('Message handlers set up successfully');
  }

  /**
   * Handle incoming messages
   * @private
   * @param {import('../core/interfaces/IMessageBus.js').Message} message - Incoming message
   * @param {chrome.runtime.MessageSender} sender - Message sender
   * @returns {Promise<*>} Message response
   */
  async _handleMessage(message, sender) {
    try {
      this.logger?.debug('Handling message', { type: message.type, sender: sender?.tab?.id });

      switch (message.type) {
      case MessageTypes.EXTRACT_IMAGES:
        return await this._handleExtractImages(message.payload);

      case MessageTypes.GET_PAGE_INFO:
        return this._handleGetPageInfo();

      case MessageTypes.VALIDATE_PAGE:
        return await this._handleValidatePage();

      default:
        throw new ExtensionError(
          `Unknown message type: ${message.type}`,
          ErrorCodes.VALIDATION_ERROR,
          { messageType: message.type }
        );
      }

    } catch (error) {
      this.logger?.error('Error handling message', {
        messageType: message.type,
        error: error.message
      });

      await this.errorHandler?.handleError(error);
      throw error;
    }
  }

  /**
   * Handle image extraction request
   * @private
   * @param {Object} payload - Message payload
   * @returns {Promise<Object>} Extraction result
   */
  async _handleExtractImages(payload = {}) {
    if (!this.currentExtractor) {
      throw new ExtensionError(
        'No extractor available for current page',
        ErrorCodes.SERVICE_UNAVAILABLE,
        { url: this.currentUrl }
      );
    }

    try {
      this.logger?.info('Starting image extraction', {
        platform: this.currentExtractor.platformName,
        url: this.currentUrl
      });

      const images = await this.currentExtractor.extractImages();

      this.logger?.info('Image extraction completed', {
        platform: this.currentExtractor.platformName,
        imageCount: images.length
      });

      return {
        success: true,
        images,
        count: images.length,
        platform: this.currentExtractor.platformName,
        url: this.currentUrl
      };

    } catch (error) {
      const wrappedError = new ExtensionError(
        'Image extraction failed',
        ErrorCodes.EXTRACTION_ERROR,
        {
          platform: this.currentExtractor.platformName,
          url: this.currentUrl,
          originalError: error.message
        }
      );

      await this.errorHandler?.handleError(wrappedError);
      throw wrappedError;
    }
  }

  /**
   * Handle page info request
   * @private
   * @returns {Object} Page information
   */
  _handleGetPageInfo() {
    return {
      success: true,
      pageInfo: this.getCurrentPlatformInfo()
    };
  }

  /**
   * Handle page validation request
   * @private
   * @returns {Promise<Object>} Validation result
   */
  async _handleValidatePage() {
    try {
      if (!this.currentExtractor) {
        return {
          success: true,
          isValid: false,
          platform: null,
          reason: 'Unsupported platform'
        };
      }

      const isValid = await this.currentExtractor.validatePage();

      return {
        success: true,
        isValid,
        platform: this.currentExtractor.platformName,
        reason: isValid ? 'Page is valid' : 'Page validation failed'
      };

    } catch (error) {
      this.logger?.error('Page validation error', { error: error.message });

      return {
        success: true,
        isValid: false,
        platform: this.currentExtractor?.platformName || null,
        reason: `Validation error: ${error.message}`
      };
    }
  }

  /**
   * Set up URL change detection
   * @private
   * @returns {void}
   */
  _setupUrlChangeDetection() {
    // Listen for popstate events (back/forward navigation)
    window.addEventListener('popstate', this._handleUrlChange);

    // Listen for pushstate/replacestate (programmatic navigation)
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = (...args) => {
      originalPushState.apply(history, args);
      setTimeout(this._handleUrlChange, 0);
    };

    history.replaceState = (...args) => {
      originalReplaceState.apply(history, args);
      setTimeout(this._handleUrlChange, 0);
    };

    this.logger?.debug('URL change detection set up');
  }

  /**
   * Clean up URL change detection
   * @private
   * @returns {void}
   */
  _cleanupUrlChangeDetection() {
    window.removeEventListener('popstate', this._handleUrlChange);
    // Note: We don't restore original pushState/replaceState to avoid conflicts
  }

  /**
   * Handle URL change events
   * @private
   * @returns {Promise<void>}
   */
  async _handleUrlChange() {
    const newUrl = window.location.href;

    if (newUrl !== this.currentUrl) {
      this.logger?.info('URL changed', { from: this.currentUrl, to: newUrl });

      this.currentUrl = newUrl;

      // Re-initialize platform for new URL
      await this._initializeCurrentPlatform();

      // Notify about URL change
      await this._notifyUrlChange(newUrl);
    }
  }

  /**
   * Initialize platform extractor for current URL
   * @private
   * @returns {Promise<void>}
   */
  async _initializeCurrentPlatform() {
    try {
      // Cleanup previous extractor
      if (this.currentExtractor && typeof this.currentExtractor.cleanup === 'function') {
        await this.currentExtractor.cleanup();
      }

      this.currentExtractor = null;

      // Detect platform for current URL
      const platformName = this.platformRegistry.detectPlatform(this.currentUrl);

      if (platformName) {
        // Create extractor for detected platform
        this.currentExtractor = this.platformRegistry.createExtractorByName(platformName, {
          logger: this.logger,
          errorHandler: this.errorHandler
        });

        this.logger?.info('Platform extractor initialized', {
          platform: platformName,
          url: this.currentUrl
        });
      } else {
        this.logger?.info('No platform detected for current URL', { url: this.currentUrl });
      }

    } catch (error) {
      this.logger?.error('Failed to initialize platform extractor', {
        url: this.currentUrl,
        error: error.message
      });

      await this.errorHandler?.handleError(error);
    }
  }

  /**
   * Get extractor capabilities
   * @private
   * @returns {string[]} Array of capabilities
   */
  _getExtractorCapabilities() {
    if (!this.currentExtractor) {
      return [];
    }

    const platformName = this.currentExtractor.platformName;
    return this.platformRegistry.getPlatformCapabilities(platformName);
  }

  /**
   * Notify background that content script is ready
   * @private
   * @returns {Promise<void>}
   */
  async _notifyContentReady() {
    try {
      if (this.messageBus) {
        const message = createMessage(MessageTypes.CONTENT_READY, {
          url: this.currentUrl,
          platform: this.currentExtractor?.platformName || null,
          isSupported: this.currentExtractor !== null
        });

        this.messageBus.sendAsync(message);
      }
    } catch (error) {
      this.logger?.warn('Failed to notify content ready', { error: error.message });
    }
  }

  /**
   * Notify about URL change
   * @private
   * @param {string} newUrl - New URL
   * @returns {Promise<void>}
   */
  async _notifyUrlChange(newUrl) {
    try {
      if (this.messageBus) {
        const message = createMessage(MessageTypes.URL_CHANGED, {
          url: newUrl,
          platform: this.currentExtractor?.platformName || null,
          isSupported: this.currentExtractor !== null
        });

        this.messageBus.sendAsync(message);
      }
    } catch (error) {
      this.logger?.warn('Failed to notify URL change', { error: error.message });
    }
  }
}

/**
 * Create and initialize content service
 * @returns {Promise<ContentService>} Initialized content service
 */
export async function createContentService() {
  const container = getServiceContainer();

  const logger = container.get('logger');
  const errorHandler = container.get('errorHandler');
  const messageBus = container.get('messageBus');

  const contentService = new ContentService({
    logger,
    errorHandler,
    messageBus
  });

  await contentService.initialize();
  return contentService;
}
