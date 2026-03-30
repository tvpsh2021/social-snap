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
    /^https:\/\/www\.facebook\.com\/[^/]+\/photos\//,       // /username/photos/photoId
    /^https:\/\/www\.facebook\.com\/reel\/\d+/,             // /reel/reelId
    /^https:\/\/www\.facebook\.com\/\d+\/videos\/pcb\.\d+\/\d+/  // /userId/videos/pcb.xxx/videoId
  ],
  [PLATFORMS.X]: [
    /^https:\/\/x\.com\/[^/]+\/status\/[^/]+\/photo\/\d+/,  // /username/status/statusId/photo/number
    /^https:\/\/x\.com\/[^/]+\/status\/[^/]+\/video\/\d+/,  // /username/status/statusId/video/number
    /^https:\/\/x\.com\/[^/]+\/status\/\d+\/?(?:\?.*)?$/    // plain tweet URL (video-only tweets)
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
    MAX_ATTEMPTS: 1000,
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
    IMAGES: 'img',
    PICTURE_IMAGES: 'picture img',
    VIDEOS: 'video'
  },

  INSTAGRAM: {
    NEXT_BUTTONS: [
      'button[tabindex="-1"]',
    ],
    POST_IMAGES: 'img',
    MAIN_ELEMENT: 'main',
    CAROUSEL_INDICATOR: 'ul li',
    UL_ELEMENT: 'ul',
    BOUNDARY_ELEMENTS: 'div, h2, span'
  },

  FACEBOOK: {
    NEXT_BUTTONS: [
      'div[data-visualcompletion="ignore-dynamic"]:nth-of-type(2) .html-div',
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
    CAROUSEL_VIDEOS: 'li[role="listitem"] video',
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

// === X.COM VIDEO CACHE ===
// Populated by x-fetch-interceptor.js (MAIN world) via CustomEvents on document.
const X_VIDEO_CACHE = new Map(); // videoId -> { fullSizeUrl, thumbnailUrl }

if (window.location.hostname.includes('x.com')) {
  document.addEventListener('__socialSnapXVideo', (e) => {
    const { videoId, fullSizeUrl, thumbnailUrl, isHLS } = e.detail;
    if (videoId) X_VIDEO_CACHE.set(videoId, { fullSizeUrl, thumbnailUrl, isHLS: isHLS || false });
  });

  document.addEventListener('__socialSnapXVideoCache', (e) => {
    Object.entries(e.detail).forEach(([id, data]) => X_VIDEO_CACHE.set(id, data));
  });
}


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
    const match = pathname.match(/\.(jpg|jpeg|png|gif|webp|mp4)$/i);
    if (match) {
      return match[1].toLowerCase();
    }

    const searchParams = urlObj.searchParams;
    if (searchParams.has('format')) {
      return searchParams.get('format');
    }

    if (url.includes('mp4')) return 'mp4';
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
  IMAGES_APPEND: 'imagesAppend',
  EXTRACTION_COMPLETE: 'extractionComplete',
  EXTRACTION_ERROR: 'extractionError'
};

let stopFbExtractionRequested = false;
let fbCarouselActive = false;

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
    } else if (src.includes('twimg.com')) {
      // Twitter/X CDN uses 'name' param to control size (thumb, small, medium, large, 4096x4096)
      thumbnailUrl = src.replace(/([?&]name=)[^&]+/, '$1small');
      if (maxWidth === 0) {
        maxSizeUrl = src.replace(/([?&]name=)[^&]+/, '$14096x4096');
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

  _findTargetContainer() {
    const allContainers = document.querySelectorAll(SELECTORS.THREADS.CONTAINER);
    if (allContainers.length === 0) return null;

    // Extract post ID from current URL (e.g. /@username/post/ABC123 or /t/ABC123)
    const pathname = window.location.pathname;
    const postIdMatch = pathname.match(/\/@[^/]+\/post\/([^/]+)/) || pathname.match(/\/t\/([^/]+)/);
    const postId = postIdMatch?.[1];

    if (postId) {
      const matched = Array.from(allContainers).find(container =>
        container.querySelector(`a[href*="/${postId}"]`)
      );
      if (matched) {
        log(`Found target container by post ID: ${postId}`);
        return matched;
      }
      log(`No container matched post ID "${postId}", falling back to first`);
    }

    return allContainers[0];
  }

  extractImages() {
    log('=== Starting Threads image extraction ===');

    const firstContainer = this._findTargetContainer();
    log('Target container found:', firstContainer);

    if (!firstContainer) {
      log(`No container with ${SELECTORS.THREADS.CONTAINER} found`);
      return [];
    }

    const allImgs = firstContainer.querySelectorAll(SELECTORS.THREADS.IMAGES);
    const pictureImgs = firstContainer.querySelectorAll(SELECTORS.THREADS.PICTURE_IMAGES);
    const videos = firstContainer.querySelectorAll(SELECTORS.THREADS.VIDEOS);

    log(`Found ${allImgs.length} total imgs (${pictureImgs.length} in <picture>), ${videos.length} videos`);

    const mediaData = [];

    // Carousel images: inside <picture> elements (no profile picture here)
    if (pictureImgs.length > 0) {
      pictureImgs.forEach((img, index) => {
        mediaData.push({ ...this.createImageData(img, index), mediaType: 'image' });
      });
    } else if (videos.length === 0) {
      // Plain image post (no <picture> wrapper, no video): skip profile picture
      Array.from(allImgs).slice(1).forEach((img, index) => {
        mediaData.push({ ...this.createImageData(img, index), mediaType: 'image' });
      });
    }

    // Videos: cover images are imgs NOT inside <picture>, skip first (profile picture)
    if (videos.length > 0) {
      const coverImgs = Array.from(allImgs)
        .filter(img => !img.closest('picture'))
        .slice(1);

      videos.forEach((video, index) => {
        if (!video.src) {
          log(`Video ${index + 1} has no src, skipping`);
          return;
        }

        const thumbnailUrl = coverImgs[index] ? coverImgs[index].src : '';
        log(`Video ${index + 1}:`, {
          src: video.src.substring(0, 80),
          thumbnailUrl: thumbnailUrl.substring(0, 80)
        });

        mediaData.push({
          index: mediaData.length + 1,
          alt: 'Video',
          thumbnailUrl,
          fullSizeUrl: video.src,
          maxWidth: 0,
          mediaType: 'video'
        });
      });
    }

    log('Extracted media information:', mediaData);
    return mediaData;
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

    const isCarousel = !!mainElement.querySelector(SELECTORS.INSTAGRAM.CAROUSEL_INDICATOR);

    if (isCarousel) {
      log('Carousel post detected (<ul> found).');
      const postMedia = await this._navigateCarousel(mainElement);

      const mediaData = [];
      postMedia.forEach((item, index) => {
        if (!item) return;
        if (item.mediaType === 'video') {
          mediaData.push({
            index: index + 1,
            alt: 'Video',
            thumbnailUrl: item.thumbnailUrl || '',
            fullSizeUrl: item.src,
            maxWidth: 0,
            mediaType: 'video'
          });
        } else if (item.src) {
          mediaData.push(this.createImageData(item, index));
        }
      });

      log('Extracted Instagram carousel media information:', mediaData);
      return mediaData;
    }

    log('Single media post detected (no <ul> found).');

    const singleVideo = mainElement.querySelector('video');
    if (singleVideo) {
      log('Single video post detected.');
      const videoUrl = await this._extractSingleVideoUrl(singleVideo);
      if (videoUrl) {
        const thumbnailUrl = singleVideo.closest('[data-instancekey]')?.querySelector('img[referrerpolicy]')?.src || '';
        return [{
          index: 1,
          alt: 'Video',
          thumbnailUrl,
          fullSizeUrl: videoUrl,
          maxWidth: 0,
          mediaType: 'video'
        }];
      }
      log('Could not extract video URL from single video post.');
      return [];
    }

    let mainPostImages = this._extractSingleImage(mainElement);

    log('filter before:', mainPostImages.length);
    log(mainPostImages);

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
    const mediaMap = new Map();
    const collectedVideoUrls = new Set();
    const collectedVideoAssetIds = new Set();
    const processedVideoBlobUrls = new Set();
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

    const getVideoMeta = (url) => {
      try {
        const efg = new URL(url).searchParams.get('efg');
        if (!efg) return null;
        // efg uses URL-safe base64 (- and _ instead of + and /)
        const standardBase64 = efg.replace(/-/g, '+').replace(/_/g, '/');
        const decoded = JSON.parse(atob(standardBase64));
        return {
          assetId: decoded.xpv_asset_id ? String(decoded.xpv_asset_id) : null,
          isCarouselItem: typeof decoded.vencodeTag === 'string' && decoded.vencodeTag.includes('carousel_item')
        };
      } catch {
        return null;
      }
    };

    const getNewVideoUrl = () => {
      const entries = performance.getEntriesByType('resource');
      for (const entry of entries) {
        if (!entry.name.includes('.mp4')) continue;
        const isCdnUrl = entry.name.includes('fbcdn.net') || entry.name.includes('cdninstagram.com');
        if (!isCdnUrl) continue;
        const cleanUrl = this._cleanVideoUrl(entry.name);
        if (collectedVideoUrls.has(cleanUrl)) continue;
        const meta = getVideoMeta(entry.name);
        if (meta?.assetId && collectedVideoAssetIds.has(meta.assetId)) continue;
        return cleanUrl;
      }
      return null;
    };

    const collectCurrentlyVisibleMedia = async () => {
      const ul = container.querySelector(SELECTORS.INSTAGRAM.UL_ELEMENT);
      if (!ul) return;

      const listItems = Array.from(ul.children).filter(li => li instanceof HTMLLIElement);
      log('listItems: ', listItems);

      if (listItems.length === 0) return;

      const zeroPxLi = listItems.find(li => getTranslateXFromString(li) === 0);

      const insertMediaFromLi = async (_visibleLi) => {
        const video = _visibleLi.querySelector('video');
        if (video) {
          if (video.src && processedVideoBlobUrls.has(video.src)) {
            log('Video element already processed, skipping');
            return;
          }
          if (video.src) processedVideoBlobUrls.add(video.src);

          let videoUrl = getNewVideoUrl();
          if (!videoUrl) {
            log('Video detected but no URL found, triggering load and retrying...');
            try {
              const playPromise = video.play();
              if (playPromise) playPromise.catch(() => {});
            } catch {
              // ignore autoplay restrictions
            }
            await wait(800);
            videoUrl = getNewVideoUrl();
          }

          if (videoUrl) {
            collectedVideoUrls.add(videoUrl);
            const meta = getVideoMeta(videoUrl);
            if (meta?.assetId) collectedVideoAssetIds.add(meta.assetId);
            if (!mediaMap.has(videoUrl)) {
              const thumbnailImg = _visibleLi.querySelector('img[referrerpolicy]');
              const thumbnailUrl = thumbnailImg?.src || '';
              log(`Found new video via performance API. Total: ${mediaMap.size + 1}`);
              mediaMap.set(videoUrl, { mediaType: 'video', src: videoUrl, thumbnailUrl });
            }
          } else {
            log('Video detected but no new video URL found in performance entries');
          }
          return;
        }

        const img = _visibleLi.querySelector(SELECTORS.INSTAGRAM.POST_IMAGES);
        if (img && img.src) {
          if (!mediaMap.has(img.src)) {
            log(`Found new image. Total: ${mediaMap.size + 1}`);
            mediaMap.set(img.src, img);
          }
        }
      };

      if (listItems.length >= 3) {
        // Standard carousel: 3+ items in DOM (previous, current, next sliding window)
        if (zeroPxLi) {
          log('Rule matched: Found li with translateX(0px) and li>=3');
          await insertMediaFromLi(listItems[1]);
        }
        await insertMediaFromLi(listItems[2]);
      } else if (zeroPxLi) {
        // Single-image post wrapped in ul/li, or carousel with fewer than 3 items loaded
        log(`Processing zeroPxLi directly (listItems.length=${listItems.length})`);
        await insertMediaFromLi(zeroPxLi);
      }
    };

    while (navigationCount < CAROUSEL.INSTAGRAM.MAX_ATTEMPTS) {
      log('navigationCount: ', navigationCount);
      await collectCurrentlyVisibleMedia();

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

    log(`Carousel navigation complete. Found ${mediaMap.size} unique media items.`);

    return Array.from(mediaMap.values());
  }

  _findVideoUrlInPerformance() {
    const entries = performance.getEntriesByType('resource');
    for (const entry of entries) {
      if (!entry.name.includes('.mp4')) continue;
      const isCdnUrl = entry.name.includes('fbcdn.net') || entry.name.includes('cdninstagram.com');
      if (!isCdnUrl) continue;
      return this._cleanVideoUrl(entry.name);
    }
    return null;
  }

  async _extractSingleVideoUrl(videoElement) {
    let videoUrl = this._findVideoUrlInPerformance();
    if (!videoUrl) {
      log('Single video: no URL found, triggering load and retrying...');
      try {
        const playPromise = videoElement.play();
        if (playPromise) playPromise.catch(() => {});
      } catch {
        // ignore autoplay restrictions
      }
      await wait(800);
      videoUrl = this._findVideoUrlInPerformance();
    }
    return videoUrl;
  }

  _cleanVideoUrl(url) {
    try {
      const urlObj = new URL(url);
      urlObj.searchParams.delete('bytestart');
      urlObj.searchParams.delete('byteend');
      return urlObj.toString();
    } catch {
      return url;
    }
  }

  _findNextButton(container) {
    const selectors = container.querySelectorAll(SELECTORS.INSTAGRAM.NEXT_BUTTONS);

    return Array.from(selectors).find(button => {
      const computedStyle = window.getComputedStyle(button);
      if (computedStyle.right === '0px') {
        return true;
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
    stopFbExtractionRequested = false;
    fbCarouselActive = true;
    log('Starting Facebook media navigation...');

    const collectedMedia = []; // { mediaType, fullSizeUrl, thumbnailUrl, alt, maxWidth, videoId? }
    const collectedImageIds = new Set(); // for image dedup
    const collectedVideoIds = new Set(); // for video dedup
    let navigationCount = 0;
    const maxNavigations = CAROUSEL.FACEBOOK.MAX_ATTEMPTS;

    const sendIncremental = () => {
      chrome.runtime.sendMessage({
        action: CONTENT_MESSAGES.IMAGES_APPEND,
        images: [collectedMedia[collectedMedia.length - 1]]
      });
    };

    const extractFbImageId = (url) => {
      const match = url.match(/\/(\d+)_\d+/);
      return match ? match[1] : null;
    };

    const tryCollectImage = () => {
      log('Taking Facebook image snapshot...');
      const possibleSelectors = SELECTORS.FACEBOOK.POST_IMAGES;
      let foundImage = null;

      for (const selector of possibleSelectors) {
        const images = document.querySelectorAll(selector);
        for (const img of images) {
          const rect = img.getBoundingClientRect();
          if (rect.width > 200 && rect.height > IMAGE_FILTERS.MIN_HEIGHT &&
              !img.src.includes('profile') && !img.src.includes('icon') && !img.src.includes('static')) {
            foundImage = img;
            break;
          }
        }
        if (foundImage) break;
      }

      if (!foundImage) {
        log('No suitable main image found');
        return 'none';
      }

      const fbId = extractFbImageId(foundImage.src);
      const isDuplicate = collectedImageIds.has(foundImage.src)
        || collectedImageIds.has(foundImage.currentSrc)
        || (fbId && collectedImageIds.has(fbId));

      if (isDuplicate) {
        log('Duplicate image detected');
        return 'duplicate';
      }

      collectedImageIds.add(foundImage.src);
      if (foundImage.currentSrc) collectedImageIds.add(foundImage.currentSrc);
      if (fbId) collectedImageIds.add(fbId);

      collectedMedia.push(this.createImageData(foundImage, collectedMedia.length));
      log(`✓ Collected image ${collectedMedia.length}: ${foundImage.src.substring(0, 60)}`);
      return 'new';
    };

    const tryCollectVideo = async () => {
      const videoId = this._extractVideoIdFromUrl();
      if (!videoId) return 'none';
      if (collectedVideoIds.has(videoId)) {
        log('Duplicate video detected');
        return 'duplicate';
      }

      log(`Video page detected, videoId: ${videoId}`);

      // Trigger video playback so the browser fetches the MP4 segments.
      // Facebook carousel videos don't autoplay; clicking the play button
      // or calling video.play() starts the MSE download.
      const video = document.querySelector('video');
      if (video) {
        try {
          const playPromise = video.play();
          if (playPromise) playPromise.catch(() => {});
        } catch {
          // Autoplay blocked; try clicking the play button
        }
      }
      // Also try clicking the play button overlay
      const playButton = document.querySelector('[aria-label*="再生"], [aria-label*="Play"]');
      if (playButton) {
        log('Clicking play button to trigger video load');
        playButton.click();
      }

      try {
        const videoUrl = await this._fetchVideoUrlFromBackground(videoId);
        collectedVideoIds.add(videoId);
        collectedMedia.push({
          index: collectedMedia.length + 1,
          alt: 'Video',
          thumbnailUrl: '',
          fullSizeUrl: videoUrl,
          maxWidth: 0,
          mediaType: 'video'
        });
        log(`✓ Collected video ${collectedMedia.length}: videoId=${videoId}`);
        return 'new';
      } catch (error) {
        logError(`Failed to fetch video URL for ${videoId}:`, error);
        return 'none';
      }
    };

    try {
      // Collect initial media
      log('Collecting initial Facebook media...');
      if (this._isFbVideoPage()) {
        const r = await tryCollectVideo();
        if (r === 'new') sendIncremental();
      } else {
        const r = tryCollectImage();
        if (r === 'new') sendIncremental();
      }

      // Navigate through the album
      while (!stopFbExtractionRequested && navigationCount < maxNavigations) {
        const nextButton = this._findNavigationButton();
        if (!nextButton) {
          log('No navigation button found, stopping');
          break;
        }

        log(`Navigation attempt ${navigationCount + 1}: Clicking Next button`);
        try {
          nextButton.click();
        } catch {
          const parentButton = nextButton.closest('button');
          if (parentButton) parentButton.click();
        }

        await wait(CAROUSEL.FACEBOOK.WAIT_TIME);

        let result;
        if (this._isFbVideoPage()) {
          result = await tryCollectVideo();
        } else {
          result = tryCollectImage();
        }

        if (result === 'new') sendIncremental();

        if (result === 'duplicate') {
          log('Found duplicate media, album navigation complete');
          break;
        }

        navigationCount++;
      }

      if (stopFbExtractionRequested) {
        log('Extraction stopped by user');
      }
    } finally {
      log(`Facebook navigation completed. Total media collected: ${collectedMedia.length}`);
      chrome.runtime.sendMessage({ action: CONTENT_MESSAGES.EXTRACTION_COMPLETE });
    }

    return collectedMedia;
  }

  _isFbVideoPage() {
    return /\/videos\/pcb\.\d+\/\d+/.test(window.location.pathname);
  }

  _extractVideoIdFromUrl() {
    const match = window.location.pathname.match(/\/videos\/pcb\.\d+\/(\d+)/);
    return match ? match[1] : null;
  }

  async _fetchVideoUrlFromBackground(videoId) {
    const query = () => new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { action: 'fetchFbVideoUrl', videoId },
        (response) => {
          if (chrome.runtime.lastError || !response?.success) {
            resolve(null);
          } else {
            resolve(response.videoUrl);
          }
        }
      );
    });

    // The video MP4 request may not have been made yet. Retry up to 5 times.
    for (let attempt = 0; attempt < 5; attempt++) {
      const url = await query();
      if (url) return url;
      log(`Video URL not yet available for ${videoId}, waiting... (attempt ${attempt + 1}/5)`);
      await wait(1000);
    }
    throw new Error(`No video URL collected for videoId ${videoId}`);
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

    const isReelPage = window.location.pathname.includes('/reel/');
    if (isReelPage) {
      log('Facebook Reel page detected');
      return this._extractReelVideo();
    }

    const isVideoPage = this._isFbVideoPage();
    if (isVideoPage) {
      log('Facebook video page detected (carousel video direct navigation)');
      const videoId = this._extractVideoIdFromUrl();
      if (videoId) {
        try {
          const videoUrl = await this._fetchVideoUrlFromBackground(videoId);
          return [{
            index: 1,
            alt: 'Video',
            thumbnailUrl: '',
            fullSizeUrl: videoUrl,
            maxWidth: 0,
            mediaType: 'video'
          }];
        } catch (error) {
          logError('Failed to fetch video URL:', error);
          return [];
        }
      }
    }

    const isPhotoPage = window.location.pathname.includes('/photo') ||
                       window.location.search.includes('fbid=');

    if (!isPhotoPage) {
      log('Not a Facebook photo/reel/video page, no media to extract');
      return [];
    }

    log('Facebook photo page detected');

    // Check if this is a multi-image album by looking for navigation buttons
    const navigationButton = this._findNavigationButton();
    log('Navigation button found:', !!navigationButton);

    if (navigationButton) {
      log('Album with navigation detected, using carousel navigation...');
      try {
        // navigateCarousel() returns media data objects directly
        const carouselMedia = await this.navigateCarousel();
        if (carouselMedia.length > 0) {
          log(`Carousel navigation completed, found ${carouselMedia.length} media items`);
          return carouselMedia;
        }
      } catch (error) {
        logError('Carousel navigation failed, falling back to static detection:', error);
      }
    }

    // Fallback: static single image detection
    log('Using static image detection...');
    let mainPostImages = [];

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

    log(`Final selected Facebook post image count: ${mainPostImages.length}`);

    const imageData = [];
    mainPostImages.forEach((img, index) => {
      imageData.push(this.createImageData(img, index));
    });

    log('Extracted Facebook image information:', imageData);
    return imageData;
  }

  async _extractReelVideo() {
    log('Extracting video from Facebook Reel...');

    const video = document.querySelector('div[data-pagelet="Reels"] video')
      || document.querySelector('video[playsinline]');
    const poster = video ? (video.getAttribute('poster') || '') : '';

    const videoUrl = this._extractVideoUrlFromDashManifest();
    if (videoUrl) {
      log(`✓ Found Reel video URL from DASH manifest: ${videoUrl.substring(0, 80)}`);
      return [{
        index: 1,
        alt: 'Video',
        thumbnailUrl: poster,
        fullSizeUrl: videoUrl,
        maxWidth: 0,
        mediaType: 'video'
      }];
    }

    log('Could not find video URL in DASH manifest');
    return [];
  }

  _extractVideoUrlFromDashManifest() {
    const scripts = document.querySelectorAll('script');
    for (const script of scripts) {
      const text = script.textContent || '';
      const idx = text.indexOf('dash_manifests');
      if (idx === -1) continue;

      const prefix = 'manifest_xml":"';
      const xmlStart = text.indexOf(prefix, idx);
      if (xmlStart === -1) continue;

      const valueStart = xmlStart + prefix.length;

      // Find the end of the JSON string value (unescaped quote)
      let i = valueStart;
      while (i < text.length) {
        if (text[i] === '\\') { i += 2; continue; }
        if (text[i] === '"') break;
        i++;
      }

      let raw = text.substring(valueStart, i);
      raw = raw
        .replace(/\\u003C/g, '<')
        .replace(/\\u003E/g, '>')
        .replace(/\\\//g, '/')
        .replace(/\\"/g, '"')
        .replace(/\\n/g, '\n')
        .replace(/\\u00253D/g, '%3D');

      // Extract video BaseURLs using regex (XML parsing fails on unescaped & in URLs)
      const videoSetMatch = raw.match(/<AdaptationSet[^>]*contentType="video"[^>]*>([\s\S]*?)<\/AdaptationSet>/);
      if (!videoSetMatch) continue;

      const videoSet = videoSetMatch[1];
      const repRegex = /<Representation[^>]*bandwidth="(\d+)"[^>]*>[\s\S]*?<BaseURL>([^<]+)<\/BaseURL>/g;
      let best = null;
      let match;
      while ((match = repRegex.exec(videoSet)) !== null) {
        const bandwidth = parseInt(match[1]);
        const url = match[2].replace(/&amp;/g, '&');
        if (!best || bandwidth > best.bandwidth) {
          best = { bandwidth, url };
        }
      }

      if (best) {
        log(`DASH manifest: found ${videoSet.match(/<Representation/g)?.length || 0} representations, picked bandwidth=${best.bandwidth}`);
        return best.url;
      }
    }
    return null;
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

    // Request any video URLs already intercepted by x-fetch-interceptor.js (MAIN world).
    // dispatchEvent is synchronous, so X_VIDEO_CACHE will be populated before we proceed.
    document.dispatchEvent(new CustomEvent('__socialSnapRequestVideos'));

    await wait(CAROUSEL.X.INITIAL_WAIT);

    // Check if we're in media carousel mode (URL contains /photo/ or /video/)
    const isPhotoMode = window.location.pathname.includes('/photo/')
      || window.location.pathname.includes('/video/');
    log('Media carousel mode detected:', isPhotoMode);

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
      if (!isPhotoMode) {
        log('No photo dialog found on tweet page, trying direct video extraction...');
        return this._extractVideoFromTweetPage();
      }
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

      // If no images found, check for a GIF/video inside the dialog
      if (mainPostImages.length === 0) {
        log('No single image found, checking for GIF/video in dialog...');
        const video = mainDialog.querySelector('video');
        if (video) {
          const videoSrc = video.getAttribute('src') || '';
          const poster = video.getAttribute('poster') || '';
          if (videoSrc.includes('tweet_video/')) {
            log(`✓ Found GIF in dialog: ${videoSrc}`);
            mainPostImages = [{
              _type: 'video',
              thumbnailUrl: poster,
              fullSizeUrl: videoSrc,
              isHLS: false,
              videoId: 'gif',
              videoElement: video
            }];
          }
        }
      }
    }

    log(`Final selected X.com post image count: ${mainPostImages.length}`);

    // Apply boundary filter to exclude images after the boundary element
    const boundaryElement = this._findBoundaryElement();
    if (boundaryElement && mainPostImages.length > 0) {
      log('Found boundary element, applying boundary filter...');
      const beforeFilterCount = mainPostImages.length;

      mainPostImages = mainPostImages.filter(item => {
        // For video data objects, use the stored videoElement for position comparison
        const el = item?._type === 'video' ? item.videoElement : item;
        if (!el || !el.isConnected) return false;
        const position = boundaryElement.compareDocumentPosition(el);
        const isBeforeBoundary = position & Node.DOCUMENT_POSITION_PRECEDING;

        if (!isBeforeBoundary) {
          const label = item?._type === 'video' ? 'video' : item.src?.substring(0, 50) + '...';
          log('Filtered out item after boundary:', label);
        }

        return isBeforeBoundary;
      });

      log(`Boundary filter applied: ${beforeFilterCount} -> ${mainPostImages.length} images`);
    } else {
      log('No boundary element found or no images to filter');
    }

    const imageData = [];
    mainPostImages.forEach((item, index) => {
      if (item && item._type === 'video') {
        imageData.push({
          index: index + 1,
          alt: 'Video',
          thumbnailUrl: item.thumbnailUrl,
          fullSizeUrl: item.fullSizeUrl,
          isHLS: item.isHLS || false,
          maxWidth: 0,
          mediaType: 'video'
        });
      } else if (item && item.src) {
        imageData.push(this.createImageData(item, index));
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

    const imageMap = new Map(); // src -> img element
    const videoMap = new Map(); // poster URL -> { _type, thumbnailUrl, fullSizeUrl, videoId, videoElement }
    let navigationCount = 0;

    const collectCurrentlyVisibleMedia = () => {
      log(`\n--- Collecting media (attempt ${navigationCount + 1}) ---`);
      let newItemsFound = 0;

      // Collect images
      for (const selector of SELECTORS.X.CAROUSEL_IMAGES) {
        const carouselImages = container.querySelectorAll(selector);
        log(`Trying carousel selector "${selector}": found ${carouselImages.length} images`);

        if (carouselImages.length > 0) {
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

              // Skip imgs inside a <li> that also has a <video> — those are video thumbnails
              const isInsideVideoLi = !!img.closest('li[role="listitem"]')?.querySelector('video');
              if (isVisible && isValidImage && !imageMap.has(img.src) && !isInsideVideoLi) {
                log(`✓ Found NEW image ${imageMap.size + 1}: ${img.src}`);
                imageMap.set(img.src, img);
                newItemsFound++;
              }
            }
          });
          break; // Stop after finding images with first working selector
        }
      }

      // Collect videos
      const allVideoEls = container.querySelectorAll('li[role="listitem"] video');
      log(`Total <video> elements in carousel li items: ${allVideoEls.length}`);
      allVideoEls.forEach((v, i) => {
        log(`  video[${i}] aria-label="${v.getAttribute('aria-label')}" poster="${v.getAttribute('poster')?.substring(0, 80)}"`);
      });

      const videoEls = container.querySelectorAll(SELECTORS.X.CAROUSEL_VIDEOS);
      videoEls.forEach(video => {
        const poster = video.getAttribute('poster');
        // Deduplicate by poster URL or video element reference
        const alreadyCollected = (poster && videoMap.has(poster))
          || Array.from(videoMap.values()).some(v => v.videoElement === video);
        if (alreadyCollected) return;

        const rect = video.getBoundingClientRect();
        const isVisible = rect.width > IMAGE_FILTERS.CAROUSEL_MIN_WIDTH && rect.height > IMAGE_FILTERS.CAROUSEL_MIN_HEIGHT;
        if (!isVisible) return;

        // Support amplify_video_thumb and ext_tw_video_thumb
        const idMatch = (poster || '').match(/(?:amplify_video_thumb|ext_tw_video_thumb|tweet_video_thumb)\/([^/]+)\//);
        const videoId = idMatch ? idMatch[1] : null;
        const intercepted = videoId ? X_VIDEO_CACHE.get(videoId) : null;

        log(`Video found: videoId=${videoId}, intercepted=${!!intercepted}, poster=${poster}`);

        // GIF detection: direct src containing tweet_video
        const videoSrc = video.getAttribute('src') || '';
        const isGif = videoSrc.includes('tweet_video/');
        if (isGif) {
          videoMap.set(poster || videoSrc || String(videoMap.size), {
            _type: 'video',
            thumbnailUrl: poster || '',
            fullSizeUrl: videoSrc,
            isHLS: false,
            videoId: videoId || 'gif',
            videoElement: video
          });
          newItemsFound++;
          log(`✓ Found NEW GIF ${videoMap.size}: ${videoSrc}`);
        } else if (intercepted) {
          videoMap.set(poster || video.src || String(videoMap.size), {
            _type: 'video',
            thumbnailUrl: poster || '',
            fullSizeUrl: intercepted.fullSizeUrl,
            isHLS: intercepted.isHLS || false,
            videoId,
            videoElement: video
          });
          newItemsFound++;
          log(`✓ Found NEW video ${videoMap.size}: videoId=${videoId} isHLS=${intercepted.isHLS}`);
        } else {
          // Fallback: poster uses /media/ path without video ID. Match by thumbnail URL.
          const thumbMatch = !videoId && poster ? this._findCachedVideoByThumbnail(poster) : null;
          if (thumbMatch) {
            videoMap.set(poster, {
              _type: 'video',
              thumbnailUrl: poster,
              fullSizeUrl: thumbMatch.fullSizeUrl,
              isHLS: thumbMatch.isHLS || false,
              videoId: thumbMatch.videoId,
              videoElement: video
            });
            newItemsFound++;
            log(`✓ Found NEW video via thumbnail match ${videoMap.size}: videoId=${thumbMatch.videoId}`);
          } else {
            // Fallback: scan performance entries for a video.twimg.com URL matching this videoId
            const perfFallback = videoId ? this._findXVideoUrlFromPerformance(videoId) : null;
            if (perfFallback) {
              videoMap.set(poster || String(videoMap.size), {
                _type: 'video',
                thumbnailUrl: poster || '',
                fullSizeUrl: perfFallback.fullSizeUrl,
                isHLS: perfFallback.isHLS,
                videoId,
                videoElement: video
              });
              newItemsFound++;
              log(`✓ Found NEW video via performance fallback ${videoMap.size}: videoId=${videoId}`);
            } else {
              // Last resort: mark with the tweet URL so yt-dlp can handle it
              const tweetUrl = this._getTweetUrl();
              log(`Video ${videoId} not found in cache or performance entries, using tweet URL fallback: ${tweetUrl}`);
              videoMap.set(poster || String(videoMap.size), {
                _type: 'video',
                thumbnailUrl: poster || '',
                fullSizeUrl: tweetUrl,
                isHLS: true,
                videoId: videoId || 'unknown',
                videoElement: video
              });
              newItemsFound++;
            }
          }
        }
      });

      log(`Collection result: ${newItemsFound} new items (${imageMap.size} images, ${videoMap.size} videos)`);
      return newItemsFound;
    };

    // Collect initial media (X.com initially loads first 2 <li>)
    log('Collecting initial media (first 2 <li> elements)...');
    collectCurrentlyVisibleMedia();

    // Navigate through carousel to load remaining slides
    while (navigationCount < CAROUSEL.X.MAX_ATTEMPTS) {
      const nextButton = this._findNextButton(container);
      if (!nextButton) {
        log('Navigation finished: No "Next" button found.');
        break;
      }

      log(`\n=== Navigation ${navigationCount + 1}/${CAROUSEL.X.MAX_ATTEMPTS} ===`);
      log('Clicking Next slide button...');

      nextButton.click();
      navigationCount++;

      await wait(CAROUSEL.X.WAIT_TIME);

      const newItems = collectCurrentlyVisibleMedia();

      if (newItems === 0 && navigationCount >= 2) {
        log('No new media found in last navigation, checking if we\'ve reached the end...');

        const confirmButton = this._findNextButton(container);
        if (!confirmButton) {
          log('Confirmed: No more Next button, ending navigation');
          break;
        }

        if (navigationCount >= 3) {
          log('No new media after 3 attempts, stopping navigation');
          break;
        }
      }
    }

    log('\n=== X.com Carousel Navigation Complete ===');
    log(`Total navigation attempts: ${navigationCount}`);
    log(`Total unique images: ${imageMap.size}, videos: ${videoMap.size}`);

    // Reconstruct ordered list by iterating <li> elements in DOM order
    const allListItems = container.querySelectorAll('li[role="listitem"]');
    const orderedMedia = [];

    allListItems.forEach(li => {
      // Check for video FIRST — a <li> with a <video> is always a video item.
      // Checking images first would incorrectly match the poster <img> inside the video <li>.
      const video = li.querySelector('video');
      if (video) {
        const poster = video.getAttribute('poster');
        const videoData = (poster ? videoMap.get(poster) : null)
          || Array.from(videoMap.values()).find(v => v.videoElement === video)
          || null;
        if (videoData) {
          orderedMedia.push(videoData);
        }
        return;
      }

      // Check for image (only if no video in this <li>)
      const img = Array.from(li.querySelectorAll('img')).find(i => imageMap.has(i.src));
      if (img) {
        orderedMedia.push(img);
      }
    });

    orderedMedia.forEach((item, index) => {
      const label = item._type === 'video'
        ? `video (${item.videoId})`
        : `image: ${item.src.substring(0, 60)}...`;
      log(`Final item ${index + 1}: ${label}`);
    });

    return orderedMedia;
  }

  _findCachedVideoByThumbnail(posterUrl) {
    if (!posterUrl) return null;
    for (const [id, data] of X_VIDEO_CACHE) {
      if (data.thumbnailUrl === posterUrl) {
        return { videoId: id, ...data };
      }
    }
    return null;
  }

  _findXVideoUrlFromPerformance(videoId) {
    const entries = performance.getEntriesByType('resource');
    const related = entries.filter(e =>
      e.name.includes('video.twimg.com') && e.name.includes(`/${videoId}/`)
    );

    if (related.length === 0) return null;

    const m3u8s = related.filter(e => e.name.includes('.m3u8'));
    // Prefer video-track m3u8 over audio-only
    const videoM3u8s = m3u8s.filter(e => !e.name.includes('/mp4a/') && !e.name.includes('/aud/'));
    const best = videoM3u8s[0] || m3u8s[0];
    if (best) return { fullSizeUrl: best.name, isHLS: true };

    return null;
  }

  _getTweetUrl() {
    return window.location.origin + window.location.pathname.replace(/\/photo\/\d+$/, '');
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

  _extractVideoFromTweetPage() {
    log('Extracting video from tweet page (non-photo-mode)...');

    const articles = document.querySelectorAll('article[data-testid="tweet"]');
    for (const article of articles) {
      const video = article.querySelector('video[poster]');
      if (!video) continue;

      const poster = video.getAttribute('poster');
      const idMatch = (poster || '').match(/(?:amplify_video_thumb|ext_tw_video_thumb|tweet_video_thumb)\/([^/]+)\//);
      const videoId = idMatch ? idMatch[1] : null;

      log(`Tweet page video found: videoId=${videoId}, poster=${poster?.substring(0, 80)}`);

      // GIF detection: video elements with direct src containing tweet_video are GIFs
      const videoSrc = video.getAttribute('src') || '';
      const isGif = videoSrc.includes('tweet_video/');
      if (isGif) {
        log(`✓ Detected GIF with direct MP4 src: ${videoSrc}`);
        return [{
          index: 1,
          alt: 'GIF',
          thumbnailUrl: poster || '',
          fullSizeUrl: videoSrc,
          isHLS: false,
          maxWidth: 0,
          mediaType: 'video'
        }];
      }

      const intercepted = videoId ? X_VIDEO_CACHE.get(videoId) : null;
      if (intercepted) {
        log(`✓ Got video URL from cache: isHLS=${intercepted.isHLS}`);
        return [{
          index: 1,
          alt: 'Video',
          thumbnailUrl: poster || '',
          fullSizeUrl: intercepted.fullSizeUrl,
          isHLS: intercepted.isHLS || false,
          maxWidth: 0,
          mediaType: 'video'
        }];
      }

      // Fallback: poster uses /media/ path without video ID. Match by thumbnail URL.
      if (!videoId && poster) {
        const thumbMatch = this._findCachedVideoByThumbnail(poster);
        if (thumbMatch) {
          log(`✓ Got video URL from cache via thumbnail match: videoId=${thumbMatch.videoId}, isHLS=${thumbMatch.isHLS}`);
          return [{
            index: 1,
            alt: 'Video',
            thumbnailUrl: poster,
            fullSizeUrl: thumbMatch.fullSizeUrl,
            isHLS: thumbMatch.isHLS || false,
            maxWidth: 0,
            mediaType: 'video'
          }];
        }
      }

      const perfFallback = videoId ? this._findXVideoUrlFromPerformance(videoId) : null;
      if (perfFallback) {
        log('Got video URL from performance entries');
        return [{
          index: 1,
          alt: 'Video',
          thumbnailUrl: poster || '',
          fullSizeUrl: perfFallback.fullSizeUrl,
          isHLS: true,
          maxWidth: 0,
          mediaType: 'video'
        }];
      }

      const tweetUrl = this._getTweetUrl();
      log(`Video URL not found, using tweet URL fallback: ${tweetUrl}`);
      return [{
        index: 1,
        alt: 'Video',
        thumbnailUrl: poster || '',
        fullSizeUrl: tweetUrl,
        isHLS: true,
        maxWidth: 0,
        mediaType: 'video'
      }];
    }

    log('No video found in tweet articles');
    return [];
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

// === STOP SIGNAL LISTENER ===
chrome.runtime.onMessage.addListener((request) => {
  if (request.action === 'stopExtraction') {
    stopFbExtractionRequested = true;
  }
});

// === AUTO EXTRACTION ===
window.addEventListener('load', () => {
  setTimeout(async () => {
    fbCarouselActive = false;
    const isFacebook = window.location.hostname.includes(PLATFORM_HOSTNAMES[PLATFORMS.FACEBOOK]);
    try {
      log('=== Social Media Image Downloader Auto-Extraction ===');
      log('Current URL:', window.location.href);
      log('Platform detection starting...');

      const images = await extractImages();
      log('Auto-extraction completed successfully:', images);

      // For Facebook carousel, navigateCarousel() already sent incremental messages + EXTRACTION_COMPLETE.
      // For other Facebook paths (reel, direct video, static image), send IMAGES_EXTRACTED normally.
      if (!(isFacebook && fbCarouselActive)) {
        chrome.runtime.sendMessage({
          action: CONTENT_MESSAGES.IMAGES_EXTRACTED,
          images,
          count: images.length
        });
      }
    } catch (error) {
      logError('Auto-extraction error:', error);
      // For Facebook carousel errors, EXTRACTION_COMPLETE was already sent in navigateCarousel()'s finally block.
      // Sending EXTRACTION_ERROR would wipe partial data from storage, so skip it.
      if (!(isFacebook && fbCarouselActive)) {
        chrome.runtime.sendMessage({
          action: CONTENT_MESSAGES.EXTRACTION_ERROR,
          error: error.message,
          count: 0
        });
      }
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

    // Check if we're in a media carousel mode (/photo/ or /video/)
    const isMediaMode = window.location.pathname.includes('/photo/')
      || window.location.pathname.includes('/video/');
    if (!isMediaMode) {
      return;
    }

    // Check if any mutation added a photo/video dialog
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
