/**
 * @jest-environment jsdom
 * @jest-environment-options {"url": "https://www.facebook.com/"}
 */
const { loadContentScript, mockWindowLocation, mockRect } = require('./helpers.js');

beforeAll(() => {
  loadContentScript();
});

beforeEach(() => {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  jest.clearAllMocks();
  global.stopFbExtractionRequested = false;
  global.fbCarouselActive = false;
});

// Build a <script type="application/json"> tag containing a fake DASH manifest.
// Using type="application/json" prevents jsdom from trying to execute the content.
//
// The content.js parser reads script.textContent and looks for the JSON string value of
// manifest_xml. Inside that JSON string, all " must be escaped as \" and / as \/, so that
// the parser can find the end of the JSON string correctly.
function buildDashManifestScript(representations) {
  const reps = representations
    .map(({ bandwidth, url }) =>
      `<Representation bandwidth=\\"${bandwidth}\\"><BaseURL>${url}<\\/BaseURL><\\/Representation>`
    )
    .join('');
  const xml = `<AdaptationSet contentType=\\"video\\">${reps}<\\/AdaptationSet>`;
  const script = document.createElement('script');
  script.type = 'application/json';
  script.textContent = `"dash_manifests":[{"manifest_xml":"${xml}"}]`;
  document.head.appendChild(script);
}

describe('FacebookPlatform.extractImages()', () => {
  test('returns empty array when the page is not a photo, reel, or video page', async () => {
    document.body.innerHTML = '<div>Facebook homepage content</div>';
    mockWindowLocation('/');

    const platform = new global.FacebookPlatform();
    const result = await platform.extractImages();

    expect(result).toEqual([]);
  });

  test('reel page: extracts the highest-bandwidth video from embedded DASH manifest', async () => {
    mockWindowLocation('/reel/123456789');
    buildDashManifestScript([
      { bandwidth: 500000, url: 'https://video.facebook.com/low.mp4' },
      { bandwidth: 2000000, url: 'https://video.facebook.com/high.mp4' },
    ]);

    const platform = new global.FacebookPlatform();
    const result = await platform.extractImages();

    expect(result).toHaveLength(1);
    expect(result[0].mediaType).toBe('video');
    expect(result[0].fullSizeUrl).toBe('https://video.facebook.com/high.mp4');
  });

  test('reel page: returns empty array when no DASH manifest is present', async () => {
    mockWindowLocation('/reel/123456789');
    // No script tag with dash_manifests

    const platform = new global.FacebookPlatform();
    const result = await platform.extractImages();

    expect(result).toEqual([]);
  });

  test('carousel video page: fetches video URL from background using videoId extracted from URL', async () => {
    mockWindowLocation('/100/videos/pcb.456/789');
    chrome.runtime.sendMessage.mockImplementation((_msg, callback) => {
      callback({ success: true, videoUrl: 'https://video.facebook.com/carousel.mp4' });
    });

    const platform = new global.FacebookPlatform();
    const result = await platform.extractImages();

    expect(result).toHaveLength(1);
    expect(result[0].mediaType).toBe('video');
    expect(result[0].fullSizeUrl).toBe('https://video.facebook.com/carousel.mp4');
  });

  test('photo page without navigation button: extracts image via static DOM detection', async () => {
    mockWindowLocation('/photo/?fbid=123456');

    const main = document.createElement('div');
    main.setAttribute('role', 'main');
    const img = document.createElement('img');
    img.src = 'https://scontent.fbcdn.net/v/123456_789_photo.jpg';
    mockRect(img, 400, 350);
    main.appendChild(img);
    document.body.appendChild(main);

    // No navigation button in DOM → carousel path is not taken
    const platform = new global.FacebookPlatform();
    const result = await platform.extractImages();

    expect(result).toHaveLength(1);
    expect(result[0].fullSizeUrl).toContain('photo.jpg');
  });

  test('photo page with navigation button: delegates to navigateCarousel()', async () => {
    mockWindowLocation('/photo/?fbid=123456');
    const carouselMedia = [
      { index: 1, alt: 'photo 1', fullSizeUrl: 'https://cdn.fb.com/1.jpg', thumbnailUrl: '', maxWidth: 0 },
      { index: 2, alt: 'photo 2', fullSizeUrl: 'https://cdn.fb.com/2.jpg', thumbnailUrl: '', maxWidth: 0 },
    ];

    const platform = new global.FacebookPlatform();
    jest.spyOn(platform, '_findNavigationButton').mockReturnValue(document.createElement('div'));
    jest.spyOn(platform, 'navigateCarousel').mockResolvedValue(carouselMedia);

    const result = await platform.extractImages();

    expect(platform.navigateCarousel).toHaveBeenCalled();
    expect(result).toHaveLength(2);
  });
});

describe('FacebookPlatform._extractVideoUrlFromDashManifest()', () => {
  test('returns highest-bandwidth video URL from DASH manifest in script tag', () => {
    buildDashManifestScript([
      { bandwidth: 1000000, url: 'https://video.facebook.com/med.mp4' },
      { bandwidth: 3000000, url: 'https://video.facebook.com/best.mp4' },
      { bandwidth: 500000, url: 'https://video.facebook.com/low.mp4' },
    ]);

    const platform = new global.FacebookPlatform();
    const url = platform._extractVideoUrlFromDashManifest();

    expect(url).toBe('https://video.facebook.com/best.mp4');
  });

  test('returns null when no script contains a DASH manifest', () => {
    // Empty head — no script tags

    const platform = new global.FacebookPlatform();
    const url = platform._extractVideoUrlFromDashManifest();

    expect(url).toBeNull();
  });
});

describe('FacebookPlatform._isFbVideoPage()', () => {
  test('returns true for /userId/videos/pcb.albumId/videoId URLs', () => {
    mockWindowLocation('/100/videos/pcb.456/789');
    const platform = new global.FacebookPlatform();
    expect(platform._isFbVideoPage()).toBe(true);
  });

  test('returns false for photo page URLs', () => {
    mockWindowLocation('/photo/?fbid=123');
    const platform = new global.FacebookPlatform();
    expect(platform._isFbVideoPage()).toBe(false);
  });
});

describe('FacebookPlatform._extractVideoIdFromUrl()', () => {
  test('extracts videoId from carousel video URL', () => {
    mockWindowLocation('/100/videos/pcb.456/789012');
    const platform = new global.FacebookPlatform();
    expect(platform._extractVideoIdFromUrl()).toBe('789012');
  });

  test('returns null for non-video URLs', () => {
    mockWindowLocation('/photo/?fbid=123');
    const platform = new global.FacebookPlatform();
    expect(platform._extractVideoIdFromUrl()).toBeNull();
  });
});
