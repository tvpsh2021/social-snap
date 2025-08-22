/**
 * Bundled background script for Social Media Image Downloader
 */

// === SHARED UTILS ===
function getFileExtension(url) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const match = pathname.match(/\.(jpg|jpeg|png|gif|webp)$/i);
    if (match) {
      return match[1].toLowerCase();
    }

    const searchParams = urlObj.searchParams;
    if (searchParams.has('format')) {
      return searchParams.get('format');
    }

    if (url.includes('jpg') || url.includes('jpeg')) return 'jpg';
    if (url.includes('png')) return 'png';
    if (url.includes('webp')) return 'webp';
    if (url.includes('gif')) return 'gif';

    return 'jpg';
  } catch (error) {
    console.log('Unable to parse URL, using default extension jpg');
    return 'jpg';
  }
}

// === MESSAGE TYPES ===
const CONTENT_MESSAGES = {
  IMAGES_EXTRACTED: 'imagesExtracted',
  EXTRACTION_ERROR: 'extractionError'
};

const POPUP_MESSAGES = {
  GET_CURRENT_IMAGES: 'getCurrentImages'
};

const BACKGROUND_MESSAGES = {
  DOWNLOAD_IMAGES: 'downloadImages',
  DOWNLOAD_SINGLE_IMAGE: 'downloadSingleImage'
};

// === DATA MANAGER ===
class DataManager {
  constructor() {
    this.tabImages = {}; // Use an object to store images per tabId
  }

  storeImages(tabId, images) {
    this.tabImages[tabId] = images;
    console.log(`Stored ${images.length} images for tab ${tabId}`);
  }

  getStoredImages(tabId) {
    return this.tabImages[tabId] || [];
  }

  clearTabData(tabId) {
    if (this.tabImages[tabId]) {
      delete this.tabImages[tabId];
      console.log(`Cleared image data for closed tab ${tabId}`);
    }
  }
}

// === DOWNLOAD MANAGER ===
class DownloadManager {
  async downloadAllImages(images) {
    // Detect platform from current tab
    // ⚠️ IMPORTANT: When adding new platform support, remember to add platform detection here
    // to avoid filenames becoming "unknown_xxxxx.jpg"
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    let platformName = 'unknown';

    if (tab.url.includes('threads.com')) {
      platformName = 'threads';
    } else if (tab.url.includes('instagram.com')) {
      platformName = 'instagram';
    } else if (tab.url.includes('facebook.com')) {
      platformName = 'facebook';
    } else if (tab.url.includes('x.com')) {
      platformName = 'x';
    }

    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      try {
        // Generate filename with platform name
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
        const extension = getFileExtension(image.fullSizeUrl);
        const filename = `${platformName}_image_${timestamp}_${i + 1}.${extension}`;

        // Start download
        await chrome.downloads.download({
          url: image.fullSizeUrl,
          filename
        });

        console.log(`Download image ${i + 1}/${images.length}: ${filename}`);

        // Add small delay to avoid downloading too many files simultaneously
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Download image ${i + 1} failed:`, error);
      }
    }
  }

  async downloadSingleImage(image, index) {
    try {
      // Detect platform from current tab
      // ⚠️ IMPORTANT: When adding new platform support, remember to add platform detection here
      // to avoid filenames becoming "unknown_xxxxx.jpg"
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      let platformName = 'unknown';

      if (tab.url.includes('threads.com')) {
        platformName = 'threads';
      } else if (tab.url.includes('instagram.com')) {
        platformName = 'instagram';
      } else if (tab.url.includes('facebook.com')) {
        platformName = 'facebook';
      } else if (tab.url.includes('x.com')) {
        platformName = 'x';
      }

      // Generate filename with platform name
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
      const extension = getFileExtension(image.fullSizeUrl);
      const filename = `${platformName}_image_${timestamp}_${index}.${extension}`;

      // Start download
      await chrome.downloads.download({
        url: image.fullSizeUrl,
        filename
      });

      console.log(`Download single image: ${filename}`);
    } catch (error) {
      console.error('Download single image failed:', error);
      throw error;
    }
  }
}

// === INITIALIZE MANAGERS ===
const dataManager = new DataManager();
const downloadManager = new DownloadManager();

// === MESSAGE LISTENERS ===
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Handle messages from content scripts
  if (sender.tab) {
    if (request.action === CONTENT_MESSAGES.IMAGES_EXTRACTED) {
      dataManager.storeImages(sender.tab.id, request.images);
      return; // No response needed
    } else if (request.action === CONTENT_MESSAGES.EXTRACTION_ERROR) {
      console.error(`Content script error in tab ${sender.tab.id}:`, request.error);
      dataManager.storeImages(sender.tab.id, []); // Clear images on error
      return; // No response needed
    }
  }

  // Handle messages from popup or other extension parts
  switch (request.action) {
  case POPUP_MESSAGES.GET_CURRENT_IMAGES:
    if (request.tabId) {
      const images = dataManager.getStoredImages(request.tabId);
      sendResponse({ images });
    }
    break;

  case BACKGROUND_MESSAGES.DOWNLOAD_IMAGES:
    downloadManager.downloadAllImages(request.images)
      .then(() => sendResponse({ success: true }))
      .catch(error => {
        console.error('Download all images failed:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Indicates async response

  case BACKGROUND_MESSAGES.DOWNLOAD_SINGLE_IMAGE:
    downloadManager.downloadSingleImage(request.image, request.index)
      .then(() => sendResponse({ success: true }))
      .catch(error => {
        console.error('Download single image failed:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Indicates async response
  }
});

// === TAB MANAGEMENT ===
// Clean up data when a tab is closed to prevent memory leaks
chrome.tabs.onRemoved.addListener((tabId) => {
  dataManager.clearTabData(tabId);
});
