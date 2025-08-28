/**
 * 已关闭标签页管理器
 * 跟踪和管理已关闭的研究标签页
 */

import { HistoryService } from "../services/history-service";
import { HistoryNode } from "../services/database-service";

export interface ClosedTab {
  node: HistoryNode;
  tabData: any; // Zotero 标签页数据
  closedAt: Date;
  windowId: number;
  index: number; // 标签页原始位置
}

export class ClosedTabsManager {
  private closedTabs: ClosedTab[] = [];
  private maxClosedTabs = 100; // 最多保留100个已关闭标签页

  constructor(private historyService: HistoryService) {}

  get databaseService() {
    return (this.historyService as any).databaseService;
  }

  async initialize(): Promise<void> {
    // 从数据库加载已关闭的标签页
    await this.loadClosedTabs();

    // 同步 Zotero 的已关闭标签页历史
    await this.syncWithZoteroHistory();

    Zotero.log("[ClosedTabsManager] Initialized", "info");
  }

  /**
   * 从数据库加载已关闭的标签页
   */
  private async loadClosedTabs(): Promise<void> {
    const closedNodes = await this.databaseService.getClosedTabs(
      this.maxClosedTabs,
    );

    for (const node of closedNodes) {
      this.closedTabs.push({
        node,
        tabData: node.closedContext?.tabData || {},
        closedAt: node.closedAt!,
        windowId: node.closedContext?.windowId || 0,
        index: node.closedContext?.index || 0,
      });
    }
  }

  /**
   * 同步 Zotero 的已关闭标签页历史
   */
  private async syncWithZoteroHistory(): Promise<void> {
    const Zotero_Tabs = this.getZoteroTabs();
    if (!Zotero_Tabs || !Zotero_Tabs._history) return;

    // Zotero_Tabs._history 是一个数组的数组
    // 每个元素代表一次关闭操作，可能包含多个标签页
    for (const closedGroup of Zotero_Tabs._history) {
      for (const tabData of closedGroup) {
        if (tabData.type === "reader" && tabData.data?.itemID) {
          // 检查是否已经在我们的历史中
          const exists = this.closedTabs.some(
            (ct) =>
              ct.tabData.data?.itemID === tabData.data.itemID &&
              ct.closedAt.getTime() === (tabData.closedAt || Date.now()),
          );

          if (!exists) {
            // 创建历史节点
            const nodes = this.historyService.getItemNodes(tabData.data.itemID);
            let targetNode = nodes.find((n) => n.status === "closed");

            if (!targetNode && nodes.length > 0) {
              // 如果没有已关闭的节点，标记最近的节点为关闭
              targetNode = nodes[0];
              await this.markNodeAsClosed(targetNode, tabData);
            }

            if (targetNode) {
              this.closedTabs.unshift({
                node: targetNode,
                tabData,
                closedAt: new Date(tabData.closedAt || Date.now()),
                windowId: tabData.windowId || 0,
                index: tabData.index || 0,
              });
            }
          }
        }
      }
    }

    // 限制数量
    if (this.closedTabs.length > this.maxClosedTabs) {
      this.closedTabs = this.closedTabs.slice(0, this.maxClosedTabs);
    }
  }

  /**
   * 处理标签页关闭事件
   */
  async handleTabClose(tabIds: string[] | number[]): Promise<void> {
    const Zotero_Tabs = this.getZoteroTabs();
    if (!Zotero_Tabs) return;

    for (const tabId of tabIds) {
      // 获取关闭前的标签页信息
      const tab = Zotero_Tabs._tabs.find((t: any) => t.id === tabId);
      if (!tab || tab.type !== "reader" || !tab.data?.itemID) continue;

      // 获取或创建对应的历史节点
      const nodes = this.historyService.getItemNodes(tab.data.itemID);
      let targetNode = nodes.find((n) => n.status === "open");

      if (targetNode) {
        // 标记节点为已关闭
        await this.markNodeAsClosed(targetNode, tab);

        // 添加到已关闭列表
        this.closedTabs.unshift({
          node: targetNode,
          tabData: tab,
          closedAt: new Date(),
          windowId: Zotero_Tabs._window?.windowID || 0,
          index: Zotero_Tabs._tabs.indexOf(tab),
        });

        // 限制数量
        if (this.closedTabs.length > this.maxClosedTabs) {
          this.closedTabs.pop();
        }

        // 触发事件
        this.notifyClosedTabsChanged();
      }
    }
  }

  /**
   * 标记节点为已关闭
   */
  private async markNodeAsClosed(
    node: HistoryNode,
    tabData: any,
  ): Promise<void> {
    const closedContext = {
      tabData: {
        type: tabData.type,
        data: tabData.data,
        title: tabData.title,
      },
      windowId: tabData.windowId || 0,
      index: tabData.index || 0,
    };

    await this.databaseService.updateNodeStatus(
      node.id,
      "closed",
      new Date(),
      closedContext,
    );

    // 更新节点状态
    node.status = "closed";
    node.closedAt = new Date();
    node.closedContext = closedContext;
  }

  /**
   * 恢复已关闭的标签页
   */
  async restoreTab(nodeId: string): Promise<boolean> {
    const closedTab = this.closedTabs.find((ct) => ct.node.id === nodeId);
    if (!closedTab) return false;

    try {
      // 使用 Zotero 的恢复功能
      const Zotero_Tabs = this.getZoteroTabs();
      if (Zotero_Tabs && Zotero_Tabs.undoClose) {
        // 检查是否在 Zotero 的历史中
        const inHistory = Zotero_Tabs._history.some((group: any[]) =>
          group.some(
            (tab) =>
              tab.data?.itemID === closedTab.tabData.data?.itemID &&
              tab.closedAt === closedTab.closedAt.getTime(),
          ),
        );

        if (inHistory) {
          await Zotero_Tabs.undoClose();
        } else {
          // 手动打开
          await Zotero.Reader.open(closedTab.node.itemId);
        }
      } else {
        // 直接打开
        await Zotero.Reader.open(closedTab.node.itemId);
      }

      // 更新节点状态
      await this.databaseService.updateNodeStatus(closedTab.node.id, "open");

      // 从已关闭列表中移除
      this.closedTabs = this.closedTabs.filter((ct) => ct.node.id !== nodeId);

      // 触发事件
      this.notifyClosedTabsChanged();

      return true;
    } catch (error) {
      Zotero.logError(error);
      return false;
    }
  }

  /**
   * 恢复最近关闭的标签页
   */
  async restoreLastClosed(): Promise<boolean> {
    if (this.closedTabs.length === 0) return false;

    const lastClosed = this.closedTabs[0];
    return await this.restoreTab(lastClosed.node.id);
  }

  /**
   * 获取已关闭的标签页列表
   */
  getClosedTabs(limit?: number): ClosedTab[] {
    if (limit) {
      return this.closedTabs.slice(0, limit);
    }
    return [...this.closedTabs];
  }

  /**
   * 按日期分组获取已关闭的标签页
   */
  getClosedTabsByDate(): Map<string, ClosedTab[]> {
    const groups = new Map<string, ClosedTab[]>();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    for (const closedTab of this.closedTabs) {
      let dateKey: string;

      if (closedTab.closedAt >= today) {
        dateKey = Zotero.getString("date.today");
      } else if (closedTab.closedAt >= yesterday) {
        dateKey = Zotero.getString("date.yesterday");
      } else {
        dateKey = closedTab.closedAt.toLocaleDateString();
      }

      if (!groups.has(dateKey)) {
        groups.set(dateKey, []);
      }
      groups.get(dateKey)!.push(closedTab);
    }

    return groups;
  }

  /**
   * 清除所有已关闭的标签页
   */
  async clearAll(): Promise<void> {
    // 更新数据库中所有已关闭节点的状态
    for (const closedTab of this.closedTabs) {
      // 实际上不改变数据库状态，只是从内存中清除
      // 这样历史记录仍然保留
    }

    this.closedTabs = [];
    this.notifyClosedTabsChanged();
  }

  /**
   * 清除特定的已关闭标签页
   */
  async clearTab(nodeId: string): Promise<void> {
    this.closedTabs = this.closedTabs.filter((ct) => ct.node.id !== nodeId);
    this.notifyClosedTabsChanged();
  }

  /**
   * 获取 Zotero_Tabs 对象
   */
  private getZoteroTabs(): any {
    const win = Zotero.getMainWindow();
    return win?.Zotero_Tabs;
  }

  /**
   * 通知已关闭标签页列表变化
   */
  private notifyClosedTabsChanged(): void {
    // 触发自定义事件，UI 可以监听这个事件来更新显示
    const event = new CustomEvent("research-navigator-closed-tabs-changed", {
      detail: {
        count: this.closedTabs.length,
      },
    });

    const win = Zotero.getMainWindow();
    if (win) {
      win.dispatchEvent(event);
    }
  }

  /**
   * 获取已关闭标签页数量
   */
  getClosedTabsCount(): number {
    return this.closedTabs.length;
  }

  /**
   * 检查节点是否为已关闭的标签页
   */
  isClosedTab(nodeId: string): boolean {
    return this.closedTabs.some((ct) => ct.node.id === nodeId);
  }

  async destroy(): Promise<void> {
    this.closedTabs = [];
  }
}
