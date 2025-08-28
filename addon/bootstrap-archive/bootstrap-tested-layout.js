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

// 关系类型枚举
const RelationType = {
  MANUAL: "manual",
  CITATION: "citation",
  AUTHOR: "author",
  TAG: "tag",
  COLLECTION: "collection",
  RELATED: "related",
  TEMPORAL: "temporal",
  TAB: "tab",
};

// 树状历史节点类
class TreeNode {
  constructor(itemId, parentId = null, relationType = RelationType.MANUAL) {
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
    this.relationType = relationType;
    this.tabId = null;

    // 文献信息缓存
    this.title = "";
    this.creators = "";
    this.itemType = "";
    this.year = "";
    this.key = "";
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
      .map((c) => (c.firstName || "") + " " + (c.lastName || ""))
      .join(", ");
    this.itemType = item.itemType;
    this.year = item.getField("year") || "";
    this.key = item.key;
  }
}

var ResearchNavigator = {
  id: null,
  version: null,
  rootURI: null,
  addedElementIds: [],
  historyPanels: new Map(),

  // 树状历史数据
  treeRoots: [],
  nodeMap: new Map(),
  itemNodeMap: new Map(),
  tabNodeMap: new Map(),
  currentNode: null,
  currentSessionId: null,
  lastActivityTime: null,
  sessionTimeout: 30 * 60 * 1000,
  navigationTimeout: 5000,

  // 导航历史
  navigationHistory: [],
  navigationIndex: -1,

  // 监听器ID
  notifierID: null,

  // 面板设置
  panelWidth: 400,
  panelTop: 100,
  panelRight: 10,

  // 调试日志
  debug(msg) {
    Zotero.debug(`[Research Navigator] ${msg}`);
  },

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
      this.currentNode = null;
    }
    this.lastActivityTime = now;
  },

  // 从标签页数据获取 itemID
  getItemIDFromTab(tabData) {
    if (!tabData) return null;
    if (tabData.itemID) return tabData.itemID;
    if (tabData.data && tabData.data.itemID) return tabData.data.itemID;
    return null;
  },

  // 分析文献之间的关系
  analyzeRelation(fromItem, toItem) {
    if (!fromItem || !toItem) return RelationType.MANUAL;

    try {
      // 检查作者关系
      const fromCreators = fromItem.getCreators();
      const toCreators = toItem.getCreators();

      for (let fc of fromCreators) {
        for (let tc of toCreators) {
          if (fc.lastName === tc.lastName && fc.firstName === tc.firstName) {
            return RelationType.AUTHOR;
          }
        }
      }

      // 检查标签关系
      const fromTags = fromItem.getTags().map((t) => t.tag);
      const toTags = toItem.getTags().map((t) => t.tag);

      const commonTags = fromTags.filter((t) => toTags.includes(t));
      if (commonTags.length > 0) {
        return RelationType.TAG;
      }

      // 检查是否在同一文件夹
      const fromCollections = fromItem.getCollections();
      const toCollections = toItem.getCollections();

      const commonCollections = fromCollections.filter((c) =>
        toCollections.includes(c),
      );
      if (commonCollections.length > 0) {
        return RelationType.COLLECTION;
      }

      // 检查Zotero相关项目
      const relatedItems = fromItem.relatedItems;
      if (relatedItems && relatedItems.includes(toItem.key)) {
        return RelationType.RELATED;
      }

      // 时间关系（默认）
      return RelationType.TEMPORAL;
    } catch (e) {
      this.debug(`Error analyzing relation: ${e}`);
      return RelationType.MANUAL;
    }
  },

  // 添加到树状历史
  addToTreeHistory(item, relationType = null, fromNode = null) {
    if (!item || !item.id) return;

    this.checkSession();

    if (!fromNode) {
      fromNode = this.currentNode;
    }

    if (!relationType && fromNode) {
      const fromItem = Zotero.Items.get(fromNode.itemId);
      relationType = this.analyzeRelation(fromItem, item);
    }

    // 检查是否刚刚访问过这个文献
    if (this.currentNode && this.currentNode.itemId === item.id) {
      this.currentNode.visitCount++;
      this.currentNode.lastVisit = new Date();
      this.updateTreeDisplay();
      return this.currentNode;
    }

    // 创建新节点
    let newNode;

    const shouldBeChild =
      fromNode &&
      fromNode.sessionId === this.currentSessionId &&
      Date.now() - fromNode.lastVisit.getTime() < this.navigationTimeout;

    if (shouldBeChild) {
      newNode = new TreeNode(item.id, fromNode.id, relationType);
      fromNode.addChild(newNode);
    } else {
      newNode = new TreeNode(item.id, null, relationType);
      this.treeRoots.push(newNode);
    }

    newNode.updateItemInfo(item);

    this.nodeMap.set(newNode.id, newNode);

    if (!this.itemNodeMap.has(item.id)) {
      this.itemNodeMap.set(item.id, []);
    }
    this.itemNodeMap.get(item.id).push(newNode);

    this.currentNode = newNode;
    this.addToNavigationHistory(newNode);
    this.updateTreeDisplay();

    return newNode;
  },

  // 添加到导航历史
  addToNavigationHistory(node) {
    if (this.navigationIndex < this.navigationHistory.length - 1) {
      this.navigationHistory = this.navigationHistory.slice(
        0,
        this.navigationIndex + 1,
      );
    }

    this.navigationHistory.push(node);
    this.navigationIndex = this.navigationHistory.length - 1;

    this.updateNavigationButtons();
  },

  // 导航：后退
  navigateBack() {
    if (this.navigationIndex > 0) {
      this.navigationIndex--;
      const node = this.navigationHistory[this.navigationIndex];
      this.currentNode = node;
      this.openItemFromNode(node);
      this.updateTreeDisplay();
      this.updateNavigationButtons();
    }
  },

  // 导航：前进
  navigateForward() {
    if (this.navigationIndex < this.navigationHistory.length - 1) {
      this.navigationIndex++;
      const node = this.navigationHistory[this.navigationIndex];
      this.currentNode = node;
      this.openItemFromNode(node);
      this.updateTreeDisplay();
      this.updateNavigationButtons();
    }
  },

  // 导航：到父节点
  navigateToParent() {
    if (this.currentNode && this.currentNode.parentId) {
      const parentNode = this.nodeMap.get(this.currentNode.parentId);
      if (parentNode) {
        this.currentNode = parentNode;
        this.openItemFromNode(parentNode);
        this.addToNavigationHistory(parentNode);
        this.updateTreeDisplay();
      }
    }
  },

  // 更新导航按钮状态
  updateNavigationButtons() {
    var windows = Services.wm.getEnumerator("navigator:browser");
    while (windows.hasMoreElements()) {
      let win = windows.getNext();
      if (win.document) {
        const doc = win.document;

        const backBtn = doc.getElementById("research-navigator-back");
        const forwardBtn = doc.getElementById("research-navigator-forward");
        const parentBtn = doc.getElementById("research-navigator-parent");

        if (backBtn) {
          backBtn.disabled = this.navigationIndex <= 0;
        }
        if (forwardBtn) {
          forwardBtn.disabled =
            this.navigationIndex >= this.navigationHistory.length - 1;
        }
        if (parentBtn) {
          parentBtn.disabled = !this.currentNode || !this.currentNode.parentId;
        }
      }
    }
  },

  // 从节点打开文献
  openItemFromNode(node) {
    if (!node) return;

    const item = Zotero.Items.get(node.itemId);
    if (!item) return;

    var win = Services.wm.getMostRecentWindow("navigator:browser");
    if (!win || !win.ZoteroPane) return;

    try {
      win.ZoteroPane.selectItem(item.id);

      if (item.isPDFAttachment()) {
        Zotero.OpenPDF.openToPage(item, null, null);
      } else if (item.isRegularItem()) {
        const attachments = item.getAttachments();
        for (let id of attachments) {
          const attachment = Zotero.Items.get(id);
          if (attachment && attachment.isPDFAttachment()) {
            Zotero.OpenPDF.openToPage(attachment, null, null);
            break;
          }
        }
      }
    } catch (e) {
      this.debug(`Error opening item: ${e}`);
    }
  },

  // 监听标签页事件
  setupTabListener() {
    this.notifierID = Zotero.Notifier.registerObserver(
      {
        notify: async (event, type, ids, extraData) => {
          this.debug(
            `Event: ${event}, Type: ${type}, IDs: ${JSON.stringify(ids)}`,
          );

          if (type === "tab") {
            if (event === "add" && ids.length > 0) {
              const tabID = ids[0];
              this.debug(`New tab opened: ${tabID}`);

              if (extraData && extraData[tabID]) {
                const tabData = extraData[tabID];
                const itemID = this.getItemIDFromTab(tabData);

                if (itemID && Zotero.Items.exists(itemID)) {
                  const item = await Zotero.Items.getAsync(itemID);
                  if (item) {
                    const node = this.addToTreeHistory(item, RelationType.TAB);
                    if (node) {
                      node.tabId = tabID;
                      this.tabNodeMap.set(tabID, node);
                    }
                  }
                }
              }
            } else if (event === "close" && ids.length > 0) {
              const tabID = ids[0];
              this.debug(`Tab closed: ${tabID}`);
              this.tabNodeMap.delete(tabID);
            } else if (event === "select" && ids.length > 0) {
              const tabID = ids[0];
              this.debug(`Tab selected: ${tabID}`);

              const node = this.tabNodeMap.get(tabID);
              if (node) {
                this.currentNode = node;
                this.addToNavigationHistory(node);
                this.updateTreeDisplay();
              } else if (extraData && extraData[tabID]) {
                const tabData = extraData[tabID];
                const itemID = this.getItemIDFromTab(tabData);

                if (itemID && Zotero.Items.exists(itemID)) {
                  const item = await Zotero.Items.getAsync(itemID);
                  if (item) {
                    const node = this.addToTreeHistory(item, RelationType.TAB);
                    if (node) {
                      node.tabId = tabID;
                      this.tabNodeMap.set(tabID, node);
                    }
                  }
                }
              }
            }
          } else if (type === "item" && event === "select") {
            if (ids.length > 0) {
              const item = await Zotero.Items.getAsync(ids[0]);
              if (item && !item.isNote() && !item.isAttachment()) {
                this.addToTreeHistory(item);
              }
            }
          }
        },
      },
      ["tab", "item"],
      "ResearchNavigator",
    );

    this.debug("Tab listener registered");
  },

  // 初始化：获取当前打开的标签页
  async initializeTabs() {
    try {
      var win = Services.wm.getMostRecentWindow("navigator:browser");
      if (win && win.Zotero_Tabs) {
        const tabs = win.Zotero_Tabs.getState();
        this.debug(`Found ${tabs.length} existing tabs`);

        for (let tab of tabs) {
          if (tab.type === "reader" && tab.data && tab.data.itemID) {
            const item = await Zotero.Items.getAsync(tab.data.itemID);
            if (item) {
              this.debug(`Loading existing tab: ${item.getField("title")}`);
              const node = this.addToTreeHistory(item, RelationType.TAB);
              if (node && tab.id) {
                node.tabId = tab.id;
                this.tabNodeMap.set(tab.id, node);
              }
            }
          }
        }
      }
    } catch (e) {
      this.debug(`Error initializing tabs: ${e}`);
    }
  },

  // 清理监听器
  cleanupListeners() {
    if (this.notifierID) {
      Zotero.Notifier.unregisterObserver(this.notifierID);
      this.notifierID = null;
    }
  },

  // 获取关系类型说明
  getRelationLabel(relationType) {
    const labels = {
      [RelationType.MANUAL]: "Manual",
      [RelationType.CITATION]: "Citation",
      [RelationType.AUTHOR]: "Author",
      [RelationType.TAG]: "Tag",
      [RelationType.COLLECTION]: "Collection",
      [RelationType.RELATED]: "Related",
      [RelationType.TEMPORAL]: "Time",
      [RelationType.TAB]: "Tab",
    };
    return labels[relationType] || "Unknown";
  },

  // 获取关系类型颜色
  getRelationColor(relationType) {
    const colors = {
      [RelationType.MANUAL]: "#666",
      [RelationType.CITATION]: "#e91e63",
      [RelationType.AUTHOR]: "#2196f3",
      [RelationType.TAG]: "#4caf50",
      [RelationType.COLLECTION]: "#ff9800",
      [RelationType.RELATED]: "#9c27b0",
      [RelationType.TEMPORAL]: "#607d8b",
      [RelationType.TAB]: "#00bcd4",
    };
    return colors[relationType] || "#666";
  },

  // 获取树形数据（用于显示）
  getTreeData() {
    const sessions = new Map();

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

    if (sessions.length === 0) {
      const emptyMsg = doc.createXULElement("label");
      emptyMsg.setAttribute("value", "No history yet");
      emptyMsg.style.cssText = "padding: 20px; color: #999;";
      treeContainer.appendChild(emptyMsg);
      return;
    }

    // 渲染每个会话
    sessions.forEach((session, index) => {
      const sessionEl = this.createSessionElement(doc, session, index === 0);
      treeContainer.appendChild(sessionEl);
    });

    // 更新统计信息
    const statsLabel = doc.getElementById("research-navigator-stats");
    if (statsLabel) {
      const totalNodes = this.nodeMap.size;
      const sessions = this.getTreeData().length;
      statsLabel.setAttribute(
        "value",
        `${totalNodes} items • ${sessions} sessions`,
      );
    }
  },

  // 创建会话元素
  createSessionElement(doc, session, isExpanded) {
    const sessionEl = doc.createXULElement("vbox");
    sessionEl.style.cssText = "margin-bottom: 10px;";

    // 会话标题
    const headerEl = doc.createXULElement("hbox");
    headerEl.style.cssText =
      "cursor: pointer; padding: 5px; background: #f5f5f5; border-radius: 3px;";

    const toggleEl = doc.createXULElement("label");
    toggleEl.setAttribute("value", isExpanded ? "▼" : "▶");
    toggleEl.style.cssText = "width: 16px;";

    const titleEl = doc.createXULElement("label");
    const sessionDate = new Date(session.timestamp);
    titleEl.setAttribute("value", sessionDate.toLocaleString());
    titleEl.setAttribute("flex", "1");

    headerEl.appendChild(toggleEl);
    headerEl.appendChild(titleEl);

    // 树容器
    const treeEl = doc.createXULElement("vbox");
    treeEl.style.cssText = isExpanded ? "margin-left: 20px;" : "display: none;";

    // 点击展开/折叠
    headerEl.addEventListener("click", () => {
      const expanded = treeEl.style.display === "none";
      treeEl.style.display = expanded ? "" : "none";
      toggleEl.setAttribute("value", expanded ? "▼" : "▶");
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

    // 节点内容
    const contentEl = doc.createXULElement("hbox");
    contentEl.style.cssText = `cursor: pointer; padding: 3px; margin-left: ${level * 20}px;`;

    // 鼠标悬停效果
    contentEl.addEventListener("mouseenter", () => {
      contentEl.style.background = "#e8f4fd";
    });
    contentEl.addEventListener("mouseleave", () => {
      contentEl.style.background = node === this.currentNode ? "#d1e7fd" : "";
    });

    // 当前节点高亮
    if (node === this.currentNode) {
      contentEl.style.background = "#d1e7fd";
    }

    // 展开/折叠
    if (node.children.length > 0) {
      const toggleEl = doc.createXULElement("label");
      toggleEl.setAttribute("value", node.expanded ? "−" : "+");
      toggleEl.style.cssText =
        "width: 16px; text-align: center; border: 1px solid #ccc; margin-right: 5px;";
      toggleEl.addEventListener("click", (e) => {
        e.stopPropagation();
        node.expanded = !node.expanded;
        this.updateTreeDisplay();
      });
      contentEl.appendChild(toggleEl);
    } else {
      const spacerEl = doc.createXULElement("box");
      spacerEl.style.cssText = "width: 21px;";
      contentEl.appendChild(spacerEl);
    }

    // 关系标记
    if (node.parentId && node.relationType) {
      const relationEl = doc.createXULElement("label");
      relationEl.setAttribute(
        "value",
        `[${this.getRelationLabel(node.relationType)}]`,
      );
      relationEl.style.cssText = `color: ${this.getRelationColor(node.relationType)}; margin-right: 5px; font-size: 0.9em;`;
      contentEl.appendChild(relationEl);
    }

    // 标题
    const titleEl = doc.createXULElement("label");
    const displayTitle = node.title || "Loading...";
    const maxLength = 60 - level * 4;
    const truncatedTitle =
      displayTitle.length > maxLength
        ? displayTitle.substr(0, maxLength) + "…"
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
      countEl.setAttribute("value", `(${node.visitCount}x)`);
      countEl.style.cssText = "color: #666; margin-left: 5px;";
      contentEl.appendChild(countEl);
    }

    // 点击打开文献
    contentEl.addEventListener("click", () => {
      this.currentNode = node;
      this.openItemFromNode(node);
      this.addToNavigationHistory(node);
      this.updateTreeDisplay();
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
};

function install(data, reason) {}

async function startup({ id, version, resourceURI, rootURI }, reason) {
  await waitForZotero();

  if (!rootURI) {
    rootURI = resourceURI.spec;
  }

  ResearchNavigator.id = id;
  ResearchNavigator.version = version;
  ResearchNavigator.rootURI = rootURI;

  ResearchNavigator.initSession();
  Zotero.ResearchNavigator = ResearchNavigator;
  ResearchNavigator.setupTabListener();
  await ResearchNavigator.initializeTabs();

  var windows = Services.wm.getEnumerator("navigator:browser");
  while (windows.hasMoreElements()) {
    let win = windows.getNext();
    if (win.Zotero && win.document.readyState === "complete") {
      addUI(win);
    }
  }

  Services.wm.addListener(windowListener);
  ResearchNavigator.debug("Research Navigator started");
}

function shutdown({ id, version, resourceURI, rootURI }, reason) {
  if (reason === APP_SHUTDOWN) {
    return;
  }

  ResearchNavigator.cleanupListeners();
  Services.wm.removeListener(windowListener);

  var windows = Services.wm.getEnumerator("navigator:browser");
  while (windows.hasMoreElements()) {
    let win = windows.getNext();
    if (win.document) {
      removeUI(win);
    }
  }

  ResearchNavigator.historyPanels.clear();

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

  // 1. 添加导航工具栏
  addNavigationToolbar(window);

  // 2. 添加浮动按钮
  if (!doc.getElementById("research-navigator-float-button")) {
    const floatBtn = doc.createElement("button");
    floatBtn.id = "research-navigator-float-button";
    floatBtn.textContent = "🌳";
    floatBtn.title = "Research Navigator";
    floatBtn.style.cssText = `
      position: fixed !important;
      bottom: 20px !important;
      right: 20px !important;
      z-index: 99999 !important;
      background: #4CAF50 !important;
      color: white !important;
      border: none !important;
      width: 48px !important;
      height: 48px !important;
      border-radius: 50% !important;
      cursor: pointer !important;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3) !important;
      font-size: 20px !important;
    `;

    floatBtn.onclick = function (e) {
      e.preventDefault();
      e.stopPropagation();
      toggleTreePanel(window);
    };

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
    menuitem.setAttribute("label", "Research Navigator");
    menuitem.addEventListener("command", function () {
      toggleTreePanel(window);
    });
    toolsMenu.appendChild(menuitem);
    ResearchNavigator.addedElementIds.push("research-navigator-tools-menu");
  }

  // 4. 添加右键菜单
  const itemMenu = doc.getElementById("zotero-itemmenu");
  if (itemMenu && !doc.getElementById("research-navigator-item-menu")) {
    const separator = doc.createXULElement("menuseparator");
    separator.id = "research-navigator-item-separator";
    itemMenu.appendChild(separator);
    ResearchNavigator.addedElementIds.push("research-navigator-item-separator");

    const addMenuItem = doc.createXULElement("menuitem");
    addMenuItem.id = "research-navigator-item-menu";
    addMenuItem.setAttribute("label", "Add to Research Path");
    addMenuItem.addEventListener("command", function () {
      const items = window.ZoteroPane.getSelectedItems();
      if (items.length > 0) {
        ResearchNavigator.addToTreeHistory(items[0], RelationType.MANUAL);
        showNotification(window, `Added: ${items[0].getField("title")}`);
      }
    });
    itemMenu.appendChild(addMenuItem);
    ResearchNavigator.addedElementIds.push("research-navigator-item-menu");
  }

  // 5. 创建树形历史面板
  createTreePanel(window);
}

// 添加导航工具栏
function addNavigationToolbar(window) {
  const doc = window.document;
  const toolbarIds = [
    "zotero-items-toolbar",
    "zotero-tb-advanced-search",
    "zotero-collections-toolbar",
  ];

  let toolbar = null;

  for (let id of toolbarIds) {
    const element = doc.getElementById(id);
    if (element && element.tagName === "toolbar") {
      toolbar = element;
      break;
    }
  }

  if (!toolbar) return;

  if (!doc.getElementById("research-navigator-toolbar-container")) {
    const container = doc.createXULElement("hbox");
    container.id = "research-navigator-toolbar-container";
    container.style.cssText = "margin: 0 5px;";

    const backBtn = doc.createXULElement("toolbarbutton");
    backBtn.id = "research-navigator-back";
    backBtn.className = "zotero-tb-button";
    backBtn.setAttribute("tooltiptext", "Back");
    backBtn.setAttribute("label", "←");
    backBtn.addEventListener("command", () => {
      ResearchNavigator.navigateBack();
    });

    const forwardBtn = doc.createXULElement("toolbarbutton");
    forwardBtn.id = "research-navigator-forward";
    forwardBtn.className = "zotero-tb-button";
    forwardBtn.setAttribute("tooltiptext", "Forward");
    forwardBtn.setAttribute("label", "→");
    forwardBtn.addEventListener("command", () => {
      ResearchNavigator.navigateForward();
    });

    const parentBtn = doc.createXULElement("toolbarbutton");
    parentBtn.id = "research-navigator-parent";
    parentBtn.className = "zotero-tb-button";
    parentBtn.setAttribute("tooltiptext", "Parent");
    parentBtn.setAttribute("label", "↑");
    parentBtn.addEventListener("command", () => {
      ResearchNavigator.navigateToParent();
    });

    const treeBtn = doc.createXULElement("toolbarbutton");
    treeBtn.id = "research-navigator-tree-button";
    treeBtn.className = "zotero-tb-button";
    treeBtn.setAttribute("tooltiptext", "History");
    treeBtn.setAttribute("label", "🌳");
    treeBtn.addEventListener("command", () => {
      toggleTreePanel(window);
    });

    const separator = doc.createXULElement("toolbarseparator");

    container.appendChild(backBtn);
    container.appendChild(forwardBtn);
    container.appendChild(parentBtn);
    container.appendChild(separator);
    container.appendChild(treeBtn);

    toolbar.appendChild(container);
    ResearchNavigator.addedElementIds.push(
      "research-navigator-toolbar-container",
    );

    ResearchNavigator.updateNavigationButtons();
  }
}

// 创建树形历史面板（稳定布局版）
function createTreePanel(window) {
  const doc = window.document;

  if (doc.getElementById("research-navigator-panel")) {
    return;
  }

  // 使用 stack 作为根容器，确保 z-index 正确
  const stack = doc.createXULElement("stack");
  stack.id = "research-navigator-panel-stack";
  stack.style.cssText = `
    position: fixed;
    right: ${ResearchNavigator.panelRight}px;
    top: ${ResearchNavigator.panelTop}px;
    width: ${ResearchNavigator.panelWidth}px;
    height: 500px;
    z-index: 1000;
  `;

  // 主面板容器
  const panelWrapper = doc.createXULElement("panel");
  panelWrapper.id = "research-navigator-panel";
  panelWrapper.setAttribute("noautohide", "true");
  panelWrapper.setAttribute("noautofocus", "true");
  panelWrapper.style.cssText = `
    width: 100%;
    height: 100%;
    background: white;
    border: 1px solid #ccc;
    border-radius: 4px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    display: none;
    margin: 0;
    padding: 0;
  `;

  // 使用 vbox 作为内容容器
  const contentBox = doc.createXULElement("vbox");
  contentBox.setAttribute("flex", "1");
  contentBox.style.cssText = "width: 100%; height: 100%;";

  // 标题栏
  const header = doc.createXULElement("hbox");
  header.style.cssText =
    "background: #4CAF50; color: white; padding: 8px; align-items: center;";

  const title = doc.createXULElement("label");
  title.setAttribute("value", "Research History");
  title.setAttribute("flex", "1");
  title.style.cssText = "font-weight: bold;";

  const closeBtn = doc.createXULElement("toolbarbutton");
  closeBtn.setAttribute("label", "×");
  closeBtn.style.cssText = "min-width: 20px; margin: 0; color: white;";
  closeBtn.addEventListener("command", () => {
    panelWrapper.style.display = "none";
  });

  header.appendChild(title);
  header.appendChild(closeBtn);

  // 工具栏
  const toolbar = doc.createXULElement("hbox");
  toolbar.style.cssText = "padding: 5px; border-bottom: 1px solid #eee;";

  const statsLabel = doc.createXULElement("label");
  statsLabel.id = "research-navigator-stats";
  statsLabel.setAttribute("value", "Loading...");
  statsLabel.setAttribute("flex", "1");
  statsLabel.style.cssText = "color: #666;";

  const clearBtn = doc.createXULElement("button");
  clearBtn.setAttribute("label", "Clear");
  clearBtn.addEventListener("command", () => {
    if (window.confirm("Clear all history?")) {
      ResearchNavigator.treeRoots = [];
      ResearchNavigator.nodeMap.clear();
      ResearchNavigator.itemNodeMap.clear();
      ResearchNavigator.tabNodeMap.clear();
      ResearchNavigator.navigationHistory = [];
      ResearchNavigator.navigationIndex = -1;
      ResearchNavigator.currentNode = null;
      ResearchNavigator.updateTreeDisplay();
      ResearchNavigator.updateNavigationButtons();
    }
  });

  toolbar.appendChild(statsLabel);
  toolbar.appendChild(clearBtn);

  // 滚动区域
  const scrollbox = doc.createXULElement("scrollbox");
  scrollbox.setAttribute("flex", "1");
  scrollbox.setAttribute("orient", "vertical");
  scrollbox.style.cssText = "overflow: auto; background: white;";

  // 树容器
  const treeContainer = doc.createXULElement("vbox");
  treeContainer.id = "research-navigator-tree-container";
  treeContainer.style.cssText = "padding: 10px;";

  scrollbox.appendChild(treeContainer);

  // 组装内容
  contentBox.appendChild(header);
  contentBox.appendChild(toolbar);
  contentBox.appendChild(scrollbox);

  panelWrapper.appendChild(contentBox);
  stack.appendChild(panelWrapper);

  // 添加到文档
  const mainWindow = doc.getElementById("main-window") || doc.documentElement;
  mainWindow.appendChild(stack);

  ResearchNavigator.addedElementIds.push("research-navigator-panel-stack");
  ResearchNavigator.historyPanels.set(window, panelWrapper);

  ResearchNavigator.updateTreePanel(window, panelWrapper);
}

// 切换树形历史面板
function toggleTreePanel(window) {
  const doc = window.document;
  const panel = doc.getElementById("research-navigator-panel");

  if (!panel) {
    createTreePanel(window);
    const newPanel = doc.getElementById("research-navigator-panel");
    if (newPanel) {
      newPanel.style.display = "block";
    }
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
  if (!window) return;

  const doc = window.document;

  const notification = doc.createElement("div");
  notification.style.cssText = `
    position: fixed;
    bottom: 80px;
    right: 20px;
    background: #4CAF50;
    color: white;
    padding: 10px 16px;
    border-radius: 4px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    z-index: 99999;
  `;
  notification.textContent = message;

  doc.body.appendChild(notification);

  window.setTimeout(() => {
    notification.remove();
  }, 2000);
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

  ResearchNavigator.historyPanels.delete(window);
}
