/**
 * Main content script for Social Media Image Downloader
 */

import { PlatformFactory } from './platform-factory.js';
import { POPUP_MESSAGES, CONTENT_MESSAGES, createSuccessResponse, createErrorResponse } from '../shared/message-types.js';

/**
 * Main image extraction function that works across platforms
 */
async function extractImages() {
  console.log('=== Multi-platform image extraction started ===');
  console.log('Current URL:', window.location.href);

  const platform = PlatformFactory.createPlatform();

  if (!platform) {
    const error = `Unsupported platform: ${window.location.hostname}`;
    console.error(error);
    console.log('Supported platforms:', PlatformFactory.getSupportedPlatforms());
    throw new Error(error);
  }

  console.log(`Using ${platform.platformName} platform extractor`);

  try {
    const images = await platform.extractImages();
    console.log(`Successfully extracted ${images.length} images`);
    return images;
  } catch (error) {
    console.error('Image extraction failed:', error);
    throw error;
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === POPUP_MESSAGES.EXTRACT_IMAGES) {
    extractImages()
      .then(images => {
        sendResponse(createSuccessResponse({ images, count: images.length }));
      })
      .catch(error => {
        console.error('Image extraction error:', error);
        sendResponse(createErrorResponse(error, 'Failed to extract images'));
      });
    return true; // Keep the message channel open for async response
  }
});

// Automatically extract image information after page load
window.addEventListener('load', () => {
  setTimeout(async () => {
    try {
      const images = await extractImages();
      // Store image information in chrome.storage for popup use
      chrome.runtime.sendMessage({
        action: CONTENT_MESSAGES.IMAGES_EXTRACTED,
        images,
        count: images.length
      });
    } catch (error) {
      console.error('Auto-extraction error:', error);
      chrome.runtime.sendMessage({
        action: CONTENT_MESSAGES.EXTRACTION_ERROR,
        error: error.message,
        count: 0
      });
    }
  }, 2000); // Wait 2 seconds to ensure images are loaded
});
