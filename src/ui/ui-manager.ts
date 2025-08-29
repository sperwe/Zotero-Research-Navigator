/**
 * UI 管理器
 * 负责管理所有用户界面组件
 */

import { ClosedTabsManager } from "../managers/closed-tabs-manager";
import { NoteAssociationSystem } from "../managers/note-association-system";
import { HistoryService } from "../services/history-service";
import { MainPanel } from "./components/main-panel";
import { ToolbarButton } from "./components/toolbar-button";
import { ToolbarButtonV2 } from "./components/toolbar-button-v2";
import { ToolbarButtonZotero7 } from "./components/toolbar-button-zotero7";
import { SidebarManager } from "./sidebar-manager";
import { QuickNoteButton } from "./components/quick-note-button";
import { config } from "../../package.json";

export interface UIManagerOptions {
  closedTabsManager: ClosedTabsManager;
  noteAssociationSystem: NoteAssociationSystem;
  historyService: HistoryService;
}

export class UIManager {
  private initialized = false;
  private mainPanel: MainPanel | null = null;
  private sidebarManager: SidebarManager | null = null;
  private toolbarButton: ToolbarButton | null = null;
  private quickNoteButton: QuickNoteButton | null = null;
  private windows = new Set<Window>();
  private displayMode: "floating" | "sidebar" = "floating";

  constructor(
    private historyService: HistoryService,
    private closedTabsManager: ClosedTabsManager,
    private noteAssociationSystem: NoteAssociationSystem,
  ) {
    Zotero.log("[UIManager] Constructor called", "info");
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      Zotero.log("[UIManager] Starting initialization...", "info");

      // 等待主窗口加载
      await this.waitForMainWindow();
      Zotero.log("[UIManager] Main window ready", "info");

      // 初始化所有已打开的窗口
      const windows = this.getAllWindows();
      Zotero.log(`[UIManager] Found ${windows.length} windows`, "info");

      for (const win of windows) {
        await this.initializeWindow(win);
      }

      // 监听新窗口
      this.registerWindowListener();

      this.initialized = true;
      Zotero.log("[UIManager] Initialization completed", "info");
    } catch (error) {
      Zotero.logError(error);
      throw new Error(`Failed to initialize UI: ${error}`);
    }
  }

  /**
   * 等待主窗口加载
   */
  private async waitForMainWindow(): Promise<void> {
    let retries = 0;
    while (retries < 30) {
      // 最多等待3秒
      const win = Zotero.getMainWindow();
      if (win && win.document) {
        // 降低要求，只要有 document 就继续
        Zotero.log(`[UIManager] Window state: readyState=${win.document.readyState}, hasBody=${!!win.document.body}`, "info");
        return;
      }
      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });
      retries++;
    }
    
    // 最后的尝试
    const win = Zotero.getMainWindow();
    if (win) {
      Zotero.log("[UIManager] Main window exists but document not ready, proceeding anyway", "warn");
      return;
    }
    
    throw new Error("Main window not available after 3 seconds");
  }

  /**
   * 初始化窗口
   */
  private async initializeWindow(win: Window): Promise<void> {
    if (this.windows.has(win)) return;

    Zotero.log("[UIManager] Initializing window...", "info");
    this.windows.add(win);

    try {
      // 创建工具栏按钮
      if (!this.toolbarButton) {
        Zotero.log("[UIManager] Creating toolbar button...", "info");
        
        // 尝试使用 Zotero 7 专用的工具栏按钮
        try {
          const buttonZ7 = new ToolbarButtonZotero7(win, {
            onPanelToggle: () => this.toggleDisplay(),
            onModeChange: (mode) => this.setDisplayMode(mode)
          });
          await buttonZ7.create();
          Zotero.log("[UIManager] Toolbar button Zotero7 created successfully", "info");
          // 保存引用以便清理
          (this as any)._buttonZ7 = buttonZ7;
        } catch (z7Error) {
          Zotero.log("[UIManager] Failed to create Zotero7 button, trying V2: " + z7Error, "warn");
          
          // 尝试使用 V2 版本
          try {
            const buttonV2 = new ToolbarButtonV2(win);
            await buttonV2.create();
            Zotero.log("[UIManager] Toolbar button V2 created successfully", "info");
          } catch (v2Error) {
            Zotero.log("[UIManager] Failed to create V2 button, trying V1: " + v2Error, "warn");
            
            // 回退到原版本
            this.toolbarButton = new ToolbarButton(win, {
              onTogglePanel: () => this.toggleMainPanel(),
              onQuickNote: () => {}, // 不再使用工具栏的快速笔记
              onSearchHistory: () => this.openSearchDialog(),
              onOpenPreferences: () => this.openPreferences(),
              closedTabsManager: this.closedTabsManager,
              historyService: this.historyService,
            });
            await this.toolbarButton.create();
            Zotero.log("[UIManager] Toolbar button V1 created", "info");
          }
        }
      }
      
      // 初始化快速笔记浮动按钮
      if (!this.quickNoteButton) {
        Zotero.log("[UIManager] Creating quick note button...", "info");
        this.quickNoteButton = new QuickNoteButton(
          win,
          this.noteAssociationSystem,
          this.historyService
        );
        await this.quickNoteButton.initialize();
        Zotero.log("[UIManager] Quick note button created", "info");
      }

      // 创建主面板
      if (!this.mainPanel) {
        Zotero.log("[UIManager] Creating main panel...", "info");
        this.mainPanel = new MainPanel(win, {
          closedTabsManager: this.closedTabsManager,
          noteAssociationSystem: this.noteAssociationSystem,
          historyService: this.historyService,
        });
        await this.mainPanel.create();
        Zotero.log("[UIManager] Main panel created", "info");
      }
      
      // 初始化侧边栏
      await this.initializeSidebar(win);
      
      // 恢复显示模式
      const savedMode = Zotero.Prefs.get("extensions.zotero.researchnavigator.displayMode") as string;
      if (savedMode === "sidebar") {
        this.displayMode = "sidebar";
      }

      // 添加样式
      this.injectStyles(win);
      Zotero.log("[UIManager] Window initialization completed", "info");
    } catch (error) {
      Zotero.logError(error);
      throw new Error(`Failed to initialize window: ${error}`);
    }
  }

  /**
   * 获取所有窗口
   */
  private getAllWindows(): Window[] {
    const windows: Window[] = [];
    
    // 首先确保主窗口被包含
    const mainWindow = Zotero.getMainWindow();
    if (mainWindow) {
      windows.push(mainWindow);
      Zotero.log("[UIManager] Added main window", "info");
    }
    
    // 然后检查其他窗口
    try {
      const enumerator = Services.wm.getEnumerator("navigator:browser");
      while (enumerator.hasMoreElements()) {
        const win = enumerator.getNext();
        if (win && win.Zotero && win !== mainWindow) {
          windows.push(win);
        }
      }
    } catch (e) {
      Zotero.log("[UIManager] Error enumerating windows: " + e, "warn");
    }

    return windows;
  }

  /**
   * 注册窗口监听器
   */
  private registerWindowListener(): void {
    const listener = {
      onOpenWindow: (xulWindow: any) => {
        const win = xulWindow
          .QueryInterface(Ci.nsIInterfaceRequestor)
          .getInterface(Ci.nsIDOMWindow);

        win.addEventListener(
          "load",
          async () => {
            if (win.Zotero) {
              await this.initializeWindow(win);
            }
          },
          { once: true },
        );
      },

      onCloseWindow: (xulWindow: any) => {
        const win = xulWindow
          .QueryInterface(Ci.nsIInterfaceRequestor)
          .getInterface(Ci.nsIDOMWindow);
        this.windows.delete(win);
      },
    };

    Services.wm.addListener(listener);

    // 保存监听器引用以便清理
    (this as any)._windowListener = listener;
  }

  /**
   * 注入样式
   */
  private injectStyles(win: Window): void {
    const doc = win.document;

    // 检查是否已经注入
    if (doc.getElementById("research-navigator-styles")) return;

    const style = doc.createElement("style");
    style.id = "research-navigator-styles";
    style.textContent = `
      /* Research Navigator 全局样式 */
      .research-navigator-button {
        list-style-image: url(chrome://researchnavigator/content/icons/icon.png);
      }
      
      .research-navigator-panel {
        --panel-background: rgba(255, 255, 255, 0.98);
        --panel-border: rgba(0, 0, 0, 0.12);
        --text-color: #333333;
        --text-secondary: #666666;
        --hover-background: rgba(0, 0, 0, 0.04);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
      }
      
      /* 暗色模式支持 */
      @media (prefers-color-scheme: dark) {
        .research-navigator-panel {
          --panel-background: rgba(30, 30, 30, 0.95);
          --panel-border: rgba(255, 255, 255, 0.15);
          --text-color: #e0e0e0;
          --text-secondary: #a0a0a0;
          --hover-background: rgba(255, 255, 255, 0.08);
        }
      }
      
      /* 动画 */
      @keyframes slideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      
      .research-navigator-panel.animate-in {
        animation: slideIn 0.3s ease-out;
      }
    `;

    if (doc.head) {
      doc.head.appendChild(style);
    } else {
      // 如果 head 还不存在，稍后重试
      const root = doc.documentElement || doc;
      root.appendChild(style);
    }
  }

  /**
   * 初始化侧边栏
   */
  private async initializeSidebar(win: Window): Promise<void> {
    if (!this.sidebarManager) {
      this.sidebarManager = new SidebarManager(win, () => {
        // 提供内容给侧边栏
        if (this.mainPanel) {
          const content = this.mainPanel.getContent();
          return content;
        }
        return null;
      });
      
      await this.sidebarManager.initialize();
      
      // 监听模式切换事件
      win.addEventListener("research-navigator-toggle-mode", () => {
        this.toggleDisplayMode();
      });
    }
  }
  
  /**
   * 切换显示
   */
  toggleDisplay(): void {
    if (this.displayMode === "floating") {
      this.toggleMainPanel();
    } else {
      this.toggleSidebar();
    }
  }
  
  /**
   * 切换主面板显示/隐藏
   */
  toggleMainPanel(): void {
    Zotero.log("[UIManager] toggleMainPanel called", "info");
    if (this.mainPanel) {
      Zotero.log("[UIManager] Main panel exists, toggling...", "info");
      this.mainPanel.toggle();
    } else {
      Zotero.log("[UIManager] Main panel is null!", "error");
      // 尝试创建面板
      const win = Zotero.getMainWindow();
      if (win && !this.mainPanel) {
        this.mainPanel = new MainPanel(win, {
          closedTabsManager: this.closedTabsManager,
          noteAssociationSystem: this.noteAssociationSystem,
          historyService: this.historyService,
        });
        this.mainPanel.create().then(() => {
          Zotero.log("[UIManager] Main panel created on demand", "info");
          this.mainPanel.show();
        }).catch(err => {
          Zotero.logError(`[UIManager] Failed to create panel on demand: ${err}`);
        });
      }
    }
  }
  
  /**
   * 切换侧边栏显示
   */
  toggleSidebar(): void {
    if (!this.sidebarManager) return;
    
    this.sidebarManager.toggle();
  }
  
  /**
   * 设置显示模式
   */
  setDisplayMode(mode: "floating" | "sidebar"): void {
    if (this.displayMode === mode) return;
    
    Zotero.log(`[UIManager] Switching display mode to: ${mode}`, "info");
    
    // 隐藏当前模式
    if (this.displayMode === "floating" && this.mainPanel) {
      this.mainPanel.hide();
    } else if (this.displayMode === "sidebar" && this.sidebarManager) {
      this.sidebarManager.hide();
    }
    
    // 切换模式
    this.displayMode = mode;
    
    // 保存偏好
    Zotero.Prefs.set("extensions.zotero.researchnavigator.displayMode", mode);
    
    // 显示新模式
    if (mode === "floating" && this.mainPanel) {
      this.mainPanel.show();
    } else if (mode === "sidebar" && this.sidebarManager) {
      this.sidebarManager.show();
    }
  }
  
  /**
   * 切换显示模式
   */
  toggleDisplayMode(): void {
    const newMode = this.displayMode === "floating" ? "sidebar" : "floating";
    this.setDisplayMode(newMode);
  }

  /**
   * 快速创建笔记（已废弃）
   */
  async quickCreateNote(): Promise<void> {
    // 快速笔记功能已移至浮动按钮
    this.showNotification("Please use the floating button in the bottom-right corner", "info");
  }

  /**
   * 打开搜索对话框
   */
  openSearchDialog(): void {
    // TODO: 实现搜索对话框
    this.showNotification("Search dialog coming soon", "info");
  }

  /**
   * 打开设置界面
   */
  openPreferences(): void {
    const win = Zotero.getMainWindow();
    if (win) {
      win.openDialog(
        "chrome://researchnavigator/content/preferences.xul",
        "research-navigator-preferences",
        "chrome,dialog,centerscreen",
      );
    }
  }

  /**
   * 显示通知
   */
  showNotification(
    message: string,
    type: "success" | "warning" | "error" | "info" = "info",
  ): void {
    const win = Zotero.getMainWindow();
    if (!win) return;

    const notificationBox = win.document.getElementById(
      "zotero-notification-box",
    );
    if (!notificationBox) return;

    const priority = {
      success: notificationBox.PRIORITY_INFO_HIGH,
      warning: notificationBox.PRIORITY_WARNING_MEDIUM,
      error: notificationBox.PRIORITY_CRITICAL_HIGH,
      info: notificationBox.PRIORITY_INFO_LOW,
    }[type];

    notificationBox.appendNotification(
      message,
      `research-navigator-${Date.now()}`,
      null,
      priority,
      [],
    );

    // 自动关闭通知
    if (win && win.setTimeout) {
      win.setTimeout(() => {
        const notification = notificationBox.currentNotification;
        if (notification && notification.label === message) {
          notificationBox.removeNotification(notification);
        }
      }, 5000);
    }
  }
  
  /**
   * 刷新历史标签页
   */
  refreshHistoryTab(): void {
    if (this.mainPanel) {
      this.mainPanel.refreshHistoryTab();
      Zotero.log("[UIManager] Refreshing history tab", "info");
    }
  }

  async destroy(): Promise<void> {
    // 移除窗口监听器
    if ((this as any)._windowListener) {
      Services.wm.removeListener((this as any)._windowListener);
    }

    // 清理组件
    if (this.toolbarButton) {
      this.toolbarButton.destroy();
      this.toolbarButton = null;
    }
    
    if (this.quickNoteButton) {
      this.quickNoteButton.destroy();
      this.quickNoteButton = null;
    }

    if (this.mainPanel) {
      this.mainPanel.destroy();
      this.mainPanel = null;
    }

    // 清理样式
    for (const win of this.windows) {
      const style = win.document.getElementById("research-navigator-styles");
      if (style) {
        style.remove();
      }
    }

    this.windows.clear();
    this.initialized = false;
  }
}
