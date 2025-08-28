/**
 * Research Navigator 核心类
 * 基于开发计划 v2.1 的全新实现
 */

import { ClosedTabsManager } from "../managers/closed-tabs-manager";
import { NoteAssociationSystem } from "../managers/note-association-system";
import { UIManager } from "../ui/ui-manager";
import { DatabaseService } from "../services/database-service";
import { HistoryService } from "../services/history-service";
import { config } from "../../package.json";

export class ResearchNavigator {
  private static instance: ResearchNavigator;
  
  // 核心管理器
  private closedTabsManager!: ClosedTabsManager;
  private noteAssociationSystem!: NoteAssociationSystem;
  private uiManager!: UIManager;
  
  // 核心服务
  private databaseService!: DatabaseService;
  private historyService!: HistoryService;
  
  // 状态
  private initialized = false;
  
  private constructor() {
    // 单例模式
  }
  
  /**
   * 获取单例实例
   */
  static getInstance(): ResearchNavigator {
    if (!ResearchNavigator.instance) {
      ResearchNavigator.instance = new ResearchNavigator();
    }
    return ResearchNavigator.instance;
  }
  
  /**
   * 初始化插件
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      Zotero.log("[Research Navigator] Already initialized", "warn");
      return;
    }
    
    try {
      Zotero.log("[Research Navigator] Starting initialization...", "info");
      
      // 1. 初始化核心服务
      await this.initializeServices();
      
      // 2. 初始化管理器
      await this.initializeManagers();
      
      // 3. 初始化 UI
      await this.initializeUI();
      
      // 4. 注册事件监听器
      this.registerEventListeners();
      
      this.initialized = true;
      
      // 添加调试方法
      this.addDebugMethods();
      
      Zotero.log("[Research Navigator] Initialization completed successfully", "info");
    } catch (error) {
      Zotero.logError(error);
      throw new Error(`Failed to initialize Research Navigator: ${error}`);
    }
  }
  
  /**
   * 初始化核心服务
   */
  private async initializeServices(): Promise<void> {
    // 数据库服务
    this.databaseService = new DatabaseService();
    await this.databaseService.initialize();
    
    // 历史服务
    this.historyService = new HistoryService(this.databaseService);
    await this.historyService.initialize();
  }
  
  /**
   * 初始化管理器
   */
  private async initializeManagers(): Promise<void> {
    // 已关闭标签页管理器
    this.closedTabsManager = new ClosedTabsManager(this.historyService);
    await this.closedTabsManager.initialize();
    
    // 笔记关联系统
    this.noteAssociationSystem = new NoteAssociationSystem(
      this.databaseService,
      this.historyService
    );
    await this.noteAssociationSystem.initialize();
  }
  
  /**
   * 初始化 UI
   */
  private async initializeUI(): Promise<void> {
    this.uiManager = new UIManager(
      this.historyService,
      this.closedTabsManager,
      this.noteAssociationSystem
    );
    
    await this.uiManager.initialize();
  }
  
  /**
   * 注册事件监听器
   */
  private registerEventListeners(): void {
    // 监听 Zotero 事件
    const notifierID = Zotero.Notifier.registerObserver({
      notify: async (event: string, type: string, ids: number[] | string[], extraData?: any) => {
        try {
          Zotero.log(`[ResearchNavigator] Event: ${event}, Type: ${type}, IDs: ${ids}`, "info");
          
          // 处理标签页事件
          if (type === "tab") {
            await this.handleTabEvent(event, ids, extraData);
          }
          
          // 处理文献选择事件 - 这是主要的历史记录触发器
          if (type === "item" && event === "select") {
            await this.handleItemSelect(ids);
          }
          
          // 处理笔记事件
          if (type === "item" && event === "add") {
            await this.handleItemEvent(event, ids);
          }
        } catch (error) {
          Zotero.logError(`Error handling ${type} ${event}: ${error}`);
        }
      }
    }, ["tab", "item"], "ResearchNavigator");
    
    // 保存 notifier ID 以便清理
    this.notifierID = notifierID;
    
    // 另外添加一个定时器来监听 ZoteroPane 的选择变化
    this.setupSelectionListener();
  }
  
  /**
   * 设置选择监听器（备用方案）
   */
  private setupSelectionListener(): void {
    const win = Zotero.getMainWindow();
    if (!win || !win.ZoteroPane) {
      Zotero.log("[ResearchNavigator] ZoteroPane not available yet, retrying...", "info");
      win.setTimeout(() => this.setupSelectionListener(), 1000);
      return;
    }
    
    // 方法1：监听 itemsView 的选择变化
    if (win.ZoteroPane.itemsView) {
      // 保存上次选择的项目ID
      let lastSelectedId: number | null = null;
      
      // 定期检查选择变化
      this.selectionCheckInterval = win.setInterval(() => {
        try {
          const selected = win.ZoteroPane.itemsView.getSelectedItems();
          if (selected && selected.length > 0) {
            const currentId = selected[0].id;
            if (currentId !== lastSelectedId) {
              lastSelectedId = currentId;
              const item = selected[0];
              Zotero.log(`[ResearchNavigator] Item selected (detected): ${currentId}, Type: ${item.itemType}, Title: ${item.getField('title')}`, "info");
              this.handleItemSelect([currentId]).catch(error => {
                Zotero.logError(`[ResearchNavigator] Error handling selection: ${error}`);
              });
            }
          }
        } catch (error) {
          // 忽略错误，可能是视图还未准备好
        }
      }, 500); // 每500ms检查一次
    }
    
    // 方法2：保存原始的 selectItem 方法
    const originalSelectItem = win.ZoteroPane.selectItem;
    
    // 重写 selectItem 方法
    win.ZoteroPane.selectItem = async (itemID: number, ...args: any[]) => {
      // 调用原始方法
      const result = await originalSelectItem.call(win.ZoteroPane, itemID, ...args);
      
      // 记录历史
      try {
        Zotero.log(`[ResearchNavigator] Item selected via selectItem: ${itemID}`, "info");
        await this.handleItemSelect([itemID]);
      } catch (error) {
        Zotero.logError(`[ResearchNavigator] Error handling selection: ${error}`);
      }
      
      return result;
    };
    
    Zotero.log("[ResearchNavigator] Selection listener setup completed", "info");
  }
  
  private selectionCheckInterval?: number;
  
  private notifierID?: string;
  
  /**
   * 处理标签页事件
   */
  private async handleTabEvent(event: string, ids: number[] | string[], extraData?: any): Promise<void> {
    if (event === "close") {
      // 标签页关闭时，更新已关闭标签页历史
      await this.closedTabsManager.handleTabClose(ids);
    } else if (event === "select") {
      // 标签页切换时，更新当前历史节点
      await this.historyService.handleTabSelect(ids[0]);
    }
  }
  
  /**
   * 处理文献选择事件
   */
  private async handleItemSelect(ids: number[] | string[]): Promise<void> {
    if (ids.length === 0) return;
    
    // 获取选中的第一个项目
    const itemId = Number(ids[0]);
    const item = await Zotero.Items.getAsync(itemId);
    
    if (!item) return;
    
    // 只记录常规文献项目和附件，跳过独立笔记
    if (item.isNote() && item.isTopLevelItem()) {
      Zotero.log(`[Research Navigator] Skipping standalone note: ${item.id}`, "info");
      return;
    }
    
    // 记录到历史
    Zotero.log(`[Research Navigator] Item selected: ${item.getField('title')}`, "info");
    
    // 创建或更新历史节点
    const node = await this.historyService.createOrUpdateNode(itemId);
    Zotero.log(`[Research Navigator] History node created: ${JSON.stringify({
      id: node.id,
      title: node.title,
      sessionId: node.sessionId
    })}`, "info");
    
    // 调试：检查当前会话
    const sessions = this.historyService.getAllSessions();
    Zotero.log(`[Research Navigator] Total sessions: ${sessions.length}`, "info");
    if (sessions.length > 0) {
      Zotero.log(`[Research Navigator] Latest session: ${JSON.stringify({
        id: sessions[0].id,
        name: sessions[0].name,
        nodeCount: sessions[0].nodes.length
      })}`, "info");
    }
    
    // 显示通知
    if (this.uiManager) {
      this.uiManager.showNotification(`📚 Added to history: ${item.getField('title')}`);
    }
    
    // 刷新 UI
    if (this.uiManager) {
      this.uiManager.refreshHistoryTab();
    }
  }
  
  /**
   * 处理项目事件（主要是笔记）
   */
  private async handleItemEvent(event: string, ids: number[] | string[]): Promise<void> {
    for (const id of ids) {
      const item = await Zotero.Items.getAsync(Number(id));
      if (item && item.isNote()) {
        // 检查是否需要自动关联
        await this.noteAssociationSystem.checkAutoAssociation(item);
      }
    }
  }
  
  /**
   * 显示/隐藏主面板
   */
  toggleMainPanel(): void {
    this.uiManager.toggleMainPanel();
  }
  
  /**
   * 打开设置
   */
  openPreferences(): void {
    this.uiManager.openPreferences();
  }
  
  /**
   * 关闭插件
   */
  async shutdown(): Promise<void> {
    Zotero.log("[Research Navigator] Shutting down...", "info");
    
    // 注销事件监听器
    if (this.notifierID) {
      Zotero.Notifier.unregisterObserver(this.notifierID);
    }
    
    // 清理选择检查定时器
    if (this.selectionCheckInterval) {
      const win = Zotero.getMainWindow();
      if (win) {
        win.clearInterval(this.selectionCheckInterval);
      }
    }
    
    // 关闭 UI
    if (this.uiManager) {
      await this.uiManager.destroy();
    }
    
    // 关闭管理器
    if (this.closedTabsManager) {
      await this.closedTabsManager.destroy();
    }
    
    if (this.noteAssociationSystem) {
      await this.noteAssociationSystem.destroy();
    }
    
    // 关闭服务
    if (this.historyService) {
      await this.historyService.destroy();
    }
    
    if (this.databaseService) {
      await this.databaseService.destroy();
    }
    
    this.initialized = false;
    Zotero.log("[Research Navigator] Shutdown completed", "info");
  }
  
  // Getters for external access
  get closedTabs(): ClosedTabsManager {
    return this.closedTabsManager;
  }
  
  get noteAssociation(): NoteAssociationSystem {
    return this.noteAssociationSystem;
  }
  
  get ui(): UIManager {
    return this.uiManager;
  }
  
  get history(): HistoryService {
    return this.historyService;
  }
  
  /**
   * 添加调试方法
   */
  private addDebugMethods(): void {
    // 添加到 Zotero 全局对象
    const zotero = Zotero as any;
    
    // 确保对象存在
    if (!zotero.ResearchNavigator) {
      zotero.ResearchNavigator = {};
    }
    
    // 添加调试方法
    Object.assign(zotero.ResearchNavigator, {
      // 获取历史记录统计
      getStats: async () => {
        const sessions = await this.historyService.getAllSessions();
        const totalNodes = sessions.reduce((sum, session) => sum + session.nodeCount, 0);
        const closedTabs = this.closedTabsManager?.getClosedTabs() || [];
        
        const stats = {
          sessions: sessions.length,
          totalNodes,
          closedTabs: closedTabs.length,
          currentSessionId: this.historyService.getCurrentSessionId(),
          latestSession: sessions[0]
        };
        
        Zotero.log("=== Research Navigator Statistics ===", "info");
        Zotero.log(`Sessions: ${stats.sessions}`, "info");
        Zotero.log(`Total History Nodes: ${stats.totalNodes}`, "info");
        Zotero.log(`Closed Tabs: ${stats.closedTabs}`, "info");
        Zotero.log(`Current Session: ${stats.currentSessionId}`, "info");
        if (stats.latestSession) {
          Zotero.log(`Latest Session: ${stats.latestSession.name} (${stats.latestSession.nodeCount} nodes)`, "info");
        }
        Zotero.log("=====================================", "info");
        
        return stats;
      },
      
      // 手动创建测试历史
      createTestHistory: async () => {
        const selected = Zotero.getActiveZoteroPane()?.getSelectedItems();
        if (selected && selected.length > 0) {
          await this.handleItemSelect(selected.map(item => item.id));
          Zotero.log("Created history node for selected item", "info");
        } else {
          Zotero.log("No item selected", "warning");
        }
      },
      
      // 显示/隐藏面板
      togglePanel: () => {
        this.uiManager?.toggleMainPanel();
      },
      
      // 获取当前选中的项目
      getSelectedItems: () => {
        return Zotero.getActiveZoteroPane()?.getSelectedItems();
      },
      
      // 获取导航器实例
      getInstance: () => this,
      
      // 检查初始化状态
      isInitialized: () => this.initialized,
      
      // 获取服务实例
      getServices: () => ({
        database: this.databaseService,
        history: this.historyService,
        closedTabs: this.closedTabsManager,
        noteAssociation: this.noteAssociationSystem,
        ui: this.uiManager
      })
    });
    
    Zotero.log("[Research Navigator] Debug methods added. Use Zotero.ResearchNavigator.getStats() in console", "info");
  }
  
}

// 导出单例获取函数
export function getResearchNavigator(): ResearchNavigator {
  return ResearchNavigator.getInstance();
}