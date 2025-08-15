/**
 * @fileoverview Enhanced download manager service with improved reliability
 */

import { IDownloadManager } from '../core/interfaces/IDownloadManager.js';
import { DownloadProgress, DownloadStatus } from '../core/types/DownloadTypes.js';
import { ExtensionError, ErrorCodes } from '../core/types/ErrorTypes.js';
import { getFileExtension } from '../shared/utils/index.js';

/**
 * Download queue item
 * @typedef {Object} DownloadQueueItem
 * @property {string} id - Unique download identifier
 * @property {import('../core/interfaces/IPlatformExtractor.js').ImageData} imageData - Image data to download
 * @property {number} retryCount - Number of retry attempts
 * @property {string} status - Current status (pending, downloading, completed, failed)
 * @property {string} [filename] - Generated filename
 * @property {string} [error] - Error message if failed
 * @property {number} startTime - Download start timestamp
 * @property {number} [endTime] - Download completion timestamp
 */

/**
 * Enhanced download manager service with batch processing, retry mechanism, and progress tracking
 */
export class DownloadManagerService extends IDownloadManager {
  /**
   * @param {import('../core/services/LoggingService.js').LoggingService} logger - Logging service
   * @param {import('../core/services/ErrorHandlerService.js').ErrorHandlerService} errorHandler - Error handler service
   * @param {import('../core/services/ConfigurationService.js').ConfigurationService} config - Configuration service
   */
  constructor(logger, errorHandler, config, notificationService = null) {
    super();

    this.logger = logger;
    this.errorHandler = errorHandler;
    this.config = config;
    this.notificationService = notificationService;

    // Download queue and tracking
    this.downloadQueue = new Map();
    this.activeDownloads = new Set();
    this.completedDownloads = new Map();
    this.failedDownloads = new Map();

    // Configuration
    this.maxConcurrentDownloads = config.get('downloads.maxConcurrent', 3);
    this.maxRetryAttempts = config.get('downloads.maxRetries', 3);
    this.retryDelay = config.get('downloads.retryDelay', 1000);
    this.downloadDelay = config.get('downloads.delay', 500);

    // Progress tracking
    this.progressCallbacks = new Set();
    this.currentProgress = new DownloadProgress();

    this.logger.info('DownloadManagerService initialized', {
      maxConcurrent: this.maxConcurrentDownloads,
      maxRetries: this.maxRetryAttempts
    });
  }

  /**
   * Download a single image
   * @param {import('../core/interfaces/IPlatformExtractor.js').ImageData} image - Image data to download
   * @returns {Promise<import('../core/interfaces/IDownloadManager.js').DownloadResult>} Download result
   */
  async downloadSingle(image) {
    this.logger.info('Starting single image download', { imageId: image.id });

    try {
      const queueItem = this.createQueueItem(image);
      this.downloadQueue.set(queueItem.id, queueItem);

      // Update progress tracking
      this.updateProgress();

      // Notify download started
      if (this.notificationService) {
        this.notificationService.notifyDownloadStarted(queueItem.filename, {
          imageId: image.id,
          platform: image.platform
        });
      }

      const result = await this.processDownload(queueItem);
      this.updateProgress();

      return result;
    } catch (error) {
      const downloadError = new ExtensionError(
        `Failed to download image: ${error.message}`,
        ErrorCodes.DOWNLOAD_FAILED,
        { imageId: image.id, originalError: error }
      );

      await this.errorHandler.handleError(downloadError);
      throw downloadError;
    }
  }

  /**
   * Download multiple images in batch
   * @param {import('../core/interfaces/IPlatformExtractor.js').ImageData[]} images - Array of image data to download
   * @returns {Promise<import('../core/interfaces/IDownloadManager.js').DownloadResult[]>} Array of download results
   */
  async downloadBatch(images) {
    this.logger.info('Starting batch download', { count: images.length });

    if (!Array.isArray(images) || images.length === 0) {
      throw new ExtensionError(
        'Invalid images array provided for batch download',
        ErrorCodes.VALIDATION_ERROR
      );
    }

    try {
      // Notify batch started
      if (this.notificationService) {
        this.notificationService.notifyBatchStarted(images.length);
      }

      // Create queue items for all images
      const queueItems = images.map(image => {
        const queueItem = this.createQueueItem(image);
        this.downloadQueue.set(queueItem.id, queueItem);
        return queueItem;
      });

      // Update progress tracking
      this.updateProgress();

      // Process downloads with concurrency control
      const results = await this.processBatchDownloads(queueItems);
      this.updateProgress();

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      this.logger.info('Batch download completed', {
        total: results.length,
        successful,
        failed
      });

      // Notify batch completed
      if (this.notificationService) {
        this.notificationService.notifyBatchCompleted(successful, failed);
      }

      return results;
    } catch (error) {
      const downloadError = new ExtensionError(
        `Batch download failed: ${error.message}`,
        ErrorCodes.DOWNLOAD_FAILED,
        { imageCount: images.length, originalError: error }
      );

      await this.errorHandler.handleError(downloadError);
      throw downloadError;
    }
  }

  /**
   * Get current download progress
   * @returns {import('../core/interfaces/IDownloadManager.js').DownloadProgress} Current download progress information
   */
  getDownloadProgress() {
    return this.currentProgress.toSummary();
  }

  /**
   * Cancel all pending downloads
   * @returns {Promise<void>}
   */
  async cancelAllDownloads() {
    this.logger.info('Cancelling all downloads');

    // Cancel pending downloads
    for (const [id, queueItem] of this.downloadQueue) {
      if (queueItem.status === 'pending') {
        queueItem.status = 'cancelled';
        this.failedDownloads.set(id, {
          ...queueItem,
          error: 'Download cancelled by user'
        });
      }
    }

    // Clear the queue
    this.downloadQueue.clear();
    this.updateProgress();
  }

  /**
   * Retry failed downloads
   * @returns {Promise<import('../core/interfaces/IDownloadManager.js').DownloadResult[]>} Results of retry attempts
   */
  async retryFailedDownloads() {
    this.logger.info('Retrying failed downloads', { count: this.failedDownloads.size });

    const failedItems = Array.from(this.failedDownloads.values());
    this.failedDownloads.clear();

    // Reset retry count and add back to queue
    const retryItems = failedItems.map(item => ({
      ...item,
      retryCount: 0,
      status: 'pending',
      error: undefined
    }));

    retryItems.forEach(item => {
      this.downloadQueue.set(item.id, item);
    });

    return await this.processBatchDownloads(retryItems);
  }

  /**
   * Add progress callback
   * @param {Function} callback - Progress callback function
   */
  addProgressCallback(callback) {
    this.progressCallbacks.add(callback);
  }

  /**
   * Remove progress callback
   * @param {Function} callback - Progress callback function
   */
  removeProgressCallback(callback) {
    this.progressCallbacks.delete(callback);
  }

  /**
   * Create a download queue item
   * @param {import('../core/interfaces/IPlatformExtractor.js').ImageData} imageData - Image data
   * @returns {DownloadQueueItem} Queue item
   * @private
   */
  createQueueItem(imageData) {
    const id = `download_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const filename = this.generateFilename(imageData);

    return {
      id,
      imageData,
      retryCount: 0,
      status: 'pending',
      filename,
      startTime: Date.now()
    };
  }

  /**
   * Process batch downloads with concurrency control
   * @param {DownloadQueueItem[]} queueItems - Queue items to process
   * @returns {Promise<import('../core/interfaces/IDownloadManager.js').DownloadResult[]>} Download results
   * @private
   */
  async processBatchDownloads(queueItems) {
    const results = [];
    const processing = [];

    for (const queueItem of queueItems) {
      // Wait if we've reached max concurrent downloads
      if (processing.length >= this.maxConcurrentDownloads) {
        const completed = await Promise.race(processing);
        results.push(completed);
        processing.splice(processing.indexOf(completed), 1);
      }

      // Start download
      const downloadPromise = this.processDownload(queueItem);
      processing.push(downloadPromise);

      // Add delay between starting downloads
      if (this.downloadDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, this.downloadDelay));
      }
    }

    // Wait for remaining downloads to complete
    const remainingResults = await Promise.all(processing);
    results.push(...remainingResults);

    return results;
  }

  /**
   * Process a single download with retry logic
   * @param {DownloadQueueItem} queueItem - Queue item to process
   * @returns {Promise<import('../core/interfaces/IDownloadManager.js').DownloadResult>} Download result
   * @private
   */
  async processDownload(queueItem) {
    const { id, imageData, filename } = queueItem;

    while (queueItem.retryCount <= this.maxRetryAttempts) {
      try {
        queueItem.status = 'downloading';
        this.activeDownloads.add(id);
        this.notifyProgressUpdate();

        this.logger.debug('Starting download attempt', {
          downloadId: id,
          attempt: queueItem.retryCount + 1,
          filename
        });

        // Perform the actual download
        const downloadId = await chrome.downloads.download({
          url: imageData.url,
          filename,
          conflictAction: 'uniquify'
        });

        // Wait for download completion
        await this.waitForDownloadCompletion(downloadId);

        // Success
        queueItem.status = 'completed';
        queueItem.endTime = Date.now();

        this.activeDownloads.delete(id);
        this.downloadQueue.delete(id);
        this.completedDownloads.set(id, queueItem);

        const result = {
          id,
          success: true,
          filename,
          timestamp: queueItem.endTime
        };

        this.logger.info('Download completed successfully', {
          downloadId: id,
          filename,
          duration: queueItem.endTime - queueItem.startTime
        });

        // Notify download completed
        if (this.notificationService) {
          this.notificationService.notifyDownloadCompleted(filename, {
            downloadId: id,
            duration: queueItem.endTime - queueItem.startTime,
            platform: imageData.platform
          });
        }

        this.updateProgress();
        return result;

      } catch (error) {
        queueItem.retryCount++;
        this.activeDownloads.delete(id);

        this.logger.warn('Download attempt failed', {
          downloadId: id,
          attempt: queueItem.retryCount,
          error: error.message
        });

        if (queueItem.retryCount <= this.maxRetryAttempts) {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * queueItem.retryCount));
        } else {
          // Max retries exceeded
          queueItem.status = 'failed';
          queueItem.error = error.message;
          queueItem.endTime = Date.now();

          this.downloadQueue.delete(id);
          this.failedDownloads.set(id, queueItem);

          const result = {
            id,
            success: false,
            filename,
            error: error.message,
            timestamp: queueItem.endTime
          };

          this.logger.error('Download failed after max retries', {
            downloadId: id,
            filename,
            retries: queueItem.retryCount - 1,
            error: error.message
          });

          // Notify download failed
          if (this.notificationService) {
            this.notificationService.notifyDownloadFailed(filename, error.message, {
              downloadId: id,
              retries: queueItem.retryCount - 1,
              platform: imageData.platform
            });
          }

          this.updateProgress();
          return result;
        }
      }
    }
  }

  /**
   * Wait for Chrome download to complete
   * @param {number} downloadId - Chrome download ID
   * @returns {Promise<void>}
   * @private
   */
  async waitForDownloadCompletion(downloadId) {
    return new Promise((resolve, reject) => {
      const checkDownload = () => {
        chrome.downloads.search({ id: downloadId }, (downloads) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          if (downloads.length === 0) {
            reject(new Error('Download not found'));
            return;
          }

          const download = downloads[0];

          if (download.state === 'complete') {
            resolve();
          } else if (download.state === 'interrupted') {
            reject(new Error(`Download interrupted: ${download.error || 'Unknown error'}`));
          } else {
            // Still in progress, check again
            setTimeout(checkDownload, 100);
          }
        });
      };

      checkDownload();
    });
  }

  /**
   * Generate filename for download
   * @param {import('../core/interfaces/IPlatformExtractor.js').ImageData} imageData - Image data
   * @returns {string} Generated filename
   * @private
   */
  generateFilename(imageData) {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
    const extension = getFileExtension(imageData.url);
    const platform = imageData.platform || 'unknown';
    const imageId = imageData.id.split('_').pop() || Math.random().toString(36).substring(2, 7);

    return `${platform}_image_${timestamp}_${imageId}.${extension}`;
  }

  /**
   * Update progress tracking
   * @private
   */
  updateProgress() {
    const total = this.downloadQueue.size + this.completedDownloads.size + this.failedDownloads.size;
    const completed = this.completedDownloads.size;
    const failed = this.failedDownloads.size;
    const inProgress = this.activeDownloads.size;

    this.currentProgress.update({
      total,
      completed,
      failed,
      inProgress
    });

    this.notifyProgressUpdate();

    // Notify progress to notification service
    if (this.notificationService) {
      this.notificationService.notifyProgress(this.currentProgress);
    }
  }

  /**
   * Notify progress callbacks
   * @private
   */
  notifyProgressUpdate() {
    const progress = this.getDownloadProgress();
    this.progressCallbacks.forEach(callback => {
      try {
        callback(progress);
      } catch (error) {
        this.logger.warn('Progress callback error', { error: error.message });
      }
    });
  }

  /**
   * Get download statistics
   * @returns {Object} Download statistics
   */
  getDownloadStats() {
    const progress = this.getDownloadProgress();
    const avgDownloadTime = this.calculateAverageDownloadTime();

    return {
      ...progress,
      avgDownloadTime,
      queueSize: this.downloadQueue.size,
      activeDownloads: this.activeDownloads.size
    };
  }

  /**
   * Calculate average download time
   * @returns {number} Average download time in milliseconds
   * @private
   */
  calculateAverageDownloadTime() {
    const completed = Array.from(this.completedDownloads.values());
    if (completed.length === 0) return 0;

    const totalTime = completed.reduce((sum, item) => {
      return sum + (item.endTime - item.startTime);
    }, 0);

    return Math.round(totalTime / completed.length);
  }

  /**
   * Store extracted images for later download
   * @param {import('../core/interfaces/IPlatformExtractor.js').ImageData[]} images - Array of extracted images
   * @returns {Promise<void>}
   */
  async storeImages(images) {
    if (!Array.isArray(images)) {
      throw new ExtensionError(
        'Invalid images array provided',
        ErrorCodes.VALIDATION_ERROR,
        { images }
      );
    }

    this.logger.info('Storing extracted images', { count: images.length });

    // Store images in a temporary storage for later download
    if (!this.storedImages) {
      this.storedImages = [];
    }

    this.storedImages = images;

    // Notify that images are available
    if (this.notificationService) {
      this.notificationService.notifyImagesExtracted(images.length);
    }
  }

  /**
   * Get stored images
   * @returns {import('../core/interfaces/IPlatformExtractor.js').ImageData[]} Array of stored images
   */
  getStoredImages() {
    return this.storedImages || [];
  }

  /**
   * Download all stored images
   * @param {import('../core/interfaces/IPlatformExtractor.js').ImageData[]} [images] - Optional images array, uses stored images if not provided
   * @returns {Promise<import('../core/interfaces/IDownloadManager.js').DownloadResult[]>} Download results
   */
  async downloadAllImages(images = null) {
    const imagesToDownload = images || this.getStoredImages();

    if (!imagesToDownload || imagesToDownload.length === 0) {
      throw new ExtensionError(
        'No images available for download',
        ErrorCodes.VALIDATION_ERROR
      );
    }

    return await this.downloadBatch(imagesToDownload);
  }

  /**
   * Download a single image by index
   * @param {import('../core/interfaces/IPlatformExtractor.js').ImageData} image - Image data to download
   * @param {number} [index] - Optional index for tracking purposes
   * @returns {Promise<import('../core/interfaces/IDownloadManager.js').DownloadResult>} Download result
   */
  async downloadSingleImage(image, index = null) {
    if (!image) {
      throw new ExtensionError(
        'No image data provided for download',
        ErrorCodes.VALIDATION_ERROR
      );
    }

    this.logger.info('Downloading single image', {
      imageId: image.id,
      index,
      platform: image.platform
    });

    return await this.downloadSingle(image);
  }

  /**
   * Cancel all downloads
   * @returns {Promise<void>}
   */
  async cancelDownloads() {
    await this.cancelAllDownloads();
  }

  /**
   * Initialize the download manager service
   * @returns {Promise<void>}
   */
  async initialize() {
    this.logger.info('Initializing DownloadManagerService');

    // Initialize stored images array
    this.storedImages = [];

    // Set up Chrome downloads event listeners
    if (chrome.downloads && chrome.downloads.onChanged) {
      chrome.downloads.onChanged.addListener(this._handleDownloadChanged.bind(this));
    }

    this.logger.info('DownloadManagerService initialized successfully');
  }

  /**
   * Cleanup the download manager service
   * @returns {Promise<void>}
   */
  async cleanup() {
    try {
      this.logger.info('Cleaning up DownloadManagerService');

      // Cancel any pending downloads
      await this.cancelAllDownloads();

      // Clear callbacks
      this.progressCallbacks.clear();

      // Clear stored data
      this.storedImages = [];
      this.downloadQueue.clear();
      this.activeDownloads.clear();
      this.completedDownloads.clear();
      this.failedDownloads.clear();

      // Remove Chrome downloads listeners
      if (chrome.downloads && chrome.downloads.onChanged) {
        chrome.downloads.onChanged.removeListener(this._handleDownloadChanged.bind(this));
      }

      this.logger.info('DownloadManagerService cleanup completed');

    } catch (error) {
      this.logger.error('Error during DownloadManagerService cleanup', { error });
    }
  }

  /**
   * Handle Chrome downloads API changes
   * @private
   * @param {chrome.downloads.DownloadDelta} downloadDelta - Download change information
   * @returns {void}
   */
  _handleDownloadChanged(downloadDelta) {
    // This can be used to track download progress from Chrome's perspective
    // and sync with our internal tracking if needed
    this.logger.debug('Chrome download changed', { downloadDelta });
  }

  /**
   * Clear all download history
   */
  clearHistory() {
    this.completedDownloads.clear();
    this.failedDownloads.clear();
    this.currentProgress.reset();
    this.updateProgress();
    this.logger.info('Download history cleared');
  }
}
