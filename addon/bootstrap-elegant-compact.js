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
            false
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
  MANUAL: 'manual',        // 手动导航
  CITATION: 'citation',    // 引用关系
  AUTHOR: 'author',        // 作者关系
  TAG: 'tag',             // 标签关系
  COLLECTION: 'collection', // 同一文件夹
  RELATED: 'related',      // Zotero相关
  TEMPORAL: 'temporal',    // 时间关系
  TAB: 'tab'              // 标签页导航
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
    this.title = '';
    this.creators = '';
    this.itemType = '';
    this.year = '';
    this.key = '';
  }
  
  generateId() {
    return 'node_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
  
  addChild(node) {
    node.depth = this.depth + 1;
    node.parentId = this.id;
    this.children.push(node);
  }
  
  updateItemInfo(item) {
    if (!item) return;
    this.title = item.getField('title') || 'Untitled';
    this.creators = item.getCreators().map(c => (c.firstName || '') + ' ' + (c.lastName || '')).join(', ');
    this.itemType = item.itemType;
    this.year = item.getField('year') || '';
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
  treeRoots: [],              // 所有根节点
  nodeMap: new Map(),         // id -> node 的映射
  itemNodeMap: new Map(),     // itemId -> nodes 的映射
  tabNodeMap: new Map(),      // tabId -> node 的映射
  currentNode: null,          // 当前节点
  currentSessionId: null,     // 当前会话ID
  lastActivityTime: null,     // 最后活动时间
  sessionTimeout: 30 * 60 * 1000, // 30分钟会话超时
  navigationTimeout: 5000,    // 5秒内认为是导航关系
  
  // 导航历史
  navigationHistory: [],      // 导航历史栈
  navigationIndex: -1,        // 当前在历史中的位置
  
  // 监听器ID
  notifierID: null,
  
  // 面板设置
  panelWidth: 380,
  panelTop: 100,
  panelRight: 10,
  isResizing: false,
  isDragging: false,
  viewMode: 'tree',           // 'tree' or 'list'
  
  // 调试日志
  debug(msg) {
    Zotero.debug(`[Research Navigator] ${msg}`);
  },
  
  // 初始化会话
  initSession() {
    this.currentSessionId = 'session_' + Date.now();
    this.lastActivityTime = Date.now();
  },
  
  // 检查是否需要新会话
  checkSession() {
    const now = Date.now();
    if (!this.lastActivityTime || (now - this.lastActivityTime) > this.sessionTimeout) {
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
      const fromTags = fromItem.getTags().map(t => t.tag);
      const toTags = toItem.getTags().map(t => t.tag);
      
      const commonTags = fromTags.filter(t => toTags.includes(t));
      if (commonTags.length > 0) {
        return RelationType.TAG;
      }
      
      // 3. 检查是否在同一文件夹
      const fromCollections = fromItem.getCollections();
      const toCollections = toItem.getCollections();
      
      const commonCollections = fromCollections.filter(c => toCollections.includes(c));
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
    const shouldBeChild = fromNode && 
                         fromNode.sessionId === this.currentSessionId &&
                         (Date.now() - fromNode.lastVisit.getTime()) < this.navigationTimeout;
    
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
      this.navigationHistory = this.navigationHistory.slice(0, this.navigationIndex + 1);
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
        
        const backBtn = doc.getElementById('research-navigator-back');
        const forwardBtn = doc.getElementById('research-navigator-forward');
        const parentBtn = doc.getElementById('research-navigator-parent');
        
        if (backBtn) {
          backBtn.disabled = this.navigationIndex <= 0;
        }
        if (forwardBtn) {
          forwardBtn.disabled = this.navigationIndex >= this.navigationHistory.length - 1;
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
    this.notifierID = Zotero.Notifier.registerObserver({
      notify: async (event, type, ids, extraData) => {
        this.debug(`Event: ${event}, Type: ${type}, IDs: ${JSON.stringify(ids)}`);
        
        if (type === 'tab') {
          // 处理标签页事件
          if (event === 'add' && ids.length > 0) {
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
          } else if (event === 'close' && ids.length > 0) {
            // 标签页关闭
            const tabID = ids[0];
            this.debug(`Tab closed: ${tabID}`);
            this.tabNodeMap.delete(tabID);
          } else if (event === 'select' && ids.length > 0) {
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
        } else if (type === 'item' && event === 'select') {
          // 项目选择事件
          if (ids.length > 0) {
            const item = await Zotero.Items.getAsync(ids[0]);
            if (item && !item.isNote() && !item.isAttachment()) {
              this.addToTreeHistory(item);
            }
          }
        }
      }
    }, ['tab', 'item'], 'ResearchNavigator');
    
    this.debug('Tab listener registered');
  },
  
  // 初始化：获取当前打开的标签页
  async initializeTabs() {
    try {
      var win = Services.wm.getMostRecentWindow("navigator:browser");
      if (win && win.Zotero_Tabs) {
        const tabs = win.Zotero_Tabs.getState();
        this.debug(`Found ${tabs.length} existing tabs`);
        
        for (let tab of tabs) {
          if (tab.type === 'reader' && tab.data && tab.data.itemID) {
            const item = await Zotero.Items.getAsync(tab.data.itemID);
            if (item) {
              this.debug(`Loading existing tab: ${item.getField('title')}`);
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
      [RelationType.MANUAL]: '→',
      [RelationType.CITATION]: '📎',
      [RelationType.AUTHOR]: '👤',
      [RelationType.TAG]: '🏷️',
      [RelationType.COLLECTION]: '📁',
      [RelationType.RELATED]: '🔗',
      [RelationType.TEMPORAL]: '⏱️',
      [RelationType.TAB]: '📑'
    };
    return icons[relationType] || '→';
  },
  
  // 获取关系类型颜色
  getRelationColor(relationType) {
    const colors = {
      [RelationType.MANUAL]: '#666',
      [RelationType.CITATION]: '#e91e63',
      [RelationType.AUTHOR]: '#2196f3',
      [RelationType.TAG]: '#4caf50',
      [RelationType.COLLECTION]: '#ff9800',
      [RelationType.RELATED]: '#9c27b0',
      [RelationType.TEMPORAL]: '#607d8b',
      [RelationType.TAB]: '#00bcd4'
    };
    return colors[relationType] || '#666';
  },
  
  // 获取关系类型说明
  getRelationLabel(relationType) {
    const labels = {
      [RelationType.MANUAL]: 'Manual navigation',
      [RelationType.CITATION]: 'Citation',
      [RelationType.AUTHOR]: 'Same author',
      [RelationType.TAG]: 'Common tags',
      [RelationType.COLLECTION]: 'Same collection',
      [RelationType.RELATED]: 'Related item',
      [RelationType.TEMPORAL]: 'Time-based',
      [RelationType.TAB]: 'Tab navigation'
    };
    return labels[relationType] || 'Unknown';
  },
  
  // 获取树形数据（用于显示）
  getTreeData() {
    const sessions = new Map();
    
    // 按会话分组
    this.treeRoots.forEach(root => {
      if (!sessions.has(root.sessionId)) {
        sessions.set(root.sessionId, {
          id: root.sessionId,
          timestamp: root.timestamp,
          roots: []
        });
      }
      sessions.get(root.sessionId).roots.push(root);
    });
    
    // 转换为数组并排序
    return Array.from(sessions.values()).sort((a, b) => b.timestamp - a.timestamp);
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
    const treeContainer = doc.getElementById('research-navigator-tree-container');
    if (!treeContainer) return;
    
    // 清空现有内容
    while (treeContainer.firstChild) {
      treeContainer.removeChild(treeContainer.firstChild);
    }
    
    // 获取树形数据
    const sessions = this.getTreeData();
    
    if (sessions.length === 0) {
      const emptyMsg = doc.createXULElement('vbox');
      emptyMsg.style.cssText = 'padding: 40px 20px; align-items: center;';
      
      const icon = doc.createXULElement('label');
      icon.setAttribute('value', '🌱');
      icon.style.cssText = 'font-size: 48px; margin-bottom: 10px;';
      
      const text = doc.createXULElement('label');
      text.setAttribute('value', 'Start exploring to build your research tree');
      text.style.cssText = 'color: #999; font-size: 0.9em; text-align: center;';
      
      emptyMsg.appendChild(icon);
      emptyMsg.appendChild(text);
      treeContainer.appendChild(emptyMsg);
      return;
    }
    
    // 渲染每个会话
    sessions.forEach((session, index) => {
      const sessionEl = this.createSessionElement(doc, session, index === 0);
      treeContainer.appendChild(sessionEl);
    });
    
    // 更新统计信息
    const statsLabel = doc.getElementById('research-navigator-stats');
    if (statsLabel) {
      const totalNodes = this.nodeMap.size;
      const activePaths = this.treeRoots.filter(r => r.sessionId === this.currentSessionId).length;
      statsLabel.setAttribute('value', `${totalNodes} items • ${sessions.length} sessions • ${activePaths} active`);
    }
  },
  
  // 创建会话元素（美观版）
  createSessionElement(doc, session, isExpanded) {
    const sessionEl = doc.createXULElement('vbox');
    sessionEl.style.cssText = 'margin-bottom: 8px;';
    
    // 会话标题
    const headerEl = doc.createXULElement('hbox');
    headerEl.style.cssText = `
      cursor: pointer; 
      padding: 6px 10px; 
      background: ${isExpanded ? '#f8f9fa' : '#fff'};
      border: 1px solid ${isExpanded ? '#e0e0e0' : '#f0f0f0'};
      border-radius: 6px;
      align-items: center;
      transition: all 0.2s ease;
    `;
    
    // 悬停效果
    headerEl.addEventListener('mouseenter', () => {
      if (!isExpanded) headerEl.style.background = '#f8f9fa';
    });
    headerEl.addEventListener('mouseleave', () => {
      if (!isExpanded) headerEl.style.background = '#fff';
    });
    
    const toggleEl = doc.createXULElement('label');
    toggleEl.setAttribute('value', isExpanded ? '▼' : '▶');
    toggleEl.style.cssText = 'width: 14px; color: #666; font-size: 0.8em; margin-right: 4px;';
    
    const iconEl = doc.createXULElement('label');
    iconEl.setAttribute('value', '📅');
    iconEl.style.cssText = 'margin-right: 6px; font-size: 14px;';
    
    const titleEl = doc.createXULElement('label');
    const sessionDate = new Date(session.timestamp);
    const today = new Date();
    const isToday = sessionDate.toDateString() === today.toDateString();
    const dateStr = isToday ? 'Today' : sessionDate.toLocaleDateString();
    const timeStr = sessionDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    titleEl.setAttribute('value', `${dateStr} • ${timeStr}`);
    titleEl.setAttribute('flex', '1');
    titleEl.style.cssText = 'font-weight: 500; color: #333;';
    
    const countEl = doc.createXULElement('label');
    countEl.setAttribute('value', `${session.roots.length} paths`);
    countEl.style.cssText = 'color: #999; font-size: 0.85em; margin-left: 8px;';
    
    headerEl.appendChild(toggleEl);
    headerEl.appendChild(iconEl);
    headerEl.appendChild(titleEl);
    headerEl.appendChild(countEl);
    
    // 树容器
    const treeEl = doc.createXULElement('vbox');
    treeEl.style.cssText = isExpanded ? 
      'margin-top: 4px; padding-left: 20px;' : 
      'display: none;';
    
    // 点击展开/折叠
    headerEl.addEventListener('click', () => {
      const expanded = treeEl.style.display === 'none';
      treeEl.style.display = expanded ? '' : 'none';
      toggleEl.setAttribute('value', expanded ? '▼' : '▶');
      headerEl.style.background = expanded ? '#f8f9fa' : '#fff';
      headerEl.style.border = `1px solid ${expanded ? '#e0e0e0' : '#f0f0f0'}`;
    });
    
    // 渲染每个根节点
    session.roots.forEach(root => {
      const rootEl = this.createNodeElement(doc, root, 0);
      treeEl.appendChild(rootEl);
    });
    
    sessionEl.appendChild(headerEl);
    sessionEl.appendChild(treeEl);
    
    return sessionEl;
  },
  
  // 创建节点元素（美观版）
  createNodeElement(doc, node, level) {
    const nodeEl = doc.createXULElement('vbox');
    nodeEl.style.cssText = 'position: relative;';
    
    // 连接线（仅子节点）
    if (level > 0) {
      const connector = doc.createXULElement('box');
      connector.style.cssText = `
        position: absolute;
        left: ${(level - 1) * 20 + 10}px;
        top: 0;
        bottom: 0;
        width: 20px;
        border-left: 1px solid #e0e0e0;
        border-bottom: 1px solid #e0e0e0;
        height: 14px;
      `;
      nodeEl.appendChild(connector);
    }
    
    // 节点内容
    const contentEl = doc.createXULElement('hbox');
    contentEl.style.cssText = `
      cursor: pointer; 
      padding: 4px 8px; 
      margin-left: ${level * 20}px;
      align-items: center;
      border-radius: 4px;
      transition: all 0.15s ease;
      position: relative;
      min-height: 24px;
    `;
    
    // 鼠标悬停效果
    contentEl.addEventListener('mouseenter', () => {
      contentEl.style.background = 'rgba(33, 150, 243, 0.08)';
    });
    contentEl.addEventListener('mouseleave', () => {
      contentEl.style.background = node === this.currentNode ? 'rgba(33, 150, 243, 0.12)' : '';
    });
    
    // 当前节点高亮
    if (node === this.currentNode) {
      contentEl.style.background = 'rgba(33, 150, 243, 0.12)';
      contentEl.style.borderLeft = '3px solid #2196f3';
      contentEl.style.paddingLeft = '5px';
    }
    
    // 展开/折叠（仅有子节点时显示）
    if (node.children.length > 0) {
      const toggleEl = doc.createXULElement('label');
      toggleEl.setAttribute('value', node.expanded ? '−' : '+');
      toggleEl.style.cssText = `
        width: 16px; 
        height: 16px; 
        cursor: pointer; 
        color: #666; 
        font-size: 12px; 
        text-align: center;
        border: 1px solid #ddd;
        border-radius: 3px;
        margin-right: 6px;
        background: white;
        line-height: 14px;
      `;
      toggleEl.addEventListener('click', (e) => {
        e.stopPropagation();
        node.expanded = !node.expanded;
        this.updateTreeDisplay();
      });
      contentEl.appendChild(toggleEl);
    } else {
      const spacerEl = doc.createXULElement('box');
      spacerEl.style.cssText = 'width: 22px;';
      contentEl.appendChild(spacerEl);
    }
    
    // 关系指示（彩色小圆点）
    if (node.parentId && level > 0) {
      const relationDot = doc.createXULElement('box');
      relationDot.style.cssText = `
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: ${this.getRelationColor(node.relationType)};
        margin-right: 6px;
      `;
      relationDot.setAttribute('tooltiptext', this.getRelationLabel(node.relationType));
      contentEl.appendChild(relationDot);
    }
    
    // 文献类型图标
    const iconEl = doc.createXULElement('label');
    const icon = this.getItemTypeIcon(node.itemType);
    iconEl.setAttribute('value', icon);
    iconEl.style.cssText = 'width: 20px; font-size: 14px; margin-right: 6px; opacity: 0.8;';
    contentEl.appendChild(iconEl);
    
    // 标题和年份
    const textBox = doc.createXULElement('vbox');
    textBox.setAttribute('flex', '1');
    textBox.style.cssText = 'min-width: 0;';
    
    const titleEl = doc.createXULElement('label');
    const displayTitle = node.title || 'Loading...';
    const maxLength = 50;
    const truncatedTitle = displayTitle.length > maxLength ? 
      displayTitle.substr(0, maxLength) + '…' : displayTitle;
    titleEl.setAttribute('value', truncatedTitle);
    titleEl.setAttribute('tooltiptext', `${node.title}\n${node.creators}\n${node.year}`);
    titleEl.style.cssText = 'font-size: 0.9em; color: #333; font-weight: 400;';
    
    // 作者和年份（次要信息）
    const metaEl = doc.createXULElement('label');
    const firstAuthor = node.creators.split(',')[0]?.trim() || '';
    const shortAuthor = firstAuthor.length > 20 ? firstAuthor.substr(0, 20) + '…' : firstAuthor;
    const metaText = node.year ? `${shortAuthor} • ${node.year}` : shortAuthor;
    metaEl.setAttribute('value', metaText);
    metaEl.style.cssText = 'font-size: 0.8em; color: #999; margin-top: 1px;';
    
    textBox.appendChild(titleEl);
    if (metaText) textBox.appendChild(metaEl);
    contentEl.appendChild(textBox);
    
    // 访问次数（徽章样式）
    if (node.visitCount > 1) {
      const countEl = doc.createXULElement('label');
      countEl.setAttribute('value', node.visitCount);
      countEl.style.cssText = `
        background: #e3f2fd;
        color: #1976d2;
        padding: 1px 6px;
        border-radius: 10px;
        font-size: 0.75em;
        font-weight: 500;
        margin-left: 6px;
      `;
      contentEl.appendChild(countEl);
    }
    
    // 点击打开文献
    contentEl.addEventListener('click', () => {
      this.currentNode = node;
      this.openItemFromNode(node);
      this.addToNavigationHistory(node);
      this.updateTreeDisplay();
    });
    
    nodeEl.appendChild(contentEl);
    
    // 子节点
    if (node.expanded && node.children.length > 0) {
      const childrenEl = doc.createXULElement('vbox');
      childrenEl.style.cssText = 'position: relative;';
      node.children.forEach(child => {
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
      'journalArticle': '📰',
      'book': '📚',
      'bookSection': '📖',
      'conferencePaper': '📋',
      'thesis': '🎓',
      'report': '📊',
      'webpage': '🌐',
      'attachment': '📎',
      'note': '📝',
      'default': '📄'
    };
    return icons[itemType] || icons.default;
  }
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
  
  ResearchNavigator.debug('Research Navigator started');
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
      false
    );
  },
  onCloseWindow: function (aWindow) {},
  onWindowTitleChange: function (aWindow, aTitle) {}
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
    
    floatBtn.onmouseover = function() {
      this.style.transform = 'scale(1.1)';
    };
    
    floatBtn.onmouseout = function() {
      this.style.transform = 'scale(1)';
    };
    
    floatBtn.onclick = function(e) {
      e.preventDefault();
      e.stopPropagation();
      toggleTreePanel(window);
    };
    
    // 尝试多个父元素
    const parents = [doc.body, doc.documentElement, doc.getElementById("browser"), doc.querySelector("#appcontent")];
    for (let parent of parents) {
      if (parent) {
        try {
          parent.appendChild(floatBtn);
          ResearchNavigator.addedElementIds.push("research-navigator-float-button");
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
    ResearchNavigator.addedElementIds.push("research-navigator-tools-separator");
    
    const menuitem = doc.createXULElement("menuitem");
    menuitem.id = "research-navigator-tools-menu";
    menuitem.setAttribute("label", "Research Navigator - Tree History");
    menuitem.setAttribute("accesskey", "T");
    menuitem.addEventListener("command", function() {
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
    addMenuItem.addEventListener("command", function() {
      const items = window.ZoteroPane.getSelectedItems();
      if (items.length > 0) {
        ResearchNavigator.addToTreeHistory(items[0], RelationType.MANUAL);
        showNotification(window, `Added to research path: ${items[0].getField('title')}`);
      }
    });
    itemMenu.appendChild(addMenuItem);
    ResearchNavigator.addedElementIds.push("research-navigator-item-menu");
    
    // 作为新路径开始
    const newPathMenuItem = doc.createXULElement("menuitem");
    newPathMenuItem.id = "research-navigator-new-path-menu";
    newPathMenuItem.setAttribute("label", "Start New Research Path Here");
    newPathMenuItem.addEventListener("command", function() {
      const items = window.ZoteroPane.getSelectedItems();
      if (items.length > 0) {
        ResearchNavigator.currentNode = null;
        ResearchNavigator.addToTreeHistory(items[0], RelationType.MANUAL);
        showNotification(window, `Started new research path from: ${items[0].getField('title')}`);
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
    'zotero-items-toolbar',
    'zotero-tb-advanced-search',
    'zotero-collections-toolbar'
  ];
  
  let toolbar = null;
  
  for (let id of toolbarIds) {
    const element = doc.getElementById(id);
    if (element && element.tagName === 'toolbar') {
      toolbar = element;
      break;
    }
  }
  
  if (!toolbar) return;
  
  // 创建导航按钮容器
  if (!doc.getElementById('research-navigator-toolbar-container')) {
    const container = doc.createXULElement('hbox');
    container.id = 'research-navigator-toolbar-container';
    container.style.cssText = 'margin: 0 5px;';
    
    // 后退按钮
    const backBtn = doc.createXULElement('toolbarbutton');
    backBtn.id = 'research-navigator-back';
    backBtn.className = 'zotero-tb-button';
    backBtn.setAttribute('tooltiptext', 'Navigate Back');
    backBtn.setAttribute('label', '←');
    backBtn.addEventListener('command', () => {
      ResearchNavigator.navigateBack();
    });
    
    // 前进按钮
    const forwardBtn = doc.createXULElement('toolbarbutton');
    forwardBtn.id = 'research-navigator-forward';
    forwardBtn.className = 'zotero-tb-button';
    forwardBtn.setAttribute('tooltiptext', 'Navigate Forward');
    forwardBtn.setAttribute('label', '→');
    forwardBtn.addEventListener('command', () => {
      ResearchNavigator.navigateForward();
    });
    
    // 父节点按钮
    const parentBtn = doc.createXULElement('toolbarbutton');
    parentBtn.id = 'research-navigator-parent';
    parentBtn.className = 'zotero-tb-button';
    parentBtn.setAttribute('tooltiptext', 'Go to Parent Item');
    parentBtn.setAttribute('label', '↑');
    parentBtn.addEventListener('command', () => {
      ResearchNavigator.navigateToParent();
    });
    
    // 树形视图按钮
    const treeBtn = doc.createXULElement('toolbarbutton');
    treeBtn.id = 'research-navigator-tree-button';
    treeBtn.className = 'zotero-tb-button';
    treeBtn.setAttribute('tooltiptext', 'Toggle Tree History');
    treeBtn.setAttribute('label', '🌳');
    treeBtn.addEventListener('command', () => {
      toggleTreePanel(window);
    });
    
    // 分隔符
    const separator = doc.createXULElement('toolbarseparator');
    
    container.appendChild(backBtn);
    container.appendChild(forwardBtn);
    container.appendChild(parentBtn);
    container.appendChild(separator);
    container.appendChild(treeBtn);
    
    toolbar.appendChild(container);
    ResearchNavigator.addedElementIds.push('research-navigator-toolbar-container');
    
    // 初始更新按钮状态
    ResearchNavigator.updateNavigationButtons();
  }
}

// 创建树形历史面板（美观版）
function createTreePanel(window) {
  const doc = window.document;
  
  if (doc.getElementById('research-navigator-panel')) {
    return;
  }
  
  // 外层容器
  const panelWrapper = doc.createXULElement('vbox');
  panelWrapper.id = 'research-navigator-panel';
  panelWrapper.style.cssText = `
    position: fixed;
    right: ${ResearchNavigator.panelRight}px;
    top: ${ResearchNavigator.panelTop}px;
    width: ${ResearchNavigator.panelWidth}px;
    height: 550px;
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04);
    z-index: 1000;
    display: none;
    min-width: 320px;
    max-width: 600px;
  `;
  
  // 标题栏
  const header = doc.createXULElement('hbox');
  header.style.cssText = `
    background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
    color: white;
    padding: 12px 16px;
    align-items: center;
    border-radius: 8px 8px 0 0;
    cursor: move;
  `;
  
  // 拖动功能
  header.addEventListener('mousedown', (e) => {
    if (e.target !== header && e.target.parentNode !== header) return;
    if (e.button !== 0) return;
    
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
      
      if (newRight >= 0 && newRight <= window.innerWidth - panelWrapper.clientWidth) {
        panelWrapper.style.right = newRight + 'px';
        ResearchNavigator.panelRight = newRight;
      }
      if (newTop >= 0 && newTop <= window.innerHeight - panelWrapper.clientHeight) {
        panelWrapper.style.top = newTop + 'px';
        ResearchNavigator.panelTop = newTop;
      }
    };
    
    const onMouseUp = () => {
      ResearchNavigator.isDragging = false;
      doc.removeEventListener('mousemove', onMouseMove);
      doc.removeEventListener('mouseup', onMouseUp);
    };
    
    doc.addEventListener('mousemove', onMouseMove);
    doc.addEventListener('mouseup', onMouseUp);
  });
  
  const iconEl = doc.createXULElement('label');
  iconEl.setAttribute('value', '🌳');
  iconEl.style.cssText = 'font-size: 18px; margin-right: 8px;';
  
  const title = doc.createXULElement('label');
  title.setAttribute('value', 'Research Navigator');
  title.setAttribute('flex', '1');
  title.style.cssText = 'font-weight: 600; font-size: 1.05em; cursor: move;';
  
  const minimizeBtn = doc.createXULElement('toolbarbutton');
  minimizeBtn.setAttribute('label', '−');
  minimizeBtn.style.cssText = `
    color: white;
    min-width: 24px;
    margin: 0 2px;
    padding: 0;
    background: rgba(255,255,255,0.15);
    border-radius: 4px;
    font-size: 18px;
    line-height: 24px;
    text-align: center;
    cursor: pointer;
  `;
  minimizeBtn.addEventListener('command', () => {
    // TODO: Implement minimize
  });
  
  const closeBtn = doc.createXULElement('toolbarbutton');
  closeBtn.setAttribute('label', '×');
  closeBtn.style.cssText = `
    color: white;
    min-width: 24px;
    margin: 0;
    padding: 0;
    background: rgba(255,255,255,0.15);
    border-radius: 4px;
    font-size: 18px;
    line-height: 24px;
    text-align: center;
    cursor: pointer;
  `;
  closeBtn.addEventListener('command', () => {
    panelWrapper.style.display = 'none';
  });
  
  header.appendChild(iconEl);
  header.appendChild(title);
  header.appendChild(minimizeBtn);
  header.appendChild(closeBtn);
  
  // 工具栏
  const toolbar = doc.createXULElement('hbox');
  toolbar.style.cssText = `
    padding: 10px 12px;
    border-bottom: 1px solid #f0f0f0;
    background: #fafbfc;
    align-items: center;
  `;
  
  const statsLabel = doc.createXULElement('label');
  statsLabel.id = 'research-navigator-stats';
  statsLabel.setAttribute('value', 'Loading...');
  statsLabel.style.cssText = 'flex: 1; color: #666; font-size: 0.85em;';
  
  const viewToggle = doc.createXULElement('button');
  viewToggle.setAttribute('label', '📊');
  viewToggle.setAttribute('tooltiptext', 'Toggle View Mode');
  viewToggle.style.cssText = `
    margin: 0 4px;
    padding: 4px 8px;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    background: white;
    cursor: pointer;
  `;
  viewToggle.addEventListener('command', () => {
    ResearchNavigator.viewMode = ResearchNavigator.viewMode === 'tree' ? 'list' : 'tree';
    ResearchNavigator.updateTreeDisplay();
  });
  
  const clearBtn = doc.createXULElement('button');
  clearBtn.setAttribute('label', 'Clear All');
  clearBtn.style.cssText = `
    margin: 0;
    padding: 4px 12px;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    background: white;
    color: #666;
    cursor: pointer;
  `;
  clearBtn.addEventListener('command', () => {
    if (window.confirm('Clear all history? This cannot be undone.')) {
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
  toolbar.appendChild(viewToggle);
  toolbar.appendChild(clearBtn);
  
  // 内容区域（使用 scrollbox）
  const scrollbox = doc.createXULElement('scrollbox');
  scrollbox.setAttribute('flex', '1');
  scrollbox.setAttribute('orient', 'vertical');
  scrollbox.style.cssText = `
    overflow: auto;
    background: #fafbfc;
    min-height: 0;
  `;
  
  // 树容器
  const treeContainer = doc.createXULElement('vbox');
  treeContainer.id = 'research-navigator-tree-container';
  treeContainer.style.cssText = 'padding: 12px; min-width: max-content;';
  
  scrollbox.appendChild(treeContainer);
  
  // 调整大小手柄
  const resizeHandle = doc.createXULElement('box');
  resizeHandle.style.cssText = `
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 8px;
    cursor: ew-resize;
    background: transparent;
  `;
  
  resizeHandle.addEventListener('mouseenter', () => {
    resizeHandle.style.background = 'linear-gradient(to right, transparent, rgba(76,175,80,0.1))';
  });
  
  resizeHandle.addEventListener('mouseleave', () => {
    if (!ResearchNavigator.isResizing) {
      resizeHandle.style.background = 'transparent';
    }
  });
  
  resizeHandle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    ResearchNavigator.isResizing = true;
    resizeHandle.style.background = 'linear-gradient(to right, transparent, rgba(76,175,80,0.2))';
    
    const startX = e.clientX;
    const startWidth = panelWrapper.clientWidth;
    
    const onMouseMove = (e) => {
      if (!ResearchNavigator.isResizing) return;
      
      const deltaX = e.clientX - startX;
      const newWidth = startWidth + deltaX;
      
      if (newWidth >= 320 && newWidth <= 600) {
        panelWrapper.style.width = newWidth + 'px';
        ResearchNavigator.panelWidth = newWidth;
      }
    };
    
    const onMouseUp = () => {
      ResearchNavigator.isResizing = false;
      resizeHandle.style.background = 'transparent';
      doc.removeEventListener('mousemove', onMouseMove);
      doc.removeEventListener('mouseup', onMouseUp);
    };
    
    doc.addEventListener('mousemove', onMouseMove);
    doc.addEventListener('mouseup', onMouseUp);
  });
  
  panelWrapper.appendChild(header);
  panelWrapper.appendChild(toolbar);
  panelWrapper.appendChild(scrollbox);
  panelWrapper.appendChild(resizeHandle);
  
  // 添加到文档
  const mainWindow = doc.getElementById('main-window') || doc.documentElement;
  mainWindow.appendChild(panelWrapper);
  
  ResearchNavigator.addedElementIds.push('research-navigator-panel');
  ResearchNavigator.historyPanels.set(window, panelWrapper);
  
  // 初始更新
  ResearchNavigator.updateTreePanel(window, panelWrapper);
}

// 切换树形历史面板
function toggleTreePanel(window) {
  const doc = window.document;
  const panel = doc.getElementById('research-navigator-panel');
  
  if (!panel) {
    createTreePanel(window);
    const newPanel = doc.getElementById('research-navigator-panel');
    if (newPanel) {
      newPanel.style.display = 'block';
    }
    return;
  }
  
  if (panel.style.display === 'none') {
    panel.style.display = 'block';
    ResearchNavigator.updateTreePanel(window, panel);
  } else {
    panel.style.display = 'none';
  }
}

// 显示通知（优雅版）
function showNotification(window, message) {
  if (!window) return;
  
  const doc = window.document;
  
  const notification = doc.createElement('div');
  notification.style.cssText = `
    position: fixed;
    bottom: 80px;
    right: 20px;
    background: white;
    color: #333;
    padding: 12px 20px;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 99999;
    font-size: 0.9em;
    border-left: 4px solid #4CAF50;
    animation: slideIn 0.3s ease;
    max-width: 300px;
  `;
  
  const icon = doc.createElement('span');
  icon.textContent = '✓ ';
  icon.style.cssText = 'color: #4CAF50; font-weight: bold; margin-right: 4px;';
  
  const text = doc.createElement('span');
  text.textContent = message;
  
  notification.appendChild(icon);
  notification.appendChild(text);
  
  const style = doc.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { 
        transform: translateX(100%); 
        opacity: 0; 
      }
      to { 
        transform: translateX(0); 
        opacity: 1; 
      }
    }
  `;
  doc.head.appendChild(style);
  
  doc.body.appendChild(notification);
  
  window.setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transform = 'translateX(20px)';
    notification.style.transition = 'all 0.3s ease';
    window.setTimeout(() => {
      notification.remove();
      style.remove();
    }, 300);
  }, 2500);
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