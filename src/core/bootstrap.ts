/**
 * Bootstrap initialization for Research Navigator
 * 提供插件的核心初始化逻辑
 */

import { BasicTool } from "zotero-plugin-toolkit";
import { config } from "@/config";
import Addon from "../addon";
import { safeLoader } from "../bootstrap/safe-loader";

export interface BootstrapContext {
  rootURI: string;
  version: string;
  resourceURI: string;
}

/**
 * 插件启动入口
 */
export async function startup(
  { rootURI }: BootstrapContext,
  reason: number
): Promise<void> {
  // Use safeLoader instead of BasicTool.waitForZotero
  const isReady = await safeLoader.waitForZotero();
  if (!isReady) {
    throw new Error("Zotero initialization timeout");
  }
  
  const Zotero = BasicTool.getZotero();
  
  // 创建并注册插件实例
  if (!Zotero[config.addonInstance]) {
    const addon = new Addon();
    Zotero[config.addonInstance] = addon;
    
    // 设置全局引用
    if (typeof globalThis !== "undefined") {
      (globalThis as any).addon = addon;
      (globalThis as any).ztoolkit = addon.ztoolkit;
    }
    
    // 调用启动钩子
    await addon.hooks.onStartup();
  }
}

/**
 * 插件关闭入口
 */
export function shutdown(
  { rootURI }: BootstrapContext,
  reason: number
): void {
  const Zotero = BasicTool.getZotero();
  const addon = Zotero[config.addonInstance];
  
  if (addon) {
    addon.hooks.onShutdown();
    delete Zotero[config.addonInstance];
    
    // 清理全局引用
    if (typeof globalThis !== "undefined") {
      delete (globalThis as any).addon;
      delete (globalThis as any).ztoolkit;
    }
  }
}

/**
 * 插件卸载入口
 */
export function uninstall(
  { rootURI }: BootstrapContext,
  reason: number
): void {
  // 执行卸载清理
  const Zotero = BasicTool.getZotero();
  
  // 清理偏好设置
  if (Zotero.Prefs) {
    const branch = Zotero.Prefs.getBranch(config.prefsPrefix);
    if (branch) {
      branch.deleteBranch("");
    }
  }
}

/**
 * 主窗口加载事件
 * 注意：Zotero 传入的是 { window } 对象，不是直接的 window
 */
export function onMainWindowLoad({ window }: { window: Window }): void {
  const Zotero = BasicTool.getZotero();
  const addon = Zotero[config.addonInstance];
  
  if (addon) {
    addon.hooks.onMainWindowLoad(window);
  }
}

/**
 * 主窗口卸载事件
 */
export function onMainWindowUnload({ window }: { window: Window }): void {
  const Zotero = BasicTool.getZotero();
  const addon = Zotero[config.addonInstance];
  
  if (addon) {
    addon.hooks.onMainWindowUnload(window);
  }
}