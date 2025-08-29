/**
 * 直接使用 zTree 的简单实现
 */

import { HistoryService } from '../../../services/history-service';
import { ClosedTabsManager } from '../../../managers/closed-tabs-manager';

declare const Services: any;

export class HistoryTreeZTreeDirect {
  private container: HTMLElement;
  private treeObj: any = null;
  
  constructor(
    private window: Window,
    private historyService: HistoryService,
    private closedTabsManager: ClosedTabsManager
  ) {
    Zotero.log('[HistoryTreeZTreeDirect] Direct zTree implementation', 'info');
  }
  
  async init(container: HTMLElement): Promise<void> {
    this.container = container;
    const doc = container.ownerDocument || this.window.document;
    
    // 加载 jQuery 和 zTree
    await this.loadDependencies();
    
    // 创建基本结构
    container.innerHTML = `
      <div style="height: 100%; display: flex; flex-direction: column;">
        <div style="padding: 10px; border-bottom: 1px solid #e0e0e0;">
          <button id="refreshBtn" style="margin-right: 10px;">🔄 Refresh</button>
          <button id="expandAllBtn" style="margin-right: 10px;">📂 Expand All</button>
          <button id="collapseAllBtn">📁 Collapse All</button>
        </div>
        <div id="historyTree" class="ztree" style="flex: 1; overflow: auto; padding: 10px;"></div>
      </div>
    `;
    
    // 绑定按钮事件
    doc.getElementById('refreshBtn')?.addEventListener('click', () => this.refresh());
    doc.getElementById('expandAllBtn')?.addEventListener('click', () => this.treeObj?.expandAll(true));
    doc.getElementById('collapseAllBtn')?.addEventListener('click', () => this.treeObj?.expandAll(false));
    
    // 加载 zTree 样式
    this.loadStyles(doc);
    
    // 初始化树
    await this.refresh();
  }
  
  private async loadDependencies(): Promise<void> {
    const win = this.window as any;
    
    // 加载 jQuery
    if (!win.jQuery && !win.$) {
      Zotero.log('[HistoryTreeZTreeDirect] Loading jQuery...', 'info');
      await this.loadScript('chrome://researchnavigator/content/lib/jquery.min.js');
    }
    
    // 等待 jQuery 就绪
    let attempts = 0;
    while (!win.$ && attempts < 10) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    if (!win.$) {
      throw new Error('Failed to load jQuery');
    }
    
    // 加载 zTree
    if (!win.$.fn?.zTree) {
      Zotero.log('[HistoryTreeZTreeDirect] Loading zTree...', 'info');
      await this.loadScript('chrome://researchnavigator/content/lib/ztree/jquery.ztree.core.min.js');
    }
    
    Zotero.log('[HistoryTreeZTreeDirect] Dependencies loaded successfully', 'info');
  }
  
  private loadScript(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        if (typeof Services !== 'undefined' && Services.scriptloader) {
          Services.scriptloader.loadSubScript(url, this.window);
          resolve();
        } else {
          const script = this.window.document.createElement('script');
          script.src = url;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error(`Failed to load ${url}`));
          (this.window.document.head || this.window.document.documentElement).appendChild(script);
        }
      } catch (error) {
        reject(error);
      }
    });
  }
  
  private loadStyles(doc: Document): void {
    // 加载 zTree 样式
    const link = doc.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'chrome://researchnavigator/content/lib/ztree/zTreeStyle.css';
    doc.head.appendChild(link);
    
    // 添加自定义样式
    const style = doc.createElement('style');
    style.textContent = `
      .ztree li span.button.custom_icon {
        margin-right: 2px;
        background: none;
        vertical-align: top;
      }
      .ztree li a:hover {
        text-decoration: none;
        background-color: #e7f4f9;
      }
      .ztree li a.curSelectedNode {
        background-color: #d4e7f1;
      }
    `;
    doc.head.appendChild(style);
  }
  
  private async refresh(): Promise<void> {
    try {
      Zotero.log('[HistoryTreeZTreeDirect] Refreshing tree...', 'info');
      
      // 获取数据
      const sessions = await this.historyService.getAllSessions();
      const closedTabs = this.closedTabsManager.getClosedTabs();
      
      // 构建 zTree 节点
      const zNodes = await this.buildZNodes(sessions, closedTabs);
      
      // zTree 配置
      const setting = {
        view: {
          nameIsHTML: true,
          showLine: true,
          showIcon: false,
          dblClickExpand: true,
          addDiyDom: this.addDiyDom.bind(this)
        },
        data: {
          simpleData: {
            enable: true,
            idKey: "id",
            pIdKey: "pId"
          }
        },
        callback: {
          onClick: this.onNodeClick.bind(this)
        }
      };
      
      // 初始化或刷新树
      const $ = (this.window as any).$;
      this.treeObj = $.fn.zTree.init($("#historyTree"), setting, zNodes);
      
      Zotero.log(`[HistoryTreeZTreeDirect] Tree initialized with ${zNodes.length} nodes`, 'info');
      
    } catch (error) {
      Zotero.logError(`[HistoryTreeZTreeDirect] Failed to refresh: ${error}`);
    }
  }
  
  private async buildZNodes(sessions: any[], closedTabs: any[]): Promise<any[]> {
    const nodes = [];
    let nodeId = 1;
    
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
      const dateNodeId = nodeId++;
      nodes.push({
        id: dateNodeId,
        pId: 0,
        name: `${date}`,
        open: true,
        isParent: true,
        iconSkin: "date",
        customIcon: "📅"
      });
      
      // 创建会话节点
      for (const { session, nodes: historyNodes } of sessionData) {
        const sessionNodeId = nodeId++;
        nodes.push({
          id: sessionNodeId,
          pId: dateNodeId,
          name: `Session ${session.id.slice(-6)} (${historyNodes.length} items)`,
          open: false,
          isParent: true,
          iconSkin: "session",
          customIcon: "📚"
        });
        
        // 创建历史节点
        for (const historyNode of historyNodes) {
          nodes.push({
            id: nodeId++,
            pId: sessionNodeId,
            name: historyNode.title || 'Untitled',
            iconSkin: "item",
            customIcon: historyNode.status === 'active' ? "📖" : "📕",
            nodeData: historyNode
          });
        }
      }
    }
    
    // 创建关闭标签节点
    if (closedTabs.length > 0) {
      const closedRootId = nodeId++;
      nodes.push({
        id: closedRootId,
        pId: 0,
        name: `Closed Tabs (${closedTabs.length})`,
        open: true,
        isParent: true,
        iconSkin: "closed",
        customIcon: "👻"
      });
      
      for (const tab of closedTabs) {
        nodes.push({
          id: nodeId++,
          pId: closedRootId,
          name: tab.node.title || 'Untitled',
          iconSkin: "closedItem",
          customIcon: "👻",
          closedTab: tab
        });
      }
    }
    
    return nodes;
  }
  
  private addDiyDom(treeId: string, treeNode: any): void {
    const $ = (this.window as any).$;
    const aObj = $("#" + treeNode.tId + "_a");
    
    if (treeNode.customIcon) {
      const iconHtml = `<span class='button custom_icon'>${treeNode.customIcon}</span>`;
      aObj.prepend(iconHtml);
    }
  }
  
  private onNodeClick(event: any, treeId: string, treeNode: any): void {
    if (treeNode.nodeData && treeNode.nodeData.itemId) {
      // 打开历史项目
      const ZoteroPane = Zotero.getActiveZoteroPane();
      if (ZoteroPane) {
        ZoteroPane.selectItem(treeNode.nodeData.itemId);
      }
    } else if (treeNode.closedTab) {
      // 恢复关闭的标签
      this.closedTabsManager.restoreTab(treeNode.closedTab);
    }
  }
}