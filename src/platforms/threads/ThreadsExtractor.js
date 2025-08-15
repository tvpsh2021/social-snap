/**
 * @fileoverview Threads platform image extractor
 * Refactored to use the new BasePlatformExtractor architecture
 */

import { BasePlatformExtractor } from '../base/BasePlatformExtractor.js';
import { PLATFORMS } from '../../shared/constants/PlatformConstants.js';
import { getPlatformConfig } from '../../shared/constants/PlatformConstants.js';

/**
 * Threads platform image extractor
 * Extracts images from Threads posts with advanced filtering
 */
export class ThreadsExtractor extends BasePlatformExtractor {
  /**
   * @param {Object} dependencies - Injected dependencies
   * @param {Object} [customConfig={}] - Custom configuration
   */
  constructor(dependencies, customConfig = {}) {
    const defaultConfig = getPlatformConfig(PLATFORMS.THREADS);
    const mergedConfig = {
      ...defaultConfig,
      ...customConfig,
      // Deep merge nested objects
      selectors: {
        ...defaultConfig.selectors,
        ...customConfig.selectors
      },
      extraction: {
        ...defaultConfig.extraction,
        ...customConfig.extraction
      },
      filtering: {
        ...defaultConfig.filtering,
        ...customConfig.filtering
      }
    };

    super(dependencies, mergedConfig);
  }

  /**
   * Platform name identifier
   * @type {string}
   */
  get platformName() {
    return PLATFORMS.THREADS;
  }

  /**
   * Supported URL patterns for Threads
   * @type {string[]}
   */
  get supportedUrlPatterns() {
    return this.config.supportedUrlPatterns || ['threads.com'];
  }

  /**
   * Extract images from the current Threads page
   * @returns {Promise<import('../../core/interfaces/IPlatformExtractor.js').ImageData[]>} Array of extracted image data
   */
  async extractImages() {
    this._startExtraction();

    try {
      this.logger?.info('Starting Threads image extraction', {
        url: window.location.href,
        config: {
          maxImages: this.config.extraction.maxImages,
          excludeComments: this.config.filtering.excludeComments
        }
      });

      // Use multiple extraction strategies
      const extractedImages = await this._extractWithMultipleStrategies();

      // Filter and validate images
      const validImages = this.filterValidImages(extractedImages);

      // Apply Threads-specific filtering
      const filteredImages = this._applyThreadsFiltering(validImages);

      // Convert to standardized image data
      const imageData = filteredImages.map((img, index) =>
        this.createImageData(img, index, {
          extractionStrategy: img._extractionStrategy || 'unknown',
          isMainPost: img._isMainPost || false,
          commentFiltered: this.config.filtering.excludeComments
        })
      );

      return this._completeExtraction(imageData);

    } catch (error) {
      await this.errorHandler?.handleError(error, {
        context: 'threads_extraction',
        platform: this.platformName,
        url: window.location.href
      });
      throw error;
    }
  }

  /**
   * Validate that the current page is ready for Threads extraction
   * @returns {Promise<boolean>} True if page is valid for extraction
   */
  async _validatePlatformSpecific() {
    try {
      // Check if we're on a Threads page
      if (!window.location.hostname.includes('threads.com')) {
        return false;
      }

      // Wait for main content to load
      const mainContent = await this.waitForElement('main, [role="main"]', 5000);
      if (!mainContent) {
        this.logger?.warn('Main content not found on Threads page');
        return false;
      }

      // Check for presence of images or image containers
      const hasImages = document.querySelector('picture img, img[alt*="可能是"]');
      if (!hasImages) {
        this.logger?.info('No images found on current Threads page');
        return true; // Still valid, just no images to extract
      }

      return true;

    } catch (error) {
      this.logger?.error('Threads page validation failed', { error: error.message });
      return false;
    }
  }

  /**
   * Extract images using multiple strategies
   * @private
   * @returns {Promise<HTMLImageElement[]>} Array of image elements
   */
  async _extractWithMultipleStrategies() {
    // Import DOMUtils for optimized queries
    const { default: DOMUtils } = await import('../../shared/utils/DOMUtils.js');

    // Batch all selectors for better performance
    const selectors = [
      ...this.config.selectors.mainContainers,
      this.config.selectors.pictureImages,
      this.config.selectors.descriptiveImages,
      this.config.selectors.pictureDescriptive
    ];

    // Perform batch query
    const batchResults = DOMUtils.batchQuerySelectors(selectors);

    const strategies = [
      () => this._extractFromMainPost(batchResults),
      () => this._extractFromPictureElements(batchResults),
      () => this._extractFromDescriptiveImages(batchResults),
      () => this._extractFallback(batchResults)
    ];

    let allImages = [];

    for (const strategy of strategies) {
      try {
        const images = await strategy();
        if (images.length > 0) {
          allImages = [...allImages, ...images];
          this.logger?.debug('Strategy found images', {
            strategy: strategy.name,
            count: images.length
          });
        }
      } catch (error) {
        this.logger?.warn('Extraction strategy failed', {
          strategy: strategy.name,
          error: error.message
        });
      }
    }

    // Remove duplicates based on src
    const uniqueImages = this._removeDuplicateImages(allImages);

    this.logger?.info('Multiple strategies extraction completed', {
      totalFound: allImages.length,
      uniqueImages: uniqueImages.length
    });

    return uniqueImages;
  }

  /**
   * Extract images from main post containers
   * @private
   * @returns {HTMLImageElement[]} Array of image elements
   */
  _extractFromMainPost() {
    const images = [];
    const { mainContainers } = this.config.selectors;

    for (const selector of mainContainers) {
      const container = document.querySelector(selector);
      if (container) {
        const containerImages = container.querySelectorAll(this.config.selectors.pictureDescriptive);
        if (containerImages.length > 0) {
          this.logger?.debug('Found images in main container', {
            selector,
            count: containerImages.length
          });

          const imageArray = Array.from(containerImages);
          imageArray.forEach(img => {
            img._extractionStrategy = 'main_post';
            img._isMainPost = true;
          });

          images.push(...imageArray);
          break; // Use first successful container
        }
      }
    }

    return images;
  }

  /**
   * Extract images from picture elements
   * @private
   * @returns {HTMLImageElement[]} Array of image elements
   */
  _extractFromPictureElements() {
    const pictureImages = document.querySelectorAll(this.config.selectors.pictureImages);
    const images = Array.from(pictureImages);

    images.forEach(img => {
      img._extractionStrategy = 'picture_elements';
    });

    this.logger?.debug('Extracted from picture elements', { count: images.length });
    return images;
  }

  /**
   * Extract images with descriptive alt text
   * @private
   * @returns {HTMLImageElement[]} Array of image elements
   */
  _extractFromDescriptiveImages() {
    const descriptiveImages = document.querySelectorAll(this.config.selectors.descriptiveImages);
    const images = Array.from(descriptiveImages);

    images.forEach(img => {
      img._extractionStrategy = 'descriptive_alt';
    });

    this.logger?.debug('Extracted descriptive images', { count: images.length });
    return images;
  }

  /**
   * Fallback extraction method
   * @private
   * @returns {HTMLImageElement[]} Array of image elements
   */
  _extractFallback() {
    const allImages = document.querySelectorAll('img');
    const images = Array.from(allImages).filter(img => {
      const rect = img.getBoundingClientRect();
      return rect.width > this.config.extraction.minImageWidth &&
             rect.height > this.config.extraction.minImageHeight &&
             !this._shouldExcludeImage(img, img.src);
    });

    images.forEach(img => {
      img._extractionStrategy = 'fallback';
    });

    this.logger?.debug('Fallback extraction completed', { count: images.length });
    return images;
  }

  /**
   * Apply Threads-specific filtering
   * @private
   * @param {HTMLImageElement[]} images - Images to filter
   * @returns {HTMLImageElement[]} Filtered images
   */
  _applyThreadsFiltering(images) {
    if (!this.config.filtering.excludeComments) {
      return images;
    }

    const filteredImages = images.filter(img => {
      // Check if image is in comment section
      const isInComment = this._isImageInComment(img);

      // Apply content filtering
      const shouldKeep = this.config.filtering.contentFiltering ?
        this._shouldKeepImageByContent(img.alt) : true;

      const keep = !isInComment && shouldKeep;

      if (!keep) {
        this.logger?.debug('Filtered out image', {
          alt: img.alt?.substring(0, 50),
          isInComment,
          contentFiltered: !shouldKeep
        });
      }

      return keep;
    });

    this.logger?.info('Applied Threads filtering', {
      original: images.length,
      filtered: filteredImages.length,
      removed: images.length - filteredImages.length
    });

    return filteredImages;
  }

  /**
   * Check if image is in comment section
   * @private
   * @param {HTMLImageElement} img - Image element to check
   * @returns {boolean} True if image is in comment section
   */
  _isImageInComment(img) {
    // Check for comment-related containers
    if (img.closest('[data-testid*="comment"]') ||
        img.closest('[data-testid*="reply"]') ||
        img.closest('[role="article"]')?.querySelector('[data-testid*="reply"]')) {
      return true;
    }

    // Check for comment-related class names
    if (img.closest('div[class*="comment"]') ||
        img.closest('div[class*="reply"]')) {
      return true;
    }

    // Check if near username links (comments usually follow usernames)
    if (this._isNearUsernameLink(img)) {
      return true;
    }

    // Check if after main post area (by DOM order)
    if (this._isAfterMainPost(img)) {
      return true;
    }

    return false;
  }

  /**
   * Check if image is near a username link (indicating comment)
   * @private
   * @param {HTMLImageElement} img - Image element
   * @returns {boolean} True if near username link
   */
  _isNearUsernameLink(img) {
    const userLink = img.closest('div')?.querySelector('a[href*="/@"]');
    if (!userLink) {
      return false;
    }

    // Check if this user link is in the main post author section
    const mainAuthorSection = document.querySelector('[role="main"], main, .main-content')?.querySelector('a[href*="/@"]');
    if (!mainAuthorSection) {
      return false;
    }

    // If the user link in the image area is not the main author and is far away, it might be a comment
    const isMainAuthor = userLink.href === mainAuthorSection.href;
    const linkIndex = Array.from(document.querySelectorAll('a')).indexOf(userLink);
    const mainLinkIndex = Array.from(document.querySelectorAll('a')).indexOf(mainAuthorSection);

    return !isMainAuthor && (linkIndex > mainLinkIndex + 10);
  }

  /**
   * Check if image is after main post area
   * @private
   * @param {HTMLImageElement} img - Image element
   * @returns {boolean} True if after main post
   */
  _isAfterMainPost(img) {
    // Find main post interaction buttons (Like, Reply, Repost, Share)
    const mainInteractionButtons = document.querySelectorAll('button[aria-label*="Like"], button:has(img[alt="Like"])');
    if (mainInteractionButtons.length === 0) {
      return false;
    }

    const firstInteractionButton = mainInteractionButtons[0];
    const buttonIndex = Array.from(document.querySelectorAll('*')).indexOf(firstInteractionButton);
    const imgIndex = Array.from(document.querySelectorAll('*')).indexOf(img.closest('div'));

    // If image is many positions after the first interaction button, it might be in comments
    return imgIndex > buttonIndex + 100;
  }

  /**
   * Determine if image should be kept based on alt text content
   * @private
   * @param {string} alt - Image alt text
   * @returns {boolean} True if image should be kept
   */
  _shouldKeepImageByContent(alt) {
    if (!alt) {
      return true; // Keep images without alt text
    }

    const altLower = alt.toLowerCase();

    // Only exclude very clear comment section image characteristics
    const isDefiniteComment =
      // News images (usually shared in comments)
      (altLower.includes('연합뉴스') || altLower.includes('news')) ||
      // Obviously multi-person news images
      (altLower.includes('4 個人') && altLower.includes('顯示的文字')) ||
      // News screenshots containing lots of text
      (altLower.includes('文字') && altLower.includes('4 個人') && altLower.includes('顯示'));

    return !isDefiniteComment;
  }

  /**
   * Remove duplicate images based on src URL
   * @private
   * @param {HTMLImageElement[]} images - Images to deduplicate
   * @returns {HTMLImageElement[]} Deduplicated images
   */
  _removeDuplicateImages(images) {
    const seen = new Set();
    const unique = [];

    for (const img of images) {
      const src = img.src || img.currentSrc;
      if (src && !seen.has(src)) {
        seen.add(src);
        unique.push(img);
      }
    }

    return unique;
  }

  /**
   * Enhanced image exclusion logic for Threads
   * @protected
   * @param {HTMLImageElement} imgElement - Image element
   * @param {string} src - Image source URL
   * @returns {boolean} True if image should be excluded
   */
  _shouldExcludeImage(imgElement, src) {
    // Call parent exclusion logic first
    if (super._shouldExcludeImage(imgElement, src)) {
      return true;
    }

    const alt = (imgElement.alt || '').toLowerCase();
    const srcLower = src.toLowerCase();

    // Threads-specific exclusions
    const threadsExclusions = [
      'thread',
      'comment',
      'reply',
      'reaction',
      'notification'
    ];

    return threadsExclusions.some(exclusion =>
      alt.includes(exclusion) || srcLower.includes(exclusion)
    );
  }
}
