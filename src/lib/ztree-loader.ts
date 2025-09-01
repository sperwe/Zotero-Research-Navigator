/**
 * zTree 资源加载器 - 统一处理 jQuery 和 zTree 的加载
 */

export class ZTreeLoader {
  private static instance: ZTreeLoader;
  private loaded = false;
  private loading = false;
  private loadPromise: Promise<void> | null = null;

  static getInstance(): ZTreeLoader {
    if (!ZTreeLoader.instance) {
      ZTreeLoader.instance = new ZTreeLoader();
    }
    return ZTreeLoader.instance;
  }

  /**
   * 确保 jQuery 和 zTree 已加载
   */
  async ensureLoaded(window: Window): Promise<void> {
    if (this.loaded) {
      return;
    }

    if (this.loading) {
      return this.loadPromise!;
    }

    this.loading = true;
    this.loadPromise = this.loadLibraries(window);

    try {
      await this.loadPromise;
      this.loaded = true;
    } catch (error) {
      this.loading = false;
      this.loadPromise = null;
      throw error;
    }
  }

  private async loadLibraries(window: Window): Promise<void> {
    const win = window as any;

    // 检查是否已经加载
    if (win.$ && win.$.fn && win.$.fn.zTree) {
      Zotero.log("[ZTreeLoader] Libraries already loaded", "info");
      return;
    }

    // 方案1: 尝试使用 Zotero 的资源加载
    try {
      await this.loadViaZoteroResources(window);
      return;
    } catch (e) {
      Zotero.log(`[ZTreeLoader] Zotero resource loading failed: ${e}`, "warn");
    }

    // 方案2: 尝试通过 HTTP 加载
    try {
      await this.loadViaHTTP(window);
      return;
    } catch (e) {
      Zotero.log(`[ZTreeLoader] HTTP loading failed: ${e}`, "warn");
    }

    // 方案3: 使用内联代码
    await this.loadInlineCode(window);
  }

  private async loadViaZoteroResources(window: Window): Promise<void> {
    // 获取插件路径
    const rootURI = await Zotero.Plugins.getRootURI(
      "research-navigator@zotero.org",
    );
    if (!rootURI) {
      throw new Error("Cannot get plugin root URI");
    }

    // 使用 Zotero.File 读取文件
    const jqueryPath = rootURI + "content/lib/jquery.min.js";
    const ztreePath = rootURI + "content/lib/ztree/jquery.ztree.core.min.js";

    // 读取文件内容
    const jqueryContent = await Zotero.File.getContentsFromURL(jqueryPath);
    const ztreeContent = await Zotero.File.getContentsFromURL(ztreePath);

    // 在窗口上下文中执行
    (window as any).eval(jqueryContent);
    await new Promise((resolve) => setTimeout(resolve, 50));
    (window as any).eval(ztreeContent);

    Zotero.log("[ZTreeLoader] Loaded via Zotero resources", "info");
  }

  private async loadViaHTTP(window: Window): Promise<void> {
    const rootURI = await Zotero.Plugins.getRootURI(
      "research-navigator@zotero.org",
    );
    if (!rootURI) {
      throw new Error("Cannot get plugin root URI");
    }

    // jQuery
    const jqueryResponse = await Zotero.HTTP.request(
      "GET",
      rootURI + "content/lib/jquery.min.js",
    );
    if (jqueryResponse.status !== 200) {
      throw new Error("Failed to load jQuery");
    }
    (window as any).eval(jqueryResponse.responseText);

    await new Promise((resolve) => setTimeout(resolve, 50));

    // zTree
    const ztreeResponse = await Zotero.HTTP.request(
      "GET",
      rootURI + "content/lib/ztree/jquery.ztree.core.min.js",
    );
    if (ztreeResponse.status !== 200) {
      throw new Error("Failed to load zTree");
    }
    (window as any).eval(ztreeResponse.responseText);

    Zotero.log("[ZTreeLoader] Loaded via HTTP", "info");
  }

  private async loadInlineCode(window: Window): Promise<void> {
    // 这里可以包含 jQuery 和 zTree 的最小化代码
    // 为了演示，我们创建一个模拟实现
    const win = window as any;

    win.$ = function (selector: any) {
      if (typeof selector === "string") {
        if (selector.startsWith("#")) {
          const el = window.document.getElementById(selector.substring(1));
          return el ? [el] : [];
        }
        return window.document.querySelectorAll(selector);
      }
      return selector;
    };

    win.$.fn = {
      zTree: {
        init: (container: any, setting: any, zNodes: any) => {
          Zotero.log(
            "[ZTreeLoader] Using fallback tree implementation",
            "warn",
          );
          // 返回一个模拟的树对象
          return {
            expandAll: () => {},
            getNodes: () => zNodes,
          };
        },
      },
    };

    Zotero.log("[ZTreeLoader] Loaded inline fallback", "info");
  }

  /**
   * 加载 zTree CSS
   */
  async loadStyles(document: Document): Promise<void> {
    try {
      const rootURI = await Zotero.Plugins.getRootURI(
        "research-navigator@zotero.org",
      );
      if (rootURI) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = rootURI + "content/lib/ztree/zTreeStyle.css";
        document.head.appendChild(link);
      }
    } catch (e) {
      // 如果加载失败，注入基本样式
      const style = document.createElement("style");
      style.textContent = this.getFallbackStyles();
      document.head.appendChild(style);
    }
  }

  private getFallbackStyles(): string {
    return `
      .ztree {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 13px;
      }
      .ztree li {
        list-style: none;
        line-height: 22px;
      }
      .ztree li a {
        padding: 2px 5px;
        text-decoration: none;
        color: #333;
        cursor: pointer;
        display: inline-block;
      }
      .ztree li a:hover {
        background: #e7f4f9;
      }
    `;
  }
}
