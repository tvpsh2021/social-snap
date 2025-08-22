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
    PICTURE_IMAGES: 'picture img',
    DESCRIPTIVE_IMAGES: 'img[alt*="可能是"]',
    PICTURE_DESCRIPTIVE: 'picture img[alt*="可能是"]',
    MAIN_CONTAINERS: [
      'article[role="article"]:first-of-type',
      '[data-testid*="post"]:first-of-type',
      '[data-testid*="thread"]:first-of-type',
      'main > div:first-child',
      '[role="main"] > div:first-child'
    ]
  },

  INSTAGRAM: {
    NEXT_BUTTONS: [
      'button[aria-label="Next"]',
      'button[aria-label="下一個"]'
    ],
    PREV_BUTTONS: [
      'button[aria-label="Previous"]',
      'button[aria-label="上一個"]'
    ],
    IMAGES_WITH_ALT: 'img',
  },

  FACEBOOK: {
    MAIN_IMAGE: 'main img',
    NEXT_BUTTONS: [
      'button:contains("次の写真")',
      'button[aria-label*="Next"]',
      'button[aria-label*="下一張"]',
      'button[aria-label*="次へ"]'
    ],
    PREV_BUTTONS: [
      'button:contains("前の写真")',
      'button[aria-label*="Previous"]',
      'button[aria-label*="上一張"]',
      'button[aria-label*="前へ"]'
    ],
    NAVIGATION_BUTTONS: [
      'button:contains("次の写真")',
      'button:contains("Next")',
      'button:contains("下一張")',
      'i[data-visualcompletion="css-img"].x1b0d499.xfdhc5e',
      'i[data-visualcompletion="css-img"][style*="background-image"]',
      'button:has(i[data-visualcompletion="css-img"])',
      'div[role="button"]:has(i[data-visualcompletion="css-img"])'
    ],
    POST_IMAGES: [
      'main img',
      'div[data-pagelet*="photo"] img',
      'div[role="main"] img',
      'img[alt*="人"]',
      'img[alt*="画像のようです"]',
      'img[src*="fbcdn.net"]',
      'img[src*="facebook.com"]',
      '[data-pagelet="MediaViewer"] img',
      '[data-testid*="photo"] img'
    ]
  },

  X: {
    CAROUSEL_CONTAINER: [
      // 'dialog ul',
      // 'dialog div[role="group"] ul',
      // 'div[data-testid*="carousel"] ul'
      'ul[role="list"]'
    ],
    CAROUSEL_IMAGES: [
      // 'dialog ul li img',
      // 'dialog div[role="group"] ul li img',
      // 'div[data-testid*="carousel"] ul li img'
      'li[role="listitem"] img'
    ],
    NEXT_BUTTONS: [
      'button[aria-label="Next slide"]',
      'button[aria-label="Next slide"][role="button"]',
      'button:has(svg):has(path[d*="12.957 4.54L20.414 12"])',
      'button:has([aria-label="Next slide"])',
      'button[aria-label*="Next"]',
      'button[aria-label*="次の"]'
    ],
    PREV_BUTTONS: [
      'button[aria-label="Previous slide"]',
      'button:has([aria-label="Previous slide"])',
      'button[aria-label*="Previous"]',
      'button[aria-label*="前の"]'
    ],
    POST_IMAGES: [
      'dialog img[alt="Image"]',
      'dialog img[alt="画像"]',
      'dialog img[src*="twimg.com"]',
      'article img[alt="Image"]',
      'img[src*="pbs.twimg.com"]'
    ],
    MAIN_DIALOG: [
      'dialog[role="dialog"]',
      'div[data-testid="photoModal"]',
      'div[role="dialog"]'
    ]
  }
};

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
    console.log('Unable to parse URL, using default extension jpg');
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

const POPUP_MESSAGES = {
  EXTRACT_IMAGES: 'extractImages',
  GET_CURRENT_IMAGES: 'getCurrentImages'
};

const createSuccessResponse = (data) => ({
  success: true,
  ...data
});

const createErrorResponse = (errorObj, message = 'Operation failed') => ({
  success: false,
  error: errorObj.message || errorObj,
  message
});

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
      console.log(`Image ${index + 1} srcset options:`, sources);

      sources.forEach(source => {
        const parts = source.split(' ');
        if (parts.length >= 2) {
          const url = parts[0];
          const descriptor = parts[1];
          if (descriptor.endsWith('w')) {
            const width = parseInt(descriptor.slice(0, -1));
            console.log(`  - ${width}w: ${url.substring(0, 80)}...`);
            if (width > maxWidth) {
              maxWidth = width;
              maxSizeUrl = url;
            }
          }
        }
      });

      if (maxWidth > 0) {
        console.log(`Selected maximum size: ${maxWidth}w`);
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

    console.log(`Image ${index + 1}:`, {
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
    console.log('=== Starting Threads image extraction ===');

    // Strategy 1: Find images in picture tags
    const pictureImages = document.querySelectorAll(SELECTORS.THREADS.PICTURE_IMAGES);
    console.log('Strategy 1 - Images in picture tags:', pictureImages.length);

    // Strategy 2: Find images with descriptive alt text
    const chineseImages = document.querySelectorAll(SELECTORS.THREADS.DESCRIPTIVE_IMAGES);
    console.log('Strategy 2 - Images with descriptive alt text:', chineseImages.length);

    // Strategy 3: Combination - images with descriptive alt text in picture tags
    const pictureChineseImages = document.querySelectorAll(SELECTORS.THREADS.PICTURE_DESCRIPTIVE);
    console.log('Strategy 3 - Descriptive images in picture tags:', pictureChineseImages.length);

    // Try to distinguish main post from comment section
    let mainPostImages = [];

    // Method 1: Find main post container
    const possibleMainContainers = SELECTORS.THREADS.MAIN_CONTAINERS;

    for (const selector of possibleMainContainers) {
      const container = document.querySelector(selector);
      if (container) {
        const containerImages = container.querySelectorAll(SELECTORS.THREADS.PICTURE_DESCRIPTIVE);
        if (containerImages.length > 0) {
          console.log(`Found ${containerImages.length} images in container "${selector}"`);
          mainPostImages = Array.from(containerImages);
          break;
        }
      }
    }

    // Method 2: If no container found, use position-based detection
    if (mainPostImages.length === 0) {
      console.log('Using position-based detection method...');
      const allPictureImages = Array.from(pictureChineseImages);

      // Analyze each image's context to determine if it's from the main post
      const imagesWithPosition = allPictureImages.map(img => {
        const rect = img.getBoundingClientRect();
        const isInComment = this._isImageInComment(img);

        return {
          img,
          y: rect.top,
          isInComment: !!isInComment,
          domIndex: Array.from(document.querySelectorAll('img')).indexOf(img),
          alt: img.alt
        };
      });

      // Sort and take earlier images (assumed to be from main post)
      imagesWithPosition.sort((a, b) => a.domIndex - b.domIndex);

      // Filter out images that are clearly from comment section
      const filteredImages = imagesWithPosition.filter(item => !item.isInComment);

      console.log('Position analysis results:', {
        totalImages: imagesWithPosition.length,
        afterFiltering: filteredImages.length,
        commentImages: imagesWithPosition.length - filteredImages.length
      });

      // Additional content filtering
      const contentFilteredImages = filteredImages.filter(item => {
        return this._shouldKeepImage(item.alt);
      });

      console.log('Content filtering results:', {
        original: filteredImages.length,
        afterContentFiltering: contentFilteredImages.length
      });

      // Select final image collection
      if (contentFilteredImages.length >= 1) {
        mainPostImages = contentFilteredImages.map(item => item.img);
        console.log('Using content-filtered results');
      } else if (filteredImages.length >= 1) {
        mainPostImages = filteredImages.map(item => item.img);
        console.log('Using position-filtered results');
      } else {
        mainPostImages = imagesWithPosition.map(item => item.img);
        console.log('Using all found images (no filtering)');
      }

      if (mainPostImages.length > 20) {
        console.warn(`Abnormally high image count (${mainPostImages.length} images), might include comment section images`);
      }
    }

    console.log(`Final selected main post image count: ${mainPostImages.length}`);

    const imageData = [];
    mainPostImages.forEach((img, index) => {
      imageData.push(this.createImageData(img, index));
    });

    console.log('Extracted image information:', imageData);
    return imageData;
  }

  _isImageInComment(img) {
    return (
      img.closest('[data-testid*="comment"]') ||
      img.closest('[data-testid*="reply"]') ||
      img.closest('[role="article"]')?.querySelector('[data-testid*="reply"]') ||
      img.closest('div[class*="comment"]') ||
      img.closest('div[class*="reply"]') ||
      this._isNearUsernameLink(img) ||
      this._isAfterMainPost(img)
    );
  }

  _isNearUsernameLink(img) {
    const userLink = img.closest('div')?.querySelector('a[href*="/@"]');
    if (userLink) {
      const mainAuthorSection = document.querySelector('[role="main"], main, .main-content')?.querySelector('a[href*="/@"]');
      if (mainAuthorSection) {
        const isMainAuthor = userLink.href === mainAuthorSection.href;
        const linkIndex = Array.from(document.querySelectorAll('a')).indexOf(userLink);
        const mainLinkIndex = Array.from(document.querySelectorAll('a')).indexOf(mainAuthorSection);
        return !isMainAuthor && (linkIndex > mainLinkIndex + 10);
      }
    }
    return false;
  }

  _isAfterMainPost(img) {
    const mainInteractionButtons = document.querySelectorAll('button[aria-label*="Like"], button:has(img[alt="Like"])');
    if (mainInteractionButtons.length > 0) {
      const firstInteractionButton = mainInteractionButtons[0];
      const buttonIndex = Array.from(document.querySelectorAll('*')).indexOf(firstInteractionButton);
      const imgIndex = Array.from(document.querySelectorAll('*')).indexOf(img.closest('div'));
      return imgIndex > buttonIndex + 100;
    }
    return false;
  }

  _shouldKeepImage(alt) {
    const altLower = alt.toLowerCase();
    const isDefiniteComment =
      (altLower.includes('연합뉴스') || altLower.includes('news')) ||
      (altLower.includes('4 個人') && altLower.includes('顯示的文字')) ||
      (altLower.includes('文字') && altLower.includes('4 個人') && altLower.includes('顯示'));

    const shouldKeep = !isDefiniteComment;
    if (!shouldKeep) {
      console.log(`Filtered out image: ${alt.substring(0, 60)}...`);
    }
    return shouldKeep;
  }
}

// === INSTAGRAM PLATFORM ===
class InstagramPlatform extends BasePlatform {
  constructor() {
    super();
    this.platformName = PLATFORMS.INSTAGRAM;
  }

  isCurrentPlatform() {
    return window.location.hostname.includes('instagram.com');
  }

  async extractImages() {
    console.log('=== Starting Instagram image extraction ===');
    await wait(CAROUSEL.INSTAGRAM.INITIAL_WAIT);

    const mainElement = document.querySelector('main');
    if (!mainElement) {
      console.log('No <main> element found. Cannot extract images.');
      return [];
    }

    // Use the presence of a <ul> element to determine if it's a carousel
    const isCarousel = !!mainElement.querySelector('ul li');
    let mainPostImages = [];

    if (isCarousel) {
      console.log('Carousel post detected (<ul> found).');
      mainPostImages = await this._navigateCarousel(mainElement);


    } else {
      console.log('Single image post detected (no <ul> found).');
      mainPostImages = this._extractSingleImage(mainElement);

      console.log('filter before:', mainPostImages.length);
      console.log(mainPostImages);

      // Apply boundary filter AFTER collecting all images
      const boundaryElement = this._findBoundaryElement();
      if (boundaryElement) {
        console.log('Applying boundary filter.');
        mainPostImages = mainPostImages.filter(img => {
          if (!img || !img.isConnected) return false;
          const position = boundaryElement.compareDocumentPosition(img);
          return position & Node.DOCUMENT_POSITION_PRECEDING;
        });
      }

      console.log(`Final selected Instagram post image count: ${mainPostImages.length}`);
    }

    const imageData = [];
    mainPostImages.forEach((img, index) => {
      if (img && img.src) {
        imageData.push(this.createImageData(img, index));
      }
    });

    console.log('Extracted Instagram image information:', imageData);
    return imageData;
  }

  _findBoundaryElement() {
    const allDivs = document.querySelectorAll('div, h2, span');
    for (const el of allDivs) {
      if (el.textContent.trim().startsWith('More posts from')) {
        console.log('Found boundary element:', el);
        return el;
      }
    }
    return null;
  }

  _extractSingleImage(container) {
    console.log('Extracting single image...');
    const postImages = container.querySelectorAll(SELECTORS.INSTAGRAM.IMAGES_WITH_ALT);
    return Array.from(postImages).filter(img =>
      img.naturalWidth > IMAGE_FILTERS.MIN_WIDTH && img.naturalHeight > IMAGE_FILTERS.MIN_HEIGHT
    );
  }

  async _navigateCarousel(container) {
    console.log('Starting carousel navigation with user-defined rule-based logic and fixed wait...');
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
      const ul =  container.querySelector('ul');
      if (!ul) return;

      const listItems = Array.from(ul.children).filter(li => li instanceof HTMLLIElement);
      console.log('listItems: ', listItems);

      if (listItems.length === 0) return;

      const zeroPxLi = listItems.find(li => getTranslateXFromString(li) === 0);

      const insertImage = (_visibleLi) => {
        const img = _visibleLi.querySelector(SELECTORS.INSTAGRAM.IMAGES_WITH_ALT);
        if (img && img.src) {
          if (!imageMap.has(img.src)) {
            console.log(`Found new visible image via rules. Total: ${imageMap.size + 1}`);
            imageMap.set(img.src, img);
          }
        }
      };

      // first image
      if (zeroPxLi && listItems.length === 3) {
        console.log('Rule matched: Found li with translateX(0px). and li=3');
        insertImage(listItems[1]);
      }

      insertImage(listItems[2]);
    };

    while (navigationCount < CAROUSEL.INSTAGRAM.MAX_ATTEMPTS) {
      console.log('navigationCount: ', navigationCount);
      collectCurrentlyVisibleImage();

      const nextButton = this._findNextButton(container);
      if (!nextButton) {
        console.log('Navigation finished: No "Next" button found.');
        break;
      }

      console.log(`Navigation attempt ${navigationCount + 1}: Clicking Next button.`);
      nextButton.click();
      navigationCount++;

      await wait(CAROUSEL.INSTAGRAM.WAIT_TIME);
    }

    console.log(`Carousel navigation complete. Found ${imageMap.size} unique images.`);

    return Array.from(imageMap.values());
  }

  _findNextButton(container) {
    const selectors = SELECTORS.INSTAGRAM.NEXT_BUTTONS;

    for (const selector of selectors) {
      const button = container.querySelector(selector);
      if (button && button.offsetParent !== null) {
        return button;
      }
    }
    return null;
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
    console.log('Starting Facebook photo navigation to load all images...');

    const collectedImages = [];
    let navigationCount = 0;
    const maxNavigations = CAROUSEL.FACEBOOK.MAX_ATTEMPTS;

    // Enhanced image detection function
    const takeImageSnapshot = () => {
      console.log('Taking Facebook image snapshot...');

      // Try multiple selectors to find the main image
      const possibleSelectors = SELECTORS.FACEBOOK.POST_IMAGES;

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
      } catch {
        console.log('Direct click failed, trying parent button');
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
        console.log(`Successfully navigated to image ${collectedImages.length}`);
      } else {
        console.log('Found duplicate image, album navigation complete');
        break;
      }

      navigationCount++;
    }

    console.log(`Facebook navigation completed. Total images collected: ${collectedImages.length}`);
    return collectedImages.map(img => img.element);
  }

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

    for (const selector of SELECTORS.FACEBOOK.NAVIGATION_BUTTONS) {
      try {
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
          const style = element.getAttribute('style') || '';
          const classes = element.className || '';

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

    console.log('Trying alternative navigation button detection...');
    const allButtons = document.querySelectorAll('button, div[role="button"], i[data-visualcompletion]');

    for (const button of allButtons) {
      const buttonText = button.textContent || button.innerText || button.getAttribute('aria-label') || '';
      const style = button.getAttribute('style') || '';

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

    console.log('Looking for clickable elements near main image...');
    const mainImage = document.querySelector(SELECTORS.FACEBOOK.MAIN_IMAGE);
    if (mainImage) {
      const container = mainImage.closest('main') || mainImage.parentElement;
      if (container) {
        const clickableElements = container.querySelectorAll('button, div[role="button"], i[style*="background-image"]');
        if (clickableElements.length > 0) {
          console.log(`Found ${clickableElements.length} clickable elements near main image`);
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

  async extractImages() {
    console.log('=== Starting Facebook image extraction ===');

    await wait(CAROUSEL.FACEBOOK.INITIAL_WAIT);

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

    console.log(`Final selected Facebook post image count: ${mainPostImages.length}`);

    const imageData = [];
    mainPostImages.forEach((img, index) => {
      imageData.push(this.createImageData(img, index));
    });

    console.log('Extracted Facebook image information:', imageData);
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
    console.log('=== Starting X.com image extraction ===');
    await wait(CAROUSEL.X.INITIAL_WAIT);

    // Check if we're in photo mode (URL contains /photo/)
    const isPhotoMode = window.location.pathname.includes('/photo/');
    console.log('Photo mode detected:', isPhotoMode);

    // Find the main dialog container
    let mainDialog = null;
    for (const selector of SELECTORS.X.MAIN_DIALOG) {
      mainDialog = document.querySelector(selector);
      if (mainDialog) {
        console.log(`Found main dialog with selector: ${selector}`);
        break;
      }
    }

    if (!mainDialog) {
      console.log('No main dialog found. Cannot extract images.');
      return [];
    }

    // Check if it's a carousel (has multiple images)
    let carouselContainer = null;
    for (const selector of SELECTORS.X.CAROUSEL_CONTAINER) {
      carouselContainer = mainDialog.querySelector(selector);
      if (carouselContainer) {
        console.log(`Found carousel container with selector: ${selector}`);
        break;
      }
    }

    const isCarousel = !!carouselContainer;
    console.log('Carousel detected:', isCarousel);

    let mainPostImages = [];

    if (isCarousel) {
      console.log('Extracting images from carousel...');
      mainPostImages = await this._navigateCarousel(mainDialog);
    } else {
      console.log('Extracting single image...');
      mainPostImages = this._extractSingleImage(mainDialog);
    }

    console.log(`Final selected X.com post image count: ${mainPostImages.length}`);

    // Apply boundary filter to exclude images after the boundary element
    const boundaryElement = this._findBoundaryElement();
    if (boundaryElement && mainPostImages.length > 0) {
      console.log('Found boundary element, applying boundary filter...');
      const beforeFilterCount = mainPostImages.length;

      mainPostImages = mainPostImages.filter(img => {
        if (!img || !img.isConnected) return false;
        const position = boundaryElement.compareDocumentPosition(img);
        const isBeforeBoundary = position & Node.DOCUMENT_POSITION_PRECEDING;

        if (!isBeforeBoundary) {
          console.log('Filtered out image after boundary:', img.src.substring(0, 50) + '...');
        }

        return isBeforeBoundary;
      });

      console.log(`Boundary filter applied: ${beforeFilterCount} -> ${mainPostImages.length} images`);
    } else {
      console.log('No boundary element found or no images to filter');
    }

    const imageData = [];
    mainPostImages.forEach((img, index) => {
      if (img && img.src) {
        imageData.push(this.createImageData(img, index));
      }
    });

    console.log('Extracted X.com image information:', imageData);
    return imageData;
  }

  _extractSingleImage(container) {
    console.log('Extracting single image from X.com...');

    // Try different selectors to find the main image
    for (const selector of SELECTORS.X.POST_IMAGES) {
      const images = container.querySelectorAll(selector);
      console.log(`Trying selector "${selector}": found ${images.length} images`);

      const validImages = Array.from(images).filter(img => {
        const rect = img.getBoundingClientRect();
        const hasValidSize = rect.width > IMAGE_FILTERS.MIN_WIDTH && rect.height > IMAGE_FILTERS.MIN_HEIGHT;
        const isContentImage = img.alt === 'Image' || img.alt === '画像' || img.src.includes('twimg.com');

        console.log('Image validation:', {
          src: img.src.substring(0, 50) + '...',
          alt: img.alt,
          size: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
          hasValidSize,
          isContentImage
        });

        return hasValidSize && isContentImage;
      });

      if (validImages.length > 0) {
        console.log(`Found ${validImages.length} valid images with selector: ${selector}`);
        return validImages;
      }
    }

    console.log('No valid images found');
    return [];
  }

  async _navigateCarousel(container) {
    console.log('Starting X.com carousel navigation...');
    console.log('X.com carousel works with lazy loading: initially loads 2 <li>, then loads new ones on navigation');

    const imageMap = new Map();
    let navigationCount = 0;

    const collectCurrentlyVisibleImages = () => {
      console.log(`\n--- Collecting images (attempt ${navigationCount + 1}) ---`);
      let foundImages = false;
      let newImagesFound = 0;

      for (const selector of SELECTORS.X.CAROUSEL_IMAGES) {
        const carouselImages = container.querySelectorAll(selector);
        console.log(`Trying carousel selector "${selector}": found ${carouselImages.length} images`);

        if (carouselImages.length > 0) {
          foundImages = true;
          carouselImages.forEach((img, index) => {
            if (img && img.src) {
              const rect = img.getBoundingClientRect();
              const isValidImage = img.alt === 'Image' || img.alt === '画像' || img.src.includes('twimg.com');
              const isVisible = rect.width > IMAGE_FILTERS.CAROUSEL_MIN_WIDTH && rect.height > IMAGE_FILTERS.CAROUSEL_MIN_HEIGHT;

              console.log(`Image ${index + 1}:`, {
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
                  console.log(`✓ Found NEW image ${imageMap.size + 1}: ${img.src.substring(0, 50)}...`);
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
        console.log('No carousel images found with any selector');
      }

      console.log(`Collection result: ${newImagesFound} new images, ${imageMap.size} total images`);
      return newImagesFound;
    };

    // Collect initial images (X.com initially loads first 2 <li>)
    console.log('Collecting initial images (first 2 <li> elements)...');
    collectCurrentlyVisibleImages();

    // Navigate through carousel to load remaining images
    while (navigationCount < CAROUSEL.X.MAX_ATTEMPTS) {
      const nextButton = this._findNextButton(container);
      if (!nextButton) {
        console.log('Navigation finished: No "Next" button found.');
        break;
      }

      console.log(`\n=== Navigation ${navigationCount + 1}/${CAROUSEL.X.MAX_ATTEMPTS} ===`);
      console.log('Clicking Next slide button...');

      // Click the button
      nextButton.click();
      navigationCount++;

      // Wait longer for X.com to lazy-load new images
      await wait(CAROUSEL.X.WAIT_TIME + 500); // Extra 500ms for lazy loading

      // Collect images after navigation
      const newImages = collectCurrentlyVisibleImages();

      // If no new images found after 2 attempts, we might have reached the end
      if (newImages === 0 && navigationCount >= 2) {
        console.log('No new images found in last navigation, checking if we\'ve reached the end...');

        // Try one more navigation to confirm we're at the end
        const confirmButton = this._findNextButton(container);
        if (!confirmButton) {
          console.log('Confirmed: No more Next button, ending navigation');
          break;
        }

        // If button exists but no new images after 3 attempts, stop
        if (navigationCount >= 3) {
          console.log('No new images after 3 attempts, stopping navigation');
          break;
        }
      }
    }

    console.log('\n=== X.com Carousel Navigation Complete ===');
    console.log(`Total navigation attempts: ${navigationCount}`);
    console.log(`Total unique images found: ${imageMap.size}`);

    const finalImages = Array.from(imageMap.values());
    finalImages.forEach((img, index) => {
      console.log(`Final image ${index + 1}: ${img.src.substring(0, 60)}...`);
    });

    return finalImages;
  }

  _findNextButton(container) {
    const selectors = SELECTORS.X.NEXT_BUTTONS;

    for (const selector of selectors) {
      const button = container.querySelector(selector);
      if (button && button.offsetParent !== null) {
        console.log(`Found next button with selector: ${selector}`);
        return button;
      }
    }

    // Also try finding next button in the document if not found in container
    for (const selector of selectors) {
      const button = document.querySelector(selector);
      if (button && button.offsetParent !== null) {
        console.log(`Found next button in document with selector: ${selector}`);
        return button;
      }
    }

    console.log('No next button found');
    return null;
  }

  _findBoundaryElement() {
    console.log('Looking for X.com boundary element...');

    // Look for div with aria-expanded="true" which indicates the boundary
    const expandedDivs = document.querySelectorAll('div[aria-expanded="true"]');
    console.log(`Found ${expandedDivs.length} div elements with aria-expanded="true"`);

    for (const div of expandedDivs) {
      console.log('Found potential boundary element:', {
        tagName: div.tagName,
        ariaExpanded: div.getAttribute('aria-expanded'),
        classes: div.className.substring(0, 100),
        textContent: div.textContent.substring(0, 50) + '...'
      });

      // Return the first div with aria-expanded="true"
      // This is typically where X.com separates main content from related/recommended content
      return div;
    }

    console.log('No boundary element found (no div with aria-expanded="true")');
    return null;
  }
}

// === PLATFORM FACTORY ===
class PlatformFactory {
  static createPlatform() {
    const currentUrl = window.location.href;

    // First check if this is a valid post URL (not homepage)
    if (!isValidPostUrl(currentUrl)) {
      console.log('URL validation failed:', {
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
  console.log('=== Multi-platform image extraction started ===');
  console.log('Current URL:', window.location.href);

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

    console.error(error);
    console.log('URL validation details:', {
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
    console.error(error);
    throw new Error(error);
  }

  console.log(`Using ${platform.platformName} platform extractor`);

  try {
    const images = await platform.extractImages();
    console.log(`Successfully extracted ${images.length} images`);
    return images;
  } catch (error) {
    console.error('Image extraction failed:', error);
    throw error;
  }
}

// === MESSAGE LISTENERS ===
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === POPUP_MESSAGES.EXTRACT_IMAGES) {
    extractImages()
      .then(images => {
        sendResponse(createSuccessResponse({ images, count: images.length }));
      })
      .catch(error => {
        console.error('Image extraction error:', error);
        sendResponse(createErrorResponse(error, 'Failed to extract images'));
      });
    return true;
  }
});

// === AUTO EXTRACTION ===
window.addEventListener('load', () => {
  setTimeout(async () => {
    try {
      console.log('=== Social Media Image Downloader Auto-Extraction ===');
      console.log('Current URL:', window.location.href);
      console.log('Platform detection starting...');

      const images = await extractImages();
      console.log('Auto-extraction completed successfully:', images);

      chrome.runtime.sendMessage({
        action: CONTENT_MESSAGES.IMAGES_EXTRACTED,
        images,
        count: images.length
      });
    } catch (error) {
      console.error('Auto-extraction error:', error);
      chrome.runtime.sendMessage({
        action: CONTENT_MESSAGES.EXTRACTION_ERROR,
        error: error.message,
        count: 0
      });
    }
  }, 2000);
});

// === DEBUG HELPER ===
window.testXExtraction = async () => {
  console.log('=== Manual X.com Test ===');
  console.log('Current URL:', window.location.href);
  console.log('Is photo mode:', window.location.pathname.includes('/photo/'));

  // Test dialog detection
  console.log('\n--- Testing Dialog Detection ---');
  const dialogs = ['dialog[role="dialog"]', 'div[data-testid="photoModal"]', 'div[role="dialog"]'];
  let mainDialog = null;

  for (const selector of dialogs) {
    const dialog = document.querySelector(selector);
    console.log(`${selector}: ${!!dialog}`);
    if (dialog && !mainDialog) mainDialog = dialog;
  }

  if (!mainDialog) {
    console.error('No main dialog found!');
    return [];
  }

  // Test carousel detection
  console.log('\n--- Testing Carousel Detection ---');
  const carouselSelectors = ['ul[role="list"]'];
  let carouselContainer = null;

  for (const selector of carouselSelectors) {
    const container = mainDialog.querySelector(selector);
    console.log(`${selector}: ${!!container}`);
    if (container && !carouselContainer) carouselContainer = container;
  }

  // Test image detection
  console.log('\n--- Testing Image Detection ---');
  const imageSelectors = [
    'li[role="listitem"] img'
  ];

  for (const selector of imageSelectors) {
    const images = mainDialog.querySelectorAll(selector);
    console.log(`${selector}: found ${images.length} images`);

    images.forEach((img, index) => {
      const rect = img.getBoundingClientRect();
      console.log(`  Image ${index + 1}:`, {
        src: img.src.substring(0, 50) + '...',
        alt: img.alt,
        size: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
        visible: rect.width > 0 && rect.height > 0
      });
    });
  }

  // Test button detection
  console.log('\n--- Testing Next Button Detection ---');
  const buttonSelectors = [
    'button[aria-label="Next slide"]',
    'button[aria-label="Next slide"][role="button"]',
    'button:has(svg):has(path[d*="12.957 4.54L20.414 12"])',
    'button:has([aria-label="Next slide"])'
  ];

  for (const selector of buttonSelectors) {
    try {
      const button = mainDialog.querySelector(selector);
      console.log(`${selector}: ${!!button}`);
      if (button) {
        console.log(`  Button visible: ${button.offsetParent !== null}`);
        console.log(`  Button classes: ${button.className}`);
      }
    } catch (error) {
      console.log(`${selector}: ERROR - ${error.message}`);
    }
  }

  // Test boundary element detection
  console.log('\n--- Testing Boundary Element Detection ---');
  const expandedDivs = document.querySelectorAll('div[aria-expanded="true"]');
  console.log(`Found ${expandedDivs.length} div elements with aria-expanded="true"`);

  expandedDivs.forEach((div, index) => {
    console.log(`Boundary element ${index + 1}:`, {
      tagName: div.tagName,
      ariaExpanded: div.getAttribute('aria-expanded'),
      classes: div.className.substring(0, 80) + '...',
      textContent: div.textContent.substring(0, 50) + '...',
      position: {
        top: div.getBoundingClientRect().top,
        bottom: div.getBoundingClientRect().bottom
      }
    });
  });

  // Test actual extraction
  console.log('\n--- Testing Actual Extraction ---');
  try {
    const images = await extractImages();
    console.log('Manual extraction result:', images);
    console.log(`Successfully extracted ${images.length} images`);
    return images;
  } catch (error) {
    console.error('Manual extraction error:', error);
    return [];
  }
};

// === X.COM BOUNDARY TEST HELPER ===
window.testXBoundary = () => {
  console.log('=== X.com Boundary Element Test ===');

  const expandedDivs = document.querySelectorAll('div[aria-expanded="true"]');
  console.log(`Found ${expandedDivs.length} div elements with aria-expanded="true"`);

  if (expandedDivs.length === 0) {
    console.log('❌ No boundary elements found!');
    return [];
  }

  const boundaryInfo = [];

  expandedDivs.forEach((div, index) => {
    const rect = div.getBoundingClientRect();
    const info = {
      index: index + 1,
      tagName: div.tagName,
      ariaExpanded: div.getAttribute('aria-expanded'),
      classes: div.className,
      textContent: div.textContent.trim().substring(0, 100),
      position: {
        top: Math.round(rect.top),
        bottom: Math.round(rect.bottom),
        height: Math.round(rect.height)
      },
      visible: rect.width > 0 && rect.height > 0,
      element: div
    };

    boundaryInfo.push(info);
    console.log(`Boundary Element ${index + 1}:`, info);
  });

  // Test which images would be filtered
  console.log('\n--- Testing Image Filtering ---');
  const testImages = document.querySelectorAll('li[role="listitem"] img');
  console.log(`Found ${testImages.length} potential images to test`);

  if (expandedDivs.length > 0 && testImages.length > 0) {
    const boundaryElement = expandedDivs[0]; // Use first boundary element
    let beforeBoundary = 0;
    let afterBoundary = 0;

    testImages.forEach((img, index) => {
      const position = boundaryElement.compareDocumentPosition(img);
      const isBeforeBoundary = position & Node.DOCUMENT_POSITION_PRECEDING;

      if (isBeforeBoundary) {
        beforeBoundary++;
        console.log(`✓ Image ${index + 1}: BEFORE boundary (keep)`);
      } else {
        afterBoundary++;
        console.log(`✗ Image ${index + 1}: AFTER boundary (filter out)`);
      }
    });

    console.log('\n--- Filter Results ---');
    console.log(`Images BEFORE boundary (keep): ${beforeBoundary}`);
    console.log(`Images AFTER boundary (filter): ${afterBoundary}`);
    console.log(`Total images: ${testImages.length}`);
  }

  return boundaryInfo;
};
