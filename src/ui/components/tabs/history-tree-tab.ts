/**
 * 历史树标签页
 */

import { HistoryService } from "../../../services/history-service";
import { ClosedTabsManager } from "../../../managers/closed-tabs-manager";
import { HistoryNode } from "../../../services/database-service";

export interface HistoryTreeTabOptions {
  historyService: HistoryService;
  closedTabsManager: ClosedTabsManager;
}

export class HistoryTreeTab {
  private container: HTMLElement | null = null;
  private searchInput: HTMLInputElement | null = null;
  private treeContainer: HTMLElement | null = null;
  private searchQuery = "";
  
  constructor(
    private window: Window,
    private options: HistoryTreeTabOptions
  ) {}
  
  async initialize(): Promise<void> {
    // 初始化
  }
  
  render(): HTMLElement {
    const doc = this.window.document;
    
    this.container = doc.createElement("div");
    this.container.className = "history-tree-tab";
    this.container.style.cssText = `
      height: 100%;
      display: flex;
      flex-direction: column;
    `;
    
    // 搜索栏
    const searchBar = this.createSearchBar(doc);
    this.container.appendChild(searchBar);
    
    // 树容器
    this.treeContainer = doc.createElement("div");
    this.treeContainer.className = "tree-container";
    this.treeContainer.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 8px;
    `;
    this.container.appendChild(this.treeContainer);
    
    // 渲染树
    this.renderTree();
    
    return this.container;
  }
  
  /**
   * 创建搜索栏
   */
  private createSearchBar(doc: Document): HTMLElement {
    const searchBar = doc.createElement("div");
    searchBar.className = "search-bar";
    searchBar.style.cssText = `
      padding: 8px;
      border-bottom: 1px solid var(--panel-border);
    `;
    
    this.searchInput = doc.createElement("input");
    this.searchInput.type = "text";
    this.searchInput.placeholder = "Search history...";
    this.searchInput.style.cssText = `
      width: 100%;
      padding: 6px 10px;
      border: 1px solid var(--panel-border);
      border-radius: 4px;
      background: var(--panel-background);
      color: var(--text-color);
      font-size: 13px;
    `;
    
    this.searchInput.addEventListener("input", () => {
      this.searchQuery = this.searchInput!.value;
      this.renderTree();
    });
    
    searchBar.appendChild(this.searchInput);
    return searchBar;
  }
  
  /**
   * 渲染树
   */
  private async renderTree(): Promise<void> {
    if (!this.treeContainer) return;
    
    this.treeContainer.innerHTML = "";
    
    // 获取所有节点
    const allNodes = await this.options.historyService.databaseService.getAllHistoryNodes();
    
    // 过滤节点
    const filteredNodes = this.filterNodes(allNodes);
    
    // 按会话分组
    const sessions = this.groupBySession(filteredNodes);
    
    // 渲染每个会话
    for (const [sessionId, nodes] of sessions) {
      const sessionEl = this.renderSession(sessionId, nodes);
      this.treeContainer.appendChild(sessionEl);
    }
  }
  
  /**
   * 过滤节点
   */
  private filterNodes(nodes: HistoryNode[]): HistoryNode[] {
    if (!this.searchQuery) return nodes;
    
    const query = this.searchQuery.toLowerCase();
    return nodes.filter(node => 
      node.title.toLowerCase().includes(query) ||
      node.itemType.toLowerCase().includes(query)
    );
  }
  
  /**
   * 按会话分组
   */
  private groupBySession(nodes: HistoryNode[]): Map<string, HistoryNode[]> {
    const sessions = new Map<string, HistoryNode[]>();
    
    for (const node of nodes) {
      if (!sessions.has(node.sessionId)) {
        sessions.set(node.sessionId, []);
      }
      sessions.get(node.sessionId)!.push(node);
    }
    
    // 按时间排序会话
    return new Map([...sessions.entries()].sort((a, b) => {
      const aTime = Math.max(...a[1].map(n => n.timestamp.getTime()));
      const bTime = Math.max(...b[1].map(n => n.timestamp.getTime()));
      return bTime - aTime;
    }));
  }
  
  /**
   * 渲染会话
   */
  private renderSession(sessionId: string, nodes: HistoryNode[]): HTMLElement {
    const doc = this.window.document;
    
    const sessionEl = doc.createElement("div");
    sessionEl.className = "history-session";
    sessionEl.style.cssText = `
      margin-bottom: 16px;
    `;
    
    // 会话标题
    const header = doc.createElement("div");
    header.className = "session-header";
    header.style.cssText = `
      font-weight: 600;
      font-size: 13px;
      color: var(--text-secondary);
      margin-bottom: 8px;
    `;
    
    const sessionDate = new Date(Math.min(...nodes.map(n => n.timestamp.getTime())));
    const isToday = this.isToday(sessionDate);
    const dateStr = isToday ? "Today" : sessionDate.toLocaleDateString();
    
    header.textContent = `${dateStr} - ${nodes.length} items`;
    sessionEl.appendChild(header);
    
    // 构建树
    const tree = this.options.historyService.buildTree(nodes);
    const rootNodes = tree.get(null) || [];
    
    // 渲染根节点
    for (const node of rootNodes) {
      const nodeEl = this.renderNode(node, tree);
      sessionEl.appendChild(nodeEl);
    }
    
    return sessionEl;
  }
  
  /**
   * 渲染节点
   */
  private renderNode(node: HistoryNode, tree: Map<string | null, HistoryNode[]>): HTMLElement {
    const doc = this.window.document;
    
    const nodeEl = doc.createElement("div");
    nodeEl.className = "history-node";
    nodeEl.style.cssText = `
      margin-left: ${node.depth * 20}px;
      margin-bottom: 4px;
    `;
    
    // 节点内容
    const content = doc.createElement("div");
    content.className = "node-content";
    content.style.cssText = `
      display: flex;
      align-items: center;
      padding: 4px 8px;
      border-radius: 4px;
      cursor: pointer;
      transition: background 0.2s;
    `;
    
    content.addEventListener("mouseenter", () => {
      content.style.background = "rgba(0, 0, 0, 0.05)";
    });
    
    content.addEventListener("mouseleave", () => {
      content.style.background = "transparent";
    });
    
    content.addEventListener("click", async () => {
      await this.options.historyService.navigateToNode(node.id);
    });
    
    // 图标
    const icon = doc.createElement("span");
    icon.style.cssText = `
      margin-right: 8px;
      font-size: 16px;
    `;
    icon.textContent = node.status === "closed" ? "💤" : this.getItemIcon(node.itemType);
    content.appendChild(icon);
    
    // 标题
    const title = doc.createElement("span");
    title.className = "node-title";
    title.style.cssText = `
      flex: 1;
      font-size: 13px;
      color: var(--text-color);
      ${node.status === "closed" ? "opacity: 0.6; text-decoration: line-through;" : ""}
    `;
    title.textContent = node.title;
    content.appendChild(title);
    
    // 时间
    const time = doc.createElement("span");
    time.className = "node-time";
    time.style.cssText = `
      font-size: 11px;
      color: var(--text-secondary);
      margin-left: 8px;
    `;
    time.textContent = node.lastVisit.toLocaleTimeString();
    content.appendChild(time);
    
    // 笔记标记
    if (node.hasNotes) {
      const noteIcon = doc.createElement("span");
      noteIcon.style.cssText = `
        margin-left: 4px;
        font-size: 12px;
      `;
      noteIcon.textContent = "📝";
      noteIcon.title = "Has notes";
      content.appendChild(noteIcon);
    }
    
    nodeEl.appendChild(content);
    
    // 渲染子节点
    const children = tree.get(node.id) || [];
    for (const child of children) {
      const childEl = this.renderNode(child, tree);
      nodeEl.appendChild(childEl);
    }
    
    return nodeEl;
  }
  
  /**
   * 获取项目图标
   */
  private getItemIcon(itemType: string): string {
    const icons: Record<string, string> = {
      book: "📚",
      bookSection: "📑",
      journalArticle: "📄",
      webpage: "🌐",
      thesis: "🎓",
      report: "📊",
      attachment: "📎",
      note: "📝"
    };
    
    return icons[itemType] || "📄";
  }
  
  /**
   * 判断是否是今天
   */
  private isToday(date: Date): boolean {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }
  
  onHide(): void {
    // 清理资源
  }
  
  destroy(): void {
    this.container = null;
    this.searchInput = null;
    this.treeContainer = null;
  }
}