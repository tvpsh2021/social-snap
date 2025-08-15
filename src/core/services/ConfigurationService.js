/**
 * @fileoverview Configuration management service implementation
 */

import { ExtensionError, ErrorCodes, ValidationError } from '../types/ErrorTypes.js';

/**
 * Configuration validation schema
 * @typedef {Object} ConfigSchema
 * @property {string} type - Value type (string, number, boolean, object, array)
 * @property {boolean} [required=false] - Whether the field is required
 * @property {*} [default] - Default value if not provided
 * @property {Function} [validator] - Custom validation function
 * @property {*} [min] - Minimum value (for numbers)
 * @property {*} [max] - Maximum value (for numbers)
 * @property {Array} [enum] - Allowed values
 */

/**
 * Configuration management service
 */
export class ConfigurationService {
  /**
   * Create configuration service
   * @param {Object} [defaultConfig={}] - Default configuration values
   * @param {Object} [schema={}] - Configuration validation schema
   * @param {import('../interfaces/ILogger.js').ILogger} [logger] - Logger service
   */
  constructor(defaultConfig = {}, schema = {}, logger = null) {
    this.logger = logger;
    this.schema = schema;
    this.defaultConfig = defaultConfig;
    this.config = { ...defaultConfig };
    this.changeListeners = [];
    this.isInitialized = false;

    // Bind methods to preserve context
    this._validateValue = this._validateValue.bind(this);
    this._notifyListeners = this._notifyListeners.bind(this);
  }

  /**
   * Initialize configuration service
   * @param {boolean} [loadFromStorage=true] - Whether to load from Chrome storage
   * @returns {Promise<void>}
   */
  async initialize(loadFromStorage = true) {
    try {
      if (loadFromStorage) {
        await this._loadFromStorage();
      }

      // Validate loaded configuration
      this._validateConfiguration(this.config);

      this.isInitialized = true;
      this._log('info', 'Configuration service initialized');

    } catch (error) {
      throw new ExtensionError(
        'Failed to initialize configuration service',
        ErrorCodes.INITIALIZATION_ERROR,
        { originalError: error.message }
      );
    }
  }

  /**
   * Get configuration value
   * @param {string} key - Configuration key (supports dot notation)
   * @param {*} [defaultValue] - Default value if key not found
   * @returns {*} Configuration value
   */
  get(key, defaultValue = undefined) {
    if (!this.isInitialized) {
      this._log('warn', 'Configuration service not initialized, using default values');
    }

    const value = this._getNestedValue(this.config, key);

    if (value === undefined) {
      return defaultValue !== undefined ? defaultValue : this._getNestedValue(this.defaultConfig, key);
    }

    return value;
  }

  /**
   * Set configuration value
   * @param {string} key - Configuration key (supports dot notation)
   * @param {*} value - Value to set
   * @param {boolean} [persist=true] - Whether to persist to storage
   * @returns {Promise<void>}
   */
  async set(key, value, persist = true) {
    // Validate the value
    this._validateValue(key, value);

    const oldValue = this.get(key);
    this._setNestedValue(this.config, key, value);

    this._log('debug', `Configuration updated: ${key}`, { oldValue, newValue: value });

    // Persist to storage if requested
    if (persist && this.isInitialized) {
      await this._saveToStorage();
    }

    // Notify listeners
    this._notifyListeners(key, value, oldValue);
  }

  /**
   * Update multiple configuration values
   * @param {Object} updates - Object with key-value pairs to update
   * @param {boolean} [persist=true] - Whether to persist to storage
   * @returns {Promise<void>}
   */
  async update(updates, persist = true) {
    const changes = [];

    for (const [key, value] of Object.entries(updates)) {
      const oldValue = this.get(key);
      this._validateValue(key, value);
      this._setNestedValue(this.config, key, value);
      changes.push({ key, value, oldValue });
    }

    this._log('debug', 'Configuration batch updated', { changes });

    // Persist to storage if requested
    if (persist && this.isInitialized) {
      await this._saveToStorage();
    }

    // Notify listeners for all changes
    for (const change of changes) {
      this._notifyListeners(change.key, change.value, change.oldValue);
    }
  }

  /**
   * Reset configuration to defaults
   * @param {boolean} [persist=true] - Whether to persist to storage
   * @returns {Promise<void>}
   */
  async reset(persist = true) {
    const oldConfig = { ...this.config };
    this.config = { ...this.defaultConfig };

    this._log('info', 'Configuration reset to defaults');

    if (persist && this.isInitialized) {
      await this._saveToStorage();
    }

    // Notify listeners about reset
    this._notifyListeners('*', this.config, oldConfig);
  }

  /**
   * Get all configuration values
   * @returns {Object} Complete configuration object
   */
  getAll() {
    return { ...this.config };
  }

  /**
   * Check if configuration key exists
   * @param {string} key - Configuration key
   * @returns {boolean} True if key exists
   */
  has(key) {
    return this._getNestedValue(this.config, key) !== undefined;
  }

  /**
   * Delete configuration key
   * @param {string} key - Configuration key to delete
   * @param {boolean} [persist=true] - Whether to persist to storage
   * @returns {Promise<void>}
   */
  async delete(key, persist = true) {
    const oldValue = this.get(key);
    this._deleteNestedValue(this.config, key);

    this._log('debug', `Configuration key deleted: ${key}`, { oldValue });

    if (persist && this.isInitialized) {
      await this._saveToStorage();
    }

    this._notifyListeners(key, undefined, oldValue);
  }

  /**
   * Add configuration change listener
   * @param {Function} listener - Change listener function
   * @returns {Function} Unsubscribe function
   */
  onChange(listener) {
    if (typeof listener !== 'function') {
      throw new ValidationError('Listener must be a function', 'listener', listener);
    }

    this.changeListeners.push(listener);

    // Return unsubscribe function
    return () => {
      const index = this.changeListeners.indexOf(listener);
      if (index > -1) {
        this.changeListeners.splice(index, 1);
      }
    };
  }

  /**
   * Validate configuration against schema
   * @param {string} [key] - Specific key to validate (validates all if not provided)
   * @returns {boolean} True if valid
   * @throws {ValidationError} If validation fails
   */
  validate(key = null) {
    if (key) {
      const value = this.get(key);
      this._validateValue(key, value);
    } else {
      this._validateConfiguration(this.config);
    }
    return true;
  }

  /**
   * Get configuration schema
   * @returns {Object} Configuration schema
   */
  getSchema() {
    return { ...this.schema };
  }

  /**
   * Update configuration schema
   * @param {Object} newSchema - New schema definition
   * @returns {void}
   */
  updateSchema(newSchema) {
    this.schema = { ...this.schema, ...newSchema };
    this._log('debug', 'Configuration schema updated');
  }

  /**
   * Export configuration as JSON
   * @param {boolean} [includeDefaults=false] - Whether to include default values
   * @returns {string} JSON string of configuration
   */
  export(includeDefaults = false) {
    const exportData = {
      timestamp: Date.now(),
      config: this.config
    };

    if (includeDefaults) {
      exportData.defaults = this.defaultConfig;
      exportData.schema = this.schema;
    }

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Import configuration from JSON
   * @param {string} jsonData - JSON configuration data
   * @param {boolean} [persist=true] - Whether to persist to storage
   * @returns {Promise<void>}
   */
  async import(jsonData, persist = true) {
    try {
      const importData = JSON.parse(jsonData);

      if (!importData.config || typeof importData.config !== 'object') {
        throw new ValidationError('Invalid import data format', 'config', importData);
      }

      // Validate imported configuration
      this._validateConfiguration(importData.config);

      const oldConfig = { ...this.config };
      this.config = { ...importData.config };

      this._log('info', 'Configuration imported successfully');

      if (persist && this.isInitialized) {
        await this._saveToStorage();
      }

      this._notifyListeners('*', this.config, oldConfig);

    } catch (error) {
      throw new ExtensionError(
        'Failed to import configuration',
        ErrorCodes.VALIDATION_ERROR,
        { originalError: error.message }
      );
    }
  }

  /**
   * Load configuration from Chrome storage
   * @private
   * @returns {Promise<void>}
   */
  async _loadFromStorage() {
    if (!chrome || !chrome.storage || !chrome.storage.sync) {
      this._log('warn', 'Chrome storage API not available');
      return;
    }

    try {
      const result = await chrome.storage.sync.get('extensionConfig');
      if (result.extensionConfig) {
        this.config = { ...this.defaultConfig, ...result.extensionConfig };
        this._log('debug', 'Configuration loaded from storage');
      }
    } catch (error) {
      this._log('error', 'Failed to load configuration from storage', { error: error.message });
      // Continue with default configuration
    }
  }

  /**
   * Save configuration to Chrome storage
   * @private
   * @returns {Promise<void>}
   */
  async _saveToStorage() {
    if (!chrome || !chrome.storage || !chrome.storage.sync) {
      this._log('warn', 'Chrome storage API not available');
      return;
    }

    try {
      await chrome.storage.sync.set({ extensionConfig: this.config });
      this._log('debug', 'Configuration saved to storage');
    } catch (error) {
      this._log('error', 'Failed to save configuration to storage', { error: error.message });
      throw new ExtensionError(
        'Failed to persist configuration',
        ErrorCodes.STORAGE_FULL,
        { originalError: error.message }
      );
    }
  }

  /**
   * Get nested value from object using dot notation
   * @private
   * @param {Object} obj - Object to search
   * @param {string} key - Dot-notation key
   * @returns {*} Value or undefined
   */
  _getNestedValue(obj, key) {
    return key.split('.').reduce((current, prop) => current?.[prop], obj);
  }

  /**
   * Set nested value in object using dot notation
   * @private
   * @param {Object} obj - Object to modify
   * @param {string} key - Dot-notation key
   * @param {*} value - Value to set
   * @returns {void}
   */
  _setNestedValue(obj, key, value) {
    const keys = key.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((current, prop) => {
      if (!(prop in current)) {
        current[prop] = {};
      }
      return current[prop];
    }, obj);
    target[lastKey] = value;
  }

  /**
   * Delete nested value from object using dot notation
   * @private
   * @param {Object} obj - Object to modify
   * @param {string} key - Dot-notation key
   * @returns {void}
   */
  _deleteNestedValue(obj, key) {
    const keys = key.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((current, prop) => current?.[prop], obj);
    if (target) {
      delete target[lastKey];
    }
  }

  /**
   * Validate single configuration value
   * @private
   * @param {string} key - Configuration key
   * @param {*} value - Value to validate
   * @returns {void}
   * @throws {ValidationError} If validation fails
   */
  _validateValue(key, value) {
    const schemaEntry = this.schema[key];
    if (!schemaEntry) {
      return; // No schema defined, skip validation
    }

    // Check required
    if (schemaEntry.required && (value === undefined || value === null)) {
      throw new ValidationError(`Required configuration key missing: ${key}`, key, value);
    }

    // Skip further validation if value is undefined/null and not required
    if (value === undefined || value === null) {
      return;
    }

    // Check type
    if (schemaEntry.type && typeof value !== schemaEntry.type) {
      throw new ValidationError(
        `Invalid type for ${key}: expected ${schemaEntry.type}, got ${typeof value}`,
        key,
        value
      );
    }

    // Check enum values
    if (schemaEntry.enum && !schemaEntry.enum.includes(value)) {
      throw new ValidationError(
        `Invalid value for ${key}: must be one of ${schemaEntry.enum.join(', ')}`,
        key,
        value
      );
    }

    // Check min/max for numbers
    if (schemaEntry.type === 'number') {
      if (schemaEntry.min !== undefined && value < schemaEntry.min) {
        throw new ValidationError(`Value for ${key} must be >= ${schemaEntry.min}`, key, value);
      }
      if (schemaEntry.max !== undefined && value > schemaEntry.max) {
        throw new ValidationError(`Value for ${key} must be <= ${schemaEntry.max}`, key, value);
      }
    }

    // Custom validator
    if (schemaEntry.validator && typeof schemaEntry.validator === 'function') {
      const isValid = schemaEntry.validator(value);
      if (!isValid) {
        throw new ValidationError(`Custom validation failed for ${key}`, key, value);
      }
    }
  }

  /**
   * Validate entire configuration object
   * @private
   * @param {Object} config - Configuration to validate
   * @returns {void}
   * @throws {ValidationError} If validation fails
   */
  _validateConfiguration(config) {
    for (const key of Object.keys(this.schema)) {
      const value = this._getNestedValue(config, key);
      this._validateValue(key, value);
    }
  }

  /**
   * Notify change listeners
   * @private
   * @param {string} key - Changed key
   * @param {*} newValue - New value
   * @param {*} oldValue - Old value
   * @returns {void}
   */
  _notifyListeners(key, newValue, oldValue) {
    for (const listener of this.changeListeners) {
      try {
        listener(key, newValue, oldValue);
      } catch (error) {
        this._log('error', 'Error in configuration change listener', { error: error.message, key });
      }
    }
  }

  /**
   * Log message with appropriate level
   * @private
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} [context={}] - Additional context
   * @returns {void}
   */
  _log(level, message, context = {}) {
    if (this.logger && typeof this.logger[level] === 'function') {
      this.logger[level](message, { component: 'ConfigurationService', ...context });
    } else {
      console[level](`[ConfigurationService] ${message}`, context);
    }
  }
}

/**
 * Create a singleton instance of ConfigurationService
 * @param {Object} [defaultConfig={}] - Default configuration values
 * @param {Object} [schema={}] - Configuration validation schema
 * @param {import('../interfaces/ILogger.js').ILogger} [logger] - Logger service
 * @returns {ConfigurationService} Configuration service instance
 */
export function createConfigurationService(defaultConfig = {}, schema = {}, logger = null) {
  return new ConfigurationService(defaultConfig, schema, logger);
}

/**
 * Default configuration schema for the extension
 */
export const DefaultConfigSchema = {
  'logging.level': {
    type: 'string',
    default: 'info',
    enum: ['debug', 'info', 'warn', 'error']
  },
  'logging.enableConsole': {
    type: 'boolean',
    default: true
  },
  'logging.enableStorage': {
    type: 'boolean',
    default: false
  },
  'download.maxConcurrent': {
    type: 'number',
    default: 3,
    min: 1,
    max: 10
  },
  'download.retryAttempts': {
    type: 'number',
    default: 3,
    min: 0,
    max: 10
  },
  'extraction.timeout': {
    type: 'number',
    default: 10000,
    min: 1000,
    max: 60000
  },
  'ui.theme': {
    type: 'string',
    default: 'auto',
    enum: ['light', 'dark', 'auto']
  }
};

/**
 * Default configuration values
 */
export const DefaultConfig = {
  logging: {
    level: 'info',
    enableConsole: true,
    enableStorage: false
  },
  download: {
    maxConcurrent: 3,
    retryAttempts: 3
  },
  extraction: {
    timeout: 10000
  },
  ui: {
    theme: 'auto'
  }
};
