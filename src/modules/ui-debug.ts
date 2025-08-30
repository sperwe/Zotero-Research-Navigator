/**
 * UI Debug Module
 * 用于调试 UI 组件问题
 */

export class UIDebugger {
  static logAvailableToolbars(doc: Document): void {
    addon.ztoolkit.log("=== Available Toolbars ===");

    const toolbarIds = [
      "zotero-items-toolbar",
      "zotero-tb-advanced-search",
      "zotero-toolbar",
      "zotero-tb-actions",
      "nav-bar",
      "zotero-collections-toolbar",
      "zotero-tabs-toolbar",
    ];

    toolbarIds.forEach((id) => {
      const toolbar = doc.getElementById(id);
      if (toolbar) {
        addon.ztoolkit.log(`✓ ${id}: Found`);
        addon.ztoolkit.log(`  - Tag: ${toolbar.tagName}`);
        addon.ztoolkit.log(`  - Children: ${toolbar.children.length}`);
        addon.ztoolkit.log(
          `  - Parent: ${toolbar.parentElement?.id || "unknown"}`,
        );
      } else {
        addon.ztoolkit.log(`✗ ${id}: Not found`);
      }
    });
  }

  static logAvailableMenus(doc: Document): void {
    addon.ztoolkit.log("=== Available Menus ===");

    const menuIds = [
      "menu_ToolsPopup",
      "menu_FilePopup",
      "zotero-itemmenu",
      "menuTools",
      "menuFile",
    ];

    menuIds.forEach((id) => {
      const menu = doc.getElementById(id);
      if (menu) {
        addon.ztoolkit.log(`✓ ${id}: Found`);
      } else {
        addon.ztoolkit.log(`✗ ${id}: Not found`);
      }
    });
  }

  static checkChromeRegistration(): void {
    addon.ztoolkit.log("=== Chrome Registration Check ===");

    try {
      // 尝试解析 chrome URL
      const testUrl = `chrome://${config.addonRef}/content/icons/icon.svg`;
      addon.ztoolkit.log(`Testing URL: ${testUrl}`);

      // 在 Zotero 环境中，可以使用 Services.io
      if (typeof Services !== "undefined" && Services.io) {
        try {
          const uri = Services.io.newURI(testUrl, null, null);
          addon.ztoolkit.log(`✓ Chrome URL can be parsed: ${uri.spec}`);
        } catch (e) {
          addon.ztoolkit.log(`✗ Chrome URL parse failed: ${e}`);
        }
      }
    } catch (e) {
      addon.ztoolkit.log(`Chrome check error: ${e}`);
    }
  }

  static logZoteroEnvironment(): void {
    addon.ztoolkit.log("=== Zotero Environment ===");
    addon.ztoolkit.log(`Zotero version: ${Zotero.version}`);
    addon.ztoolkit.log(`Platform: ${Zotero.platform}`);
    addon.ztoolkit.log(`OS: ${Zotero.oscpu || "unknown"}`);
    addon.ztoolkit.log(`Locale: ${Zotero.locale}`);
    addon.ztoolkit.log(`Debug mode: ${Zotero.Debug?.enabled || false}`);
  }

  static createTestButton(doc: Document): void {
    addon.ztoolkit.log("=== Creating Test Button ===");

    try {
      const toolbar = doc.getElementById("zotero-items-toolbar");
      if (!toolbar) {
        addon.ztoolkit.log("✗ Items toolbar not found");
        return;
      }

      // 移除旧的测试按钮
      const oldButton = doc.getElementById("test-rn-button");
      if (oldButton) {
        oldButton.remove();
      }

      // 创建新按钮
      const button = doc.createXULElement("toolbarbutton");
      button.id = "test-rn-button";
      button.setAttribute("label", "RN Test");
      button.setAttribute("tooltiptext", "Research Navigator Test Button");
      button.style.listStyleImage =
        "url('chrome://zotero/skin/16/universal/add.svg')";

      button.addEventListener("command", () => {
        alert("Research Navigator Test Button Clicked!");
      });

      toolbar.appendChild(button);
      addon.ztoolkit.log("✓ Test button created");
    } catch (e) {
      addon.ztoolkit.log(`✗ Test button creation failed: ${e}`);
    }
  }

  static runFullDiagnostic(win: Window): void {
    const doc = win.document;

    addon.ztoolkit.log("\n========== UI DIAGNOSTIC REPORT ==========\n");

    this.logZoteroEnvironment();
    addon.ztoolkit.log("");

    this.logAvailableToolbars(doc);
    addon.ztoolkit.log("");

    this.logAvailableMenus(doc);
    addon.ztoolkit.log("");

    this.checkChromeRegistration();
    addon.ztoolkit.log("");

    this.createTestButton(doc);

    addon.ztoolkit.log("\n========== END DIAGNOSTIC ==========\n");
  }
}

// 导入配置
import { config } from "@/config";
