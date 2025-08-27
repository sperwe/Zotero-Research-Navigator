/**
 * UI Manager for Research Navigator
 * 统一管理所有UI组件的创建、更新和销毁
 */

import { UITool, MenuManager, KeyboardManager } from "zotero-plugin-toolkit";
import { config } from "../../package.json";
import { HistoryTracker } from "./historyTracker";
import { SearchEngine } from "./searchEngine";
import { createHistoryPanel } from "./ui-components/history-panel";
import { createToolbarButton } from "./ui-components/toolbar-button";
import { registerMenuItems } from "./ui-components/menu-items";

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

    // 验证窗口对象
    if (!win || !win.document) {
      addon.ztoolkit.log("Invalid window object provided", 'error');
      return;
    }

    try {
      addon.ztoolkit.log("Initializing UI components...");
      
      // 记录窗口
      this.windows.add(win);
      
      // 逐步初始化各个组件，捕获单个组件的错误
      const initSteps = [
        { name: "toolbar button", fn: () => this.createToolbarButton(win) },
        { name: "history panel", fn: () => this.createHistoryPanel(win) },
        { name: "menu items", fn: () => this.registerMenuItems(win) },
        { name: "shortcuts", fn: () => this.registerShortcuts(win) }
      ];
      
      for (const step of initSteps) {
        try {
          await step.fn();
          addon.ztoolkit.log(`Successfully initialized ${step.name}`);
        } catch (error) {
          addon.ztoolkit.log(`Failed to initialize ${step.name}: ${error}`, 'warn');
          // 继续初始化其他组件
        }
      }
      
      this.initialized = true;
      addon.ztoolkit.log("UI initialization completed");
    } catch (error) {
      addon.ztoolkit.log(`UI initialization failed: ${error}`, 'error');
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
      const button = await createToolbarButton(win, () => {
        this.toggleHistoryPanel(win);
      });
      
      if (button) {
        this.uiElements.set(`toolbar-button-${win.location.href}`, button);
        addon.ztoolkit.log("Toolbar button created successfully");
      }
    } catch (error) {
      addon.ztoolkit.log(`Failed to create toolbar button: ${error}`, 'warn');
    }
  }

  /**
   * 创建历史面板
   */
  private async createHistoryPanel(win: Window): Promise<void> {
    try {
      const panel = await createHistoryPanel(win, this.historyTracker, this.searchEngine);
      
      if (panel) {
        this.uiElements.set(`history-panel-${win.location.href}`, panel);
        addon.ztoolkit.log("History panel created successfully");
      }
    } catch (error) {
      addon.ztoolkit.log(`Failed to create history panel: ${error}`, 'warn');
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
      addon.ztoolkit.log(`Failed to register menu items: ${error}`, 'warn');
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
      addon.ztoolkit.log(`Failed to register shortcuts: ${error}`, 'warn');
    }
  }

  /**
   * 切换历史面板显示状态
   */
  toggleHistoryPanel(win: Window): void {
    const panelKey = `history-panel-${win.location.href}`;
    const panel = this.uiElements.get(panelKey) as HTMLElement;
    
    if (panel) {
      const isVisible = panel.style.display !== "none";
      panel.style.display = isVisible ? "none" : "block";
      
      if (!isVisible) {
        // 面板显示时更新内容
        this.updateHistoryPanel(win);
      }
      
      addon.ztoolkit.log(`History panel ${isVisible ? 'hidden' : 'shown'}`);
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
      const event = new CustomEvent('update-history', {
        detail: {
          history: this.historyTracker.getHistoryTree()
        }
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
      "Are you sure you want to clear all history?"
    );
    
    if (confirmed) {
      this.historyTracker.clearHistory();
      
      // 更新所有窗口的面板
      this.windows.forEach(win => this.updateHistoryPanel(win));
      
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
      const fp = Components.classes["@mozilla.org/filepicker;1"]
        .createInstance(Components.interfaces.nsIFilePicker);
      
      fp.init(null, "Export Research History", Components.interfaces.nsIFilePicker.modeSave);
      fp.appendFilter("JSON Files", "*.json");
      fp.defaultString = `research-history-${new Date().toISOString().split('T')[0]}.json`;
      
      const result = await new Promise((resolve) => {
        fp.open(resolve);
      });
      
      if (result === Components.interfaces.nsIFilePicker.returnOK) {
        const file = fp.file;
        Zotero.File.putContents(file, json);
        
        addon.ztoolkit.log(`History exported to ${file.path}`);
      }
    } catch (error) {
      addon.ztoolkit.log(`Failed to export history: ${error}`, 'error');
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
      addon.ztoolkit.log(`Error destroying UI manager: ${error}`, 'error');
    }
  }

  /**
   * 获取UI状态
   */
  get isInitialized(): boolean {
    return this.initialized;
  }
}