/**
 * Shared constants for the Social Media Image Downloader extension
 */

// Supported platforms
export const PLATFORMS = {
  THREADS: 'threads',
  INSTAGRAM: 'instagram'
};

// Platform hostnames
export const PLATFORM_HOSTNAMES = {
  [PLATFORMS.THREADS]: 'threads.com',
  [PLATFORMS.INSTAGRAM]: 'instagram.com'
};

// Navigation limits
export const NAVIGATION_LIMITS = {
  MAX_ATTEMPTS: 20,
  WAIT_TIME: 2000,
  INITIAL_WAIT: 1000
};

// Image filtering criteria
export const IMAGE_FILTERS = {
  MIN_WIDTH: 150,
  MIN_HEIGHT: 150,
  CAROUSEL_MIN_WIDTH: 50,
  CAROUSEL_MIN_HEIGHT: 50
};

// File naming patterns
export const FILENAME_PATTERNS = {
  [PLATFORMS.THREADS]: 'threads_image',
  [PLATFORMS.INSTAGRAM]: 'instagram_image'
};

// CSS Selectors
export const SELECTORS = {
  // Common selectors
  ARTICLE: 'article',
  IMAGES_WITH_ALT: 'img[alt*="可能是"], img[alt*="Photo by"]',

  // Threads specific
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

  // Instagram specific
  INSTAGRAM: {
    NEXT_BUTTONS: [
      'button[aria-label="Next"]',
      'button[aria-label="下一個"]',
      'button._afxw._al46._al47'
    ],
    PREV_BUTTONS: [
      'button[aria-label="Previous"]',
      'button[aria-label="上一個"]'
    ],
    CAROUSEL_IMAGES: [
      'article img[alt*="可能是"]',
      'article img[alt*="Photo by"]',
      'article img[src*="scontent"]',
      'article div[role="button"] img',
      'article ul li img'
    ]
  }
};
