/**
 * Bundled background script for Social Media Image Downloader
 */

// === SHARED UTILS ===
function getFileExtension(url) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const match = pathname.match(/\.(jpg|jpeg|png|gif|webp|mp4)$/i);
    if (match) {
      return match[1].toLowerCase();
    }

    const searchParams = urlObj.searchParams;
    if (searchParams.has('format')) {
      return searchParams.get('format');
    }

    if (url.includes('mp4')) return 'mp4';
    if (url.includes('jpg') || url.includes('jpeg')) return 'jpg';
    if (url.includes('png')) return 'png';
    if (url.includes('webp')) return 'webp';
    if (url.includes('gif')) return 'gif';

    return 'jpg';
  } catch (error) {
    console.log('Unable to parse URL, using default extension jpg');
    console.error(error);
    return 'jpg';
  }
}

// === MESSAGE TYPES ===
const CONTENT_MESSAGES = {
  IMAGES_EXTRACTED: 'imagesExtracted',
  IMAGES_APPEND: 'imagesAppend',
  EXTRACTION_COMPLETE: 'extractionComplete',
  EXTRACTION_ERROR: 'extractionError'
};

const POPUP_MESSAGES = {
  GET_CURRENT_IMAGES: 'getCurrentImages'
};

const BACKGROUND_MESSAGES = {
  DOWNLOAD_IMAGES: 'downloadImages',
  DOWNLOAD_SINGLE_IMAGE: 'downloadSingleImage',
  FETCH_FB_VIDEO_URL: 'fetchFbVideoUrl'
};

// === DATA MANAGER ===
class DataManager {
  async storeImages(tabId, images) {
    await chrome.storage.session.set({ [String(tabId)]: images });
  }

  async appendImages(tabId, newImages) {
    const key = String(tabId);
    const result = await chrome.storage.session.get(key);
    const existing = result[key] || [];
    await chrome.storage.session.set({ [key]: [...existing, ...newImages] });
  }

  async getStoredImages(tabId) {
    const key = String(tabId);
    const result = await chrome.storage.session.get(key);
    return result[key] || [];
  }

  async clearTabData(tabId) {
    await chrome.storage.session.remove(String(tabId));
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
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
        const extension = getFileExtension(image.fullSizeUrl);
        const mediaType = image.mediaType === 'video' ? 'video' : 'image';
        const filename = `${platformName}_${mediaType}_${timestamp}_${i + 1}.${extension}`;

        await chrome.downloads.download({
          url: image.fullSizeUrl,
          filename
        });

        console.log(`Download ${mediaType} ${i + 1}/${images.length}: ${filename}`);

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

      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
      const extension = getFileExtension(image.fullSizeUrl);
      const mediaType = image.mediaType === 'video' ? 'video' : 'image';
      const filename = `${platformName}_${mediaType}_${timestamp}_${index}.${extension}`;

      await chrome.downloads.download({
        url: image.fullSizeUrl,
        filename
      });

      console.log(`Download single ${mediaType}: ${filename}`);
    } catch (error) {
      console.error('Download single image failed:', error);
      throw error;
    }
  }
}

// === INITIALIZE MANAGERS ===
const dataManager = new DataManager();
const downloadManager = new DownloadManager();

// In-memory set tracking tabs with ongoing extractions.
// Best-effort: cleared if service worker is killed and restarts.
const extractingTabs = new Set();

// === FACEBOOK VIDEO URL COLLECTOR ===
// Passively collects Facebook video MP4 URLs via webRequest.
// Each URL's `efg` query param contains base64 JSON with video_id and bitrate,
// allowing precise filtering by video and quality selection.
const fbVideoUrls = new Map(); // videoId -> { url, bitrate }

function cleanFbVideoUrl(url) {
  try {
    const urlObj = new URL(url);
    urlObj.searchParams.delete('bytestart');
    urlObj.searchParams.delete('byteend');
    return urlObj.toString();
  } catch {
    return url;
  }
}

function parseEfgParam(url) {
  try {
    const efg = new URL(url).searchParams.get('efg');
    if (!efg) return null;
    const decoded = JSON.parse(atob(decodeURIComponent(efg)));
    return {
      videoId: decoded.video_id ? String(decoded.video_id) : null,
      bitrate: decoded.bitrate || 0
    };
  } catch {
    return null;
  }
}

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (!details.url.includes('.mp4')) return;
    const meta = parseEfgParam(details.url);
    if (!meta || !meta.videoId) return;

    const existing = fbVideoUrls.get(meta.videoId);
    if (!existing || meta.bitrate > existing.bitrate) {
      fbVideoUrls.set(meta.videoId, {
        url: cleanFbVideoUrl(details.url),
        bitrate: meta.bitrate
      });
    }
  },
  { urls: ['*://*.fbcdn.net/*'] }
);

// === MESSAGE LISTENERS ===
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Handle messages from content scripts
  if (sender.tab) {
    if (request.action === CONTENT_MESSAGES.IMAGES_EXTRACTED) {
      (async () => {
        await dataManager.storeImages(sender.tab.id, request.images);
        extractingTabs.delete(sender.tab.id);
      })();
      return;
    }

    if (request.action === CONTENT_MESSAGES.IMAGES_APPEND) {
      (async () => {
        await dataManager.appendImages(sender.tab.id, request.images);
        extractingTabs.add(sender.tab.id);
        chrome.runtime.sendMessage({
          action: CONTENT_MESSAGES.IMAGES_APPEND,
          images: request.images,
          tabId: sender.tab.id
        }).catch(() => {});
      })();
      return;
    }

    if (request.action === CONTENT_MESSAGES.EXTRACTION_COMPLETE) {
      (async () => {
        extractingTabs.delete(sender.tab.id);
        chrome.runtime.sendMessage({
          action: CONTENT_MESSAGES.EXTRACTION_COMPLETE,
          tabId: sender.tab.id
        }).catch(() => {});
      })();
      return;
    }

    if (request.action === CONTENT_MESSAGES.EXTRACTION_ERROR) {
      (async () => {
        console.error(`Content script error in tab ${sender.tab.id}:`, request.error);
        await dataManager.storeImages(sender.tab.id, []);
        extractingTabs.delete(sender.tab.id);
      })();
      return;
    }
  }

  // Handle messages from popup or other extension parts
  switch (request.action) {
  case POPUP_MESSAGES.GET_CURRENT_IMAGES:
    if (request.tabId) {
      (async () => {
        const images = await dataManager.getStoredImages(request.tabId);
        const extracting = extractingTabs.has(request.tabId);
        sendResponse({ images, extracting });
      })();
      return true; // Keep channel open for async sendResponse
    }
    break;

  case BACKGROUND_MESSAGES.DOWNLOAD_IMAGES:
    downloadManager.downloadAllImages(request.images)
      .then(() => sendResponse({ success: true }))
      .catch(error => {
        console.error('Download all images failed:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;

  case BACKGROUND_MESSAGES.DOWNLOAD_SINGLE_IMAGE:
    downloadManager.downloadSingleImage(request.image, request.index)
      .then(() => sendResponse({ success: true }))
      .catch(error => {
        console.error('Download single image failed:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;

  case BACKGROUND_MESSAGES.FETCH_FB_VIDEO_URL: {
    const cached = fbVideoUrls.get(request.videoId);
    if (cached) {
      sendResponse({ success: true, videoUrl: cached.url });
    } else {
      sendResponse({ success: false, error: `No video URL found for videoId ${request.videoId}` });
    }
    break;
  }
  }
});

// === TAB MANAGEMENT ===
// Clean up data when a tab is closed to prevent memory leaks
chrome.tabs.onRemoved.addListener((tabId) => {
  extractingTabs.delete(tabId);
  dataManager.clearTabData(tabId);
});
