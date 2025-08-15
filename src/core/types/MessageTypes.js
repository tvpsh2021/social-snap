/**
 * @fileoverview Message type definitions and constants
 */

/**
 * Message types for inter-component communication
 * @readonly
 * @enum {string}
 */
export const MessageTypes = {
  // Content script to background messages
  EXTRACT_IMAGES: 'EXTRACT_IMAGES',
  IMAGES_EXTRACTED: 'IMAGES_EXTRACTED',
  EXTRACTION_ERROR: 'EXTRACTION_ERROR',

  // Content script lifecycle messages
  CONTENT_READY: 'CONTENT_READY',
  URL_CHANGED: 'URL_CHANGED',
  GET_PAGE_INFO: 'GET_PAGE_INFO',
  VALIDATE_PAGE: 'VALIDATE_PAGE',

  // Extraction progress messages
  EXTRACTION_STARTED: 'EXTRACTION_STARTED',
  EXTRACTION_PROGRESS: 'EXTRACTION_PROGRESS',
  EXTRACTION_COMPLETED: 'EXTRACTION_COMPLETED',
  EXTRACTION_FAILED: 'EXTRACTION_FAILED',
  EXTRACTION_CANCELLED: 'EXTRACTION_CANCELLED',

  // Download related messages
  DOWNLOAD_SINGLE: 'DOWNLOAD_SINGLE',
  DOWNLOAD_BATCH: 'DOWNLOAD_BATCH',
  DOWNLOAD_PROGRESS: 'DOWNLOAD_PROGRESS',
  DOWNLOAD_COMPLETE: 'DOWNLOAD_COMPLETE',
  DOWNLOAD_ERROR: 'DOWNLOAD_ERROR',
  DOWNLOAD_CANCELLED: 'DOWNLOAD_CANCELLED',

  // Popup to background messages
  GET_IMAGES: 'GET_IMAGES',
  GET_DOWNLOAD_STATUS: 'GET_DOWNLOAD_STATUS',
  CANCEL_DOWNLOADS: 'CANCEL_DOWNLOADS',
  RETRY_DOWNLOADS: 'RETRY_DOWNLOADS',

  // Status and health messages
  PING: 'PING',
  PONG: 'PONG',
  STATUS_UPDATE: 'STATUS_UPDATE',
  ERROR_REPORT: 'ERROR_REPORT',

  // Configuration messages
  GET_CONFIG: 'GET_CONFIG',
  UPDATE_CONFIG: 'UPDATE_CONFIG',
  CONFIG_CHANGED: 'CONFIG_CHANGED'
};

/**
 * Message priority levels
 * @readonly
 * @enum {number}
 */
export const MessagePriority = {
  LOW: 1,
  NORMAL: 2,
  HIGH: 3,
  CRITICAL: 4
};

/**
 * Create a standardized message object
 * @param {string} type - Message type from MessageTypes enum
 * @param {*} payload - Message payload data
 * @param {string} [requestId] - Optional request ID for correlation
 * @param {number} [priority=MessagePriority.NORMAL] - Message priority
 * @returns {import('../interfaces/IMessageBus.js').Message} Formatted message
 */
export function createMessage(type, payload, requestId = null, priority = MessagePriority.NORMAL) {
  return {
    type,
    payload,
    requestId: requestId || generateRequestId(),
    timestamp: Date.now(),
    priority
  };
}

/**
 * Create a standardized response message
 * @param {string} requestId - Original request ID
 * @param {boolean} success - Whether the operation was successful
 * @param {*} [data] - Response data if successful
 * @param {string} [error] - Error message if unsuccessful
 * @returns {import('../interfaces/IMessageBus.js').MessageResponse} Formatted response
 */
export function createResponse(requestId, success, data = null, error = null) {
  return {
    success,
    data,
    error,
    requestId,
    timestamp: Date.now()
  };
}

/**
 * Generate a unique request ID
 * @returns {string} Unique request identifier
 */
export function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Validate message structure
 * @param {*} message - Message to validate
 * @returns {boolean} True if message is valid
 */
export function isValidMessage(message) {
  return (
    message &&
    typeof message === 'object' &&
    typeof message.type === 'string' &&
    message.type.length > 0 &&
    typeof message.requestId === 'string' &&
    typeof message.timestamp === 'number'
  );
}

/**
 * Validate response structure
 * @param {*} response - Response to validate
 * @returns {boolean} True if response is valid
 */
export function isValidResponse(response) {
  return (
    response &&
    typeof response === 'object' &&
    typeof response.success === 'boolean' &&
    typeof response.requestId === 'string' &&
    typeof response.timestamp === 'number'
  );
}
