/**
 * Bundled content script for Social Media Image Downloader
 * This file combines all content script modules into a single file to avoid ES6 import issues
 */

// === SHARED CONSTANTS ===
const PLATFORMS = {
  THREADS: 'threads',
  INSTAGRAM: 'instagram',
  FACEBOOK: 'facebook',
  X: 'x'
};

const PLATFORM_HOSTNAMES = {
  [PLATFORMS.THREADS]: 'threads.com',
  [PLATFORMS.INSTAGRAM]: 'instagram.com',
  [PLATFORMS.FACEBOOK]: 'facebook.com',
  [PLATFORMS.X]: 'x.com'
};

// URL patterns for single posts (exclude homepage/main feeds)
const SINGLE_POST_PATTERNS = {
  [PLATFORMS.THREADS]: [
    /^https:\/\/www\.threads\.com\/@[^/]+\/post\/[^/]+/,   // @username/post/postId
    /^https:\/\/www\.threads\.com\/t\/[^/]+/               // /t/postId format
  ],
  [PLATFORMS.INSTAGRAM]: [
    /^https:\/\/www\.instagram\.com\/p\/[^/]+/,            // /p/postId
    /^https:\/\/www\.instagram\.com\/[^/]+\/p\/[^/]+/,     // /accountId/p/postId
    /^https:\/\/www\.instagram\.com\/reel\/[^/]+/          // /reel/reelId
  ],
  [PLATFORMS.FACEBOOK]: [
    /^https:\/\/www\.facebook\.com\/photo\/\?fbid=/,        // /photo/?fbid=photoId
    /^https:\/\/www\.facebook\.com\/[^/]+\/photos\//        // /username/photos/photoId
  ],
  [PLATFORMS.X]: [
    /^https:\/\/x\.com\/[^/]+\/status\/[^/]+\/photo\/\d+/   // /username/status/statusId/photo/number - Only photo mode
  ]
};

// Homepage patterns to exclude
const HOMEPAGE_PATTERNS = [
  /^https:\/\/www\.threads\.com\/?$/,                       // Threads homepage
  /^https:\/\/www\.threads\.com\/\?[^/]*$/,               // Threads homepage with query params
  /^https:\/\/www\.instagram\.com\/?$/,                     // Instagram homepage
  /^https:\/\/www\.instagram\.com\/\?[^/]*$/,             // Instagram homepage with query params
  /^https:\/\/www\.facebook\.com\/?$/,                      // Facebook homepage
  /^https:\/\/www\.facebook\.com\/\?[^/]*$/,              // Facebook homepage with query params
  /^https:\/\/x\.com\/?$/,                                  // X homepage
  /^https:\/\/x\.com\/home$/,                              // X home feed
  /^https:\/\/x\.com\/\?[^/]*$/                           // X homepage with query params
];

const GENERAL_CONFIG = {
  ON_LOAD_WAIT: 1000,
  DEBUG: true,
};

const CAROUSEL = {
  INSTAGRAM: {
    INITIAL_WAIT: 500,
    WAIT_TIME: 1000,
    MAX_ATTEMPTS: 50,
  },
  FACEBOOK: {
    INITIAL_WAIT: 1000,
    WAIT_TIME: 1000,
    MAX_ATTEMPTS: 50,
  },
  X: {
    INITIAL_WAIT: 500,
    WAIT_TIME: 1000,
    MAX_ATTEMPTS: 10,
  }
};

const IMAGE_FILTERS = {
  MIN_WIDTH: 150,
  MIN_HEIGHT: 150,
  CAROUSEL_MIN_WIDTH: 50,
  CAROUSEL_MIN_HEIGHT: 50
};

const SELECTORS = {
  THREADS: {
    CONTAINER: 'div[data-pressable-container="true"]',
    IMAGES: 'img'
  },

  INSTAGRAM: {
    NEXT_BUTTONS: [
      'button',
    ],
    POST_IMAGES: 'img',
    MAIN_ELEMENT: 'main',
    CAROUSEL_INDICATOR: 'ul li',
    UL_ELEMENT: 'ul',
    BOUNDARY_ELEMENTS: 'div, h2, span'
  },

  FACEBOOK: {
    NEXT_BUTTONS: [
      'div[data-visualcompletion="ignore-dynamic"]:nth-of-type(2) i[data-visualcompletion="css-img"]',

    ],
    POST_IMAGES: [
      'div[role="main"] img',
    ]
  },

  X: {
    CAROUSEL_CONTAINER: [
      'ul[role="list"]'
    ],
    CAROUSEL_IMAGES: [
      'li[role="listitem"] img'
    ],
    NEXT_BUTTONS: [
      'div[data-testid="Carousel-NavRight"] button'
    ],
    POST_IMAGES: [
      'div[data-testid="swipe-to-dismiss"] img'
    ],
    MAIN_DIALOG: [
      'div[role="dialog"]'
    ],
    BOUNDARY_INDICATOR: 'div[aria-expanded="true"]'
  }
};

function log(...message) {
  if (GENERAL_CONFIG.DEBUG) {
    console.log(...message);
  }
}

function logError(...message) {
  if (GENERAL_CONFIG.DEBUG) {
    console.error(...message);
  }
}

function logWarn(...message) {
  if (GENERAL_CONFIG.DEBUG) {
    console.warn(...message);
  }
}

// === URL VALIDATION UTILS ===
function isHomepage(url) {
  return HOMEPAGE_PATTERNS.some(pattern => pattern.test(url));
}

function isSinglePost(url) {
  const allPostPatterns = Object.values(SINGLE_POST_PATTERNS).flat();
  return allPostPatterns.some(pattern => pattern.test(url));
}

function isValidPostUrl(url) {
  // Must be a single post and NOT a homepage
  return isSinglePost(url) && !isHomepage(url);
}

function getPlatformFromUrl(url) {
  if (url.includes(PLATFORM_HOSTNAMES[PLATFORMS.THREADS])) {
    return PLATFORMS.THREADS;
  } else if (url.includes(PLATFORM_HOSTNAMES[PLATFORMS.INSTAGRAM])) {
    return PLATFORMS.INSTAGRAM;
  } else if (url.includes(PLATFORM_HOSTNAMES[PLATFORMS.FACEBOOK])) {
    return PLATFORMS.FACEBOOK;
  } else if (url.includes(PLATFORM_HOSTNAMES[PLATFORMS.X])) {
    return PLATFORMS.X;
  }
  return null;
}

// === SHARED UTILS ===
function getFileExtension(url) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const match = pathname.match(/\.(jpg|jpeg|png|gif|webp)$/i);
    if (match) {
      return match[1].toLowerCase();
    }

    const searchParams = urlObj.searchParams;
    if (searchParams.has('format')) {
      return searchParams.get('format');
    }

    if (url.includes('jpg') || url.includes('jpeg')) return 'jpg';
    if (url.includes('png')) return 'png';
    if (url.includes('webp')) return 'webp';
    if (url.includes('gif')) return 'gif';

    return 'jpg';
  } catch {
    log('Unable to parse URL, using default extension jpg');
    return 'jpg';
  }
}

function generateFilename(platformName, index, url) {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
  const extension = getFileExtension(url);
  return `${platformName}_image_${timestamp}_${index}.${extension}`;
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// === MESSAGE TYPES ===
const CONTENT_MESSAGES = {
  IMAGES_EXTRACTED: 'imagesExtracted',
  EXTRACTION_ERROR: 'extractionError'
};

// === BASE PLATFORM CLASS ===
class BasePlatform {
  constructor() {
    this.platformName = 'base';
  }

  isCurrentPlatform() {
    return false;
  }

  extractImages() {
    return [];
  }

  generateFilename(index, url) {
    return generateFilename(this.platformName, index, url);
  }

  createImageData(img, index) {
    const src = img.src;
    const alt = img.alt;
    const srcset = img.srcset;

    // Parse srcset to find maximum size
    let maxSizeUrl = src;
    let maxWidth = 0;

    if (srcset) {
      const sources = srcset.split(',').map(s => s.trim());
      log(`Image ${index + 1} srcset options:`, sources);

      sources.forEach(source => {
        const parts = source.split(' ');
        if (parts.length >= 2) {
          const url = parts[0];
          const descriptor = parts[1];
          if (descriptor.endsWith('w')) {
            const width = parseInt(descriptor.slice(0, -1));
            log(`  - ${width}w: ${url.substring(0, 80)}...`);
            if (width > maxWidth) {
              maxWidth = width;
              maxSizeUrl = url;
            }
          }
        }
      });

      if (maxWidth > 0) {
        log(`Selected maximum size: ${maxWidth}w`);
      }
    }

    // Handle Instagram/Meta image URLs - preserve all necessary security parameters
    let thumbnailUrl = src;

    // If no larger size found, use original src
    if (maxWidth === 0) {
      maxSizeUrl = src;
    }

    // For thumbnails, try to modify size parameters without breaking other parameters
    if (src.includes('instagram.') || src.includes('fbcdn.net')) {
      // Instagram/Facebook CDN images, keep original URL as thumbnail
      thumbnailUrl = src;
      if (maxWidth === 0) {
        maxSizeUrl = src;
      }
    } else {
      // Non-Instagram images, can safely modify size parameters
      if (thumbnailUrl.includes('?')) {
        const baseUrl = thumbnailUrl.split('?')[0];
        thumbnailUrl = baseUrl + '?width=150&height=150';
      }
    }

    log(`Image ${index + 1}:`, {
      alt: alt.substring(0, 30) + '...',
      thumbnailUrl,
      fullSizeUrl: maxSizeUrl,
      maxWidth
    });

    return {
      index: index + 1,
      alt,
      thumbnailUrl,
      fullSizeUrl: maxSizeUrl,
      maxWidth
    };
  }
}

// === THREADS PLATFORM ===
class ThreadsPlatform extends BasePlatform {
  constructor() {
    super();
    this.platformName = PLATFORMS.THREADS;
  }

  isCurrentPlatform() {
    return window.location.hostname.includes(PLATFORM_HOSTNAMES[PLATFORMS.THREADS]);
  }

  extractImages() {
    log('=== Starting Threads image extraction ===');

    // Find the first div with data-pressable-container="true"
    const firstContainer = document.querySelector(SELECTORS.THREADS.CONTAINER);
    log('First container found:', firstContainer);

    if (!firstContainer) {
      log(`No container with ${SELECTORS.THREADS.CONTAINER} found`);
      return [];
    }

    // Get all img elements within this first container
    const targetImages = firstContainer.querySelectorAll(SELECTORS.THREADS.IMAGES);
    log(`Found ${targetImages.length} images in the first container`);

    // Skip the first image (user profile picture)
    const mainPostImages = Array.from(targetImages).slice(1);
    log(`Skipped first image (profile picture), selected ${mainPostImages.length} images`);

    const imageData = [];
    mainPostImages.forEach((img, index) => {
      imageData.push(this.createImageData(img, index));
    });

    log('Extracted image information:', imageData);
    return imageData;
  }
}

// === INSTAGRAM PLATFORM ===
class InstagramPlatform extends BasePlatform {
  constructor() {
    super();
    this.platformName = PLATFORMS.INSTAGRAM;
  }

  isCurrentPlatform() {
    return window.location.hostname.includes(PLATFORM_HOSTNAMES[PLATFORMS.INSTAGRAM]);
  }

  async extractImages() {
    log('=== Starting Instagram image extraction ===');
    await wait(CAROUSEL.INSTAGRAM.INITIAL_WAIT);

    const mainElement = document.querySelector(SELECTORS.INSTAGRAM.MAIN_ELEMENT);
    if (!mainElement) {
      log('No <main> element found. Cannot extract images.');
      return [];
    }

    // Use the presence of a <ul> element to determine if it's a carousel
    const isCarousel = !!mainElement.querySelector(SELECTORS.INSTAGRAM.CAROUSEL_INDICATOR);
    let mainPostImages = [];

    if (isCarousel) {
      log('Carousel post detected (<ul> found).');
      mainPostImages = await this._navigateCarousel(mainElement);


    } else {
      log('Single image post detected (no <ul> found).');
      mainPostImages = this._extractSingleImage(mainElement);

      log('filter before:', mainPostImages.length);
      log(mainPostImages);

      // Apply boundary filter AFTER collecting all images
      const boundaryElement = this._findBoundaryElement();
      if (boundaryElement) {
        log('Applying boundary filter.');
        mainPostImages = mainPostImages.filter(img => {
          if (!img || !img.isConnected) return false;
          const position = boundaryElement.compareDocumentPosition(img);
          return position & Node.DOCUMENT_POSITION_PRECEDING;
        });
      }

      log(`Final selected Instagram post image count: ${mainPostImages.length}`);
    }

    const imageData = [];
    mainPostImages.forEach((img, index) => {
      if (img && img.src) {
        imageData.push(this.createImageData(img, index));
      }
    });

    log('Extracted Instagram image information:', imageData);
    return imageData;
  }

  _findBoundaryElement() {
    const allDivs = document.querySelectorAll(SELECTORS.INSTAGRAM.BOUNDARY_ELEMENTS);
    for (const el of allDivs) {
      if (el.textContent.trim().startsWith('More posts from')) {
        log('Found boundary element:', el);
        return el;
      }
    }
    return null;
  }

  _extractSingleImage(container) {
    log('Extracting single image...');
    const postImages = container.querySelectorAll(SELECTORS.INSTAGRAM.POST_IMAGES);
    return Array.from(postImages).filter(img =>
      img.naturalWidth > IMAGE_FILTERS.MIN_WIDTH && img.naturalHeight > IMAGE_FILTERS.MIN_HEIGHT
    );
  }

  async _navigateCarousel(container) {
    log('Starting carousel navigation with user-defined rule-based logic and fixed wait...');
    const imageMap = new Map();
    let navigationCount = 0;

    const getTranslateXFromString = (element) => {
      if (!element || !element.style || !element.style.transform) return null;
      const transform = element.style.transform;
      const match = transform.match(/translateX\(([^p]+)px\)/);
      if (match && match[1]) {
        return parseFloat(match[1]);
      }
      return null;
    };

    const collectCurrentlyVisibleImage = () => {
      const ul =  container.querySelector(SELECTORS.INSTAGRAM.UL_ELEMENT);
      if (!ul) return;

      const listItems = Array.from(ul.children).filter(li => li instanceof HTMLLIElement);
      log('listItems: ', listItems);

      if (listItems.length === 0) return;

      const zeroPxLi = listItems.find(li => getTranslateXFromString(li) === 0);

      const insertImage = (_visibleLi) => {
        const img = _visibleLi.querySelector(SELECTORS.INSTAGRAM.POST_IMAGES);
        if (img && img.src) {
          if (!imageMap.has(img.src)) {
            log(`Found new visible image via rules. Total: ${imageMap.size + 1}`);
            imageMap.set(img.src, img);
          }
        }
      };

      // first image
      if (zeroPxLi && listItems.length === 3) {
        log('Rule matched: Found li with translateX(0px). and li=3');
        insertImage(listItems[1]);
      }

      insertImage(listItems[2]);
    };

    while (navigationCount < CAROUSEL.INSTAGRAM.MAX_ATTEMPTS) {
      log('navigationCount: ', navigationCount);
      collectCurrentlyVisibleImage();

      const nextButton = this._findNextButton(container);
      if (!nextButton) {
        log('Navigation finished: No "Next" button found.');
        break;
      }

      log(`Navigation attempt ${navigationCount + 1}: Clicking Next button.`);
      nextButton.click();
      navigationCount++;

      await wait(CAROUSEL.INSTAGRAM.WAIT_TIME);
    }

    log(`Carousel navigation complete. Found ${imageMap.size} unique images.`);

    return Array.from(imageMap.values());
  }

  _findNextButton(container) {
    const selectors = container.querySelectorAll(SELECTORS.INSTAGRAM.NEXT_BUTTONS);

    return Array.from(selectors).find(button => {
      if (button.offsetParent !== null) {
        const computedStyle = window.getComputedStyle(button);
        return computedStyle.right === '0px';
      }
      return false;
    }) || null;
  }
}

// === FACEBOOK PLATFORM ===
class FacebookPlatform extends BasePlatform {
  constructor() {
    super();
    this.platformName = PLATFORMS.FACEBOOK;
  }

  isCurrentPlatform() {
    return window.location.hostname.includes(PLATFORM_HOSTNAMES[PLATFORMS.FACEBOOK]);
  }

  async navigateCarousel() {
    log('Starting Facebook photo navigation to load all images...');

    const collectedImages = [];
    let navigationCount = 0;
    const maxNavigations = CAROUSEL.FACEBOOK.MAX_ATTEMPTS;

    // Enhanced image detection function
    const takeImageSnapshot = () => {
      log('Taking Facebook image snapshot...');

      // Try multiple selectors to find the main image
      const possibleSelectors = SELECTORS.FACEBOOK.POST_IMAGES;

      let foundImage = null;

      for (const selector of possibleSelectors) {
        const images = document.querySelectorAll(selector);
        log(`Trying selector "${selector}": found ${images.length} images`);

        for (const img of images) {
          const rect = img.getBoundingClientRect();
          log(`Image: ${img.src.substring(0, 50)}... Size: ${rect.width}x${rect.height}`);

          if (rect.width > IMAGE_FILTERS.MIN_WIDTH &&
              rect.height > IMAGE_FILTERS.MIN_HEIGHT &&
              !img.src.includes('profile') &&
              !img.src.includes('icon') &&
              !img.src.includes('static') &&
              rect.width > 200) { // Facebook photos are usually larger

            // Found a potential main image
            foundImage = img;
            log('Found potential main image:', img.src.substring(0, 80));
            break;
          }
        }

        if (foundImage) break;
      }

      if (!foundImage) {
        log('No suitable main image found');
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

        log('Comparing with existing image:', {
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
        log(`✓ Collected Facebook image ${collectedImages.length}:`, {
          alt: imageData.alt.substring(0, 30),
          src: imageData.src.substring(0, 60),
          size: `${imageData.naturalWidth}x${imageData.naturalHeight}`,
          rect: `${Math.round(rect.width)}x${Math.round(rect.height)}`
        });
        return true;
      } else {
        log('Image already exists in collection, skipping');
        return false;
      }
    };

    // Collect the first image
    log('Collecting initial Facebook image...');

    takeImageSnapshot();

    // Navigate through the album until we find a duplicate image (full circle)
    while (navigationCount < maxNavigations) {
      const nextButton = this._findNavigationButton();

      if (!nextButton) {
        log('No navigation button found, stopping');
        break;
      }

      log(`Navigation attempt ${navigationCount + 1}: Clicking Next button`);

      // Try different click strategies
      try {
        // Strategy 1: Direct click
        nextButton.click();
      } catch {
        log('Direct click failed, trying parent button');
        // Strategy 2: Click parent button
        const parentButton = nextButton.closest('button');
        if (parentButton) {
          parentButton.click();
        }
      }

      await wait(CAROUSEL.FACEBOOK.WAIT_TIME);

      // Try to collect new image
      const foundNewImage = takeImageSnapshot();

      if (foundNewImage) {
        log(`Successfully navigated to image ${collectedImages.length}`);
      } else {
        log('Found duplicate image, album navigation complete');
        break;
      }

      navigationCount++;
    }

    log(`Facebook navigation completed. Total images collected: ${collectedImages.length}`);
    return collectedImages.map(img => img.element);
  }

  _findNavigationButton() {
    log('Looking for Facebook navigation buttons...');

    for (const selector of SELECTORS.FACEBOOK.NEXT_BUTTONS) {
      try {

        const elements = document.querySelectorAll(selector);
        log(`Trying selector "${selector}": found ${elements.length} elements`);

        return elements[0];
      } catch (error) {
        log(`Selector ${selector} failed:`, error);
        continue;
      }
    }

    log('No navigation button found');
    return null;
  }

  async extractImages() {
    log('=== Starting Facebook image extraction ===');

    await wait(CAROUSEL.FACEBOOK.INITIAL_WAIT);

    const isPhotoPage = window.location.pathname.includes('/photo') ||
                       window.location.search.includes('fbid=');

    if (!isPhotoPage) {
      log('Not a Facebook photo page, no images to extract');
      return [];
    }

    log('Facebook photo page detected');

    // Check if this is a multi-image album by looking for the specific text
    const isMultiImageAlbum = document.body.textContent.includes('この写真は投稿で使用されています。');
    log('Multi-image album detected:', isMultiImageAlbum);

    let mainPostImages = [];

    if (isMultiImageAlbum) {
      // Check if this is part of an album with navigation buttons
      const navigationButton = this._findNavigationButton();
      log('Navigation button found:', !!navigationButton);

      if (navigationButton) {
        log('Multi-image album confirmed, using carousel navigation to load all images...');
        try {
          mainPostImages = await this.navigateCarousel();
          log(`Carousel navigation completed, found ${mainPostImages.length} images`);
        } catch (error) {
          logError('Carousel navigation failed, falling back to static detection:', error);
          mainPostImages = [];
        }
      } else {
        log('Multi-image album detected but no navigation button found, using static detection');
      }
    } else {
      log('Single image post detected, using static detection only (no navigation)');
    }

    if (mainPostImages.length === 0) {
      log('No main image found, trying alternative selectors...');

      for (const selector of SELECTORS.FACEBOOK.POST_IMAGES) {
        const images = document.querySelectorAll(selector);
        log(`Trying selector "${selector}": found ${images.length} images`);

        const validImages = Array.from(images).filter(img => {
          const rect = img.getBoundingClientRect();
          return rect.width > IMAGE_FILTERS.MIN_WIDTH &&
                 rect.height > IMAGE_FILTERS.MIN_HEIGHT &&
                 !img.src.includes('profile') &&
                 !img.src.includes('icon') &&
                 !img.src.includes('emoji');
        });

        if (validImages.length > 0) {
          log(`Found ${validImages.length} valid images with selector: ${selector}`);
          mainPostImages = validImages;
          break;
        }
      }
    }

    log(`Final selected Facebook post image count: ${mainPostImages.length}`);

    const imageData = [];
    mainPostImages.forEach((img, index) => {
      imageData.push(this.createImageData(img, index));
    });

    log('Extracted Facebook image information:', imageData);
    return imageData;
  }
}

// === X PLATFORM ===
class XPlatform extends BasePlatform {
  constructor() {
    super();
    this.platformName = PLATFORMS.X;
  }

  isCurrentPlatform() {
    return window.location.hostname.includes(PLATFORM_HOSTNAMES[PLATFORMS.X]);
  }

  async extractImages() {
    log('=== Starting X.com image extraction ===');
    await wait(CAROUSEL.X.INITIAL_WAIT);

    // Check if we're in photo mode (URL contains /photo/)
    const isPhotoMode = window.location.pathname.includes('/photo/');
    log('Photo mode detected:', isPhotoMode);

    // Find the main dialog container
    let mainDialog = null;
    for (const selector of SELECTORS.X.MAIN_DIALOG) {
      mainDialog = document.querySelector(selector);
      if (mainDialog) {
        log(`Found main dialog with selector: ${selector}`);
        break;
      }
    }

    if (!mainDialog) {
      log('No main dialog found. Cannot extract images.');
      return [];
    }

    // Check if it's a carousel (has multiple images)
    let carouselContainer = null;
    for (const selector of SELECTORS.X.CAROUSEL_CONTAINER) {
      carouselContainer = mainDialog.querySelector(selector);
      if (carouselContainer) {
        log(`Found carousel container with selector: ${selector}`);
        break;
      }
    }

    const isCarousel = !!carouselContainer;
    log('Carousel detected:', isCarousel);

    let mainPostImages = [];

    if (isCarousel) {
      log('Extracting images from carousel...');
      mainPostImages = await this._navigateCarousel(mainDialog);
    } else {
      log('Extracting single image...');
      mainPostImages = this._extractSingleImage(mainDialog);
    }

    log(`Final selected X.com post image count: ${mainPostImages.length}`);

    // Apply boundary filter to exclude images after the boundary element
    const boundaryElement = this._findBoundaryElement();
    if (boundaryElement && mainPostImages.length > 0) {
      log('Found boundary element, applying boundary filter...');
      const beforeFilterCount = mainPostImages.length;

      mainPostImages = mainPostImages.filter(img => {
        if (!img || !img.isConnected) return false;
        const position = boundaryElement.compareDocumentPosition(img);
        const isBeforeBoundary = position & Node.DOCUMENT_POSITION_PRECEDING;

        if (!isBeforeBoundary) {
          log('Filtered out image after boundary:', img.src.substring(0, 50) + '...');
        }

        return isBeforeBoundary;
      });

      log(`Boundary filter applied: ${beforeFilterCount} -> ${mainPostImages.length} images`);
    } else {
      log('No boundary element found or no images to filter');
    }

    const imageData = [];
    mainPostImages.forEach((img, index) => {
      if (img && img.src) {
        imageData.push(this.createImageData(img, index));
      }
    });

    log('Extracted X.com image information:', imageData);
    return imageData;
  }

  _extractSingleImage(container) {
    log('Extracting single image from X.com...');

    // Try different selectors to find the main image
    for (const selector of SELECTORS.X.POST_IMAGES) {
      const images = container.querySelectorAll(selector);
      log(`Trying selector "${selector}": found ${images.length} images`);

      const validImages = Array.from(images).filter(img => {
        const rect = img.getBoundingClientRect();
        const hasValidSize = rect.width > IMAGE_FILTERS.MIN_WIDTH && rect.height > IMAGE_FILTERS.MIN_HEIGHT;
        const isContentImage = img.alt === 'Image' || img.alt === '画像' || img.src.includes('twimg.com');

        log('Image validation:', {
          src: img.src.substring(0, 50) + '...',
          alt: img.alt,
          size: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
          hasValidSize,
          isContentImage
        });

        return hasValidSize && isContentImage;
      });

      if (validImages.length > 0) {
        log(`Found ${validImages.length} valid images with selector: ${selector}`);
        return validImages;
      }
    }

    log('No valid images found');
    return [];
  }

  async _navigateCarousel(container) {
    log('Starting X.com carousel navigation...');
    log('X.com carousel works with lazy loading: initially loads 2 <li>, then loads new ones on navigation');

    const imageMap = new Map();
    let navigationCount = 0;

    const collectCurrentlyVisibleImages = () => {
      log(`\n--- Collecting images (attempt ${navigationCount + 1}) ---`);
      let foundImages = false;
      let newImagesFound = 0;

      for (const selector of SELECTORS.X.CAROUSEL_IMAGES) {
        const carouselImages = container.querySelectorAll(selector);
        log(`Trying carousel selector "${selector}": found ${carouselImages.length} images`);

        if (carouselImages.length > 0) {
          foundImages = true;
          carouselImages.forEach((img, index) => {
            if (img && img.src) {
              const rect = img.getBoundingClientRect();
              const isValidImage = img.alt === 'Image' || img.alt === '画像' || img.src.includes('twimg.com');
              const isVisible = rect.width > IMAGE_FILTERS.CAROUSEL_MIN_WIDTH && rect.height > IMAGE_FILTERS.CAROUSEL_MIN_HEIGHT;

              log(`Image ${index + 1}:`, {
                src: img.src.substring(0, 60) + '...',
                alt: img.alt,
                size: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
                isValidImage,
                isVisible,
                alreadyCollected: imageMap.has(img.src)
              });

              // Check if image is valid and visible
              if (isVisible && isValidImage) {
                if (!imageMap.has(img.src)) {
                  log(`✓ Found NEW image ${imageMap.size + 1}: ${img.src.substring(0, 50)}...`);
                  imageMap.set(img.src, img);
                  newImagesFound++;
                }
              }
            }
          });
          break; // Stop after finding images with first working selector
        }
      }

      if (!foundImages) {
        log('No carousel images found with any selector');
      }

      log(`Collection result: ${newImagesFound} new images, ${imageMap.size} total images`);
      return newImagesFound;
    };

    // Collect initial images (X.com initially loads first 2 <li>)
    log('Collecting initial images (first 2 <li> elements)...');
    collectCurrentlyVisibleImages();

    // Navigate through carousel to load remaining images
    while (navigationCount < CAROUSEL.X.MAX_ATTEMPTS) {
      const nextButton = this._findNextButton(container);
      if (!nextButton) {
        log('Navigation finished: No "Next" button found.');
        break;
      }

      log(`\n=== Navigation ${navigationCount + 1}/${CAROUSEL.X.MAX_ATTEMPTS} ===`);
      log('Clicking Next slide button...');

      // Click the button
      nextButton.click();
      navigationCount++;

      // Wait longer for X.com to lazy-load new images
      await wait(CAROUSEL.X.WAIT_TIME); // Extra 500ms for lazy loading

      // Collect images after navigation
      const newImages = collectCurrentlyVisibleImages();

      // If no new images found after 2 attempts, we might have reached the end
      if (newImages === 0 && navigationCount >= 2) {
        log('No new images found in last navigation, checking if we\'ve reached the end...');

        // Try one more navigation to confirm we're at the end
        const confirmButton = this._findNextButton(container);
        if (!confirmButton) {
          log('Confirmed: No more Next button, ending navigation');
          break;
        }

        // If button exists but no new images after 3 attempts, stop
        if (navigationCount >= 3) {
          log('No new images after 3 attempts, stopping navigation');
          break;
        }
      }
    }

    log('\n=== X.com Carousel Navigation Complete ===');
    log(`Total navigation attempts: ${navigationCount}`);
    log(`Total unique images found: ${imageMap.size}`);

    const finalImages = Array.from(imageMap.values());
    finalImages.forEach((img, index) => {
      log(`Final image ${index + 1}: ${img.src.substring(0, 60)}...`);
    });

    return finalImages;
  }

  _findNextButton(container) {
    const selectors = SELECTORS.X.NEXT_BUTTONS;

    for (const selector of selectors) {
      const button = container.querySelector(selector);
      if (button && button.offsetParent !== null) {
        log(`Found next button with selector: ${selector}`);
        return button;
      }
    }

    // Also try finding next button in the document if not found in container
    for (const selector of selectors) {
      const button = document.querySelector(selector);
      if (button && button.offsetParent !== null) {
        log(`Found next button in document with selector: ${selector}`);
        return button;
      }
    }

    log('No next button found');
    return null;
  }

  _findBoundaryElement() {
    log('Looking for X.com boundary element...');

    // Look for div with aria-expanded="true" which indicates the boundary
    const expandedDivs = document.querySelectorAll(SELECTORS.X.BOUNDARY_INDICATOR);
    log(`Found ${expandedDivs.length} div elements with aria-expanded="true"`);

    for (const div of expandedDivs) {
      log('Found potential boundary element:', {
        tagName: div.tagName,
        ariaExpanded: div.getAttribute('aria-expanded'),
        classes: div.className.substring(0, 100),
        textContent: div.textContent.substring(0, 50) + '...'
      });

      // Return the first div with aria-expanded="true"
      // This is typically where X.com separates main content from related/recommended content
      return div;
    }

    log('No boundary element found (no div with aria-expanded="true")');
    return null;
  }
}

// === PLATFORM FACTORY ===
class PlatformFactory {
  static createPlatform() {
    const currentUrl = window.location.href;

    // First check if this is a valid post URL (not homepage)
    if (!isValidPostUrl(currentUrl)) {
      log('URL validation failed:', {
        url: currentUrl,
        isHomepage: isHomepage(currentUrl),
        isSinglePost: isSinglePost(currentUrl),
        isValid: isValidPostUrl(currentUrl)
      });
      return null;
    }

    const platform = getPlatformFromUrl(currentUrl);

    if (platform === PLATFORMS.THREADS) {
      return new ThreadsPlatform();
    } else if (platform === PLATFORMS.INSTAGRAM) {
      return new InstagramPlatform();
    } else if (platform === PLATFORMS.FACEBOOK) {
      return new FacebookPlatform();
    } else if (platform === PLATFORMS.X) {
      return new XPlatform();
    }

    return null;
  }

  static getSupportedPlatforms() {
    return Object.values(PLATFORM_HOSTNAMES);
  }

  static isValidUrl(url = window.location.href) {
    return isValidPostUrl(url);
  }
}

// === MAIN EXTRACTION FUNCTION ===
async function extractImages() {
  log('=== Multi-platform image extraction started ===');
  log('Current URL:', window.location.href);

  const currentUrl = window.location.href;

  // Check if URL is valid (single post, not homepage)
  if (!PlatformFactory.isValidUrl(currentUrl)) {
    let error = '';
    if (isHomepage(currentUrl)) {
      error = 'Homepage detected. This extension only works on individual posts, not on the main feed.';
    } else if (!isSinglePost(currentUrl)) {
      error = 'Unsupported page type. This extension works on individual posts only.';
    } else {
      error = `Unsupported platform: ${window.location.hostname}`;
    }

    logWarn(error);
    log('URL validation details:', {
      url: currentUrl,
      isHomepage: isHomepage(currentUrl),
      isSinglePost: isSinglePost(currentUrl),
      supportedPlatforms: PlatformFactory.getSupportedPlatforms()
    });
    throw new Error(error);
  }

  const platform = PlatformFactory.createPlatform();

  if (!platform) {
    const error = `Failed to create platform handler for: ${window.location.hostname}`;
    logError(error);
    throw new Error(error);
  }

  log(`Using ${platform.platformName} platform extractor`);

  try {
    const images = await platform.extractImages();
    log(`Successfully extracted ${images.length} images`);
    return images;
  } catch (error) {
    logError('Image extraction failed:', error);
    throw error;
  }
}

// === AUTO EXTRACTION ===
window.addEventListener('load', () => {
  setTimeout(async () => {
    try {
      log('=== Social Media Image Downloader Auto-Extraction ===');
      log('Current URL:', window.location.href);
      log('Platform detection starting...');

      const images = await extractImages();
      log('Auto-extraction completed successfully:', images);

      chrome.runtime.sendMessage({
        action: CONTENT_MESSAGES.IMAGES_EXTRACTED,
        images,
        count: images.length
      });
    } catch (error) {
      logError('Auto-extraction error:', error);
      chrome.runtime.sendMessage({
        action: CONTENT_MESSAGES.EXTRACTION_ERROR,
        error: error.message,
        count: 0
      });
    }
  }, GENERAL_CONFIG.ON_LOAD_WAIT);

  // Setup SPA carousel detection for X.com
  setupSpaCarouselDetection();
});

// === SPA CAROUSEL DETECTION ===
function setupSpaCarouselDetection() {
  // Only setup for X.com
  log('Current URL:', window.location.href);
  if (!window.location.hostname.includes(PLATFORM_HOSTNAMES[PLATFORMS.X])) {
    return;
  }

  log('Setting up SPA carousel detection for X.com...');

  let extractionInProgress = false;

  const observer = new MutationObserver(async (mutations) => {
    // Skip if already processing
    if (extractionInProgress) {
      return;
    }

    // Check if we're in photo mode
    const isPhotoMode = window.location.pathname.includes('/photo/');
    if (!isPhotoMode) {
      return;
    }

    // Check if any mutation added a photo dialog
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if this node or its children contain a photo dialog
            const isPhotoDialog = checkForPhotoDialog(node);
            if (isPhotoDialog) {
              log('Photo carousel detected in SPA navigation, triggering extraction...');

              extractionInProgress = true;
              try {
                // Wait a bit for the carousel to fully load
                await wait(CAROUSEL.X.INITIAL_WAIT);

                const images = await extractImages();
                log('SPA carousel extraction completed:', images);

                chrome.runtime.sendMessage({
                  action: CONTENT_MESSAGES.IMAGES_EXTRACTED,
                  images,
                  count: images.length
                });
              } catch (error) {
                logError('SPA carousel extraction error:', error);
                chrome.runtime.sendMessage({
                  action: CONTENT_MESSAGES.EXTRACTION_ERROR,
                  error: error.message,
                  count: 0
                });
              } finally {
                extractionInProgress = false;
              }

              return; // Exit early once we found and processed a dialog
            }
          }
        }
      }
    }
  });

  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  log('SPA carousel detection setup completed');
}

function checkForPhotoDialog(node) {
  // Check if the node itself is a photo dialog
  for (const selector of SELECTORS.X.MAIN_DIALOG) {
    if (node.matches && node.matches(selector)) {
      log(`Found photo dialog with selector: ${selector}`);
      return true;
    }
  }

  // Check if the node contains a photo dialog
  for (const selector of SELECTORS.X.MAIN_DIALOG) {
    if (node.querySelector && node.querySelector(selector)) {
      log(`Found photo dialog in subtree with selector: ${selector}`);
      return true;
    }
  }

  return false;
}
