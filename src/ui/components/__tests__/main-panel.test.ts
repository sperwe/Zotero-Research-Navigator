import { MainPanel } from '../main-panel';
import { ZoteroMockEnvironment } from '../../../test/helpers/zotero-mock-environment';
import { DOMTestingUtils } from '../../../test/helpers/dom-testing-utils';

describe('MainPanel', () => {
  let panel: MainPanel;
  let mockEnv: ZoteroMockEnvironment;
  let domUtils: DOMTestingUtils;
  let mockWindow: any;
  
  beforeEach(async () => {
    // Setup environment
    mockEnv = new ZoteroMockEnvironment();
    domUtils = new DOMTestingUtils();
    mockWindow = (global as any).window;
    
    // Create panel with mocked dependencies
    const mockOptions = {
      closedTabsManager: {
        getClosedTabs: jest.fn(() => []),
        getSessionGroups: jest.fn(() => [])
      },
      noteAssociationSystem: {
        getAssociationsForNode: jest.fn(() => []),
        createAssociation: jest.fn()
      },
      historyService: {
        getRecentHistory: jest.fn(() => []),
        getSessionHistory: jest.fn(() => [])
      }
    };
    
    panel = new MainPanel(mockWindow, mockOptions as any);
    await panel.create();
  });
  
  afterEach(() => {
    panel.destroy();
    domUtils.cleanup();
    mockEnv.clearAll();
  });
  
  describe('Panel Creation', () => {
    it('should create panel container', async () => {
      const container = mockWindow.document.getElementById('research-navigator-panel');
      expect(container).toBeTruthy();
    });
    
    it('should create tab bar with correct tabs', async () => {
      const tabButtons = mockWindow.document.querySelectorAll('.rn-tab-button');
      expect(tabButtons.length).toBeGreaterThan(0);
      
      // Check for expected tabs
      const tabIds = Array.from(tabButtons).map((btn: any) => 
        btn.getAttribute('data-tab-id')
      );
      expect(tabIds).toContain('history');
      expect(tabIds).toContain('notes');
    });
    
    it('should initialize with first tab active', async () => {
      const firstTab = mockWindow.document.querySelector('.rn-tab-button');
      expect(firstTab?.classList.contains('active')).toBe(true);
    });
  });
  
  describe('Tab Switching', () => {
    it('should switch tabs when clicking tab button', async () => {
      const historyTab = mockWindow.document.querySelector('[data-tab-id="history"]');
      const notesTab = mockWindow.document.querySelector('[data-tab-id="notes"]');
      
      // Initially history tab should be active
      expect(historyTab?.classList.contains('active')).toBe(true);
      
      // Click notes tab
      notesTab?.dispatchEvent(new Event('click'));
      
      // Notes tab should now be active
      expect(notesTab?.classList.contains('active')).toBe(true);
      expect(historyTab?.classList.contains('active')).toBe(false);
    });
    
    it('should show corresponding content when switching tabs', async () => {
      const notesTab = mockWindow.document.querySelector('[data-tab-id="notes"]');
      
      // Switch to notes tab
      notesTab?.dispatchEvent(new Event('click'));
      
      // Check if notes content is visible
      const notesContent = mockWindow.document.querySelector('[data-tab="notes"]');
      expect(notesContent?.style.display).not.toBe('none');
    });
  });
  
  describe('Window Controls', () => {
    it('should minimize panel when clicking minimize button', () => {
      const minimizeBtn = mockWindow.document.querySelector('.window-control-minimize');
      const container = mockWindow.document.getElementById('research-navigator-panel');
      
      minimizeBtn?.dispatchEvent(new Event('click'));
      
      expect(container?.style.display).toBe('none');
    });
    
    it('should close panel when clicking close button', () => {
      const closeBtn = mockWindow.document.querySelector('.window-control-close');
      const container = mockWindow.document.getElementById('research-navigator-panel');
      
      closeBtn?.dispatchEvent(new Event('click'));
      
      expect(container?.style.display).toBe('none');
    });
  });
  
  describe('Panel Dragging', () => {
    it('should make panel draggable', () => {
      const header = mockWindow.document.querySelector('.rn-panel-header');
      const container = mockWindow.document.getElementById('research-navigator-panel');
      
      // Simulate drag
      const startX = 100;
      const startY = 100;
      
      const mouseDownEvent = new MouseEvent('mousedown', {
        clientX: startX,
        clientY: startY
      });
      header?.dispatchEvent(mouseDownEvent);
      
      const mouseMoveEvent = new MouseEvent('mousemove', {
        clientX: startX + 50,
        clientY: startY + 50
      });
      mockWindow.document.dispatchEvent(mouseMoveEvent);
      
      const mouseUpEvent = new MouseEvent('mouseup');
      mockWindow.document.dispatchEvent(mouseUpEvent);
      
      // Panel should have moved
      expect(container?.style.left).toBeTruthy();
      expect(container?.style.top).toBeTruthy();
    });
  });
  
  describe('Panel Resizing', () => {
    it('should save panel size to preferences', () => {
      const container = mockWindow.document.getElementById('research-navigator-panel');
      
      // Change size
      if (container) {
        container.style.width = '600px';
        container.style.height = '800px';
      }
      
      // Trigger resize observer (mocked)
      panel.saveState();
      
      expect(Zotero.Prefs.set).toHaveBeenCalledWith(
        'extensions.zotero.researchnavigator.panelState',
        expect.stringContaining('"width":600')
      );
    });
  });
  
  describe('State Persistence', () => {
    it('should save active tab state', () => {
      // Switch to notes tab
      panel.switchTab('notes');
      
      // Save state
      panel.saveState();
      
      expect(Zotero.Prefs.set).toHaveBeenCalledWith(
        'extensions.zotero.researchnavigator.panelState',
        expect.stringContaining('"activeTab":"notes"')
      );
    });
    
    it('should restore saved state on creation', async () => {
      // Mock saved state
      Zotero.Prefs.get = jest.fn((key) => {
        if (key === 'extensions.zotero.researchnavigator.panelState') {
          return JSON.stringify({
            activeTab: 'notes',
            width: 600,
            height: 800,
            position: { left: 100, top: 100 }
          });
        }
      });
      
      // Create new panel
      const newPanel = new MainPanel(mockWindow, {
        closedTabsManager: {} as any,
        noteAssociationSystem: {} as any,
        historyService: {} as any
      });
      await newPanel.create();
      
      // Check if state was restored
      const container = mockWindow.document.getElementById('research-navigator-panel');
      expect(container?.style.width).toBe('600px');
      expect(container?.style.height).toBe('800px');
      
      newPanel.destroy();
    });
  });
  
  describe('Error Handling', () => {
    it('should handle tab creation errors gracefully', async () => {
      // Mock tab creation to throw error
      const mockOptions = {
        closedTabsManager: {
          getClosedTabs: jest.fn(() => {
            throw new Error('Tab error');
          })
        },
        noteAssociationSystem: {} as any,
        historyService: {} as any
      };
      
      const errorPanel = new MainPanel(mockWindow, mockOptions as any);
      
      // Should not throw
      await expect(errorPanel.create()).resolves.not.toThrow();
      
      // Panel should still be created
      const container = mockWindow.document.getElementById('research-navigator-panel');
      expect(container).toBeTruthy();
      
      errorPanel.destroy();
    });
  });
});