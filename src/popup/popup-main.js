/**
 * Main popup script for Social Media Image Downloader
 */

import { StatusDisplay } from './components/status-display.js';
import { ImageGrid } from './components/image-grid.js';
import { POPUP_MESSAGES, BACKGROUND_MESSAGES } from '../shared/message-types.js';
import { PLATFORM_HOSTNAMES } from '../shared/constants.js';

class PopupController {
  constructor() {
    this.statusDisplay = new StatusDisplay();
    this.imageGrid = new ImageGrid();

    this._initializeEventListeners();
    this.init();
  }

  /**
   * Initialize the popup
   */
  async init() {
    try {
      this.statusDisplay.showLoading();

      // First try to get stored image information from background script
      const response = await chrome.runtime.sendMessage({ action: 'getCurrentImages' });

      if (response && response.images && response.images.length > 0) {
        this._displayImages(response.images);
      } else {
        // If no stored image information, try to extract from current page
        await this._extractImagesFromCurrentTab();
      }
    } catch (err) {
      console.error('Initialization failed:', err);
      this.statusDisplay.showError();
    }
  }

  /**
   * Extract images from current tab
   */
  async _extractImagesFromCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      // Check if current page is supported
      const supportedPlatforms = Object.values(PLATFORM_HOSTNAMES);
      const isSupported = supportedPlatforms.some(platform => tab.url.includes(platform));

      if (!isSupported) {
        this.statusDisplay.showError(`Unsupported platform. This extension works on: ${supportedPlatforms.join(', ')}`);
        return;
      }

      // Send message to content script
      const response = await chrome.tabs.sendMessage(tab.id, { action: POPUP_MESSAGES.EXTRACT_IMAGES });

      if (response && response.success && response.images && response.images.length > 0) {
        this._displayImages(response.images);
      } else if (response && response.error) {
        this.statusDisplay.showError(`Extraction failed: ${response.error}`);
      } else {
        this.statusDisplay.showError();
      }
    } catch (err) {
      console.error('Image extraction failed:', err);
      this.statusDisplay.showError();
    }
  }

  /**
   * Display images in the popup
   * @param {Array} images - Array of image data objects
   */
  _displayImages(images) {
    // Update status display
    this.statusDisplay.showContent();
    this.statusDisplay.updateImageCount(images.length);

    // Display images in grid
    this.imageGrid.displayImages(images);
  }

  /**
   * Initialize event listeners
   */
  _initializeEventListeners() {
    // Listen for download success events
    document.addEventListener('downloadSuccess', () => {
      this.statusDisplay.showSuccess();
    });
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});
