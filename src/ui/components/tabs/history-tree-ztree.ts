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
  
  /**
   * 获取内联的 HTML 内容
   */
  private getInlineHTML(): string {
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>History Tree</title>
    <style>
        body {
            margin: 0;
            padding: 10px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 13px;
            background: var(--material-background, #fff);
            color: var(--fill-primary, #000);
        }
        
        #toolbar {
            display: flex;
            align-items: center;
            padding: 5px 0;
            margin-bottom: 10px;
            border-bottom: 1px solid #e0e0e0;
        }
        
        #toolbar button {
            margin-right: 10px;
            padding: 4px 8px;
            font-size: 12px;
            border: 1px solid #ccc;
            background: #f5f5f5;
            cursor: pointer;
            border-radius: 3px;
        }
        
        #toolbar button:hover {
            background: #e0e0e0;
        }
        
        #tree-container {
            height: calc(100vh - 60px);
            overflow: auto;
        }
        
        /* 自定义 zTree 样式 */
        .ztree li span.button.remove {
            margin-left: 5px;
            background: none;
            border: none;
            cursor: pointer;
        }
        
        .ztree li span.button.restore {
            margin-left: 5px;
            background: none;
            border: none;
            cursor: pointer;
        }
    </style>
</head>
<body>
    <div id="toolbar">
        <button id="refresh-btn">🔄 Refresh</button>
        <button id="clear-btn">🗑️ Clear All</button>
        <button id="settings-btn">⚙️ Settings</button>
    </div>
    <div id="tree-container" class="ztree"></div>
    
    <script>
        // 立即执行初始化
        (function() {
            // 确保 DOM 已加载
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', initializeTree);
            } else {
                // DOM 已经加载完成
                setTimeout(initializeTree, 0);
            }
        })();
        
        function initializeTree() {
            console.log('Initializing tree in iframe...');
            // 全局变量
            window.treeObj = null;
            
            // 与父窗口通信的 API
            window.historyTreeAPI = {
                // 构建树
                buildTree: function(data) {
                    const zNodes = convertToZNodes(data);
                    
                    const setting = {
                        view: {
                            dblClickExpand: true,
                            showLine: true,
                            showIcon: true,
                            nameIsHTML: true,
                            addDiyDom: addCustomButtons
                        },
                        data: {
                            simpleData: {
                                enable: true,
                                idKey: "id",
                                pIdKey: "pId"
                            }
                        },
                        callback: {
                            onClick: handleNodeClick,
                            onRightClick: handleNodeRightClick
                        }
                    };
                    
                    window.treeObj = $.fn.zTree.init($("#tree-container"), setting, zNodes);
                },
                
                // 刷新树
                refresh: function() {
                    if (window.parent && window.parent.refreshHistoryTree) {
                        window.parent.refreshHistoryTree();
                    }
                },
                
                // 获取树对象
                getTree: function() {
                    return window.treeObj;
                }
            };
            
            // 转换数据为 zTree 节点格式
            function convertToZNodes(data) {
                const zNodes = [];
                const { dateGroups, closedTabs } = data;
                
                // 处理日期分组
                dateGroups.forEach(([date, sessionData]) => {
                    // 创建日期节点
                    const dateNode = {
                        id: 'date_' + date,
                        pId: null,
                        name: '📅 ' + date,
                        open: true,
                        isParent: true
                    };
                    zNodes.push(dateNode);
                    
                    // 处理该日期下的 sessions
                    sessionData.forEach(({ session, nodes }) => {
                        const sessionNode = {
                            id: 'session_' + session.id,
                            pId: 'date_' + date,
                            name: '📚 Session ' + session.id.slice(-6),
                            title: nodes.length + ' items',
                            open: false,
                            isParent: true,
                            sessionData: session
                        };
                        zNodes.push(sessionNode);
                        
                        // 添加子节点
                        nodes.forEach(node => {
                            const nodeIcon = node.status === 'active' ? '📖' : '📕';
                            const historyNode = {
                                id: 'node_' + node.id,
                                pId: 'session_' + session.id,
                                name: nodeIcon + ' ' + (node.title || 'Untitled'),
                                title: 'Visited at ' + new Date(node.timestamp).toLocaleTimeString(),
                                historyNode: node
                            };
                            zNodes.push(historyNode);
                        });
                    });
                });
                
                // 处理关闭的标签
                if (closedTabs && closedTabs.length > 0) {
                    const closedTabsNode = {
                        id: 'closed_tabs',
                        pId: null,
                        name: '👻 Closed Tabs (' + closedTabs.length + ')',
                        open: true,
                        isParent: true
                    };
                    zNodes.push(closedTabsNode);
                    
                    closedTabs.forEach((tab, index) => {
                        const closedNode = {
                            id: 'closed_' + index,
                            pId: 'closed_tabs',
                            name: '👻 ' + (tab.node.title || 'Untitled'),
                            title: 'Closed at ' + tab.closedAt.toLocaleTimeString(),
                            closedTabData: tab
                        };
                        zNodes.push(closedNode);
                    });
                }
                
                return zNodes;
            }
            
            // 添加自定义按钮
            function addCustomButtons(treeId, treeNode) {
                const aObj = $("#" + treeNode.tId + "_a");
                
                if (treeNode.historyNode) {
                    // 添加删除按钮
                    const deleteBtn = $('<span class="button remove">🗑️</span>');
                    deleteBtn.on('click', function(e) {
                        e.stopPropagation();
                        if (window.parent && window.parent.deleteHistoryNode) {
                            window.parent.deleteHistoryNode(treeNode.historyNode.id);
                        }
                    });
                    aObj.append(deleteBtn);
                }
                
                if (treeNode.closedTabData) {
                    // 添加恢复按钮
                    const restoreBtn = $('<span class="button restore">↩️</span>');
                    restoreBtn.on('click', function(e) {
                        e.stopPropagation();
                        if (window.parent && window.parent.restoreClosedTab) {
                            window.parent.restoreClosedTab(treeNode.closedTabData);
                        }
                    });
                    aObj.append(restoreBtn);
                }
            }
            
            // 处理节点点击
            function handleNodeClick(event, treeId, treeNode) {
                if (window.parent && window.parent.handleHistoryNodeClick) {
                    window.parent.handleHistoryNodeClick(treeNode);
                }
            }
            
            // 处理右键点击
            function handleNodeRightClick(event, treeId, treeNode) {
                if (window.parent && window.parent.handleHistoryNodeRightClick) {
                    window.parent.handleHistoryNodeRightClick(event, treeNode);
                }
            }
            
            // 工具栏按钮事件
            document.getElementById('refresh-btn').addEventListener('click', function() {
                window.historyTreeAPI.refresh();
            });
            
            document.getElementById('clear-btn').addEventListener('click', function() {
                if (window.parent && window.parent.clearAllHistory) {
                    window.parent.clearAllHistory();
                }
            });
            
            document.getElementById('settings-btn').addEventListener('click', function() {
                if (window.parent && window.parent.showHistorySettings) {
                    window.parent.showHistorySettings();
                }
            });
            
            // 通知父窗口准备就绪
            try {
                if (window.parent && window.parent !== window) {
                    // 使用 postMessage 通知父窗口
                    window.parent.postMessage({ type: 'treeReady' }, '*');
                }
            } catch (e) {
                console.error('Failed to notify parent:', e);
            }
        }
    </script>
</body>
</html>`;
  }
  
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
    
    // 监听来自 iframe 的消息
    this.window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'treeReady') {
        Zotero.log('[HistoryTreeZTree] Received treeReady message from iframe', 'info');
      }
    });
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
    
    // 使用 data URL 来避免路径问题
    const htmlContent = this.getInlineHTML();
    const dataURL = 'data:text/html;charset=UTF-8,' + encodeURIComponent(htmlContent);
    this.iframe.setAttribute('src', dataURL);
    Zotero.log('[HistoryTreeZTree] Using data URL for iframe content', 'info');
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
      
      // 立即调用初始化
      this.onIframeReady().catch(error => {
        Zotero.logError(`[HistoryTreeZTree] Failed to initialize iframe: ${error}`);
      });
    });
    
    // 添加到容器
    this.container.appendChild(this.iframe);
    
    Zotero.log('[HistoryTreeZTree] iframe created and appended', 'info');
  }
  
  /**
   * iframe 准备就绪的回调
   */
  private async onIframeReady(): Promise<void> {
    Zotero.log('[HistoryTreeZTree] iframe ready, injecting dependencies', 'info');
    
    if (!this.iframeWindow) {
      Zotero.logError('[HistoryTreeZTree] No iframe window available');
      return;
    }
    
    try {
      const iframeDoc = this.iframeWindow.document;
      
      // 注入 jQuery
      const jqueryScript = iframeDoc.createElement('script');
      jqueryScript.textContent = await this.loadFileContent('chrome://researchnavigator/content/lib/jquery.min.js');
      iframeDoc.head.appendChild(jqueryScript);
      
      // 注入 zTree JS
      const ztreeScript = iframeDoc.createElement('script');
      ztreeScript.textContent = await this.loadFileContent('chrome://researchnavigator/content/lib/ztree/jquery.ztree.core.min.js');
      iframeDoc.head.appendChild(ztreeScript);
      
      // 注入 zTree CSS
      const ztreeCSS = iframeDoc.createElement('style');
      ztreeCSS.textContent = await this.loadFileContent('chrome://researchnavigator/content/lib/ztree/zTreeStyle.css');
      // 修复 CSS 中的图片路径
      ztreeCSS.textContent = ztreeCSS.textContent.replace(/url\(["']?([^"')]+)["']?\)/g, (match, url) => {
        if (url && !url.startsWith('data:') && !url.startsWith('http')) {
          // 将相对路径转换为 data URL 或 chrome URL
          return `url("chrome://researchnavigator/content/lib/ztree/${url}")`;
        }
        return match;
      });
      iframeDoc.head.appendChild(ztreeCSS);
      
      // 等待 iframe 内部初始化完成
      await new Promise(resolve => setTimeout(resolve, 200));
      
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
   * 加载文件内容
   */
  private async loadFileContent(url: string): Promise<string> {
    try {
      // 首先尝试获取插件的实际路径
      let actualUrl = url;
      if (url.startsWith('chrome://researchnavigator/')) {
        try {
          const rootURI = Zotero.Plugins?.getRootURI ? 
            await Zotero.Plugins.getRootURI('research-navigator@zotero.org') : 
            null;
          
          if (rootURI) {
            actualUrl = url.replace('chrome://researchnavigator/', rootURI);
            Zotero.log(`[HistoryTreeZTree] Converted URL: ${url} -> ${actualUrl}`, 'info');
          }
        } catch (e) {
          Zotero.log(`[HistoryTreeZTree] Failed to get plugin root URI: ${e}`, 'warn');
        }
      }
      
      // 尝试使用 Zotero 的文件读取方法
      if (Zotero.File && Zotero.File.getContentsFromURL) {
        return await Zotero.File.getContentsFromURL(actualUrl);
      }
      
      // 备用方法：使用 XMLHttpRequest
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', actualUrl, true);
        xhr.onload = () => {
          if (xhr.status === 200) {
            resolve(xhr.responseText);
          } else {
            reject(new Error(`Failed to load ${actualUrl}: ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error(`Failed to load ${actualUrl}`));
        xhr.send();
      });
    } catch (error) {
      Zotero.logError(`[HistoryTreeZTree] Failed to load file ${url}: ${error}`);
      throw error;
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