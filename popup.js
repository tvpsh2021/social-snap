// Popup JavaScript

let currentImages = [];

// DOM elements
const loading = document.getElementById('loading');
const error = document.getElementById('error');
const success = document.getElementById('success');
const content = document.getElementById('content');
const imageCount = document.getElementById('image-count');
const imagesGrid = document.getElementById('images-grid');
const downloadBtn = document.getElementById('download-btn');

// Initialize popup
async function init() {
  try {
    // First try to get stored image information from background script
    const response = await chrome.runtime.sendMessage({ action: 'getCurrentImages' });

    if (response && response.images && response.images.length > 0) {
      displayImages(response.images);
    } else {
      // If no stored image information, try to extract from current page
      await extractImagesFromCurrentTab();
    }
  } catch (err) {
    console.error('Initialization failed:', err);
    showError();
  }
}

// Extract images from current tab
async function extractImagesFromCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.url.includes('threads.com')) {
      showError();
      return;
    }

    // Send message to content script
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractImages' });

    if (response && response.images && response.images.length > 0) {
      displayImages(response.images);
    } else {
      showError();
    }
  } catch (err) {
    console.error('Image extraction failed:', err);
    showError();
  }
}

// 顯示圖片
function displayImages(images) {
  currentImages = images;

  // Hide loading and error messages
  loading.style.display = 'none';
  error.style.display = 'none';

  // Display image count
  imageCount.textContent = `Found ${images.length} images`;

  // Clear and populate image grid
  imagesGrid.innerHTML = '';

  images.forEach((image, index) => {
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
    img.onerror = function() {
      console.log(`Thumbnail loading failed ${index + 1}, trying original URL:`, image.thumbnailUrl);

      // First try original src URL
      if (this.src !== image.fullSizeUrl) {
        this.src = image.fullSizeUrl;
        return;
      }

      // If still fails, show default image
      this.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiBmaWxsPSIjRjBGMkY1Ii8+CjxwYXRoIGQ9Ik01MCA3NUMzOS4yIDc1IDI4LjkgNzAuNyAyMS4yIDYzQzEzLjUgNTUuMyA5LjIgNDUgOS4yIDM0LjJDOS4yIDIzLjQgMTMuNSAxMy4xIDIxLjIgNS40QzI4LjkgLTIuMyAzOS4yIC02LjYgNTAgLTYuNkM2MC44IC02LjYgNzEuMSAtMi4zIDc4LjggNS40Qzg2LjUgMTMuMSA5MC44IDIzLjQgOTAuOCAzNC4yQzkwLjggNDUgODYuNSA1NS4zIDc4LjggNjNDNzEuMSA3MC43IDYwLjggNzUgNTAgNzVaTTUwIDY3QzU4LjMgNjcgNjYuMiA2My44IDcyIDU4Qzc3LjggNTIuMiA4MSA0NC4zIDgxIDM2QzgxIDI3LjcgNzcuOCAxOS44IDcyIDE0QzY2LjIgOC4yIDU4LjMgNSA1MCA1QzQxLjcgNSAzMy44IDguMiAyOCAxNEMyMi4yIDE5LjggMTkgMjcuNyAxOSAzNkMxOSA0NC4zIDIyLjIgNTIuMiAyOCA1OEMzMy44IDYzLjggNDEuNyA2NyA1MCA2N1oiIGZpbGw9IiNDQ0QyRDkiLz4KPHBhdGggZD0iTTQzIDU1SDU3VjQxSDQzVjU1Wk00MyA2M0g1N1Y1NUg0M1Y2M1pNNDMgNTVINDNWMjlINTdWNDFINDNWNTVaIiBmaWxsPSIjQ0NEMkQ5Ii8+Cjx0ZXh0IHg9IjUwIiB5PSIyNSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTAiIGZpbGw9IiNDQ0QyRDkiIHRleHQtYW5jaG9yPSJtaWRkbGUiPuWcluePjzwvdGV4dD4KPC9zdmc+';
    };

    // Add click event to download single image
    imageItem.addEventListener('click', async() => {
      try {
        downloadOverlay.textContent = 'Downloading...';

        await chrome.runtime.sendMessage({
          action: 'downloadSingleImage',
          image,
          index: index + 1
        });

        downloadOverlay.textContent = 'Downloaded';
        setTimeout(() => {
          downloadOverlay.textContent = 'Click to Download';
        }, 1500);
      } catch (error) {
        console.error('Single download failed:', error);
        downloadOverlay.textContent = 'Download Failed';
        setTimeout(() => {
          downloadOverlay.textContent = 'Click to Download';
        }, 1500);
      }
    });

    imageItem.appendChild(img);
    imageItem.appendChild(downloadOverlay);
    imagesGrid.appendChild(imageItem);
  });

  // Show content area
  content.style.display = 'block';
}

// Show error
function showError() {
  loading.style.display = 'none';
  error.style.display = 'block';
  content.style.display = 'none';
}

// Show success message
function showSuccess() {
  success.style.display = 'block';
  setTimeout(() => {
    success.style.display = 'none';
  }, 3000);
}

// Download button click event
downloadBtn.addEventListener('click', async() => {
  if (currentImages.length === 0) {
    return;
  }

  try {
    downloadBtn.disabled = true;
    downloadBtn.textContent = 'Downloading...';

    // Send download request to background script
    await chrome.runtime.sendMessage({
      action: 'downloadImages',
      images: currentImages
    });

    showSuccess();

    // Reset button
    setTimeout(() => {
      downloadBtn.disabled = false;
      downloadBtn.textContent = 'Download All Images';
    }, 2000);
  } catch (err) {
    console.error('Download failed:', err);
    downloadBtn.disabled = false;
    downloadBtn.textContent = 'Download Failed, Please Retry';

    setTimeout(() => {
      downloadBtn.textContent = 'Download All Images';
    }, 2000);
  }
});

// Initialize
init();
