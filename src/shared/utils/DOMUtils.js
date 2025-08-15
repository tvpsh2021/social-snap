/**
 * DOM utility functions for consistent DOM operations across the extension
 * Provides element waiting, observation, validation, and sanitization functions
 */
class DOMUtils {
  /**
   * Wait for an element to appear in the DOM
   * @param {string} selector - CSS selector for the element
   * @param {Object} options - Configuration options
   * @param {number} options.timeout - Maximum time to wait in milliseconds (default: 5000)
   * @param {Element} options.root - Root element to search within (default: document)
   * @param {boolean} options.visible - Whether element must be visible (default: false)
   * @returns {Promise<Element>} Promise that resolves with the found element
   */
  static waitForElement(selector, options = {}) {
    const {
      timeout = 5000,
      root = document,
      visible = false
    } = options;

    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      // Check if element already exists
      const existingElement = root.querySelector(selector);
      if (existingElement && (!visible || this.isElementVisible(existingElement))) {
        resolve(existingElement);
        return;
      }

      // Set up observer
      const observer = new MutationObserver((mutations) => {
        const element = root.querySelector(selector);
        if (element && (!visible || this.isElementVisible(element))) {
          observer.disconnect();
          resolve(element);
          return;
        }

        // Check timeout
        if (Date.now() - startTime > timeout) {
          observer.disconnect();
          reject(new Error(`Element "${selector}" not found within ${timeout}ms`));
        }
      });

      observer.observe(root, {
        childList: true,
        subtree: true,
        attributes: visible ? true : false,
        attributeFilter: visible ? ['style', 'class'] : undefined
      });

      // Set timeout fallback
      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Element "${selector}" not found within ${timeout}ms`));
      }, timeout);
    });
  }

  /**
   * Wait for multiple elements to appear in the DOM
   * @param {string[]} selectors - Array of CSS selectors
   * @param {Object} options - Configuration options
   * @returns {Promise<Element[]>} Promise that resolves with array of found elements
   */
  static waitForElements(selectors, options = {}) {
    const promises = selectors.map(selector => this.waitForElement(selector, options));
    return Promise.all(promises);
  }

  /**
   * Check if an element is visible in the viewport
   * @param {Element} element - Element to check
   * @returns {boolean} True if element is visible
   */
  static isElementVisible(element) {
    if (!element) return false;

    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }

    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  /**
   * Check if an element is in the viewport
   * @param {Element} element - Element to check
   * @param {number} threshold - Percentage of element that must be visible (0-1)
   * @returns {boolean} True if element is in viewport
   */
  static isElementInViewport(element, threshold = 0) {
    if (!element) return false;

    const rect = element.getBoundingClientRect();
    const windowHeight = window.innerHeight || document.documentElement.clientHeight;
    const windowWidth = window.innerWidth || document.documentElement.clientWidth;

    const verticalVisible = Math.max(0, Math.min(rect.bottom, windowHeight) - Math.max(rect.top, 0));
    const horizontalVisible = Math.max(0, Math.min(rect.right, windowWidth) - Math.max(rect.left, 0));

    const elementArea = rect.width * rect.height;
    const visibleArea = verticalVisible * horizontalVisible;

    return elementArea > 0 && (visibleArea / elementArea) >= threshold;
  }

  /**
   * Observe element changes with a callback
   * @param {Element} element - Element to observe
   * @param {Function} callback - Callback function to execute on changes
   * @param {Object} options - MutationObserver options
   * @returns {MutationObserver} The observer instance
   */
  static observeElement(element, callback, options = {}) {
    const defaultOptions = {
      childList: true,
      subtree: true,
      attributes: true,
      attributeOldValue: true,
      characterData: true,
      characterDataOldValue: true
    };

    const observerOptions = { ...defaultOptions, ...options };

    const observer = new MutationObserver((mutations) => {
      callback(mutations, observer);
    });

    observer.observe(element, observerOptions);
    return observer;
  }

  /**
   * Safely query selector with error handling
   * @param {string} selector - CSS selector
   * @param {Element} root - Root element to search within
   * @returns {Element|null} Found element or null
   */
  static safeQuerySelector(selector, root = document) {
    try {
      return root.querySelector(selector);
    } catch (error) {
      console.warn(`Invalid selector "${selector}":`, error);
      return null;
    }
  }

  /**
   * Safely query all selectors with error handling
   * @param {string} selector - CSS selector
   * @param {Element} root - Root element to search within
   * @returns {NodeList|Array} Found elements or empty array
   */
  static safeQuerySelectorAll(selector, root = document) {
    try {
      return root.querySelectorAll(selector);
    } catch (error) {
      console.warn(`Invalid selector "${selector}":`, error);
      return [];
    }
  }

  /**
   * Get element text content safely
   * @param {Element} element - Element to get text from
   * @param {boolean} trim - Whether to trim whitespace
   * @returns {string} Element text content or empty string
   */
  static getElementText(element, trim = true) {
    if (!element) return '';

    const text = element.textContent || element.innerText || '';
    return trim ? text.trim() : text;
  }

  /**
   * Get element attribute safely
   * @param {Element} element - Element to get attribute from
   * @param {string} attribute - Attribute name
   * @param {string} defaultValue - Default value if attribute doesn't exist
   * @returns {string} Attribute value or default value
   */
  static getElementAttribute(element, attribute, defaultValue = '') {
    if (!element || !element.getAttribute) return defaultValue;

    const value = element.getAttribute(attribute);
    return value !== null ? value : defaultValue;
  }

  /**
   * Validate if element is a valid DOM element
   * @param {*} element - Element to validate
   * @returns {boolean} True if valid DOM element
   */
  static isValidElement(element) {
    return element &&
           element.nodeType === Node.ELEMENT_NODE &&
           typeof element.tagName === 'string';
  }

  /**
   * Validate if element is an image element
   * @param {Element} element - Element to validate
   * @returns {boolean} True if valid image element
   */
  static isImageElement(element) {
    if (!this.isValidElement(element)) return false;

    const tagName = element.tagName.toLowerCase();
    return tagName === 'img' ||
           (tagName === 'picture' && element.querySelector('img')) ||
           (element.style && element.style.backgroundImage && element.style.backgroundImage !== 'none');
  }

  /**
   * Sanitize HTML content to prevent XSS
   * @param {string} html - HTML content to sanitize
   * @returns {string} Sanitized HTML content
   */
  static sanitizeHTML(html) {
    if (typeof html !== 'string') return '';

    // Create a temporary div to parse HTML
    const temp = document.createElement('div');
    temp.textContent = html; // This automatically escapes HTML
    return temp.innerHTML;
  }

  /**
   * Create element with attributes and content
   * @param {string} tagName - HTML tag name
   * @param {Object} attributes - Element attributes
   * @param {string|Element|Element[]} content - Element content
   * @returns {Element} Created element
   */
  static createElement(tagName, attributes = {}, content = null) {
    const element = document.createElement(tagName);

    // Set attributes
    Object.entries(attributes).forEach(([key, value]) => {
      if (key === 'className') {
        element.className = value;
      } else if (key === 'style' && typeof value === 'object') {
        Object.assign(element.style, value);
      } else {
        element.setAttribute(key, value);
      }
    });

    // Set content
    if (content !== null) {
      if (typeof content === 'string') {
        element.textContent = content;
      } else if (content instanceof Element) {
        element.appendChild(content);
      } else if (Array.isArray(content)) {
        content.forEach(child => {
          if (child instanceof Element) {
            element.appendChild(child);
          }
        });
      }
    }

    return element;
  }

  /**
   * Remove element safely
   * @param {Element} element - Element to remove
   * @returns {boolean} True if element was removed
   */
  static removeElement(element) {
    if (!this.isValidElement(element)) return false;

    try {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
        return true;
      }
    } catch (error) {
      console.warn('Error removing element:', error);
    }

    return false;
  }

  /**
   * Debounce function calls
   * @param {Function} func - Function to debounce
   * @param {number} wait - Wait time in milliseconds
   * @param {boolean} immediate - Whether to execute immediately
   * @returns {Function} Debounced function
   */
  static debounce(func, wait, immediate = false) {
    let timeout;

    return function executedFunction(...args) {
      const later = () => {
        timeout = null;
        if (!immediate) func.apply(this, args);
      };

      const callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);

      if (callNow) func.apply(this, args);
    };
  }

  /**
   * Throttle function calls
   * @param {Function} func - Function to throttle
   * @param {number} limit - Time limit in milliseconds
   * @returns {Function} Throttled function
   */
  static throttle(func, limit) {
    let inThrottle;

    return function executedFunction(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  /**
   * Batch DOM queries for better performance
   * @param {string[]} selectors - Array of CSS selectors
   * @param {Element} root - Root element to search within (default: document)
   * @returns {Map<string, Element[]>} Map of selector to found elements
   */
  static batchQuerySelectors(selectors, root = document) {
    const results = new Map();

    // Use DocumentFragment for better performance if available
    const fragment = root === document ? document : root;

    selectors.forEach(selector => {
      try {
        const elements = Array.from(fragment.querySelectorAll(selector));
        results.set(selector, elements);
      } catch (error) {
        console.warn(`Invalid selector "${selector}":`, error);
        results.set(selector, []);
      }
    });

    return results;
  }

  /**
   * Optimized element visibility check with caching
   * @param {Element} element - Element to check
   * @param {boolean} useCache - Whether to use cached results
   * @returns {boolean} True if element is visible
   */
  static isElementVisibleOptimized(element, useCache = true) {
    if (!this.isValidElement(element)) return false;

    // Use cached result if available and requested
    if (useCache && element._visibilityCache) {
      const cache = element._visibilityCache;
      if (Date.now() - cache.timestamp < 100) { // Cache for 100ms
        return cache.visible;
      }
    }

    const visible = this.isElementVisible(element);

    // Cache result
    if (useCache) {
      element._visibilityCache = {
        visible,
        timestamp: Date.now()
      };
    }

    return visible;
  }

  /**
   * Optimized wait for multiple elements
   * @param {string[]} selectors - Array of CSS selectors
   * @param {Object} options - Configuration options
   * @returns {Promise<Map<string, Element>>} Promise that resolves with found elements
   */
  static async waitForElements(selectors, options = {}) {
    const { timeout = 5000, root = document } = options;
    const results = new Map();
    const pending = new Set(selectors);

    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      // Check existing elements first
      selectors.forEach(selector => {
        const element = root.querySelector(selector);
        if (element) {
          results.set(selector, element);
          pending.delete(selector);
        }
      });

      // If all found, resolve immediately
      if (pending.size === 0) {
        resolve(results);
        return;
      }

      // Set up observer for remaining elements
      const observer = new MutationObserver(() => {
        pending.forEach(selector => {
          const element = root.querySelector(selector);
          if (element) {
            results.set(selector, element);
            pending.delete(selector);
          }
        });

        // Check if all found or timeout
        if (pending.size === 0) {
          observer.disconnect();
          resolve(results);
        } else if (Date.now() - startTime > timeout) {
          observer.disconnect();
          reject(new Error(`Timeout waiting for elements: ${Array.from(pending).join(', ')}`));
        }
      });

      observer.observe(root, {
        childList: true,
        subtree: true
      });
    });
  }

  /**
   * Memory-efficient element cleanup
   * @param {Element} element - Element to clean up
   */
  static cleanupElement(element) {
    if (!this.isValidElement(element)) return;

    // Clear cached data
    delete element._visibilityCache;

    // Remove all event listeners by cloning
    if (element.parentNode) {
      const clone = element.cloneNode(true);
      element.parentNode.replaceChild(clone, element);
    }
  }

  /**
   * Batch cleanup of elements
   * @param {Element[]} elements - Array of elements to clean up
   */
  static batchCleanupElements(elements) {
    if (!Array.isArray(elements)) return;

    // Use requestAnimationFrame for better performance
    const cleanup = () => {
      const batch = elements.splice(0, 10); // Process 10 at a time
      batch.forEach(element => this.cleanupElement(element));

      if (elements.length > 0) {
        requestAnimationFrame(cleanup);
      }
    };

    requestAnimationFrame(cleanup);
  }
}

export default DOMUtils;
