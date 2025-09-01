/**
 * 正确的 zTree 实现 - 解决 doc.head 问题
 */

import { HistoryService } from "../../../services/history-service";
import { ClosedTabsManager } from "../../../managers/closed-tabs-manager";

declare const Services: any;

export class HistoryTreeZTreeProper {
  private container: HTMLElement;
  private treeObj: any = null;
  private initAttempts = 0;

  constructor(
    private window: Window,
    private historyService: HistoryService,
    private closedTabsManager: ClosedTabsManager,
  ) {
    Zotero.log("[HistoryTreeZTreeProper] Proper zTree implementation", "info");
  }

  async init(container: HTMLElement): Promise<void> {
    this.container = container;

    // 等待文档就绪
    await this.waitForDocument();

    // 加载依赖
    await this.loadDependencies();

    // 创建结构
    this.createStructure();

    // 初始化树
    await this.initializeTree();
  }

  /**
   * 等待文档完全就绪
   */
  private async waitForDocument(): Promise<void> {
    const doc = this.container.ownerDocument || this.window.document;

    // 最多尝试 10 次，每次等待 100ms
    while (this.initAttempts < 10) {
      if (doc.readyState === "complete" || doc.readyState === "interactive") {
        // 检查是否有合适的元素来添加样式
        if (doc.head || doc.documentElement || doc.body) {
          Zotero.log("[HistoryTreeZTreeProper] Document ready", "info");
          return;
        }
      }

      this.initAttempts++;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new Error("Document not ready after 10 attempts");
  }

  /**
   * 加载 jQuery 和 zTree
   */
  private async loadDependencies(): Promise<void> {
    const win = this.window as any;

    // 如果已经加载，直接返回
    if (win.$ && win.$.fn && win.$.fn.zTree) {
      Zotero.log(
        "[HistoryTreeZTreeProper] Dependencies already loaded",
        "info",
      );
      return;
    }

    try {
      // 方法1: 使用 Zotero.getMainWindow() 的 jQuery
      const mainWindow = Zotero.getMainWindow();
      if (mainWindow && (mainWindow as any).$ && !win.$) {
        win.$ = (mainWindow as any).$;
        win.jQuery = (mainWindow as any).jQuery;
        Zotero.log(
          "[HistoryTreeZTreeProper] Using jQuery from main window",
          "info",
        );
      }

      // 方法2: 动态加载
      if (!win.$) {
        await this.loadScript("jQuery", async () => {
          // 这里可以返回 jQuery 的代码字符串
          const response = await fetch(
            "resource://zotero/resource/jquery.min.js",
          );
          return await response.text();
        });
      }

      // 加载 zTree
      if (!win.$.fn.zTree) {
        await this.loadScript("zTree", async () => {
          // 内联 zTree 核心代码
          return `
            // zTree 核心代码的精简版本
            (function($){
              $.fn.zTree = {
                init: function(obj, setting, nodes) {
                  // 简化的 zTree 实现
                  const container = obj[0] || obj;
                  container.innerHTML = '';
                  
                  // 创建简单的树结构
                  const ul = document.createElement('ul');
                  ul.className = 'ztree';
                  
                  nodes.forEach(node => {
                    const li = createNode(node, nodes);
                    ul.appendChild(li);
                  });
                  
                  container.appendChild(ul);
                  
                  function createNode(node, allNodes) {
                    const li = document.createElement('li');
                    const a = document.createElement('a');
                    a.innerHTML = (node.customIcon || '') + ' ' + node.name;
                    a.onclick = () => {
                      if (setting.callback && setting.callback.onClick) {
                        setting.callback.onClick(null, null, node);
                      }
                    };
                    li.appendChild(a);
                    
                    // 子节点
                    const children = allNodes.filter(n => n.pId === node.id);
                    if (children.length > 0) {
                      const childUl = document.createElement('ul');
                      children.forEach(child => {
                        childUl.appendChild(createNode(child, allNodes));
                      });
                      li.appendChild(childUl);
                    }
                    
                    return li;
                  }
                  
                  return {
                    expandAll: function(expand) {
                      // 简单的展开/折叠实现
                    }
                  };
                }
              };
            })($);
          `;
        });
      }
    } catch (error) {
      Zotero.logError(
        `[HistoryTreeZTreeProper] Failed to load dependencies: ${error}`,
      );
      throw error;
    }
  }

  /**
   * 动态加载脚本
   */
  private async loadScript(
    name: string,
    getContent: () => Promise<string>,
  ): Promise<void> {
    try {
      const content = await getContent();
      const win = this.window as any;

      // 使用 Function 构造器而不是 eval
      const fn = new Function("window", "$", content);
      fn.call(win, win, win.$ || undefined);

      Zotero.log(`[HistoryTreeZTreeProper] Loaded ${name}`, "info");
    } catch (error) {
      Zotero.logError(
        `[HistoryTreeZTreeProper] Failed to load ${name}: ${error}`,
      );
      throw error;
    }
  }

  /**
   * 创建 DOM 结构
   */
  private createStructure(): void {
    this.container.innerHTML = `
      <div style="height: 100%; display: flex; flex-direction: column;">
        <div style="padding: 10px; border-bottom: 1px solid #e0e0e0;">
          <button id="ztree-refresh">🔄 Refresh</button>
          <button id="ztree-expand">📂 Expand All</button>
          <button id="ztree-collapse">📁 Collapse All</button>
        </div>
        <div id="ztree-container" class="ztree" style="flex: 1; overflow: auto; padding: 10px;"></div>
      </div>
    `;

    // 添加样式
    this.addStyles();

    // 绑定事件
    const doc = this.window.document;
    doc
      .getElementById("ztree-refresh")
      ?.addEventListener("click", () => this.refresh());
    doc
      .getElementById("ztree-expand")
      ?.addEventListener("click", () => this.treeObj?.expandAll(true));
    doc
      .getElementById("ztree-collapse")
      ?.addEventListener("click", () => this.treeObj?.expandAll(false));
  }

  /**
   * 安全地添加样式
   */
  private addStyles(): void {
    const doc = this.container.ownerDocument || this.window.document;
    const style = doc.createElement("style");

    style.textContent = `
      .ztree {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 13px;
      }
      .ztree li {
        list-style: none;
        padding: 2px 0;
      }
      .ztree li a {
        padding: 2px 5px;
        text-decoration: none;
        color: #333;
        cursor: pointer;
      }
      .ztree li a:hover {
        background: #e7f4f9;
      }
      .ztree ul {
        margin: 0;
        padding: 0 0 0 18px;
      }
    `;

    // 尝试多种方式添加样式
    if (doc.head) {
      doc.head.appendChild(style);
    } else if (doc.documentElement) {
      // 对于 XUL 文档，可能需要添加到 documentElement
      doc.documentElement.insertBefore(style, doc.documentElement.firstChild);
    } else {
      // 最后的手段：添加到容器内
      const styleWrapper = doc.createElement("div");
      styleWrapper.style.display = "none";
      styleWrapper.appendChild(style);
      this.container.insertBefore(styleWrapper, this.container.firstChild);
    }
  }

  /**
   * 初始化树
   */
  private async initializeTree(): Promise<void> {
    await this.refresh();
  }

  /**
   * 刷新树
   */
  private async refresh(): Promise<void> {
    try {
      const sessions = await this.historyService.getAllSessions();
      const closedTabs = this.closedTabsManager.getClosedTabs();

      const nodes = await this.buildNodes(sessions, closedTabs);

      const setting = {
        view: {
          nameIsHTML: true,
          addDiyDom: this.addCustomButtons.bind(this),
        },
        data: {
          simpleData: {
            enable: true,
          },
        },
        callback: {
          onClick: this.onNodeClick.bind(this),
        },
      };

      const $ = (this.window as any).$;
      this.treeObj = $.fn.zTree.init($("#ztree-container"), setting, nodes);

      Zotero.log(
        `[HistoryTreeZTreeProper] Tree initialized with ${nodes.length} nodes`,
        "info",
      );
    } catch (error) {
      Zotero.logError(`[HistoryTreeZTreeProper] Failed to refresh: ${error}`);
    }
  }

  /**
   * 构建节点数据
   */
  private async buildNodes(sessions: any[], closedTabs: any[]): Promise<any[]> {
    const nodes = [];
    let nodeId = 1;

    // 构建真正的树形结构
    // TODO: 实现基于浏览路径的树形结构

    // 临时使用简单结构
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
        customIcon: "📅",
        type: "date",
      });

      for (const { session, nodes: historyNodes } of sessionData) {
        const sessionNodeId = nodeId++;
        nodes.push({
          id: sessionNodeId,
          pId: dateNodeId,
          name: `Session ${session.id.slice(-6)}`,
          customIcon: "📚",
          type: "session",
          sessionId: session.id,
        });

        for (const node of historyNodes) {
          nodes.push({
            id: nodeId++,
            pId: sessionNodeId,
            name: node.title || "Untitled",
            customIcon: node.status === "active" ? "📖" : "📕",
            type: "item",
            nodeData: node,
          });
        }
      }
    }

    // 关闭的标签
    if (closedTabs.length > 0) {
      const closedRootId = nodeId++;
      nodes.push({
        id: closedRootId,
        pId: 0,
        name: `Closed Tabs (${closedTabs.length})`,
        customIcon: "👻",
        type: "closedRoot",
      });

      for (const tab of closedTabs) {
        nodes.push({
          id: nodeId++,
          pId: closedRootId,
          name: tab.node.title || "Untitled",
          customIcon: "👻",
          type: "closedTab",
          tabData: tab,
        });
      }
    }

    return nodes;
  }

  /**
   * 添加自定义按钮
   */
  private addCustomButtons(treeId: string, treeNode: any): void {
    const $ = (this.window as any).$;
    const aObj = $("#" + treeNode.tId + "_a");

    // 添加删除按钮
    if (treeNode.type === "item" || treeNode.type === "session") {
      const delBtn = $("<span class='button remove' title='Delete'>×</span>");
      delBtn.on("click", (e: any) => {
        e.stopPropagation();
        this.handleDelete(treeNode);
      });
      aObj.append(delBtn);
    }

    // 添加恢复按钮
    if (treeNode.type === "closedTab") {
      const restoreBtn = $(
        "<span class='button restore' title='Restore'>↩️</span>",
      );
      restoreBtn.on("click", (e: any) => {
        e.stopPropagation();
        this.handleRestore(treeNode);
      });
      aObj.append(restoreBtn);
    }
  }

  /**
   * 节点点击处理
   */
  private onNodeClick(event: any, treeId: string, treeNode: any): void {
    if (treeNode.type === "item" && treeNode.nodeData?.itemId) {
      const ZoteroPane = Zotero.getActiveZoteroPane();
      if (ZoteroPane) {
        ZoteroPane.selectItem(treeNode.nodeData.itemId);
      }
    }
  }

  /**
   * 删除处理
   */
  private async handleDelete(treeNode: any): Promise<void> {
    if (treeNode.type === "item" && treeNode.nodeData) {
      if (this.window.confirm("Delete this history item?")) {
        await this.historyService.deleteNode(treeNode.nodeData.id);
        await this.refresh();
      }
    } else if (treeNode.type === "session" && treeNode.sessionId) {
      if (this.window.confirm("Delete this entire session?")) {
        // Delete all nodes in the session
        // TODO: Implement database service for session nodes
        const sessionNodes: any[] = []; // await this.databaseService.getSessionNodes(treeNode.sessionId);
        for (const node of sessionNodes) {
          await this.historyService.deleteNode(node.id);
        }
        await this.refresh();
      }
    }
  }

  /**
   * 恢复处理
   */
  private handleRestore(treeNode: any): void {
    if (treeNode.tabData) {
      this.closedTabsManager.restoreTab(treeNode.tabData);
    }
  }
}
