/**
 * @fileoverview Interface definition for inter-component message communication
 */

/**
 * @typedef {Object} Message
 * @property {string} type - Message type identifier
 * @property {*} payload - Message payload data
 * @property {string} requestId - Unique request identifier
 * @property {number} timestamp - Message creation timestamp
 */

/**
 * @typedef {Object} MessageResponse
 * @property {boolean} success - Whether the message was processed successfully
 * @property {*} [data] - Response data if successful
 * @property {string} [error] - Error message if unsuccessful
 * @property {string} requestId - Original request identifier
 * @property {number} timestamp - Response timestamp
 */

/**
 * @callback MessageHandler
 * @param {Message} message - The received message
 * @returns {Promise<*>|*} Handler response
 */

/**
 * Interface for message bus communication system
 * @interface IMessageBus
 */
class IMessageBus {
  /**
   * Send a message and wait for response
   * @template T
   * @param {Message} message - Message to send
   * @param {number} [timeout=5000] - Timeout in milliseconds
   * @returns {Promise<MessageResponse<T>>} Message response
   */
  async send(message, timeout = 5000) {
    throw new Error('send method must be implemented by subclass');
  }

  /**
   * Send a message without waiting for response
   * @param {Message} message - Message to send
   * @returns {void}
   */
  sendAsync(message) {
    throw new Error('sendAsync method must be implemented by subclass');
  }

  /**
   * Subscribe to messages of a specific type
   * @template T
   * @param {string} messageType - Type of messages to subscribe to
   * @param {MessageHandler<T>} handler - Handler function for messages
   * @returns {void}
   */
  subscribe(messageType, handler) {
    throw new Error('subscribe method must be implemented by subclass');
  }

  /**
   * Unsubscribe from messages of a specific type
   * @param {string} messageType - Type of messages to unsubscribe from
   * @param {MessageHandler} handler - Handler function to remove
   * @returns {void}
   */
  unsubscribe(messageType, handler) {
    throw new Error('unsubscribe method must be implemented by subclass');
  }

  /**
   * Check if the message bus is connected and ready
   * @returns {boolean} True if ready for communication
   */
  isReady() {
    throw new Error('isReady method must be implemented by subclass');
  }

  /**
   * Initialize the message bus
   * @returns {Promise<void>}
   */
  async initialize() {
    throw new Error('initialize method must be implemented by subclass');
  }

  /**
   * Cleanup and disconnect the message bus
   * @returns {Promise<void>}
   */
  async cleanup() {
    throw new Error('cleanup method must be implemented by subclass');
  }
}

export { IMessageBus };
