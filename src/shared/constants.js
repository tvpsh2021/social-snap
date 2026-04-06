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

const CONTENT_MESSAGES = {
  IMAGES_EXTRACTED: 'imagesExtracted',
  IMAGES_APPEND: 'imagesAppend',
  EXTRACTION_COMPLETE: 'extractionComplete',
  EXTRACTION_ERROR: 'extractionError'
};

const POPUP_MESSAGES = {
  GET_CURRENT_IMAGES: 'getCurrentImages'
};

const BACKGROUND_MESSAGES = {
  DOWNLOAD_IMAGES: 'downloadImages',
  DOWNLOAD_SINGLE_IMAGE: 'downloadSingleImage',
  FETCH_FB_VIDEO_URL: 'fetchFbVideoUrl'
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PLATFORMS, PLATFORM_HOSTNAMES, CONTENT_MESSAGES, POPUP_MESSAGES, BACKGROUND_MESSAGES };
}
