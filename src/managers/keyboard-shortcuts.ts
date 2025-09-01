export interface KeyboardShortcut {
  id: string;
  key: string;
  modifiers: ("ctrl" | "alt" | "shift" | "meta")[];
  description: string;
  category: "navigation" | "editing" | "search" | "view" | "general";
  action: () => void | Promise<void>;
  enabled: boolean;
}

export class KeyboardShortcutManager {
  private shortcuts = new Map<string, KeyboardShortcut>();
  private defaultShortcuts: KeyboardShortcut[] = [];
  private customShortcuts = new Map<string, Partial<KeyboardShortcut>>();

  constructor(private window: Window) {
    this.initializeDefaultShortcuts();
    this.loadCustomShortcuts();
    this.attachEventListeners();
  }

  /**
   * 初始化默认快捷键
   */
  private initializeDefaultShortcuts(): void {
    this.defaultShortcuts = [
      // 导航快捷键
      {
        id: "toggle-panel",
        key: "p",
        modifiers: ["ctrl", "shift"],
        description: "Toggle research navigator panel",
        category: "navigation",
        action: () => {
          const event = new CustomEvent("research-navigator-toggle-panel");
          this.window.dispatchEvent(event);
        },
        enabled: true,
      },
      {
        id: "switch-to-history",
        key: "1",
        modifiers: ["alt"],
        description: "Switch to History tab",
        category: "navigation",
        action: () => this.switchTab("history"),
        enabled: true,
      },
      {
        id: "switch-to-notes",
        key: "2",
        modifiers: ["alt"],
        description: "Switch to Notes tab",
        category: "navigation",
        action: () => this.switchTab("notes"),
        enabled: true,
      },
      {
        id: "switch-to-search",
        key: "3",
        modifiers: ["alt"],
        description: "Switch to Search tab",
        category: "navigation",
        action: () => this.switchTab("search"),
        enabled: true,
      },

      // 搜索快捷键
      {
        id: "quick-search",
        key: "f",
        modifiers: ["ctrl", "shift"],
        description: "Focus on search box",
        category: "search",
        action: () => this.focusSearch(),
        enabled: true,
      },
      {
        id: "advanced-search",
        key: "f",
        modifiers: ["ctrl", "alt"],
        description: "Open advanced search",
        category: "search",
        action: () => this.openAdvancedSearch(),
        enabled: true,
      },

      // 编辑快捷键
      {
        id: "create-note",
        key: "n",
        modifiers: ["ctrl", "shift"],
        description: "Create new note",
        category: "editing",
        action: () => this.createNewNote(),
        enabled: true,
      },
      {
        id: "save-note",
        key: "s",
        modifiers: ["ctrl"],
        description: "Save current note",
        category: "editing",
        action: () => this.saveCurrentNote(),
        enabled: true,
      },

      // 视图快捷键
      {
        id: "expand-all",
        key: "e",
        modifiers: ["ctrl", "shift"],
        description: "Expand all nodes",
        category: "view",
        action: () => this.expandAllNodes(),
        enabled: true,
      },
      {
        id: "collapse-all",
        key: "c",
        modifiers: ["ctrl", "shift"],
        description: "Collapse all nodes",
        category: "view",
        action: () => this.collapseAllNodes(),
        enabled: true,
      },
      {
        id: "refresh",
        key: "r",
        modifiers: ["ctrl", "shift"],
        description: "Refresh current view",
        category: "view",
        action: () => this.refresh(),
        enabled: true,
      },

      // 通用快捷键
      {
        id: "help",
        key: "?",
        modifiers: ["shift"],
        description: "Show keyboard shortcuts help",
        category: "general",
        action: () => this.showHelp(),
        enabled: true,
      },
      {
        id: "export",
        key: "e",
        modifiers: ["ctrl", "alt"],
        description: "Export current view",
        category: "general",
        action: () => this.exportCurrentView(),
        enabled: true,
      },
    ];

    // 注册默认快捷键
    for (const shortcut of this.defaultShortcuts) {
      this.registerShortcut(shortcut);
    }
  }

  /**
   * 注册快捷键
   */
  registerShortcut(shortcut: KeyboardShortcut): void {
    const key = this.getShortcutKey(shortcut);
    this.shortcuts.set(key, shortcut);
  }

  /**
   * 取消注册快捷键
   */
  unregisterShortcut(id: string): void {
    for (const [key, shortcut] of this.shortcuts.entries()) {
      if (shortcut.id === id) {
        this.shortcuts.delete(key);
        break;
      }
    }
  }

  /**
   * 更新快捷键
   */
  updateShortcut(id: string, updates: Partial<KeyboardShortcut>): void {
    const existing = this.getShortcutById(id);
    if (!existing) return;

    // 移除旧的
    this.unregisterShortcut(id);

    // 注册新的
    const updated = { ...existing, ...updates };
    this.registerShortcut(updated);

    // 保存自定义
    this.customShortcuts.set(id, updates);
    this.saveCustomShortcuts();
  }

  /**
   * 获取快捷键的键值
   */
  private getShortcutKey(shortcut: KeyboardShortcut): string {
    const parts = [...shortcut.modifiers.sort(), shortcut.key.toLowerCase()];
    return parts.join("+");
  }

  /**
   * 通过 ID 获取快捷键
   */
  private getShortcutById(id: string): KeyboardShortcut | undefined {
    for (const shortcut of this.shortcuts.values()) {
      if (shortcut.id === id) {
        return shortcut;
      }
    }
    return undefined;
  }

  /**
   * 附加事件监听器
   */
  private attachEventListeners(): void {
    this.window.addEventListener("keydown", (e) => this.handleKeyDown(e));
  }

  /**
   * 处理按键事件
   */
  private handleKeyDown(e: KeyboardEvent): void {
    // 忽略输入框中的按键
    const target = e.target as HTMLElement;
    if (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable
    ) {
      return;
    }

    // 构建按键组合
    const modifiers: string[] = [];
    if (e.ctrlKey) modifiers.push("ctrl");
    if (e.altKey) modifiers.push("alt");
    if (e.shiftKey) modifiers.push("shift");
    if (e.metaKey) modifiers.push("meta");

    const key = [...modifiers.sort(), e.key.toLowerCase()].join("+");

    // 查找匹配的快捷键
    const shortcut = this.shortcuts.get(key);
    if (shortcut && shortcut.enabled) {
      e.preventDefault();
      e.stopPropagation();

      try {
        shortcut.action();
      } catch (error) {
        Zotero.logError(
          `[KeyboardShortcuts] Error executing shortcut ${shortcut.id}: ${error}`,
        );
      }
    }
  }

  /**
   * 快捷键动作实现
   */
  private switchTab(tabId: string): void {
    const event = new CustomEvent("research-navigator-switch-tab", {
      detail: { tabId },
    });
    this.window.dispatchEvent(event);
  }

  private focusSearch(): void {
    const searchInput = this.window.document.querySelector(
      ".hts-search-input",
    ) as HTMLInputElement;
    if (searchInput) {
      searchInput.focus();
      searchInput.select();
    }
  }

  private openAdvancedSearch(): void {
    this.switchTab("search");
  }

  private createNewNote(): void {
    const event = new CustomEvent("research-navigator-create-note");
    this.window.dispatchEvent(event);
  }

  private saveCurrentNote(): void {
    const event = new CustomEvent("research-navigator-save-note");
    this.window.dispatchEvent(event);
  }

  private expandAllNodes(): void {
    const event = new CustomEvent("research-navigator-expand-all");
    this.window.dispatchEvent(event);
  }

  private collapseAllNodes(): void {
    const event = new CustomEvent("research-navigator-collapse-all");
    this.window.dispatchEvent(event);
  }

  private refresh(): void {
    const event = new CustomEvent("research-navigator-refresh");
    this.window.dispatchEvent(event);
  }

  private exportCurrentView(): void {
    const event = new CustomEvent("research-navigator-export");
    this.window.dispatchEvent(event);
  }

  /**
   * 显示帮助
   */
  showHelp(): void {
    const doc = this.window.document;

    // 创建帮助对话框
    const dialog = doc.createElement("div");
    dialog.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      border: 1px solid var(--material-border);
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.2);
      max-width: 600px;
      max-height: 80vh;
      overflow: hidden;
      z-index: 10000;
    `;

    // 标题
    const header = doc.createElement("div");
    header.style.cssText = `
      padding: 16px 20px;
      border-bottom: 1px solid var(--material-border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;
    header.innerHTML = `
      <h3 style="margin: 0;">Keyboard Shortcuts</h3>
      <button style="background: none; border: none; font-size: 20px; cursor: pointer;">✕</button>
    `;
    dialog.appendChild(header);

    // 内容
    const content = doc.createElement("div");
    content.style.cssText = `
      padding: 20px;
      overflow-y: auto;
      max-height: calc(80vh - 100px);
    `;

    // 按类别分组显示快捷键
    const categories = ["navigation", "search", "editing", "view", "general"];
    const categoryLabels = {
      navigation: "Navigation",
      search: "Search",
      editing: "Editing",
      view: "View",
      general: "General",
    };

    for (const category of categories) {
      const categoryShortcuts = Array.from(this.shortcuts.values()).filter(
        (s) => s.category === category && s.enabled,
      );

      if (categoryShortcuts.length === 0) continue;

      const section = doc.createElement("div");
      section.style.marginBottom = "20px";

      const title = doc.createElement("h4");
      title.style.cssText = `
        margin: 0 0 10px 0;
        color: var(--fill-secondary);
        font-size: 14px;
        text-transform: uppercase;
      `;
      title.textContent =
        categoryLabels[category as keyof typeof categoryLabels];
      section.appendChild(title);

      const list = doc.createElement("div");

      for (const shortcut of categoryShortcuts) {
        const item = doc.createElement("div");
        item.style.cssText = `
          display: flex;
          justify-content: space-between;
          padding: 5px 0;
          font-size: 13px;
        `;

        const desc = doc.createElement("span");
        desc.textContent = shortcut.description;

        const keys = doc.createElement("span");
        keys.style.cssText = `
          font-family: monospace;
          background: var(--material-button);
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 12px;
        `;
        keys.textContent = [
          ...shortcut.modifiers.map(
            (m) => m.charAt(0).toUpperCase() + m.slice(1),
          ),
          shortcut.key.toUpperCase(),
        ].join("+");

        item.appendChild(desc);
        item.appendChild(keys);
        list.appendChild(item);
      }

      section.appendChild(list);
      content.appendChild(section);
    }

    dialog.appendChild(content);

    // 关闭按钮事件
    const closeBtn = header.querySelector("button");
    closeBtn?.addEventListener("click", () => {
      dialog.remove();
    });

    // 点击外部关闭
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog) {
        dialog.remove();
      }
    });

    // ESC 关闭
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        dialog.remove();
        doc.removeEventListener("keydown", escHandler);
      }
    };
    doc.addEventListener("keydown", escHandler);

    doc.body.appendChild(dialog);
  }

  /**
   * 获取所有快捷键
   */
  getAllShortcuts(): KeyboardShortcut[] {
    return Array.from(this.shortcuts.values());
  }

  /**
   * 获取按类别分组的快捷键
   */
  getShortcutsByCategory(): Map<string, KeyboardShortcut[]> {
    const grouped = new Map<string, KeyboardShortcut[]>();

    for (const shortcut of this.shortcuts.values()) {
      const category = shortcut.category;
      if (!grouped.has(category)) {
        grouped.set(category, []);
      }
      grouped.get(category)!.push(shortcut);
    }

    return grouped;
  }

  /**
   * 保存自定义快捷键
   */
  private saveCustomShortcuts(): void {
    const data = Object.fromEntries(this.customShortcuts);
    Zotero.Prefs.set("researchnavigator.customShortcuts", JSON.stringify(data));
  }

  /**
   * 加载自定义快捷键
   */
  private loadCustomShortcuts(): void {
    try {
      const saved = Zotero.Prefs.get("researchnavigator.customShortcuts");
      if (saved) {
        const data = JSON.parse(saved);
        for (const [id, updates] of Object.entries(data)) {
          this.updateShortcut(id, updates as Partial<KeyboardShortcut>);
        }
      }
    } catch (error) {
      Zotero.logError(
        `[KeyboardShortcuts] Error loading custom shortcuts: ${error}`,
      );
    }
  }

  /**
   * 重置到默认快捷键
   */
  resetToDefaults(): void {
    this.shortcuts.clear();
    this.customShortcuts.clear();

    for (const shortcut of this.defaultShortcuts) {
      this.registerShortcut(shortcut);
    }

    this.saveCustomShortcuts();
  }

  /**
   * 销毁
   */
  destroy(): void {
    this.shortcuts.clear();
    this.customShortcuts.clear();
  }
}
