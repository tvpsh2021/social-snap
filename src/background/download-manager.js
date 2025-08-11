/**
 * Download manager for handling image downloads
 */

import { getFileExtension } from '../shared/utils.js';

export class DownloadManager {
  constructor() {
    this.currentImages = [];
  }

  /**
   * Store current page's image information
   * @param {Array} images - Array of image data objects
   */
  storeImages(images) {
    this.currentImages = images;
    console.log(`Background script received ${images.length} image information`);
  }

  /**
   * Get stored images
   * @returns {Array} Array of stored images
   */
  getStoredImages() {
    return this.currentImages;
  }

  /**
   * Download all images
   * @param {Array} images - Array of image data objects
   */
  async downloadAllImages(images) {
    // Detect platform from current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    let platformName = 'unknown';

    if (tab.url.includes('threads.com')) {
      platformName = 'threads';
    } else if (tab.url.includes('instagram.com')) {
      platformName = 'instagram';
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

  /**
   * Download single image
   * @param {Object} image - Image data object
   * @param {number} index - Image index
   */
  async downloadSingleImage(image, index) {
    try {
      // Detect platform from current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      let platformName = 'unknown';

      if (tab.url.includes('threads.com')) {
        platformName = 'threads';
      } else if (tab.url.includes('instagram.com')) {
        platformName = 'instagram';
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
