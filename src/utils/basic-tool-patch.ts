/**
 * Patch for BasicTool to prevent recursion
 * This ensures Zotero is available in globalThis before BasicTool tries to get it
 */

export function patchBasicTool() {
  // If Zotero is already defined, we're good
  if (typeof Zotero !== "undefined" && Zotero) {
    return;
  }

  // Try to get Zotero from the global context
  try {
    // In Zotero plugin context, Zotero should be available
    const win = typeof window !== "undefined" ? window : globalThis;

    if ((win as any).Zotero) {
      // Make sure it's available globally
      (globalThis as any).Zotero = (win as any).Zotero;
      return;
    }

    // Try to get from ChromeUtils if available
    if (typeof ChromeUtils !== "undefined" && ChromeUtils.importESModule) {
      try {
        const { Zotero: ImportedZotero } = ChromeUtils.importESModule(
          "chrome://zotero/content/zotero.mjs",
        );
        if (ImportedZotero) {
          (globalThis as any).Zotero = ImportedZotero;
        }
      } catch (e) {
        // Ignore import errors in test environments
      }
    }
  } catch (e) {
    // Log but don't throw - let BasicTool handle missing Zotero
    if (typeof console !== "undefined" && console.error) {
      console.error("[Research Navigator] Failed to patch BasicTool:", e);
    }
  }
}
