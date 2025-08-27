import { BasicTool, UITool, ProgressWindowHelper } from "zotero-plugin-toolkit";
import { HistoryTracker } from "./modules/historyTracker";
import { SearchEngine } from "./modules/searchEngine";
import { UIManager } from "./modules/ui-manager";
import { config } from "../package.json";
import { diagnostic } from "./utils/diagnostic";
import { safeLoader } from "./bootstrap/safe-loader";

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
  // 使用安全加载器确保只初始化一次
  return safeLoader.initialize(async () => {
    diagnostic.clear();
    diagnostic.log("Plugin startup", true, { phase: "begin" });

    try {
      // 验证环境
      const envValid = await diagnostic.validateEnvironment();
      if (!envValid) {
        throw new Error("Environment validation failed");
      }

      // 使用安全加载器等待 Zotero
      diagnostic.log("Waiting for Zotero", true, { phase: "wait" });
      const zoteroReady = await safeLoader.waitForZotero(30000);
      
      if (!zoteroReady) {
        throw new Error("Zotero initialization timeout");
      }
      
      // 等待 Schema 更新完成
      if (Zotero.Schema && Zotero.Schema.schemaUpdatePromise) {
        try {
          await Zotero.Schema.schemaUpdatePromise;
          diagnostic.log("Schema update completed", true, { phase: "schema" });
        } catch (e) {
          diagnostic.log("Schema update failed", false, { 
            phase: "schema",
            error: e.message 
          });
          // 继续执行，Schema 更新失败不应阻止插件加载
        }
      }
      
      diagnostic.log("Zotero ready", true, { 
        version: Zotero.version,
        platform: Zotero.platform,
        locale: Zotero.locale
      });
      
      // 初始化模块
      diagnostic.log("Initializing modules", true, { phase: "modules" });
      await diagnostic.measurePerformance("Module initialization", async () => {
        await moduleManager.initialize();
      });
      
      // 标记插件已初始化
      addon.data.initialized = true;
      diagnostic.log("Plugin startup completed", true, { 
        phase: "complete",
        totalTime: `${Date.now()}ms`
      });
      
      addon.ztoolkit.log("Research Navigator startup completed");
    } catch (error) {
      diagnostic.log("Plugin startup failed", false, { 
        phase: "error",
        error: error.message,
        stack: error.stack
      }, error);
      addon.ztoolkit.log(`Startup failed: ${error}`, 'error');
      
      // 生成诊断报告
      const report = diagnostic.generateReport();
      addon.ztoolkit.log(`Diagnostic report: ${report}`);
      
      throw error;
    }
  });
}

/**
 * 主窗口加载钩子
 */
async function onMainWindowLoad(win: Window) {
  diagnostic.log("Main window load event", true, { phase: "begin" });
  
  // 验证窗口对象
  const windowValid = diagnostic.validateWindow(win);
  if (!windowValid) {
    diagnostic.log("Window validation failed", false, { phase: "validation" });
    return;
  }
  
  // 等待窗口完全加载
  if (win.document.readyState !== "complete") {
    diagnostic.log("Waiting for window load", true, { readyState: win.document.readyState });
    await new Promise<void>((resolve) => {
      win.addEventListener("load", () => {
        diagnostic.log("Window load event fired", true, { readyState: "complete" });
        resolve();
      }, { once: true });
    });
  }
  
  // 等待 Zotero UI 元素
  diagnostic.log("Waiting for Zotero UI", true, { phase: "ui-wait" });
  await new Promise<void>((resolve) => {
    let attempts = 0;
    const checkUI = () => {
      attempts++;
      const doc = win.document;
      
      // 检查关键 UI 元素
      const hasItemsTree = doc.getElementById("zotero-items-tree") !== null;
      const hasPane = doc.getElementById("zotero-pane") !== null;
      
      if (hasItemsTree && hasPane) {
        diagnostic.log("Zotero UI ready", true, { 
          attempts,
          hasItemsTree,
          hasPane 
        });
        resolve();
      } else if (attempts > 50) { // 5秒超时
        diagnostic.log("Zotero UI timeout", false, { 
          attempts,
          hasItemsTree,
          hasPane 
        });
        resolve();
      } else {
        win.setTimeout(checkUI, 100);
      }
    };
    checkUI();
  });
  
  try {
    // 确保模块已初始化
    await moduleManager.initialize();
    
    // 检查是否是主 Zotero 窗口
    if (win.location.href !== "chrome://zotero/content/zotero.xhtml") {
      diagnostic.log("Not main window", true, { 
        location: win.location.href,
        action: "skip" 
      });
      return;
    }
    
    // 验证 UI 元素
    diagnostic.validateUIElements(win.document);
    
    // 初始化UI
    diagnostic.log("Initializing UI", true, { phase: "ui-init" });
    await diagnostic.measurePerformance("UI initialization", async () => {
      await moduleManager.initializeUI(win);
    });
    
    // 显示加载成功提示（仅在开发模式）
    if (addon.data.env === "development") {
      showWelcomeMessage(win);
    }
    
    diagnostic.log("Main window load completed", true, { 
      phase: "complete",
      report: diagnostic.generateReport()
    });
    
    addon.ztoolkit.log("UI initialization completed successfully");
  } catch (error) {
    diagnostic.log("UI initialization failed", false, { 
      phase: "error",
      error: error.message 
    }, error);
    
    addon.ztoolkit.log(`Failed to initialize UI: ${error}`, 'error');
    
    // 只在主窗口显示错误
    if (win.location.href === "chrome://zotero/content/zotero.xhtml") {
      try {
        new ProgressWindowHelper(config.addonName)
          .createLine({
            text: "Failed to initialize Research Navigator",
            type: "error"
          })
          .show();
      } catch (e) {
        diagnostic.log("Could not show error notification", false, { 
          error: e.message 
        });
      }
    }
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
  // 只在开发模式下显示
  if (addon.data.env === "development") {
    win.setTimeout(() => {
      try {
        const progressWindow = new ProgressWindowHelper(config.addonName);
        progressWindow
          .createLine({
            text: "Research Navigator loaded successfully!",
            type: "success",
            progress: 100
          })
          .show();
        
        // 3秒后自动关闭
        win.setTimeout(() => {
          try {
            progressWindow.close();
          } catch (e) {
            // 窗口可能已经关闭
          }
        }, 3000);
      } catch (error) {
        addon.ztoolkit.log("Could not show welcome message", 'warn');
      }
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