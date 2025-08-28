/**
 * UI 管理器
 * 负责管理所有用户界面组件
 */

import { ClosedTabsManager } from "../managers/closed-tabs-manager";
import { NoteAssociationSystem } from "../managers/note-association-system";
import { HistoryService } from "../services/history-service";

export interface UIManagerOptions {
  closedTabsManager: ClosedTabsManager;
  noteAssociationSystem: NoteAssociationSystem;
  historyService: HistoryService;
}

export class UIManager {
  private initialized = false;
  
  constructor(private options: UIManagerOptions) {}
  
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    // TODO: 实现 UI 初始化
    // 1. 创建工具栏按钮
    // 2. 创建主面板
    // 3. 注册事件监听器
    
    this.initialized = true;
    Zotero.log("[UIManager] Initialized", "info");
  }
  
  /**
   * 切换主面板显示/隐藏
   */
  toggleMainPanel(): void {
    // TODO: 实现面板切换
    Zotero.log("[UIManager] Toggle main panel", "info");
  }
  
  /**
   * 打开设置界面
   */
  openPreferences(): void {
    // TODO: 实现设置界面
    Zotero.log("[UIManager] Open preferences", "info");
  }
  
  async destroy(): Promise<void> {
    // TODO: 清理 UI 组件
    this.initialized = false;
  }
}