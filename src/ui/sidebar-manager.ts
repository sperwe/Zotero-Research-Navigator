/**
 * 侧边栏管理器
 * 提供在 Zotero 侧边栏中显示 Research Navigator 的功能
 */

export class SidebarManager {
  private sidebarPane: any = null;
  private initialized = false;
  private contentContainer: HTMLElement | null = null;
  
  constructor(
    private window: Window,
    private onContentRequest: () => HTMLElement | null
  ) {}
  
  /**
   * 初始化侧边栏
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      // 注册侧边栏
      this.registerSidebar();
      
      // 监听侧边栏切换
      this.setupListeners();
      
      this.initialized = true;
      Zotero.log("[SidebarManager] Initialized", "info");
    } catch (error) {
      // 侧边栏是可选功能，如果无法初始化就记录警告但不中断
      Zotero.log(`[SidebarManager] Initialization skipped: ${error}`, "warn");
      this.initialized = false;
      // 不抛出错误，让插件继续运行
    }
  }
  
  /**
   * 注册侧边栏
   */
  private registerSidebar(): void {
    const doc = this.window.document;
    
    // 查找侧边栏容器 - 尝试多个可能的位置
    let sidebarContainer = doc.getElementById("zotero-view-splitter");
    if (!sidebarContainer) {
      sidebarContainer = doc.getElementById("zotero-items-splitter");
    }
    if (!sidebarContainer) {
      // 查找主要的内容区域
      const mainHbox = doc.getElementById("zotero-main-hbox") || 
                      doc.querySelector("#main-window > hbox") ||
                      doc.querySelector("hbox#browser");
      if (mainHbox) {
        // 在主容器的最右侧添加
        sidebarContainer = mainHbox;
      }
    }
    
    if (!sidebarContainer) {
      throw new Error("Sidebar container not found");
    }
    
    // 创建侧边栏面板
    const pane = doc.createXULElement("vbox");
    pane.id = "research-navigator-sidebar";
    pane.setAttribute("flex", "1");
    pane.setAttribute("width", "350");
    pane.style.cssText = `
      min-width: 250px;
      max-width: 600px;
    `;
    
    // 创建标题栏
    const header = this.createHeader(doc);
    pane.appendChild(header);
    
    // 创建内容容器
    this.contentContainer = doc.createElement("div");
    this.contentContainer.style.cssText = `
      flex: 1;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    `;
    pane.appendChild(this.contentContainer);
    
    // 添加到侧边栏之前
    sidebarContainer.parentNode?.insertBefore(pane, sidebarContainer);
    
    // 创建分隔条
    const splitter = doc.createXULElement("splitter");
    splitter.id = "research-navigator-splitter";
    splitter.setAttribute("collapse", "before");
    splitter.setAttribute("resizebefore", "closest");
    splitter.setAttribute("resizeafter", "closest");
    splitter.style.cssText = `
      border-left: 1px solid var(--material-border-quarternary);
      border-right: 1px solid var(--material-border-quarternary);
      min-width: 1px;
      width: 3px;
      background: var(--material-background);
      margin: 0;
    `;
    
    sidebarContainer.parentNode?.insertBefore(splitter, sidebarContainer);
    
    this.sidebarPane = pane;
    
    // 初始隐藏
    this.hide();
  }
  
  /**
   * 创建标题栏
   */
  private createHeader(doc: Document): HTMLElement {
    const header = doc.createElement("div");
    header.style.cssText = `
      display: flex;
      align-items: center;
      padding: 10px;
      border-bottom: 1px solid var(--material-border-quarternary);
      background: var(--material-sidepane);
    `;
    
    // 标题
    const title = doc.createElement("h3");
    title.style.cssText = `
      flex: 1;
      margin: 0;
      font-size: 1.1em;
    `;
    title.textContent = "Research Navigator";
    header.appendChild(title);
    
    // 切换按钮（切换到浮动面板）
    const toggleBtn = doc.createElement("button");
    toggleBtn.innerHTML = "⇄";
    toggleBtn.title = "Switch to floating panel";
    toggleBtn.style.cssText = `
      padding: 4px 8px;
      margin-right: 5px;
      cursor: pointer;
      border: 1px solid var(--material-border-quarternary);
      background: var(--material-button);
      border-radius: 3px;
    `;
    toggleBtn.addEventListener("click", () => {
      this.window.dispatchEvent(new Event("research-navigator-toggle-mode"));
    });
    header.appendChild(toggleBtn);
    
    // 关闭按钮
    const closeBtn = doc.createElement("button");
    closeBtn.innerHTML = "✕";
    closeBtn.title = "Close sidebar";
    closeBtn.style.cssText = `
      padding: 4px 8px;
      cursor: pointer;
      border: 1px solid var(--material-border-quarternary);
      background: var(--material-button);
      border-radius: 3px;
    `;
    closeBtn.addEventListener("click", () => this.hide());
    header.appendChild(closeBtn);
    
    return header;
  }
  
  /**
   * 设置监听器
   */
  private setupListeners(): void {
    // 监听窗口大小变化
    this.window.addEventListener("resize", () => {
      this.adjustSize();
    });
  }
  
  /**
   * 显示侧边栏
   */
  show(): void {
    if (!this.sidebarPane) return;
    
    this.sidebarPane.style.display = "flex";
    const splitter = this.window.document.getElementById("research-navigator-splitter");
    if (splitter) {
      splitter.style.display = "block";
    }
    
    // 更新内容
    this.updateContent();
    
    // 调整大小
    this.adjustSize();
    
    Zotero.log("[SidebarManager] Sidebar shown", "info");
  }
  
  /**
   * 隐藏侧边栏
   */
  hide(): void {
    if (!this.sidebarPane) return;
    
    this.sidebarPane.style.display = "none";
    const splitter = this.window.document.getElementById("research-navigator-splitter");
    if (splitter) {
      splitter.style.display = "none";
    }
    
    Zotero.log("[SidebarManager] Sidebar hidden", "info");
  }
  
  /**
   * 切换侧边栏显示
   */
  toggle(): void {
    if (this.isVisible()) {
      this.hide();
    } else {
      this.show();
    }
  }
  
  /**
   * 检查是否可见
   */
  isVisible(): boolean {
    return this.sidebarPane && this.sidebarPane.style.display !== "none";
  }
  
  /**
   * 更新内容
   */
  updateContent(): void {
    if (!this.contentContainer) return;
    
    // 清空现有内容
    this.contentContainer.innerHTML = "";
    
    // 获取新内容
    const content = this.onContentRequest();
    if (content) {
      this.contentContainer.appendChild(content);
    }
  }
  
  /**
   * 调整大小
   */
  private adjustSize(): void {
    if (!this.sidebarPane) return;
    
    // 获取保存的宽度
    const savedWidth = Zotero.Prefs.get("extensions.zotero.researchnavigator.sidebarWidth");
    if (savedWidth) {
      this.sidebarPane.style.width = `${savedWidth}px`;
    }
    
    // 监听宽度变化
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "attributes" && mutation.attributeName === "width") {
          const newWidth = parseInt(this.sidebarPane.getAttribute("width") || "350");
          Zotero.Prefs.set("extensions.zotero.researchnavigator.sidebarWidth", newWidth);
        }
      });
    });
    
    observer.observe(this.sidebarPane, {
      attributes: true,
      attributeFilter: ["width"]
    });
  }
  
  /**
   * 销毁
   */
  destroy(): void {
    if (this.sidebarPane && this.sidebarPane.parentNode) {
      this.sidebarPane.parentNode.removeChild(this.sidebarPane);
    }
    
    const splitter = this.window.document.getElementById("research-navigator-splitter");
    if (splitter && splitter.parentNode) {
      splitter.parentNode.removeChild(splitter);
    }
    
    this.sidebarPane = null;
    this.contentContainer = null;
    this.initialized = false;
  }
}