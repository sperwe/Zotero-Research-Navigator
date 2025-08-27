import { BasicTool, UITool, ProgressWindowHelper } from "zotero-plugin-toolkit";
import { HistoryTracker } from "./modules/historyTracker";
import { SearchEngine } from "./modules/searchEngine";
import { UIManager } from "./modules/ui-manager";
import { config } from "../package.json";

// 模块管理器
class ModuleManager {
  private historyTracker?: HistoryTracker;
  private searchEngine?: SearchEngine;
  private uiManager?: UIManager;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // 初始化核心模块
      this.historyTracker = new HistoryTracker();
      this.searchEngine = new SearchEngine(this.historyTracker);
      this.uiManager = new UIManager(this.historyTracker, this.searchEngine);
      
      this.initialized = true;
      addon.ztoolkit.log("Core modules initialized successfully");
    } catch (error) {
      addon.ztoolkit.log(`Failed to initialize modules: ${error}`, 'error');
      throw error;
    }
  }

  async initializeUI(win: Window): Promise<void> {
    if (!this.uiManager) {
      throw new Error("UI Manager not initialized");
    }
    await this.uiManager.initialize(win);
  }

  destroy(): void {
    if (this.historyTracker) {
      this.historyTracker.destroy();
    }
    if (this.uiManager) {
      this.uiManager.destroy();
    }
    this.initialized = false;
  }

  get modules() {
    return {
      historyTracker: this.historyTracker,
      searchEngine: this.searchEngine,
      uiManager: this.uiManager
    };
  }
}

// 单例模块管理器
const moduleManager = new ModuleManager();

/**
 * 插件启动钩子
 */
async function onStartup() {
  addon.ztoolkit.log("Starting Research Navigator...");

  try {
    // 等待 Zotero 完全初始化
    await BasicTool.waitForZotero();
    
    // 初始化模块
    await moduleManager.initialize();
    
    // 标记插件已初始化
    addon.data.initialized = true;
    addon.ztoolkit.log("Research Navigator startup completed");
  } catch (error) {
    addon.ztoolkit.log(`Startup failed: ${error}`, 'error');
    throw error;
  }
}

/**
 * 主窗口加载钩子
 */
async function onMainWindowLoad(win: Window) {
  addon.ztoolkit.log("Main window loaded");
  
  try {
    // 确保模块已初始化
    await moduleManager.initialize();
    
    // 初始化UI
    await moduleManager.initializeUI(win);
    
    // 显示加载成功提示
    showWelcomeMessage(win);
  } catch (error) {
    addon.ztoolkit.log(`Failed to initialize UI: ${error}`, 'error');
    
    // 显示错误提示
    new ProgressWindowHelper(config.addonName)
      .createLine({
        text: "Failed to initialize Research Navigator",
        type: "error"
      })
      .show();
  }
}

/**
 * 主窗口卸载钩子
 */
async function onMainWindowUnload(win: Window) {
  addon.ztoolkit.log("Main window unloading");
  
  // UI 清理会在 UIManager 中自动处理
}

/**
 * 插件关闭钩子
 */
function onShutdown() {
  addon.ztoolkit.log("Shutting down Research Navigator");
  
  try {
    // 清理模块
    moduleManager.destroy();
    
    // 标记插件已关闭
    addon.data.alive = false;
    addon.data.initialized = false;
    
    // 清理工具包
    addon.ztoolkit.unregisterAll();
    
    addon.ztoolkit.log("Shutdown completed");
  } catch (error) {
    console.error("Error during shutdown:", error);
  }
}

/**
 * 偏好设置窗口事件
 */
function onPrefsEvent(type: string, data: { window?: Window }) {
  switch (type) {
    case "load":
      if (data.window) {
        addon.ztoolkit.log("Preferences window loaded");
        // 可以在这里初始化偏好设置UI
      }
      break;
  }
}

/**
 * 显示欢迎消息
 */
function showWelcomeMessage(win: Window) {
  const Zotero = BasicTool.getZotero();
  
  // 只在开发模式下显示
  if (addon.data.env === "development") {
    win.setTimeout(() => {
      const progressWindow = new ProgressWindowHelper(config.addonName);
      progressWindow
        .createLine({
          text: "Research Navigator loaded successfully!",
          type: "success",
          progress: 100
        })
        .show();
      
      // 3秒后自动关闭
      win.setTimeout(() => progressWindow.close(), 3000);
    }, 1000);
  }
}

export default {
  onStartup,
  onMainWindowLoad,
  onMainWindowUnload,
  onShutdown,
  onPrefsEvent,
};