/**
 * Main background script for Social Media Image Downloader
 * Uses the new BackgroundService architecture
 */

import { createBackgroundService } from './BackgroundService.js';

// Global background service instance
let backgroundService = null;

/**
 * Initialize the background service
 * @returns {Promise<void>}
 */
async function initializeBackgroundService() {
  try {
    if (backgroundService) {
      return; // Already initialized
    }

    backgroundService = await createBackgroundService();
    console.log('[Background] Service initialized successfully');

  } catch (error) {
    console.error('[Background] Failed to initialize service:', error);

    // Retry initialization after a delay
    setTimeout(() => {
      initializeBackgroundService();
    }, 5000);
  }
}

/**
 * Cleanup background service
 * @returns {Promise<void>}
 */
async function cleanupBackgroundService() {
  if (backgroundService) {
    await backgroundService.cleanup();
    backgroundService = null;
  }
}

// Initialize service when script loads
initializeBackgroundService();

// Handle service worker lifecycle events
if (typeof self !== 'undefined' && self.addEventListener) {
  // Service worker context
  self.addEventListener('install', (event) => {
    console.log('[Background] Service worker installing');
    event.waitUntil(initializeBackgroundService());
  });

  self.addEventListener('activate', (event) => {
    console.log('[Background] Service worker activating');
    event.waitUntil(initializeBackgroundService());
  });
}

// Ensure service is available for other scripts
globalThis.getBackgroundService = () => backgroundService;
