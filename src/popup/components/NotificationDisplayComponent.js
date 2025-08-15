/**
 * @fileoverview Notification display component for showing download notifications
 */

import { formatDuration } from '../../core/types/DownloadTypes.js';

/**
 * Notification display component for showing download notifications in the popup
 */
export class NotificationDisplayComponent {
  /**
   * @param {HTMLElement} container - Container element for notifications
   * @param {Object} [options={}] - Configuration options
   * @param {number} [options.maxNotifications=5] - Maximum notifications to show
   * @param {number} [options.autoHideDelay=5000] - Auto-hide delay in milliseconds
   * @param {boolean} [options.showTimestamp=true] - Show notification timestamps
   * @param {boolean} [options.allowDismiss=true] - Allow manual dismissal
   */
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      maxNotifications: 5,
      autoHideDelay: 5000,
      showTimestamp: true,
      allowDismiss: true,
      ...options
    };

    this.notifications = new Map();
    this.autoHideTimers = new Map();

    this.createElements();
    this.addStyles();
  }

  /**
   * Create notification container elements
   * @private
   */
  createElements() {
    this.container.innerHTML = '';
    this.container.className = 'notification-display';

    this.notificationList = document.createElement('div');
    this.notificationList.className = 'notification-list';

    this.container.appendChild(this.notificationList);
  }

  /**
   * Add CSS styles for notifications
   * @private
   */
  addStyles() {
    if (document.getElementById('notification-display-styles')) return;

    const style = document.createElement('style');
    style.id = 'notification-display-styles';
    style.textContent = `
      .notification-display {
        margin: 10px 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      .notification-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .notification-item {
        padding: 12px;
        border-radius: 8px;
        border-left: 4px solid;
        background: #f9f9f9;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        animation: slideIn 0.3s ease-out;
        position: relative;
        transition: all 0.3s ease;
      }

      .notification-item.removing {
        animation: slideOut 0.3s ease-in;
        opacity: 0;
        transform: translateX(100%);
      }

      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateX(-100%);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }

      @keyframes slideOut {
        from {
          opacity: 1;
          transform: translateX(0);
        }
        to {
          opacity: 0;
          transform: translateX(100%);
        }
      }

      .notification-item.success {
        border-left-color: #4CAF50;
        background: #f1f8e9;
      }

      .notification-item.error {
        border-left-color: #F44336;
        background: #ffebee;
      }

      .notification-item.warning {
        border-left-color: #FF9800;
        background: #fff3e0;
      }

      .notification-item.info {
        border-left-color: #2196F3;
        background: #e3f2fd;
      }

      .notification-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 4px;
      }

      .notification-title {
        font-weight: 600;
        font-size: 13px;
        color: #333;
        margin: 0;
      }

      .notification-timestamp {
        font-size: 11px;
        color: #666;
        white-space: nowrap;
        margin-left: 8px;
      }

      .notification-message {
        font-size: 12px;
        color: #555;
        line-height: 1.4;
        margin: 0;
      }

      .notification-dismiss {
        position: absolute;
        top: 8px;
        right: 8px;
        background: none;
        border: none;
        font-size: 16px;
        color: #999;
        cursor: pointer;
        padding: 0;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: all 0.2s ease;
      }

      .notification-dismiss:hover {
        background: rgba(0, 0, 0, 0.1);
        color: #666;
      }

      .notification-data {
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid rgba(0, 0, 0, 0.1);
        font-size: 11px;
        color: #777;
      }

      .notification-data-item {
        display: inline-block;
        margin-right: 12px;
      }

      .notification-data-label {
        font-weight: 500;
      }

      /* Empty state */
      .notification-display:empty::after {
        content: 'No notifications';
        display: block;
        text-align: center;
        color: #999;
        font-size: 12px;
        padding: 20px;
        font-style: italic;
      }

      /* Severity icons */
      .notification-item::before {
        content: '';
        position: absolute;
        left: 12px;
        top: 12px;
        width: 16px;
        height: 16px;
        background-size: contain;
        background-repeat: no-repeat;
      }

      .notification-item.success::before {
        content: '✓';
        color: #4CAF50;
        font-weight: bold;
        font-size: 14px;
        width: auto;
        height: auto;
      }

      .notification-item.error::before {
        content: '✗';
        color: #F44336;
        font-weight: bold;
        font-size: 14px;
        width: auto;
        height: auto;
      }

      .notification-item.warning::before {
        content: '⚠';
        color: #FF9800;
        font-weight: bold;
        font-size: 14px;
        width: auto;
        height: auto;
      }

      .notification-item.info::before {
        content: 'ℹ';
        color: #2196F3;
        font-weight: bold;
        font-size: 14px;
        width: auto;
        height: auto;
      }

      .notification-content {
        margin-left: 24px;
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * Add a notification to the display
   * @param {import('../../core/types/DownloadTypes.js').DownloadNotification} notification - Notification to add
   */
  addNotification(notification) {
    // Remove oldest notification if at max capacity
    if (this.notifications.size >= this.options.maxNotifications) {
      const oldestId = this.notifications.keys().next().value;
      this.removeNotification(oldestId);
    }

    const notificationElement = this.createNotificationElement(notification);
    this.notificationList.appendChild(notificationElement);
    this.notifications.set(notification.id, {
      notification,
      element: notificationElement
    });

    // Set up auto-hide timer
    if (this.options.autoHideDelay > 0 && notification.severity !== 'error') {
      const timer = setTimeout(() => {
        this.removeNotification(notification.id);
      }, this.options.autoHideDelay);

      this.autoHideTimers.set(notification.id, timer);
    }
  }

  /**
   * Create notification DOM element
   * @param {import('../../core/types/DownloadTypes.js').DownloadNotification} notification - Notification data
   * @returns {HTMLElement} Notification element
   * @private
   */
  createNotificationElement(notification) {
    const element = document.createElement('div');
    element.className = `notification-item ${notification.severity}`;
    element.dataset.notificationId = notification.id;

    const content = document.createElement('div');
    content.className = 'notification-content';

    // Header with title and timestamp
    const header = document.createElement('div');
    header.className = 'notification-header';

    const title = document.createElement('h4');
    title.className = 'notification-title';
    title.textContent = notification.title;

    header.appendChild(title);

    if (this.options.showTimestamp) {
      const timestamp = document.createElement('span');
      timestamp.className = 'notification-timestamp';
      timestamp.textContent = this.formatTimestamp(notification.timestamp);
      header.appendChild(timestamp);
    }

    content.appendChild(header);

    // Message
    const message = document.createElement('p');
    message.className = 'notification-message';
    message.textContent = notification.message;
    content.appendChild(message);

    // Additional data
    if (notification.data && Object.keys(notification.data).length > 0) {
      const dataSection = this.createDataSection(notification.data);
      content.appendChild(dataSection);
    }

    element.appendChild(content);

    // Dismiss button
    if (this.options.allowDismiss) {
      const dismissButton = document.createElement('button');
      dismissButton.className = 'notification-dismiss';
      dismissButton.innerHTML = '×';
      dismissButton.title = 'Dismiss notification';
      dismissButton.addEventListener('click', () => {
        this.removeNotification(notification.id);
      });

      element.appendChild(dismissButton);
    }

    return element;
  }

  /**
   * Create data section for notification
   * @param {Object} data - Notification data
   * @returns {HTMLElement} Data section element
   * @private
   */
  createDataSection(data) {
    const dataSection = document.createElement('div');
    dataSection.className = 'notification-data';

    const relevantKeys = ['platform', 'duration', 'retries', 'count', 'successful', 'failed'];

    relevantKeys.forEach(key => {
      if (data[key] !== undefined) {
        const item = document.createElement('span');
        item.className = 'notification-data-item';

        const label = document.createElement('span');
        label.className = 'notification-data-label';
        label.textContent = `${this.formatDataLabel(key)}: `;

        const value = document.createElement('span');
        value.textContent = this.formatDataValue(key, data[key]);

        item.appendChild(label);
        item.appendChild(value);
        dataSection.appendChild(item);
      }
    });

    return dataSection;
  }

  /**
   * Format data label for display
   * @param {string} key - Data key
   * @returns {string} Formatted label
   * @private
   */
  formatDataLabel(key) {
    const labels = {
      platform: 'Platform',
      duration: 'Duration',
      retries: 'Retries',
      count: 'Count',
      successful: 'Success',
      failed: 'Failed'
    };

    return labels[key] || key;
  }

  /**
   * Format data value for display
   * @param {string} key - Data key
   * @param {*} value - Data value
   * @returns {string} Formatted value
   * @private
   */
  formatDataValue(key, value) {
    switch (key) {
      case 'duration':
        return formatDuration(value);
      case 'platform':
        return value.charAt(0).toUpperCase() + value.slice(1);
      default:
        return String(value);
    }
  }

  /**
   * Format timestamp for display
   * @param {number} timestamp - Timestamp in milliseconds
   * @returns {string} Formatted timestamp
   * @private
   */
  formatTimestamp(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 60000) { // Less than 1 minute
      return 'Just now';
    } else if (diff < 3600000) { // Less than 1 hour
      const minutes = Math.floor(diff / 60000);
      return `${minutes}m ago`;
    } else {
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  }

  /**
   * Remove notification by ID
   * @param {string} notificationId - Notification ID to remove
   */
  removeNotification(notificationId) {
    const notificationData = this.notifications.get(notificationId);
    if (!notificationData) return;

    const { element } = notificationData;

    // Clear auto-hide timer
    const timer = this.autoHideTimers.get(notificationId);
    if (timer) {
      clearTimeout(timer);
      this.autoHideTimers.delete(notificationId);
    }

    // Animate removal
    element.classList.add('removing');

    setTimeout(() => {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
      this.notifications.delete(notificationId);
    }, 300);
  }

  /**
   * Clear all notifications
   */
  clearAll() {
    // Clear all timers
    this.autoHideTimers.forEach(timer => clearTimeout(timer));
    this.autoHideTimers.clear();

    // Remove all elements
    this.notifications.forEach((data, id) => {
      data.element.classList.add('removing');
      setTimeout(() => {
        if (data.element.parentNode) {
          data.element.parentNode.removeChild(data.element);
        }
      }, 300);
    });

    // Clear data
    setTimeout(() => {
      this.notifications.clear();
    }, 300);
  }

  /**
   * Clear notifications by type
   * @param {string} type - Notification type to clear
   */
  clearByType(type) {
    const toRemove = [];

    this.notifications.forEach((data, id) => {
      if (data.notification.type === type) {
        toRemove.push(id);
      }
    });

    toRemove.forEach(id => this.removeNotification(id));
  }

  /**
   * Clear notifications by severity
   * @param {string} severity - Notification severity to clear
   */
  clearBySeverity(severity) {
    const toRemove = [];

    this.notifications.forEach((data, id) => {
      if (data.notification.severity === severity) {
        toRemove.push(id);
      }
    });

    toRemove.forEach(id => this.removeNotification(id));
  }

  /**
   * Get notification count
   * @returns {number} Number of notifications
   */
  getNotificationCount() {
    return this.notifications.size;
  }

  /**
   * Get notification count by severity
   * @param {string} severity - Severity level
   * @returns {number} Number of notifications with specified severity
   */
  getNotificationCountBySeverity(severity) {
    let count = 0;
    this.notifications.forEach(data => {
      if (data.notification.severity === severity) {
        count++;
      }
    });
    return count;
  }

  /**
   * Check if notifications are visible
   * @returns {boolean} True if any notifications are visible
   */
  hasVisibleNotifications() {
    return this.notifications.size > 0;
  }

  /**
   * Update notification timestamps
   */
  updateTimestamps() {
    if (!this.options.showTimestamp) return;

    this.notifications.forEach(data => {
      const timestampElement = data.element.querySelector('.notification-timestamp');
      if (timestampElement) {
        timestampElement.textContent = this.formatTimestamp(data.notification.timestamp);
      }
    });
  }

  /**
   * Destroy the notification display component
   */
  destroy() {
    this.clearAll();
    this.container.innerHTML = '';
  }
}
