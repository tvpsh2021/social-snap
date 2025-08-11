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

// === CONSTANTS ===
const PLATFORM_HOSTNAMES = ['threads.com', 'instagram.com'];

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

  updateImageCount(count) {
    const imageCountEl = document.getElementById('image-count');
    if (imageCountEl) {
      imageCountEl.textContent = `Found ${count} images`;
    }
  }
}

// === IMAGE GRID COMPONENT ===
class ImageGrid {
  constructor() {
    this.imagesGridEl = document.getElementById('images-grid');
    this.downloadBtnEl = document.getElementById('download-btn');
    this.currentImages = [];

    this._initializeDownloadButton();
  }

  displayImages(images) {
    this.currentImages = images;
    this.imagesGridEl.innerHTML = '';

    images.forEach((image, index) => {
      const imageItem = this._createImageItem(image, index);
      this.imagesGridEl.appendChild(imageItem);
    });
  }

  _createImageItem(image, index) {
    const imageItem = document.createElement('div');
    imageItem.className = 'image-item';

    const img = document.createElement('img');
    img.src = image.thumbnailUrl;
    img.alt = `Image ${index + 1}`;
    img.title = image.alt;
    img.crossOrigin = 'anonymous';

    const downloadOverlay = document.createElement('div');
    downloadOverlay.className = 'download-overlay';
    downloadOverlay.textContent = 'Click to Download';

    console.log(`Loading thumbnail ${index + 1}:`, image.thumbnailUrl);

    img.onerror = () => {
      console.log(`Thumbnail loading failed ${index + 1}, trying original URL:`, image.thumbnailUrl);

      if (img.src !== image.fullSizeUrl) {
        img.src = image.fullSizeUrl;
        return;
      }

      img.src = this._getDefaultImageDataUrl();
    };

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

  _initializeDownloadButton() {
    this.downloadBtnEl.addEventListener('click', async () => {
      if (this.currentImages.length === 0) {
        return;
      }

      try {
        this.downloadBtnEl.disabled = true;
        this.downloadBtnEl.textContent = 'Downloading...';

        await chrome.runtime.sendMessage({
          action: BACKGROUND_MESSAGES.DOWNLOAD_IMAGES,
          images: this.currentImages
        });

        this._notifyDownloadSuccess();

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

    this._initializeEventListeners();
    this.init();
  }

  async init() {
    try {
      this.statusDisplay.showLoading();

      const response = await chrome.runtime.sendMessage({ action: 'getCurrentImages' });

      if (response && response.images && response.images.length > 0) {
        this._displayImages(response.images);
      } else {
        await this._extractImagesFromCurrentTab();
      }
    } catch (err) {
      console.error('Initialization failed:', err);
      this.statusDisplay.showError();
    }
  }

    async _extractImagesFromCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      const isSupported = PLATFORM_HOSTNAMES.some(platform => tab.url.includes(platform));

      if (!isSupported) {
        this.statusDisplay.showError(`Unsupported platform. This extension works on: ${PLATFORM_HOSTNAMES.join(', ')}`);
        return;
      }

      // Check if it's a homepage (should be excluded)
      if (this._isHomepage(tab.url)) {
        this.statusDisplay.showError('This extension only works on individual posts, not on the main feed page. Please navigate to a specific post.');
        return;
      }

      const response = await chrome.tabs.sendMessage(tab.id, { action: POPUP_MESSAGES.EXTRACT_IMAGES });

      if (response && response.success && response.images && response.images.length > 0) {
        this._displayImages(response.images);
      } else if (response && response.error) {
        // Handle specific error messages
        if (response.error.includes('Homepage detected') || response.error.includes('main feed')) {
          this.statusDisplay.showError('This extension only works on individual posts. Please navigate to a specific post, not the main feed.');
        } else if (response.error.includes('individual posts only')) {
          this.statusDisplay.showError('This extension only works on individual posts. Please make sure you are viewing a single post.');
        } else {
          this.statusDisplay.showError(`Extraction failed: ${response.error}`);
        }
      } else {
        this.statusDisplay.showError();
      }
    } catch (err) {
      console.error('Image extraction failed:', err);
      this.statusDisplay.showError();
    }
  }

  _isHomepage(url) {
    const homepagePatterns = [
      /^https:\/\/www\.threads\.com\/?$/,
      /^https:\/\/www\.threads\.com\/\?[^\/]*$/,
      /^https:\/\/www\.instagram\.com\/?$/,
      /^https:\/\/www\.instagram\.com\/\?[^\/]*$/
    ];

    return homepagePatterns.some(pattern => pattern.test(url));
  }

  _displayImages(images) {
    this.statusDisplay.showContent();
    this.statusDisplay.updateImageCount(images.length);
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
