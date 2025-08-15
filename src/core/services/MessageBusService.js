/**
 * @fileoverview Message bus service implementation for inter-component communication
 */

import { IMessageBus } from '../interfaces/IMessageBus.js';
import {
  MessageTypes,
  MessagePriority,
  createMessage,
  createResponse,
  isValidMessage,
  isValidResponse
} from '../types/MessageTypes.js';
import { ExtensionError, ErrorCodes } from '../types/ErrorTypes.js';

/**
 * Message bus service for Chrome extension communication
 * @implements {IMessageBus}
 */
export class MessageBusService extends IMessageBus {
  /**
   * Create message bus service
   * @param {import('../interfaces/ILogger.js').ILogger} [logger] - Logger service
   */
  constructor(logger = null) {
    super();
    this.logger = logger;
    this.handlers = new Map();
    this.pendingRequests = new Map();
    this.isInitialized = false;
    this.messageQueue = [];
    this.processingQueue = false;

    // Bind methods to preserve context
    this._handleMessage = this._handleMessage.bind(this);
    this._handleDisconnect = this._handleDisconnect.bind(this);
  }

  /**
   * Send a message and wait for response
   * @template T
   * @param {import('../interfaces/IMessageBus.js').Message} message - Message to send
   * @param {number} [timeout=5000] - Timeout in milliseconds
   * @returns {Promise<import('../interfaces/IMessageBus.js').MessageResponse<T>>} Message response
   */
  async send(message, timeout = 5000) {
    if (!this.isReady()) {
      throw new ExtensionError(
        'Message bus is not ready',
        ErrorCodes.SERVICE_UNAVAILABLE,
        { messageType: message.type }
      );
    }

    if (!isValidMessage(message)) {
      throw new ExtensionError(
        'Invalid message format',
        ErrorCodes.VALIDATION_ERROR,
        { message }
      );
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(message.requestId);
        reject(new ExtensionError(
          `Message timeout after ${timeout}ms`,
          ErrorCodes.REQUEST_TIMEOUT,
          { messageType: message.type, requestId: message.requestId }
        ));
      }, timeout);

      this.pendingRequests.set(message.requestId, {
        resolve,
        reject,
        timeoutId,
        timestamp: Date.now()
      });

      try {
        this._sendMessage(message);
      } catch (error) {
        clearTimeout(timeoutId);
        this.pendingRequests.delete(message.requestId);
        reject(error);
      }
    });
  }

  /**
   * Send a message without waiting for response
   * @param {import('../interfaces/IMessageBus.js').Message} message - Message to send
   * @returns {void}
   */
  sendAsync(message) {
    if (!this.isReady()) {
      this._queueMessage(message);
      return;
    }

    if (!isValidMessage(message)) {
      this._logError('Invalid message format for async send', { message });
      return;
    }

    try {
      this._sendMessage(message);
    } catch (error) {
      this._logError('Failed to send async message', { error, message });
    }
  }

  /**
   * Subscribe to messages of a specific type
   * @template T
   * @param {string} messageType - Type of messages to subscribe to
   * @param {import('../interfaces/IMessageBus.js').MessageHandler<T>} handler - Handler function for messages
   * @returns {void}
   */
  subscribe(messageType, handler) {
    if (typeof handler !== 'function') {
      throw new ExtensionError(
        'Message handler must be a function',
        ErrorCodes.VALIDATION_ERROR,
        { messageType, handlerType: typeof handler }
      );
    }

    if (!this.handlers.has(messageType)) {
      this.handlers.set(messageType, []);
    }

    this.handlers.get(messageType).push(handler);
    this._log('debug', `Subscribed to message type: ${messageType}`);
  }

  /**
   * Unsubscribe from messages of a specific type
   * @param {string} messageType - Type of messages to unsubscribe from
   * @param {import('../interfaces/IMessageBus.js').MessageHandler} handler - Handler function to remove
   * @returns {void}
   */
  unsubscribe(messageType, handler) {
    const handlers = this.handlers.get(messageType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
        if (handlers.length === 0) {
          this.handlers.delete(messageType);
        }
        this._log('debug', `Unsubscribed from message type: ${messageType}`);
      }
    }
  }

  /**
   * Check if the message bus is connected and ready
   * @returns {boolean} True if ready for communication
   */
  isReady() {
    return this.isInitialized && typeof chrome !== 'undefined' && chrome.runtime;
  }

  /**
   * Initialize the message bus
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      // Set up Chrome runtime message listener
      if (chrome && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener(this._handleMessage);
      }

      // Set up disconnect listener
      if (chrome && chrome.runtime && chrome.runtime.onConnect) {
        chrome.runtime.onConnect.addListener((port) => {
          port.onDisconnect.addListener(this._handleDisconnect);
        });
      }

      this.isInitialized = true;
      this._log('info', 'Message bus initialized successfully');

      // Process any queued messages
      await this._processMessageQueue();

    } catch (error) {
      throw new ExtensionError(
        'Failed to initialize message bus',
        ErrorCodes.INITIALIZATION_ERROR,
        { originalError: error.message }
      );
    }
  }

  /**
   * Cleanup and disconnect the message bus
   * @returns {Promise<void>}
   */
  async cleanup() {
    try {
      // Clear pending requests
      for (const [requestId, request] of this.pendingRequests) {
        clearTimeout(request.timeoutId);
        request.reject(new ExtensionError(
          'Message bus is shutting down',
          ErrorCodes.SERVICE_UNAVAILABLE,
          { requestId }
        ));
      }
      this.pendingRequests.clear();

      // Clear handlers
      this.handlers.clear();

      // Clear message queue
      this.messageQueue = [];

      // Remove Chrome listeners
      if (chrome && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.removeListener(this._handleMessage);
      }

      this.isInitialized = false;
      this._log('info', 'Message bus cleaned up successfully');

    } catch (error) {
      this._logError('Error during message bus cleanup', { error });
    }
  }

  /**
   * Handle incoming Chrome runtime messages
   * @private
   * @param {*} message - Incoming message
   * @param {chrome.runtime.MessageSender} sender - Message sender
   * @param {Function} sendResponse - Response callback
   * @returns {boolean} True if response will be sent asynchronously
   */
  _handleMessage(message, sender, sendResponse) {
    // Handle responses to pending requests
    if (isValidResponse(message) && this.pendingRequests.has(message.requestId)) {
      const request = this.pendingRequests.get(message.requestId);
      clearTimeout(request.timeoutId);
      this.pendingRequests.delete(message.requestId);
      request.resolve(message);
      return false;
    }

    // Handle new messages
    if (isValidMessage(message)) {
      this._processIncomingMessage(message, sender, sendResponse);
      return true; // Indicates we will send response asynchronously
    }

    this._logError('Received invalid message', { message, sender });
    return false;
  }

  /**
   * Process incoming message with registered handlers
   * @private
   * @param {import('../interfaces/IMessageBus.js').Message} message - Incoming message
   * @param {chrome.runtime.MessageSender} sender - Message sender
   * @param {Function} sendResponse - Response callback
   * @returns {void}
   */
  async _processIncomingMessage(message, sender, sendResponse) {
    const handlers = this.handlers.get(message.type);

    if (!handlers || handlers.length === 0) {
      const response = createResponse(message.requestId, false, null, 'No handler registered for message type');
      sendResponse(response);
      return;
    }

    try {
      // Execute all handlers for this message type
      const results = await Promise.allSettled(
        handlers.map(handler => handler(message, sender))
      );

      // Find the first successful result or collect errors
      const successfulResult = results.find(result => result.status === 'fulfilled');

      if (successfulResult) {
        const response = createResponse(message.requestId, true, successfulResult.value);
        sendResponse(response);
      } else {
        const errors = results
          .filter(result => result.status === 'rejected')
          .map(result => result.reason?.message || 'Unknown error');

        const response = createResponse(message.requestId, false, null, errors.join('; '));
        sendResponse(response);
      }

    } catch (error) {
      this._logError('Error processing message', { error, messageType: message.type });
      const response = createResponse(message.requestId, false, null, error.message);
      sendResponse(response);
    }
  }

  /**
   * Handle Chrome runtime disconnect
   * @private
   * @param {chrome.runtime.Port} port - Disconnected port
   * @returns {void}
   */
  _handleDisconnect(port) {
    this._log('warn', 'Chrome runtime disconnected', { portName: port.name });

    // Reject any pending requests
    for (const [requestId, request] of this.pendingRequests) {
      clearTimeout(request.timeoutId);
      request.reject(new ExtensionError(
        'Connection lost',
        ErrorCodes.NETWORK_ERROR,
        { requestId }
      ));
    }
    this.pendingRequests.clear();
  }

  /**
   * Send message via Chrome runtime
   * @private
   * @param {import('../interfaces/IMessageBus.js').Message} message - Message to send
   * @returns {void}
   */
  _sendMessage(message) {
    if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage(message);
    } else if (chrome && chrome.tabs && chrome.tabs.sendMessage) {
      // Fallback for content script communication
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, message);
        }
      });
    } else {
      throw new ExtensionError(
        'Chrome runtime API not available',
        ErrorCodes.SERVICE_UNAVAILABLE,
        { messageType: message.type }
      );
    }
  }

  /**
   * Queue message for later processing
   * @private
   * @param {import('../interfaces/IMessageBus.js').Message} message - Message to queue
   * @returns {void}
   */
  _queueMessage(message) {
    this.messageQueue.push(message);
    this._log('debug', `Queued message: ${message.type}`);
  }

  /**
   * Process queued messages
   * @private
   * @returns {Promise<void>}
   */
  async _processMessageQueue() {
    if (this.processingQueue || this.messageQueue.length === 0) {
      return;
    }

    this.processingQueue = true;

    try {
      while (this.messageQueue.length > 0) {
        const message = this.messageQueue.shift();
        try {
          this._sendMessage(message);
        } catch (error) {
          this._logError('Failed to send queued message', { error, message });
        }
      }
    } finally {
      this.processingQueue = false;
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
      this.logger[level](message, { component: 'MessageBusService', ...context });
    } else {
      console[level](`[MessageBusService] ${message}`, context);
    }
  }

  /**
   * Log error message
   * @private
   * @param {string} message - Error message
   * @param {Object} [context={}] - Additional context
   * @returns {void}
   */
  _logError(message, context = {}) {
    this._log('error', message, context);
  }
}

/**
 * Create a singleton instance of MessageBusService
 * @param {import('../interfaces/ILogger.js').ILogger} [logger] - Logger service
 * @returns {MessageBusService} Message bus service instance
 */
export function createMessageBusService(logger = null) {
  return new MessageBusService(logger);
}

/**
 * Create a message with proper typing and validation
 * @param {string} type - Message type from MessageTypes
 * @param {*} payload - Message payload
 * @param {number} [priority=MessagePriority.NORMAL] - Message priority
 * @returns {import('../interfaces/IMessageBus.js').Message} Formatted message
 */
export function createTypedMessage(type, payload, priority = MessagePriority.NORMAL) {
  return createMessage(type, payload, null, priority);
}
