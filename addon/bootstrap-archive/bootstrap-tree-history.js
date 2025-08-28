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

// 树状历史节点类
class TreeNode {
  constructor(itemId, parentId = null) {
    this.id = this.generateId();
    this.itemId = itemId;
    this.parentId = parentId;
    this.children = [];
    this.timestamp = new Date();
    this.sessionId = ResearchNavigator.currentSessionId;
    this.depth = 0;
    this.expanded = true;
    this.visitCount = 1;
    this.lastVisit = new Date();

    // 文献信息缓存
    this.title = "";
    this.creators = "";
    this.itemType = "";
    this.year = "";
  }

  generateId() {
    return "node_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
  }

  addChild(node) {
    node.depth = this.depth + 1;
    node.parentId = this.id;
    this.children.push(node);
  }

  updateItemInfo(item) {
    if (!item) return;
    this.title = item.getField("title") || "Untitled";
    this.creators = item
      .getCreators()
      .map((c) => c.firstName + " " + c.lastName)
      .join(", ");
    this.itemType = item.itemType;
    this.year = item.getField("year") || "";
  }
}

var ResearchNavigator = {
  id: null,
  version: null,
  rootURI: null,
  addedElementIds: [],
  historyPanels: new Map(),

  // 树状历史数据
  treeRoots: [], // 所有根节点
  nodeMap: new Map(), // id -> node 的映射
  itemNodeMap: new Map(), // itemId -> nodes 的映射
  currentNode: null, // 当前节点
  currentSessionId: null, // 当前会话ID
  lastActivityTime: null, // 最后活动时间
  sessionTimeout: 30 * 60 * 1000, // 30分钟会话超时
  navigationTimeout: 5000, // 5秒内认为是导航关系

  // 初始化会话
  initSession() {
    this.currentSessionId = "session_" + Date.now();
    this.lastActivityTime = Date.now();
  },

  // 检查是否需要新会话
  checkSession() {
    const now = Date.now();
    if (
      !this.lastActivityTime ||
      now - this.lastActivityTime > this.sessionTimeout
    ) {
      this.initSession();
      this.currentNode = null; // 新会话没有当前节点
    }
    this.lastActivityTime = now;
  },

  // 添加到树状历史
  addToTreeHistory(item) {
    if (!item || !item.id) return;

    this.checkSession();

    // 检查是否已经访问过这个文献
    const existingNodes = this.itemNodeMap.get(item.id) || [];

    // 如果刚刚访问过（5秒内），只更新访问信息
    if (this.currentNode && this.currentNode.itemId === item.id) {
      this.currentNode.visitCount++;
      this.currentNode.lastVisit = new Date();
      this.updateTreeDisplay();
      return;
    }

    // 创建新节点
    let newNode;

    // 判断是否应该作为子节点
    const shouldBeChild =
      this.currentNode &&
      this.currentNode.sessionId === this.currentSessionId &&
      Date.now() - this.currentNode.lastVisit.getTime() <
        this.navigationTimeout;

    if (shouldBeChild) {
      // 作为当前节点的子节点
      newNode = new TreeNode(item.id, this.currentNode.id);
      this.currentNode.addChild(newNode);
    } else {
      // 作为新的根节点
      newNode = new TreeNode(item.id);
      this.treeRoots.push(newNode);
    }

    // 更新节点信息
    newNode.updateItemInfo(item);

    // 添加到映射
    this.nodeMap.set(newNode.id, newNode);

    if (!this.itemNodeMap.has(item.id)) {
      this.itemNodeMap.set(item.id, []);
    }
    this.itemNodeMap.get(item.id).push(newNode);

    // 更新当前节点
    this.currentNode = newNode;

    // 更新显示
    this.updateTreeDisplay();
  },

  // 获取树形数据（用于显示）
  getTreeData() {
    const sessions = new Map();

    // 按会话分组
    this.treeRoots.forEach((root) => {
      if (!sessions.has(root.sessionId)) {
        sessions.set(root.sessionId, {
          id: root.sessionId,
          timestamp: root.timestamp,
          roots: [],
        });
      }
      sessions.get(root.sessionId).roots.push(root);
    });

    // 转换为数组并排序
    return Array.from(sessions.values()).sort(
      (a, b) => b.timestamp - a.timestamp,
    );
  },

  // 更新树形显示
  updateTreeDisplay() {
    for (let [win, panel] of this.historyPanels) {
      this.updateTreePanel(win, panel);
    }
  },

  // 更新单个树形面板
  updateTreePanel(win, panel) {
    const doc = win.document;
    const treeContainer = doc.getElementById(
      "research-navigator-tree-container",
    );
    if (!treeContainer) return;

    // 清空现有内容
    while (treeContainer.firstChild) {
      treeContainer.removeChild(treeContainer.firstChild);
    }

    // 获取树形数据
    const sessions = this.getTreeData();

    // 渲染每个会话
    sessions.forEach((session, index) => {
      const sessionEl = this.createSessionElement(doc, session, index === 0);
      treeContainer.appendChild(sessionEl);
    });
  },

  // 创建会话元素
  createSessionElement(doc, session, isExpanded) {
    const sessionEl = doc.createXULElement("vbox");
    sessionEl.className = "tree-session";
    sessionEl.style.cssText = "margin-bottom: 10px;";

    // 会话标题
    const headerEl = doc.createXULElement("hbox");
    headerEl.style.cssText =
      "cursor: pointer; padding: 5px; background: #f0f0f0;";

    const toggleEl = doc.createXULElement("label");
    toggleEl.setAttribute("value", isExpanded ? "▼" : "▶");
    toggleEl.style.width = "20px";

    const titleEl = doc.createXULElement("label");
    const sessionDate = new Date(session.timestamp);
    const dateStr =
      sessionDate.toLocaleDateString() + " " + sessionDate.toLocaleTimeString();
    titleEl.setAttribute(
      "value",
      `Session - ${dateStr} (${session.roots.length} paths)`,
    );
    titleEl.setAttribute("flex", "1");

    headerEl.appendChild(toggleEl);
    headerEl.appendChild(titleEl);

    // 树容器
    const treeEl = doc.createXULElement("vbox");
    treeEl.style.cssText = isExpanded
      ? "margin-left: 20px;"
      : "display: none; margin-left: 20px;";

    // 点击展开/折叠
    headerEl.addEventListener("click", () => {
      if (treeEl.style.display === "none") {
        treeEl.style.display = "";
        toggleEl.setAttribute("value", "▼");
      } else {
        treeEl.style.display = "none";
        toggleEl.setAttribute("value", "▶");
      }
    });

    // 渲染每个根节点
    session.roots.forEach((root) => {
      const rootEl = this.createNodeElement(doc, root, 0);
      treeEl.appendChild(rootEl);
    });

    sessionEl.appendChild(headerEl);
    sessionEl.appendChild(treeEl);

    return sessionEl;
  },

  // 创建节点元素
  createNodeElement(doc, node, level) {
    const nodeEl = doc.createXULElement("vbox");
    nodeEl.style.cssText = `margin-left: ${level * 20}px;`;

    // 节点内容
    const contentEl = doc.createXULElement("hbox");
    contentEl.style.cssText =
      "cursor: pointer; padding: 3px; align-items: center;";

    // 鼠标悬停效果
    contentEl.addEventListener("mouseenter", () => {
      contentEl.style.background = "#e0e0e0";
    });
    contentEl.addEventListener("mouseleave", () => {
      contentEl.style.background = node === this.currentNode ? "#d0e0f0" : "";
    });

    // 当前节点高亮
    if (node === this.currentNode) {
      contentEl.style.background = "#d0e0f0";
    }

    // 展开/折叠图标
    if (node.children.length > 0) {
      const toggleEl = doc.createXULElement("label");
      toggleEl.setAttribute("value", node.expanded ? "▼" : "▶");
      toggleEl.style.cssText = "width: 20px; cursor: pointer;";
      toggleEl.addEventListener("click", (e) => {
        e.stopPropagation();
        node.expanded = !node.expanded;
        this.updateTreeDisplay();
      });
      contentEl.appendChild(toggleEl);
    } else {
      const spacerEl = doc.createXULElement("label");
      spacerEl.setAttribute("value", "");
      spacerEl.style.width = "20px";
      contentEl.appendChild(spacerEl);
    }

    // 文献类型图标
    const iconEl = doc.createXULElement("label");
    const icon = this.getItemTypeIcon(node.itemType);
    iconEl.setAttribute("value", icon);
    iconEl.style.cssText = "width: 20px; font-size: 16px;";
    contentEl.appendChild(iconEl);

    // 标题
    const titleEl = doc.createXULElement("label");
    const displayTitle = node.title || "Loading...";
    const truncatedTitle =
      displayTitle.length > 50
        ? displayTitle.substr(0, 50) + "..."
        : displayTitle;
    titleEl.setAttribute("value", truncatedTitle);
    titleEl.setAttribute("flex", "1");
    titleEl.setAttribute(
      "tooltiptext",
      `${node.title}\n${node.creators}\n${node.year}`,
    );
    contentEl.appendChild(titleEl);

    // 访问次数
    if (node.visitCount > 1) {
      const countEl = doc.createXULElement("label");
      countEl.setAttribute("value", `(${node.visitCount})`);
      countEl.style.cssText = "color: #666; margin-left: 5px;";
      contentEl.appendChild(countEl);
    }

    // 点击打开文献
    contentEl.addEventListener("click", () => {
      const zoteroItem = Zotero.Items.get(node.itemId);
      if (zoteroItem) {
        doc.defaultView.ZoteroPane.selectItem(node.itemId);
      }
    });

    nodeEl.appendChild(contentEl);

    // 子节点
    if (node.expanded && node.children.length > 0) {
      const childrenEl = doc.createXULElement("vbox");
      node.children.forEach((child) => {
        const childNodeEl = this.createNodeElement(doc, child, level + 1);
        childrenEl.appendChild(childNodeEl);
      });
      nodeEl.appendChild(childrenEl);
    }

    return nodeEl;
  },

  // 获取文献类型图标
  getItemTypeIcon(itemType) {
    const icons = {
      journalArticle: "📰",
      book: "📚",
      bookSection: "📖",
      conferencePaper: "📋",
      thesis: "🎓",
      report: "📊",
      webpage: "🌐",
      default: "📄",
    };
    return icons[itemType] || icons.default;
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

  // 初始化会话
  ResearchNavigator.initSession();

  // 注册到 Zotero
  Zotero.ResearchNavigator = ResearchNavigator;

  // 监听选择事件
  Zotero.Notifier.registerObserver(
    {
      notify: async (event, type, ids, extraData) => {
        if (event === "select" && type === "item") {
          const items = Zotero.Items.get(ids);
          for (let item of items) {
            ResearchNavigator.addToTreeHistory(item);
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
    floatBtn.textContent = "🌳";
    floatBtn.title = "Research Navigator - Tree History";
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
      toggleTreePanel(window);
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
    menuitem.setAttribute("label", "Research Navigator - Tree History");
    menuitem.setAttribute("accesskey", "T");
    menuitem.addEventListener("command", function () {
      toggleTreePanel(window);
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
    menuitem.setAttribute("label", "Start New Research Path Here");
    menuitem.addEventListener("command", function () {
      const items = window.ZoteroPane.getSelectedItems();
      if (items.length > 0) {
        // 开始新的研究路径
        ResearchNavigator.currentNode = null;
        ResearchNavigator.addToTreeHistory(items[0]);
        showNotification(
          window,
          `Started new research path from: ${items[0].getField("title")}`,
        );
      }
    });
    itemMenu.appendChild(menuitem);
    ResearchNavigator.addedElementIds.push("research-navigator-item-menu");
  }

  // 5. 创建树形历史面板（初始隐藏）
  createTreePanel(window);
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
      "Research Navigator - Toggle Tree History",
    );
    button.setAttribute("label", "🌳");
    button.style.listStyleImage =
      'url("chrome://zotero/skin/16/universal/folder.png")';

    button.addEventListener("command", () => {
      toggleTreePanel(window);
    });

    if (referenceNode) {
      toolbar.insertBefore(button, referenceNode);
    } else {
      toolbar.appendChild(button);
    }

    ResearchNavigator.addedElementIds.push("research-navigator-toolbar-button");
  }
}

// 创建树形历史面板
function createTreePanel(window) {
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
    width: 400px;
    max-height: 600px;
    background: white;
    border: 1px solid #ccc;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    z-index: 1000;
    display: none;
  `;

  // 标题栏
  const header = doc.createXULElement("hbox");
  header.style.cssText = `
    background: #4CAF50;
    color: white;
    padding: 8px;
    align-items: center;
  `;

  const title = doc.createXULElement("label");
  title.setAttribute("value", "Research Tree History");
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

  // 工具栏
  const toolbar = doc.createXULElement("hbox");
  toolbar.style.cssText = "padding: 5px; border-bottom: 1px solid #ddd;";

  const newSessionBtn = doc.createXULElement("button");
  newSessionBtn.setAttribute("label", "New Session");
  newSessionBtn.addEventListener("command", () => {
    ResearchNavigator.initSession();
    ResearchNavigator.currentNode = null;
    showNotification(window, "Started new research session");
  });

  const clearBtn = doc.createXULElement("button");
  clearBtn.setAttribute("label", "Clear All");
  clearBtn.addEventListener("command", () => {
    if (window.confirm("Clear all history? This cannot be undone.")) {
      ResearchNavigator.treeRoots = [];
      ResearchNavigator.nodeMap.clear();
      ResearchNavigator.itemNodeMap.clear();
      ResearchNavigator.currentNode = null;
      ResearchNavigator.updateTreeDisplay();
    }
  });

  toolbar.appendChild(newSessionBtn);
  toolbar.appendChild(clearBtn);

  // 树容器
  const scrollbox = doc.createXULElement("scrollbox");
  scrollbox.setAttribute("flex", "1");
  scrollbox.style.cssText = "overflow-y: auto; max-height: 500px;";

  const treeContainer = doc.createXULElement("vbox");
  treeContainer.id = "research-navigator-tree-container";
  treeContainer.style.cssText = "padding: 10px;";

  scrollbox.appendChild(treeContainer);

  panel.appendChild(header);
  panel.appendChild(toolbar);
  panel.appendChild(scrollbox);

  // 添加到文档
  const mainWindow = doc.getElementById("main-window") || doc.documentElement;
  mainWindow.appendChild(panel);

  ResearchNavigator.addedElementIds.push("research-navigator-panel");
  ResearchNavigator.historyPanels.set(window, panel);

  // 初始更新
  ResearchNavigator.updateTreePanel(window, panel);
}

// 切换树形历史面板
function toggleTreePanel(window) {
  const doc = window.document;
  const panel = doc.getElementById("research-navigator-panel");

  if (!panel) {
    createTreePanel(window);
    return;
  }

  if (panel.style.display === "none") {
    panel.style.display = "block";
    ResearchNavigator.updateTreePanel(window, panel);
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
