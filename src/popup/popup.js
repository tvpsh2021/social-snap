/**
 * Bundled popup script for Social Media Image Downloader
 */

// === MESSAGE TYPES ===
const POPUP_MESSAGES = {
  EXTRACT_IMAGES: 'extractImages',
  GET_CURRENT_IMAGES: 'getCurrentImages'
};

const BACKGROUND_MESSAGES = {
  DOWNLOAD_IMAGES: 'downloadImages',
  DOWNLOAD_SINGLE_IMAGE: 'downloadSingleImage'
};

// === STATUS DISPLAY COMPONENT ===
class StatusDisplay {
  constructor() {
    this.loadingEl = document.getElementById('loading');
    this.errorEl = document.getElementById('error');
    this.successEl = document.getElementById('success');
    this.contentEl = document.getElementById('content');
  }

  showLoading() {
    this.loadingEl.style.display = 'block';
    this.errorEl.style.display = 'none';
    this.successEl.style.display = 'none';
    this.contentEl.style.display = 'none';
  }

  showError(message = 'No images found. Please ensure you are on a supported social media post page.') {
    this.loadingEl.style.display = 'none';
    this.errorEl.style.display = 'block';
    this.contentEl.style.display = 'none';

    const errorTextEl = this.errorEl.querySelector('p');
    if (errorTextEl && message) {
      errorTextEl.textContent = message;
    }
  }

  showSuccess(message = 'Image download started! Please check your browser\'s download list.') {
    this.successEl.style.display = 'block';

    const successTextEl = this.successEl.querySelector('p');
    if (successTextEl && message) {
      successTextEl.textContent = message;
    }

    setTimeout(() => {
      this.successEl.style.display = 'none';
    }, 3000);
  }

  showContent() {
    this.loadingEl.style.display = 'none';
    this.errorEl.style.display = 'none';
    this.contentEl.style.display = 'block';
  }

  updateImageCount(images) {
    const imageCountEl = document.getElementById('image-count');
    if (imageCountEl) {
      const videoCount = images.filter(i => i.mediaType === 'video').length;
      const imageCount = images.length - videoCount;

      if (videoCount > 0 && imageCount > 0) {
        imageCountEl.textContent = `Found ${imageCount} image(s) and ${videoCount} video(s)`;
      } else if (videoCount > 0) {
        imageCountEl.textContent = `Found ${videoCount} video(s)`;
      } else {
        imageCountEl.textContent = `Found ${imageCount} image(s)`;
      }
    }
  }
}

// === IMAGE GRID COMPONENT ===
class ImageGrid {
  constructor() {
    this.imagesGridEl = document.getElementById('images-grid');
    this.downloadImagesBtnEl = document.getElementById('download-images-btn');
    this.downloadVideosBtnEl = document.getElementById('download-videos-btn');
    this.currentImages = [];

    this._initializeDownloadButtons();
  }

  displayImages(images) {
    this.currentImages = images;
    this.imagesGridEl.innerHTML = '';

    images.forEach((image, index) => {
      const imageItem = this._createImageItem(image, index);
      this.imagesGridEl.appendChild(imageItem);
    });

    const hasImages = images.some(i => i.mediaType !== 'video');
    const hasVideos = images.some(i => i.mediaType === 'video');
    this.downloadImagesBtnEl.style.display = hasImages ? '' : 'none';
    this.downloadVideosBtnEl.style.display = hasVideos ? '' : 'none';
  }

  _createImageItem(image, index) {
    const imageItem = document.createElement('div');
    imageItem.className = 'image-item';

    const img = document.createElement('img');
    img.src = image.thumbnailUrl || this._getDefaultImageDataUrl();
    img.alt = `${image.mediaType === 'video' ? 'Video' : 'Image'} ${index + 1}`;
    img.title = image.alt;
    img.crossOrigin = 'anonymous';

    const downloadOverlay = document.createElement('div');
    downloadOverlay.className = 'download-overlay';
    downloadOverlay.textContent = 'Click to Download';

    console.log(`Loading thumbnail ${index + 1}:`, image.thumbnailUrl);

    img.onerror = () => {
      console.log(`Thumbnail loading failed ${index + 1}:`, image.thumbnailUrl);
      img.src = this._getDefaultImageDataUrl();
    };

    if (image.mediaType === 'video') {
      const videoBadge = document.createElement('div');
      videoBadge.className = 'video-badge';
      videoBadge.textContent = 'VIDEO';
      imageItem.appendChild(videoBadge);
    }

    imageItem.addEventListener('click', async () => {
      await this._downloadSingleImage(image, index + 1, downloadOverlay);
    });

    imageItem.appendChild(img);
    imageItem.appendChild(downloadOverlay);

    return imageItem;
  }

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

  _initializeDownloadButtons() {
    this.downloadImagesBtnEl.addEventListener('click', async () => {
      const images = this.currentImages.filter(i => i.mediaType !== 'video');
      await this._downloadBatch(images, this.downloadImagesBtnEl, 'Download Images');
    });

    this.downloadVideosBtnEl.addEventListener('click', async () => {
      const videos = this.currentImages.filter(i => i.mediaType === 'video');
      await this._downloadBatch(videos, this.downloadVideosBtnEl, 'Download Videos');
    });
  }

  async _downloadBatch(items, btn, defaultLabel) {
    if (items.length === 0) return;

    try {
      btn.disabled = true;
      btn.textContent = 'Downloading...';

      await chrome.runtime.sendMessage({
        action: BACKGROUND_MESSAGES.DOWNLOAD_IMAGES,
        images: items
      });

      this._notifyDownloadSuccess();

      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = defaultLabel;
      }, 2000);
    } catch (err) {
      console.error('Download failed:', err);
      btn.disabled = false;
      btn.textContent = 'Failed, Retry';

      setTimeout(() => {
        btn.textContent = defaultLabel;
      }, 2000);
    }
  }

  _notifyDownloadSuccess() {
    const event = new CustomEvent('downloadSuccess');
    document.dispatchEvent(event);
  }

  _getDefaultImageDataUrl() {
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiBmaWxsPSIjRjBGMkY1Ii8+CjxwYXRoIGQ9Ik01MCA3NUMzOS4yIDc1IDI4LjkgNzAuNyAyMS4yIDYzQzEzLjUgNTUuMyA5LjIgNDUgOS4yIDM0LjJDOS4yIDIzLjQgMTMuNSAxMy4xIDIxLjIgNS40QzI4LjkgLTIuMyAzOS4yIC02LjYgNTAgLTYuNkM2MC44IC02LjYgNzEuMSAtMi4zIDc4LjggNS40Qzg2LjUgMTMuMSA5MC44IDIzLjQgOTAuOCAzNC4yQzkwLjggNDUgODYuNSA1NS4zIDc4LjggNjNDNzEuMSA3MC43IDYwLjggNzUgNTAgNzVaTTUwIDY3QzU4LjMgNjcgNjYuMiA2My44IDcyIDU4Qzc3LjggNTIuMiA4MSA0NC4zIDgxIDM2QzgxIDI3LjcgNzcuOCAxOS44IDcyIDE0QzY2LjIgOC4yIDU4LjMgNSA1MCA1QzQxLjcgNSAzMy44IDguMiAyOCAxNEMyMi4yIDE5LjggMTkgMjcuNyAxOSAzNkMxOSA0NC4zIDIyLjIgNTIuMiAyOCA1OEMzMy44IDYzLjggNDEuNyA2NyA1MCA2N1oiIGZpbGw9IiNDQ0QyRDkiLz4KPHBhdGggZD0iTTQzIDU1SDU3VjQxSDQzVjU1Wk00MyA2M0g1N1Y1NUg0M1Y2M1pNNDMgNTVINDNWMjlINTdWNDFINDNWNTVaIiBmaWxsPSIjQ0NEMkQ5Ii8+Cjx0ZXh0IHg9IjUwIiB5PSIyNSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTAiIGZpbGw9IiNDQ0QyRDkiIHRleHQtYW5jaG9yPSJtaWRkbGUiPuWcluePjzwvdGV4dD4KPC9zdmc+';
  }
}

// === POPUP CONTROLLER ===
class PopupController {
  constructor() {
    this.statusDisplay = new StatusDisplay();
    this.imageGrid = new ImageGrid();
    this.currentTab = null;

    this._initializeEventListeners();
    this.init();
  }

  async init() {
    try {
      this.statusDisplay.showLoading();

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      this.currentTab = tab;

      // The content script now runs automatically on page load.
      // The popup's only job is to query the background script for the result.
      const response = await chrome.runtime.sendMessage({
        action: POPUP_MESSAGES.GET_CURRENT_IMAGES,
        tabId: this.currentTab.id
      });

      // If images are found (or an empty array from a failed/no-image extraction), display the result.
      if (response && response.images) {
        if (response.images.length > 0) {
          this._displayImages(response.images);
        } else {
          // This handles cases where auto-extraction ran but found no images,
          // or the page is unsupported.
          this.statusDisplay.showError();
        }
      } else {
        // This handles errors or if the background script isn't ready.
        console.error('Invalid response from background script.');
        this.statusDisplay.showError('Failed to get images. Please reload the page and try again.');
      }
    } catch (err) {
      console.error('Popup initialization failed:', err);
      if (err.message.includes('Receiving end does not exist')) {
        this.statusDisplay.showError('This page may not be supported or needs to be reloaded.');
      } else {
        this.statusDisplay.showError('An unexpected error occurred.');
      }
    }
  }

  _displayImages(images) {
    this.statusDisplay.showContent();
    this.statusDisplay.updateImageCount(images);
    this.imageGrid.displayImages(images);
  }

  _initializeEventListeners() {
    document.addEventListener('downloadSuccess', () => {
      this.statusDisplay.showSuccess();
    });
  }
}

// === INITIALIZE POPUP ===
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});
