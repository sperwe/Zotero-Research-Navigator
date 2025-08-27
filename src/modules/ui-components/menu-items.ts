/**
 * Menu Items Component
 * 注册和管理菜单项
 */

import { MenuManager } from "zotero-plugin-toolkit";
import { config } from "../../../package.json";

export interface MenuCallbacks {
  onOpenHistory: () => void;
  onClearHistory: () => void;
  onExportHistory: () => void;
}

export async function registerMenuItems(
  win: Window,
  callbacks: MenuCallbacks
): Promise<void> {
  // 工具菜单项
  addon.ztoolkit.Menu.register("menuTools", {
    tag: "menuseparator"
  });
  
  addon.ztoolkit.Menu.register("menuTools", {
    tag: "menuitem",
    id: `${config.addonRef}-menu-open`,
    label: "Research Navigator",
    accessKey: "R",
    commandListener: callbacks.onOpenHistory,
    icon: `chrome://${config.addonRef}/content/icons/icon.svg`
  });
  
  // 文件菜单 - 导出
  addon.ztoolkit.Menu.register("menuFile", {
    tag: "menuseparator",
    insertAfter: "menu_export"
  });
  
  addon.ztoolkit.Menu.register("menuFile", {
    tag: "menuitem",
    id: `${config.addonRef}-menu-export`,
    label: "Export Research History...",
    commandListener: callbacks.onExportHistory,
    insertAfter: "menu_export"
  });
  
  // 右键菜单 - 项目菜单
  addon.ztoolkit.Menu.register("item", {
    tag: "menuseparator"
  });
  
  addon.ztoolkit.Menu.register("item", {
    tag: "menuitem",
    id: `${config.addonRef}-context-view-history`,
    label: "View in Research History",
    commandListener: () => {
      const items = Zotero.getActiveZoteroPane().getSelectedItems();
      if (items.length > 0) {
        // 打开历史面板并定位到该项目
        callbacks.onOpenHistory();
        // TODO: 实现定位功能
      }
    }
  });
  
  addon.ztoolkit.log("Menu items registered");
}