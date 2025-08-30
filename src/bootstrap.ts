/**
 * Bootstrap 入口文件
 * Version 2.3.1 - Dev Build with Auto-Update
 * 提供 Zotero 插件所需的生命周期函数
 */

import { getResearchNavigator } from "./core/research-navigator";
import { registerBootstrapTests } from "./test/bootstrap-tests";
import { config } from "./config";

// Bootstrap 函数必须在全局作用域
declare global {
  interface Window {
    startup: (data: any, reason: any) => Promise<void>;
    shutdown: (data: any, reason: any) => Promise<void>;
    install: (data: any, reason: any) => void;
    uninstall: (data: any, reason: any) => void;
  }
}

/**
 * 插件安装时调用
 */
function install(data: any, reason: any): void {
  // 安装时不需要特殊处理
}

/**
 * 插件启动时调用
 */
async function startup(
  { id, version, rootURI }: { id: string; version: string; rootURI: string },
  reason: number,
): Promise<void> {
  try {
    // 等待 Zotero 初始化
    while (typeof Zotero === "undefined" || !Zotero.initialized) {
      await new Promise((resolve) => {
      // 在 Zotero 环境中使用 ChromeUtils.idleDispatch 或直接 resolve
      if (typeof ChromeUtils !== "undefined" && ChromeUtils.idleDispatch) {
        ChromeUtils.idleDispatch(resolve);
      } else {
        resolve();
      }
    });
    }

    // 记录启动信息
    Zotero.log(
      `[Research Navigator] Starting up... Version: ${version}, Reason: ${reason}`,
      "info",
    );

    // 获取插件实例
    const navigator = getResearchNavigator();
    
    // 立即注册到全局对象，便于调试和外部访问
    (Zotero as any).ResearchNavigator = navigator;
    
    // 添加基本的调试方法（在初始化之前就可用）
    (Zotero as any).ResearchNavigator.debug = {
      getNavigator: () => navigator,
      checkStatus: () => {
        Zotero.log(`Navigator initialized: ${navigator.initialized}`, "info");
        Zotero.log(`Navigator instance: ${navigator}`, "info");
        return navigator.initialized;
      }
    };
    
    // 初始化
    await navigator.initialize();

    // 注册 Bootstrap 测试工具（开发版或从 dev 分支构建）
    const isDev = config.version.includes('dev') || 
                  config.version.includes('beta') || 
                  version.includes('dev') ||
                  rootURI.includes('dev') ||
                  true; // 暂时总是启用测试工具
    
    if (isDev) {
      try {
        registerBootstrapTests();
        Zotero.log("[Research Navigator] Bootstrap tests registered", "info");
      } catch (e) {
        Zotero.logError(`[Research Navigator] Failed to register tests: ${e}`);
      }
    }

    // 注册关闭处理器
    Zotero.addShutdownListener(shutdown);

    Zotero.log("[Research Navigator] Startup completed successfully", "info");
  } catch (error) {
    Zotero.logError(error);
    Services.prompt.alert(
      null,
      "Research Navigator",
      `Failed to start Research Navigator: ${error}`,
    );
  }
}

/**
 * 插件关闭时调用
 */
async function shutdown(data: any, reason: any): Promise<void> {
  try {
    Zotero.log(
      `[Research Navigator] Shutting down... Reason: ${reason}`,
      "info",
    );

    // 获取插件实例并关闭
    const navigator = getResearchNavigator();
    await navigator.shutdown();

    // 清理全局引用
    if ((Zotero as any).ResearchNavigator) {
      delete (Zotero as any).ResearchNavigator;
    }

    Zotero.log("[Research Navigator] Shutdown completed", "info");
  } catch (error) {
    Zotero.logError(error);
  }
}

/**
 * 插件卸载时调用
 */
function uninstall(data: any, reason: any): void {
  // 卸载时不需要特殊处理，数据保留
}

// 导出到全局作用域
if (!window.startup) window.startup = startup;
if (!window.shutdown) window.shutdown = shutdown;
if (!window.install) window.install = install;
if (!window.uninstall) window.uninstall = uninstall;

// 为了兼容性，也导出函数
export { startup, shutdown, install, uninstall };
