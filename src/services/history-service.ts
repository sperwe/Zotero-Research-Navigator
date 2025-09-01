/**
 * 历史服务
 * 管理研究历史和导航
 */

/// <reference path="../types/global.d.ts" />

import { DatabaseService, HistoryNode } from "./database-service";

export class HistoryService {
  private currentNode: HistoryNode | null = null;
  private currentSessionId: string;
  private sessionTimeout = 30 * 60 * 1000; // 30分钟
  private lastActivityTime: number;

  // 缓存
  private nodeCache = new Map<string, HistoryNode>();
  private itemNodeMap = new Map<number, string[]>(); // itemId -> nodeIds

  constructor(public databaseService: DatabaseService) {
    this.currentSessionId = this.generateSessionId();
    this.lastActivityTime = Date.now();
  }

  async initialize(): Promise<void> {
    Zotero.log("[HistoryService] Starting initialization...", "info");
    // 加载现有节点到缓存
    await this.loadNodesIntoCache();
    Zotero.log(
      `[HistoryService] Loaded ${this.nodeCache.size} nodes into cache`,
      "info",
    );

    // 检查是否需要恢复会话
    await this.checkSessionContinuity();
    Zotero.log(
      `[HistoryService] Current session ID: ${this.currentSessionId}`,
      "info",
    );

    Zotero.log("[HistoryService] Initialized", "info");
  }

  /**
   * 加载节点到缓存
   */
  private async loadNodesIntoCache(): Promise<void> {
    const nodes = await this.databaseService.getAllHistoryNodes();

    for (const node of nodes) {
      this.nodeCache.set(node.id, node);

      // 构建 itemId 索引
      if (!this.itemNodeMap.has(node.itemId)) {
        this.itemNodeMap.set(node.itemId, []);
      }
      this.itemNodeMap.get(node.itemId)!.push(node.id);
    }
  }

  /**
   * 检查会话连续性
   */
  private async checkSessionContinuity(): Promise<void> {
    const now = Date.now();

    // 获取最近的节点
    const recentNodes = Array.from(this.nodeCache.values())
      .filter((node) => node.status === "open")
      .sort((a, b) => b.lastVisit.getTime() - a.lastVisit.getTime());

    if (recentNodes.length > 0) {
      const lastNode = recentNodes[0];
      const timeSinceLastVisit = now - lastNode.lastVisit.getTime();

      // 如果距离上次访问不超过会话超时时间，继续使用相同会话
      if (timeSinceLastVisit < this.sessionTimeout) {
        this.currentSessionId = lastNode.sessionId;
        this.currentNode = lastNode;
        Zotero.log(
          `[HistoryService] Continuing session: ${this.currentSessionId}`,
          "info",
        );
      } else {
        // 创建新会话
        this.currentSessionId = this.generateSessionId();
        Zotero.log(
          `[HistoryService] Starting new session: ${this.currentSessionId}`,
          "info",
        );
      }
    }
  }

  /**
   * 创建或更新历史节点
   */
  async createOrUpdateNode(
    itemId: number,
    options: {
      parentId?: string;
      relationType?: string;
      force?: boolean;
    } = {},
  ): Promise<HistoryNode> {
    // 检查是否需要新会话
    this.checkSessionTimeout();

    // 获取 Zotero 项目
    const item = await Zotero.Items.getAsync(itemId);
    if (!item) {
      throw new Error(`Item ${itemId} not found`);
    }

    // 查找现有节点
    let existingNode: HistoryNode | null = null;
    const nodeIds = this.itemNodeMap.get(itemId) || [];

    // 优先查找当前会话中的节点
    for (const nodeId of nodeIds) {
      const node = this.nodeCache.get(nodeId);
      if (
        node &&
        node.sessionId === this.currentSessionId &&
        node.status === "open"
      ) {
        existingNode = node;
        break;
      }
    }

    if (existingNode && !options.force) {
      // 更新现有节点
      existingNode.lastVisit = new Date();
      existingNode.visitCount++;
      await this.databaseService.saveHistoryNode(existingNode);
      this.currentNode = existingNode;
      return existingNode;
    }

    // 创建新节点
    // 如果使用 force 选项，不设置父节点（避免外键约束问题）
    const parentId = options.force
      ? null
      : options.parentId || this.currentNode?.id || null;
    const path =
      parentId && this.currentNode && !options.force
        ? [...this.currentNode.path, this.currentNode.id]
        : [];

    const newNode: HistoryNode = {
      id: this.generateNodeId(),
      itemId: item.id,
      libraryId: item.libraryID,
      parentId,
      sessionId: this.currentSessionId,
      timestamp: new Date(),
      lastVisit: new Date(),
      visitCount: 1,
      title: this.getItemTitle(item),
      itemType: item.itemType,
      status: "open",
      hasNotes: false,
      depth: path.length,
      path,
    };

    // 保存到数据库
    await this.databaseService.saveHistoryNode(newNode);

    Zotero.log(
      `[HistoryService] Created new node: ${newNode.id} for item "${newNode.title}"`,
      "info",
    );

    // 更新缓存
    this.nodeCache.set(newNode.id, newNode);
    Zotero.log(
      `[HistoryService] Current nodeCache size: ${this.nodeCache.size}`,
      "info",
    );
    if (!this.itemNodeMap.has(itemId)) {
      this.itemNodeMap.set(itemId, []);
    }
    this.itemNodeMap.get(itemId)!.push(newNode.id);

    this.currentNode = newNode;
    this.lastActivityTime = Date.now();

    return newNode;
  }

  /**
   * 处理标签页选择
   */
  async handleTabSelect(tabId: string | number): Promise<void> {
    // 获取标签页信息
    const Zotero_Tabs = Zotero.getActiveZoteroPane()?.Zotero_Tabs;
    if (!Zotero_Tabs) return;

    const tab = Zotero_Tabs._tabs.find((t: any) => t.id === tabId);
    if (!tab || tab.type !== "reader" || !tab.data?.itemID) return;

    // 创建或更新节点
    await this.createOrUpdateNode(tab.data.itemID);
  }

  /**
   * 获取当前会话的节点
   */
  async getCurrentSessionNodes(): Promise<HistoryNode[]> {
    return Array.from(this.nodeCache.values())
      .filter((node) => node.sessionId === this.currentSessionId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * 获取单个节点
   */
  async getNode(nodeId: string): Promise<HistoryNode | null> {
    if (this.nodeCache.has(nodeId)) {
      return this.nodeCache.get(nodeId) || null;
    }

    const node = await this.databaseService.getHistoryNode(nodeId);
    if (node) {
      this.nodeCache.set(nodeId, node);
    }
    return node;
  }

  /**
   * 根据文献ID获取节点
   */

  async getNodesByItemId(itemId: number): Promise<HistoryNode[]> {
    return Array.from(this.nodeCache.values())
      .filter((node) => node.itemId === itemId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * 获取所有会话
   */
  getAllSessions(): any[] {
    // 根据 sessionId 分组节点
    const sessionMap = new Map<string, any>();

    for (const node of this.nodeCache.values()) {
      if (!sessionMap.has(node.sessionId)) {
        sessionMap.set(node.sessionId, {
          id: node.sessionId,
          name: `Session ${node.timestamp.toLocaleDateString()} ${node.timestamp.toLocaleTimeString()}`,
          startTime: node.timestamp,
          nodes: [],
        });
      }
      sessionMap.get(node.sessionId).nodes.push(node);
    }

    // 按时间排序会话
    const sessions = Array.from(sessionMap.values()).sort(
      (a, b) => b.startTime.getTime() - a.startTime.getTime(),
    );

    Zotero.log(
      `[HistoryService] Returning ${sessions.length} sessions with total ${this.nodeCache.size} nodes`,
      "info",
    );

    return sessions;
  }

  /**
   * 获取会话的所有节点
   */
  getSessionNodes(sessionId: string): HistoryNode[] {
    return Array.from(this.nodeCache.values())
      .filter((node) => node.sessionId === sessionId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * 获取节点的子节点
   */
  getChildNodes(nodeId: string): HistoryNode[] {
    return Array.from(this.nodeCache.values())
      .filter((node) => node.parentId === nodeId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * 获取项目的所有节点
   */
  getItemNodes(itemId: number): HistoryNode[] {
    const nodeIds = this.itemNodeMap.get(itemId) || [];
    return nodeIds
      .map((id) => this.nodeCache.get(id))
      .filter((node): node is HistoryNode => node !== undefined)
      .sort((a, b) => b.lastVisit.getTime() - a.lastVisit.getTime());
  }

  /**
   * 构建树形结构
   */
  buildTree(nodes: HistoryNode[]): Map<string | null, HistoryNode[]> {
    const tree = new Map<string | null, HistoryNode[]>();

    for (const node of nodes) {
      const parentId = node.parentId;
      if (!tree.has(parentId)) {
        tree.set(parentId, []);
      }
      tree.get(parentId)!.push(node);
    }

    return tree;
  }

  /**
   * 检查会话超时
   */
  private checkSessionTimeout(): void {
    const now = Date.now();
    if (now - this.lastActivityTime > this.sessionTimeout) {
      // 开始新会话
      this.currentSessionId = this.generateSessionId();
      this.currentNode = null;
      Zotero.log(
        `[HistoryService] Session timeout, starting new session: ${this.currentSessionId}`,
        "info",
      );
    }
    this.lastActivityTime = now;
  }

  /**
   * 生成会话ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 生成节点ID
   */
  private generateNodeId(): string {
    return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取项目标题
   */
  private getItemTitle(item: any): string {
    try {
      // 尝试获取标题
      let title = item.getField("title");

      // 如果标题为空，尝试其他字段
      if (!title) {
        // 对于附件，使用文件名
        if (item.isAttachment()) {
          title =
            item.getField("filename") || item.getField("title") || "Attachment";
        }
        // 对于笔记，使用前50个字符
        else if (item.isNote()) {
          const noteContent = item.getNote();
          const plainText = noteContent.replace(/<[^>]*>/g, "").trim();
          title =
            plainText.substring(0, 50) + (plainText.length > 50 ? "..." : "");
          if (!title) title = "Note";
        }
        // 其他类型尝试获取创作者和年份
        else {
          const creators = item.getCreators();
          const year = item.getField("date");
          if (creators && creators.length > 0) {
            const firstCreator = creators[0];
            title = firstCreator.lastName || firstCreator.name || "";
            if (year) {
              title += ` (${year.substring(0, 4)})`;
            }
          }
        }
      }

      return title || `Item ${item.id}`;
    } catch (error) {
      Zotero.logError(`[HistoryService] Error getting item title: ${error}`);
      return `Item ${item.id}`;
    }
  }

  /**
   * 删除节点
   */
  async deleteNode(nodeId: string): Promise<void> {
    // 首先递归删除所有子节点
    const childNodes = this.getChildNodes(nodeId);
    for (const child of childNodes) {
      await this.deleteNode(child.id);
    }

    // 从缓存中删除
    const node = this.nodeCache.get(nodeId);
    if (node) {
      this.nodeCache.delete(nodeId);

      // 从 itemNodeMap 中删除
      const nodeIds = this.itemNodeMap.get(node.itemId);
      if (nodeIds) {
        const index = nodeIds.indexOf(nodeId);
        if (index > -1) {
          nodeIds.splice(index, 1);
        }
        if (nodeIds.length === 0) {
          this.itemNodeMap.delete(node.itemId);
        }
      }
    }

    // 从数据库中删除
    await this.databaseService.deleteHistoryNode(nodeId);
  }

  /**
   * 获取当前节点
   */
  getCurrentNode(): HistoryNode | null {
    return this.currentNode;
  }

  /**
   * 获取当前会话ID
   */
  getCurrentSessionId(): string {
    return this.currentSessionId;
  }

  /**
   * 导航到节点
   */
  async navigateToNode(nodeId: string): Promise<void> {
    const node = this.nodeCache.get(nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }

    // 更新当前节点
    this.currentNode = node;

    // 打开对应的项目
    const item = await Zotero.Items.getAsync(node.itemId);
    if (item) {
      // 尝试在标签页中打开
      await this.openItemInTab(item);
    }
  }

  /**
   * 在标签页中打开项目
   */
  private async openItemInTab(item: Zotero.Item): Promise<boolean> {
    try {
      // 如果是附件
      if (item.isAttachment()) {
        if (item.attachmentReaderType) {
          await Zotero.Reader.open(item.id);
          return true;
        }
      }
      // 如果是常规项目，尝试打开最佳附件
      else if (item.isRegularItem()) {
        const attachments = item.getAttachments();
        for (const attachmentId of attachments) {
          const attachment = await Zotero.Items.getAsync(attachmentId);
          if (attachment?.attachmentReaderType) {
            await Zotero.Reader.open(attachmentId);
            return true;
          }
        }
      }

      // 如果无法在标签页中打开，在库中选择
      const ZoteroPane = Zotero.getActiveZoteroPane();
      if (ZoteroPane) {
        await ZoteroPane.selectItem(item.id);
      }

      return false;
    } catch (error) {
      Zotero.logError(error);
      return false;
    }
  }

  /**
   * 清除所有历史记录
   */
  async clearAll(preserveSessions: boolean = false): Promise<void> {
    try {
      Zotero.log("[HistoryService] Clearing all history", "info");

      // 清除数据库中的所有历史记录
      await this.databaseService.clearAll();

      // 清除内存缓存
      this.nodeCache.clear();
      this.itemNodeMap.clear();
      this.currentNode = null;

      // 如果不保留会话，重置当前会话
      if (!preserveSessions) {
        this.currentSessionId = this.generateSessionId();
        this.lastActivityTime = Date.now();
      }

      // 通知监听器
      await this.notifyListeners("clear", null);

      Zotero.log("[HistoryService] All history cleared", "info");
    } catch (error) {
      Zotero.logError(`[HistoryService] Failed to clear history: ${error}`);
      throw error;
    }
  }

  async destroy(): Promise<void> {
    // 清理缓存
    this.nodeCache.clear();
    this.itemNodeMap.clear();
    this.currentNode = null;
  }
}
