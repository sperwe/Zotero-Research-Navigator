/**
 * 主面板组件
 * 实现混合式 UI（浮动面板 + 可选侧边栏）
 */

import { ClosedTabsManager } from "../../managers/closed-tabs-manager";
import { NoteAssociationSystem } from "../../managers/note-association-system";
import { HistoryService } from "../../services/history-service";
import { HistoryTreeTab } from "./tabs/history-tree-tab";
import { NoteRelationsTab } from "./tabs/note-relations-tab";

export interface MainPanelOptions {
  closedTabsManager: ClosedTabsManager;
  noteAssociationSystem: NoteAssociationSystem;
  historyService: HistoryService;
}

export class MainPanel {
  private container: HTMLElement | null = null;
  private isVisible = false;
  private isDocked = false;
  private activeTab = "history";

  // 标签页
  private tabs: Map<string, any> = new Map();

  // 面板尺寸
  private width = 400;
  private height = 500;
  private minWidth = 300;
  private minHeight = 200;

  constructor(
    private window: Window,
    private options: MainPanelOptions,
  ) {}

  async create(): Promise<void> {
    const doc = this.window.document;

    // 创建容器
    this.container = doc.createElement("div");
    this.container.id = "research-navigator-main-panel";
    this.container.className = "research-navigator-panel";
    this.container.style.cssText = `
      position: fixed;
      right: 20px;
      top: 80px;
      width: ${this.width}px;
      height: ${this.height}px;
      background: rgba(255, 255, 255, 0.98);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border: 1px solid rgba(0, 0, 0, 0.1);
      border-radius: 12px;
      box-shadow: 
        0 20px 25px -5px rgba(0, 0, 0, 0.1),
        0 10px 10px -5px rgba(0, 0, 0, 0.04),
        0 0 0 1px rgba(0, 0, 0, 0.05);
      display: none;
      flex-direction: column;
      z-index: 1000;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    `;

    // 创建标题栏
    const header = this.createHeader(doc);
    this.container.appendChild(header);

    // 创建标签栏
    const tabBar = this.createTabBar(doc);
    this.container.appendChild(tabBar);

    // 创建内容区域
    const content = this.createContent(doc);
    this.container.appendChild(content);

    // 创建调整大小的手柄
    this.createResizers(doc);

    // 添加样式
    this.injectStyles(doc);
    
    // 添加到文档
    if (doc.body) {
      doc.body.appendChild(this.container);
    } else {
      // 如果 body 还不存在，添加到根元素
      const root = doc.documentElement || doc;
      root.appendChild(this.container);
    }

    // 初始化标签页
    await this.initializeTabs();

    // 加载保存的状态
    this.loadState();

    Zotero.log("[MainPanel] Created successfully", "info");
  }

  /**
   * 创建标题栏
   */
  private createHeader(doc: Document): HTMLElement {
    const header = doc.createElement("div");
    header.className = "panel-header";
    header.style.cssText = `
      display: flex;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.06);
      cursor: move;
      background: linear-gradient(to bottom, rgba(0, 0, 0, 0.02), transparent);
      border-radius: 12px 12px 0 0;
      user-select: none;
      -webkit-user-select: none;
    `;

    // 标题
    const title = doc.createElement("h3");
    title.textContent = "Research Navigator";
    title.style.cssText = `
      margin: 0;
      flex: 1;
      font-size: 16px;
      font-weight: 600;
      color: #1a1a1a;
      letter-spacing: -0.3px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    `;
    header.appendChild(title);

    // 停靠按钮
    const dockButton = doc.createElement("button");
    dockButton.className = "panel-dock-button";
    dockButton.innerHTML = this.isDocked ? "⬜" : "📌";
    dockButton.title = this.isDocked ? "Undock" : "Dock to sidebar";
    dockButton.style.cssText = `
      background: transparent;
      border: none;
      padding: 6px;
      cursor: pointer;
      opacity: 0.6;
      transition: all 0.2s ease;
      border-radius: 4px;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
    `;
    dockButton.addEventListener("mouseenter", () => {
      dockButton.style.opacity = "1";
      dockButton.style.background = "rgba(0, 0, 0, 0.06)";
    });
    dockButton.addEventListener("mouseleave", () => {
      dockButton.style.opacity = "0.6";
      dockButton.style.background = "transparent";
    });
    dockButton.addEventListener("click", () => this.toggleDock());
    header.appendChild(dockButton);

    // 关闭按钮
    const closeButton = doc.createElement("button");
    closeButton.className = "panel-close-button";
    closeButton.innerHTML = "✕";
    closeButton.title = "Close";
    closeButton.style.cssText = `
      background: transparent;
      border: none;
      padding: 6px;
      cursor: pointer;
      opacity: 0.6;
      transition: all 0.2s ease;
      border-radius: 4px;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      margin-left: 8px;
    `;
    closeButton.addEventListener("mouseenter", () => {
      closeButton.style.opacity = "1";
      closeButton.style.background = "rgba(220, 53, 69, 0.1)";
      closeButton.style.color = "#dc3545";
    });
    closeButton.addEventListener("mouseleave", () => {
      closeButton.style.opacity = "0.6";
      closeButton.style.background = "transparent";
      closeButton.style.color = "inherit";
    });
    closeButton.addEventListener("click", () => this.hide());
    header.appendChild(closeButton);

    // 拖动功能
    this.makeDraggable(header);

    return header;
  }

  /**
   * 创建标签栏
   */
  private createTabBar(doc: Document): HTMLElement {
    const tabBar = doc.createElement("div");
    tabBar.className = "panel-tab-bar";
    tabBar.style.cssText = `
      display: flex;
      padding: 0 12px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.06);
      background: rgba(0, 0, 0, 0.02);
      backdrop-filter: blur(5px);
    `;

    const tabs = [
      { id: "history", label: "History Tree", icon: "🌳" },
      { id: "notes", label: "Note Relations", icon: "📝" },
    ];

    for (const tab of tabs) {
      const tabButton = doc.createElement("button");
      tabButton.className = `panel-tab ${tab.id === this.activeTab ? "active" : ""}`;
      tabButton.setAttribute("data-tab", tab.id);
      tabButton.style.cssText = `
        background: none;
        border: none;
        border-bottom: 2px solid transparent;
        padding: 10px 16px;
        cursor: pointer;
        font-size: 14px;
        color: ${tab.id === this.activeTab ? "#0066cc" : "#666"};
        font-weight: ${tab.id === this.activeTab ? "500" : "400"};
        opacity: ${tab.id === this.activeTab ? "1" : "0.8"};
        transition: all 0.2s ease;
        ${tab.id === this.activeTab ? "border-bottom-color: #0066cc;" : ""}
      `;
      
      tabButton.addEventListener("mouseenter", () => {
        if (tab.id !== this.activeTab) {
          tabButton.style.opacity = "1";
          tabButton.style.color = "#0066cc";
        }
      });
      
      tabButton.addEventListener("mouseleave", () => {
        if (tab.id !== this.activeTab) {
          tabButton.style.opacity = "0.8";
          tabButton.style.color = "#666";
        }
      });
      tabButton.innerHTML = `${tab.icon} ${tab.label}`;

      tabButton.addEventListener("click", () => this.switchTab(tab.id));
      tabBar.appendChild(tabButton);
    }

    return tabBar;
  }

  /**
   * 创建内容区域
   */
  private createContent(doc: Document): HTMLElement {
    const content = doc.createElement("div");
    content.className = "panel-content";
    content.style.cssText = `
      flex: 1;
      overflow: hidden;
      position: relative;
    `;

    return content;
  }

  /**
   * 创建调整大小的手柄
   */
  private createResizers(doc: Document): void {
    if (!this.container) return;

    // 右下角调整大小手柄
    const resizer = doc.createElement("div");
    resizer.className = "panel-resizer";
    resizer.style.cssText = `
      position: absolute;
      right: 0;
      bottom: 0;
      width: 10px;
      height: 10px;
      cursor: nwse-resize;
    `;

    this.makeResizable(resizer);
    this.container.appendChild(resizer);
  }
  
  /**
   * 注入样式
   */
  private injectStyles(doc: Document): void {
    const styleId = "research-navigator-panel-styles";
    if (doc.getElementById(styleId)) return;
    
    const style = doc.createElement("style");
    style.id = styleId;
    style.textContent = `
      @keyframes fadeInScale {
        from {
          opacity: 0;
          transform: scale(0.95) translateY(-10px);
        }
        to {
          opacity: 1;
          transform: scale(1) translateY(0);
        }
      }
      
      @keyframes fadeOutScale {
        from {
          opacity: 1;
          transform: scale(1) translateY(0);
        }
        to {
          opacity: 0;
          transform: scale(0.95) translateY(-10px);
        }
      }
      
      .research-navigator-panel.animate-in {
        animation: fadeInScale 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
      }
      
      .research-navigator-panel.animate-out {
        animation: fadeOutScale 0.2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
      }
      
      /* 滚动条美化 */
      .research-navigator-panel ::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }
      
      .research-navigator-panel ::-webkit-scrollbar-track {
        background: rgba(0, 0, 0, 0.03);
        border-radius: 4px;
      }
      
      .research-navigator-panel ::-webkit-scrollbar-thumb {
        background: rgba(0, 0, 0, 0.15);
        border-radius: 4px;
        transition: background 0.2s;
      }
      
      .research-navigator-panel ::-webkit-scrollbar-thumb:hover {
        background: rgba(0, 0, 0, 0.25);
      }
      
      /* 输入框美化 */
      .research-navigator-panel input[type="text"],
      .research-navigator-panel input[type="search"] {
        background: rgba(0, 0, 0, 0.04);
        border: 1px solid rgba(0, 0, 0, 0.08);
        border-radius: 6px;
        padding: 8px 12px;
        font-size: 14px;
        transition: all 0.2s ease;
        outline: none;
      }
      
      .research-navigator-panel input[type="text"]:focus,
      .research-navigator-panel input[type="search"]:focus {
        background: white;
        border-color: #0066cc;
        box-shadow: 0 0 0 3px rgba(0, 102, 204, 0.1);
      }
      
      /* 按钮美化 */
      .research-navigator-panel button {
        transition: all 0.2s ease;
      }
      
      .research-navigator-panel button:active {
        transform: scale(0.95);
      }
      
      /* 悬浮时的阴影增强 */
      .research-navigator-panel:hover {
        box-shadow: 
          0 25px 30px -5px rgba(0, 0, 0, 0.12),
          0 15px 15px -5px rgba(0, 0, 0, 0.06),
          0 0 0 1px rgba(0, 0, 0, 0.08);
      }
    `;
    
    doc.head.appendChild(style);
  }

  /**
   * 初始化标签页
   */
  private async initializeTabs(): Promise<void> {
    // 历史树标签页
    const historyTab = new HistoryTreeTab(
      this.window,
      this.options.historyService,
      this.options.closedTabsManager
    );
    this.tabs.set("history", historyTab);

    // 已关闭标签页
    // 已关闭标签页功能整合到历史树中，不需要单独标签

    // 笔记关联标签页
    const notesTab = new NoteRelationsTab(
      this.window,
      this.options.historyService,
      this.options.noteAssociationSystem
    );
    this.tabs.set("notes", notesTab);

    // 显示初始标签页
    this.showTab(this.activeTab);
  }

  /**
   * 切换标签页
   */
  private switchTab(tabId: string): void {
    if (tabId === this.activeTab) return;

    // 更新标签栏样式
    const tabButtons = this.container?.querySelectorAll(".panel-tab");
    tabButtons?.forEach((button) => {
      const isActive = button.getAttribute("data-tab") === tabId;
      button.classList.toggle("active", isActive);
      (button as HTMLElement).style.opacity = isActive ? "1" : "0.7";
      (button as HTMLElement).style.borderBottomColor = isActive
        ? "var(--accent-blue)"
        : "transparent";
    });

    // 隐藏当前标签页
    this.hideTab(this.activeTab);

    // 显示新标签页
    this.activeTab = tabId;
    this.showTab(tabId);

    // 保存状态
    this.saveState();
  }

  /**
   * 显示标签页
   */
  private showTab(tabId: string): void {
    const tab = this.tabs.get(tabId);
    if (!tab) return;

    const content = this.container?.querySelector(".panel-content");
    if (!content) return;

    const doc = this.window.document;

    // 清空内容
    content.innerHTML = "";

    // 渲染标签页
    const container = doc.createElement('div');
    container.style.cssText = 'height: 100%; width: 100%;';
    content.appendChild(container);
    
    // 所有标签页都应该有 create 方法
    if (tab && typeof (tab as any).create === 'function') {
      (tab as any).create(container);
    } else {
      Zotero.logError(`Tab ${tabId} does not have a create method`);
    }
  }

  /**
   * 隐藏标签页
   */
  private hideTab(tabId: string): void {
    const tab = this.tabs.get(tabId);
    if (tab && typeof tab.onHide === "function") {
      tab.onHide();
    }
  }

  /**
   * 使元素可拖动
   */
  private makeDraggable(element: HTMLElement): void {
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    element.addEventListener("mousedown", (e: MouseEvent) => {
      if (this.isDocked) return;

      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;

      const rect = this.container!.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;

      e.preventDefault();
    });

    this.window.addEventListener("mousemove", (e: MouseEvent) => {
      if (!isDragging || !this.container) return;

      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      this.container.style.left = `${startLeft + deltaX}px`;
      this.container.style.top = `${startTop + deltaY}px`;
      this.container.style.right = "auto";
    });

    this.window.addEventListener("mouseup", () => {
      isDragging = false;
    });
  }

  /**
   * 使元素可调整大小
   */
  private makeResizable(resizer: HTMLElement): void {
    let isResizing = false;
    let startX = 0;
    let startY = 0;
    let startWidth = 0;
    let startHeight = 0;

    resizer.addEventListener("mousedown", (e: MouseEvent) => {
      isResizing = true;
      startX = e.clientX;
      startY = e.clientY;
      startWidth = this.width;
      startHeight = this.height;

      e.preventDefault();
    });

    this.window.addEventListener("mousemove", (e: MouseEvent) => {
      if (!isResizing || !this.container) return;

      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      this.width = Math.max(this.minWidth, startWidth + deltaX);
      this.height = Math.max(this.minHeight, startHeight + deltaY);

      this.container.style.width = `${this.width}px`;
      this.container.style.height = `${this.height}px`;
    });

    this.window.addEventListener("mouseup", () => {
      if (isResizing) {
        isResizing = false;
        this.saveState();
      }
    });
  }

  /**
   * 切换停靠状态
   */
  private toggleDock(): void {
    this.isDocked = !this.isDocked;

    if (this.isDocked) {
      // TODO: 实现停靠到侧边栏
      Zotero.log("[MainPanel] Docking not yet implemented", "warn");
      this.isDocked = false;
    } else {
      // TODO: 实现从侧边栏分离
    }
  }

  /**
   * 显示面板
   */
  show(): void {
    if (!this.container) return;

    this.container.style.display = "flex";
    this.container.classList.add("animate-in");
    this.isVisible = true;

    // 移除动画类
    setTimeout(() => {
      this.container?.classList.remove("animate-in");
    }, 300);

    this.saveState();
  }

  /**
   * 隐藏面板
   */
  hide(): void {
    if (!this.container) return;

    this.container.style.display = "none";
    this.isVisible = false;

    this.saveState();
  }

  /**
   * 切换显示/隐藏
   */
  toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * 保存状态
   */
  private saveState(): void {
    const state = {
      isVisible: this.isVisible,
      isDocked: this.isDocked,
      activeTab: this.activeTab,
      width: this.width,
      height: this.height,
      position: this.container
        ? {
            left: this.container.style.left,
            top: this.container.style.top,
          }
        : null,
    };

    Zotero.Prefs.set("researchnavigator.panel.state", JSON.stringify(state));
  }

  /**
   * 加载状态
   */
  private loadState(): void {
    try {
      const stateStr = Zotero.Prefs.get("researchnavigator.panel.state");
      if (!stateStr) return;

      const state = JSON.parse(stateStr);

      this.isDocked = state.isDocked || false;
      this.activeTab = state.activeTab || "history";
      this.width = state.width || 400;
      this.height = state.height || 500;

      if (this.container) {
        this.container.style.width = `${this.width}px`;
        this.container.style.height = `${this.height}px`;

        if (state.position) {
          this.container.style.left = state.position.left;
          this.container.style.top = state.position.top;
          this.container.style.right = "auto";
        }
      }

      if (state.isVisible) {
        this.show();
      }
    } catch (error) {
      Zotero.logError(error);
    }
  }

  /**
   * 获取内容容器（用于侧边栏模式）
   */
  getContent(): HTMLElement | null {
    if (!this.container) return null;
    
    // 创建一个新的容器，包含标签页内容
    const doc = this.window.document;
    const contentWrapper = doc.createElement("div");
    contentWrapper.style.cssText = `
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    `;
    
    // 复制标签栏
    const tabBar = this.container.querySelector(".panel-tab-bar");
    if (tabBar) {
      const tabBarClone = tabBar.cloneNode(true) as HTMLElement;
      // 重新绑定事件
      const buttons = tabBarClone.querySelectorAll("button[data-tab]");
      buttons.forEach((btn) => {
        btn.addEventListener("click", () => {
          const tabName = btn.getAttribute("data-tab");
          if (tabName) {
            this.switchTab(tabName);
          }
        });
      });
      contentWrapper.appendChild(tabBarClone);
    }
    
    // 复制内容区域
    const content = this.container.querySelector(".panel-content");
    if (content) {
      const contentClone = content.cloneNode(true) as HTMLElement;
      contentWrapper.appendChild(contentClone);
    }
    
    return contentWrapper;
  }
  
  /**
   * 刷新历史标签页
   */
  refreshHistoryTab(): void {
    const historyTab = this.tabs.get("history");
    if (historyTab && this.activeTab === "history") {
      // 触发历史树的刷新
      if ('refresh' in historyTab && typeof historyTab.refresh === 'function') {
        (historyTab as any).refresh();
      }
    }
  }
  
  /**
   * 销毁组件
   */
  destroy(): void {
    // 销毁所有标签页
    for (const tab of this.tabs.values()) {
      if (typeof tab.destroy === "function") {
        tab.destroy();
      }
    }
    this.tabs.clear();

    // 移除容器
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }
}
