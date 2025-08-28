/**
 * 历史树形标签页
 * 显示研究历史的树形结构，包括已关闭的标签页
 */

import { HistoryService } from "../../../services/history-service";
import { ClosedTabsManager } from "../../../managers/closed-tabs-manager";
import { ZoteroTabsIntegration, ZoteroTabData } from "../../../managers/zotero-tabs-integration";
import { HistoryNode } from "../../../services/database-service";

export class HistoryTreeTab {
  private container: HTMLElement | null = null;
  private treeContainer: HTMLElement | null = null;
  private searchInput: HTMLInputElement | null = null;
  private tabsIntegration: ZoteroTabsIntegration;
  
  constructor(
    private window: Window,
    private historyService: HistoryService,
    private closedTabsManager: ClosedTabsManager
  ) {
    this.tabsIntegration = new ZoteroTabsIntegration();
    this.tabsIntegration.addHistoryChangeListener(() => this.refresh());
  }
  
  create(container: HTMLElement): void {
    this.container = container;
    const doc = this.window.document;
    
    // 创建搜索栏
    const searchBar = doc.createElement("div");
    searchBar.className = "history-search-bar";
    searchBar.style.cssText = `
      padding: 10px;
      border-bottom: 1px solid var(--material-border-quarternary);
    `;
    
    this.searchInput = doc.createElement("input");
    this.searchInput.type = "text";
    this.searchInput.placeholder = "Search history...";
    this.searchInput.style.cssText = `
      width: 100%;
      padding: 5px 10px;
      border: 1px solid var(--material-border-quarternary);
      border-radius: 3px;
      background: var(--material-background);
      color: var(--fill-primary);
    `;
    this.searchInput.addEventListener("input", () => this.onSearch());
    
    searchBar.appendChild(this.searchInput);
    container.appendChild(searchBar);
    
    // 创建工具栏
    const toolbar = doc.createElement("div");
    toolbar.className = "history-toolbar";
    toolbar.style.cssText = `
      padding: 5px 10px;
      display: flex;
      gap: 10px;
      border-bottom: 1px solid var(--material-border-quarternary);
    `;
    
    // 刷新按钮
    const refreshBtn = doc.createElement("button");
    refreshBtn.textContent = "Refresh";
    refreshBtn.addEventListener("click", () => this.refresh());
    toolbar.appendChild(refreshBtn);
    
    // 测试按钮 - 创建测试数据
    const testBtn = doc.createElement("button");
    testBtn.textContent = "Create Test Data";
    testBtn.style.cssText = `
      background: #4CAF50;
      color: white;
    `;
    testBtn.addEventListener("click", async () => {
      await this.createTestData();
      this.refresh();
    });
    toolbar.appendChild(testBtn);
    
    // 清除已关闭标签页按钮
    const clearClosedBtn = doc.createElement("button");
    clearClosedBtn.textContent = "Clear Closed Tabs";
    clearClosedBtn.addEventListener("click", () => this.clearClosedTabs());
    toolbar.appendChild(clearClosedBtn);
    
    // 展开/折叠按钮
    const expandBtn = doc.createElement("button");
    expandBtn.textContent = "Expand All";
    expandBtn.addEventListener("click", () => this.expandAll());
    toolbar.appendChild(expandBtn);
    
    const collapseBtn = doc.createElement("button");
    collapseBtn.textContent = "Collapse All";
    collapseBtn.addEventListener("click", () => this.collapseAll());
    toolbar.appendChild(collapseBtn);
    
    container.appendChild(toolbar);
    
    // 创建树形容器
    this.treeContainer = doc.createElement("div");
    this.treeContainer.className = "history-tree-container";
    this.treeContainer.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 10px;
    `;
    
    container.appendChild(this.treeContainer);
    
    // 初始加载
    this.refresh();
  }
  
  /**
   * 刷新历史树
   */
  async refresh(): Promise<void> {
    if (!this.treeContainer) return;
    
    Zotero.log("[HistoryTreeTab] Refreshing history tree", "info");
    
    const doc = this.window.document;
    this.treeContainer.innerHTML = "";
    
    // 获取会话历史
    const sessions = this.historyService.getAllSessions();
    Zotero.log(`[HistoryTreeTab] Found ${sessions.length} sessions`, "info");
    
    // 获取已关闭的标签页组
    const closedGroups = this.tabsIntegration.getClosedTabs();
    
    // 创建根节点
    const rootList = doc.createElement("ul");
    rootList.className = "history-tree-root";
    rootList.style.cssText = `
      list-style: none;
      padding: 0;
      margin: 0;
    `;
    
    // 添加已关闭标签页部分
    if (closedGroups.length > 0) {
      const closedSection = this.createClosedTabsSection(doc, closedGroups);
      rootList.appendChild(closedSection);
    }
    
    // 添加会话历史
    for (const session of sessions) {
      const sessionNode = this.createSessionNode(doc, session);
      rootList.appendChild(sessionNode);
    }
    
    this.treeContainer.appendChild(rootList);
  }
  
  /**
   * 创建已关闭标签页部分
   */
  private createClosedTabsSection(doc: Document, groups: any[]): HTMLElement {
    const li = doc.createElement("li");
    li.className = "history-closed-section";
    li.style.cssText = `
      margin-bottom: 15px;
      border: 1px solid var(--material-border-quarternary);
      border-radius: 5px;
      padding: 10px;
      background: var(--material-sidepane);
    `;
    
    // 标题
    const header = doc.createElement("div");
    header.style.cssText = `
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: bold;
      margin-bottom: 10px;
      cursor: pointer;
    `;
    
    const icon = doc.createElement("span");
    icon.textContent = "🗑️";
    header.appendChild(icon);
    
    const title = doc.createElement("span");
    title.textContent = `Recently Closed (${groups.length} groups)`;
    header.appendChild(title);
    
    li.appendChild(header);
    
    // 创建列表
    const list = doc.createElement("ul");
    list.style.cssText = `
      list-style: none;
      padding-left: 20px;
      margin: 0;
    `;
    
    // 添加每个关闭组
    for (const group of groups.slice(0, 10)) { // 只显示最近10个
      const groupNode = this.createClosedGroupNode(doc, group);
      list.appendChild(groupNode);
    }
    
    li.appendChild(list);
    
    // 折叠功能
    let expanded = true;
    header.addEventListener("click", () => {
      expanded = !expanded;
      list.style.display = expanded ? "block" : "none";
      icon.textContent = expanded ? "🗑️" : "📁";
    });
    
    return li;
  }
  
  /**
   * 创建已关闭标签页组节点
   */
  private createClosedGroupNode(doc: Document, group: any): HTMLElement {
    const li = doc.createElement("li");
    li.style.cssText = `
      margin: 5px 0;
      padding: 5px;
      border-radius: 3px;
      transition: background 0.2s;
    `;
    
    // 鼠标悬停效果
    li.addEventListener("mouseenter", () => {
      li.style.background = "var(--material-mix-quinary)";
    });
    
    li.addEventListener("mouseleave", () => {
      li.style.background = "";
    });
    
    // 时间戳
    const time = doc.createElement("div");
    time.style.cssText = `
      font-size: 0.9em;
      color: var(--fill-secondary);
      margin-bottom: 5px;
    `;
    time.textContent = new Date(group.closedAt).toLocaleString();
    li.appendChild(time);
    
    // 标签页列表
    const tabList = doc.createElement("ul");
    tabList.style.cssText = `
      list-style: none;
      padding-left: 15px;
      margin: 0;
    `;
    
    for (const tab of group.tabs) {
      const tabNode = this.createClosedTabNode(doc, tab);
      tabList.appendChild(tabNode);
    }
    
    li.appendChild(tabList);
    
    // 恢复按钮
    const restoreBtn = doc.createElement("button");
    restoreBtn.textContent = "Restore All";
    restoreBtn.style.cssText = `
      margin-top: 5px;
      padding: 3px 8px;
      font-size: 0.9em;
      cursor: pointer;
    `;
    restoreBtn.addEventListener("click", async () => {
      for (const tab of group.tabs) {
        await this.tabsIntegration.restoreTab(tab);
      }
    });
    
    li.appendChild(restoreBtn);
    
    return li;
  }
  
  /**
   * 创建已关闭标签页节点
   */
  private createClosedTabNode(doc: Document, tab: ZoteroTabData): HTMLElement {
    const li = doc.createElement("li");
    li.style.cssText = `
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 3px 5px;
      cursor: pointer;
      border-radius: 3px;
    `;
    
    // 图标
    const icon = doc.createElement("span");
    icon.textContent = this.getTabIcon(tab.type);
    li.appendChild(icon);
    
    // 标题
    const title = doc.createElement("span");
    title.style.flex = "1";
    title.textContent = tab.title;
    li.appendChild(title);
    
    // 点击恢复
    li.addEventListener("click", async () => {
      await this.tabsIntegration.restoreTab(tab);
    });
    
    // 悬停效果
    li.addEventListener("mouseenter", () => {
      li.style.background = "var(--material-mix-quinary)";
    });
    
    li.addEventListener("mouseleave", () => {
      li.style.background = "";
    });
    
    return li;
  }
  
  /**
   * 创建会话节点
   */
  private createSessionNode(doc: Document, session: any): HTMLElement {
    const li = doc.createElement("li");
    li.className = "history-session";
    li.style.cssText = `
      margin: 10px 0;
    `;
    
    // 会话标题
    const header = doc.createElement("div");
    header.style.cssText = `
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 5px;
      cursor: pointer;
      font-weight: bold;
    `;
    
    const icon = doc.createElement("span");
    icon.textContent = "📅";
    header.appendChild(icon);
    
    const title = doc.createElement("span");
    title.style.flex = "1";
    title.textContent = `${session.name || 'Session'} (${session.nodes.length} items)`;
    header.appendChild(title);
    
    // 删除按钮
    const deleteBtn = doc.createElement("button");
    deleteBtn.textContent = "×";
    deleteBtn.title = "Delete session";
    deleteBtn.style.cssText = `
      background: #ff4444;
      color: white;
      border: none;
      border-radius: 3px;
      padding: 2px 8px;
      cursor: pointer;
      font-size: 16px;
      font-weight: bold;
    `;
    deleteBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (this.window.confirm(`Delete session "${session.name}"?`)) {
        await this.deleteSession(session.id);
      }
    });
    header.appendChild(deleteBtn);
    
    li.appendChild(header);
    
    // 创建节点列表
    const nodeList = doc.createElement("ul");
    nodeList.style.cssText = `
      list-style: none;
      padding-left: 20px;
      margin: 0;
    `;
    
    // 获取会话的根节点
    const rootNodes = this.historyService.getSessionNodes(session.id)
      .filter((node: HistoryNode) => !node.parentId);
    
    for (const node of rootNodes) {
      const nodeElement = this.createHistoryNode(doc, node);
      nodeList.appendChild(nodeElement);
    }
    
    li.appendChild(nodeList);
    
    // 折叠功能
    let expanded = false;
    nodeList.style.display = "none";
    
    header.addEventListener("click", () => {
      expanded = !expanded;
      nodeList.style.display = expanded ? "block" : "none";
      icon.textContent = expanded ? "📂" : "📅";
    });
    
    return li;
  }
  
  /**
   * 创建历史节点
   */
  private createHistoryNode(doc: Document, node: HistoryNode): HTMLElement {
    const li = doc.createElement("li");
    li.className = `history-node ${node.status}`;
    li.style.cssText = `
      margin: 3px 0;
    `;
    
    // 节点内容
    const content = doc.createElement("div");
    content.style.cssText = `
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 3px 5px;
      cursor: pointer;
      border-radius: 3px;
      opacity: ${node.status === "closed" ? "0.6" : "1"};
    `;
    
    // 图标
    const icon = doc.createElement("span");
    icon.textContent = node.status === "active" ? "📖" : 
                       node.status === "closed" ? "📕" : "📘";
    content.appendChild(icon);
    
    // 标题
    const title = doc.createElement("span");
    title.style.flex = "1";
    title.textContent = node.title || `Item ${node.itemId}`;
    content.appendChild(title);
    
    // 时间
    const time = doc.createElement("span");
    time.style.cssText = `
      font-size: 0.8em;
      color: var(--fill-secondary);
    `;
    time.textContent = new Date(node.timestamp).toLocaleTimeString();
    content.appendChild(time);
    
    li.appendChild(content);
    
    // 点击打开
    content.addEventListener("click", async () => {
      if (node.itemId) {
        await this.openItem(node.itemId);
      }
    });
    
    // 右键菜单
    content.addEventListener("contextmenu", async (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      // 创建上下文菜单
      const menu = doc.createElement("div");
      menu.style.cssText = `
        position: absolute;
        left: ${e.pageX}px;
        top: ${e.pageY}px;
        background: var(--material-background);
        border: 1px solid var(--material-border-quarternary);
        border-radius: 5px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        padding: 5px 0;
        z-index: 1000;
        min-width: 150px;
      `;
      
      // 删除选项
      const deleteOption = doc.createElement("div");
      deleteOption.textContent = "Delete Node";
      deleteOption.style.cssText = `
        padding: 8px 15px;
        cursor: pointer;
        color: #ff4444;
      `;
      deleteOption.addEventListener("mouseenter", () => {
        deleteOption.style.background = "var(--material-mix-quinary)";
      });
      deleteOption.addEventListener("mouseleave", () => {
        deleteOption.style.background = "";
      });
      deleteOption.addEventListener("click", async () => {
        doc.body.removeChild(menu);
        if (this.window.confirm(`Delete history node "${node.title}"?`)) {
          await this.deleteNode(node);
        }
      });
      menu.appendChild(deleteOption);
      
      // 在库中显示选项
      if (node.itemId) {
        const showInLibraryOption = doc.createElement("div");
        showInLibraryOption.textContent = "Show in Library";
        showInLibraryOption.style.cssText = `
          padding: 8px 15px;
          cursor: pointer;
        `;
        showInLibraryOption.addEventListener("mouseenter", () => {
          showInLibraryOption.style.background = "var(--material-mix-quinary)";
        });
        showInLibraryOption.addEventListener("mouseleave", () => {
          showInLibraryOption.style.background = "";
        });
        showInLibraryOption.addEventListener("click", async () => {
          doc.body.removeChild(menu);
          await this.showInLibrary(node.itemId);
        });
        menu.appendChild(showInLibraryOption);
      }
      
      // 点击其他地方关闭菜单
      const closeMenu = () => {
        if (doc.body.contains(menu)) {
          doc.body.removeChild(menu);
        }
        doc.removeEventListener("click", closeMenu);
      };
      setTimeout(() => doc.addEventListener("click", closeMenu), 0);
      
      doc.body.appendChild(menu);
    });
    
    // 悬停效果
    content.addEventListener("mouseenter", () => {
      content.style.background = "var(--material-mix-quinary)";
    });
    
    content.addEventListener("mouseleave", () => {
      content.style.background = "";
    });
    
    // 子节点
    const children = this.historyService.getChildNodes(node.id);
    if (children.length > 0) {
      const childList = doc.createElement("ul");
      childList.style.cssText = `
        list-style: none;
        padding-left: 20px;
        margin: 0;
      `;
      
      for (const child of children) {
        const childElement = this.createHistoryNode(doc, child);
        childList.appendChild(childElement);
      }
      
      li.appendChild(childList);
    }
    
    return li;
  }
  
  /**
   * 获取标签页图标
   */
  private getTabIcon(type: string): string {
    switch (type) {
      case "reader": return "📄";
      case "library": return "📚";
      case "search": return "🔍";
      case "note": return "📝";
      default: return "📋";
    }
  }
  
  /**
   * 打开条目
   */
  private async openItem(itemId: number): Promise<void> {
    try {
      const item = await Zotero.Items.getAsync(itemId);
      if (item) {
        if (item.isRegularItem() && item.isTopLevelItem()) {
          // 打开 PDF
          const attachment = await item.getBestAttachment();
          if (attachment) {
            await Zotero.Reader.open(attachment.id);
          }
        } else if (item.isNote()) {
          // 打开笔记
          Zotero.openNoteWindow(item.id);
        }
      }
    } catch (error) {
      Zotero.logError(error);
    }
  }
  
  /**
   * 搜索
   */
  private onSearch(): void {
    const query = this.searchInput?.value.toLowerCase() || "";
    if (!query) {
      this.refresh();
      return;
    }
    
    const doc = this.window.document;
    
    // 获取所有节点和会话元素
    const allNodes = this.treeContainer?.querySelectorAll(".history-node") || [];
    const allSessions = this.treeContainer?.querySelectorAll(".history-session") || [];
    
    // 过滤节点
    let matchedNodeCount = 0;
    allNodes.forEach((nodeElement: any) => {
      const nodeText = nodeElement.textContent?.toLowerCase() || "";
      const matches = nodeText.includes(query);
      
      if (matches) {
        nodeElement.style.display = "";
        matchedNodeCount++;
        
        // 确保父元素也显示
        let parent = nodeElement.parentElement;
        while (parent && parent !== this.treeContainer) {
          if (parent.style) parent.style.display = "";
          parent = parent.parentElement;
        }
      } else {
        nodeElement.style.display = "none";
      }
    });
    
    // 处理会话 - 如果会话内没有匹配的节点，隐藏整个会话
    allSessions.forEach((sessionElement: any) => {
      const visibleNodes = sessionElement.querySelectorAll(".history-node:not([style*='display: none'])");
      if (visibleNodes.length === 0) {
        sessionElement.style.display = "none";
      }
    });
    
    // 显示搜索结果统计
    if (this.searchInput) {
      this.searchInput.title = `Found ${matchedNodeCount} items`;
    }
    
    Zotero.log(`[HistoryTreeTab] Search: "${query}" - found ${matchedNodeCount} items`, "info");
  }
  
  /**
   * 创建测试数据
   */
  private async createTestData(): Promise<void> {
    Zotero.log("[HistoryTreeTab] Creating test data...", "info");
    
    try {
      // 获取库中的一些项目
      const items = await Zotero.Items.getAll(1); // 从库 1 获取所有项目
      const regularItems = items.filter((item: any) => item.isRegularItem()).slice(0, 5); // 获取前5个常规项目
      
      if (regularItems.length === 0) {
        this.window.alert("No items found in library. Please add some items first.");
        return;
      }
      
      // 为每个项目创建历史节点
      for (const item of regularItems) {
        await this.historyService.createOrUpdateNode(item.id);
        Zotero.log(`[HistoryTreeTab] Created history node for item: ${item.getField('title')}`, "info");
      }
      
      this.window.alert(`Created history nodes for ${regularItems.length} items`);
    } catch (error) {
      Zotero.logError(`[HistoryTreeTab] Failed to create test data: ${error}`);
      this.window.alert(`Failed to create test data: ${error}`);
    }
  }
  
  /**
   * 清除已关闭标签页
   */
  private clearClosedTabs(): void {
    if (this.window.confirm("Clear all closed tabs history?")) {
      this.tabsIntegration.clearHistory();
      this.refresh();
    }
  }
  
  /**
   * 删除会话
   */
  private async deleteSession(sessionId: string): Promise<void> {
    try {
      // 获取该会话的所有节点
      const nodes = this.historyService.getSessionNodes(sessionId);
      
      // 删除每个节点
      for (const node of nodes) {
        await this.historyService.deleteNode(node.id);
      }
      
      Zotero.log(`[HistoryTreeTab] Deleted session ${sessionId} with ${nodes.length} nodes`, "info");
      
      // 刷新显示
      this.refresh();
    } catch (error) {
      Zotero.logError(`[HistoryTreeTab] Failed to delete session: ${error}`);
      this.window.alert(`Failed to delete session: ${error}`);
    }
  }
  
  /**
   * 删除单个节点
   */
  private async deleteNode(node: HistoryNode): Promise<void> {
    try {
      await this.historyService.deleteNode(node.id);
      Zotero.log(`[HistoryTreeTab] Deleted node ${node.id}`, "info");
      this.refresh();
    } catch (error) {
      Zotero.logError(`[HistoryTreeTab] Failed to delete node: ${error}`);
      this.window.alert(`Failed to delete node: ${error}`);
    }
  }
  
  /**
   * 在库中显示项目
   */
  private async showInLibrary(itemId: number): Promise<void> {
    try {
      const ZoteroPane = Zotero.getActiveZoteroPane();
      if (ZoteroPane) {
        await ZoteroPane.selectItem(itemId);
      }
    } catch (error) {
      Zotero.logError(`[HistoryTreeTab] Failed to show item in library: ${error}`);
    }
  }

  /**
   * 展开所有
   */
  private expandAll(): void {
    const lists = this.treeContainer?.querySelectorAll("ul");
    lists?.forEach(list => {
      (list as HTMLElement).style.display = "block";
    });
  }
  
  /**
   * 折叠所有
   */
  private collapseAll(): void {
    const lists = this.treeContainer?.querySelectorAll(".history-tree-root > li > ul");
    lists?.forEach(list => {
      (list as HTMLElement).style.display = "none";
    });
  }
  
  /**
   * 销毁
   */
  destroy(): void {
    this.tabsIntegration.removeHistoryChangeListener(() => this.refresh());
    this.tabsIntegration.destroy();
    this.container = null;
    this.treeContainer = null;
    this.searchInput = null;
  }
}