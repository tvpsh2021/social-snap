/**
 * @jest-environment jsdom
 * @jest-environment-options {"url": "https://x.com/"}
 */
const { loadContentScript, mockWindowLocation, mockRect } = require('./helpers.js');

beforeAll(() => {
  loadContentScript();
});

beforeEach(() => {
  document.body.innerHTML = '';
  jest.clearAllMocks();
  global.X_VIDEO_CACHE.clear();
  performance.getEntriesByType = jest.fn().mockReturnValue([]);
});

// Helpers

function makeDialog() {
  const dialog = document.createElement('div');
  dialog.setAttribute('role', 'dialog');
  document.body.appendChild(dialog);
  return dialog;
}

function makeContentImage(src = 'https://pbs.twimg.com/media/abc.jpg?format=jpg&name=large') {
  const img = document.createElement('img');
  img.src = src;
  img.alt = 'Image';
  mockRect(img, 400, 300);
  return img;
}

describe('XPlatform.extractImages() — no dialog', () => {
  test('returns empty array when in photo mode but no dialog is found', async () => {
    document.body.innerHTML = '<div>no dialog here</div>';
    mockWindowLocation('/user/status/123/photo/1');

    const platform = new global.XPlatform();
    const result = await platform.extractImages();

    expect(result).toEqual([]);
  });

  test('falls through to tweet-page video extraction when not in photo/video mode', async () => {
    document.body.innerHTML = '<div>no dialog</div>';
    mockWindowLocation('/user/status/123');

    const platform = new global.XPlatform();
    jest.spyOn(platform, '_extractVideoFromTweetPage').mockReturnValue([]);
    await platform.extractImages();

    expect(platform._extractVideoFromTweetPage).toHaveBeenCalled();
  });
});

describe('XPlatform.extractImages() — single image', () => {
  test('extracts single content image from inside the dialog', async () => {
    mockWindowLocation('/user/status/123/photo/1');

    const dialog = makeDialog();
    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-testid', 'swipe-to-dismiss');
    wrapper.appendChild(makeContentImage('https://pbs.twimg.com/media/abc.jpg?format=jpg&name=large'));
    dialog.appendChild(wrapper);

    const platform = new global.XPlatform();
    const result = await platform.extractImages();

    expect(result).toHaveLength(1);
    expect(result[0].fullSizeUrl).toContain('pbs.twimg.com');
  });

  test('returns empty array when dialog has no content images', async () => {
    mockWindowLocation('/user/status/123/photo/1');

    const dialog = makeDialog();
    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-testid', 'swipe-to-dismiss');
    // No image element inside — nothing to extract
    dialog.appendChild(wrapper);

    const platform = new global.XPlatform();
    const result = await platform.extractImages();

    expect(result).toEqual([]);
  });
});

describe('XPlatform.extractImages() — GIF in dialog', () => {
  test('detects GIF via video element with tweet_video src', async () => {
    mockWindowLocation('/user/status/123/photo/1');

    const dialog = makeDialog();
    const video = document.createElement('video');
    video.setAttribute('src', 'https://video.twimg.com/tweet_video/abc.mp4');
    video.setAttribute('poster', 'https://pbs.twimg.com/tweet_video_thumb/abc.jpg');
    mockRect(video, 400, 300);
    dialog.appendChild(video);

    const platform = new global.XPlatform();
    const result = await platform.extractImages();

    expect(result).toHaveLength(1);
    expect(result[0].mediaType).toBe('video');
    expect(result[0].fullSizeUrl).toContain('tweet_video/abc.mp4');
    expect(result[0].isHLS).toBe(false);
  });
});

describe('XPlatform.extractImages() — video from cache in dialog', () => {
  test('returns video when videoId from poster is found in X_VIDEO_CACHE', async () => {
    mockWindowLocation('/user/status/123/video/1');

    const videoId = 'vid999';
    global.X_VIDEO_CACHE.set(videoId, {
      fullSizeUrl: 'https://video.twimg.com/ext_tw_video/vid999/pu/vid/1280x720/clip.m3u8',
      thumbnailUrl: `https://pbs.twimg.com/ext_tw_video_thumb/${videoId}/pu/img/thumb.jpg`,
      isHLS: true,
    });

    const dialog = makeDialog();
    const ul = document.createElement('ul');
    ul.setAttribute('role', 'list');
    const li = document.createElement('li');
    li.setAttribute('role', 'listitem');
    const video = document.createElement('video');
    video.setAttribute('poster', `https://pbs.twimg.com/ext_tw_video_thumb/${videoId}/pu/img/thumb.jpg`);
    mockRect(video, 400, 300);
    li.appendChild(video);
    ul.appendChild(li);
    dialog.appendChild(ul);

    const platform = new global.XPlatform();
    const result = await platform.extractImages();

    expect(result).toHaveLength(1);
    expect(result[0].mediaType).toBe('video');
    expect(result[0].fullSizeUrl).toContain('vid999');
    expect(result[0].isHLS).toBe(true);
  });
});

describe('XPlatform.extractImages() — image carousel', () => {
  test('collects all images from carousel list items', async () => {
    mockWindowLocation('/user/status/123/photo/1');

    const dialog = makeDialog();
    const ul = document.createElement('ul');
    ul.setAttribute('role', 'list');

    ['img1.jpg', 'img2.jpg'].forEach(filename => {
      const li = document.createElement('li');
      li.setAttribute('role', 'listitem');
      li.appendChild(makeContentImage(`https://pbs.twimg.com/media/${filename}?format=jpg&name=4096x4096`));
      ul.appendChild(li);
    });

    dialog.appendChild(ul);

    const platform = new global.XPlatform();
    const result = await platform.extractImages();

    expect(result).toHaveLength(2);
    result.forEach(item => expect(item.fullSizeUrl).toContain('pbs.twimg.com'));
  });
});

describe('XPlatform._extractVideoFromTweetPage()', () => {
  test('returns empty array when no tweet article is found', () => {
    document.body.innerHTML = '<div>no articles</div>';
    const platform = new global.XPlatform();
    const result = platform._extractVideoFromTweetPage();
    expect(result).toEqual([]);
  });

  test('returns empty array when tweet article has no video element', () => {
    document.body.innerHTML = '<article data-testid="tweet"><div>text only</div></article>';
    const platform = new global.XPlatform();
    const result = platform._extractVideoFromTweetPage();
    expect(result).toEqual([]);
  });

  test('detects GIF: returns video item with isHLS=false', () => {
    const article = document.createElement('article');
    article.setAttribute('data-testid', 'tweet');
    const video = document.createElement('video');
    video.setAttribute('src', 'https://video.twimg.com/tweet_video/gif.mp4');
    video.setAttribute('poster', 'https://pbs.twimg.com/tweet_video_thumb/gif.jpg');
    article.appendChild(video);
    document.body.appendChild(article);

    const platform = new global.XPlatform();
    const result = platform._extractVideoFromTweetPage();

    expect(result).toHaveLength(1);
    expect(result[0].fullSizeUrl).toContain('tweet_video/gif.mp4');
    expect(result[0].isHLS).toBe(false);
    expect(result[0].mediaType).toBe('video');
  });

  test('returns intercepted video URL from X_VIDEO_CACHE matched by videoId in poster', () => {
    const videoId = 'vid123';
    global.X_VIDEO_CACHE.set(videoId, {
      fullSizeUrl: 'https://video.twimg.com/ext_tw_video/vid123/pu/vid/1280x720/clip.m3u8',
      thumbnailUrl: '',
      isHLS: true,
    });

    const article = document.createElement('article');
    article.setAttribute('data-testid', 'tweet');
    const video = document.createElement('video');
    video.setAttribute('poster', `https://pbs.twimg.com/ext_tw_video_thumb/${videoId}/pu/img/thumb.jpg`);
    article.appendChild(video);
    document.body.appendChild(article);

    const platform = new global.XPlatform();
    const result = platform._extractVideoFromTweetPage();

    expect(result).toHaveLength(1);
    expect(result[0].fullSizeUrl).toContain('vid123');
    expect(result[0].isHLS).toBe(true);
  });

  test('falls back to tweet URL when video is not in cache or performance entries', () => {
    mockWindowLocation('/user/status/123/photo/1');

    const article = document.createElement('article');
    article.setAttribute('data-testid', 'tweet');
    const video = document.createElement('video');
    video.setAttribute('poster', 'https://pbs.twimg.com/ext_tw_video_thumb/UNKNOWN/pu/img/thumb.jpg');
    article.appendChild(video);
    document.body.appendChild(article);

    const platform = new global.XPlatform();
    const result = platform._extractVideoFromTweetPage();

    expect(result).toHaveLength(1);
    // Falls back to tweet page URL (with /photo/1 stripped) and marks as HLS
    expect(result[0].fullSizeUrl).toContain('x.com');
    expect(result[0].isHLS).toBe(true);
  });
});
