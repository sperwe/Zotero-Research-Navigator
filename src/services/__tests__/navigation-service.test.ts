import { NavigationService } from '../navigation-service';
import { HistoryService } from '../history-service';
import { ZoteroMockEnvironment } from '../../test/helpers/zotero-mock-environment';

jest.mock('../history-service');

describe('NavigationService', () => {
  let navigationService: NavigationService;
  let mockHistoryService: jest.Mocked<HistoryService>;
  let mockEnv: ZoteroMockEnvironment;
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockEnv = new ZoteroMockEnvironment();
    
    mockHistoryService = new HistoryService() as jest.Mocked<HistoryService>;
    navigationService = new NavigationService();
    (navigationService as any).historyService = mockHistoryService;
  });
  
  afterEach(() => {
    mockEnv.clearAll();
  });
  
  describe('trackItemView', () => {
    it('should track item navigation', async () => {
      const item = await mockEnv.createItem('journalArticle', {
        id: 123,
        title: 'Test Article'
      });
      
      mockHistoryService.trackNavigation = jest.fn().mockResolvedValue(undefined);
      
      await navigationService.trackItemView(item.id);
      
      expect(mockHistoryService.trackNavigation).toHaveBeenCalledWith(
        'item-123',
        expect.objectContaining({
          type: 'item',
          itemId: 123
        })
      );
    });
    
    it('should handle attachment navigation', async () => {
      const attachment = await mockEnv.createItem('attachment', {
        id: 456,
        itemType: 'attachment',
        title: 'Test PDF'
      });
      
      // Mock isAttachment
      attachment.isAttachment = jest.fn().mockReturnValue(true);
      Zotero.Items.get = jest.fn().mockReturnValue(attachment);
      
      mockHistoryService.trackNavigation = jest.fn().mockResolvedValue(undefined);
      
      await navigationService.trackItemView(attachment.id);
      
      expect(mockHistoryService.trackNavigation).toHaveBeenCalledWith(
        'attachment-456',
        expect.objectContaining({
          type: 'attachment'
        })
      );
    });
    
    it('should skip deleted items', async () => {
      const item = await mockEnv.createItem('journalArticle', {
        id: 789,
        deleted: true
      });
      
      Zotero.Items.get = jest.fn().mockReturnValue(item);
      mockHistoryService.trackNavigation = jest.fn();
      
      await navigationService.trackItemView(789);
      
      expect(mockHistoryService.trackNavigation).not.toHaveBeenCalled();
    });
  });
  
  describe('trackCollectionView', () => {
    it('should track collection navigation', async () => {
      const collection = await mockEnv.createCollection('Test Collection');
      
      Zotero.Collections.get = jest.fn().mockReturnValue(collection);
      mockHistoryService.trackNavigation = jest.fn().mockResolvedValue(undefined);
      
      await navigationService.trackCollectionView(collection.id);
      
      expect(mockHistoryService.trackNavigation).toHaveBeenCalledWith(
        `collection-${collection.id}`,
        expect.objectContaining({
          type: 'collection',
          collectionId: collection.id,
          name: 'Test Collection'
        })
      );
    });
  });
  
  describe('trackSearch', () => {
    it('should track search navigation', async () => {
      const searchQuery = 'quantum physics';
      const resultCount = 42;
      
      mockHistoryService.trackNavigation = jest.fn().mockResolvedValue(undefined);
      
      await navigationService.trackSearch(searchQuery, resultCount);
      
      expect(mockHistoryService.trackNavigation).toHaveBeenCalledWith(
        expect.stringMatching(/^search-/),
        expect.objectContaining({
          type: 'search',
          query: searchQuery,
          resultCount: resultCount
        })
      );
    });
    
    it('should sanitize search queries', async () => {
      const searchQuery = 'test <script>alert("xss")</script>';
      
      mockHistoryService.trackNavigation = jest.fn().mockResolvedValue(undefined);
      
      await navigationService.trackSearch(searchQuery, 0);
      
      expect(mockHistoryService.trackNavigation).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          query: expect.not.stringContaining('<script>')
        })
      );
    });
  });
  
  describe('trackTabOpen', () => {
    it('should track tab opening', async () => {
      const tabId = 'tab-123';
      const tabData = {
        type: 'reader',
        itemId: 456,
        title: 'PDF Reader'
      };
      
      mockHistoryService.trackNavigation = jest.fn().mockResolvedValue(undefined);
      
      await navigationService.trackTabOpen(tabId, tabData);
      
      expect(mockHistoryService.trackNavigation).toHaveBeenCalledWith(
        `tab-${tabId}`,
        expect.objectContaining({
          type: 'tab',
          action: 'open',
          tabData
        })
      );
    });
  });
  
  describe('getNavigationHistory', () => {
    it('should return formatted navigation history', async () => {
      const mockHistory = [
        {
          id: 'item-123',
          type: 'item',
          timestamp: Date.now() - 1000,
          data: { title: 'Article 1' }
        },
        {
          id: 'collection-456',
          type: 'collection',
          timestamp: Date.now() - 2000,
          data: { name: 'My Collection' }
        }
      ];
      
      mockHistoryService.getRecentHistory = jest.fn().mockResolvedValue(mockHistory);
      
      const history = await navigationService.getNavigationHistory(10);
      
      expect(history).toHaveLength(2);
      expect(history[0].id).toBe('item-123');
      expect(history[0].type).toBe('item');
    });
  });
  
  describe('getNavigationStats', () => {
    it('should calculate navigation statistics', async () => {
      const mockHistory = [
        { id: 'item-1', type: 'item', data: {} },
        { id: 'item-2', type: 'item', data: {} },
        { id: 'collection-1', type: 'collection', data: {} },
        { id: 'search-1', type: 'search', data: {} },
        { id: 'item-1', type: 'item', data: {} }, // Revisit
      ];
      
      mockHistoryService.getRecentHistory = jest.fn().mockResolvedValue(mockHistory);
      
      const stats = await navigationService.getNavigationStats();
      
      expect(stats).toEqual({
        totalNavigations: 5,
        uniqueItems: 4,
        itemViews: 3,
        collectionViews: 1,
        searches: 1,
        mostVisited: expect.arrayContaining([
          { id: 'item-1', count: 2, type: 'item' }
        ])
      });
    });
  });
  
  describe('clearNavigationHistory', () => {
    it('should clear all navigation history', async () => {
      mockHistoryService.clearHistory = jest.fn().mockResolvedValue(undefined);
      
      await navigationService.clearNavigationHistory();
      
      expect(mockHistoryService.clearHistory).toHaveBeenCalled();
    });
    
    it('should clear history for specific time period', async () => {
      const since = Date.now() - 86400000; // 1 day ago
      
      mockHistoryService.clearHistory = jest.fn().mockResolvedValue(undefined);
      
      await navigationService.clearNavigationHistory(since);
      
      expect(mockHistoryService.clearHistory).toHaveBeenCalledWith(since);
    });
  });
  
  describe('error handling', () => {
    it('should handle errors gracefully', async () => {
      mockHistoryService.trackNavigation = jest.fn()
        .mockRejectedValue(new Error('Database error'));
      
      // Should not throw
      await expect(navigationService.trackItemView(123))
        .resolves.not.toThrow();
      
      // Should log error
      expect(Zotero.logError).toHaveBeenCalled();
    });
  });
});