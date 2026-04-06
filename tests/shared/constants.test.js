const {
  PLATFORMS,
  PLATFORM_HOSTNAMES,
  CONTENT_MESSAGES,
  POPUP_MESSAGES,
  BACKGROUND_MESSAGES,
} = require('../../src/shared/constants.js');

describe('PLATFORMS', () => {
  test('has all expected platform keys', () => {
    expect(PLATFORMS).toHaveProperty('THREADS');
    expect(PLATFORMS).toHaveProperty('INSTAGRAM');
    expect(PLATFORMS).toHaveProperty('FACEBOOK');
    expect(PLATFORMS).toHaveProperty('X');
  });

  test('values are lowercase strings', () => {
    Object.values(PLATFORMS).forEach(value => {
      expect(typeof value).toBe('string');
      expect(value).toBe(value.toLowerCase());
    });
  });
});

describe('PLATFORM_HOSTNAMES', () => {
  test('has an entry for every platform', () => {
    Object.values(PLATFORMS).forEach(platform => {
      expect(PLATFORM_HOSTNAMES).toHaveProperty(platform);
    });
  });

  test('hostnames end with known TLDs', () => {
    Object.values(PLATFORM_HOSTNAMES).forEach(hostname => {
      expect(hostname).toMatch(/\.com$/);
    });
  });
});

describe('Message constants', () => {
  test('CONTENT_MESSAGES has expected keys', () => {
    expect(Object.keys(CONTENT_MESSAGES)).toEqual(
      expect.arrayContaining(['IMAGES_EXTRACTED', 'IMAGES_APPEND', 'EXTRACTION_COMPLETE', 'EXTRACTION_ERROR'])
    );
  });

  test('POPUP_MESSAGES has expected keys', () => {
    expect(Object.keys(POPUP_MESSAGES)).toEqual(
      expect.arrayContaining(['GET_CURRENT_IMAGES'])
    );
  });

  test('BACKGROUND_MESSAGES has expected keys', () => {
    expect(Object.keys(BACKGROUND_MESSAGES)).toEqual(
      expect.arrayContaining(['DOWNLOAD_IMAGES', 'DOWNLOAD_SINGLE_IMAGE', 'FETCH_FB_VIDEO_URL'])
    );
  });

  test('no duplicate values across all message types', () => {
    const allValues = [
      ...Object.values(CONTENT_MESSAGES),
      ...Object.values(POPUP_MESSAGES),
      ...Object.values(BACKGROUND_MESSAGES),
    ];
    const uniqueValues = new Set(allValues);
    expect(uniqueValues.size).toBe(allValues.length);
  });
});
