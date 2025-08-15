/**
 * URL utility functions for parsing, validation, and filename generation
 * Provides consistent URL handling across the extension
 */
class URLUtils {
  /**
   * Validate if a string is a valid URL
   * @param {string} url - URL string to validate
   * @returns {boolean} True if valid URL
   */
  static isValidURL(url) {
    if (typeof url !== 'string' || !url.trim()) return false;

    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate if URL is a valid HTTP/HTTPS URL
   * @param {string} url - URL string to validate
   * @returns {boolean} True if valid HTTP/HTTPS URL
   */
  static isValidHTTPURL(url) {
    if (!this.isValidURL(url)) return false;

    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * Validate if URL points to an image resource
   * @param {string} url - URL string to validate
   * @returns {boolean} True if URL appears to be an image
   */
  static isImageURL(url) {
    if (!this.isValidURL(url)) return false;

    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname.toLowerCase();
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico'];

      return imageExtensions.some(ext => pathname.endsWith(ext)) ||
             urlObj.searchParams.has('format') ||
             pathname.includes('/image/') ||
             pathname.includes('/img/');
    } catch {
      return false;
    }
  }

  /**
   * Parse URL and return components
   * @param {string} url - URL string to parse
   * @returns {Object|null} URL components or null if invalid
   */
  static parseURL(url) {
    if (!this.isValidURL(url)) return null;

    try {
      const urlObj = new URL(url);
      return {
        href: urlObj.href,
        protocol: urlObj.protocol,
        hostname: urlObj.hostname,
        port: urlObj.port,
        pathname: urlObj.pathname,
        search: urlObj.search,
        hash: urlObj.hash,
        origin: urlObj.origin,
        searchParams: Object.fromEntries(urlObj.searchParams)
      };
    } catch {
      return null;
    }
  }

  /**
   * Get domain from URL
   * @param {string} url - URL string
   * @returns {string} Domain or empty string if invalid
   */
  static getDomain(url) {
    if (!this.isValidURL(url)) return '';

    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return '';
    }
  }

  /**
   * Check if URL belongs to a specific domain
   * @param {string} url - URL to check
   * @param {string} domain - Domain to match against
   * @returns {boolean} True if URL belongs to domain
   */
  static isDomainMatch(url, domain) {
    const urlDomain = this.getDomain(url);
    if (!urlDomain || !domain) return false;

    return urlDomain === domain || urlDomain.endsWith('.' + domain);
  }

  /**
   * Generate filename from URL
   * @param {string} url - URL to generate filename from
   * @param {Object} options - Generation options
   * @param {string} options.prefix - Prefix for filename
   * @param {string} options.suffix - Suffix for filename
   * @param {string} options.extension - Force specific extension
   * @param {number} options.maxLength - Maximum filename length
   * @returns {string} Generated filename
   */
  static generateFilename(url, options = {}) {
    const {
      prefix = '',
      suffix = '',
      extension = null,
      maxLength = 255
    } = options;

    if (!this.isValidURL(url)) {
      return this.sanitizeFilename(`${prefix}unknown${suffix}${extension || '.jpg'}`);
    }

    try {
      const urlObj = new URL(url);
      let filename = '';

      // Extract filename from pathname
      const pathParts = urlObj.pathname.split('/').filter(part => part);
      if (pathParts.length > 0) {
        const lastPart = pathParts[pathParts.length - 1];
        if (lastPart && !lastPart.includes('.')) {
          filename = lastPart;
        } else if (lastPart) {
          filename = lastPart.split('.')[0];
        }
      }

      // Fallback to domain if no filename found
      if (!filename) {
        filename = urlObj.hostname.replace(/^www\./, '');
      }

      // Add timestamp if filename is too generic
      if (filename.length < 3 || ['image', 'img', 'photo', 'pic'].includes(filename.toLowerCase())) {
        filename += '_' + Date.now();
      }

      // Determine extension
      let fileExtension = extension;
      if (!fileExtension) {
        const pathExtension = this.getFileExtensionFromURL(url);
        fileExtension = pathExtension || '.jpg';
      }

      // Construct full filename
      let fullFilename = `${prefix}${filename}${suffix}${fileExtension}`;

      // Truncate if too long
      if (fullFilename.length > maxLength) {
        const extensionLength = fileExtension.length;
        const maxBaseLength = maxLength - extensionLength - prefix.length - suffix.length;
        filename = filename.substring(0, maxBaseLength);
        fullFilename = `${prefix}${filename}${suffix}${fileExtension}`;
      }

      return this.sanitizeFilename(fullFilename);
    } catch {
      return this.sanitizeFilename(`${prefix}unknown_${Date.now()}${suffix}${extension || '.jpg'}`);
    }
  }

  /**
   * Get file extension from URL
   * @param {string} url - URL to extract extension from
   * @returns {string} File extension with dot or empty string
   */
  static getFileExtensionFromURL(url) {
    if (!this.isValidURL(url)) return '';

    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const lastDotIndex = pathname.lastIndexOf('.');

      if (lastDotIndex > -1 && lastDotIndex < pathname.length - 1) {
        const extension = pathname.substring(lastDotIndex).toLowerCase();
        // Validate it's a reasonable extension (not too long)
        if (extension.length <= 5 && /^\.[\w]+$/.test(extension)) {
          return extension;
        }
      }
    } catch {
      // Ignore parsing errors
    }

    return '';
  }

  /**
   * Sanitize filename to be safe for file systems
   * @param {string} filename - Filename to sanitize
   * @returns {string} Sanitized filename
   */
  static sanitizeFilename(filename) {
    if (typeof filename !== 'string') return 'unknown';

    // Replace invalid characters with underscores
    let sanitized = filename
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');

    // Ensure filename is not empty
    if (!sanitized) {
      sanitized = 'unknown';
    }

    // Handle reserved names on Windows
    const reservedNames = [
      'CON', 'PRN', 'AUX', 'NUL',
      'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
      'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
    ];

    const nameWithoutExt = sanitized.split('.')[0].toUpperCase();
    if (reservedNames.includes(nameWithoutExt)) {
      sanitized = '_' + sanitized;
    }

    return sanitized;
  }

  /**
   * Build URL with query parameters
   * @param {string} baseUrl - Base URL
   * @param {Object} params - Query parameters
   * @returns {string} URL with parameters
   */
  static buildURL(baseUrl, params = {}) {
    if (!this.isValidURL(baseUrl)) return baseUrl;

    try {
      const urlObj = new URL(baseUrl);

      Object.entries(params).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          urlObj.searchParams.set(key, String(value));
        }
      });

      return urlObj.toString();
    } catch {
      return baseUrl;
    }
  }

  /**
   * Remove query parameters from URL
   * @param {string} url - URL to clean
   * @param {string[]} paramsToRemove - Specific parameters to remove (optional)
   * @returns {string} Clean URL
   */
  static removeQueryParams(url, paramsToRemove = null) {
    if (!this.isValidURL(url)) return url;

    try {
      const urlObj = new URL(url);

      if (paramsToRemove === null) {
        // Remove all parameters
        urlObj.search = '';
      } else if (Array.isArray(paramsToRemove)) {
        // Remove specific parameters
        paramsToRemove.forEach(param => {
          urlObj.searchParams.delete(param);
        });
      }

      return urlObj.toString();
    } catch {
      return url;
    }
  }

  /**
   * Resolve relative URL against base URL
   * @param {string} relativeUrl - Relative URL
   * @param {string} baseUrl - Base URL
   * @returns {string} Resolved absolute URL
   */
  static resolveURL(relativeUrl, baseUrl) {
    if (!relativeUrl) return baseUrl;
    if (this.isValidURL(relativeUrl)) return relativeUrl;
    if (!this.isValidURL(baseUrl)) return relativeUrl;

    try {
      const resolved = new URL(relativeUrl, baseUrl);
      return resolved.toString();
    } catch {
      return relativeUrl;
    }
  }

  /**
   * Check if two URLs are the same (ignoring fragments and parameter order)
   * @param {string} url1 - First URL
   * @param {string} url2 - Second URL
   * @returns {boolean} True if URLs are equivalent
   */
  static areURLsEquivalent(url1, url2) {
    if (!this.isValidURL(url1) || !this.isValidURL(url2)) {
      return url1 === url2;
    }

    try {
      const urlObj1 = new URL(url1);
      const urlObj2 = new URL(url2);

      // Compare origin and pathname
      if (urlObj1.origin !== urlObj2.origin || urlObj1.pathname !== urlObj2.pathname) {
        return false;
      }

      // Compare search parameters (order independent)
      const params1 = Array.from(urlObj1.searchParams.entries()).sort();
      const params2 = Array.from(urlObj2.searchParams.entries()).sort();

      return JSON.stringify(params1) === JSON.stringify(params2);
    } catch {
      return false;
    }
  }

  /**
   * Extract image URLs from srcset attribute
   * @param {string} srcset - Srcset attribute value
   * @returns {Array} Array of {url, descriptor} objects
   */
  static parseSrcset(srcset) {
    if (typeof srcset !== 'string' || !srcset.trim()) return [];

    const sources = [];
    const candidates = srcset.split(',');

    candidates.forEach(candidate => {
      const trimmed = candidate.trim();
      if (!trimmed) return;

      const parts = trimmed.split(/\s+/);
      if (parts.length >= 1) {
        const url = parts[0];
        const descriptor = parts[1] || '1x';

        if (this.isValidURL(url)) {
          sources.push({ url, descriptor });
        }
      }
    });

    return sources;
  }
}

export default URLUtils;
