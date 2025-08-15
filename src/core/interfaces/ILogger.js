/**
 * @fileoverview Interface definition for logging service
 */

/**
 * @typedef {Object} LogContext
 * @property {string} [component] - Component generating the log
 * @property {string} [operation] - Operation being performed
 * @property {Object} [metadata] - Additional log metadata
 * @property {string} [userId] - User identifier if applicable
 * @property {string} [url] - URL related to the log entry
 */

/**
 * Interface for logging service
 * @interface ILogger
 */
class ILogger {
  /**
   * Log an error message
   * @param {string} message - Log message
   * @param {LogContext|Object} [context={}] - Additional context
   * @returns {void}
   */
  error(message, context = {}) {
    throw new Error('error method must be implemented by subclass');
  }

  /**
   * Log a warning message
   * @param {string} message - Log message
   * @param {LogContext|Object} [context={}] - Additional context
   * @returns {void}
   */
  warn(message, context = {}) {
    throw new Error('warn method must be implemented by subclass');
  }

  /**
   * Log an info message
   * @param {string} message - Log message
   * @param {LogContext|Object} [context={}] - Additional context
   * @returns {void}
   */
  info(message, context = {}) {
    throw new Error('info method must be implemented by subclass');
  }

  /**
   * Log a debug message
   * @param {string} message - Log message
   * @param {LogContext|Object} [context={}] - Additional context
   * @returns {void}
   */
  debug(message, context = {}) {
    throw new Error('debug method must be implemented by subclass');
  }

  /**
   * Set the minimum log level
   * @param {string} level - Log level (error, warn, info, debug)
   * @returns {void}
   */
  setLevel(level) {
    throw new Error('setLevel method must be implemented by subclass');
  }

  /**
   * Get current log level
   * @returns {string} Current log level
   */
  getLevel() {
    throw new Error('getLevel method must be implemented by subclass');
  }
}

export { ILogger };
