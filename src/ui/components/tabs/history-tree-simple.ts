/**
 * 简化版的 History Tree 实现 - 直接在主窗口使用 zTree
 */

import { HistoryService } from "../../../services/history-service";
import { HistoryNode } from "../../../services/database-service";
import { ClosedTabsManager } from "../../../managers/closed-tabs-manager";

declare const Services: any;

export class HistoryTreeSimple {
  private container: HTMLElement;
  private treeObj: any = null;
  private treeContainer: HTMLElement | null = null;
  private jqueryLoaded = false;
  private ztreeLoaded = false;

  constructor(
    private window: Window,
    private historyService: HistoryService,
    private closedTabsManager: ClosedTabsManager,
  ) {
    Zotero.log("[HistoryTreeSimple] Using direct zTree implementation", "info");
  }

  /**
   * 初始化组件
   */
  async init(container: HTMLElement): Promise<void> {
    this.container = container;
    const doc = container.ownerDocument || this.window.document;

    // 清空容器
    this.container.innerHTML = "";

    // 创建加载提示
    const loadingDiv = doc.createElement("div");
    loadingDiv.style.cssText =
      "padding: 20px; text-align: center; color: #666;";
    loadingDiv.textContent = "Loading zTree components...";
    this.container.appendChild(loadingDiv);

    try {
      // 加载依赖
      await this.loadDependencies();

      // 创建树容器
      this.container.innerHTML = "";
      this.createUI(doc);

      // 加载数据
      await this.refreshTree();
    } catch (error) {
      Zotero.logError(`[HistoryTreeSimple] Failed to initialize: ${error}`);
      this.showError(error.toString());
    }
  }

  /**
   * 创建UI
   */
  private createUI(doc: Document): void {
    // 创建工具栏
    const toolbar = doc.createElement("div");
    toolbar.style.cssText = `
      display: flex;
      align-items: center;
      padding: 10px;
      border-bottom: 1px solid #e0e0e0;
      background: #f5f5f5;
    `;

    const refreshBtn = doc.createElement("button");
    refreshBtn.textContent = "🔄 Refresh";
    refreshBtn.style.cssText = `
      margin-right: 10px;
      padding: 4px 8px;
      font-size: 12px;
      border: 1px solid #ccc;
      background: #fff;
      cursor: pointer;
      border-radius: 3px;
    `;
    refreshBtn.addEventListener("click", () => this.refreshTree());
    toolbar.appendChild(refreshBtn);

    const clearBtn = doc.createElement("button");
    clearBtn.textContent = "🗑️ Clear All";
    clearBtn.style.cssText = refreshBtn.style.cssText;
    clearBtn.addEventListener("click", () => this.handleClearAll());
    toolbar.appendChild(clearBtn);

    this.container.appendChild(toolbar);

    // 创建树容器
    this.treeContainer = doc.createElement("div");
    this.treeContainer.id = "history-ztree-" + Date.now();
    this.treeContainer.className = "ztree";
    this.treeContainer.style.cssText = `
      flex: 1;
      overflow: auto;
      padding: 10px;
    `;
    this.container.appendChild(this.treeContainer);
  }

  /**
   * 加载依赖
   */
  private async loadDependencies(): Promise<void> {
    const win = this.window as any;

    // 检查 jQuery
    if (!win.$ && !win.jQuery) {
      await this.loadScript(
        "jQuery",
        "chrome://researchnavigator/content/lib/jquery.min.js",
      );
      // 等待 jQuery 加载
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // 检查 zTree
    if (!win.$ || !win.$.fn || !win.$.fn.zTree) {
      await this.loadScript(
        "zTree",
        "chrome://researchnavigator/content/lib/ztree/jquery.ztree.core.min.js",
      );
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 加载 CSS
      await this.loadCSS(
        "chrome://researchnavigator/content/lib/ztree/zTreeStyle.css",
      );
    }

    Zotero.log("[HistoryTreeSimple] Dependencies loaded", "info");
  }

  /**
   * 加载脚本
   */
  private async loadScript(name: string, url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // 使用 Services.scriptloader
        if (typeof Services !== "undefined" && Services.scriptloader) {
          Services.scriptloader.loadSubScript(url, this.window);
          Zotero.log(
            `[HistoryTreeSimple] Loaded ${name} via scriptloader`,
            "info",
          );
          resolve();
        } else {
          // 备用方法
          const script = this.window.document.createElement("script");
          script.src = url;
          script.onload = () => {
            Zotero.log(`[HistoryTreeSimple] Loaded ${name} via DOM`, "info");
            resolve();
          };
          script.onerror = () => reject(new Error(`Failed to load ${name}`));
          this.window.document.head.appendChild(script);
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 加载CSS
   */
  private async loadCSS(url: string): Promise<void> {
    const link = this.window.document.createElement("link");
    link.rel = "stylesheet";
    link.type = "text/css";
    link.href = url;
    this.window.document.head.appendChild(link);
  }

  /**
   * 刷新树
   */
  async refreshTree(): Promise<void> {
    if (!this.treeContainer) return;

    try {
      Zotero.log("[HistoryTreeSimple] Refreshing tree", "info");

      // 获取数据
      const sessions = await this.historyService.getAllSessions();
      const closedTabs = this.closedTabsManager.getClosedTabs();

      // 转换为 zTree 节点
      const zNodes = await this.getZTreeNodes(sessions, closedTabs);

      // zTree 设置
      const setting = {
        view: {
          dblClickExpand: true,
          showLine: true,
          showIcon: true,
          nameIsHTML: true,
        },
        data: {
          simpleData: {
            enable: true,
          },
        },
        callback: {
          onClick: (event: any, treeId: string, treeNode: any) => {
            this.handleNodeClick(treeNode);
          },
        },
      };

      // 初始化或更新树
      const $ = (this.window as any).$;
      if ($ && $.fn && $.fn.zTree) {
        this.treeObj = $.fn.zTree.init(
          $("#" + this.treeContainer.id),
          setting,
          zNodes,
        );
        Zotero.log(
          "[HistoryTreeSimple] Tree initialized with " +
            zNodes.length +
            " nodes",
          "info",
        );
      } else {
        throw new Error("zTree not available");
      }
    } catch (error) {
      Zotero.logError(`[HistoryTreeSimple] Failed to refresh tree: ${error}`);
      this.showError(error.toString());
    }
  }

  /**
   * 获取 zTree 节点数据
   */
  private async getZTreeNodes(
    sessions: any[],
    closedTabs: any[],
  ): Promise<any[]> {
    const zNodes = [];
    const dateGroups = new Map<string, any[]>();

    // 按日期分组
    for (const session of sessions) {
      const date = new Date(session.startTime).toLocaleDateString();
      if (!dateGroups.has(date)) {
        dateGroups.set(date, []);
      }

      const nodes = await this.historyService.getSessionNodes(session.id);
      dateGroups.get(date)!.push({ session, nodes });
    }

    // 创建日期节点
    let nodeId = 0;
    for (const [date, sessionData] of dateGroups) {
      const dateNodeId = `date_${nodeId++}`;
      zNodes.push({
        id: dateNodeId,
        pId: 0,
        name: `📅 ${date}`,
        open: true,
        isParent: true,
      });

      // 创建 session 节点
      for (const { session, nodes } of sessionData) {
        const sessionNodeId = `session_${nodeId++}`;
        zNodes.push({
          id: sessionNodeId,
          pId: dateNodeId,
          name: `📚 Session ${session.id.slice(-6)} (${nodes.length} items)`,
          open: false,
          isParent: true,
        });

        // 创建历史节点
        for (const node of nodes) {
          zNodes.push({
            id: `node_${nodeId++}`,
            pId: sessionNodeId,
            name: `${node.status === "active" ? "📖" : "📕"} ${node.title || "Untitled"}`,
            historyNode: node,
          });
        }
      }
    }

    // 添加关闭的标签
    if (closedTabs.length > 0) {
      const closedTabsNodeId = `closed_${nodeId++}`;
      zNodes.push({
        id: closedTabsNodeId,
        pId: 0,
        name: `👻 Closed Tabs (${closedTabs.length})`,
        open: true,
        isParent: true,
      });

      for (const tab of closedTabs) {
        zNodes.push({
          id: `closedtab_${nodeId++}`,
          pId: closedTabsNodeId,
          name: `👻 ${tab.node.title || "Untitled"}`,
          closedTab: tab,
        });
      }
    }

    return zNodes;
  }

  /**
   * 处理节点点击
   */
  private handleNodeClick(treeNode: any): void {
    if (treeNode.historyNode) {
      const node = treeNode.historyNode;
      if (node.itemId) {
        const ZoteroPane = Zotero.getActiveZoteroPane();
        if (ZoteroPane) {
          ZoteroPane.selectItem(node.itemId);
        }
      }
    } else if (treeNode.closedTab) {
      // 恢复关闭的标签
      this.closedTabsManager.restoreTab(treeNode.closedTab);
    }
  }

  /**
   * 清空所有历史
   */
  private async handleClearAll(): Promise<void> {
    if (
      this.window.confirm(
        "Are you sure you want to clear all history? This cannot be undone.",
      )
    ) {
      try {
        await this.historyService.clearAll(false);
        await this.refreshTree();
      } catch (error) {
        Zotero.logError(
          `[HistoryTreeSimple] Failed to clear history: ${error}`,
        );
      }
    }
  }

  /**
   * 显示错误
   */
  private showError(error: string): void {
    if (this.container) {
      this.container.innerHTML = `
        <div style="padding: 20px; text-align: center; color: #666;">
          <p>Failed to load tree view.</p>
          <p style="font-size: 12px; margin-top: 10px;">Error: ${error}</p>
        </div>
      `;
    }
  }
}
