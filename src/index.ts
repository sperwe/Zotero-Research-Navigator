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

// Get current execution context
const currentContext = (function() { return this; })();

// Strategy 1: Set addon on the current execution context (ctx in bootstrap.js)
if (currentContext && typeof currentContext === "object") {
  (currentContext as any).addon = addonInstance;
  (currentContext as any).ztoolkit = addonInstance.ztoolkit;
  
  // CRITICAL FIX: Handle bootstrap.js expectation of ctx._globalThis.addon
  // If we're in bootstrap context (ctx.globalThis === ctx), set up _globalThis
  if (currentContext.globalThis === currentContext) {
    // We're in bootstrap.js context
    currentContext._globalThis = {
      addon: addonInstance,
      ztoolkit: addonInstance.ztoolkit
    };
    
    if (typeof Zotero !== "undefined" && Zotero.debug) {
      Zotero.debug("[Research Navigator] Detected bootstrap.js context, set ctx._globalThis.addon");
    }
  }
}

// Strategy 2: Set on global objects for broader compatibility
if (typeof globalThis !== "undefined") {
  (globalThis as any).addon = addonInstance;
  (globalThis as any).ztoolkit = addonInstance.ztoolkit;
}

// Strategy 3: Set on window if available
if (typeof window !== "undefined") {
  (window as any).addon = addonInstance;
  (window as any).ztoolkit = addonInstance.ztoolkit;
}

// Strategy 4: Register with Zotero
if (typeof Zotero !== "undefined") {
  Zotero[config.addonInstance] = addonInstance;
  Zotero.debug("[Research Navigator] Addon instance created and registered");
  Zotero.debug("[Research Navigator] Version: " + (config as any).version || "unknown");
  Zotero.debug("[Research Navigator] Addon ID: " + config.addonID);
  
  // Additional debug info
  Zotero.debug("[Research Navigator] Addon available at:");
  if (currentContext && currentContext.addon) Zotero.debug("  - currentContext.addon");
  if (currentContext && currentContext._globalThis?.addon) Zotero.debug("  - currentContext._globalThis.addon");
  if ((globalThis as any).addon) Zotero.debug("  - globalThis.addon");
  if (Zotero[config.addonInstance]) Zotero.debug("  - Zotero." + config.addonInstance);
} else {
  console.log("[Research Navigator] Warning: Zotero not available during initialization");
}

// Export for potential use by other modules
export { addonInstance as addon };