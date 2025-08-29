/**
 * 使用 zTree 的历史树组件
 */

/// <reference path="../../../types/ztree.d.ts" />

import { HistoryService } from '../../../services/history-service';
import { HistoryNode } from '../../../services/database-service';
import { ClosedTabsManager } from '../../../managers/closed-tabs-manager';

declare const $: any;

export class HistoryTreeZTree {
  private container: HTMLElement;
  private treeObj: IZTreeObj | null = null;
  private treeContainer: HTMLElement | null = null;
  
  constructor(
    private window: Window,
    private historyService: HistoryService,
    private closedTabsManager: ClosedTabsManager
  ) {}
  
  /**
   * 初始化组件
   */
  async init(container: HTMLElement): Promise<void> {
    this.container = container;
    const doc = this.window.document;
    
    // 清空容器
    this.container.innerHTML = '';
    
    // 创建工具栏
    const toolbar = this.createToolbar(doc);
    this.container.appendChild(toolbar);
    
    // 创建树容器
    this.treeContainer = doc.createElement('div');
    this.treeContainer.id = 'history-ztree';
    this.treeContainer.className = 'ztree';
    this.treeContainer.style.cssText = `
      flex: 1;
      overflow: auto;
      padding: 10px;
    `;
    this.container.appendChild(this.treeContainer);
    
    try {
      // 加载 jQuery 和 zTree（如果尚未加载）
      await this.loadDependencies();
      
      // 初始化树
      await this.refreshTree();
    } catch (error) {
      Zotero.logError(`[HistoryTreeZTree] Failed to initialize zTree, showing error message: ${error}`);
      // 显示错误消息
      this.treeContainer.innerHTML = `
        <div style="padding: 20px; text-align: center; color: #666;">
          <p>Failed to load tree view components.</p>
          <p style="font-size: 12px; margin-top: 10px;">Error: ${error}</p>
          <p style="font-size: 12px; margin-top: 10px;">Please disable zTree in preferences or contact support if the issue persists.</p>
        </div>
      `;
    }
  }
  
  /**
   * 创建工具栏
   */
  private createToolbar(doc: Document): HTMLElement {
    const toolbar = doc.createElement('div');
    toolbar.style.cssText = `
      display: flex;
      padding: 8px;
      gap: 8px;
      border-bottom: 1px solid var(--fill-quinary);
      align-items: center;
    `;
    
    // 刷新按钮
    const refreshBtn = doc.createElement('button');
    refreshBtn.textContent = '🔄 Refresh';
    refreshBtn.style.cssText = `
      padding: 4px 8px;
      font-size: 12px;
    `;
    refreshBtn.addEventListener('click', () => this.refreshTree());
    toolbar.appendChild(refreshBtn);
    
    // 展开/折叠按钮
    const expandAllBtn = doc.createElement('button');
    expandAllBtn.textContent = '📂 Expand All';
    expandAllBtn.style.cssText = `
      padding: 4px 8px;
      font-size: 12px;
    `;
    expandAllBtn.addEventListener('click', () => {
      if (this.treeObj) {
        const isExpanded = expandAllBtn.textContent.includes('Expand');
        this.treeObj.expandAll(isExpanded);
        expandAllBtn.textContent = isExpanded ? '📁 Collapse All' : '📂 Expand All';
      }
    });
    toolbar.appendChild(expandAllBtn);
    
    // 设置按钮
    const settingsBtn = doc.createElement('button');
    settingsBtn.textContent = '⚙️ Settings';
    settingsBtn.style.cssText = `
      padding: 4px 8px;
      font-size: 12px;
      margin-left: auto;
    `;
    settingsBtn.addEventListener('click', () => this.showSettings());
    toolbar.appendChild(settingsBtn);
    
    return toolbar;
  }
  
  /**
   * 加载依赖
   */
  private async loadDependencies(): Promise<void> {
    try {
      const doc = this.window.document;
      const win = this.window as any;
      
      Zotero.log('[HistoryTreeZTree] Starting dependency loading...', 'info');
      
      // 检查 jQuery 是否已加载
      if (typeof win.$ === 'undefined' && typeof win.jQuery === 'undefined') {
        Zotero.log('[HistoryTreeZTree] jQuery not found, loading...', 'info');
        // 加载 jQuery
        await this.loadScript('chrome://researchnavigator/content/lib/jquery.min.js');
        
        // 等待 jQuery 真正可用
        let jQueryCheckCount = 0;
        while ((typeof win.$ === 'undefined' && typeof win.jQuery === 'undefined') && jQueryCheckCount < 10) {
          await new Promise(resolve => setTimeout(resolve, 100));
          jQueryCheckCount++;
        }
        
        if (typeof win.$ === 'undefined' && typeof win.jQuery === 'undefined') {
          throw new Error('jQuery failed to load after multiple attempts');
        }
        
        Zotero.log('[HistoryTreeZTree] jQuery loaded successfully', 'info');
      }
      
      // 获取 jQuery 引用
      const $ = win.$ || win.jQuery;
      
      // 检查 zTree 是否已加载
      if (!$ || typeof $.fn.zTree === 'undefined') {
        Zotero.log('[HistoryTreeZTree] zTree not found, loading...', 'info');
        
        // 加载 zTree CSS
        const link = doc.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'chrome://researchnavigator/content/lib/ztree/zTreeStyle.css';
        
        // 确保 head 存在
        if (doc.head) {
          doc.head.appendChild(link);
        } else if (doc.documentElement) {
          doc.documentElement.appendChild(link);
        } else {
          // 延迟加载
          setTimeout(() => {
            if (doc.head) {
              doc.head.appendChild(link);
            }
          }, 100);
        }
        
        // 加载 zTree JS
        await this.loadScript('chrome://researchnavigator/content/lib/ztree/jquery.ztree.core.min.js');
        
        // 等待 zTree 真正可用
        let zTreeCheckCount = 0;
        while ((!$ || typeof $.fn.zTree === 'undefined') && zTreeCheckCount < 10) {
          await new Promise(resolve => setTimeout(resolve, 100));
          zTreeCheckCount++;
        }
        
        if (!$ || typeof $.fn.zTree === 'undefined') {
          throw new Error('zTree failed to load after multiple attempts');
        }
        
        Zotero.log('[HistoryTreeZTree] zTree loaded successfully', 'info');
      }
      
      Zotero.log('[HistoryTreeZTree] All dependencies loaded', 'info');
    } catch (error) {
      Zotero.logError(`[HistoryTreeZTree] Failed to load dependencies: ${error}`);
      throw error;
    }
  }
  
  /**
   * 动态加载脚本
   */
  private loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // 检查是否有 Services.scriptloader 可用
        if (typeof Services !== 'undefined' && Services.scriptloader) {
          Zotero.log(`[HistoryTreeZTree] Attempting to load script via Services.scriptloader: ${src}`, 'info');
          
          try {
            // 尝试加载脚本到 window 作用域
            Services.scriptloader.loadSubScript(src, this.window, 'UTF-8');
            Zotero.log(`[HistoryTreeZTree] Script loaded successfully via Services.scriptloader: ${src}`, 'info');
            resolve();
            return;
          } catch (e) {
            Zotero.log(`[HistoryTreeZTree] Services.scriptloader failed, falling back to DOM method: ${e}`, 'warn');
          }
        }
        
        // 回退到 DOM 方法
        const doc = this.window.document;
        Zotero.log(`[HistoryTreeZTree] Loading script via DOM: ${src}`, 'info');
        
        const script = doc.createElement('script');
        script.type = 'text/javascript';
        script.src = src;
        
        let loaded = false;
        const onLoad = () => {
          if (!loaded) {
            loaded = true;
            Zotero.log(`[HistoryTreeZTree] Script loaded successfully via DOM: ${src}`, 'info');
            resolve();
          }
        };
        
        const onError = (error: any) => {
          if (!loaded) {
            loaded = true;
            Zotero.logError(`[HistoryTreeZTree] Failed to load script via DOM: ${src}`);
            reject(new Error(`Failed to load script: ${src}`));
          }
        };
        
        script.addEventListener('load', onLoad);
        script.addEventListener('error', onError);
        
        // 尝试附加到不同的位置
        const appendScript = () => {
          if (doc.head) {
            doc.head.appendChild(script);
          } else if (doc.body) {
            doc.body.appendChild(script);
          } else if (doc.documentElement) {
            doc.documentElement.appendChild(script);
          } else {
            // 如果 DOM 还没准备好，等待一下再试
            setTimeout(() => {
              if (doc.head || doc.body) {
                appendScript();
              } else {
                onError(new Error('No suitable element to append script'));
              }
            }, 100);
          }
        };
        
        appendScript();
      } catch (error) {
        Zotero.logError(`[HistoryTreeZTree] Unexpected error loading script ${src}: ${error}`);
        reject(error);
      }
    });
  }
  
  /**
   * 刷新树
   */
  async refreshTree(): Promise<void> {
    if (!this.treeContainer) return;
    
    // 获取数据
    const sessions = await this.historyService.getAllSessions();
    const closedTabs = this.closedTabsManager.getClosedTabs();
    
    // 转换为 zTree 节点格式
    const zNodes: IZTreeNode[] = [];
    
    // 按日期分组
    const dateGroups = new Map<string, IZTreeNode[]>();
    
    // 处理 sessions
    for (const session of sessions) {
      const date = new Date(session.startTime).toLocaleDateString();
      if (!dateGroups.has(date)) {
        dateGroups.set(date, []);
      }
      
      // 获取该 session 的所有节点
      const nodes = await this.historyService.getSessionNodes(session.id);
      
      const sessionNode: IZTreeNode = {
        id: `session_${session.id}`,
        pId: `date_${date}`,
        name: `📚 Session ${session.id.slice(-6)}`,
        title: `${nodes.length} items`,
        open: false,
        isParent: true,
        sessionData: session
      };
      
      dateGroups.get(date)!.push(sessionNode);
      
      // 添加子节点
      for (const node of nodes) {
        const childNode: IZTreeNode = {
          id: `node_${node.id}`,
          pId: sessionNode.id,
          name: this.formatNodeName(node),
          title: node.title,
          icon: this.getNodeIcon(node),
          nodeData: node
        };
        zNodes.push(childNode);
      }
    }
    
    // 处理 closed tabs（按日期分组）
    const closedByDate = new Map<string, any[]>();
    for (const closedTab of closedTabs) {
      const date = closedTab.closedAt.toLocaleDateString();
      if (!closedByDate.has(date)) {
        closedByDate.set(date, []);
      }
      closedByDate.get(date)!.push(closedTab);
    }
    
    // 创建日期节点
    const allDates = new Set([...dateGroups.keys(), ...closedByDate.keys()]);
    const sortedDates = Array.from(allDates).sort((a, b) => 
      new Date(b).getTime() - new Date(a).getTime()
    );
    
    for (const date of sortedDates) {
      const dateNode: IZTreeNode = {
        id: `date_${date}`,
        pId: null,
        name: `📅 ${date}`,
        open: sortedDates.indexOf(date) < 3, // 默认展开最近3天
        isParent: true
      };
      zNodes.push(dateNode);
      
      // 添加该日期的 sessions
      const dateSessions = dateGroups.get(date) || [];
      zNodes.push(...dateSessions);
      
      // 添加该日期的 closed tabs
      const dateClosedTabs = closedByDate.get(date) || [];
      if (dateClosedTabs.length > 0) {
        const closedGroupNode: IZTreeNode = {
          id: `closed_${date}`,
          pId: `date_${date}`,
          name: `👻 Closed Tabs (${dateClosedTabs.length})`,
          open: false,
          isParent: true,
          icon: 'chrome://researchnavigator/content/icons/ghost.png'
        };
        zNodes.push(closedGroupNode);
        
        for (const closedTab of dateClosedTabs) {
          const closedNode: IZTreeNode = {
            id: `closed_${closedTab.node.id}`,
            pId: closedGroupNode.id,
            name: `👻 ${closedTab.node.title || 'Untitled'}`,
            title: `Closed at ${closedTab.closedAt.toLocaleTimeString()}`,
            icon: this.getNodeIcon(closedTab.node),
            closedTabData: closedTab
          };
          zNodes.push(closedNode);
        }
      }
    }
    
    // 初始化或更新树
    const setting: IZTreeSetting = {
      view: {
        dblClickExpand: true,
        showLine: true,
        showIcon: true,
        nameIsHTML: true,
        addDiyDom: (treeId: string, treeNode: IZTreeNode) => {
          this.addCustomButtons(treeId, treeNode);
        }
      },
      data: {
        simpleData: {
          enable: true,
          idKey: "id",
          pIdKey: "pId"
        }
      },
      callback: {
        onClick: (event: Event, treeId: string, treeNode: IZTreeNode) => {
          this.handleNodeClick(treeNode);
        },
        onRightClick: (event: Event, treeId: string, treeNode: IZTreeNode) => {
          this.handleNodeRightClick(event, treeNode);
        }
      }
    };
    
    // 使用 jQuery 初始化 zTree
    const $ = this.window.$;
    this.treeObj = $.fn.zTree.init($(this.treeContainer), setting, zNodes);
  }
  
  /**
   * 格式化节点名称
   */
  private formatNodeName(node: HistoryNode): string {
    const icon = this.getNodeIcon(node);
    const status = node.status === 'active' ? '🟢' : '⚫';
    return `${icon} ${status} ${node.title || 'Untitled'}`;
  }
  
  /**
   * 获取节点图标
   */
  private getNodeIcon(node: HistoryNode): string {
    switch (node.itemType) {
      case 'journalArticle':
        return '📄';
      case 'book':
        return '📚';
      case 'webpage':
        return '🌐';
      case 'attachment':
        return node.title?.toLowerCase().includes('.pdf') ? '📑' : '📎';
      default:
        return '📝';
    }
  }
  
  /**
   * 添加自定义按钮
   */
  private addCustomButtons(treeId: string, treeNode: IZTreeNode): void {
    const $ = this.window.$;
    const aObj = $(`#${treeNode.tId}_a`);
    
    // 为历史节点添加删除按钮
    if (treeNode.nodeData || treeNode.closedTabData) {
      const deleteBtn = $('<span class="button" style="margin-left:5px;">🗑️</span>');
      deleteBtn.bind('click', (e: Event) => {
        e.stopPropagation();
        this.handleDeleteNode(treeNode);
      });
      aObj.append(deleteBtn);
    }
    
    // 为关闭的标签添加恢复按钮
    if (treeNode.closedTabData) {
      const restoreBtn = $('<span class="button" style="margin-left:5px;">↩️</span>');
      restoreBtn.bind('click', (e: Event) => {
        e.stopPropagation();
        this.handleRestoreTab(treeNode.closedTabData);
      });
      aObj.append(restoreBtn);
    }
  }
  
  /**
   * 处理节点点击
   */
  private handleNodeClick(treeNode: IZTreeNode): void {
    if (treeNode.nodeData) {
      // 打开项目
      const itemId = treeNode.nodeData.itemId;
      Zotero.getActiveZoteroPane().selectItem(itemId);
    } else if (treeNode.closedTabData) {
      // 显示关闭标签的信息
      const info = treeNode.closedTabData;
      Zotero.log(`Closed tab: ${info.node.title} at ${info.closedAt}`, "info");
    }
  }
  
  /**
   * 处理节点右键
   */
  private handleNodeRightClick(event: Event, treeNode: IZTreeNode): void {
    // TODO: 实现右键菜单
    event.preventDefault();
  }
  
  /**
   * 处理删除节点
   */
  private async handleDeleteNode(treeNode: IZTreeNode): Promise<void> {
    if (confirm('Delete this history node?')) {
      if (treeNode.nodeData) {
        await this.historyService.deleteNode(treeNode.nodeData.id);
      } else if (treeNode.closedTabData) {
        // 使用节点的 ID 来删除
        const tabId = treeNode.closedTabData.node.id;
        await this.closedTabsManager.removeClosedTab(tabId);
      }
      await this.refreshTree();
    }
  }
  
  /**
   * 处理恢复标签
   */
  private async handleRestoreTab(closedTab: any): Promise<void> {
    const index = this.closedTabsManager.getClosedTabs().indexOf(closedTab);
    if (index !== -1) {
      await this.closedTabsManager.restoreTab(index);
      await this.refreshTree();
    }
  }
  
  /**
   * 显示设置对话框
   */
  private showSettings(): void {
    const doc = this.window.document;
    
    // 创建对话框
    const dialog = doc.createElement('div');
    dialog.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      z-index: 1000;
    `;
    
    // 创建标题
    const title = doc.createElement('h3');
    title.textContent = 'History Settings';
    dialog.appendChild(title);
    
    // 创建第一个设置项
    const div1 = doc.createElement('div');
    div1.style.margin = '10px 0';
    const label1 = doc.createElement('label');
    label1.textContent = 'Load history for last ';
    const input1 = doc.createElement('input');
    input1.type = 'number';
    input1.id = 'historyDays';
    input1.min = '1';
    input1.max = '365';
    input1.value = String(Zotero.Prefs.get('researchnavigator.historyLoadDays', true) || 7);
    input1.style.width = '50px';
    label1.appendChild(input1);
    label1.appendChild(doc.createTextNode(' days'));
    div1.appendChild(label1);
    dialog.appendChild(div1);
    
    // 创建第二个设置项
    const div2 = doc.createElement('div');
    div2.style.margin = '10px 0';
    const label2 = doc.createElement('label');
    label2.textContent = 'Maximum history groups: ';
    const input2 = doc.createElement('input');
    input2.type = 'number';
    input2.id = 'maxGroups';
    input2.min = '10';
    input2.max = '500';
    input2.value = String(Zotero.Prefs.get('researchnavigator.maxHistoryGroups', true) || 50);
    input2.style.width = '50px';
    label2.appendChild(input2);
    div2.appendChild(label2);
    dialog.appendChild(div2);
    
    // 创建按钮容器
    const buttonDiv = doc.createElement('div');
    buttonDiv.style.marginTop = '20px';
    buttonDiv.style.textAlign = 'right';
    const saveBtn = doc.createElement('button');
    saveBtn.id = 'saveSettings';
    saveBtn.textContent = 'Save';
    const cancelBtn = doc.createElement('button');
    cancelBtn.id = 'cancelSettings';
    cancelBtn.textContent = 'Cancel';
    buttonDiv.appendChild(saveBtn);
    buttonDiv.appendChild(doc.createTextNode(' '));
    buttonDiv.appendChild(cancelBtn);
    dialog.appendChild(buttonDiv);
    
    // 背景遮罩
    const overlay = doc.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      z-index: 999;
    `;
    
    doc.body.appendChild(overlay);
    doc.body.appendChild(dialog);
    
    // 事件处理
    doc.getElementById('saveSettings')!.addEventListener('click', () => {
      const days = parseInt((doc.getElementById('historyDays') as HTMLInputElement).value);
      const groups = parseInt((doc.getElementById('maxGroups') as HTMLInputElement).value);
      
      Zotero.Prefs.set('researchnavigator.historyLoadDays', days, true);
      Zotero.Prefs.set('researchnavigator.maxHistoryGroups', groups, true);
      
      doc.body.removeChild(overlay);
      doc.body.removeChild(dialog);
      
      // 重新加载设置并刷新
      this.closedTabsManager['loadSettings']();
      this.refreshTree();
    });
    
    doc.getElementById('cancelSettings')!.addEventListener('click', () => {
      doc.body.removeChild(overlay);
      doc.body.removeChild(dialog);
    });
  }
}