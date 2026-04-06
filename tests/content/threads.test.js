/**
 * @jest-environment jsdom
 * @jest-environment-options {"url": "https://www.threads.com/"}
 */
const { loadContentScript, mockWindowLocation } = require('./helpers.js');

beforeAll(() => {
  loadContentScript();
});

beforeEach(() => {
  document.body.innerHTML = '';
  jest.clearAllMocks();
});

describe('ThreadsPlatform.extractImages()', () => {
  test('returns empty array when no container is found', async () => {
    document.body.innerHTML = '<div>irrelevant content</div>';
    mockWindowLocation('/t/ABC123');

    const platform = new global.ThreadsPlatform();
    const result = await platform.extractImages();

    expect(result).toEqual([]);
  });

  test('single image post: returns post images, skipping the first (profile picture)', async () => {
    document.body.innerHTML = `
      <div data-pressable-container="true">
        <a href="/t/ABC123"><span>post</span></a>
        <img src="https://example.com/profile.jpg" alt="profile">
        <img src="https://scontent.cdninstagram.com/v/photo.jpg" alt="photo">
      </div>
    `;
    mockWindowLocation('/t/ABC123');

    const platform = new global.ThreadsPlatform();
    const result = await platform.extractImages();

    expect(result).toHaveLength(1);
    expect(result[0].fullSizeUrl).toContain('photo.jpg');
    expect(result[0].mediaType).toBe('image');
  });

  test('carousel post: returns all images inside <picture> elements', async () => {
    document.body.innerHTML = `
      <div data-pressable-container="true">
        <a href="/t/ABC123"><span>post</span></a>
        <picture><img src="https://scontent.cdninstagram.com/v/photo1.jpg" alt="1"></picture>
        <picture><img src="https://scontent.cdninstagram.com/v/photo2.jpg" alt="2"></picture>
        <picture><img src="https://scontent.cdninstagram.com/v/photo3.jpg" alt="3"></picture>
      </div>
    `;
    mockWindowLocation('/t/ABC123');

    const platform = new global.ThreadsPlatform();
    const result = await platform.extractImages();

    expect(result).toHaveLength(3);
    result.forEach(item => expect(item.mediaType).toBe('image'));
    expect(result[0].fullSizeUrl).toContain('photo1.jpg');
    expect(result[2].fullSizeUrl).toContain('photo3.jpg');
  });

  test('video post: returns video items with cover image as thumbnail', async () => {
    document.body.innerHTML = `
      <div data-pressable-container="true">
        <a href="/t/ABC123"><span>post</span></a>
        <img src="https://example.com/profile.jpg" alt="profile">
        <img src="https://example.com/cover.jpg" alt="cover">
        <video src="https://example.com/video.mp4"></video>
      </div>
    `;
    mockWindowLocation('/t/ABC123');

    const platform = new global.ThreadsPlatform();
    const result = await platform.extractImages();

    expect(result).toHaveLength(1);
    expect(result[0].mediaType).toBe('video');
    expect(result[0].fullSizeUrl).toBe('https://example.com/video.mp4');
    expect(result[0].thumbnailUrl).toContain('cover.jpg');
  });

  test('video post without src: skips video elements that have no src', async () => {
    document.body.innerHTML = `
      <div data-pressable-container="true">
        <a href="/t/ABC123"><span>post</span></a>
        <img src="https://example.com/profile.jpg" alt="profile">
        <video></video>
      </div>
    `;
    mockWindowLocation('/t/ABC123');

    const platform = new global.ThreadsPlatform();
    const result = await platform.extractImages();

    expect(result).toHaveLength(0);
  });
});

describe('ThreadsPlatform._findTargetContainer()', () => {
  test('selects the container that contains a link matching the post ID from URL', () => {
    document.body.innerHTML = `
      <div data-pressable-container="true"><a href="/t/OTHER">other post</a></div>
      <div data-pressable-container="true"><a href="/t/ABC123">target post</a></div>
    `;
    mockWindowLocation('/t/ABC123');

    const platform = new global.ThreadsPlatform();
    const container = platform._findTargetContainer();

    expect(container.querySelector('a[href="/t/ABC123"]')).not.toBeNull();
  });

  test('falls back to first container when no container matches the post ID', () => {
    document.body.innerHTML = `
      <div data-pressable-container="true" id="first"><a href="/t/OTHER">other</a></div>
      <div data-pressable-container="true" id="second"><a href="/t/UNRELATED">unrelated</a></div>
    `;
    mockWindowLocation('/t/NOMATCH');

    const platform = new global.ThreadsPlatform();
    const container = platform._findTargetContainer();

    expect(container.id).toBe('first');
  });
});
