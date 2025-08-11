/**
 * Shared utility functions
 */

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

/**
 * Generate filename for downloaded image
 * @param {string} platformName - Platform name
 * @param {number} index - Image index
 * @param {string} url - Image URL
 * @returns {string} Generated filename
 */
export function generateFilename(platformName, index, url) {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
  const extension = getFileExtension(url);
  return `${platformName}_image_${timestamp}_${index}.${extension}`;
}

/**
 * Wait for a specified amount of time
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
export function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wait for an element to appear on the page
 * @param {string} selector - CSS selector to wait for
 * @param {number} timeout - Maximum time to wait in milliseconds
 * @returns {Promise<Element|null>}
 */
export function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve) => {
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }

    const observer = new MutationObserver((mutations) => {
      const element = document.querySelector(selector);
      if (element) {
        observer.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeout);
  });
}

/**
 * Detect current platform from hostname
 * @param {string} hostname - Current page hostname
 * @returns {string|null} Platform name or null if unsupported
 */
export function detectPlatform(hostname) {
  if (hostname.includes('threads.com')) return 'threads';
  if (hostname.includes('instagram.com')) return 'instagram';
  return null;
}
