/**
 * History Panel Component
 * 创建和管理历史记录面板
 */

import { config } from "@/config";
import { HistoryTracker, HistoryNode } from "../historyTracker";
import { SearchEngine } from "../searchEngine";
import { createElement } from "../../utils/ui-helper";

export async function createHistoryPanel(
  win: Window,
  historyTracker: HistoryTracker,
  searchEngine: SearchEngine,
): Promise<Element | null> {
  const doc = win.document;

  // 查找主容器
  const container = doc.getElementById("zotero-pane") || doc.body;
  if (!container) {
    addon.ztoolkit.log("No suitable container found for history panel", "warn");
    return null;
  }

  // 检查是否已存在
  const existingPanel = doc.getElementById(`${config.addonRef}-history-panel`);
  if (existingPanel) {
    return existingPanel;
  }

  // 创建面板
  const panel = createElement(doc, "div", {
    id: `${config.addonRef}-history-panel`,
    classList: ["research-navigator-panel"],
    styles: {
      position: "fixed",
      right: "20px",
      top: "80px",
      width: "350px",
      maxHeight: "600px",
      backgroundColor: "var(--material-background, #ffffff)",
      border: "1px solid var(--material-border, #e0e0e0)",
      borderRadius: "8px",
      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
      display: "none",
      flexDirection: "column",
      zIndex: "1000",
      overflow: "hidden",
    },
  });

  // 创建面板头部
  const header = createPanelHeader(doc, historyTracker);
  panel.appendChild(header);

  // 创建搜索栏
  const searchBar = createSearchBar(doc, searchEngine);
  panel.appendChild(searchBar);

  // 创建历史列表容器
  const listContainer = createElement(doc, "div", {
    id: `${config.addonRef}-history-list`,
    classList: ["history-list-container"],
    styles: {
      flex: "1",
      overflowY: "auto",
      padding: "10px",
    },
  });
  panel.appendChild(listContainer);

  // 创建底部工具栏
  const footer = createPanelFooter(doc, historyTracker);
  panel.appendChild(footer);

  // 添加到容器
  container.appendChild(panel);

  // 设置更新事件监听
  panel.addEventListener("update-history", (e: any) => {
    updateHistoryList(doc, listContainer, e.detail.history);
  });

  // 初始更新
  updateHistoryList(doc, listContainer, historyTracker.getHistoryTree());

  return panel;
}

function createPanelHeader(
  doc: Document,
  historyTracker: HistoryTracker,
): Element {
  const header = createElement(doc, "div", {
    classList: ["panel-header"],
    styles: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "15px",
      borderBottom: "1px solid var(--material-border, #e0e0e0)",
      backgroundColor: "var(--material-background-secondary, #f5f5f5)",
    },
  });

  // 标题
  const title = createElement(doc, "h3", {
    styles: {
      margin: "0",
      fontSize: "16px",
      fontWeight: "600",
      color: "var(--material-text-primary, #333333)",
    },
  });
  title.textContent = "Research History";
  header.appendChild(title);

  // 关闭按钮
  const closeButton = createElement(doc, "button", {
    classList: ["close-button"],
    styles: {
      background: "transparent",
      border: "none",
      fontSize: "20px",
      cursor: "pointer",
      padding: "0",
      width: "24px",
      height: "24px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "4px",
    },
  });
  closeButton.innerHTML = "×";
  closeButton.addEventListener("click", () => {
    const panel = doc.getElementById(`${config.addonRef}-history-panel`);
    if (panel) {
      (panel as HTMLElement).style.display = "none";
    }
  });
  header.appendChild(closeButton);

  return header;
}

function createSearchBar(doc: Document, searchEngine: SearchEngine): Element {
  const searchContainer = createElement(doc, "div", {
    classList: ["search-container"],
    styles: {
      padding: "10px",
      borderBottom: "1px solid var(--material-border, #e0e0e0)",
    },
  });

  const searchInput = createElement(doc, "input", {
    properties: {
      type: "search",
      placeholder: "Search history...",
    },
    styles: {
      width: "100%",
      padding: "8px 12px",
      border: "1px solid var(--material-border, #e0e0e0)",
      borderRadius: "4px",
      fontSize: "14px",
      outline: "none",
    },
  }) as HTMLInputElement;

  // 搜索处理
  let searchTimeout: number;
  searchInput.addEventListener("input", (e) => {
    clearTimeout(searchTimeout);
    const query = (e.target as HTMLInputElement).value;

    searchTimeout = doc.defaultView!.setTimeout(() => {
      const results = searchEngine.search(query);
      const listContainer = doc.getElementById(
        `${config.addonRef}-history-list`,
      );
      if (listContainer) {
        updateHistoryList(doc, listContainer, results);
      }
    }, 300);
  });

  searchContainer.appendChild(searchInput);
  return searchContainer;
}

function createPanelFooter(
  doc: Document,
  historyTracker: HistoryTracker,
): Element {
  const footer = createElement(doc, "div", {
    classList: ["panel-footer"],
    styles: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "10px 15px",
      borderTop: "1px solid var(--material-border, #e0e0e0)",
      backgroundColor: "var(--material-background-secondary, #f5f5f5)",
    },
  });

  // 统计信息
  const stats = createElement(doc, "span", {
    styles: {
      fontSize: "12px",
      color: "var(--material-text-secondary, #666666)",
    },
  });
  const count = historyTracker.getHistoryTree().length;
  stats.textContent = `${count} items in history`;
  footer.appendChild(stats);

  // 操作按钮
  const actions = createElement(doc, "div", {
    styles: {
      display: "flex",
      gap: "10px",
    },
  });

  // 清空按钮
  const clearButton = createElement(doc, "button", {
    properties: {
      title: "Clear history",
    },
    styles: {
      padding: "4px 8px",
      fontSize: "12px",
      border: "1px solid var(--material-border, #e0e0e0)",
      borderRadius: "4px",
      background: "white",
      cursor: "pointer",
    },
  });
  clearButton.textContent = "Clear";
  clearButton.addEventListener("click", () => {
    const event = new CustomEvent("clear-history");
    footer.dispatchEvent(event);
  });
  actions.appendChild(clearButton);

  footer.appendChild(actions);
  return footer;
}

function updateHistoryList(
  doc: Document,
  container: Element,
  nodes: HistoryNode[],
): void {
  // 清空容器
  container.innerHTML = "";

  if (nodes.length === 0) {
    const emptyMessage = createElement(doc, "div", {
      styles: {
        textAlign: "center",
        padding: "40px 20px",
        color: "var(--material-text-secondary, #666666)",
        fontSize: "14px",
      },
    });
    emptyMessage.textContent = "No history items yet";
    container.appendChild(emptyMessage);
    return;
  }

  // 创建历史项
  nodes.forEach((node) => {
    const item = createHistoryItem(doc, node);
    container.appendChild(item);
  });
}

function createHistoryItem(doc: Document, node: HistoryNode): Element {
  const item = createElement(doc, "div", {
    classList: ["history-item"],
    properties: {
      "data-item-id": node.itemID,
    },
    styles: {
      padding: "10px",
      marginBottom: "8px",
      border: "1px solid var(--material-border, #e0e0e0)",
      borderRadius: "6px",
      cursor: "pointer",
      transition: "all 0.2s ease",
      backgroundColor: "var(--material-background, #ffffff)",
    },
  });

  // 标题
  const title = createElement(doc, "div", {
    styles: {
      fontWeight: "500",
      fontSize: "14px",
      marginBottom: "4px",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
  });
  title.textContent = node.title;
  item.appendChild(title);

  // 元数据
  const meta = createElement(doc, "div", {
    styles: {
      fontSize: "12px",
      color: "var(--material-text-secondary, #666666)",
      display: "flex",
      gap: "10px",
    },
  });

  // 类型
  const typeSpan = createElement(doc, "span");
  typeSpan.textContent = node.itemType;
  meta.appendChild(typeSpan);

  // 最后访问时间
  const timeSpan = createElement(doc, "span");
  const date = new Date(node.lastAccessed);
  timeSpan.textContent = formatRelativeTime(date);
  meta.appendChild(timeSpan);

  // 访问次数
  const countSpan = createElement(doc, "span");
  countSpan.textContent = `${node.accessRecords.length} visits`;
  meta.appendChild(countSpan);

  item.appendChild(meta);

  // 悬停效果
  item.addEventListener("mouseenter", () => {
    (item as HTMLElement).style.backgroundColor =
      "var(--material-background-hover, #f8f8f8)";
    (item as HTMLElement).style.borderColor =
      "var(--material-primary, #2196F3)";
  });

  item.addEventListener("mouseleave", () => {
    (item as HTMLElement).style.backgroundColor =
      "var(--material-background, #ffffff)";
    (item as HTMLElement).style.borderColor = "var(--material-border, #e0e0e0)";
  });

  // 点击打开项目
  item.addEventListener("click", async () => {
    try {
      const itemID = parseInt(node.itemID);
      const zoteroItem = await Zotero.Items.getAsync(itemID);
      if (zoteroItem) {
        // 选中项目
        const itemsView = Zotero.getActiveZoteroPane().itemsView;
        await itemsView.selectItem(itemID);

        // 如果是PDF，打开它
        if (zoteroItem.isPDFAttachment()) {
          Zotero.OpenPDF.openToPage(zoteroItem, 1);
        }
      }
    } catch (error) {
      addon.ztoolkit.log(`Failed to open item: ${error}`, "error");
    }
  });

  return item;
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString();
}
