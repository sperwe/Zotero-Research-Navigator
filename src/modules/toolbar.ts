/**
 * 工具栏功能模块
 */

import { config } from "@/config";
import { getString } from "../utils/locale";
import { HistoryNode } from "./historyTree";

export class ToolbarManager {
  private button: XUL.ToolBarButton | null = null;
  private popup: XUL.MenuPopup | null = null;

  constructor(private addon: any) {}

  /**
   * 初始化工具栏
   */
  public async init() {
    this.createToolbarButton();
    this.createPopupMenu();
  }

  /**
   * 创建工具栏按钮
   */
  private createToolbarButton() {
    const doc = this.addon.data.ztoolkit.getGlobal("document");

    // 查找参考位置
    const referenceNode = doc.getElementById("zotero-tb-advanced-search");
    if (!referenceNode) return;

    // 创建按钮
    this.button = this.addon.data.ztoolkit.UI.createElement(
      doc,
      "toolbarbutton",
      {
        id: "research-navigator-toolbar-button",
        classList: ["zotero-tb-button"],
        attributes: {
          tooltiptext: "Research Navigator",
          type: "menu-button",
          removable: "true",
        },
        styles: {
          listStyleImage: `url(chrome://${config.addonRef}/content/icons/icon.png)`,
        },
        listeners: [
          {
            type: "command",
            listener: (event: Event) => {
              if (event.target === this.button) {
                // 点击按钮主体，切换面板显示
                this.addon.hooks.onTogglePanel();
              }
            },
          },
        ],
      },
    ) as XUL.ToolBarButton;

    // 插入到工具栏
    referenceNode.parentNode?.insertBefore(
      this.button,
      referenceNode.nextSibling,
    );
  }

  /**
   * 创建下拉菜单
   */
  private createPopupMenu() {
    if (!this.button) return;

    const doc = this.addon.data.ztoolkit.getGlobal("document");

    this.popup = this.addon.data.ztoolkit.UI.createElement(doc, "menupopup", {
      id: "research-navigator-popup",
      classList: ["research-navigator-popup"],
    }) as XUL.MenuPopup;

    // 添加菜单项
    this.addMenuItem(
      "togglePanel",
      getString("toolbar-toggle-panel"),
      "Alt+H",
      () => {
        this.addon.hooks.onTogglePanel();
      },
    );

    this.addMenuSeparator();

    // 恢复最近关闭
    this.addClosedTabsSection();

    this.addMenuSeparator();

    // 快速操作
    this.addMenuItem(
      "quickNote",
      getString("toolbar-quick-note"),
      "Alt+N",
      () => {
        this.addon.hooks.onQuickNote();
      },
    );

    this.addMenuItem(
      "searchHistory",
      getString("toolbar-search-history"),
      "Ctrl+Shift+H",
      () => {
        this.addon.hooks.onSearchHistory();
      },
    );

    this.addMenuSeparator();

    // 最近访问
    this.addRecentItemsSection();

    this.addMenuSeparator();

    // 设置
    this.addMenuItem("settings", getString("toolbar-settings"), "", () => {
      this.addon.hooks.onOpenPreferences();
    });

    this.button.appendChild(this.popup);
  }

  /**
   * 添加菜单项
   */
  private addMenuItem(
    id: string,
    label: string,
    acceltext: string,
    oncommand: () => void,
  ) {
    if (!this.popup) return;

    const doc = this.addon.data.ztoolkit.getGlobal("document");
    const menuitem = this.addon.data.ztoolkit.UI.createElement(
      doc,
      "menuitem",
      {
        id: `research-navigator-menu-${id}`,
        attributes: {
          label,
          acceltext,
        },
        listeners: [
          {
            type: "command",
            listener: oncommand,
          },
        ],
      },
    );

    this.popup.appendChild(menuitem);
  }

  /**
   * 添加分隔线
   */
  private addMenuSeparator() {
    if (!this.popup) return;

    const doc = this.addon.data.ztoolkit.getGlobal("document");
    const separator = doc.createXULElement("menuseparator");
    this.popup.appendChild(separator);
  }

  /**
   * 添加已关闭标签页部分
   */
  private addClosedTabsSection() {
    if (!this.popup) return;

    const closedTabs = this.getClosedTabs();
    const count = closedTabs.length;

    if (count === 0) {
      this.addMenuItem(
        "no-closed-tabs",
        getString("toolbar-no-closed-tabs"),
        "",
        () => {},
      );
      return;
    }

    // 标题
    const doc = this.addon.data.ztoolkit.getGlobal("document");
    const header = this.addon.data.ztoolkit.UI.createElement(doc, "menuitem", {
      attributes: {
        label: getString("toolbar-restore-closed-tabs", { args: { count } }),
        disabled: "true",
        style: "font-weight: bold;",
      },
    });
    this.popup.appendChild(header);

    // 显示最近5个已关闭的标签页
    closedTabs.slice(0, 5).forEach((tab, index) => {
      this.addMenuItem(
        `closed-tab-${index}`,
        this.truncateTitle(tab.title),
        "",
        () => {
          this.addon.hooks.onRestoreTab(tab.id);
        },
      );
    });

    // 如果超过5个，添加"查看全部"
    if (count > 5) {
      this.addMenuItem(
        "view-all-closed",
        getString("toolbar-view-all-closed", { args: { count } }),
        "",
        () => {
          this.addon.hooks.onShowClosedTabs();
        },
      );
    }
  }

  /**
   * 添加最近访问部分
   */
  private addRecentItemsSection() {
    if (!this.popup) return;

    const recentItems = this.getRecentItems();

    if (recentItems.length === 0) {
      this.addMenuItem(
        "no-recent-items",
        getString("toolbar-no-recent-items"),
        "",
        () => {},
      );
      return;
    }

    // 标题
    const doc = this.addon.data.ztoolkit.getGlobal("document");
    const header = this.addon.data.ztoolkit.UI.createElement(doc, "menuitem", {
      attributes: {
        label: getString("toolbar-recent-items"),
        disabled: "true",
        style: "font-weight: bold;",
      },
    });
    this.popup.appendChild(header);

    // 显示最近5个项目
    recentItems.slice(0, 5).forEach((item, index) => {
      const timeAgo = this.getTimeAgo(item.lastVisit);
      this.addMenuItem(
        `recent-item-${index}`,
        `${this.truncateTitle(item.title)} (${timeAgo})`,
        "",
        () => {
          this.addon.hooks.onOpenItem(item.itemId);
        },
      );
    });
  }

  /**
   * 获取已关闭的标签页
   */
  private getClosedTabs(): any[] {
    try {
      const Zotero_Tabs = this.addon.data.ztoolkit.getGlobal("Zotero_Tabs");
      if (!Zotero_Tabs || !Zotero_Tabs._history) return [];

      // 扁平化历史记录
      const closedTabs: any[] = [];
      Zotero_Tabs._history.forEach((entry: any[]) => {
        entry.forEach((tab: any) => {
          if (tab.data && tab.data.itemID) {
            const item = Zotero.Items.get(tab.data.itemID);
            if (item) {
              closedTabs.push({
                id: tab.data.itemID,
                title: item.getField("title") || "Untitled",
                closedAt: tab.closedAt || Date.now(),
              });
            }
          }
        });
      });

      // 按关闭时间排序
      return closedTabs.sort((a, b) => b.closedAt - a.closedAt);
    } catch (e) {
      Zotero.logError(e);
      return [];
    }
  }

  /**
   * 获取最近访问的项目
   */
  private getRecentItems(): HistoryNode[] {
    try {
      const nodes = this.addon.data.researchNavigator.getAllNodes();
      return nodes
        .filter((node) => node.lastVisit)
        .sort((a, b) => b.lastVisit.getTime() - a.lastVisit.getTime())
        .slice(0, 10);
    } catch (e) {
      Zotero.logError(e);
      return [];
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

    if (seconds < 60) return getString("time-just-now");
    if (seconds < 3600)
      return getString("time-minutes-ago", {
        args: { count: Math.floor(seconds / 60) },
      });
    if (seconds < 86400)
      return getString("time-hours-ago", {
        args: { count: Math.floor(seconds / 3600) },
      });
    return getString("time-days-ago", {
      args: { count: Math.floor(seconds / 86400) },
    });
  }

  /**
   * 更新菜单
   */
  public updateMenu() {
    if (!this.popup) return;

    // 移除所有子元素
    while (this.popup.firstChild) {
      this.popup.removeChild(this.popup.firstChild);
    }

    // 重新创建菜单
    this.createPopupMenu();
  }

  /**
   * 销毁工具栏
   */
  public destroy() {
    this.button?.remove();
    this.button = null;
    this.popup = null;
  }
}
