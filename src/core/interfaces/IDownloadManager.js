/**
 * @fileoverview Interface definition for download management functionality
 */

/**
 * @typedef {Object} DownloadResult
 * @property {string} id - Download identifier
 * @property {boolean} success - Whether download was successful
 * @property {string} filename - Downloaded filename
 * @property {string} [error] - Error message if download failed
 * @property {number} timestamp - Download completion timestamp
 */

/**
 * @typedef {Object} DownloadProgress
 * @property {number} total - Total number of downloads
 * @property {number} completed - Number of completed downloads
 * @property {number} failed - Number of failed downloads
 * @property {number} inProgress - Number of downloads in progress
 * @property {number} percentage - Overall completion percentage (0-100)
 */

/**
 * Interface for download management operations
 * @interface IDownloadManager
 */
class IDownloadManager {
  /**
   * Download a single image
   * @param {import('./IPlatformExtractor.js').ImageData} image - Image data to download
   * @returns {Promise<DownloadResult>} Download result
   */
  async downloadSingle(image) {
    throw new Error('downloadSingle method must be implemented by subclass');
  }

  /**
   * Download multiple images in batch
   * @param {import('./IPlatformExtractor.js').ImageData[]} images - Array of image data to download
   * @returns {Promise<DownloadResult[]>} Array of download results
   */
  async downloadBatch(images) {
    throw new Error('downloadBatch method must be implemented by subclass');
  }

  /**
   * Get current download progress
   * @returns {DownloadProgress} Current download progress information
   */
  getDownloadProgress() {
    throw new Error('getDownloadProgress method must be implemented by subclass');
  }

  /**
   * Cancel all pending downloads
   * @returns {Promise<void>}
   */
  async cancelAllDownloads() {
    throw new Error('cancelAllDownloads method must be implemented by subclass');
  }

  /**
   * Retry failed downloads
   * @returns {Promise<DownloadResult[]>} Results of retry attempts
   */
  async retryFailedDownloads() {
    throw new Error('retryFailedDownloads method must be implemented by subclass');
  }
}

export { IDownloadManager };
