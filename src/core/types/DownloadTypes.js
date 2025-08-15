/**
 * @fileoverview Download-related type definitions and utilities
 */

/**
 * Download status enumeration
 * @readonly
 * @enum {string}
 */
export const DownloadStatus = {
  PENDING: 'pending',
  DOWNLOADING: 'downloading',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  RETRYING: 'retrying'
};

/**
 * Download notification types
 * @readonly
 * @enum {string}
 */
export const NotificationType = {
  DOWNLOAD_STARTED: 'download_started',
  DOWNLOAD_PROGRESS: 'download_progress',
  DOWNLOAD_COMPLETED: 'download_completed',
  DOWNLOAD_FAILED: 'download_failed',
  BATCH_STARTED: 'batch_started',
  BATCH_COMPLETED: 'batch_completed',
  BATCH_PROGRESS: 'batch_progress'
};

/**
 * Download progress tracking class
 */
export class DownloadProgress {
  /**
   * Create a download progress tracker
   * @param {number} [total=0] - Total number of downloads
   * @param {number} [completed=0] - Number of completed downloads
   * @param {number} [failed=0] - Number of failed downloads
   * @param {number} [inProgress=0] - Number of downloads in progress
   */
  constructor(total = 0, completed = 0, failed = 0, inProgress = 0) {
    this.total = total;
    this.completed = completed;
    this.failed = failed;
    this.inProgress = inProgress;
    this.startTime = Date.now();
    this.lastUpdateTime = Date.now();
    this.downloadDetails = new Map(); // Map of download ID to details
  }

  /**
   * Get completion percentage
   * @returns {number} Percentage (0-100)
   */
  get percentage() {
    return this.total > 0 ? Math.round((this.completed / this.total) * 100) : 0;
  }

  /**
   * Get pending downloads count
   * @returns {number} Number of pending downloads
   */
  get pending() {
    return Math.max(0, this.total - this.completed - this.failed - this.inProgress);
  }

  /**
   * Check if all downloads are complete
   * @returns {boolean} True if all downloads are finished
   */
  get isComplete() {
    return this.total > 0 && (this.completed + this.failed) >= this.total;
  }

  /**
   * Get elapsed time in milliseconds
   * @returns {number} Elapsed time since start
   */
  get elapsedTime() {
    return Date.now() - this.startTime;
  }

  /**
   * Get estimated time remaining in milliseconds
   * @returns {number} Estimated time remaining (0 if cannot estimate)
   */
  get estimatedTimeRemaining() {
    if (this.completed === 0 || this.isComplete) return 0;

    const avgTimePerDownload = this.elapsedTime / this.completed;
    const remaining = this.total - this.completed - this.failed;

    return Math.round(avgTimePerDownload * remaining);
  }

  /**
   * Get download rate (downloads per second)
   * @returns {number} Downloads per second
   */
  get downloadRate() {
    const elapsedSeconds = this.elapsedTime / 1000;
    return elapsedSeconds > 0 ? this.completed / elapsedSeconds : 0;
  }

  /**
   * Update progress counters
   * @param {Object} updates - Updates to apply
   * @param {number} [updates.total] - New total count
   * @param {number} [updates.completed] - New completed count
   * @param {number} [updates.failed] - New failed count
   * @param {number} [updates.inProgress] - New in progress count
   */
  update({ total, completed, failed, inProgress }) {
    if (typeof total === 'number') this.total = total;
    if (typeof completed === 'number') this.completed = completed;
    if (typeof failed === 'number') this.failed = failed;
    if (typeof inProgress === 'number') this.inProgress = inProgress;

    this.lastUpdateTime = Date.now();
  }

  /**
   * Add download detail
   * @param {string} downloadId - Download identifier
   * @param {DownloadDetail} detail - Download detail
   */
  addDownloadDetail(downloadId, detail) {
    this.downloadDetails.set(downloadId, {
      ...detail,
      addedAt: Date.now()
    });
  }

  /**
   * Update download detail
   * @param {string} downloadId - Download identifier
   * @param {Partial<DownloadDetail>} updates - Updates to apply
   */
  updateDownloadDetail(downloadId, updates) {
    const existing = this.downloadDetails.get(downloadId);
    if (existing) {
      this.downloadDetails.set(downloadId, {
        ...existing,
        ...updates,
        updatedAt: Date.now()
      });
    }
  }

  /**
   * Remove download detail
   * @param {string} downloadId - Download identifier
   */
  removeDownloadDetail(downloadId) {
    this.downloadDetails.delete(downloadId);
  }

  /**
   * Get download detail
   * @param {string} downloadId - Download identifier
   * @returns {DownloadDetail|undefined} Download detail
   */
  getDownloadDetail(downloadId) {
    return this.downloadDetails.get(downloadId);
  }

  /**
   * Get all download details
   * @returns {DownloadDetail[]} Array of download details
   */
  getAllDownloadDetails() {
    return Array.from(this.downloadDetails.values());
  }

  /**
   * Reset progress tracking
   */
  reset() {
    this.total = 0;
    this.completed = 0;
    this.failed = 0;
    this.inProgress = 0;
    this.startTime = Date.now();
    this.lastUpdateTime = Date.now();
    this.downloadDetails.clear();
  }

  /**
   * Create a summary object
   * @returns {Object} Progress summary
   */
  toSummary() {
    return {
      total: this.total,
      completed: this.completed,
      failed: this.failed,
      inProgress: this.inProgress,
      pending: this.pending,
      percentage: this.percentage,
      isComplete: this.isComplete,
      elapsedTime: this.elapsedTime,
      estimatedTimeRemaining: this.estimatedTimeRemaining,
      downloadRate: this.downloadRate,
      lastUpdateTime: this.lastUpdateTime
    };
  }

  /**
   * Create progress from existing data
   * @param {Object} data - Progress data
   * @returns {DownloadProgress} Progress instance
   */
  static fromData(data) {
    const progress = new DownloadProgress(
      data.total,
      data.completed,
      data.failed,
      data.inProgress
    );

    if (data.startTime) progress.startTime = data.startTime;
    if (data.lastUpdateTime) progress.lastUpdateTime = data.lastUpdateTime;

    return progress;
  }
}

/**
 * @typedef {Object} DownloadDetail
 * @property {string} id - Download identifier
 * @property {string} filename - Download filename
 * @property {string} status - Current download status
 * @property {string} [error] - Error message if failed
 * @property {number} startTime - Download start time
 * @property {number} [endTime] - Download end time
 * @property {number} [fileSize] - File size in bytes
 * @property {number} [bytesDownloaded] - Bytes downloaded so far
 * @property {number} retryCount - Number of retry attempts
 * @property {number} addedAt - When detail was added to progress
 * @property {number} [updatedAt] - When detail was last updated
 */

/**
 * Download notification class
 */
export class DownloadNotification {
  /**
   * Create a download notification
   * @param {string} type - Notification type from NotificationType
   * @param {string} title - Notification title
   * @param {string} message - Notification message
   * @param {Object} [data={}] - Additional notification data
   * @param {string} [severity='info'] - Notification severity (info, warning, error, success)
   */
  constructor(type, title, message, data = {}, severity = 'info') {
    this.type = type;
    this.title = title;
    this.message = message;
    this.data = data;
    this.severity = severity;
    this.timestamp = Date.now();
    this.id = this.generateId();
  }

  /**
   * Generate unique notification ID
   * @returns {string} Unique identifier
   * @private
   */
  generateId() {
    return `notification_${this.timestamp}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Convert to JSON representation
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      id: this.id,
      type: this.type,
      title: this.title,
      message: this.message,
      data: this.data,
      severity: this.severity,
      timestamp: this.timestamp
    };
  }

  /**
   * Create notification for download started
   * @param {string} filename - Download filename
   * @param {Object} [data={}] - Additional data
   * @returns {DownloadNotification} Notification instance
   */
  static downloadStarted(filename, data = {}) {
    return new DownloadNotification(
      NotificationType.DOWNLOAD_STARTED,
      'Download Started',
      `Started downloading ${filename}`,
      { filename, ...data },
      'info'
    );
  }

  /**
   * Create notification for download completed
   * @param {string} filename - Download filename
   * @param {Object} [data={}] - Additional data
   * @returns {DownloadNotification} Notification instance
   */
  static downloadCompleted(filename, data = {}) {
    return new DownloadNotification(
      NotificationType.DOWNLOAD_COMPLETED,
      'Download Completed',
      `Successfully downloaded ${filename}`,
      { filename, ...data },
      'success'
    );
  }

  /**
   * Create notification for download failed
   * @param {string} filename - Download filename
   * @param {string} error - Error message
   * @param {Object} [data={}] - Additional data
   * @returns {DownloadNotification} Notification instance
   */
  static downloadFailed(filename, error, data = {}) {
    return new DownloadNotification(
      NotificationType.DOWNLOAD_FAILED,
      'Download Failed',
      `Failed to download ${filename}: ${error}`,
      { filename, error, ...data },
      'error'
    );
  }

  /**
   * Create notification for batch started
   * @param {number} count - Number of downloads in batch
   * @param {Object} [data={}] - Additional data
   * @returns {DownloadNotification} Notification instance
   */
  static batchStarted(count, data = {}) {
    return new DownloadNotification(
      NotificationType.BATCH_STARTED,
      'Batch Download Started',
      `Started downloading ${count} images`,
      { count, ...data },
      'info'
    );
  }

  /**
   * Create notification for batch completed
   * @param {number} successful - Number of successful downloads
   * @param {number} failed - Number of failed downloads
   * @param {Object} [data={}] - Additional data
   * @returns {DownloadNotification} Notification instance
   */
  static batchCompleted(successful, failed, data = {}) {
    const total = successful + failed;
    const message = failed > 0
      ? `Completed ${successful}/${total} downloads (${failed} failed)`
      : `Successfully downloaded all ${successful} images`;

    return new DownloadNotification(
      NotificationType.BATCH_COMPLETED,
      'Batch Download Completed',
      message,
      { successful, failed, total, ...data },
      failed > 0 ? 'warning' : 'success'
    );
  }

  /**
   * Create notification for batch progress
   * @param {number} completed - Number of completed downloads
   * @param {number} total - Total number of downloads
   * @param {Object} [data={}] - Additional data
   * @returns {DownloadNotification} Notification instance
   */
  static batchProgress(completed, total, data = {}) {
    const percentage = Math.round((completed / total) * 100);

    return new DownloadNotification(
      NotificationType.BATCH_PROGRESS,
      'Download Progress',
      `Downloaded ${completed}/${total} images (${percentage}%)`,
      { completed, total, percentage, ...data },
      'info'
    );
  }
}

/**
 * Format time duration in human-readable format
 * @param {number} milliseconds - Duration in milliseconds
 * @returns {string} Formatted duration
 */
export function formatDuration(milliseconds) {
  if (milliseconds < 1000) return '< 1s';

  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Format file size in human-readable format
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Calculate download speed
 * @param {number} bytesDownloaded - Bytes downloaded
 * @param {number} elapsedTime - Elapsed time in milliseconds
 * @returns {string} Formatted download speed
 */
export function formatDownloadSpeed(bytesDownloaded, elapsedTime) {
  if (elapsedTime === 0) return '0 B/s';

  const bytesPerSecond = (bytesDownloaded / elapsedTime) * 1000;
  return `${formatFileSize(bytesPerSecond)}/s`;
}
