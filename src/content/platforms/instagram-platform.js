/**
 * Instagram platform image extractor
 */

import { BasePlatform } from './base-platform.js';
import { PLATFORMS, SELECTORS, NAVIGATION_LIMITS, IMAGE_FILTERS } from '../../shared/constants.js';
import { wait, waitForElement } from '../../shared/utils.js';

export class InstagramPlatform extends BasePlatform {
  constructor() {
    super();
    this.platformName = PLATFORMS.INSTAGRAM;
  }

  isCurrentPlatform() {
    return window.location.hostname.includes('instagram.com');
  }

  /**
   * Wait for elements to appear on the page
   * @param {string} selector - CSS selector to wait for
   * @param {number} timeout - Maximum time to wait in milliseconds
   * @returns {Promise<Element|null>}
   */
  async waitForElement(selector, timeout = 5000) {
    return waitForElement(selector, timeout);
  }

  /**
   * Navigate through carousel to load all images
   * @returns {Promise<Array>} Promise that resolves to array of all loaded images
   */
  async navigateCarousel() {
    console.log('Starting carousel navigation to load all images...');

    // Check current image index from URL
    const urlParams = new URLSearchParams(window.location.search);
    const currentImgIndex = parseInt(urlParams.get('img_index') || '1');
    console.log(`Starting from image index: ${currentImgIndex}`);

    const allImages = new Map(); // Use Map with src as key to avoid duplicates
    let navigationCount = 0;
    const maxNavigations = NAVIGATION_LIMITS.MAX_ATTEMPTS;

    // Helper function to collect current images
    const collectCurrentImages = () => {
      // Use the same logic as the static detection to ensure consistency
      console.log('Collecting current images...');

      // Find images with descriptive alt text (same as static method)
      const descriptiveImages = document.querySelectorAll(SELECTORS.IMAGES_WITH_ALT);
      console.log(`Found ${descriptiveImages.length} descriptive images`);

      const validImages = Array.from(descriptiveImages).filter(img => {
        const rect = img.getBoundingClientRect();
        // Use same filtering logic as static detection
        const isValid = rect.width > IMAGE_FILTERS.MIN_WIDTH &&
                       rect.height > IMAGE_FILTERS.MIN_HEIGHT &&
                       !img.alt.toLowerCase().includes('profile picture') &&
                       !img.src.includes('profile_pic');

        if (isValid) {
          console.log(`Valid image found: ${img.src.substring(0, 60)}...`);
        }
        return isValid;
      });

      let newImagesAdded = 0;
      validImages.forEach(img => {
        // Use src as unique identifier
        if (img.src && !allImages.has(img.src)) {
          allImages.set(img.src, {
            element: img,
            src: img.src,
            alt: img.alt,
            srcset: img.srcset
          });
          newImagesAdded++;
          console.log(`Added new image: ${img.alt.substring(0, 30)}...`);
        }
      });

      console.log(`Collected ${validImages.length} valid images, new: ${newImagesAdded}, total unique: ${allImages.size}`);
      return newImagesAdded;
    };

    // Collect initial images
    await wait(NAVIGATION_LIMITS.INITIAL_WAIT);
    collectCurrentImages();

    // If we're not at the first image, try to navigate to the beginning first
    if (currentImgIndex > 1) {
      await this._navigateToBeginning(currentImgIndex, collectCurrentImages);
    }

    // Try to find Next button and navigate
    let consecutiveNoNewImages = 0;

    while (navigationCount < maxNavigations) {
      const nextButton = this._findNextButton();

      if (!nextButton || nextButton.disabled) {
        console.log('No more Next button or button is disabled, stopping navigation');
        break;
      }

      console.log(`Navigation ${navigationCount + 1}: Clicking Next button`);
      nextButton.click();

      // Wait for new content to load
      await wait(NAVIGATION_LIMITS.WAIT_TIME);

      const newImageCount = collectCurrentImages();
      navigationCount++;

      // Track consecutive attempts with no new images
      if (newImageCount === 0) {
        consecutiveNoNewImages++;
        console.log(`No new images in attempt ${navigationCount}, consecutive failures: ${consecutiveNoNewImages}`);

        // Only stop after 3 consecutive failures AND we have some images already
        if (consecutiveNoNewImages >= 3 && allImages.size > 0) {
          console.log('Multiple consecutive attempts with no new images, stopping navigation');
          break;
        }
      } else {
        consecutiveNoNewImages = 0; // Reset counter when we find new images
      }

      // Check if we've reached the end
      const updatedNextButton = this._findNextButton();

      if (!updatedNextButton || updatedNextButton.disabled) {
        console.log('Next button is now disabled or missing, stopping navigation');
        break;
      }
    }

    console.log(`Navigation completed. Total unique images found: ${allImages.size}`);
    return Array.from(allImages.values()).map(item => item.element);
  }

  async extractImages() {
    console.log('=== Starting Instagram image extraction ===');

    // Wait a bit for the page to fully load
    await wait(2000);

    // Try to scroll to ensure the main content is visible
    const article = document.querySelector(SELECTORS.ARTICLE);
    if (article) {
      article.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await wait(1000);
    }

    // Check if this is a carousel post by looking for Next button
    console.log('Checking for carousel Next button...');

    // Debug: Check what buttons are available
    const allButtons = document.querySelectorAll('button');
    console.log(`Total buttons found: ${allButtons.length}`);

    const nextButton = this._findNextButton();
    this._logNextButtonDetails(nextButton);

    let mainPostImages = [];

    if (nextButton && !nextButton.disabled) {
      console.log('Carousel detected, using navigation method to load all images...');
      try {
        mainPostImages = await this.navigateCarousel();
        console.log(`Carousel navigation completed, found ${mainPostImages.length} images`);
      } catch (error) {
        console.error('Carousel navigation failed, falling back to static detection:', error);
        mainPostImages = [];
      }
    } else {
      console.log('No active Next button found, using static detection only');
    }

    // If carousel method failed or no carousel detected, use static detection
    if (mainPostImages.length === 0) {
      mainPostImages = this._useStaticDetection();
    }

    console.log(`Final selected Instagram post image count: ${mainPostImages.length}`);

    const imageData = [];
    mainPostImages.forEach((img, index) => {
      imageData.push(this.createImageData(img, index));
    });

    console.log('Extracted Instagram image information:', imageData);
    return imageData;
  }

  /**
   * Find Next button using various selectors
   * @returns {HTMLButtonElement|null} Next button element or null
   */
  _findNextButton() {
    // Try primary selectors first
    for (const selector of SELECTORS.INSTAGRAM.NEXT_BUTTONS) {
      const button = document.querySelector(selector);
      if (button) {
        console.log(`Found Next button with selector: ${selector}`);
        return button;
      }
    }

    // Try alternative selectors
    const possibleNextButtons = [
      'button[tabindex="-1"]',
      'button:has(div)',
      'svg[aria-label="Next"] ~ button',
      'button[class*="al4"]',
      'article button:not([aria-label*="Like"]):not([aria-label*="Comment"]):not([aria-label*="Share"])'
    ];

    for (const selector of possibleNextButtons) {
      const buttons = document.querySelectorAll(selector);
      console.log(`Trying selector "${selector}": found ${buttons.length} buttons`);

      for (const btn of buttons) {
        // Check if this looks like a Next button
        const hasNextIcon = btn.innerHTML.includes('_9zm2') ||
                           btn.querySelector('svg') ||
                           btn.textContent.includes('Next') ||
                           btn.ariaLabel?.includes('Next');

        if (hasNextIcon && !btn.disabled) {
          console.log('Found potential Next button:', btn);
          return btn;
        }
      }
    }

    return null;
  }

  /**
   * Log Next button details for debugging
   * @param {HTMLButtonElement|null} nextButton - Next button element
   */
  _logNextButtonDetails(nextButton) {
    console.log('Next button found:', !!nextButton);
    if (nextButton) {
      console.log('Next button details:', {
        tagName: nextButton.tagName,
        className: nextButton.className,
        ariaLabel: nextButton.ariaLabel,
        disabled: nextButton.disabled
      });
    }
  }

  /**
   * Navigate to the beginning of the carousel
   * @param {number} currentImgIndex - Current image index
   * @param {Function} collectCurrentImages - Function to collect images
   */
  async _navigateToBeginning(currentImgIndex, collectCurrentImages) {
    console.log('Not at first image, trying to navigate to beginning...');
    const prevButton = document.querySelector(SELECTORS.INSTAGRAM.PREV_BUTTONS[0]) ||
                      document.querySelector(SELECTORS.INSTAGRAM.PREV_BUTTONS[1]);

    if (prevButton) {
      // Click Previous button multiple times to get to the start
      for (let i = 0; i < currentImgIndex - 1; i++) {
        console.log(`Navigating to previous image (${i + 1}/${currentImgIndex - 1})`);
        prevButton.click();
        await wait(1500);
        collectCurrentImages(); // Collect images at each position
      }
    }
  }

  /**
   * Use static detection methods as fallback
   * @returns {Array} Array of image elements
   */
  _useStaticDetection() {
    console.log('Using static detection methods...');

    // Strategy 1: Find images in articles (main post content)
    const articleImages = document.querySelectorAll('article img');
    console.log('Strategy 1 - Images in articles:', articleImages.length);

    // Strategy 2: Find images with descriptive alt text (similar to Threads)
    const descriptiveImages = document.querySelectorAll(SELECTORS.IMAGES_WITH_ALT);
    console.log('Strategy 2 - Images with descriptive alt text:', descriptiveImages.length);

    // Strategy 3: Find images in carousel/slideshow containers
    const carouselImages = document.querySelectorAll('[role="tablist"] img, [role="button"] img');
    console.log('Strategy 3 - Images in carousels:', carouselImages.length);

    let mainPostImages = [];

    // Method 1: Find images in the main article container
    const mainArticle = document.querySelector(SELECTORS.ARTICLE);
    if (mainArticle) {
      const postImages = mainArticle.querySelectorAll(SELECTORS.IMAGES_WITH_ALT);
      const filteredImages = Array.from(postImages).filter(img => {
        const rect = img.getBoundingClientRect();
        return rect.width > 100 && rect.height > 100;
      });

      if (filteredImages.length > 0) {
        console.log(`Found ${filteredImages.length} images in main article`);
        mainPostImages = filteredImages;
      }
    }

    // Method 2: If no images found in article, try to find carousel images
    if (mainPostImages.length === 0) {
      console.log('No images found in article, trying carousel detection...');

      const carouselContainer = document.querySelector('[role="tablist"]') ||
                               document.querySelector('div[style*="transform"]') ||
                               document.querySelector('div[class*="carousel"]');

      if (carouselContainer) {
        const carouselImgs = carouselContainer.querySelectorAll('img');
        const contentImages = Array.from(carouselImgs).filter(img => {
          const rect = img.getBoundingClientRect();
          return rect.width > 200 && rect.height > 200 &&
                 (img.alt.includes('可能是') || img.alt.includes('Photo by'));
        });

        if (contentImages.length > 0) {
          console.log(`Found ${contentImages.length} images in carousel`);
          mainPostImages = contentImages;
        }
      }
    }

    // Method 3: Fallback - look for any reasonably sized images with descriptive alt text
    if (mainPostImages.length === 0) {
      console.log('Using fallback method - looking for any large descriptive images...');

      const allDescriptiveImages = Array.from(descriptiveImages).filter(img => {
        const rect = img.getBoundingClientRect();
        return rect.width > IMAGE_FILTERS.MIN_WIDTH &&
               rect.height > IMAGE_FILTERS.MIN_HEIGHT &&
               !img.alt.toLowerCase().includes('profile picture') &&
               !img.src.includes('profile_pic');
      });

      // Sort by size (largest first) and take up to 10 images
      allDescriptiveImages.sort((a, b) => {
        const aRect = a.getBoundingClientRect();
        const bRect = b.getBoundingClientRect();
        return (bRect.width * bRect.height) - (aRect.width * aRect.height);
      });

      mainPostImages = allDescriptiveImages.slice(0, 10);
      console.log(`Found ${mainPostImages.length} images using fallback method`);
    }

    return mainPostImages;
  }
}
