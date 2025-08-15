/**
 * @fileoverview Interface definition for centralized error handling
 */

/**
 * @typedef {Object} ErrorContext
 * @property {string} [component] - Component where error occurred
 * @property {string} [operation] - Operation being performed when error occurred
 * @property {Object} [metadata] - Additional error metadata
 * @property {string} [userId] - User identifier if applicable
 * @property {string} [url] - URL where error occurred
 */

/**
 * @typedef {Object} ErrorHandlerResult
 * @property {boolean} handled - Whether the error was handled
 * @property {boolean} shouldRetry - Whether the operation should be retried
 * @property {string} [userMessage] - User-friendly error message
 * @property {*} [fallbackValue] - Fallback value to use if applicable
 */

/**
 * @callback ErrorHandlerFunction
 * @param {Error} error - The error to handle
 * @param {ErrorContext} context - Error context information
 * @returns {Promise<ErrorHandlerResult>|ErrorHandlerResult} Handler result
 */

/**
 * Interface for centralized error handling system
 * @interface IErrorHandler
 */
class IErrorHandler {
  /**
   * Handle an error with context information
   * @param {Error} error - The error to handle
   * @param {ErrorContext} [context={}] - Additional context about the error
   * @returns {Promise<ErrorHandlerResult>} Error handling result
   */
  async handleError(error, context = {}) {
    throw new Error('handleError method must be implemented by subclass');
  }

  /**
   * Register a custom error handler for specific error types
   * @param {string|Function} errorType - Error type or constructor to handle
   * @param {ErrorHandlerFunction} handler - Handler function
   * @returns {void}
   */
  registerHandler(errorType, handler) {
    throw new Error('registerHandler method must be implemented by subclass');
  }

  /**
   * Unregister an error handler
   * @param {string|Function} errorType - Error type or constructor
   * @param {ErrorHandlerFunction} handler - Handler function to remove
   * @returns {void}
   */
  unregisterHandler(errorType, handler) {
    throw new Error('unregisterHandler method must be implemented by subclass');
  }

  /**
   * Log an error without handling it
   * @param {Error} error - The error to log
   * @param {ErrorContext} [context={}] - Additional context about the error
   * @returns {void}
   */
  logError(error, context = {}) {
    throw new Error('logError method must be implemented by subclass');
  }

  /**
   * Check if an error type has a registered handler
   * @param {string|Function} errorType - Error type or constructor to check
   * @returns {boolean} True if handler exists
   */
  hasHandler(errorType) {
    throw new Error('hasHandler method must be implemented by subclass');
  }

  /**
   * Get error statistics
   * @returns {Object} Error statistics object
   */
  getErrorStats() {
    throw new Error('getErrorStats method must be implemented by subclass');
  }

  /**
   * Clear error statistics
   * @returns {void}
   */
  clearErrorStats() {
    throw new Error('clearErrorStats method must be implemented by subclass');
  }
}

export { IErrorHandler };
