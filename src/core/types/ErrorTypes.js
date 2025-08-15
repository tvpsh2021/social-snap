/**
 * @fileoverview Error type definitions and custom error classes
 */

/**
 * Error codes for different types of errors
 * @readonly
 * @enum {string}
 */
export const ErrorCodes = {
  // Platform errors
  PLATFORM_NOT_SUPPORTED: 'PLATFORM_NOT_SUPPORTED',
  PLATFORM_DETECTION_FAILED: 'PLATFORM_DETECTION_FAILED',
  PLATFORM_INITIALIZATION_FAILED: 'PLATFORM_INITIALIZATION_FAILED',

  // Extraction errors
  IMAGE_EXTRACTION_FAILED: 'IMAGE_EXTRACTION_FAILED',
  NO_IMAGES_FOUND: 'NO_IMAGES_FOUND',
  PAGE_NOT_READY: 'PAGE_NOT_READY',
  INVALID_PAGE_STRUCTURE: 'INVALID_PAGE_STRUCTURE',

  // Download errors
  DOWNLOAD_FAILED: 'DOWNLOAD_FAILED',
  DOWNLOAD_TIMEOUT: 'DOWNLOAD_TIMEOUT',
  DOWNLOAD_CANCELLED: 'DOWNLOAD_CANCELLED',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  STORAGE_FULL: 'STORAGE_FULL',

  // Network errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  REQUEST_TIMEOUT: 'REQUEST_TIMEOUT',
  INVALID_URL: 'INVALID_URL',
  CORS_ERROR: 'CORS_ERROR',

  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',

  // System errors
  INITIALIZATION_ERROR: 'INITIALIZATION_ERROR',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  OPERATION_NOT_SUPPORTED: 'OPERATION_NOT_SUPPORTED',
  MESSAGE_PROCESSING_ERROR: 'MESSAGE_PROCESSING_ERROR',
  SERVICE_ERROR: 'SERVICE_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

/**
 * Error severity levels
 * @readonly
 * @enum {string}
 */
export const ErrorSeverity = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

/**
 * Base extension error class
 */
export class ExtensionError extends Error {
  /**
   * Create an extension error
   * @param {string} message - Error message
   * @param {string} code - Error code from ErrorCodes
   * @param {import('../interfaces/IErrorHandler.js').ErrorContext} [context={}] - Error context
   * @param {string} [severity=ErrorSeverity.MEDIUM] - Error severity
   */
  constructor(message, code, context = {}, severity = ErrorSeverity.MEDIUM) {
    super(message);
    this.name = 'ExtensionError';
    this.code = code;
    this.context = context;
    this.severity = severity;
    this.timestamp = Date.now();

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ExtensionError);
    }
  }

  /**
   * Convert error to JSON representation
   * @returns {Object} JSON representation of the error
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      severity: this.severity,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}

/**
 * Platform-specific error
 */
export class PlatformError extends ExtensionError {
  /**
   * Create a platform error
   * @param {string} message - Error message
   * @param {string} platform - Platform name
   * @param {string} [code=ErrorCodes.PLATFORM_NOT_SUPPORTED] - Error code
   * @param {import('../interfaces/IErrorHandler.js').ErrorContext} [context={}] - Error context
   */
  constructor(message, platform, code = ErrorCodes.PLATFORM_NOT_SUPPORTED, context = {}) {
    super(message, code, { ...context, platform }, ErrorSeverity.HIGH);
    this.name = 'PlatformError';
    this.platform = platform;
  }
}

/**
 * Image extraction error
 */
export class ExtractionError extends ExtensionError {
  /**
   * Create an extraction error
   * @param {string} message - Error message
   * @param {string} [code=ErrorCodes.IMAGE_EXTRACTION_FAILED] - Error code
   * @param {import('../interfaces/IErrorHandler.js').ErrorContext} [context={}] - Error context
   */
  constructor(message, code = ErrorCodes.IMAGE_EXTRACTION_FAILED, context = {}) {
    super(message, code, context, ErrorSeverity.MEDIUM);
    this.name = 'ExtractionError';
  }
}

/**
 * Download error
 */
export class DownloadError extends ExtensionError {
  /**
   * Create a download error
   * @param {string} message - Error message
   * @param {string} [code=ErrorCodes.DOWNLOAD_FAILED] - Error code
   * @param {import('../interfaces/IErrorHandler.js').ErrorContext} [context={}] - Error context
   */
  constructor(message, code = ErrorCodes.DOWNLOAD_FAILED, context = {}) {
    super(message, code, context, ErrorSeverity.HIGH);
    this.name = 'DownloadError';
  }
}

/**
 * Network error
 */
export class NetworkError extends ExtensionError {
  /**
   * Create a network error
   * @param {string} message - Error message
   * @param {string} [code=ErrorCodes.NETWORK_ERROR] - Error code
   * @param {import('../interfaces/IErrorHandler.js').ErrorContext} [context={}] - Error context
   */
  constructor(message, code = ErrorCodes.NETWORK_ERROR, context = {}) {
    super(message, code, context, ErrorSeverity.HIGH);
    this.name = 'NetworkError';
  }
}

/**
 * Validation error
 */
export class ValidationError extends ExtensionError {
  /**
   * Create a validation error
   * @param {string} message - Error message
   * @param {string} field - Field that failed validation
   * @param {*} value - Invalid value
   * @param {string} [code=ErrorCodes.VALIDATION_ERROR] - Error code
   */
  constructor(message, field, value, code = ErrorCodes.VALIDATION_ERROR) {
    super(message, code, { field, value }, ErrorSeverity.MEDIUM);
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
  }
}

/**
 * Create an error from a generic Error object
 * @param {Error} error - Generic error
 * @param {string} [code=ErrorCodes.UNKNOWN_ERROR] - Error code to assign
 * @param {import('../interfaces/IErrorHandler.js').ErrorContext} [context={}] - Additional context
 * @returns {ExtensionError} Extension error instance
 */
export function createExtensionError(error, code = ErrorCodes.UNKNOWN_ERROR, context = {}) {
  if (error instanceof ExtensionError) {
    return error;
  }

  return new ExtensionError(
    error.message || 'Unknown error occurred',
    code,
    { ...context, originalError: error.name },
    ErrorSeverity.MEDIUM
  );
}

/**
 * Check if an error is retryable
 * @param {Error} error - Error to check
 * @returns {boolean} True if error is retryable
 */
export function isRetryableError(error) {
  if (!(error instanceof ExtensionError)) {
    return false;
  }

  const retryableCodes = [
    ErrorCodes.NETWORK_ERROR,
    ErrorCodes.REQUEST_TIMEOUT,
    ErrorCodes.DOWNLOAD_TIMEOUT,
    ErrorCodes.SERVICE_UNAVAILABLE
  ];

  return retryableCodes.includes(error.code);
}

/**
 * Get user-friendly error message
 * @param {Error} error - Error to get message for
 * @returns {string} User-friendly error message
 */
export function getUserFriendlyMessage(error) {
  if (!(error instanceof ExtensionError)) {
    return 'An unexpected error occurred. Please try again.';
  }

  const friendlyMessages = {
    [ErrorCodes.PLATFORM_NOT_SUPPORTED]: 'This website is not supported for image extraction.',
    [ErrorCodes.NO_IMAGES_FOUND]: 'No images were found on this page.',
    [ErrorCodes.DOWNLOAD_FAILED]: 'Failed to download the image. Please try again.',
    [ErrorCodes.NETWORK_ERROR]: 'Network connection error. Please check your internet connection.',
    [ErrorCodes.INSUFFICIENT_PERMISSIONS]: 'Insufficient permissions to download files.',
    [ErrorCodes.STORAGE_FULL]: 'Not enough storage space to download the image.',
    [ErrorCodes.PAGE_NOT_READY]: 'Page is still loading. Please wait and try again.'
  };

  return friendlyMessages[error.code] || error.message || 'An error occurred. Please try again.';
}
