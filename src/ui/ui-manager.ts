/**
 * UI 管理器
 * 负责管理所有用户界面组件
 */

import { ClosedTabsManager } from "../managers/closed-tabs-manager";
import { NoteAssociationSystem } from "../managers/note-association-system";
import { HistoryService } from "../services/history-service";
import { MainPanel } from "./components/main-panel";
import { ToolbarButton } from "./components/toolbar-button";
import { config } from "../../package.json";

export interface UIManagerOptions {
  closedTabsManager: ClosedTabsManager;
  noteAssociationSystem: NoteAssociationSystem;
  historyService: HistoryService;
}

export class UIManager {
  private initialized = false;
  private mainPanel: MainPanel | null = null;
  private toolbarButton: ToolbarButton | null = null;
  private windows = new Set<Window>();

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
      if (win && win.document.readyState === "complete") {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
      retries++;
    }
    throw new Error("Main window not ready");
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
        this.toolbarButton = new ToolbarButton(win, {
          onTogglePanel: () => this.toggleMainPanel(),
          onQuickNote: () => this.quickCreateNote(),
          onSearchHistory: () => this.openSearchDialog(),
          onOpenPreferences: () => this.openPreferences(),
          closedTabsManager: this.closedTabsManager,
          historyService: this.historyService,
        });
        await this.toolbarButton.create();
        Zotero.log("[UIManager] Toolbar button created", "info");
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
    const enumerator = Services.wm.getEnumerator("navigator:browser");

    while (enumerator.hasMoreElements()) {
      const win = enumerator.getNext();
      if (win.Zotero) {
        windows.push(win);
      }
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
        --panel-background: var(--material-background);
        --panel-border: var(--material-border-quarternary);
        --text-color: var(--fill-primary);
        --text-secondary: var(--fill-secondary);
      }
      
      /* 暗色模式支持 */
      @media (prefers-color-scheme: dark) {
        .research-navigator-panel {
          --panel-background: #1e1e1e;
          --panel-border: #404040;
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

    doc.head.appendChild(style);
  }

  /**
   * 切换主面板显示/隐藏
   */
  toggleMainPanel(): void {
    if (this.mainPanel) {
      this.mainPanel.toggle();
    }
  }

  /**
   * 快速创建笔记
   */
  async quickCreateNote(): Promise<void> {
    const currentNode = this.historyService.getCurrentNode();
    if (!currentNode) {
      this.showNotification("No active research context", "warning");
      return;
    }

    try {
      const note = await this.noteAssociationSystem.createContextualNote(
        currentNode.id,
        "<p>Quick note created from toolbar</p>",
      );

      // 打开笔记编辑器
      const ZoteroPane = Zotero.getActiveZoteroPane();
      if (ZoteroPane) {
        await ZoteroPane.selectItem(note.id);
        ZoteroPane.openNoteWindow(note.id);
      }

      this.showNotification("Note created successfully", "success");
    } catch (error) {
      Zotero.logError(error);
      this.showNotification("Failed to create note", "error");
    }
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
    setTimeout(() => {
      const notification = notificationBox.currentNotification;
      if (notification && notification.label === message) {
        notificationBox.removeNotification(notification);
      }
    }, 5000);
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
