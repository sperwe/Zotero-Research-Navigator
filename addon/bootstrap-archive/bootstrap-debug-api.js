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

var ResearchNavigatorDebug = {
  id: null,
  version: null,
  rootURI: null,

  // 调试：探索 Zotero API
  exploreAPI() {
    Zotero.debug("[RN Debug] === Exploring Zotero API ===");

    // 1. 检查 Tabs API
    Zotero.debug("[RN Debug] Checking Tabs API:");
    if (typeof Zotero.Tabs !== "undefined") {
      Zotero.debug("[RN Debug] - Zotero.Tabs exists");
      for (let prop in Zotero.Tabs) {
        if (typeof Zotero.Tabs[prop] === "function") {
          Zotero.debug(`[RN Debug] - Zotero.Tabs.${prop}()`);
        }
      }
    } else {
      Zotero.debug("[RN Debug] - Zotero.Tabs NOT found");
    }

    // 2. 检查 Reader API
    Zotero.debug("[RN Debug] Checking Reader API:");
    if (typeof Zotero.Reader !== "undefined") {
      Zotero.debug("[RN Debug] - Zotero.Reader exists");
      for (let prop in Zotero.Reader) {
        if (typeof Zotero.Reader[prop] === "function") {
          Zotero.debug(`[RN Debug] - Zotero.Reader.${prop}()`);
        }
      }
    }

    // 3. 检查 Notifier 支持的类型
    Zotero.debug("[RN Debug] Checking Notifier types:");
    const types = [
      "tab",
      "item",
      "collection",
      "search",
      "share",
      "group",
      "trash",
      "tags",
      "sync",
      "api-key",
      "setting",
      "feedItem",
      "feed",
    ];
    types.forEach((type) => {
      try {
        const id = Zotero.Notifier.registerObserver(
          {
            notify: () => {},
          },
          [type],
          "test",
        );
        Zotero.Notifier.unregisterObserver(id);
        Zotero.debug(`[RN Debug] - '${type}' is supported`);
      } catch (e) {
        Zotero.debug(`[RN Debug] - '${type}' is NOT supported`);
      }
    });

    // 4. 检查窗口中的标签页
    var windows = Services.wm.getEnumerator("navigator:browser");
    while (windows.hasMoreElements()) {
      let win = windows.getNext();
      if (win.Zotero) {
        Zotero.debug("[RN Debug] Checking window tabs:");

        // 检查各种可能的标签页容器
        const tabContainers = [
          "zotero-tabs-container",
          "zotero-tabs",
          "zotero-view-tabbox",
          "tabs-container",
          "tab-bar-container",
        ];

        tabContainers.forEach((id) => {
          const elem = win.document.getElementById(id);
          if (elem) {
            Zotero.debug(`[RN Debug] - Found element: ${id}`);
          }
        });

        // 检查 ZoteroPane
        if (win.ZoteroPane) {
          Zotero.debug("[RN Debug] - ZoteroPane exists");
          for (let prop in win.ZoteroPane) {
            if (prop.includes("tab") || prop.includes("Tab")) {
              Zotero.debug(
                `[RN Debug] - ZoteroPane.${prop}: ${typeof win.ZoteroPane[prop]}`,
              );
            }
          }
        }
      }
    }
  },

  // 监听所有事件
  setupUniversalListener() {
    const allTypes = [
      "item",
      "collection",
      "search",
      "share",
      "group",
      "trash",
      "tags",
      "sync",
      "api-key",
      "setting",
      "feedItem",
      "feed",
      "tab",
    ];

    this.universalObserverID = Zotero.Notifier.registerObserver(
      {
        notify: (event, type, ids, extraData) => {
          Zotero.debug(
            `[RN Debug] Event detected - Type: ${type}, Event: ${event}, IDs: ${JSON.stringify(ids)}`,
          );

          if (extraData) {
            Zotero.debug(`[RN Debug] Extra data: ${JSON.stringify(extraData)}`);
          }

          // 特别关注 item 事件
          if (type === "item" && event === "select") {
            Zotero.debug("[RN Debug] === Item Selected ===");
            ids.forEach(async (id) => {
              const item = await Zotero.Items.getAsync(id);
              if (item) {
                Zotero.debug(`[RN Debug] Selected: ${item.getField("title")}`);
              }
            });
          }
        },
      },
      allTypes,
      "ResearchNavigatorDebug",
    );

    Zotero.debug("[RN Debug] Universal listener registered");
  },

  // 手动追踪打开的项目
  hookIntoItemOpening() {
    // Hook 到 ZoteroPane 的方法
    var windows = Services.wm.getEnumerator("navigator:browser");
    while (windows.hasMoreElements()) {
      let win = windows.getNext();
      if (win.ZoteroPane) {
        // 保存原始方法
        const originalViewItems = win.ZoteroPane.viewItems;
        const originalSelectItem = win.ZoteroPane.selectItem;

        // 重写 viewItems
        win.ZoteroPane.viewItems = function (items, event) {
          Zotero.debug(
            `[RN Debug] viewItems called with ${items.length} items`,
          );
          items.forEach((item) => {
            Zotero.debug(`[RN Debug] - Opening: ${item.getField("title")}`);
          });

          // 调用原始方法
          return originalViewItems.apply(this, arguments);
        };

        // 重写 selectItem
        win.ZoteroPane.selectItem = function (itemID, inLibraryRoot) {
          Zotero.debug(`[RN Debug] selectItem called with ID: ${itemID}`);

          // 调用原始方法
          return originalSelectItem.apply(this, arguments);
        };

        Zotero.debug("[RN Debug] Hooked into ZoteroPane methods");
      }
    }
  },
};

function install(data, reason) {}

async function startup({ id, version, resourceURI, rootURI }, reason) {
  await waitForZotero();

  if (!rootURI) {
    rootURI = resourceURI.spec;
  }

  ResearchNavigatorDebug.id = id;
  ResearchNavigatorDebug.version = version;
  ResearchNavigatorDebug.rootURI = rootURI;

  // 注册到 Zotero
  Zotero.ResearchNavigatorDebug = ResearchNavigatorDebug;

  // 执行调试
  Zotero.debug("[RN Debug] === Starting Debug Session ===");

  // 1. 探索 API
  ResearchNavigatorDebug.exploreAPI();

  // 2. 设置监听器
  ResearchNavigatorDebug.setupUniversalListener();

  // 3. Hook 到打开方法
  ResearchNavigatorDebug.hookIntoItemOpening();

  // 添加调试按钮
  var windows = Services.wm.getEnumerator("navigator:browser");
  while (windows.hasMoreElements()) {
    let win = windows.getNext();
    if (win.Zotero && win.document.readyState === "complete") {
      addDebugUI(win);
    }
  }

  // 监听新窗口
  Services.wm.addListener(windowListener);
}

function shutdown({ id, version, resourceURI, rootURI }, reason) {
  if (reason === APP_SHUTDOWN) {
    return;
  }

  // 清理
  if (ResearchNavigatorDebug.universalObserverID) {
    Zotero.Notifier.unregisterObserver(
      ResearchNavigatorDebug.universalObserverID,
    );
  }

  Services.wm.removeListener(windowListener);

  if (Zotero.ResearchNavigatorDebug) {
    delete Zotero.ResearchNavigatorDebug;
  }
}

function uninstall(data, reason) {}

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
          addDebugUI(domWindow);
        }
      },
      false,
    );
  },
  onCloseWindow: function (aWindow) {},
  onWindowTitleChange: function (aWindow, aTitle) {},
};

function addDebugUI(window) {
  const doc = window.document;

  // 添加调试按钮
  if (!doc.getElementById("research-navigator-debug-button")) {
    const debugBtn = doc.createElement("button");
    debugBtn.id = "research-navigator-debug-button";
    debugBtn.textContent = "🐛 Debug";
    debugBtn.style.cssText = `
      position: fixed !important;
      bottom: 80px !important;
      right: 20px !important;
      z-index: 99999 !important;
      background: #ff5722 !important;
      color: white !important;
      border: none !important;
      padding: 10px !important;
      border-radius: 4px !important;
      cursor: pointer !important;
    `;

    debugBtn.onclick = function () {
      // 重新运行 API 探索
      ResearchNavigatorDebug.exploreAPI();

      // 显示当前打开的标签页
      if (window.Zotero_Tabs) {
        const tabs = window.Zotero_Tabs.getState();
        window.alert(`Current tabs: ${JSON.stringify(tabs, null, 2)}`);
      } else {
        window.alert("Zotero_Tabs not found in window");
      }
    };

    const parents = [doc.body, doc.documentElement];
    for (let parent of parents) {
      if (parent) {
        try {
          parent.appendChild(debugBtn);
          break;
        } catch (e) {}
      }
    }
  }
}
