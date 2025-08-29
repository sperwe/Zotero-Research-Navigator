/**
 * 内置库的历史树实现 - 不依赖外部文件加载
 */

import { HistoryService } from '../../../services/history-service';
import { ClosedTabsManager } from '../../../managers/closed-tabs-manager';

export class HistoryTreeBuiltin {
  private container: HTMLElement;
  private treeContainer: HTMLElement | null = null;
  private expandedNodes = new Set<string>();
  
  constructor(
    private window: Window,
    private historyService: HistoryService,
    private closedTabsManager: ClosedTabsManager
  ) {
    Zotero.log('[HistoryTreeBuiltin] Using built-in tree implementation', 'info');
  }
  
  async init(container: HTMLElement): Promise<void> {
    this.container = container;
    const doc = container.ownerDocument || this.window.document;
    
    // 添加样式
    this.addStyles(doc);
    
    // 创建结构
    container.innerHTML = `
      <div class="htb-container">
        <div class="htb-toolbar">
          <button class="htb-btn" id="htb-refresh">🔄 Refresh</button>
          <button class="htb-btn" id="htb-expand-all">📂 Expand All</button>
          <button class="htb-btn" id="htb-collapse-all">📁 Collapse All</button>
          <button class="htb-btn" id="htb-clear-all">🗑️ Clear All</button>
        </div>
        <div class="htb-tree" id="htb-tree-container"></div>
      </div>
    `;
    
    this.treeContainer = doc.getElementById('htb-tree-container');
    
    // 绑定事件
    doc.getElementById('htb-refresh')?.addEventListener('click', () => this.refresh());
    doc.getElementById('htb-expand-all')?.addEventListener('click', () => this.expandAll());
    doc.getElementById('htb-collapse-all')?.addEventListener('click', () => this.collapseAll());
    doc.getElementById('htb-clear-all')?.addEventListener('click', () => this.clearAll());
    
    // 初始化数据
    await this.refresh();
  }
  
  private addStyles(doc: Document): void {
    const style = doc.createElement('style');
    style.textContent = `
      .htb-container {
        height: 100%;
        display: flex;
        flex-direction: column;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 13px;
        overflow: hidden; /* 防止整个容器滚动 */
      }
      
      .htb-toolbar {
        display: flex;
        align-items: center;
        padding: 10px;
        border-bottom: 1px solid #e0e0e0;
        background: #f7f7f7;
      }
      
      .htb-btn {
        margin-right: 10px;
        padding: 5px 10px;
        font-size: 12px;
        border: 1px solid #ccc;
        background: #fff;
        cursor: pointer;
        border-radius: 3px;
        transition: all 0.2s;
      }
      
      .htb-btn:hover {
        background: #e8e8e8;
        border-color: #999;
      }
      
      .htb-tree {
        flex: 1;
        overflow-y: auto; /* 垂直滚动 */
        overflow-x: hidden; /* 隐藏水平滚动条 */
        padding: 10px;
        min-height: 0; /* 重要：让 flex 容器能够正确计算高度 */
      }
      
      .htb-node {
        margin: 2px 0;
        user-select: none;
      }
      
      .htb-node-content {
        display: flex;
        align-items: center;
        padding: 3px 5px;
        cursor: pointer;
        border-radius: 3px;
        transition: background 0.2s;
      }
      
      .htb-node-content:hover {
        background: #f0f0f0;
      }
      
      .htb-node-content.selected {
        background: #e3f2fd;
      }
      
      .htb-expand-icon {
        width: 16px;
        text-align: center;
        cursor: pointer;
        font-size: 10px;
        color: #666;
      }
      
      .htb-node-icon {
        margin: 0 5px;
      }
      
      .htb-node-text {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      
      .htb-node-count {
        color: #666;
        font-size: 11px;
        margin-left: 5px;
      }
      
      .htb-children {
        margin-left: 20px;
        display: none;
      }
      
      .htb-expanded > .htb-children {
        display: block;
      }
      
      .htb-date-group {
        font-weight: 600;
        color: #1a73e8;
      }
      
      .htb-session-group {
        color: #5f6368;
      }
      
      .htb-history-item {
        color: #202124;
      }
      
      .htb-closed-group {
        font-weight: 600;
        color: #9e9e9e;
      }
      
      .htb-closed-item {
        color: #757575;
        font-style: italic;
      }
    `;
    
    // 安全地添加样式
    if (doc.head) {
      doc.head.appendChild(style);
    } else if (doc.documentElement) {
      doc.documentElement.appendChild(style);
    } else if (doc.body) {
      doc.body.appendChild(style);
    } else {
      // 如果都不存在，尝试稍后添加
      Zotero.log('[HistoryTreeBuiltin] No suitable element to append styles, trying inline styles', 'warn');
      // 作为备用方案，我们可以将样式内联到容器中
      if (this.container) {
        const styleContainer = doc.createElement('div');
        styleContainer.innerHTML = `<style>${style.textContent}</style>`;
        this.container.insertBefore(styleContainer.firstChild!, this.container.firstChild);
      }
    }
  }
  
  private async refresh(): Promise<void> {
    if (!this.treeContainer) return;
    
    try {
      Zotero.log('[HistoryTreeBuiltin] Refreshing tree...', 'info');
      
      const sessions = await this.historyService.getAllSessions();
      const closedTabs = this.closedTabsManager.getClosedTabs();
      
      // 构建树结构
      const treeData = await this.buildTreeData(sessions, closedTabs);
      
      // 渲染树
      this.renderTree(treeData);
      
      Zotero.log(`[HistoryTreeBuiltin] Rendered ${treeData.length} root nodes`, 'info');
      
    } catch (error) {
      Zotero.logError(`[HistoryTreeBuiltin] Failed to refresh: ${error}`);
    }
  }
  
  private async buildTreeData(sessions: any[], closedTabs: any[]): Promise<any[]> {
    const nodes = [];
    
    // 按日期分组
    const dateGroups = new Map<string, any[]>();
    
    for (const session of sessions) {
      const date = new Date(session.startTime).toLocaleDateString();
      if (!dateGroups.has(date)) {
        dateGroups.set(date, []);
      }
      const sessionNodes = await this.historyService.getSessionNodes(session.id);
      dateGroups.get(date)!.push({ session, nodes: sessionNodes });
    }
    
    // 创建日期节点
    for (const [date, sessionData] of dateGroups) {
      const dateNode = {
        id: `date_${date}`,
        type: 'date',
        icon: '📅',
        text: date,
        count: sessionData.length,
        children: []
      };
      
      // 创建会话节点
      for (const { session, nodes: historyNodes } of sessionData) {
        const sessionNode = {
          id: `session_${session.id}`,
          type: 'session',
          icon: '📚',
          text: `Session ${session.id.slice(-6)}`,
          count: historyNodes.length,
          children: historyNodes.map(node => ({
            id: `node_${node.id}`,
            type: 'history',
            icon: node.status === 'active' ? '📖' : '📕',
            text: node.title || 'Untitled',
            data: node
          }))
        };
        dateNode.children.push(sessionNode);
      }
      
      nodes.push(dateNode);
    }
    
    // 创建关闭标签节点
    if (closedTabs.length > 0) {
      const closedNode = {
        id: 'closed_tabs',
        type: 'closed',
        icon: '👻',
        text: 'Closed Tabs',
        count: closedTabs.length,
        children: closedTabs.map((tab, i) => ({
          id: `closed_${i}`,
          type: 'closedItem',
          icon: '👻',
          text: tab.node.title || 'Untitled',
          data: tab
        }))
      };
      nodes.push(closedNode);
    }
    
    return nodes;
  }
  
  private renderTree(nodes: any[]): void {
    if (!this.treeContainer) return;
    
    this.treeContainer.innerHTML = '';
    
    for (const node of nodes) {
      const element = this.createNodeElement(node);
      this.treeContainer.appendChild(element);
    }
  }
  
  private createNodeElement(node: any): HTMLElement {
    const doc = this.window.document;
    const nodeEl = doc.createElement('div');
    nodeEl.className = 'htb-node';
    
    // 节点内容
    const content = doc.createElement('div');
    content.className = `htb-node-content htb-${node.type}-group`;
    
    // 展开图标
    if (node.children && node.children.length > 0) {
      const expandIcon = doc.createElement('span');
      expandIcon.className = 'htb-expand-icon';
      expandIcon.textContent = this.expandedNodes.has(node.id) ? '▼' : '▶';
      expandIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleNode(node.id, nodeEl);
      });
      content.appendChild(expandIcon);
    } else {
      const spacer = doc.createElement('span');
      spacer.className = 'htb-expand-icon';
      spacer.textContent = ' ';
      content.appendChild(spacer);
    }
    
    // 图标
    const icon = doc.createElement('span');
    icon.className = 'htb-node-icon';
    icon.textContent = node.icon;
    content.appendChild(icon);
    
    // 文本
    const text = doc.createElement('span');
    text.className = 'htb-node-text';
    text.textContent = node.text;
    content.appendChild(text);
    
    // 计数
    if (node.count !== undefined) {
      const count = doc.createElement('span');
      count.className = 'htb-node-count';
      count.textContent = `(${node.count})`;
      content.appendChild(count);
    }
    
    // 点击事件
    content.addEventListener('click', () => this.handleNodeClick(node));
    
    nodeEl.appendChild(content);
    
    // 子节点容器
    if (node.children && node.children.length > 0) {
      const children = doc.createElement('div');
      children.className = 'htb-children';
      
      for (const child of node.children) {
        const childEl = this.createNodeElement(child);
        children.appendChild(childEl);
      }
      
      nodeEl.appendChild(children);
      
      // 恢复展开状态
      if (this.expandedNodes.has(node.id)) {
        nodeEl.classList.add('htb-expanded');
      }
    }
    
    return nodeEl;
  }
  
  private toggleNode(nodeId: string, nodeEl: HTMLElement): void {
    const isExpanded = nodeEl.classList.contains('htb-expanded');
    
    if (isExpanded) {
      nodeEl.classList.remove('htb-expanded');
      this.expandedNodes.delete(nodeId);
    } else {
      nodeEl.classList.add('htb-expanded');
      this.expandedNodes.add(nodeId);
    }
    
    // 更新图标
    const expandIcon = nodeEl.querySelector('.htb-expand-icon');
    if (expandIcon) {
      expandIcon.textContent = isExpanded ? '▶' : '▼';
    }
  }
  
  private handleNodeClick(node: any): void {
    if (node.type === 'history' && node.data?.itemId) {
      // 打开历史项目
      const ZoteroPane = Zotero.getActiveZoteroPane();
      if (ZoteroPane) {
        ZoteroPane.selectItem(node.data.itemId);
      }
    } else if (node.type === 'closedItem' && node.data) {
      // 恢复关闭的标签
      this.closedTabsManager.restoreTab(node.data);
    }
  }
  
  private expandAll(): void {
    const nodes = this.treeContainer?.querySelectorAll('.htb-node');
    nodes?.forEach(node => {
      if (node.querySelector('.htb-children')) {
        node.classList.add('htb-expanded');
        const expandIcon = node.querySelector('.htb-expand-icon');
        if (expandIcon) expandIcon.textContent = '▼';
      }
    });
    
    // 更新展开状态
    this.expandedNodes.clear();
    nodes?.forEach(node => {
      const content = node.querySelector('.htb-node-content');
      if (content) {
        const id = this.getNodeIdFromElement(node as HTMLElement);
        if (id) this.expandedNodes.add(id);
      }
    });
  }
  
  private collapseAll(): void {
    const nodes = this.treeContainer?.querySelectorAll('.htb-node');
    nodes?.forEach(node => {
      node.classList.remove('htb-expanded');
      const expandIcon = node.querySelector('.htb-expand-icon');
      if (expandIcon && node.querySelector('.htb-children')) {
        expandIcon.textContent = '▶';
      }
    });
    
    this.expandedNodes.clear();
  }
  
  private getNodeIdFromElement(nodeEl: HTMLElement): string | null {
    // 从渲染的数据中提取节点ID（这是一个简化实现）
    const text = nodeEl.querySelector('.htb-node-text')?.textContent || '';
    const icon = nodeEl.querySelector('.htb-node-icon')?.textContent || '';
    return `${icon}_${text}`;
  }
  
  private async clearAll(): Promise<void> {
    if (this.window.confirm('Are you sure you want to clear all history? This cannot be undone.')) {
      try {
        await this.historyService.clearAll(false);
        await this.refresh();
      } catch (error) {
        Zotero.logError(`[HistoryTreeBuiltin] Failed to clear history: ${error}`);
      }
    }
  }
}