/**
 * 笔记关联标签页
 * 显示和管理历史节点与笔记的双向关联
 */

import { NoteAssociationSystem } from "../../../managers/note-association-system";
import { HistoryService } from "../../../services/history-service";
import { HistoryNode } from "../../../services/database-service";
import { NoteEditorIntegration, EditorMode } from "./note-editor-integration";
import { NoteBranchingSystem } from "../../../managers/note-branching";
import { BetterNotesCompat } from "../../../utils/betternotes-compat";

export interface AssociatedNote {
  id: number;
  noteId: number;
  nodeId: string;
  relationType: string;
  title: string;
  content: string;
  dateModified: Date;
}

export class NoteRelationsTab {
  private container: HTMLElement | null = null;
  private contentContainer: HTMLElement | null = null;
  private selectedNode: HistoryNode | null = null;
  private editorMode: EditorMode = "column";
  private editorContainer: HTMLElement | null = null;
  private selectedNoteId: number | null = null;
  private noteBranchingSystem: NoteBranchingSystem;
  private branchingPanel: HTMLElement | null = null;

  constructor(
    private window: Window,
    private historyService: HistoryService,
    private noteAssociationSystem: NoteAssociationSystem,
  ) {
    this.noteBranchingSystem = new NoteBranchingSystem(
      window,
      noteAssociationSystem,
    );
  }

  create(container: HTMLElement): void {
    try {
      Zotero.log("[NoteRelationsTab] create method called", "info");
      this.container = container;
      const doc = this.window.document;

      // 创建主布局
      container.style.cssText = `
      display: flex;
      height: 100%;
      overflow: hidden;
    `;

      // 左侧：历史节点选择器
      const nodeSelector = this.createNodeSelector(doc);
      container.appendChild(nodeSelector);

      // 右侧：笔记关联内容
      this.contentContainer = doc.createElement("div");
      this.contentContainer.style.cssText = `
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      border-left: 1px solid var(--material-border-quarternary);
    `;

      // 初始提示
      this.showEmptyState();

      container.appendChild(this.contentContainer);

      Zotero.log(
        "[NoteRelationsTab] create method completed successfully",
        "info",
      );
    } catch (error) {
      Zotero.logError(`[NoteRelationsTab] Error in create method: ${error}`);
      // 显示错误信息
      container.innerHTML = `<div style="padding: 20px; color: red;">Error loading Note Relations tab: ${error}</div>`;
    }
  }

  /**
   * 创建节点选择器
   */
  private createNodeSelector(doc: Document): HTMLElement {
    const selector = doc.createElement("div");
    selector.style.cssText = `
      width: 250px;
      display: flex;
      flex-direction: column;
      background: var(--material-sidepane);
      overflow: hidden;
    `;

    // 标题
    const header = doc.createElement("div");
    header.style.cssText = `
      padding: 10px;
      font-weight: bold;
      border-bottom: 1px solid var(--material-border-quarternary);
    `;
    header.textContent = "Select History Node";
    selector.appendChild(header);

    // 搜索框
    const searchBox = doc.createElement("input");
    searchBox.type = "text";
    searchBox.placeholder = "Search nodes...";
    searchBox.style.cssText = `
      margin: 10px;
      padding: 5px;
      border: 1px solid var(--material-border-quarternary);
      border-radius: 3px;
    `;
    searchBox.addEventListener("input", (e) => {
      this.filterNodes((e.target as HTMLInputElement).value);
    });
    selector.appendChild(searchBox);

    // 节点列表
    const nodeList = doc.createElement("div");
    nodeList.id = "note-association-node-list";
    nodeList.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 10px;
      position: relative;
      z-index: 1;
    `;

    // 加载最近的节点
    this.loadRecentNodes(nodeList);

    selector.appendChild(nodeList);

    return selector;
  }

  /**
   * 加载最近的节点
   */
  private async loadRecentNodes(container: HTMLElement): Promise<void> {
    const doc = this.window.document;
    container.innerHTML = "";

    // 获取最近的会话
    const sessions = this.historyService.getAllSessions().slice(0, 3);

    for (const session of sessions) {
      const sessionGroup = doc.createElement("div");
      sessionGroup.style.cssText = `
        margin-bottom: 15px;
      `;

      // 会话标题
      const sessionTitle = doc.createElement("div");
      sessionTitle.style.cssText = `
        font-weight: bold;
        color: var(--fill-secondary);
        margin-bottom: 5px;
      `;
      sessionTitle.textContent = new Date(
        session.startTime,
      ).toLocaleDateString();
      sessionGroup.appendChild(sessionTitle);

      // 获取会话的节点
      const nodes = this.historyService
        .getSessionNodes(session.id)
        .slice(0, 10);

      for (const node of nodes) {
        const nodeElement = this.createNodeElement(doc, node);
        sessionGroup.appendChild(nodeElement);
      }

      container.appendChild(sessionGroup);
    }
  }

  /**
   * 创建节点元素
   */
  private createNodeElement(doc: Document, node: HistoryNode): HTMLElement {
    const element = doc.createElement("div");
    element.style.cssText = `
      padding: 10px 12px;
      margin: 5px 0;
      border-radius: 5px;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 8px;
      user-select: none;
      border: 1px solid transparent;
      position: relative;
    `;

    // 图标
    const icon = doc.createElement("span");
    icon.style.pointerEvents = "none";
    icon.textContent = node.status === "open" ? "📖" : "📕";
    element.appendChild(icon);

    // 标题
    const title = doc.createElement("div");
    title.style.cssText = `
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      pointer-events: none;
    `;
    title.textContent = node.title || `Item ${node.itemId}`;
    element.appendChild(title);

    // 显示实际的笔记数量（从 Zotero 获取）
    (async () => {
      try {
        const item = await Zotero.Items.getAsync(node.itemId);
        if (!item) return;

        let noteCount = 0;
        let noteIds: number[] = [];

        if (item.isAttachment() && item.parentID) {
          // 如果是附件，获取父项的笔记
          const parent = await Zotero.Items.getAsync(item.parentID);
          if (parent) {
            noteIds = parent.getNotes();
          }
        } else if (!item.isNote()) {
          // 如果是普通项目，获取其笔记
          noteIds = item.getNotes();
        }

        noteCount = noteIds.length;

        // 同时获取插件关联的笔记数量
        const associatedNotes = await this.noteAssociationSystem.getNodeNotes(
          node.id,
        );
        const associatedCount = associatedNotes.length;

        Zotero.log(
          `[NoteRelationsTab] Node ${node.id}: Zotero notes: ${noteCount}, Associated: ${associatedCount}`,
          "info",
        );

        if (noteCount > 0 || associatedCount > 0) {
          const badge = doc.createElement("span");
          badge.style.cssText = `
            background: var(--fill-secondary);
            color: var(--material-background);
            padding: 2px 6px;
            border-radius: 10px;
            font-size: 0.8em;
            pointer-events: none;
          `;

          // 显示格式：总数 (已关联数)
          if (associatedCount > 0 && associatedCount < noteCount) {
            badge.textContent = `${noteCount} (${associatedCount})`;
            badge.title = `${noteCount} notes total, ${associatedCount} associated`;
          } else {
            badge.textContent = noteCount.toString();
            badge.title = `${noteCount} notes`;
          }

          element.appendChild(badge);
        }
      } catch (error) {
        Zotero.logError(
          `[NoteRelationsTab] Error getting note count for node ${node.id}: ${error}`,
        );
      }
    })();

    // 点击事件
    element.addEventListener("click", async (e) => {
      e.stopPropagation();

      Zotero.log(
        `[NoteRelationsTab] Node clicked: ${node.id} - ${node.title}`,
        "info",
      );

      try {
        // 更新选中状态
        element.parentElement?.querySelectorAll("div").forEach((el) => {
          if (el.style.background) {
            el.style.background = "";
            el.style.border = "1px solid transparent";
          }
        });
        element.style.background = "var(--material-mix-quinary)";
        element.style.border = "1px solid var(--material-border-secondary)";

        // 选择节点
        await this.selectNode(node);
      } catch (error) {
        Zotero.logError(
          `[NoteRelationsTab] Error handling node click: ${error}`,
        );
      }
    });

    // 悬停效果
    element.addEventListener("mouseenter", () => {
      if (!this.selectedNode || this.selectedNode.id !== node.id) {
        element.style.background = "var(--material-button)";
        element.style.border = "1px solid var(--material-border-quarternary)";
      }
    });

    element.addEventListener("mouseleave", () => {
      if (!this.selectedNode || this.selectedNode.id !== node.id) {
        element.style.background = "";
        element.style.border = "1px solid transparent";
      }
    });

    return element;
  }

  /**
   * 选择节点
   */
  private async selectNode(node: HistoryNode): Promise<void> {
    Zotero.log(
      `[NoteRelationsTab] Selecting node: ${node.id} - ${node.title}`,
      "info",
    );
    this.selectedNode = node;
    await this.loadNodeAssociations();
  }

  /**
   * 加载节点关联
   */
  private async loadNodeAssociations(): Promise<void> {
    if (!this.selectedNode || !this.contentContainer) return;

    try {
      const doc = this.window.document;
      this.contentContainer.innerHTML = "";

      // 工具栏（包含节点信息）
      const toolbar = this.createToolbar(doc);
      this.contentContainer.appendChild(toolbar);

      // 内容区域 - 根据模式创建不同的布局
      const content = doc.createElement("div");
      content.className = "notes-content";

      let listContainer: HTMLElement;

      if (this.editorMode === "column") {
        // 分栏模式：笔记列表 + 编辑器
        content.style.cssText = `
          flex: 1;
          display: flex;
          overflow: hidden;
        `;

        // 创建笔记列表容器
        listContainer = doc.createElement("div");
        listContainer.style.cssText = `
          width: 300px;
          overflow-y: auto;
          padding: 15px;
          border-right: 1px solid var(--material-border-quarternary);
        `;
        content.appendChild(listContainer);

        // 创建编辑器容器
        this.editorContainer = doc.createElement("div");
        this.editorContainer.style.cssText = `
          flex: 1;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--fill-secondary);
        `;
        this.editorContainer.textContent = "Select a note to edit";
        content.appendChild(this.editorContainer);
      } else {
        // 其他模式使用默认布局
        content.style.cssText = `
          flex: 1;
          overflow-y: auto;
          padding: 15px;
        `;
        listContainer = content;
      }

      // 获取 Zotero 中该项目的所有笔记
      Zotero.log(
        `[NoteRelationsTab] Loading notes for node: ${this.selectedNode.id} (Item ID: ${this.selectedNode.itemId})`,
        "info",
      );

      const item = await Zotero.Items.getAsync(this.selectedNode.itemId);
      if (!item) {
        content.innerHTML = "<p>Item not found</p>";
        this.contentContainer.appendChild(content);
        return;
      }

      // 获取所有相关笔记的ID
      let allNoteIds: number[] = [];
      let targetItem = item;

      if (item.isAttachment() && item.parentID) {
        // 如果是附件，获取父项
        const parent = await Zotero.Items.getAsync(item.parentID);
        if (parent) {
          targetItem = parent;
          allNoteIds = parent.getNotes();
          Zotero.log(
            `[NoteRelationsTab] Attachment's parent has ${allNoteIds.length} notes`,
            "info",
          );
        }
      } else if (!item.isNote()) {
        // 如果是普通项目
        allNoteIds = item.getNotes();
        Zotero.log(
          `[NoteRelationsTab] Item has ${allNoteIds.length} notes`,
          "info",
        );
      }

      // 获取插件关联的笔记信息
      const associatedNotes =
        await this.noteAssociationSystem.getAssociatedNotes(
          this.selectedNode.id,
        );
      const associatedNoteIds = new Set(associatedNotes.map((n) => n.noteId));

      // 分类笔记：已关联的和未关联的
      const zoteroNotes: AssociatedNote[] = [];
      const pluginAssociatedNotes: AssociatedNote[] = [];

      // 处理 Zotero 中的所有笔记
      for (const noteId of allNoteIds) {
        try {
          const note = await Zotero.Items.getAsync(noteId);
          if (note) {
            // 安全地获取笔记内容
            let noteContent = "";
            try {
              noteContent = note.getNote();
            } catch (contentError) {
              Zotero.logError(
                `[NoteRelationsTab] Error getting content for note ${noteId}: ${contentError}`,
              );
              noteContent = "[Error loading note content]";
            }

            const noteData: AssociatedNote = {
              id: -1,
              noteId: note.id,
              nodeId: this.selectedNode.id,
              relationType: "zotero_native" as any,
              title: note.getField("title") || "Untitled Note",
              content: noteContent,
              dateModified: new Date(note.getField("dateModified")),
            };

            if (associatedNoteIds.has(noteId)) {
              // 找到对应的关联信息
              const assoc = associatedNotes.find((a) => a.noteId === noteId);
              if (assoc) {
                noteData.id = assoc.id;
                noteData.relationType = assoc.relationType;
              }
              pluginAssociatedNotes.push(noteData);
            } else {
              zoteroNotes.push(noteData);
            }
          }
        } catch (error) {
          Zotero.logError(
            `[NoteRelationsTab] Error loading note ${noteId}: ${error}`,
          );
          // 继续处理下一个笔记，不要中断整个流程
        }
      }

      // 显示已关联的笔记
      if (pluginAssociatedNotes.length > 0) {
        const section = this.createSection(
          doc,
          "Associated Notes",
          pluginAssociatedNotes,
          true,
        );
        listContainer.appendChild(section);
      }

      // 显示未关联的 Zotero 笔记
      if (zoteroNotes.length > 0) {
        const section = this.createSection(
          doc,
          "Zotero Notes (Not Associated)",
          zoteroNotes,
          false,
        );
        listContainer.appendChild(section);
      }

      // 如果没有任何笔记，显示空状态
      if (allNoteIds.length === 0) {
        const empty = doc.createElement("div");
        empty.style.cssText = `
          text-align: center;
          color: var(--fill-secondary);
          padding: 40px;
        `;
        empty.textContent = "No notes associated with this node";
        listContainer.appendChild(empty);
      }

      this.contentContainer.appendChild(content);
    } catch (error) {
      Zotero.logError(
        `[NoteRelationsTab] Error loading node associations: ${error}`,
      );
      // 显示错误状态
      if (this.contentContainer) {
        this.contentContainer.innerHTML = `
          <div style="text-align: center; color: var(--fill-secondary); padding: 40px;">
            Error loading notes. Please check the console for details.
          </div>
        `;
      }
    }
  }

  /**
   * 创建工具栏
   */
  private createToolbar(doc: Document): HTMLElement {
    const toolbar = doc.createElement("div");
    toolbar.style.cssText = `
      padding: 8px 15px;
      display: flex;
      gap: 10px;
      border-bottom: 1px solid var(--material-border-quarternary);
      background: var(--material-sidepane);
      align-items: center;
      min-height: 36px;
    `;

    // 节点信息（subtle样式）
    if (this.selectedNode) {
      const nodeInfo = doc.createElement("div");
      nodeInfo.style.cssText = `
        display: flex;
        align-items: center;
        gap: 6px;
        color: var(--fill-secondary);
        font-size: 12px;
        opacity: 0.8;
        margin-right: auto;
        overflow: hidden;
        max-width: 300px;
      `;

      // 图标
      const icon = doc.createElement("span");
      icon.textContent = this.selectedNode.status === "open" ? "📖" : "📕";
      icon.style.fontSize = "14px";
      nodeInfo.appendChild(icon);

      // 标题和时间
      const textInfo = doc.createElement("span");
      textInfo.style.cssText = `
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      `;
      const dateStr = new Date(this.selectedNode.timestamp).toLocaleDateString(
        undefined,
        {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        },
      );
      textInfo.textContent = `${this.selectedNode.title || `Item ${this.selectedNode.itemId}`} · ${dateStr}`;

      // 添加悬停效果
      nodeInfo.addEventListener("mouseenter", () => {
        nodeInfo.style.opacity = "1";
      });
      nodeInfo.addEventListener("mouseleave", () => {
        nodeInfo.style.opacity = "0.8";
      });

      // 添加 tooltip
      nodeInfo.title = `${this.selectedNode.title || `Item ${this.selectedNode.itemId}`}\n${new Date(this.selectedNode.timestamp).toLocaleString()}\nStatus: ${this.selectedNode.status}`;

      nodeInfo.appendChild(textInfo);
      toolbar.appendChild(nodeInfo);
    }

    // 添加笔记按钮
    const addBtn = doc.createElement("button");
    addBtn.textContent = "Add Note";
    addBtn.addEventListener("click", () => {
      try {
        this.showAddNoteDialog();
      } catch (error) {
        Zotero.logError(
          `[NoteRelationsTab] Error showing add note dialog: ${error}`,
        );
      }
    });
    toolbar.appendChild(addBtn);

    // 创建新笔记按钮
    const createBtn = doc.createElement("button");
    createBtn.textContent = "Create New Note";
    createBtn.addEventListener("click", () => {
      try {
        this.createNewNote();
      } catch (error) {
        Zotero.logError(`[NoteRelationsTab] Error creating new note: ${error}`);
      }
    });
    toolbar.appendChild(createBtn);

    // 搜索框
    const searchBox = doc.createElement("input");
    searchBox.type = "text";
    searchBox.placeholder = "Search notes...";
    searchBox.style.cssText = `
      flex: 1;
      padding: 5px;
      border: 1px solid var(--material-border-quarternary);
      border-radius: 3px;
    `;
    searchBox.addEventListener("input", async (e) => {
      try {
        const query = (e.target as HTMLInputElement).value;
        if (query && this.selectedNode) {
          const systemResults =
            await this.noteAssociationSystem.searchRelatedNotes(
              query,
              this.selectedNode.id,
            );
          // Convert system results to tab format
          const results: AssociatedNote[] = systemResults.map((r) => ({
            id: r.noteId,
            noteId: r.noteId,
            nodeId: r.nodeId,
            relationType: r.relationType,
            title: r.note?.getNoteTitle() || "Untitled",
            content: r.note?.getNote() || "",
            dateModified: r.note?.dateModified || new Date(),
          }));
          this.showSearchResults(results);
        } else if (query && !this.selectedNode) {
          // 如果有搜索内容但没有选中节点，清空搜索结果
          const content = this.container?.querySelector(".notes-list");
          if (content) {
            this.showEmptyState();
          }
        }
      } catch (error) {
        Zotero.logError(`[NoteRelationsTab] Error in search: ${error}`);
      }
    });
    toolbar.appendChild(searchBox);

    // 添加分隔符
    const spacer = doc.createElement("div");
    spacer.style.flex = "1";
    toolbar.appendChild(spacer);

    // 模式切换按钮
    const modeSwitcher = doc.createElement("div");
    modeSwitcher.style.cssText = `
      display: flex;
      gap: 5px;
      align-items: center;
      padding: 0 5px;
    `;

    const modeLabel = doc.createElement("span");
    modeLabel.textContent = "View:";
    modeLabel.style.cssText = `
      font-size: 12px;
      color: var(--fill-secondary);
    `;
    modeSwitcher.appendChild(modeLabel);

    const modes: { mode: EditorMode; icon: string; title: string }[] = [
      { mode: "column", icon: "📑", title: "Column view" },
      { mode: "tab", icon: "📄", title: "Tab view" },
      { mode: "drawer", icon: "📋", title: "Drawer view" },
    ];

    modes.forEach(({ mode, icon, title }) => {
      const btn = doc.createElement("button");
      btn.textContent = icon;
      btn.title = title;
      btn.style.cssText = `
        padding: 2px 8px;
        background: ${this.editorMode === mode ? "var(--fill-quinary)" : "transparent"};
        border: 1px solid ${this.editorMode === mode ? "var(--fill-quarternary)" : "transparent"};
        cursor: pointer;
        border-radius: 3px;
      `;
      btn.addEventListener("click", () => this.switchEditorMode(mode));
      modeSwitcher.appendChild(btn);
    });

    toolbar.appendChild(modeSwitcher);

    return toolbar;
  }

  /**
   * 创建通用的笔记部分
   */
  private createSection(
    doc: Document,
    title: string,
    notes: AssociatedNote[],
    isAssociated: boolean,
  ): HTMLElement {
    const section = doc.createElement("div");
    section.className = "notes-section";
    section.style.cssText = `
      margin-bottom: 20px;
    `;

    const header = doc.createElement("h4");
    header.style.cssText = `
      margin: 0 0 10px 0;
      color: var(--fill-primary);
      font-size: 14px;
    `;
    header.textContent = `${title} (${notes.length})`;
    section.appendChild(header);

    const list = doc.createElement("div");
    list.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 10px;
    `;

    for (const note of notes) {
      const noteCard = this.createNoteCard(doc, note, isAssociated);
      list.appendChild(noteCard);
    }

    section.appendChild(list);

    return section;
  }

  /**
   * 创建已关联部分
   */
  private createAssociatedSection(
    doc: Document,
    notes: AssociatedNote[],
  ): HTMLElement {
    const section = doc.createElement("div");
    section.style.cssText = `
      margin-bottom: 30px;
    `;

    const title = doc.createElement("h4");
    title.textContent = `Associated Notes (${notes.length})`;
    title.style.marginBottom = "10px";
    section.appendChild(title);

    const list = doc.createElement("div");
    list.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 10px;
    `;

    for (const note of notes) {
      const noteCard = this.createNoteCard(doc, note, true);
      list.appendChild(noteCard);
    }

    section.appendChild(list);

    return section;
  }

  /**
   * 创建建议部分
   */
  private createSuggestedSection(
    doc: Document,
    notes: AssociatedNote[],
  ): HTMLElement {
    const section = doc.createElement("div");
    section.style.cssText = `
      margin-bottom: 30px;
    `;

    const title = doc.createElement("h4");
    title.textContent = `Suggested Notes (${notes.length})`;
    title.style.marginBottom = "10px";
    section.appendChild(title);

    const list = doc.createElement("div");
    list.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 10px;
    `;

    for (const note of notes) {
      const noteCard = this.createNoteCard(doc, note, false);
      list.appendChild(noteCard);
    }

    section.appendChild(list);

    return section;
  }

  /**
   * 创建笔记卡片
   */
  private createNoteCard(
    doc: Document,
    note: AssociatedNote,
    isAssociated: boolean,
  ): HTMLElement {
    const card = doc.createElement("div");
    card.style.cssText = `
      border: 1px solid var(--material-border-quarternary);
      border-radius: 5px;
      padding: 15px;
      background: var(--material-background);
      transition: all 0.2s;
      cursor: pointer;
    `;

    // 添加悬停效果
    card.addEventListener("mouseenter", () => {
      card.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)";
      card.style.borderColor = "var(--fill-quarternary)";
    });

    card.addEventListener("mouseleave", () => {
      card.style.boxShadow = "";
      card.style.borderColor = "var(--material-border-quarternary)";
    });

    // 点击整个卡片打开笔记
    card.addEventListener("click", (e) => {
      // 避免按钮点击事件冒泡
      if ((e.target as HTMLElement).tagName === "BUTTON") return;

      Zotero.log(
        `[NoteRelationsTab] Card clicked. Mode: ${this.editorMode}, Has container: ${!!this.editorContainer}`,
        "info",
      );

      if (this.editorMode === "column" && this.editorContainer) {
        // 分栏模式：在右侧编辑器中打开
        Zotero.log(
          `[NoteRelationsTab] Opening note ${note.noteId} in editor from card click`,
          "info",
        );
        this.openNoteInEditor(note.noteId);

        // 视觉反馈：高亮选中的卡片
        const section = card.closest(".notes-section");
        if (section) {
          // 清除同一部分中所有卡片的高亮
          const allCards = section.querySelectorAll(
            'div[style*="cursor: pointer"]',
          );
          allCards?.forEach((c) => {
            if (c !== card) {
              (c as HTMLElement).style.background =
                "var(--material-background)";
            }
          });
        }

        // 也清除其他部分的高亮
        const allSections = this.container?.querySelectorAll(".notes-section");
        allSections?.forEach((s) => {
          if (s !== section) {
            const cards = s.querySelectorAll('div[style*="cursor: pointer"]');
            cards?.forEach((c) => {
              (c as HTMLElement).style.background =
                "var(--material-background)";
            });
          }
        });

        card.style.background = "var(--fill-quinary)";
      }
    });

    // 标题行
    const header = doc.createElement("div");
    header.style.cssText = `
      display: flex;
      align-items: start;
      gap: 10px;
      margin-bottom: 10px;
    `;

    const titleContainer = doc.createElement("div");
    titleContainer.style.flex = "1";

    const title = doc.createElement("div");
    title.style.fontWeight = "bold";
    title.textContent = note.title;
    titleContainer.appendChild(title);

    // 显示关联类型
    const relationType = doc.createElement("div");
    relationType.style.cssText = `
      font-size: 0.9em;
      color: var(--fill-secondary);
    `;
    relationType.textContent = `Type: ${note.relationType}`;
    titleContainer.appendChild(relationType);

    header.appendChild(titleContainer);

    // 分支管理按钮
    const branchBtn = doc.createElement("button");
    branchBtn.style.cssText = `
      padding: 4px 8px;
      font-size: 12px;
      background: white;
      border: 1px solid var(--material-border-quarternary);
      border-radius: 3px;
      cursor: pointer;
      color: var(--fill-secondary);
    `;
    branchBtn.innerHTML = "🌿 Branches";
    branchBtn.title = "Manage note branches";
    branchBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.showBranchingPanel(note.noteId);
    });
    header.appendChild(branchBtn);

    // 操作按钮
    const actions = doc.createElement("div");
    actions.style.cssText = `
      display: flex;
      gap: 5px;
    `;

    if (isAssociated) {
      const removeBtn = doc.createElement("button");
      removeBtn.textContent = "Remove";
      removeBtn.style.cssText = `
        padding: 3px 8px;
        font-size: 0.9em;
      `;
      removeBtn.addEventListener("click", async () => {
        if (this.selectedNode && note.id > 0) {
          // note.id 是关联记录的ID，不是笔记ID
          await this.noteAssociationSystem.removeAssociation(
            note.noteId,
            this.selectedNode.id,
          );
          await this.loadNodeAssociations();
        }
      });
      actions.appendChild(removeBtn);
    } else {
      const addBtn = doc.createElement("button");
      addBtn.textContent = "Associate";
      addBtn.style.cssText = `
        padding: 3px 8px;
        font-size: 0.9em;
      `;
      addBtn.addEventListener("click", async () => {
        if (this.selectedNode) {
          await this.noteAssociationSystem.associateNote(
            note.noteId,
            this.selectedNode.id,
            "manual",
          );
          await this.loadNodeAssociations();
        }
      });
      actions.appendChild(addBtn);
    }

    const openBtn = doc.createElement("button");
    openBtn.textContent = this.editorMode === "column" ? "Edit" : "Open";
    openBtn.style.cssText = `
      padding: 3px 8px;
      font-size: 0.9em;
    `;
    openBtn.addEventListener("click", () => {
      // 根据模式打开笔记
      Zotero.log(
        `[NoteRelationsTab] Open button clicked. Mode: ${this.editorMode}, Has container: ${!!this.editorContainer}`,
        "info",
      );

      if (this.editorMode === "column" && this.editorContainer) {
        // 分栏模式：在右侧编辑器中打开
        Zotero.log(
          `[NoteRelationsTab] Opening note ${note.noteId} in editor`,
          "info",
        );
        this.openNoteInEditor(note.noteId);
      } else {
        // 其他模式：在新窗口中打开
        Zotero.log(
          `[NoteRelationsTab] Opening note ${note.noteId} in new window`,
          "info",
        );
        try {
          const noteItem = Zotero.Items.get(note.noteId);
          if (noteItem) {
            const zoteroPane = Zotero.getActiveZoteroPane();
            if (zoteroPane) {
              zoteroPane.openNoteWindow(note.noteId);
            }
          }
        } catch (error) {
          Zotero.logError(`Failed to open note: ${error}`);
        }
      }
    });
    actions.appendChild(openBtn);

    // 删除按钮
    const deleteBtn = doc.createElement("button");
    deleteBtn.textContent = "Delete";
    deleteBtn.style.cssText = `
      padding: 3px 8px;
      font-size: 0.9em;
      background: #dc3545;
      color: white;
      border: none;
      border-radius: 3px;
      cursor: pointer;
    `;
    deleteBtn.addEventListener("mouseover", () => {
      deleteBtn.style.background = "#c82333";
    });
    deleteBtn.addEventListener("mouseout", () => {
      deleteBtn.style.background = "#dc3545";
    });
    deleteBtn.addEventListener("click", async (e) => {
      e.stopPropagation(); // 防止触发卡片点击事件

      // 确认删除
      const confirmDelete = this.window.confirm(
        `Are you sure you want to delete this note?\n\nTitle: ${note.title}\n\nThis action cannot be undone.`,
      );

      if (confirmDelete) {
        try {
          Zotero.log(`[NoteRelationsTab] Deleting note ${note.noteId}`, "info");

          // 如果正在编辑这个笔记，先清空编辑器
          if (this.selectedNoteId === note.noteId && this.editorContainer) {
            this.editorContainer.innerHTML = "";
            this.selectedNoteId = null;
          }

          // 删除笔记
          const noteItem = Zotero.Items.get(note.noteId);
          if (noteItem) {
            await noteItem.eraseTx();
            Zotero.log(
              `[NoteRelationsTab] Note ${note.noteId} deleted successfully`,
              "info",
            );

            // 刷新列表
            await this.loadNodeAssociations();
          } else {
            Zotero.logError(`[NoteRelationsTab] Note ${note.noteId} not found`);
          }
        } catch (error) {
          Zotero.logError(`[NoteRelationsTab] Failed to delete note: ${error}`);
          this.window.alert(`Failed to delete note: ${error}`);
        }
      }
    });
    actions.appendChild(deleteBtn);

    header.appendChild(actions);
    card.appendChild(header);

    // 内容预览
    const content = doc.createElement("div");
    content.style.cssText = `
      font-size: 0.9em;
      color: var(--fill-secondary);
      line-height: 1.5;
      max-height: 100px;
      overflow: hidden;
      margin-bottom: 10px;
    `;

    // 安全地提取纯文本内容
    try {
      // 使用 DOMParser 来解析 HTML，这是 Zotero 推荐的方式
      const parser = new DOMParser();
      const noteDoc = parser.parseFromString(note.content, "text/html");
      let text = noteDoc.body ? noteDoc.body.textContent : "";
      // 标准化空白字符
      text = (text || "").replace(/\s+/g, " ").trim();
      content.textContent =
        text.substring(0, 200) + (text.length > 200 ? "..." : "");
    } catch (error) {
      // 如果 DOMParser 失败，使用简单的正则表达式清理
      Zotero.log(
        `[NoteRelationsTab] Failed to parse note content with DOMParser: ${error}`,
        "warn",
      );
      try {
        const text = note.content
          .replace(/<[^>]*>/g, "")
          .replace(/\s+/g, " ")
          .trim();
        content.textContent =
          text.substring(0, 200) + (text.length > 200 ? "..." : "");
      } catch (fallbackError) {
        content.textContent = "[Unable to display note content]";
        Zotero.logError(
          `[NoteRelationsTab] Failed to extract text from note: ${fallbackError}`,
        );
      }
    }

    card.appendChild(content);

    // 元信息
    const meta = doc.createElement("div");
    meta.style.cssText = `
      display: flex;
      gap: 15px;
      font-size: 0.85em;
      color: var(--fill-tertiary);
    `;

    const date = doc.createElement("span");
    date.textContent = `Modified: ${note.dateModified.toLocaleDateString()}`;
    meta.appendChild(date);

    // 移除 tags 相关代码，因为 AssociatedNote 接口中没有 tags 属性

    card.appendChild(meta);

    // 悬停效果
    card.addEventListener("mouseenter", () => {
      card.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)";
    });

    card.addEventListener("mouseleave", () => {
      card.style.boxShadow = "";
    });

    return card;
  }

  /**
   * 显示空状态
   */
  private showEmptyState(): void {
    if (!this.contentContainer) return;

    const doc = this.window.document;
    this.contentContainer.innerHTML = "";

    const empty = doc.createElement("div");
    empty.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--fill-secondary);
      text-align: center;
      padding: 40px;
    `;

    const icon = doc.createElement("div");
    icon.style.fontSize = "48px";
    icon.textContent = "📝";
    empty.appendChild(icon);

    const title = doc.createElement("h3");
    title.textContent = "Select a History Node";
    empty.appendChild(title);

    const desc = doc.createElement("p");
    desc.textContent =
      "Choose a node from the left panel to view and manage its note associations";
    empty.appendChild(desc);

    this.contentContainer.appendChild(empty);
  }

  /**
   * 显示添加笔记对话框
   */
  private async showAddNoteDialog(): Promise<void> {
    if (!this.selectedNode) return;

    const doc = this.window.document;

    // 确保有 body 元素
    if (!doc.body) {
      Zotero.logError("[NoteRelationsTab] Document body not available");
      return;
    }

    // 创建模态对话框
    const dialog = doc.createElement("div");
    dialog.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: var(--material-background);
      border: 1px solid var(--material-border-quarternary);
      border-radius: 10px;
      box-shadow: 0 5px 20px rgba(0,0,0,0.3);
      padding: 20px;
      z-index: 10000;
      width: 400px;
      max-height: 600px;
      display: flex;
      flex-direction: column;
    `;

    // 标题
    const title = doc.createElement("h3");
    title.textContent = "Select Note to Associate";
    title.style.cssText = `
      margin: 0 0 15px 0;
      font-size: 16px;
    `;
    dialog.appendChild(title);

    // 搜索框
    const searchInput = doc.createElement("input");
    searchInput.type = "text";
    searchInput.placeholder = "Search notes...";
    searchInput.style.cssText = `
      padding: 8px;
      border: 1px solid var(--material-border-quarternary);
      border-radius: 5px;
      margin-bottom: 10px;
    `;
    dialog.appendChild(searchInput);

    // 笔记列表容器
    const noteListContainer = doc.createElement("div");
    noteListContainer.style.cssText = `
      flex: 1;
      overflow-y: auto;
      max-height: 400px;
      border: 1px solid var(--material-border-quarternary);
      border-radius: 5px;
      padding: 10px;
    `;
    dialog.appendChild(noteListContainer);

    // 加载所有笔记
    const loadNotes = async (filter = "") => {
      noteListContainer.innerHTML = "";

      // 获取所有笔记
      const s = new Zotero.Search();
      s.libraryID =
        this.selectedNode.libraryId || Zotero.Libraries.userLibraryID;
      s.addCondition("itemType", "is", "note");
      if (filter) {
        s.addCondition("title", "contains", filter);
      }

      const noteIDs = await s.search();
      const notes = await Zotero.Items.getAsync(noteIDs);

      if (notes.length === 0) {
        noteListContainer.innerHTML = "<p>No notes found</p>";
        return;
      }

      // 显示笔记列表
      for (const note of notes.slice(0, 50)) {
        // 限制显示前50个
        const noteItem = doc.createElement("div");
        noteItem.style.cssText = `
          padding: 10px;
          border-bottom: 1px solid var(--material-border-quarternary);
          cursor: pointer;
        `;

        // 笔记标题
        const noteTitle = doc.createElement("div");
        noteTitle.style.fontWeight = "bold";
        noteTitle.textContent = note.getNoteTitle() || "Untitled Note";
        noteItem.appendChild(noteTitle);

        // 笔记预览
        const notePreview = doc.createElement("div");
        notePreview.style.cssText = `
          font-size: 12px;
          color: var(--fill-secondary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        `;
        // 安全地提取笔记内容
        try {
          const parser = new DOMParser();
          const noteDoc = parser.parseFromString(note.getNote(), "text/html");
          let plainText = noteDoc.body ? noteDoc.body.textContent : "";
          plainText = (plainText || "").replace(/\s+/g, " ").trim();
          notePreview.textContent =
            plainText.substring(0, 100) + (plainText.length > 100 ? "..." : "");
        } catch (error) {
          // 回退到正则清理
          const noteContent = note.getNote();
          const plainText = noteContent
            .replace(/<[^>]*>/g, "")
            .replace(/\s+/g, " ")
            .trim();
          notePreview.textContent =
            plainText.substring(0, 100) + (plainText.length > 100 ? "..." : "");
        }
        noteItem.appendChild(notePreview);

        // 点击选择
        noteItem.addEventListener("click", async () => {
          await this.noteAssociationSystem.associateNote(
            note.id,
            this.selectedNode.id,
          );
          await this.loadNodeAssociations();
          closeDialog();
        });

        // 悬停效果
        noteItem.addEventListener("mouseenter", () => {
          noteItem.style.background = "var(--material-mix-quinary)";
        });
        noteItem.addEventListener("mouseleave", () => {
          noteItem.style.background = "";
        });

        noteListContainer.appendChild(noteItem);
      }
    };

    // 搜索事件
    let searchTimeout: any;
    searchInput.addEventListener("input", () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        loadNotes(searchInput.value);
      }, 300);
    });

    // 遮罩层
    const overlay = doc.createElement("div");
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      z-index: 9999;
    `;

    // 关闭对话框函数（提前定义）
    const closeDialog = () => {
      doc.body.removeChild(overlay);
      doc.body.removeChild(dialog);
    };

    overlay.addEventListener("click", closeDialog);

    // 按钮容器
    const buttonContainer = doc.createElement("div");
    buttonContainer.style.cssText = `
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 15px;
    `;

    // 取消按钮
    const cancelBtn = doc.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", closeDialog);
    buttonContainer.appendChild(cancelBtn);

    dialog.appendChild(buttonContainer);

    // 显示对话框
    doc.body.appendChild(overlay);
    doc.body.appendChild(dialog);

    // 初始加载
    await loadNotes();

    // 聚焦搜索框
    searchInput.focus();
  }

  /**
   * 创建新笔记
   */
  private async createNewNote(): Promise<void> {
    if (!this.selectedNode) return;

    try {
      // 获取目标项目
      const item = await Zotero.Items.getAsync(this.selectedNode.itemId);
      if (!item) {
        Zotero.logError("[NoteRelationsTab] Item not found for creating note");
        return;
      }

      // 确定父项ID
      let parentItemID: number | undefined;
      let targetTitle = this.selectedNode.title;

      if (item.isAttachment() && item.parentID) {
        // 如果是附件，笔记应该关联到父项
        parentItemID = item.parentID;
        const parent = await Zotero.Items.getAsync(item.parentID);
        if (parent) {
          targetTitle = parent.getField("title");
        }
      } else if (!item.isNote() && item.isRegularItem()) {
        // 如果是普通项目，直接设置为父项
        parentItemID = item.id;
      }

      // 创建新笔记
      const note = new Zotero.Item("note");
      const timestamp = new Date().toLocaleString();
      note.setNote(
        `<h1>Note for ${targetTitle}</h1><p>Created from Research Navigator at ${timestamp}</p><p></p>`,
      );

      if (parentItemID) {
        note.parentItemID = parentItemID;
      }

      await note.saveTx();

      // 自动关联到历史节点
      await this.noteAssociationSystem.createAssociation(
        note.id,
        this.selectedNode.id,
        "created_during",
        { source: "manual", context: "Created from history node" },
      );

      // 刷新笔记列表并在面板内打开新笔记
      try {
        // 先刷新关联列表以显示新创建的笔记
        await this.loadNodeAssociations();

        // 如果是列模式，直接在右侧编辑器中打开
        if (this.editorMode === "column" && this.editorContainer) {
          Zotero.log(
            `[NoteRelationsTab] Opening new note ${note.id} in panel editor`,
            "info",
          );
          this.openNoteInEditor(note.id);
        } else {
          // 如果不是列模式，则打开独立窗口
          const zoteroPane = Zotero.getActiveZoteroPane();
          if (zoteroPane && typeof zoteroPane.selectItem === "function") {
            await zoteroPane.selectItem(note.id);
            Zotero.log(`[NoteRelationsTab] Selected note: ${note.id}`, "info");
          }

          // 使用 setTimeout 确保 UI 已经更新
          setTimeout(() => {
            try {
              const zp = Zotero.getActiveZoteroPane();
              if (zp && typeof zp.openNoteWindow === "function") {
                Zotero.log(
                  `[NoteRelationsTab] Opening note window for note ID: ${note.id}`,
                  "info",
                );
                // 检查笔记是否真的存在
                const noteItem = Zotero.Items.get(note.id);
                if (noteItem) {
                  zp.openNoteWindow(note.id);
                } else {
                  Zotero.logError(
                    `[NoteRelationsTab] Note item not found in database: ${note.id}`,
                  );
                }
              } else {
                // 如果不能打开独立窗口，至少聚焦到笔记编辑器
                const noteEditor =
                  zp?.document.getElementById("zotero-note-editor");
                if (noteEditor) {
                  noteEditor.focus();
                  Zotero.log(
                    "[NoteRelationsTab] Focused on note editor",
                    "info",
                  );
                }
              }
            } catch (error) {
              Zotero.logError(
                `[NoteRelationsTab] Error in setTimeout: ${error}`,
              );
            }
          }, 100);
        }
      } catch (error) {
        Zotero.logError(
          `[NoteRelationsTab] Error selecting/opening note: ${error}`,
        );
      }

      // 刷新显示
      await this.loadNodeAssociations();

      Zotero.log(
        `[NoteRelationsTab] Created new note: ${note.id} for parent: ${parentItemID}`,
        "info",
      );
    } catch (error) {
      Zotero.logError(`[NoteRelationsTab] Failed to create new note: ${error}`);
    }
  }

  /**
   * 显示搜索结果
   */
  private showSearchResults(results: AssociatedNote[]): void {
    const doc = this.window.document;
    const content = this.container?.querySelector(".notes-list");
    if (!content) return;

    // 清空当前内容
    content.innerHTML = "";

    // 显示搜索结果标题
    const header = doc.createElement("h4");
    header.style.cssText = `
      margin: 15px 15px 10px 15px;
      color: var(--fill-primary);
      display: flex;
      align-items: center;
      gap: 10px;
    `;
    header.innerHTML = `🔍 Search Results (${results.length})`;

    // 添加清除搜索按钮
    const clearBtn = doc.createElement("button");
    clearBtn.textContent = "Clear";
    clearBtn.style.cssText = `
      padding: 2px 8px;
      font-size: 12px;
      cursor: pointer;
    `;
    clearBtn.addEventListener("click", () => {
      // 清空搜索框
      const searchBox = this.container?.querySelector(
        'input[type="text"]',
      ) as HTMLInputElement;
      if (searchBox) {
        searchBox.value = "";
      }
      // 重新加载原始内容
      if (this.selectedNode) {
        this.loadNodeAssociations();
      }
    });
    header.appendChild(clearBtn);

    content.appendChild(header);

    if (results.length === 0) {
      const emptyMsg = doc.createElement("div");
      emptyMsg.style.cssText = `
        padding: 30px;
        text-align: center;
        color: var(--fill-secondary);
      `;
      emptyMsg.textContent = "No notes found matching your search.";
      content.appendChild(emptyMsg);
      return;
    }

    // 显示搜索结果
    const section = this.createSection(doc, "", results, false);
    content.appendChild(section);

    Zotero.log(
      `[NoteRelationsTab] Displayed ${results.length} search results`,
      "info",
    );
  }

  /**
   * 过滤节点
   */
  private filterNodes(query: string): void {
    // TODO: 实现节点过滤
    Zotero.log(`[NoteRelationsTab] Filter nodes: ${query}`, "info");
  }

  /**
   * 切换编辑器模式
   */
  private switchEditorMode(mode: EditorMode): void {
    if (this.editorMode === mode) return;

    this.editorMode = mode;
    Zotero.log(`[NoteRelationsTab] Switching to ${mode} mode`, "info");

    // 重新渲染内容
    if (this.selectedNode) {
      this.loadNodeAssociations();
    }

    // 更新工具栏按钮状态
    this.updateModeButtons();
  }

  /**
   * 更新模式按钮状态
   */
  private updateModeButtons(): void {
    const buttons = this.container?.querySelectorAll('[title*="view"]');
    buttons?.forEach((btn, index) => {
      const modes: EditorMode[] = ["column", "tab", "drawer"];
      const isActive = modes[index] === this.editorMode;
      (btn as HTMLElement).style.background = isActive
        ? "var(--fill-quinary)"
        : "transparent";
      (btn as HTMLElement).style.border =
        `1px solid ${isActive ? "var(--fill-quarternary)" : "transparent"}`;
    });
  }

  /**
   * 在编辑器中打开笔记
   */
  private openNoteInEditor(noteId: number): void {
    Zotero.log(
      `[NoteRelationsTab] openNoteInEditor called with noteId: ${noteId}`,
      "info",
    );

    if (!this.editorContainer) {
      Zotero.log(`[NoteRelationsTab] No editor container found!`, "warning");
      return;
    }

    // 如果正在打开相同的笔记，忽略
    if (this.selectedNoteId === noteId) {
      Zotero.log(`[NoteRelationsTab] Note ${noteId} already open`, "info");
      return;
    }

    // 清理现有编辑器
    try {
      const existingEditor =
        this.editorContainer.querySelector("[data-note-id]");
      if (existingEditor) {
        // 清理 EditorInstance
        const editorInstance = (existingEditor as any)._editorInstance;
        if (editorInstance && typeof editorInstance.uninit === "function") {
          Zotero.log(
            `[NoteRelationsTab] Uninitializing previous editor`,
            "info",
          );
          try {
            editorInstance.uninit();
          } catch (e) {
            Zotero.logError(
              `[NoteRelationsTab] Error uninitializing editor: ${e}`,
            );
          }
        }

        // 清理 iframe 的 EditorInstance
        const iframe = existingEditor.querySelector("iframe");
        if (iframe && (iframe as any)._editorInstance) {
          const iframeInstance = (iframe as any)._editorInstance;
          if (iframeInstance && typeof iframeInstance.uninit === "function") {
            try {
              iframeInstance.uninit();
            } catch (e) {
              Zotero.logError(
                `[NoteRelationsTab] Error uninitializing iframe editor: ${e}`,
              );
            }
          }
        }
      }
    } catch (e) {
      Zotero.logError(`[NoteRelationsTab] Error during editor cleanup: ${e}`);
    }

    this.editorContainer.innerHTML = "";
    Zotero.log(`[NoteRelationsTab] Cleared editor container`, "info");

    // 首先添加一个加载指示器来确认容器可见
    const doc = this.window.document;
    const loadingDiv = doc.createElement("div");
    loadingDiv.style.cssText = `
      padding: 20px;
      text-align: center;
      background: #f0f0f0;
      border: 2px solid #ccc;
      border-radius: 5px;
      margin: 10px;
    `;
    loadingDiv.textContent = `Loading note ${noteId}...`;
    this.editorContainer.appendChild(loadingDiv);

    // 延迟创建编辑器，让用户看到加载状态
    setTimeout(() => {
      this.editorContainer.innerHTML = "";

      // 创建新编辑器
      const editor = this.createNoteEditor(noteId);
      if (editor) {
        this.editorContainer.appendChild(editor);
        Zotero.log(`[NoteRelationsTab] Editor created and appended`, "info");

        // 给编辑器一个唯一的 ID 以便调试
        editor.setAttribute("data-note-id", noteId.toString());

        // 检查容器的实际大小
        const containerRect = this.editorContainer.getBoundingClientRect();
        Zotero.log(
          `[NoteRelationsTab] Container dimensions: ${containerRect.width}x${containerRect.height}`,
          "info",
        );
      } else {
        Zotero.log(`[NoteRelationsTab] Failed to create editor`, "error");

        // 显示错误信息
        const errorDiv = doc.createElement("div");
        errorDiv.style.cssText = `
          padding: 20px;
          text-align: center;
          color: red;
          background: #ffe0e0;
          border: 1px solid #ff0000;
          border-radius: 5px;
          margin: 10px;
        `;
        errorDiv.textContent = `Failed to load editor for note ${noteId}`;
        this.editorContainer.appendChild(errorDiv);
      }
    }, 500);
  }

  /**
   * 创建笔记编辑器
   */
  private createNoteEditor(noteId: number): HTMLElement | null {
    const doc = this.window.document;

    try {
      // 确保自定义元素脚本已加载
      const win = this.window as any;

      // 检查是否需要加载脚本
      if (!win.customElements || !win.customElements.get("note-editor")) {
        Zotero.log(
          `[NoteRelationsTab] note-editor element not registered, loading scripts`,
          "info",
        );

        if (win.Services && win.Services.scriptloader) {
          try {
            // 加载 customElements.js 脚本
            win.Services.scriptloader.loadSubScript(
              "chrome://zotero/content/customElements.js",
              win,
            );
            Zotero.log(
              `[NoteRelationsTab] Custom elements script loaded`,
              "info",
            );
          } catch (e) {
            Zotero.logError(
              `[NoteRelationsTab] Failed to load custom elements: ${e}`,
            );
            return null;
          }
        } else {
          Zotero.logError(
            `[NoteRelationsTab] Services.scriptloader not available`,
          );
          return null;
        }
      }

      // 创建编辑器容器
      const editorContainer = doc.createElement("div");
      editorContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        height: 100%;
        width: 100%;
        min-height: 400px;
        background: var(--material-background);
        border: 1px solid var(--material-border-quarternary);
        border-radius: 5px;
        overflow: hidden;
      `;

      // 尝试使用原生编辑器
      const useNativeEditor = true;

      if (useNativeEditor && win.Zotero && win.Zotero.EditorInstance) {
        Zotero.log(`[NoteRelationsTab] Using native Zotero editor`, "info");

        // 创建编辑器容器，模仿 note-editor 的结构
        const noteEditorContainer = doc.createElement("div");
        noteEditorContainer.style.cssText = `
          display: flex;
          flex-direction: column;
          height: 100%;
          width: 100%;
        `;

        // 创建 iframe
        const iframe = doc.createElement("iframe") as HTMLIFrameElement;
        iframe.id = "editor-view";
        iframe.style.cssText = `
          border: 0;
          width: 100%;
          flex-grow: 1;
          min-height: 400px;
        `;
        // 设置属性以避免 XPC 错误
        iframe.setAttribute("type", "content");
        iframe.setAttribute("remote", "false");
        iframe.setAttribute("src", "resource://zotero/note-editor/editor.html");

        noteEditorContainer.appendChild(iframe);
        editorContainer.appendChild(noteEditorContainer);

        // 注册 UIProperties
        if (win.Zotero.UIProperties) {
          win.Zotero.UIProperties.registerRoot(noteEditorContainer);
        }

        // 先隐藏 iframe，避免闪烁
        iframe.style.visibility = "hidden";

        // 标记 iframe 初始化状态
        let iframeInitialized = false;

        // 等待 iframe 内容加载
        const initializeEditor = async () => {
          if (iframeInitialized) return;
          iframeInitialized = true;

          try {
            Zotero.log(
              `[NoteRelationsTab] iframe ready, contentWindow available: ${!!iframe.contentWindow}`,
              "info",
            );

            // 等待一下确保 iframe 完全准备好
            await new Promise((resolve) => setTimeout(resolve, 200));

            const item = await Zotero.Items.getAsync(noteId);
            if (item && item.isNote()) {
              Zotero.log(
                `[NoteRelationsTab] Initializing native editor for note ${noteId}`,
                "info",
              );

              // 检查 contentWindow 是否真的可用
              if (!iframe.contentWindow) {
                throw new Error("iframe contentWindow is not available");
              }

              // 创建 EditorInstance
              const editorInstance = new win.Zotero.EditorInstance();
              Zotero.log(`[NoteRelationsTab] EditorInstance created`, "info");

              // 使用兼容性模块处理 BetterNotes
              BetterNotesCompat.markEditorAsManaged(editorInstance, iframe);

              // 初始化编辑器
              await editorInstance.init({
                item: item,
                iframeWindow: iframe.contentWindow,
                viewMode: "library",
                readOnly: false,
                placeholder: "Start typing...",
                // 添加 popup 参数以避免 BetterNotes 错误
                popup: null,
                // 禁用某些可能导致冲突的功能
                disableUI: false,
                _betterNotesIgnore: true,
              });

              // 保存引用以便清理
              (noteEditorContainer as any)._editorInstance = editorInstance;
              (iframe as any)._editorInstance = editorInstance;
              this.selectedNoteId = noteId;

              Zotero.log(
                `[NoteRelationsTab] Native editor initialized successfully`,
                "info",
              );

              // 检查编辑器状态并显示
              setTimeout(() => {
                const iframeDoc = iframe.contentDocument;
                if (iframeDoc) {
                  const hasContent =
                    iframeDoc.body && iframeDoc.body.innerHTML.length > 0;
                  Zotero.log(
                    `[NoteRelationsTab] iframe has content: ${hasContent}`,
                    "info",
                  );
                  Zotero.log(
                    `[NoteRelationsTab] iframe body class: ${iframeDoc.body?.className}`,
                    "info",
                  );

                  // 尝试找到编辑器元素
                  const editorEl = iframeDoc.querySelector(".editor-core");
                  Zotero.log(
                    `[NoteRelationsTab] Editor element found: ${!!editorEl}`,
                    "info",
                  );

                  // 如果内容已加载，显示 iframe
                  if (hasContent && editorEl) {
                    iframe.style.visibility = "visible";
                    iframe.style.opacity = "0";
                    iframe.style.transition = "opacity 0.3s ease-in-out";
                    setTimeout(() => {
                      iframe.style.opacity = "1";
                    }, 50);
                  }
                }
              }, 500);

              // 备用：确保最终显示
              setTimeout(() => {
                iframe.style.visibility = "visible";
                iframe.style.opacity = "1";
              }, 1500);
            }
          } catch (error) {
            Zotero.logError(
              `[NoteRelationsTab] Failed to initialize native editor: ${error}`,
            );

            // 如果原生编辑器失败，回退到自定义编辑器
            Zotero.log(
              `[NoteRelationsTab] Falling back to custom editor`,
              "warning",
            );
            this.editorContainer.innerHTML = "";
            const customEditor = this.createCustomEditor(noteId);
            if (customEditor) {
              this.editorContainer.appendChild(customEditor);
            }
          }
        };

        // 监听 DOMContentLoaded 事件
        iframe.addEventListener("DOMContentLoaded", initializeEditor);

        // 备用：监听 load 事件
        iframe.addEventListener("load", () => {
          Zotero.log(`[NoteRelationsTab] iframe load event fired`, "info");
          initializeEditor();
        });

        // 再备用：设置超时初始化
        setTimeout(() => {
          if (!iframeInitialized && iframe.contentWindow) {
            Zotero.log(`[NoteRelationsTab] Timeout initialization`, "warning");
            initializeEditor();
          }
        }, 2000);

        return editorContainer;
      } else if (
        !useNativeEditor ||
        !win.customElements ||
        !win.customElements.get("note-editor")
      ) {
        Zotero.log(`[NoteRelationsTab] Using custom editable display`, "info");

        // 创建可编辑的笔记显示
        const noteDisplay = doc.createElement("div");
        noteDisplay.style.cssText = `
          display: flex;
          flex-direction: column;
          height: 100%;
          background: white;
          border: 1px solid #ddd;
          border-radius: 5px;
          overflow: hidden;
        `;

        // 创建工具栏
        const toolbar = doc.createElement("div");
        toolbar.style.cssText = `
          padding: 10px;
          background: #f5f5f5;
          border-bottom: 1px solid #ddd;
          display: flex;
          gap: 10px;
          align-items: center;
        `;

        const saveBtn = doc.createElement("button");
        saveBtn.textContent = "Save";
        saveBtn.style.cssText = `
          padding: 5px 15px;
          background: #4CAF50;
          color: white;
          border: none;
          border-radius: 3px;
          cursor: pointer;
        `;

        const status = doc.createElement("span");
        status.style.cssText = `
          margin-left: 10px;
          color: #666;
          font-size: 12px;
        `;

        toolbar.appendChild(saveBtn);
        toolbar.appendChild(status);
        noteDisplay.appendChild(toolbar);

        // 创建可编辑区域
        const editor = doc.createElement("div");
        editor.contentEditable = "true";
        editor.style.cssText = `
          flex: 1;
          padding: 20px;
          overflow-y: auto;
          outline: none;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 14px;
          line-height: 1.6;
        `;

        noteDisplay.appendChild(editor);

        // 异步加载笔记内容
        setTimeout(async () => {
          try {
            const item = await Zotero.Items.getAsync(noteId);
            if (item && item.isNote()) {
              const noteContent = item.getNote();
              editor.innerHTML = noteContent;
              this.selectedNoteId = noteId;

              // 保存按钮事件
              saveBtn.onclick = async () => {
                try {
                  saveBtn.disabled = true;
                  status.textContent = "Saving...";
                  status.style.color = "#666";

                  // 保存笔记
                  item.setNote(editor.innerHTML);
                  await item.saveTx();

                  status.textContent = "Saved!";
                  status.style.color = "#4CAF50";

                  // 3秒后清除状态
                  setTimeout(() => {
                    status.textContent = "";
                  }, 3000);
                } catch (error) {
                  Zotero.logError(
                    `[NoteRelationsTab] Failed to save note: ${error}`,
                  );
                  status.textContent = "Save failed!";
                  status.style.color = "#f44336";
                } finally {
                  saveBtn.disabled = false;
                }
              };

              // 添加快捷键支持 (Ctrl+S)
              editor.addEventListener("keydown", (e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === "s") {
                  e.preventDefault();
                  saveBtn.click();
                }
              });

              Zotero.log(
                `[NoteRelationsTab] Editable note display loaded`,
                "info",
              );
            }
          } catch (error) {
            Zotero.logError(
              `[NoteRelationsTab] Failed to load note content: ${error}`,
            );
            editor.innerHTML = `<p style="color: red;">Failed to load note: ${error}</p>`;
            editor.contentEditable = "false";
          }
        }, 100);

        editorContainer.appendChild(noteDisplay);
        return editorContainer;
      }

      // 创建 note-editor 元素
      const noteEditor = doc.createElement("note-editor") as any;
      noteEditor.setAttribute("flex", "1");
      noteEditor.setAttribute("notitle", "1");
      noteEditor.style.cssText = `
        display: flex;
        flex: 1;
        width: 100%;
        height: 100%;
      `;

      // 设置编辑器属性
      noteEditor.mode = "edit";
      noteEditor.viewMode = "library";

      // 立即添加到容器，让编辑器初始化
      editorContainer.appendChild(noteEditor);

      // 异步加载笔记
      setTimeout(async () => {
        try {
          const item = await Zotero.Items.getAsync(noteId);
          if (item && item.isNote()) {
            Zotero.log(
              `[NoteRelationsTab] Loading note item into editor`,
              "info",
            );

            // 确保编辑器已连接到 DOM
            if (noteEditor.isConnected) {
              noteEditor.parent = null;
              noteEditor.item = item;

              // 隐藏 links 容器（标签和相关）
              setTimeout(() => {
                const linksContainer =
                  noteEditor.querySelector("#links-container");
                if (linksContainer) {
                  (linksContainer as HTMLElement).hidden = true;
                }
              }, 300);

              this.selectedNoteId = noteId;
              Zotero.log(`[NoteRelationsTab] Note loaded successfully`, "info");

              // 调试：检查编辑器的实际大小
              const rect = noteEditor.getBoundingClientRect();
              Zotero.log(
                `[NoteRelationsTab] Editor dimensions: ${rect.width}x${rect.height}`,
                "info",
              );

              // 确保编辑器可见
              noteEditor.style.visibility = "visible";
              noteEditor.style.opacity = "1";

              // 添加一个测试边框来确认编辑器位置
              noteEditor.style.border = "2px solid red";

              // 检查编辑器内部的 iframe
              setTimeout(() => {
                const iframe = noteEditor.querySelector("iframe");
                if (iframe) {
                  Zotero.log(
                    `[NoteRelationsTab] Found iframe inside editor`,
                    "info",
                  );
                  iframe.style.border = "2px solid blue";
                } else {
                  Zotero.log(
                    `[NoteRelationsTab] No iframe found inside editor`,
                    "warning",
                  );
                }

                // 列出编辑器的所有子元素
                const children = noteEditor.children;
                Zotero.log(
                  `[NoteRelationsTab] Editor has ${children.length} children`,
                  "info",
                );
                for (let i = 0; i < children.length; i++) {
                  Zotero.log(
                    `[NoteRelationsTab] Child ${i}: ${children[i].tagName}`,
                    "info",
                  );
                }
              }, 500);
            } else {
              Zotero.log(
                `[NoteRelationsTab] Editor not connected to DOM`,
                "warning",
              );
            }
          }
        } catch (error) {
          Zotero.logError(
            `[NoteRelationsTab] Failed to load note ${noteId}: ${error}`,
          );
        }
      }, 200);

      return editorContainer;
    } catch (error) {
      Zotero.logError(`[NoteRelationsTab] Failed to create editor: ${error}`);
      return null;
    }
  }

  /**
   * 创建自定义编辑器（回退方案）
   */
  private createCustomEditor(noteId: number): HTMLElement | null {
    const doc = this.window.document;

    // 复用之前的自定义编辑器代码
    const noteDisplay = doc.createElement("div");
    noteDisplay.style.cssText = `
      display: flex;
      flex-direction: column;
      height: 100%;
      background: white;
      border: 1px solid #ddd;
      border-radius: 5px;
      overflow: hidden;
    `;

    const toolbar = doc.createElement("div");
    toolbar.style.cssText = `
      padding: 10px;
      background: #f5f5f5;
      border-bottom: 1px solid #ddd;
      display: flex;
      gap: 10px;
      align-items: center;
    `;

    const saveBtn = doc.createElement("button");
    saveBtn.textContent = "Save";
    saveBtn.style.cssText = `
      padding: 5px 15px;
      background: #4CAF50;
      color: white;
      border: none;
      border-radius: 3px;
      cursor: pointer;
    `;

    const status = doc.createElement("span");
    status.style.cssText = `
      margin-left: 10px;
      color: #666;
      font-size: 12px;
    `;

    toolbar.appendChild(saveBtn);
    toolbar.appendChild(status);
    noteDisplay.appendChild(toolbar);

    const editor = doc.createElement("div");
    editor.contentEditable = "true";
    editor.style.cssText = `
      flex: 1;
      padding: 20px;
      overflow-y: auto;
      outline: none;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.6;
    `;

    noteDisplay.appendChild(editor);

    setTimeout(async () => {
      try {
        const item = await Zotero.Items.getAsync(noteId);
        if (item && item.isNote()) {
          editor.innerHTML = item.getNote();
          this.selectedNoteId = noteId;

          saveBtn.onclick = async () => {
            try {
              saveBtn.disabled = true;
              status.textContent = "Saving...";
              item.setNote(editor.innerHTML);
              await item.saveTx();
              status.textContent = "Saved!";
              setTimeout(() => {
                status.textContent = "";
              }, 3000);
            } catch (error) {
              Zotero.logError(`[NoteRelationsTab] Failed to save: ${error}`);
              status.textContent = "Save failed!";
              status.style.color = "#f44336";
            } finally {
              saveBtn.disabled = false;
            }
          };

          editor.addEventListener("keydown", (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "s") {
              e.preventDefault();
              saveBtn.click();
            }
          });
        }
      } catch (error) {
        Zotero.logError(`[NoteRelationsTab] Failed to load note: ${error}`);
        editor.innerHTML = `<p style="color: red;">Failed to load note: ${error}</p>`;
        editor.contentEditable = "false";
      }
    }, 100);

    return noteDisplay;
  }

  /**
   * 显示分支管理面板
   */
  private async showBranchingPanel(noteId: number): Promise<void> {
    if (!this.container) return;

    const doc = this.window.document;

    // 如果已经有分支面板，先移除
    if (this.branchingPanel) {
      this.branchingPanel.remove();
      this.branchingPanel = null;
    }

    // 创建浮动面板
    this.branchingPanel = doc.createElement("div");
    this.branchingPanel.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 600px;
      max-height: 80vh;
      background: white;
      border: 1px solid var(--material-border);
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      z-index: 1000;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    `;

    // 标题栏
    const header = doc.createElement("div");
    header.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid var(--material-border);
      background: #f5f5f5;
    `;

    const title = doc.createElement("h3");
    title.style.cssText = `
      margin: 0;
      font-size: 16px;
      font-weight: 600;
    `;
    title.textContent = "🌿 Note Branches";
    header.appendChild(title);

    const closeBtn = doc.createElement("button");
    closeBtn.style.cssText = `
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
      color: #666;
      padding: 0;
      width: 30px;
      height: 30px;
    `;
    closeBtn.innerHTML = "×";
    closeBtn.addEventListener("click", () => {
      this.branchingPanel?.remove();
      this.branchingPanel = null;
    });
    header.appendChild(closeBtn);

    this.branchingPanel.appendChild(header);

    // 内容区域
    const content = doc.createElement("div");
    content.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 20px;
    `;

    try {
      // 获取分支信息
      const branches = await this.noteBranchingSystem.getAllBranches(noteId);

      if (branches.length === 0) {
        // 创建初始版本
        content.innerHTML = `
          <div style="text-align: center; padding: 40px;">
            <p style="color: #666; margin-bottom: 20px;">This note has no version history yet.</p>
            <button id="init-branching" style="
              padding: 8px 16px;
              background: var(--accent-blue);
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
            ">Initialize Version Control</button>
          </div>
        `;

        const initBtn = content.querySelector("#init-branching");
        initBtn?.addEventListener("click", async () => {
          try {
            await this.noteBranchingSystem.createInitialVersion(noteId);
            // 重新加载面板
            this.showBranchingPanel(noteId);
          } catch (error) {
            Zotero.logError(
              `[NoteRelationsTab] Failed to initialize branching: ${error}`,
            );
          }
        });
      } else {
        // 显示分支列表
        const branchList = doc.createElement("div");
        branchList.style.cssText = `
          margin-bottom: 20px;
        `;

        const listTitle = doc.createElement("h4");
        listTitle.style.cssText = `
          margin: 0 0 10px 0;
          font-size: 14px;
          color: #666;
        `;
        listTitle.textContent = "Branches:";
        branchList.appendChild(listTitle);

        for (const branch of branches) {
          const branchItem = doc.createElement("div");
          branchItem.style.cssText = `
            padding: 10px;
            margin-bottom: 8px;
            border: 1px solid var(--material-border-quarternary);
            border-radius: 4px;
            background: ${branch.name === "main" ? "#e3f2fd" : "white"};
            cursor: pointer;
          `;

          branchItem.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong>${branch.name}</strong>
                ${branch.name === "main" ? '<span style="margin-left: 8px; font-size: 11px; color: #1976d2;">DEFAULT</span>' : ""}
              </div>
              <div style="font-size: 12px; color: #666;">
                Updated: ${new Date(branch.updatedAt).toLocaleDateString()}
              </div>
            </div>
          `;

          branchList.appendChild(branchItem);
        }

        content.appendChild(branchList);

        // 操作按钮
        const actions = doc.createElement("div");
        actions.style.cssText = `
          display: flex;
          gap: 10px;
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid var(--material-border-quarternary);
        `;

        const newBranchBtn = doc.createElement("button");
        newBranchBtn.style.cssText = `
          padding: 8px 16px;
          background: white;
          border: 1px solid var(--material-border);
          border-radius: 4px;
          cursor: pointer;
        `;
        newBranchBtn.textContent = "+ New Branch";
        newBranchBtn.addEventListener("click", async () => {
          const branchName = this.window.prompt("Enter branch name:");
          if (branchName) {
            try {
              await this.noteBranchingSystem.createBranch(noteId, branchName);
              this.showBranchingPanel(noteId);
            } catch (error) {
              Zotero.logError(
                `[NoteRelationsTab] Failed to create branch: ${error}`,
              );
            }
          }
        });
        actions.appendChild(newBranchBtn);

        const commitBtn = doc.createElement("button");
        commitBtn.style.cssText = `
          padding: 8px 16px;
          background: var(--accent-blue);
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        `;
        commitBtn.textContent = "Commit Changes";
        commitBtn.addEventListener("click", async () => {
          const message = this.window.prompt("Commit message:");
          if (message) {
            try {
              await this.noteBranchingSystem.commit(noteId, message);
              this.showBranchingPanel(noteId);
            } catch (error) {
              Zotero.logError(`[NoteRelationsTab] Failed to commit: ${error}`);
            }
          }
        });
        actions.appendChild(commitBtn);

        content.appendChild(actions);
      }
    } catch (error) {
      Zotero.logError(`[NoteRelationsTab] Error loading branches: ${error}`);
      content.innerHTML = `
        <div style="text-align: center; padding: 40px; color: var(--fill-error);">
          <p>Failed to load branch information</p>
        </div>
      `;
    }

    this.branchingPanel.appendChild(content);

    // 添加到文档
    doc.body.appendChild(this.branchingPanel);
  }

  /**
   * 销毁
   */
  destroy(): void {
    this.container = null;
    this.contentContainer = null;
    this.selectedNode = null;
    // 清除缓存（如果方法存在）
    // Clear cache if needed
    // Note: clearCache method might need to be implemented in the future
    // 清理分支面板
    if (this.branchingPanel) {
      this.branchingPanel.remove();
      this.branchingPanel = null;
    }
  }
}
