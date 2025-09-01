/**
 * 打包 zTree 的历史树实现 - 将 jQuery 和 zTree 内联
 */

import { HistoryService } from "../../../services/history-service";
import { ClosedTabsManager } from "../../../managers/closed-tabs-manager";

// 我们可以将 jQuery 和 zTree 的核心代码内联在这里
// 但更好的方法是通过 webpack/rollup 等工具在构建时打包

export class HistoryTreeZTreeBundled {
  private container: HTMLElement;
  private treeObj: any = null;

  constructor(
    private window: Window,
    private historyService: HistoryService,
    private closedTabsManager: ClosedTabsManager,
  ) {
    Zotero.log(
      "[HistoryTreeZTreeBundled] Using bundled zTree implementation",
      "info",
    );
  }

  async init(container: HTMLElement): Promise<void> {
    this.container = container;
    const doc = container.ownerDocument || this.window.document;

    // 注入依赖
    await this.injectDependencies();

    // 创建UI结构
    container.innerHTML = `
      <div style="height: 100%; display: flex; flex-direction: column;">
        <div style="padding: 10px; border-bottom: 1px solid #e0e0e0; background: #f7f7f7;">
          <button id="refreshBtn" style="margin-right: 10px;">🔄 Refresh</button>
          <button id="expandAllBtn" style="margin-right: 10px;">📂 Expand All</button>
          <button id="collapseAllBtn">📁 Collapse All</button>
        </div>
        <div id="ztree-container" class="ztree" style="flex: 1; overflow: auto; padding: 10px;"></div>
      </div>
    `;

    // 绑定事件
    doc
      .getElementById("refreshBtn")
      ?.addEventListener("click", () => this.refresh());
    doc
      .getElementById("expandAllBtn")
      ?.addEventListener("click", () => this.treeObj?.expandAll(true));
    doc
      .getElementById("collapseAllBtn")
      ?.addEventListener("click", () => this.treeObj?.expandAll(false));

    // 注入样式
    this.injectStyles(doc);

    // 初始化树
    await this.refresh();
  }

  private async injectDependencies(): Promise<void> {
    const win = this.window as any;

    // 如果已经有 jQuery，跳过
    if (win.$ && win.$.fn && win.$.fn.zTree) {
      Zotero.log(
        "[HistoryTreeZTreeBundled] jQuery and zTree already loaded",
        "info",
      );
      return;
    }

    // 这里我们可以直接注入 jQuery 和 zTree 的代码
    // 为了演示，我们使用一个简化的方法
    await this.loadBundledLibraries();

    Zotero.log("[HistoryTreeZTreeBundled] Dependencies injected", "info");
  }

  private async loadBundledLibraries(): Promise<void> {
    const win = this.window as any;

    // 方案1: 使用 fetch 加载本地文件内容
    try {
      // 获取插件根路径
      let baseURI = "";
      if (Zotero.Plugins && Zotero.Plugins.getRootURI) {
        baseURI = await Zotero.Plugins.getRootURI(
          "research-navigator@zotero.org",
        );
      }

      if (!baseURI) {
        // 如果无法获取，尝试使用相对路径
        baseURI = "resource://zotero-research-navigator/";
      }

      // 加载 jQuery
      const jqueryUrl = baseURI + "content/lib/jquery.min.js";
      const jqueryResponse = await Zotero.HTTP.request("GET", jqueryUrl);
      if (jqueryResponse.status === 200) {
        // 在窗口上下文中执行 jQuery
        win.eval(jqueryResponse.responseText);
        Zotero.log("[HistoryTreeZTreeBundled] jQuery loaded via HTTP", "info");
      }

      // 等待 jQuery 就绪
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 加载 zTree
      if (win.$) {
        const ztreeUrl = baseURI + "content/lib/ztree/jquery.ztree.core.min.js";
        const ztreeResponse = await Zotero.HTTP.request("GET", ztreeUrl);
        if (ztreeResponse.status === 200) {
          win.eval(ztreeResponse.responseText);
          Zotero.log("[HistoryTreeZTreeBundled] zTree loaded via HTTP", "info");
        }
      }
    } catch (error) {
      Zotero.logError(
        `[HistoryTreeZTreeBundled] Failed to load bundled libraries: ${error}`,
      );

      // 方案2: 使用内联的精简版本
      this.injectMinimalImplementation();
    }
  }

  private injectMinimalImplementation(): void {
    // 如果无法加载完整的库，我们可以注入一个最小的实现
    // 这里可以包含 jQuery 和 zTree 的核心功能的精简版本
    const win = this.window as any;

    // 创建一个简化的 jQuery 替代
    if (!win.$) {
      win.$ = (selector: string) => {
        if (selector.startsWith("#")) {
          return {
            element: win.document.getElementById(selector.substring(1)),
            html: function (content?: string) {
              if (content !== undefined) {
                this.element.innerHTML = content;
                return this;
              }
              return this.element.innerHTML;
            },
          };
        }
        return null;
      };

      win.$.fn = {
        zTree: {
          init: (container: any, setting: any, zNodes: any) => {
            // 简化的 zTree 实现
            Zotero.log(
              "[HistoryTreeZTreeBundled] Using minimal zTree implementation",
              "warn",
            );
            return this.createMinimalTree(container, setting, zNodes);
          },
        },
      };
    }
  }

  private createMinimalTree(container: any, setting: any, zNodes: any[]): any {
    // 创建一个最小的树实现
    const containerEl = container.element || container[0] || container;
    if (!containerEl) return null;

    containerEl.innerHTML = "";

    // 渲染节点
    const renderNode = (node: any, level: number = 0) => {
      const nodeEl = this.window.document.createElement("div");
      nodeEl.style.marginLeft = `${level * 20}px`;
      nodeEl.style.padding = "2px";
      nodeEl.style.cursor = "pointer";

      const icon = node.customIcon || (node.open ? "📂" : "📁");
      nodeEl.innerHTML = `${icon} ${node.name}`;

      nodeEl.addEventListener("click", () => {
        if (setting.callback && setting.callback.onClick) {
          setting.callback.onClick(null, null, node);
        }
      });

      containerEl.appendChild(nodeEl);

      // 渲染子节点
      const children = zNodes.filter((n) => n.pId === node.id);
      children.forEach((child) => renderNode(child, level + 1));
    };

    // 渲染根节点
    const rootNodes = zNodes.filter((n) => !n.pId || n.pId === 0);
    rootNodes.forEach((node) => renderNode(node));

    return {
      expandAll: (expand: boolean) => {
        Zotero.log(
          "[HistoryTreeZTreeBundled] expandAll not implemented in minimal version",
          "info",
        );
      },
    };
  }

  private injectStyles(doc: Document): void {
    const style = doc.createElement("style");
    style.textContent = `
      /* zTree 基本样式 */
      .ztree {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 13px;
        color: #333;
      }
      
      .ztree li {
        list-style: none;
        line-height: 20px;
        white-space: nowrap;
        outline: 0;
      }
      
      .ztree li a {
        padding: 2px 3px;
        margin: 0;
        cursor: pointer;
        color: #333;
        text-decoration: none;
        display: inline-block;
      }
      
      .ztree li a:hover {
        background-color: #e7f4f9;
        text-decoration: none;
      }
      
      .ztree li a.curSelectedNode {
        background-color: #d4e7f1;
        border: 1px solid #a0c6d8;
      }
      
      /* 自定义图标样式 */
      .ztree li span.button.custom_icon {
        margin-right: 5px;
        background: none;
        vertical-align: middle;
      }
    `;
    doc.head.appendChild(style);
  }

  private async refresh(): Promise<void> {
    try {
      Zotero.log("[HistoryTreeZTreeBundled] Refreshing tree...", "info");

      const sessions = await this.historyService.getAllSessions();
      const closedTabs = this.closedTabsManager.getClosedTabs();

      const zNodes = await this.buildZNodes(sessions, closedTabs);

      const setting = {
        view: {
          nameIsHTML: true,
          showLine: true,
          showIcon: false,
          dblClickExpand: true,
          addDiyDom: (treeId: string, treeNode: any) => {
            const $ = (this.window as any).$;
            if ($ && $.fn && $.fn.zTree) {
              const aObj = $("#" + treeNode.tId + "_a");
              if (treeNode.customIcon && aObj.prepend) {
                const iconHtml = `<span class='button custom_icon'>${treeNode.customIcon}</span>`;
                aObj.prepend(iconHtml);
              }
            }
          },
        },
        data: {
          simpleData: {
            enable: true,
            idKey: "id",
            pIdKey: "pId",
          },
        },
        callback: {
          onClick: (event: any, treeId: string, treeNode: any) => {
            this.onNodeClick(event, treeId, treeNode);
          },
        },
      };

      const $ = (this.window as any).$;
      if ($ && $.fn && $.fn.zTree) {
        this.treeObj = $.fn.zTree.init($("#ztree-container"), setting, zNodes);
        Zotero.log(
          `[HistoryTreeZTreeBundled] Tree initialized with ${zNodes.length} nodes`,
          "info",
        );
      } else {
        Zotero.logError("[HistoryTreeZTreeBundled] zTree not available");
      }
    } catch (error) {
      Zotero.logError(`[HistoryTreeZTreeBundled] Failed to refresh: ${error}`);
    }
  }

  private async buildZNodes(
    sessions: any[],
    closedTabs: any[],
  ): Promise<any[]> {
    const nodes = [];
    let nodeId = 1;

    const dateGroups = new Map<string, any[]>();

    for (const session of sessions) {
      const date = new Date(session.startTime).toLocaleDateString();
      if (!dateGroups.has(date)) {
        dateGroups.set(date, []);
      }
      const sessionNodes = await this.historyService.getSessionNodes(
        session.id,
      );
      dateGroups.get(date)!.push({ session, nodes: sessionNodes });
    }

    for (const [date, sessionData] of dateGroups) {
      const dateNodeId = nodeId++;
      nodes.push({
        id: dateNodeId,
        pId: 0,
        name: date,
        open: true,
        isParent: true,
        customIcon: "📅",
      });

      for (const { session, nodes: historyNodes } of sessionData) {
        const sessionNodeId = nodeId++;
        nodes.push({
          id: sessionNodeId,
          pId: dateNodeId,
          name: `Session ${session.id.slice(-6)} (${historyNodes.length} items)`,
          open: false,
          isParent: true,
          customIcon: "📚",
        });

        for (const historyNode of historyNodes) {
          nodes.push({
            id: nodeId++,
            pId: sessionNodeId,
            name: historyNode.title || "Untitled",
            customIcon: historyNode.status === "active" ? "📖" : "📕",
            nodeData: historyNode,
          });
        }
      }
    }

    if (closedTabs.length > 0) {
      const closedRootId = nodeId++;
      nodes.push({
        id: closedRootId,
        pId: 0,
        name: `Closed Tabs (${closedTabs.length})`,
        open: true,
        isParent: true,
        customIcon: "👻",
      });

      for (const tab of closedTabs) {
        nodes.push({
          id: nodeId++,
          pId: closedRootId,
          name: tab.node.title || "Untitled",
          customIcon: "👻",
          closedTab: tab,
        });
      }
    }

    return nodes;
  }

  private onNodeClick(event: any, treeId: string, treeNode: any): void {
    if (treeNode.nodeData && treeNode.nodeData.itemId) {
      const ZoteroPane = Zotero.getActiveZoteroPane();
      if (ZoteroPane) {
        ZoteroPane.selectItem(treeNode.nodeData.itemId);
      }
    } else if (treeNode.closedTab) {
      this.closedTabsManager.restoreTab(treeNode.closedTab);
    }
  }
}
