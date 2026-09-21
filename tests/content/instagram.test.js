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
  document.head.innerHTML = '';
  jest.clearAllMocks();
  global.wait.mockReset().mockResolvedValue(undefined);
  performance.getEntriesByType = jest.fn().mockReturnValue([]);
});

function appendEmbeddedPost(post) {
  const script = document.createElement('script');
  script.type = 'application/json';
  script.textContent = JSON.stringify({
    require: [['ScheduledServerJS', 'handle', null, [{ data: { post } }]]]
  });
  document.head.appendChild(script);
}

describe('InstagramPlatform.extractImages()', () => {
  test('returns empty array when <main> element is not found', async () => {
    document.body.innerHTML = '<div>no main here</div>';
    mockWindowLocation('/p/ABC123');

    const platform = new global.InstagramPlatform();
    const result = await platform.extractImages();

    expect(result).toEqual([]);
  });

  test('waits for Instagram to render the post DOM', async () => {
    mockWindowLocation('/p/ABC123');

    global.wait.mockImplementationOnce(async () => {
      const main = document.createElement('main');
      const img = document.createElement('img');
      img.src = 'https://scontent.cdninstagram.com/v/delayed.jpg';
      Object.defineProperty(img, 'naturalWidth', { get: () => 400, configurable: true });
      Object.defineProperty(img, 'naturalHeight', { get: () => 300, configurable: true });
      main.appendChild(img);
      document.body.appendChild(main);
    });

    const platform = new global.InstagramPlatform();
    const result = await platform.extractImages();

    expect(global.wait).toHaveBeenCalledWith(global.CAROUSEL.INSTAGRAM.READY_POLL_INTERVAL);
    expect(result).toHaveLength(1);
    expect(result[0].fullSizeUrl).toContain('delayed.jpg');
  });

  test('extracts all carousel images from embedded data without rendered post DOM', async () => {
    mockWindowLocation('/p/ABC123');
    appendEmbeddedPost({
      code: 'ABC123',
      media_type: 8,
      carousel_media: Array.from({ length: 6 }, (_, index) => ({
        media_type: 1,
        accessibility_caption: `Photo ${index + 1}`,
        image_versions2: {
          candidates: [
            { url: `https://scontent.cdninstagram.com/v/photo-${index + 1}-small.jpg`, width: 640, height: 640 },
            { url: `https://scontent.cdninstagram.com/v/photo-${index + 1}.jpg`, width: 1440, height: 1920 },
          ]
        }
      }))
    });

    const platform = new global.InstagramPlatform();
    const result = await platform.extractImages();

    expect(result).toHaveLength(6);
    expect(result.map(item => item.fullSizeUrl)).toEqual(
      Array.from({ length: 6 }, (_, index) => `https://scontent.cdninstagram.com/v/photo-${index + 1}.jpg`)
    );
    expect(global.wait).not.toHaveBeenCalled();
  });

  test('extracts mixed carousel videos directly from embedded data', async () => {
    mockWindowLocation('/p/ABC123');
    appendEmbeddedPost({
      code: 'ABC123',
      media_type: 8,
      carousel_media: [
        {
          media_type: 1,
          image_versions2: {
            candidates: [{ url: 'https://scontent.cdninstagram.com/v/photo.jpg', width: 1080, height: 1350 }]
          }
        },
        {
          media_type: 2,
          image_versions2: {
            candidates: [{ url: 'https://scontent.cdninstagram.com/v/poster.jpg', width: 1080, height: 1350 }]
          },
          video_versions: [
            { url: 'https://video.cdninstagram.com/v/video-low.mp4', width: 480, height: 600 },
            { url: 'https://video.cdninstagram.com/v/video-high.mp4?bytestart=0&byteend=100', width: 1080, height: 1350 },
          ]
        }
      ]
    });

    const platform = new global.InstagramPlatform();
    const result = await platform.extractImages();

    expect(result).toHaveLength(2);
    expect(result[0].mediaType).toBe('image');
    expect(result[1]).toMatchObject({
      mediaType: 'video',
      thumbnailUrl: 'https://scontent.cdninstagram.com/v/poster.jpg',
      fullSizeUrl: 'https://video.cdninstagram.com/v/video-high.mp4'
    });
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

  test('carousel post: collects only the visible image slide via translateX detection', async () => {
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

    // No Next button → navigation loop exits after collecting the visible slide.
    const platform = new global.InstagramPlatform();
    const result = await platform.extractImages();

    expect(result).toHaveLength(1);
    expect(result[0].fullSizeUrl).toContain('current.jpg');
  });

  test('carousel post: polls until the visible media changes before collecting the next slide', async () => {
    mockWindowLocation('/p/ABC123');

    const main = document.createElement('main');
    const ul = document.createElement('ul');
    const currentLi = document.createElement('li');
    const nextLi = document.createElement('li');
    const currentImg = document.createElement('img');
    const nextImg = document.createElement('img');
    const nextButton = document.createElement('button');

    currentLi.style.transform = 'translateX(0px)';
    nextLi.style.transform = 'translateX(375px)';
    currentImg.src = 'https://scontent.cdninstagram.com/v/current.jpg';
    nextImg.src = 'https://scontent.cdninstagram.com/v/next.jpg';
    nextButton.tabIndex = -1;
    nextButton.style.right = '0px';
    currentLi.appendChild(currentImg);
    nextLi.appendChild(nextImg);
    ul.appendChild(currentLi);
    ul.appendChild(nextLi);
    main.appendChild(ul);
    main.appendChild(nextButton);
    document.body.appendChild(main);

    let clicked = false;
    nextButton.addEventListener('click', () => {
      clicked = true;
    });
    global.wait.mockImplementation(async () => {
      if (!clicked) return;
      currentLi.style.transform = 'translateX(-375px)';
      nextLi.style.transform = 'translateX(0px)';
      nextButton.remove();
    });

    const platform = new global.InstagramPlatform();
    const result = await platform.extractImages();

    expect(result.map(item => item.fullSizeUrl)).toEqual([
      'https://scontent.cdninstagram.com/v/current.jpg',
      'https://scontent.cdninstagram.com/v/next.jpg',
    ]);
    expect(global.wait).toHaveBeenCalledWith(global.CAROUSEL.INSTAGRAM.MEDIA_POLL_INTERVAL);
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

    const platform = new global.InstagramPlatform();
    const result = await platform.extractImages();

    expect(result).toHaveLength(1);
    expect(result[0].mediaType).toBe('video');
    expect(result[0].fullSizeUrl).toContain('carousel_clip.mp4');
  });

  test('carousel video: polls for a delayed MP4 request', async () => {
    mockWindowLocation('/p/ABC123');

    performance.getEntriesByType = jest.fn()
      .mockReturnValueOnce([])
      .mockReturnValue([
        { name: 'https://video.cdninstagram.com/v/delayed_clip.mp4' }
      ]);

    const main = document.createElement('main');
    const ul = document.createElement('ul');
    const currentLi = document.createElement('li');
    const video = document.createElement('video');
    video.src = 'blob:https://www.instagram.com/delayed';
    video.play = jest.fn().mockResolvedValue(undefined);
    currentLi.style.transform = 'translateX(0px)';
    currentLi.appendChild(video);
    ul.appendChild(currentLi);
    main.appendChild(ul);
    document.body.appendChild(main);

    const platform = new global.InstagramPlatform();
    const result = await platform.extractImages();

    expect(video.play).toHaveBeenCalled();
    expect(global.wait).toHaveBeenCalledWith(global.CAROUSEL.INSTAGRAM.VIDEO_URL_POLL_INTERVAL);
    expect(result).toHaveLength(1);
    expect(result[0].fullSizeUrl).toContain('delayed_clip.mp4');
  });

  test('carousel video: ignores MP4 resources explicitly tagged as non-carousel', async () => {
    mockWindowLocation('/p/ABC123');

    const encodeMeta = meta => Buffer.from(JSON.stringify(meta))
      .toString('base64url');
    const unrelatedMeta = encodeMeta({ xpv_asset_id: '111', vencodeTag: 'clips_video' });
    const carouselMeta = encodeMeta({ xpv_asset_id: '222', vencodeTag: 'carousel_item' });
    performance.getEntriesByType = jest.fn().mockReturnValue([
      { name: `https://video.cdninstagram.com/v/unrelated.mp4?efg=${unrelatedMeta}` },
      { name: `https://video.cdninstagram.com/v/carousel.mp4?efg=${carouselMeta}` },
    ]);

    const main = document.createElement('main');
    const ul = document.createElement('ul');
    const currentLi = document.createElement('li');
    const video = document.createElement('video');
    video.src = 'blob:https://www.instagram.com/carousel';
    video.play = jest.fn().mockResolvedValue(undefined);
    currentLi.style.transform = 'translateX(0px)';
    currentLi.appendChild(video);
    ul.appendChild(currentLi);
    main.appendChild(ul);
    document.body.appendChild(main);

    const platform = new global.InstagramPlatform();
    const result = await platform.extractImages();

    expect(result).toHaveLength(1);
    expect(result[0].fullSizeUrl).toContain('/carousel.mp4');
  });
});

describe('InstagramPlatform saved post actions', () => {
  test('detects a localized remove control inside main', async () => {
    document.body.innerHTML = `
      <main><button id="unsave" aria-label="取消儲存"></button></main>
    `;
    mockWindowLocation('/p/ABC123');
    document.getElementById('unsave').addEventListener('click', event => event.currentTarget.remove());

    const platform = new global.InstagramPlatform();
    expect(platform.getSaveState().saved).toBe(true);

    await platform.unsavePost();

    expect(platform.getSaveState().saved).toBe(false);
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
