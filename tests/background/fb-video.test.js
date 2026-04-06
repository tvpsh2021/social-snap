const { loadBackgroundScript } = require('./helpers.js');
loadBackgroundScript();

describe('cleanFbVideoUrl', () => {
  test('strips bytestart and byteend params', () => {
    const url = 'https://video.xx.fbcdn.net/v/clip.mp4?efg=abc&bytestart=0&byteend=1024&oh=xyz';
    const result = global.cleanFbVideoUrl(url);

    expect(result).not.toContain('bytestart');
    expect(result).not.toContain('byteend');
    expect(result).toContain('efg=abc');
    expect(result).toContain('oh=xyz');
  });

  test('returns original URL when no byte params present', () => {
    const url = 'https://video.xx.fbcdn.net/v/clip.mp4?efg=abc&oh=xyz';
    const result = global.cleanFbVideoUrl(url);

    expect(result).toBe(url);
  });

  test('returns original string for malformed URL', () => {
    const result = global.cleanFbVideoUrl('not-a-url');
    expect(result).toBe('not-a-url');
  });
});

describe('parseEfgParam', () => {
  function makeEfgUrl(efgPayload) {
    const encoded = Buffer.from(JSON.stringify(efgPayload)).toString('base64');
    return `https://video.xx.fbcdn.net/v/clip.mp4?efg=${encodeURIComponent(encoded)}&oh=xyz`;
  }

  test('extracts videoId and bitrate from efg param', () => {
    const url = makeEfgUrl({ video_id: 123456789, bitrate: 4000000 });
    const result = global.parseEfgParam(url);

    expect(result).toEqual({ videoId: '123456789', bitrate: 4000000 });
  });

  test('returns videoId as string', () => {
    const url = makeEfgUrl({ video_id: 999, bitrate: 100 });
    const result = global.parseEfgParam(url);

    expect(typeof result.videoId).toBe('string');
  });

  test('returns null when no efg param', () => {
    const url = 'https://video.xx.fbcdn.net/v/clip.mp4?oh=xyz';
    expect(global.parseEfgParam(url)).toBeNull();
  });

  test('returns null videoId when video_id missing from payload', () => {
    const url = makeEfgUrl({ bitrate: 3000000 });
    const result = global.parseEfgParam(url);

    expect(result.videoId).toBeNull();
    expect(result.bitrate).toBe(3000000);
  });

  test('defaults bitrate to 0 when missing', () => {
    const url = makeEfgUrl({ video_id: 12345 });
    const result = global.parseEfgParam(url);

    expect(result.bitrate).toBe(0);
  });

  test('returns null for malformed base64', () => {
    const url = 'https://video.xx.fbcdn.net/v/clip.mp4?efg=!!!invalid!!!';
    expect(global.parseEfgParam(url)).toBeNull();
  });

  test('returns null for malformed URL', () => {
    expect(global.parseEfgParam('not-a-url')).toBeNull();
  });
});

describe('Facebook video URL collection (webRequest listener)', () => {
  let webRequestCallback;

  beforeAll(() => {
    webRequestCallback = chrome.webRequest.onBeforeRequest.addListener.mock.calls[0][0];
  });

  beforeEach(() => {
    global.fbVideoUrls.clear();
  });

  function makeDetailsUrl(videoId, bitrate) {
    const efgPayload = { video_id: videoId, bitrate };
    const encoded = Buffer.from(JSON.stringify(efgPayload)).toString('base64');
    return `https://video.xx.fbcdn.net/v/clip.mp4?efg=${encodeURIComponent(encoded)}&bytestart=0&byteend=1024`;
  }

  test('stores video URL keyed by videoId', () => {
    const url = makeDetailsUrl(111, 2000000);
    webRequestCallback({ url });

    expect(global.fbVideoUrls.has('111')).toBe(true);
    expect(global.fbVideoUrls.get('111').bitrate).toBe(2000000);
    expect(global.fbVideoUrls.get('111').url).not.toContain('bytestart');
  });

  test('replaces lower bitrate with higher bitrate for same videoId', () => {
    webRequestCallback({ url: makeDetailsUrl(222, 1000000) });
    webRequestCallback({ url: makeDetailsUrl(222, 4000000) });

    expect(global.fbVideoUrls.get('222').bitrate).toBe(4000000);
  });

  test('does not replace higher bitrate with lower bitrate', () => {
    webRequestCallback({ url: makeDetailsUrl(333, 4000000) });
    webRequestCallback({ url: makeDetailsUrl(333, 1000000) });

    expect(global.fbVideoUrls.get('333').bitrate).toBe(4000000);
  });

  test('ignores non-mp4 URLs', () => {
    webRequestCallback({ url: 'https://video.xx.fbcdn.net/v/image.jpg?efg=abc' });

    expect(global.fbVideoUrls.size).toBe(0);
  });

  test('ignores URLs without efg param', () => {
    webRequestCallback({ url: 'https://video.xx.fbcdn.net/v/clip.mp4?oh=xyz' });

    expect(global.fbVideoUrls.size).toBe(0);
  });
});
