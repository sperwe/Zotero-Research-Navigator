/**
 * 笔记关联视图
 */

import { getString } from "../../utils/locale";
import { HistoryNode } from "../historyTree";

interface NoteRelation {
  noteId: number;
  nodeId: string;
  relationType: string;
  createdAt: Date;
  context: {
    sessionId: string;
    fromNode?: string;
    path?: string[];
  };
}

export class NoteRelationView {
  private container: HTMLDivElement | null = null;
  private listContainer: HTMLDivElement | null = null;
  private currentNode: HistoryNode | null = null;
  
  constructor(private addon: any) {}

  /**
   * 初始化视图
   */
  public async init() {
    // 监听笔记创建事件
    this.registerNoteListeners();
  }

  /**
   * 渲染视图
   */
  public async render(): Promise<HTMLElement> {
    const doc = this.addon.data.ztoolkit.getGlobal("document");
    
    this.container = this.addon.data.ztoolkit.UI.createElement(doc, "div", {
      classList: ["note-relation-view"],
      styles: {
        height: "100%",
        display: "flex",
        flexDirection: "column",
      },
    }) as HTMLDivElement;

    // 创建工具栏
    const toolbar = this.createToolbar();
    this.container.appendChild(toolbar);

    // 创建主要内容区域
    const content = this.addon.data.ztoolkit.UI.createElement(doc, "div", {
      classList: ["note-content"],
      styles: {
        flex: "1",
        display: "flex",
        gap: "16px",
        padding: "16px",
        overflow: "hidden",
      },
    });

    // 左侧：历史路径
    const pathPanel = this.createPathPanel();
    content.appendChild(pathPanel);

    // 右侧：笔记列表
    const notePanel = this.createNotePanel();
    content.appendChild(notePanel);

    this.container.appendChild(content);

    // 加载初始数据
    await this.loadCurrentNodeNotes();

    return this.container;
  }

  /**
   * 创建工具栏
   */
  private createToolbar(): HTMLElement {
    const doc = this.addon.data.ztoolkit.getGlobal("document");
    
    const toolbar = this.addon.data.ztoolkit.UI.createElement(doc, "div", {
      classList: ["note-toolbar"],
      styles: {
        padding: "8px 16px",
        borderBottom: "1px solid var(--material-border-quarternary)",
        display: "flex",
        alignItems: "center",
        gap: "16px",
      },
    });

    // 标题
    const title = this.addon.data.ztoolkit.UI.createElement(doc, "h3", {
      styles: {
        margin: "0",
        fontSize: "16px",
        fontWeight: "bold",
      },
      properties: {
        textContent: getString("note-relation-title"),
      },
    });
    toolbar.appendChild(title);

    // 创建新笔记按钮
    const createNoteBtn = this.addon.data.ztoolkit.UI.createElement(doc, "button", {
      classList: ["create-note-btn"],
      styles: {
        marginLeft: "auto",
        padding: "4px 12px",
        border: "1px solid var(--material-border-quarternary)",
        borderRadius: "4px",
        backgroundColor: "var(--material-button)",
        cursor: "pointer",
      },
      properties: {
        textContent: getString("create-note"),
      },
      listeners: [
        {
          type: "click",
          listener: () => this.createNewNote(),
        },
      ],
    });
    toolbar.appendChild(createNoteBtn);

    // 关联现有笔记按钮
    const linkNoteBtn = this.addon.data.ztoolkit.UI.createElement(doc, "button", {
      classList: ["link-note-btn"],
      styles: {
        padding: "4px 12px",
        border: "1px solid var(--material-border-quarternary)",
        borderRadius: "4px",
        backgroundColor: "var(--material-button)",
        cursor: "pointer",
      },
      properties: {
        textContent: getString("link-existing-note"),
      },
      listeners: [
        {
          type: "click",
          listener: () => this.linkExistingNote(),
        },
      ],
    });
    toolbar.appendChild(linkNoteBtn);

    return toolbar;
  }

  /**
   * 创建路径面板
   */
  private createPathPanel(): HTMLElement {
    const doc = this.addon.data.ztoolkit.getGlobal("document");
    
    const panel = this.addon.data.ztoolkit.UI.createElement(doc, "div", {
      classList: ["path-panel"],
      styles: {
        width: "300px",
        borderRight: "1px solid var(--material-border-quarternary)",
        paddingRight: "16px",
        overflowY: "auto",
      },
    });

    // 标题
    const header = this.addon.data.ztoolkit.UI.createElement(doc, "h4", {
      styles: {
        margin: "0 0 12px 0",
        fontSize: "14px",
        fontWeight: "bold",
        color: "var(--fill-secondary)",
      },
      properties: {
        textContent: getString("current-path"),
      },
    });
    panel.appendChild(header);

    // 路径显示
    const pathContainer = this.addon.data.ztoolkit.UI.createElement(doc, "div", {
      id: "path-container",
      classList: ["path-container"],
    });
    panel.appendChild(pathContainer);

    return panel;
  }

  /**
   * 创建笔记面板
   */
  private createNotePanel(): HTMLElement {
    const doc = this.addon.data.ztoolkit.getGlobal("document");
    
    const panel = this.addon.data.ztoolkit.UI.createElement(doc, "div", {
      classList: ["note-panel"],
      styles: {
        flex: "1",
        display: "flex",
        flexDirection: "column",
      },
    });

    // 标题
    const header = this.addon.data.ztoolkit.UI.createElement(doc, "h4", {
      styles: {
        margin: "0 0 12px 0",
        fontSize: "14px",
        fontWeight: "bold",
        color: "var(--fill-secondary)",
      },
      properties: {
        textContent: getString("related-notes"),
      },
    });
    panel.appendChild(header);

    // 笔记列表容器
    this.listContainer = this.addon.data.ztoolkit.UI.createElement(doc, "div", {
      classList: ["note-list-container"],
      styles: {
        flex: "1",
        overflowY: "auto",
      },
    }) as HTMLDivElement;
    panel.appendChild(this.listContainer);

    return panel;
  }

  /**
   * 加载当前节点的笔记
   */
  private async loadCurrentNodeNotes() {
    // 获取当前选中的历史节点
    this.currentNode = this.addon.data.researchNavigator.currentNode;
    
    if (!this.currentNode) {
      this.showEmptyState();
      return;
    }

    // 更新路径显示
    this.updatePathDisplay();

    // 加载相关笔记
    const relations = await this.getNoteRelations(this.currentNode.id);
    this.displayNotes(relations);
  }

  /**
   * 更新路径显示
   */
  private updatePathDisplay() {
    const pathContainer = this.container?.querySelector("#path-container");
    if (!pathContainer || !this.currentNode) return;

    pathContainer.innerHTML = "";

    // 构建路径
    const path = this.buildNodePath(this.currentNode);
    const doc = this.addon.data.ztoolkit.getGlobal("document");

    path.forEach((node, index) => {
      // 节点
      const nodeElement = this.addon.data.ztoolkit.UI.createElement(doc, "div", {
        classList: ["path-node"],
        styles: {
          padding: "8px",
          marginBottom: "4px",
          backgroundColor: index === path.length - 1 ? "var(--material-button)" : "transparent",
          borderRadius: "4px",
          cursor: "pointer",
        },
        listeners: [
          {
            type: "click",
            listener: () => this.addon.hooks.onOpenItem(node.itemId),
          },
        ],
      });

      // 缩进
      if (index > 0) {
        nodeElement.style.marginLeft = `${index * 20}px`;
      }

      // 图标和标题
      const icon = this.addon.data.ztoolkit.UI.createElement(doc, "span", {
        properties: {
          textContent: "📄 ",
        },
      });
      nodeElement.appendChild(icon);

      const title = this.addon.data.ztoolkit.UI.createElement(doc, "span", {
        properties: {
          textContent: node.title,
        },
      });
      nodeElement.appendChild(title);

      pathContainer.appendChild(nodeElement);

      // 连接线
      if (index < path.length - 1) {
        const connector = this.addon.data.ztoolkit.UI.createElement(doc, "div", {
          styles: {
            marginLeft: `${(index + 1) * 20 - 10}px`,
            width: "2px",
            height: "20px",
            backgroundColor: "var(--material-border-quarternary)",
            marginBottom: "4px",
          },
        });
        pathContainer.appendChild(connector);
      }
    });
  }

  /**
   * 构建节点路径
   */
  private buildNodePath(node: HistoryNode): HistoryNode[] {
    const path: HistoryNode[] = [];
    let currentNode: HistoryNode | null = node;

    while (currentNode) {
      path.unshift(currentNode);
      if (currentNode.parentId) {
        currentNode = this.addon.data.researchNavigator.nodeMap.get(currentNode.parentId);
      } else {
        break;
      }
    }

    return path;
  }

  /**
   * 获取笔记关联
   */
  private async getNoteRelations(nodeId: string): Promise<NoteRelation[]> {
    try {
      const db = this.addon.data.researchNavigator.db;
      const relations = await db.getNoteRelationsForNode(nodeId);
      return relations;
    } catch (e) {
      Zotero.logError(e);
      return [];
    }
  }

  /**
   * 显示笔记
   */
  private displayNotes(relations: NoteRelation[]) {
    if (!this.listContainer) return;

    this.listContainer.innerHTML = "";

    if (relations.length === 0) {
      this.showEmptyNoteList();
      return;
    }

    const doc = this.addon.data.ztoolkit.getGlobal("document");

    relations.forEach(relation => {
      const noteItem = this.createNoteItem(relation);
      this.listContainer.appendChild(noteItem);
    });
  }

  /**
   * 创建笔记项
   */
  private createNoteItem(relation: NoteRelation): HTMLElement {
    const doc = this.addon.data.ztoolkit.getGlobal("document");
    const note = Zotero.Items.get(relation.noteId);
    
    if (!note) return doc.createElement("div");

    const noteItem = this.addon.data.ztoolkit.UI.createElement(doc, "div", {
      classList: ["note-item"],
      styles: {
        padding: "12px",
        marginBottom: "8px",
        border: "1px solid var(--material-border-quarternary)",
        borderRadius: "4px",
        backgroundColor: "var(--material-sidepane)",
        cursor: "pointer",
      },
      listeners: [
        {
          type: "click",
          listener: () => this.openNote(note),
        },
      ],
    });

    // 笔记标题
    const title = this.addon.data.ztoolkit.UI.createElement(doc, "div", {
      classList: ["note-title"],
      styles: {
        fontWeight: "bold",
        fontSize: "14px",
        marginBottom: "4px",
      },
      properties: {
        textContent: note.getNoteTitle() || getString("untitled-note"),
      },
    });
    noteItem.appendChild(title);

    // 关联信息
    const relationInfo = this.addon.data.ztoolkit.UI.createElement(doc, "div", {
      classList: ["relation-info"],
      styles: {
        fontSize: "12px",
        color: "var(--fill-secondary)",
        marginBottom: "4px",
      },
      properties: {
        textContent: `${this.getRelationTypeLabel(relation.relationType)} • ${relation.createdAt.toLocaleDateString()}`,
      },
    });
    noteItem.appendChild(relationInfo);

    // 笔记预览
    const preview = this.addon.data.ztoolkit.UI.createElement(doc, "div", {
      classList: ["note-preview"],
      styles: {
        fontSize: "13px",
        color: "var(--fill-secondary)",
        maxHeight: "60px",
        overflow: "hidden",
        textOverflow: "ellipsis",
      },
      properties: {
        textContent: this.getNotePreview(note),
      },
    });
    noteItem.appendChild(preview);

    // 操作按钮
    const actions = this.addon.data.ztoolkit.UI.createElement(doc, "div", {
      classList: ["note-actions"],
      styles: {
        marginTop: "8px",
        display: "flex",
        gap: "8px",
      },
    });

    // 查看历史上下文按钮
    const contextBtn = this.addon.data.ztoolkit.UI.createElement(doc, "button", {
      styles: {
        padding: "2px 8px",
        fontSize: "12px",
        border: "1px solid var(--material-border-quarternary)",
        borderRadius: "4px",
        backgroundColor: "var(--material-button)",
        cursor: "pointer",
      },
      properties: {
        textContent: getString("view-context"),
      },
      listeners: [
        {
          type: "click",
          listener: (e: Event) => {
            e.stopPropagation();
            this.showNoteContext(relation);
          },
        },
      ],
    });
    actions.appendChild(contextBtn);

    // 取消关联按钮
    const unlinkBtn = this.addon.data.ztoolkit.UI.createElement(doc, "button", {
      styles: {
        padding: "2px 8px",
        fontSize: "12px",
        border: "1px solid var(--material-border-quarternary)",
        borderRadius: "4px",
        backgroundColor: "var(--material-button)",
        cursor: "pointer",
      },
      properties: {
        textContent: getString("unlink-note"),
      },
      listeners: [
        {
          type: "click",
          listener: (e: Event) => {
            e.stopPropagation();
            this.unlinkNote(relation);
          },
        },
      ],
    });
    actions.appendChild(unlinkBtn);

    noteItem.appendChild(actions);

    return noteItem;
  }

  /**
   * 获取关联类型标签
   */
  private getRelationTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      created_during: getString("relation-created-during"),
      inspired_by: getString("relation-inspired-by"),
      summarizes: getString("relation-summarizes"),
      questions: getString("relation-questions"),
    };
    return labels[type] || type;
  }

  /**
   * 获取笔记预览
   */
  private getNotePreview(note: Zotero.Item): string {
    const content = note.getNote();
    const text = content.replace(/<[^>]*>/g, ""); // 移除 HTML 标签
    return text.substring(0, 150) + (text.length > 150 ? "..." : "");
  }

  /**
   * 打开笔记
   */
  private openNote(note: Zotero.Item) {
    const ZoteroPane = this.addon.data.ztoolkit.getGlobal("ZoteroPane");
    ZoteroPane.selectItem(note.id);
    ZoteroPane.openNoteWindow(note.id);
  }

  /**
   * 显示笔记上下文
   */
  private showNoteContext(relation: NoteRelation) {
    const doc = this.addon.data.ztoolkit.getGlobal("document");
    
    // 创建弹出窗口显示详细的历史上下文
    const dialog = this.addon.data.ztoolkit.UI.createElement(doc, "dialog", {
      styles: {
        padding: "20px",
        borderRadius: "8px",
        border: "1px solid var(--material-border-quarternary)",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
      },
    });

    const content = this.addon.data.ztoolkit.UI.createElement(doc, "div", {
      children: [
        {
          tag: "h3",
          properties: {
            textContent: getString("note-context-title"),
          },
        },
        {
          tag: "p",
          properties: {
            textContent: `Session: ${relation.context.sessionId}`,
          },
        },
        {
          tag: "p",
          properties: {
            textContent: `Created at: ${relation.createdAt.toLocaleString()}`,
          },
        },
        {
          tag: "button",
          properties: {
            textContent: getString("close"),
          },
          listeners: [
            {
              type: "click",
              listener: () => dialog.close(),
            },
          ],
        },
      ],
    });

    dialog.appendChild(content);
    doc.body.appendChild(dialog);
    dialog.showModal();
  }

  /**
   * 创建新笔记
   */
  private async createNewNote() {
    if (!this.currentNode) return;

    try {
      // 创建新笔记
      const note = new Zotero.Item("note");
      note.libraryID = this.currentNode.libraryId || Zotero.Libraries.userLibraryID;
      
      // 如果当前节点是文献，将笔记作为子笔记
      const item = Zotero.Items.get(this.currentNode.itemId);
      if (item && !item.isNote()) {
        note.parentID = item.id;
      }

      // 设置初始内容，包含历史上下文
      const path = this.buildNodePath(this.currentNode);
      const pathText = path.map(n => n.title).join(" → ");
      
      note.setNote(`
        <h2>Research Context</h2>
        <p><strong>Path:</strong> ${pathText}</p>
        <p><strong>Created:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>Session:</strong> ${this.addon.data.researchNavigator.currentSessionId}</p>
        <hr>
        <p>Your notes here...</p>
      `);

      await note.saveTx();

      // 创建关联
      await this.addon.data.researchNavigator.db.createNoteRelation({
        noteId: note.id,
        nodeId: this.currentNode.id,
        relationType: "created_during",
        context: {
          sessionId: this.addon.data.researchNavigator.currentSessionId,
          fromNode: this.currentNode.parentId,
          path: path.map(n => n.id),
        },
      });

      // 打开笔记编辑器
      this.openNote(note);

      // 刷新列表
      await this.loadCurrentNodeNotes();
    } catch (e) {
      Zotero.logError(e);
      this.addon.hooks.onShowMessage(getString("error-create-note"), "error");
    }
  }

  /**
   * 关联现有笔记
   */
  private async linkExistingNote() {
    if (!this.currentNode) return;

    // 显示笔记选择对话框
    const io = {
      dataIn: {
        currentNode: this.currentNode,
      },
      dataOut: null,
    };

    window.openDialog(
      "chrome://zotero/content/selectItemsDialog.xul",
      "",
      "chrome,dialog=no,centerscreen,resizable=yes",
      io
    );

    if (io.dataOut && io.dataOut.length > 0) {
      // 创建关联
      for (const noteId of io.dataOut) {
        await this.addon.data.researchNavigator.db.createNoteRelation({
          noteId,
          nodeId: this.currentNode.id,
          relationType: "linked_manually",
          context: {
            sessionId: this.addon.data.researchNavigator.currentSessionId,
          },
        });
      }

      // 刷新列表
      await this.loadCurrentNodeNotes();
    }
  }

  /**
   * 取消关联
   */
  private async unlinkNote(relation: NoteRelation) {
    const confirmed = Services.prompt.confirm(
      null,
      getString("confirm-unlink-title"),
      getString("confirm-unlink-message")
    );

    if (!confirmed) return;

    try {
      await this.addon.data.researchNavigator.db.removeNoteRelation(
        relation.noteId,
        relation.nodeId
      );

      // 刷新列表
      await this.loadCurrentNodeNotes();
    } catch (e) {
      Zotero.logError(e);
      this.addon.hooks.onShowMessage(getString("error-unlink-note"), "error");
    }
  }

  /**
   * 显示空状态
   */
  private showEmptyState() {
    const pathContainer = this.container?.querySelector("#path-container");
    if (pathContainer) {
      pathContainer.innerHTML = `<p style="color: var(--fill-secondary);">${getString("no-node-selected")}</p>`;
    }

    if (this.listContainer) {
      this.listContainer.innerHTML = `<p style="color: var(--fill-secondary);">${getString("no-node-selected")}</p>`;
    }
  }

  /**
   * 显示空笔记列表
   */
  private showEmptyNoteList() {
    if (!this.listContainer) return;

    const doc = this.addon.data.ztoolkit.getGlobal("document");
    const emptyState = this.addon.data.ztoolkit.UI.createElement(doc, "div", {
      styles: {
        textAlign: "center",
        padding: "40px",
        color: "var(--fill-secondary)",
      },
      children: [
        {
          tag: "p",
          properties: {
            textContent: getString("no-notes-found"),
          },
          styles: {
            marginBottom: "16px",
          },
        },
        {
          tag: "button",
          properties: {
            textContent: getString("create-first-note"),
          },
          styles: {
            padding: "8px 16px",
            border: "1px solid var(--material-border-quarternary)",
            borderRadius: "4px",
            backgroundColor: "var(--material-button)",
            cursor: "pointer",
          },
          listeners: [
            {
              type: "click",
              listener: () => this.createNewNote(),
            },
          ],
        },
      ],
    });

    this.listContainer.appendChild(emptyState);
  }

  /**
   * 注册笔记监听器
   */
  private registerNoteListeners() {
    const notifierID = Zotero.Notifier.registerObserver({
      notify: async (event: string, type: string, ids: number[]) => {
        if (type === "item") {
          // 检查是否有笔记被创建或修改
          const items = Zotero.Items.get(ids);
          const hasNotes = items.some(item => item.isNote());
          
          if (hasNotes && this.currentNode) {
            // 检查是否需要自动关联
            for (const item of items) {
              if (item.isNote() && event === "add") {
                await this.checkAutoRelation(item);
              }
            }
            
            // 刷新视图
            await this.loadCurrentNodeNotes();
          }
        }
      },
    }, ["item"], "NoteRelationView");

    this.addon.data._noteRelationNotifierID = notifierID;
  }

  /**
   * 检查自动关联
   */
  private async checkAutoRelation(note: Zotero.Item) {
    if (!this.currentNode) return;

    // 如果笔记的父项与当前节点的项目相同，自动创建关联
    if (note.parentID === this.currentNode.itemId) {
      const existingRelation = await this.addon.data.researchNavigator.db.getNoteRelation(
        note.id,
        this.currentNode.id
      );

      if (!existingRelation) {
        await this.addon.data.researchNavigator.db.createNoteRelation({
          noteId: note.id,
          nodeId: this.currentNode.id,
          relationType: "created_during",
          context: {
            sessionId: this.addon.data.researchNavigator.currentSessionId,
            fromNode: this.currentNode.parentId,
          },
        });
      }
    }
  }

  /**
   * 销毁视图
   */
  public destroy() {
    // 注销监听器
    if (this.addon.data._noteRelationNotifierID) {
      Zotero.Notifier.unregisterObserver(this.addon.data._noteRelationNotifierID);
    }

    // 清理 DOM
    this.container = null;
    this.listContainer = null;
    this.currentNode = null;
  }
}