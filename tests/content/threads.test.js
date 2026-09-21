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

describe('ThreadsPlatform saved post actions', () => {
  test('detects and clicks the target post remove control', async () => {
    document.body.innerHTML = `
      <div data-pressable-container="true">
        <a href="/t/ABC123">target post</a>
        <button id="unsave"><svg aria-label="Remove"></svg></button>
      </div>
    `;
    mockWindowLocation('/t/ABC123');
    document.getElementById('unsave').addEventListener('click', event => event.currentTarget.remove());

    const platform = new global.ThreadsPlatform();
    await expect(platform.getSaveState())
      .resolves.toMatchObject({ supported: true, saved: true, platform: 'threads' });

    await platform.unsavePost();

    await expect(platform.getSaveState()).resolves.toMatchObject({ saved: false });
  });

  test('detects and clicks Unsave from the target post More menu', async () => {
    document.body.innerHTML = `
      <div role="menu" style="display:none">
        <div role="menuitem">Stale hidden menu item</div>
      </div>
      <div data-pressable-container="true">
        <a href="/t/ABC123">target post</a>
        <div id="more" role="button" aria-haspopup="menu" aria-expanded="false"></div>
        <div role="button" aria-haspopup="dialog" aria-expanded="false">Repost</div>
      </div>
    `;
    mockWindowLocation('/t/ABC123');

    let saved = true;
    const moreButton = document.getElementById('more');
    moreButton.addEventListener('click', () => {
      const existingMenu = Array.from(document.querySelectorAll('[role="menu"]'))
        .find(menu => window.getComputedStyle(menu).display !== 'none');
      if (existingMenu) {
        existingMenu.remove();
        moreButton.setAttribute('aria-expanded', 'false');
        return;
      }

      const menu = document.createElement('div');
      menu.setAttribute('role', 'menu');
      const item = document.createElement('div');
      item.setAttribute('role', 'menuitem');
      item.textContent = saved ? 'Unsave' : 'Save';
      item.addEventListener('click', () => {
        saved = false;
        menu.remove();
        moreButton.setAttribute('aria-expanded', 'false');
      });
      menu.appendChild(item);
      document.body.appendChild(menu);
      moreButton.setAttribute('aria-expanded', 'true');
    });

    const platform = new global.ThreadsPlatform();
    await expect(platform.getSaveState()).resolves.toMatchObject({ saved: true });
    expect(platform._findOpenMenu()).toBeNull();

    await platform.unsavePost();

    expect(saved).toBe(false);
  });
});
