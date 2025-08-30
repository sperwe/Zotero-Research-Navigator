/**
 * UI Manager for Research Navigator
 * 统一管理所有UI组件的创建、更新和销毁
 */

import { UITool, MenuManager, KeyboardManager } from "zotero-plugin-toolkit";
import { config } from "@/config";
import { HistoryTracker } from "./historyTracker";
import { SearchEngine } from "./searchEngine";
import { createHistoryPanel } from "./ui-components/history-panel";
import { createToolbarButton } from "./ui-components/toolbar-button";
import { createToolbarButtonZ7 } from "./ui-components/toolbar-button-z7";
import { registerMenuItems } from "./ui-components/menu-items";
import { UIDebugger } from "./ui-debug";

export class UIManager {
  private historyTracker: HistoryTracker;
  private searchEngine: SearchEngine;
  private initialized = false;
  private uiElements: Map<string, Element> = new Map();
  private windows: Set<Window> = new Set();

  constructor(historyTracker: HistoryTracker, searchEngine: SearchEngine) {
    this.historyTracker = historyTracker;
    this.searchEngine = searchEngine;
  }

  /**
   * 初始化UI
   */
  async initialize(win: Window): Promise<void> {
    if (this.windows.has(win)) {
      addon.ztoolkit.log("UI already initialized for this window");
      return;
    }

    addon.ztoolkit.log("[UIManager] Initialize called");
    addon.ztoolkit.log(`[UIManager] Window location: ${win?.location?.href}`);
    addon.ztoolkit.log(`[UIManager] Already initialized: ${this.initialized}`);
    addon.ztoolkit.log(`[UIManager] Window in set: ${this.windows.has(win)}`);

    // 验证窗口对象
    if (!win || !win.document) {
      addon.ztoolkit.log("[UIManager] Invalid window object provided", "error");
      return;
    }

    try {
      addon.ztoolkit.log("[UIManager] Starting UI component initialization...");

      // 运行诊断（仅在开发模式）
      if (addon.data.env === "development") {
        UIDebugger.runFullDiagnostic(win);
      }

      // 记录窗口
      this.windows.add(win);

      // 逐步初始化各个组件，捕获单个组件的错误
      const initSteps = [
        { name: "toolbar button", fn: () => this.createToolbarButton(win) },
        { name: "history panel", fn: () => this.createHistoryPanel(win) },
        { name: "menu items", fn: () => this.registerMenuItems(win) },
        { name: "shortcuts", fn: () => this.registerShortcuts(win) },
      ];

      for (const step of initSteps) {
        try {
          addon.ztoolkit.log(`[UIManager] Initializing ${step.name}...`);
          await step.fn();
          addon.ztoolkit.log(
            `[UIManager] Successfully initialized ${step.name}`,
          );
        } catch (error) {
          addon.ztoolkit.log(
            `[UIManager] Failed to initialize ${step.name}: ${error}`,
            "warn",
          );
          addon.ztoolkit.log(`[UIManager] Error stack: ${error.stack}`, "warn");
          // 继续初始化其他组件
        }
      }

      // 创建调试浮动按钮（确保至少有一个可见的UI元素）
      this.createDebugButton(win);

      this.initialized = true;
      addon.ztoolkit.log("UI initialization completed");
    } catch (error) {
      addon.ztoolkit.log(`UI initialization failed: ${error}`, "error");
      // 清理已添加的窗口
      this.windows.delete(win);
      throw error;
    }
  }

  /**
   * 创建工具栏按钮
   */
  private async createToolbarButton(win: Window): Promise<void> {
    try {
      // 尝试使用 Zotero 7 兼容的方法
      let button = await createToolbarButtonZ7(win, () => {
        this.toggleHistoryPanel(win);
      });

      // 如果失败，尝试原始方法
      if (!button) {
        addon.ztoolkit.log("Z7 toolbar button failed, trying original method");
        button = await createToolbarButton(win, () => {
          this.toggleHistoryPanel(win);
        });
      }

      if (button) {
        this.uiElements.set(`toolbar-button-${win.location.href}`, button);
        addon.ztoolkit.log("Toolbar button created successfully");
      } else {
        addon.ztoolkit.log(
          "Failed to create toolbar button with both methods",
          "warn",
        );
      }
    } catch (error) {
      addon.ztoolkit.log(`Failed to create toolbar button: ${error}`, "warn");
    }
  }

  /**
   * 创建历史面板
   */
  private async createHistoryPanel(win: Window): Promise<void> {
    try {
      const panel = await createHistoryPanel(
        win,
        this.historyTracker,
        this.searchEngine,
      );

      if (panel) {
        this.uiElements.set(`history-panel-${win.location.href}`, panel);
        addon.ztoolkit.log("History panel created successfully");
      }
    } catch (error) {
      addon.ztoolkit.log(`Failed to create history panel: ${error}`, "warn");
    }
  }

  /**
   * 注册菜单项
   */
  private async registerMenuItems(win: Window): Promise<void> {
    try {
      await registerMenuItems(win, {
        onOpenHistory: () => this.toggleHistoryPanel(win),
        onClearHistory: () => this.clearHistory(),
        onExportHistory: () => this.exportHistory(),
      });

      addon.ztoolkit.log("Menu items registered successfully");
    } catch (error) {
      addon.ztoolkit.log(`Failed to register menu items: ${error}`, "warn");
    }
  }

  /**
   * 注册快捷键
   */
  private async registerShortcuts(win: Window): Promise<void> {
    try {
      // Ctrl/Cmd + Shift + H 打开历史面板
      addon.ztoolkit.Keyboard.register((ev, data) => {
        if (ev.key === "H" && ev.shiftKey && (ev.ctrlKey || ev.metaKey)) {
          ev.preventDefault();
          this.toggleHistoryPanel(win);
          return true;
        }
        return false;
      });

      addon.ztoolkit.log("Keyboard shortcuts registered successfully");
    } catch (error) {
      addon.ztoolkit.log(`Failed to register shortcuts: ${error}`, "warn");
    }
  }

  /**
   * 切换历史面板显示状态
   */
  toggleHistoryPanel(win: Window): void {
    const panelKey = `history-panel-${win.location.href}`;
    let panel = this.uiElements.get(panelKey) as HTMLElement;

    // 如果面板不存在，尝试创建它
    if (!panel) {
      addon.ztoolkit.log(
        "History panel not found in UI elements, attempting to create",
      );
      this.createHistoryPanel(win)
        .then(() => {
          panel = this.uiElements.get(panelKey) as HTMLElement;
          if (panel) {
            panel.style.display = "block";
            this.updateHistoryPanel(win);
          }
        })
        .catch((error) => {
          addon.ztoolkit.log(
            `Failed to create history panel: ${error}`,
            "error",
          );
        });
      return;
    }

    if (panel) {
      const isVisible = panel.style.display !== "none";
      panel.style.display = isVisible ? "none" : "block";

      if (!isVisible) {
        // 面板显示时更新内容
        this.updateHistoryPanel(win);
      }

      addon.ztoolkit.log(`History panel ${isVisible ? "hidden" : "shown"}`);
    }
  }

  /**
   * 更新历史面板内容
   */
  private updateHistoryPanel(win: Window): void {
    const panelKey = `history-panel-${win.location.href}`;
    const panel = this.uiElements.get(panelKey);

    if (panel) {
      // 触发面板更新事件
      const event = new CustomEvent("update-history", {
        detail: {
          history: this.historyTracker.getHistoryTree(),
        },
      });
      panel.dispatchEvent(event);
    }
  }

  /**
   * 清空历史记录
   */
  private async clearHistory(): Promise<void> {
    const ps = Services.prompt;
    const confirmed = ps.confirm(
      null,
      config.addonName,
      "Are you sure you want to clear all history?",
    );

    if (confirmed) {
      this.historyTracker.clearHistory();

      // 更新所有窗口的面板
      this.windows.forEach((win) => this.updateHistoryPanel(win));

      addon.ztoolkit.log("History cleared by user");
    }
  }

  /**
   * 导出历史记录
   */
  private async exportHistory(): Promise<void> {
    try {
      const data = this.historyTracker.exportHistory();
      const json = JSON.stringify(data, null, 2);

      // 使用文件选择器
      const fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(
        Components.interfaces.nsIFilePicker,
      );

      fp.init(
        null,
        "Export Research History",
        Components.interfaces.nsIFilePicker.modeSave,
      );
      fp.appendFilter("JSON Files", "*.json");
      fp.defaultString = `research-history-${new Date().toISOString().split("T")[0]}.json`;

      const result = await new Promise((resolve) => {
        fp.open(resolve);
      });

      if (result === Components.interfaces.nsIFilePicker.returnOK) {
        const file = fp.file;
        Zotero.File.putContents(file, json);

        addon.ztoolkit.log(`History exported to ${file.path}`);
      }
    } catch (error) {
      addon.ztoolkit.log(`Failed to export history: ${error}`, "error");
    }
  }

  /**
   * 销毁UI
   */
  destroy(): void {
    try {
      // 移除所有UI元素
      this.uiElements.forEach((element, key) => {
        try {
          element.remove();
        } catch (e) {
          // 元素可能已经被移除
        }
      });
      this.uiElements.clear();

      // 清空窗口记录
      this.windows.clear();

      // 注销快捷键
      addon.ztoolkit.Keyboard.unregisterAll();

      this.initialized = false;
      addon.ztoolkit.log("UI manager destroyed");
    } catch (error) {
      addon.ztoolkit.log(`Error destroying UI manager: ${error}`, "error");
    }
  }

  /**
   * 获取UI状态
   */
  get isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * 创建调试浮动按钮
   */
  private createDebugButton(win: Window): void {
    try {
      const doc = win.document;

      // 查找 Zotero 主界面
      const zoteroPane =
        doc.getElementById("zotero-pane") || doc.documentElement;

      // 创建浮动按钮
      const button = doc.createElement("button");
      button.id = "research-navigator-debug-button";
      button.textContent = "📚 RN";
      button.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 10000;
        width: 50px;
        height: 50px;
        border-radius: 50%;
        background: #2980b9;
        color: white;
        border: none;
        cursor: pointer;
        font-size: 18px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        transition: all 0.3s ease;
      `;

      button.addEventListener("click", () => {
        addon.ztoolkit.log("Debug button clicked!");
        this.toggleHistoryPanel(win);
      });

      button.addEventListener("mouseenter", () => {
        button.style.transform = "scale(1.1)";
        button.style.background = "#3498db";
      });

      button.addEventListener("mouseleave", () => {
        button.style.transform = "scale(1)";
        button.style.background = "#2980b9";
      });

      zoteroPane.appendChild(button);
      this.uiElements.set(`debug-button-${win.location.href}`, button);
      addon.ztoolkit.log("Debug floating button created successfully");
    } catch (error) {
      addon.ztoolkit.log(`Failed to create debug button: ${error}`, "warn");
    }
  }
}
