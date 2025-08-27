/**
 * Safe loader for Research Navigator
 * 确保插件在各种情况下都能正确加载
 */

export class SafeLoader {
  private static instance: SafeLoader;
  private initialized = false;
  private initPromise?: Promise<void>;

  private constructor() {}

  static getInstance(): SafeLoader {
    if (!SafeLoader.instance) {
      SafeLoader.instance = new SafeLoader();
    }
    return SafeLoader.instance;
  }

  /**
   * 安全地等待 Zotero 初始化
   */
  async waitForZotero(timeout = 30000): Promise<boolean> {
    const startTime = Date.now();

    // 如果 Zotero 已经存在且初始化完成
    if (this.isZoteroReady()) {
      return true;
    }

    // 创建等待 promise
    return new Promise<boolean>((resolve) => {
      const checkInterval = setInterval(() => {
        if (this.isZoteroReady()) {
          clearInterval(checkInterval);
          resolve(true);
        } else if (Date.now() - startTime > timeout) {
          clearInterval(checkInterval);
          resolve(false);
        }
      }, 100);
    });
  }

  /**
   * 检查 Zotero 是否已准备好
   */
  private isZoteroReady(): boolean {
    try {
      return (
        typeof Zotero !== "undefined" &&
        Zotero !== null &&
        Zotero.Schema !== undefined &&
        (!Zotero.Schema.schemaUpdatePromise || 
         (typeof Zotero.Schema.schemaUpdatePromise.then === "function"))
      );
    } catch (e) {
      return false;
    }
  }

  /**
   * 等待主窗口准备好
   */
  async waitForMainWindow(win: Window, timeout = 10000): Promise<boolean> {
    const startTime = Date.now();

    // 检查窗口是否有效
    if (!win || !win.document) {
      return false;
    }

    // 等待文档加载完成
    if (win.document.readyState !== "complete") {
      await new Promise<void>((resolve) => {
        const listener = () => {
          win.removeEventListener("load", listener);
          resolve();
        };
        win.addEventListener("load", listener);

        // 超时保护
        win.setTimeout(() => {
          win.removeEventListener("load", listener);
          resolve();
        }, timeout);
      });
    }

    // 等待关键 UI 元素
    return new Promise<boolean>((resolve) => {
      let attempts = 0;
      const maxAttempts = Math.floor(timeout / 100);

      const checkUI = () => {
        attempts++;

        try {
          const hasRequiredElements = this.checkRequiredElements(win.document);
          
          if (hasRequiredElements) {
            resolve(true);
          } else if (attempts >= maxAttempts) {
            resolve(false);
          } else {
            win.setTimeout(checkUI, 100);
          }
        } catch (e) {
          if (attempts >= maxAttempts) {
            resolve(false);
          } else {
            win.setTimeout(checkUI, 100);
          }
        }
      };

      checkUI();
    });
  }

  /**
   * 检查必需的 UI 元素
   */
  private checkRequiredElements(doc: Document): boolean {
    const requiredElements = [
      "zotero-pane",
      "zotero-items-tree"
    ];

    for (const id of requiredElements) {
      if (!doc.getElementById(id)) {
        return false;
      }
    }

    return true;
  }

  /**
   * 获取安全的窗口对象
   */
  getSafeWindow(): Window | null {
    try {
      // 尝试各种方式获取窗口
      if (typeof window !== "undefined" && window) {
        return window;
      }

      if (typeof globalThis !== "undefined" && globalThis.window) {
        return globalThis.window;
      }

      // 尝试从 Services 获取
      if (typeof Services !== "undefined") {
        const wm = Services.wm;
        const win = wm.getMostRecentWindow("navigator:browser") ||
                   wm.getMostRecentWindow("zotero:main") ||
                   wm.getMostRecentWindow(null);
        return win;
      }

      return null;
    } catch (e) {
      return null;
    }
  }

  /**
   * 安全地执行函数
   */
  async safeExecute<T>(
    fn: () => T | Promise<T>,
    fallback?: T,
    errorHandler?: (error: Error) => void
  ): Promise<T | undefined> {
    try {
      return await fn();
    } catch (error) {
      if (errorHandler) {
        errorHandler(error as Error);
      }
      return fallback;
    }
  }

  /**
   * 初始化插件（确保只执行一次）
   */
  async initialize(initFn: () => Promise<void>): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.safeExecute(async () => {
      await initFn();
      this.initialized = true;
    });

    return this.initPromise;
  }

  /**
   * 重置状态（用于测试）
   */
  reset(): void {
    this.initialized = false;
    this.initPromise = undefined;
  }
}

export const safeLoader = SafeLoader.getInstance();