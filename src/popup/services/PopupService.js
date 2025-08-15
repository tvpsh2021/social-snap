/**
 * @fileoverview Popup service for handling business logic and state management
 */

import { POPUP_MESSAGES, BACKGROUND_MESSAGES } from '../../shared/message-types.js';
import { PLATFORM_HOSTNAMES } from '../../shared/constants/PlatformConstants.js';

/**
 * Service class for managing popup business logic and state
 */
export class PopupService {
  /**
   * @param {Object} [options={}] - Configuration options
   * @param {Function} [options.onStateChange] - Callback for state changes
   * @param {Function} [options.onImagesLoaded] - Callback when images are loaded
   * @param {Function} [options.onDownloadProgress] - Callback for download progress
   * @param {Function} [options.onError] - Callback for errors
   */
  constructor(options = {}) {
    this.options = {
      onStateChange: null,
      onImagesLoaded: null,
      onDownloadProgress: null,
      onError: null,
      ...options
    };

    this.state = {
      currentState: 'initializing',
      images: [],
      currentTab: null,
      downloadProgress: null,
      error: null
    };

    this.messageListeners = new Map();
    this.isInitialized = false;
  }

  /**
   * Initialize the popup service
   */
  async initialize() {
    if (this.isInitialized) {
      console.warn('PopupService already initialized');
      return;
    }

    try {
      console.log('[PopupService] Starting initialization...');
      this.setState('loading');
      this.setupMessageListeners();

      console.log('[PopupService] Getting current tab...');
      // Get current tab information
      await this.getCurrentTab();
      console.log('[PopupService] Current tab:', this.state.currentTab?.url);

      console.log('[PopupService] Getting stored images...');
      // Try to get stored images first
      const storedImages = await this.getStoredImages();
      console.log('[PopupService] Stored images:', storedImages?.length || 0);

      if (storedImages && storedImages.length > 0) {
        console.log('[PopupService] Using stored images');
        this.setImages(storedImages);
        this.setState('content');
      } else {
        console.log('[PopupService] Extracting images from current tab...');
        // Extract images from current tab
        await this.extractImagesFromCurrentTab();
      }

      this.isInitialized = true;
      console.log('[PopupService] Initialization completed');
    } catch (error) {
      console.error('PopupService initialization failed:', error);
      this.handleError(error, 'Failed to initialize popup');
    }
  }

  /**
   * Setup message listeners for background communication
   * @private
   */
  setupMessageListeners() {
    // Listen for download progress updates
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleBackgroundMessage(message, sender, sendResponse);
    });
  }

  /**
   * Handle messages from background script
   * @param {Object} message - Message object
   * @param {Object} sender - Message sender
   * @param {Function} sendResponse - Response callback
   * @private
   */
  handleBackgroundMessage(message, sender, sendResponse) {
    switch (message.type) {
      case 'DOWNLOAD_PROGRESS':
        this.handleDownloadProgress(message.data);
        break;
      case 'DOWNLOAD_COMPLETE':
        this.handleDownloadComplete(message.data);
        break;
      case 'DOWNLOAD_ERROR':
        this.handleDownloadError(message.data);
        break;
      default:
        // Unknown message type
        break;
    }
  }

  /**
   * Get current active tab
   * @private
   */
  async getCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      this.state.currentTab = tab;
      return tab;
    } catch (error) {
      throw new Error(`Failed to get current tab: ${error.message}`);
    }
  }

  /**
   * Get stored images from background script
   * @returns {Promise<Array>} Stored images array
   * @private
   */
  async getStoredImages() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getCurrentImages'
      });

      if (response && response.success && response.images) {
        return response.images;
      }

      return [];
    } catch (error) {
      console.warn('Failed to get stored images:', error);
      return [];
    }
  }

  /**
   * Extract images from current tab
   * @private
   */
  async extractImagesFromCurrentTab() {
    try {
      console.log('[PopupService] Starting image extraction...');
      const tab = this.state.currentTab;
      if (!tab) {
        throw new Error('No active tab found');
      }

      console.log('[PopupService] Checking platform support for:', tab.url);
      // Check if current page is supported
      if (!this.isSupportedPlatform(tab.url)) {
        const supportedPlatforms = Object.values(PLATFORM_HOSTNAMES);
        throw new Error(
          `Unsupported platform. This extension works on: ${supportedPlatforms.join(', ')}`
        );
      }

      this.setState('loading', { message: 'Extracting images from page...' });

      console.log('[PopupService] Sending message to content script...');
      // Send message to content script with timeout
      const response = await Promise.race([
        chrome.tabs.sendMessage(tab.id, {
          action: POPUP_MESSAGES.EXTRACT_IMAGES
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Content script timeout')), 10000)
        )
      ]);

      console.log('[PopupService] Content script response:', response);

      if (response && response.success && response.images) {
        if (response.images.length > 0) {
          console.log('[PopupService] Setting images and switching to content state');
          this.setImages(response.images);
          this.setState('content');
        } else {
          throw new Error('No images found on this page');
        }
      } else {
        throw new Error(response?.error || 'Failed to extract images');
      }
    } catch (error) {
      console.error('Image extraction failed:', error);
      this.handleError(error, 'Failed to extract images from page');
    }
  }

  /**
   * Check if platform is supported
   * @param {string} url - URL to check
   * @returns {boolean} True if supported
   * @private
   */
  isSupportedPlatform(url) {
    if (!url) return false;

    const supportedPlatforms = Object.values(PLATFORM_HOSTNAMES);
    return supportedPlatforms.some(platform => url.includes(platform));
  }

  /**
   * Download all images
   * @returns {Promise<boolean>} Success status
   */
  async downloadAllImages() {
    const images = this.getImagesOnly();
    if (!images || images.length === 0) {
      throw new Error('No images to download');
    }

    try {
      this.setState('downloading');

      const response = await chrome.runtime.sendMessage({
        action: BACKGROUND_MESSAGES.DOWNLOAD_IMAGES,
        images: images
      });

      if (response && response.success) {
        this.setState('success', {
          message: `Started downloading ${images.length} images`
        });
        return true;
      } else {
        throw new Error(response?.error || 'Download request failed');
      }
    } catch (error) {
      console.error('Images download failed:', error);
      this.handleError(error, 'Failed to start images download');
      return false;
    }
  }

  /**
   * Download all videos
   * @returns {Promise<boolean>} Success status
   */
  async downloadAllVideos() {
    const videos = this.getVideosOnly();
    if (!videos || videos.length === 0) {
      throw new Error('No videos to download');
    }

    try {
      this.setState('downloading');

      const response = await chrome.runtime.sendMessage({
        action: BACKGROUND_MESSAGES.DOWNLOAD_IMAGES, // Reuse same action for now
        images: videos
      });

      if (response && response.success) {
        this.setState('success', {
          message: `Started downloading ${videos.length} videos`
        });
        return true;
      } else {
        throw new Error(response?.error || 'Download request failed');
      }
    } catch (error) {
      console.error('Videos download failed:', error);
      this.handleError(error, 'Failed to start videos download');
      return false;
    }
  }

  /**
   * Download single image
   * @param {Object} image - Image data object
   * @param {number} index - Image index
   * @returns {Promise<boolean>} Success status
   */
  async downloadSingleImage(image, index) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: BACKGROUND_MESSAGES.DOWNLOAD_SINGLE_IMAGE,
        image,
        index: index + 1
      });

      if (response && response.success) {
        // Notify success through callback
        if (this.options.onDownloadProgress) {
          this.options.onDownloadProgress({
            type: 'single',
            image,
            index,
            status: 'completed'
          });
        }
        return true;
      } else {
        throw new Error(response?.error || 'Single download failed');
      }
    } catch (error) {
      console.error('Single download failed:', error);

      // Notify error through callback
      if (this.options.onDownloadProgress) {
        this.options.onDownloadProgress({
          type: 'single',
          image,
          index,
          status: 'failed',
          error: error.message
        });
      }

      return false;
    }
  }

  /**
   * Handle download progress updates
   * @param {Object} progressData - Progress data
   * @private
   */
  handleDownloadProgress(progressData) {
    this.state.downloadProgress = progressData;

    if (this.options.onDownloadProgress) {
      this.options.onDownloadProgress(progressData);
    }
  }

  /**
   * Handle download completion
   * @param {Object} completionData - Completion data
   * @private
   */
  handleDownloadComplete(completionData) {
    this.setState('success', {
      message: `Download completed! ${completionData.successful || 0} images downloaded successfully.`
    });

    if (this.options.onDownloadProgress) {
      this.options.onDownloadProgress({
        type: 'batch',
        status: 'completed',
        ...completionData
      });
    }
  }

  /**
   * Handle download errors
   * @param {Object} errorData - Error data
   * @private
   */
  handleDownloadError(errorData) {
    this.handleError(
      new Error(errorData.message || 'Download failed'),
      'Download error occurred'
    );
  }

  /**
   * Set current state
   * @param {string} state - New state
   * @param {Object} [data={}] - Additional state data
   * @private
   */
  setState(state, data = {}) {
    const previousState = this.state.currentState;
    this.state.currentState = state;

    console.log('[PopupService] Setting state:', { state, previousState, data });

    // Merge additional data
    Object.assign(this.state, data);

    // Notify state change
    if (this.options.onStateChange) {
      console.log('[PopupService] Calling onStateChange callback');
      this.options.onStateChange(state, previousState, data);
    } else {
      console.warn('[PopupService] No onStateChange callback registered');
    }
  }

  /**
   * Set images data
   * @param {Array} images - Images array
   * @private
   */
  setImages(images) {
    this.state.images = images || [];

    if (this.options.onImagesLoaded) {
      this.options.onImagesLoaded(this.state.images);
    }
  }

  /**
   * Get images only (filter out videos)
   * @returns {Array} Images array
   */
  getImagesOnly() {
    return this.state.images.filter(item => item.mediaType === 'image');
  }

  /**
   * Get videos only (filter out images)
   * @returns {Array} Videos array
   */
  getVideosOnly() {
    return this.state.images.filter(item => item.mediaType === 'video');
  }

  /**
   * Check if videos are available
   * @returns {boolean} True if videos are available
   */
  hasVideos() {
    return this.getVideosOnly().length > 0;
  }

  /**
   * Get video count
   * @returns {number} Number of videos
   */
  getVideoCount() {
    return this.getVideosOnly().length;
  }

  /**
   * Handle errors
   * @param {Error} error - Error object
   * @param {string} context - Error context
   * @private
   */
  handleError(error, context) {
    this.state.error = {
      message: error.message,
      context,
      timestamp: Date.now()
    };

    this.setState('error', {
      message: error.message,
      details: context
    });

    if (this.options.onError) {
      this.options.onError(error, context);
    }
  }

  /**
   * Refresh images from current tab
   */
  async refreshImages() {
    this.state.images = [];
    this.state.error = null;
    await this.extractImagesFromCurrentTab();
  }

  /**
   * Get current state
   * @returns {Object} Current state object
   */
  getCurrentState() {
    return { ...this.state };
  }

  /**
   * Get images
   * @returns {Array} Current images array
   */
  getImages() {
    return [...this.state.images];
  }

  /**
   * Get image count
   * @returns {number} Number of images
   */
  getImageCount() {
    return this.state.images.length;
  }

  /**
   * Check if images are available
   * @returns {boolean} True if images are available
   */
  hasImages() {
    return this.state.images.length > 0;
  }

  /**
   * Get current tab information
   * @returns {Object|null} Current tab object
   */
  getCurrentTabInfo() {
    return this.state.currentTab;
  }

  /**
   * Get download progress
   * @returns {Object|null} Download progress data
   */
  getDownloadProgress() {
    return this.state.downloadProgress;
  }

  /**
   * Get last error
   * @returns {Object|null} Last error object
   */
  getLastError() {
    return this.state.error;
  }

  /**
   * Clear error state
   */
  clearError() {
    this.state.error = null;
  }

  /**
   * Check if service is initialized
   * @returns {boolean} True if initialized
   */
  isServiceInitialized() {
    return this.isInitialized;
  }

  /**
   * Cleanup and destroy the service
   */
  destroy() {
    // Clear message listeners
    this.messageListeners.clear();

    // Reset state
    this.state = {
      currentState: 'destroyed',
      images: [],
      currentTab: null,
      downloadProgress: null,
      error: null
    };

    this.isInitialized = false;
  }
}
