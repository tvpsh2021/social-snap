/**
 * @fileoverview Main popup script using new modular component architecture
 */

import { BACKGROUND_MESSAGES } from '../shared/message-types.js';

import { ImageGridComponent } from './components/image-grid.js';
import { NotificationDisplayComponent } from './components/NotificationDisplayComponent.js';
import { StatusDisplayComponent } from './components/status-display.js';
import { PopupService } from './services/PopupService.js';

/**
 * Main popup controller using new modular architecture
 */
class PopupController {
  constructor() {
    this.components = {};
    this.service = null;
    this.isInitialized = false;
    this.timers = new Set(); // Track timers for cleanup

    this.initializeComponents();
    this.initializeService();
  }

  /**
   * Create a managed timer that automatically cleans up
   * @param {Function} callback - Timer callback
   * @param {number} delay - Delay in milliseconds
   * @returns {number} Timer ID
   * @private
   */
  createManagedTimer(callback, delay) {
    const timer = setTimeout(() => {
      callback();
      this.timers.delete(timer);
    }, delay);
    this.timers.add(timer);
    return timer;
  }

  /**
   * Initialize UI components
   * @private
   */
  initializeComponents() {
    try {
      // Get container elements
      const statusContainer = document.getElementById('status-display');
      const imageGridContainer = document.getElementById('image-grid');
      const videoGridContainer = document.getElementById('video-grid');
      const progressContainer = document.getElementById('progress-bar');
      const notificationContainer = document.getElementById('notifications');
      const contentArea = document.getElementById('content-area');
      const downloadImagesBtn = document.getElementById('download-images-btn');
      const downloadVideosBtn = document.getElementById('download-videos-btn');
      const imagesSection = document.getElementById('images-section');
      const videosSection = document.getElementById('videos-section');
      const imagesCount = document.getElementById('images-count');
      const videosCount = document.getElementById('videos-count');

      if (!statusContainer || !imageGridContainer || !videoGridContainer || !contentArea ||
          !downloadImagesBtn || !downloadVideosBtn || !imagesSection || !videosSection) {
        throw new Error('Required DOM elements not found');
      }

      // Initialize components
      this.components.statusDisplay = new StatusDisplayComponent(statusContainer, {
        showImageCount: true,
        autoHideSuccess: true,
        successHideDelay: 3000,
        onStateChange: this.handleStateChange.bind(this)
      });

      this.components.imageGrid = new ImageGridComponent(imageGridContainer, {
        columns: 3,
        showOverlay: true,
        enableSingleDownload: true,
        onImageClick: this.handleImageClick.bind(this),
        onDownloadStart: this.handleSingleDownloadStart.bind(this),
        onDownloadComplete: this.handleSingleDownloadComplete.bind(this)
      });

      this.components.videoGrid = new ImageGridComponent(videoGridContainer, {
        columns: 3,
        showOverlay: true,
        enableSingleDownload: true,
        onImageClick: this.handleVideoClick.bind(this),
        onDownloadStart: this.handleSingleDownloadStart.bind(this),
        onDownloadComplete: this.handleSingleDownloadComplete.bind(this)
      });

      // Progress bar component removed

      this.components.notifications = new NotificationDisplayComponent(notificationContainer, {
        maxNotifications: 3,
        autoHideDelay: 5000,
        showTimestamp: true,
        allowDismiss: true
      });

      // Store references to key elements
      this.elements = {
        contentArea,
        downloadImagesBtn,
        downloadVideosBtn,
        progressContainer,
        notificationContainer,
        imagesSection,
        videosSection,
        imagesCount,
        videosCount
      };

      // Initialize download button
      this.initializeDownloadButton();

      // Components initialized successfully
    } catch (error) {
      console.error('Failed to initialize components:', error);
      this.showFallbackError('Failed to initialize popup components');
    }
  }

  /**
   * Initialize popup service
   * @private
   */
  initializeService() {
    try {
      console.log('[PopupController] Creating PopupService...');
      this.service = new PopupService({
        onStateChange: (state, previousState, data) => {
          // Call both handlers to ensure proper UI updates
          this.handleStateChange(state, previousState, data);
          this.handleServiceStateChange(state, previousState, data);
        },
        onImagesLoaded: this.handleImagesLoaded.bind(this),
        onDownloadProgress: this.handleDownloadProgress.bind(this),
        onError: this.handleServiceError.bind(this)
      });

      console.log('[PopupController] Initializing PopupService...');
      // Initialize the service
      this.service.initialize().then(() => {
        this.isInitialized = true;
        console.log('[PopupController] PopupService initialized successfully');
      }).catch(error => {
        console.error('Service initialization failed:', error);
        this.handleServiceError(error, 'Service initialization failed');
      });
    } catch (error) {
      console.error('Failed to create popup service:', error);
      this.showFallbackError('Failed to initialize popup service');
    }
  }

  /**
   * Initialize download button event handlers
   * @private
   */
  initializeDownloadButton() {
    // Images download button
    this.elements.downloadImagesBtn.addEventListener('click', async() => {
      if (!this.service || !this.service.hasImages()) {
        return;
      }

      try {
        this.setDownloadButtonState('loading', 'images');
        const success = await this.service.downloadAllImages();

        if (success) {
          this.setDownloadButtonState('success', 'images');
          this.createManagedTimer(() => {
            this.setDownloadButtonState('default', 'images');
          }, 2000);
        } else {
          this.setDownloadButtonState('error', 'images');
          this.createManagedTimer(() => {
            this.setDownloadButtonState('default', 'images');
          }, 3000);
        }
      } catch (error) {
        console.error('Images download failed:', error);
        this.setDownloadButtonState('error', 'images');
        this.createManagedTimer(() => {
          this.setDownloadButtonState('default', 'images');
        }, 3000);
      }
    });

    // Videos download button
    this.elements.downloadVideosBtn.addEventListener('click', async() => {
      if (!this.service || !this.service.hasVideos()) {
        return;
      }

      try {
        this.setDownloadButtonState('loading', 'videos');
        const success = await this.service.downloadAllVideos();

        if (success) {
          this.setDownloadButtonState('success', 'videos');
          this.createManagedTimer(() => {
            this.setDownloadButtonState('default', 'videos');
          }, 2000);
        } else {
          this.setDownloadButtonState('error', 'videos');
          this.createManagedTimer(() => {
            this.setDownloadButtonState('default', 'videos');
          }, 3000);
        }
      } catch (error) {
        console.error('Videos download failed:', error);
        this.setDownloadButtonState('error', 'videos');
        this.createManagedTimer(() => {
          this.setDownloadButtonState('default', 'videos');
        }, 3000);
      }
    });
  }

  /**
   * Handle component state changes
   * @param {string} state - New state
   * @param {string} previousState - Previous state
   * @param {Object} data - Additional state data
   * @private
   */
  handleStateChange(state, previousState, data) {
    switch (state) {
    case 'loading':
      this.elements.contentArea.classList.add('hidden');
      this.elements.downloadImagesBtn.disabled = true;
      this.elements.downloadVideosBtn.disabled = true;
      break;

    case 'content':
      this.elements.contentArea.classList.remove('hidden');
      this.updateDownloadButtons();
      break;

    case 'error':
      this.elements.contentArea.classList.add('hidden');
      this.elements.downloadImagesBtn.disabled = true;
      this.elements.downloadVideosBtn.disabled = true;
      break;

    case 'success':
      // Keep content area visible for success state
      break;
    }
  }

  /**
   * Handle service state changes
   * @param {string} state - New state
   * @param {string} previousState - Previous state
   * @param {Object} data - Additional state data
   * @private
   */
  handleServiceStateChange(state, previousState, data) {
    console.log('[PopupController] State change:', { state, previousState, data });

    switch (state) {
    case 'loading':
      this.components.statusDisplay.showLoading(data?.message);
      break;

    case 'content':
      this.components.statusDisplay.showContent();
      break;

    case 'error':
      this.components.statusDisplay.showError(data?.message, data?.details);
      break;

    case 'success':
      this.components.statusDisplay.showSuccess(data?.message);
      break;

    case 'downloading':
      // Downloading state - no progress bar
      break;
    }
  }

  /**
   * Handle images loaded
   * @param {Array} media - Loaded media (images and videos)
   * @private
   */
  handleImagesLoaded(media) {
    // Separate images and videos
    const images = media.filter(item => item.mediaType === 'image');
    const videos = media.filter(item => item.mediaType === 'video');

    console.log('[PopupController] Separated media:', { images: images.length, videos: videos.length });

    // Update counts
    this.elements.imagesCount.textContent = images.length;
    this.elements.videosCount.textContent = videos.length;

    // Show/hide sections based on content
    if (images.length > 0) {
      this.elements.imagesSection.classList.remove('hidden');
      this.components.imageGrid.displayImages(images);
    } else {
      this.elements.imagesSection.classList.add('hidden');
    }

    if (videos.length > 0) {
      this.elements.videosSection.classList.remove('hidden');
      this.components.videoGrid.displayImages(videos); // Reuse ImageGridComponent for videos
    } else {
      this.elements.videosSection.classList.add('hidden');
    }

    this.updateDownloadButtons();
  }

  /**
   * Handle download progress updates
   * @param {Object} progressData - Progress data
   * @private
   */
  handleDownloadProgress(progressData) {
    // Progress bar removed - just handle notifications and image grid updates
    if (progressData.type === 'batch') {
      if (progressData.status === 'completed') {
        this.addNotification({
          id: `batch-${Date.now()}`,
          type: 'download',
          severity: 'success',
          title: 'Download Complete',
          message: `Successfully downloaded ${progressData.successful || 0} images`,
          timestamp: Date.now(),
          data: progressData
        });
      }
    } else if (progressData.type === 'single') {
      // Update individual image states
      this.components.imageGrid.updateDownloadProgress([{
        index: progressData.index,
        status: progressData.status,
        percentage: progressData.percentage
      }]);
    }
  }

  /**
   * Handle service errors
   * @param {Error} error - Error object
   * @param {string} context - Error context
   * @private
   */
  handleServiceError(error, context) {
    console.error('Service error:', error, context);

    this.addNotification({
      id: `error-${Date.now()}`,
      type: 'error',
      severity: 'error',
      title: 'Error',
      message: error.message || 'An unexpected error occurred',
      timestamp: Date.now(),
      data: { context }
    });
  }

  /**
   * Handle image click events
   * @param {Object} image - Image data
   * @param {number} index - Image index
   * @param {HTMLElement} imageItem - Image element
   * @returns {Promise<boolean>} Whether to continue with download
   * @private
   */
  async handleImageClick(image, index, imageItem) {
    // Allow the download to proceed
    return true;
  }

  /**
   * Handle single download start
   * @param {Object} image - Image data
   * @param {number} index - Image index
   * @private
   */
  handleSingleDownloadStart(image, index) {
    console.log(`Starting download for image ${index + 1}`);
  }

  /**
   * Handle single download completion
   * @param {Object} image - Image data
   * @param {number} index - Image index
   * @param {boolean} success - Whether download was successful
   * @param {Error} [error] - Error if download failed
   * @private
   */
  handleSingleDownloadComplete(image, index, success, error) {
    if (success) {
      this.addNotification({
        id: `single-${index}-${Date.now()}`,
        type: 'download',
        severity: 'success',
        title: 'Image Downloaded',
        message: `Image ${index + 1} downloaded successfully`,
        timestamp: Date.now()
      });
    } else {
      this.addNotification({
        id: `single-error-${index}-${Date.now()}`,
        type: 'download',
        severity: 'error',
        title: 'Download Failed',
        message: `Failed to download image ${index + 1}: ${error?.message || 'Unknown error'}`,
        timestamp: Date.now()
      });
    }
  }



  /**
   * Handle video click
   * @param {Object} video - Video data
   * @param {number} index - Video index
   * @private
   */
  handleVideoClick(video, index) {
    console.log('[PopupController] Video clicked:', { video, index });
    // Could open video in new tab or show preview
  }

  /**
   * Handle video download
   * @param {Object} video - Video data
   * @param {number} index - Video index
   * @private
   */
  async handleVideoDownload(video, index) {
    console.log('[PopupController] Video download requested:', { video, index });
    // Implement video download logic
  }

  /**
   * Update download buttons state
   * @private
   */
  updateDownloadButtons() {
    const hasImages = this.service && this.service.hasImages();
    const hasVideos = this.service && this.service.hasVideos();

    this.elements.downloadImagesBtn.disabled = !hasImages;
    this.elements.downloadVideosBtn.disabled = !hasVideos;
  }

  /**
   * Set download button state
   * @param {string} state - Button state (default, loading, success, error)
   * @param {string} type - Button type (images, videos)
   * @private
   */
  setDownloadButtonState(state, type = 'images') {
    const button = type === 'images' ? this.elements.downloadImagesBtn : this.elements.downloadVideosBtn;
    const textSpan = button.querySelector('.download-btn-text');

    // Remove all state classes
    button.classList.remove('loading', 'success', 'error');

    switch (state) {
      case 'loading':
        button.classList.add('loading');
        button.disabled = true;
        textSpan.textContent = `Downloading ${type}...`;
        break;
      case 'success':
        button.classList.add('success');
        textSpan.textContent = `${type} downloaded!`;
        break;
      case 'error':
        button.classList.add('error');
        textSpan.textContent = `Download failed`;
        break;
      default:
        button.disabled = false;
        textSpan.textContent = `Download All ${type.charAt(0).toUpperCase() + type.slice(1)}`;
    }
  }

  /**
   * Add notification
   * @param {Object} notification - Notification data
   * @private
   */
  addNotification(notification) {
    this.elements.notificationContainer.classList.remove('hidden');
    this.components.notifications.addNotification(notification);
  }

  /**
   * Show fallback error when components fail to initialize
   * @param {string} message - Error message
   * @private
   */
  showFallbackError(message) {
    document.body.innerHTML = `
      <div style="padding: 20px; text-align: center; color: #e41e3f;">
        <h3>Initialization Error</h3>
        <p>${message}</p>
        <button onclick="location.reload()" style="
          background: #1877f2;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
        ">Retry</button>
      </div>
    `;
  }

  /**
   * Cleanup and destroy controller
   */
  destroy() {
    // Clear all timers
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();

    // Destroy components
    Object.values(this.components).forEach(component => {
      if (component && typeof component.destroy === 'function') {
        component.destroy();
      }
    });

    // Destroy service
    if (this.service) {
      this.service.destroy();
    }

    this.isInitialized = false;
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  try {
    new PopupController();
  } catch (error) {
    console.error('Failed to initialize popup:', error);

    // Show fallback error UI
    document.body.innerHTML = `
      <div style="padding: 20px; text-align: center; color: #e41e3f;">
        <h3>Popup Failed to Load</h3>
        <p>An error occurred while initializing the popup.</p>
        <button onclick="location.reload()" style="
          background: #1877f2;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
        ">Retry</button>
      </div>
    `;
  }
});
