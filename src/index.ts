/**
 * Research Navigator - Main Entry Point
 * Zotero插件主入口文件
 */

// 最先导入初始化代码
import "./bootstrap-init";

import { BasicTool } from "zotero-plugin-toolkit";
import Addon from "./addon";
import { config } from "../package.json";
import { setupConsolePolyfill } from "./polyfills/console";

// 再次确保 console polyfill 被设置
setupConsolePolyfill();

// Create addon instance
const addonInstance = new Addon();

// Log creation
if (typeof Zotero !== "undefined" && Zotero.debug) {
  Zotero.debug("[Research Navigator] Creating addon instance...");
}

// Make addon available in multiple locations for bootstrap.js to find
if (typeof globalThis !== "undefined") {
  (globalThis as any).addon = addonInstance;
  (globalThis as any).ztoolkit = addonInstance.ztoolkit;
}

// Also try to set on the current context (which might be 'ctx' from bootstrap.js)
try {
  (eval("this") as any).addon = addonInstance;
  (eval("this") as any).ztoolkit = addonInstance.ztoolkit;
} catch (e) {
  // eval might fail in strict mode
}

// Set on window if available
if (typeof window !== "undefined") {
  (window as any).addon = addonInstance;
  (window as any).ztoolkit = addonInstance.ztoolkit;
}

// Register with Zotero
if (typeof Zotero !== "undefined") {
  Zotero[config.addonInstance] = addonInstance;
  Zotero.debug("[Research Navigator] Addon instance created and registered");
  Zotero.debug("[Research Navigator] Version: " + (config as any).version || "unknown");
  Zotero.debug("[Research Navigator] Addon ID: " + config.addonID);
} else {
  console.log("[Research Navigator] Warning: Zotero not available during initialization");
}

// Export for potential use by other modules
export { addonInstance as addon };