/**
 * @fileoverview Modular image grid component with improved rendering and separation of concerns
 */

import { BACKGROUND_MESSAGES } from '../../shared/message-types.js';

/**
 * Image grid component for displaying and managing image thumbnails
 */
export class ImageGridComponent {
  /**
   * @param {HTMLElement} container - Container element for the image grid
   * @param {Object} [options={}] - Configuration options
   * @param {number} [options.columns=3] - Number of grid columns
   * @param {boolean} [options.showOverlay=true] - Show download overlay on hover
   * @param {boolean} [options.enableSingleDownload=true] - Enable individual image downloads
   * @param {Function} [options.onImageClick] - Callback for image click events
   * @param {Function} [options.onDownloadStart] - Callback for download start events
   * @param {Function} [options.onDownloadComplete] - Callback for download complete events
   */
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      columns: 3,
      showOverlay: true,
      enableSingleDownload: true,
      onImageClick: null,
      onDownloadStart: null,
      onDownloadComplete: null,
      ...options
    };

    this.currentImages = [];
    this.downloadStates = new Map(); // Track individual download states
    this.timers = new Set(); // Track timers for cleanup
    this.isInitialized = false;

    this.createElements();
    this.addStyles();
  }

  /**
   * Create grid container elements
   * @private
   */
  createElements() {
    this.container.innerHTML = '';
    this.container.className = 'image-grid-container';

    this.gridElement = document.createElement('div');
    this.gridElement.className = `image-grid columns-${this.options.columns}`;

    this.container.appendChild(this.gridElement);
    this.isInitialized = true;
  }

  /**
   * Add CSS styles for the image grid
   * @private
   */
  addStyles() {
    if (document.getElementById('image-grid-styles')) return;

    const style = document.createElement('style');
    style.id = 'image-grid-styles';
    style.textContent = `
      .image-grid-container {
        margin: 16px 0;
      }

      .image-grid {
        display: grid;
        gap: 8px;
        max-height: 300px;
        overflow-y: auto;
        padding: 2px;
      }

      .image-grid.columns-2 {
        grid-template-columns: repeat(2, 1fr);
      }

      .image-grid.columns-3 {
        grid-template-columns: repeat(3, 1fr);
      }

      .image-grid.columns-4 {
        grid-template-columns: repeat(4, 1fr);
      }

      .image-item {
        aspect-ratio: 1;
        border-radius: 8px;
        overflow: hidden;
        border: 2px solid #e4e6ea;
        transition: all 0.2s ease;
        position: relative;
        cursor: pointer;
        background: #f8f9fa;
      }

      .image-item:hover {
        border-color: #1877f2;
        transform: scale(1.02);
        box-shadow: 0 4px 12px rgba(24, 119, 242, 0.15);
      }

      .image-item.downloading {
        border-color: #ff9800;
        animation: pulse 1.5s infinite;
      }

      .image-item.downloaded {
        border-color: #4caf50;
      }

      .image-item.error {
        border-color: #f44336;
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }

      .image-item img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: opacity 0.2s ease;
      }

      .image-item.loading img {
        opacity: 0.5;
      }

      .image-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(24, 119, 242, 0.9);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.2s ease;
        color: white;
        font-size: 12px;
        font-weight: 600;
        text-align: center;
        padding: 8px;
      }

      .image-item:hover .image-overlay {
        opacity: 1;
      }

      .image-overlay.downloading {
        background: rgba(255, 152, 0, 0.9);
        opacity: 1;
      }

      .image-overlay.downloaded {
        background: rgba(76, 175, 80, 0.9);
        opacity: 1;
      }

      .image-overlay.error {
        background: rgba(244, 67, 54, 0.9);
        opacity: 1;
      }

      .image-overlay-text {
        margin-bottom: 4px;
      }

      .image-overlay-subtext {
        font-size: 10px;
        opacity: 0.9;
      }

      .image-loading-placeholder {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f0f2f5;
        color: #65676b;
        font-size: 11px;
      }

      .image-error-placeholder {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: #ffebee;
        color: #c62828;
        font-size: 10px;
        text-align: center;
        padding: 8px;
      }

      /* Empty state */
      .image-grid:empty::after {
        content: 'No images to display';
        display: block;
        text-align: center;
        color: #65676b;
        font-size: 14px;
        padding: 40px 20px;
        grid-column: 1 / -1;
      }

      /* Scrollbar styling */
      .image-grid::-webkit-scrollbar {
        width: 6px;
      }

      .image-grid::-webkit-scrollbar-track {
        background: #f1f1f1;
        border-radius: 3px;
      }

      .image-grid::-webkit-scrollbar-thumb {
        background: #c1c1c1;
        border-radius: 3px;
      }

      .image-grid::-webkit-scrollbar-thumb:hover {
        background: #a8a8a8;
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * Display images in the grid
   * @param {Array} images - Array of image data objects
   */
  displayImages(images) {
    if (!this.isInitialized) {
      console.error('ImageGridComponent not initialized');
      return;
    }

    this.currentImages = images;
    this.downloadStates.clear();

    // Clear and populate image grid
    this.gridElement.innerHTML = '';

    if (!images || images.length === 0) {
      return; // CSS will show empty state message
    }

    images.forEach((image, index) => {
      const imageItem = this.createImageItem(image, index);
      this.gridElement.appendChild(imageItem);
    });
  }

  /**
   * Create individual image item element
   * @param {Object} image - Image data object
   * @param {number} index - Image index
   * @returns {HTMLElement} Image item element
   */
  createImageItem(image, index) {
    const imageItem = document.createElement('div');
    imageItem.className = 'image-item loading';
    imageItem.dataset.imageId = image.id || `image-${index}`;
    imageItem.dataset.imageIndex = index;

    // Create image element
    const img = document.createElement('img');
    img.alt = image.alt || `Image ${index + 1}`;
    img.title = image.alt || `Image ${index + 1}`;
    img.crossOrigin = 'anonymous';

    // Create overlay
    const overlay = this.createImageOverlay(image, index);
    imageItem.appendChild(overlay);

    // Handle image loading
    this.loadImageWithFallback(img, image, imageItem);

    // Add click event handler
    if (this.options.enableSingleDownload) {
      imageItem.addEventListener('click', (event) => {
        event.preventDefault();
        this.handleImageClick(image, index, imageItem);
      });
    }

    imageItem.appendChild(img);

    return imageItem;
  }

  /**
   * Create image overlay element
   * @param {Object} image - Image data object
   * @param {number} index - Image index
   * @returns {HTMLElement} Overlay element
   * @private
   */
  createImageOverlay(image, index) {
    const overlay = document.createElement('div');
    overlay.className = 'image-overlay';

    const overlayText = document.createElement('div');
    overlayText.className = 'image-overlay-text';
    overlayText.textContent = 'Click to Download';

    const overlaySubtext = document.createElement('div');
    overlaySubtext.className = 'image-overlay-subtext';
    overlaySubtext.textContent = `${image.width || '?'} × ${image.height || '?'}`;

    overlay.appendChild(overlayText);
    overlay.appendChild(overlaySubtext);

    return overlay;
  }

  /**
   * Load image with fallback handling
   * @param {HTMLImageElement} img - Image element
   * @param {Object} image - Image data object
   * @param {HTMLElement} container - Container element
   * @private
   */
  loadImageWithFallback(img, image, container) {
    let attemptCount = 0;
    const maxAttempts = 3;
    const urls = [
      image.thumbnailUrl,
      image.url,
      image.fullSizeUrl
    ].filter(Boolean);

    const tryLoadImage = () => {
      if (attemptCount >= urls.length || attemptCount >= maxAttempts) {
        this.showImageError(container, 'Failed to load image');
        return;
      }

      const currentUrl = urls[attemptCount];
      if (!currentUrl) {
        attemptCount++;
        tryLoadImage();
        return;
      }

      img.onload = () => {
        container.classList.remove('loading');
        container.appendChild(img);
      };

      img.onerror = () => {
        console.warn(`Image load failed (attempt ${attemptCount + 1}):`, currentUrl);
        attemptCount++;
        tryLoadImage();
      };

      img.src = currentUrl;
    };

    tryLoadImage();
  }

  /**
   * Show image error state
   * @param {HTMLElement} container - Container element
   * @param {string} message - Error message
   * @private
   */
  showImageError(container, message) {
    container.classList.remove('loading');
    container.classList.add('error');

    const errorPlaceholder = document.createElement('div');
    errorPlaceholder.className = 'image-error-placeholder';
    errorPlaceholder.innerHTML = `
      <div>⚠</div>
      <div>${message}</div>
    `;

    container.appendChild(errorPlaceholder);
  }

  /**
   * Handle image click event
   * @param {Object} image - Image data object
   * @param {number} index - Image index
   * @param {HTMLElement} imageItem - Image item element
   */
  async handleImageClick(image, index, imageItem) {
    const imageId = image.id || `image-${index}`;

    // Check if already downloading
    if (this.downloadStates.get(imageId) === 'downloading') {
      return;
    }

    // Call custom click handler if provided
    if (this.options.onImageClick) {
      const shouldContinue = await this.options.onImageClick(image, index, imageItem);
      if (shouldContinue === false) {
        return;
      }
    }

    await this.downloadSingleImage(image, index, imageItem);
  }

  /**
   * Download single image
   * @param {Object} image - Image data object
   * @param {number} index - Image index
   * @param {HTMLElement} imageItem - Image item element
   */
  async downloadSingleImage(image, index, imageItem) {
    const imageId = image.id || `image-${index}`;
    const overlay = imageItem.querySelector('.image-overlay');
    const overlayText = overlay.querySelector('.image-overlay-text');

    try {
      // Update state
      this.downloadStates.set(imageId, 'downloading');
      imageItem.classList.add('downloading');
      overlay.classList.add('downloading');
      overlayText.textContent = 'Downloading...';

      // Notify download start
      if (this.options.onDownloadStart) {
        this.options.onDownloadStart(image, index);
      }

      // Send download request
      const response = await chrome.runtime.sendMessage({
        action: BACKGROUND_MESSAGES.DOWNLOAD_SINGLE_IMAGE,
        image,
        index: index + 1
      });

      if (response && response.success) {
        // Success state
        this.downloadStates.set(imageId, 'downloaded');
        imageItem.classList.remove('downloading');
        imageItem.classList.add('downloaded');
        overlay.classList.remove('downloading');
        overlay.classList.add('downloaded');
        overlayText.textContent = 'Downloaded';

        // Notify download complete
        if (this.options.onDownloadComplete) {
          this.options.onDownloadComplete(image, index, true);
        }

        // Reset after delay
        const timer = setTimeout(() => {
          this.resetImageState(imageId, imageItem);
          this.timers.delete(timer);
        }, 2000);
        this.timers.add(timer);
      } else {
        throw new Error(response?.error || 'Download failed');
      }
    } catch (error) {
      console.error('Single download failed:', error);

      // Error state
      this.downloadStates.set(imageId, 'error');
      imageItem.classList.remove('downloading');
      imageItem.classList.add('error');
      overlay.classList.remove('downloading');
      overlay.classList.add('error');
      overlayText.textContent = 'Download Failed';

      // Notify download complete with error
      if (this.options.onDownloadComplete) {
        this.options.onDownloadComplete(image, index, false, error);
      }

      // Reset after delay
      const timer = setTimeout(() => {
        this.resetImageState(imageId, imageItem);
        this.timers.delete(timer);
      }, 3000);
      this.timers.add(timer);
    }
  }

  /**
   * Reset image state to default
   * @param {string} imageId - Image ID
   * @param {HTMLElement} imageItem - Image item element
   */
  resetImageState(imageId, imageItem) {
    this.downloadStates.delete(imageId);
    imageItem.classList.remove('downloading', 'downloaded', 'error');

    const overlay = imageItem.querySelector('.image-overlay');
    const overlayText = overlay.querySelector('.image-overlay-text');

    overlay.classList.remove('downloading', 'downloaded', 'error');
    overlayText.textContent = 'Click to Download';
  }

  /**
   * Update download progress for specific images
   * @param {Array} progressData - Array of progress data for each image
   */
  updateDownloadProgress(progressData) {
    if (!Array.isArray(progressData)) return;

    progressData.forEach((progress, index) => {
      const imageItem = this.gridElement.querySelector(`[data-image-index="${index}"]`);
      if (!imageItem) return;

      const overlay = imageItem.querySelector('.image-overlay');
      const overlayText = overlay.querySelector('.image-overlay-text');

      switch (progress.status) {
        case 'downloading':
          imageItem.classList.add('downloading');
          overlay.classList.add('downloading');
          overlayText.textContent = `${progress.percentage || 0}%`;
          break;
        case 'completed':
          imageItem.classList.remove('downloading');
          imageItem.classList.add('downloaded');
          overlay.classList.remove('downloading');
          overlay.classList.add('downloaded');
          overlayText.textContent = 'Downloaded';
          break;
        case 'failed':
          imageItem.classList.remove('downloading');
          imageItem.classList.add('error');
          overlay.classList.remove('downloading');
          overlay.classList.add('error');
          overlayText.textContent = 'Failed';
          break;
      }
    });
  }

  /**
   * Set grid column count
   * @param {number} columns - Number of columns (2-4)
   */
  setColumns(columns) {
    if (columns < 2 || columns > 4) return;

    this.options.columns = columns;
    this.gridElement.className = `image-grid columns-${columns}`;
  }

  /**
   * Get current images
   * @returns {Array} Current images array
   */
  getCurrentImages() {
    return [...this.currentImages];
  }

  /**
   * Get image count
   * @returns {number} Number of images
   */
  getImageCount() {
    return this.currentImages.length;
  }

  /**
   * Get download states
   * @returns {Map} Map of image IDs to download states
   */
  getDownloadStates() {
    return new Map(this.downloadStates);
  }

  /**
   * Clear all images from grid
   */
  clear() {
    this.currentImages = [];
    this.downloadStates.clear();
    if (this.gridElement) {
      this.gridElement.innerHTML = '';
    }
  }

  /**
   * Check if grid has images
   * @returns {boolean} True if grid has images
   */
  hasImages() {
    return this.currentImages.length > 0;
  }

  /**
   * Enable or disable single image downloads
   * @param {boolean} enabled - Whether to enable single downloads
   */
  setSingleDownloadEnabled(enabled) {
    this.options.enableSingleDownload = enabled;

    // Update existing image items
    const imageItems = this.gridElement.querySelectorAll('.image-item');
    imageItems.forEach(item => {
      if (enabled) {
        item.style.cursor = 'pointer';
      } else {
        item.style.cursor = 'default';
      }
    });
  }

  /**
   * Destroy the image grid component
   */
  destroy() {
    // Clear all timers
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();

    // Clear all images and their event listeners
    this.clear();

    // Clear download states
    this.downloadStates.clear();

    // Remove all child elements and their event listeners
    if (this.container) {
      // Remove all event listeners by cloning and replacing the container
      const newContainer = this.container.cloneNode(false);
      this.container.parentNode?.replaceChild(newContainer, this.container);
      this.container = newContainer;
    }

    // Clear references
    this.images = [];
    this.isInitialized = false;
  }
}

// Maintain backward compatibility
export { ImageGridComponent as ImageGrid };
