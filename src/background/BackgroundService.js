/**
 * @fileoverview Background service for Chrome extension service worker
 */

import { getServiceContainer, initializeServices, cleanupServices } from '../core/services/ServiceContainer.js';
import { ExtensionError, ErrorCodes } from '../core/types/ErrorTypes.js';
import { MessageTypes, createMessage, createResponse } from '../core/types/MessageTypes.js';

/**
 * Background service for Chrome extension
 * Manages service worker lifecycle and message handling
 */
export class BackgroundService {
  /**
   * Create background service
   */
  constructor() {
    this.isInitialized = false;
    this.serviceContainer = null;
    this.logger = null;
    this.messageBus = null;
    this.errorHandler = null;
    this.downloadManager = null;

    // Bind methods to preserve context
    this._handleInstallation = this._handleInstallation.bind(this);
    this._handleStartup = this._handleStartup.bind(this);
    this._handleSuspend = this._handleSuspend.bind(this);
  }

  /**
   * Initialize the background service
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      // Initialize service container and core services
      this.serviceContainer = await initializeServices();
      this.logger = this.serviceContainer.get('logger');
      this.messageBus = this.serviceContainer.get('messageBus');
      this.errorHandler = this.serviceContainer.get('errorHandler');

      // Get download manager service
      this.downloadManager = await this.serviceContainer.getAsync('downloadManager');

      // Set up Chrome extension event listeners
      this._setupExtensionListeners();

      // Set up message handlers
      this._setupMessageHandlers();

      this.isInitialized = true;
      this.logger.info('Background service initialized successfully');

    } catch (error) {
      const extensionError = new ExtensionError(
        'Failed to initialize background service',
        ErrorCodes.INITIALIZATION_ERROR,
        { originalError: error.message }
      );

      if (this.errorHandler) {
        await this.errorHandler.handleError(extensionError);
      } else {
        console.error('[BackgroundService] Initialization failed:', extensionError);
      }

      throw extensionError;
    }
  }

  /**
   * Cleanup the background service
   * @returns {Promise<void>}
   */
  async cleanup() {
    try {
      if (this.logger) {
        this.logger.info('Background service cleanup started');
      }

      // Remove Chrome extension listeners
      this._removeExtensionListeners();

      // Cleanup services
      await cleanupServices();

      this.isInitialized = false;
      this.serviceContainer = null;
      this.logger = null;
      this.messageBus = null;
      this.errorHandler = null;
      this.downloadManager = null;

      console.log('[BackgroundService] Cleanup completed');

    } catch (error) {
      console.error('[BackgroundService] Error during cleanup:', error);
    }
  }

  /**
   * Check if service is ready
   * @returns {boolean} True if service is initialized and ready
   */
  isReady() {
    return this.isInitialized && this.messageBus && this.messageBus.isReady();
  }

  /**
   * Set up Chrome extension event listeners
   * @private
   * @returns {void}
   */
  _setupExtensionListeners() {
    // Handle extension installation
    if (chrome.runtime.onInstalled) {
      chrome.runtime.onInstalled.addListener(this._handleInstallation);
    }

    // Handle extension startup
    if (chrome.runtime.onStartup) {
      chrome.runtime.onStartup.addListener(this._handleStartup);
    }

    // Handle service worker suspend (Manifest V3)
    if (chrome.runtime.onSuspend) {
      chrome.runtime.onSuspend.addListener(this._handleSuspend);
    }

    // Handle direct Chrome runtime messages (for popup communication)
    if (chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener(this._handleChromeMessage.bind(this));
    }

    this.logger?.debug('Chrome extension listeners set up');
  }

  /**
   * Remove Chrome extension event listeners
   * @private
   * @returns {void}
   */
  _removeExtensionListeners() {
    try {
      if (chrome.runtime.onInstalled) {
        chrome.runtime.onInstalled.removeListener(this._handleInstallation);
      }

      if (chrome.runtime.onStartup) {
        chrome.runtime.onStartup.removeListener(this._handleStartup);
      }

      if (chrome.runtime.onSuspend) {
        chrome.runtime.onSuspend.removeListener(this._handleSuspend);
      }

      this.logger?.debug('Chrome extension listeners removed');
    } catch (error) {
      this.logger?.error('Error removing extension listeners', { error });
    }
  }

  /**
   * Set up message handlers for different message types
   * @private
   * @returns {void}
   */
  _setupMessageHandlers() {
    if (!this.messageBus) {
      throw new ExtensionError(
        'Message bus not available for handler setup',
        ErrorCodes.SERVICE_UNAVAILABLE
      );
    }

    // Image extraction messages
    this.messageBus.subscribe(MessageTypes.IMAGES_EXTRACTED, this._handleImagesExtracted.bind(this));
    this.messageBus.subscribe(MessageTypes.EXTRACTION_ERROR, this._handleExtractionError.bind(this));

    // Download messages
    this.messageBus.subscribe(MessageTypes.DOWNLOAD_SINGLE, this._handleDownloadSingle.bind(this));
    this.messageBus.subscribe(MessageTypes.DOWNLOAD_BATCH, this._handleDownloadBatch.bind(this));
    this.messageBus.subscribe(MessageTypes.CANCEL_DOWNLOADS, this._handleCancelDownloads.bind(this));
    this.messageBus.subscribe(MessageTypes.RETRY_DOWNLOADS, this._handleRetryDownloads.bind(this));

    // Status and query messages
    this.messageBus.subscribe(MessageTypes.GET_IMAGES, this._handleGetImages.bind(this));
    this.messageBus.subscribe(MessageTypes.GET_DOWNLOAD_STATUS, this._handleGetDownloadStatus.bind(this));
    this.messageBus.subscribe(MessageTypes.PING, this._handlePing.bind(this));

    // Configuration messages
    this.messageBus.subscribe(MessageTypes.GET_CONFIG, this._handleGetConfig.bind(this));
    this.messageBus.subscribe(MessageTypes.UPDATE_CONFIG, this._handleUpdateConfig.bind(this));

    this.logger.debug('Message handlers set up successfully');
  }

  /**
   * Handle extension installation
   * @private
   * @param {chrome.runtime.InstalledDetails} details - Installation details
   * @returns {Promise<void>}
   */
  async _handleInstallation(details) {
    try {
      this.logger?.info('Extension installed', { reason: details.reason });

      if (details.reason === 'install') {
        // First time installation
        this.logger?.info('First time installation detected');
      } else if (details.reason === 'update') {
        // Extension update
        this.logger?.info('Extension updated', {
          previousVersion: details.previousVersion
        });
      }

    } catch (error) {
      await this._handleServiceError(error, 'installation');
    }
  }

  /**
   * Handle extension startup
   * @private
   * @returns {Promise<void>}
   */
  async _handleStartup() {
    try {
      this.logger?.info('Extension startup detected');

      // Reinitialize services if needed
      if (!this.isReady()) {
        await this.initialize();
      }

    } catch (error) {
      await this._handleServiceError(error, 'startup');
    }
  }

  /**
   * Handle service worker suspend
   * @private
   * @returns {Promise<void>}
   */
  async _handleSuspend() {
    try {
      this.logger?.info('Service worker suspending');
      await this.cleanup();
    } catch (error) {
      console.error('[BackgroundService] Error during suspend:', error);
    }
  }

  /**
   * Handle direct Chrome runtime messages (bridge to message bus)
   * @private
   * @param {Object} message - Chrome runtime message
   * @param {Object} sender - Message sender
   * @param {Function} sendResponse - Response callback
   * @returns {boolean} True if response is async
   */
  _handleChromeMessage(message, sender, sendResponse) {
    console.log('[BackgroundService] Received Chrome message:', message);

    // Handle legacy download messages from popup
    if (message.action === 'DOWNLOAD_SINGLE') {
      console.log('[BackgroundService] Processing DOWNLOAD_SINGLE with image:', message.image);

      this._handleDownloadSingle({
        type: MessageTypes.DOWNLOAD_SINGLE,
        payload: {
          image: message.image,
          index: message.index
        }
      }).then(result => {
        console.log('[BackgroundService] Download single result:', result);
        sendResponse(result);
      }).catch(error => {
        console.error('[BackgroundService] Download single error:', error);
        sendResponse({
          success: false,
          error: error.message
        });
      });
      return true; // Keep message channel open for async response
    }

    if (message.action === 'DOWNLOAD_BATCH') {
      this._handleDownloadBatch({
        type: MessageTypes.DOWNLOAD_BATCH,
        payload: {
          images: message.images
        }
      }).then(result => {
        console.log('[BackgroundService] Download batch result:', result);
        sendResponse(result);
      }).catch(error => {
        console.error('[BackgroundService] Download batch error:', error);
        sendResponse({
          success: false,
          error: error.message
        });
      });
      return true; // Keep message channel open for async response
    }

    if (message.action === 'getCurrentImages') {
      this._handleGetImages({
        type: MessageTypes.GET_IMAGES,
        payload: {}
      }).then(result => {
        console.log('[BackgroundService] Get images result:', result);
        sendResponse(result);
      }).catch(error => {
        console.error('[BackgroundService] Get images error:', error);
        sendResponse({
          success: false,
          error: error.message,
          images: []
        });
      });
      return true; // Keep message channel open for async response
    }

    // Handle other legacy messages
    console.log('[BackgroundService] Unhandled Chrome message:', message.action);
    return false;
  }

  /**
   * Handle images extracted message
   * @private
   * @param {import('../interfaces/IMessageBus.js').Message} message - Message with extracted images
   * @returns {Promise<*>} Handler response
   */
  async _handleImagesExtracted(message) {
    try {
      const { images } = message.payload;

      if (!Array.isArray(images)) {
        throw new ExtensionError(
          'Invalid images data received',
          ErrorCodes.VALIDATION_ERROR,
          { payload: message.payload }
        );
      }

      // Store images in download manager
      if (this.downloadManager && typeof this.downloadManager.storeImages === 'function') {
        await this.downloadManager.storeImages(images);
      }

      this.logger?.info('Images extracted and stored', { count: images.length });
      return { success: true, count: images.length };

    } catch (error) {
      return await this._handleMessageError(error, 'images extraction');
    }
  }

  /**
   * Handle extraction error message
   * @private
   * @param {import('../interfaces/IMessageBus.js').Message} message - Error message
   * @returns {Promise<*>} Handler response
   */
  async _handleExtractionError(message) {
    try {
      const { error, context } = message.payload;

      this.logger?.error('Image extraction error received', { error, context });

      // Report error to error handler
      if (this.errorHandler) {
        const extensionError = new ExtensionError(
          'Image extraction failed',
          ErrorCodes.EXTRACTION_ERROR,
          { originalError: error, ...context }
        );
        await this.errorHandler.handleError(extensionError);
      }

      return { success: true, acknowledged: true };

    } catch (error) {
      return await this._handleMessageError(error, 'extraction error handling');
    }
  }

  /**
   * Handle single image download request
   * @private
   * @param {import('../interfaces/IMessageBus.js').Message} message - Download request message
   * @returns {Promise<*>} Handler response
   */
  async _handleDownloadSingle(message) {
    try {
      const { image, index } = message.payload;

      if (!this.downloadManager) {
        throw new ExtensionError(
          'Download manager not available',
          ErrorCodes.SERVICE_UNAVAILABLE
        );
      }

      const result = await this.downloadManager.downloadSingleImage(image, index);

      this.logger?.info('Single image download completed', {
        imageId: image.id,
        success: result.success
      });

      return result;

    } catch (error) {
      return await this._handleMessageError(error, 'single image download');
    }
  }

  /**
   * Handle batch download request
   * @private
   * @param {import('../interfaces/IMessageBus.js').Message} message - Batch download request
   * @returns {Promise<*>} Handler response
   */
  async _handleDownloadBatch(message) {
    try {
      const { images } = message.payload;

      if (!Array.isArray(images)) {
        throw new ExtensionError(
          'Invalid images array for batch download',
          ErrorCodes.VALIDATION_ERROR,
          { payload: message.payload }
        );
      }

      if (!this.downloadManager) {
        throw new ExtensionError(
          'Download manager not available',
          ErrorCodes.SERVICE_UNAVAILABLE
        );
      }

      const results = await this.downloadManager.downloadAllImages(images);

      this.logger?.info('Batch download completed', {
        total: images.length,
        successful: results.filter(r => r.success).length
      });

      return { success: true, results };

    } catch (error) {
      return await this._handleMessageError(error, 'batch download');
    }
  }

  /**
   * Handle cancel downloads request
   * @private
   * @param {import('../interfaces/IMessageBus.js').Message} message - Cancel request
   * @returns {Promise<*>} Handler response
   */
  async _handleCancelDownloads(message) {
    try {
      if (!this.downloadManager || typeof this.downloadManager.cancelDownloads !== 'function') {
        throw new ExtensionError(
          'Download cancellation not supported',
          ErrorCodes.OPERATION_NOT_SUPPORTED
        );
      }

      await this.downloadManager.cancelDownloads();
      this.logger?.info('Downloads cancelled');

      return { success: true, cancelled: true };

    } catch (error) {
      return await this._handleMessageError(error, 'download cancellation');
    }
  }

  /**
   * Handle retry downloads request
   * @private
   * @param {import('../interfaces/IMessageBus.js').Message} message - Retry request
   * @returns {Promise<*>} Handler response
   */
  async _handleRetryDownloads(message) {
    try {
      if (!this.downloadManager || typeof this.downloadManager.retryFailedDownloads !== 'function') {
        throw new ExtensionError(
          'Download retry not supported',
          ErrorCodes.OPERATION_NOT_SUPPORTED
        );
      }

      const results = await this.downloadManager.retryFailedDownloads();
      this.logger?.info('Failed downloads retried', { results });

      return { success: true, results };

    } catch (error) {
      return await this._handleMessageError(error, 'download retry');
    }
  }

  /**
   * Handle get images request
   * @private
   * @param {import('../interfaces/IMessageBus.js').Message} message - Get images request
   * @returns {Promise<*>} Handler response
   */
  async _handleGetImages(message) {
    try {
      if (!this.downloadManager || typeof this.downloadManager.getStoredImages !== 'function') {
        return { success: true, images: [] };
      }

      const images = this.downloadManager.getStoredImages();
      return { success: true, images };

    } catch (error) {
      return await this._handleMessageError(error, 'get images');
    }
  }

  /**
   * Handle get download status request
   * @private
   * @param {import('../interfaces/IMessageBus.js').Message} message - Status request
   * @returns {Promise<*>} Handler response
   */
  async _handleGetDownloadStatus(message) {
    try {
      if (!this.downloadManager || typeof this.downloadManager.getDownloadProgress !== 'function') {
        return { success: true, status: { active: false, progress: 0 } };
      }

      const status = this.downloadManager.getDownloadProgress();
      return { success: true, status };

    } catch (error) {
      return await this._handleMessageError(error, 'get download status');
    }
  }

  /**
   * Handle ping request
   * @private
   * @param {import('../interfaces/IMessageBus.js').Message} message - Ping message
   * @returns {Promise<*>} Handler response
   */
  async _handlePing(message) {
    return {
      success: true,
      pong: true,
      timestamp: Date.now(),
      serviceReady: this.isReady()
    };
  }

  /**
   * Handle get configuration request
   * @private
   * @param {import('../interfaces/IMessageBus.js').Message} message - Config request
   * @returns {Promise<*>} Handler response
   */
  async _handleGetConfig(message) {
    try {
      const config = this.serviceContainer.get('config');
      const configData = config ? config.getAll() : {};

      return { success: true, config: configData };

    } catch (error) {
      return await this._handleMessageError(error, 'get configuration');
    }
  }

  /**
   * Handle update configuration request
   * @private
   * @param {import('../interfaces/IMessageBus.js').Message} message - Config update request
   * @returns {Promise<*>} Handler response
   */
  async _handleUpdateConfig(message) {
    try {
      const { updates } = message.payload;
      const config = this.serviceContainer.get('config');

      if (!config || typeof config.update !== 'function') {
        throw new ExtensionError(
          'Configuration service not available',
          ErrorCodes.SERVICE_UNAVAILABLE
        );
      }

      await config.update(updates);
      this.logger?.info('Configuration updated', { updates });

      return { success: true, updated: true };

    } catch (error) {
      return await this._handleMessageError(error, 'update configuration');
    }
  }

  /**
   * Handle message processing errors
   * @private
   * @param {Error} error - Error that occurred
   * @param {string} operation - Operation that failed
   * @returns {Promise<*>} Error response
   */
  async _handleMessageError(error, operation) {
    const extensionError = error instanceof ExtensionError ? error : new ExtensionError(
      `${operation} failed`,
      ErrorCodes.MESSAGE_PROCESSING_ERROR,
      { originalError: error.message, operation }
    );

    this.logger?.error(`Message handler error: ${operation}`, { error: extensionError });

    if (this.errorHandler) {
      await this.errorHandler.handleError(extensionError);
    }

    return {
      success: false,
      error: extensionError.message,
      code: extensionError.code
    };
  }

  /**
   * Handle service-level errors
   * @private
   * @param {Error} error - Error that occurred
   * @param {string} context - Context where error occurred
   * @returns {Promise<void>}
   */
  async _handleServiceError(error, context) {
    const extensionError = error instanceof ExtensionError ? error : new ExtensionError(
      `Background service error during ${context}`,
      ErrorCodes.SERVICE_ERROR,
      { originalError: error.message, context }
    );

    if (this.errorHandler) {
      await this.errorHandler.handleError(extensionError);
    } else if (this.logger) {
      this.logger.error(`Service error: ${context}`, { error: extensionError });
    } else {
      console.error(`[BackgroundService] ${context} error:`, extensionError);
    }
  }
}

/**
 * Create and initialize background service
 * @returns {Promise<BackgroundService>} Initialized background service
 */
export async function createBackgroundService() {
  const service = new BackgroundService();
  await service.initialize();
  return service;
}
