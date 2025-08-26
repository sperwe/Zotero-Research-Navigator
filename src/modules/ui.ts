/**
 * UI module for Research Navigator
 * Creates and manages the user interface using zotero-plugin-toolkit
 */

import { HistoryTracker, HistoryNode } from "./historyTracker";
import { SearchEngine } from "./searchEngine";

let currentWindow: Window;
let currentHistoryTracker: HistoryTracker;
let currentSearchEngine: SearchEngine;

export async function initializeUI(
  win: Window,
  historyTracker: HistoryTracker,
  searchEngine: SearchEngine
): Promise<void> {
  currentWindow = win;
  currentHistoryTracker = historyTracker;
  currentSearchEngine = searchEngine;
  
  // 添加工具栏按钮
  await createToolbarButton(win);
  
  // 创建历史面板
  createHistoryPanel(win, historyTracker, searchEngine);
  
  // 添加菜单项
  createMenuItems(win);
  
  // 注册快捷键
  registerShortcuts(win);
}

async function createToolbarButton(win: Window): Promise<void> {
  const doc = win.document;
  
  // 创建工具栏按钮
  ztoolkit.UI.appendElement({
    tag: "toolbarbutton",
    id: "research-navigator-button",
    namespace: "xul",
    attributes: {
      tooltiptext: "Research Navigator - View History",
      label: "Research History",
      class: "toolbarbutton-1",
      style: "list-style-image: url(chrome://researchnavigator/content/icons/icon-16.png)",
    },
    listeners: [
      {
        type: "click",
        listener: () => {
          toggleHistoryPanel(win);
        },
      },
    ],
  });
  
  // 尝试添加到多个工具栏
  const toolbarIds = ["zotero-toolbar", "zotero-items-toolbar", "nav-bar"];
  for (const toolbarId of toolbarIds) {
    const toolbar = doc.getElementById(toolbarId);
    if (toolbar) {
      const button = doc.getElementById("research-navigator-button");
      if (button && !button.parentNode) {
        toolbar.appendChild(button);
        ztoolkit.log(`[Research Navigator] Toolbar button added to ${toolbarId}`);
        break;
      }
    }
  }
}

function createHistoryPanel(
  win: Window,
  historyTracker: HistoryTracker,
  searchEngine: SearchEngine
): void {
  const doc = win.document;
  
  // 创建面板容器
  const panel = ztoolkit.UI.appendElement({
    tag: "div",
    id: "research-navigator-panel",
    namespace: "html",
    styles: {
      position: "fixed",
      right: "0",
      top: "0",
      bottom: "0",
      width: "350px",
      backgroundColor: "#ffffff",
      borderLeft: "1px solid #ddd",
      display: "none",
      flexDirection: "column",
      zIndex: "1000",
    },
    children: [
      {
        tag: "div",
        namespace: "html",
        styles: {
          padding: "10px",
          borderBottom: "1px solid #ddd",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        },
        children: [
          {
            tag: "h2",
            namespace: "html",
            styles: {
              margin: "0",
              fontSize: "16px",
              fontWeight: "bold",
            },
            properties: {
              textContent: "Research History",
            },
          },
          {
            tag: "button",
            namespace: "html",
            styles: {
              border: "none",
              background: "none",
              cursor: "pointer",
              fontSize: "20px",
            },
            properties: {
              textContent: "×",
            },
            listeners: [
              {
                type: "click",
                listener: () => toggleHistoryPanel(win),
              },
            ],
          },
        ],
      },
      {
        tag: "div",
        namespace: "html",
        styles: {
          padding: "10px",
        },
        children: [
          {
            tag: "input",
            id: "research-navigator-search",
            namespace: "html",
            attributes: {
              type: "text",
              placeholder: "Search history...",
            },
            styles: {
              width: "100%",
              padding: "8px",
              border: "1px solid #ddd",
              borderRadius: "4px",
              fontSize: "14px",
            },
            listeners: [
              {
                type: "input",
                listener: (e: Event) => {
                  const query = (e.target as HTMLInputElement).value;
                  updateHistoryDisplay(win, historyTracker, searchEngine, query);
                },
              },
            ],
          },
        ],
      },
      {
        tag: "div",
        id: "research-navigator-tree",
        namespace: "html",
        styles: {
          flex: "1",
          overflow: "auto",
          padding: "10px",
        },
      },
    ],
  }, doc.body);
  
  // 存储到窗口对象
  (win as any).researchNavigatorPanel = panel;
}

function toggleHistoryPanel(win: Window): void {
  const doc = win.document;
  const panel = doc.getElementById("research-navigator-panel");
  if (panel) {
    const isVisible = panel.style.display !== "none";
    panel.style.display = isVisible ? "none" : "flex";
    
    if (!isVisible) {
      // 面板打开时更新显示
      updateHistoryDisplay(win, currentHistoryTracker, currentSearchEngine);
    }
  }
}

function updateHistoryDisplay(
  win: Window,
  historyTracker: HistoryTracker,
  searchEngine: SearchEngine,
  query?: string
): void {
  const doc = win.document;
  const treeContainer = doc.getElementById("research-navigator-tree");
  if (!treeContainer) return;
  
  // 清空现有内容
  treeContainer.innerHTML = "";
  
  const history = historyTracker.getHistory();
  
  if (query && query.trim()) {
    // 构建搜索索引并搜索
    searchEngine.buildIndex(history);
    const results = searchEngine.search(query);
    
    if (results.length === 0) {
      treeContainer.innerHTML = '<div style="color: #666; text-align: center;">No results found</div>';
      return;
    }
    
    // 显示搜索结果
    for (const result of results) {
      const node = createHistoryNodeElement(doc, result.node, () => {
        openItem(result.node.itemID);
      });
      treeContainer.appendChild(node);
    }
  } else {
    // 显示完整历史树
    if (history.length === 0) {
      treeContainer.innerHTML = '<div style="color: #666; text-align: center;">No history yet</div>';
      return;
    }
    
    for (const node of history) {
      const element = createHistoryTreeElement(doc, node);
      treeContainer.appendChild(element);
    }
  }
}

function createHistoryTreeElement(doc: Document, node: HistoryNode): HTMLElement {
  const nodeEl = ztoolkit.UI.createElement(doc, "div", {
    styles: {
      marginBottom: "5px",
    },
    children: [
      {
        tag: "div",
        styles: {
          display: "flex",
          alignItems: "center",
          padding: "5px",
          cursor: "pointer",
          borderRadius: "4px",
        },
        listeners: [
          {
            type: "mouseenter",
            listener: (e: Event) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = "#f0f0f0";
            },
          },
          {
            type: "mouseleave",
            listener: (e: Event) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
            },
          },
          {
            type: "click",
            listener: () => openItem(node.itemID),
          },
        ],
        children: [
          {
            tag: "span",
            styles: {
              marginRight: "5px",
              fontSize: "12px",
              color: "#666",
            },
            properties: {
              textContent: getItemTypeIcon(node.itemType),
            },
          },
          {
            tag: "span",
            styles: {
              flex: "1",
              fontSize: "14px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            },
            properties: {
              textContent: node.title,
              title: node.title,
            },
          },
        ],
      },
    ],
  });
  
  // 递归创建子节点
  if (node.children && node.children.length > 0) {
    const childrenContainer = ztoolkit.UI.createElement(doc, "div", {
      styles: {
        marginLeft: "20px",
      },
    });
    
    for (const child of node.children) {
      childrenContainer.appendChild(createHistoryTreeElement(doc, child));
    }
    
    nodeEl.appendChild(childrenContainer);
  }
  
  return nodeEl;
}

function createHistoryNodeElement(
  doc: Document,
  node: HistoryNode,
  onClick: () => void
): HTMLElement {
  return ztoolkit.UI.createElement(doc, "div", {
    styles: {
      padding: "8px",
      marginBottom: "5px",
      border: "1px solid #eee",
      borderRadius: "4px",
      cursor: "pointer",
    },
    listeners: [
      {
        type: "click",
        listener: onClick,
      },
      {
        type: "mouseenter",
        listener: (e: Event) => {
          (e.currentTarget as HTMLElement).style.backgroundColor = "#f5f5f5";
        },
      },
      {
        type: "mouseleave", 
        listener: (e: Event) => {
          (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
        },
      },
    ],
    children: [
      {
        tag: "div",
        styles: {
          fontWeight: "bold",
          marginBottom: "4px",
        },
        properties: {
          textContent: node.title,
        },
      },
      {
        tag: "div",
        styles: {
          fontSize: "12px",
          color: "#666",
        },
        properties: {
          textContent: `${getItemTypeLabel(node.itemType)} • ${formatDate(node.lastAccessed)}`,
        },
      },
    ],
  });
}

function getItemTypeIcon(itemType: string): string {
  const icons: { [key: string]: string } = {
    journalArticle: "📄",
    book: "📚",
    bookSection: "📖",
    thesis: "🎓",
    conferencePaper: "🎙️",
    webpage: "🌐",
    report: "📊",
    patent: "🔬",
    note: "📝",
    attachment: "📎",
    collection: "📁",
  };
  return icons[itemType] || "📄";
}

function getItemTypeLabel(itemType: string): string {
  const labels: { [key: string]: string } = {
    journalArticle: "Journal Article",
    book: "Book",
    bookSection: "Book Section",
    thesis: "Thesis",
    conferencePaper: "Conference Paper",
    webpage: "Web Page",
    report: "Report",
    patent: "Patent",
    note: "Note",
    attachment: "Attachment",
    collection: "Collection",
  };
  return labels[itemType] || itemType;
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) {
    return "Today";
  } else if (days === 1) {
    return "Yesterday";
  } else if (days < 7) {
    return `${days} days ago`;
  } else {
    return date.toLocaleDateString();
  }
}

async function openItem(itemID: string): Promise<void> {
  try {
    const id = parseInt(itemID);
    const item = await Zotero.Items.getAsync(id);
    
    if (item) {
      // 选择条目
      const libraryID = item.libraryID;
      const itemTreeView = Zotero.getActiveZoteroPane().itemsView;
      
      await itemTreeView.selectItem(id);
      
      // 如果是 PDF，尝试打开
      if (item.isPDFAttachment()) {
        Zotero.OpenPDF.openToPage(item, 1);
      }
    }
  } catch (error) {
    ztoolkit.log(`[Research Navigator] Error opening item: ${error}`, 'error');
  }
}

function createMenuItems(win: Window): void {
  // 添加到工具菜单
  ztoolkit.Menu.register("menuTools", {
    tag: "menuitem",
    id: "research-navigator-menu-tools",
    label: "Research Navigator",
    commandListener: () => toggleHistoryPanel(win),
  });
  
  // 添加到视图菜单
  ztoolkit.Menu.register("menuView", {
    tag: "menuitem", 
    id: "research-navigator-menu-view",
    label: "Research History Panel",
    type: "checkbox",
    commandListener: () => toggleHistoryPanel(win),
  });
}

function registerShortcuts(win: Window): void {
  // 注册快捷键 Ctrl/Cmd + Shift + H
  ztoolkit.Shortcut.register("event", {
    id: "research-navigator-toggle",
    key: "H",
    modifiers: "accel,shift",
    callback: () => {
      toggleHistoryPanel(win);
    },
  });
}