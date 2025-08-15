/**
 * Validation utility functions for data validation and type checking
 * Provides consistent validation across the extension
 */
class ValidationUtils {
  /**
   * Check if value is null or undefined
   * @param {*} value - Value to check
   * @returns {boolean} True if value is null or undefined
   */
  static isNullOrUndefined(value) {
    return value === null || value === undefined;
  }

  /**
   * Check if value is empty (null, undefined, empty string, empty array, empty object)
   * @param {*} value - Value to check
   * @returns {boolean} True if value is empty
   */
  static isEmpty(value) {
    if (this.isNullOrUndefined(value)) return true;
    if (typeof value === 'string') return value.trim().length === 0;
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object') return Object.keys(value).length === 0;
    return false;
  }

  /**
   * Check if value is a non-empty string
   * @param {*} value - Value to check
   * @returns {boolean} True if value is a non-empty string
   */
  static isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
  }

  /**
   * Check if value is a valid number
   * @param {*} value - Value to check
   * @param {Object} options - Validation options
   * @param {number} options.min - Minimum value
   * @param {number} options.max - Maximum value
   * @param {boolean} options.integer - Must be integer
   * @returns {boolean} True if value is a valid number
   */
  static isValidNumber(value, options = {}) {
    const { min, max, integer = false } = options;

    if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
      return false;
    }

    if (integer && !Number.isInteger(value)) {
      return false;
    }

    if (typeof min === 'number' && value < min) {
      return false;
    }

    if (typeof max === 'number' && value > max) {
      return false;
    }

    return true;
  }

  /**
   * Check if value is a valid positive integer
   * @param {*} value - Value to check
   * @returns {boolean} True if value is a positive integer
   */
  static isPositiveInteger(value) {
    return this.isValidNumber(value, { min: 1, integer: true });
  }

  /**
   * Check if value is a valid array
   * @param {*} value - Value to check
   * @param {Object} options - Validation options
   * @param {number} options.minLength - Minimum array length
   * @param {number} options.maxLength - Maximum array length
   * @param {Function} options.itemValidator - Function to validate each item
   * @returns {boolean} True if value is a valid array
   */
  static isValidArray(value, options = {}) {
    const { minLength, maxLength, itemValidator } = options;

    if (!Array.isArray(value)) return false;

    if (typeof minLength === 'number' && value.length < minLength) {
      return false;
    }

    if (typeof maxLength === 'number' && value.length > maxLength) {
      return false;
    }

    if (typeof itemValidator === 'function') {
      return value.every(item => itemValidator(item));
    }

    return true;
  }

  /**
   * Check if value is a valid object
   * @param {*} value - Value to check
   * @param {Object} options - Validation options
   * @param {string[]} options.requiredKeys - Required object keys
   * @param {string[]} options.allowedKeys - Allowed object keys
   * @returns {boolean} True if value is a valid object
   */
  static isValidObject(value, options = {}) {
    const { requiredKeys = [], allowedKeys = null } = options;

    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return false;
    }

    const keys = Object.keys(value);

    // Check required keys
    for (const requiredKey of requiredKeys) {
      if (!keys.includes(requiredKey)) {
        return false;
      }
    }

    // Check allowed keys
    if (allowedKeys !== null) {
      for (const key of keys) {
        if (!allowedKeys.includes(key)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Validate image data object
   * @param {*} imageData - Image data to validate
   * @returns {boolean} True if valid image data
   */
  static isValidImageData(imageData) {
    return this.isValidObject(imageData, {
      requiredKeys: ['id', 'url', 'platform']
    }) &&
    this.isNonEmptyString(imageData.id) &&
    this.isNonEmptyString(imageData.url) &&
    this.isNonEmptyString(imageData.platform) &&
    (this.isNullOrUndefined(imageData.thumbnailUrl) || this.isNonEmptyString(imageData.thumbnailUrl)) &&
    (this.isNullOrUndefined(imageData.alt) || typeof imageData.alt === 'string') &&
    (this.isNullOrUndefined(imageData.width) || this.isPositiveInteger(imageData.width)) &&
    (this.isNullOrUndefined(imageData.height) || this.isPositiveInteger(imageData.height));
  }

  /**
   * Validate message object
   * @param {*} message - Message to validate
   * @returns {boolean} True if valid message
   */
  static isValidMessage(message) {
    return this.isValidObject(message, {
      requiredKeys: ['type', 'payload']
    }) &&
    this.isNonEmptyString(message.type) &&
    message.payload !== undefined &&
    (this.isNullOrUndefined(message.requestId) || this.isNonEmptyString(message.requestId)) &&
    (this.isNullOrUndefined(message.timestamp) || this.isValidNumber(message.timestamp));
  }

  /**
   * Validate download progress object
   * @param {*} progress - Progress object to validate
   * @returns {boolean} True if valid progress object
   */
  static isValidDownloadProgress(progress) {
    return this.isValidObject(progress, {
      requiredKeys: ['total', 'completed', 'failed']
    }) &&
    this.isValidNumber(progress.total, { min: 0, integer: true }) &&
    this.isValidNumber(progress.completed, { min: 0, integer: true }) &&
    this.isValidNumber(progress.failed, { min: 0, integer: true }) &&
    progress.completed + progress.failed <= progress.total;
  }

  /**
   * Validate error object
   * @param {*} error - Error object to validate
   * @returns {boolean} True if valid error object
   */
  static isValidError(error) {
    return error instanceof Error ||
           (this.isValidObject(error, { requiredKeys: ['message'] }) &&
            this.isNonEmptyString(error.message));
  }

  /**
   * Sanitize and validate string input
   * @param {*} value - Value to sanitize
   * @param {Object} options - Sanitization options
   * @param {number} options.maxLength - Maximum string length
   * @param {boolean} options.trim - Whether to trim whitespace
   * @param {RegExp} options.allowedPattern - Pattern that string must match
   * @returns {string|null} Sanitized string or null if invalid
   */
  static sanitizeString(value, options = {}) {
    const { maxLength = 1000, trim = true, allowedPattern = null } = options;

    if (typeof value !== 'string') return null;

    let sanitized = trim ? value.trim() : value;

    if (sanitized.length === 0) return null;
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }

    if (allowedPattern && !allowedPattern.test(sanitized)) {
      return null;
    }

    return sanitized;
  }

  /**
   * Sanitize and validate number input
   * @param {*} value - Value to sanitize
   * @param {Object} options - Sanitization options
   * @returns {number|null} Sanitized number or null if invalid
   */
  static sanitizeNumber(value, options = {}) {
    let num;

    if (typeof value === 'number') {
      num = value;
    } else if (typeof value === 'string') {
      num = parseFloat(value);
    } else {
      return null;
    }

    return this.isValidNumber(num, options) ? num : null;
  }

  /**
   * Validate platform name
   * @param {*} platform - Platform name to validate
   * @returns {boolean} True if valid platform name
   */
  static isValidPlatform(platform) {
    const validPlatforms = ['threads', 'instagram', 'facebook'];
    return this.isNonEmptyString(platform) &&
           validPlatforms.includes(platform.toLowerCase());
  }

  /**
   * Validate CSS selector
   * @param {*} selector - CSS selector to validate
   * @returns {boolean} True if valid CSS selector
   */
  static isValidCSSSelector(selector) {
    if (!this.isNonEmptyString(selector)) return false;

    try {
      document.querySelector(selector);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate configuration object
   * @param {*} config - Configuration object to validate
   * @returns {boolean} True if valid configuration
   */
  static isValidConfiguration(config) {
    if (!this.isValidObject(config)) return false;

    // Check for required configuration properties
    const requiredProps = ['platforms', 'download', 'ui'];
    for (const prop of requiredProps) {
      if (!config.hasOwnProperty(prop)) return false;
    }

    // Validate platforms config
    if (!this.isValidObject(config.platforms)) return false;

    // Validate download config
    if (!this.isValidObject(config.download)) return false;
    if (config.download.hasOwnProperty('maxConcurrent') &&
        !this.isPositiveInteger(config.download.maxConcurrent)) {
      return false;
    }

    // Validate UI config
    if (!this.isValidObject(config.ui)) return false;

    return true;
  }

  /**
   * Create a validator function for a specific schema
   * @param {Object} schema - Validation schema
   * @returns {Function} Validator function
   */
  static createValidator(schema) {
    return (value) => {
      return this.validateAgainstSchema(value, schema);
    };
  }

  /**
   * Validate value against a schema
   * @param {*} value - Value to validate
   * @param {Object} schema - Validation schema
   * @returns {boolean} True if value matches schema
   */
  static validateAgainstSchema(value, schema) {
    if (schema.type) {
      switch (schema.type) {
        case 'string':
          if (!this.isNonEmptyString(value)) return false;
          break;
        case 'number':
          if (!this.isValidNumber(value, schema.options)) return false;
          break;
        case 'array':
          if (!this.isValidArray(value, schema.options)) return false;
          break;
        case 'object':
          if (!this.isValidObject(value, schema.options)) return false;
          break;
        case 'boolean':
          if (typeof value !== 'boolean') return false;
          break;
        default:
          return false;
      }
    }

    if (schema.validator && typeof schema.validator === 'function') {
      return schema.validator(value);
    }

    return true;
  }

  /**
   * Get validation error message for a value
   * @param {*} value - Value that failed validation
   * @param {string} fieldName - Name of the field
   * @param {Object} schema - Validation schema
   * @returns {string} Error message
   */
  static getValidationError(value, fieldName, schema) {
    if (this.isNullOrUndefined(value)) {
      return `${fieldName} is required`;
    }

    if (schema.type === 'string' && !this.isNonEmptyString(value)) {
      return `${fieldName} must be a non-empty string`;
    }

    if (schema.type === 'number' && !this.isValidNumber(value, schema.options)) {
      return `${fieldName} must be a valid number`;
    }

    if (schema.type === 'array' && !this.isValidArray(value, schema.options)) {
      return `${fieldName} must be a valid array`;
    }

    if (schema.type === 'object' && !this.isValidObject(value, schema.options)) {
      return `${fieldName} must be a valid object`;
    }

    return `${fieldName} is invalid`;
  }
}

export default ValidationUtils;
