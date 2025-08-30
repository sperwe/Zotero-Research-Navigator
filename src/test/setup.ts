// Mock Zotero global object
global.Zotero = {
  log: jest.fn((msg: string, level?: string) => {
    if (process.env.DEBUG) {
      console.log(`[${level || 'info'}] ${msg}`);
    }
  }),
  logError: jest.fn((msg: string) => {
    if (process.env.DEBUG) {
      console.error(msg);
    }
  }),
  getMainWindow: jest.fn(() => ({
    document: {
      getElementById: jest.fn(),
      createElement: jest.fn(() => ({
        style: {},
        addEventListener: jest.fn(),
        appendChild: jest.fn(),
      })),
      body: {},
      documentElement: {}
    }
  })),
  getActiveZoteroPane: jest.fn(() => ({
    getSelectedItems: jest.fn(() => [])
  })),
  Prefs: {
    get: jest.fn(),
    set: jest.fn()
  },
  Items: {
    getAsync: jest.fn()
  },
  getString: jest.fn((key: string) => key),
  Plugins: {
    getRootURI: jest.fn(() => 'chrome://researchnavigator/')
  }
} as any;

// Mock window object
global.window = {
  document: global.Zotero.getMainWindow().document,
  setTimeout: jest.fn((fn: Function, delay: number) => {
    if (process.env.IMMEDIATE_TIMERS) {
      fn();
    }
    return 1;
  }),
  clearTimeout: jest.fn(),
  setInterval: jest.fn(),
  clearInterval: jest.fn()
} as any;