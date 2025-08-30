import { DatabaseService } from '../database-service';

// Mock Zotero.DB
const mockDB = {
  executeTransaction: jest.fn(async (callback: Function) => {
    await callback();
  }),
  queryAsync: jest.fn(),
  columnQueryAsync: jest.fn(),
  valueQueryAsync: jest.fn()
};

// Mock the global Zotero object
(global as any).Zotero = {
  DB: mockDB,
  debug: jest.fn(),
  logError: jest.fn()
};

describe('DatabaseService', () => {
  let dbService: DatabaseService;
  
  beforeEach(() => {
    jest.clearAllMocks();
    dbService = new DatabaseService();
  });
  
  describe('execute', () => {
    it('should execute SQL query with parameters', async () => {
      const sql = 'INSERT INTO test (id, name) VALUES (?, ?)';
      const params = { id: 1, name: 'test' };
      
      await dbService.execute(sql, params);
      
      expect(mockDB.queryAsync).toHaveBeenCalledWith(sql, [1, 'test']);
    });
    
    it('should handle execution errors', async () => {
      const error = new Error('DB Error');
      mockDB.queryAsync.mockRejectedValueOnce(error);
      
      await expect(dbService.execute('SELECT * FROM test'))
        .rejects.toThrow('DB Error');
      
      expect(Zotero.logError).toHaveBeenCalled();
    });
  });
  
  describe('query', () => {
    it('should return query results', async () => {
      const mockResults = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' }
      ];
      mockDB.queryAsync.mockResolvedValueOnce(mockResults);
      
      const results = await dbService.query('SELECT * FROM items');
      
      expect(results).toEqual(mockResults);
      expect(mockDB.queryAsync).toHaveBeenCalledWith('SELECT * FROM items', undefined);
    });
    
    it('should handle query with parameters', async () => {
      const mockResults = [{ id: 1, name: 'Item 1' }];
      mockDB.queryAsync.mockResolvedValueOnce(mockResults);
      
      const results = await dbService.query(
        'SELECT * FROM items WHERE id = ?',
        { id: 1 }
      );
      
      expect(results).toEqual(mockResults);
      expect(mockDB.queryAsync).toHaveBeenCalledWith(
        'SELECT * FROM items WHERE id = ?',
        [1]
      );
    });
  });
  
  describe('transaction', () => {
    it('should execute multiple queries in transaction', async () => {
      const operations = async () => {
        await dbService.execute('INSERT INTO items VALUES (1)');
        await dbService.execute('INSERT INTO items VALUES (2)');
      };
      
      await dbService.transaction(operations);
      
      expect(mockDB.executeTransaction).toHaveBeenCalled();
      expect(mockDB.queryAsync).toHaveBeenCalledTimes(2);
    });
    
    it('should rollback transaction on error', async () => {
      const error = new Error('Transaction Error');
      const operations = async () => {
        await dbService.execute('INSERT INTO items VALUES (1)');
        throw error;
      };
      
      await expect(dbService.transaction(operations))
        .rejects.toThrow('Transaction Error');
        
      expect(Zotero.logError).toHaveBeenCalled();
    });
  });
  
  describe('getColumns', () => {
    it('should return column values', async () => {
      const mockValues = [1, 2, 3];
      mockDB.columnQueryAsync.mockResolvedValueOnce(mockValues);
      
      const values = await dbService.getColumns('SELECT id FROM items');
      
      expect(values).toEqual(mockValues);
    });
  });
  
  describe('getValue', () => {
    it('should return single value', async () => {
      mockDB.valueQueryAsync.mockResolvedValueOnce(42);
      
      const value = await dbService.getValue('SELECT COUNT(*) FROM items');
      
      expect(value).toBe(42);
    });
    
    it('should return null for no results', async () => {
      mockDB.valueQueryAsync.mockResolvedValueOnce(undefined);
      
      const value = await dbService.getValue('SELECT id FROM items WHERE id = ?', { id: 999 });
      
      expect(value).toBeNull();
    });
  });
});