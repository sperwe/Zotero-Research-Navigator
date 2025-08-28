/* global Components, Services */
const { classes: Cc, interfaces: Ci, utils: Cu } = Components;

// 等待 Zotero 初始化
async function waitForZotero() {
  if (typeof Zotero != "undefined") {
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
      break;
    }
  }
  if (!found) {
    await new Promise((resolve) => {
      var listener = {
        onOpenWindow: function (aWindow) {
          // Wait for the window to finish loading
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
                resolve();
              }
            },
            false,
          );
        },
      };
      Services.wm.addListener(listener);
    });
  }
  await Zotero.initializationPromise;
}

var ResearchNavigator = {
  id: null,
  version: null,
  rootURI: null,
  addedElementIds: [],
};

function install(data, reason) {}

async function startup({ id, version, resourceURI, rootURI }, reason) {
  await waitForZotero();

  // String 'rootURI' introduced in Zotero 7
  if (!rootURI) {
    rootURI = resourceURI.spec;
  }

  ResearchNavigator.id = id;
  ResearchNavigator.version = version;
  ResearchNavigator.rootURI = rootURI;

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
}

function shutdown({ id, version, resourceURI, rootURI }, reason) {
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

function uninstall(data, reason) {}

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
      false,
    );
  },
  onCloseWindow: function (aWindow) {},
  onWindowTitleChange: function (aWindow, aTitle) {},
};

// 添加 UI
function addUI(window) {
  const doc = window.document;

  // 1. 添加浮动测试按钮（使用 HTML）
  if (!doc.getElementById("research-navigator-float-button")) {
    const floatBtn = doc.createElement("button");
    floatBtn.id = "research-navigator-float-button";
    floatBtn.textContent = "RN Test";
    floatBtn.style.cssText = `
      position: fixed !important;
      bottom: 20px !important;
      right: 20px !important;
      z-index: 99999 !important;
      background: #2196F3 !important;
      color: white !important;
      border: none !important;
      padding: 10px 15px !important;
      border-radius: 50px !important;
      cursor: pointer !important;
      box-shadow: 0 4px 6px rgba(0,0,0,0.3) !important;
      font-weight: bold !important;
    `;
    floatBtn.onclick = function () {
      window.alert(
        "Research Navigator is working!\n\nThis proves the plugin loaded correctly.",
      );
    };

    // 尝试多个父元素
    const parents = [
      doc.body,
      doc.documentElement,
      doc.getElementById("browser"),
      doc.querySelector("#appcontent"),
    ];
    for (let parent of parents) {
      if (parent) {
        try {
          parent.appendChild(floatBtn);
          ResearchNavigator.addedElementIds.push(
            "research-navigator-float-button",
          );
          break;
        } catch (e) {}
      }
    }
  }

  // 2. 添加工具菜单项
  const toolsMenu = doc.getElementById("menu_ToolsPopup");
  if (toolsMenu && !doc.getElementById("research-navigator-tools-menu")) {
    const menuitem = doc.createXULElement("menuitem");
    menuitem.id = "research-navigator-tools-menu";
    menuitem.setAttribute("label", "Research Navigator (Working!)");
    menuitem.addEventListener("command", function () {
      window.alert("Research Navigator Tools Menu clicked!");
    });
    toolsMenu.appendChild(menuitem);
    ResearchNavigator.addedElementIds.push("research-navigator-tools-menu");
  }

  // 3. 添加右键菜单到文献
  const itemMenu = doc.getElementById("zotero-itemmenu");
  if (itemMenu && !doc.getElementById("research-navigator-item-menu")) {
    const menuitem = doc.createXULElement("menuitem");
    menuitem.id = "research-navigator-item-menu";
    menuitem.setAttribute("label", "Test Research Navigator");
    menuitem.addEventListener("command", function () {
      const items = window.ZoteroPane.getSelectedItems();
      window.alert(`Selected ${items.length} items`);
    });
    itemMenu.appendChild(menuitem);
    ResearchNavigator.addedElementIds.push("research-navigator-item-menu");
  }

  // 4. 添加状态栏图标（Zotero 7）
  try {
    const statusBar =
      doc.getElementById("status-bar") ||
      doc.getElementById("zotero-status-bar");
    if (statusBar && !doc.getElementById("research-navigator-status")) {
      const statusIcon = doc.createXULElement("toolbarbutton");
      statusIcon.id = "research-navigator-status";
      statusIcon.className = "statusbarpanel-iconic";
      statusIcon.setAttribute("tooltiptext", "Research Navigator Active");
      statusIcon.style.listStyleImage =
        "url('chrome://zotero/skin/16/universal/folder.png')";
      statusIcon.addEventListener("command", function () {
        window.alert("Research Navigator Status clicked!");
      });
      statusBar.appendChild(statusIcon);
      ResearchNavigator.addedElementIds.push("research-navigator-status");
    }
  } catch (e) {}
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
