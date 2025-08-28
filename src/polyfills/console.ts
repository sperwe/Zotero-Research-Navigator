/**
 * Console polyfill for Zotero environment
 * Provides a minimal console implementation that redirects to Zotero.debug
 */

export function setupConsolePolyfill() {
  const Zotero =
    (globalThis as any).Zotero || (globalThis as any).window?.Zotero;

  const consolePolyfill = {
    log: (message?: any, ...args: any[]) => {
      if (Zotero && Zotero.debug) {
        const msg = [message, ...args].filter((x) => x !== undefined).join(" ");
        if (msg) Zotero.debug(`[Console.log] ${msg}`);
      }
    },
    error: (message?: any, ...args: any[]) => {
      if (Zotero && Zotero.debug) {
        const msg = [message, ...args].filter((x) => x !== undefined).join(" ");
        if (msg) Zotero.debug(`[Console.error] ${msg}`, 1);
      }
    },
    warn: (message?: any, ...args: any[]) => {
      if (Zotero && Zotero.debug) {
        const msg = [message, ...args].filter((x) => x !== undefined).join(" ");
        if (msg) Zotero.debug(`[Console.warn] ${msg}`, 2);
      }
    },
    info: (message?: any, ...args: any[]) => {
      if (Zotero && Zotero.debug) {
        const msg = [message, ...args].filter((x) => x !== undefined).join(" ");
        if (msg) Zotero.debug(`[Console.info] ${msg}`);
      }
    },
    debug: (message?: any, ...args: any[]) => {
      if (Zotero && Zotero.debug) {
        const msg = [message, ...args].filter((x) => x !== undefined).join(" ");
        if (msg) Zotero.debug(`[Console.debug] ${msg}`);
      }
    },
    group: (...args: any[]) => {
      // No-op for group, but log the group label
      if (args.length > 0 && Zotero && Zotero.debug) {
        const msg = args.filter((x) => x !== undefined).join(" ");
        if (msg) Zotero.debug(`[Console.group] ${msg}`);
      }
    },
    groupEnd: () => {
      // No-op for groupEnd
    },
    groupCollapsed: (...args: any[]) => {
      // No-op for groupCollapsed, but log the group label
      if (args.length > 0 && Zotero && Zotero.debug) {
        const msg = args.filter((x) => x !== undefined).join(" ");
        if (msg) Zotero.debug(`[Console.groupCollapsed] ${msg}`);
      }
    },
    time: (label?: string) => {
      // No-op for time
      if (label && Zotero && Zotero.debug) {
        Zotero.debug(`[Console.time] ${label}`);
      }
    },
    timeEnd: (label?: string) => {
      // No-op for timeEnd
      if (label && Zotero && Zotero.debug) {
        Zotero.debug(`[Console.timeEnd] ${label}`);
      }
    },
    trace: () => {
      // No-op for trace
      if (Zotero && Zotero.debug) {
        Zotero.debug(`[Console.trace]`);
      }
    },
    assert: (condition?: boolean, ...data: any[]) => {
      // No-op for assert
      if (!condition && Zotero && Zotero.debug) {
        const msg = data.filter((x) => x !== undefined).join(" ");
        Zotero.debug(`[Console.assert] Assertion failed: ${msg}`);
      }
    },
    clear: () => {
      // No-op for clear
    },
    count: (label?: string) => {
      // No-op for count
      if (label && Zotero && Zotero.debug) {
        Zotero.debug(`[Console.count] ${label}`);
      }
    },
    countReset: (label?: string) => {
      // No-op for countReset
    },
    dir: (obj?: any) => {
      // No-op for dir
      if (obj && Zotero && Zotero.debug) {
        Zotero.debug(`[Console.dir] ${JSON.stringify(obj)}`);
      }
    },
    dirxml: (obj?: any) => {
      // No-op for dirxml
    },
    table: (...data: any[]) => {
      // No-op for table
    },
    profile: (label?: string) => {
      // No-op for profile
    },
    profileEnd: (label?: string) => {
      // No-op for profileEnd
    },
  };

  // 设置全局 console 和 _console
  (globalThis as any).console = consolePolyfill;
  (globalThis as any)._console = consolePolyfill;

  // 也设置在 window 对象上（如果存在）
  if ((globalThis as any).window) {
    (globalThis as any).window.console = consolePolyfill;
    (globalThis as any).window._console = consolePolyfill;
  }

  if (Zotero && Zotero.debug) {
    Zotero.debug("[Research Navigator] Console polyfill installed");
  }
}
