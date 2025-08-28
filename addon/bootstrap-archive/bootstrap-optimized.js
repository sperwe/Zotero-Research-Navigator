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
  MANUAL: "manual", // 手动导航
  CITATION: "citation", // 引用关系
  AUTHOR: "author", // 作者关系
  TAG: "tag", // 标签关系
  COLLECTION: "collection", // 同一文件夹
  RELATED: "related", // Zotero相关
  TEMPORAL: "temporal", // 时间关系
  TAB: "tab", // 标签页导航
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
  treeRoots: [], // 所有根节点
  nodeMap: new Map(), // id -> node 的映射
  itemNodeMap: new Map(), // itemId -> nodes 的映射
  tabNodeMap: new Map(), // tabId -> node 的映射
  currentNode: null, // 当前节点
  currentSessionId: null, // 当前会话ID
  lastActivityTime: null, // 最后活动时间
  sessionTimeout: 30 * 60 * 1000, // 30分钟会话超时
  navigationTimeout: 5000, // 5秒内认为是导航关系

  // 导航历史
  navigationHistory: [], // 导航历史栈
  navigationIndex: -1, // 当前在历史中的位置

  // 监听器ID
  notifierID: null,

  // 面板设置
  panelWidth: 450,
  panelTop: 100,
  panelRight: 10,
  isResizing: false,
  isDragging: false,
  compactMode: false, // 紧凑模式

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

    // 直接的 itemID
    if (tabData.itemID) return tabData.itemID;

    // 从 data 属性获取
    if (tabData.data && tabData.data.itemID) return tabData.data.itemID;

    return null;
  },

  // 分析文献之间的关系
  analyzeRelation(fromItem, toItem) {
    if (!fromItem || !toItem) return RelationType.MANUAL;

    try {
      // 1. 检查作者关系
      const fromCreators = fromItem.getCreators();
      const toCreators = toItem.getCreators();

      for (let fc of fromCreators) {
        for (let tc of toCreators) {
          if (fc.lastName === tc.lastName && fc.firstName === tc.firstName) {
            return RelationType.AUTHOR;
          }
        }
      }

      // 2. 检查标签关系
      const fromTags = fromItem.getTags().map((t) => t.tag);
      const toTags = toItem.getTags().map((t) => t.tag);

      const commonTags = fromTags.filter((t) => toTags.includes(t));
      if (commonTags.length > 0) {
        return RelationType.TAG;
      }

      // 3. 检查是否在同一文件夹
      const fromCollections = fromItem.getCollections();
      const toCollections = toItem.getCollections();

      const commonCollections = fromCollections.filter((c) =>
        toCollections.includes(c),
      );
      if (commonCollections.length > 0) {
        return RelationType.COLLECTION;
      }

      // 4. 检查Zotero相关项目
      const relatedItems = fromItem.relatedItems;
      if (relatedItems && relatedItems.includes(toItem.key)) {
        return RelationType.RELATED;
      }

      // 5. 时间关系（默认）
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

    // 如果没有指定来源节点，使用当前节点
    if (!fromNode) {
      fromNode = this.currentNode;
    }

    // 如果没有指定关系类型，自动分析
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

    // 判断是否应该作为子节点
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

    // 添加到导航历史
    this.addToNavigationHistory(newNode);

    // 更新显示
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

  // 从节点打开文献（修复版）
  openItemFromNode(node) {
    if (!node) return;

    const item = Zotero.Items.get(node.itemId);
    if (!item) return;

    var win = Services.wm.getMostRecentWindow("navigator:browser");
    if (!win || !win.ZoteroPane) return;

    try {
      // 使用 ZoteroPane 选择项目
      win.ZoteroPane.selectItem(item.id);

      // 如果是 PDF，尝试在阅读器中打开
      if (item.isPDFAttachment()) {
        // 使用 OpenPDF 而不是 Reader.open
        Zotero.OpenPDF.openToPage(item, null, null);
      } else if (item.isRegularItem()) {
        // 获取第一个 PDF 附件
        const attachments = item.getAttachments();
        for (let id of attachments) {
          const attachment = Zotero.Items.get(id);
          if (attachment && attachment.isPDFAttachment()) {
            // 使用 OpenPDF 而不是 Reader.open
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
            // 处理标签页事件
            if (event === "add" && ids.length > 0) {
              // 新标签页打开
              const tabID = ids[0];
              this.debug(`New tab opened: ${tabID}`);

              // 从 extraData 获取标签页信息
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
              // 标签页关闭
              const tabID = ids[0];
              this.debug(`Tab closed: ${tabID}`);
              this.tabNodeMap.delete(tabID);
            } else if (event === "select" && ids.length > 0) {
              // 标签页切换
              const tabID = ids[0];
              this.debug(`Tab selected: ${tabID}`);

              // 检查是否是已追踪的标签页
              const node = this.tabNodeMap.get(tabID);
              if (node) {
                this.currentNode = node;
                this.addToNavigationHistory(node);
                this.updateTreeDisplay();
              } else if (extraData && extraData[tabID]) {
                // 尝试从 extraData 获取信息
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
            // 项目选择事件
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

  // 获取关系类型图标
  getRelationIcon(relationType) {
    const icons = {
      [RelationType.MANUAL]: "👆",
      [RelationType.CITATION]: "📎",
      [RelationType.AUTHOR]: "👤",
      [RelationType.TAG]: "🏷️",
      [RelationType.COLLECTION]: "📁",
      [RelationType.RELATED]: "🔗",
      [RelationType.TEMPORAL]: "⏱️",
      [RelationType.TAB]: "📑",
    };
    return icons[relationType] || "❓";
  },

  // 获取关系类型说明
  getRelationLabel(relationType) {
    const labels = {
      [RelationType.MANUAL]: "Manual navigation",
      [RelationType.CITATION]: "Citation",
      [RelationType.AUTHOR]: "Same author",
      [RelationType.TAG]: "Common tags",
      [RelationType.COLLECTION]: "Same collection",
      [RelationType.RELATED]: "Related item",
      [RelationType.TEMPORAL]: "Time-based",
      [RelationType.TAB]: "Tab navigation",
    };
    return labels[relationType] || "Unknown";
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

    if (sessions.length === 0) {
      const emptyMsg = doc.createXULElement("label");
      emptyMsg.setAttribute(
        "value",
        "No history yet. Start browsing items to build your research tree!",
      );
      emptyMsg.style.cssText =
        "padding: 20px; color: #666; text-align: center; white-space: normal;";
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
      statsLabel.setAttribute(
        "value",
        `Total: ${this.nodeMap.size} items, ${sessions.length} sessions`,
      );
    }
  },

  // 创建会话元素
  createSessionElement(doc, session, isExpanded) {
    const sessionEl = doc.createXULElement("vbox");
    sessionEl.className = "tree-session";
    sessionEl.style.cssText = "margin-bottom: 15px;";

    // 会话标题
    const headerEl = doc.createXULElement("hbox");
    headerEl.style.cssText = `
      cursor: pointer; 
      padding: 8px 12px; 
      background: linear-gradient(to right, #f5f5f5, #f0f0f0);
      border-radius: 4px;
      margin-bottom: 5px;
      align-items: center;
      min-width: 0;
    `;

    const toggleEl = doc.createXULElement("label");
    toggleEl.setAttribute("value", isExpanded ? "▼" : "▶");
    toggleEl.style.cssText = "width: 20px; color: #666; flex-shrink: 0;";

    const titleEl = doc.createXULElement("label");
    const sessionDate = new Date(session.timestamp);
    const dateStr =
      sessionDate.toLocaleDateString() + " " + sessionDate.toLocaleTimeString();
    titleEl.setAttribute("value", `Session - ${dateStr}`);
    titleEl.setAttribute("flex", "1");
    titleEl.style.cssText =
      "font-weight: bold; color: #333; overflow: hidden; text-overflow: ellipsis;";

    const countEl = doc.createXULElement("label");
    countEl.setAttribute("value", `(${session.roots.length} paths)`);
    countEl.style.cssText = "color: #666; font-size: 0.9em; flex-shrink: 0;";

    headerEl.appendChild(toggleEl);
    headerEl.appendChild(titleEl);
    headerEl.appendChild(countEl);

    // 树容器
    const treeEl = doc.createXULElement("vbox");
    treeEl.style.cssText = isExpanded
      ? "margin-left: 10px; padding-left: 10px; border-left: 2px solid #e0e0e0;"
      : "display: none;";

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
    const indentSize = this.compactMode ? 15 : 25;
    nodeEl.style.cssText = `margin-left: ${level * indentSize}px; margin-bottom: 2px;`;

    // 节点内容
    const contentEl = doc.createXULElement("hbox");
    contentEl.style.cssText = `
      cursor: pointer; 
      padding: 4px 8px; 
      align-items: center;
      border-radius: 3px;
      transition: background 0.2s;
      min-width: 0;
    `;

    // 鼠标悬停效果
    contentEl.addEventListener("mouseenter", () => {
      contentEl.style.background = "#e8f0fe";
    });
    contentEl.addEventListener("mouseleave", () => {
      contentEl.style.background = node === this.currentNode ? "#d2e3fc" : "";
    });

    // 当前节点高亮
    if (node === this.currentNode) {
      contentEl.style.background = "#d2e3fc";
      contentEl.style.border = "1px solid #1976d2";
      contentEl.style.padding = "3px 7px";
    }

    // 展开/折叠图标
    if (node.children.length > 0) {
      const toggleEl = doc.createXULElement("label");
      toggleEl.setAttribute("value", node.expanded ? "▼" : "▶");
      toggleEl.style.cssText =
        "width: 20px; cursor: pointer; color: #666; flex-shrink: 0;";
      toggleEl.addEventListener("click", (e) => {
        e.stopPropagation();
        node.expanded = !node.expanded;
        this.updateTreeDisplay();
      });
      contentEl.appendChild(toggleEl);
    } else {
      const spacerEl = doc.createXULElement("label");
      spacerEl.setAttribute("value", "");
      spacerEl.style.cssText = "width: 20px; flex-shrink: 0;";
      contentEl.appendChild(spacerEl);
    }

    // 关系类型图标（紧凑模式下可以隐藏）
    if (!this.compactMode) {
      if (node.relationType && node.parentId) {
        const relationEl = doc.createXULElement("label");
        relationEl.setAttribute(
          "value",
          this.getRelationIcon(node.relationType),
        );
        relationEl.setAttribute(
          "tooltiptext",
          this.getRelationLabel(node.relationType),
        );
        relationEl.style.cssText =
          "width: 22px; font-size: 14px; flex-shrink: 0;";
        contentEl.appendChild(relationEl);
      } else {
        const spacerEl = doc.createXULElement("label");
        spacerEl.setAttribute("value", "");
        spacerEl.style.cssText = "width: 22px; flex-shrink: 0;";
        contentEl.appendChild(spacerEl);
      }
    }

    // 文献类型图标
    const iconEl = doc.createXULElement("label");
    const icon = this.getItemTypeIcon(node.itemType);
    iconEl.setAttribute("value", icon);
    iconEl.style.cssText = "width: 22px; font-size: 16px; flex-shrink: 0;";
    contentEl.appendChild(iconEl);

    // 标题处理 - 智能截断
    const titleEl = doc.createXULElement("label");
    const displayTitle = node.title || "Loading...";

    // 根据层级动态调整显示长度
    const baseLength = this.compactMode ? 30 : 40;
    const maxLength = Math.max(20, baseLength - level * 3);

    // 智能截断：保留开头和结尾
    let truncatedTitle = displayTitle;
    if (displayTitle.length > maxLength) {
      const startLength = Math.floor(maxLength * 0.7);
      const endLength = maxLength - startLength - 3;
      truncatedTitle =
        displayTitle.substr(0, startLength) +
        "..." +
        displayTitle.substr(-endLength);
    }

    titleEl.setAttribute("value", truncatedTitle);
    titleEl.setAttribute("flex", "1");
    titleEl.setAttribute(
      "tooltiptext",
      `${node.title}\n${node.creators}\n${node.year}`,
    );
    titleEl.style.cssText =
      "color: #333; overflow: hidden; text-overflow: ellipsis; min-width: 0;";
    contentEl.appendChild(titleEl);

    // 访问次数
    if (node.visitCount > 1) {
      const countEl = doc.createXULElement("label");
      countEl.setAttribute("value", `(${node.visitCount})`);
      countEl.style.cssText =
        "color: #999; margin-left: 5px; font-size: 0.85em; flex-shrink: 0;";
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
      attachment: "📎",
      note: "📝",
      default: "📄",
    };
    return icons[itemType] || icons.default;
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

  // 初始化会话
  ResearchNavigator.initSession();

  // 注册到 Zotero
  Zotero.ResearchNavigator = ResearchNavigator;

  // 设置监听器
  ResearchNavigator.setupTabListener();

  // 初始化现有标签页
  await ResearchNavigator.initializeTabs();

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

  ResearchNavigator.debug("Research Navigator started");
}

function shutdown({ id, version, resourceURI, rootURI }, reason) {
  if (reason === APP_SHUTDOWN) {
    return;
  }

  // 清理监听器
  ResearchNavigator.cleanupListeners();

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

  // 1. 添加导航工具栏
  addNavigationToolbar(window);

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

    // 添加到研究路径
    const addMenuItem = doc.createXULElement("menuitem");
    addMenuItem.id = "research-navigator-item-menu";
    addMenuItem.setAttribute("label", "Add to Research Path");
    addMenuItem.addEventListener("command", function () {
      const items = window.ZoteroPane.getSelectedItems();
      if (items.length > 0) {
        ResearchNavigator.addToTreeHistory(items[0], RelationType.MANUAL);
        showNotification(
          window,
          `Added to research path: ${items[0].getField("title")}`,
        );
      }
    });
    itemMenu.appendChild(addMenuItem);
    ResearchNavigator.addedElementIds.push("research-navigator-item-menu");

    // 作为新路径开始
    const newPathMenuItem = doc.createXULElement("menuitem");
    newPathMenuItem.id = "research-navigator-new-path-menu";
    newPathMenuItem.setAttribute("label", "Start New Research Path Here");
    newPathMenuItem.addEventListener("command", function () {
      const items = window.ZoteroPane.getSelectedItems();
      if (items.length > 0) {
        ResearchNavigator.currentNode = null;
        ResearchNavigator.addToTreeHistory(items[0], RelationType.MANUAL);
        showNotification(
          window,
          `Started new research path from: ${items[0].getField("title")}`,
        );
      }
    });
    itemMenu.appendChild(newPathMenuItem);
    ResearchNavigator.addedElementIds.push("research-navigator-new-path-menu");
  }

  // 5. 创建树形历史面板（初始隐藏）
  createTreePanel(window);
}

// 添加导航工具栏
function addNavigationToolbar(window) {
  const doc = window.document;

  // 尝试多个工具栏位置
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

  // 创建导航按钮容器
  if (!doc.getElementById("research-navigator-toolbar-container")) {
    const container = doc.createXULElement("hbox");
    container.id = "research-navigator-toolbar-container";
    container.style.cssText = "margin: 0 5px;";

    // 后退按钮
    const backBtn = doc.createXULElement("toolbarbutton");
    backBtn.id = "research-navigator-back";
    backBtn.className = "zotero-tb-button";
    backBtn.setAttribute("tooltiptext", "Navigate Back");
    backBtn.setAttribute("label", "←");
    backBtn.addEventListener("command", () => {
      ResearchNavigator.navigateBack();
    });

    // 前进按钮
    const forwardBtn = doc.createXULElement("toolbarbutton");
    forwardBtn.id = "research-navigator-forward";
    forwardBtn.className = "zotero-tb-button";
    forwardBtn.setAttribute("tooltiptext", "Navigate Forward");
    forwardBtn.setAttribute("label", "→");
    forwardBtn.addEventListener("command", () => {
      ResearchNavigator.navigateForward();
    });

    // 父节点按钮
    const parentBtn = doc.createXULElement("toolbarbutton");
    parentBtn.id = "research-navigator-parent";
    parentBtn.className = "zotero-tb-button";
    parentBtn.setAttribute("tooltiptext", "Go to Parent Item");
    parentBtn.setAttribute("label", "↑");
    parentBtn.addEventListener("command", () => {
      ResearchNavigator.navigateToParent();
    });

    // 树形视图按钮
    const treeBtn = doc.createXULElement("toolbarbutton");
    treeBtn.id = "research-navigator-tree-button";
    treeBtn.className = "zotero-tb-button";
    treeBtn.setAttribute("tooltiptext", "Toggle Tree History");
    treeBtn.setAttribute("label", "🌳");
    treeBtn.addEventListener("command", () => {
      toggleTreePanel(window);
    });

    // 分隔符
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

    // 初始更新按钮状态
    ResearchNavigator.updateNavigationButtons();
  }
}

// 创建树形历史面板
function createTreePanel(window) {
  const doc = window.document;

  if (doc.getElementById("research-navigator-panel")) {
    return;
  }

  // 外层容器（固定定位）
  const panelWrapper = doc.createXULElement("vbox");
  panelWrapper.id = "research-navigator-panel";
  panelWrapper.style.cssText = `
    position: fixed;
    right: ${ResearchNavigator.panelRight}px;
    top: ${ResearchNavigator.panelTop}px;
    width: ${ResearchNavigator.panelWidth}px;
    height: 600px;
    background: white;
    border: 1px solid #ccc;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 1000;
    display: none;
    min-width: 300px;
    max-width: 800px;
    display: flex;
    flex-direction: column;
  `;

  // 标题栏（可拖动）
  const header = doc.createXULElement("hbox");
  header.style.cssText = `
    background: linear-gradient(to bottom, #4CAF50, #45a049);
    color: white;
    padding: 10px 12px;
    align-items: center;
    border-radius: 6px 6px 0 0;
    cursor: move;
    flex-shrink: 0;
  `;

  // 拖动功能
  header.addEventListener("mousedown", (e) => {
    if (e.target !== header && e.target.parentNode !== header) return;

    ResearchNavigator.isDragging = true;
    const startX = e.clientX;
    const startY = e.clientY;
    const startRight = parseInt(panelWrapper.style.right);
    const startTop = parseInt(panelWrapper.style.top);

    const onMouseMove = (e) => {
      if (!ResearchNavigator.isDragging) return;

      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      const newRight = startRight - deltaX;
      const newTop = startTop + deltaY;

      // 限制在窗口内
      if (
        newRight >= 0 &&
        newRight <= window.innerWidth - panelWrapper.clientWidth
      ) {
        panelWrapper.style.right = newRight + "px";
        ResearchNavigator.panelRight = newRight;
      }
      if (
        newTop >= 0 &&
        newTop <= window.innerHeight - panelWrapper.clientHeight
      ) {
        panelWrapper.style.top = newTop + "px";
        ResearchNavigator.panelTop = newTop;
      }
    };

    const onMouseUp = () => {
      ResearchNavigator.isDragging = false;
      doc.removeEventListener("mousemove", onMouseMove);
      doc.removeEventListener("mouseup", onMouseUp);
    };

    doc.addEventListener("mousemove", onMouseMove);
    doc.addEventListener("mouseup", onMouseUp);
  });

  const title = doc.createXULElement("label");
  title.setAttribute("value", "Research Tree History");
  title.setAttribute("flex", "1");
  title.style.cssText = "font-weight: bold; font-size: 1.1em; cursor: move;";

  const closeBtn = doc.createXULElement("toolbarbutton");
  closeBtn.setAttribute("label", "✕");
  closeBtn.style.cssText = `
    color: white;
    min-width: 24px;
    margin: 0;
    padding: 2px 6px;
    background: rgba(255,255,255,0.2);
    border-radius: 3px;
    font-weight: bold;
    cursor: pointer;
  `;
  closeBtn.addEventListener("command", () => {
    panelWrapper.style.display = "none";
  });

  header.appendChild(title);
  header.appendChild(closeBtn);

  // 工具栏
  const toolbar = doc.createXULElement("hbox");
  toolbar.style.cssText =
    "padding: 8px; border-bottom: 1px solid #e0e0e0; background: #f8f8f8; flex-shrink: 0;";

  // 统计信息
  const statsLabel = doc.createXULElement("label");
  statsLabel.id = "research-navigator-stats";
  statsLabel.setAttribute("value", "Loading...");
  statsLabel.style.cssText = "flex: 1; color: #666; font-size: 0.9em;";

  // 紧凑模式切换
  const compactBtn = doc.createXULElement("button");
  compactBtn.setAttribute("label", "📐");
  compactBtn.setAttribute("tooltiptext", "Toggle Compact Mode");
  compactBtn.style.cssText = "margin: 0 4px;";
  compactBtn.addEventListener("command", () => {
    ResearchNavigator.compactMode = !ResearchNavigator.compactMode;
    ResearchNavigator.updateTreeDisplay();
    showNotification(
      window,
      ResearchNavigator.compactMode ? "Compact mode ON" : "Compact mode OFF",
    );
  });

  const newSessionBtn = doc.createXULElement("button");
  newSessionBtn.setAttribute("label", "New Session");
  newSessionBtn.style.cssText = "margin: 0 4px;";
  newSessionBtn.addEventListener("command", () => {
    ResearchNavigator.initSession();
    ResearchNavigator.currentNode = null;
    showNotification(window, "Started new research session");
  });

  const clearBtn = doc.createXULElement("button");
  clearBtn.setAttribute("label", "Clear");
  clearBtn.style.cssText = "margin: 0 4px;";
  clearBtn.addEventListener("command", () => {
    if (window.confirm("Clear all history? This cannot be undone.")) {
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
  toolbar.appendChild(compactBtn);
  toolbar.appendChild(newSessionBtn);
  toolbar.appendChild(clearBtn);

  // 内容区域（带滚动）
  const contentArea = doc.createXULElement("vbox");
  contentArea.setAttribute("flex", "1");
  contentArea.style.cssText = `
    overflow: auto;
    background: #fafafa;
    position: relative;
    min-height: 0;
  `;

  // 树容器
  const treeContainer = doc.createXULElement("vbox");
  treeContainer.id = "research-navigator-tree-container";
  treeContainer.style.cssText = "padding: 10px; min-width: max-content;";

  contentArea.appendChild(treeContainer);

  // 调整大小手柄（右边缘）
  const resizer = doc.createXULElement("splitter");
  resizer.setAttribute("orient", "vertical");
  resizer.style.cssText = `
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 5px;
    cursor: ew-resize;
    background: transparent;
  `;

  resizer.addEventListener("mousedown", (e) => {
    ResearchNavigator.isResizing = true;
    const startX = e.clientX;
    const startWidth = panelWrapper.clientWidth;

    const onMouseMove = (e) => {
      if (!ResearchNavigator.isResizing) return;
      const newWidth = startWidth + (e.clientX - startX);
      if (newWidth >= 300 && newWidth <= 800) {
        panelWrapper.style.width = newWidth + "px";
        ResearchNavigator.panelWidth = newWidth;
      }
    };

    const onMouseUp = () => {
      ResearchNavigator.isResizing = false;
      doc.removeEventListener("mousemove", onMouseMove);
      doc.removeEventListener("mouseup", onMouseUp);
    };

    doc.addEventListener("mousemove", onMouseMove);
    doc.addEventListener("mouseup", onMouseUp);
  });

  panelWrapper.appendChild(header);
  panelWrapper.appendChild(toolbar);
  panelWrapper.appendChild(contentArea);
  panelWrapper.appendChild(resizer);

  // 添加到文档
  const mainWindow = doc.getElementById("main-window") || doc.documentElement;
  mainWindow.appendChild(panelWrapper);

  ResearchNavigator.addedElementIds.push("research-navigator-panel");
  ResearchNavigator.historyPanels.set(window, panelWrapper);

  // 初始更新
  ResearchNavigator.updateTreePanel(window, panelWrapper);
}

// 切换树形历史面板
function toggleTreePanel(window) {
  const doc = window.document;
  const panel = doc.getElementById("research-navigator-panel");

  if (!panel) {
    createTreePanel(window);
    return;
  }

  if (panel.style.display === "none" || panel.style.display === "") {
    panel.style.display = "flex";
    ResearchNavigator.updateTreePanel(window, panel);
  } else {
    panel.style.display = "none";
  }
}

// 显示通知
function showNotification(window, message) {
  if (!window) return;

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
