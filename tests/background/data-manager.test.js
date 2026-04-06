const { loadBackgroundScript } = require('./helpers.js');
loadBackgroundScript();

describe('DataManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('storeImages calls chrome.storage.session.set with stringified tabId', async () => {
    chrome.storage.session.set.mockResolvedValue(undefined);
    const images = [{ fullSizeUrl: 'https://example.com/img.jpg' }];

    await global.dataManager.storeImages(42, images);

    expect(chrome.storage.session.set).toHaveBeenCalledWith({ '42': images });
  });

  test('getStoredImages returns empty array for unknown tab', async () => {
    chrome.storage.session.get.mockResolvedValue({});

    const result = await global.dataManager.getStoredImages(99);

    expect(result).toEqual([]);
    expect(chrome.storage.session.get).toHaveBeenCalledWith('99');
  });

  test('getStoredImages returns stored images', async () => {
    const images = [{ fullSizeUrl: 'https://example.com/a.jpg' }];
    chrome.storage.session.get.mockResolvedValue({ '42': images });

    const result = await global.dataManager.getStoredImages(42);

    expect(result).toEqual(images);
  });

  test('appendImages merges with existing data', async () => {
    const existing = [{ fullSizeUrl: 'https://example.com/1.jpg' }];
    const newImages = [{ fullSizeUrl: 'https://example.com/2.jpg' }];
    chrome.storage.session.get.mockResolvedValue({ '42': existing });
    chrome.storage.session.set.mockResolvedValue(undefined);

    await global.dataManager.appendImages(42, newImages);

    expect(chrome.storage.session.set).toHaveBeenCalledWith({
      '42': [...existing, ...newImages]
    });
  });

  test('appendImages handles empty existing data', async () => {
    const newImages = [{ fullSizeUrl: 'https://example.com/1.jpg' }];
    chrome.storage.session.get.mockResolvedValue({});
    chrome.storage.session.set.mockResolvedValue(undefined);

    await global.dataManager.appendImages(42, newImages);

    expect(chrome.storage.session.set).toHaveBeenCalledWith({
      '42': newImages
    });
  });

  test('clearTabData calls chrome.storage.session.remove', async () => {
    chrome.storage.session.remove.mockResolvedValue(undefined);

    await global.dataManager.clearTabData(42);

    expect(chrome.storage.session.remove).toHaveBeenCalledWith('42');
  });
});
