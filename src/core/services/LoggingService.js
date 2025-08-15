/**
 * @fileoverview Structured logging service implementation
 */

import { ILogger } from '../interfaces/ILogger.js';
import { ExtensionError, ErrorCodes } from '../types/ErrorTypes.js';

/**
 * Log levels with numeric values for comparison
 * @readonly
 * @enum {number}
 */
export const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

/**
 * Log level names
 * @readonly
 * @enum {string}
 */
export const LogLevelNames = {
  [LogLevel.DEBUG]: 'debug',
  [LogLevel.INFO]: 'info',
  [LogLevel.WARN]: 'warn',
  [LogLevel.ERROR]: 'error'
};

/**
 * Structured logging service
 * @implements {ILogger}
 */
export class LoggingService extends ILogger {
  /**
   * Create logging service
   * @param {Object} [config={}] - Logging configuration
   * @param {string} [config.level='info'] - Minimum log level
   * @param {boolean} [config.enableConsole=true] - Enable console output
   * @param {boolean} [config.enableStorage=false] - Enable log storage
   * @param {number} [config.maxStoredLogs=1000] - Maximum stored log entries
   * @param {string} [config.dateFormat='ISO'] - Date format for timestamps
   */
  constructor(config = {}) {
    console.log('[LoggingService] Constructor starting with config:', config);
    try {
      super();
      console.log('[LoggingService] Super constructor called');

      this.config = {
        level: config.level || 'info',
        enableConsole: config.enableConsole !== false,
        enableStorage: config.enableStorage || false,
        maxStoredLogs: config.maxStoredLogs || 1000,
        dateFormat: config.dateFormat || 'ISO',
        ...config
      };
      console.log('[LoggingService] Config set:', this.config);

      console.log('[LoggingService] Parsing log level...');
      this.currentLevel = this._parseLogLevel(this.config.level);
      console.log('[LoggingService] Current level:', this.currentLevel);

      this.storedLogs = [];
      this.logStats = {
        totalLogs: 0,
        logsByLevel: new Map(),
        startTime: Date.now()
      };
      console.log('[LoggingService] Stats initialized');

      console.log('[LoggingService] Binding methods...');
      // Bind methods to preserve context
      this._shouldLog = this._shouldLog.bind(this);
      console.log('[LoggingService] Constructor completed successfully');
    } catch (error) {
      console.error('[LoggingService] Error in constructor:', error);
      throw error;
    }
  }

  /**
   * Log an error message
   * @param {string} message - Log message
   * @param {import('../interfaces/ILogger.js').LogContext|Object} [context={}] - Additional context
   * @returns {void}
   */
  error(message, context = {}) {
    this._log(LogLevel.ERROR, message, context);
  }

  /**
   * Log a warning message
   * @param {string} message - Log message
   * @param {import('../interfaces/ILogger.js').LogContext|Object} [context={}] - Additional context
   * @returns {void}
   */
  warn(message, context = {}) {
    this._log(LogLevel.WARN, message, context);
  }

  /**
   * Log an info message
   * @param {string} message - Log message
   * @param {import('../interfaces/ILogger.js').LogContext|Object} [context={}] - Additional context
   * @returns {void}
   */
  info(message, context = {}) {
    this._log(LogLevel.INFO, message, context);
  }

  /**
   * Log a debug message
   * @param {string} message - Log message
   * @param {import('../interfaces/ILogger.js').LogContext|Object} [context={}] - Additional context
   * @returns {void}
   */
  debug(message, context = {}) {
    this._log(LogLevel.DEBUG, message, context);
  }

  /**
   * Set the minimum log level
   * @param {string} level - Log level (error, warn, info, debug)
   * @returns {void}
   */
  setLevel(level) {
    const numericLevel = this._parseLogLevel(level);
    if (numericLevel === null) {
      throw new ExtensionError(
        `Invalid log level: ${level}`,
        ErrorCodes.VALIDATION_ERROR,
        { validLevels: Object.values(LogLevelNames) }
      );
    }

    this.currentLevel = numericLevel;
    this.config.level = level;
  }

  /**
   * Get current log level
   * @returns {string} Current log level
   */
  getLevel() {
    return LogLevelNames[this.currentLevel] || 'info';
  }

  /**
   * Get stored logs
   * @param {Object} [options={}] - Filter options
   * @param {string} [options.level] - Filter by log level
   * @param {string} [options.component] - Filter by component
   * @param {number} [options.since] - Filter by timestamp (logs since this time)
   * @param {number} [options.limit] - Limit number of results
   * @returns {Array} Array of log entries
   */
  getLogs(options = {}) {
    let logs = [...this.storedLogs];

    // Filter by level
    if (options.level) {
      const levelNum = this._parseLogLevel(options.level);
      if (levelNum !== null) {
        logs = logs.filter(log => log.level >= levelNum);
      }
    }

    // Filter by component
    if (options.component) {
      logs = logs.filter(log => log.context.component === options.component);
    }

    // Filter by timestamp
    if (options.since) {
      logs = logs.filter(log => log.timestamp >= options.since);
    }

    // Apply limit
    if (options.limit && options.limit > 0) {
      logs = logs.slice(-options.limit);
    }

    return logs;
  }

  /**
   * Clear stored logs
   * @returns {void}
   */
  clearLogs() {
    this.storedLogs = [];
    this.logStats = {
      totalLogs: 0,
      logsByLevel: new Map(),
      startTime: Date.now()
    };
  }

  /**
   * Get logging statistics
   * @returns {Object} Logging statistics
   */
  getStats() {
    return {
      totalLogs: this.logStats.totalLogs,
      logsByLevel: Object.fromEntries(this.logStats.logsByLevel),
      storedLogsCount: this.storedLogs.length,
      currentLevel: this.getLevel(),
      uptime: Date.now() - this.logStats.startTime
    };
  }

  /**
   * Export logs as JSON
   * @param {Object} [options={}] - Export options
   * @returns {string} JSON string of logs
   */
  exportLogs(options = {}) {
    const logs = this.getLogs(options);
    return JSON.stringify({
      exportTime: Date.now(),
      totalLogs: logs.length,
      logs: logs
    }, null, 2);
  }

  /**
   * Update configuration
   * @param {Object} newConfig - New configuration options
   * @returns {void}
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };

    if (newConfig.level) {
      this.setLevel(newConfig.level);
    }

    // Trim stored logs if max limit changed
    if (newConfig.maxStoredLogs && this.storedLogs.length > newConfig.maxStoredLogs) {
      this.storedLogs = this.storedLogs.slice(-newConfig.maxStoredLogs);
    }
  }

  /**
   * Internal logging method
   * @private
   * @param {number} level - Numeric log level
   * @param {string} message - Log message
   * @param {Object} context - Log context
   * @returns {void}
   */
  _log(level, message, context) {
    if (!this._shouldLog(level)) {
      return;
    }

    const logEntry = {
      level,
      levelName: LogLevelNames[level],
      message,
      context: { ...context },
      timestamp: Date.now(),
      formattedTime: this._formatTimestamp(Date.now())
    };

    // Update statistics
    this._updateStats(level);

    // Console output
    if (this.config.enableConsole) {
      this._outputToConsole(logEntry);
    }

    // Store log if enabled
    if (this.config.enableStorage) {
      this._storeLog(logEntry);
    }
  }

  /**
   * Check if message should be logged based on current level
   * @private
   * @param {number} level - Log level to check
   * @returns {boolean} True if should log
   */
  _shouldLog(level) {
    return level >= this.currentLevel;
  }

  /**
   * Parse log level string to numeric value
   * @private
   * @param {string} level - Log level string
   * @returns {number|null} Numeric log level or null if invalid
   */
  _parseLogLevel(level) {
    const levelMap = {
      'debug': LogLevel.DEBUG,
      'info': LogLevel.INFO,
      'warn': LogLevel.WARN,
      'error': LogLevel.ERROR
    };

    return levelMap[level.toLowerCase()] ?? null;
  }

  /**
   * Format timestamp according to configuration
   * @private
   * @param {number} timestamp - Timestamp to format
   * @returns {string} Formatted timestamp
   */
  _formatTimestamp(timestamp) {
    const date = new Date(timestamp);

    switch (this.config.dateFormat) {
      case 'ISO':
        return date.toISOString();
      case 'locale':
        return date.toLocaleString();
      case 'time':
        return date.toLocaleTimeString();
      default:
        return date.toISOString();
    }
  }

  /**
   * Output log entry to console
   * @private
   * @param {Object} logEntry - Log entry to output
   * @returns {void}
   */
  _outputToConsole(logEntry) {
    const { levelName, message, context, formattedTime } = logEntry;
    const prefix = `[${formattedTime}] [${levelName.toUpperCase()}]`;

    // Format context for display
    const contextStr = Object.keys(context).length > 0
      ? ` ${JSON.stringify(context)}`
      : '';

    const fullMessage = `${prefix} ${message}${contextStr}`;

    // Use appropriate console method
    switch (logEntry.level) {
      case LogLevel.ERROR:
        console.error(fullMessage);
        break;
      case LogLevel.WARN:
        console.warn(fullMessage);
        break;
      case LogLevel.INFO:
        console.info(fullMessage);
        break;
      case LogLevel.DEBUG:
        console.debug(fullMessage);
        break;
      default:
        console.log(fullMessage);
    }
  }

  /**
   * Store log entry in memory
   * @private
   * @param {Object} logEntry - Log entry to store
   * @returns {void}
   */
  _storeLog(logEntry) {
    this.storedLogs.push(logEntry);

    // Trim logs if exceeding maximum
    if (this.storedLogs.length > this.config.maxStoredLogs) {
      this.storedLogs = this.storedLogs.slice(-this.config.maxStoredLogs);
    }
  }

  /**
   * Update logging statistics
   * @private
   * @param {number} level - Log level
   * @returns {void}
   */
  _updateStats(level) {
    this.logStats.totalLogs++;

    const levelName = LogLevelNames[level];
    const currentCount = this.logStats.logsByLevel.get(levelName) || 0;
    this.logStats.logsByLevel.set(levelName, currentCount + 1);
  }
}

/**
 * Create a singleton instance of LoggingService
 * @param {Object} [config={}] - Logging configuration
 * @returns {LoggingService} Logging service instance
 */
export function createLoggingService(config = {}) {
  return new LoggingService(config);
}

/**
 * Create a logger with predefined component context
 * @param {LoggingService} loggingService - Base logging service
 * @param {string} component - Component name
 * @returns {Object} Component-specific logger
 */
export function createComponentLogger(loggingService, component) {
  return {
    error: (message, context = {}) => loggingService.error(message, { component, ...context }),
    warn: (message, context = {}) => loggingService.warn(message, { component, ...context }),
    info: (message, context = {}) => loggingService.info(message, { component, ...context }),
    debug: (message, context = {}) => loggingService.debug(message, { component, ...context })
  };
}
