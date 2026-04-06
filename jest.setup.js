global.chrome = {
  runtime: {
    onMessage: { addListener: jest.fn() },
    sendMessage: jest.fn(),
    lastError: null,
  },
  storage: {
    session: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
    },
  },
  downloads: {
    download: jest.fn(),
  },
  tabs: {
    query: jest.fn(),
    onRemoved: { addListener: jest.fn() },
    sendMessage: jest.fn(),
  },
  webRequest: {
    onBeforeRequest: { addListener: jest.fn() },
  },
};

global.importScripts = jest.fn();
