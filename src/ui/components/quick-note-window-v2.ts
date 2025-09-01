/**
 * 快速笔记窗口 V2 - 更稳定的实现
 */

import { NoteAssociationSystem } from "../../managers/note-association-system";
import { HistoryService } from "../../services/history-service";
import { BetterNotesCompat } from "../../utils/betternotes-compat";

export class QuickNoteWindowV2 {
  private container: HTMLElement | null = null;
  private editor: any = null;
  private currentNoteId: number | null = null;
  private associatedNodeId: string | null = null;
  private isCreating = false; // 防止重复创建
  private isLoadingNote = false; // 防止重复加载笔记
  private noteContext: string | null = null; // 记录笔记创建时的上下文
  private lastShowTime = 0; // 防抖动
  private pendingNodeId: string | null = null; // 待处理的节点ID
  private window: Window | null = null; // Add window property

  // Pin to Tab 功能
  private isPinned = false; // 是否固定到标签页
  private pinnedContext: string | null = null; // 固定的上下文
  private pinnedTabId: string | null = null; // 固定的标签页ID
  private pinnedTitle: string | null = null; // 固定的标题

  // 自动保存
  private autoSaveTimer: any = null;
  private lastSaveTime = 0;
  private hasUnsavedChanges = false;

  // 笔记历史
  private noteHistory: number[] = []; // 最近使用的笔记ID列表
  private currentHistoryIndex = -1;

  constructor(
    private noteAssociationSystem: NoteAssociationSystem,
    private historyService: HistoryService,
  ) {}

  /**
   * 显示快速笔记窗口
   */
  async show(nodeId?: string): Promise<void> {
    Zotero.log(
      `[QuickNoteWindowV2] show() called with nodeId: ${nodeId}`,
      "info",
    );

    // 防抖动 - 如果在300ms内多次调用，只处理最后一次
    const now = Date.now();
    if (now - this.lastShowTime < 300) {
      Zotero.log("[QuickNoteWindowV2] Debouncing rapid show() calls", "info");
      this.pendingNodeId = nodeId || null;
      return;
    }
    this.lastShowTime = now;

    // 如果已经有容器，直接显示
    if (this.container) {
      // 检查容器是否在 DOM 中
      if (!this.container.parentElement) {
        Zotero.log(
          "[QuickNoteWindowV2] Container exists but not in DOM, re-adding",
          "warn",
        );
        const doc = Zotero.getMainWindow()?.document;
        if (doc) {
          this.appendToDocument(doc);
        }
      }

      Zotero.log(
        `[QuickNoteWindowV2] Reusing existing window, currentNoteId: ${this.currentNoteId}`,
        "info",
      );

      // 强制确保窗口可见
      this.container.style.cssText =
        this.container.style.cssText +
        `
        ; display: flex !important;
        visibility: visible !important;
        opacity: 1 !important;
        z-index: 10001 !important;
      `;

      // 检查是否需要创建新笔记
      const shouldCreateNew = this.shouldCreateNewNote(nodeId);

      if (shouldCreateNew) {
        // 立即更新上下文，防止并发问题
        this.noteContext = nodeId || null;
        this.associatedNodeId = nodeId || null;

        if (!this.isLoadingNote) {
          Zotero.log(
            "[QuickNoteWindowV2] Creating new note based on context change",
            "info",
          );
          this.isLoadingNote = true; // 立即设置标志
          setTimeout(() => this.createNewNote(), 100);
        } else {
          Zotero.log(
            "[QuickNoteWindowV2] Already loading a note, skipping",
            "info",
          );
        }
      } else if (!this.currentNoteId && !this.isLoadingNote) {
        // 没有笔记且不在加载中，创建新笔记
        this.associatedNodeId = nodeId || null;
        this.noteContext = nodeId || null;
        this.isLoadingNote = true; // 立即设置标志
        Zotero.log(
          "[QuickNoteWindowV2] No current note, creating new one",
          "info",
        );
        setTimeout(() => this.createNewNote(), 100);
      } else {
        // 继续使用当前笔记
        this.updateNoteInfo();
      }
      return;
    }

    // 防止重复创建
    if (this.isCreating) {
      Zotero.log(
        "[QuickNoteWindowV2] Already creating window, skipping",
        "info",
      );
      return;
    }

    // 创建新窗口
    this.createWindow(nodeId);

    // 不再自动创建笔记，等待用户操作或窗口完全初始化后再创建
  }

  /**
   * 创建窗口 - 简化版本
   */
  private createWindow(nodeId?: string): void {
    this.isCreating = true;
    this.associatedNodeId = nodeId || null;

    try {
      // 直接使用 Zotero 主窗口
      const win = Zotero.getMainWindow();
      if (!win) {
        Zotero.logError("[QuickNoteWindowV2] No main window available");
        return;
      }

      // 保存 window 引用
      this.window = win;
      const doc = win.document;

      // 创建容器
      this.container = doc.createElement("div");
      this.container.id = "quick-note-window-v2";
      this.container.className = "quick-note-window";

      // 内联样式，避免外部CSS问题
      this.container.style.cssText = `
        position: fixed !important;
        top: 100px !important;
        right: 50px !important;
        width: 450px !important;
        height: 600px !important;
        background: white !important;
        background-color: white !important;
        border: 1px solid #ddd !important;
        border-radius: 8px !important;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15) !important;
        z-index: 10000 !important;
        display: flex !important;
        flex-direction: column !important;
        overflow: hidden !important;
        opacity: 1 !important;
        visibility: visible !important;
      `;

      // 创建内容
      this.container.innerHTML = this.getWindowHTML();

      // 找到合适的父元素并添加
      const added = this.appendToDocument(doc);
      if (!added) {
        Zotero.logError("[QuickNoteWindowV2] Failed to add window to document");
        return;
      }

      // 设置事件处理
      this.setupEventHandlers();

      // 初始化UI状态
      this.updateModeIcon();

      // 初始化编辑器
      const editorContainer = this.container.querySelector(
        "#quick-note-editor-container",
      );
      if (editorContainer) {
        this.initializeEditor(editorContainer as HTMLElement);

        // 窗口初始化完成后，如果没有笔记就创建一个
        setTimeout(() => {
          if (!this.currentNoteId && !this.isLoadingNote) {
            Zotero.log(
              "[QuickNoteWindowV2] No current note, creating new note after window init",
              "info",
            );
            this.isLoadingNote = true; // 立即设置标志
            this.createNewNote();
          } else if (this.currentNoteId) {
            // 如果有笔记，更新信息显示
            this.updateNoteInfo();
          }
        }, 500);
      }

      // 使窗口可拖动
      const header = this.container.querySelector(".quick-note-header");
      if (header) {
        this.makeDraggable(header as HTMLElement);
      }

      Zotero.log("[QuickNoteWindowV2] Window created successfully", "info");
    } catch (error) {
      Zotero.logError(`[QuickNoteWindowV2] Failed to create window: ${error}`);
    } finally {
      this.isCreating = false;
    }
  }

  /**
   * 获取窗口HTML内容
   */
  private getWindowHTML(): string {
    return `
      <div class="quick-note-header" style="
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        background: #f5f5f5;
        border-bottom: 1px solid #ddd;
        cursor: move;
      ">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="quick-note-mode-icon" style="
            font-size: 16px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 24px;
            height: 24px;
            border-radius: 4px;
            background: #e8e8e8;
            color: #666;
            cursor: help;
          " title="Mode: Context">🎯</span>
          <h3 style="margin: 0; font-size: 16px; font-weight: 500;">Quick Note</h3>
          <span class="quick-note-context-info" style="
            font-size: 12px;
            color: #666;
            max-width: 200px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          "></span>
        </div>
        <div style="display: flex; align-items: center; gap: 4px;">
          <span class="quick-note-save-status" style="
            font-size: 12px;
            color: #4CAF50;
            display: none;
            align-items: center;
            gap: 4px;
          ">
            <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: currentColor;"></span>
            Saved
          </span>
          <span class="quick-note-close" role="button" tabindex="0" style="
            background: none;
            border: none;
            font-size: 20px;
            cursor: pointer;
            padding: 0 8px;
            color: #666;
            display: inline-block;
          ">×</span>
        </div>
      </div>
      
      <div class="quick-note-toolbar" style="
        display: flex;
        gap: 8px;
        padding: 8px 16px;
        background: #fafafa;
        border-bottom: 1px solid #eee;
        align-items: center;
      ">
        <span class="quick-note-pin" role="button" tabindex="0" style="
          padding: 4px 8px;
          background: #f0f0f0;
          color: #666;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          transition: all 0.2s;
        " title="Pin to current tab">
          <span style="font-size: 14px;">📌</span>
          <span class="pin-text">Pin to Tab</span>
        </span>
        
        <div style="display: flex; gap: 4px; padding: 0 8px;">
          <span class="quick-note-prev" role="button" tabindex="0" style="
            padding: 2px 6px;
            background: #f0f0f0;
            color: #666;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            display: inline-block;
            font-size: 14px;
            opacity: 0.5;
          " title="Previous note">⬅️</span>
          <span class="quick-note-next" role="button" tabindex="0" style="
            padding: 2px 6px;
            background: #f0f0f0;
            color: #666;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            display: inline-block;
            font-size: 14px;
            opacity: 0.5;
          " title="Next note">➡️</span>
        </div>
        
        <span class="quick-note-info" style="
          flex: 1;
          font-size: 12px;
          color: #666;
          padding: 0 10px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        "></span>
        
        <span class="quick-note-save" role="button" tabindex="0" style="
          padding: 4px 12px;
          background: #2196F3;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          display: inline-block;
        ">Save</span>
        <span class="quick-note-new" role="button" tabindex="0" style="
          padding: 4px 12px;
          background: #4CAF50;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          display: inline-block;
        ">New Note</span>
      </div>
      
      <div id="quick-note-editor-container" style="
        flex: 1;
        overflow: hidden;
        position: relative;
      "></div>
      
      <div class="quick-note-status" style="
        padding: 8px 16px;
        background: #f5f5f5;
        border-top: 1px solid #ddd;
        font-size: 12px;
        color: #666;
      ">
        <span class="status-text">Ready</span>
        <span class="word-count" style="float: right;">0 words</span>
      </div>
    `;
  }

  /**
   * 尝试添加到文档
   */
  private appendToDocument(doc: Document): boolean {
    const targets = [
      { selector: "#main-window", name: "main-window" },
      { selector: "#zotero-pane", name: "zotero-pane" },
      { selector: "#browser", name: "browser" },
      { selector: "body", name: "body" },
      { element: doc.documentElement, name: "documentElement" },
    ];

    for (const target of targets) {
      try {
        const element = target.selector
          ? doc.querySelector(target.selector)
          : target.element;

        if (element && this.container) {
          element.appendChild(this.container);
          Zotero.log(`[QuickNoteWindowV2] Appended to: ${target.name}`, "info");

          // 确保窗口可见
          this.container.style.display = "flex";
          this.container.style.visibility = "visible";

          // 强制重绘
          this.container.offsetHeight;

          return true;
        }
      } catch (e) {
        // Continue to next target
      }
    }

    return false;
  }

  /**
   * 设置事件处理
   */
  private setupEventHandlers(): void {
    if (!this.container) return;

    // 关闭按钮
    const closeBtn = this.container.querySelector(".quick-note-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => this.hide());
    }

    // 保存按钮
    const saveBtn = this.container.querySelector(".quick-note-save");
    if (saveBtn) {
      saveBtn.addEventListener("click", () => this.saveNote());
    }

    // 新建按钮
    const newBtn = this.container.querySelector(".quick-note-new");
    if (newBtn) {
      newBtn.addEventListener("click", () => this.forceCreateNewNote());
    }

    // Pin 按钮
    const pinBtn = this.container.querySelector(".quick-note-pin");
    if (pinBtn) {
      pinBtn.addEventListener("click", () => this.togglePin());
    }

    // 历史导航按钮
    const prevBtn = this.container.querySelector(".quick-note-prev");
    if (prevBtn) {
      prevBtn.addEventListener("click", () => this.navigateHistory(-1));
    }

    const nextBtn = this.container.querySelector(".quick-note-next");
    if (nextBtn) {
      nextBtn.addEventListener("click", () => this.navigateHistory(1));
    }

    // 监听编辑器变化，启用自动保存
    const editorContainer = this.container.querySelector(
      "#quick-note-editor-container",
    );
    if (editorContainer) {
      editorContainer.addEventListener("input", () => this.onEditorChange());

      // 添加拖拽事件监听到容器
      editorContainer.addEventListener("dragover", (e) =>
        this.handleDragOver(e as DragEvent),
      );
      editorContainer.addEventListener("drop", (e) =>
        this.handleDrop(e as DragEvent),
      );
      editorContainer.addEventListener("dragleave", (e) =>
        this.handleDragLeave(e as DragEvent),
      );

      // 添加到整个窗口，确保能捕获拖拽
      this.container.addEventListener("dragover", (e) =>
        this.handleDragOver(e as DragEvent),
      );
      this.container.addEventListener("drop", (e) =>
        this.handleDrop(e as DragEvent),
      );
    }
  }

  /**
   * 初始化编辑器
   */
  private async initializeEditor(container: HTMLElement): Promise<void> {
    try {
      Zotero.log("[QuickNoteWindowV2] Initializing editor...", "info");

      // 如果已有笔记，加载编辑器
      if (this.currentNoteId) {
        Zotero.log(
          `[QuickNoteWindowV2] Loading existing note ${this.currentNoteId} in editor`,
          "info",
        );
        await this.loadNoteEditor(this.currentNoteId, container);
        // 添加到历史记录
        this.addToHistory(this.currentNoteId);
      } else {
        // 暂时显示加载中
        const loading = container.ownerDocument.createElement("div");
        loading.id = "editor-loading";
        loading.style.cssText = `
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: #666;
          font-size: 14px;
        `;
        loading.textContent = "Preparing editor...";
        container.appendChild(loading);
        Zotero.log(
          "[QuickNoteWindowV2] Editor container ready, waiting for note creation",
          "info",
        );
      }
    } catch (error) {
      Zotero.logError(
        `[QuickNoteWindowV2] Failed to initialize editor: ${error}`,
      );
      // 回退到简单编辑器
      this.initializeSimpleEditor(container);
    }
  }

  /**
   * 加载 Zotero 原生编辑器
   */
  private async loadNoteEditor(
    noteId: number,
    container: HTMLElement,
  ): Promise<void> {
    try {
      // 清空容器
      container.innerHTML = "";

      const doc = container.ownerDocument;
      const win = doc.defaultView || this.window || Zotero.getMainWindow();

      // 确保自定义元素脚本已加载
      if (!win.customElements || !win.customElements.get("note-editor")) {
        Zotero.log(
          `[QuickNoteWindowV2] note-editor element not registered, loading scripts`,
          "info",
        );

        if (win.Services && win.Services.scriptloader) {
          try {
            win.Services.scriptloader.loadSubScript(
              "chrome://zotero/content/customElements.js",
              win,
            );
            Zotero.log(
              `[QuickNoteWindowV2] Custom elements script loaded`,
              "info",
            );
          } catch (e) {
            Zotero.logError(
              `[QuickNoteWindowV2] Failed to load custom elements: ${e}`,
            );
            throw e;
          }
        }
      }

      // 创建编辑器容器
      const editorContainer = doc.createElement("div");
      editorContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        height: 100%;
        width: 100%;
        background: white;
      `;
      container.appendChild(editorContainer);

      // 创建 iframe
      const iframe = doc.createElement("iframe") as HTMLIFrameElement;
      iframe.id = "quick-note-editor-iframe";
      iframe.style.cssText = `
        border: 0;
        width: 100%;
        flex-grow: 1;
        min-height: 300px;
        background: white;
      `;
      iframe.setAttribute("type", "content");
      iframe.setAttribute("remote", "false");
      iframe.setAttribute("src", "resource://zotero/note-editor/editor.html");

      editorContainer.appendChild(iframe);

      // 注册 UIProperties
      if (win.Zotero.UIProperties) {
        win.Zotero.UIProperties.registerRoot(editorContainer);
      }

      // 先隐藏 iframe，避免闪烁
      iframe.style.visibility = "hidden";

      // 标记初始化状态
      let iframeInitialized = false;

      // 等待 iframe 内容加载
      const initializeEditor = async () => {
        if (iframeInitialized) return;
        iframeInitialized = true;

        try {
          Zotero.log(
            `[QuickNoteWindowV2] iframe ready, initializing editor for note ${noteId}`,
            "info",
          );

          // 等待一下确保 iframe 完全准备好
          await new Promise((resolve) => setTimeout(resolve, 200));

          const item = await Zotero.Items.getAsync(noteId);
          if (!item || !item.isNote()) {
            throw new Error("Invalid note item");
          }

          // 创建 EditorInstance
          const editorInstance = new win.Zotero.EditorInstance();

          // 使用兼容性模块处理 BetterNotes
          BetterNotesCompat.markEditorAsManaged(editorInstance, iframe);

          // 存储实例引用以便清理
          (iframe as any)._editorInstance = editorInstance;
          (editorContainer as any)._editorInstance = editorInstance;

          // 等待 BetterNotes 完成其代理设置（如果存在）
          await BetterNotesCompat.waitForInitialization();

          // 初始化编辑器
          await editorInstance.init({
            item: item,
            viewMode: "library",
            readOnly: false,
            iframeWindow: iframe.contentWindow,
            popup: false,
            saveOnClose: true,
            ignoreUpdate: true,
          });

          // BetterNotes 兼容性已由 BetterNotesCompat 处理

          // 显示 iframe
          iframe.style.visibility = "visible";

          this.editor = editorInstance;
          this.currentNoteId = noteId;

          // 给 iframe 内部也添加拖拽事件监听
          if (iframe.contentDocument) {
            // 绑定到 body 元素
            const iframeBody = iframe.contentDocument.body;
            if (iframeBody) {
              iframeBody.addEventListener("dragover", (e) =>
                this.handleDragOver(e),
              );
              iframeBody.addEventListener("drop", (e) => this.handleDrop(e));
              iframeBody.addEventListener("dragleave", (e) =>
                this.handleDragLeave(e),
              );

              // 监听编辑器内容变化
              iframeBody.addEventListener("input", () => this.onEditorChange());

              Zotero.log(
                "[QuickNoteWindowV2] Drag-drop events attached to iframe body",
                "info",
              );
            }

            // 也绑定到 contentWindow
            if (iframe.contentWindow) {
              iframe.contentWindow.addEventListener("dragover", (e) =>
                this.handleDragOver(e),
              );
              iframe.contentWindow.addEventListener("drop", (e) =>
                this.handleDrop(e),
              );

              Zotero.log(
                "[QuickNoteWindowV2] Drag-drop events attached to iframe window",
                "info",
              );
            }
          }

          Zotero.log(
            "[QuickNoteWindowV2] Native editor loaded successfully",
            "info",
          );
          this.updateStatus("Note loaded");
        } catch (error) {
          Zotero.logError(
            `[QuickNoteWindowV2] Failed to initialize editor: ${error}`,
          );
          throw error;
        }
      };

      // 监听 iframe 加载
      iframe.addEventListener("load", initializeEditor);

      // 备用：如果 load 事件没触发
      setTimeout(() => {
        if (!iframeInitialized && iframe.contentWindow) {
          initializeEditor();
        }
      }, 1000);
    } catch (error) {
      Zotero.logError(
        `[QuickNoteWindowV2] Failed to load native editor: ${error}`,
      );
      // 回退到简单编辑器
      this.initializeSimpleEditor(container);
    }
  }

  /**
   * 初始化简单编辑器（备用）
   */
  private initializeSimpleEditor(container: HTMLElement): void {
    // 创建一个简单的文本区域作为备用
    const textArea = container.ownerDocument.createElement("textarea");
    textArea.style.cssText = `
      width: 100%;
      height: 100%;
      border: none;
      padding: 16px;
      font-family: -apple-system, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      resize: none;
      outline: none;
    `;
    textArea.placeholder = "Start typing your note...";
    container.appendChild(textArea);

    // 保存引用以便后续使用
    (container as any)._simpleEditor = textArea;
  }

  /**
   * 使窗口可拖动
   */
  private makeDraggable(header: HTMLElement): void {
    let isDragging = false;
    let currentX = 0;
    let currentY = 0;
    let initialX = 0;
    let initialY = 0;

    const dragStart = (e: MouseEvent) => {
      if (this.container) {
        initialX = e.clientX - parseInt(this.container.style.right || "50");
        initialY = e.clientY - parseInt(this.container.style.top || "100");
        isDragging = true;
      }
    };

    const dragEnd = () => {
      isDragging = false;
    };

    const drag = (e: MouseEvent) => {
      if (!isDragging || !this.container) return;

      e.preventDefault();
      currentX = initialX - e.clientX;
      currentY = e.clientY - initialY;

      this.container.style.right = currentX + "px";
      this.container.style.top = currentY + "px";
    };

    header.addEventListener("mousedown", dragStart);
    header.ownerDocument.addEventListener("mouseup", dragEnd);
    header.ownerDocument.addEventListener("mousemove", drag);
  }

  /**
   * 判断是否需要创建新笔记
   */
  private shouldCreateNewNote(nodeId?: string): boolean {
    // 如果固定到标签页，检查是否是同一个标签页
    if (this.isPinned) {
      const currentTabId = this.getCurrentTabId();
      if (currentTabId === this.pinnedTabId) {
        // 同一个标签页，不创建新笔记
        return false;
      } else {
        // 不同标签页，解除固定
        this.unpin();
      }
    }

    const mode =
      Zotero.Prefs.get("extensions.zotero.researchnavigator.quickNoteMode") ||
      "context";

    // A模式：总是创建新笔记
    if (mode === "always-new") {
      return true;
    }

    // 总是重用模式
    if (mode === "always-reuse") {
      return false;
    }

    // B模式：基于上下文
    if (mode === "context") {
      // 如果没有当前笔记，需要创建
      if (!this.currentNoteId) {
        return true;
      }

      // 如果上下文改变了，需要创建新笔记
      if (nodeId && nodeId !== this.noteContext) {
        Zotero.log(
          `[QuickNoteWindowV2] Context changed from ${this.noteContext} to ${nodeId}`,
          "info",
        );
        return true;
      }
    }

    return false;
  }

  /**
   * 更新笔记信息显示
   */
  private async updateNoteInfo(): Promise<void> {
    // 更新模式图标
    this.updateModeIcon();

    // 更新上下文信息
    const contextEl = this.container?.querySelector(
      ".quick-note-context-info",
    ) as HTMLElement;
    if (contextEl && this.associatedNodeId) {
      const nodeInfo = await this.getNodeInfo(this.associatedNodeId);
      if (nodeInfo) {
        contextEl.textContent = nodeInfo.title;
        contextEl.title = nodeInfo.title; // 完整标题的悬停提示
      }
    }

    // 更新笔记标题信息
    const infoEl = this.container?.querySelector(
      ".quick-note-info",
    ) as HTMLElement;
    if (!infoEl || !this.currentNoteId) return;

    try {
      const note = await Zotero.Items.getAsync(this.currentNoteId);
      if (note) {
        const title = note.getField("title") || "Quick Note";
        const date = new Date(note.dateModified).toLocaleString();
        infoEl.innerHTML = `<strong>${title}</strong> <span style="color: #999; font-size: 11px;">${date}</span>`;
      }
    } catch (error) {
      Zotero.logError(
        `[QuickNoteWindowV2] Failed to update note info: ${error}`,
      );
    }

    // 更新历史导航按钮状态
    this.updateHistoryButtons();
  }

  /**
   * 获取节点信息
   */
  private async getNodeInfo(nodeId: string): Promise<{
    title: string;
    type: string;
    itemID: number;
    parentID?: number;
  } | null> {
    try {
      // 解析节点ID (格式: "item-123" 或 "attachment-456" 或 "note-789")
      const [type, id] = nodeId.split("-");
      const itemId = parseInt(id);

      if (!itemId) return null;

      const item = await Zotero.Items.getAsync(itemId);
      if (!item) return null;

      const result: any = {
        title: item.getField("title") || "Untitled",
        type: type,
        itemID: itemId,
      };

      // 如果是附件，获取父项ID
      if (item.isAttachment() && item.parentID) {
        result.parentID = item.parentID;
        // 如果附件没有标题，尝试使用父项的标题
        if (result.title === "Untitled") {
          const parent = await Zotero.Items.getAsync(item.parentID);
          if (parent) {
            result.title = parent.getField("title") || "Untitled";
          }
        }
      } else if (item.isNote()) {
        // 如果是笔记，检查它是否有父项
        if (item.parentID) {
          // 使用笔记的父项作为新笔记的父项
          result.parentID = item.parentID;
          result.type = "note-with-parent";
        } else {
          // 独立笔记，不能作为父项
          result.type = "standalone-note";
        }
      }

      return result;
    } catch (error) {
      Zotero.logError(`[QuickNoteWindowV2] Failed to get node info: ${error}`);
      return null;
    }
  }

  /**
   * 保存笔记
   */
  private async saveNote(): Promise<void> {
    try {
      if (!this.currentNoteId) {
        this.updateStatus("No note to save");
        return;
      }

      this.updateStatus("Saving...");

      // EditorInstance 会自动保存，这里只需要更新状态
      if (this.editor && typeof this.editor.saveSync === "function") {
        this.editor.saveSync();
      }

      this.updateStatus("Saved");

      // 2秒后恢复状态
      setTimeout(() => {
        this.updateStatus("Ready");
      }, 2000);
    } catch (error) {
      Zotero.logError(`[QuickNoteWindowV2] Save failed: ${error}`);
      this.updateStatus("Save failed");
    }
  }

  /**
   * 强制创建新笔记（用户点击新建按钮）
   */
  private async forceCreateNewNote(): Promise<void> {
    Zotero.log("[QuickNoteWindowV2] User requested new note", "info");

    // 防止并发
    if (this.isLoadingNote) {
      Zotero.log(
        "[QuickNoteWindowV2] Already loading a note, skipping force create",
        "info",
      );
      return;
    }

    // 清除当前笔记信息
    this.currentNoteId = null;
    this.noteContext = this.associatedNodeId; // 使用当前关联的节点作为新上下文

    // 清空编辑器
    const editorContainer = this.container?.querySelector(
      "#quick-note-editor-container",
    );
    if (editorContainer) {
      editorContainer.innerHTML = "";
      const loading = editorContainer.ownerDocument.createElement("div");
      loading.id = "editor-loading";
      loading.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: #666;
        font-size: 14px;
      `;
      loading.textContent = "Creating new note...";
      editorContainer.appendChild(loading);
    }

    // 创建新笔记
    this.isLoadingNote = true;
    await this.createNewNote();
  }

  /**
   * 创建新笔记
   */
  private async createNewNote(): Promise<void> {
    // 再次检查标志（因为是异步调用）
    if (!this.isLoadingNote) {
      Zotero.log(
        "[QuickNoteWindowV2] createNewNote called but isLoadingNote is false, aborting",
        "warning",
      );
      return;
    }

    try {
      this.updateStatus("Creating new note...");

      // 创建新的 Zotero 笔记
      const note = new Zotero.Item("note");

      // 设置初始内容
      const timestamp = new Date().toLocaleString();
      let noteContent = `<h2>Quick Note</h2><p>Created at ${timestamp}</p><p></p>`;
      let parentItemID: number | undefined;

      // 如果有关联的节点，添加相关信息并设置父项
      if (this.associatedNodeId) {
        const nodeInfo = await this.getNodeInfo(this.associatedNodeId);
        if (nodeInfo) {
          noteContent = `<h2>Quick Note - ${nodeInfo.title}</h2><p>Created at ${timestamp}</p><p></p>`;

          // 根据节点类型决定父项
          if (nodeInfo.type === "attachment" && nodeInfo.parentID) {
            // 附件：使用附件的父项
            parentItemID = nodeInfo.parentID;
            Zotero.log(
              `[QuickNoteWindowV2] Attachment node - Setting parent item ID: ${parentItemID}`,
              "info",
            );
          } else if (
            nodeInfo.type === "note-with-parent" &&
            nodeInfo.parentID
          ) {
            // 有父项的笔记：使用相同的父项
            parentItemID = nodeInfo.parentID;
            Zotero.log(
              `[QuickNoteWindowV2] Note with parent - Setting parent item ID: ${parentItemID}`,
              "info",
            );
          } else if (nodeInfo.type === "item") {
            // 普通项目：检查是否真的是普通项目
            const item = await Zotero.Items.getAsync(nodeInfo.itemID);
            if (item && item.isRegularItem()) {
              parentItemID = nodeInfo.itemID;
              Zotero.log(
                `[QuickNoteWindowV2] Regular item - Setting parent item ID: ${parentItemID}`,
                "info",
              );
            } else {
              Zotero.log(
                `[QuickNoteWindowV2] Item ${nodeInfo.itemID} is not a regular item, creating standalone note`,
                "info",
              );
            }
          } else if (nodeInfo.type === "standalone-note") {
            // 独立笔记：创建新的独立笔记
            Zotero.log(
              `[QuickNoteWindowV2] Standalone note selected - Creating new standalone note`,
              "info",
            );
          }
        }
      }

      note.setNote(noteContent);

      // 设置父项（如果有）
      if (parentItemID) {
        note.parentID = parentItemID;
      }

      // 临时禁用项目选择通知
      const notifierID = Zotero.Notifier.registerObserver(
        {
          notify: (event: string, type: string, ids: number[]) => {
            if (event === "add" && type === "item" && ids.includes(note.id)) {
              // 阻止选择新创建的笔记
              return false;
            }
          },
        },
        ["item"],
      );

      // 保存笔记
      await note.saveTx();

      // 移除通知监听
      Zotero.Notifier.unregisterObserver(notifierID);

      this.currentNoteId = note.id;
      this.noteContext = this.associatedNodeId; // 记录创建时的上下文

      // 添加到历史记录
      this.addToHistory(note.id);

      // 在编辑器中加载新笔记
      const editorContainer = this.container?.querySelector(
        "#quick-note-editor-container",
      );
      Zotero.log(
        `[QuickNoteWindowV2] Looking for editor container, found: ${!!editorContainer}`,
        "info",
      );

      if (editorContainer) {
        Zotero.log(
          `[QuickNoteWindowV2] Loading note ${this.currentNoteId} in editor...`,
          "info",
        );
        await this.loadNoteEditor(
          this.currentNoteId,
          editorContainer as HTMLElement,
        );
        Zotero.log(`[QuickNoteWindowV2] Note loaded in editor`, "info");
      } else {
        Zotero.logError("[QuickNoteWindowV2] Editor container not found!");
      }

      // 创建关联
      if (this.associatedNodeId) {
        await this.noteAssociationSystem.createAssociation(
          note.id,
          this.associatedNodeId,
          "quick-note",
          { source: "quick-note-window-v2" },
        );
      }

      // 更新信息显示
      await this.updateNoteInfo();

      this.updateStatus("New note created");
    } catch (error) {
      Zotero.logError(`[QuickNoteWindowV2] Failed to create note: ${error}`);
      this.updateStatus("Failed to create note");
    } finally {
      this.isLoadingNote = false;
    }
  }

  /**
   * 更新状态
   */
  private updateStatus(text: string): void {
    if (!this.container) return;

    const statusEl = this.container.querySelector(".status-text");
    if (statusEl) {
      statusEl.textContent = text;
    }
  }

  /**
   * 隐藏窗口
   */
  hide(): void {
    if (this.container) {
      this.container.style.display = "none";
      Zotero.log(
        `[QuickNoteWindowV2] Window hidden, keeping note ${this.currentNoteId} in memory, context: ${this.noteContext}`,
        "info",
      );
    }

    // 处理待处理的显示请求
    if (this.pendingNodeId !== null) {
      const pendingId = this.pendingNodeId;
      this.pendingNodeId = null;
      setTimeout(() => this.show(pendingId), 100);
    }
  }

  /**
   * 更新模式图标
   */
  private updateModeIcon(): void {
    const iconEl = this.container?.querySelector(
      ".quick-note-mode-icon",
    ) as HTMLElement;
    if (!iconEl) return;

    const mode =
      Zotero.Prefs.get("extensions.zotero.researchnavigator.quickNoteMode") ||
      "context";

    if (this.isPinned) {
      iconEl.textContent = "📌";
      iconEl.style.background = "#2196F3";
      iconEl.style.color = "white";
      iconEl.title = `Pinned to: ${this.pinnedTitle || "Tab"}`;
    } else {
      switch (mode) {
        case "always-new":
          iconEl.textContent = "📝";
          iconEl.title = "Mode: Always New";
          break;
        case "always-reuse":
          iconEl.textContent = "🔄";
          iconEl.title = "Mode: Always Reuse";
          break;
        default:
          iconEl.textContent = "🎯";
          iconEl.title = "Mode: Context-based";
      }
      iconEl.style.background = "#e8e8e8";
      iconEl.style.color = "#666";
    }
  }

  /**
   * 切换固定状态
   */
  private async togglePin(): Promise<void> {
    if (this.isPinned) {
      this.unpin();
    } else {
      await this.pin();
    }
  }

  /**
   * 固定到当前标签页
   */
  private async pin(): Promise<void> {
    this.isPinned = true;
    this.pinnedContext = this.associatedNodeId;
    this.pinnedTabId = this.getCurrentTabId();

    // 获取当前标签页标题
    if (this.associatedNodeId) {
      const nodeInfo = await this.getNodeInfo(this.associatedNodeId);
      this.pinnedTitle = nodeInfo?.title || "Unknown";
    }

    // 更新UI
    const pinBtn = this.container?.querySelector(
      ".quick-note-pin",
    ) as HTMLElement;
    if (pinBtn) {
      pinBtn.style.background = "#2196F3";
      pinBtn.style.color = "white";
      const textEl = pinBtn.querySelector(".pin-text");
      if (textEl) {
        textEl.textContent = `Pinned to: ${this.pinnedTitle}`;
      }
    }

    this.updateModeIcon();
    Zotero.log(
      `[QuickNoteWindowV2] Pinned to tab: ${this.pinnedTabId}`,
      "info",
    );
  }

  /**
   * 解除固定
   */
  private unpin(): void {
    this.isPinned = false;
    this.pinnedContext = null;
    this.pinnedTabId = null;
    this.pinnedTitle = null;

    // 更新UI
    const pinBtn = this.container?.querySelector(
      ".quick-note-pin",
    ) as HTMLElement;
    if (pinBtn) {
      pinBtn.style.background = "#f0f0f0";
      pinBtn.style.color = "#666";
      const textEl = pinBtn.querySelector(".pin-text");
      if (textEl) {
        textEl.textContent = "Pin to Tab";
      }
    }

    this.updateModeIcon();
    Zotero.log("[QuickNoteWindowV2] Unpinned from tab", "info");
  }

  /**
   * 获取当前标签页ID
   */
  private getCurrentTabId(): string | null {
    try {
      const win = Zotero.getMainWindow();
      if (win?.Zotero_Tabs) {
        return win.Zotero_Tabs.selectedID;
      }
    } catch (error) {
      Zotero.logError(
        `[QuickNoteWindowV2] Failed to get current tab ID: ${error}`,
      );
    }
    return null;
  }

  /**
   * 编辑器内容变化处理
   */
  private onEditorChange(): void {
    this.hasUnsavedChanges = true;

    // 清除之前的定时器
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }

    // 显示"未保存"状态
    this.updateSaveStatus("unsaved");

    // 2秒后自动保存
    this.autoSaveTimer = setTimeout(() => {
      this.autoSave();
    }, 2000);
  }

  /**
   * 自动保存
   */
  private async autoSave(): Promise<void> {
    if (!this.hasUnsavedChanges || !this.currentNoteId) return;

    this.updateSaveStatus("saving");

    try {
      await this.saveNote();
      this.hasUnsavedChanges = false;
      this.lastSaveTime = Date.now();
      this.updateSaveStatus("saved");

      // 3秒后隐藏保存状态
      setTimeout(() => {
        this.updateSaveStatus("hidden");
      }, 3000);
    } catch (error) {
      Zotero.logError(`[QuickNoteWindowV2] Auto-save failed: ${error}`);
      this.updateSaveStatus("error");
    }
  }

  /**
   * 更新保存状态显示
   */
  private updateSaveStatus(
    status: "saved" | "saving" | "unsaved" | "error" | "hidden",
  ): void {
    const statusEl = this.container?.querySelector(
      ".quick-note-save-status",
    ) as HTMLElement;
    if (!statusEl) return;

    switch (status) {
      case "saved":
        statusEl.style.display = "flex";
        statusEl.style.color = "#4CAF50";
        statusEl.innerHTML =
          '<span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: currentColor;"></span> Saved';
        break;
      case "saving":
        statusEl.style.display = "flex";
        statusEl.style.color = "#FF9800";
        statusEl.innerHTML =
          '<span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: currentColor; animation: pulse 1s infinite;"></span> Saving...';
        break;
      case "unsaved":
        statusEl.style.display = "flex";
        statusEl.style.color = "#f44336";
        statusEl.innerHTML =
          '<span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: currentColor;"></span> Unsaved';
        break;
      case "error":
        statusEl.style.display = "flex";
        statusEl.style.color = "#f44336";
        statusEl.innerHTML = "⚠️ Save failed";
        break;
      case "hidden":
        statusEl.style.display = "none";
        break;
    }
  }

  /**
   * 导航历史记录
   */
  private async navigateHistory(direction: number): Promise<void> {
    const newIndex = this.currentHistoryIndex + direction;

    if (newIndex < 0 || newIndex >= this.noteHistory.length) {
      return; // 超出范围
    }

    // 保存当前笔记
    if (this.hasUnsavedChanges) {
      await this.saveNote();
    }

    // 切换到历史笔记
    this.currentHistoryIndex = newIndex;
    const noteId = this.noteHistory[newIndex];

    try {
      const note = await Zotero.Items.getAsync(noteId);
      if (note && !note.deleted) {
        this.currentNoteId = noteId;

        // 加载笔记到编辑器
        const editorContainer = this.container?.querySelector(
          "#quick-note-editor-container",
        );
        if (editorContainer) {
          await this.loadNoteEditor(noteId, editorContainer as HTMLElement);
        }

        // 更新UI
        await this.updateNoteInfo();
        this.updateHistoryButtons();
      } else {
        // 笔记已删除，从历史中移除
        this.noteHistory.splice(newIndex, 1);
        if (this.currentHistoryIndex >= this.noteHistory.length) {
          this.currentHistoryIndex = this.noteHistory.length - 1;
        }
        this.updateHistoryButtons();
      }
    } catch (error) {
      Zotero.logError(
        `[QuickNoteWindowV2] Failed to navigate history: ${error}`,
      );
    }
  }

  /**
   * 更新历史导航按钮状态
   */
  private updateHistoryButtons(): void {
    const prevBtn = this.container?.querySelector(
      ".quick-note-prev",
    ) as HTMLElement;
    const nextBtn = this.container?.querySelector(
      ".quick-note-next",
    ) as HTMLElement;

    if (prevBtn) {
      prevBtn.style.opacity = this.currentHistoryIndex > 0 ? "1" : "0.5";
      prevBtn.style.pointerEvents =
        this.currentHistoryIndex > 0 ? "auto" : "none";
    }

    if (nextBtn) {
      nextBtn.style.opacity =
        this.currentHistoryIndex < this.noteHistory.length - 1 ? "1" : "0.5";
      nextBtn.style.pointerEvents =
        this.currentHistoryIndex < this.noteHistory.length - 1
          ? "auto"
          : "none";
    }
  }

  /**
   * 添加笔记到历史记录
   */
  private addToHistory(noteId: number): void {
    // 如果已在历史中，先移除
    const existingIndex = this.noteHistory.indexOf(noteId);
    if (existingIndex !== -1) {
      this.noteHistory.splice(existingIndex, 1);
    }

    // 添加到历史末尾
    this.noteHistory.push(noteId);

    // 限制历史记录数量
    if (this.noteHistory.length > 10) {
      this.noteHistory.shift();
    }

    // 更新当前索引
    this.currentHistoryIndex = this.noteHistory.length - 1;

    this.updateHistoryButtons();
  }

  /**
   * 处理拖拽悬停
   */
  private handleDragOver(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();

    Zotero.log("[QuickNoteWindowV2] DragOver event triggered", "info");

    // 设置拖拽效果
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "copy";
    }

    // 添加视觉反馈
    const editorContainer = this.container?.querySelector(
      "#quick-note-editor-container",
    ) as HTMLElement;
    if (editorContainer) {
      editorContainer.style.cssText =
        editorContainer.style.cssText +
        "; background-color: #f0f8ff !important; outline: 2px dashed #2196F3 !important; outline-offset: -2px !important;";
    }
  }

  /**
   * 处理拖拽离开
   */
  private handleDragLeave(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();

    // 恢复编辑器样式
    const editorContainer = this.container?.querySelector(
      "#quick-note-editor-container",
    ) as HTMLElement;
    if (editorContainer) {
      // 移除拖拽样式
      const currentStyle = editorContainer.style.cssText;
      editorContainer.style.cssText = currentStyle
        .replace(/;\s*background-color:\s*[^;]+!important/gi, "")
        .replace(/;\s*outline:\s*[^;]+!important/gi, "")
        .replace(/;\s*outline-offset:\s*[^;]+!important/gi, "");
    }
  }

  /**
   * 处理拖拽释放
   */
  private async handleDrop(e: DragEvent): Promise<void> {
    e.preventDefault();
    e.stopPropagation();

    Zotero.log("[QuickNoteWindowV2] Drop event triggered", "info");

    // 恢复编辑器样式
    const editorContainer = this.container?.querySelector(
      "#quick-note-editor-container",
    ) as HTMLElement;
    if (editorContainer) {
      // 移除拖拽样式
      const currentStyle = editorContainer.style.cssText;
      editorContainer.style.cssText = currentStyle
        .replace(/;\s*background-color:\s*[^;]+!important/gi, "")
        .replace(/;\s*outline:\s*[^;]+!important/gi, "")
        .replace(/;\s*outline-offset:\s*[^;]+!important/gi, "");
    }

    if (!e.dataTransfer) {
      Zotero.log("[QuickNoteWindowV2] No dataTransfer in drop event", "warn");
      return;
    }

    if (!this.editor) {
      Zotero.log("[QuickNoteWindowV2] No editor instance available", "warn");
      return;
    }

    // 获取拖拽的文本
    const text = e.dataTransfer.getData("text/plain");
    if (!text) {
      Zotero.log("[QuickNoteWindowV2] No text data in drop event", "warn");
      return;
    }

    Zotero.log(
      `[QuickNoteWindowV2] Dropped text: ${text.substring(0, 50)}...`,
      "info",
    );

    try {
      // 格式化为引用格式
      const timestamp = new Date().toLocaleString();
      const sourceInfo = await this.getSourceInfo();

      // 创建格式化的引用文本
      let formattedText = `\n\n> ${text.trim()}\n\n`;
      if (sourceInfo) {
        formattedText += `*— ${sourceInfo}, ${timestamp}*\n\n`;
      } else {
        formattedText += `*— ${timestamp}*\n\n`;
      }

      // 获取当前内容并添加引用
      try {
        if (
          this.editor &&
          this.editor.getContentHTML &&
          this.editor.setContentHTML
        ) {
          // 创建 Markdown 格式的引用文本
          const lines = text.trim().split("\n");
          const quotedText = lines.map((line) => `> ${line}`).join("\n");

          // 添加引文来源
          const citation = `_— ${sourceInfo ? sourceInfo + ", " : ""}${timestamp}_`;

          // 组合新内容
          const markdownText = `\n\n${quotedText}\n\n${citation}\n\n`;

          // 尝试使用 BetterNotes 的 Markdown 功能
          const betterNotesInserted =
            await BetterNotesCompat.insertWithBetterNotes(
              this.editor,
              markdownText,
            );

          if (betterNotesInserted) {
            Zotero.log(
              "[QuickNoteWindowV2] Text inserted using BetterNotes Markdown conversion",
              "info",
            );
          } else if (
            this.editor.insertText &&
            typeof this.editor.insertText === "function"
          ) {
            // 如果有 insertText 方法，直接插入文本
            await this.editor.insertText(markdownText);
          } else if (
            this.editor._editorInstance &&
            this.editor._editorInstance.insertText
          ) {
            // 尝试使用内部实例的方法
            await this.editor._editorInstance.insertText(markdownText);
          } else {
            // 后备方案：获取当前内容并追加
            const currentHTML = await this.editor.getContentHTML();

            // 直接插入带有 > 的文本，不进行HTML转义
            // 每行用 <p> 标签包裹，让编辑器能识别 Markdown
            const lines = markdownText.split("\n");
            const htmlParagraphs = lines
              .filter((line) => line.trim()) // 过滤空行
              .map((line) => `<p>${line}</p>`)
              .join("");

            const newHTML = currentHTML + htmlParagraphs;
            await this.editor.setContentHTML(newHTML);
          }

          // 尝试滚动到底部
          setTimeout(() => {
            const iframe = this.container?.querySelector(
              "#quick-note-editor-iframe",
            ) as HTMLIFrameElement;
            if (iframe?.contentDocument?.body) {
              iframe.contentDocument.body.scrollTop =
                iframe.contentDocument.body.scrollHeight;
            }
          }, 100);

          Zotero.log("[QuickNoteWindowV2] Quote inserted successfully", "info");
        } else {
          throw new Error("Editor API not available");
        }
      } catch (error) {
        Zotero.logError(`[QuickNoteWindowV2] Failed to insert text: ${error}`);

        // 后备方案：使用简单的文本格式
        try {
          if (this.currentNoteId) {
            const note = await Zotero.Items.getAsync(this.currentNoteId);
            if (note) {
              const currentContent = note.getNote();

              // 使用 Markdown 格式
              const lines = text.trim().split("\n");
              const quotedText = lines.map((line) => `> ${line}`).join("\n");
              const citation = `_— ${sourceInfo ? sourceInfo + ", " : ""}${timestamp}_`;

              // 转换为 HTML，保留 Markdown 语法但不转义
              const quotedLines = quotedText
                .split("\n")
                .map((line) => `<p>${line}</p>`)
                .join("");
              const citationHTML = `<p>${citation}</p>`;

              const newContent = currentContent + quotedLines + citationHTML;
              note.setNote(newContent);
              await note.saveTx();

              // 重新加载编辑器
              const editorContainer = this.container?.querySelector(
                "#quick-note-editor-container",
              );
              if (editorContainer) {
                await this.loadNoteEditor(
                  this.currentNoteId,
                  editorContainer as HTMLElement,
                );
              }
            }
          }
        } catch (fallbackError) {
          Zotero.logError(
            `[QuickNoteWindowV2] Fallback also failed: ${fallbackError}`,
          );
        }
      }

      // 触发内容变化事件
      this.onEditorChange();

      // 记录拖拽源信息
      if (sourceInfo) {
        Zotero.log(
          `[QuickNoteWindowV2] Text dropped from: ${sourceInfo}`,
          "info",
        );
      }

      // 显示提示
      this.showDropFeedback("Text added as quote");
    } catch (error) {
      Zotero.logError(`[QuickNoteWindowV2] Failed to handle drop: ${error}`);
    }
  }

  /**
   * 获取拖拽源信息
   */
  private async getSourceInfo(): Promise<string | null> {
    try {
      const win = Zotero.getMainWindow();
      if (!win?.Zotero_Tabs) {
        return null;
      }

      const selectedID = win.Zotero_Tabs.selectedID;
      if (!selectedID) {
        return null;
      }

      // 检查是否是阅读器标签页
      const reader = Zotero.Reader.getByTabID(selectedID);
      if (reader) {
        const item = reader._item;
        const title = item?.getField("title") || "Unknown";
        const page = reader._state?.pageIndex
          ? `p. ${reader._state.pageIndex + 1}`
          : "";
        return `${title} ${page}`.trim();
      }

      // 检查是否是普通文献
      const items = win.ZoteroPane?.getSelectedItems();
      if (items && items.length > 0) {
        return items[0].getField("title") || "Unknown";
      }

      return null;
    } catch (error) {
      Zotero.logError(
        `[QuickNoteWindowV2] Failed to get source info: ${error}`,
      );
      return null;
    }
  }

  /**
   * 显示拖拽反馈
   */
  private showDropFeedback(message: string): void {
    const feedback = this.container?.ownerDocument.createElement("div");
    if (!feedback || !this.container) return;

    feedback.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(33, 150, 243, 0.9);
      color: white;
      padding: 12px 24px;
      border-radius: 4px;
      font-size: 14px;
      z-index: 10000;
      pointer-events: none;
      animation: fadeInOut 2s ease-in-out;
    `;
    feedback.textContent = message;

    // 添加淡入淡出动画
    const style = this.container.ownerDocument.createElement("style");
    style.textContent = `
      @keyframes fadeInOut {
        0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
        20% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        80% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
      }
    `;
    this.container.appendChild(style);
    this.container.appendChild(feedback);

    // 2秒后移除
    setTimeout(() => {
      feedback.remove();
      style.remove();
    }, 2000);
  }

  /**
   * 关闭窗口
   */
  close(): void {
    try {
      // 清理编辑器实例
      if (this.editor && typeof this.editor.uninit === "function") {
        Zotero.log("[QuickNoteWindowV2] Uninitializing editor", "info");
        this.editor.uninit();
      }

      // 清理 iframe 的编辑器实例
      const iframe = this.container?.querySelector("#quick-note-editor-iframe");
      if (iframe && (iframe as any)._editorInstance) {
        const editorInstance = (iframe as any)._editorInstance;
        if (typeof editorInstance.uninit === "function") {
          try {
            editorInstance.uninit();
          } catch (e) {
            Zotero.logError(
              `[QuickNoteWindowV2] Error uninitializing iframe editor: ${e}`,
            );
          }
        }
      }

      // 移除容器
      if (this.container) {
        this.container.remove();
        this.container = null;
      }

      this.editor = null;
      this.currentNoteId = null;
    } catch (error) {
      Zotero.logError(`[QuickNoteWindowV2] Error during close: ${error}`);
    }
  }
}
