/**
 * UI module for Research Navigator
 * Creates and manages the user interface using zotero-plugin-toolkit
 */

import { HistoryTracker, HistoryNode } from "./historyTracker";
import { SearchEngine } from "./searchEngine";

let currentHistoryTracker: HistoryTracker;
let currentSearchEngine: SearchEngine;

export async function initializeUI(
  win: Window,
  historyTracker: HistoryTracker,
  searchEngine: SearchEngine
): Promise<void> {
  ztoolkit.log("[Research Navigator] Starting UI initialization");
  
  currentHistoryTracker = historyTracker;
  currentSearchEngine = searchEngine;
  
  try {
    // 首先尝试创建一个简单的测试按钮
    createSimpleTestButton(win);
    
    // 添加工具栏按钮
    await createToolbarButton(win);
    ztoolkit.log("[Research Navigator] Toolbar button creation attempted");
    
    // 创建历史面板
    createHistoryPanel(win, historyTracker, searchEngine);
    ztoolkit.log("[Research Navigator] History panel created");
    
    // 添加菜单项
    createMenuItems(win);
    ztoolkit.log("[Research Navigator] Menu items created");
    
    // 注册快捷键
    registerShortcuts(win);
    ztoolkit.log("[Research Navigator] Shortcuts registered");
    
    ztoolkit.log("[Research Navigator] UI initialization completed");
    
    // 添加一个测试通知来确认插件已加载
    win.setTimeout(() => {
      ztoolkit.getGlobal("Zotero").alert(
        null,
        "Research Navigator",
        "Plugin loaded successfully! Use Ctrl+Shift+H to open the history panel."
      );
    }, 2000);
  } catch (error) {
    ztoolkit.log(`[Research Navigator] UI initialization error: ${error}`, 'error');
  }
}

function createSimpleTestButton(win: Window): void {
  try {
    const doc = win.document;
    
    // 查找 Zotero 主界面中的一个稳定元素
    const zoteroPane = doc.getElementById("zotero-pane");
    if (!zoteroPane) {
      ztoolkit.log("[Research Navigator] zotero-pane not found", 'warn');
      return;
    }
    
    // 创建一个浮动按钮用于测试
    const testButton = doc.createElement("button");
    testButton.id = "research-navigator-test-button";
    testButton.textContent = "📚 History";
    testButton.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 10000;
      padding: 10px 15px;
      background: #2980b9;
      color: white;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-size: 14px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.3);
    `;
    
    testButton.addEventListener("click", () => {
      ztoolkit.log("[Research Navigator] Test button clicked!");
      toggleHistoryPanel(win);
    });
    
    testButton.addEventListener("mouseover", () => {
      testButton.style.background = "#3498db";
    });
    
    testButton.addEventListener("mouseout", () => {
      testButton.style.background = "#2980b9";
    });
    
    zoteroPane.appendChild(testButton);
    ztoolkit.log("[Research Navigator] Test button added successfully");
  } catch (error) {
    ztoolkit.log(`[Research Navigator] Error creating test button: ${error}`, 'error');
  }
}

async function createToolbarButton(win: Window): Promise<void> {
  const doc = win.document;
  
  try {
    // 基于 Zotero 源码，工具栏按钮应该是这样的结构
    const props = {
      id: "zotero-tb-research-navigator",
      class: "zotero-tb-button",
      tooltiptext: "Research Navigator - View History", 
      tabindex: "-1",
      label: "Research History"
    };
    
    // 创建工具栏按钮
    const toolbarbutton = doc.createXULElement("toolbarbutton");
    for (const [key, value] of Object.entries(props)) {
      toolbarbutton.setAttribute(key, value);
    }
    
    // 设置图标样式
    toolbarbutton.style.listStyleImage = "url('chrome://researchnavigator/content/icons/icon.svg')";
    
    // 添加事件监听器
    toolbarbutton.addEventListener("command", () => {
      ztoolkit.log("[Research Navigator] Toolbar button clicked");
      toggleHistoryPanel(win);
    });
    
    // Zotero 7 的主要工具栏位置
    const toolbarLocations = [
      // 项目工具栏（最常用的位置）
      { id: "zotero-items-toolbar", position: "afterend", referenceId: "zotero-tb-lookup" },
      // 标签工具栏
      { id: "zotero-tabs-toolbar", position: "beforeend", referenceId: null },
      // 收藏工具栏
      { id: "zotero-collections-toolbar", position: "beforeend", referenceId: null }
    ];
    
    let added = false;
    for (const location of toolbarLocations) {
      const toolbar = doc.getElementById(location.id);
      if (toolbar) {
        // 检查按钮是否已存在
        if (doc.getElementById(props.id)) {
          ztoolkit.log(`[Research Navigator] Button already exists in ${location.id}`);
          return;
        }
        
        if (location.referenceId) {
          // 插入到特定位置
          const referenceNode = doc.getElementById(location.referenceId);
          if (referenceNode) {
            referenceNode.insertAdjacentElement('afterend', toolbarbutton);
            ztoolkit.log(`[Research Navigator] Button added after ${location.referenceId} in ${location.id}`);
            added = true;
            break;
          }
        } else {
          // 添加到工具栏末尾
          toolbar.appendChild(toolbarbutton);
          ztoolkit.log(`[Research Navigator] Button added to end of ${location.id}`);
          added = true;
          break;
        }
      }
    }
    
    if (!added) {
      ztoolkit.log("[Research Navigator] ERROR: Could not find any toolbar to add button", 'error');
    }
  } catch (error) {
    ztoolkit.log(`[Research Navigator] Error creating toolbar button: ${error}`, 'error');
  }
}

function createHistoryPanel(
  win: Window,
  historyTracker: HistoryTracker,
  searchEngine: SearchEngine
): void {
  const doc = win.document;
  
  // 创建面板容器
  const panel = ztoolkit.UI.createElement(doc, "div", {
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
  });
  
  doc.body.appendChild(panel);
  
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
  try {
    const doc = win.document;
    
    // 直接添加到工具菜单（基于 Zotero 源码）
    const toolsMenuPopup = doc.getElementById("menu_ToolsPopup");
    if (toolsMenuPopup) {
      // 创建菜单项
      const menuitem = doc.createXULElement("menuitem");
      menuitem.setAttribute("id", "research-navigator-menu-tools");
      menuitem.setAttribute("label", "Research Navigator");
      menuitem.addEventListener("command", () => {
        ztoolkit.log("[Research Navigator] Tools menu item clicked");
        toggleHistoryPanel(win);
      });
      
      // 添加分隔符
      const separator = doc.createXULElement("menuseparator");
      
      // 插入到插件菜单项之前（menu_addons）
      const addonsMenuItem = doc.getElementById("menu_addons");
      if (addonsMenuItem) {
        toolsMenuPopup.insertBefore(separator, addonsMenuItem);
        toolsMenuPopup.insertBefore(menuitem, separator);
        ztoolkit.log("[Research Navigator] Menu item added to Tools menu");
      } else {
        // 如果找不到插件菜单项，添加到末尾
        toolsMenuPopup.appendChild(separator);
        toolsMenuPopup.appendChild(menuitem);
        ztoolkit.log("[Research Navigator] Menu item added to end of Tools menu");
      }
    } else {
      ztoolkit.log("[Research Navigator] Tools menu not found", 'warn');
    }
    
    // 同时尝试使用 ztoolkit 的方法（作为备用）
    ztoolkit.Menu.register("menuTools", {
      tag: "menuitem",
      id: "research-navigator-menu-tools-ztoolkit",
      label: "Research Navigator (ZToolkit)",
      commandListener: () => {
        ztoolkit.log("[Research Navigator] ZToolkit menu item clicked");
        toggleHistoryPanel(win);
      },
    });
    
  } catch (error) {
    ztoolkit.log(`[Research Navigator] Error creating menu items: ${error}`, 'error');
  }
}

function registerShortcuts(win: Window): void {
  try {
    // 注册快捷键 Ctrl/Cmd + Shift + H
    ztoolkit.Keyboard.register((ev, data) => {
      ztoolkit.log(`[Research Navigator] Key event: ${ev.key}, ctrl: ${ev.ctrlKey}, shift: ${ev.shiftKey}, meta: ${ev.metaKey}`);
      
      if (ev.key === "H" && ev.shiftKey && (ev.ctrlKey || ev.metaKey)) {
        ztoolkit.log("[Research Navigator] Shortcut triggered!");
        toggleHistoryPanel(win);
        ev.preventDefault();
        ev.stopPropagation();
        return true;
      }
      return false;
    });
    
    ztoolkit.log("[Research Navigator] Keyboard shortcut registered (Ctrl/Cmd+Shift+H)");
  } catch (error) {
    ztoolkit.log(`[Research Navigator] Error registering shortcuts: ${error}`, 'error');
  }
}