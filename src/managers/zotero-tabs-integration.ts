/**
 * Zotero 标签页集成
 * 深度集成 Zotero 的标签页系统
 */

// Zotero_Tabs 需要从窗口对象获取

export interface ZoteroTabData {
  id: string;
  type: "reader" | "library" | "search" | "note";
  title: string;
  data: any;
  index?: number;
  windowId?: number;
  closedAt?: number;
  state?: any; // 标签页状态（滚动位置等）
}

export interface ZoteroClosedTabGroup {
  tabs: ZoteroTabData[];
  closedAt: number;
  windowId: number;
}

export class ZoteroTabsIntegration {
  private historyChangeListeners: Set<() => void> = new Set();
  private originalUndoClose: any;
  private Zotero_Tabs: any;
  
  constructor() {
    // 延迟初始化，等待 Zotero_Tabs 可用
    const win = Zotero.getMainWindow();
    if (win && win.setTimeout) {
      win.setTimeout(() => this.setupHooks(), 1000);
    } else {
      // 立即尝试
      this.setupHooks();
    }
  }
  
  /**
   * 获取 Zotero_Tabs 对象
   */
  private getZoteroTabs(): any {
    try {
      const win = Zotero.getMainWindow();
      if (!win) return null;
      
      // 尝试多种方式获取 Zotero_Tabs
      if (win.Zotero_Tabs) {
        return win.Zotero_Tabs;
      }
      
      // 尝试从全局 Zotero 对象获取
      if ((Zotero as any).Tabs) {
        return (Zotero as any).Tabs;
      }
      
      // 尝试从 ZoteroPane 获取
      if (win.ZoteroPane && (win.ZoteroPane as any).tabs) {
        return (win.ZoteroPane as any).tabs;
      }
      
      return null;
    } catch (error) {
      Zotero.logError(`[ZoteroTabsIntegration] Error getting Zotero_Tabs: ${error}`);
      return null;
    }
  }
  
  /**
   * 设置钩子以监听标签页变化
   */
  private setupHooks(): void {
    this.Zotero_Tabs = this.getZoteroTabs();
    if (!this.Zotero_Tabs) {
      Zotero.log("[ZoteroTabsIntegration] Zotero_Tabs not available", "warn");
      return;
    }
    
    const Zotero_Tabs = this.Zotero_Tabs;
    
    // 保存原始方法
    this.originalUndoClose = this.Zotero_Tabs.undoClose;
    
    // 监听标签页关闭
    const originalClose = this.Zotero_Tabs.close;
    this.Zotero_Tabs.close = (tabID: string) => {
      const tabData = this.getTabData(tabID);
      const result = originalClose.call(Zotero_Tabs, tabID);
      
      if (tabData) {
        this.onTabClosed(tabData);
      }
      
      return result;
    };
    
    // 监听撤销关闭
    this.Zotero_Tabs.undoClose = () => {
      const result = this.originalUndoClose.call(Zotero_Tabs);
      this.onHistoryChanged();
      return result;
    };
    
    Zotero.log("[ZoteroTabsIntegration] Hooks installed", "info");
  }
  
  /**
   * 获取标签页数据
   */
  private getTabData(tabID: string): ZoteroTabData | null {
    if (!this.Zotero_Tabs || !this.Zotero_Tabs._tabs || !this.Zotero_Tabs._tabs[tabID]) {
      return null;
    }
    
    const tab = this.Zotero_Tabs._tabs[tabID];
    return {
      id: tabID,
      type: tab.type,
      title: tab.title || "",
      data: tab.data,
      index: this.Zotero_Tabs._getTabIndex(tabID),
      windowId: tab.windowId,
      state: tab.state
    };
  }
  
  /**
   * 获取所有已关闭的标签页
   */
  getClosedTabs(): ZoteroClosedTabGroup[] {
    if (!this.Zotero_Tabs || !this.Zotero_Tabs._history) {
      return [];
    }
    
    const groups: ZoteroClosedTabGroup[] = [];
    
    // this.Zotero_Tabs._history 是一个二维数组
    // 外层数组的每个元素代表一次关闭操作（可能关闭多个标签）
    for (let i = 0; i < this.Zotero_Tabs._history.length; i++) {
      const historyGroup = this.Zotero_Tabs._history[i];
      const tabs: ZoteroTabData[] = [];
      
      for (const tabData of historyGroup) {
        tabs.push({
          id: tabData.id || `closed-${Date.now()}-${Math.random()}`,
          type: tabData.type,
          title: tabData.title || this.getTabTitle(tabData),
          data: tabData.data,
          index: tabData.index,
          windowId: tabData.windowId,
          closedAt: tabData.closedAt,
          state: tabData.state
        });
      }
      
      if (tabs.length > 0) {
        groups.push({
          tabs,
          closedAt: tabs[0].closedAt || Date.now(),
          windowId: tabs[0].windowId || 0
        });
      }
    }
    
    return groups;
  }
  
  /**
   * 获取标签页标题
   */
  private getTabTitle(tabData: any): string {
    if (tabData.title) return tabData.title;
    
    switch (tabData.type) {
      case "reader":
        if (tabData.data?.itemID) {
          try {
            const item = Zotero.Items.get(tabData.data.itemID);
            if (item) {
              return item.getDisplayTitle();
            }
          } catch (e) {
            // Item might be deleted
          }
        }
        return "PDF Reader";
        
      case "library":
        return tabData.data?.libraryID 
          ? `Library ${tabData.data.libraryID}`
          : "Library";
          
      case "search":
        return tabData.data?.query || "Search";
        
      case "note":
        return tabData.data?.itemID
          ? `Note ${tabData.data.itemID}`
          : "Note";
          
      default:
        return "Unknown Tab";
    }
  }
  
  /**
   * 恢复已关闭的标签页
   */
  async restoreTab(tabData: ZoteroTabData): Promise<boolean> {
    try {
      switch (tabData.type) {
        case "reader":
          if (tabData.data?.itemID) {
            // 检查条目是否还存在
            const item = await Zotero.Items.getAsync(tabData.data.itemID);
            if (item) {
              await Zotero.Reader.open(
                tabData.data.itemID,
                tabData.data.location,
                {
                  openInWindow: tabData.data.openInWindow,
                  allowDuplicate: false
                }
              );
              
              // 恢复状态（如滚动位置）
              if (tabData.state) {
                this.restoreTabState(tabData.id, tabData.state);
              }
              
              return true;
            }
          }
          break;
          
        case "library":
          // 恢复库视图
          if (tabData.data?.libraryID) {
            const library = Zotero.Libraries.get(tabData.data.libraryID);
            if (library) {
              this.Zotero_Tabs.add({
                type: "library",
                data: tabData.data,
                title: tabData.title
              });
              return true;
            }
          }
          break;
          
        case "search":
          // 恢复搜索
          if (tabData.data?.query) {
            this.Zotero_Tabs.add({
              type: "search",
              data: tabData.data,
              title: tabData.title
            });
            return true;
          }
          break;
          
        case "note":
          // 恢复笔记
          if (tabData.data?.itemID) {
            const item = await Zotero.Items.getAsync(tabData.data.itemID);
            if (item && item.isNote()) {
              this.Zotero_Tabs.add({
                type: "note",
                data: tabData.data,
                title: tabData.title
              });
              return true;
            }
          }
          break;
      }
    } catch (error) {
      Zotero.logError(error);
    }
    
    return false;
  }
  
  /**
   * 恢复最近关闭的标签页组
   */
  async restoreLastClosedGroup(): Promise<boolean> {
    if (this.originalUndoClose) {
      return this.originalUndoClose.call(this.Zotero_Tabs);
    }
    return false;
  }
  
  /**
   * 恢复标签页状态
   */
  private async restoreTabState(tabID: string, state: any): Promise<void> {
    // 等待标签页完全加载
    await new Promise(resolve => {
      const checkInterval = setInterval(() => {
        const tab = this.Zotero_Tabs._tabs[tabID];
        if (tab && tab.loaded) {
          clearInterval(checkInterval);
          resolve(undefined);
        }
      }, 100);
      
      // 超时保护
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve(undefined);
      }, 5000);
    });
    
    // 应用状态
    const tab = this.Zotero_Tabs._tabs[tabID];
    if (tab && state) {
      Object.assign(tab.state || {}, state);
    }
  }
  
  /**
   * 清空已关闭标签页历史
   */
  clearHistory(): void {
    if (this.Zotero_Tabs._history) {
      this.Zotero_Tabs._history.length = 0;
      this.onHistoryChanged();
    }
  }
  
  /**
   * 当标签页关闭时
   */
  private onTabClosed(tabData: ZoteroTabData): void {
    // 通知监听器
    this.notifyHistoryChange();
  }
  
  /**
   * 当历史变化时
   */
  private onHistoryChanged(): void {
    this.notifyHistoryChange();
  }
  
  /**
   * 添加历史变化监听器
   */
  addHistoryChangeListener(listener: () => void): void {
    this.historyChangeListeners.add(listener);
  }
  
  /**
   * 移除历史变化监听器
   */
  removeHistoryChangeListener(listener: () => void): void {
    this.historyChangeListeners.delete(listener);
  }
  
  /**
   * 通知历史变化
   */
  private notifyHistoryChange(): void {
    this.historyChangeListeners.forEach(listener => {
      try {
        listener();
      } catch (error) {
        Zotero.logError(error);
      }
    });
  }
  
  /**
   * 销毁
   */
  destroy(): void {
    try {
      // 恢复原始方法
      const Zotero_Tabs = this.getZoteroTabs();
      if (this.originalUndoClose && Zotero_Tabs) {
        Zotero_Tabs.undoClose = this.originalUndoClose;
      }
    } catch (error) {
      // 忽略错误，可能窗口已经关闭
    }
    
    this.historyChangeListeners.clear();
  }
}