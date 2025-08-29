/**
 * 安全版历史树 - 避免 doc.head is null 错误
 */

import { HistoryService } from '../../../services/history-service';
import { ClosedTabsManager } from '../../../managers/closed-tabs-manager';

export class HistoryTreeSafe {
  private container: HTMLElement;
  private treeContainer: HTMLElement | null = null;
  private expandedNodes = new Set<string>();
  
  constructor(
    private window: Window,
    private historyService: HistoryService,
    private closedTabsManager: ClosedTabsManager
  ) {
    Zotero.log('[HistoryTreeSafe] Using safe tree implementation', 'info');
  }
  
  async init(container: HTMLElement): Promise<void> {
    this.container = container;
    const doc = container.ownerDocument || this.window.document;
    
    try {
      // 创建包含内联样式的结构
      container.innerHTML = `
        <div class="hts-container" style="height: 100%; display: flex; flex-direction: column; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px;">
          <style>
            .hts-toolbar { display: flex; align-items: center; padding: 10px; border-bottom: 1px solid #e0e0e0; background: #f7f7f7; }
            .hts-btn { margin-right: 10px; padding: 5px 10px; font-size: 12px; border: 1px solid #ccc; background: #fff; cursor: pointer; border-radius: 3px; transition: all 0.2s; }
            .hts-btn:hover { background: #e8e8e8; border-color: #999; }
            .hts-tree { flex: 1; overflow-y: auto; overflow-x: hidden; padding: 10px; min-height: 0; }
            .hts-node { margin: 2px 0; user-select: none; }
            .hts-node-content { display: flex; align-items: center; padding: 3px 5px; cursor: pointer; border-radius: 3px; transition: background 0.2s; }
            .hts-node-content:hover { background: #f0f0f0; }
            .hts-expand-icon { width: 16px; text-align: center; cursor: pointer; font-size: 10px; color: #666; }
            .hts-node-icon { margin: 0 5px; }
            .hts-node-text { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .hts-node-count { color: #666; font-size: 11px; margin-left: 5px; }
            .hts-children { margin-left: 20px; display: none; }
            .hts-expanded > .hts-children { display: block; }
            .hts-date-group { font-weight: 600; color: #1a73e8; }
            .hts-session-group { color: #5f6368; }
            .hts-history-item { color: #202124; }
            .hts-closed-group { font-weight: 600; color: #9e9e9e; }
            .hts-closed-item { color: #757575; font-style: italic; }
          </style>
          <div class="hts-toolbar">
            <button class="hts-btn" id="hts-refresh">🔄 Refresh</button>
            <button class="hts-btn" id="hts-expand-all">📂 Expand All</button>
            <button class="hts-btn" id="hts-collapse-all">📁 Collapse All</button>
            <button class="hts-btn" id="hts-clear-all">🗑️ Clear All</button>
          </div>
          <div class="hts-tree" id="hts-tree-container"></div>
        </div>
      `;
      
      this.treeContainer = doc.getElementById('hts-tree-container');
      
      // 绑定事件
      doc.getElementById('hts-refresh')?.addEventListener('click', () => this.refresh());
      doc.getElementById('hts-expand-all')?.addEventListener('click', () => this.expandAll());
      doc.getElementById('hts-collapse-all')?.addEventListener('click', () => this.collapseAll());
      doc.getElementById('hts-clear-all')?.addEventListener('click', () => this.clearAll());
      
      // 初始化数据
      await this.refresh();
      
    } catch (error) {
      Zotero.logError(`[HistoryTreeSafe] Init error: ${error}`);
      container.innerHTML = `<div style="padding: 20px; color: red;">Error initializing tree: ${error}</div>`;
    }
  }
  
  private async refresh(): Promise<void> {
    if (!this.treeContainer) return;
    
    try {
      Zotero.log('[HistoryTreeSafe] Refreshing tree...', 'info');
      
      const sessions = await this.historyService.getAllSessions();
      const closedTabs = this.closedTabsManager.getClosedTabs();
      
      const treeData = await this.buildTreeData(sessions, closedTabs);
      this.renderTree(treeData);
      
      Zotero.log(`[HistoryTreeSafe] Rendered ${treeData.length} root nodes`, 'info');
      
    } catch (error) {
      Zotero.logError(`[HistoryTreeSafe] Failed to refresh: ${error}`);
    }
  }
  
  private async buildTreeData(sessions: any[], closedTabs: any[]): Promise<any[]> {
    const nodes = [];
    
    const dateGroups = new Map<string, any[]>();
    
    for (const session of sessions) {
      const date = new Date(session.startTime).toLocaleDateString();
      if (!dateGroups.has(date)) {
        dateGroups.set(date, []);
      }
      const sessionNodes = await this.historyService.getSessionNodes(session.id);
      dateGroups.get(date)!.push({ session, nodes: sessionNodes });
    }
    
    for (const [date, sessionData] of dateGroups) {
      const dateNode = {
        id: `date_${date}`,
        type: 'date',
        icon: '📅',
        text: date,
        count: sessionData.length,
        children: []
      };
      
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
    nodeEl.className = 'hts-node';
    
    const content = doc.createElement('div');
    content.className = `hts-node-content hts-${node.type}-group`;
    
    if (node.children && node.children.length > 0) {
      const expandIcon = doc.createElement('span');
      expandIcon.className = 'hts-expand-icon';
      expandIcon.textContent = this.expandedNodes.has(node.id) ? '▼' : '▶';
      expandIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleNode(node.id, nodeEl);
      });
      content.appendChild(expandIcon);
    } else {
      const spacer = doc.createElement('span');
      spacer.className = 'hts-expand-icon';
      spacer.textContent = ' ';
      content.appendChild(spacer);
    }
    
    const icon = doc.createElement('span');
    icon.className = 'hts-node-icon';
    icon.textContent = node.icon;
    content.appendChild(icon);
    
    const text = doc.createElement('span');
    text.className = 'hts-node-text';
    text.textContent = node.text;
    content.appendChild(text);
    
    if (node.count !== undefined) {
      const count = doc.createElement('span');
      count.className = 'hts-node-count';
      count.textContent = `(${node.count})`;
      content.appendChild(count);
    }
    
    content.addEventListener('click', () => this.handleNodeClick(node));
    
    nodeEl.appendChild(content);
    
    if (node.children && node.children.length > 0) {
      const children = doc.createElement('div');
      children.className = 'hts-children';
      
      for (const child of node.children) {
        const childEl = this.createNodeElement(child);
        children.appendChild(childEl);
      }
      
      nodeEl.appendChild(children);
      
      if (this.expandedNodes.has(node.id)) {
        nodeEl.classList.add('hts-expanded');
      }
    }
    
    return nodeEl;
  }
  
  private toggleNode(nodeId: string, nodeEl: HTMLElement): void {
    const isExpanded = nodeEl.classList.contains('hts-expanded');
    
    if (isExpanded) {
      nodeEl.classList.remove('hts-expanded');
      this.expandedNodes.delete(nodeId);
    } else {
      nodeEl.classList.add('hts-expanded');
      this.expandedNodes.add(nodeId);
    }
    
    const expandIcon = nodeEl.querySelector('.hts-expand-icon');
    if (expandIcon) {
      expandIcon.textContent = isExpanded ? '▶' : '▼';
    }
  }
  
  private handleNodeClick(node: any): void {
    if (node.type === 'history' && node.data?.itemId) {
      const ZoteroPane = Zotero.getActiveZoteroPane();
      if (ZoteroPane) {
        ZoteroPane.selectItem(node.data.itemId);
      }
    } else if (node.type === 'closedItem' && node.data) {
      this.closedTabsManager.restoreTab(node.data);
    }
  }
  
  private expandAll(): void {
    const nodes = this.treeContainer?.querySelectorAll('.hts-node');
    nodes?.forEach(node => {
      if (node.querySelector('.hts-children')) {
        node.classList.add('hts-expanded');
        const expandIcon = node.querySelector('.hts-expand-icon');
        if (expandIcon) expandIcon.textContent = '▼';
      }
    });
    
    this.expandedNodes.clear();
    nodes?.forEach(node => {
      const content = node.querySelector('.hts-node-content');
      if (content) {
        const id = this.getNodeIdFromElement(node as HTMLElement);
        if (id) this.expandedNodes.add(id);
      }
    });
  }
  
  private collapseAll(): void {
    const nodes = this.treeContainer?.querySelectorAll('.hts-node');
    nodes?.forEach(node => {
      node.classList.remove('hts-expanded');
      const expandIcon = node.querySelector('.hts-expand-icon');
      if (expandIcon && node.querySelector('.hts-children')) {
        expandIcon.textContent = '▶';
      }
    });
    
    this.expandedNodes.clear();
  }
  
  private getNodeIdFromElement(nodeEl: HTMLElement): string | null {
    const text = nodeEl.querySelector('.hts-node-text')?.textContent || '';
    const icon = nodeEl.querySelector('.hts-node-icon')?.textContent || '';
    return `${icon}_${text}`;
  }
  
  private async clearAll(): Promise<void> {
    if (this.window.confirm('Are you sure you want to clear all history? This cannot be undone.')) {
      try {
        await this.historyService.clearAll(false);
        await this.refresh();
      } catch (error) {
        Zotero.logError(`[HistoryTreeSafe] Failed to clear history: ${error}`);
      }
    }
  }
}