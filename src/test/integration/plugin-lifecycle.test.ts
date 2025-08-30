/**
 * 集成测试：插件生命周期
 * 测试插件的安装、启动、关闭、卸载等完整流程
 */

import { PluginCore } from '../../core/plugin-core';
import { ZoteroMockEnvironment } from '../helpers/zotero-mock-environment';

describe('Plugin Lifecycle Integration Tests', () => {
  let mockEnv: ZoteroMockEnvironment;
  let plugin: PluginCore;
  
  beforeEach(() => {
    mockEnv = new ZoteroMockEnvironment();
    plugin = new PluginCore();
  });
  
  afterEach(async () => {
    await plugin.shutdown();
    mockEnv.clearAll();
  });
  
  describe('Plugin Installation', () => {
    it('should initialize all components on startup', async () => {
      await plugin.startup();
      
      // Verify all managers are initialized
      expect(plugin.isInitialized()).toBe(true);
      
      // Verify database tables are created
      expect(Zotero.DB.queryAsync).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS')
      );
      
      // Verify UI components are created
      expect(Zotero.getMainWindow).toHaveBeenCalled();
    });
    
    it('should handle initialization errors gracefully', async () => {
      // Mock database error
      Zotero.DB.queryAsync = jest.fn().mockRejectedValueOnce(
        new Error('DB initialization failed')
      );
      
      // Should not throw
      await expect(plugin.startup()).resolves.not.toThrow();
      
      // Should log error
      expect(Zotero.logError).toHaveBeenCalledWith(
        expect.stringContaining('DB initialization failed')
      );
    });
  });
  
  describe('Plugin Operation', () => {
    beforeEach(async () => {
      await plugin.startup();
    });
    
    it('should track item navigation', async () => {
      // Create test item
      const item = await mockEnv.createItem('journalArticle', {
        title: 'Test Article'
      });
      
      // Simulate item selection
      await mockEnv.simulateItemSelect(item.id);
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify navigation was tracked
      expect(Zotero.DB.queryAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO history_nodes'),
        expect.arrayContaining([expect.stringContaining('item-' + item.id)])
      );
    });
    
    it('should handle closed tabs', async () => {
      // Simulate closing a tab
      await mockEnv.simulateTabClose('tab-123', {
        title: 'Closed Article',
        type: 'reader'
      });
      
      // Verify tab is in history
      const closedTabs = Zotero.Zotero_Tabs._history;
      expect(closedTabs).toHaveLength(1);
      expect(closedTabs[0].id).toBe('tab-123');
    });
    
    it('should create note associations', async () => {
      // Create item and note
      const item = await mockEnv.createItem('journalArticle');
      const note = await mockEnv.createItem('note', {
        parentID: item.id,
        note: '<p>Test note content</p>'
      });
      
      // Simulate association creation
      await plugin.noteAssociationSystem?.createAssociation(
        note.id,
        `item-${item.id}`,
        'manual'
      );
      
      // Verify association was saved
      expect(Zotero.DB.queryAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO note_associations'),
        expect.any(Array)
      );
    });
  });
  
  describe('Plugin Shutdown', () => {
    it('should clean up all resources on shutdown', async () => {
      await plugin.startup();
      
      // Create some UI elements
      const window = Zotero.getMainWindow();
      const testElement = window.document.createElement('div');
      testElement.id = 'test-plugin-element';
      window.document.body.appendChild(testElement);
      
      // Shutdown plugin
      await plugin.shutdown();
      
      // Verify cleanup
      expect(plugin.isInitialized()).toBe(false);
      
      // UI elements should be removed
      expect(window.document.getElementById('test-plugin-element')).toBeNull();
    });
    
    it('should save state before shutdown', async () => {
      await plugin.startup();
      
      // Make some changes
      await mockEnv.simulateItemSelect(123);
      
      // Shutdown
      await plugin.shutdown();
      
      // Verify state was saved
      expect(Zotero.Prefs.set).toHaveBeenCalledWith(
        expect.stringContaining('researchnavigator'),
        expect.any(String)
      );
    });
  });
  
  describe('Error Recovery', () => {
    it('should recover from database errors', async () => {
      await plugin.startup();
      
      // Simulate database error
      Zotero.DB.queryAsync = jest.fn()
        .mockRejectedValueOnce(new Error('DB Error'))
        .mockResolvedValueOnce([]); // Second call succeeds
      
      // Try to track navigation
      await mockEnv.simulateItemSelect(123);
      
      // Wait for retry
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Should have retried
      expect(Zotero.DB.queryAsync).toHaveBeenCalledTimes(2);
    });
    
    it('should handle missing Zotero APIs gracefully', async () => {
      // Remove a critical API
      delete (Zotero as any).Items;
      
      // Should still start without crashing
      await expect(plugin.startup()).resolves.not.toThrow();
      
      // Should log appropriate errors
      expect(Zotero.logError).toHaveBeenCalled();
    });
  });
  
  describe('Performance', () => {
    it('should handle large history efficiently', async () => {
      await plugin.startup();
      
      const startTime = Date.now();
      
      // Create many history entries
      for (let i = 0; i < 100; i++) {
        await mockEnv.simulateItemSelect(i);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time
      expect(duration).toBeLessThan(5000); // 5 seconds for 100 items
    });
    
    it('should paginate large result sets', async () => {
      await plugin.startup();
      
      // Mock large result set
      const largeResults = Array(1000).fill(null).map((_, i) => ({
        nodeId: `item-${i}`,
        timestamp: Date.now() - i * 1000
      }));
      
      Zotero.DB.queryAsync = jest.fn().mockResolvedValue(largeResults);
      
      // Request history
      const history = await plugin.historyService?.getRecentHistory(50);
      
      // Should limit results
      expect(history).toHaveLength(50);
    });
  });
});