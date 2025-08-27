/* global Components, Services, Zotero, dump */
const { classes: Cc, interfaces: Ci, utils: Cu } = Components;

dump("\n[Research Navigator Debug] Bootstrap loading...\n");

// 等待 Zotero 初始化
async function waitForZotero() {
  dump("[Research Navigator Debug] Waiting for Zotero...\n");
  
  if (typeof Zotero != "undefined") {
    dump("[Research Navigator Debug] Zotero already available\n");
    await Zotero.initializationPromise;
    return;
  }

  var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
  var windows = Services.wm.getEnumerator("navigator:browser");
  var found = false;
  while (windows.hasMoreElements()) {
    let win = windows.getNext();
    if (win.Zotero) {
      Zotero = win.Zotero;
      found = true;
      dump("[Research Navigator Debug] Found Zotero in existing window\n");
      break;
    }
  }
  
  if (!found) {
    dump("[Research Navigator Debug] Waiting for Zotero window...\n");
    await new Promise((resolve) => {
      var listener = {
        onOpenWindow: function (aWindow) {
          let domWindow = aWindow
            .QueryInterface(Ci.nsIInterfaceRequestor)
            .getInterface(Ci.nsIDOMWindowInternal || Ci.nsIDOMWindow);
          domWindow.addEventListener(
            "load",
            function () {
              domWindow.removeEventListener("load", arguments.callee, false);
              if (domWindow.Zotero) {
                Services.wm.removeListener(listener);
                Zotero = domWindow.Zotero;
                dump("[Research Navigator Debug] Found Zotero in new window\n");
                resolve();
              }
            },
            false
          );
        },
      };
      Services.wm.addListener(listener);
    });
  }
  await Zotero.initializationPromise;
  dump("[Research Navigator Debug] Zotero initialized\n");
}

var ResearchNavigator = {
  id: null,
  version: null,
  rootURI: null,
  
  addedElementIds: [],
  
  debug(msg) {
    Zotero.debug(`[Research Navigator] ${msg}`);
    dump(`[Research Navigator] ${msg}\n`);
  }
};

function install(data, reason) {
  dump("[Research Navigator Debug] Install called\n");
}

async function startup({ id, version, resourceURI, rootURI }, reason) {
  dump("[Research Navigator Debug] Startup called\n");
  dump(`[Research Navigator Debug] ID: ${id}, Version: ${version}\n`);
  dump(`[Research Navigator Debug] Reason: ${reason}\n`);
  
  try {
    await waitForZotero();
    
    if (!rootURI) {
      rootURI = resourceURI.spec;
    }

    ResearchNavigator.id = id;
    ResearchNavigator.version = version;
    ResearchNavigator.rootURI = rootURI;
    
    ResearchNavigator.debug('Starting Research Navigator');
    
    // 注册到 Zotero
    Zotero.ResearchNavigator = ResearchNavigator;
    
    // 确保在所有已打开的窗口中添加 UI
    var windows = Services.wm.getEnumerator("navigator:browser");
    while (windows.hasMoreElements()) {
      let win = windows.getNext();
      if (win.Zotero && win.document.readyState === "complete") {
        addUI(win);
      }
    }
    
    // 监听新窗口
    Services.wm.addListener(windowListener);
    
    ResearchNavigator.debug('Research Navigator started successfully');
  } catch (e) {
    dump(`[Research Navigator Debug] Startup error: ${e}\n`);
    dump(`[Research Navigator Debug] Stack: ${e.stack}\n`);
  }
}

const APP_SHUTDOWN = 2;

function shutdown({ id, version, resourceURI, rootURI }, reason) {
  dump(`[Research Navigator Debug] Shutdown called, reason: ${reason}\n`);
  
  if (reason === APP_SHUTDOWN) {
    return;
  }
  
  // 移除监听器
  Services.wm.removeListener(windowListener);
  
  // 移除所有窗口的 UI
  var windows = Services.wm.getEnumerator("navigator:browser");
  while (windows.hasMoreElements()) {
    let win = windows.getNext();
    if (win.document) {
      removeUI(win);
    }
  }
  
  // 从 Zotero 对象移除
  if (Zotero.ResearchNavigator) {
    delete Zotero.ResearchNavigator;
  }
}

function uninstall(data, reason) {
  dump("[Research Navigator Debug] Uninstall called\n");
}

// 窗口监听器
var windowListener = {
  onOpenWindow: function (aWindow) {
    let domWindow = aWindow
      .QueryInterface(Ci.nsIInterfaceRequestor)
      .getInterface(Ci.nsIDOMWindowInternal || Ci.nsIDOMWindow);
    domWindow.addEventListener(
      "load",
      function () {
        domWindow.removeEventListener("load", arguments.callee, false);
        if (domWindow.Zotero) {
          addUI(domWindow);
        }
      },
      false
    );
  },
  onCloseWindow: function (aWindow) {},
  onWindowTitleChange: function (aWindow, aTitle) {}
};

// 添加 UI
function addUI(window) {
  ResearchNavigator.debug('Adding UI to window');
  
  const doc = window.document;
  
  // 1. 添加浮动测试按钮（右下角）
  if (!doc.getElementById("research-navigator-float-button")) {
    const floatBtn = doc.createElement("button");
    floatBtn.id = "research-navigator-float-button";
    floatBtn.textContent = "🌳";
    floatBtn.title = "Research Navigator Debug";
    floatBtn.style.cssText = `
      position: fixed !important;
      bottom: 20px !important;
      right: 20px !important;
      z-index: 99999 !important;
      background: #4CAF50 !important;
      color: white !important;
      border: none !important;
      width: 50px !important;
      height: 50px !important;
      border-radius: 50% !important;
      cursor: pointer !important;
      box-shadow: 0 4px 6px rgba(0,0,0,0.3) !important;
      font-size: 24px !important;
    `;
    
    floatBtn.onclick = function(e) {
      e.preventDefault();
      e.stopPropagation();
      ResearchNavigator.debug('Float button clicked');
      alert('Research Navigator is working!\n\nVersion: ' + ResearchNavigator.version);
    };
    
    // 尝试多个父元素
    const parents = [doc.body, doc.documentElement, doc.getElementById("browser"), doc.querySelector("#appcontent")];
    for (let parent of parents) {
      if (parent) {
        try {
          parent.appendChild(floatBtn);
          ResearchNavigator.addedElementIds.push("research-navigator-float-button");
          ResearchNavigator.debug('Float button added successfully');
          break;
        } catch (e) {
          ResearchNavigator.debug(`Failed to add to ${parent}: ${e}`);
        }
      }
    }
  }
  
  // 2. 添加工具菜单项
  const toolsMenu = doc.getElementById("menu_ToolsPopup");
  if (toolsMenu && !doc.getElementById("research-navigator-tools-menu")) {
    const menuitem = doc.createXULElement("menuitem");
    menuitem.id = "research-navigator-tools-menu";
    menuitem.setAttribute("label", "Research Navigator Debug");
    menuitem.addEventListener("command", function() {
      ResearchNavigator.debug('Tools menu clicked');
      alert('Research Navigator Tools Menu Working!');
    });
    toolsMenu.appendChild(menuitem);
    ResearchNavigator.addedElementIds.push("research-navigator-tools-menu");
    ResearchNavigator.debug('Tools menu added successfully');
  }
  
  ResearchNavigator.debug('UI addition completed');
}

// 移除 UI
function removeUI(window) {
  const doc = window.document;
  
  for (let id of ResearchNavigator.addedElementIds) {
    const elem = doc.getElementById(id);
    if (elem && elem.parentNode) {
      elem.parentNode.removeChild(elem);
    }
  }
}

dump("[Research Navigator Debug] Bootstrap loaded\n");