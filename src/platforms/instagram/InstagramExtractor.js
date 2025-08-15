/**
 * @fileoverview Instagram platform image extractor
 * Refactored to use the new BasePlatformExtractor architecture
 */

import { BasePlatformExtractor } from '../base/BasePlatformExtractor.js';
import { PLATFORMS } from '../../shared/constants/PlatformConstants.js';
import { getPlatformConfig } from '../../shared/constants/PlatformConstants.js';

/**
 * Instagram platform image extractor
 * Supports both carousel navigation and static extraction methods
 */
export class InstagramExtractor extends BasePlatformExtractor {
  /**
   * @param {Object} dependencies - Injected dependencies
   * @param {Object} [customConfig={}] - Custom configuration
   */
  constructor(dependencies, customConfig = {}) {
    const defaultConfig = getPlatformConfig(PLATFORMS.INSTAGRAM);
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
      carousel: {
        ...defaultConfig.carousel,
        ...customConfig.carousel
      }
    };

    super(dependencies, mergedConfig);
  }

  /**
   * Platform name identifier
   * @type {string}
   */
  get platformName() {
    return PLATFORMS.INSTAGRAM;
  }

  /**
   * Supported URL patterns for Instagram
   * @type {string[]}
   */
  get supportedUrlPatterns() {
    return this.config.supportedUrlPatterns || ['instagram.com'];
  }

  /**
   * Extract images from the current Instagram page
   * @returns {Promise<import('../../core/interfaces/IPlatformExtractor.js').ImageData[]>} Array of extracted image data
   */
  async extractImages() {
    this._startExtraction();

    try {
      this.logger?.info('Starting Instagram image extraction', {
        url: window.location.href,
        config: {
          maxImages: this.config.extraction.maxImages,
          carouselNavigation: true
        }
      });

      // Wait for page to load and scroll to main content
      await this._preparePageForExtraction();

      // Determine extraction method based on carousel detection
      const extractedImages = await this._determineAndExecuteExtractionMethod();

      // Filter and validate images
      const validImages = this.filterValidImages(extractedImages);

      // Convert to standardized image data
      const imageData = validImages.map((img, index) =>
        this.createImageData(img, index, {
          extractionMethod: img._extractionMethod || 'unknown',
          carouselPosition: img._carouselPosition || null,
          isCarouselImage: img._isCarouselImage || false
        })
      );

      return this._completeExtraction(imageData);

    } catch (error) {
      await this.errorHandler?.handleError(error, {
        context: 'instagram_extraction',
        platform: this.platformName,
        url: window.location.href
      });
      throw error;
    }
  }

  /**
   * Validate that the current page is ready for Instagram extraction
   * @returns {Promise<boolean>} True if page is valid for extraction
   */
  async _validatePlatformSpecific() {
    try {
      // Check if we're on an Instagram page
      if (!window.location.hostname.includes('instagram.com')) {
        return false;
      }

      // Wait for main article content to load
      const article = await this.waitForElement(this.config.selectors.article, 5000);
      if (!article) {
        this.logger?.warn('Main article not found on Instagram page');
        return false;
      }

      return true;

    } catch (error) {
      this.logger?.error('Instagram page validation failed', { error: error.message });
      return false;
    }
  }

  /**
   * Prepare page for extraction by waiting and scrolling
   * @private
   * @returns {Promise<void>}
   */
  async _preparePageForExtraction() {
    // Wait for initial page load
    await this._wait(this.config.extraction.pageLoadWait);

    // Try to scroll to ensure the main content is visible
    const article = document.querySelector(this.config.selectors.article);
    if (article) {
      article.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await this._wait(this.config.extraction.scrollWait);
    }
  }

  /**
   * Determine extraction method and execute
   * @private
   * @returns {Promise<HTMLImageElement[]>} Array of image elements
   */
  async _determineAndExecuteExtractionMethod() {
    // Check for carousel by looking for Next button
    const nextButton = this._findNextButton();
    this._logNextButtonDetails(nextButton);

    let extractedImages = [];

    if (nextButton && !nextButton.disabled) {
      this.logger?.info('Carousel detected, using navigation method');
      try {
        extractedImages = await this._navigateCarousel();
        this.logger?.info('Carousel navigation completed', { count: extractedImages.length });
      } catch (error) {
        this.logger?.error('Carousel navigation failed, falling back to static detection', {
          error: error.message
        });
        extractedImages = [];
      }
    } else {
      this.logger?.info('No active carousel detected, using static detection');
    }

    // If carousel method failed or no carousel detected, use static detection
    if (extractedImages.length === 0) {
      extractedImages = await this._useStaticDetection();
    }

    return extractedImages;
  }

  /**
   * Navigate through carousel to load all images
   * @private
   * @returns {Promise<HTMLImageElement[]>} Array of all loaded images
   */
  async _navigateCarousel() {
    this.logger?.info('Starting carousel navigation to load all images');

    const allImages = new Map(); // Use Map with src as key to avoid duplicates
    let navigationCount = 0;
    const maxNavigations = this.config.extraction.maxNavigationAttempts;

    // Helper function to collect current images
    const collectCurrentImages = () => {
      this.logger?.debug('Collecting current carousel images');

      // Find images with descriptive alt text (same as static method)
      const descriptiveImages = document.querySelectorAll('img[alt*="可能是"], img[alt*="Photo by"]');
      this.logger?.debug('Found descriptive images', { count: descriptiveImages.length });

      const validImages = Array.from(descriptiveImages).filter(img => {
        const rect = img.getBoundingClientRect();
        const isValid = rect.width > this.config.extraction.minImageWidth &&
                       rect.height > this.config.extraction.minImageHeight &&
                       !this._shouldExcludeImage(img, img.src);

        return isValid;
      });

      let newImagesAdded = 0;
      validImages.forEach((img, index) => {
        // Use src as unique identifier
        if (img.src && !allImages.has(img.src)) {
          img._extractionMethod = 'carousel_navigation';
          img._isCarouselImage = true;
          img._carouselPosition = navigationCount + 1;

          allImages.set(img.src, img);
          newImagesAdded++;

          this.logger?.debug('Added new carousel image', {
            position: navigationCount + 1,
            alt: img.alt?.substring(0, 30),
            src: img.src.substring(0, 60)
          });
        }
      });

      this.logger?.debug('Collected carousel images', {
        valid: validImages.length,
        new: newImagesAdded,
        totalUnique: allImages.size
      });

      return newImagesAdded;
    };

    // Collect initial images
    await this._wait(this.config.extraction.initialWait);
    collectCurrentImages();

    // Handle case where we're not at the first image
    const currentImgIndex = this._getCurrentImageIndex();
    if (currentImgIndex > 1) {
      await this._navigateToBeginning(currentImgIndex, collectCurrentImages);
    }

    // Navigate through carousel
    let consecutiveNoNewImages = 0;

    while (navigationCount < maxNavigations) {
      const nextButton = this._findNextButton();

      if (!nextButton || nextButton.disabled) {
        this.logger?.info('No more Next button or button is disabled, stopping navigation');
        break;
      }

      this.logger?.debug('Navigation attempt', {
        count: navigationCount + 1,
        maxNavigations
      });

      nextButton.click();

      // Wait for new content to load
      await this._wait(this.config.extraction.navigationWaitTime);

      const newImageCount = collectCurrentImages();
      navigationCount++;

      // Track consecutive attempts with no new images
      if (newImageCount === 0) {
        consecutiveNoNewImages++;
        this.logger?.debug('No new images found', {
          attempt: navigationCount,
          consecutiveFailures: consecutiveNoNewImages
        });

        // Stop after 3 consecutive failures AND we have some images already
        if (consecutiveNoNewImages >= 3 && allImages.size > 0) {
          this.logger?.info('Multiple consecutive attempts with no new images, stopping navigation');
          break;
        }
      } else {
        consecutiveNoNewImages = 0; // Reset counter when we find new images
      }

      // Check if we've reached the end
      const updatedNextButton = this._findNextButton();
      if (!updatedNextButton || updatedNextButton.disabled) {
        this.logger?.info('Next button is now disabled or missing, stopping navigation');
        break;
      }
    }

    this.logger?.info('Carousel navigation completed', {
      totalUniqueImages: allImages.size,
      navigationAttempts: navigationCount
    });

    return Array.from(allImages.values());
  }

  /**
   * Use static detection methods as fallback
   * @private
   * @returns {Promise<HTMLImageElement[]>} Array of image elements
   */
  async _useStaticDetection() {
    this.logger?.info('Using static detection methods');

    const strategies = [
      () => this._extractFromMainArticle(),
      () => this._extractFromCarouselContainer(),
      () => this._extractFallbackMethod()
    ];

    let extractedImages = [];

    for (const strategy of strategies) {
      try {
        const images = await strategy();
        if (images.length > 0) {
          extractedImages = images;
          this.logger?.info('Static detection strategy succeeded', {
            strategy: strategy.name,
            count: images.length
          });
          break;
        }
      } catch (error) {
        this.logger?.warn('Static detection strategy failed', {
          strategy: strategy.name,
          error: error.message
        });
      }
    }

    return extractedImages;
  }

  /**
   * Extract images from main article container
   * @private
   * @returns {HTMLImageElement[]} Array of image elements
   */
  _extractFromMainArticle() {
    const mainArticle = document.querySelector(this.config.selectors.article);
    if (!mainArticle) {
      return [];
    }

    const postImages = mainArticle.querySelectorAll('img[alt*="可能是"], img[alt*="Photo by"]');
    const filteredImages = Array.from(postImages).filter(img => {
      const rect = img.getBoundingClientRect();
      return rect.width > this.config.carousel.articleImageMinSize &&
             rect.height > this.config.carousel.articleImageMinSize &&
             !this._shouldExcludeImage(img, img.src);
    });

    filteredImages.forEach(img => {
      img._extractionMethod = 'main_article';
    });

    this.logger?.debug('Extracted from main article', { count: filteredImages.length });
    return filteredImages;
  }

  /**
   * Extract images from carousel container
   * @private
   * @returns {HTMLImageElement[]} Array of image elements
   */
  _extractFromCarouselContainer() {
    const carouselContainer = document.querySelector('[role="tablist"]') ||
                             document.querySelector('div[style*="transform"]') ||
                             document.querySelector('div[class*="carousel"]');

    if (!carouselContainer) {
      return [];
    }

    const carouselImgs = carouselContainer.querySelectorAll('img');
    const contentImages = Array.from(carouselImgs).filter(img => {
      const rect = img.getBoundingClientRect();
      return rect.width > this.config.carousel.carouselImageMinSize &&
             rect.height > this.config.carousel.carouselImageMinSize &&
             (img.alt.includes('可能是') || img.alt.includes('Photo by')) &&
             !this._shouldExcludeImage(img, img.src);
    });

    contentImages.forEach(img => {
      img._extractionMethod = 'carousel_container';
      img._isCarouselImage = true;
    });

    this.logger?.debug('Extracted from carousel container', { count: contentImages.length });
    return contentImages;
  }

  /**
   * Fallback extraction method
   * @private
   * @returns {HTMLImageElement[]} Array of image elements
   */
  _extractFallbackMethod() {
    const allDescriptiveImages = document.querySelectorAll('img[alt*="可能是"], img[alt*="Photo by"]');

    const validImages = Array.from(allDescriptiveImages).filter(img => {
      const rect = img.getBoundingClientRect();
      return rect.width > this.config.extraction.minImageWidth &&
             rect.height > this.config.extraction.minImageHeight &&
             !img.alt.toLowerCase().includes('profile picture') &&
             !img.src.includes('profile_pic') &&
             !this._shouldExcludeImage(img, img.src);
    });

    // Sort by size (largest first) and take up to maxFallbackImages
    validImages.sort((a, b) => {
      const aRect = a.getBoundingClientRect();
      const bRect = b.getBoundingClientRect();
      return (bRect.width * bRect.height) - (aRect.width * aRect.height);
    });

    const limitedImages = validImages.slice(0, this.config.carousel.maxFallbackImages);

    limitedImages.forEach(img => {
      img._extractionMethod = 'fallback';
    });

    this.logger?.debug('Fallback extraction completed', { count: limitedImages.length });
    return limitedImages;
  }

  /**
   * Find Next button using various selectors
   * @private
   * @returns {HTMLButtonElement|null} Next button element or null
   */
  _findNextButton() {
    // Try primary selectors first
    for (const selector of this.config.selectors.nextButtons) {
      const button = document.querySelector(selector);
      if (button) {
        this.logger?.debug('Found Next button', { selector });
        return button;
      }
    }

    // Try alternative selectors
    const alternativeSelectors = [
      'button[tabindex="-1"]',
      'button:has(div)',
      'svg[aria-label="Next"] ~ button',
      'button[class*="al4"]',
      'article button:not([aria-label*="Like"]):not([aria-label*="Comment"]):not([aria-label*="Share"])'
    ];

    for (const selector of alternativeSelectors) {
      const buttons = document.querySelectorAll(selector);

      for (const btn of buttons) {
        // Check if this looks like a Next button
        const hasNextIcon = btn.innerHTML.includes('_9zm2') ||
                           btn.querySelector('svg') ||
                           btn.textContent.includes('Next') ||
                           btn.ariaLabel?.includes('Next');

        if (hasNextIcon && !btn.disabled) {
          this.logger?.debug('Found potential Next button', { selector });
          return btn;
        }
      }
    }

    return null;
  }

  /**
   * Log Next button details for debugging
   * @private
   * @param {HTMLButtonElement|null} nextButton - Next button element
   */
  _logNextButtonDetails(nextButton) {
    this.logger?.debug('Next button analysis', {
      found: !!nextButton,
      disabled: nextButton?.disabled,
      ariaLabel: nextButton?.ariaLabel,
      className: nextButton?.className
    });
  }

  /**
   * Get current image index from URL
   * @private
   * @returns {number} Current image index
   */
  _getCurrentImageIndex() {
    const urlParams = new URLSearchParams(window.location.search);
    return parseInt(urlParams.get('img_index') || '1');
  }

  /**
   * Navigate to the beginning of the carousel
   * @private
   * @param {number} currentImgIndex - Current image index
   * @param {Function} collectCurrentImages - Function to collect images
   */
  async _navigateToBeginning(currentImgIndex, collectCurrentImages) {
    this.logger?.info('Navigating to carousel beginning', { currentIndex: currentImgIndex });

    const prevButton = document.querySelector(this.config.selectors.prevButtons[0]) ||
                      document.querySelector(this.config.selectors.prevButtons[1]);

    if (prevButton) {
      // Click Previous button multiple times to get to the start
      for (let i = 0; i < currentImgIndex - 1; i++) {
        this.logger?.debug('Navigating to previous image', {
          step: i + 1,
          total: currentImgIndex - 1
        });

        prevButton.click();
        await this._wait(this.config.extraction.prevNavigationWait);
        collectCurrentImages(); // Collect images at each position
      }
    }
  }

  /**
   * Wait for specified time
   * @private
   * @param {number} ms - Milliseconds to wait
   * @returns {Promise<void>}
   */
  async _wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Enhanced image exclusion logic for Instagram
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

    // Instagram-specific exclusions
    const instagramExclusions = [
      'story',
      'highlight',
      'reel',
      'igtv'
    ];

    return instagramExclusions.some(exclusion =>
      alt.includes(exclusion) || srcLower.includes(exclusion)
    );
  }
}
