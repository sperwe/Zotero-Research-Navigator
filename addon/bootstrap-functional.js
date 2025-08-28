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
  historyPanels: new Map(), // 存储每个窗口的历史面板

  // 历史追踪功能
  history: [],
  maxHistoryItems: 100,

  // 添加到历史
  addToHistory: function (item) {
    if (!item || !item.id) return;

    // 移除重复项
    this.history = this.history.filter((h) => h.id !== item.id);

    // 添加到开头
    this.history.unshift({
      id: item.id,
      title: item.getField("title"),
      creators: item
        .getCreators()
        .map((c) => c.firstName + " " + c.lastName)
        .join(", "),
      date: new Date().toISOString(),
      itemType: item.itemType,
    });

    // 限制数量
    if (this.history.length > this.maxHistoryItems) {
      this.history = this.history.slice(0, this.maxHistoryItems);
    }

    // 更新所有窗口的历史面板
    this.updateAllHistoryPanels();
  },

  // 更新所有历史面板
  updateAllHistoryPanels: function () {
    for (let [win, panel] of this.historyPanels) {
      this.updateHistoryPanel(win, panel);
    }
  },

  // 更新单个历史面板
  updateHistoryPanel: function (win, panel) {
    const doc = win.document;
    const listbox = doc.getElementById("research-navigator-history-list");
    if (!listbox) return;

    // 清空现有内容
    while (listbox.firstChild) {
      listbox.removeChild(listbox.firstChild);
    }

    // 添加历史项
    for (let item of this.history) {
      const listitem = doc.createXULElement("richlistitem");

      const vbox = doc.createXULElement("vbox");
      vbox.setAttribute("flex", "1");

      const titleLabel = doc.createXULElement("label");
      titleLabel.setAttribute("value", item.title || "Untitled");
      titleLabel.style.fontWeight = "bold";

      const metaLabel = doc.createXULElement("label");
      metaLabel.setAttribute(
        "value",
        `${item.creators || "Unknown"} - ${item.itemType}`,
      );
      metaLabel.style.fontSize = "0.9em";
      metaLabel.style.color = "#666";

      vbox.appendChild(titleLabel);
      vbox.appendChild(metaLabel);
      listitem.appendChild(vbox);

      // 点击打开项目
      listitem.addEventListener("dblclick", () => {
        const zoteroItem = Zotero.Items.get(item.id);
        if (zoteroItem) {
          win.ZoteroPane.selectItem(item.id);
        }
      });

      listbox.appendChild(listitem);
    }
  },
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

  // 监听选择事件
  Zotero.Notifier.registerObserver(
    {
      notify: async (event, type, ids, extraData) => {
        if (event === "select" && type === "item") {
          const items = Zotero.Items.get(ids);
          for (let item of items) {
            ResearchNavigator.addToHistory(item);
          }
        }
      },
    },
    ["item"],
    "ResearchNavigator",
  );

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

  // 移除通知观察者
  Zotero.Notifier.unregisterObserver("ResearchNavigator");

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

  // 清理历史面板映射
  ResearchNavigator.historyPanels.clear();

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

  // 1. 添加工具栏按钮
  addToolbarButton(window);

  // 2. 添加浮动测试按钮（右下角）
  if (!doc.getElementById("research-navigator-float-button")) {
    const floatBtn = doc.createElement("button");
    floatBtn.id = "research-navigator-float-button";
    floatBtn.textContent = "📚";
    floatBtn.title = "Research Navigator - Click to toggle history panel";
    floatBtn.style.cssText = `
      position: fixed !important;
      bottom: 20px !important;
      right: 20px !important;
      z-index: 99999 !important;
      background: #2196F3 !important;
      color: white !important;
      border: none !important;
      width: 50px !important;
      height: 50px !important;
      border-radius: 50% !important;
      cursor: pointer !important;
      box-shadow: 0 4px 6px rgba(0,0,0,0.3) !important;
      font-size: 24px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      transition: all 0.3s ease !important;
    `;

    floatBtn.onmouseover = function () {
      this.style.transform = "scale(1.1)";
    };

    floatBtn.onmouseout = function () {
      this.style.transform = "scale(1)";
    };

    floatBtn.onclick = function (e) {
      e.preventDefault();
      e.stopPropagation();
      toggleHistoryPanel(window);
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

  // 3. 添加工具菜单项
  const toolsMenu = doc.getElementById("menu_ToolsPopup");
  if (toolsMenu && !doc.getElementById("research-navigator-tools-menu")) {
    const separator = doc.createXULElement("menuseparator");
    separator.id = "research-navigator-tools-separator";
    toolsMenu.appendChild(separator);
    ResearchNavigator.addedElementIds.push(
      "research-navigator-tools-separator",
    );

    const menuitem = doc.createXULElement("menuitem");
    menuitem.id = "research-navigator-tools-menu";
    menuitem.setAttribute("label", "Research Navigator - History Panel");
    menuitem.setAttribute("accesskey", "R");
    menuitem.addEventListener("command", function () {
      toggleHistoryPanel(window);
    });
    toolsMenu.appendChild(menuitem);
    ResearchNavigator.addedElementIds.push("research-navigator-tools-menu");
  }

  // 4. 添加右键菜单到文献
  const itemMenu = doc.getElementById("zotero-itemmenu");
  if (itemMenu && !doc.getElementById("research-navigator-item-menu")) {
    const separator = doc.createXULElement("menuseparator");
    separator.id = "research-navigator-item-separator";
    itemMenu.appendChild(separator);
    ResearchNavigator.addedElementIds.push("research-navigator-item-separator");

    const menuitem = doc.createXULElement("menuitem");
    menuitem.id = "research-navigator-item-menu";
    menuitem.setAttribute("label", "Add to Research History");
    menuitem.addEventListener("command", function () {
      const items = window.ZoteroPane.getSelectedItems();
      for (let item of items) {
        ResearchNavigator.addToHistory(item);
      }
      showNotification(window, `Added ${items.length} item(s) to history`);
    });
    itemMenu.appendChild(menuitem);
    ResearchNavigator.addedElementIds.push("research-navigator-item-menu");
  }

  // 5. 创建历史面板（初始隐藏）
  createHistoryPanel(window);
}

// 添加工具栏按钮
function addToolbarButton(window) {
  const doc = window.document;

  // 尝试多个工具栏位置
  const toolbarIds = [
    "zotero-items-toolbar",
    "zotero-tb-advanced-search",
    "zotero-tb-search-menu-button",
    "zotero-tb-search",
  ];

  let toolbar = null;
  let referenceNode = null;

  // 找到合适的工具栏和参考节点
  for (let id of toolbarIds) {
    const element = doc.getElementById(id);
    if (element) {
      if (element.tagName === "toolbar") {
        toolbar = element;
        break;
      } else if (
        element.parentNode &&
        element.parentNode.tagName === "toolbar"
      ) {
        toolbar = element.parentNode;
        referenceNode = element.nextSibling;
        break;
      }
    }
  }

  if (toolbar && !doc.getElementById("research-navigator-toolbar-button")) {
    const button = doc.createXULElement("toolbarbutton");
    button.id = "research-navigator-toolbar-button";
    button.className = "zotero-tb-button";
    button.setAttribute(
      "tooltiptext",
      "Research Navigator - Toggle History Panel",
    );
    button.setAttribute("label", "📚");
    button.style.listStyleImage =
      'url("chrome://zotero/skin/16/universal/folder.png")';

    button.addEventListener("command", () => {
      toggleHistoryPanel(window);
    });

    if (referenceNode) {
      toolbar.insertBefore(button, referenceNode);
    } else {
      toolbar.appendChild(button);
    }

    ResearchNavigator.addedElementIds.push("research-navigator-toolbar-button");
  }
}

// 创建历史面板
function createHistoryPanel(window) {
  const doc = window.document;

  if (doc.getElementById("research-navigator-panel")) {
    return;
  }

  const panel = doc.createXULElement("vbox");
  panel.id = "research-navigator-panel";
  panel.style.cssText = `
    position: fixed;
    right: 10px;
    top: 100px;
    width: 300px;
    max-height: 500px;
    background: white;
    border: 1px solid #ccc;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    z-index: 1000;
    display: none;
  `;

  // 标题栏
  const header = doc.createXULElement("hbox");
  header.style.cssText = `
    background: #2196F3;
    color: white;
    padding: 8px;
    align-items: center;
  `;

  const title = doc.createXULElement("label");
  title.setAttribute("value", "Research History");
  title.setAttribute("flex", "1");
  title.style.fontWeight = "bold";

  const closeBtn = doc.createXULElement("toolbarbutton");
  closeBtn.setAttribute("label", "✕");
  closeBtn.style.cssText = `
    color: white;
    min-width: 20px;
    margin: 0;
    padding: 0 4px;
  `;
  closeBtn.addEventListener("command", () => {
    panel.style.display = "none";
  });

  header.appendChild(title);
  header.appendChild(closeBtn);

  // 列表容器
  const listbox = doc.createXULElement("richlistbox");
  listbox.id = "research-navigator-history-list";
  listbox.setAttribute("flex", "1");
  listbox.style.cssText = `
    overflow-y: auto;
    max-height: 400px;
  `;

  panel.appendChild(header);
  panel.appendChild(listbox);

  // 添加到文档
  const mainWindow = doc.getElementById("main-window") || doc.documentElement;
  mainWindow.appendChild(panel);

  ResearchNavigator.addedElementIds.push("research-navigator-panel");
  ResearchNavigator.historyPanels.set(window, panel);

  // 初始更新
  ResearchNavigator.updateHistoryPanel(window, panel);
}

// 切换历史面板
function toggleHistoryPanel(window) {
  const doc = window.document;
  const panel = doc.getElementById("research-navigator-panel");

  if (!panel) {
    createHistoryPanel(window);
    return;
  }

  if (panel.style.display === "none") {
    panel.style.display = "block";
    ResearchNavigator.updateHistoryPanel(window, panel);
  } else {
    panel.style.display = "none";
  }
}

// 显示通知
function showNotification(window, message) {
  const doc = window.document;

  // 创建通知元素
  const notification = doc.createElement("div");
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    bottom: 80px;
    right: 20px;
    background: #4CAF50;
    color: white;
    padding: 12px 20px;
    border-radius: 4px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    z-index: 99999;
    animation: slideIn 0.3s ease;
  `;

  // 添加动画
  const style = doc.createElement("style");
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `;
  doc.head.appendChild(style);

  // 添加到文档
  doc.body.appendChild(notification);

  // 3秒后移除
  window.setTimeout(() => {
    notification.style.opacity = "0";
    notification.style.transition = "opacity 0.3s ease";
    window.setTimeout(() => {
      notification.remove();
      style.remove();
    }, 300);
  }, 3000);
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

  // 从映射中移除
  ResearchNavigator.historyPanels.delete(window);
}
