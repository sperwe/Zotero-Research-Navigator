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
  MANUAL: 'manual',
  CITATION: 'citation',
  AUTHOR: 'author',
  TAG: 'tag',
  COLLECTION: 'collection',
  RELATED: 'related',
  TEMPORAL: 'temporal',
  TAB: 'tab'
};

// 视图模式枚举
const ViewMode = {
  TREE: 'tree',
  LIST: 'list',
  GRAPH: 'graph',
  TIMELINE: 'timeline'
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
    this.notes = '';
    this.tags = [];
    this.importance = 0;
    
    // 文献信息缓存
    this.title = '';
    this.creators = '';
    this.itemType = '';
    this.year = '';
    this.key = '';
    this.doi = '';
    this.abstract = '';
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
    this.doi = item.getField('DOI') || '';
    this.abstract = item.getField('abstractNote') || '';
  }
  
  toJSON() {
    return {
      id: this.id,
      itemId: this.itemId,
      parentId: this.parentId,
      timestamp: this.timestamp,
      sessionId: this.sessionId,
      depth: this.depth,
      visitCount: this.visitCount,
      lastVisit: this.lastVisit,
      relationType: this.relationType,
      notes: this.notes,
      tags: this.tags,
      importance: this.importance,
      title: this.title,
      creators: this.creators,
      itemType: this.itemType,
      year: this.year,
      key: this.key,
      doi: this.doi
    };
  }
  
  static fromJSON(data) {
    const node = new TreeNode(data.itemId, data.parentId, data.relationType);
    Object.assign(node, data);
    node.timestamp = new Date(data.timestamp);
    node.lastVisit = new Date(data.lastVisit);
    node.children = [];
    return node;
  }
}

// 数据库管理器
class DatabaseManager {
  constructor() {
    this.dbName = 'ResearchNavigatorDB';
    this.tableName = 'researchNavigatorHistory';
    this.initialized = false;
  }
  
  async init() {
    if (this.initialized) return;
    
    try {
      await Zotero.DB.queryAsync(
        `CREATE TABLE IF NOT EXISTS ${this.tableName} (
          id TEXT PRIMARY KEY,
          data TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          sessionId TEXT NOT NULL,
          itemId INTEGER NOT NULL
        )`
      );
      
      await Zotero.DB.queryAsync(
        `CREATE INDEX IF NOT EXISTS idx_itemId ON ${this.tableName} (itemId)`
      );
      
      await Zotero.DB.queryAsync(
        `CREATE INDEX IF NOT EXISTS idx_sessionId ON ${this.tableName} (sessionId)`
      );
      
      await Zotero.DB.queryAsync(
        `CREATE INDEX IF NOT EXISTS idx_timestamp ON ${this.tableName} (timestamp)`
      );
      
      this.initialized = true;
      ResearchNavigator.debug('Database initialized');
    } catch (e) {
      ResearchNavigator.debug(`Database init error: ${e}`);
    }
  }
  
  async saveNode(node) {
    await this.init();
    
    try {
      const data = JSON.stringify(node.toJSON());
      await Zotero.DB.queryAsync(
        `INSERT OR REPLACE INTO ${this.tableName} (id, data, timestamp, sessionId, itemId) VALUES (?, ?, ?, ?, ?)`,
        [node.id, data, node.timestamp.getTime(), node.sessionId, node.itemId]
      );
    } catch (e) {
      ResearchNavigator.debug(`Save node error: ${e}`);
    }
  }
  
  async loadNodes(limit = 1000) {
    await this.init();
    
    try {
      const rows = await Zotero.DB.queryAsync(
        `SELECT data FROM ${this.tableName} ORDER BY timestamp DESC LIMIT ?`,
        [limit]
      );
      
      return rows.map(row => TreeNode.fromJSON(JSON.parse(row.data)));
    } catch (e) {
      ResearchNavigator.debug(`Load nodes error: ${e}`);
      return [];
    }
  }
  
  async loadNodesBySession(sessionId) {
    await this.init();
    
    try {
      const rows = await Zotero.DB.queryAsync(
        `SELECT data FROM ${this.tableName} WHERE sessionId = ? ORDER BY timestamp`,
        [sessionId]
      );
      
      return rows.map(row => TreeNode.fromJSON(JSON.parse(row.data)));
    } catch (e) {
      ResearchNavigator.debug(`Load session nodes error: ${e}`);
      return [];
    }
  }
  
  async searchNodes(query) {
    await this.init();
    
    try {
      const rows = await Zotero.DB.queryAsync(
        `SELECT data FROM ${this.tableName} 
         WHERE data LIKE ? 
         ORDER BY timestamp DESC 
         LIMIT 100`,
        [`%${query}%`]
      );
      
      return rows.map(row => TreeNode.fromJSON(JSON.parse(row.data)));
    } catch (e) {
      ResearchNavigator.debug(`Search nodes error: ${e}`);
      return [];
    }
  }
  
  async clearAll() {
    await this.init();
    
    try {
      await Zotero.DB.queryAsync(`DELETE FROM ${this.tableName}`);
    } catch (e) {
      ResearchNavigator.debug(`Clear all error: ${e}`);
    }
  }
  
  async exportData() {
    const nodes = await this.loadNodes(10000);
    return JSON.stringify({
      version: ResearchNavigator.version,
      exportDate: new Date(),
      nodes: nodes.map(n => n.toJSON())
    }, null, 2);
  }
  
  async importData(jsonData) {
    try {
      const data = JSON.parse(jsonData);
      for (let nodeData of data.nodes) {
        const node = TreeNode.fromJSON(nodeData);
        await this.saveNode(node);
      }
      return true;
    } catch (e) {
      ResearchNavigator.debug(`Import data error: ${e}`);
      return false;
    }
  }
}

// 搜索引擎
class SearchEngine {
  constructor() {
    this.searchIndex = new Map();
  }
  
  indexNode(node) {
    const searchText = `${node.title} ${node.creators} ${node.year} ${node.tags.join(' ')} ${node.notes}`.toLowerCase();
    const words = searchText.split(/\s+/).filter(w => w.length > 2);
    
    words.forEach(word => {
      if (!this.searchIndex.has(word)) {
        this.searchIndex.set(word, new Set());
      }
      this.searchIndex.get(word).add(node.id);
    });
  }
  
  search(query, nodes) {
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const results = new Map();
    
    queryWords.forEach(word => {
      if (this.searchIndex.has(word)) {
        this.searchIndex.get(word).forEach(nodeId => {
          results.set(nodeId, (results.get(nodeId) || 0) + 1);
        });
      }
    });
    
    // 根据匹配度排序
    const sortedIds = Array.from(results.entries())
      .sort((a, b) => b[1] - a[1])
      .map(entry => entry[0]);
    
    return sortedIds.map(id => nodes.find(n => n.id === id)).filter(n => n);
  }
  
  clear() {
    this.searchIndex.clear();
  }
}

// 推荐引擎
class RecommendationEngine {
  analyzePatterns(nodes) {
    const patterns = {
      authorCollaborations: new Map(),
      tagCombinations: new Map(),
      temporalPatterns: [],
      citationNetworks: new Map()
    };
    
    // 分析作者合作
    nodes.forEach(node => {
      const authors = node.creators.split(',').map(a => a.trim());
      authors.forEach(author => {
        if (!patterns.authorCollaborations.has(author)) {
          patterns.authorCollaborations.set(author, new Set());
        }
        authors.forEach(coauthor => {
          if (author !== coauthor) {
            patterns.authorCollaborations.get(author).add(coauthor);
          }
        });
      });
    });
    
    // 分析标签组合
    nodes.forEach(node => {
      if (node.tags.length > 1) {
        const tagCombo = node.tags.sort().join('|');
        patterns.tagCombinations.set(tagCombo, (patterns.tagCombinations.get(tagCombo) || 0) + 1);
      }
    });
    
    return patterns;
  }
  
  getRecommendations(currentNode, allNodes, limit = 5) {
    const recommendations = [];
    const patterns = this.analyzePatterns(allNodes);
    
    // 基于作者的推荐
    const currentAuthors = currentNode.creators.split(',').map(a => a.trim());
    const relatedAuthors = new Set();
    
    currentAuthors.forEach(author => {
      if (patterns.authorCollaborations.has(author)) {
        patterns.authorCollaborations.get(author).forEach(coauthor => {
          relatedAuthors.add(coauthor);
        });
      }
    });
    
    // 查找相关作者的其他文献
    allNodes.forEach(node => {
      if (node.id === currentNode.id) return;
      
      const nodeAuthors = node.creators.split(',').map(a => a.trim());
      const hasRelatedAuthor = nodeAuthors.some(author => relatedAuthors.has(author));
      
      if (hasRelatedAuthor) {
        recommendations.push({
          node: node,
          reason: 'Related author',
          score: 0.8
        });
      }
    });
    
    // 基于标签的推荐
    if (currentNode.tags.length > 0) {
      allNodes.forEach(node => {
        if (node.id === currentNode.id) return;
        
        const commonTags = node.tags.filter(tag => currentNode.tags.includes(tag));
        if (commonTags.length > 0) {
          recommendations.push({
            node: node,
            reason: `Common tags: ${commonTags.join(', ')}`,
            score: 0.6 + (0.1 * commonTags.length)
          });
        }
      });
    }
    
    // 按分数排序并返回前N个
    return recommendations
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}

var ResearchNavigator = {
  id: null,
  version: null,
  rootURI: null,
  addedElementIds: [],
  historyPanels: new Map(),
  
  // 数据管理
  db: new DatabaseManager(),
  searchEngine: new SearchEngine(),
  recommendationEngine: new RecommendationEngine(),
  
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
  panelHeight: 550,
  panelTop: 100,
  panelRight: 10,
  isResizing: false,
  isDragging: false,
  viewMode: ViewMode.TREE,
  compactMode: false,
  showRecommendations: false,
  
  // 过滤设置
  filterRelationType: null,
  filterDateRange: null,
  filterImportance: 0,
  searchQuery: '',
  
  // 快捷键
  shortcuts: {
    togglePanel: 'Alt+H',
    navigateBack: 'Alt+Left',
    navigateForward: 'Alt+Right',
    navigateParent: 'Alt+Up',
    switchView: 'Alt+V',
    search: 'Ctrl+F'
  },
  
  // 调试日志
  debug(msg) {
    Zotero.debug(`[Research Navigator] ${msg}`);
  },
  
  // 初始化
  async init() {
    this.initSession();
    await this.db.init();
    await this.loadHistoryFromDB();
    this.setupShortcuts();
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
  
  // 从数据库加载历史
  async loadHistoryFromDB() {
    const nodes = await this.db.loadNodes();
    
    // 重建树结构
    const nodeById = new Map();
    nodes.forEach(node => {
      nodeById.set(node.id, node);
      this.nodeMap.set(node.id, node);
      
      if (!this.itemNodeMap.has(node.itemId)) {
        this.itemNodeMap.set(node.itemId, []);
      }
      this.itemNodeMap.get(node.itemId).push(node);
      
      // 重建搜索索引
      this.searchEngine.indexNode(node);
    });
    
    // 重建父子关系
    nodes.forEach(node => {
      if (node.parentId && nodeById.has(node.parentId)) {
        const parent = nodeById.get(node.parentId);
        parent.children.push(node);
      } else if (!node.parentId) {
        this.treeRoots.push(node);
      }
    });
    
    this.debug(`Loaded ${nodes.length} nodes from database`);
  },
  
  // 设置快捷键
  setupShortcuts() {
    // 这里需要根据Zotero的具体API来实现
    // 暂时使用简单的键盘事件监听
    var windows = Services.wm.getEnumerator("navigator:browser");
    while (windows.hasMoreElements()) {
      let win = windows.getNext();
      if (win.document) {
        win.document.addEventListener('keydown', this.handleShortcut.bind(this));
      }
    }
  },
  
  // 处理快捷键
  handleShortcut(event) {
    const key = `${event.altKey ? 'Alt+' : ''}${event.ctrlKey ? 'Ctrl+' : ''}${event.key}`;
    
    switch(key) {
      case 'Alt+h':
      case 'Alt+H':
        this.togglePanel();
        event.preventDefault();
        break;
      case 'Alt+ArrowLeft':
        this.navigateBack();
        event.preventDefault();
        break;
      case 'Alt+ArrowRight':
        this.navigateForward();
        event.preventDefault();
        break;
      case 'Alt+ArrowUp':
        this.navigateToParent();
        event.preventDefault();
        break;
      case 'Alt+v':
      case 'Alt+V':
        this.cycleViewMode();
        event.preventDefault();
        break;
    }
  },
  
  // 切换面板显示
  togglePanel() {
    var win = Services.wm.getMostRecentWindow("navigator:browser");
    if (win) {
      toggleTreePanel(win);
    }
  },
  
  // 循环切换视图模式
  cycleViewMode() {
    const modes = Object.values(ViewMode);
    const currentIndex = modes.indexOf(this.viewMode);
    this.viewMode = modes[(currentIndex + 1) % modes.length];
    this.updateTreeDisplay();
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
      // 1. 检查引用关系
      const fromRelated = fromItem.relatedItems || [];
      const toRelated = toItem.relatedItems || [];
      
      if (fromRelated.includes(toItem.key) || toRelated.includes(fromItem.key)) {
        return RelationType.CITATION;
      }
      
      // 2. 检查作者关系
      const fromCreators = fromItem.getCreators();
      const toCreators = toItem.getCreators();
      
      for (let fc of fromCreators) {
        for (let tc of toCreators) {
          if (fc.lastName === tc.lastName && fc.firstName === tc.firstName) {
            return RelationType.AUTHOR;
          }
        }
      }
      
      // 3. 检查标签关系
      const fromTags = fromItem.getTags().map(t => t.tag);
      const toTags = toItem.getTags().map(t => t.tag);
      
      const commonTags = fromTags.filter(t => toTags.includes(t));
      if (commonTags.length > 0) {
        return RelationType.TAG;
      }
      
      // 4. 检查是否在同一文件夹
      const fromCollections = fromItem.getCollections();
      const toCollections = toItem.getCollections();
      
      const commonCollections = fromCollections.filter(c => toCollections.includes(c));
      if (commonCollections.length > 0) {
        return RelationType.COLLECTION;
      }
      
      // 5. 检查Zotero相关项目
      const relatedItems = fromItem.relatedItems;
      if (relatedItems && relatedItems.includes(toItem.key)) {
        return RelationType.RELATED;
      }
      
      // 6. 时间关系（默认）
      return RelationType.TEMPORAL;
      
    } catch (e) {
      this.debug(`Error analyzing relation: ${e}`);
      return RelationType.MANUAL;
    }
  },
  
  // 添加到树状历史
  async addToTreeHistory(item, relationType = null, fromNode = null) {
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
      await this.db.saveNode(this.currentNode);
      this.updateTreeDisplay();
      return this.currentNode;
    }
    
    // 创建新节点
    let newNode;
    
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
    
    // 同步标签
    const itemTags = item.getTags().map(t => t.tag);
    newNode.tags = itemTags;
    
    // 添加到映射
    this.nodeMap.set(newNode.id, newNode);
    
    if (!this.itemNodeMap.has(item.id)) {
      this.itemNodeMap.set(item.id, []);
    }
    this.itemNodeMap.get(item.id).push(newNode);
    
    // 索引节点
    this.searchEngine.indexNode(newNode);
    
    // 保存到数据库
    await this.db.saveNode(newNode);
    
    // 更新当前节点
    this.currentNode = newNode;
    
    // 添加到导航历史
    this.addToNavigationHistory(newNode);
    
    // 更新显示
    this.updateTreeDisplay();
    
    // 检查推荐
    if (this.showRecommendations) {
      this.updateRecommendations();
    }
    
    return newNode;
  },
  
  // 添加到导航历史
  addToNavigationHistory(node) {
    if (this.navigationIndex < this.navigationHistory.length - 1) {
      this.navigationHistory = this.navigationHistory.slice(0, this.navigationIndex + 1);
    }
    
    this.navigationHistory.push(node);
    this.navigationIndex = this.navigationHistory.length - 1;
    
    // 限制历史长度
    if (this.navigationHistory.length > 100) {
      this.navigationHistory = this.navigationHistory.slice(-100);
      this.navigationIndex = this.navigationHistory.length - 1;
    }
    
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
    this.notifierID = Zotero.Notifier.registerObserver({
      notify: async (event, type, ids, extraData) => {
        this.debug(`Event: ${event}, Type: ${type}, IDs: ${JSON.stringify(ids)}`);
        
        if (type === 'tab') {
          if (event === 'add' && ids.length > 0) {
            const tabID = ids[0];
            this.debug(`New tab opened: ${tabID}`);
            
            if (extraData && extraData[tabID]) {
              const tabData = extraData[tabID];
              const itemID = this.getItemIDFromTab(tabData);
              
              if (itemID && Zotero.Items.exists(itemID)) {
                const item = await Zotero.Items.getAsync(itemID);
                if (item) {
                  const node = await this.addToTreeHistory(item, RelationType.TAB);
                  if (node) {
                    node.tabId = tabID;
                    this.tabNodeMap.set(tabID, node);
                  }
                }
              }
            }
          } else if (event === 'close' && ids.length > 0) {
            const tabID = ids[0];
            this.debug(`Tab closed: ${tabID}`);
            this.tabNodeMap.delete(tabID);
          } else if (event === 'select' && ids.length > 0) {
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
                  const node = await this.addToTreeHistory(item, RelationType.TAB);
                  if (node) {
                    node.tabId = tabID;
                    this.tabNodeMap.set(tabID, node);
                  }
                }
              }
            }
          }
        } else if (type === 'item' && event === 'select') {
          if (ids.length > 0) {
            const item = await Zotero.Items.getAsync(ids[0]);
            if (item && !item.isNote() && !item.isAttachment()) {
              await this.addToTreeHistory(item);
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
              const node = await this.addToTreeHistory(item, RelationType.TAB);
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
    
    // 应用过滤
    let filteredRoots = this.treeRoots;
    
    if (this.searchQuery) {
      const searchResults = this.searchEngine.search(this.searchQuery, Array.from(this.nodeMap.values()));
      const searchIds = new Set(searchResults.map(n => n.id));
      filteredRoots = this.treeRoots.filter(root => this.isNodeInSearch(root, searchIds));
    }
    
    if (this.filterRelationType) {
      filteredRoots = filteredRoots.filter(root => this.hasRelationType(root, this.filterRelationType));
    }
    
    if (this.filterImportance > 0) {
      filteredRoots = filteredRoots.filter(root => this.hasImportance(root, this.filterImportance));
    }
    
    // 按会话分组
    filteredRoots.forEach(root => {
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
  
  // 检查节点是否在搜索结果中
  isNodeInSearch(node, searchIds) {
    if (searchIds.has(node.id)) return true;
    return node.children.some(child => this.isNodeInSearch(child, searchIds));
  },
  
  // 检查节点是否包含特定关系类型
  hasRelationType(node, relationType) {
    if (node.relationType === relationType) return true;
    return node.children.some(child => this.hasRelationType(child, relationType));
  },
  
  // 检查节点是否满足重要性要求
  hasImportance(node, minImportance) {
    if (node.importance >= minImportance) return true;
    return node.children.some(child => this.hasImportance(child, minImportance));
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
    
    // 更新不同视图
    switch (this.viewMode) {
      case ViewMode.TREE:
        this.updateTreeView(doc);
        break;
      case ViewMode.LIST:
        this.updateListView(doc);
        break;
      case ViewMode.GRAPH:
        this.updateGraphView(doc);
        break;
      case ViewMode.TIMELINE:
        this.updateTimelineView(doc);
        break;
    }
    
    // 显示对应的视图
    const views = ['tree', 'list', 'graph', 'timeline'];
    views.forEach(viewName => {
      const viewEl = doc.getElementById(`research-navigator-${viewName}-view`);
      if (viewEl) {
        viewEl.style.display = viewName === this.viewMode ? 'flex' : 'none';
      }
    });
    
    // 更新推荐面板
    if (this.showRecommendations) {
      const recommendPanel = doc.getElementById('research-navigator-recommend-panel');
      if (recommendPanel) {
        recommendPanel.style.display = 'block';
      }
    } else {
      const recommendPanel = doc.getElementById('research-navigator-recommend-panel');
      if (recommendPanel) {
        recommendPanel.style.display = 'none';
      }
    }
    
    // 更新统计信息
    const statsLabel = doc.getElementById('research-navigator-stats');
    if (statsLabel) {
      const totalNodes = this.nodeMap.size;
      const sessions = this.getTreeData().length;
      const filtered = this.searchQuery || this.filterRelationType || this.filterImportance > 0;
      statsLabel.setAttribute('value', 
        `${totalNodes} items • ${sessions} sessions${filtered ? ' (filtered)' : ''}`
      );
    }
  },
  
  // 更新树形视图
  updateTreeView(doc) {
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
      emptyMsg.style.cssText = 'padding: 30px 20px; align-items: center;';
      
      const icon = doc.createXULElement('label');
      icon.setAttribute('value', '🌱');
      icon.style.cssText = 'font-size: 42px; margin-bottom: 8px;';
      
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
  },
  
  // 更新列表视图
  updateListView(doc) {
    const listContainer = doc.getElementById('research-navigator-list-container');
    if (!listContainer) return;
    
    while (listContainer.firstChild) {
      listContainer.removeChild(listContainer.firstChild);
    }
    
    // 获取所有节点并排序
    let nodes = Array.from(this.nodeMap.values());
    
    // 应用搜索过滤
    if (this.searchQuery) {
      nodes = this.searchEngine.search(this.searchQuery, nodes);
    }
    
    // 按时间排序
    nodes.sort((a, b) => b.timestamp - a.timestamp);
    
    // 渲染列表项
    nodes.forEach(node => {
      const item = this.createListItem(doc, node);
      listContainer.appendChild(item);
    });
  },
  
  // 更新图表视图
  updateGraphView(doc) {
    const iframe = doc.getElementById('research-navigator-graph-iframe');
    if (!iframe || !iframe.contentWindow) return;
    
    // 准备数据
    const nodes = [];
    const edges = [];
    
    this.nodeMap.forEach(node => {
      nodes.push({
        id: node.id,
        label: node.title.substr(0, 30) + (node.title.length > 30 ? '...' : ''),
        color: this.getRelationColor(node.relationType),
        size: Math.min(node.visitCount * 10, 50)
      });
      
      if (node.parentId && this.nodeMap.has(node.parentId)) {
        edges.push({
          source: node.parentId,
          target: node.id,
          color: this.getRelationColor(node.relationType)
        });
      }
    });
    
    // 发送数据到iframe
    iframe.contentWindow.postMessage({
      type: 'updateGraph',
      nodes: nodes,
      edges: edges
    }, '*');
  },
  
  // 更新时间线视图
  updateTimelineView(doc) {
    const timelineContainer = doc.getElementById('research-navigator-timeline-container');
    if (!timelineContainer) return;
    
    while (timelineContainer.firstChild) {
      timelineContainer.removeChild(timelineContainer.firstChild);
    }
    
    // 按日期分组
    const dateGroups = new Map();
    
    this.nodeMap.forEach(node => {
      const dateKey = new Date(node.timestamp).toDateString();
      if (!dateGroups.has(dateKey)) {
        dateGroups.set(dateKey, []);
      }
      dateGroups.get(dateKey).push(node);
    });
    
    // 排序日期
    const sortedDates = Array.from(dateGroups.keys()).sort((a, b) => 
      new Date(a) - new Date(b)
    );
    
    // 渲染时间线
    sortedDates.forEach(date => {
      const dateEl = this.createTimelineDateSection(doc, date, dateGroups.get(date));
      timelineContainer.appendChild(dateEl);
    });
  },
  
  // 更新推荐面板
  updateRecommendationPanel(win, recommendations) {
    const doc = win.document;
    const list = doc.getElementById('research-navigator-recommend-list');
    if (!list) return;
    
    while (list.firstChild) {
      list.removeChild(list.firstChild);
    }
    
    recommendations.forEach(rec => {
      const item = doc.createXULElement('hbox');
      item.style.cssText = 'padding: 5px; cursor: pointer; border-radius: 3px;';
      
      item.addEventListener('mouseenter', () => {
        item.style.background = '#e3f2fd';
      });
      
      item.addEventListener('mouseleave', () => {
        item.style.background = '';
      });
      
      item.addEventListener('click', () => {
        this.openItemFromNode(rec.node);
      });
      
      const title = doc.createXULElement('label');
      title.setAttribute('value', rec.node.title.substr(0, 50) + '...');
      title.setAttribute('flex', '1');
      
      const reason = doc.createXULElement('label');
      reason.setAttribute('value', rec.reason);
      reason.style.cssText = 'color: #666; font-size: 0.85em;';
      
      item.appendChild(title);
      item.appendChild(reason);
      list.appendChild(item);
    });
  },
  
  // 创建会话元素（美观版）
  createSessionElement(doc, session, isExpanded) {
    const sessionEl = doc.createXULElement('vbox');
    sessionEl.style.cssText = 'margin-bottom: 6px;';
    
    // 会话标题
    const headerEl = doc.createXULElement('hbox');
    headerEl.style.cssText = `
      cursor: pointer; 
      padding: ${this.compactMode ? '4px 6px' : '5px 8px'}; 
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
    toggleEl.style.cssText = `width: 14px; color: #666; font-size: ${this.compactMode ? '0.7em' : '0.8em'}; margin-right: 4px;`;
    
    const iconEl = doc.createXULElement('label');
    iconEl.setAttribute('value', '📅');
    iconEl.style.cssText = `margin-right: 6px; font-size: ${this.compactMode ? '12px' : '14px'};`;
    
    const titleEl = doc.createXULElement('label');
    const sessionDate = new Date(session.timestamp);
    const today = new Date();
    const isToday = sessionDate.toDateString() === today.toDateString();
    const dateStr = isToday ? 'Today' : sessionDate.toLocaleDateString();
    const timeStr = sessionDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    titleEl.setAttribute('value', `${dateStr} • ${timeStr}`);
    titleEl.setAttribute('flex', '1');
    titleEl.style.cssText = `font-weight: 500; color: #333; font-size: ${this.compactMode ? '0.85em' : '1em'};`;
    
    const countEl = doc.createXULElement('label');
    countEl.setAttribute('value', `${session.roots.length} paths`);
    countEl.style.cssText = `color: #999; font-size: ${this.compactMode ? '0.75em' : '0.85em'}; margin-left: 8px;`;
    
    headerEl.appendChild(toggleEl);
    if (!this.compactMode) headerEl.appendChild(iconEl);
    headerEl.appendChild(titleEl);
    headerEl.appendChild(countEl);
    
    // 树容器
    const treeEl = doc.createXULElement('vbox');
    treeEl.style.cssText = isExpanded ? 
      `margin-top: 3px; padding-left: ${this.compactMode ? '12px' : '18px'};` : 
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
    if (level > 0 && !this.compactMode) {
      const connector = doc.createXULElement('box');
      connector.style.cssText = `
        position: absolute;
        left: ${(level - 1) * 16 + 8}px;
        top: 0;
        bottom: 0;
        width: 16px;
        border-left: 1px solid #e0e0e0;
        border-bottom: 1px solid #e0e0e0;
        height: 10px;
      `;
      nodeEl.appendChild(connector);
    }
    
    // 节点内容
    const contentEl = doc.createXULElement('hbox');
    contentEl.style.cssText = `
      cursor: pointer; 
      padding: ${this.compactMode ? '2px 4px' : '3px 6px'}; 
      margin-left: ${level * (this.compactMode ? 12 : 16)}px;
      align-items: center;
      border-radius: 4px;
      transition: all 0.15s ease;
      position: relative;
      min-height: ${this.compactMode ? '18px' : '22px'};
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
      contentEl.style.paddingLeft = '3px';
    }
    
    // 展开/折叠（仅有子节点时显示）
    if (node.children.length > 0) {
      const toggleEl = doc.createXULElement('label');
      toggleEl.setAttribute('value', node.expanded ? '−' : '+');
      toggleEl.style.cssText = `
        width: ${this.compactMode ? '12px' : '16px'}; 
        height: ${this.compactMode ? '12px' : '16px'}; 
        cursor: pointer; 
        color: #666; 
        font-size: ${this.compactMode ? '10px' : '12px'}; 
        text-align: center;
        border: 1px solid #ddd;
        border-radius: 3px;
        margin-right: ${this.compactMode ? '4px' : '6px'};
        background: white;
        line-height: ${this.compactMode ? '10px' : '14px'};
      `;
      toggleEl.addEventListener('click', (e) => {
        e.stopPropagation();
        node.expanded = !node.expanded;
        this.updateTreeDisplay();
      });
      contentEl.appendChild(toggleEl);
    } else {
      const spacerEl = doc.createXULElement('box');
      spacerEl.style.cssText = `width: ${this.compactMode ? '16px' : '22px'};`;
      contentEl.appendChild(spacerEl);
    }
    
    // 关系指示（彩色小圆点）
    if (node.parentId && level > 0 && !this.compactMode) {
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
    
    // 重要性标记
    if (node.importance > 0) {
      const stars = '★'.repeat(Math.min(node.importance, 5));
      const importanceEl = doc.createXULElement('label');
      importanceEl.setAttribute('value', stars);
      importanceEl.style.cssText = `color: #ffc107; margin-right: 4px; font-size: ${this.compactMode ? '10px' : '12px'};`;
      contentEl.appendChild(importanceEl);
    }
    
    // 文献类型图标
    if (!this.compactMode) {
      const iconEl = doc.createXULElement('label');
      const icon = this.getItemTypeIcon(node.itemType);
      iconEl.setAttribute('value', icon);
      iconEl.style.cssText = 'width: 20px; font-size: 14px; margin-right: 6px; opacity: 0.8;';
      contentEl.appendChild(iconEl);
    }
    
    // 标题和年份
    const textBox = doc.createXULElement('vbox');
    textBox.setAttribute('flex', '1');
    textBox.style.cssText = 'min-width: 0;';
    
    const titleEl = doc.createXULElement('label');
    const displayTitle = node.title || 'Loading...';
    const maxLength = this.compactMode ? 40 : 50;
    const truncatedTitle = displayTitle.length > maxLength ? 
      displayTitle.substr(0, maxLength) + '…' : displayTitle;
    titleEl.setAttribute('value', truncatedTitle);
    titleEl.setAttribute('tooltiptext', `${node.title}\n${node.creators}\n${node.year}${node.notes ? '\n\nNotes: ' + node.notes : ''}`);
    titleEl.style.cssText = `font-size: ${this.compactMode ? '0.8em' : '0.9em'}; color: #333; font-weight: 400;`;
    
    // 作者和年份（次要信息）
    if (!this.compactMode) {
      const metaEl = doc.createXULElement('label');
      const firstAuthor = node.creators.split(',')[0]?.trim() || '';
      const shortAuthor = firstAuthor.length > 20 ? firstAuthor.substr(0, 20) + '…' : firstAuthor;
      const metaText = node.year ? `${shortAuthor} • ${node.year}` : shortAuthor;
      metaEl.setAttribute('value', metaText);
      metaEl.style.cssText = 'font-size: 0.8em; color: #999; margin-top: 1px;';
      textBox.appendChild(metaEl);
    }
    
    textBox.appendChild(titleEl);
    contentEl.appendChild(textBox);
    
    // 访问次数（徽章样式）
    if (node.visitCount > 1) {
      const countEl = doc.createXULElement('label');
      countEl.setAttribute('value', node.visitCount);
      countEl.style.cssText = `
        background: #e3f2fd;
        color: #1976d2;
        padding: ${this.compactMode ? '0 4px' : '1px 6px'};
        border-radius: 10px;
        font-size: ${this.compactMode ? '0.7em' : '0.75em'};
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
    
    // 右键菜单
    contentEl.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.showNodeContextMenu(doc, node, e);
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
  
  // 创建列表项
  createListItem(doc, node) {
    const item = doc.createXULElement('hbox');
    item.style.cssText = 'padding: 8px; border-bottom: 1px solid #eee; cursor: pointer;';
    
    item.addEventListener('mouseenter', () => {
      item.style.background = '#f5f5f5';
    });
    
    item.addEventListener('mouseleave', () => {
      item.style.background = '';
    });
    
    // 图标
    const icon = doc.createXULElement('label');
    icon.setAttribute('value', this.getItemTypeIcon(node.itemType));
    icon.style.cssText = 'width: 30px; font-size: 20px; margin-right: 10px;';
    
    // 信息
    const info = doc.createXULElement('vbox');
    info.setAttribute('flex', '1');
    
    const title = doc.createXULElement('label');
    title.setAttribute('value', node.title);
    title.style.cssText = 'font-weight: 500;';
    
    const meta = doc.createXULElement('label');
    meta.setAttribute('value', `${node.creators} • ${node.year}`);
    meta.style.cssText = 'color: #666; font-size: 0.9em;';
    
    const time = doc.createXULElement('label');
    time.setAttribute('value', new Date(node.timestamp).toLocaleString());
    time.style.cssText = 'color: #999; font-size: 0.85em;';
    
    info.appendChild(title);
    info.appendChild(meta);
    info.appendChild(time);
    
    // 关系类型
    const relation = doc.createXULElement('label');
    relation.setAttribute('value', this.getRelationLabel(node.relationType));
    relation.style.cssText = `color: ${this.getRelationColor(node.relationType)}; margin-left: 10px;`;
    
    item.appendChild(icon);
    item.appendChild(info);
    item.appendChild(relation);
    
    item.addEventListener('click', () => {
      this.currentNode = node;
      this.openItemFromNode(node);
      this.addToNavigationHistory(node);
    });
    
    return item;
  },
  
  // 创建时间线日期段
  createTimelineDateSection(doc, date, nodes) {
    const section = doc.createXULElement('vbox');
    section.style.cssText = 'margin-right: 30px;';
    
    // 日期标题
    const dateLabel = doc.createXULElement('label');
    dateLabel.setAttribute('value', date);
    dateLabel.style.cssText = 'font-weight: bold; margin-bottom: 10px;';
    
    // 时间线
    const timeline = doc.createXULElement('vbox');
    timeline.style.cssText = 'border-left: 2px solid #4CAF50; padding-left: 20px;';
    
    // 按时间排序
    nodes.sort((a, b) => a.timestamp - b.timestamp);
    
    nodes.forEach(node => {
      const item = doc.createXULElement('hbox');
      item.style.cssText = 'margin-bottom: 15px; position: relative; cursor: pointer;';
      
      // 时间点
      const dot = doc.createXULElement('box');
      dot.style.cssText = `
        position: absolute;
        left: -26px;
        top: 5px;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: ${this.getRelationColor(node.relationType)};
        border: 2px solid white;
      `;
      
      // 时间
      const time = doc.createXULElement('label');
      time.setAttribute('value', new Date(node.timestamp).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      }));
      time.style.cssText = 'width: 50px; color: #666; font-size: 0.9em;';
      
      // 标题
      const title = doc.createXULElement('label');
      title.setAttribute('value', node.title.substr(0, 50) + (node.title.length > 50 ? '...' : ''));
      title.setAttribute('flex', '1');
      
      item.appendChild(dot);
      item.appendChild(time);
      item.appendChild(title);
      
      item.addEventListener('click', () => {
        this.currentNode = node;
        this.openItemFromNode(node);
        this.addToNavigationHistory(node);
      });
      
      timeline.appendChild(item);
    });
    
    section.appendChild(dateLabel);
    section.appendChild(timeline);
    
    return section;
  },
  
  // 显示节点右键菜单
  showNodeContextMenu(doc, node, event) {
    const popup = doc.createXULElement('menupopup');
    
    // 添加注释
    const noteItem = doc.createXULElement('menuitem');
    noteItem.setAttribute('label', 'Add Note...');
    noteItem.addEventListener('command', async () => {
      const note = prompt('Add note for this item:', node.notes || '');
      if (note !== null) {
        await this.addNodeNote(node, note);
      }
    });
    popup.appendChild(noteItem);
    
    // 设置重要性
    const importanceMenu = doc.createXULElement('menu');
    importanceMenu.setAttribute('label', 'Set Importance');
    const importancePopup = doc.createXULElement('menupopup');
    
    for (let i = 0; i <= 5; i++) {
      const item = doc.createXULElement('menuitem');
      item.setAttribute('label', i === 0 ? 'None' : '★'.repeat(i));
      item.addEventListener('command', async () => {
        await this.updateNodeImportance(node, i);
      });
      importancePopup.appendChild(item);
    }
    
    importanceMenu.appendChild(importancePopup);
    popup.appendChild(importanceMenu);
    
    // 分隔符
    popup.appendChild(doc.createXULElement('menuseparator'));
    
    // 在库中显示
    const showItem = doc.createXULElement('menuitem');
    showItem.setAttribute('label', 'Show in Library');
    showItem.addEventListener('command', () => {
      var win = Services.wm.getMostRecentWindow("navigator:browser");
      if (win && win.ZoteroPane) {
        win.ZoteroPane.selectItem(node.itemId);
      }
    });
    popup.appendChild(showItem);
    
    // 显示菜单
    popup.openPopupAtScreen(event.screenX, event.screenY, true);
    doc.documentElement.appendChild(popup);
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
  
  // 更新推荐
  updateRecommendations() {
    if (!this.currentNode) return;
    
    const allNodes = Array.from(this.nodeMap.values());
    const recommendations = this.recommendationEngine.getRecommendations(this.currentNode, allNodes);
    
    // 更新推荐显示
    for (let [win, panel] of this.historyPanels) {
      this.updateRecommendationPanel(win, recommendations);
    }
  },
  
  // 导出历史
  async exportHistory() {
    const data = await this.db.exportData();
    const file = await this.showSaveDialog('Export Research History', 'research-history.json');
    
    if (file) {
      await Zotero.File.putContentsAsync(file, data);
      this.showNotification('History exported successfully');
    }
  },
  
  // 导入历史
  async importHistory() {
    const file = await this.showOpenDialog('Import Research History', ['json']);
    
    if (file) {
      const data = await Zotero.File.getContentsAsync(file);
      const success = await this.db.importData(data);
      
      if (success) {
        await this.loadHistoryFromDB();
        this.updateTreeDisplay();
        this.showNotification('History imported successfully');
      } else {
        this.showNotification('Failed to import history', 'error');
      }
    }
  },
  
  // 显示保存对话框
  async showSaveDialog(title, defaultName) {
    const nsIFilePicker = Components.interfaces.nsIFilePicker;
    const fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
    
    fp.init(window, title, nsIFilePicker.modeSave);
    fp.defaultString = defaultName;
    fp.appendFilter("JSON Files", "*.json");
    
    const result = await new Promise(resolve => {
      fp.open(returnConstant => {
        resolve(returnConstant === nsIFilePicker.returnOK ? fp.file : null);
      });
    });
    
    return result;
  },
  
  // 显示打开对话框
  async showOpenDialog(title, extensions) {
    const nsIFilePicker = Components.interfaces.nsIFilePicker;
    const fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
    
    fp.init(window, title, nsIFilePicker.modeOpen);
    extensions.forEach(ext => {
      fp.appendFilter(`${ext.toUpperCase()} Files`, `*.${ext}`);
    });
    
    const result = await new Promise(resolve => {
      fp.open(returnConstant => {
        resolve(returnConstant === nsIFilePicker.returnOK ? fp.file : null);
      });
    });
    
    return result;
  },
  
  // 显示通知
  showNotification(message, type = 'info') {
    var win = Services.wm.getMostRecentWindow("navigator:browser");
    if (win) {
      showNotification(win, message, type);
    }
  },
  
  // 清除所有历史
  async clearAllHistory() {
    if (confirm('Are you sure you want to clear all history? This cannot be undone.')) {
      await this.db.clearAll();
      this.treeRoots = [];
      this.nodeMap.clear();
      this.itemNodeMap.clear();
      this.tabNodeMap.clear();
      this.navigationHistory = [];
      this.navigationIndex = -1;
      this.currentNode = null;
      this.searchEngine.clear();
      this.updateTreeDisplay();
      this.updateNavigationButtons();
      this.showNotification('History cleared');
    }
  },
  
  // 更新节点重要性
  async updateNodeImportance(node, importance) {
    node.importance = importance;
    await this.db.saveNode(node);
    this.updateTreeDisplay();
  },
  
  // 添加节点注释
  async addNodeNote(node, note) {
    node.notes = note;
    await this.db.saveNode(node);
    this.updateTreeDisplay();
  },
  
  // 获取统计信息
  getStatistics() {
    const stats = {
      totalNodes: this.nodeMap.size,
      totalSessions: new Set(Array.from(this.nodeMap.values()).map(n => n.sessionId)).size,
      relationTypes: {},
      topAuthors: new Map(),
      topTags: new Map(),
      dailyActivity: new Map()
    };
    
    // 统计关系类型
    Object.values(RelationType).forEach(type => {
      stats.relationTypes[type] = 0;
    });
    
    Array.from(this.nodeMap.values()).forEach(node => {
      // 关系类型
      stats.relationTypes[node.relationType]++;
      
      // 作者统计
      const authors = node.creators.split(',').map(a => a.trim()).filter(a => a);
      authors.forEach(author => {
        stats.topAuthors.set(author, (stats.topAuthors.get(author) || 0) + 1);
      });
      
      // 标签统计
      node.tags.forEach(tag => {
        stats.topTags.set(tag, (stats.topTags.get(tag) || 0) + 1);
      });
      
      // 日活动统计
      const dateKey = new Date(node.timestamp).toDateString();
      stats.dailyActivity.set(dateKey, (stats.dailyActivity.get(dateKey) || 0) + 1);
    });
    
    // 排序并限制数量
    stats.topAuthors = new Map(
      Array.from(stats.topAuthors.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
    );
    
    stats.topTags = new Map(
      Array.from(stats.topTags.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
    );
    
    return stats;
  }
};

// 继续在startup函数之前添加必要的函数定义

function install(data, reason) {}

async function startup({ id, version, resourceURI, rootURI }, reason) {
  await waitForZotero();
  
  if (!rootURI) {
    rootURI = resourceURI.spec;
  }

  ResearchNavigator.id = id;
  ResearchNavigator.version = version;
  ResearchNavigator.rootURI = rootURI;
  
  // 初始化
  await ResearchNavigator.init();
  
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
  
  // 添加键盘事件监听
  doc.addEventListener('keydown', ResearchNavigator.handleShortcut.bind(ResearchNavigator));
  
  // 1. 添加导航工具栏
  addNavigationToolbar(window);
  
  // 2. 添加浮动测试按钮（右下角）
  if (!doc.getElementById("research-navigator-float-button")) {
    const floatBtn = doc.createElement("button");
    floatBtn.id = "research-navigator-float-button";
    floatBtn.textContent = "🌳";
    floatBtn.title = "Research Navigator (Alt+H)";
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
    menuitem.setAttribute("label", "Research Navigator");
    menuitem.setAttribute("accesskey", "R");
    menuitem.addEventListener("command", function() {
      toggleTreePanel(window);
    });
    toolsMenu.appendChild(menuitem);
    ResearchNavigator.addedElementIds.push("research-navigator-tools-menu");
    
    // 导出菜单项
    const exportMenuItem = doc.createXULElement("menuitem");
    exportMenuItem.id = "research-navigator-export-menu";
    exportMenuItem.setAttribute("label", "Export Research History...");
    exportMenuItem.addEventListener("command", function() {
      ResearchNavigator.exportHistory();
    });
    toolsMenu.appendChild(exportMenuItem);
    ResearchNavigator.addedElementIds.push("research-navigator-export-menu");
    
    // 导入菜单项
    const importMenuItem = doc.createXULElement("menuitem");
    importMenuItem.id = "research-navigator-import-menu";
    importMenuItem.setAttribute("label", "Import Research History...");
    importMenuItem.addEventListener("command", function() {
      ResearchNavigator.importHistory();
    });
    toolsMenu.appendChild(importMenuItem);
    ResearchNavigator.addedElementIds.push("research-navigator-import-menu");
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
    addMenuItem.addEventListener("command", async function() {
      const items = window.ZoteroPane.getSelectedItems();
      if (items.length > 0) {
        await ResearchNavigator.addToTreeHistory(items[0], RelationType.MANUAL);
        showNotification(window, `Added to research path: ${items[0].getField('title')}`);
      }
    });
    itemMenu.appendChild(addMenuItem);
    ResearchNavigator.addedElementIds.push("research-navigator-item-menu");
    
    // 作为新路径开始
    const newPathMenuItem = doc.createXULElement("menuitem");
    newPathMenuItem.id = "research-navigator-new-path-menu";
    newPathMenuItem.setAttribute("label", "Start New Research Path Here");
    newPathMenuItem.addEventListener("command", async function() {
      const items = window.ZoteroPane.getSelectedItems();
      if (items.length > 0) {
        ResearchNavigator.currentNode = null;
        await ResearchNavigator.addToTreeHistory(items[0], RelationType.MANUAL);
        showNotification(window, `Started new research path from: ${items[0].getField('title')}`);
      }
    });
    itemMenu.appendChild(newPathMenuItem);
    ResearchNavigator.addedElementIds.push("research-navigator-new-path-menu");
    
    // 标记为重要
    const markImportantMenuItem = doc.createXULElement("menuitem");
    markImportantMenuItem.id = "research-navigator-important-menu";
    markImportantMenuItem.setAttribute("label", "Mark as Important in History");
    markImportantMenuItem.addEventListener("command", async function() {
      const items = window.ZoteroPane.getSelectedItems();
      if (items.length > 0) {
        const nodes = ResearchNavigator.itemNodeMap.get(items[0].id) || [];
        if (nodes.length > 0) {
          const node = nodes[nodes.length - 1]; // 最近的节点
          await ResearchNavigator.updateNodeImportance(node, 5);
          showNotification(window, 'Marked as important');
        }
      }
    });
    itemMenu.appendChild(markImportantMenuItem);
    ResearchNavigator.addedElementIds.push("research-navigator-important-menu");
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
    backBtn.setAttribute('tooltiptext', 'Navigate Back (Alt+←)');
    backBtn.setAttribute('label', '←');
    backBtn.addEventListener('command', () => {
      ResearchNavigator.navigateBack();
    });
    
    // 前进按钮
    const forwardBtn = doc.createXULElement('toolbarbutton');
    forwardBtn.id = 'research-navigator-forward';
    forwardBtn.className = 'zotero-tb-button';
    forwardBtn.setAttribute('tooltiptext', 'Navigate Forward (Alt+→)');
    forwardBtn.setAttribute('label', '→');
    forwardBtn.addEventListener('command', () => {
      ResearchNavigator.navigateForward();
    });
    
    // 父节点按钮
    const parentBtn = doc.createXULElement('toolbarbutton');
    parentBtn.id = 'research-navigator-parent';
    parentBtn.className = 'zotero-tb-button';
    parentBtn.setAttribute('tooltiptext', 'Go to Parent Item (Alt+↑)');
    parentBtn.setAttribute('label', '↑');
    parentBtn.addEventListener('command', () => {
      ResearchNavigator.navigateToParent();
    });
    
    // 树形视图按钮
    const treeBtn = doc.createXULElement('toolbarbutton');
    treeBtn.id = 'research-navigator-tree-button';
    treeBtn.className = 'zotero-tb-button';
    treeBtn.setAttribute('tooltiptext', 'Toggle History Panel (Alt+H)');
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

// 创建树形历史面板（全功能版）
function createTreePanel(window) {
  const doc = window.document;
  
  if (doc.getElementById('research-navigator-panel')) {
    return;
  }
  
  // 外层容器
  const panelWrapper = doc.createXULElement('vbox');
  panelWrapper.id = 'research-navigator-panel';
  panelWrapper.setAttribute('flex', '0');
  panelWrapper.style.cssText = `
    position: fixed;
    right: ${ResearchNavigator.panelRight}px;
    top: ${ResearchNavigator.panelTop}px;
    width: ${ResearchNavigator.panelWidth}px;
    height: ${ResearchNavigator.panelHeight}px;
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04);
    z-index: 1000;
    display: none;
    min-width: 320px;
    max-width: 800px;
    overflow: hidden;
  `;
  
  // 标题栏
  const header = doc.createXULElement('hbox');
  header.setAttribute('flex', '0');
  header.style.cssText = `
    background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
    color: white;
    padding: 10px 14px;
    align-items: center;
    border-radius: 8px 8px 0 0;
    cursor: move;
    min-height: 40px;
    max-height: 40px;
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
  
  // 视图切换按钮
  const viewToggle = doc.createXULElement('button');
  viewToggle.id = 'research-navigator-view-toggle';
  viewToggle.setAttribute('label', getViewIcon(ResearchNavigator.viewMode));
  viewToggle.setAttribute('tooltiptext', 'Switch View (Alt+V)');
  viewToggle.style.cssText = `
    color: white;
    min-width: 30px;
    margin: 0 4px;
    padding: 2px 6px;
    background: rgba(255,255,255,0.15);
    border-radius: 4px;
    font-size: 16px;
    cursor: pointer;
  `;
  viewToggle.addEventListener('command', () => {
    ResearchNavigator.cycleViewMode();
    viewToggle.setAttribute('label', getViewIcon(ResearchNavigator.viewMode));
  });
  
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
    panelWrapper.style.height = '40px';
    panelWrapper.style.overflow = 'hidden';
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
  header.appendChild(viewToggle);
  header.appendChild(minimizeBtn);
  header.appendChild(closeBtn);
  
  // 搜索栏
  const searchBar = doc.createXULElement('hbox');
  searchBar.setAttribute('flex', '0');
  searchBar.style.cssText = `
    padding: 8px 10px;
    border-bottom: 1px solid #f0f0f0;
    background: #fafbfc;
    align-items: center;
  `;
  
  const searchIcon = doc.createXULElement('label');
  searchIcon.setAttribute('value', '🔍');
  searchIcon.style.cssText = 'margin-right: 6px;';
  
  const searchBox = doc.createXULElement('textbox');
  searchBox.id = 'research-navigator-search';
  searchBox.setAttribute('placeholder', 'Search history...');
  searchBox.setAttribute('flex', '1');
  searchBox.style.cssText = 'margin-right: 8px;';
  searchBox.addEventListener('input', (e) => {
    ResearchNavigator.searchQuery = e.target.value;
    ResearchNavigator.updateTreeDisplay();
  });
  
  // 过滤器按钮
  const filterBtn = doc.createXULElement('button');
  filterBtn.setAttribute('label', '⚙️');
  filterBtn.setAttribute('tooltiptext', 'Filters');
  filterBtn.style.cssText = 'min-width: 30px;';
  filterBtn.addEventListener('command', () => {
    toggleFilterPanel(doc);
  });
  
  searchBar.appendChild(searchIcon);
  searchBar.appendChild(searchBox);
  searchBar.appendChild(filterBtn);
  
  // 工具栏
  const toolbar = doc.createXULElement('hbox');
  toolbar.setAttribute('flex', '0');
  toolbar.style.cssText = `
    padding: 6px 10px;
    border-bottom: 1px solid #f0f0f0;
    background: #fafbfc;
    align-items: center;
    min-height: 32px;
    max-height: 32px;
  `;
  
  const statsLabel = doc.createXULElement('label');
  statsLabel.id = 'research-navigator-stats';
  statsLabel.setAttribute('value', 'Loading...');
  statsLabel.style.cssText = 'flex: 1; color: #666; font-size: 0.85em;';
  
  // 推荐按钮
  const recommendBtn = doc.createXULElement('button');
  recommendBtn.setAttribute('label', '💡');
  recommendBtn.setAttribute('tooltiptext', 'Toggle Recommendations');
  recommendBtn.style.cssText = `
    margin: 0 4px;
    padding: 2px 8px;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    background: ${ResearchNavigator.showRecommendations ? '#e3f2fd' : 'white'};
    cursor: pointer;
  `;
  recommendBtn.addEventListener('command', () => {
    ResearchNavigator.showRecommendations = !ResearchNavigator.showRecommendations;
    recommendBtn.style.background = ResearchNavigator.showRecommendations ? '#e3f2fd' : 'white';
    ResearchNavigator.updateTreeDisplay();
    if (ResearchNavigator.showRecommendations) {
      ResearchNavigator.updateRecommendations();
    }
  });
  
  // 统计按钮
  const statsBtn = doc.createXULElement('button');
  statsBtn.setAttribute('label', '📊');
  statsBtn.setAttribute('tooltiptext', 'Show Statistics');
  statsBtn.style.cssText = `
    margin: 0 4px;
    padding: 2px 8px;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    background: white;
    cursor: pointer;
  `;
  statsBtn.addEventListener('command', () => {
    showStatisticsPanel(window);
  });
  
  // 紧凑模式按钮
  const compactBtn = doc.createXULElement('button');
  compactBtn.setAttribute('label', '📐');
  compactBtn.setAttribute('tooltiptext', 'Toggle Compact Mode');
  compactBtn.style.cssText = `
    margin: 0 4px;
    padding: 2px 8px;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    background: ${ResearchNavigator.compactMode ? '#e3f2fd' : 'white'};
    cursor: pointer;
  `;
  compactBtn.addEventListener('command', () => {
    ResearchNavigator.compactMode = !ResearchNavigator.compactMode;
    compactBtn.style.background = ResearchNavigator.compactMode ? '#e3f2fd' : 'white';
    ResearchNavigator.updateTreeDisplay();
  });
  
  const clearBtn = doc.createXULElement('button');
  clearBtn.setAttribute('label', 'Clear');
  clearBtn.style.cssText = `
    margin: 0;
    padding: 2px 12px;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    background: white;
    color: #666;
    cursor: pointer;
  `;
  clearBtn.addEventListener('command', () => {
    ResearchNavigator.clearAllHistory();
  });
  
  toolbar.appendChild(statsLabel);
  toolbar.appendChild(recommendBtn);
  toolbar.appendChild(statsBtn);
  toolbar.appendChild(compactBtn);
  toolbar.appendChild(clearBtn);
  
  // 过滤器面板（初始隐藏）
  const filterPanel = createFilterPanel(doc);
  filterPanel.style.display = 'none';
  
  // 推荐面板（初始隐藏）
  const recommendPanel = createRecommendationPanel(doc);
  recommendPanel.style.display = 'none';
  
  // 内容区域
  const contentWrapper = doc.createXULElement('vbox');
  contentWrapper.setAttribute('flex', '1');
  contentWrapper.style.cssText = 'overflow: hidden; min-height: 0; position: relative;';
  
  // 不同视图的容器
  const treeView = createTreeView(doc);
  const listView = createListView(doc);
  const graphView = createGraphView(doc);
  const timelineView = createTimelineView(doc);
  
  // 根据当前视图模式显示对应视图
  treeView.style.display = ResearchNavigator.viewMode === ViewMode.TREE ? 'flex' : 'none';
  listView.style.display = ResearchNavigator.viewMode === ViewMode.LIST ? 'flex' : 'none';
  graphView.style.display = ResearchNavigator.viewMode === ViewMode.GRAPH ? 'flex' : 'none';
  timelineView.style.display = ResearchNavigator.viewMode === ViewMode.TIMELINE ? 'flex' : 'none';
  
  contentWrapper.appendChild(recommendPanel);
  contentWrapper.appendChild(treeView);
  contentWrapper.appendChild(listView);
  contentWrapper.appendChild(graphView);
  contentWrapper.appendChild(timelineView);
  
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
      
      if (newWidth >= 320 && newWidth <= 800) {
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
  panelWrapper.appendChild(searchBar);
  panelWrapper.appendChild(toolbar);
  panelWrapper.appendChild(filterPanel);
  panelWrapper.appendChild(contentWrapper);
  panelWrapper.appendChild(resizeHandle);
  
  // 添加到文档
  const mainWindow = doc.getElementById('main-window') || doc.documentElement;
  mainWindow.appendChild(panelWrapper);
  
  ResearchNavigator.addedElementIds.push('research-navigator-panel');
  ResearchNavigator.historyPanels.set(window, panelWrapper);
  
  // 初始更新
  ResearchNavigator.updateTreePanel(window, panelWrapper);
}

// 获取视图图标
function getViewIcon(viewMode) {
  const icons = {
    [ViewMode.TREE]: '🌳',
    [ViewMode.LIST]: '📋',
    [ViewMode.GRAPH]: '🕸️',
    [ViewMode.TIMELINE]: '📅'
  };
  return icons[viewMode] || '🌳';
}

// 创建过滤器面板
function createFilterPanel(doc) {
  const panel = doc.createXULElement('vbox');
  panel.id = 'research-navigator-filter-panel';
  panel.style.cssText = `
    padding: 10px;
    background: #f5f5f5;
    border-bottom: 1px solid #e0e0e0;
  `;
  
  // 关系类型过滤
  const relationLabel = doc.createXULElement('label');
  relationLabel.setAttribute('value', 'Filter by Relation:');
  relationLabel.style.cssText = 'font-weight: bold; margin-bottom: 5px;';
  
  const relationBox = doc.createXULElement('hbox');
  relationBox.style.cssText = 'margin-bottom: 10px;';
  
  Object.entries(RelationType).forEach(([key, value]) => {
    const checkbox = doc.createXULElement('checkbox');
    checkbox.setAttribute('label', ResearchNavigator.getRelationLabel(value));
    checkbox.setAttribute('checked', 'true');
    checkbox.addEventListener('command', () => {
      // TODO: 实现关系类型过滤
    });
    relationBox.appendChild(checkbox);
  });
  
  // 重要性过滤
  const importanceLabel = doc.createXULElement('label');
  importanceLabel.setAttribute('value', 'Minimum Importance:');
  importanceLabel.style.cssText = 'font-weight: bold; margin-bottom: 5px;';
  
  const importanceSlider = doc.createXULElement('scale');
  importanceSlider.setAttribute('min', '0');
  importanceSlider.setAttribute('max', '5');
  importanceSlider.setAttribute('value', '0');
  importanceSlider.style.cssText = 'margin-bottom: 10px;';
  importanceSlider.addEventListener('change', (e) => {
    ResearchNavigator.filterImportance = parseInt(e.target.value);
    ResearchNavigator.updateTreeDisplay();
  });
  
  panel.appendChild(relationLabel);
  panel.appendChild(relationBox);
  panel.appendChild(importanceLabel);
  panel.appendChild(importanceSlider);
  
  return panel;
}

// 创建推荐面板
function createRecommendationPanel(doc) {
  const panel = doc.createXULElement('vbox');
  panel.id = 'research-navigator-recommend-panel';
  panel.style.cssText = `
    padding: 10px;
    background: #e8f4fd;
    border-bottom: 1px solid #bbdefb;
    margin-bottom: 5px;
  `;
  
  const title = doc.createXULElement('label');
  title.setAttribute('value', '💡 Recommended Items');
  title.style.cssText = 'font-weight: bold; margin-bottom: 5px;';
  
  const list = doc.createXULElement('vbox');
  list.id = 'research-navigator-recommend-list';
  
  panel.appendChild(title);
  panel.appendChild(list);
  
  return panel;
}

// 创建树形视图
function createTreeView(doc) {
  const view = doc.createXULElement('vbox');
  view.id = 'research-navigator-tree-view';
  view.setAttribute('flex', '1');
  view.style.cssText = 'display: flex; flex-direction: column;';
  
  const scrollbox = doc.createXULElement('scrollbox');
  scrollbox.setAttribute('flex', '1');
  scrollbox.setAttribute('orient', 'vertical');
  scrollbox.style.cssText = `
    overflow: auto;
    background: white;
    min-height: 0;
  `;
  
  const treeContainer = doc.createXULElement('vbox');
  treeContainer.id = 'research-navigator-tree-container';
  treeContainer.style.cssText = 'padding: 8px; min-width: max-content;';
  
  scrollbox.appendChild(treeContainer);
  view.appendChild(scrollbox);
  
  return view;
}

// 创建列表视图
function createListView(doc) {
  const view = doc.createXULElement('vbox');
  view.id = 'research-navigator-list-view';
  view.setAttribute('flex', '1');
  view.style.cssText = 'display: flex; flex-direction: column;';
  
  const scrollbox = doc.createXULElement('scrollbox');
  scrollbox.setAttribute('flex', '1');
  scrollbox.setAttribute('orient', 'vertical');
  scrollbox.style.cssText = 'overflow: auto; background: white;';
  
  const listContainer = doc.createXULElement('vbox');
  listContainer.id = 'research-navigator-list-container';
  listContainer.style.cssText = 'padding: 10px;';
  
  scrollbox.appendChild(listContainer);
  view.appendChild(scrollbox);
  
  return view;
}

// 创建图表视图
function createGraphView(doc) {
  const view = doc.createXULElement('vbox');
  view.id = 'research-navigator-graph-view';
  view.setAttribute('flex', '1');
  view.style.cssText = 'display: flex; flex-direction: column;';
  
  // 这里需要使用 HTML canvas 或 SVG 来绘制图表
  const graphContainer = doc.createXULElement('box');
  graphContainer.id = 'research-navigator-graph-container';
  graphContainer.setAttribute('flex', '1');
  graphContainer.style.cssText = 'background: white; position: relative;';
  
  // 创建 HTML iframe 来容纳图表
  const iframe = doc.createElement('iframe');
  iframe.id = 'research-navigator-graph-iframe';
  iframe.style.cssText = 'width: 100%; height: 100%; border: none;';
  iframe.src = 'data:text/html,<html><body style="margin:0"><canvas id="graph-canvas" style="width:100%;height:100%"></canvas></body></html>';
  
  graphContainer.appendChild(iframe);
  view.appendChild(graphContainer);
  
  return view;
}

// 创建时间线视图
function createTimelineView(doc) {
  const view = doc.createXULElement('vbox');
  view.id = 'research-navigator-timeline-view';
  view.setAttribute('flex', '1');
  view.style.cssText = 'display: flex; flex-direction: column;';
  
  const scrollbox = doc.createXULElement('scrollbox');
  scrollbox.setAttribute('flex', '1');
  scrollbox.setAttribute('orient', 'horizontal');
  scrollbox.style.cssText = 'overflow: auto; background: white;';
  
  const timelineContainer = doc.createXULElement('hbox');
  timelineContainer.id = 'research-navigator-timeline-container';
  timelineContainer.style.cssText = 'padding: 20px; min-width: max-content;';
  
  scrollbox.appendChild(timelineContainer);
  view.appendChild(scrollbox);
  
  return view;
}

// 切换过滤器面板
function toggleFilterPanel(doc) {
  const panel = doc.getElementById('research-navigator-filter-panel');
  if (panel) {
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  }
}

// 切换树形历史面板
function toggleTreePanel(window) {
  const doc = window.document;
  const panel = doc.getElementById('research-navigator-panel');
  
  if (!panel) {
    createTreePanel(window);
    const newPanel = doc.getElementById('research-navigator-panel');
    if (newPanel) {
      newPanel.style.display = 'flex';
      newPanel.style.height = ResearchNavigator.panelHeight + 'px';
    }
    return;
  }
  
  if (panel.style.display === 'none') {
    panel.style.display = 'flex';
    panel.style.height = ResearchNavigator.panelHeight + 'px';
    ResearchNavigator.updateTreePanel(window, panel);
  } else {
    panel.style.display = 'none';
  }
}

// 显示统计面板
function showStatisticsPanel(window) {
  const doc = window.document;
  const stats = ResearchNavigator.getStatistics();
  
  // 创建统计对话框
  const dialog = doc.createXULElement('dialog');
  dialog.setAttribute('title', 'Research Navigator Statistics');
  dialog.style.cssText = 'padding: 20px;';
  
  const content = doc.createXULElement('vbox');
  
  // 总体统计
  const summaryBox = doc.createXULElement('groupbox');
  const summaryCaption = doc.createXULElement('caption');
  summaryCaption.setAttribute('label', 'Summary');
  summaryBox.appendChild(summaryCaption);
  
  const summaryGrid = doc.createXULElement('grid');
  const summaryColumns = doc.createXULElement('columns');
  const summaryCol1 = doc.createXULElement('column');
  const summaryCol2 = doc.createXULElement('column');
  summaryColumns.appendChild(summaryCol1);
  summaryColumns.appendChild(summaryCol2);
  
  const summaryRows = doc.createXULElement('rows');
  
  const addStatRow = (label, value) => {
    const row = doc.createXULElement('row');
    const labelEl = doc.createXULElement('label');
    labelEl.setAttribute('value', label + ':');
    labelEl.style.cssText = 'font-weight: bold;';
    const valueEl = doc.createXULElement('label');
    valueEl.setAttribute('value', value);
    row.appendChild(labelEl);
    row.appendChild(valueEl);
    summaryRows.appendChild(row);
  };
  
  addStatRow('Total Items', stats.totalNodes);
  addStatRow('Total Sessions', stats.totalSessions);
  addStatRow('Most Common Relation', Object.entries(stats.relationTypes).sort((a,b) => b[1]-a[1])[0]?.[0] || 'N/A');
  
  summaryGrid.appendChild(summaryColumns);
  summaryGrid.appendChild(summaryRows);
  summaryBox.appendChild(summaryGrid);
  
  // 作者统计
  const authorBox = doc.createXULElement('groupbox');
  const authorCaption = doc.createXULElement('caption');
  authorCaption.setAttribute('label', 'Top Authors');
  authorBox.appendChild(authorCaption);
  
  const authorList = doc.createXULElement('vbox');
  Array.from(stats.topAuthors.entries()).forEach(([author, count]) => {
    const label = doc.createXULElement('label');
    label.setAttribute('value', `${author}: ${count} items`);
    authorList.appendChild(label);
  });
  authorBox.appendChild(authorList);
  
  // 标签统计
  const tagBox = doc.createXULElement('groupbox');
  const tagCaption = doc.createXULElement('caption');
  tagCaption.setAttribute('label', 'Top Tags');
  tagBox.appendChild(tagCaption);
  
  const tagList = doc.createXULElement('vbox');
  Array.from(stats.topTags.entries()).forEach(([tag, count]) => {
    const label = doc.createXULElement('label');
    label.setAttribute('value', `${tag}: ${count} items`);
    tagList.appendChild(label);
  });
  tagBox.appendChild(tagList);
  
  content.appendChild(summaryBox);
  content.appendChild(authorBox);
  content.appendChild(tagBox);
  
  // 按钮
  const buttons = doc.createXULElement('hbox');
  buttons.style.cssText = 'margin-top: 20px; justify-content: center;';
  
  const exportBtn = doc.createXULElement('button');
  exportBtn.setAttribute('label', 'Export Stats');
  exportBtn.addEventListener('command', () => {
    // TODO: 实现统计导出
  });
  
  const closeBtn = doc.createXULElement('button');
  closeBtn.setAttribute('label', 'Close');
  closeBtn.addEventListener('command', () => {
    dialog.close();
  });
  
  buttons.appendChild(exportBtn);
  buttons.appendChild(closeBtn);
  
  dialog.appendChild(content);
  dialog.appendChild(buttons);
  
  doc.documentElement.appendChild(dialog);
  dialog.openDialog();
}

// 显示通知（增强版）
function showNotification(window, message, type = 'info') {
  if (!window) return;
  
  const doc = window.document;
  
  const notification = doc.createElement('div');
  notification.style.cssText = `
    position: fixed;
    bottom: 80px;
    right: 20px;
    background: ${type === 'error' ? '#f44336' : type === 'warning' ? '#ff9800' : '#4CAF50'};
    color: white;
    padding: 12px 20px;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 99999;
    font-size: 0.9em;
    animation: slideIn 0.3s ease;
    max-width: 300px;
    display: flex;
    align-items: center;
  `;
  
  const icon = doc.createElement('span');
  icon.textContent = type === 'error' ? '❌ ' : type === 'warning' ? '⚠️ ' : '✓ ';
  icon.style.cssText = 'margin-right: 8px; font-size: 1.2em;';
  
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
  }, 3000);
}

// 移除 UI
function removeUI(window) {
  const doc = window.document;
  
  // 移除键盘事件监听
  doc.removeEventListener('keydown', ResearchNavigator.handleShortcut);
  
  for (let id of ResearchNavigator.addedElementIds) {
    const elem = doc.getElementById(id);
    if (elem && elem.parentNode) {
      elem.parentNode.removeChild(elem);
    }
  }
  
  ResearchNavigator.historyPanels.delete(window);
}