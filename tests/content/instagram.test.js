/**
 * @jest-environment jsdom
 * @jest-environment-options {"url": "https://www.instagram.com/"}
 */
const { loadContentScript, mockWindowLocation } = require('./helpers.js');

beforeAll(() => {
  loadContentScript();
});

beforeEach(() => {
  document.body.innerHTML = '';
  jest.clearAllMocks();
  performance.getEntriesByType = jest.fn().mockReturnValue([]);
});

describe('InstagramPlatform.extractImages()', () => {
  test('returns empty array when <main> element is not found', async () => {
    document.body.innerHTML = '<div>no main here</div>';
    mockWindowLocation('/p/ABC123');

    const platform = new global.InstagramPlatform();
    const result = await platform.extractImages();

    expect(result).toEqual([]);
  });

  test('single image post: returns the main post image', async () => {
    mockWindowLocation('/p/ABC123');

    const main = document.createElement('main');
    const img = document.createElement('img');
    img.src = 'https://scontent.cdninstagram.com/v/photo.jpg';
    img.alt = 'a photo';
    // Instagram filters by naturalWidth/Height > 150; jsdom returns 0 by default
    Object.defineProperty(img, 'naturalWidth', { get: () => 400, configurable: true });
    Object.defineProperty(img, 'naturalHeight', { get: () => 300, configurable: true });
    main.appendChild(img);
    document.body.appendChild(main);

    const platform = new global.InstagramPlatform();
    const result = await platform.extractImages();

    expect(result).toHaveLength(1);
    expect(result[0].fullSizeUrl).toContain('photo.jpg');
  });

  test('single image post: filters out images smaller than 150x150', async () => {
    mockWindowLocation('/p/ABC123');

    const main = document.createElement('main');
    const small = document.createElement('img');
    small.src = 'https://scontent.cdninstagram.com/v/icon.png';
    // naturalWidth/Height default to 0 in jsdom — below the 150px threshold
    main.appendChild(small);
    document.body.appendChild(main);

    const platform = new global.InstagramPlatform();
    const result = await platform.extractImages();

    expect(result).toHaveLength(0);
  });

  test('single video post: returns video using URL from performance API', async () => {
    mockWindowLocation('/p/ABC123');

    performance.getEntriesByType = jest.fn().mockReturnValue([
      { name: 'https://video.cdninstagram.com/v/clip.mp4' }
    ]);

    const main = document.createElement('main');
    const video = document.createElement('video');
    video.play = jest.fn().mockResolvedValue(undefined);
    main.appendChild(video);
    document.body.appendChild(main);

    const platform = new global.InstagramPlatform();
    const result = await platform.extractImages();

    expect(result).toHaveLength(1);
    expect(result[0].mediaType).toBe('video');
    expect(result[0].fullSizeUrl).toContain('clip.mp4');
  });

  test('single video post: returns empty array when video URL cannot be found', async () => {
    mockWindowLocation('/p/ABC123');
    performance.getEntriesByType = jest.fn().mockReturnValue([]);

    const main = document.createElement('main');
    const video = document.createElement('video');
    video.play = jest.fn().mockResolvedValue(undefined);
    main.appendChild(video);
    document.body.appendChild(main);

    const platform = new global.InstagramPlatform();
    const result = await platform.extractImages();

    expect(result).toEqual([]);
  });

  test('carousel post: collects the visible image slide via translateX detection', async () => {
    mockWindowLocation('/p/ABC123');

    // Build the carousel DOM with JS methods so jsdom respects element.style.transform
    const main = document.createElement('main');
    const ul = document.createElement('ul');

    const makeSlide = (src, translateX) => {
      const li = document.createElement('li');
      li.style.transform = `translateX(${translateX}px)`;
      const img = document.createElement('img');
      img.src = src;
      li.appendChild(img);
      return li;
    };

    ul.appendChild(makeSlide('https://scontent.cdninstagram.com/v/prev.jpg', -375));
    ul.appendChild(makeSlide('https://scontent.cdninstagram.com/v/current.jpg', 0));
    ul.appendChild(makeSlide('https://scontent.cdninstagram.com/v/next.jpg', 375));
    main.appendChild(ul);
    document.body.appendChild(main);

    // No Next button → navigation loop exits after first collection.
    // The carousel logic always collects listItems[1] (current) and listItems[2] (preloaded next).
    const platform = new global.InstagramPlatform();
    const result = await platform.extractImages();

    expect(result).toHaveLength(2);
    expect(result[0].fullSizeUrl).toContain('current.jpg');
    expect(result[1].fullSizeUrl).toContain('next.jpg');
  });

  test('carousel post: collects video from visible slide via performance API', async () => {
    mockWindowLocation('/p/ABC123');

    performance.getEntriesByType = jest.fn().mockReturnValue([
      { name: 'https://video.cdninstagram.com/v/carousel_clip.mp4?xpv_asset_id=999' }
    ]);

    const main = document.createElement('main');
    const ul = document.createElement('ul');

    const prevLi = document.createElement('li');
    prevLi.style.transform = 'translateX(-375px)';
    const prevImg = document.createElement('img');
    prevImg.src = 'https://scontent.cdninstagram.com/v/prev.jpg';
    prevLi.appendChild(prevImg);

    const currentLi = document.createElement('li');
    currentLi.style.transform = 'translateX(0px)';
    const video = document.createElement('video');
    video.src = 'blob:https://www.instagram.com/fake';
    video.play = jest.fn().mockResolvedValue(undefined);
    const thumb = document.createElement('img');
    thumb.src = 'https://scontent.cdninstagram.com/v/thumb.jpg';
    thumb.setAttribute('referrerpolicy', 'no-referrer');
    currentLi.appendChild(video);
    currentLi.appendChild(thumb);

    const nextLi = document.createElement('li');
    nextLi.style.transform = 'translateX(375px)';
    const nextImg = document.createElement('img');
    nextImg.src = 'https://scontent.cdninstagram.com/v/next.jpg';
    nextLi.appendChild(nextImg);

    ul.appendChild(prevLi);
    ul.appendChild(currentLi);
    ul.appendChild(nextLi);
    main.appendChild(ul);
    document.body.appendChild(main);

    // The carousel logic collects listItems[1] (video) and listItems[2] (next image).
    const platform = new global.InstagramPlatform();
    const result = await platform.extractImages();

    expect(result).toHaveLength(2);
    expect(result[0].mediaType).toBe('video');
    expect(result[0].fullSizeUrl).toContain('carousel_clip.mp4');
    expect(result[1].fullSizeUrl).toContain('next.jpg');
  });
});

describe('InstagramPlatform._findNextButton()', () => {
  test('returns null when no button matches the right:0px computed style', () => {
    const main = document.createElement('main');
    main.innerHTML = '<button tabindex="-1">Next</button>';
    document.body.appendChild(main);

    const platform = new global.InstagramPlatform();
    // jsdom getComputedStyle returns empty string for 'right' (no real CSS engine)
    const button = platform._findNextButton(main);

    expect(button).toBeNull();
  });
});
