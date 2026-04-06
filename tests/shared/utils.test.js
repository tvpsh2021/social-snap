const constants = require('../../src/shared/constants.js');

// utils.js depends on PLATFORMS and PLATFORM_HOSTNAMES as globals
global.PLATFORMS = constants.PLATFORMS;
global.PLATFORM_HOSTNAMES = constants.PLATFORM_HOSTNAMES;

const { getFileExtension, getPlatformFromUrl } = require('../../src/shared/utils.js');

describe('getFileExtension', () => {
  test('extracts .jpg from URL path', () => {
    expect(getFileExtension('https://cdn.example.com/photo/abc123.jpg')).toBe('jpg');
  });

  test('extracts .jpeg from URL path', () => {
    expect(getFileExtension('https://cdn.example.com/photo/abc123.jpeg')).toBe('jpeg');
  });

  test('extracts .png from URL path', () => {
    expect(getFileExtension('https://cdn.example.com/image.png')).toBe('png');
  });

  test('extracts .mp4 from URL path', () => {
    expect(getFileExtension('https://cdn.example.com/video/clip.mp4')).toBe('mp4');
  });

  test('extracts .webp from URL path', () => {
    expect(getFileExtension('https://cdn.example.com/photo.webp')).toBe('webp');
  });

  test('extracts .gif from URL path', () => {
    expect(getFileExtension('https://cdn.example.com/animation.gif')).toBe('gif');
  });

  test('is case-insensitive for extensions', () => {
    expect(getFileExtension('https://cdn.example.com/photo.JPG')).toBe('jpg');
    expect(getFileExtension('https://cdn.example.com/video.MP4')).toBe('mp4');
  });

  test('reads format from query parameter', () => {
    expect(getFileExtension('https://cdn.example.com/image?format=webp&quality=80')).toBe('webp');
  });

  test('falls back to string matching when no extension or format param', () => {
    expect(getFileExtension('https://cdn.example.com/mp4/segment/123')).toBe('mp4');
    expect(getFileExtension('https://cdn.example.com/jpg/render/456')).toBe('jpg');
    expect(getFileExtension('https://cdn.example.com/png/render/789')).toBe('png');
  });

  test('returns jpg as default when no extension detected', () => {
    expect(getFileExtension('https://cdn.example.com/unknown/resource/123')).toBe('jpg');
  });

  test('returns jpg for malformed URL', () => {
    expect(getFileExtension('not-a-valid-url')).toBe('jpg');
  });

  test('handles Instagram CDN URLs with query params', () => {
    expect(getFileExtension('https://scontent.cdninstagram.com/v/image.jpg?_nc_ht=scontent&_nc_cat=1')).toBe('jpg');
  });

  test('handles Facebook CDN video URLs', () => {
    expect(getFileExtension('https://video.xx.fbcdn.net/v/clip.mp4?efg=abc&oh=xyz')).toBe('mp4');
  });

  test('handles X/Twitter image URLs with name param', () => {
    expect(getFileExtension('https://pbs.twimg.com/media/abc123.jpg?format=jpg&name=large')).toBe('jpg');
  });
});

describe('getPlatformFromUrl', () => {
  test('detects Threads', () => {
    expect(getPlatformFromUrl('https://www.threads.com/@user/post/abc123')).toBe('threads');
  });

  test('detects Instagram', () => {
    expect(getPlatformFromUrl('https://www.instagram.com/p/abc123')).toBe('instagram');
  });

  test('detects Facebook', () => {
    expect(getPlatformFromUrl('https://www.facebook.com/photo/?fbid=123')).toBe('facebook');
  });

  test('detects X.com', () => {
    expect(getPlatformFromUrl('https://x.com/user/status/123/photo/1')).toBe('x');
  });

  test('returns null for unknown URL', () => {
    expect(getPlatformFromUrl('https://www.youtube.com/watch?v=abc')).toBeNull();
  });

  test('returns null for empty string', () => {
    expect(getPlatformFromUrl('')).toBeNull();
  });

  test('detects platform from CDN URLs', () => {
    expect(getPlatformFromUrl('https://scontent.cdninstagram.com/v/image.jpg')).toBe('instagram');
    expect(getPlatformFromUrl('https://video.xx.fbcdn.net/v/clip.mp4')).toBeNull();
  });
});
