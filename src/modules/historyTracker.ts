/**
 * History tracking module for Research Navigator
 * Tracks research history in a tree structure
 */

import { config } from "../../package.json";

export interface AccessRecord {
  timestamp: number;
  action: 'open' | 'view' | 'edit';
}

export interface HistoryNode {
  itemID: string;
  title: string;
  itemType: string;
  parentID?: string;
  children: HistoryNode[];
  accessRecords: AccessRecord[];
  lastAccessed: number;
  expanded?: boolean;
}

export class HistoryTracker {
  private historyTree: Map<string, HistoryNode>;
  private currentNode: HistoryNode | null = null;
  private observerID: string | null = null;

  constructor() {
    this.historyTree = new Map();
    this.initialize();
  }

  private initialize(): void {
    // 从存储中加载历史记录
    this.loadHistory();

    // 注册 Zotero 事件监听器
    this.observerID = Zotero.Notifier.registerObserver({
      notify: async (event: string, type: string, ids: string[] | number[], _extraData: any) => {
        if (type === 'item' || type === 'collection') {
          for (const id of ids) {
            const itemID = String(id);
            if (event === 'select' || event === 'open') {
              await this.trackAccess(itemID, 'open');
            } else if (event === 'modify') {
              await this.trackAccess(itemID, 'edit');
            }
          }
        }
      }
    }, ['item', 'collection'], 'researchNavigator');

    ztoolkit.log('[Research Navigator] History tracker initialized');
  }

  async trackAccess(itemID: string, action: 'open' | 'view' | 'edit'): Promise<void> {
    try {
      const item = await Zotero.Items.getAsync(parseInt(itemID));
      if (!item) return;

      const node = this.getOrCreateNode(itemID, item);
      
      // 添加访问记录
      node.accessRecords.push({
        timestamp: Date.now(),
        action
      });
      node.lastAccessed = Date.now();

      // 设置父子关系
      if (this.currentNode && this.currentNode.itemID !== itemID) {
        node.parentID = this.currentNode.itemID;
        if (!this.currentNode.children.find(child => child.itemID === itemID)) {
          this.currentNode.children.push(node);
        }
      }

      this.currentNode = node;
      this.saveHistory();
      
      ztoolkit.log(`[Research Navigator] Tracked ${action} for item ${itemID}`);
    } catch (error) {
      ztoolkit.log(`[Research Navigator] Error tracking access: ${error}`, 'error');
    }
  }

  private getOrCreateNode(itemID: string, item: any): HistoryNode {
    if (this.historyTree.has(itemID)) {
      return this.historyTree.get(itemID)!;
    }

    const node: HistoryNode = {
      itemID,
      title: item.getField('title') || 'Untitled',
      itemType: item.itemType,
      children: [],
      accessRecords: [],
      lastAccessed: Date.now(),
      expanded: true
    };

    this.historyTree.set(itemID, node);
    return node;
  }

  getHistory(): HistoryNode[] {
    const rootNodes: HistoryNode[] = [];
    
    for (const node of this.historyTree.values()) {
      if (!node.parentID || !this.historyTree.has(node.parentID)) {
        rootNodes.push(node);
      }
    }

    // 按最后访问时间排序
    rootNodes.sort((a, b) => b.lastAccessed - a.lastAccessed);
    
    return rootNodes;
  }

  clearHistory(): void {
    this.historyTree.clear();
    this.currentNode = null;
    this.saveHistory();
    ztoolkit.log('[Research Navigator] History cleared');
  }

  private loadHistory(): void {
    try {
      const saved = Zotero.Prefs.get(`${config.prefsPrefix}.history`);
      if (saved) {
        const data = JSON.parse(saved);
        this.historyTree = new Map(data.map((node: HistoryNode) => [node.itemID, node]));
        ztoolkit.log('[Research Navigator] History loaded');
      }
    } catch (error) {
      ztoolkit.log(`[Research Navigator] Error loading history: ${error}`, 'error');
    }
  }

  private saveHistory(): void {
    try {
      const data = Array.from(this.historyTree.values());
      Zotero.Prefs.set(`${config.prefsPrefix}.history`, JSON.stringify(data));
    } catch (error) {
      ztoolkit.log(`[Research Navigator] Error saving history: ${error}`, 'error');
    }
  }

  destroy(): void {
    if (this.observerID) {
      Zotero.Notifier.unregisterObserver(this.observerID);
      this.observerID = null;
    }
    this.saveHistory();
    ztoolkit.log('[Research Navigator] History tracker destroyed');
  }
}