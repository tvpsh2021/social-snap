/**
 * @fileoverview Image extraction service for coordinated extraction
 * Handles extraction progress tracking, caching, and user feedback
 */

import { ExtensionError, ErrorCodes } from '../core/types/ErrorTypes.js';
import { ImageData } from '../core/types/ImageTypes.js';
import { MessageTypes, createMessage } from '../core/types/MessageTypes.js';

/**
 * Service for coordinating image extraction between platform extractors and UI
 */
export class ImageExtractionService {
  /**
   * Create image extraction service
   * @param {Object} dependencies - Injected dependencies
   * @param {import('../core/interfaces/ILogger.js').ILogger} dependencies.logger - Logger service
   * @param {import('../core/interfaces/IErrorHandler.js').IErrorHandler} dependencies.errorHandler - Error handler service
   * @param {import('../core/interfaces/IMessageBus.js').IMessageBus} dependencies.messageBus - Message bus service
   */
  constructor({ logger, errorHandler, messageBus }) {
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.messageBus = messageBus;

    // Extraction state
    this.isExtracting = false;
    this.currentExtraction = null;
    this.extractionProgress = {
      total: 0,
      completed: 0,
      failed: 0,
      percentage: 0
    };

    // Cache for extraction results
    this.extractionCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    this.maxCacheSize = 10;

    // Progress tracking
    this.progressCallbacks = new Set();
    this.extractionStartTime = null;

    this.logger?.info('ImageExtractionService created');
  }

  /**
   * Extract images using the provided extractor
   * @param {import('../platforms/base/BasePlatformExtractor.js').BasePlatformExtractor} extractor - Platform extractor
   * @param {Object} [options={}] - Extraction options
   * @param {boolean} [options.useCache=true] - Whether to use cached results
   * @param {boolean} [options.trackProgress=true] - Whether to track progress
   * @param {Function} [options.onProgress] - Progress callback function
   * @returns {Promise<ImageData[]>} Extracted images
   */
  async extractImages(extractor, options = {}) {
    const {
      useCache = true,
      trackProgress = true,
      onProgress = null
    } = options;

    if (this.isExtracting) {
      throw new ExtensionError(
        'Extraction already in progress',
        ErrorCodes.OPERATION_IN_PROGRESS,
        { currentExtraction: this.currentExtraction?.id }
      );
    }

    const extractionId = this._generateExtractionId();
    const cacheKey = this._generateCacheKey(extractor, window.location.href);

    try {
      // Check cache first
      if (useCache && this.extractionCache.has(cacheKey)) {
        const cachedResult = this.extractionCache.get(cacheKey);
        if (this._isCacheValid(cachedResult)) {
          this.logger?.info('Using cached extraction result', {
            extractionId,
            platform: extractor.platformName,
            imageCount: cachedResult.images.length
          });

          return cachedResult.images;
        } else {
          // Remove expired cache entry
          this.extractionCache.delete(cacheKey);
        }
      }

      // Start extraction
      this.isExtracting = true;
      this.extractionStartTime = Date.now();
      this.currentExtraction = {
        id: extractionId,
        platform: extractor.platformName,
        url: window.location.href,
        startTime: this.extractionStartTime
      };

      // Reset progress
      this._resetProgress();

      // Add progress callback if provided
      if (onProgress && typeof onProgress === 'function') {
        this.progressCallbacks.add(onProgress);
      }

      this.logger?.info('Starting image extraction', {
        extractionId,
        platform: extractor.platformName,
        url: window.location.href
      });

      // Notify extraction started
      await this._notifyExtractionStarted();

      // Perform extraction with progress tracking
      const images = await this._performExtraction(extractor, trackProgress);

      // Validate and process results
      const validatedImages = await this._validateAndProcessImages(images, extractor);

      // Cache results
      if (useCache && validatedImages.length > 0) {
        this._cacheResults(cacheKey, validatedImages);
      }

      // Notify extraction completed
      await this._notifyExtractionCompleted(validatedImages);

      this.logger?.info('Image extraction completed successfully', {
        extractionId,
        platform: extractor.platformName,
        imageCount: validatedImages.length,
        duration: Date.now() - this.extractionStartTime
      });

      return validatedImages;

    } catch (error) {
      const wrappedError = new ExtensionError(
        'Image extraction failed',
        ErrorCodes.EXTRACTION_ERROR,
        {
          extractionId,
          platform: extractor.platformName,
          url: window.location.href,
          originalError: error.message
        }
      );

      await this.errorHandler?.handleError(wrappedError);
      await this._notifyExtractionFailed(wrappedError);

      throw wrappedError;

    } finally {
      // Cleanup
      this.isExtracting = false;
      this.currentExtraction = null;
      this.extractionStartTime = null;

      if (onProgress) {
        this.progressCallbacks.delete(onProgress);
      }
    }
  }

  /**
   * Get current extraction progress
   * @returns {Object} Progress information
   */
  getExtractionProgress() {
    return {
      ...this.extractionProgress,
      isExtracting: this.isExtracting,
      currentExtraction: this.currentExtraction,
      elapsedTime: this.extractionStartTime ? Date.now() - this.extractionStartTime : 0
    };
  }

  /**
   * Cancel current extraction
   * @returns {Promise<void>}
   */
  async cancelExtraction() {
    if (!this.isExtracting) {
      return;
    }

    this.logger?.info('Cancelling extraction', {
      extractionId: this.currentExtraction?.id
    });

    // Set cancellation flag
    if (this.currentExtraction) {
      this.currentExtraction.cancelled = true;
    }

    // Notify cancellation
    await this._notifyExtractionCancelled();

    // Reset state
    this.isExtracting = false;
    this.currentExtraction = null;
    this.extractionStartTime = null;
    this._resetProgress();
  }

  /**
   * Clear extraction cache
   * @param {string} [platform] - Specific platform to clear, or all if not specified
   * @returns {void}
   */
  clearCache(platform = null) {
    if (platform) {
      // Clear cache for specific platform
      const keysToDelete = [];
      for (const [key, value] of this.extractionCache) {
        if (value.platform === platform) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => this.extractionCache.delete(key));

      this.logger?.info('Cache cleared for platform', { platform, clearedEntries: keysToDelete.length });
    } else {
      // Clear all cache
      const clearedEntries = this.extractionCache.size;
      this.extractionCache.clear();

      this.logger?.info('All cache cleared', { clearedEntries });
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    const stats = {
      totalEntries: this.extractionCache.size,
      maxSize: this.maxCacheSize,
      platforms: {},
      oldestEntry: null,
      newestEntry: null
    };

    let oldestTime = Date.now();
    let newestTime = 0;

    for (const [key, value] of this.extractionCache) {
      // Platform stats
      if (!stats.platforms[value.platform]) {
        stats.platforms[value.platform] = 0;
      }
      stats.platforms[value.platform]++;

      // Time stats
      if (value.timestamp < oldestTime) {
        oldestTime = value.timestamp;
        stats.oldestEntry = value.timestamp;
      }
      if (value.timestamp > newestTime) {
        newestTime = value.timestamp;
        stats.newestEntry = value.timestamp;
      }
    }

    return stats;
  }

  /**
   * Add progress callback
   * @param {Function} callback - Progress callback function
   * @returns {void}
   */
  addProgressCallback(callback) {
    if (typeof callback === 'function') {
      this.progressCallbacks.add(callback);
    }
  }

  /**
   * Remove progress callback
   * @param {Function} callback - Progress callback function
   * @returns {void}
   */
  removeProgressCallback(callback) {
    this.progressCallbacks.delete(callback);
  }

  /**
   * Perform the actual extraction with progress tracking
   * @private
   * @param {import('../platforms/base/BasePlatformExtractor.js').BasePlatformExtractor} extractor - Platform extractor
   * @param {boolean} trackProgress - Whether to track progress
   * @returns {Promise<Array>} Raw extraction results
   */
  async _performExtraction(extractor, trackProgress) {
    if (trackProgress) {
      // If extractor supports progress tracking, use it
      if (typeof extractor.extractImagesWithProgress === 'function') {
        return await extractor.extractImagesWithProgress((progress) => {
          this._updateProgress(progress);
        });
      }
    }

    // Fallback to regular extraction
    const images = await extractor.extractImages();

    if (trackProgress) {
      this._updateProgress({
        total: images.length,
        completed: images.length,
        failed: 0,
        percentage: 100
      });
    }

    return images;
  }

  /**
   * Validate and process extracted images
   * @private
   * @param {Array} rawImages - Raw extraction results
   * @param {import('../platforms/base/BasePlatformExtractor.js').BasePlatformExtractor} extractor - Platform extractor
   * @returns {Promise<ImageData[]>} Validated and processed images
   */
  async _validateAndProcessImages(rawImages, extractor) {
    const validatedImages = [];
    const errors = [];

    for (let i = 0; i < rawImages.length; i++) {
      try {
        const rawImage = rawImages[i];

        // Validate image data
        if (!this._isValidImageData(rawImage)) {
          errors.push(`Invalid image data at index ${i}`);
          continue;
        }

        // Create ImageData instance
        const imageData = new ImageData({
          id: this._generateImageId(rawImage, i),
          url: rawImage.fullSizeUrl || rawImage.url,
          thumbnailUrl: rawImage.thumbnailUrl || rawImage.url,
          alt: rawImage.alt || '',
          width: rawImage.width || 0,
          height: rawImage.height || 0,
          platform: extractor.platformName,
          extractedAt: new Date().toISOString(),
          metadata: {
            index: i,
            originalData: rawImage,
            extractionId: this.currentExtraction?.id
          }
        });

        validatedImages.push(imageData);

      } catch (error) {
        errors.push(`Error processing image at index ${i}: ${error.message}`);
        this.logger?.warn('Error processing image', { index: i, error: error.message });
      }
    }

    if (errors.length > 0) {
      this.logger?.warn('Some images failed validation', {
        totalImages: rawImages.length,
        validImages: validatedImages.length,
        errors: errors.length
      });
    }

    return validatedImages;
  }

  /**
   * Check if image data is valid
   * @private
   * @param {*} imageData - Image data to validate
   * @returns {boolean} True if valid
   */
  _isValidImageData(imageData) {
    return (
      imageData &&
      typeof imageData === 'object' &&
      (imageData.url || imageData.fullSizeUrl) &&
      typeof (imageData.url || imageData.fullSizeUrl) === 'string' &&
      (imageData.url || imageData.fullSizeUrl).startsWith('http')
    );
  }

  /**
   * Generate extraction ID
   * @private
   * @returns {string} Unique extraction ID
   */
  _generateExtractionId() {
    return `extraction_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Generate image ID
   * @private
   * @param {Object} imageData - Image data
   * @param {number} index - Image index
   * @returns {string} Unique image ID
   */
  _generateImageId(imageData, index) {
    const url = imageData.fullSizeUrl || imageData.url;
    const urlHash = this._simpleHash(url);
    return `img_${this.currentExtraction?.id}_${index}_${urlHash}`;
  }

  /**
   * Generate cache key
   * @private
   * @param {import('../platforms/base/BasePlatformExtractor.js').BasePlatformExtractor} extractor - Platform extractor
   * @param {string} url - Page URL
   * @returns {string} Cache key
   */
  _generateCacheKey(extractor, url) {
    const urlHash = this._simpleHash(url);
    return `${extractor.platformName}_${urlHash}`;
  }

  /**
   * Simple hash function for strings
   * @private
   * @param {string} str - String to hash
   * @returns {string} Hash value
   */
  _simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Cache extraction results
   * @private
   * @param {string} cacheKey - Cache key
   * @param {ImageData[]} images - Images to cache
   * @returns {void}
   */
  _cacheResults(cacheKey, images) {
    // Ensure cache size limit
    if (this.extractionCache.size >= this.maxCacheSize) {
      this._evictOldestCacheEntry();
    }

    const cacheEntry = {
      images,
      platform: images[0]?.platform || 'unknown',
      timestamp: Date.now(),
      url: window.location.href
    };

    this.extractionCache.set(cacheKey, cacheEntry);

    this.logger?.debug('Results cached', {
      cacheKey,
      imageCount: images.length,
      cacheSize: this.extractionCache.size
    });
  }

  /**
   * Check if cache entry is valid
   * @private
   * @param {Object} cacheEntry - Cache entry to check
   * @returns {boolean} True if valid
   */
  _isCacheValid(cacheEntry) {
    const age = Date.now() - cacheEntry.timestamp;
    return age < this.cacheTimeout;
  }

  /**
   * Evict oldest cache entry
   * @private
   * @returns {void}
   */
  _evictOldestCacheEntry() {
    let oldestKey = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.extractionCache) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.extractionCache.delete(oldestKey);
      this.logger?.debug('Evicted oldest cache entry', { key: oldestKey });
    }
  }

  /**
   * Reset progress tracking
   * @private
   * @returns {void}
   */
  _resetProgress() {
    this.extractionProgress = {
      total: 0,
      completed: 0,
      failed: 0,
      percentage: 0
    };
  }

  /**
   * Update progress and notify callbacks
   * @private
   * @param {Object} progress - Progress update
   * @returns {void}
   */
  _updateProgress(progress) {
    this.extractionProgress = {
      ...this.extractionProgress,
      ...progress
    };

    // Calculate percentage if not provided
    if (this.extractionProgress.total > 0 && !progress.percentage) {
      this.extractionProgress.percentage = Math.round(
        (this.extractionProgress.completed / this.extractionProgress.total) * 100
      );
    }

    // Notify progress callbacks
    for (const callback of this.progressCallbacks) {
      try {
        callback(this.extractionProgress);
      } catch (error) {
        this.logger?.warn('Error in progress callback', { error: error.message });
      }
    }

    // Notify via message bus
    this._notifyProgressUpdate();
  }

  /**
   * Notify extraction started
   * @private
   * @returns {Promise<void>}
   */
  async _notifyExtractionStarted() {
    try {
      if (this.messageBus) {
        const message = createMessage(MessageTypes.EXTRACTION_STARTED, {
          extractionId: this.currentExtraction?.id,
          platform: this.currentExtraction?.platform,
          url: this.currentExtraction?.url
        });

        this.messageBus.sendAsync(message);
      }
    } catch (error) {
      this.logger?.warn('Failed to notify extraction started', { error: error.message });
    }
  }

  /**
   * Notify extraction completed
   * @private
   * @param {ImageData[]} images - Extracted images
   * @returns {Promise<void>}
   */
  async _notifyExtractionCompleted(images) {
    try {
      if (this.messageBus) {
        const message = createMessage(MessageTypes.EXTRACTION_COMPLETED, {
          extractionId: this.currentExtraction?.id,
          platform: this.currentExtraction?.platform,
          url: this.currentExtraction?.url,
          imageCount: images.length,
          duration: Date.now() - this.extractionStartTime
        });

        this.messageBus.sendAsync(message);
      }
    } catch (error) {
      this.logger?.warn('Failed to notify extraction completed', { error: error.message });
    }
  }

  /**
   * Notify extraction failed
   * @private
   * @param {Error} error - Extraction error
   * @returns {Promise<void>}
   */
  async _notifyExtractionFailed(error) {
    try {
      if (this.messageBus) {
        const message = createMessage(MessageTypes.EXTRACTION_FAILED, {
          extractionId: this.currentExtraction?.id,
          platform: this.currentExtraction?.platform,
          url: this.currentExtraction?.url,
          error: error.message,
          errorCode: error.code
        });

        this.messageBus.sendAsync(message);
      }
    } catch (notifyError) {
      this.logger?.warn('Failed to notify extraction failed', { error: notifyError.message });
    }
  }

  /**
   * Notify extraction cancelled
   * @private
   * @returns {Promise<void>}
   */
  async _notifyExtractionCancelled() {
    try {
      if (this.messageBus) {
        const message = createMessage(MessageTypes.EXTRACTION_CANCELLED, {
          extractionId: this.currentExtraction?.id,
          platform: this.currentExtraction?.platform,
          url: this.currentExtraction?.url
        });

        this.messageBus.sendAsync(message);
      }
    } catch (error) {
      this.logger?.warn('Failed to notify extraction cancelled', { error: error.message });
    }
  }

  /**
   * Notify progress update
   * @private
   * @returns {void}
   */
  _notifyProgressUpdate() {
    try {
      if (this.messageBus) {
        const message = createMessage(MessageTypes.EXTRACTION_PROGRESS, {
          extractionId: this.currentExtraction?.id,
          progress: this.extractionProgress
        });

        this.messageBus.sendAsync(message);
      }
    } catch (error) {
      this.logger?.warn('Failed to notify progress update', { error: error.message });
    }
  }
}
