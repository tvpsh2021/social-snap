/**
 * Base class for platform-specific image extraction
 */

import { generateFilename } from '../../shared/utils.js';

export class BasePlatform {
  constructor() {
    this.platformName = 'base';
  }

  /**
   * Check if current page matches this platform
   * @returns {boolean}
   */
  isCurrentPlatform() {
    return false;
  }

  /**
   * Extract images from the current page
   * @returns {Array|Promise<Array>} Array of image data objects
   */
  extractImages() {
    return [];
  }

  /**
   * Generate filename for downloaded image
   * @param {number} index - Image index
   * @param {string} url - Image URL
   * @returns {string} Generated filename
   */
  generateFilename(index, url) {
    return generateFilename(this.platformName, index, url);
  }

  /**
   * Create image data object
   * @param {HTMLImageElement} img - Image element
   * @param {number} index - Image index
   * @returns {Object} Image data object
   */
  createImageData(img, index) {
    const src = img.src;
    const alt = img.alt;
    const srcset = img.srcset;

    // Parse srcset to find maximum size
    let maxSizeUrl = src;
    let maxWidth = 0;

    if (srcset) {
      const sources = srcset.split(',').map(s => s.trim());
      console.log(`Image ${index + 1} srcset options:`, sources);

      sources.forEach(source => {
        const parts = source.split(' ');
        if (parts.length >= 2) {
          const url = parts[0];
          const descriptor = parts[1];
          if (descriptor.endsWith('w')) {
            const width = parseInt(descriptor.slice(0, -1));
            console.log(`  - ${width}w: ${url.substring(0, 80)}...`);
            if (width > maxWidth) {
              maxWidth = width;
              maxSizeUrl = url;
            }
          }
        }
      });

      if (maxWidth > 0) {
        console.log(`Selected maximum size: ${maxWidth}w`);
      }
    }

    // Handle Instagram/Meta image URLs - preserve all necessary security parameters
    let thumbnailUrl = src;

    // If no larger size found, use original src
    if (maxWidth === 0) {
      maxSizeUrl = src;
    }

    // For thumbnails, try to modify size parameters without breaking other parameters
    if (src.includes('instagram.') || src.includes('fbcdn.net')) {
      // Instagram/Facebook CDN images, keep original URL as thumbnail
      thumbnailUrl = src;
      if (maxWidth === 0) {
        maxSizeUrl = src;
      }
    } else {
      // Non-Instagram images, can safely modify size parameters
      if (thumbnailUrl.includes('?')) {
        const baseUrl = thumbnailUrl.split('?')[0];
        thumbnailUrl = baseUrl + '?width=150&height=150';
      }
    }

    console.log(`Image ${index + 1}:`, {
      alt: alt.substring(0, 30) + '...',
      thumbnailUrl,
      fullSizeUrl: maxSizeUrl,
      maxWidth
    });

    return {
      index: index + 1,
      alt,
      thumbnailUrl,
      fullSizeUrl: maxSizeUrl,
      maxWidth
    };
  }
}
