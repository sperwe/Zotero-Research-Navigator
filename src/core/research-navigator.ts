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
    this.uiManager = new UIManager({
      closedTabsManager: this.closedTabsManager,
      noteAssociationSystem: this.noteAssociationSystem,
      historyService: this.historyService
    });
    
    await this.uiManager.initialize();
  }
  
  /**
   * 注册事件监听器
   */
  private registerEventListeners(): void {
    // 监听 Zotero 事件
    const notifierID = Zotero.Notifier.registerObserver({
      notify: async (event: string, type: string, ids: number[] | string[], extraData?: any) => {
        // 处理标签页事件
        if (type === "tab") {
          await this.handleTabEvent(event, ids, extraData);
        }
        
        // 处理笔记事件
        if (type === "item" && event === "add") {
          await this.handleItemEvent(event, ids);
        }
      }
    }, ["tab", "item"], "ResearchNavigator");
    
    // 保存 notifier ID 以便清理
    this.notifierID = notifierID;
  }
  
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
}

// 导出单例获取函数
export function getResearchNavigator(): ResearchNavigator {
  return ResearchNavigator.getInstance();
}