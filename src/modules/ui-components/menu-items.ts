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
  callbacks: MenuCallbacks,
): Promise<void> {
  addon.ztoolkit.log("[Menu] Starting menu registration...");

  try {
    // 工具菜单项
    addon.ztoolkit.log("[Menu] Registering Tools menu items...");
    addon.ztoolkit.Menu.register("menuTools", {
      tag: "menuseparator",
    });

    addon.ztoolkit.Menu.register("menuTools", {
      tag: "menuitem",
      id: `${config.addonRef}-menu-open`,
      label: "Research Navigator",
      accessKey: "R",
      commandListener: () => {
        addon.ztoolkit.log("[Menu] Tools menu item clicked");
        callbacks.onOpenHistory();
      },
      icon: `chrome://${config.addonRef}/content/icons/icon.svg`,
    });
    addon.ztoolkit.log("[Menu] Tools menu items registered");

    // 文件菜单 - 导出
    addon.ztoolkit.log("[Menu] Registering File menu items...");
    addon.ztoolkit.Menu.register("menuFile", {
      tag: "menuseparator",
      insertAfter: "menu_export",
    });

    addon.ztoolkit.Menu.register("menuFile", {
      tag: "menuitem",
      id: `${config.addonRef}-menu-export`,
      label: "Export Research History...",
      commandListener: () => {
        addon.ztoolkit.log("[Menu] Export menu item clicked");
        callbacks.onExportHistory();
      },
      insertAfter: "menu_export",
    });
    addon.ztoolkit.log("[Menu] File menu items registered");

    // 右键菜单 - 项目菜单
    addon.ztoolkit.log("[Menu] Registering item context menu...");
    addon.ztoolkit.Menu.register("item", {
      tag: "menuseparator",
    });

    addon.ztoolkit.Menu.register("item", {
      tag: "menuitem",
      id: `${config.addonRef}-context-view-history`,
      label: "View in Research History",
      commandListener: () => {
        addon.ztoolkit.log("[Menu] Item context menu clicked");
        const items = Zotero.getActiveZoteroPane().getSelectedItems();
        addon.ztoolkit.log(`[Menu] Selected items: ${items.length}`);
        if (items.length > 0) {
          const item = items[0];
          addon.ztoolkit.log(
            `[Menu] First item: ${item.getField("title")} (ID: ${item.id})`,
          );
          // 打开历史面板并定位到该项目
          callbacks.onOpenHistory();
        }
      },
    });

    // 添加更多右键菜单项
    addon.ztoolkit.Menu.register("item", {
      tag: "menuitem",
      id: `${config.addonRef}-context-show-history`,
      label: "Show Item History",
      commandListener: () => {
        addon.ztoolkit.log("[Menu] Show Item History clicked");
        const items = Zotero.getActiveZoteroPane().getSelectedItems();
        if (items.length > 0) {
          const item = items[0];
          const historyInfo = `Item: ${item.getField("title")}\nType: ${item.itemType}\nID: ${item.id}`;
          addon.ztoolkit.log(`[Menu] History info: ${historyInfo}`);

          // 显示一个简单的对话框
          const ps = Components.classes[
            "@mozilla.org/embedcomp/prompt-service;1"
          ].getService(Components.interfaces.nsIPromptService);
          ps.alert(null, "Research Navigator - Item History", historyInfo);
        }
      },
    });

    // 添加一个最简单的测试菜单项
    addon.ztoolkit.Menu.register("item", {
      tag: "menuitem",
      id: `${config.addonRef}-context-test`,
      label: "Research Navigator Test",
      commandListener: () => {
        addon.ztoolkit.log("[Menu] Test menu item clicked!");
        // 使用 Zotero 的 alert 方法
        Zotero.alert(
          null,
          "Research Navigator",
          "Plugin is working! Right-click menu test successful.",
        );
      },
    });

    // 集合右键菜单
    addon.ztoolkit.log("[Menu] Registering collection context menu...");
    addon.ztoolkit.Menu.register("collection", {
      tag: "menuseparator",
    });

    addon.ztoolkit.Menu.register("collection", {
      tag: "menuitem",
      id: `${config.addonRef}-context-collection-history`,
      label: "View Collection History",
      commandListener: () => {
        addon.ztoolkit.log("[Menu] Collection context menu clicked");
        const collectionTreeRow =
          Zotero.getActiveZoteroPane().getCollectionTreeRow();
        if (collectionTreeRow) {
          addon.ztoolkit.log(`[Menu] Collection: ${collectionTreeRow.name}`);
          callbacks.onOpenHistory();
        }
      },
    });

    addon.ztoolkit.log("[Menu] All menu items registered successfully");
  } catch (error) {
    addon.ztoolkit.log(
      `[Menu] Error registering menu items: ${error}`,
      "error",
    );
    addon.ztoolkit.log(`[Menu] Error stack: ${error.stack}`, "error");
  }
}
