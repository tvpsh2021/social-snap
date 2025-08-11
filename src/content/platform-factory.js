/**
 * Platform factory for creating appropriate platform instances
 */

import { ThreadsPlatform } from './platforms/threads-platform.js';
import { InstagramPlatform } from './platforms/instagram-platform.js';
import { PLATFORMS, PLATFORM_HOSTNAMES } from '../shared/constants.js';

export class PlatformFactory {
  /**
   * Create platform instance based on current hostname
   * @returns {BasePlatform|null} Platform instance or null if unsupported
   */
  static createPlatform() {
    const hostname = window.location.hostname;

    if (hostname.includes(PLATFORM_HOSTNAMES[PLATFORMS.THREADS])) {
      return new ThreadsPlatform();
    } else if (hostname.includes(PLATFORM_HOSTNAMES[PLATFORMS.INSTAGRAM])) {
      return new InstagramPlatform();
    }

    // Return null for unsupported platforms
    return null;
  }

  /**
   * Get list of supported platforms
   * @returns {Array<string>} Array of supported platform hostnames
   */
  static getSupportedPlatforms() {
    return Object.values(PLATFORM_HOSTNAMES);
  }

  /**
   * Check if current platform is supported
   * @param {string} hostname - Hostname to check
   * @returns {boolean} True if platform is supported
   */
  static isPlatformSupported(hostname) {
    return Object.values(PLATFORM_HOSTNAMES).some(platform => hostname.includes(platform));
  }
}
