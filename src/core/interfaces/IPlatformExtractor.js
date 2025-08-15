/**
 * @fileoverview Interface definition for platform-specific image extractors
 */

/**
 * @typedef {Object} ImageData
 * @property {string} id - Unique identifier for the image
 * @property {string} url - Full resolution image URL
 * @property {string} thumbnailUrl - Thumbnail image URL
 * @property {string} alt - Alt text for the image
 * @property {number} width - Image width in pixels
 * @property {number} height - Image height in pixels
 * @property {string} platform - Platform name (threads, instagram, facebook)
 * @property {number} extractedAt - Timestamp when image was extracted
 * @property {Object} metadata - Additional platform-specific metadata
 */

/**
 * Interface for platform-specific image extractors
 * @interface IPlatformExtractor
 */
class IPlatformExtractor {
  /**
   * Platform name identifier
   * @type {string}
   */
  get platformName() {
    throw new Error('platformName getter must be implemented by subclass');
  }

  /**
   * Check if the current URL is supported by this platform extractor
   * @param {string} url - The URL to check
   * @returns {boolean} True if the platform supports this URL
   */
  isSupported(url) {
    throw new Error('isSupported method must be implemented by subclass');
  }

  /**
   * Extract images from the current page
   * @returns {Promise<ImageData[]>} Array of extracted image data
   * @throws {Error} When extraction fails
   */
  async extractImages() {
    throw new Error('extractImages method must be implemented by subclass');
  }

  /**
   * Validate that the current page is ready for image extraction
   * @returns {Promise<boolean>} True if page is valid for extraction
   */
  async validatePage() {
    throw new Error('validatePage method must be implemented by subclass');
  }
}

export { IPlatformExtractor };
