/**
 * Bundled content script for Social Media Image Downloader
 * This file combines all content script modules into a single file to avoid ES6 import issues
 */

// === SHARED CONSTANTS ===
const PLATFORMS = {
  THREADS: 'threads',
  INSTAGRAM: 'instagram',
  FACEBOOK: 'facebook'
};

const PLATFORM_HOSTNAMES = {
  [PLATFORMS.THREADS]: 'threads.com',
  [PLATFORMS.INSTAGRAM]: 'instagram.com',
  [PLATFORMS.FACEBOOK]: 'facebook.com'
};

// URL patterns for single posts (exclude homepage/main feeds)
const SINGLE_POST_PATTERNS = {
  [PLATFORMS.THREADS]: [
    /^https:\/\/www\.threads\.com\/@[^\/]+\/post\/[^\/]+/,  // @username/post/postId
    /^https:\/\/www\.threads\.com\/t\/[^\/]+/               // /t/postId format
  ],
  [PLATFORMS.INSTAGRAM]: [
    /^https:\/\/www\.instagram\.com\/p\/[^\/]+/,            // /p/postId
    /^https:\/\/www\.instagram\.com\/reel\/[^\/]+/          // /reel/reelId
  ],
  [PLATFORMS.FACEBOOK]: [
    /^https:\/\/www\.facebook\.com\/photo\/\?fbid=/,        // /photo/?fbid=photoId
    /^https:\/\/www\.facebook\.com\/[^\/]+\/photos\//       // /username/photos/photoId
  ]
};

// Homepage patterns to exclude
const HOMEPAGE_PATTERNS = [
  /^https:\/\/www\.threads\.com\/?$/,                       // Threads homepage
  /^https:\/\/www\.threads\.com\/\?[^\/]*$/,               // Threads homepage with query params
  /^https:\/\/www\.instagram\.com\/?$/,                     // Instagram homepage
  /^https:\/\/www\.instagram\.com\/\?[^\/]*$/,             // Instagram homepage with query params
  /^https:\/\/www\.facebook\.com\/?$/,                      // Facebook homepage
  /^https:\/\/www\.facebook\.com\/\?[^\/]*$/               // Facebook homepage with query params
];

const NAVIGATION_LIMITS = {
  MAX_ATTEMPTS: 20,
  WAIT_TIME: 2000,
  INITIAL_WAIT: 1000
};

const IMAGE_FILTERS = {
  MIN_WIDTH: 150,
  MIN_HEIGHT: 150,
  CAROUSEL_MIN_WIDTH: 50,
  CAROUSEL_MIN_HEIGHT: 50
};

const SELECTORS = {
  ARTICLE: 'article',
  IMAGES_WITH_ALT: 'img[alt*="可能是"], img[alt*="Photo by"]',

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
      'button[aria-label="下一個"]',
      'button._afxw._al46._al47'
    ],
    PREV_BUTTONS: [
      'button[aria-label="Previous"]',
      'button[aria-label="上一個"]'
    ]
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
      'img[src*="facebook.com"]'
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
  } catch (error) {
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

function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve) => {
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }

    const observer = new MutationObserver((mutations) => {
      const element = document.querySelector(selector);
      if (element) {
        observer.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeout);
  });
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

const createErrorResponse = (error, message = 'Operation failed') => ({
  success: false,
  error: error.message || error,
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
    return window.location.hostname.includes('threads.com');
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

  async navigateCarousel() {
    console.log('Starting carousel navigation to load all images...');

    const urlParams = new URLSearchParams(window.location.search);
    const currentImgIndex = parseInt(urlParams.get('img_index') || '1');
    console.log(`Starting from image index: ${currentImgIndex}`);

    const allImages = new Map();
    let navigationCount = 0;
    const maxNavigations = NAVIGATION_LIMITS.MAX_ATTEMPTS;

    const collectCurrentImages = () => {
      console.log('Collecting current images...');
      const descriptiveImages = document.querySelectorAll(SELECTORS.IMAGES_WITH_ALT);
      console.log(`Found ${descriptiveImages.length} descriptive images`);

      const validImages = Array.from(descriptiveImages).filter(img => {
        const rect = img.getBoundingClientRect();
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

    await wait(NAVIGATION_LIMITS.INITIAL_WAIT);
    collectCurrentImages();

    if (currentImgIndex > 1) {
      await this._navigateToBeginning(currentImgIndex, collectCurrentImages);
    }

    let consecutiveNoNewImages = 0;

    while (navigationCount < maxNavigations) {
      const nextButton = this._findNextButton();

      if (!nextButton || nextButton.disabled) {
        console.log('No more Next button or button is disabled, stopping navigation');
        break;
      }

      console.log(`Navigation ${navigationCount + 1}: Clicking Next button`);
      nextButton.click();

      await wait(NAVIGATION_LIMITS.WAIT_TIME);

      const newImageCount = collectCurrentImages();
      navigationCount++;

      if (newImageCount === 0) {
        consecutiveNoNewImages++;
        console.log(`No new images in attempt ${navigationCount}, consecutive failures: ${consecutiveNoNewImages}`);

        if (consecutiveNoNewImages >= 3 && allImages.size > 0) {
          console.log('Multiple consecutive attempts with no new images, stopping navigation');
          break;
        }
      } else {
        consecutiveNoNewImages = 0;
      }

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

    await wait(2000);

    const article = document.querySelector(SELECTORS.ARTICLE);
    if (article) {
      article.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await wait(1000);
    }

    console.log('Checking for carousel Next button...');

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

  _findNextButton() {
    for (const selector of SELECTORS.INSTAGRAM.NEXT_BUTTONS) {
      const button = document.querySelector(selector);
      if (button) {
        console.log(`Found Next button with selector: ${selector}`);
        return button;
      }
    }

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

  async _navigateToBeginning(currentImgIndex, collectCurrentImages) {
    console.log('Not at first image, trying to navigate to beginning...');
    const prevButton = document.querySelector(SELECTORS.INSTAGRAM.PREV_BUTTONS[0]) ||
                      document.querySelector(SELECTORS.INSTAGRAM.PREV_BUTTONS[1]);

    if (prevButton) {
      for (let i = 0; i < currentImgIndex - 1; i++) {
        console.log(`Navigating to previous image (${i + 1}/${currentImgIndex - 1})`);
        prevButton.click();
        await wait(1500);
        collectCurrentImages();
      }
    }
  }

  _useStaticDetection() {
    console.log('Using static detection methods...');

    const articleImages = document.querySelectorAll('article img');
    console.log('Strategy 1 - Images in articles:', articleImages.length);

    const descriptiveImages = document.querySelectorAll(SELECTORS.IMAGES_WITH_ALT);
    console.log('Strategy 2 - Images with descriptive alt text:', descriptiveImages.length);

    const carouselImages = document.querySelectorAll('[role="tablist"] img, [role="button"] img');
    console.log('Strategy 3 - Images in carousels:', carouselImages.length);

    let mainPostImages = [];

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

    if (mainPostImages.length === 0) {
      console.log('Using fallback method - looking for any large descriptive images...');

      const allDescriptiveImages = Array.from(descriptiveImages).filter(img => {
        const rect = img.getBoundingClientRect();
        return rect.width > IMAGE_FILTERS.MIN_WIDTH &&
               rect.height > IMAGE_FILTERS.MIN_HEIGHT &&
               !img.alt.toLowerCase().includes('profile picture') &&
               !img.src.includes('profile_pic');
      });

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

// === FACEBOOK PLATFORM ===
class FacebookPlatform extends BasePlatform {
  constructor() {
    super();
    this.platformName = PLATFORMS.FACEBOOK;
  }

  isCurrentPlatform() {
    return window.location.hostname.includes('facebook.com');
  }

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

    await wait(2000);

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
      error = `Unsupported page type. This extension works on individual posts only.`;
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
      const images = await extractImages();
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
