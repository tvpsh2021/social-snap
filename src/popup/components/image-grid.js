/**
 * Image grid component for popup UI
 */

import { BACKGROUND_MESSAGES } from '../../shared/message-types.js';

export class ImageGrid {
  constructor() {
    this.imagesGridEl = document.getElementById('images-grid');
    this.downloadBtnEl = document.getElementById('download-btn');
    this.currentImages = [];

    this._initializeDownloadButton();
  }

  /**
   * Display images in the grid
   * @param {Array} images - Array of image data objects
   */
  displayImages(images) {
    this.currentImages = images;

    // Clear and populate image grid
    this.imagesGridEl.innerHTML = '';

    images.forEach((image, index) => {
      const imageItem = this._createImageItem(image, index);
      this.imagesGridEl.appendChild(imageItem);
    });
  }

  /**
   * Create individual image item element
   * @param {Object} image - Image data object
   * @param {number} index - Image index
   * @returns {HTMLElement} Image item element
   */
  _createImageItem(image, index) {
    const imageItem = document.createElement('div');
    imageItem.className = 'image-item';

    const img = document.createElement('img');
    img.src = image.thumbnailUrl;
    img.alt = `Image ${index + 1}`;
    img.title = image.alt;
    img.crossOrigin = 'anonymous'; // Try to handle CORS

    // Create download overlay
    const downloadOverlay = document.createElement('div');
    downloadOverlay.className = 'download-overlay';
    downloadOverlay.textContent = 'Click to Download';

    console.log(`Loading thumbnail ${index + 1}:`, image.thumbnailUrl);

    // Handle image loading errors
    img.onerror = () => {
      console.log(`Thumbnail loading failed ${index + 1}, trying original URL:`, image.thumbnailUrl);

      // First try original src URL
      if (img.src !== image.fullSizeUrl) {
        img.src = image.fullSizeUrl;
        return;
      }

      // If still fails, show default image
      img.src = this._getDefaultImageDataUrl();
    };

    // Add click event to download single image
    imageItem.addEventListener('click', async () => {
      await this._downloadSingleImage(image, index + 1, downloadOverlay);
    });

    imageItem.appendChild(img);
    imageItem.appendChild(downloadOverlay);

    return imageItem;
  }

  /**
   * Download single image
   * @param {Object} image - Image data object
   * @param {number} index - Image index
   * @param {HTMLElement} overlay - Download overlay element
   */
  async _downloadSingleImage(image, index, overlay) {
    try {
      overlay.textContent = 'Downloading...';

      await chrome.runtime.sendMessage({
        action: BACKGROUND_MESSAGES.DOWNLOAD_SINGLE_IMAGE,
        image,
        index
      });

      overlay.textContent = 'Downloaded';
      setTimeout(() => {
        overlay.textContent = 'Click to Download';
      }, 1500);
    } catch (error) {
      console.error('Single download failed:', error);
      overlay.textContent = 'Download Failed';
      setTimeout(() => {
        overlay.textContent = 'Click to Download';
      }, 1500);
    }
  }

  /**
   * Initialize download all button
   */
  _initializeDownloadButton() {
    this.downloadBtnEl.addEventListener('click', async () => {
      if (this.currentImages.length === 0) {
        return;
      }

      try {
        this.downloadBtnEl.disabled = true;
        this.downloadBtnEl.textContent = 'Downloading...';

        // Send download request to background script
        await chrome.runtime.sendMessage({
          action: BACKGROUND_MESSAGES.DOWNLOAD_IMAGES,
          images: this.currentImages
        });

        // Show success message (handled by parent component)
        this._notifyDownloadSuccess();

        // Reset button
        setTimeout(() => {
          this.downloadBtnEl.disabled = false;
          this.downloadBtnEl.textContent = 'Download All Images';
        }, 2000);
      } catch (err) {
        console.error('Download failed:', err);
        this.downloadBtnEl.disabled = false;
        this.downloadBtnEl.textContent = 'Download Failed, Please Retry';

        setTimeout(() => {
          this.downloadBtnEl.textContent = 'Download All Images';
        }, 2000);
      }
    });
  }

  /**
   * Notify parent component of successful download
   */
  _notifyDownloadSuccess() {
    const event = new CustomEvent('downloadSuccess');
    document.dispatchEvent(event);
  }

  /**
   * Get default image data URL for failed image loads
   * @returns {string} Data URL for default image
   */
  _getDefaultImageDataUrl() {
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiBmaWxsPSIjRjBGMkY1Ii8+CjxwYXRoIGQ9Ik01MCA3NUMzOS4yIDc1IDI4LjkgNzAuNyAyMS4yIDYzQzEzLjUgNTUuMyA5LjIgNDUgOS4yIDM0LjJDOS4yIDIzLjQgMTMuNSAxMy4xIDIxLjIgNS40QzI4LjkgLTIuMyAzOS4yIC02LjYgNTAgLTYuNkM2MC44IC02LjYgNzEuMSAtMi4zIDc4LjggNS40Qzg2LjUgMTMuMSA5MC44IDIzLjQgOTAuOCAzNC4yQzkwLjggNDUgODYuNSA1NS4zIDc4LjggNjNDNzEuMSA3MC43IDYwLjggNzUgNTAgNzVaTTUwIDY3QzU4LjMgNjcgNjYuMiA2My44IDcyIDU4Qzc3LjggNTIuMiA4MSA0NC4zIDgxIDM2QzgxIDI3LjcgNzcuOCAxOS44IDcyIDE0QzY2LjIgOC4yIDU4LjMgNSA1MCA1QzQxLjcgNSAzMy44IDguMiAyOCAxNEMyMi4yIDE5LjggMTkgMjcuNyAxOSAzNkMxOSA0NC4zIDIyLjIgNTIuMiAyOCA1OEMzMy44IDYzLjggNDEuNyA2NyA1MCA2N1oiIGZpbGw9IiNDQ0QyRDkiLz4KPHBhdGggZD0iTTQzIDU1SDU3VjQxSDQzVjU1Wk00MyA2M0g1N1Y1NUg0M1Y2M1pNNDMgNTVINDNWMjlINTdWNDFINDNWNTVaIiBmaWxsPSIjQ0NEMkQ5Ii8+Cjx0ZXh0IHg9IjUwIiB5PSIyNSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTAiIGZpbGw9IiNDQ0QyRDkiIHRleHQtYW5jaG9yPSJtaWRkbGUiPuWcluePjzwvdGV4dD4KPC9zdmc+';
  }
}
