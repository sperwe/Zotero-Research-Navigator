import { NoteAssociationSystem } from '../note-association-system';
import { DatabaseService } from '../../services/database-service';
import { ZoteroMockEnvironment } from '../../test/helpers/zotero-mock-environment';

jest.mock('../../services/database-service');

describe('NoteAssociationSystem', () => {
  let system: NoteAssociationSystem;
  let mockDbService: jest.Mocked<DatabaseService>;
  let mockEnv: ZoteroMockEnvironment;
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockEnv = new ZoteroMockEnvironment();
    
    // Create mock database service
    mockDbService = new DatabaseService() as jest.Mocked<DatabaseService>;
    system = new NoteAssociationSystem();
    (system as any).dbService = mockDbService;
  });
  
  afterEach(() => {
    mockEnv.clearAll();
  });
  
  describe('createAssociation', () => {
    it('should create a new association', async () => {
      const noteId = 123;
      const nodeId = 'item-456';
      const associationType = 'manual';
      const context = { source: 'test' };
      
      mockDbService.execute = jest.fn().mockResolvedValue(undefined);
      
      await system.createAssociation(noteId, nodeId, associationType, context);
      
      expect(mockDbService.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO note_associations'),
        expect.objectContaining({
          noteId,
          nodeId,
          associationType,
          context: JSON.stringify(context)
        })
      );
    });
    
    it('should handle duplicate associations', async () => {
      const noteId = 123;
      const nodeId = 'item-456';
      
      // First call succeeds
      mockDbService.execute = jest.fn().mockResolvedValue(undefined);
      await system.createAssociation(noteId, nodeId, 'manual');
      
      // Second call should update
      await system.createAssociation(noteId, nodeId, 'manual');
      
      expect(mockDbService.execute).toHaveBeenCalledTimes(2);
    });
  });
  
  describe('getAssociationsForNote', () => {
    it('should return associations for a note', async () => {
      const noteId = 123;
      const mockAssociations = [
        {
          id: 1,
          noteId: 123,
          nodeId: 'item-456',
          associationType: 'manual',
          context: '{"source":"test"}',
          timestamp: Date.now()
        }
      ];
      
      mockDbService.query = jest.fn().mockResolvedValue(mockAssociations);
      
      const associations = await system.getAssociationsForNote(noteId);
      
      expect(mockDbService.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE noteId = ?'),
        { noteId }
      );
      
      expect(associations).toHaveLength(1);
      expect(associations[0].context).toEqual({ source: 'test' });
    });
    
    it('should handle notes with no associations', async () => {
      mockDbService.query = jest.fn().mockResolvedValue([]);
      
      const associations = await system.getAssociationsForNote(999);
      
      expect(associations).toEqual([]);
    });
  });
  
  describe('getAssociationsForNode', () => {
    it('should return notes associated with a node', async () => {
      const nodeId = 'item-456';
      const mockAssociations = [
        {
          id: 1,
          noteId: 123,
          nodeId: 'item-456',
          associationType: 'created_during',
          context: '{}',
          timestamp: Date.now()
        },
        {
          id: 2,
          noteId: 124,
          nodeId: 'item-456',
          associationType: 'manual',
          context: '{}',
          timestamp: Date.now()
        }
      ];
      
      mockDbService.query = jest.fn().mockResolvedValue(mockAssociations);
      
      // Mock note items
      const note1 = await mockEnv.createItem('note', { id: 123, note: 'Note 1' });
      const note2 = await mockEnv.createItem('note', { id: 124, note: 'Note 2' });
      
      Zotero.Items.getAsync = jest.fn()
        .mockResolvedValueOnce(note1)
        .mockResolvedValueOnce(note2);
      
      const notes = await system.getAssociationsForNode(nodeId);
      
      expect(notes).toHaveLength(2);
      expect(notes[0].id).toBe(123);
      expect(notes[1].id).toBe(124);
    });
    
    it('should filter out deleted notes', async () => {
      const nodeId = 'item-456';
      const mockAssociations = [
        { noteId: 123, nodeId, associationType: 'manual', context: '{}' },
        { noteId: 124, nodeId, associationType: 'manual', context: '{}' }
      ];
      
      mockDbService.query = jest.fn().mockResolvedValue(mockAssociations);
      
      // Note 123 exists, note 124 doesn't
      const note1 = await mockEnv.createItem('note', { id: 123 });
      Zotero.Items.getAsync = jest.fn()
        .mockResolvedValueOnce(note1)
        .mockResolvedValueOnce(null);
      
      const notes = await system.getAssociationsForNode(nodeId);
      
      expect(notes).toHaveLength(1);
      expect(notes[0].id).toBe(123);
    });
  });
  
  describe('removeAssociation', () => {
    it('should remove an association', async () => {
      const noteId = 123;
      const nodeId = 'item-456';
      
      mockDbService.execute = jest.fn().mockResolvedValue(undefined);
      
      await system.removeAssociation(noteId, nodeId);
      
      expect(mockDbService.execute).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM note_associations'),
        { noteId, nodeId }
      );
    });
  });
  
  describe('getAssociationTypes', () => {
    it('should return all unique association types', async () => {
      const mockTypes = [
        { associationType: 'manual' },
        { associationType: 'created_during' },
        { associationType: 'manual' }, // duplicate
        { associationType: 'quick-note' }
      ];
      
      mockDbService.query = jest.fn().mockResolvedValue(mockTypes);
      
      const types = await system.getAssociationTypes();
      
      expect(types).toEqual(['manual', 'created_during', 'quick-note']);
      expect(types).toHaveLength(3); // No duplicates
    });
  });
  
  describe('searchAssociations', () => {
    it('should search associations by context', async () => {
      const searchTerm = 'important';
      const mockResults = [
        {
          noteId: 123,
          nodeId: 'item-456',
          context: '{"tags":["important","research"]}'
        }
      ];
      
      mockDbService.query = jest.fn().mockResolvedValue(mockResults);
      
      const results = await system.searchAssociations(searchTerm);
      
      expect(mockDbService.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE context LIKE ?'),
        expect.objectContaining({
          searchTerm: expect.stringContaining(searchTerm)
        })
      );
    });
  });
  
  describe('countAssociations', () => {
    it('should count total associations', async () => {
      mockDbService.getValue = jest.fn().mockResolvedValue(42);
      
      const count = await system.countAssociations();
      
      expect(mockDbService.getValue).toHaveBeenCalledWith(
        expect.stringContaining('SELECT COUNT(*)')
      );
      expect(count).toBe(42);
    });
    
    it('should count associations by type', async () => {
      mockDbService.getValue = jest.fn().mockResolvedValue(10);
      
      const count = await system.countAssociations('manual');
      
      expect(mockDbService.getValue).toHaveBeenCalledWith(
        expect.stringContaining('WHERE associationType = ?'),
        { type: 'manual' }
      );
      expect(count).toBe(10);
    });
  });
});