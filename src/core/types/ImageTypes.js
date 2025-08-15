/**
 * @fileoverview Image data type definitions and utilities
 */

/**
 * Image quality levels
 * @readonly
 * @enum {string}
 */
export const ImageQuality = {
  THUMBNAIL: 'thumbnail',
  MEDIUM: 'medium',
  HIGH: 'high',
  ORIGINAL: 'original'
};

/**
 * Supported image formats
 * @readonly
 * @enum {string}
 */
export const ImageFormat = {
  JPEG: 'jpeg',
  JPG: 'jpg',
  PNG: 'png',
  WEBP: 'webp',
  GIF: 'gif',
  SVG: 'svg'
};

/**
 * Image extraction status
 * @readonly
 * @enum {string}
 */
export const ExtractionStatus = {
  PENDING: 'pending',
  EXTRACTING: 'extracting',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

/**
 * Create a standardized ImageData object
 * @param {Object} params - Image data parameters
 * @param {string} params.url - Full resolution image URL
 * @param {string} [params.thumbnailUrl] - Thumbnail image URL
 * @param {string} [params.alt] - Alt text for the image
 * @param {number} [params.width] - Image width in pixels
 * @param {number} [params.height] - Image height in pixels
 * @param {string} params.platform - Platform name
 * @param {Object} [params.metadata={}] - Additional metadata
 * @returns {import('../interfaces/IPlatformExtractor.js').ImageData} Formatted image data
 */
export function createImageData({
  url,
  thumbnailUrl = null,
  alt = '',
  width = null,
  height = null,
  platform,
  metadata = {}
}) {
  return {
    id: generateImageId(url, platform),
    url,
    thumbnailUrl: thumbnailUrl || url,
    alt,
    width,
    height,
    platform,
    extractedAt: Date.now(),
    metadata: {
      ...metadata,
      format: getImageFormat(url),
      quality: getImageQuality(url, width, height)
    }
  };
}

/**
 * Generate a unique image ID
 * @param {string} url - Image URL
 * @param {string} platform - Platform name
 * @returns {string} Unique image identifier
 */
export function generateImageId(url, platform) {
  const urlHash = hashString(url);
  const timestamp = Date.now();
  return `${platform}_${urlHash}_${timestamp}`;
}

/**
 * Extract image format from URL
 * @param {string} url - Image URL
 * @returns {string} Image format
 */
export function getImageFormat(url) {
  const extension = url.split('.').pop()?.toLowerCase().split('?')[0];
  return Object.values(ImageFormat).includes(extension) ? extension : ImageFormat.JPEG;
}

/**
 * Determine image quality based on dimensions and URL
 * @param {string} url - Image URL
 * @param {number} [width] - Image width
 * @param {number} [height] - Image height
 * @returns {string} Image quality level
 */
export function getImageQuality(url, width, height) {
  // Check URL for quality indicators
  const urlLower = url.toLowerCase();
  if (urlLower.includes('thumb') || urlLower.includes('small')) {
    return ImageQuality.THUMBNAIL;
  }
  if (urlLower.includes('medium') || urlLower.includes('mid')) {
    return ImageQuality.MEDIUM;
  }
  if (urlLower.includes('large') || urlLower.includes('full') || urlLower.includes('original')) {
    return ImageQuality.ORIGINAL;
  }

  // Determine by dimensions if available
  if (width && height) {
    const pixels = width * height;
    if (pixels < 50000) return ImageQuality.THUMBNAIL; // < 50k pixels
    if (pixels < 500000) return ImageQuality.MEDIUM;   // < 500k pixels
    if (pixels < 2000000) return ImageQuality.HIGH;    // < 2M pixels
    return ImageQuality.ORIGINAL;
  }

  return ImageQuality.HIGH; // Default assumption
}

/**
 * Validate image data structure
 * @param {*} imageData - Image data to validate
 * @returns {boolean} True if image data is valid
 */
export function isValidImageData(imageData) {
  return (
    imageData &&
    typeof imageData === 'object' &&
    typeof imageData.id === 'string' &&
    typeof imageData.url === 'string' &&
    isValidUrl(imageData.url) &&
    typeof imageData.platform === 'string' &&
    typeof imageData.extractedAt === 'number'
  );
}

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @returns {boolean} True if URL is valid
 */
export function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Simple string hash function
 * @param {string} str - String to hash
 * @returns {string} Hash value
 */
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Filter images by quality
 * @param {import('../interfaces/IPlatformExtractor.js').ImageData[]} images - Images to filter
 * @param {string} minQuality - Minimum quality level
 * @returns {import('../interfaces/IPlatformExtractor.js').ImageData[]} Filtered images
 */
export function filterImagesByQuality(images, minQuality) {
  const qualityOrder = [
    ImageQuality.THUMBNAIL,
    ImageQuality.MEDIUM,
    ImageQuality.HIGH,
    ImageQuality.ORIGINAL
  ];

  const minIndex = qualityOrder.indexOf(minQuality);
  if (minIndex === -1) return images;

  return images.filter(image => {
    const imageQualityIndex = qualityOrder.indexOf(image.metadata?.quality || ImageQuality.HIGH);
    return imageQualityIndex >= minIndex;
  });
}

/**
 * Sort images by extraction time
 * @param {import('../interfaces/IPlatformExtractor.js').ImageData[]} images - Images to sort
 * @param {boolean} [ascending=false] - Sort order
 * @returns {import('../interfaces/IPlatformExtractor.js').ImageData[]} Sorted images
 */
export function sortImagesByTime(images, ascending = false) {
  return [...images].sort((a, b) => {
    return ascending ? a.extractedAt - b.extractedAt : b.extractedAt - a.extractedAt;
  });
}
