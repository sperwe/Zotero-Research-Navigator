/**
 * Standalone History Tree - 完全自包含的实现
 */

import { HistoryService } from '../../../services/history-service';
import { ClosedTabsManager } from '../../../managers/closed-tabs-manager';

export class HistoryTreeStandalone {
  private container: HTMLElement;
  private treeData: any[] = [];
  
  constructor(
    private window: Window,
    private historyService: HistoryService,
    private closedTabsManager: ClosedTabsManager
  ) {
    Zotero.log('[HistoryTreeStandalone] Using native implementation', 'info');
  }
  
  async init(container: HTMLElement): Promise<void> {
    this.container = container;
    const doc = container.ownerDocument || this.window.document;
    
    // 清空容器
    this.container.innerHTML = '';
    
    // 添加样式
    this.addStyles(doc);
    
    // 创建UI
    this.createUI(doc);
    
    // 加载数据
    await this.loadData();
  }
  
  private addStyles(doc: Document): void {
    const style = doc.createElement('style');
    style.textContent = `
      .history-tree-standalone {
        height: 100%;
        display: flex;
        flex-direction: column;
        font-size: 13px;
      }
      
      .hts-toolbar {
        display: flex;
        align-items: center;
        padding: 10px;
        border-bottom: 1px solid #e0e0e0;
        background: #f5f5f5;
      }
      
      .hts-toolbar button {
        margin-right: 10px;
        padding: 4px 8px;
        font-size: 12px;
        border: 1px solid #ccc;
        background: #fff;
        cursor: pointer;
        border-radius: 3px;
      }
      
      .hts-toolbar button:hover {
        background: #e8e8e8;
      }
      
      .hts-tree-container {
        flex: 1;
        overflow: auto;
        padding: 10px;
      }
      
      .hts-tree-node {
        margin: 2px 0;
        padding: 2px;
        cursor: pointer;
        user-select: none;
      }
      
      .hts-tree-node:hover {
        background: #f0f0f0;
      }
      
      .hts-tree-group {
        margin-left: 0;
      }
      
      .hts-tree-item {
        margin-left: 20px;
      }
      
      .hts-tree-subitem {
        margin-left: 40px;
      }
      
      .hts-icon {
        display: inline-block;
        width: 16px;
        text-align: center;
        margin-right: 4px;
      }
      
      .hts-expand {
        cursor: pointer;
        font-size: 10px;
        width: 12px;
        display: inline-block;
      }
      
      .hts-collapsed > .hts-children {
        display: none;
      }
      
      .hts-date-group {
        font-weight: bold;
        color: #333;
      }
      
      .hts-session-group {
        color: #555;
      }
      
      .hts-history-item {
        color: #333;
      }
      
      .hts-closed-tab {
        color: #666;
        font-style: italic;
      }
    `;
    doc.head.appendChild(style);
  }
  
  private createUI(doc: Document): void {
    const wrapper = doc.createElement('div');
    wrapper.className = 'history-tree-standalone';
    
    // 工具栏
    const toolbar = doc.createElement('div');
    toolbar.className = 'hts-toolbar';
    
    const refreshBtn = doc.createElement('button');
    refreshBtn.textContent = '🔄 Refresh';
    refreshBtn.addEventListener('click', () => this.loadData());
    toolbar.appendChild(refreshBtn);
    
    const clearBtn = doc.createElement('button');
    clearBtn.textContent = '🗑️ Clear All';
    clearBtn.addEventListener('click', () => this.clearAll());
    toolbar.appendChild(clearBtn);
    
    const expandBtn = doc.createElement('button');
    expandBtn.textContent = '📂 Expand All';
    expandBtn.addEventListener('click', () => this.expandAll());
    toolbar.appendChild(expandBtn);
    
    const collapseBtn = doc.createElement('button');
    collapseBtn.textContent = '📁 Collapse All';
    collapseBtn.addEventListener('click', () => this.collapseAll());
    toolbar.appendChild(collapseBtn);
    
    wrapper.appendChild(toolbar);
    
    // 树容器
    const treeContainer = doc.createElement('div');
    treeContainer.className = 'hts-tree-container';
    treeContainer.id = 'hts-tree-' + Date.now();
    wrapper.appendChild(treeContainer);
    
    this.container.appendChild(wrapper);
  }
  
  private async loadData(): Promise<void> {
    try {
      Zotero.log('[HistoryTreeStandalone] Loading data...', 'info');
      
      const sessions = await this.historyService.getAllSessions();
      const closedTabs = this.closedTabsManager.getClosedTabs();
      
      // 组织数据
      const dateGroups = new Map<string, any[]>();
      
      for (const session of sessions) {
        const date = new Date(session.startTime).toLocaleDateString();
        if (!dateGroups.has(date)) {
          dateGroups.set(date, []);
        }
        
        const nodes = await this.historyService.getSessionNodes(session.id);
        dateGroups.get(date)!.push({ session, nodes });
      }
      
      // 渲染树
      const treeContainer = this.container.querySelector('.hts-tree-container');
      if (treeContainer) {
        treeContainer.innerHTML = '';
        
        // 渲染日期组
        for (const [date, sessionData] of dateGroups) {
          const dateNode = this.createDateNode(date, sessionData);
          treeContainer.appendChild(dateNode);
        }
        
        // 渲染关闭的标签
        if (closedTabs.length > 0) {
          const closedTabsNode = this.createClosedTabsNode(closedTabs);
          treeContainer.appendChild(closedTabsNode);
        }
      }
      
      Zotero.log(`[HistoryTreeStandalone] Loaded ${dateGroups.size} date groups and ${closedTabs.length} closed tabs`, 'info');
      
    } catch (error) {
      Zotero.logError(`[HistoryTreeStandalone] Failed to load data: ${error}`);
    }
  }
  
  private createDateNode(date: string, sessionData: any[]): HTMLElement {
    const doc = this.window.document;
    
    const dateGroup = doc.createElement('div');
    dateGroup.className = 'hts-tree-node hts-tree-group hts-date-group';
    
    const header = doc.createElement('div');
    header.innerHTML = `
      <span class="hts-expand">▼</span>
      <span class="hts-icon">📅</span>
      ${date} (${sessionData.length} sessions)
    `;
    header.addEventListener('click', () => this.toggleNode(dateGroup));
    dateGroup.appendChild(header);
    
    const children = doc.createElement('div');
    children.className = 'hts-children';
    
    for (const { session, nodes } of sessionData) {
      const sessionNode = this.createSessionNode(session, nodes);
      children.appendChild(sessionNode);
    }
    
    dateGroup.appendChild(children);
    return dateGroup;
  }
  
  private createSessionNode(session: any, nodes: any[]): HTMLElement {
    const doc = this.window.document;
    
    const sessionGroup = doc.createElement('div');
    sessionGroup.className = 'hts-tree-node hts-tree-item hts-session-group';
    
    const header = doc.createElement('div');
    header.innerHTML = `
      <span class="hts-expand">▼</span>
      <span class="hts-icon">📚</span>
      Session ${session.id.slice(-6)} (${nodes.length} items)
    `;
    header.addEventListener('click', () => this.toggleNode(sessionGroup));
    sessionGroup.appendChild(header);
    
    const children = doc.createElement('div');
    children.className = 'hts-children';
    
    for (const node of nodes) {
      const itemNode = this.createHistoryNode(node);
      children.appendChild(itemNode);
    }
    
    sessionGroup.appendChild(children);
    return sessionGroup;
  }
  
  private createHistoryNode(node: any): HTMLElement {
    const doc = this.window.document;
    
    const item = doc.createElement('div');
    item.className = 'hts-tree-node hts-tree-subitem hts-history-item';
    
    const icon = node.status === 'active' ? '📖' : '📕';
    item.innerHTML = `
      <span class="hts-icon">${icon}</span>
      ${node.title || 'Untitled'}
    `;
    
    item.addEventListener('click', () => {
      if (node.itemId) {
        const ZoteroPane = Zotero.getActiveZoteroPane();
        if (ZoteroPane) {
          ZoteroPane.selectItem(node.itemId);
        }
      }
    });
    
    return item;
  }
  
  private createClosedTabsNode(closedTabs: any[]): HTMLElement {
    const doc = this.window.document;
    
    const closedGroup = doc.createElement('div');
    closedGroup.className = 'hts-tree-node hts-tree-group';
    
    const header = doc.createElement('div');
    header.innerHTML = `
      <span class="hts-expand">▼</span>
      <span class="hts-icon">👻</span>
      Closed Tabs (${closedTabs.length})
    `;
    header.addEventListener('click', () => this.toggleNode(closedGroup));
    closedGroup.appendChild(header);
    
    const children = doc.createElement('div');
    children.className = 'hts-children';
    
    for (const tab of closedTabs) {
      const tabNode = doc.createElement('div');
      tabNode.className = 'hts-tree-node hts-tree-item hts-closed-tab';
      tabNode.innerHTML = `
        <span class="hts-icon">👻</span>
        ${tab.node.title || 'Untitled'}
      `;
      tabNode.addEventListener('click', () => {
        this.closedTabsManager.restoreTab(tab);
      });
      children.appendChild(tabNode);
    }
    
    closedGroup.appendChild(children);
    return closedGroup;
  }
  
  private toggleNode(node: HTMLElement): void {
    node.classList.toggle('hts-collapsed');
    const expand = node.querySelector('.hts-expand');
    if (expand) {
      expand.textContent = node.classList.contains('hts-collapsed') ? '▶' : '▼';
    }
  }
  
  private expandAll(): void {
    const nodes = this.container.querySelectorAll('.hts-tree-group, .hts-tree-item');
    nodes.forEach(node => {
      node.classList.remove('hts-collapsed');
      const expand = node.querySelector('.hts-expand');
      if (expand) expand.textContent = '▼';
    });
  }
  
  private collapseAll(): void {
    const nodes = this.container.querySelectorAll('.hts-tree-group, .hts-tree-item');
    nodes.forEach(node => {
      node.classList.add('hts-collapsed');
      const expand = node.querySelector('.hts-expand');
      if (expand) expand.textContent = '▶';
    });
  }
  
  private async clearAll(): Promise<void> {
    if (this.window.confirm('Are you sure you want to clear all history? This cannot be undone.')) {
      try {
        await this.historyService.clearAll(false);
        await this.loadData();
      } catch (error) {
        Zotero.logError(`[HistoryTreeStandalone] Failed to clear history: ${error}`);
      }
    }
  }
}