/**
 * @fileoverview Service container for dependency injection and service management
 */

import { ExtensionError, ErrorCodes } from '../types/ErrorTypes.js';
import { LoggingService, createLoggingService } from './LoggingService.js';
import { ConfigurationService, createConfigurationService, DefaultConfig, DefaultConfigSchema } from './ConfigurationService.js';
import { ErrorHandlerService, createErrorHandlerService } from './ErrorHandlerService.js';
import { MessageBusService, createMessageBusService } from './MessageBusService.js';
import { DownloadManagerService } from '../../background/DownloadManagerService.js';

/**
 * Service container for dependency injection
 */
export class ServiceContainer {
  /**
   * Create service container
   */
  constructor() {
    this.services = new Map();
    this.factories = new Map();
    this.singletons = new Set();
    this.isInitialized = false;

    // Register default service factories
    this._registerDefaultFactories();
  }

  /**
   * Register a service factory
   * @param {string} name - Service name
   * @param {Function} factory - Factory function that creates the service
   * @param {boolean} [singleton=true] - Whether service should be singleton
   * @returns {void}
   */
  register(name, factory, singleton = true) {
    if (typeof factory !== 'function') {
      throw new ExtensionError(
        'Service factory must be a function',
        ErrorCodes.VALIDATION_ERROR,
        { serviceName: name, factoryType: typeof factory }
      );
    }

    this.factories.set(name, factory);

    if (singleton) {
      this.singletons.add(name);
    }
  }

  /**
   * Register a service instance directly
   * @param {string} name - Service name
   * @param {*} instance - Service instance
   * @returns {void}
   */
  registerInstance(name, instance) {
    this.services.set(name, instance);
    this.singletons.add(name);
  }

  /**
   * Get a service instance
   * @template T
   * @param {string} name - Service name
   * @returns {T|Promise<T>} Service instance or promise of service instance
   */
  get(name) {
    // Return existing instance if singleton
    if (this.singletons.has(name) && this.services.has(name)) {
      return this.services.get(name);
    }

    // Create new instance using factory
    const factory = this.factories.get(name);
    if (!factory) {
      throw new ExtensionError(
        `Service not registered: ${name}`,
        ErrorCodes.SERVICE_UNAVAILABLE,
        { serviceName: name, availableServices: Array.from(this.factories.keys()) }
      );
    }

    try {
      const instance = factory(this);

      // Handle async factories
      if (instance && typeof instance.then === 'function') {
        return instance.then(resolvedInstance => {
          // Store singleton instances
          if (this.singletons.has(name)) {
            this.services.set(name, resolvedInstance);
          }
          return resolvedInstance;
        });
      }

      // Store singleton instances
      if (this.singletons.has(name)) {
        this.services.set(name, instance);
      }

      return instance;
    } catch (error) {
      throw new ExtensionError(
        `Failed to create service: ${name}`,
        ErrorCodes.INITIALIZATION_ERROR,
        { serviceName: name, originalError: error.message }
      );
    }
  }

  /**
   * Get a service instance asynchronously
   * @template T
   * @param {string} name - Service name
   * @returns {Promise<T>} Service instance
   */
  async getAsync(name) {
    const result = this.get(name);
    return result && typeof result.then === 'function' ? await result : result;
  }

  /**
   * Check if service is registered
   * @param {string} name - Service name
   * @returns {boolean} True if service is registered
   */
  has(name) {
    return this.factories.has(name) || this.services.has(name);
  }

  /**
   * Initialize all services
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log('[ServiceContainer] Step 1: Getting logger service...');
      // Initialize core services in order
      const logger = this.get('logger');
      console.log('[ServiceContainer] Logger service created:', !!logger);

      console.log('[ServiceContainer] Step 2: Getting config service...');
      const config = this.get('config');
      console.log('[ServiceContainer] Config service created:', !!config);

      console.log('[ServiceContainer] Step 3: Getting error handler service...');
      const errorHandler = this.get('errorHandler');
      console.log('[ServiceContainer] Error handler service created:', !!errorHandler);

      console.log('[ServiceContainer] Step 4: Getting message bus service...');
      const messageBus = this.get('messageBus');
      console.log('[ServiceContainer] Message bus service created:', !!messageBus);

      console.log('[ServiceContainer] Step 5: Initializing config service...');
      // Initialize services that require async setup
      if (config && typeof config.initialize === 'function') {
        await config.initialize();
        console.log('[ServiceContainer] Config service initialized');
      }

      console.log('[ServiceContainer] Step 6: Initializing message bus service...');
      if (messageBus && typeof messageBus.initialize === 'function') {
        await messageBus.initialize();
        console.log('[ServiceContainer] Message bus service initialized');
      }

      console.log('[ServiceContainer] Step 7: Getting download manager service...');
      // Initialize download manager service (async)
      await this.getAsync('downloadManager');
      console.log('[ServiceContainer] Download manager service created');

      this.isInitialized = true;

      if (logger) {
        logger.info('Service container initialized successfully');
      }

    } catch (error) {
      console.error('[ServiceContainer] Initialization error:', error.message);
      console.error('[ServiceContainer] Error stack:', error.stack);
      console.error('[ServiceContainer] Full error object:', error);
      throw new ExtensionError(
        'Failed to initialize service container',
        ErrorCodes.INITIALIZATION_ERROR,
        { originalError: error.message }
      );
    }
  }

  /**
   * Cleanup all services
   * @returns {Promise<void>}
   */
  async cleanup() {
    try {
      // Cleanup services in reverse order
      const servicesToCleanup = ['downloadManager', 'messageBus', 'errorHandler', 'config', 'logger'];

      for (const serviceName of servicesToCleanup) {
        if (this.services.has(serviceName)) {
          const service = this.services.get(serviceName);
          if (service && typeof service.cleanup === 'function') {
            await service.cleanup();
          }
        }
      }

      // Clear all services
      this.services.clear();
      this.isInitialized = false;

    } catch (error) {
      console.error('[ServiceContainer] Error during cleanup:', error);
    }
  }

  /**
   * Get all registered service names
   * @returns {string[]} Array of service names
   */
  getServiceNames() {
    const factoryNames = Array.from(this.factories.keys());
    const instanceNames = Array.from(this.services.keys());
    return [...new Set([...factoryNames, ...instanceNames])];
  }

  /**
   * Get service statistics
   * @returns {Object} Service statistics
   */
  getStats() {
    return {
      totalRegistered: this.factories.size,
      totalInstances: this.services.size,
      singletons: Array.from(this.singletons),
      isInitialized: this.isInitialized
    };
  }

  /**
   * Create a scoped container with additional services
   * @param {Object} additionalServices - Additional service factories
   * @returns {ServiceContainer} New scoped container
   */
  createScope(additionalServices = {}) {
    const scopedContainer = new ServiceContainer();

    // Copy existing factories
    for (const [name, factory] of this.factories) {
      scopedContainer.register(name, factory, this.singletons.has(name));
    }

    // Copy existing instances
    for (const [name, instance] of this.services) {
      scopedContainer.registerInstance(name, instance);
    }

    // Add additional services
    for (const [name, factory] of Object.entries(additionalServices)) {
      scopedContainer.register(name, factory);
    }

    return scopedContainer;
  }

  /**
   * Register default service factories
   * @private
   * @returns {void}
   */
  _registerDefaultFactories() {
    // Logger service - create with default config to avoid circular dependency
    this.register('logger', (container) => {
      // Use default logging config to avoid circular dependency with config service
      const defaultLoggingConfig = {
        level: 'info',
        enableConsole: true,
        enableStorage: false
      };

      return createLoggingService(defaultLoggingConfig);
    });

    // Configuration service
    this.register('config', (container) => {
      // Create config service without logger initially to avoid circular dependency
      return createConfigurationService(DefaultConfig, DefaultConfigSchema, null);
    });

    // Error handler service
    this.register('errorHandler', (container) => {
      const logger = container.get('logger');
      return createErrorHandlerService(logger);
    });

    // Message bus service
    this.register('messageBus', (container) => {
      const logger = container.get('logger');
      return createMessageBusService(logger);
    });

    // Download manager service
    this.register('downloadManager', async (container) => {
      const logger = container.get('logger');
      const errorHandler = container.get('errorHandler');
      const config = container.get('config');
      const notificationService = container.has('notificationService') ? container.get('notificationService') : null;

      // Use static import - DownloadManagerService is imported at the top of the file
      const downloadManager = new DownloadManagerService(logger, errorHandler, config, notificationService);

      // Initialize the service
      await downloadManager.initialize();

      return downloadManager;
    });
  }
}

/**
 * Global service container instance
 */
let globalContainer = null;

/**
 * Get the global service container
 * @returns {ServiceContainer} Global service container
 */
export function getServiceContainer() {
  if (!globalContainer) {
    globalContainer = new ServiceContainer();
  }
  return globalContainer;
}

/**
 * Initialize the global service container
 * @returns {Promise<ServiceContainer>} Initialized service container
 */
export async function initializeServices() {
  const container = getServiceContainer();
  await container.initialize();
  return container;
}

/**
 * Cleanup the global service container
 * @returns {Promise<void>}
 */
export async function cleanupServices() {
  if (globalContainer) {
    await globalContainer.cleanup();
    globalContainer = null;
  }
}

/**
 * Get a service from the global container
 * @template T
 * @param {string} name - Service name
 * @returns {T} Service instance
 */
export function getService(name) {
  return getServiceContainer().get(name);
}

/**
 * Register a service in the global container
 * @param {string} name - Service name
 * @param {Function} factory - Service factory
 * @param {boolean} [singleton=true] - Whether service should be singleton
 * @returns {void}
 */
export function registerService(name, factory, singleton = true) {
  getServiceContainer().register(name, factory, singleton);
}

/**
 * Register a service instance in the global container
 * @param {string} name - Service name
 * @param {*} instance - Service instance
 * @returns {void}
 */
export function registerServiceInstance(name, instance) {
  getServiceContainer().registerInstance(name, instance);
}
