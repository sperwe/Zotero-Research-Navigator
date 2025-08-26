/**
 * Bootstrap initialization
 * This code runs at the very beginning to set up the environment
 */

// Immediately set up console polyfill
(function() {
  const Zotero = (globalThis as any).Zotero;
  
  const noop = () => {};
  const logWrapper = (prefix: string, level?: number) => {
    return (...args: any[]) => {
      if (Zotero && Zotero.debug) {
        const msg = args.filter(x => x !== undefined).join(' ');
        if (msg) {
          Zotero.debug(`${prefix} ${msg}`, level);
        }
      }
    };
  };
  
  const consolePolyfill = {
    log: logWrapper('[Console.log]'),
    error: logWrapper('[Console.error]', 1),
    warn: logWrapper('[Console.warn]', 2),
    info: logWrapper('[Console.info]'),
    debug: logWrapper('[Console.debug]'),
    group: logWrapper('[Console.group]'),
    groupEnd: noop,
    groupCollapsed: logWrapper('[Console.groupCollapsed]'),
    time: logWrapper('[Console.time]'),
    timeEnd: logWrapper('[Console.timeEnd]'),
    trace: noop,
    assert: noop,
    clear: noop,
    count: logWrapper('[Console.count]'),
    countReset: noop,
    dir: logWrapper('[Console.dir]'),
    dirxml: noop,
    table: noop,
    profile: noop,
    profileEnd: noop
  };
  
  // Force set all possible console references
  const targets = [globalThis, (globalThis as any).window, self];
  const names = ['console', '_console'];
  
  targets.forEach(target => {
    if (target) {
      names.forEach(name => {
        try {
          Object.defineProperty(target, name, {
            value: consolePolyfill,
            writable: true,
            configurable: true
          });
        } catch (e) {
          // Fallback to direct assignment
          (target as any)[name] = consolePolyfill;
        }
      });
    }
  });
  
  if (Zotero && Zotero.debug) {
    Zotero.debug("[Research Navigator] Bootstrap console polyfill installed");
  }
})();

// Export to make TypeScript happy
export {};