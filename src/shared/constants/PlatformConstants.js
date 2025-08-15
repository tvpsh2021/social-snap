/**
 * @fileoverview Platform-specific constants and configuration
 */

/**
 * Supported platforms
 * @readonly
 * @enum {string}
 */
export const PLATFORMS = {
  THREADS: 'threads',
  INSTAGRAM: 'instagram',
  FACEBOOK: 'facebook'
};

/**
 * Platform hostnames
 * @readonly
 * @type {Object<string, string>}
 */
export const PLATFORM_HOSTNAMES = {
  [PLATFORMS.THREADS]: 'threads.com',
  [PLATFORMS.INSTAGRAM]: 'instagram.com',
  [PLATFORMS.FACEBOOK]: 'facebook.com'
};

/**
 * Image filtering criteria
 * @readonly
 * @type {Object}
 */
export const IMAGE_FILTERS = {
  MIN_WIDTH: 150,
  MIN_HEIGHT: 150,
  CAROUSEL_MIN_WIDTH: 50,
  CAROUSEL_MIN_HEIGHT: 50
};

/**
 * Platform capabilities
 * @readonly
 * @enum {string}
 */
export const PLATFORM_CAPABILITIES = {
  CAROUSEL_NAVIGATION: 'carousel_navigation',
  STATIC_EXTRACTION: 'static_extraction',
  DYNAMIC_LOADING: 'dynamic_loading',
  BATCH_DOWNLOAD: 'batch_download',
  PROGRESS_TRACKING: 'progress_tracking',
  ERROR_RECOVERY: 'error_recovery',
  IMAGE_FILTERING: 'image_filtering',
  METADATA_EXTRACTION: 'metadata_extraction'
};

/**
 * Default platform configurations
 */
export const PLATFORM_CONFIGS = {
  [PLATFORMS.THREADS]: {
    name: 'Threads',
    displayName: 'Threads',
    supportedUrlPatterns: ['threads.com'],
    capabilities: [
      PLATFORM_CAPABILITIES.STATIC_EXTRACTION,
      PLATFORM_CAPABILITIES.IMAGE_FILTERING,
      PLATFORM_CAPABILITIES.METADATA_EXTRACTION,
      PLATFORM_CAPABILITIES.ERROR_RECOVERY
    ],
    selectors: {
      pictureImages: 'picture img',
      descriptiveImages: 'img[alt*="可能是"]',
      pictureDescriptive: 'picture img[alt*="可能是"]',
      mainContainers: [
        'article[role="article"]:first-of-type',
        '[data-testid*="post"]:first-of-type',
        '[data-testid*="thread"]:first-of-type',
        'main > div:first-child',
        '[role="main"] > div:first-child'
      ]
    },
    extraction: {
      maxImages: 50,
      minImageWidth: 150,
      minImageHeight: 150,
      timeout: 30000,
      waitTime: 1000
    },
    filtering: {
      excludeComments: true,
      excludeProfilePictures: true,
      contentFiltering: true
    }
  },

  [PLATFORMS.INSTAGRAM]: {
    name: 'Instagram',
    displayName: 'Instagram',
    supportedUrlPatterns: ['instagram.com'],
    capabilities: [
      PLATFORM_CAPABILITIES.CAROUSEL_NAVIGATION,
      PLATFORM_CAPABILITIES.STATIC_EXTRACTION,
      PLATFORM_CAPABILITIES.DYNAMIC_LOADING,
      PLATFORM_CAPABILITIES.IMAGE_FILTERING,
      PLATFORM_CAPABILITIES.METADATA_EXTRACTION,
      PLATFORM_CAPABILITIES.ERROR_RECOVERY
    ],
    selectors: {
      article: 'article',
      nextButtons: [
        'button[aria-label="Next"]',
        'button[aria-label="下一個"]',
        'button._afxw._al46._al47'
      ],
      prevButtons: [
        'button[aria-label="Previous"]',
        'button[aria-label="上一個"]'
      ],
      carouselImages: [
        'article img[alt*="可能是"]',
        'article img[alt*="Photo by"]',
        'article img[src*="scontent"]',
        'article div[role="button"] img',
        'article ul li img'
      ]
    },
    extraction: {
      maxImages: 50,
      minImageWidth: 150,
      minImageHeight: 150,
      timeout: 30000,
      maxNavigationAttempts: 20,
      navigationWaitTime: 2000,
      initialWait: 1000,
      pageLoadWait: 2000,
      scrollWait: 1000,
      prevNavigationWait: 1500
    },
    carousel: {
      articleImageMinSize: 100,
      carouselImageMinSize: 200,
      maxFallbackImages: 10
    }
  },

  [PLATFORMS.FACEBOOK]: {
    name: 'Facebook',
    displayName: 'Facebook',
    supportedUrlPatterns: ['facebook.com'],
    capabilities: [
      PLATFORM_CAPABILITIES.CAROUSEL_NAVIGATION,
      PLATFORM_CAPABILITIES.STATIC_EXTRACTION,
      PLATFORM_CAPABILITIES.DYNAMIC_LOADING,
      PLATFORM_CAPABILITIES.IMAGE_FILTERING,
      PLATFORM_CAPABILITIES.METADATA_EXTRACTION,
      PLATFORM_CAPABILITIES.ERROR_RECOVERY
    ],
    selectors: {
      mainImage: 'main img',
      nextButtons: [
        'i[data-visualcompletion="css-img"][style*="background-image"][style*="YY7dXjkW69Q"]',
        'button[aria-label*="Next"]',
        'button[aria-label*="next"]',
        'button[aria-label*="下一張"]',
        'button[aria-label*="次へ"]',
        'button[aria-label*="次の写真"]'
      ],
      navigationButtons: [
        'button:contains("次の写真")',
        'button:contains("Next")',
        'button:contains("下一張")',
        'i[data-visualcompletion="css-img"].x1b0d499.xfdhc5e',
        'i[data-visualcompletion="css-img"][style*="background-image"]',
        'button:has(i[data-visualcompletion="css-img"])',
        'div[role="button"]:has(i[data-visualcompletion="css-img"])'
      ],
      postImages: [
        'main img',
        'div[data-pagelet*="photo"] img',
        'div[role="main"] img',
        'img[alt*="人"]',
        'img[alt*="画像のようです"]',
        'img[src*="fbcdn.net"]',
        'img[src*="facebook.com"]'
      ]
    },
    extraction: {
      maxImages: 50,
      minImageWidth: 150,
      minImageHeight: 150,
      timeout: 30000,
      maxNavigations: 500,
      navigationWaitTime: 1500,
      pageLoadWait: 2000,
      initialWait: 2000,
      minPhotoWidth: 200
    }
  }
};

/**
 * Get platform configuration by name
 * @param {string} platformName - Platform identifier
 * @returns {Object|null} Platform configuration or null if not found
 */
export function getPlatformConfig(platformName) {
  return PLATFORM_CONFIGS[platformName] || null;
}

/**
 * Get all platform configurations
 * @returns {Object} All platform configurations
 */
export function getAllPlatformConfigs() {
  return { ...PLATFORM_CONFIGS };
}

/**
 * Check if platform has specific capability
 * @param {string} platformName - Platform identifier
 * @param {string} capability - Capability to check
 * @returns {boolean} True if platform has the capability
 */
export function platformHasCapability(platformName, capability) {
  const config = PLATFORM_CONFIGS[platformName];
  return config?.capabilities?.includes(capability) || false;
}

/**
 * Get platforms with specific capability
 * @param {string} capability - Capability to search for
 * @returns {string[]} Array of platform names with the capability
 */
export function getPlatformsWithCapability(capability) {
  return Object.keys(PLATFORM_CONFIGS).filter(platformName =>
    platformHasCapability(platformName, capability)
  );
}

/**
 * Merge custom configuration with default platform configuration
 * @param {string} platformName - Platform identifier
 * @param {Object} customConfig - Custom configuration to merge
 * @returns {Object} Merged configuration
 */
export function mergePlatformConfig(platformName, customConfig) {
  const defaultConfig = PLATFORM_CONFIGS[platformName];
  if (!defaultConfig) {
    throw new Error(`Unknown platform: ${platformName}`);
  }

  return {
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
    capabilities: [
      ...new Set([
        ...(defaultConfig.capabilities || []),
        ...(customConfig.capabilities || [])
      ])
    ]
  };
}
