const fs = require('fs');
const path = require('path');

function loadContentScript() {
  const constants = require('../../src/shared/constants.js');
  const utils = require('../../src/shared/utils.js');

  global.PLATFORMS = constants.PLATFORMS;
  global.PLATFORM_HOSTNAMES = constants.PLATFORM_HOSTNAMES;
  global.CONTENT_MESSAGES = constants.CONTENT_MESSAGES;
  global.getFileExtension = utils.getFileExtension;
  global.getPlatformFromUrl = utils.getPlatformFromUrl;
  // Replace wait with a no-op so async extractions don't actually sleep
  global.wait = jest.fn().mockResolvedValue(undefined);

  let source = fs.readFileSync(
    path.join(__dirname, '../../src/content/content.js'),
    'utf8'
  );

  // Expose module-level constants so tests can read them and class methods can find them as globals
  [
    'SINGLE_POST_PATTERNS', 'HOMEPAGE_PATTERNS', 'GENERAL_CONFIG',
    'CAROUSEL', 'IMAGE_FILTERS', 'SELECTORS',
  ].forEach(name => {
    source = source.replace(
      new RegExp(`(?:const|let|var)\\s+${name}\\s*=`),
      `global.${name} =`
    );
  });

  // Expose mutable flags
  source = source.replace(/let\s+stopFbExtractionRequested\s*=/, 'global.stopFbExtractionRequested =');
  source = source.replace(/let\s+fbCarouselActive\s*=/, 'global.fbCarouselActive =');

  // Expose X video cache Map so tests can seed / inspect it
  source = source.replace('const X_VIDEO_CACHE = new Map()', 'global.X_VIDEO_CACHE = new Map()');

  // Expose platform classes
  [
    'BasePlatform', 'ThreadsPlatform', 'InstagramPlatform',
    'FacebookPlatform', 'XPlatform', 'PlatformFactory',
  ].forEach(name => {
    source = source.replace(
      new RegExp(`class\\s+${name}\\b`),
      `global.${name} = class ${name}`
    );
  });

  eval(source); // content.js is a browser script with no module exports; eval is the only viable loader
}

/**
 * Changes window.location pathname (and optional search) via history.pushState.
 * Each test file sets the hostname via @jest-environment-options, so only the
 * path portion needs to be changed per test.
 *
 * @param {string} pathname - e.g. '/p/ABC123' or '/photo/?fbid=123'
 */
function mockWindowLocation(pathname) {
  window.history.pushState({}, '', pathname);
}

/**
 * Makes getBoundingClientRect() return a non-zero size on the given element.
 */
function mockRect(el, width = 400, height = 300) {
  el.getBoundingClientRect = jest.fn().mockReturnValue({ width, height, top: 0, left: 0, bottom: height, right: width });
}

module.exports = { loadContentScript, mockWindowLocation, mockRect };
