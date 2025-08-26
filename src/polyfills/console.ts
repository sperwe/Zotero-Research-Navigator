/**
 * Console polyfill for Zotero environment
 * Provides a minimal console implementation that redirects to Zotero.debug
 */

export function setupConsolePolyfill() {
  // 检查是否需要 polyfill
  if (typeof globalThis.console === 'undefined' || !globalThis.console.log) {
    const Zotero = globalThis.Zotero || (globalThis as any).Zotero;
    
    const consolePolyfill = {
      log: (message: any, ...args: any[]) => {
        if (Zotero && Zotero.debug) {
          Zotero.debug(`[Console.log] ${message} ${args.join(' ')}`);
        }
      },
      error: (message: any, ...args: any[]) => {
        if (Zotero && Zotero.debug) {
          Zotero.debug(`[Console.error] ${message} ${args.join(' ')}`, 1);
        }
      },
      warn: (message: any, ...args: any[]) => {
        if (Zotero && Zotero.debug) {
          Zotero.debug(`[Console.warn] ${message} ${args.join(' ')}`, 2);
        }
      },
      info: (message: any, ...args: any[]) => {
        if (Zotero && Zotero.debug) {
          Zotero.debug(`[Console.info] ${message} ${args.join(' ')}`);
        }
      },
      debug: (message: any, ...args: any[]) => {
        if (Zotero && Zotero.debug) {
          Zotero.debug(`[Console.debug] ${message} ${args.join(' ')}`);
        }
      },
      group: () => {
        // No-op for group
      },
      groupEnd: () => {
        // No-op for groupEnd
      },
      groupCollapsed: () => {
        // No-op for groupCollapsed
      },
      time: () => {
        // No-op for time
      },
      timeEnd: () => {
        // No-op for timeEnd
      },
      trace: () => {
        // No-op for trace
      },
      assert: () => {
        // No-op for assert
      }
    };
    
    // 设置全局 console
    (globalThis as any).console = consolePolyfill;
    (globalThis as any)._console = consolePolyfill;
    
    if (Zotero && Zotero.debug) {
      Zotero.debug("[Research Navigator] Console polyfill installed");
    }
  }
}