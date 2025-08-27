/**
 * Safe initialization utilities to prevent recursion
 */

// Cache for Zotero object to prevent repeated lookups
let cachedZotero: any = null;

/**
 * Safely get Zotero without causing recursion
 */
export function getSafeZotero(): any {
  // Return cached version if available
  if (cachedZotero) {
    return cachedZotero;
  }
  
  // Direct check without using getGlobal
  if (typeof Zotero !== "undefined" && Zotero) {
    cachedZotero = Zotero;
    return Zotero;
  }
  
  // Check window.Zotero
  if (typeof window !== "undefined" && window.Zotero) {
    cachedZotero = window.Zotero;
    return window.Zotero;
  }
  
  // Check globalThis.Zotero
  if (typeof globalThis !== "undefined" && (globalThis as any).Zotero) {
    cachedZotero = (globalThis as any).Zotero;
    return (globalThis as any).Zotero;
  }
  
  // As last resort, try ChromeUtils but with protection
  try {
    if (typeof ChromeUtils !== "undefined" && ChromeUtils.importESModule) {
      const module = ChromeUtils.importESModule("chrome://zotero/content/zotero.mjs");
      if (module && module.Zotero) {
        cachedZotero = module.Zotero;
        return module.Zotero;
      }
    }
  } catch (e) {
    // Ignore import errors
  }
  
  return null;
}

/**
 * Initialize the addon without using BasicTool.getGlobal
 */
export function initializeAddon(addon: any, config: any): boolean {
  const Zotero = getSafeZotero();
  
  if (!Zotero) {
    console.error("[Research Navigator] Failed to get Zotero object");
    return false;
  }
  
  // Check if already initialized
  if (Zotero[config.addonInstance]) {
    return true;
  }
  
  // Register addon
  Zotero[config.addonInstance] = addon;
  
  if (Zotero.debug) {
    Zotero.debug("[Research Navigator] Addon registered successfully");
    Zotero.debug("[Research Navigator] Version: " + config.version);
  }
  
  return true;
}