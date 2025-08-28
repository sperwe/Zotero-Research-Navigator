/**
 * Zotero 7 专用的工具栏按钮
 * 基于实际的 Zotero 7 源代码结构
 */

export class ToolbarButtonZotero7 {
  private window: Window;
  private button: any = null;
  private onPanelToggle: (() => void) | null = null;
  private onModeChange: ((mode: "floating" | "sidebar") => void) | null = null;

  constructor(window: Window, options?: { 
    onPanelToggle?: () => void;
    onModeChange?: (mode: "floating" | "sidebar") => void;
  }) {
    this.window = window;
    this.onPanelToggle = options?.onPanelToggle || null;
    this.onModeChange = options?.onModeChange || null;
  }

  async create(): Promise<void> {
    const doc = this.window.document;
    
    Zotero.log("[ToolbarButtonZotero7] Starting creation...", "info");
    
    // 首先检查是否已存在按钮，避免重复
    const existingButton = doc.getElementById("research-navigator-button");
    if (existingButton) {
      Zotero.log("[ToolbarButtonZotero7] Button already exists, removing old one", "info");
      existingButton.remove();
    }
    
    // 基于 Zotero 7 源代码，主要工具栏是 zotero-items-toolbar
    // 它在 <hbox id="zotero-items-toolbar"> 内
    let toolbar = doc.getElementById("zotero-items-toolbar");
    
    if (!toolbar) {
      // 备选：尝试集合工具栏
      toolbar = doc.getElementById("zotero-collections-toolbar");
    }
    
    if (!toolbar) {
      // 最后尝试：标签栏工具栏
      toolbar = doc.getElementById("zotero-tabs-toolbar");
    }
    
    if (!toolbar) {
      throw new Error("No Zotero toolbar found");
    }
    
    Zotero.log(`[ToolbarButtonZotero7] Found toolbar: ${toolbar.id}`, "info");
    
    // 创建按钮 - 使用 Zotero 的标准样式
    this.button = doc.createXULElement("toolbarbutton");
    this.button.id = "research-navigator-button";
    this.button.className = "zotero-tb-button"; // Zotero 标准按钮类
    this.button.setAttribute("tabindex", "-1");
    this.button.setAttribute("data-l10n-id", "research-navigator-button");
    this.button.setAttribute("tooltiptext", "Research Navigator");
    
    // 设置图标样式 - 使用树形图标
    this.button.style.listStyleImage = `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path fill="context-fill" fill-opacity="context-fill-opacity" d="M3 2v3h2v7H3v3h4v-3h2V8h2v4H9v3h4v-3h-2V7H9V5h2V2H9v3H7V2H3zm1 1h2v1H4V3zm6 0h2v1h-2V3zm0 9h2v1h-2v-1zM4 12h2v1H4v-1z"/></svg>')`;
    
    // 添加悬停效果
    this.button.addEventListener("mouseenter", () => {
      this.button.style.opacity = "0.8";
    });
    
    this.button.addEventListener("mouseleave", () => {
      this.button.style.opacity = "1";
    });
    
    // 点击事件
    this.button.addEventListener("command", (event: Event) => {
      Zotero.log("[ToolbarButtonZotero7] Button clicked", "info");
      if (this.onPanelToggle) {
        this.onPanelToggle();
      } else {
        this.showPanel();
      }
    });
    
    // 右键菜单
    this.button.addEventListener("contextmenu", (event: Event) => {
      event.preventDefault();
      this.showContextMenu(event);
    });
    
    // 找到最佳插入位置
    const insertPosition = this.findInsertPosition(toolbar);
    
    if (insertPosition) {
      toolbar.insertBefore(this.button, insertPosition);
      Zotero.log(`[ToolbarButtonZotero7] Button inserted at specified position`, "info");
    } else {
      // 在搜索框之前插入（spacer 之前）
      const spacer = toolbar.querySelector("spacer[flex='1']");
      if (spacer) {
        toolbar.insertBefore(this.button, spacer);
        Zotero.log("[ToolbarButtonZotero7] Button inserted before spacer", "info");
      } else {
        // 默认添加到末尾
        toolbar.appendChild(this.button);
        Zotero.log("[ToolbarButtonZotero7] Button appended to toolbar", "info");
      }
    }
    
    // 调试：列出工具栏中的所有子元素
    const toolbarChildren = Array.from(toolbar.children).map((child: any) => 
      child.id || child.className || child.tagName
    );
    Zotero.log(`[ToolbarButtonZotero7] Toolbar children: ${toolbarChildren.join(", ")}`, "info");
    
    Zotero.log("[ToolbarButtonZotero7] Button created and inserted", "info");
  }
  
  private findInsertPosition(toolbar: any): any {
    const doc = toolbar.ownerDocument;
    
    // 基于 Zotero 7 源代码，最佳位置是在 spacer 之前（笔记按钮之后）
    // 布局：[add] [attachment] [note] [我们的按钮] <spacer flex="1"/> [search]
    
    // 1. 首先尝试找到笔记按钮
    const noteButton = doc.getElementById("zotero-tb-note-add");
    if (noteButton && noteButton.nextSibling) {
      return noteButton.nextSibling;
    }
    
    // 2. 如果没有笔记按钮，尝试附件按钮
    const attachmentButton = doc.getElementById("zotero-tb-attachment-add");
    if (attachmentButton && attachmentButton.nextSibling) {
      return attachmentButton.nextSibling;
    }
    
    // 3. 尝试找到 spacer（在搜索框之前）
    const searchBox = doc.getElementById("zotero-tb-search");
    if (searchBox && searchBox.previousElementSibling?.tagName === "spacer") {
      return searchBox.previousElementSibling;
    }
    
    // 4. 如果都没找到，在搜索框之前插入
    if (searchBox) {
      return searchBox;
    }
    
    // 5. 最后的选择，返回 null 添加到末尾
    return null;
  }
  
  private showPanel(): void {
    const win = this.window;
    const doc = win.document;
    
    // 检查是否已有面板
    let panel = doc.getElementById("research-navigator-panel");
    
    if (panel) {
      // 切换显示/隐藏
      if (panel.style.display === "none") {
        panel.style.display = "block";
      } else {
        panel.style.display = "none";
      }
      return;
    }
    
    // 创建一个简单的面板
    panel = doc.createElement("div");
    panel.id = "research-navigator-panel";
    panel.style.cssText = `
      position: fixed;
      top: 100px;
      right: 20px;
      width: 300px;
      height: 400px;
      background: var(--material-background, white);
      border: 1px solid var(--material-border-quarternary, #ccc);
      border-radius: 5px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      z-index: 1000;
      padding: 15px;
      overflow: auto;
    `;
    
    // 添加标题
    const title = doc.createElement("h3");
    title.textContent = "Research Navigator";
    title.style.marginTop = "0";
    panel.appendChild(title);
    
    // 添加内容
    const content = doc.createElement("div");
    content.innerHTML = `
      <p>Research Navigator is active!</p>
      <p>Features coming soon:</p>
      <ul>
        <li>History Tree</li>
        <li>Closed Tabs</li>
        <li>Note Associations</li>
      </ul>
    `;
    panel.appendChild(content);
    
    // 添加关闭按钮
    const closeBtn = doc.createElement("button");
    closeBtn.textContent = "Close";
    closeBtn.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      padding: 5px 10px;
      cursor: pointer;
    `;
    closeBtn.addEventListener("click", () => {
      panel.style.display = "none";
    });
    panel.appendChild(closeBtn);
    
    // 添加到文档
    if (doc.body) {
      doc.body.appendChild(panel);
    } else {
      doc.documentElement.appendChild(panel);
    }
  }
  
  /**
   * 显示右键菜单
   */
  private showContextMenu(event: Event): void {
    const doc = this.window.document;
    const mouseEvent = event as MouseEvent;
    
    // 创建弹出菜单
    const popup = doc.createXULElement("menupopup");
    popup.id = "research-navigator-context-menu";
    
    // 浮动面板选项
    const floatingItem = doc.createXULElement("menuitem");
    floatingItem.setAttribute("label", "Floating Panel");
    floatingItem.setAttribute("type", "radio");
    floatingItem.setAttribute("name", "display-mode");
    floatingItem.setAttribute("checked", "true");
    floatingItem.addEventListener("command", () => {
      if (this.onModeChange) {
        this.onModeChange("floating");
      }
      popup.hidePopup();
    });
    popup.appendChild(floatingItem);
    
    // 侧边栏选项
    const sidebarItem = doc.createXULElement("menuitem");
    sidebarItem.setAttribute("label", "Sidebar");
    sidebarItem.setAttribute("type", "radio");
    sidebarItem.setAttribute("name", "display-mode");
    sidebarItem.addEventListener("command", () => {
      if (this.onModeChange) {
        this.onModeChange("sidebar");
      }
      popup.hidePopup();
    });
    popup.appendChild(sidebarItem);
    
    // 分隔线
    const separator = doc.createXULElement("menuseparator");
    popup.appendChild(separator);
    
    // 设置选项
    const settingsItem = doc.createXULElement("menuitem");
    settingsItem.setAttribute("label", "Settings...");
    settingsItem.addEventListener("command", () => {
      // TODO: 打开设置对话框
      Zotero.log("[ToolbarButtonZotero7] Settings clicked", "info");
      popup.hidePopup();
    });
    popup.appendChild(settingsItem);
    
    // 添加到文档并显示
    doc.documentElement.appendChild(popup);
    popup.openPopupAtScreen(mouseEvent.screenX, mouseEvent.screenY, true);
    
    // 自动清理
    popup.addEventListener("popuphidden", () => {
      popup.remove();
    });
  }
  
  destroy(): void {
    if (this.button && this.button.parentNode) {
      this.button.parentNode.removeChild(this.button);
    }
    
    const panel = this.window.document.getElementById("research-navigator-panel");
    if (panel) {
      panel.remove();
    }
    
    this.button = null;
  }
}