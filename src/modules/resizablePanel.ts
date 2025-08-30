/**
 * 可调整大小的面板模块
 */

import { config } from "@/config";
import { getString } from "../utils/locale";
import { HistoryTreeView } from "./views/historyTreeView";
import { NoteRelationView } from "./views/noteRelationView";
import { StatisticsView } from "./views/statisticsView";

export interface PanelTab {
  id: string;
  label: string;
  view: any;
}

export class ResizablePanel {
  private container: HTMLDivElement | null = null;
  private resizer: HTMLDivElement | null = null;
  private tabBar: HTMLDivElement | null = null;
  private contentArea: HTMLDivElement | null = null;

  private tabs: PanelTab[] = [];
  private activeTabId: string = "history";

  private minHeight = 200;
  private maxHeight = 600;
  private defaultHeight = 300;

  private isResizing = false;
  private startY = 0;
  private startHeight = 0;

  constructor(private addon: any) {
    // 初始化视图
    this.tabs = [
      {
        id: "history",
        label: getString("panel-tab-history"),
        view: new HistoryTreeView(addon),
      },
      {
        id: "notes",
        label: getString("panel-tab-notes"),
        view: new NoteRelationView(addon),
      },
      {
        id: "statistics",
        label: getString("panel-tab-statistics"),
        view: new StatisticsView(addon),
      },
    ];
  }

  /**
   * 初始化面板
   */
  public async init() {
    await this.createPanel();
    await this.loadSavedState();
    await this.initializeViews();
  }

  /**
   * 创建面板结构
   */
  private async createPanel() {
    const doc = this.addon.data.ztoolkit.getGlobal("document");
    const mainWindow = doc.getElementById("appcontent");
    if (!mainWindow) return;

    // 创建容器
    this.container = this.addon.data.ztoolkit.UI.createElement(doc, "div", {
      id: "research-navigator-panel",
      classList: ["research-navigator-panel"],
      styles: {
        position: "relative",
        bottom: "0",
        left: "0",
        right: "0",
        height: `${this.defaultHeight}px`,
        backgroundColor: "var(--material-background)",
        borderTop: "1px solid var(--material-border-quarternary)",
        display: "none",
        flexDirection: "column",
      },
    }) as HTMLDivElement;

    // 创建调整大小的手柄
    this.resizer = this.addon.data.ztoolkit.UI.createElement(doc, "div", {
      classList: ["panel-resizer"],
      styles: {
        position: "absolute",
        top: "-3px",
        left: "0",
        right: "0",
        height: "6px",
        cursor: "ns-resize",
        zIndex: "10",
      },
      listeners: [
        {
          type: "mousedown",
          listener: this.onStartResize.bind(this),
        },
      ],
    }) as HTMLDivElement;

    // 创建标签栏
    this.tabBar = this.addon.data.ztoolkit.UI.createElement(doc, "div", {
      classList: ["panel-tab-bar"],
      styles: {
        display: "flex",
        height: "32px",
        backgroundColor: "var(--material-background)",
        borderBottom: "1px solid var(--material-border-quarternary)",
        alignItems: "center",
        paddingLeft: "8px",
      },
    }) as HTMLDivElement;

    // 创建标签
    this.tabs.forEach((tab) => {
      const tabElement = this.addon.data.ztoolkit.UI.createElement(doc, "div", {
        classList: ["panel-tab", tab.id === this.activeTabId ? "active" : ""],
        attributes: {
          "data-tab-id": tab.id,
        },
        styles: {
          padding: "4px 16px",
          marginRight: "4px",
          cursor: "pointer",
          borderRadius: "4px 4px 0 0",
          backgroundColor:
            tab.id === this.activeTabId
              ? "var(--material-sidepane)"
              : "transparent",
          fontWeight: tab.id === this.activeTabId ? "bold" : "normal",
        },
        properties: {
          textContent: tab.label,
        },
        listeners: [
          {
            type: "click",
            listener: () => this.switchTab(tab.id),
          },
        ],
      });
      this.tabBar.appendChild(tabElement);
    });

    // 创建内容区域
    this.contentArea = this.addon.data.ztoolkit.UI.createElement(doc, "div", {
      classList: ["panel-content-area"],
      styles: {
        flex: "1",
        overflow: "auto",
        padding: "8px",
      },
    }) as HTMLDivElement;

    // 组装面板
    this.container.appendChild(this.resizer);
    this.container.appendChild(this.tabBar);
    this.container.appendChild(this.contentArea);

    // 添加到主窗口
    mainWindow.appendChild(this.container);

    // 添加样式
    this.injectStyles();
  }

  /**
   * 注入样式
   */
  private injectStyles() {
    const doc = this.addon.data.ztoolkit.getGlobal("document");
    const style = this.addon.data.ztoolkit.UI.createElement(doc, "style", {
      id: "research-navigator-panel-styles",
      properties: {
        textContent: `
          .research-navigator-panel {
            box-shadow: 0 -2px 4px rgba(0, 0, 0, 0.1);
          }
          
          .panel-resizer:hover {
            background-color: var(--material-button);
          }
          
          .panel-tab {
            transition: all 0.2s ease;
          }
          
          .panel-tab:hover {
            background-color: var(--material-button-hover);
          }
          
          .panel-tab.active {
            border-bottom: 2px solid var(--accent-blue);
          }
          
          /* 暗色模式支持 */
          @media (prefers-color-scheme: dark) {
            .research-navigator-panel {
              box-shadow: 0 -2px 4px rgba(255, 255, 255, 0.1);
            }
          }
        `,
      },
    });
    if (doc.head) {
      doc.head.appendChild(style);
    } else if (doc.documentElement) {
      doc.documentElement.appendChild(style);
    }
  }

  /**
   * 开始调整大小
   */
  private onStartResize(event: MouseEvent) {
    this.isResizing = true;
    this.startY = event.clientY;
    this.startHeight = this.container?.offsetHeight || this.defaultHeight;

    const doc = this.addon.data.ztoolkit.getGlobal("document");
    doc.addEventListener("mousemove", this.onResize.bind(this));
    doc.addEventListener("mouseup", this.onEndResize.bind(this));

    // 防止文本选择
    event.preventDefault();
  }

  /**
   * 调整大小中
   */
  private onResize(event: MouseEvent) {
    if (!this.isResizing || !this.container) return;

    const deltaY = this.startY - event.clientY;
    const newHeight = this.startHeight + deltaY;

    if (newHeight >= this.minHeight && newHeight <= this.maxHeight) {
      this.container.style.height = `${newHeight}px`;
    }
  }

  /**
   * 结束调整大小
   */
  private onEndResize() {
    this.isResizing = false;

    const doc = this.addon.data.ztoolkit.getGlobal("document");
    doc.removeEventListener("mousemove", this.onResize.bind(this));
    doc.removeEventListener("mouseup", this.onEndResize.bind(this));

    // 保存高度
    if (this.container) {
      const height = this.container.offsetHeight;
      Zotero.Prefs.set(`${config.addonRef}.panel.height`, height);
    }
  }

  /**
   * 切换标签
   */
  private async switchTab(tabId: string) {
    if (tabId === this.activeTabId) return;

    // 更新标签样式
    const tabs = this.tabBar?.querySelectorAll(".panel-tab");
    tabs?.forEach((tab) => {
      if (tab.getAttribute("data-tab-id") === tabId) {
        tab.classList.add("active");
        (tab as HTMLElement).style.backgroundColor = "var(--material-sidepane)";
        (tab as HTMLElement).style.fontWeight = "bold";
      } else {
        tab.classList.remove("active");
        (tab as HTMLElement).style.backgroundColor = "transparent";
        (tab as HTMLElement).style.fontWeight = "normal";
      }
    });

    // 切换内容
    this.activeTabId = tabId;
    await this.renderActiveView();

    // 保存状态
    Zotero.Prefs.set(`${config.addonRef}.panel.activeTab`, tabId);
  }

  /**
   * 渲染当前视图
   */
  private async renderActiveView() {
    if (!this.contentArea) return;

    // 清空内容
    this.contentArea.innerHTML = "";

    // 渲染新视图
    const activeTab = this.tabs.find((tab) => tab.id === this.activeTabId);
    if (activeTab && activeTab.view) {
      const content = await activeTab.view.render();
      this.contentArea.appendChild(content);
    }
  }

  /**
   * 初始化视图
   */
  private async initializeViews() {
    for (const tab of this.tabs) {
      if (tab.view && typeof tab.view.init === "function") {
        await tab.view.init();
      }
    }

    // 渲染初始视图
    await this.renderActiveView();
  }

  /**
   * 加载保存的状态
   */
  private async loadSavedState() {
    // 加载高度
    const savedHeight = Zotero.Prefs.get(
      `${config.addonRef}.panel.height`,
    ) as number;
    if (savedHeight && this.container) {
      this.container.style.height = `${savedHeight}px`;
    }

    // 加载活动标签
    const savedTab = Zotero.Prefs.get(
      `${config.addonRef}.panel.activeTab`,
    ) as string;
    if (savedTab && this.tabs.find((tab) => tab.id === savedTab)) {
      this.activeTabId = savedTab;
    }

    // 加载显示状态
    const isVisible = Zotero.Prefs.get(
      `${config.addonRef}.panel.visible`,
    ) as boolean;
    if (isVisible) {
      this.show();
    }
  }

  /**
   * 显示面板
   */
  public show() {
    if (this.container) {
      this.container.style.display = "flex";
      Zotero.Prefs.set(`${config.addonRef}.panel.visible`, true);
    }
  }

  /**
   * 隐藏面板
   */
  public hide() {
    if (this.container) {
      this.container.style.display = "none";
      Zotero.Prefs.set(`${config.addonRef}.panel.visible`, false);
    }
  }

  /**
   * 切换显示/隐藏
   */
  public toggle() {
    if (this.container?.style.display === "none") {
      this.show();
    } else {
      this.hide();
    }
  }

  /**
   * 更新视图
   */
  public async updateView(tabId?: string) {
    if (tabId) {
      await this.switchTab(tabId);
    } else {
      await this.renderActiveView();
    }
  }

  /**
   * 获取当前活动的视图
   */
  public getActiveView() {
    const activeTab = this.tabs.find((tab) => tab.id === this.activeTabId);
    return activeTab?.view;
  }

  /**
   * 销毁面板
   */
  public destroy() {
    // 销毁所有视图
    this.tabs.forEach((tab) => {
      if (tab.view && typeof tab.view.destroy === "function") {
        tab.view.destroy();
      }
    });

    // 移除DOM元素
    this.container?.remove();

    // 移除样式
    const doc = this.addon.data.ztoolkit.getGlobal("document");
    doc.getElementById("research-navigator-panel-styles")?.remove();

    // 清理引用
    this.container = null;
    this.resizer = null;
    this.tabBar = null;
    this.contentArea = null;
  }
}
