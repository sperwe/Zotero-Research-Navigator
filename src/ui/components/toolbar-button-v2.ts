/**
 * 改进的工具栏按钮，更好地查找 Zotero 主工具栏
 */

export class ToolbarButtonV2 {
  private window: Window;
  private button: any = null;

  constructor(window: Window) {
    this.window = window;
  }

  async create(): Promise<void> {
    const doc = this.window.document;

    // 方法1: 查找主工具栏（通过类名和位置）
    let toolbar = this.findMainToolbar(doc);

    if (!toolbar) {
      // 方法2: 查找任何包含 Zotero 操作按钮的工具栏
      toolbar = this.findToolbarWithZoteroButtons(doc);
    }

    if (!toolbar) {
      // 方法3: 使用第一个可见的工具栏
      toolbar = this.findFirstVisibleToolbar(doc);
    }

    if (!toolbar) {
      throw new Error("No suitable toolbar found");
    }

    Zotero.log(
      `[ToolbarButtonV2] Using toolbar: ${toolbar.id || toolbar.className || "unknown"}`,
      "info",
    );

    // 创建按钮
    this.button = doc.createXULElement("toolbarbutton");
    this.button.id = "research-navigator-button-v2";
    this.button.setAttribute("label", "Research Navigator");
    this.button.setAttribute(
      "tooltiptext",
      "Research Navigator - Click to open",
    );
    this.button.className = "zotero-tb-button";

    // 设置图标（使用内联 data URI 避免路径问题）
    this.button.style.listStyleImage = `url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAOCAYAAAAfSC3RAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAA7AAAAOwBeShxvQAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAEZSURBVCiRlZKxSgNBEIa/3buQO4gWphGsrCwsxMrCB7DyAXwAKwtfwCfQysLKB7C0sLCwsBGxsLAQEcRgkOTubnZnLHK5S3IJgv92M/PN7M7OiqoyTKiqjCLpUJ8xxpiqqgCIvPehqtr+Px9F0XPW9z6OY7eAXwH7cRzT6/V4vb/n4vSUXrdbWO12Ozuqyg5As9mEIMAYg3OO3dVV5jY36bZagCGRiNSTYNBqMT0zw3StxtvTE/V6naWFBY729wEQEbQgyFkQBIgI+0dHLG5vs7K7y8H5OeVyOZ9sE0LeQClJGBVSSvR9Q2MMiAiZUuJLiTP1YT1f13VJKZHaJ/e9SX4fQCnZMc/nUFrrBCBKd+ScY6L4X/wBH21tEFgLkNcAAAAASUVORK5CYII=')`;

    // 点击事件
    this.button.addEventListener("command", () => {
      Zotero.log("[ToolbarButtonV2] Button clicked!", "info");
      // 显示一个简单的对话框作为测试
      this.window.alert("Research Navigator button clicked!");
    });

    // 查找插入位置
    const insertPosition = this.findBestInsertPosition(toolbar);

    if (insertPosition.before) {
      toolbar.insertBefore(this.button, insertPosition.before);
    } else if (insertPosition.after) {
      insertPosition.after.parentNode.insertBefore(
        this.button,
        insertPosition.after.nextSibling,
      );
    } else {
      // 默认添加到末尾
      toolbar.appendChild(this.button);
    }

    Zotero.log("[ToolbarButtonV2] Button created and inserted", "info");

    // 强制刷新工具栏
    this.forceToolbarRefresh(toolbar);
  }

  private findMainToolbar(doc: Document): any {
    // Zotero 7 的主工具栏通常在顶部
    const toolbars = doc.getElementsByTagName("toolbar");

    for (let i = 0; i < toolbars.length; i++) {
      const toolbar = toolbars[i];

      // 跳过隐藏的工具栏
      if ((toolbar as any).hidden || (toolbar as any).collapsed) continue;

      // 查找包含主要操作的工具栏
      if (
        toolbar.id === "zotero-toolbar" ||
        toolbar.id === "nav-bar" ||
        toolbar.id === "zotero-collections-toolbar"
      ) {
        return toolbar;
      }

      // 查找包含新建条目按钮的工具栏
      if (
        toolbar.querySelector("#zotero-tb-add") ||
        toolbar.querySelector("#zotero-tb-item-add")
      ) {
        return toolbar;
      }
    }

    return null;
  }

  private findToolbarWithZoteroButtons(doc: Document): any {
    const toolbars = doc.getElementsByTagName("toolbar");

    for (let i = 0; i < toolbars.length; i++) {
      const toolbar = toolbars[i];

      // 跳过隐藏的工具栏
      if ((toolbar as any).hidden || (toolbar as any).collapsed) continue;

      // 查找包含任何 Zotero 按钮的工具栏
      const buttons = toolbar.querySelectorAll("toolbarbutton");
      for (let j = 0; j < buttons.length; j++) {
        const button = buttons[j];
        if (button.id && button.id.includes("zotero")) {
          return toolbar;
        }
      }
    }

    return null;
  }

  private findFirstVisibleToolbar(doc: Document): any {
    const toolbars = doc.getElementsByTagName("toolbar");

    for (let i = 0; i < toolbars.length; i++) {
      const toolbar = toolbars[i];

      // 跳过隐藏的工具栏
      if ((toolbar as any).hidden || (toolbar as any).collapsed) continue;

      // 检查是否在可见区域
      const rect = toolbar.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        return toolbar;
      }
    }

    return null;
  }

  private findBestInsertPosition(toolbar: any): { before?: any; after?: any } {
    // 尝试在搜索框之后插入
    const searchBox = toolbar.querySelector("#zotero-tb-search");
    if (searchBox) {
      return { after: searchBox };
    }

    // 尝试在高级搜索按钮之前插入
    const advancedSearch = toolbar.querySelector("#zotero-tb-advanced-search");
    if (advancedSearch) {
      return { before: advancedSearch };
    }

    // 尝试在操作按钮之后插入
    const actionButton = toolbar.querySelector("#zotero-tb-actions-menu");
    if (actionButton) {
      return { after: actionButton };
    }

    return {};
  }

  private forceToolbarRefresh(toolbar: any): void {
    // 强制工具栏重新布局
    if (toolbar.style) {
      const display = toolbar.style.display;
      toolbar.style.display = "none";
      toolbar.offsetHeight; // 强制重排
      toolbar.style.display = display;
    }
  }

  destroy(): void {
    if (this.button && this.button.parentNode) {
      this.button.parentNode.removeChild(this.button);
    }
    this.button = null;
  }
}
