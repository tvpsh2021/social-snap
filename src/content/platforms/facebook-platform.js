/**
 * Facebook platform image extractor
 */

import { BasePlatform } from './base-platform.js';
import { PLATFORMS, SELECTORS, NAVIGATION_LIMITS, IMAGE_FILTERS } from '../../shared/constants.js';
import { wait, waitForElement } from '../../shared/utils.js';

export class FacebookPlatform extends BasePlatform {
  constructor() {
    super();
    this.platformName = PLATFORMS.FACEBOOK;
  }

  isCurrentPlatform() {
    return window.location.hostname.includes('facebook.com');
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
   * Navigate through Facebook photo album to load all images
   * Facebook uses circular navigation, and may not change img src but update content
   * @returns {Promise<Array>} Promise that resolves to array of all loaded images
   */
  async navigateCarousel() {
    console.log('Starting Facebook photo navigation to load all images...');

    const collectedImages = [];
    let navigationCount = 0;
    const maxNavigations = 500; // Support very large albums (prevent infinite loops)

    // Enhanced image detection function
    const takeImageSnapshot = () => {
      console.log('Taking Facebook image snapshot...');

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
        console.log(`Trying selector "${selector}": found ${images.length} images`);

        for (const img of images) {
          const rect = img.getBoundingClientRect();
          console.log(`Image: ${img.src.substring(0, 50)}... Size: ${rect.width}x${rect.height}`);

          if (rect.width > IMAGE_FILTERS.MIN_WIDTH &&
              rect.height > IMAGE_FILTERS.MIN_HEIGHT &&
              !img.src.includes('profile') &&
              !img.src.includes('icon') &&
              !img.src.includes('static') &&
              rect.width > 200) { // Facebook photos are usually larger

            // Found a potential main image
            foundImage = img;
            console.log('Found potential main image:', img.src.substring(0, 80));
            break;
          }
        }

        if (foundImage) break;
      }

      if (!foundImage) {
        console.log('No suitable main image found');
        return false;
      }

      const rect = foundImage.getBoundingClientRect();

      // Create a comprehensive image data object
      const imageData = {
        src: foundImage.src,
        alt: foundImage.alt || 'Facebook image',
        width: rect.width,
        height: rect.height,
        currentSrc: foundImage.currentSrc || foundImage.src,
        naturalWidth: foundImage.naturalWidth,
        naturalHeight: foundImage.naturalHeight,
        element: foundImage,
        timestamp: Date.now()
      };

      // More precise duplicate detection
      const isDuplicate = collectedImages.some(existing => {
        // Extract image ID from Facebook URL for more precise comparison
        const extractImageId = (url) => {
          const match = url.match(/\/(\d+)_\d+/);
          return match ? match[1] : null;
        };

        const existingId = extractImageId(existing.src);
        const newId = extractImageId(imageData.src);

        // Compare multiple attributes
        const srcMatch = existing.src === imageData.src;
        const currentSrcMatch = existing.currentSrc === imageData.currentSrc;
        const idMatch = existingId && newId && existingId === newId;
        const exactSizeMatch = existing.naturalWidth === imageData.naturalWidth &&
                              existing.naturalHeight === imageData.naturalHeight &&
                              existing.alt === imageData.alt;

        console.log('Comparing with existing image:', {
          srcMatch,
          currentSrcMatch,
          idMatch,
          exactSizeMatch,
          existingId,
          newId,
          existingSrc: existing.src.substring(0, 50),
          newSrc: imageData.src.substring(0, 50)
        });

        // Only consider duplicate if:
        // 1. Exact URL match, OR
        // 2. Same Facebook image ID (most reliable for Facebook)
        // Remove size+alt matching as it's too restrictive for Facebook albums
        return srcMatch || currentSrcMatch || idMatch;
      });

      if (!isDuplicate) {
        collectedImages.push(imageData);
        console.log(`✓ Collected Facebook image ${collectedImages.length}:`, {
          alt: imageData.alt.substring(0, 30),
          src: imageData.src.substring(0, 60),
          size: `${imageData.naturalWidth}x${imageData.naturalHeight}`,
          rect: `${Math.round(rect.width)}x${Math.round(rect.height)}`
        });
        return true;
      } else {
        console.log('Image already exists in collection, skipping');
        return false;
      }
    };

    // Collect the first image
    console.log('Collecting initial Facebook image...');
    await wait(NAVIGATION_LIMITS.INITIAL_WAIT);
    takeImageSnapshot();

    // Navigate through the album until we find a duplicate image (full circle)
    while (navigationCount < maxNavigations) {
      const nextButton = this._findNavigationButton();

      if (!nextButton) {
        console.log('No navigation button found, stopping');
        break;
      }

      console.log(`Navigation attempt ${navigationCount + 1}: Clicking Next button`);

      // Try different click strategies
      try {
        // Strategy 1: Direct click
        nextButton.click();
      } catch (error) {
        console.log('Direct click failed, trying parent button');
        // Strategy 2: Click parent button
        const parentButton = nextButton.closest('button');
        if (parentButton) {
          parentButton.click();
        }
      }

      // Wait even longer for Facebook's lazy loading
      await wait(4000);

      // Try to collect new image
      const foundNewImage = takeImageSnapshot();

      if (foundNewImage) {
        console.log(`Successfully navigated to image ${collectedImages.length}`);
      } else {
        console.log('Found duplicate image, album navigation complete');
        break; // Immediately stop when we find a duplicate (completed full circle)
      }

      navigationCount++;
    }

    console.log(`Facebook navigation completed. Total images collected: ${collectedImages.length}`);
    return collectedImages.map(img => img.element);
  }

  async extractImages() {
    console.log('=== Starting Facebook image extraction ===');

    // Wait a bit for the page to fully load
    await wait(2000);

    // Check if this is a photo view page
    const isPhotoPage = window.location.pathname.includes('/photo') ||
                       window.location.search.includes('fbid=');

    if (!isPhotoPage) {
      console.log('Not a Facebook photo page, no images to extract');
      return [];
    }

    console.log('Facebook photo page detected');

    // Check if this is a multi-image album by looking for the specific text
    const isMultiImageAlbum = document.body.textContent.includes('この写真は投稿で使用されています。');
    console.log('Multi-image album detected:', isMultiImageAlbum);

    let mainPostImages = [];

    if (isMultiImageAlbum) {
      // Check if this is part of an album with navigation buttons
      const navigationButton = this._findNavigationButton();
      console.log('Navigation button found:', !!navigationButton);

      if (navigationButton) {
        console.log('Multi-image album confirmed, using carousel navigation to load all images...');
        try {
          mainPostImages = await this.navigateCarousel();
          console.log(`Carousel navigation completed, found ${mainPostImages.length} images`);
        } catch (error) {
          console.error('Carousel navigation failed, falling back to static detection:', error);
          mainPostImages = [];
        }
      } else {
        console.log('Multi-image album detected but no navigation button found, using static detection');
      }
    } else {
      console.log('Single image post detected, using static detection only (no navigation)');
    }

    // If navigation method failed or no navigation button found, use static detection
    if (mainPostImages.length === 0) {
      mainPostImages = this._useStaticDetection();
    }

    console.log(`Final selected Facebook post image count: ${mainPostImages.length}`);

    const imageData = [];
    mainPostImages.forEach((img, index) => {
      imageData.push(this.createImageData(img, index));
    });

    console.log('Extracted Facebook image information:', imageData);
    return imageData;
  }

  /**
   * Find navigation button using various selectors
   * Facebook uses <i> elements with background images as navigation buttons
   * @returns {HTMLElement|null} Navigation button element or null
   */
  _findNavigationButton() {
    console.log('Looking for Facebook navigation buttons...');

    // Try text-based navigation buttons first (more reliable)
    const textButtons = document.querySelectorAll('button');
    for (const button of textButtons) {
      const buttonText = button.textContent || button.innerText || '';
      if (buttonText.includes('次の写真') ||
          buttonText.includes('Next') ||
          buttonText.includes('下一張')) {
        console.log('Found text-based navigation button:', buttonText);
        return button;
      }
    }

    // Try Facebook-specific navigation button selectors
    for (const selector of SELECTORS.FACEBOOK.NAVIGATION_BUTTONS) {
      try {
        // Handle :contains() selector manually since CSS doesn't support it
        if (selector.includes(':contains(')) {
          const text = selector.match(/:contains\("([^"]+)"\)/)?.[1];
          if (text) {
            const buttons = document.querySelectorAll('button');
            for (const button of buttons) {
              if (button.textContent.includes(text) || button.innerText.includes(text)) {
                console.log(`Found navigation button with text: ${text}`);
                return button;
              }
            }
          }
          continue;
        }

        const elements = document.querySelectorAll(selector);
        console.log(`Trying selector "${selector}": found ${elements.length} elements`);

        for (const element of elements) {
          // Check if this looks like a Next button
          const style = element.getAttribute('style') || '';
          const classes = element.className || '';

          // Look for the specific background image that indicates navigation
          if (style.includes('background-image') &&
              (style.includes('YY7dXjkW69Q') || classes.includes('x1b0d499'))) {
            console.log('Found Facebook navigation button:', element);
            return element;
          }
        }
      } catch (error) {
        console.log(`Selector ${selector} failed:`, error);
        continue;
      }
    }

    // Try to find any navigation buttons by looking for common patterns
    console.log('Trying alternative navigation button detection...');
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
        console.log('Found potential navigation button by content/style:', {
          tagName: button.tagName,
          text: buttonText.substring(0, 30),
          hasNavStyle: style.includes('YY7dXjkW69Q')
        });
        return button;
      }
    }

    // Last resort: look for any clickable elements near the main image
    console.log('Looking for clickable elements near main image...');
    const mainImage = document.querySelector(SELECTORS.FACEBOOK.MAIN_IMAGE);
    if (mainImage) {
      const container = mainImage.closest('main') || mainImage.parentElement;
      if (container) {
        const clickableElements = container.querySelectorAll('button, div[role="button"], i[style*="background-image"]');
        if (clickableElements.length > 0) {
          console.log(`Found ${clickableElements.length} clickable elements near main image`);
          // Return the first one that looks like it might be navigation
          for (const element of clickableElements) {
            const rect = element.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              console.log('Using nearby clickable element as navigation button');
              return element;
            }
          }
        }
      }
    }

    console.log('No navigation button found');
    return null;
  }

  /**
   * Use static detection methods as fallback
   * @returns {Array} Array of image elements
   */
  _useStaticDetection() {
    console.log('Using Facebook static detection methods...');

    let mainPostImages = [];

    // Method 1: Find the main image in the photo viewer
    const mainImage = document.querySelector(SELECTORS.FACEBOOK.MAIN_IMAGE);
    if (mainImage) {
      const rect = mainImage.getBoundingClientRect();
      if (rect.width > IMAGE_FILTERS.MIN_WIDTH &&
          rect.height > IMAGE_FILTERS.MIN_HEIGHT) {
        console.log('Found main Facebook photo');
        mainPostImages = [mainImage];
      }
    }

    // Method 2: Try different selectors for Facebook images
    if (mainPostImages.length === 0) {
      console.log('No main image found, trying alternative selectors...');

      for (const selector of SELECTORS.FACEBOOK.POST_IMAGES) {
        const images = document.querySelectorAll(selector);
        console.log(`Trying selector "${selector}": found ${images.length} images`);

        const validImages = Array.from(images).filter(img => {
          const rect = img.getBoundingClientRect();
          return rect.width > IMAGE_FILTERS.MIN_WIDTH &&
                 rect.height > IMAGE_FILTERS.MIN_HEIGHT &&
                 !img.src.includes('profile') &&
                 !img.src.includes('icon') &&
                 !img.src.includes('emoji');
        });

        if (validImages.length > 0) {
          console.log(`Found ${validImages.length} valid images with selector: ${selector}`);
          mainPostImages = validImages;
          break;
        }
      }
    }

    // Method 3: Fallback - look for any reasonably sized images
    if (mainPostImages.length === 0) {
      console.log('Using fallback method - looking for any large Facebook images...');

      const allImages = document.querySelectorAll('img');
      const validImages = Array.from(allImages).filter(img => {
        const rect = img.getBoundingClientRect();
        const isFacebookImage = img.src.includes('fbcdn.net') ||
                              img.src.includes('facebook.com');

        return rect.width > IMAGE_FILTERS.MIN_WIDTH &&
               rect.height > IMAGE_FILTERS.MIN_HEIGHT &&
               isFacebookImage &&
               !img.src.includes('profile') &&
               !img.src.includes('icon') &&
               !img.src.includes('emoji') &&
               !img.src.includes('static');
      });

      // Sort by size (largest first) and take up to 10 images
      validImages.sort((a, b) => {
        const aRect = a.getBoundingClientRect();
        const bRect = b.getBoundingClientRect();
        return (bRect.width * bRect.height) - (aRect.width * aRect.height);
      });

      mainPostImages = validImages.slice(0, 10);
      console.log(`Found ${mainPostImages.length} images using fallback method`);
    }

    return mainPostImages;
  }
}
