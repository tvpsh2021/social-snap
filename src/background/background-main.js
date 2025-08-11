/**
 * Main background script for Social Media Image Downloader
 */

import { DownloadManager } from './download-manager.js';
import { CONTENT_MESSAGES, BACKGROUND_MESSAGES } from '../shared/message-types.js';

// Initialize download manager
const downloadManager = new DownloadManager();

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === CONTENT_MESSAGES.IMAGES_EXTRACTED) {
    downloadManager.storeImages(request.images);
  } else if (request.action === CONTENT_MESSAGES.EXTRACTION_ERROR) {
    console.error('Content script extraction error:', request.error);
  }
});

// Handle download requests
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === BACKGROUND_MESSAGES.DOWNLOAD_IMAGES) {
    downloadManager.downloadAllImages(request.images)
      .then(() => {
        sendResponse({ success: true });
      })
      .catch(error => {
        console.error('Download all images failed:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open for async response
  } else if (request.action === BACKGROUND_MESSAGES.DOWNLOAD_SINGLE_IMAGE) {
    downloadManager.downloadSingleImage(request.image, request.index)
      .then(() => {
        sendResponse({ success: true });
      })
      .catch(error => {
        console.error('Download single image failed:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open for async response
  }
});

// Function to get current image information
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getCurrentImages') {
    sendResponse({ images: downloadManager.getStoredImages() });
  }
});
