/**
 * 快速笔记浮动按钮
 * 在每个标签页右下角显示
 */

import { QuickNoteWindow } from "./quick-note-window";
import { NoteAssociationSystem } from "../../managers/note-association-system";
import { HistoryService } from "../../services/history-service";

export class QuickNoteButton {
  private button: HTMLElement | null = null;
  private quickNoteWindow: QuickNoteWindow | null = null;
  private intervalId: number | null = null;

  constructor(
    private window: Window,
    private noteAssociationSystem: NoteAssociationSystem,
    private historyService: HistoryService,
  ) {}

  /**
   * 初始化
   */
  async initialize(): Promise<void> {
    try {
      Zotero.log("[QuickNoteButton] Initializing...", "info");

      // 创建快速笔记窗口实例
      this.quickNoteWindow = new QuickNoteWindow(
        this.window,
        this.noteAssociationSystem,
        this.historyService,
      );

      // 等待DOM准备就绪
      await this.waitForDOM();

      // 直接在主窗口创建按钮
      this.createFloatingButton();

      // 开始监听标签页变化
      this.observeTabChanges();

      Zotero.log("[QuickNoteButton] Initialized successfully", "info");
    } catch (error) {
      Zotero.logError(`[QuickNoteButton] Initialization error: ${error}`);
    }
  }

  /**
   * 等待DOM准备就绪
   */
  private async waitForDOM(): Promise<void> {
    const doc = this.window.document;

    // 如果body已存在，直接返回
    if (doc.body) {
      return;
    }

    // 等待DOM准备就绪
    return new Promise((resolve) => {
      if (doc.readyState === "loading") {
        doc.addEventListener("DOMContentLoaded", () => resolve());
      } else {
        // 等待下一个事件循环
        this.window.setTimeout(() => resolve(), 0);
      }
    });
  }

  /**
   * 创建浮动按钮
   */
  private createFloatingButton(): void {
    try {
      Zotero.log("[QuickNoteButton] Creating floating button...", "info");

      const doc = this.window.document;

      // 再次检查body是否存在
      if (!doc.body) {
        Zotero.logError("[QuickNoteButton] Document body still not available");
        // 稍后重试
        this.window.setTimeout(() => this.createFloatingButton(), 100);
        return;
      }

      // 检查是否已存在
      if (this.button || doc.getElementById("quick-note-floating-button")) {
        Zotero.log("[QuickNoteButton] Button already exists", "info");
        return;
      }

      // 创建按钮
      this.button = doc.createElement("div");
      this.button.id = "quick-note-floating-button";
      this.button.style.cssText = `
        position: fixed;
        bottom: 30px;
        right: 30px;
        width: 56px;
        height: 56px;
        background: #2196F3;
        border-radius: 50%;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        transition: all 0.3s ease;
        user-select: none;
      `;

      // 添加图标
      this.button.innerHTML = `<span style="font-size: 24px; color: white;">📝</span>`;

      // 添加悬停效果
      this.button.addEventListener("mouseenter", () => {
        if (this.button) {
          this.button.style.transform = "scale(1.1)";
          this.button.style.boxShadow = "0 4px 20px rgba(0,0,0,0.3)";
        }
      });

      this.button.addEventListener("mouseleave", () => {
        if (this.button) {
          this.button.style.transform = "scale(1)";
          this.button.style.boxShadow = "0 2px 10px rgba(0,0,0,0.2)";
        }
      });

      // 添加点击事件
      this.button.addEventListener("click", () => this.handleClick());

      // 添加提示
      this.button.title = "Quick Note (Click to open)";

      // 设置初始显示状态
      this.button.style.display = "none"; // 初始隐藏，等待updateButton决定

      // 添加到文档
      doc.body.appendChild(this.button);

      Zotero.log("[QuickNoteButton] Button created and added to body", "info");

      // 立即更新按钮显示状态
      // 延迟一下以确保标签页DOM已经加载
      this.window.setTimeout(() => {
        this.updateButton();
      }, 100);
    } catch (error) {
      Zotero.logError(`[QuickNoteButton] Create button error: ${error}`);
    }
  }

  /**
   * 监听标签页变化
   */
  private observeTabChanges(): void {
    try {
      // 监听标签页切换事件
      this.window.addEventListener("select", (e) => {
        if ((e.target as any)?.id === "zotero-tabs") {
          setTimeout(() => this.updateButton(), 100);
        }
      });

      // 监听 tabbox 的选择变化
      const tabbox = this.window.document.getElementById("zotero-tabs");
      if (tabbox) {
        tabbox.addEventListener("select", () => {
          setTimeout(() => this.updateButton(), 100);
        });
      }

      // 定期检查标签页变化（作为备用方案）
      this.intervalId = this.window.setInterval(() => {
        this.updateButton();
      }, 1000) as unknown as number;

      Zotero.log("[QuickNoteButton] Tab change observers set up", "info");
    } catch (error) {
      Zotero.logError(
        `[QuickNoteButton] Error setting up tab observers: ${error}`,
      );
    }
  }

  /**
   * 更新按钮显示
   */
  private updateButton(): void {
    try {
      if (!this.button) {
        Zotero.log("[QuickNoteButton] No button to update", "info");
        return;
      }

      // 获取当前活动的标签页
      const activeTab = this.getActiveTab();
      Zotero.log(
        `[QuickNoteButton] Active tab: ${activeTab ? activeTab.id : "none"}`,
        "info",
      );

      if (!activeTab) {
        this.button.style.display = "none";
        return;
      }

      // 检查是否应该显示按钮
      const shouldShow = this.shouldShowButton(activeTab);
      Zotero.log(`[QuickNoteButton] Should show button: ${shouldShow}`, "info");

      this.button.style.display = shouldShow ? "flex" : "none";
    } catch (error) {
      Zotero.logError(`[QuickNoteButton] Update button error: ${error}`);
    }
  }

  /**
   * 获取当前活动的标签页
   */
  private getActiveTab(): Element | null {
    // 首先检查主界面
    const zoteroPane = this.window.document.getElementById("zotero-pane");
    if (zoteroPane && !zoteroPane.hidden) {
      return zoteroPane;
    }

    // 获取标签页容器
    const deck = this.window.document.getElementById("zotero-tabs-deck");
    if (!deck) {
      // 如果没有tabs-deck，可能是旧版本，返回zotero-pane
      return zoteroPane;
    }

    // 获取选中的标签页
    const selectedTab = deck.querySelector('[selected="true"]');
    if (selectedTab) return selectedTab;

    // 备用方法：获取可见的标签页
    const visibleTab = deck.querySelector(':not([hidden="true"])');
    return visibleTab || zoteroPane;
  }

  /**
   * 判断是否应该显示按钮
   */
  private shouldShowButton(tab: Element | null): boolean {
    if (!tab) return false;

    // 如果是zotero-pane，始终显示
    if (tab.id === "zotero-pane") {
      return true;
    }

    const tabType =
      tab.getAttribute("data-tab-type") || tab.getAttribute("type");

    // 在这些标签页类型中显示按钮
    const allowedTypes = ["library", "reader", "note", "web"];

    // 如果没有类型信息，检查是否是标签页内容
    if (!tabType) {
      return (
        tab.classList.contains("zotero-tab-content") ||
        tab.tagName.toLowerCase() === "tabpanel"
      );
    }

    return allowedTypes.includes(tabType);
  }

  // Remove showButton and hideButton methods as they're no longer needed
  // The button visibility is now controlled by display style in updateButton

  /**
   * 处理点击事件
   */
  private async handleClick(): Promise<void> {
    try {
      if (!this.quickNoteWindow) {
        Zotero.logError("[QuickNoteButton] Quick note window not initialized");
        return;
      }

      // 获取当前选中的项目（如果有）
      const selectedItems = Zotero.getActiveZoteroPane()?.getSelectedItems();
      let nodeId: string | undefined;

      if (selectedItems && selectedItems.length === 1) {
        const item = selectedItems[0];
        if (!item.isNote()) {
          // 为选中的项目创建历史节点
          const node = await this.historyService.createOrUpdateNode(item.id);
          nodeId = node.id;
        }
      }

      // 显示快速笔记窗口
      await this.quickNoteWindow.show(nodeId);

      // 添加点击动画
      this.animateClick();
    } catch (error) {
      Zotero.logError(`[QuickNoteButton] Click handler error: ${error}`);
    }
  }

  /**
   * 点击动画
   */
  private animateClick(): void {
    if (!this.button) return;

    // 创建涟漪效果
    const ripple = this.window.document.createElement("div");
    ripple.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      width: 0;
      height: 0;
      border-radius: 50%;
      background: rgba(255,255,255,0.5);
      transform: translate(-50%, -50%);
      pointer-events: none;
    `;

    this.button.appendChild(ripple);

    // 动画
    ripple.animate(
      [
        { width: "0px", height: "0px", opacity: 1 },
        { width: "100px", height: "100px", opacity: 0 },
      ],
      {
        duration: 600,
        easing: "ease-out",
      },
    ).onfinish = () => ripple.remove();
  }

  /**
   * 销毁
   */
  destroy(): void {
    // 清理定时器
    if (this.intervalId) {
      this.window.clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // 移除按钮
    if (this.button) {
      this.button.remove();
      this.button = null;
    }

    // 清理快速笔记窗口
    if (this.quickNoteWindow) {
      this.quickNoteWindow.close();
      this.quickNoteWindow = null;
    }

    Zotero.log("[QuickNoteButton] Destroyed", "info");
  }
}
