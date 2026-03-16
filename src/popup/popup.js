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

  showError(message = 'Open a specific post on Instagram, Threads, Facebook, or X to get started.') {
    this.loadingEl.style.display = 'none';
    this.errorEl.style.display = 'flex';
    this.contentEl.style.display = 'none';

    const errorTextEl = this.errorEl.querySelector('p');
    if (errorTextEl && message) {
      errorTextEl.textContent = message;
    }

    const countEl = document.getElementById('image-count');
    if (countEl) {
      countEl.textContent = '0 items';
      countEl.classList.remove('has-items');
    }
  }

  showSuccess(message = 'Download started. Check your downloads folder.') {
    this.successEl.style.display = 'flex';

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
    const countEl = document.getElementById('image-count');
    if (!countEl) return;

    const total = images.length;
    countEl.textContent = `${total} item${total !== 1 ? 's' : ''}`;
    countEl.classList.toggle('has-items', total > 0);
  }
}

// === IMAGE GRID COMPONENT ===
class ImageGrid {
  constructor() {
    this.imagesGridEl = document.getElementById('images-grid');
    this.downloadAllBtnEl = document.getElementById('download-all-btn');
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

    const imageCount = images.filter(i => i.mediaType !== 'video').length;
    const directVideoCount = images.filter(i => i.mediaType === 'video' && !i.isHLS).length;
    const hlsVideos = images.filter(i => i.mediaType === 'video' && i.isHLS);

    // "Download All" counts only directly downloadable items
    const downloadableCount = imageCount + directVideoCount;
    if (downloadableCount > 0) {
      this.downloadAllBtnEl.style.display = '';
      this.downloadAllBtnEl.textContent = `Download All  ·  ${downloadableCount}`;
    } else {
      this.downloadAllBtnEl.style.display = 'none';
    }

    if (imageCount > 0) {
      this.downloadImagesBtnEl.style.display = '';
      this.downloadImagesBtnEl.textContent = `Images  ·  ${imageCount}`;
    } else {
      this.downloadImagesBtnEl.style.display = 'none';
    }

    if (directVideoCount > 0) {
      this.downloadVideosBtnEl.style.display = '';
      this.downloadVideosBtnEl.textContent = `Videos  ·  ${directVideoCount}`;
    } else {
      this.downloadVideosBtnEl.style.display = 'none';
    }

    this._renderHlsSection(hlsVideos);
  }

  _renderHlsSection(hlsVideos) {
    const sectionEl = document.getElementById('hls-section');
    const commandsEl = document.getElementById('hls-commands');
    if (!sectionEl || !commandsEl) return;

    if (hlsVideos.length === 0) {
      sectionEl.style.display = 'none';
      return;
    }

    commandsEl.innerHTML = '';
    hlsVideos.forEach((video, index) => {
      const command = `yt-dlp "${video.fullSizeUrl}"`;

      const row = document.createElement('div');
      row.className = 'hls-command-row';

      if (hlsVideos.length > 1) {
        const label = document.createElement('span');
        label.className = 'hls-command-label';
        label.textContent = `Video ${index + 1}`;
        row.appendChild(label);
      }

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'hls-command-input';
      input.value = command;
      input.readOnly = true;
      input.addEventListener('click', () => input.select());

      const copyBtn = document.createElement('button');
      copyBtn.className = 'hls-copy-btn';
      copyBtn.textContent = 'Copy';
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(command).then(() => {
          copyBtn.textContent = 'Copied!';
          copyBtn.classList.add('copied');
          setTimeout(() => {
            copyBtn.textContent = 'Copy';
            copyBtn.classList.remove('copied');
          }, 1500);
        }).catch(() => {
          input.select();
          document.execCommand('copy');
        });
      });

      row.appendChild(input);
      row.appendChild(copyBtn);
      commandsEl.appendChild(row);
    });

    sectionEl.style.display = 'block';
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

    const dlCircle = document.createElement('div');
    dlCircle.className = 'dl-circle';
    dlCircle.innerHTML = `<svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <path d="M8 4v8m0 0L5.5 9.5M8 12l2.5-2.5" stroke="#192a51" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
    downloadOverlay.appendChild(dlCircle);

    console.log(`Loading thumbnail ${index + 1}:`, image.thumbnailUrl);

    img.onerror = () => {
      console.log(`Thumbnail loading failed ${index + 1}:`, image.thumbnailUrl);
      img.src = this._getDefaultImageDataUrl();
    };

    if (image.mediaType === 'video') {
      const videoBadge = document.createElement('div');
      videoBadge.className = 'video-badge';
      videoBadge.textContent = image.isHLS ? 'HLS' : 'VIDEO';
      imageItem.appendChild(videoBadge);
    }

    if (image.isHLS) {
      const command = `yt-dlp "${image.fullSizeUrl}"`;
      dlCircle.innerHTML = `<svg width="13" height="13" viewBox="0 0 16 16" fill="none">
        <path d="M10.5 8H5.5M8 5.5L5.5 8 8 10.5" stroke="#192a51" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;
      imageItem.title = 'Click to copy yt-dlp command';
      imageItem.addEventListener('click', () => {
        navigator.clipboard.writeText(command).then(() => {
          const circle = imageItem.querySelector('.dl-circle');
          const original = circle.innerHTML;
          circle.innerHTML = `<svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path d="M3 8.5l3.5 3.5 6.5-8" stroke="#70c4a0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>`;
          imageItem.classList.add('downloaded');
          setTimeout(() => {
            imageItem.classList.remove('downloaded');
            circle.innerHTML = original;
          }, 1500);
        }).catch(() => {});
      });
    } else {
      imageItem.addEventListener('click', async () => {
        await this._downloadSingleImage(image, index + 1, imageItem);
      });
    }

    imageItem.appendChild(img);
    imageItem.appendChild(downloadOverlay);

    return imageItem;
  }

  async _downloadSingleImage(image, index, imageItem) {
    const circle = imageItem.querySelector('.dl-circle');

    const checkSVG = `<svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <path d="M3 8.5l3.5 3.5 6.5-8" stroke="#f5e6e8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
    const dlSVG = `<svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <path d="M8 4v8m0 0L5.5 9.5M8 12l2.5-2.5" stroke="#192a51" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;

    try {
      imageItem.classList.add('downloading');

      await chrome.runtime.sendMessage({
        action: BACKGROUND_MESSAGES.DOWNLOAD_SINGLE_IMAGE,
        image,
        index
      });

      imageItem.classList.remove('downloading');
      imageItem.classList.add('downloaded');
      if (circle) circle.innerHTML = checkSVG;

      setTimeout(() => {
        imageItem.classList.remove('downloaded');
        if (circle) circle.innerHTML = dlSVG;
      }, 2000);
    } catch (error) {
      console.error('Single download failed:', error);
      imageItem.classList.remove('downloading');
      if (circle) circle.innerHTML = dlSVG;
    }
  }

  _initializeDownloadButtons() {
    this.downloadAllBtnEl.addEventListener('click', async () => {
      await this._downloadBatch(this.currentImages, this.downloadAllBtnEl, 'Download All');
    });

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

    const originalLabel = btn.textContent;

    try {
      btn.disabled = true;
      btn.textContent = defaultLabel;

      await chrome.runtime.sendMessage({
        action: BACKGROUND_MESSAGES.DOWNLOAD_IMAGES,
        images: items
      });

      this._notifyDownloadSuccess();

      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = originalLabel;
      }, 2000);
    } catch (err) {
      console.error('Download failed:', err);
      btn.disabled = false;
      btn.textContent = 'Failed — retry';

      setTimeout(() => {
        btn.textContent = originalLabel;
      }, 2000);
    }
  }

  _notifyDownloadSuccess() {
    const event = new CustomEvent('downloadSuccess');
    document.dispatchEvent(event);
  }

  _getDefaultImageDataUrl() {
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiNGMEYyRjUiLz48dGV4dCB4PSI1MCIgeT0iNTQiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjEwIiBmaWxsPSIjOUJBNUIwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5ObyBwcmV2aWV3PC90ZXh0Pjwvc3ZnPg==';
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
