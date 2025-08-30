/**
 * Zotero Mock Environment
 * 提供更完整的 Zotero 环境模拟，支持更多集成测试场景
 */

export interface MockItem {
  id: number;
  libraryID: number;
  key: string;
  itemType: string;
  title: string;
  creators: any[];
  tags: any[];
  attachments: number[];
  notes: number[];
  parentID?: number;
  deleted?: boolean;
}

export interface MockCollection {
  id: number;
  name: string;
  parentID?: number;
  items: number[];
}

export class ZoteroMockEnvironment {
  private items: Map<number, MockItem> = new Map();
  private collections: Map<number, MockCollection> = new Map();
  private nextItemId = 1;
  private nextCollectionId = 1;
  private selectedItems: MockItem[] = [];
  
  constructor() {
    this.setupGlobalMocks();
  }
  
  private setupGlobalMocks() {
    // Mock Zotero global
    (global as any).Zotero = {
      // Logging
      log: jest.fn((msg: string, level?: string) => {
        if (process.env.DEBUG_TESTS) {
          console.log(`[${level || 'info'}] ${msg}`);
        }
      }),
      logError: jest.fn((msg: string) => {
        if (process.env.DEBUG_TESTS) {
          console.error(msg);
        }
      }),
      
      // Main window
      getMainWindow: jest.fn(() => this.createMockWindow()),
      
      // Active pane
      getActiveZoteroPane: jest.fn(() => ({
        getSelectedItems: jest.fn(() => this.selectedItems),
        selectItem: jest.fn((itemID: number) => {
          const item = this.items.get(itemID);
          if (item) {
            this.selectedItems = [item];
          }
        }),
        getSelectedCollection: jest.fn(() => null)
      })),
      
      // Items API
      Items: {
        get: jest.fn((id: number) => this.items.get(id)),
        getAsync: jest.fn(async (id: number) => this.items.get(id)),
        getAll: jest.fn(() => Array.from(this.items.values())),
        trash: jest.fn(async (id: number) => {
          const item = this.items.get(id);
          if (item) {
            item.deleted = true;
          }
        })
      },
      
      // Item constructor
      Item: jest.fn((type: string) => this.createMockItem(type)),
      
      // Collections API
      Collections: {
        get: jest.fn((id: number) => this.collections.get(id)),
        getAsync: jest.fn(async (id: number) => this.collections.get(id))
      },
      
      // Preferences
      Prefs: {
        get: jest.fn((key: string) => {
          const prefs: Record<string, any> = {
            'extensions.zotero.researchnavigator.historySize': 1000,
            'extensions.zotero.researchnavigator.sessionTimeout': 30
          };
          return prefs[key];
        }),
        set: jest.fn()
      },
      
      // Libraries
      Libraries: {
        userLibraryID: 1
      },
      
      // URI utilities
      URI: {
        getItemURI: jest.fn((item: MockItem) => `zotero://item/${item.key}`),
        getURIItem: jest.fn((uri: string) => {
          const match = uri.match(/zotero:\/\/item\/(.+)/);
          if (match) {
            return Array.from(this.items.values()).find(item => item.key === match[1]);
          }
        })
      },
      
      // Utilities
      Utilities: {
        randomString: jest.fn(() => Math.random().toString(36).substr(2, 9)),
        generateObjectKey: jest.fn(() => Math.random().toString(36).substr(2, 8).toUpperCase())
      },
      
      // Tabs (for closed tabs testing)
      Zotero_Tabs: {
        _history: [],
        close: jest.fn((id: string) => {
          (global as any).Zotero.Zotero_Tabs._history.push({
            id,
            title: 'Test Tab',
            timestamp: Date.now()
          });
        }),
        undoClose: jest.fn(() => {
          return (global as any).Zotero.Zotero_Tabs._history.pop();
        })
      },
      
      // Plugins
      Plugins: {
        getRootURI: jest.fn(() => 'chrome://researchnavigator/')
      }
    };
    
    // Mock window
    (global as any).window = this.createMockWindow();
    
    // Mock Components for XUL environment
    (global as any).Components = {
      classes: {},
      interfaces: {},
      utils: {}
    };
  }
  
  private createMockWindow() {
    const mockDoc = {
      getElementById: jest.fn((id: string) => {
        if (id === 'zotero-pane' || id === 'main-window') {
          return { appendChild: jest.fn(), style: {} };
        }
        return null;
      }),
      querySelector: jest.fn(() => null),
      createElement: jest.fn((tag: string) => ({
        tagName: tag.toUpperCase(),
        style: {},
        classList: {
          add: jest.fn(),
          remove: jest.fn(),
          contains: jest.fn()
        },
        addEventListener: jest.fn(),
        appendChild: jest.fn(),
        remove: jest.fn(),
        setAttribute: jest.fn(),
        getAttribute: jest.fn(),
        innerHTML: '',
        textContent: ''
      })),
      body: { appendChild: jest.fn() },
      documentElement: { appendChild: jest.fn() }
    };
    
    return {
      document: mockDoc,
      setTimeout: jest.fn((fn: Function) => {
        if (process.env.IMMEDIATE_TIMERS) {
          fn();
        }
        return 1;
      }),
      clearTimeout: jest.fn(),
      setInterval: jest.fn(),
      clearInterval: jest.fn()
    };
  }
  
  private createMockItem(type: string): MockItem {
    const item: MockItem = {
      id: this.nextItemId++,
      libraryID: 1,
      key: Zotero.Utilities.generateObjectKey(),
      itemType: type,
      title: '',
      creators: [],
      tags: [],
      attachments: [],
      notes: [],
      
      // Methods
      setField: jest.fn(function(this: MockItem, field: string, value: any) {
        (this as any)[field] = value;
      }),
      getField: jest.fn(function(this: MockItem, field: string) {
        return (this as any)[field];
      }),
      setNote: jest.fn(function(this: MockItem, note: string) {
        (this as any).note = note;
      }),
      getNote: jest.fn(function(this: MockItem) {
        return (this as any).note || '';
      }),
      saveTx: jest.fn(async function(this: MockItem) {
        return { id: this.id };
      }),
      addTag: jest.fn(function(this: MockItem, tag: string) {
        this.tags.push({ tag });
      }),
      getTags: jest.fn(function(this: MockItem) {
        return this.tags;
      }),
      isAttachment: jest.fn(function(this: MockItem) {
        return this.itemType === 'attachment';
      }),
      isNote: jest.fn(function(this: MockItem) {
        return this.itemType === 'note';
      }),
      isRegularItem: jest.fn(function(this: MockItem) {
        return !this.isAttachment() && !this.isNote();
      })
    } as any;
    
    // Bind methods to maintain 'this' context
    Object.keys(item).forEach(key => {
      if (typeof (item as any)[key] === 'function') {
        (item as any)[key] = (item as any)[key].bind(item);
      }
    });
    
    this.items.set(item.id, item);
    return item;
  }
  
  // Helper methods for testing
  async createItem(type: string = 'journalArticle', data: Partial<MockItem> = {}): Promise<MockItem> {
    const item = this.createMockItem(type);
    Object.assign(item, data);
    this.items.set(item.id, item);
    return item;
  }
  
  async createCollection(name: string, parentID?: number): Promise<MockCollection> {
    const collection: MockCollection = {
      id: this.nextCollectionId++,
      name,
      parentID,
      items: []
    };
    this.collections.set(collection.id, collection);
    return collection;
  }
  
  selectItems(items: MockItem[]) {
    this.selectedItems = items;
  }
  
  clearAll() {
    this.items.clear();
    this.collections.clear();
    this.selectedItems = [];
    this.nextItemId = 1;
    this.nextCollectionId = 1;
  }
  
  // Simulate Zotero events
  async simulateItemSelect(itemId: number) {
    const item = this.items.get(itemId);
    if (item) {
      this.selectedItems = [item];
      // Trigger any registered observers
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  
  async simulateTabClose(tabId: string, tabData: any = {}) {
    Zotero.Zotero_Tabs._history.push({
      id: tabId,
      timestamp: Date.now(),
      ...tabData
    });
  }
}