/**
 * Simple test version to verify UI visibility
 */

declare const Zotero: any;
declare const Services: any;
declare const ChromeUtils: any;

function install(data: any, reason: number): void {}

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

    const win = Zotero.getMainWindow();
    if (!win || !win.document) {
      throw new Error("No main window");
    }

    const doc = win.document;
    
    // 方法1: 在主工具栏添加一个简单按钮
    const toolbar = doc.getElementById("zotero-items-toolbar") || 
                   doc.getElementById("zotero-toolbar") ||
                   doc.querySelector("toolbar");
    
    if (toolbar) {
      // 创建一个简单的按钮
      const button = doc.createXULElement("toolbarbutton");
      button.id = "rn-test-button";
      button.setAttribute("label", "RN Test");
      button.setAttribute("tooltiptext", "Research Navigator Test Button");
      button.style.cssText = "background: #ff0000; color: white; font-weight: bold;";
      button.addEventListener("click", () => {
        win.alert("Research Navigator button clicked!");
      });
      
      // 添加到工具栏内部
      toolbar.appendChild(button);
      Zotero.log("[RN Simple] Button added to toolbar: " + toolbar.id, "warn");
    } else {
      Zotero.log("[RN Simple] No toolbar found!", "error");
    }
    
    // 方法2: 在主窗口添加一个浮动div
    const floater = doc.createElement("div");
    floater.id = "rn-test-floater";
    floater.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #ff0000;
      color: white;
      padding: 10px 20px;
      border-radius: 5px;
      z-index: 99999;
      cursor: pointer;
      font-weight: bold;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    `;
    floater.textContent = "Research Navigator Active";
    floater.addEventListener("click", () => {
      floater.style.display = "none";
    });
    
    if (doc.body) {
      doc.body.appendChild(floater);
      Zotero.log("[RN Simple] Floater added to body", "warn");
    } else {
      Zotero.log("[RN Simple] No body found!", "error");
    }
    
    // 列出所有工具栏
    const toolbars = doc.getElementsByTagName("toolbar");
    Zotero.log("[RN Simple] Found toolbars:", "warn");
    for (let i = 0; i < toolbars.length; i++) {
      Zotero.log(`  - ${toolbars[i].id || "(no id)"}`, "warn");
    }
    
  } catch (error) {
    Zotero.logError(error);
    Services.prompt.alert(null, "RN Simple Error", error.toString());
  }
}

function shutdown({ id, version, rootURI }: any, reason: number): void {
  try {
    const win = Zotero.getMainWindow();
    if (win && win.document) {
      const button = win.document.getElementById("rn-test-button");
      if (button) button.remove();
      
      const floater = win.document.getElementById("rn-test-floater");
      if (floater) floater.remove();
    }
  } catch (error) {
    Zotero.logError(error);
  }
}

function uninstall(data: any, reason: number): void {}

// 导出到 window
if (!window.startup) window.startup = startup;
if (!window.shutdown) window.shutdown = shutdown;
if (!window.install) window.install = install;
if (!window.uninstall) window.uninstall = uninstall;