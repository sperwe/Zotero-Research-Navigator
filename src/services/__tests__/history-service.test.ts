import { HistoryService } from "../history-service";
import { DatabaseService } from "../database-service";

// Mock DatabaseService
jest.mock("../database-service");

describe("HistoryService", () => {
  let historyService: HistoryService;
  let mockDbService: jest.Mocked<DatabaseService>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create mock database service
    mockDbService = new DatabaseService() as jest.Mocked<DatabaseService>;

    // Create history service instance
    historyService = new HistoryService();
    (historyService as any).dbService = mockDbService;
  });

  describe("trackNavigation", () => {
    it("should create a new history node", async () => {
      const nodeId = "item-123";
      const timestamp = Date.now();

      // Mock the database call
      mockDbService.execute = jest.fn().mockResolvedValue(undefined);

      // Track navigation
      await historyService.trackNavigation(nodeId);

      // Verify database was called
      expect(mockDbService.execute).toHaveBeenCalledWith(
        expect.stringContaining("INSERT OR REPLACE INTO history_nodes"),
        expect.objectContaining({
          nodeId,
          data: expect.stringContaining(nodeId),
        }),
      );
    });

    it("should handle errors gracefully", async () => {
      const nodeId = "item-456";

      // Mock database error
      mockDbService.execute = jest
        .fn()
        .mockRejectedValue(new Error("DB Error"));

      // Should not throw
      await expect(
        historyService.trackNavigation(nodeId),
      ).resolves.not.toThrow();

      // Verify error was logged
      expect(Zotero.logError).toHaveBeenCalled();
    });
  });

  describe("getRecentHistory", () => {
    it("should return recent history nodes", async () => {
      const mockNodes = [
        { nodeId: "item-1", data: '{"title":"Test 1"}', timestamp: Date.now() },
        {
          nodeId: "item-2",
          data: '{"title":"Test 2"}',
          timestamp: Date.now() - 1000,
        },
      ];

      // Mock database query
      mockDbService.query = jest.fn().mockResolvedValue(mockNodes);

      // Get recent history
      const result = await historyService.getRecentHistory(10);

      // Verify query
      expect(mockDbService.query).toHaveBeenCalledWith(
        expect.stringContaining("ORDER BY timestamp DESC"),
        { limit: 10 },
      );

      // Verify result
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("item-1");
    });
  });

  describe("getSessionHistory", () => {
    it("should group history by sessions", async () => {
      const now = Date.now();
      const mockNodes = [
        { nodeId: "item-1", data: '{"title":"Today 1"}', timestamp: now },
        {
          nodeId: "item-2",
          data: '{"title":"Today 2"}',
          timestamp: now - 1000,
        },
        {
          nodeId: "item-3",
          data: '{"title":"Yesterday"}',
          timestamp: now - 86400000,
        },
      ];

      // Mock database query
      mockDbService.query = jest.fn().mockResolvedValue(mockNodes);

      // Get session history
      const sessions = await historyService.getSessionHistory();

      // Should have 2 sessions (today and yesterday)
      expect(sessions).toHaveLength(2);
      expect(sessions[0].nodes).toHaveLength(2);
      expect(sessions[1].nodes).toHaveLength(1);
    });
  });
});
