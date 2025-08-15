/**
 * @fileoverview Notification service for user feedback and progress updates
 */

import { DownloadNotification, NotificationType } from '../types/DownloadTypes.js';

/**
 * Notification service for managing user feedback and progress updates
 */
export class NotificationService {
  /**
   * @param {import('./LoggingService.js').LoggingService} logger - Logging service
   * @param {import('./ConfigurationService.js').ConfigurationService} config - Configuration service
   */
  constructor(logger, config) {
    this.logger = logger;
    this.config = config;

    // Notification storage and callbacks
    this.notifications = new Map();
    this.notificationCallbacks = new Set();
    this.progressCallbacks = new Set();

    // Configuration
    this.maxNotifications = config.get('notifications.maxStored', 50);
    this.showBrowserNotifications = config.get('notifications.showBrowser', true);
    this.notificationTimeout = config.get('notifications.timeout', 5000);

    this.logger.info('NotificationService initialized');
  }

  /**
   * Add a notification
   * @param {DownloadNotification} notification - Notification to add
   */
  addNotification(notification) {
    // Store notification
    this.notifications.set(notification.id, notification);

    // Limit stored notifications
    if (this.notifications.size > this.maxNotifications) {
      const oldestId = this.notifications.keys().next().value;
      this.notifications.delete(oldestId);
    }

    // Log notification
    this.logger.info('Notification added', {
      id: notification.id,
      type: notification.type,
      severity: notification.severity,
      title: notification.title
    });

    // Notify callbacks
    this.notifyCallbacks(notification);

    // Show browser notification if enabled
    if (this.showBrowserNotifications && this.shouldShowBrowserNotification(notification)) {
      this.showBrowserNotification(notification);
    }
  }

  /**
   * Create and add a download started notification
   * @param {string} filename - Download filename
   * @param {Object} [data={}] - Additional data
   */
  notifyDownloadStarted(filename, data = {}) {
    const notification = DownloadNotification.downloadStarted(filename, data);
    this.addNotification(notification);
  }

  /**
   * Create and add a download completed notification
   * @param {string} filename - Download filename
   * @param {Object} [data={}] - Additional data
   */
  notifyDownloadCompleted(filename, data = {}) {
    const notification = DownloadNotification.downloadCompleted(filename, data);
    this.addNotification(notification);
  }

  /**
   * Create and add a download failed notification
   * @param {string} filename - Download filename
   * @param {string} error - Error message
   * @param {Object} [data={}] - Additional data
   */
  notifyDownloadFailed(filename, error, data = {}) {
    const notification = DownloadNotification.downloadFailed(filename, error, data);
    this.addNotification(notification);
  }

  /**
   * Create and add a batch started notification
   * @param {number} count - Number of downloads in batch
   * @param {Object} [data={}] - Additional data
   */
  notifyBatchStarted(count, data = {}) {
    const notification = DownloadNotification.batchStarted(count, data);
    this.addNotification(notification);
  }

  /**
   * Create and add a batch completed notification
   * @param {number} successful - Number of successful downloads
   * @param {number} failed - Number of failed downloads
   * @param {Object} [data={}] - Additional data
   */
  notifyBatchCompleted(successful, failed, data = {}) {
    const notification = DownloadNotification.batchCompleted(successful, failed, data);
    this.addNotification(notification);
  }

  /**
   * Create and add a batch progress notification
   * @param {number} completed - Number of completed downloads
   * @param {number} total - Total number of downloads
   * @param {Object} [data={}] - Additional data
   */
  notifyBatchProgress(completed, total, data = {}) {
    // Only show progress notifications at certain intervals to avoid spam
    const percentage = Math.round((completed / total) * 100);
    if (percentage % 10 === 0 || completed === total) {
      const notification = DownloadNotification.batchProgress(completed, total, data);
      this.addNotification(notification);
    }
  }

  /**
   * Add notification callback
   * @param {Function} callback - Callback function
   */
  addNotificationCallback(callback) {
    this.notificationCallbacks.add(callback);
  }

  /**
   * Remove notification callback
   * @param {Function} callback - Callback function
   */
  removeNotificationCallback(callback) {
    this.notificationCallbacks.delete(callback);
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
   * Notify progress update
   * @param {import('../types/DownloadTypes.js').DownloadProgress} progress - Progress data
   */
  notifyProgress(progress) {
    this.progressCallbacks.forEach(callback => {
      try {
        callback(progress.toSummary());
      } catch (error) {
        this.logger.warn('Progress callback error', { error: error.message });
      }
    });
  }

  /**
   * Get all notifications
   * @param {string} [type] - Filter by notification type
   * @param {number} [limit] - Limit number of results
   * @returns {DownloadNotification[]} Array of notifications
   */
  getNotifications(type = null, limit = null) {
    let notifications = Array.from(this.notifications.values());

    // Filter by type if specified
    if (type) {
      notifications = notifications.filter(n => n.type === type);
    }

    // Sort by timestamp (newest first)
    notifications.sort((a, b) => b.timestamp - a.timestamp);

    // Apply limit if specified
    if (limit && limit > 0) {
      notifications = notifications.slice(0, limit);
    }

    return notifications;
  }

  /**
   * Get recent notifications
   * @param {number} [minutes=60] - Minutes to look back
   * @returns {DownloadNotification[]} Recent notifications
   */
  getRecentNotifications(minutes = 60) {
    const cutoffTime = Date.now() - (minutes * 60 * 1000);
    return Array.from(this.notifications.values())
      .filter(n => n.timestamp >= cutoffTime)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Clear all notifications
   */
  clearNotifications() {
    this.notifications.clear();
    this.logger.info('All notifications cleared');
  }

  /**
   * Clear notifications by type
   * @param {string} type - Notification type to clear
   */
  clearNotificationsByType(type) {
    const toDelete = [];
    for (const [id, notification] of this.notifications) {
      if (notification.type === type) {
        toDelete.push(id);
      }
    }

    toDelete.forEach(id => this.notifications.delete(id));
    this.logger.info('Notifications cleared by type', { type, count: toDelete.length });
  }

  /**
   * Remove notification by ID
   * @param {string} notificationId - Notification ID to remove
   * @returns {boolean} True if notification was removed
   */
  removeNotification(notificationId) {
    const removed = this.notifications.delete(notificationId);
    if (removed) {
      this.logger.debug('Notification removed', { id: notificationId });
    }
    return removed;
  }

  /**
   * Get notification statistics
   * @returns {Object} Notification statistics
   */
  getNotificationStats() {
    const notifications = Array.from(this.notifications.values());
    const stats = {
      total: notifications.length,
      byType: {},
      bySeverity: {},
      recent: this.getRecentNotifications(60).length
    };

    notifications.forEach(notification => {
      // Count by type
      stats.byType[notification.type] = (stats.byType[notification.type] || 0) + 1;

      // Count by severity
      stats.bySeverity[notification.severity] = (stats.bySeverity[notification.severity] || 0) + 1;
    });

    return stats;
  }

  /**
   * Notify callbacks about new notification
   * @param {DownloadNotification} notification - Notification to broadcast
   * @private
   */
  notifyCallbacks(notification) {
    this.notificationCallbacks.forEach(callback => {
      try {
        callback(notification);
      } catch (error) {
        this.logger.warn('Notification callback error', { error: error.message });
      }
    });
  }

  /**
   * Determine if browser notification should be shown
   * @param {DownloadNotification} notification - Notification to check
   * @returns {boolean} True if browser notification should be shown
   * @private
   */
  shouldShowBrowserNotification(notification) {
    // Show browser notifications for important events
    const importantTypes = [
      NotificationType.DOWNLOAD_FAILED,
      NotificationType.BATCH_COMPLETED
    ];

    return importantTypes.includes(notification.type) ||
           notification.severity === 'error' ||
           notification.severity === 'success';
  }

  /**
   * Show browser notification
   * @param {DownloadNotification} notification - Notification to show
   * @private
   */
  async showBrowserNotification(notification) {
    try {
      // Check if notifications are supported and permitted
      if (!('Notification' in window)) {
        this.logger.debug('Browser notifications not supported');
        return;
      }

      let permission = Notification.permission;

      // Request permission if not granted
      if (permission === 'default') {
        permission = await Notification.requestPermission();
      }

      if (permission !== 'granted') {
        this.logger.debug('Browser notification permission not granted');
        return;
      }

      // Create notification
      const browserNotification = new Notification(notification.title, {
        body: notification.message,
        icon: this.getNotificationIcon(notification.severity),
        tag: notification.type, // Prevents duplicate notifications
        requireInteraction: notification.severity === 'error'
      });

      // Auto-close notification after timeout
      if (this.notificationTimeout > 0) {
        setTimeout(() => {
          browserNotification.close();
        }, this.notificationTimeout);
      }

      this.logger.debug('Browser notification shown', {
        id: notification.id,
        title: notification.title
      });

    } catch (error) {
      this.logger.warn('Failed to show browser notification', {
        error: error.message,
        notificationId: notification.id
      });
    }
  }

  /**
   * Get notification icon based on severity
   * @param {string} severity - Notification severity
   * @returns {string} Icon URL
   * @private
   */
  getNotificationIcon(severity) {
    // Use extension icon or severity-specific icons
    const icons = {
      success: '/assets/icons/icon32.png',
      error: '/assets/icons/icon32.png',
      warning: '/assets/icons/icon32.png',
      info: '/assets/icons/icon32.png'
    };

    return icons[severity] || icons.info;
  }

  /**
   * Create custom notification
   * @param {string} type - Notification type
   * @param {string} title - Notification title
   * @param {string} message - Notification message
   * @param {Object} [data={}] - Additional data
   * @param {string} [severity='info'] - Notification severity
   */
  createCustomNotification(type, title, message, data = {}, severity = 'info') {
    const notification = new DownloadNotification(type, title, message, data, severity);
    this.addNotification(notification);
  }

  /**
   * Batch notify multiple events
   * @param {Array} events - Array of notification events
   */
  batchNotify(events) {
    events.forEach(event => {
      const { type, title, message, data, severity } = event;
      this.createCustomNotification(type, title, message, data, severity);
    });
  }
}
