/**
 * Debug version of bootstrap to test UI visibility
 */

declare const Zotero: any;
declare const Services: any;
declare const ChromeUtils: any;

function install(data: any, reason: number): void {
  // 安装时不做任何事
}

async function startup(
  { id, version, rootURI }: { id: string; version: string; rootURI: string },
  reason: number,
): Promise<void> {
  try {
    // 等待 Zotero 初始化
    while (typeof Zotero === "undefined" || !Zotero.initialized) {
      await new Promise((resolve) => {
        if (typeof ChromeUtils !== "undefined" && ChromeUtils.idleDispatch) {
          ChromeUtils.idleDispatch(resolve);
        } else {
          resolve();
        }
      });
    }

    Zotero.log(`[Research Navigator DEBUG] Starting up... Version: ${version}`, "warn");
    
    // 获取主窗口
    const win = Zotero.getMainWindow();
    if (!win) {
      throw new Error("No main window found");
    }
    
    Zotero.log("[Research Navigator DEBUG] Main window found", "warn");
    
    // 创建一个非常明显的测试按钮
    const doc = win.document;
    
    // 方法1：在工具栏添加按钮
    const toolbar = doc.getElementById("zotero-tb-advanced-search");
    if (toolbar && toolbar.parentNode) {
      const button = doc.createXULElement("toolbarbutton");
      button.id = "research-navigator-debug-button";
      button.setAttribute("label", "RN DEBUG");
      button.setAttribute("tooltiptext", "Research Navigator Debug Button");
      button.style.backgroundColor = "red";
      button.style.color = "white";
      button.addEventListener("click", () => {
        win.alert("Research Navigator is running!");
      });
      
      toolbar.parentNode.insertBefore(button, toolbar);
      Zotero.log("[Research Navigator DEBUG] Toolbar button added", "warn");
    } else {
      Zotero.log("[Research Navigator DEBUG] Toolbar not found", "error");
    }
    
    // 方法2：添加一个浮动的调试面板
    const debugPanel = doc.createElement("div");
    debugPanel.id = "research-navigator-debug-panel";
    debugPanel.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: red;
      color: white;
      padding: 10px;
      z-index: 99999;
      font-weight: bold;
      cursor: pointer;
    `;
    debugPanel.textContent = "Research Navigator DEBUG";
    debugPanel.addEventListener("click", () => {
      debugPanel.remove();
    });
    
    if (doc.body) {
      doc.body.appendChild(debugPanel);
      Zotero.log("[Research Navigator DEBUG] Debug panel added to body", "warn");
    } else {
      Zotero.log("[Research Navigator DEBUG] Document body not found", "error");
    }
    
    // 方法3：修改窗口标题
    const originalTitle = doc.title;
    doc.title = "[RN DEBUG] " + originalTitle;
    
    // 在控制台打印状态
    Zotero.log("[Research Navigator DEBUG] UI initialization completed", "warn");
    Zotero.log(`[Research Navigator DEBUG] Window title: ${doc.title}`, "warn");
    Zotero.log(`[Research Navigator DEBUG] Body exists: ${!!doc.body}`, "warn");
    Zotero.log(`[Research Navigator DEBUG] Toolbar exists: ${!!toolbar}`, "warn");
    
  } catch (error) {
    Zotero.logError(error);
    Services.prompt.alert(
      null,
      "Research Navigator DEBUG",
      `Failed to start: ${error}`
    );
  }
}

function shutdown(
  { id, version, rootURI }: { id: string; version: string; rootURI: string },
  reason: number,
): void {
  try {
    Zotero.log("[Research Navigator DEBUG] Shutting down...", "warn");
    
    const win = Zotero.getMainWindow();
    if (win && win.document) {
      // 清理调试元素
      const button = win.document.getElementById("research-navigator-debug-button");
      if (button) button.remove();
      
      const panel = win.document.getElementById("research-navigator-debug-panel");
      if (panel) panel.remove();
      
      // 恢复标题
      if (win.document.title.startsWith("[RN DEBUG] ")) {
        win.document.title = win.document.title.substring(11);
      }
    }
  } catch (error) {
    Zotero.logError(error);
  }
}

function uninstall(data: any, reason: number): void {
  // 卸载时不做任何事
}

// 导出到 window
if (!window.startup) window.startup = startup;
if (!window.shutdown) window.shutdown = shutdown;
if (!window.install) window.install = install;
if (!window.uninstall) window.uninstall = uninstall;