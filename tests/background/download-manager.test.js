const { loadBackgroundScript } = require('./helpers.js');
const { CONTENT_MESSAGES } = require('../../src/shared/constants.js');
loadBackgroundScript();

describe('DownloadManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('downloadAndUnsave', () => {
    test('unsaves from the target tab after all downloads are accepted', async () => {
      chrome.downloads.download.mockResolvedValue(1);
      chrome.tabs.sendMessage.mockResolvedValue({ success: true });

      await global.downloadAndUnsave({
        images: [{ fullSizeUrl: 'https://cdn.example.com/1.jpg', mediaType: 'image' }],
        tabId: 42,
        platform: 'threads'
      });

      expect(chrome.downloads.download).toHaveBeenCalledTimes(1);
      expect(chrome.downloads.download.mock.calls[0][0].filename).toMatch(/^threads_image_/);
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(42, {
        action: CONTENT_MESSAGES.UNSAVE_POST
      });
    });

    test('keeps the post saved when a download cannot be started', async () => {
      chrome.downloads.download.mockRejectedValue(new Error('Network error'));

      await expect(global.downloadAndUnsave({
        images: [{ fullSizeUrl: 'https://cdn.example.com/1.jpg', mediaType: 'image' }],
        tabId: 42,
        platform: 'threads'
      })).rejects.toThrow('Failed to start 1 of 1 downloads.');

      expect(chrome.tabs.sendMessage).not.toHaveBeenCalled();
    });

    test('marks an unsave failure after downloads have started', async () => {
      chrome.downloads.download.mockResolvedValue(1);
      chrome.tabs.sendMessage.mockResolvedValue({ success: false, error: 'Unsave failed' });

      try {
        await global.downloadAndUnsave({
          images: [{ fullSizeUrl: 'https://cdn.example.com/1.jpg', mediaType: 'image' }],
          tabId: 42,
          platform: 'threads'
        });
        throw new Error('Expected downloadAndUnsave to reject');
      } catch (error) {
        expect(error.message).toBe('Unsave failed');
        expect(error.downloadsStarted).toBe(true);
      }
    });
  });

  describe('_detectPlatform', () => {
    test('returns platform name from tab URL', async () => {
      chrome.tabs.query.mockResolvedValue([{ url: 'https://www.instagram.com/p/abc123' }]);

      const platform = await global.downloadManager._detectPlatform();

      expect(platform).toBe('instagram');
    });

    test('returns unknown for unrecognized URL', async () => {
      chrome.tabs.query.mockResolvedValue([{ url: 'https://www.youtube.com/watch?v=123' }]);

      const platform = await global.downloadManager._detectPlatform();

      expect(platform).toBe('unknown');
    });
  });

  describe('downloadSingleImage', () => {
    test('calls chrome.downloads.download with correct filename format', async () => {
      chrome.tabs.query.mockResolvedValue([{ url: 'https://www.facebook.com/photo/?fbid=123' }]);
      chrome.downloads.download.mockResolvedValue(1);

      const image = { fullSizeUrl: 'https://cdn.fbcdn.net/photo.jpg', mediaType: 'image' };
      await global.downloadManager.downloadSingleImage(image, 1);

      expect(chrome.downloads.download).toHaveBeenCalledTimes(1);
      const call = chrome.downloads.download.mock.calls[0][0];
      expect(call.url).toBe('https://cdn.fbcdn.net/photo.jpg');
      expect(call.filename).toMatch(/^facebook_image_\d{8}T\d{6}_1\.jpg$/);
    });

    test('uses video mediaType in filename for video items', async () => {
      chrome.tabs.query.mockResolvedValue([{ url: 'https://x.com/user/status/123/video/1' }]);
      chrome.downloads.download.mockResolvedValue(1);

      const image = { fullSizeUrl: 'https://video.twimg.com/clip.mp4', mediaType: 'video' };
      await global.downloadManager.downloadSingleImage(image, 2);

      const call = chrome.downloads.download.mock.calls[0][0];
      expect(call.filename).toMatch(/^x_video_\d{8}T\d{6}_2\.mp4$/);
    });

    test('throws error when download fails', async () => {
      chrome.tabs.query.mockResolvedValue([{ url: 'https://www.instagram.com/p/abc' }]);
      chrome.downloads.download.mockRejectedValue(new Error('Download failed'));

      const image = { fullSizeUrl: 'https://cdn.example.com/photo.jpg', mediaType: 'image' };

      await expect(global.downloadManager.downloadSingleImage(image, 1)).rejects.toThrow('Download failed');
    });
  });

  describe('downloadAllImages', () => {
    test('downloads all images with sequential index in filename', async () => {
      chrome.tabs.query.mockResolvedValue([{ url: 'https://www.threads.com/@user/post/abc' }]);
      chrome.downloads.download.mockResolvedValue(1);

      const images = [
        { fullSizeUrl: 'https://cdn.example.com/1.jpg', mediaType: 'image' },
        { fullSizeUrl: 'https://cdn.example.com/2.png', mediaType: 'image' },
      ];

      await global.downloadManager.downloadAllImages(images);

      expect(chrome.downloads.download).toHaveBeenCalledTimes(2);

      const firstCall = chrome.downloads.download.mock.calls[0][0];
      const secondCall = chrome.downloads.download.mock.calls[1][0];
      expect(firstCall.filename).toMatch(/^threads_image_\d{8}T\d{6}_1\.jpg$/);
      expect(secondCall.filename).toMatch(/^threads_image_\d{8}T\d{6}_2\.png$/);
    });

    test('uses same timestamp for all files in batch', async () => {
      chrome.tabs.query.mockResolvedValue([{ url: 'https://www.instagram.com/p/abc' }]);
      chrome.downloads.download.mockResolvedValue(1);

      const images = [
        { fullSizeUrl: 'https://cdn.example.com/1.jpg', mediaType: 'image' },
        { fullSizeUrl: 'https://cdn.example.com/2.jpg', mediaType: 'image' },
      ];

      await global.downloadManager.downloadAllImages(images);

      const ts1 = chrome.downloads.download.mock.calls[0][0].filename.match(/\d{8}T\d{6}/)[0];
      const ts2 = chrome.downloads.download.mock.calls[1][0].filename.match(/\d{8}T\d{6}/)[0];
      expect(ts1).toBe(ts2);
    });

    test('continues downloading but rejects when one image fails', async () => {
      chrome.tabs.query.mockResolvedValue([{ url: 'https://www.instagram.com/p/abc' }]);
      chrome.downloads.download
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(1);

      const images = [
        { fullSizeUrl: 'https://cdn.example.com/1.jpg', mediaType: 'image' },
        { fullSizeUrl: 'https://cdn.example.com/2.jpg', mediaType: 'image' },
      ];

      await expect(global.downloadManager.downloadAllImages(images))
        .rejects.toThrow('Failed to start 1 of 2 downloads.');

      expect(chrome.downloads.download).toHaveBeenCalledTimes(2);
    });
  });
});
