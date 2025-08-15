/**
 * @fileoverview Facebook platform image extractor
 * Refactored to use the new BasePlatformExtractor architecture
 */

import { BasePlatformExtractor } from '../base/BasePlatformExtractor.js';
import { PLATFORMS } from '../../shared/constants/PlatformConstants.js';
import { getPlatformConfig } from '../../shared/constants/PlatformConstants.js';

/**
 * Facebook platform image extractor
 * Supports both photo album navigation and static extraction methods
 */
export class FacebookExtractor extends BasePlatformExtractor {
  /**
   * @param {Object} dependencies - Injected dependencies
   * @param {Object} [customConfig={}] - Custom configuration
   */
  constructor(dependencies, customConfig = {}) {
    const defaultConfig = getPlatformConfig(PLATFORMS.FACEBOOK);
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
      }
    };

    super(dependencies, mergedConfig);
  }

  /**
   * Platform name identifier
   * @type {string}
   */
  get platformName() {
    return PLATFORMS.FACEBOOK;
  }

  /**
   * Supported URL patterns for Facebook
   * @type {string[]}
   */
  get supportedUrlPatterns() {
    return this.config.supportedUrlPatterns || ['facebook.com'];
  }

  /**
   * Extract images from the current Facebook page
   * @returns {Promise<import('../../core/interfaces/IPlatformExtractor.js').ImageData[]>} Array of extracted image data
   */
  async extractImages() {
    this._startExtraction();

    try {
      this.logger?.info('Starting Facebook image extraction', {
        url: window.location.href,
        config: {
          maxImages: this.config.extraction.maxImages,
          albumNavigation: true
        }
      });

      // Check if this is a photo page
      if (!this._isPhotoPage()) {
        this.logger?.info('Not a Facebook photo page, no images to extract');
        return this._completeExtraction([]);
      }

      // Wait for page to load
      await this._wait(this.config.extraction.pageLoadWait);

      // Determine extraction method based on album detection
      const extractedImages = await this._determineAndExecuteExtractionMethod();

      // Filter and validate images
      const validImages = this.filterValidImages(extractedImages);

      // Convert to standardized image data
      const imageData = validImages.map((img, index) =>
        this.createImageData(img, index, {
          extractionMethod: img._extractionMethod || 'unknown',
          albumPosition: img._albumPosition || null,
          isAlbumImage: img._isAlbumImage || false,
          facebookImageId: this._extractFacebookImageId(img.src)
        })
      );

      return this._completeExtraction(imageData);

    } catch (error) {
      await this.errorHandler?.handleError(error, {
        context: 'facebook_extraction',
        platform: this.platformName,
        url: window.location.href
      });
      throw error;
    }
  }

  /**
   * Validate that the current page is ready for Facebook extraction
   * @returns {Promise<boolean>} True if page is valid for extraction
   */
  async _validatePlatformSpecific() {
    try {
      // Check if we're on a Facebook page
      if (!window.location.hostname.includes('facebook.com')) {
        return false;
      }

      // Check if this is a photo page
      if (!this._isPhotoPage()) {
        this.logger?.info('Not a Facebook photo page');
        return true; // Still valid, just no images to extract
      }

      // Wait for main content to load
      const mainContent = await this.waitForElement('main, [role="main"]', 5000);
      if (!mainContent) {
        this.logger?.warn('Main content not found on Facebook page');
        return false;
      }

      return true;

    } catch (error) {
      this.logger?.error('Facebook page validation failed', { error: error.message });
      return false;
    }
  }

  /**
   * Check if current page is a Facebook photo page
   * @private
   * @returns {boolean} True if this is a photo page
   */
  _isPhotoPage() {
    return window.location.pathname.includes('/photo') ||
           window.location.search.includes('fbid=');
  }

  /**
   * Determine extraction method and execute
   * @private
   * @returns {Promise<HTMLImageElement[]>} Array of image elements
   */
  async _determineAndExecuteExtractionMethod() {
    // Check if this is a multi-image album
    const isMultiImageAlbum = document.body.textContent.includes('この写真は投稿で使用されています。');
    this.logger?.info('Multi-image album detected', { isAlbum: isMultiImageAlbum });

    let extractedImages = [];

    if (isMultiImageAlbum) {
      // Check for navigation buttons
      const navigationButton = this._findNavigationButton();
      this.logger?.debug('Navigation button found', { hasButton: !!navigationButton });

      if (navigationButton) {
        this.logger?.info('Multi-image album with navigation confirmed, using carousel method');
        try {
          extractedImages = await this._navigatePhotoAlbum();
          this.logger?.info('Album navigation completed', { count: extractedImages.length });
        } catch (error) {
          this.logger?.error('Album navigation failed, falling back to static detection', {
            error: error.message
          });
          extractedImages = [];
        }
      } else {
        this.logger?.info('Multi-image album detected but no navigation button found');
      }
    } else {
      this.logger?.info('Single image post detected, using static detection only');
    }

    // If navigation method failed or no navigation available, use static detection
    if (extractedImages.length === 0) {
      extractedImages = await this._useStaticDetection();
    }

    return extractedImages;
  }

  /**
   * Navigate through Facebook photo album to load all images
   * @private
   * @returns {Promise<HTMLImageElement[]>} Array of all loaded images
   */
  async _navigatePhotoAlbum() {
    this.logger?.info('Starting Facebook photo album navigation');

    const collectedImages = [];
    let navigationCount = 0;
    const maxNavigations = this.config.extraction.maxNavigations;

    // Enhanced image detection function
    const takeImageSnapshot = () => {
      this.logger?.debug('Taking Facebook image snapshot');

      // Try multiple selectors to find the main image
      const possibleSelectors = [
        'main img',
        'img[alt*="人"]',
        'img[alt*="画像のようです"]',
        'div[role="main"] img',
        '[data-pagelet="MediaViewer"] img',
        '[data-testid*="photo"] img',
        'img[src*="fbcdn.net"]'
      ];

      let foundImage = null;

      for (const selector of possibleSelectors) {
        const images = document.querySelectorAll(selector);
        this.logger?.debug('Trying selector', { selector, count: images.length });

        for (const img of images) {
          const rect = img.getBoundingClientRect();

          if (rect.width > this.config.extraction.minImageWidth &&
              rect.height > this.config.extraction.minImageHeight &&
              !this._shouldExcludeImage(img, img.src) &&
              rect.width > this.config.extraction.minPhotoWidth) {

            foundImage = img;
            this.logger?.debug('Found potential main image', {
              src: img.src.substring(0, 80),
              size: `${rect.width}x${rect.height}`
            });
            break;
          }
        }

        if (foundImage) break;
      }

      if (!foundImage) {
        this.logger?.debug('No suitable main image found');
        return false;
      }

      const rect = foundImage.getBoundingClientRect();

      // Create comprehensive image data object
      const imageData = {
        src: foundImage.src,
        alt: foundImage.alt || 'Facebook image',
        width: rect.width,
        height: rect.height,
        currentSrc: foundImage.currentSrc || foundImage.src,
        naturalWidth: foundImage.naturalWidth,
        naturalHeight: foundImage.naturalHeight,
        element: foundImage,
        timestamp: Date.now(),
        albumPosition: navigationCount + 1
      };

      // More precise duplicate detection using Facebook image ID
      const isDuplicate = collectedImages.some(existing => {
        const existingId = this._extractFacebookImageId(existing.src);
        const newId = this._extractFacebookImageId(imageData.src);

        // Compare multiple attributes
        const srcMatch = existing.src === imageData.src;
        const currentSrcMatch = existing.currentSrc === imageData.currentSrc;
        const idMatch = existingId && newId && existingId === newId;

        this.logger?.debug('Comparing with existing image', {
          srcMatch,
          currentSrcMatch,
          idMatch,
          existingId,
          newId
        });

        // Consider duplicate if exact URL match or same Facebook image ID
        return srcMatch || currentSrcMatch || idMatch;
      });

      if (!isDuplicate) {
        foundImage._extractionMethod = 'album_navigation';
        foundImage._isAlbumImage = true;
        foundImage._albumPosition = navigationCount + 1;

        collectedImages.push(imageData);

        this.logger?.info('Collected Facebook image', {
          position: navigationCount + 1,
          alt: imageData.alt.substring(0, 30),
          src: imageData.src.substring(0, 60),
          size: `${imageData.naturalWidth}x${imageData.naturalHeight}`
        });
        return true;
      } else {
        this.logger?.info('Image already exists in collection, album navigation complete');
        return false;
      }
    };

    // Collect the first image
    this.logger?.info('Collecting initial Facebook image');
    await this._wait(this.config.extraction.initialWait);
    takeImageSnapshot();

    // Navigate through the album until we find a duplicate (full circle)
    while (navigationCount < maxNavigations) {
      const nextButton = this._findNavigationButton();

      if (!nextButton) {
        this.logger?.info('No navigation button found, stopping');
        break;
      }

      this.logger?.debug('Navigation attempt', {
        count: navigationCount + 1,
        maxNavigations
      });

      // Try different click strategies
      try {
        // Strategy 1: Direct click
        nextButton.click();
      } catch (error) {
        this.logger?.debug('Direct click failed, trying parent button');
        // Strategy 2: Click parent button
        const parentButton = nextButton.closest('button');
        if (parentButton) {
          parentButton.click();
        }
      }

      // Wait for Facebook's lazy loading
      await this._wait(this.config.extraction.navigationWaitTime);

      // Try to collect new image
      const foundNewImage = takeImageSnapshot();

      if (foundNewImage) {
        this.logger?.debug('Successfully navigated to new image', {
          position: collectedImages.length
        });
      } else {
        this.logger?.info('Found duplicate image, album navigation complete');
        break; // Stop when we find a duplicate (completed full circle)
      }

      navigationCount++;
    }

    this.logger?.info('Facebook album navigation completed', {
      totalImages: collectedImages.length,
      navigationAttempts: navigationCount
    });

    return collectedImages.map(img => img.element);
  }

  /**
   * Use static detection methods as fallback
   * @private
   * @returns {Promise<HTMLImageElement[]>} Array of image elements
   */
  async _useStaticDetection() {
    this.logger?.info('Using Facebook static detection methods');

    const strategies = [
      () => this._extractMainImage(),
      () => this._extractFromPostImages(),
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
   * Extract the main image in the photo viewer
   * @private
   * @returns {HTMLImageElement[]} Array of image elements
   */
  _extractMainImage() {
    const mainImage = document.querySelector(this.config.selectors.mainImage);
    if (!mainImage) {
      return [];
    }

    const rect = mainImage.getBoundingClientRect();
    if (rect.width > this.config.extraction.minImageWidth &&
        rect.height > this.config.extraction.minImageHeight &&
        !this._shouldExcludeImage(mainImage, mainImage.src)) {

      mainImage._extractionMethod = 'main_image';
      this.logger?.debug('Found main Facebook photo');
      return [mainImage];
    }

    return [];
  }

  /**
   * Extract from various post image selectors
   * @private
   * @returns {HTMLImageElement[]} Array of image elements
   */
  _extractFromPostImages() {
    for (const selector of this.config.selectors.postImages) {
      const images = document.querySelectorAll(selector);
      this.logger?.debug('Trying post image selector', { selector, count: images.length });

      const validImages = Array.from(images).filter(img => {
        const rect = img.getBoundingClientRect();
        return rect.width > this.config.extraction.minImageWidth &&
               rect.height > this.config.extraction.minImageHeight &&
               !this._shouldExcludeImage(img, img.src);
      });

      if (validImages.length > 0) {
        validImages.forEach(img => {
          img._extractionMethod = 'post_images';
        });

        this.logger?.debug('Found valid images with selector', {
          selector,
          count: validImages.length
        });
        return validImages;
      }
    }

    return [];
  }

  /**
   * Fallback extraction method
   * @private
   * @returns {HTMLImageElement[]} Array of image elements
   */
  _extractFallbackMethod() {
    const allImages = document.querySelectorAll('img');
    const validImages = Array.from(allImages).filter(img => {
      const rect = img.getBoundingClientRect();
      const isFacebookImage = img.src.includes('fbcdn.net') ||
                            img.src.includes('facebook.com');

      return rect.width > this.config.extraction.minImageWidth &&
             rect.height > this.config.extraction.minImageHeight &&
             isFacebookImage &&
             !this._shouldExcludeImage(img, img.src);
    });

    // Sort by size (largest first) and take up to 10 images
    validImages.sort((a, b) => {
      const aRect = a.getBoundingClientRect();
      const bRect = b.getBoundingClientRect();
      return (bRect.width * bRect.height) - (aRect.width * aRect.height);
    });

    const limitedImages = validImages.slice(0, 10);

    limitedImages.forEach(img => {
      img._extractionMethod = 'fallback';
    });

    this.logger?.debug('Fallback extraction completed', { count: limitedImages.length });
    return limitedImages;
  }

  /**
   * Find navigation button using various selectors
   * @private
   * @returns {HTMLElement|null} Navigation button element or null
   */
  _findNavigationButton() {
    this.logger?.debug('Looking for Facebook navigation buttons');

    // Try text-based navigation buttons first (more reliable)
    const textButtons = document.querySelectorAll('button');
    for (const button of textButtons) {
      const buttonText = button.textContent || button.innerText || '';
      if (buttonText.includes('次の写真') ||
          buttonText.includes('Next') ||
          buttonText.includes('下一張')) {
        this.logger?.debug('Found text-based navigation button', { text: buttonText });
        return button;
      }
    }

    // Try Facebook-specific navigation button selectors
    for (const selector of this.config.selectors.navigationButtons) {
      try {
        // Handle :contains() selector manually since CSS doesn't support it
        if (selector.includes(':contains(')) {
          const text = selector.match(/:contains\("([^"]+)"\)/)?.[1];
          if (text) {
            const buttons = document.querySelectorAll('button');
            for (const button of buttons) {
              if (button.textContent.includes(text) || button.innerText.includes(text)) {
                this.logger?.debug('Found navigation button with text', { text });
                return button;
              }
            }
          }
          continue;
        }

        const elements = document.querySelectorAll(selector);
        this.logger?.debug('Trying navigation selector', { selector, count: elements.length });

        for (const element of elements) {
          // Check if this looks like a Next button
          const style = element.getAttribute('style') || '';
          const classes = element.className || '';

          // Look for the specific background image that indicates navigation
          if (style.includes('background-image') &&
              (style.includes('YY7dXjkW69Q') || classes.includes('x1b0d499'))) {
            this.logger?.debug('Found Facebook navigation button by style');
            return element;
          }
        }
      } catch (error) {
        this.logger?.debug('Navigation selector failed', { selector, error: error.message });
        continue;
      }
    }

    // Try to find any navigation buttons by looking for common patterns
    this.logger?.debug('Trying alternative navigation button detection');
    const allButtons = document.querySelectorAll('button, div[role="button"], i[data-visualcompletion]');

    for (const button of allButtons) {
      const buttonText = button.textContent || button.innerText || button.getAttribute('aria-label') || '';
      const style = button.getAttribute('style') || '';

      // Check for various navigation indicators
      if (buttonText.includes('次の写真') ||
          buttonText.includes('Next') ||
          buttonText.includes('下一張') ||
          buttonText.includes('次へ') ||
          style.includes('YY7dXjkW69Q') ||
          (style.includes('background-image') && button.tagName === 'I')) {

        this.logger?.debug('Found potential navigation button by content/style', {
          tagName: button.tagName,
          text: buttonText.substring(0, 30),
          hasNavStyle: style.includes('YY7dXjkW69Q')
        });
        return button;
      }
    }

    this.logger?.debug('No navigation button found');
    return null;
  }

  /**
   * Extract Facebook image ID from URL
   * @private
   * @param {string} url - Image URL
   * @returns {string|null} Facebook image ID or null
   */
  _extractFacebookImageId(url) {
    const match = url.match(/\/(\d+)_\d+/);
    return match ? match[1] : null;
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
   * Enhanced image exclusion logic for Facebook
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

    // Facebook-specific exclusions
    const facebookExclusions = [
      'cover',
      'timeline',
      'story',
      'static',
      'emoji'
    ];

    return facebookExclusions.some(exclusion =>
      alt.includes(exclusion) || srcLower.includes(exclusion)
    );
  }
}
