/**
 * 已关闭标签页管理器
 * 跟踪和管理已关闭的研究标签页
 */

import { HistoryService } from "../services/history-service";
import { HistoryNode } from "../services/database-service";
import { ZoteroTabsIntegration } from "./zotero-tabs-integration";

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
  private tabsIntegration: ZoteroTabsIntegration;
  
  // 历史加载设置
  private historyLoadDays: number = 7; // 默认加载7天
  private maxHistoryGroups: number = 50; // 最多加载50个历史组

  constructor(private historyService: HistoryService) {
    this.tabsIntegration = new ZoteroTabsIntegration();
    this.loadSettings();
  }
  
  private loadSettings(): void {
    // 从 Zotero 偏好设置加载
    this.historyLoadDays = Zotero.Prefs.get('researchnavigator.historyLoadDays', true) || 7;
    this.maxHistoryGroups = Zotero.Prefs.get('researchnavigator.maxHistoryGroups', true) || 50;
  }

  get databaseService() {
    return (this.historyService as any).databaseService;
  }

  async initialize(): Promise<void> {
    // 从数据库加载已关闭的标签页
    await this.loadClosedTabs();

    // 同步 Zotero 的已关闭标签页历史
    await this.syncWithZoteroHistory();
    
    // 如果初始同步失败，延迟重试
    if (this.closedTabs.length === 0) {
      // 多次重试，以防 Zotero_Tabs 初始化较晚
      let retryCount = 0;
      const retryInterval = setInterval(async () => {
        retryCount++;
        Zotero.log(`[ClosedTabsManager] Retry attempt ${retryCount}...`, "info");
        
        const Zotero_Tabs = this.getZoteroTabs();
        if (Zotero_Tabs && Zotero_Tabs._history) {
          Zotero.log(`[ClosedTabsManager] Found _history with ${Zotero_Tabs._history.length} groups`, "info");
          
          // 打印历史内容进行调试
          if (Zotero_Tabs._history.length > 0) {
            Zotero.log(`[ClosedTabsManager] First history group: ${JSON.stringify(Zotero_Tabs._history[0])}`, "info");
          }
        }
        
        await this.syncWithZoteroHistory();
        
        if (this.closedTabs.length > 0 || retryCount >= 5) {
          clearInterval(retryInterval);
          if (this.closedTabs.length > 0) {
            this.notifyClosedTabsChanged();
          }
        }
      }, 2000); // 每2秒重试一次，最多5次
    }

    Zotero.log("[ClosedTabsManager] Initialized", "info");
  }
  
  /**
   * 创建测试历史（仅用于开发测试）
   */
  async createTestHistory(): Promise<void> {
    const Zotero_Tabs = this.getZoteroTabs();
    if (!Zotero_Tabs || !Zotero_Tabs._history) return;
    
    // 先查看当前标签页
    Zotero.log(`[ClosedTabsManager] Current tabs: ${Zotero_Tabs._tabs.length}`, "info");
    if (Zotero_Tabs._tabs.length > 1) {
      const firstTab = Zotero_Tabs._tabs[1]; // 跳过库标签页
      Zotero.log(`[ClosedTabsManager] First tab: ${JSON.stringify(firstTab)}`, "info");
      
      // 关闭第一个非库标签页来创建真实历史
      if (firstTab && firstTab.id !== 'zotero-pane') {
        Zotero.log(`[ClosedTabsManager] Closing tab: ${firstTab.id}`, "info");
        Zotero_Tabs.close(firstTab.id);
      }
    } else {
      // 如果没有打开的标签页，添加测试历史
      Zotero_Tabs._history.push([
        {
          index: 1,
          data: {
            itemID: 123456789  // 一个不存在的项目，会创建幽灵节点
          }
        }
      ]);
    }
    
    // 重新同步
    setTimeout(async () => {
      await this.syncWithZoteroHistory();
      this.notifyClosedTabsChanged();
    }, 100);
    
    Zotero.log("[ClosedTabsManager] Test history created", "info");
  }
  
  /**
   * 调试：显示 Zotero 的完整状态
   */
  debugZoteroState(): void {
    const Zotero_Tabs = this.getZoteroTabs();
    if (!Zotero_Tabs) {
      Zotero.log("[ClosedTabsManager] DEBUG: Zotero_Tabs not available", "warning");
      return;
    }
    
    Zotero.log("[ClosedTabsManager] DEBUG: Zotero_Tabs state:", "info");
    Zotero.log(`[ClosedTabsManager] - _tabs length: ${Zotero_Tabs._tabs?.length || 0}`, "info");
    Zotero.log(`[ClosedTabsManager] - _history length: ${Zotero_Tabs._history?.length || 0}`, "info");
    
    // 检查是否有其他可能的历史存储
    const possibleProps = ['history', '_closedTabs', 'closedHistory', '_recentlyClosed'];
    for (const prop of possibleProps) {
      if (Zotero_Tabs[prop]) {
        Zotero.log(`[ClosedTabsManager] - Found property '${prop}': ${JSON.stringify(Zotero_Tabs[prop])}`, "info");
      }
    }
    
    // 检查 Zotero.Session
    if (Zotero.Session) {
      Zotero.log(`[ClosedTabsManager] - Zotero.Session.state: ${JSON.stringify(Zotero.Session.state)}`, "info");
    }
    
    // 显示真实的历史项目
    if (Zotero_Tabs._history) {
      let realHistoryCount = 0;
      Zotero_Tabs._history.forEach((group, i) => {
        group.forEach((item) => {
          if (item.data?.itemID !== 123456789) {
            realHistoryCount++;
            Zotero.log(`[ClosedTabsManager] - Real history item in group ${i}: itemID=${item.data?.itemID}`, "info");
            
            // 尝试获取项目信息
            if (item.data?.itemID) {
              try {
                const zoteroItem = Zotero.Items.get(item.data.itemID);
                if (zoteroItem) {
                  Zotero.log(`[ClosedTabsManager]   - Title: ${zoteroItem.getField('title')}`, "info");
                  Zotero.log(`[ClosedTabsManager]   - Type: ${zoteroItem.itemType}`, "info");
                }
              } catch (e) {
                Zotero.log(`[ClosedTabsManager]   - Item not found in library`, "info");
              }
            }
          }
        });
      });
      Zotero.log(`[ClosedTabsManager] - Total real history items: ${realHistoryCount}`, "info");
    }
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
    
    if (!Zotero_Tabs) {
      Zotero.log("[ClosedTabsManager] Zotero_Tabs not available yet", "warning");
      return;
    }
    
    if (!Zotero_Tabs._history) {
      Zotero.log("[ClosedTabsManager] Zotero_Tabs._history not available", "warning");
      return;
    }

    Zotero.log(`[ClosedTabsManager] Syncing with Zotero history: ${Zotero_Tabs._history.length} groups`, "info");
    
    // 应用加载限制
    const cutoffTime = Date.now() - (this.historyLoadDays * 24 * 60 * 60 * 1000);
    const historyToLoad = Zotero_Tabs._history.slice(0, this.maxHistoryGroups);
    
    Zotero.log(`[ClosedTabsManager] Loading last ${this.historyLoadDays} days, max ${this.maxHistoryGroups} groups`, "info");
    Zotero.log(`[ClosedTabsManager] Actually loading ${historyToLoad.length} groups`, "info");

    // Zotero_Tabs._history 是一个数组的数组
    // 每个元素代表一次关闭操作，可能包含多个标签页
    let groupIndex = 0;
    for (const closedGroup of historyToLoad) {
      Zotero.log(`[ClosedTabsManager] Processing history group ${groupIndex}: ${closedGroup.length} items`, "info");
      
      // 估算这个组的时间（基于索引）
      const estimatedTime = Date.now() - (groupIndex * 5 * 60 * 1000); // 假设每组间隔5分钟
      
      // 如果估算时间早于截止时间，跳过
      if (estimatedTime < cutoffTime) {
        Zotero.log(`[ClosedTabsManager] Skipping group ${groupIndex} - too old`, "info");
        groupIndex++;
        continue;
      }
      
      for (const historyItem of closedGroup) {
        // historyItem 包含 { index, data }
        const tabData = historyItem.data;
        
        if (tabData && tabData.itemID) {
          // 跳过测试数据
          if (tabData.itemID === 123456789) {
            Zotero.log(`[ClosedTabsManager] Skipping test data item`, "info");
            continue;
          }
          
          // 检查是否已经在我们的历史中
          const exists = this.closedTabs.some(
            (ct) => {
              return ct.node.itemId === tabData.itemID && ct.tabData === tabData;
            }
          );

          if (!exists) {
            // 创建或获取幽灵节点，使用日期作为 sessionId
            const dateStr = new Date(estimatedTime).toISOString().split('T')[0]; // YYYY-MM-DD
            const ghostNode = await this.createGhostNode(tabData, `history_${dateStr}`);
            
            if (ghostNode) {
              const closedAt = new Date(estimatedTime);
              
              this.closedTabs.unshift({
                node: ghostNode,
                tabData: tabData,
                closedAt: closedAt,
                windowId: 0,
                index: historyItem.index,
              });
            }
          }
        }
      }
      
      groupIndex++;
    }

    // 限制数量
    if (this.closedTabs.length > this.maxClosedTabs) {
      this.closedTabs = this.closedTabs.slice(0, this.maxClosedTabs);
    }
    
    Zotero.log(`[ClosedTabsManager] Synced ${this.closedTabs.length} closed tabs`, "info");
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
   * 创建幽灵节点（用于 Zotero 历史中的已关闭标签页）
   */
  private async createGhostNode(tabData: any, sessionId?: string): Promise<HistoryNode | null> {
    try {
      const itemId = tabData.itemID;
      if (!itemId) return null;

      // 获取现有节点
      const nodes = this.historyService.getItemNodes(itemId);
      let targetNode = nodes.find((n) => n.status === "closed");

      if (!targetNode) {
        // 尝试获取项目信息
        const item = await Zotero.Items.getAsync(itemId);
        if (!item) {
          // 创建一个幽灵节点（项目可能已删除）
          let title = `Deleted Item #${itemId}`;
          let itemType = "attachment";
          
          // 尝试从 session 状态获取标题
          try {
            const sessionTabs = Zotero.Session?.state?.windows?.[0]?.tabs || [];
            const sessionTab = sessionTabs.find((t: any) => t.data?.itemID === itemId);
            if (sessionTab && sessionTab.title) {
              title = sessionTab.title;
            }
          } catch (e) {
            // 忽略错误
          }
          
                        // 从图标推断类型
              if (tabData.icon) {
                if (tabData.icon.includes('PDF')) itemType = 'attachment';
                else if (tabData.icon.includes('EPUB')) itemType = 'attachment';
                else if (tabData.icon.includes('Snapshot')) itemType = 'webpage';
              }
              
              // 保存原始的标签页标题（如果有）
              if (!title && tabData.title) {
                title = tabData.title;
              }
          
          const ghostNode: HistoryNode = {
            id: `ghost_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            itemId: itemId,
            libraryId: tabData.libraryID || Zotero.Libraries.userLibraryID,
            parentId: null,
            sessionId: sessionId || "ghost_session",
            timestamp: new Date(tabData.closedAt || Date.now()),
            lastVisit: new Date(tabData.closedAt || Date.now()),
            visitCount: 1,
            title: title,
            itemType: itemType,
            status: "closed",
            closedAt: new Date(tabData.closedAt || Date.now()),
            closedContext: {
              tabData: tabData,
              windowId: 0,
              index: 0,
              isGhost: true,
              originalTitle: title
            },
            hasNotes: false,
            depth: 0,
            path: [],
            data: { 
              isGhost: true,
              icon: tabData.icon 
            }
          };
          
          // 不保存到数据库，只在内存中
          return ghostNode;
        } else {
          // 创建一个新的历史节点
          targetNode = await this.historyService.createOrUpdateNode(item.id, { force: true });
          await this.markNodeAsClosed(targetNode, tabData);
        }
      }

      return targetNode;
    } catch (error) {
      Zotero.logError(`[ClosedTabsManager] Failed to create ghost node: ${error}`);
      return null;
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
      tabData: tabData,
      windowId: 0,
      index: 0,
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
      // 检查项目是否仍然存在
      const item = await Zotero.Items.getAsync(closedTab.node.itemId);
      if (!item) {
        // 项目已被删除
        this.showNotification(
          `Cannot restore tab: Item "${closedTab.node.title}" has been deleted from library`,
          "error"
        );
        
        // 从已关闭列表中移除
        this.closedTabs = this.closedTabs.filter((ct) => ct.node.id !== nodeId);
        this.notifyClosedTabsChanged();
        return false;
      }

      // 使用 Zotero 的恢复功能
      const Zotero_Tabs = this.getZoteroTabs();
      if (Zotero_Tabs && Zotero_Tabs.undoClose) {
        // 检查是否在 Zotero 的历史中
        const inHistory = Zotero_Tabs._history.some((group: any[]) =>
          group.some(
            (historyItem) =>
              historyItem.data?.itemID === closedTab.node.itemId
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
      
      // 显示成功提示
      this.showNotification(
        `Restored tab: ${closedTab.node.title}`,
        "success"
      );

      return true;
    } catch (error) {
      Zotero.logError(error);
      this.showNotification(
        `Failed to restore tab: ${error}`,
        "error"
      );
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
    // 清除 Zotero 的历史
    const Zotero_Tabs = this.getZoteroTabs();
    if (Zotero_Tabs && Zotero_Tabs._history) {
      const originalLength = Zotero_Tabs._history.length;
      
      // 过滤掉包含测试数据的组
      Zotero_Tabs._history = Zotero_Tabs._history.filter(group => {
        // 保留至少有一个真实项目的组
        return group.some(item => item.data?.itemID !== 123456789);
      });
      
      // 从每个组中移除测试项目
      Zotero_Tabs._history = Zotero_Tabs._history.map(group => {
        return group.filter(item => item.data?.itemID !== 123456789);
      }).filter(group => group.length > 0); // 移除空组
      
      const newLength = Zotero_Tabs._history.length;
      Zotero.log(`[ClosedTabsManager] Cleared test data: ${originalLength} -> ${newLength} groups`, "info");
    }

    // 清除我们的缓存
    this.closedTabs = [];
    
    // 更新数据库中已关闭节点的状态
    try {
      const nodes = this.historyService.getAllNodes();
      for (const node of nodes) {
        if (node.status === "closed") {
          await this.databaseService.updateNodeStatus(node.id, "open");
        }
      }
    } catch (error) {
      Zotero.logError(`[ClosedTabsManager] Error updating node status: ${error}`);
    }
    
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
    return win?.Zotero_Tabs || null;
  }

  /**
   * 通知已关闭标签页列表变化
   */
  private notifyClosedTabsChanged(): void {
    // 使用 Zotero 的通知系统而不是 CustomEvent
    const win = Zotero.getMainWindow();
    if (win && win.document) {
      // 创建一个简单的事件
      const event = win.document.createEvent("Event");
      event.initEvent("research-navigator-closed-tabs-changed", true, true);
      
      // 将数据附加到 window 对象上
      (win as any).researchNavigatorClosedTabsCount = this.closedTabs.length;
      
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
  
  /**
   * 显示通知
   */
  private showNotification(message: string, type: "success" | "error" | "info" = "info"): void {
    const win = Zotero.getMainWindow();
    if (!win) return;
    
    // 使用 Zotero 的通知系统
    const progressWindow = new Zotero.ProgressWindow();
    progressWindow.changeHeadline("Research Navigator");
    
    const icon = type === "success" ? "chrome://zotero/skin/tick.png" : 
                 type === "error" ? "chrome://zotero/skin/cross.png" : 
                 "chrome://zotero/skin/information.png";
    
    progressWindow.addLines([message], [icon]);
    progressWindow.show();
    
    // 3秒后自动关闭
    win.setTimeout(() => {
      progressWindow.close();
    }, 3000);
  }

  /**
   * 从已关闭标签页列表中移除指定标签
   */
  async removeClosedTab(tabId: string): Promise<void> {
    try {
      const Zotero_Tabs = this.getZoteroTabs();
      if (!Zotero_Tabs || !Zotero_Tabs._history) {
        Zotero.logError("[ClosedTabsManager] Cannot remove tab: Zotero_Tabs not available");
        return;
      }

      // 遍历历史组，查找并移除指定的标签
      for (let groupIndex = 0; groupIndex < Zotero_Tabs._history.length; groupIndex++) {
        const group = Zotero_Tabs._history[groupIndex];
        const itemIndex = group.findIndex((item: any) => {
          return item.data && item.data.id === tabId;
        });

        if (itemIndex !== -1) {
          // 找到了要删除的标签
          group.splice(itemIndex, 1);
          
          // 如果这个组现在为空，删除整个组
          if (group.length === 0) {
            Zotero_Tabs._history.splice(groupIndex, 1);
          }

          Zotero.log(`[ClosedTabsManager] Removed closed tab: ${tabId}`, "info");
          
          // 触发更新事件
          this.notifyClosedTabsChanged();
          return;
        }
      }

      Zotero.log(`[ClosedTabsManager] Tab not found in closed tabs: ${tabId}`, "warning");
    } catch (error) {
      Zotero.logError(`[ClosedTabsManager] Error removing closed tab: ${error}`);
    }
  }
}
