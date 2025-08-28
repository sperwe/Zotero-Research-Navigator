/**
 * 历史树视图（整合已关闭标签页）
 */

import { getString } from "../../utils/locale";
import { HistoryNode, RelationType } from "../historyTree";

export class HistoryTreeView {
  private container: HTMLDivElement | null = null;
  private treeContainer: HTMLDivElement | null = null;
  private searchInput: HTMLInputElement | null = null;

  constructor(private addon: any) {}

  /**
   * 初始化视图
   */
  public async init() {
    // 监听标签页关闭事件
    this.registerTabCloseListener();
  }

  /**
   * 渲染视图
   */
  public async render(): Promise<HTMLElement> {
    const doc = this.addon.data.ztoolkit.getGlobal("document");

    // 创建容器
    this.container = this.addon.data.ztoolkit.UI.createElement(doc, "div", {
      classList: ["history-tree-view"],
      styles: {
        height: "100%",
        display: "flex",
        flexDirection: "column",
      },
    }) as HTMLDivElement;

    // 创建搜索栏
    const searchBar = this.createSearchBar();
    this.container.appendChild(searchBar);

    // 创建工具栏
    const toolbar = this.createToolbar();
    this.container.appendChild(toolbar);

    // 创建树容器
    this.treeContainer = this.addon.data.ztoolkit.UI.createElement(doc, "div", {
      classList: ["tree-container"],
      styles: {
        flex: "1",
        overflow: "auto",
        padding: "8px",
      },
    }) as HTMLDivElement;
    this.container.appendChild(this.treeContainer);

    // 渲染树
    await this.renderTree();

    return this.container;
  }

  /**
   * 创建搜索栏
   */
  private createSearchBar(): HTMLElement {
    const doc = this.addon.data.ztoolkit.getGlobal("document");

    const searchBar = this.addon.data.ztoolkit.UI.createElement(doc, "div", {
      classList: ["search-bar"],
      styles: {
        padding: "8px",
        borderBottom: "1px solid var(--material-border-quarternary)",
      },
    });

    this.searchInput = this.addon.data.ztoolkit.UI.createElement(doc, "input", {
      classList: ["search-input"],
      attributes: {
        type: "text",
        placeholder: getString("search-placeholder"),
      },
      styles: {
        width: "100%",
        padding: "4px 8px",
        border: "1px solid var(--material-border-quarternary)",
        borderRadius: "4px",
        fontSize: "13px",
      },
      listeners: [
        {
          type: "input",
          listener: this.onSearch.bind(this),
        },
      ],
    }) as HTMLInputElement;

    searchBar.appendChild(this.searchInput);
    return searchBar;
  }

  /**
   * 创建工具栏
   */
  private createToolbar(): HTMLElement {
    const doc = this.addon.data.ztoolkit.getGlobal("document");

    const toolbar = this.addon.data.ztoolkit.UI.createElement(doc, "div", {
      classList: ["tree-toolbar"],
      styles: {
        padding: "4px 8px",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        borderBottom: "1px solid var(--material-border-quarternary)",
      },
    });

    // 展开/折叠按钮
    const expandBtn = this.createToolbarButton("expand-all", () =>
      this.expandAll(),
    );
    const collapseBtn = this.createToolbarButton("collapse-all", () =>
      this.collapseAll(),
    );

    // 显示选项
    const showClosedCheckbox = this.addon.data.ztoolkit.UI.createElement(
      doc,
      "label",
      {
        styles: {
          display: "flex",
          alignItems: "center",
          gap: "4px",
          marginLeft: "auto",
          fontSize: "12px",
        },
        children: [
          {
            tag: "input",
            attributes: {
              type: "checkbox",
              checked: "true",
            },
            listeners: [
              {
                type: "change",
                listener: (e: Event) => {
                  this.showClosedTabs = (e.target as HTMLInputElement).checked;
                  this.renderTree();
                },
              },
            ],
          },
          {
            tag: "span",
            properties: {
              textContent: getString("show-closed-tabs"),
            },
          },
        ],
      },
    );

    toolbar.appendChild(expandBtn);
    toolbar.appendChild(collapseBtn);
    toolbar.appendChild(showClosedCheckbox);

    return toolbar;
  }

  /**
   * 创建工具栏按钮
   */
  private createToolbarButton(
    action: string,
    onclick: () => void,
  ): HTMLElement {
    const doc = this.addon.data.ztoolkit.getGlobal("document");

    return this.addon.data.ztoolkit.UI.createElement(doc, "button", {
      classList: ["toolbar-button"],
      attributes: {
        title: getString(`toolbar-${action}`),
      },
      styles: {
        padding: "2px 8px",
        border: "1px solid var(--material-border-quarternary)",
        borderRadius: "4px",
        backgroundColor: "var(--material-button)",
        cursor: "pointer",
        fontSize: "12px",
      },
      properties: {
        textContent: getString(`toolbar-${action}`),
      },
      listeners: [
        {
          type: "click",
          listener: onclick,
        },
      ],
    });
  }

  /**
   * 渲染树
   */
  private async renderTree() {
    if (!this.treeContainer) return;

    // 清空容器
    this.treeContainer.innerHTML = "";

    // 获取历史数据
    const nodes = await this.getHistoryNodes();

    // 按日期分组
    const groupedNodes = this.groupNodesByDate(nodes);

    // 渲染每个日期组
    for (const [date, nodes] of Object.entries(groupedNodes)) {
      const dateGroup = this.renderDateGroup(date, nodes);
      this.treeContainer.appendChild(dateGroup);
    }
  }

  /**
   * 获取历史节点（包括已关闭的标签页）
   */
  private async getHistoryNodes(): Promise<HistoryNode[]> {
    const nodes = this.addon.data.researchNavigator.getAllNodes();

    // 添加已关闭标签页状态
    await this.markClosedTabs(nodes);

    // 根据搜索词过滤
    if (this.searchInput?.value) {
      return this.filterNodes(nodes, this.searchInput.value);
    }

    return nodes;
  }

  /**
   * 标记已关闭的标签页
   */
  private async markClosedTabs(nodes: HistoryNode[]) {
    const Zotero_Tabs = this.addon.data.ztoolkit.getGlobal("Zotero_Tabs");

    // 获取当前打开的标签页ID
    const openTabIds = new Set<number>();
    if (Zotero_Tabs && Zotero_Tabs._tabs) {
      Zotero_Tabs._tabs.forEach((tab: any) => {
        if (tab.type === "reader" && tab.data?.itemID) {
          openTabIds.add(tab.data.itemID);
        }
      });
    }

    // 标记节点状态
    nodes.forEach((node) => {
      if (node.itemId) {
        node.isClosed = !openTabIds.has(node.itemId);
      }
    });

    // 从 Zotero_Tabs._history 获取关闭时间
    if (Zotero_Tabs && Zotero_Tabs._history) {
      const closedTabsMap = new Map<number, number>();

      Zotero_Tabs._history.forEach((entry: any[]) => {
        entry.forEach((tab: any) => {
          if (tab.data?.itemID) {
            closedTabsMap.set(tab.data.itemID, tab.closedAt || Date.now());
          }
        });
      });

      nodes.forEach((node) => {
        if (node.isClosed && closedTabsMap.has(node.itemId)) {
          node.closedAt = new Date(closedTabsMap.get(node.itemId)!);
        }
      });
    }
  }

  /**
   * 按日期分组节点
   */
  private groupNodesByDate(
    nodes: HistoryNode[],
  ): Record<string, HistoryNode[]> {
    const groups: Record<string, HistoryNode[]> = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    nodes.forEach((node) => {
      let dateKey: string;
      const nodeDate = node.lastVisit || node.timestamp;

      if (nodeDate >= today) {
        dateKey = getString("date-today");
      } else if (nodeDate >= yesterday) {
        dateKey = getString("date-yesterday");
      } else {
        dateKey = nodeDate.toLocaleDateString();
      }

      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(node);
    });

    // 按日期排序
    return Object.keys(groups)
      .sort((a, b) => {
        if (a === getString("date-today")) return -1;
        if (b === getString("date-today")) return 1;
        if (a === getString("date-yesterday")) return -1;
        if (b === getString("date-yesterday")) return 1;
        return new Date(b).getTime() - new Date(a).getTime();
      })
      .reduce(
        (acc, key) => {
          acc[key] = groups[key];
          return acc;
        },
        {} as Record<string, HistoryNode[]>,
      );
  }

  /**
   * 渲染日期分组
   */
  private renderDateGroup(date: string, nodes: HistoryNode[]): HTMLElement {
    const doc = this.addon.data.ztoolkit.getGlobal("document");

    const group = this.addon.data.ztoolkit.UI.createElement(doc, "div", {
      classList: ["date-group"],
      styles: {
        marginBottom: "16px",
      },
    });

    // 日期标题
    const header = this.addon.data.ztoolkit.UI.createElement(doc, "div", {
      classList: ["date-header"],
      styles: {
        fontWeight: "bold",
        fontSize: "14px",
        marginBottom: "8px",
        color: "var(--fill-secondary)",
      },
      properties: {
        textContent: `${date} (${nodes.length})`,
      },
    });
    group.appendChild(header);

    // 渲染节点树
    const tree = this.renderNodeTree(nodes);
    group.appendChild(tree);

    return group;
  }

  /**
   * 渲染节点树
   */
  private renderNodeTree(nodes: HistoryNode[]): HTMLElement {
    const doc = this.addon.data.ztoolkit.getGlobal("document");

    const tree = this.addon.data.ztoolkit.UI.createElement(doc, "div", {
      classList: ["node-tree"],
      styles: {
        paddingLeft: "8px",
      },
    });

    // 构建树结构
    const rootNodes = nodes.filter((node) => !node.parentId);
    rootNodes.forEach((node) => {
      const nodeElement = this.renderNode(node, nodes);
      tree.appendChild(nodeElement);
    });

    return tree;
  }

  /**
   * 渲染单个节点
   */
  private renderNode(node: HistoryNode, allNodes: HistoryNode[]): HTMLElement {
    const doc = this.addon.data.ztoolkit.getGlobal("document");

    const nodeElement = this.addon.data.ztoolkit.UI.createElement(doc, "div", {
      classList: ["tree-node", node.isClosed ? "closed" : ""],
      attributes: {
        "data-node-id": node.id,
      },
      styles: {
        marginBottom: "4px",
        opacity: node.isClosed ? "0.6" : "1",
      },
    });

    // 节点内容
    const content = this.addon.data.ztoolkit.UI.createElement(doc, "div", {
      classList: ["node-content"],
      styles: {
        display: "flex",
        alignItems: "center",
        padding: "4px",
        borderRadius: "4px",
        cursor: "pointer",
        fontSize: "13px",
      },
      listeners: [
        {
          type: "click",
          listener: () => this.onNodeClick(node),
        },
        {
          type: "contextmenu",
          listener: (e: MouseEvent) => this.onNodeRightClick(e, node),
        },
      ],
    });

    // 图标
    const icon = this.addon.data.ztoolkit.UI.createElement(doc, "span", {
      classList: ["node-icon"],
      styles: {
        marginRight: "8px",
        fontSize: "16px",
      },
      properties: {
        textContent: node.isClosed ? "💤" : "📄",
      },
    });
    content.appendChild(icon);

    // 标题
    const title = this.addon.data.ztoolkit.UI.createElement(doc, "span", {
      classList: ["node-title"],
      styles: {
        flex: "1",
        textDecoration: node.isClosed ? "line-through" : "none",
      },
      properties: {
        textContent: node.title,
      },
    });
    content.appendChild(title);

    // 关闭时间
    if (node.isClosed && node.closedAt) {
      const closedTime = this.addon.data.ztoolkit.UI.createElement(
        doc,
        "span",
        {
          classList: ["closed-time"],
          styles: {
            marginLeft: "8px",
            fontSize: "11px",
            color: "var(--fill-secondary)",
          },
          properties: {
            textContent: `(${node.closedAt.toLocaleTimeString()})`,
          },
        },
      );
      content.appendChild(closedTime);
    }

    // 笔记标记
    if (node.hasNotes) {
      const noteIndicator = this.addon.data.ztoolkit.UI.createElement(
        doc,
        "span",
        {
          classList: ["note-indicator"],
          styles: {
            marginLeft: "8px",
            fontSize: "12px",
          },
          properties: {
            textContent: "📝",
          },
        },
      );
      content.appendChild(noteIndicator);
    }

    nodeElement.appendChild(content);

    // 子节点
    const children = allNodes.filter((n) => n.parentId === node.id);
    if (children.length > 0) {
      const childrenContainer = this.addon.data.ztoolkit.UI.createElement(
        doc,
        "div",
        {
          classList: ["node-children"],
          styles: {
            paddingLeft: "20px",
            marginTop: "4px",
          },
        },
      );

      children.forEach((child) => {
        const childElement = this.renderNode(child, allNodes);
        childrenContainer.appendChild(childElement);
      });

      nodeElement.appendChild(childrenContainer);
    }

    return nodeElement;
  }

  /**
   * 节点点击处理
   */
  private async onNodeClick(node: HistoryNode) {
    if (node.isClosed) {
      // 恢复已关闭的标签页
      await this.restoreTab(node);
    } else {
      // 打开或切换到标签页
      await this.addon.hooks.onOpenItem(node.itemId);
    }
  }

  /**
   * 节点右键菜单
   */
  private onNodeRightClick(event: MouseEvent, node: HistoryNode) {
    event.preventDefault();

    // 创建右键菜单
    const menu = this.createContextMenu(node);
    menu.openPopupAtScreen(event.screenX, event.screenY);
  }

  /**
   * 创建右键菜单
   */
  private createContextMenu(node: HistoryNode): any {
    const doc = this.addon.data.ztoolkit.getGlobal("document");

    const menupopup = doc.createXULElement("menupopup");

    // 打开/恢复
    const openItem = doc.createXULElement("menuitem");
    openItem.setAttribute(
      "label",
      node.isClosed
        ? getString("menu-restore-tab")
        : getString("menu-open-tab"),
    );
    openItem.addEventListener("command", () => {
      if (node.isClosed) {
        this.restoreTab(node);
      } else {
        this.addon.hooks.onOpenItem(node.itemId);
      }
    });
    menupopup.appendChild(openItem);

    // 分隔线
    menupopup.appendChild(doc.createXULElement("menuseparator"));

    // 添加笔记
    const noteItem = doc.createXULElement("menuitem");
    noteItem.setAttribute("label", getString("menu-add-note"));
    noteItem.addEventListener("command", () => {
      this.addon.hooks.onAddNote(node);
    });
    menupopup.appendChild(noteItem);

    // 查看相关笔记
    if (node.hasNotes) {
      const viewNotesItem = doc.createXULElement("menuitem");
      viewNotesItem.setAttribute("label", getString("menu-view-notes"));
      viewNotesItem.addEventListener("command", () => {
        this.addon.hooks.onViewNotes(node);
      });
      menupopup.appendChild(viewNotesItem);
    }

    // 分隔线
    menupopup.appendChild(doc.createXULElement("menuseparator"));

    // 删除节点
    const deleteItem = doc.createXULElement("menuitem");
    deleteItem.setAttribute("label", getString("menu-delete-node"));
    deleteItem.addEventListener("command", () => {
      this.addon.hooks.onDeleteNode(node);
    });
    menupopup.appendChild(deleteItem);

    return menupopup;
  }

  /**
   * 恢复标签页
   */
  private async restoreTab(node: HistoryNode) {
    try {
      const Zotero_Tabs = this.addon.data.ztoolkit.getGlobal("Zotero_Tabs");

      // 尝试使用 Zotero 的恢复功能
      if (Zotero_Tabs && Zotero_Tabs.undoClose) {
        await Zotero_Tabs.undoClose();
      } else {
        // 直接打开
        await Zotero.Reader.open(node.itemId);
      }

      // 更新节点状态
      node.isClosed = false;
      node.closedAt = undefined;

      // 刷新视图
      await this.renderTree();
    } catch (e) {
      Zotero.logError(e);
      this.addon.hooks.onShowMessage(getString("error-restore-tab"), "error");
    }
  }

  /**
   * 搜索处理
   */
  private onSearch() {
    this.renderTree();
  }

  /**
   * 过滤节点
   */
  private filterNodes(nodes: HistoryNode[], query: string): HistoryNode[] {
    const lowerQuery = query.toLowerCase();
    return nodes.filter(
      (node) =>
        node.title.toLowerCase().includes(lowerQuery) ||
        node.tags.some((tag) => tag.toLowerCase().includes(lowerQuery)),
    );
  }

  /**
   * 展开所有节点
   */
  private expandAll() {
    const nodes = this.treeContainer?.querySelectorAll(".node-children");
    nodes?.forEach((node) => {
      (node as HTMLElement).style.display = "block";
    });
  }

  /**
   * 折叠所有节点
   */
  private collapseAll() {
    const nodes = this.treeContainer?.querySelectorAll(".node-children");
    nodes?.forEach((node) => {
      (node as HTMLElement).style.display = "none";
    });
  }

  /**
   * 监听标签页关闭事件
   */
  private registerTabCloseListener() {
    const notifierID = Zotero.Notifier.registerObserver(
      {
        notify: (event: string, type: string, ids: number[]) => {
          if (type === "tab" && event === "close") {
            // 刷新视图以更新已关闭的标签页
            this.renderTree();
          }
        },
      },
      ["tab"],
      "HistoryTreeView",
    );

    // 保存 notifierID 以便销毁时注销
    this.addon.data._historyTreeNotifierID = notifierID;
  }

  /**
   * 销毁视图
   */
  public destroy() {
    // 注销监听器
    if (this.addon.data._historyTreeNotifierID) {
      Zotero.Notifier.unregisterObserver(
        this.addon.data._historyTreeNotifierID,
      );
    }

    // 清理 DOM
    this.container = null;
    this.treeContainer = null;
    this.searchInput = null;
  }

  // 属性
  private showClosedTabs = true;
}
