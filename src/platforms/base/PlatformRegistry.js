/**
 * @fileoverview Platform registry for dynamic platform management
 * Handles platform registration, detection, and factory functionality
 */

import { PLATFORMS, PLATFORM_HOSTNAMES } from '../../shared/constants/PlatformConstants.js';

/**
 * Registry for managing platform extractors
 * Provides factory functionality and platform detection
 */
export class PlatformRegistry {
  /**
   * @param {Object} dependencies - Injected dependencies
   * @param {import('../../core/interfaces/ILogger.js').ILogger} dependencies.logger - Logger service
   * @param {import('../../core/interfaces/IErrorHandler.js').IErrorHandler} dependencies.errorHandler - Error handler service
   */
  constructor({ logger, errorHandler }) {
    this.logger = logger;
    this.errorHandler = errorHandler;

    /** @type {Map<string, Function>} */
    this._extractorClasses = new Map();

    /** @type {Map<string, Object>} */
    this._platformConfigs = new Map();

    /** @type {Map<string, string[]>} */
    this._platformCapabilities = new Map();

    this.logger?.info('PlatformRegistry initialized');
  }

  /**
   * Register a platform extractor class
   * @param {string} platformName - Platform identifier
   * @param {Function} extractorClass - Platform extractor class constructor
   * @param {Object} [config={}] - Platform-specific configuration
   * @param {string[]} [capabilities=[]] - Platform capabilities
   */
  register(platformName, extractorClass, config = {}, capabilities = []) {
    try {
      // Validate platform name
      if (!platformName || typeof platformName !== 'string') {
        throw new Error('Platform name must be a non-empty string');
      }

      // Validate extractor class
      if (!extractorClass || typeof extractorClass !== 'function') {
        throw new Error('Extractor class must be a constructor function');
      }

      // Check if platform is already registered
      if (this._extractorClasses.has(platformName)) {
        this.logger?.warn('Platform already registered, overwriting', { platformName });
      }

      // Register the platform
      this._extractorClasses.set(platformName, extractorClass);
      this._platformConfigs.set(platformName, config);
      this._platformCapabilities.set(platformName, capabilities);

      this.logger?.info('Platform registered successfully', {
        platformName,
        hasConfig: Object.keys(config).length > 0,
        capabilities: capabilities.length
      });

    } catch (error) {
      this.logger?.error('Failed to register platform', {
        platformName,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Unregister a platform extractor
   * @param {string} platformName - Platform identifier
   * @returns {boolean} True if platform was unregistered
   */
  unregister(platformName) {
    const existed = this._extractorClasses.has(platformName);

    this._extractorClasses.delete(platformName);
    this._platformConfigs.delete(platformName);
    this._platformCapabilities.delete(platformName);

    if (existed) {
      this.logger?.info('Platform unregistered', { platformName });
    }

    return existed;
  }

  /**
   * Create an extractor instance for the given URL
   * @param {string} url - URL to create extractor for
   * @param {Object} [dependencies] - Dependencies to inject into extractor
   * @returns {import('../base/BasePlatformExtractor.js').BasePlatformExtractor} Platform extractor instance
   * @throws {Error} When no suitable extractor is found
   */
  createExtractor(url, dependencies = {}) {
    try {
      const platformName = this.detectPlatform(url);

      if (!platformName) {
        throw new Error(`No platform detected for URL: ${url}`);
      }

      return this.createExtractorByName(platformName, dependencies);

    } catch (error) {
      this.logger?.error('Failed to create extractor', {
        url: url?.substring(0, 100),
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Create an extractor instance by platform name
   * @param {string} platformName - Platform identifier
   * @param {Object} [dependencies] - Dependencies to inject into extractor
   * @returns {import('../base/BasePlatformExtractor.js').BasePlatformExtractor} Platform extractor instance
   * @throws {Error} When platform is not registered
   */
  createExtractorByName(platformName, dependencies = {}) {
    try {
      const ExtractorClass = this._extractorClasses.get(platformName);

      if (!ExtractorClass) {
        throw new Error(`Platform '${platformName}' is not registered`);
      }

      const config = this._platformConfigs.get(platformName) || {};

      // Merge dependencies with logger and errorHandler
      const mergedDependencies = {
        logger: this.logger,
        errorHandler: this.errorHandler,
        ...dependencies
      };

      const extractor = new ExtractorClass(mergedDependencies, config);

      this.logger?.debug('Created extractor instance', {
        platformName,
        hasConfig: Object.keys(config).length > 0
      });

      return extractor;

    } catch (error) {
      this.logger?.error('Failed to create extractor by name', {
        platformName,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Detect platform from URL
   * @param {string} url - URL to analyze
   * @returns {string|null} Platform name or null if not detected
   */
  detectPlatform(url) {
    try {
      if (!url || typeof url !== 'string') {
        return null;
      }

      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();

      // Check each registered platform
      for (const [platformName, ExtractorClass] of this._extractorClasses) {
        try {
          // Create a temporary instance to check support
          const tempExtractor = new ExtractorClass(
            { logger: this.logger, errorHandler: this.errorHandler },
            this._platformConfigs.get(platformName) || {}
          );

          if (tempExtractor.isSupported(url)) {
            this.logger?.debug('Platform detected', { platformName, url: url.substring(0, 100) });
            return platformName;
          }
        } catch (error) {
          this.logger?.warn('Error checking platform support', {
            platformName,
            error: error.message
          });
          continue;
        }
      }

      // Fallback to hostname-based detection
      for (const [platform, hostnamePattern] of Object.entries(PLATFORM_HOSTNAMES)) {
        if (hostname.includes(hostnamePattern)) {
          this.logger?.debug('Platform detected by hostname fallback', {
            platform,
            hostname,
            url: url.substring(0, 100)
          });
          return platform;
        }
      }

      this.logger?.debug('No platform detected', {
        hostname,
        url: url.substring(0, 100)
      });
      return null;

    } catch (error) {
      this.logger?.warn('Error detecting platform', {
        url: url?.substring(0, 100),
        error: error.message
      });
      return null;
    }
  }

  /**
   * Check if a platform is registered
   * @param {string} platformName - Platform identifier
   * @returns {boolean} True if platform is registered
   */
  isRegistered(platformName) {
    return this._extractorClasses.has(platformName);
  }

  /**
   * Get all registered platform names
   * @returns {string[]} Array of registered platform names
   */
  getRegisteredPlatforms() {
    return Array.from(this._extractorClasses.keys());
  }

  /**
   * Get platform configuration
   * @param {string} platformName - Platform identifier
   * @returns {Object|null} Platform configuration or null if not found
   */
  getPlatformConfig(platformName) {
    return this._platformConfigs.get(platformName) || null;
  }

  /**
   * Update platform configuration
   * @param {string} platformName - Platform identifier
   * @param {Object} config - New configuration
   * @returns {boolean} True if configuration was updated
   */
  updatePlatformConfig(platformName, config) {
    if (!this._extractorClasses.has(platformName)) {
      return false;
    }

    this._platformConfigs.set(platformName, { ...config });
    this.logger?.info('Platform configuration updated', { platformName });
    return true;
  }

  /**
   * Get platform capabilities
   * @param {string} platformName - Platform identifier
   * @returns {string[]} Array of platform capabilities
   */
  getPlatformCapabilities(platformName) {
    return this._platformCapabilities.get(platformName) || [];
  }

  /**
   * Check if platform has specific capability
   * @param {string} platformName - Platform identifier
   * @param {string} capability - Capability to check
   * @returns {boolean} True if platform has the capability
   */
  hasPlatformCapability(platformName, capability) {
    const capabilities = this._platformCapabilities.get(platformName) || [];
    return capabilities.includes(capability);
  }

  /**
   * Find platforms with specific capability
   * @param {string} capability - Capability to search for
   * @returns {string[]} Array of platform names with the capability
   */
  findPlatformsWithCapability(capability) {
    const platforms = [];

    for (const [platformName, capabilities] of this._platformCapabilities) {
      if (capabilities.includes(capability)) {
        platforms.push(platformName);
      }
    }

    return platforms;
  }

  /**
   * Validate platform extractor class
   * @param {Function} extractorClass - Extractor class to validate
   * @returns {boolean} True if class is valid
   */
  validateExtractorClass(extractorClass) {
    try {
      if (!extractorClass || typeof extractorClass !== 'function') {
        return false;
      }

      // Check if class has required methods (basic validation)
      const prototype = extractorClass.prototype;
      const requiredMethods = ['extractImages', 'isSupported'];

      return requiredMethods.every(method =>
        typeof prototype[method] === 'function'
      );

    } catch (error) {
      this.logger?.warn('Error validating extractor class', { error: error.message });
      return false;
    }
  }

  /**
   * Get registry statistics
   * @returns {Object} Registry statistics
   */
  getStats() {
    return {
      totalPlatforms: this._extractorClasses.size,
      platforms: Array.from(this._extractorClasses.keys()),
      platformsWithConfig: Array.from(this._platformConfigs.keys()).filter(
        name => Object.keys(this._platformConfigs.get(name) || {}).length > 0
      ).length,
      platformsWithCapabilities: Array.from(this._platformCapabilities.keys()).filter(
        name => (this._platformCapabilities.get(name) || []).length > 0
      ).length
    };
  }

  /**
   * Clear all registered platforms
   */
  clear() {
    const count = this._extractorClasses.size;

    this._extractorClasses.clear();
    this._platformConfigs.clear();
    this._platformCapabilities.clear();

    this.logger?.info('Registry cleared', { removedPlatforms: count });
  }
}
