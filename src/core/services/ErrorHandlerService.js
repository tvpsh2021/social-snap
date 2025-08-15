/**
 * @fileoverview Centralized error handling service implementation
 */

import { IErrorHandler } from '../interfaces/IErrorHandler.js';
import {
  ExtensionError,
  ErrorCodes,
  ErrorSeverity,
  createExtensionError,
  isRetryableError,
  getUserFriendlyMessage
} from '../types/ErrorTypes.js';

/**
 * Centralized error handling service
 * @implements {IErrorHandler}
 */
export class ErrorHandlerService extends IErrorHandler {
  /**
   * Create error handler service
   * @param {import('../interfaces/ILogger.js').ILogger} [logger] - Logger service
   */
  constructor(logger = null) {
    super();
    this.logger = logger;
    this.handlers = new Map();
    this.errorStats = {
      totalErrors: 0,
      errorsByType: new Map(),
      errorsByCode: new Map(),
      errorsBySeverity: new Map(),
      lastError: null,
      startTime: Date.now()
    };

    // Register default handlers
    this._registerDefaultHandlers();
  }

  /**
   * Handle an error with context information
   * @param {Error} error - The error to handle
   * @param {import('../interfaces/IErrorHandler.js').ErrorContext} [context={}] - Additional context about the error
   * @returns {Promise<import('../interfaces/IErrorHandler.js').ErrorHandlerResult>} Error handling result
   */
  async handleError(error, context = {}) {
    // Convert to ExtensionError if needed
    const extensionError = error instanceof ExtensionError
      ? error
      : createExtensionError(error, ErrorCodes.UNKNOWN_ERROR, context);

    // Update statistics
    this._updateErrorStats(extensionError);

    // Log the error
    this.logError(extensionError, context);

    // Find and execute handler
    const handler = this._findHandler(extensionError);
    if (handler) {
      try {
        const result = await handler(extensionError, context);
        return {
          handled: true,
          shouldRetry: result.shouldRetry || isRetryableError(extensionError),
          userMessage: result.userMessage || getUserFriendlyMessage(extensionError),
          fallbackValue: result.fallbackValue
        };
      } catch (handlerError) {
        this.logError(handlerError, {
          ...context,
          component: 'ErrorHandlerService',
          operation: 'executeHandler',
          originalError: extensionError.code
        });
      }
    }

    // Default handling
    return {
      handled: false,
      shouldRetry: isRetryableError(extensionError),
      userMessage: getUserFriendlyMessage(extensionError),
      fallbackValue: null
    };
  }

  /**
   * Register a custom error handler for specific error types
   * @param {string|Function} errorType - Error type or constructor to handle
   * @param {import('../interfaces/IErrorHandler.js').ErrorHandlerFunction} handler - Handler function
   * @returns {void}
   */
  registerHandler(errorType, handler) {
    if (typeof handler !== 'function') {
      throw new ValidationError('Handler must be a function', 'handler', handler);
    }

    const key = this._getHandlerKey(errorType);
    if (!this.handlers.has(key)) {
      this.handlers.set(key, []);
    }

    this.handlers.get(key).push(handler);
  }

  /**
   * Unregister an error handler
   * @param {string|Function} errorType - Error type or constructor
   * @param {import('../interfaces/IErrorHandler.js').ErrorHandlerFunction} handler - Handler function to remove
   * @returns {void}
   */
  unregisterHandler(errorType, handler) {
    const key = this._getHandlerKey(errorType);
    const handlers = this.handlers.get(key);

    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
        if (handlers.length === 0) {
          this.handlers.delete(key);
        }
      }
    }
  }

  /**
   * Log an error without handling it
   * @param {Error} error - The error to log
   * @param {import('../interfaces/IErrorHandler.js').ErrorContext} [context={}] - Additional context about the error
   * @returns {void}
   */
  logError(error, context = {}) {
    const logData = {
      error: error instanceof ExtensionError ? error.toJSON() : {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      context,
      timestamp: Date.now()
    };

    if (this.logger) {
      const severity = error instanceof ExtensionError ? error.severity : ErrorSeverity.MEDIUM;

      switch (severity) {
        case ErrorSeverity.CRITICAL:
          this.logger.error('Critical error occurred', logData);
          break;
        case ErrorSeverity.HIGH:
          this.logger.error('High severity error occurred', logData);
          break;
        case ErrorSeverity.MEDIUM:
          this.logger.warn('Error occurred', logData);
          break;
        case ErrorSeverity.LOW:
          this.logger.info('Low severity error occurred', logData);
          break;
        default:
          this.logger.error('Error occurred', logData);
      }
    } else {
      // Fallback to console logging
      console.error('[ErrorHandlerService]', logData);
    }
  }

  /**
   * Check if an error type has a registered handler
   * @param {string|Function} errorType - Error type or constructor to check
   * @returns {boolean} True if handler exists
   */
  hasHandler(errorType) {
    const key = this._getHandlerKey(errorType);
    return this.handlers.has(key) && this.handlers.get(key).length > 0;
  }

  /**
   * Get error statistics
   * @returns {Object} Error statistics object
   */
  getErrorStats() {
    return {
      totalErrors: this.errorStats.totalErrors,
      errorsByType: Object.fromEntries(this.errorStats.errorsByType),
      errorsByCode: Object.fromEntries(this.errorStats.errorsByCode),
      errorsBySeverity: Object.fromEntries(this.errorStats.errorsBySeverity),
      lastError: this.errorStats.lastError,
      uptime: Date.now() - this.errorStats.startTime
    };
  }

  /**
   * Clear error statistics
   * @returns {void}
   */
  clearErrorStats() {
    this.errorStats = {
      totalErrors: 0,
      errorsByType: new Map(),
      errorsByCode: new Map(),
      errorsBySeverity: new Map(),
      lastError: null,
      startTime: Date.now()
    };
  }

  /**
   * Get handler key for error type
   * @private
   * @param {string|Function} errorType - Error type or constructor
   * @returns {string} Handler key
   */
  _getHandlerKey(errorType) {
    if (typeof errorType === 'string') {
      return errorType;
    }
    if (typeof errorType === 'function') {
      return errorType.name;
    }
    throw new ValidationError('Error type must be string or constructor function', 'errorType', errorType);
  }

  /**
   * Find appropriate handler for error
   * @private
   * @param {ExtensionError} error - Error to find handler for
   * @returns {import('../interfaces/IErrorHandler.js').ErrorHandlerFunction|null} Handler function or null
   */
  _findHandler(error) {
    // Try to find handler by error constructor name
    const constructorHandlers = this.handlers.get(error.constructor.name);
    if (constructorHandlers && constructorHandlers.length > 0) {
      return constructorHandlers[constructorHandlers.length - 1]; // Use most recently registered
    }

    // Try to find handler by error code
    const codeHandlers = this.handlers.get(error.code);
    if (codeHandlers && codeHandlers.length > 0) {
      return codeHandlers[codeHandlers.length - 1]; // Use most recently registered
    }

    // Try to find generic ExtensionError handler
    const genericHandlers = this.handlers.get('ExtensionError');
    if (genericHandlers && genericHandlers.length > 0) {
      return genericHandlers[genericHandlers.length - 1]; // Use most recently registered
    }

    return null;
  }

  /**
   * Update error statistics
   * @private
   * @param {ExtensionError} error - Error to record
   * @returns {void}
   */
  _updateErrorStats(error) {
    this.errorStats.totalErrors++;
    this.errorStats.lastError = {
      type: error.constructor.name,
      code: error.code,
      message: error.message,
      timestamp: error.timestamp
    };

    // Update by type
    const typeCount = this.errorStats.errorsByType.get(error.constructor.name) || 0;
    this.errorStats.errorsByType.set(error.constructor.name, typeCount + 1);

    // Update by code
    const codeCount = this.errorStats.errorsByCode.get(error.code) || 0;
    this.errorStats.errorsByCode.set(error.code, codeCount + 1);

    // Update by severity
    const severityCount = this.errorStats.errorsBySeverity.get(error.severity) || 0;
    this.errorStats.errorsBySeverity.set(error.severity, severityCount + 1);
  }

  /**
   * Register default error handlers
   * @private
   * @returns {void}
   */
  _registerDefaultHandlers() {
    // Handler for network errors - suggest retry
    this.registerHandler(ErrorCodes.NETWORK_ERROR, async (error, context) => {
      return {
        shouldRetry: true,
        userMessage: 'Network connection issue. The operation will be retried automatically.',
        fallbackValue: null
      };
    });

    // Handler for timeout errors - suggest retry with longer timeout
    this.registerHandler(ErrorCodes.REQUEST_TIMEOUT, async (error, context) => {
      return {
        shouldRetry: true,
        userMessage: 'Request timed out. Retrying with extended timeout...',
        fallbackValue: null
      };
    });

    // Handler for platform not supported - no retry
    this.registerHandler(ErrorCodes.PLATFORM_NOT_SUPPORTED, async (error, context) => {
      return {
        shouldRetry: false,
        userMessage: 'This website is not currently supported for image extraction.',
        fallbackValue: []
      };
    });

    // Handler for no images found - no retry, empty result
    this.registerHandler(ErrorCodes.NO_IMAGES_FOUND, async (error, context) => {
      return {
        shouldRetry: false,
        userMessage: 'No images were found on this page.',
        fallbackValue: []
      };
    });

    // Handler for download failures - suggest retry
    this.registerHandler(ErrorCodes.DOWNLOAD_FAILED, async (error, context) => {
      return {
        shouldRetry: true,
        userMessage: 'Download failed. Please try again.',
        fallbackValue: null
      };
    });

    // Handler for validation errors - no retry
    this.registerHandler('ValidationError', async (error, context) => {
      return {
        shouldRetry: false,
        userMessage: `Invalid input: ${error.message}`,
        fallbackValue: null
      };
    });
  }
}

/**
 * Create a singleton instance of ErrorHandlerService
 * @param {import('../interfaces/ILogger.js').ILogger} [logger] - Logger service
 * @returns {ErrorHandlerService} Error handler service instance
 */
export function createErrorHandlerService(logger = null) {
  return new ErrorHandlerService(logger);
}
