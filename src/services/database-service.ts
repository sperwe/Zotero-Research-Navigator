/**
 * 数据库服务
 * 处理所有数据持久化操作
 */

export interface HistoryNode {
  id: string;
  itemId: number;
  libraryId: number;
  parentId: string | null;
  sessionId: string;
  timestamp: Date;
  lastVisit: Date;
  visitCount: number;
  title: string;
  itemType: string;
  status: "open" | "closed";
  closedAt?: Date;
  closedContext?: any;
  hasNotes: boolean;
  depth: number;
  path: string[]; // 从根到当前节点的路径
  data?: any; // Additional data that can be attached to the node
  url?: string; // URL for web items
}

export interface NoteRelation {
  id?: number;
  noteId: number;
  nodeId: string;
  relationType:
    | "created_during"
    | "inspired_by"
    | "summarizes"
    | "questions"
    | "manual"
    | "quick-note"
    | "reference"
    | "suggested";
  createdAt: Date;
  context: {
    sessionId: string;
    fromNode?: string;
    path?: string[];
  };
}

export class DatabaseService {
  private readonly DB_VERSION = 1;
  private readonly HISTORY_TABLE = "research_navigator_history";
  private readonly RELATIONS_TABLE = "research_navigator_note_relations";
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) {
      Zotero.log("[DatabaseService] Already initialized", "info");
      return;
    }

    Zotero.log("[DatabaseService] Starting initialization...", "info");
    try {
      // 创建历史表
      await Zotero.DB.queryAsync(`
        CREATE TABLE IF NOT EXISTS ${this.HISTORY_TABLE} (
          id TEXT PRIMARY KEY,
          itemId INTEGER NOT NULL,
          libraryId INTEGER NOT NULL,
          parentId TEXT,
          sessionId TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          lastVisit INTEGER NOT NULL,
          visitCount INTEGER DEFAULT 1,
          title TEXT NOT NULL,
          itemType TEXT,
          status TEXT DEFAULT 'open',
          closedAt INTEGER,
          closedContext TEXT,
          hasNotes INTEGER DEFAULT 0,
          depth INTEGER DEFAULT 0,
          path TEXT,
          data TEXT,
          FOREIGN KEY (parentId) REFERENCES ${this.HISTORY_TABLE}(id)
        )
      `);

      // 创建索引
      await Zotero.DB.queryAsync(
        `CREATE INDEX IF NOT EXISTS idx_itemId ON ${this.HISTORY_TABLE}(itemId)`,
      );
      await Zotero.DB.queryAsync(
        `CREATE INDEX IF NOT EXISTS idx_sessionId ON ${this.HISTORY_TABLE}(sessionId)`,
      );
      await Zotero.DB.queryAsync(
        `CREATE INDEX IF NOT EXISTS idx_status ON ${this.HISTORY_TABLE}(status)`,
      );
      await Zotero.DB.queryAsync(
        `CREATE INDEX IF NOT EXISTS idx_timestamp ON ${this.HISTORY_TABLE}(timestamp)`,
      );

      // 创建笔记关联表
      await Zotero.DB.queryAsync(`
        CREATE TABLE IF NOT EXISTS ${this.RELATIONS_TABLE} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          noteId INTEGER NOT NULL,
          nodeId TEXT NOT NULL,
          relationType TEXT DEFAULT 'created_during',
          createdAt INTEGER NOT NULL,
          context TEXT,
          UNIQUE(noteId, nodeId),
          FOREIGN KEY (nodeId) REFERENCES ${this.HISTORY_TABLE}(id)
        )
      `);

      // 创建笔记关联表的索引
      await Zotero.DB.queryAsync(
        `CREATE INDEX IF NOT EXISTS idx_noteId ON ${this.RELATIONS_TABLE}(noteId)`,
      );
      await Zotero.DB.queryAsync(
        `CREATE INDEX IF NOT EXISTS idx_nodeId ON ${this.RELATIONS_TABLE}(nodeId)`,
      );

      this.initialized = true;
      Zotero.log("[DatabaseService] Database initialized", "info");
    } catch (error) {
      Zotero.logError(error);
      throw new Error(`Failed to initialize database: ${error}`);
    }
  }

  /**
   * 删除历史节点
   */
  async deleteHistoryNode(nodeId: string): Promise<void> {
    await Zotero.DB.queryAsync(
      `DELETE FROM ${this.HISTORY_TABLE} WHERE id = ?`,
      [nodeId],
    );
  }

  /**
   * 保存历史节点
   */
  async saveHistoryNode(node: HistoryNode): Promise<void> {
    const data = {
      title: node.title,
      itemType: node.itemType,
      depth: node.depth,
      hasNotes: node.hasNotes,
    };

    await Zotero.DB.queryAsync(
      `INSERT OR REPLACE INTO ${this.HISTORY_TABLE} 
       (id, itemId, libraryId, parentId, sessionId, timestamp, lastVisit, 
        visitCount, title, itemType, status, closedAt, closedContext, 
        hasNotes, depth, path, data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        node.id,
        node.itemId,
        node.libraryId,
        node.parentId,
        node.sessionId,
        node.timestamp.getTime(),
        node.lastVisit.getTime(),
        node.visitCount,
        node.title,
        node.itemType,
        node.status,
        node.closedAt?.getTime() || null,
        node.closedContext ? JSON.stringify(node.closedContext) : null,
        node.hasNotes ? 1 : 0,
        node.depth,
        JSON.stringify(node.path),
        JSON.stringify(data),
      ],
    );
  }

  /**
   * 获取历史节点
   */
  async getHistoryNode(id: string): Promise<HistoryNode | null> {
    const results = await Zotero.DB.queryAsync(
      `SELECT * FROM ${this.HISTORY_TABLE} WHERE id = ?`,
      [id],
    );

    if (results.length === 0) return null;

    return this.rowToHistoryNode(results[0]);
  }

  /**
   * 获取所有历史节点
   */
  async getAllHistoryNodes(): Promise<HistoryNode[]> {
    Zotero.log("[DatabaseService] Getting all history nodes...", "info");
    const results = await Zotero.DB.queryAsync(
      `SELECT * FROM ${this.HISTORY_TABLE} ORDER BY timestamp DESC`,
    );
    Zotero.log(
      `[DatabaseService] Found ${results.length} history nodes in database`,
      "info",
    );

    return results.map((row) => this.rowToHistoryNode(row));
  }

  /**
   * 获取会话的历史节点
   */
  async getSessionNodes(sessionId: string): Promise<HistoryNode[]> {
    const results = await Zotero.DB.queryAsync(
      `SELECT * FROM ${this.HISTORY_TABLE} 
       WHERE sessionId = ? 
       ORDER BY timestamp ASC`,
      [sessionId],
    );

    return results.map((row) => this.rowToHistoryNode(row));
  }

  /**
   * 获取已关闭的标签页
   */
  async getClosedTabs(limit: number = 50): Promise<HistoryNode[]> {
    const results = await Zotero.DB.queryAsync(
      `SELECT * FROM ${this.HISTORY_TABLE} 
       WHERE status = 'closed' 
       ORDER BY closedAt DESC 
       LIMIT ?`,
      [limit],
    );

    return results.map((row) => this.rowToHistoryNode(row));
  }

  /**
   * 更新节点状态
   */
  async updateNodeStatus(
    nodeId: string,
    status: "open" | "closed",
    closedAt?: Date,
    closedContext?: any,
  ): Promise<void> {
    await Zotero.DB.queryAsync(
      `UPDATE ${this.HISTORY_TABLE} 
       SET status = ?, closedAt = ?, closedContext = ?
       WHERE id = ?`,
      [
        status,
        closedAt?.getTime() || null,
        closedContext ? JSON.stringify(closedContext) : null,
        nodeId,
      ],
    );
  }

  /**
   * 创建笔记关联
   */
  async createNoteRelation(relation: NoteRelation): Promise<void> {
    await Zotero.DB.queryAsync(
      `INSERT INTO ${this.RELATIONS_TABLE} 
       (noteId, nodeId, relationType, createdAt, context)
       VALUES (?, ?, ?, ?, ?)`,
      [
        relation.noteId,
        relation.nodeId,
        relation.relationType,
        relation.createdAt.getTime(),
        JSON.stringify(relation.context),
      ],
    );

    // 更新节点的 hasNotes 标记
    await Zotero.DB.queryAsync(
      `UPDATE ${this.HISTORY_TABLE} SET hasNotes = 1 WHERE id = ?`,
      [relation.nodeId],
    );
  }

  /**
   * 获取节点的笔记关联
   */
  async getNoteRelations(nodeId: string): Promise<NoteRelation[]> {
    const results = await Zotero.DB.queryAsync(
      `SELECT * FROM ${this.RELATIONS_TABLE} 
       WHERE nodeId = ? 
       ORDER BY createdAt DESC`,
      [nodeId],
    );

    return results.map((row) => ({
      id: row.id,
      noteId: row.noteId,
      nodeId: row.nodeId,
      relationType: row.relationType,
      createdAt: new Date(row.createdAt),
      context: JSON.parse(row.context || "{}"),
    }));
  }

  /**
   * 获取所有笔记关联
   */
  async getAllNoteRelations(): Promise<NoteRelation[]> {
    const results = await Zotero.DB.queryAsync(
      `SELECT * FROM ${this.RELATIONS_TABLE} 
       ORDER BY createdAt DESC`,
    );

    return results.map((row) => ({
      id: row.id,
      noteId: row.noteId,
      nodeId: row.nodeId,
      relationType: row.relationType,
      createdAt: new Date(row.createdAt),
      context: JSON.parse(row.context || "{}"),
    }));
  }

  /**
   * 获取笔记的所有关联
   */
  async getNoteAssociations(noteId: number): Promise<NoteRelation[]> {
    const results = await Zotero.DB.queryAsync(
      `SELECT * FROM ${this.RELATIONS_TABLE} 
       WHERE noteId = ? 
       ORDER BY createdAt DESC`,
      [noteId],
    );

    return results.map((row) => ({
      id: row.id,
      noteId: row.noteId,
      nodeId: row.nodeId,
      relationType: row.relationType,
      createdAt: new Date(row.createdAt),
      context: JSON.parse(row.context || "{}"),
    }));
  }

  /**
   * 删除笔记关联
   */
  async removeNoteRelation(noteId: number, nodeId: string): Promise<void> {
    await Zotero.DB.queryAsync(
      `DELETE FROM ${this.RELATIONS_TABLE} 
       WHERE noteId = ? AND nodeId = ?`,
      [noteId, nodeId],
    );

    // 检查节点是否还有其他笔记关联
    const remaining = await Zotero.DB.queryAsync(
      `SELECT COUNT(*) as count FROM ${this.RELATIONS_TABLE} WHERE nodeId = ?`,
      [nodeId],
    );

    if (remaining[0].count === 0) {
      await Zotero.DB.queryAsync(
        `UPDATE ${this.HISTORY_TABLE} SET hasNotes = 0 WHERE id = ?`,
        [nodeId],
      );
    }
  }

  /**
   * 清理数据库
   */
  async clearAll(): Promise<void> {
    await Zotero.DB.queryAsync(`DELETE FROM ${this.RELATIONS_TABLE}`);
    await Zotero.DB.queryAsync(`DELETE FROM ${this.HISTORY_TABLE}`);
  }

  /**
   * 行数据转换为历史节点
   */
  private rowToHistoryNode(row: any): HistoryNode {
    return {
      id: row.id,
      itemId: row.itemId,
      libraryId: row.libraryId,
      parentId: row.parentId,
      sessionId: row.sessionId,
      timestamp: new Date(row.timestamp),
      lastVisit: new Date(row.lastVisit),
      visitCount: row.visitCount,
      title: row.title,
      itemType: row.itemType,
      status: row.status,
      closedAt: row.closedAt ? new Date(row.closedAt) : undefined,
      closedContext: row.closedContext
        ? JSON.parse(row.closedContext)
        : undefined,
      hasNotes: row.hasNotes === 1,
      depth: row.depth,
      path: JSON.parse(row.path || "[]"),
    };
  }

  async destroy(): Promise<void> {
    // 数据库连接由 Zotero 管理，不需要手动关闭
    this.initialized = false;
  }
}
