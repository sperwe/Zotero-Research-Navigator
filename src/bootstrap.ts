/**
 * Bootstrap 入口文件
 * 提供 Zotero 插件所需的生命周期函数
 */

import { getResearchNavigator } from "./core/research-navigator";
import { config } from "../package.json";

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

    // 获取插件实例并初始化
    const navigator = getResearchNavigator();
    await navigator.initialize();

    // 注册到全局对象，便于调试和外部访问
    (Zotero as any).ResearchNavigator = navigator;

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
