/**
 * Message types for communication between different parts of the extension
 */

// Content script to popup/background messages
export const CONTENT_MESSAGES = {
  IMAGES_EXTRACTED: 'imagesExtracted',
  EXTRACTION_ERROR: 'extractionError'
};

// Popup to content script messages
export const POPUP_MESSAGES = {
  EXTRACT_IMAGES: 'extractImages',
  GET_CURRENT_IMAGES: 'getCurrentImages'
};

// Background script messages
export const BACKGROUND_MESSAGES = {
  DOWNLOAD_IMAGES: 'downloadImages',
  DOWNLOAD_SINGLE_IMAGE: 'downloadSingleImage'
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
