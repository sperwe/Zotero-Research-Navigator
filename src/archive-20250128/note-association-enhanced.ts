/**
 * 增强的笔记关联系统
 * 实现历史节点与 Zotero 笔记的双向关联
 */

import { HistoryNode } from "../services/database-service";
import { NoteAssociationSystem } from "./note-association-system";

export interface NoteAssociation {
  noteId: number;
  nodeId: number;
  type: "manual" | "auto" | "reference";
  createdAt: Date;
  context?: string;
}

export interface AssociatedNote {
  id: number;
  title: string;
  content: string;
  parentItem?: any;
  tags: string[];
  dateAdded: Date;
  dateModified: Date;
  associations: NoteAssociation[];
}

export class NoteAssociationEnhanced extends NoteAssociationSystem {
  private noteCache = new Map<number, AssociatedNote>();
  
  /**
   * 获取节点的所有关联笔记（包括详细信息）
   */
  async getNodeNotesDetailed(nodeId: number): Promise<AssociatedNote[]> {
    const associations = await this.getNodeNotes(nodeId);
    const notes: AssociatedNote[] = [];
    
    for (const association of associations) {
      const note = await this.getNoteDetails(association.noteId);
      if (note) {
        note.associations = [association];
        notes.push(note);
      }
    }
    
    return notes;
  }
  
  /**
   * 获取笔记详情
   */
  async getNoteDetails(noteId: number): Promise<AssociatedNote | null> {
    // 检查缓存
    if (this.noteCache.has(noteId)) {
      return this.noteCache.get(noteId)!;
    }
    
    try {
      const item = await Zotero.Items.getAsync(noteId);
      if (!item || !item.isNote()) {
        return null;
      }
      
      const note: AssociatedNote = {
        id: noteId,
        title: item.getNoteTitle() || "Untitled Note",
        content: item.getNote(),
        parentItem: item.parentItem ? await Zotero.Items.getAsync(item.parentItem) : undefined,
        tags: item.getTags().map((tag: any) => tag.tag),
        dateAdded: new Date(item.dateAdded),
        dateModified: new Date(item.dateModified),
        associations: []
      };
      
      // 缓存
      this.noteCache.set(noteId, note);
      
      return note;
    } catch (error) {
      Zotero.logError(error);
      return null;
    }
  }
  
  /**
   * 搜索相关笔记
   */
  async searchRelatedNotes(query: string, nodeId?: number): Promise<AssociatedNote[]> {
    const results: AssociatedNote[] = [];
    
    try {
      // 使用 Zotero 的搜索功能
      const search = new Zotero.Search();
      search.addCondition('itemType', 'is', 'note');
      search.addCondition('note', 'contains', query);
      
      const itemIds = await search.search();
      
      for (const itemId of itemIds) {
        const note = await this.getNoteDetails(itemId);
        if (note) {
          // 如果指定了节点，检查是否有关联
          if (nodeId) {
            const associations = await this.getAssociations(itemId, nodeId);
            note.associations = associations;
          }
          results.push(note);
        }
      }
    } catch (error) {
      Zotero.logError(error);
    }
    
    return results;
  }
  
  /**
   * 获取笔记和节点之间的所有关联
   */
  async getAssociations(noteId: number, nodeId: number): Promise<NoteAssociation[]> {
    const sql = `
      SELECT * FROM research_navigator_relations
      WHERE noteId = ? AND nodeId = ?
      ORDER BY createdAt DESC
    `;
    
    const rows = await Zotero.DB.queryAsync(sql, [noteId, nodeId]);
    
    return rows.map((row: any) => ({
      noteId: row.noteId,
      nodeId: row.nodeId,
      type: row.type || "manual",
      createdAt: new Date(row.createdAt),
      context: row.context
    }));
  }
  
  /**
   * 创建智能关联建议
   */
  async getSuggestedAssociations(nodeId: number): Promise<AssociatedNote[]> {
    const node = await this.getNode(nodeId);
    if (!node) return [];
    
    const suggestions: AssociatedNote[] = [];
    
    // 1. 基于父条目的笔记
    if (node.itemId) {
      const item = await Zotero.Items.getAsync(node.itemId);
      if (item) {
        // 获取条目的子笔记
        const noteIds = item.getNotes();
        for (const noteId of noteIds) {
          const note = await this.getNoteDetails(noteId);
          if (note && !await this.hasAssociation(noteId, nodeId)) {
            suggestions.push(note);
          }
        }
        
        // 获取父条目的笔记（如果当前是附件）
        if (item.parentItem) {
          const parent = await Zotero.Items.getAsync(item.parentItem);
          if (parent) {
            const parentNoteIds = parent.getNotes();
            for (const noteId of parentNoteIds) {
              const note = await this.getNoteDetails(noteId);
              if (note && !await this.hasAssociation(noteId, nodeId)) {
                suggestions.push(note);
              }
            }
          }
        }
      }
    }
    
    // 2. 基于时间接近的笔记
    const timeWindow = 30 * 60 * 1000; // 30分钟
    const nearbyNotes = await this.getNotesCreatedNear(node.timestamp, timeWindow);
    for (const note of nearbyNotes) {
      if (!suggestions.find(n => n.id === note.id) && 
          !await this.hasAssociation(note.id, nodeId)) {
        suggestions.push(note);
      }
    }
    
    // 3. 基于标签相似度
    if (node.itemId) {
      const item = await Zotero.Items.getAsync(node.itemId);
      if (item) {
        const itemTags = item.getTags().map((t: any) => t.tag);
        if (itemTags.length > 0) {
          const similarNotes = await this.getNotesWithSimilarTags(itemTags);
          for (const note of similarNotes) {
            if (!suggestions.find(n => n.id === note.id) && 
                !await this.hasAssociation(note.id, nodeId)) {
              suggestions.push(note);
            }
          }
        }
      }
    }
    
    return suggestions.slice(0, 10); // 最多返回10个建议
  }
  
  /**
   * 检查是否已有关联
   */
  private async hasAssociation(noteId: number, nodeId: number): Promise<boolean> {
    const sql = `
      SELECT COUNT(*) as count FROM research_navigator_relations
      WHERE noteId = ? AND nodeId = ?
    `;
    
    const result = await Zotero.DB.queryAsync(sql, [noteId, nodeId]);
    return result[0].count > 0;
  }
  
  /**
   * 获取在指定时间附近创建的笔记
   */
  private async getNotesCreatedNear(timestamp: Date, windowMs: number): Promise<AssociatedNote[]> {
    const startTime = new Date(timestamp.getTime() - windowMs);
    const endTime = new Date(timestamp.getTime() + windowMs);
    
    const sql = `
      SELECT itemID FROM items
      WHERE itemTypeID = (SELECT itemTypeID FROM itemTypes WHERE typeName = 'note')
      AND dateAdded BETWEEN ? AND ?
      ORDER BY dateAdded DESC
    `;
    
    const rows = await Zotero.DB.queryAsync(sql, [
      startTime.toISOString(),
      endTime.toISOString()
    ]);
    
    const notes: AssociatedNote[] = [];
    for (const row of rows) {
      const note = await this.getNoteDetails(row.itemID);
      if (note) {
        notes.push(note);
      }
    }
    
    return notes;
  }
  
  /**
   * 获取具有相似标签的笔记
   */
  private async getNotesWithSimilarTags(tags: string[]): Promise<AssociatedNote[]> {
    if (tags.length === 0) return [];
    
    const placeholders = tags.map(() => '?').join(',');
    const sql = `
      SELECT DISTINCT i.itemID, COUNT(*) as matchCount
      FROM items i
      JOIN itemTags it ON i.itemID = it.itemID
      JOIN tags t ON it.tagID = t.tagID
      WHERE i.itemTypeID = (SELECT itemTypeID FROM itemTypes WHERE typeName = 'note')
      AND t.name IN (${placeholders})
      GROUP BY i.itemID
      ORDER BY matchCount DESC
      LIMIT 20
    `;
    
    const rows = await Zotero.DB.queryAsync(sql, tags);
    
    const notes: AssociatedNote[] = [];
    for (const row of rows) {
      const note = await this.getNoteDetails(row.itemID);
      if (note) {
        notes.push(note);
      }
    }
    
    return notes;
  }
  
  /**
   * 创建带上下文的关联
   */
  async createContextualAssociation(
    noteId: number, 
    nodeId: number, 
    context: string,
    type: "manual" | "auto" | "reference" = "manual"
  ): Promise<void> {
    const sql = `
      INSERT INTO research_navigator_relations (noteId, nodeId, type, context, createdAt)
      VALUES (?, ?, ?, ?, ?)
    `;
    
    await Zotero.DB.queryAsync(sql, [
      noteId,
      nodeId,
      type,
      context,
      new Date().toISOString()
    ]);
    
    // 清除缓存
    this.noteCache.delete(noteId);
  }
  
  /**
   * 批量关联笔记
   */
  async batchAssociateNotes(nodeId: number, noteIds: number[]): Promise<void> {
    await Zotero.DB.executeTransaction(async () => {
      for (const noteId of noteIds) {
        if (!await this.hasAssociation(noteId, nodeId)) {
          await this.associateNote(noteId, nodeId);
        }
      }
    });
  }
  
  /**
   * 获取节点的历史上下文
   */
  private async getNode(nodeId: number): Promise<HistoryNode | null> {
    const sql = `SELECT * FROM research_navigator_history WHERE id = ?`;
    const rows = await Zotero.DB.queryAsync(sql, [nodeId]);
    
    if (rows.length === 0) return null;
    
    const row = rows[0];
    return {
      id: row.id,
      sessionId: row.sessionId,
      itemId: row.itemId,
      parentId: row.parentId,
      title: row.title,
      timestamp: new Date(row.timestamp),
      status: row.status,
      tabId: row.tabId,
      closedAt: row.closedAt ? new Date(row.closedAt) : undefined,
      closedContext: row.closedContext ? JSON.parse(row.closedContext) : undefined
    };
  }
  
  /**
   * 清除缓存
   */
  clearCache(): void {
    this.noteCache.clear();
  }
}