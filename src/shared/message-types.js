/**
 * Legacy message types for backward compatibility
 * These are maintained for compatibility with existing popup and content scripts
 */

// Content script to popup/background messages
export const CONTENT_MESSAGES = {
  IMAGES_EXTRACTED: 'IMAGES_EXTRACTED',
  EXTRACTION_ERROR: 'EXTRACTION_ERROR'
};

// Popup to content script messages
export const POPUP_MESSAGES = {
  EXTRACT_IMAGES: 'EXTRACT_IMAGES',
  GET_CURRENT_IMAGES: 'GET_IMAGES'
};

// Background script messages
export const BACKGROUND_MESSAGES = {
  DOWNLOAD_IMAGES: 'DOWNLOAD_BATCH',
  DOWNLOAD_SINGLE_IMAGE: 'DOWNLOAD_SINGLE'
};

// Message response structure
export const createSuccessResponse = (data) => ({
  success: true,
  ...data
});

export const createErrorResponse = (error, message = 'Operation failed') => ({
  success: false,
  error: error.message || error,
  message
});
