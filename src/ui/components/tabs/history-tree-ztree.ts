/**
 * History Tree zTree 实现 - 使用 iframe 隔离方案
 */

import { IZTreeObj, IZTreeNode, IZTreeSetting } from '../../../types/ztree';
import { HistoryService } from '../../../services/history-service';
import { HistoryNode } from '../../../services/database-service';
import { ClosedTabsManager } from '../../../managers/closed-tabs-manager';

export class HistoryTreeZTree {
  private container: HTMLElement;
  private iframe: HTMLIFrameElement | null = null;
  private iframeWindow: Window | null = null;
  
  constructor(
    private window: Window,
    private historyService: HistoryService,
    private closedTabsManager: ClosedTabsManager
  ) {
    Zotero.log('[HistoryTreeZTree] Using iframe approach for complete isolation', 'info');
    
    // 设置全局函数供 iframe 调用
    (this.window as any).refreshHistoryTree = () => this.refresh();
    (this.window as any).deleteHistoryNode = (nodeId: string) => this.handleDeleteNode(nodeId);
    (this.window as any).restoreClosedTab = (tabData: any) => this.handleRestoreTab(tabData);
    (this.window as any).clearAllHistory = () => this.handleClearAll();
    (this.window as any).showHistorySettings = () => this.showSettings();
    (this.window as any).handleHistoryNodeClick = (treeNode: any) => this.handleNodeClick(treeNode);
    (this.window as any).handleHistoryNodeRightClick = (event: Event, treeNode: any) => this.handleNodeRightClick(event, treeNode);
    (this.window as any).onHistoryTreeReady = () => this.onIframeReady();
  }
  
  /**
   * 初始化组件
   */
  async init(container: HTMLElement): Promise<void> {
    this.container = container;
    const doc = container.ownerDocument || this.window.document;
    
    // 确保容器存在且已附加到 DOM
    if (!container || !container.parentNode) {
      Zotero.logError('[HistoryTreeZTree] Container not attached to DOM');
      return;
    }
    
    // 清空容器
    this.container.innerHTML = '';
    
    // 创建 iframe
    this.iframe = doc.createElement('iframe');
    this.iframe.setAttribute('type', 'content'); // 对于 Zotero 6 的 XUL
    this.iframe.setAttribute('src', 'chrome://researchnavigator/content/history-tree.html');
    this.iframe.style.cssText = `
      width: 100%;
      height: 100%;
      border: none;
      background: transparent;
    `;
    
    // 监听 iframe 加载完成
    this.iframe.addEventListener('load', () => {
      this.iframeWindow = this.iframe!.contentWindow;
      Zotero.log('[HistoryTreeZTree] iframe loaded successfully', 'info');
    });
    
    // 添加到容器
    this.container.appendChild(this.iframe);
    
    Zotero.log('[HistoryTreeZTree] iframe created and appended', 'info');
  }
  
  /**
   * iframe 准备就绪的回调
   */
  private async onIframeReady(): Promise<void> {
    Zotero.log('[HistoryTreeZTree] iframe ready, loading data', 'info');
    
    try {
      // 获取数据
      const sessions = await this.historyService.getAllSessions();
      const closedTabs = this.closedTabsManager.getClosedTabs();
      
      // 转换数据为树节点格式
      const data = await this.prepareTreeData(sessions, closedTabs);
      
      // 调用 iframe 中的 API 构建树
      if (this.iframeWindow && (this.iframeWindow as any).historyTreeAPI) {
        (this.iframeWindow as any).historyTreeAPI.buildTree(data);
        Zotero.log('[HistoryTreeZTree] Tree data sent to iframe', 'info');
      } else {
        throw new Error('iframe API not available');
      }
    } catch (error) {
      Zotero.logError(`[HistoryTreeZTree] Failed to load tree data: ${error}`);
      this.showError(error.toString());
    }
  }
  
  /**
   * 准备树数据
   */
  private async prepareTreeData(sessions: any[], closedTabs: any[]): Promise<any> {
    const dateGroups = new Map<string, any[]>();
    
    // 处理 sessions
    for (const session of sessions) {
      const date = new Date(session.startTime).toLocaleDateString();
      if (!dateGroups.has(date)) {
        dateGroups.set(date, []);
      }
      
      const nodes = await this.historyService.getSessionNodes(session.id);
      dateGroups.get(date)!.push({
        session,
        nodes
      });
    }
    
    return {
      dateGroups: Array.from(dateGroups.entries()),
      closedTabs,
      settings: {
        historyLoadDays: Zotero.Prefs.get('researchnavigator.historyLoadDays', true) || 7,
        maxHistoryGroups: Zotero.Prefs.get('researchnavigator.maxHistoryGroups', true) || 50
      }
    };
  }
  
  /**
   * 显示错误信息
   */
  private showError(error: string): void {
    if (this.container) {
      this.container.innerHTML = `
        <div style="padding: 20px; text-align: center; color: #666;">
          <p>Failed to load tree view components.</p>
          <p style="font-size: 12px; margin-top: 10px;">Error: ${error}</p>
          <p style="font-size: 12px; margin-top: 10px;">Please disable zTree in preferences or contact support if the issue persists.</p>
        </div>
      `;
    }
  }
  
  /**
   * 刷新树
   */
  async refresh(): Promise<void> {
    Zotero.log('[HistoryTreeZTree] Refreshing tree', 'info');
    await this.onIframeReady();
  }
  
  /**
   * 处理删除节点
   */
  private async handleDeleteNode(nodeId: string): Promise<void> {
    try {
      await this.historyService.deleteNode(nodeId);
      await this.refresh();
    } catch (error) {
      Zotero.logError(`[HistoryTreeZTree] Failed to delete node: ${error}`);
    }
  }
  
  /**
   * 处理恢复标签
   */
  private handleRestoreTab(closedTab: any): void {
    try {
      this.closedTabsManager.restoreTab(closedTab);
    } catch (error) {
      Zotero.logError(`[HistoryTreeZTree] Failed to restore tab: ${error}`);
    }
  }
  
  /**
   * 处理清空所有历史
   */
  private async handleClearAll(): Promise<void> {
    if (this.window.confirm('Are you sure you want to clear all history? This cannot be undone.')) {
      try {
        await this.historyService.clearAll(false);
        await this.refresh();
      } catch (error) {
        Zotero.logError(`[HistoryTreeZTree] Failed to clear history: ${error}`);
      }
    }
  }
  
  /**
   * 显示设置对话框
   */
  private showSettings(): void {
    // TODO: 实现设置对话框
    Zotero.log('[HistoryTreeZTree] Settings dialog not implemented yet', 'warn');
  }
  
  /**
   * 处理节点点击
   */
  private handleNodeClick(treeNode: any): void {
    if (treeNode.historyNode) {
      const node = treeNode.historyNode;
      if (node.itemId) {
        // 在 Zotero 中选择项目
        const ZoteroPane = Zotero.getActiveZoteroPane();
        if (ZoteroPane) {
          ZoteroPane.selectItem(node.itemId);
        }
      }
    }
  }
  
  /**
   * 处理节点右键点击
   */
  private handleNodeRightClick(event: Event, treeNode: any): void {
    // TODO: 实现右键菜单
    Zotero.log('[HistoryTreeZTree] Right-click menu not implemented yet', 'info');
  }
}