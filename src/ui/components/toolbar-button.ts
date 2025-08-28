/**
 * 工具栏按钮组件
 */

import { ClosedTabsManager } from "../../managers/closed-tabs-manager";
import { HistoryService } from "../../services/history-service";

export interface ToolbarButtonOptions {
  onTogglePanel: () => void;
  onQuickNote: () => void;
  onSearchHistory: () => void;
  onOpenPreferences: () => void;
  closedTabsManager: ClosedTabsManager;
  historyService: HistoryService;
}

export class ToolbarButton {
  private button: any = null;
  private popup: any = null;
  
  constructor(
    private window: Window,
    private options: ToolbarButtonOptions
  ) {}
  
  async create(): Promise<void> {
    const doc = this.window.document;
    
    Zotero.log("[ToolbarButton] Starting creation...", "info");
    
    // 尝试多个工具栏位置
    const toolbarIds = [
      "zotero-tb-advanced-search",
      "zotero-items-toolbar",
      "zotero-toolbar"
    ];
    
    let toolbar = null;
    for (const id of toolbarIds) {
      toolbar = doc.getElementById(id);
      if (toolbar) {
        Zotero.log(`[ToolbarButton] Found toolbar: ${id}`, "info");
        break;
      }
    }
    
    if (!toolbar) {
      Zotero.log("[ToolbarButton] No suitable toolbar found, trying fallback", "warn");
      // 尝试查找任何工具栏
      const toolbars = doc.getElementsByTagName("toolbar");
      if (toolbars.length > 0) {
        toolbar = toolbars[0];
        Zotero.log("[ToolbarButton] Using first available toolbar", "info");
      } else {
        throw new Error("No toolbar found in window");
      }
    }
    
    // 创建按钮
    this.button = doc.createXULElement("toolbarbutton");
    this.button.id = "research-navigator-toolbar-button";
    this.button.className = "zotero-tb-button research-navigator-button";
    this.button.setAttribute("tooltiptext", "Research Navigator");
    this.button.setAttribute("type", "menu-button");
    
    // 创建下拉菜单
    this.popup = this.createPopupMenu(doc);
    this.button.appendChild(this.popup);
    
    // 按钮点击事件
    this.button.addEventListener("command", (event: Event) => {
      if (event.target === this.button) {
        this.options.onTogglePanel();
      }
    });
    
    // 插入到工具栏
    toolbar.parentNode?.insertBefore(this.button, toolbar.nextSibling);
    
    // 更新菜单内容
    this.updateMenu();
    
    // 监听已关闭标签页变化
    this.window.addEventListener("research-navigator-closed-tabs-changed", () => {
      this.updateMenu();
    });
    
    Zotero.log("[ToolbarButton] Created successfully", "info");
  }
  
  /**
   * 创建下拉菜单
   */
  private createPopupMenu(doc: Document): any {
    const popup = doc.createXULElement("menupopup");
    popup.id = "research-navigator-popup";
    return popup;
  }
  
  /**
   * 更新菜单内容
   */
  private async updateMenu(): Promise<void> {
    if (!this.popup) return;
    
    const doc = this.window.document;
    
    // 清空菜单
    while (this.popup.firstChild) {
      this.popup.removeChild(this.popup.firstChild);
    }
    
    // 添加主要操作
    this.addMenuItem("Toggle Panel", "Alt+H", () => this.options.onTogglePanel());
    this.addMenuSeparator();
    
    // 添加已关闭标签页部分
    this.addClosedTabsSection();
    this.addMenuSeparator();
    
    // 快速操作
    this.addMenuItem("Quick Note", "Alt+N", () => this.options.onQuickNote());
    this.addMenuItem("Search History", "Ctrl+Shift+H", () => this.options.onSearchHistory());
    this.addMenuSeparator();
    
    // 最近项目
    await this.addRecentItemsSection();
    this.addMenuSeparator();
    
    // 设置
    this.addMenuItem("Settings", "", () => this.options.onOpenPreferences());
  }
  
  /**
   * 添加菜单项
   */
  private addMenuItem(label: string, acceltext: string, oncommand: () => void): void {
    const doc = this.window.document;
    const menuitem = doc.createXULElement("menuitem");
    
    menuitem.setAttribute("label", label);
    if (acceltext) {
      menuitem.setAttribute("acceltext", acceltext);
    }
    
    menuitem.addEventListener("command", oncommand);
    this.popup.appendChild(menuitem);
  }
  
  /**
   * 添加分隔线
   */
  private addMenuSeparator(): void {
    const doc = this.window.document;
    const separator = doc.createXULElement("menuseparator");
    this.popup.appendChild(separator);
  }
  
  /**
   * 添加已关闭标签页部分
   */
  private addClosedTabsSection(): void {
    const closedTabs = this.options.closedTabsManager.getClosedTabs(5);
    
    if (closedTabs.length === 0) {
      const menuitem = this.window.document.createXULElement("menuitem");
      menuitem.setAttribute("label", "No recently closed tabs");
      menuitem.setAttribute("disabled", "true");
      this.popup.appendChild(menuitem);
      return;
    }
    
    // 标题
    const header = this.window.document.createXULElement("menuitem");
    header.setAttribute("label", `Restore closed tabs (${closedTabs.length})`);
    header.setAttribute("disabled", "true");
    header.style.fontWeight = "bold";
    this.popup.appendChild(header);
    
    // 列出已关闭的标签页
    for (const closedTab of closedTabs) {
      this.addMenuItem(
        this.truncateTitle(closedTab.node.title),
        closedTab.closedAt.toLocaleTimeString(),
        async () => {
          const success = await this.options.closedTabsManager.restoreTab(closedTab.node.id);
          if (!success) {
            // TODO: 显示错误通知
            Zotero.log("[ToolbarButton] Failed to restore tab", "warn");
          }
        }
      );
    }
    
    // 如果还有更多
    const totalCount = this.options.closedTabsManager.getClosedTabsCount();
    if (totalCount > 5) {
      this.addMenuItem(
        `View all ${totalCount} closed tabs...`,
        "",
        () => {
          // 切换到已关闭标签页视图
          this.options.onTogglePanel();
          // TODO: 切换到已关闭标签页标签
        }
      );
    }
  }
  
  /**
   * 添加最近项目部分
   */
  private async addRecentItemsSection(): Promise<void> {
    const currentSession = await this.options.historyService.getCurrentSessionNodes();
    const recentItems = currentSession.slice(-5).reverse(); // 最近5个
    
    if (recentItems.length === 0) {
      const menuitem = this.window.document.createXULElement("menuitem");
      menuitem.setAttribute("label", "No recent items");
      menuitem.setAttribute("disabled", "true");
      this.popup.appendChild(menuitem);
      return;
    }
    
    // 标题
    const header = this.window.document.createXULElement("menuitem");
    header.setAttribute("label", "Recent Items");
    header.setAttribute("disabled", "true");
    header.style.fontWeight = "bold";
    this.popup.appendChild(header);
    
    // 列出最近项目
    for (const node of recentItems) {
      const timeAgo = this.getTimeAgo(node.lastVisit);
      this.addMenuItem(
        this.truncateTitle(node.title),
        timeAgo,
        async () => {
          await this.options.historyService.navigateToNode(node.id);
        }
      );
    }
  }
  
  /**
   * 截断标题
   */
  private truncateTitle(title: string, maxLength: number = 50): string {
    if (title.length <= maxLength) return title;
    return title.substring(0, maxLength - 3) + "...";
  }
  
  /**
   * 获取相对时间
   */
  private getTimeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }
  
  /**
   * 销毁组件
   */
  destroy(): void {
    if (this.button) {
      this.button.remove();
      this.button = null;
    }
    this.popup = null;
  }
}