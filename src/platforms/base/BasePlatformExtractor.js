/**
 * @fileoverview Base class for platform-specific image extractors
 * Provides common functionality and enforces interface contract
 */

import { createImageData, isValidImageData } from '../../core/types/ImageTypes.js';
import { IMAGE_FILTERS } from '../../shared/constants/PlatformConstants.js';

/**
 * Abstract base class for platform-specific image extractors
 * Implements common functionality and enforces interface contract
 * @abstract
 */
export class BasePlatformExtractor {
  /**
   * @param {Object} dependencies - Injected dependencies
   * @param {import('../../core/interfaces/ILogger.js').ILogger} dependencies.logger - Logger service
   * @param {import('../../core/interfaces/IErrorHandler.js').IErrorHandler} dependencies.errorHandler - Error handler service
   * @param {Object} [config={}] - Platform-specific configuration
   */
  constructor({ logger, errorHandler }, config = {}) {
    if (new.target === BasePlatformExtractor) {
      throw new Error('BasePlatformExtractor is abstract and cannot be instantiated directly');
    }

    this.logger = logger;
    this.errorHandler = errorHandler;
    this.config = {
      // Default configuration
      minImageWidth: IMAGE_FILTERS.MIN_WIDTH,
      minImageHeight: IMAGE_FILTERS.MIN_HEIGHT,
      maxImages: 50,
      timeout: 30000,
      ...config
    };

    this._extractionStartTime = null;
    this._extractedImages = [];
  }

  /**
   * Platform name identifier - must be implemented by subclasses
   * @abstract
   * @type {string}
   */
  get platformName() {
    throw new Error('platformName getter must be implemented by subclass');
  }

  /**
   * Platform-specific URL patterns - must be implemented by subclasses
   * @abstract
   * @type {string[]}
   */
  get supportedUrlPatterns() {
    throw new Error('supportedUrlPatterns getter must be implemented by subclass');
  }

  /**
   * Check if the current URL is supported by this platform extractor
   * @param {string} url - The URL to check
   * @returns {boolean} True if the platform supports this URL
   */
  isSupported(url) {
    try {
      const urlObj = new URL(url);
      return this.supportedUrlPatterns.some(pattern => {
        if (typeof pattern === 'string') {
          return urlObj.hostname.includes(pattern);
        }
        if (pattern instanceof RegExp) {
          return pattern.test(url);
        }
        return false;
      });
    } catch (error) {
      this.logger?.warn('Invalid URL provided to isSupported', { url, error: error.message });
      return false;
    }
  }

  /**
   * Extract images from the current page - must be implemented by subclasses
   * @abstract
   * @returns {Promise<import('../../core/interfaces/IPlatformExtractor.js').ImageData[]>} Array of extracted image data
   */
  async extractImages() {
    throw new Error('extractImages method must be implemented by subclass');
  }

  /**
   * Validate that the current page is ready for image extraction
   * @returns {Promise<boolean>} True if page is valid for extraction
   */
  async validatePage() {
    try {
      // Check if we're on the correct platform
      if (!this.isSupported(window.location.href)) {
        this.logger?.warn('Current page is not supported by this platform extractor', {
          platform: this.platformName,
          url: window.location.href
        });
        return false;
      }

      // Check if page has loaded
      if (document.readyState !== 'complete') {
        this.logger?.info('Page is still loading, waiting for completion');
        await this._waitForPageLoad();
      }

      // Platform-specific validation can be overridden by subclasses
      return await this._validatePlatformSpecific();
    } catch (error) {
      await this.errorHandler?.handleError(error, {
        context: 'page_validation',
        platform: this.platformName,
        url: window.location.href
      });
      return false;
    }
  }

  /**
   * Create standardized image data object from HTML image element
   * @param {HTMLImageElement} imgElement - Image element
   * @param {number} index - Image index in extraction sequence
   * @param {Object} [additionalMetadata={}] - Additional platform-specific metadata
   * @returns {import('../../core/interfaces/IPlatformExtractor.js').ImageData} Formatted image data
   */
  createImageData(imgElement, index, additionalMetadata = {}) {
    try {
      const rect = imgElement.getBoundingClientRect();
      const src = this._getBestImageUrl(imgElement);
      const thumbnailUrl = this._getThumbnailUrl(imgElement, src);

      const imageData = createImageData({
        url: src,
        thumbnailUrl,
        alt: imgElement.alt || `${this.platformName} image ${index + 1}`,
        width: imgElement.naturalWidth || rect.width,
        height: imgElement.naturalHeight || rect.height,
        platform: this.platformName,
        metadata: {
          index: index + 1,
          extractionTime: Date.now() - (this._extractionStartTime || Date.now()),
          domRect: {
            width: rect.width,
            height: rect.height,
            x: rect.x,
            y: rect.y
          },
          element: {
            tagName: imgElement.tagName,
            className: imgElement.className,
            id: imgElement.id
          },
          ...additionalMetadata
        }
      });

      // Validate the created image data
      if (!isValidImageData(imageData)) {
        throw new Error('Created image data is invalid');
      }

      this.logger?.debug('Created image data', {
        platform: this.platformName,
        index: index + 1,
        url: src.substring(0, 100),
        alt: imageData.alt.substring(0, 50)
      });

      return imageData;
    } catch (error) {
      this.logger?.error('Failed to create image data', {
        platform: this.platformName,
        index,
        error: error.message,
        imgSrc: imgElement.src?.substring(0, 100)
      });
      throw error;
    }
  }

  /**
   * Validate image element meets minimum requirements
   * @param {HTMLImageElement} imgElement - Image element to validate
   * @returns {boolean} True if image element is valid
   */
  validateImageElement(imgElement) {
    try {
      if (!imgElement || imgElement.tagName !== 'IMG') {
        return false;
      }

      const rect = imgElement.getBoundingClientRect();
      const src = imgElement.src || imgElement.currentSrc;

      // Check basic requirements
      if (!src || src === '') {
        this.logger?.debug('Image element has no src', { element: imgElement });
        return false;
      }

      // Check dimensions
      if (rect.width < this.config.minImageWidth || rect.height < this.config.minImageHeight) {
        this.logger?.debug('Image element too small', {
          width: rect.width,
          height: rect.height,
          minWidth: this.config.minImageWidth,
          minHeight: this.config.minImageHeight
        });
        return false;
      }

      // Check for common exclusions
      if (this._shouldExcludeImage(imgElement, src)) {
        return false;
      }

      return true;
    } catch (error) {
      this.logger?.warn('Error validating image element', { error: error.message });
      return false;
    }
  }

  /**
   * Filter and validate array of image elements
   * @param {HTMLImageElement[]} imageElements - Array of image elements
   * @returns {HTMLImageElement[]} Filtered array of valid image elements
   */
  filterValidImages(imageElements) {
    const validImages = imageElements.filter(img => this.validateImageElement(img));

    this.logger?.info('Filtered image elements', {
      platform: this.platformName,
      total: imageElements.length,
      valid: validImages.length,
      filtered: imageElements.length - validImages.length
    });

    return validImages;
  }

  /**
   * Wait for specific elements to appear on the page
   * @param {string} selector - CSS selector to wait for
   * @param {number} [timeout=5000] - Maximum time to wait in milliseconds
   * @returns {Promise<Element|null>} Found element or null if timeout
   */
  async waitForElement(selector, timeout = 5000) {
    return new Promise((resolve) => {
      const startTime = Date.now();

      const checkElement = () => {
        const element = document.querySelector(selector);
        if (element) {
          resolve(element);
          return;
        }

        if (Date.now() - startTime >= timeout) {
          this.logger?.warn('Element wait timeout', { selector, timeout });
          resolve(null);
          return;
        }

        setTimeout(checkElement, 100);
      };

      checkElement();
    });
  }

  /**
   * Wait for page to fully load
   * @param {number} [timeout=10000] - Maximum time to wait
   * @returns {Promise<void>}
   */
  async _waitForPageLoad(timeout = 10000) {
    return new Promise((resolve) => {
      if (document.readyState === 'complete') {
        resolve();
        return;
      }

      const startTime = Date.now();
      const checkReady = () => {
        if (document.readyState === 'complete' || Date.now() - startTime >= timeout) {
          resolve();
          return;
        }
        setTimeout(checkReady, 100);
      };

      checkReady();
    });
  }

  /**
   * Platform-specific page validation - can be overridden by subclasses
   * @protected
   * @returns {Promise<boolean>} True if page is valid for this platform
   */
  async _validatePlatformSpecific() {
    // Default implementation - subclasses can override
    return true;
  }

  /**
   * Get the best quality image URL from an image element
   * @protected
   * @param {HTMLImageElement} imgElement - Image element
   * @returns {string} Best quality image URL
   */
  _getBestImageUrl(imgElement) {
    // Check srcset for highest quality version
    if (imgElement.srcset) {
      const sources = imgElement.srcset.split(',').map(s => s.trim());
      let maxWidth = 0;
      let bestUrl = imgElement.src;

      sources.forEach(source => {
        const parts = source.split(' ');
        if (parts.length >= 2) {
          const url = parts[0];
          const descriptor = parts[1];
          if (descriptor.endsWith('w')) {
            const width = parseInt(descriptor.slice(0, -1));
            if (width > maxWidth) {
              maxWidth = width;
              bestUrl = url;
            }
          }
        }
      });

      if (maxWidth > 0) {
        this.logger?.debug('Selected best quality from srcset', {
          selectedWidth: maxWidth,
          totalSources: sources.length
        });
        return bestUrl;
      }
    }

    return imgElement.currentSrc || imgElement.src;
  }

  /**
   * Get thumbnail URL for an image
   * @protected
   * @param {HTMLImageElement} imgElement - Image element
   * @param {string} fullUrl - Full resolution URL
   * @returns {string} Thumbnail URL
   */
  _getThumbnailUrl(imgElement, fullUrl) {
    // For social media platforms, often the src is already a reasonable thumbnail
    // Subclasses can override this for platform-specific thumbnail logic
    return imgElement.src || fullUrl;
  }

  /**
   * Check if image should be excluded based on common criteria
   * @protected
   * @param {HTMLImageElement} imgElement - Image element
   * @param {string} src - Image source URL
   * @returns {boolean} True if image should be excluded
   */
  _shouldExcludeImage(imgElement, src) {
    const alt = (imgElement.alt || '').toLowerCase();
    const srcLower = src.toLowerCase();

    // Common exclusions
    const exclusions = [
      'profile',
      'avatar',
      'icon',
      'emoji',
      'logo',
      'button',
      'arrow',
      'loading',
      'spinner',
      'placeholder'
    ];

    return exclusions.some(exclusion =>
      alt.includes(exclusion) || srcLower.includes(exclusion)
    );
  }

  /**
   * Start extraction timing
   * @protected
   */
  _startExtraction() {
    this._extractionStartTime = Date.now();
    this._extractedImages = [];

    this.logger?.info('Starting image extraction', {
      platform: this.platformName,
      url: window.location.href,
      timestamp: this._extractionStartTime
    });
  }

  /**
   * Complete extraction and log results
   * @protected
   * @param {import('../../core/interfaces/IPlatformExtractor.js').ImageData[]} images - Extracted images
   * @returns {import('../../core/interfaces/IPlatformExtractor.js').ImageData[]} The same images array
   */
  _completeExtraction(images) {
    const extractionTime = Date.now() - (this._extractionStartTime || Date.now());

    this.logger?.info('Completed image extraction', {
      platform: this.platformName,
      imageCount: images.length,
      extractionTime,
      url: window.location.href
    });

    this._extractedImages = images;
    return images;
  }
}
