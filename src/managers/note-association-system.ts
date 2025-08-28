/**
 * 笔记双向关联系统
 * 管理笔记与历史节点之间的关联
 */

import {
  DatabaseService,
  NoteRelation,
  HistoryNode,
} from "../services/database-service";
import { HistoryService } from "../services/history-service";

export type RelationType =
  | "created_during"
  | "inspired_by"
  | "summarizes"
  | "questions"
  | "manual";

export interface NoteAssociation extends NoteRelation {
  note?: Zotero.Item;
  node?: HistoryNode;
}

export class NoteAssociationSystem {
  // 自动关联规则
  private autoAssociationRules = {
    // 如果笔记在访问某文献后5分钟内创建，自动关联
    timeWindow: 5 * 60 * 1000, // 5分钟
    // 如果笔记的父项与当前节点的项目相同，自动关联
    sameParent: true,
    // 如果笔记内容包含当前节点的标题，自动关联
    titleMention: true,
  };

  constructor(
    private databaseService: DatabaseService,
    private historyService: HistoryService,
  ) {}

  async initialize(): Promise<void> {
    Zotero.log("[NoteAssociationSystem] Initialized", "info");
  }

  /**
   * 创建笔记关联
   */
  async createAssociation(
    noteId: number,
    nodeId: string,
    relationType: RelationType = "created_during",
    context?: any,
  ): Promise<void> {
    // 检查是否已存在关联
    const existing = await this.getAssociation(noteId, nodeId);
    if (existing) {
      Zotero.log(
        `[NoteAssociationSystem] Association already exists between note ${noteId} and node ${nodeId}`,
        "warn",
      );
      return;
    }

    // 创建关联
    const relation: NoteRelation = {
      noteId,
      nodeId,
      relationType,
      createdAt: new Date(),
      context: {
        sessionId:
          context?.sessionId || this.historyService.getCurrentSessionId(),
        fromNode: context?.fromNode || this.historyService.getCurrentNode()?.id,
        path: context?.path || this.historyService.getCurrentNode()?.path || [],
      },
    };

    await this.databaseService.createNoteRelation(relation);

    Zotero.log(
      `[NoteAssociationSystem] Created association: note ${noteId} -> node ${nodeId} (${relationType})`,
      "info",
    );

    // 触发事件
    this.notifyAssociationCreated(relation);
  }

  /**
   * 检查是否需要自动关联
   */
  async checkAutoAssociation(note: Zotero.Item): Promise<void> {
    if (!note.isNote()) return;

    const currentNode = this.historyService.getCurrentNode();
    if (!currentNode) return;

    let shouldAssociate = false;
    let relationType: RelationType = "created_during";

    // 规则1：时间窗口内创建
    const timeSinceVisit = Date.now() - currentNode.lastVisit.getTime();
    if (timeSinceVisit <= this.autoAssociationRules.timeWindow) {
      shouldAssociate = true;
      relationType = "created_during";
    }

    // 规则2：相同父项
    if (
      this.autoAssociationRules.sameParent &&
      note.parentID === currentNode.itemId
    ) {
      shouldAssociate = true;
      relationType = "created_during";
    }

    // 规则3：标题提及
    if (this.autoAssociationRules.titleMention) {
      const noteContent = note.getNote();
      if (noteContent.toLowerCase().includes(currentNode.title.toLowerCase())) {
        shouldAssociate = true;
        relationType = "inspired_by";
      }
    }

    if (shouldAssociate) {
      await this.createAssociation(note.id, currentNode.id, relationType);
    }
  }

  /**
   * 获取笔记的所有关联
   */
  async getNoteAssociations(noteId: number): Promise<NoteAssociation[]> {
    const relations = await this.databaseService.getNoteAssociations(noteId);

    // 增强关联信息
    const associations: NoteAssociation[] = [];
    for (const relation of relations) {
      const node = await this.databaseService.getHistoryNode(relation.nodeId);
      if (node) {
        associations.push({
          ...relation,
          node,
        });
      }
    }

    return associations;
  }

  /**
   * 获取节点的所有笔记
   */
  async getNodeNotes(nodeId: string): Promise<NoteAssociation[]> {
    const relations = await this.databaseService.getNoteRelations(nodeId);

    // 增强关联信息
    const associations: NoteAssociation[] = [];
    for (const relation of relations) {
      try {
        const note = await Zotero.Items.getAsync(relation.noteId);
        if (note) {
          associations.push({
            ...relation,
            note,
          });
        }
      } catch (error) {
        // 笔记可能已被删除
        Zotero.log(
          `[NoteAssociationSystem] Note ${relation.noteId} not found`,
          "warn",
        );
      }
    }

    return associations;
  }

  /**
   * 获取特定关联
   */
  private async getAssociation(
    noteId: number,
    nodeId: string,
  ): Promise<NoteRelation | null> {
    const relations = await this.databaseService.getNoteAssociations(noteId);
    return relations.find((r) => r.nodeId === nodeId) || null;
  }

  /**
   * 删除关联
   */
  async removeAssociation(noteId: number, nodeId: string): Promise<void> {
    await this.databaseService.removeNoteRelation(noteId, nodeId);

    Zotero.log(
      `[NoteAssociationSystem] Removed association: note ${noteId} -> node ${nodeId}`,
      "info",
    );

    // 触发事件
    this.notifyAssociationRemoved(noteId, nodeId);
  }

  /**
   * 创建带有历史上下文的新笔记
   */
  async createContextualNote(
    nodeId: string,
    initialContent?: string,
  ): Promise<Zotero.Item> {
    const node = await this.databaseService.getHistoryNode(nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }

    // 获取 Zotero 项目
    const item = await Zotero.Items.getAsync(node.itemId);
    if (!item) {
      throw new Error(`Item ${node.itemId} not found`);
    }

    // 创建笔记
    const note = new Zotero.Item("note");
    note.libraryID = item.libraryID;

    // 如果项目不是笔记，将新笔记作为其子笔记
    if (!item.isNote()) {
      note.parentID = item.id;
    }

    // 构建历史路径文本
    const pathItems: string[] = [];
    for (const nodeId of node.path) {
      const pathNode = await this.databaseService.getHistoryNode(nodeId);
      if (pathNode) {
        pathItems.push(pathNode.title);
      }
    }
    pathItems.push(node.title);
    const pathText = pathItems.join(" → ");

    // 设置笔记内容
    const content = `
<h2>Research Context</h2>
<p><strong>Path:</strong> ${pathText}</p>
<p><strong>Session:</strong> ${node.sessionId}</p>
<p><strong>Created:</strong> ${new Date().toLocaleString()}</p>
<hr>
${initialContent || "<p>Your notes here...</p>"}
    `.trim();

    note.setNote(content);

    // 添加标签
    note.addTag("research-navigator");
    note.addTag(`session:${node.sessionId.substring(0, 8)}`);

    // 保存笔记
    await note.saveTx();

    // 创建关联
    await this.createAssociation(note.id, nodeId, "created_during", {
      sessionId: node.sessionId,
      fromNode: node.parentId,
      path: node.path,
    });

    return note;
  }

  /**
   * 获取推荐的关联
   */
  async getRecommendedAssociations(noteId: number): Promise<HistoryNode[]> {
    const note = await Zotero.Items.getAsync(noteId);
    if (!note || !note.isNote()) return [];

    const recommendations: HistoryNode[] = [];
    const noteContent = note.getNote().toLowerCase();
    const noteTitle = note.getNoteTitle().toLowerCase();

    // 获取所有节点
    const allNodes = await this.databaseService.getAllHistoryNodes();

    // 计算相关性分数
    const scoredNodes = allNodes.map((node) => {
      let score = 0;

      // 标题匹配
      if (
        noteContent.includes(node.title.toLowerCase()) ||
        noteTitle.includes(node.title.toLowerCase())
      ) {
        score += 10;
      }

      // 同一会话
      const currentSession = this.historyService.getCurrentSessionId();
      if (node.sessionId === currentSession) {
        score += 5;
      }

      // 时间接近
      const timeDiff = Math.abs(Date.now() - node.lastVisit.getTime());
      if (timeDiff < 10 * 60 * 1000) {
        // 10分钟内
        score += 3;
      }

      // 父项相同
      if (note.parentID && note.parentID === node.itemId) {
        score += 8;
      }

      return { node, score };
    });

    // 排序并返回前5个
    return scoredNodes
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((item) => item.node);
  }

  /**
   * 更新关联类型
   */
  async updateAssociationType(
    noteId: number,
    nodeId: string,
    newType: RelationType,
  ): Promise<void> {
    // 先删除旧关联
    await this.removeAssociation(noteId, nodeId);

    // 创建新关联
    await this.createAssociation(noteId, nodeId, newType);
  }

  /**
   * 获取关联统计
   */
  async getAssociationStats(): Promise<{
    totalAssociations: number;
    byType: Record<RelationType, number>;
    recentAssociations: NoteRelation[];
  }> {
    const allRelations = await this.databaseService.getAllNoteRelations();

    const byType: Record<RelationType, number> = {
      created_during: 0,
      inspired_by: 0,
      summarizes: 0,
      questions: 0,
      manual: 0,
    };

    for (const relation of allRelations) {
      byType[relation.relationType as RelationType]++;
    }

    return {
      totalAssociations: allRelations.length,
      byType,
      recentAssociations: allRelations.slice(0, 10),
    };
  }

  /**
   * 通知关联创建
   */
  private notifyAssociationCreated(relation: NoteRelation): void {
    const event = new CustomEvent("research-navigator-association-created", {
      detail: relation,
    });

    const win = Zotero.getMainWindow();
    if (win) {
      win.dispatchEvent(event);
    }
  }

  /**
   * 通知关联删除
   */
  private notifyAssociationRemoved(noteId: number, nodeId: string): void {
    const event = new CustomEvent("research-navigator-association-removed", {
      detail: { noteId, nodeId },
    });

    const win = Zotero.getMainWindow();
    if (win) {
      win.dispatchEvent(event);
    }
  }

  /**
   * 获取所有笔记关联
   */
  async getAllNoteRelations(): Promise<NoteRelation[]> {
    return await this.databaseService.getAllNoteRelations();
  }

  async destroy(): Promise<void> {
    // 清理资源
  }
}
