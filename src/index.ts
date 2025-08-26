/**
 * Research Navigator - Main Entry Point
 * Zotero插件主入口文件
 */

// 最先导入初始化代码
import "./bootstrap-init";

import Addon from "./addon";
import { config } from "../package.json";
import { setupConsolePolyfill } from "./polyfills/console";
import { getSafeZotero, initializeAddon } from "./utils/safe-init";

// 再次确保 console polyfill 被设置
setupConsolePolyfill();

// 安全获取 Zotero
const Zotero = getSafeZotero();

if (Zotero && !Zotero[config.addonInstance]) {
  try {
    // Create addon instance
    const addonInstance = new Addon();
    
    // Make it globally available
    if (typeof globalThis !== "undefined") {
      (globalThis as any).addon = addonInstance;
      (globalThis as any).ztoolkit = addonInstance.ztoolkit;
    }
    
    // Register with Zotero
    if (initializeAddon(addonInstance, config)) {
      // Also set on window for compatibility
      if (typeof window !== "undefined") {
        (window as any).addon = addonInstance;
        (window as any).ztoolkit = addonInstance.ztoolkit;
      }
    }
  } catch (error) {
    if (Zotero && Zotero.debug) {
      Zotero.debug("[Research Navigator] Failed to create addon: " + error);
    }
  }
}