import { ClosedTabsManager } from '../closed-tabs-manager';
import { ZoteroMockEnvironment } from '../../test/helpers/zotero-mock-environment';

describe('ClosedTabsManager', () => {
  let manager: ClosedTabsManager;
  let mockEnv: ZoteroMockEnvironment;
  
  beforeEach(() => {
    mockEnv = new ZoteroMockEnvironment();
    manager = new ClosedTabsManager();
  });
  
  afterEach(() => {
    mockEnv.clearAll();
  });
  
  describe('getClosedTabs', () => {
    it('should return closed tabs from Zotero history', () => {
      // Add some test data to history
      const testTabs = [
        { id: 'tab-1', title: 'Article 1', timestamp: Date.now() - 1000 },
        { id: 'tab-2', title: 'Article 2', timestamp: Date.now() - 2000 },
        { id: 'tab-3', title: 'Article 3', timestamp: Date.now() - 3000 }
      ];
      
      Zotero.Zotero_Tabs._history = testTabs;
      
      const closedTabs = manager.getClosedTabs();
      
      expect(closedTabs).toHaveLength(3);
      expect(closedTabs[0].id).toBe('tab-1'); // Most recent first
      expect(closedTabs[0].data.title).toBe('Article 1');
    });
    
    it('should limit returned tabs to maxTabs', () => {
      // Add more tabs than the limit
      const testTabs = [];
      for (let i = 0; i < 20; i++) {
        testTabs.push({
          id: `tab-${i}`,
          title: `Article ${i}`,
          timestamp: Date.now() - i * 1000
        });
      }
      
      Zotero.Zotero_Tabs._history = testTabs;
      
      const closedTabs = manager.getClosedTabs(10);
      
      expect(closedTabs).toHaveLength(10);
    });
    
    it('should handle empty history', () => {
      Zotero.Zotero_Tabs._history = [];
      
      const closedTabs = manager.getClosedTabs();
      
      expect(closedTabs).toEqual([]);
    });
    
    it('should handle missing history', () => {
      Zotero.Zotero_Tabs._history = undefined;
      
      const closedTabs = manager.getClosedTabs();
      
      expect(closedTabs).toEqual([]);
    });
  });
  
  describe('restoreTab', () => {
    it('should restore a closed tab', async () => {
      const testTab = {
        id: 'tab-1',
        title: 'Test Article',
        data: { itemID: 123 },
        timestamp: Date.now()
      };
      
      Zotero.Zotero_Tabs._history = [testTab];
      
      const restored = await manager.restoreTab('tab-1');
      
      expect(restored).toBe(true);
      expect(Zotero.Zotero_Tabs.undoClose).toHaveBeenCalled();
    });
    
    it('should return false for non-existent tab', async () => {
      Zotero.Zotero_Tabs._history = [];
      
      const restored = await manager.restoreTab('non-existent');
      
      expect(restored).toBe(false);
    });
  });
  
  describe('clearHistory', () => {
    it('should clear all closed tabs', () => {
      Zotero.Zotero_Tabs._history = [
        { id: 'tab-1', title: 'Article 1' },
        { id: 'tab-2', title: 'Article 2' }
      ];
      
      manager.clearHistory();
      
      expect(Zotero.Zotero_Tabs._history).toEqual([]);
    });
  });
  
  describe('getSessionGroups', () => {
    it('should group tabs by time sessions', () => {
      const now = Date.now();
      const hour = 3600000; // 1 hour in ms
      
      Zotero.Zotero_Tabs._history = [
        { id: 'tab-1', title: 'Recent 1', timestamp: now - 5 * 60000 }, // 5 min ago
        { id: 'tab-2', title: 'Recent 2', timestamp: now - 10 * 60000 }, // 10 min ago
        { id: 'tab-3', title: 'Old 1', timestamp: now - 2 * hour }, // 2 hours ago
        { id: 'tab-4', title: 'Old 2', timestamp: now - 2.5 * hour } // 2.5 hours ago
      ];
      
      const sessions = manager.getSessionGroups();
      
      expect(sessions).toHaveLength(2);
      expect(sessions[0].tabs).toHaveLength(2); // Recent session
      expect(sessions[1].tabs).toHaveLength(2); // Old session
    });
    
    it('should handle single session', () => {
      const now = Date.now();
      
      Zotero.Zotero_Tabs._history = [
        { id: 'tab-1', title: 'Tab 1', timestamp: now - 5 * 60000 },
        { id: 'tab-2', title: 'Tab 2', timestamp: now - 10 * 60000 }
      ];
      
      const sessions = manager.getSessionGroups();
      
      expect(sessions).toHaveLength(1);
      expect(sessions[0].tabs).toHaveLength(2);
    });
  });
  
  describe('findTabById', () => {
    it('should find tab by ID', () => {
      const testTab = {
        id: 'tab-123',
        title: 'Test Article',
        timestamp: Date.now()
      };
      
      Zotero.Zotero_Tabs._history = [
        { id: 'tab-1', title: 'Other' },
        testTab,
        { id: 'tab-3', title: 'Another' }
      ];
      
      const found = manager.findTabById('tab-123');
      
      expect(found).toEqual({
        id: testTab.id,
        type: 'closedTab',
        timestamp: testTab.timestamp,
        data: testTab
      });
    });
    
    it('should return null for non-existent tab', () => {
      Zotero.Zotero_Tabs._history = [];
      
      const found = manager.findTabById('non-existent');
      
      expect(found).toBeNull();
    });
  });
});