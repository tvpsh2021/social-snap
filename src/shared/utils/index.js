/**
 * Utility functions index
 * Exports all utility classes for easy importing
 */

import DOMUtils from './DOMUtils.js';
import URLUtils from './URLUtils.js';
import ValidationUtils from './ValidationUtils.js';

/**
 * Get file extension from URL
 * @param {string} url - Image URL
 * @returns {string} File extension
 */
export function getFileExtension(url) {
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

export {
  DOMUtils,
  URLUtils,
  ValidationUtils
};

export default {
  DOMUtils,
  URLUtils,
  ValidationUtils
};
