/**
 * 调试版历史树 - 用于诊断问题
 */

import { HistoryService } from '../../../services/history-service';
import { ClosedTabsManager } from '../../../managers/closed-tabs-manager';

export class HistoryTreeDebug {
  private container: HTMLElement;
  
  constructor(
    private window: Window,
    private historyService: HistoryService,
    private closedTabsManager: ClosedTabsManager
  ) {
    Zotero.log('[HistoryTreeDebug] Constructor called', 'info');
  }
  
  async init(container: HTMLElement): Promise<void> {
    Zotero.log('[HistoryTreeDebug] Init called', 'info');
    Zotero.log(`[HistoryTreeDebug] Container: ${container}`, 'info');
    Zotero.log(`[HistoryTreeDebug] Container parent: ${container.parentNode}`, 'info');
    
    this.container = container;
    const doc = container.ownerDocument || this.window.document;
    
    try {
      // 步骤1: 显示基本信息
      container.innerHTML = '<div style="padding: 20px;">Loading History Tree Debug...</div>';
      Zotero.log('[HistoryTreeDebug] Step 1: Basic HTML set', 'info');
      
      // 步骤2: 创建调试界面
      container.innerHTML = `
        <div style="padding: 20px; font-family: Arial, sans-serif;">
          <h3>History Tree Debug</h3>
          <div id="debug-info" style="background: #f0f0f0; padding: 10px; margin: 10px 0;">
            <p>Checking services...</p>
          </div>
          <div id="debug-data" style="background: #e0e0e0; padding: 10px; margin: 10px 0;">
            <p>Loading data...</p>
          </div>
          <div id="debug-tree" style="background: #d0d0d0; padding: 10px; margin: 10px 0;">
            <p>Tree will appear here...</p>
          </div>
        </div>
      `;
      Zotero.log('[HistoryTreeDebug] Step 2: Debug UI created', 'info');
      
      const infoDiv = doc.getElementById('debug-info');
      const dataDiv = doc.getElementById('debug-data');
      const treeDiv = doc.getElementById('debug-tree');
      
      // 步骤3: 检查服务
      if (infoDiv) {
        infoDiv.innerHTML = `
          <p>✅ Container attached: ${!!container.parentNode}</p>
          <p>✅ Window available: ${!!this.window}</p>
          <p>✅ HistoryService: ${!!this.historyService}</p>
          <p>✅ ClosedTabsManager: ${!!this.closedTabsManager}</p>
        `;
      }
      Zotero.log('[HistoryTreeDebug] Step 3: Services checked', 'info');
      
      // 步骤4: 加载数据
      try {
        const sessions = await this.historyService.getAllSessions();
        const closedTabs = this.closedTabsManager.getClosedTabs();
        
        if (dataDiv) {
          dataDiv.innerHTML = `
            <p>✅ Sessions loaded: ${sessions.length}</p>
            <p>✅ Closed tabs: ${closedTabs.length}</p>
            <p>First session: ${sessions.length > 0 ? sessions[0].id : 'none'}</p>
          `;
        }
        Zotero.log(`[HistoryTreeDebug] Step 4: Data loaded - ${sessions.length} sessions`, 'info');
        
        // 步骤5: 创建简单树
        if (treeDiv) {
          let treeHTML = '<h4>History Tree:</h4>';
          
          // 按日期分组
          const dateGroups = new Map<string, any[]>();
          
          for (const session of sessions) {
            const date = new Date(session.startTime).toLocaleDateString();
            if (!dateGroups.has(date)) {
              dateGroups.set(date, []);
            }
            const nodes = await this.historyService.getSessionNodes(session.id);
            dateGroups.get(date)!.push({ session, nodes });
          }
          
          // 渲染日期组
          for (const [date, sessionData] of dateGroups) {
            treeHTML += `<div style="margin: 10px 0;">`;
            treeHTML += `<strong>📅 ${date}</strong>`;
            
            for (const { session, nodes } of sessionData) {
              treeHTML += `<div style="margin-left: 20px;">`;
              treeHTML += `📚 Session ${session.id.slice(-6)} (${nodes.length} items)`;
              
              for (const node of nodes) {
                const icon = node.status === 'active' ? '📖' : '📕';
                treeHTML += `<div style="margin-left: 40px; cursor: pointer;" onclick="Zotero.getActiveZoteroPane().selectItem(${node.itemId})">`;
                treeHTML += `${icon} ${node.title || 'Untitled'}`;
                treeHTML += `</div>`;
              }
              
              treeHTML += `</div>`;
            }
            
            treeHTML += `</div>`;
          }
          
          // 渲染关闭的标签
          if (closedTabs.length > 0) {
            treeHTML += `<div style="margin: 10px 0;">`;
            treeHTML += `<strong>👻 Closed Tabs (${closedTabs.length})</strong>`;
            
            for (const tab of closedTabs) {
              treeHTML += `<div style="margin-left: 20px; cursor: pointer;">`;
              treeHTML += `👻 ${tab.node.title || 'Untitled'}`;
              treeHTML += `</div>`;
            }
            
            treeHTML += `</div>`;
          }
          
          treeDiv.innerHTML = treeHTML;
        }
        Zotero.log('[HistoryTreeDebug] Step 5: Tree rendered', 'info');
        
      } catch (error) {
        Zotero.logError(`[HistoryTreeDebug] Error loading data: ${error}`);
        if (dataDiv) {
          dataDiv.innerHTML = `<p style="color: red;">❌ Error: ${error}</p>`;
        }
      }
      
    } catch (error) {
      Zotero.logError(`[HistoryTreeDebug] Init error: ${error}`);
      container.innerHTML = `
        <div style="padding: 20px; color: red;">
          <h3>Error in History Tree Debug</h3>
          <p>${error}</p>
        </div>
      `;
    }
  }
}