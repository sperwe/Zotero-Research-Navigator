/**
 * 笔记关联标签页
 * 显示和管理历史节点与笔记的双向关联
 */

import { NoteAssociationSystem } from "../../../managers/note-association-system";
import { HistoryService } from "../../../services/history-service";
import { HistoryNode } from "../../../services/database-service";

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
  
  constructor(
    private window: Window,
    private historyService: HistoryService,
    private noteAssociationSystem: NoteAssociationSystem
  ) {}
  
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
    
    Zotero.log("[NoteRelationsTab] create method completed successfully", "info");
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
      sessionTitle.textContent = new Date(session.startTime).toLocaleDateString();
      sessionGroup.appendChild(sessionTitle);
      
      // 获取会话的节点
      const nodes = this.historyService.getSessionNodes(session.id).slice(0, 10);
      
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
    icon.textContent = node.status === "active" ? "📖" : "📕";
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
        const associatedNotes = await this.noteAssociationSystem.getNodeNotes(node.id);
        const associatedCount = associatedNotes.length;
        
        Zotero.log(`[NoteRelationsTab] Node ${node.id}: Zotero notes: ${noteCount}, Associated: ${associatedCount}`, "info");
        
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
        Zotero.logError(`[NoteRelationsTab] Error getting note count for node ${node.id}: ${error}`);
      }
    })();
    
    // 点击事件
    element.addEventListener("click", async (e) => {
      e.stopPropagation();
      
      Zotero.log(`[NoteRelationsTab] Node clicked: ${node.id} - ${node.title}`, "info");
      
      try {
        // 更新选中状态
        element.parentElement?.querySelectorAll("div").forEach(el => {
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
        Zotero.logError(`[NoteRelationsTab] Error handling node click: ${error}`);
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
    Zotero.log(`[NoteRelationsTab] Selecting node: ${node.id} - ${node.title}`, "info");
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
      
      // 标题栏
      const header = doc.createElement("div");
      header.style.cssText = `
        padding: 15px;
        border-bottom: 1px solid var(--material-border-quarternary);
        background: var(--material-background);
      `;
      
      const title = doc.createElement("h3");
      title.style.margin = "0 0 5px 0";
      title.textContent = this.selectedNode.title || `Item ${this.selectedNode.itemId}`;
      header.appendChild(title);
      
      const subtitle = doc.createElement("div");
      subtitle.style.cssText = `
        color: var(--fill-secondary);
        font-size: 0.9em;
      `;
      subtitle.textContent = `${new Date(this.selectedNode.timestamp).toLocaleString()} - ${this.selectedNode.status}`;
      header.appendChild(subtitle);
      
      this.contentContainer.appendChild(header);
      
      // 工具栏
      const toolbar = this.createToolbar(doc);
      this.contentContainer.appendChild(toolbar);
      
      // 内容区域
      const content = doc.createElement("div");
      content.style.cssText = `
        flex: 1;
        overflow-y: auto;
        padding: 15px;
      `;
      
      // 获取 Zotero 中该项目的所有笔记
      Zotero.log(`[NoteRelationsTab] Loading notes for node: ${this.selectedNode.id} (Item ID: ${this.selectedNode.itemId})`, "info");
      
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
          Zotero.log(`[NoteRelationsTab] Attachment's parent has ${allNoteIds.length} notes`, "info");
        }
      } else if (!item.isNote()) {
        // 如果是普通项目
        allNoteIds = item.getNotes();
        Zotero.log(`[NoteRelationsTab] Item has ${allNoteIds.length} notes`, "info");
      }
      
      // 获取插件关联的笔记信息
      const associatedNotes = await this.noteAssociationSystem.getAssociatedNotes(this.selectedNode.id);
      const associatedNoteIds = new Set(associatedNotes.map(n => n.noteId));
      
      // 分类笔记：已关联的和未关联的
      const zoteroNotes: AssociatedNote[] = [];
      const pluginAssociatedNotes: AssociatedNote[] = [];
      
      // 处理 Zotero 中的所有笔记
      for (const noteId of allNoteIds) {
        try {
          const note = await Zotero.Items.getAsync(noteId);
          if (note) {
            // 安全地获取笔记内容
            let noteContent = '';
            try {
              noteContent = note.getNote();
            } catch (contentError) {
              Zotero.logError(`[NoteRelationsTab] Error getting content for note ${noteId}: ${contentError}`);
              noteContent = '[Error loading note content]';
            }
            
            const noteData: AssociatedNote = {
              id: -1,
              noteId: note.id,
              nodeId: this.selectedNode.id,
              relationType: "zotero_native" as any,
              title: note.getField('title') || 'Untitled Note',
              content: noteContent,
              dateModified: new Date(note.getField('dateModified'))
            };
            
            if (associatedNoteIds.has(noteId)) {
              // 找到对应的关联信息
              const assoc = associatedNotes.find(a => a.noteId === noteId);
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
          Zotero.logError(`[NoteRelationsTab] Error loading note ${noteId}: ${error}`);
          // 继续处理下一个笔记，不要中断整个流程
        }
      }
      
      // 显示已关联的笔记
      if (pluginAssociatedNotes.length > 0) {
        const section = this.createSection(doc, "Associated Notes", pluginAssociatedNotes, true);
        content.appendChild(section);
      }
      
      // 显示未关联的 Zotero 笔记
      if (zoteroNotes.length > 0) {
        const section = this.createSection(doc, "Zotero Notes (Not Associated)", zoteroNotes, false);
        content.appendChild(section);
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
        content.appendChild(empty);
      }
      
      this.contentContainer.appendChild(content);
    } catch (error) {
      Zotero.logError(`[NoteRelationsTab] Error loading node associations: ${error}`);
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
      padding: 10px 15px;
      display: flex;
      gap: 10px;
      border-bottom: 1px solid var(--material-border-quarternary);
      background: var(--material-sidepane);
    `;
    
    // 添加笔记按钮
    const addBtn = doc.createElement("button");
    addBtn.textContent = "Add Note";
    addBtn.addEventListener("click", () => this.showAddNoteDialog());
    toolbar.appendChild(addBtn);
    
    // 创建新笔记按钮
    const createBtn = doc.createElement("button");
    createBtn.textContent = "Create New Note";
    createBtn.addEventListener("click", () => this.createNewNote());
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
      const query = (e.target as HTMLInputElement).value;
      if (query && this.selectedNode) {
        const results = await this.noteAssociationSystem.searchRelatedNotes(query, this.selectedNode.id);
        this.showSearchResults(results);
      }
    });
    toolbar.appendChild(searchBox);
    
    return toolbar;
  }
  
  /**
   * 创建通用的笔记部分
   */
  private createSection(doc: Document, title: string, notes: AssociatedNote[], isAssociated: boolean): HTMLElement {
    const section = doc.createElement("div");
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
  private createAssociatedSection(doc: Document, notes: AssociatedNote[]): HTMLElement {
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
  private createSuggestedSection(doc: Document, notes: AssociatedNote[]): HTMLElement {
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
  private createNoteCard(doc: Document, note: AssociatedNote, isAssociated: boolean): HTMLElement {
    const card = doc.createElement("div");
    card.style.cssText = `
      border: 1px solid var(--material-border-quarternary);
      border-radius: 5px;
      padding: 15px;
      background: var(--material-background);
      transition: box-shadow 0.2s;
    `;
    
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
          await this.noteAssociationSystem.removeAssociation(note.id);
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
          await this.noteAssociationSystem.associateNote(note.noteId, this.selectedNode.id, "manual");
          await this.loadNodeAssociations();
        }
      });
      actions.appendChild(addBtn);
    }
    
    const openBtn = doc.createElement("button");
    openBtn.textContent = "Open";
    openBtn.style.cssText = `
      padding: 3px 8px;
      font-size: 0.9em;
    `;
    openBtn.addEventListener("click", () => {
      // 打开笔记窗口
      try {
        const noteItem = Zotero.Items.get(note.noteId);
        if (noteItem) {
          // 使用 Zotero 的 API 打开笔记编辑器
          const zoteroPane = Zotero.getActiveZoteroPane();
          if (zoteroPane) {
            zoteroPane.openNoteWindow(note.noteId);
          }
        }
      } catch (error) {
        Zotero.logError(`Failed to open note: ${error}`);
      }
    });
    actions.appendChild(openBtn);
    
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
      const noteDoc = parser.parseFromString(note.content, 'text/html');
      let text = noteDoc.body ? noteDoc.body.textContent : '';
      // 标准化空白字符
      text = (text || '').replace(/\s+/g, ' ').trim();
      content.textContent = text.substring(0, 200) + (text.length > 200 ? "..." : "");
    } catch (error) {
      // 如果 DOMParser 失败，使用简单的正则表达式清理
      Zotero.log(`[NoteRelationsTab] Failed to parse note content with DOMParser: ${error}`, "warn");
      try {
        const text = note.content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
        content.textContent = text.substring(0, 200) + (text.length > 200 ? "..." : "");
      } catch (fallbackError) {
        content.textContent = "[Unable to display note content]";
        Zotero.logError(`[NoteRelationsTab] Failed to extract text from note: ${fallbackError}`);
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
    desc.textContent = "Choose a node from the left panel to view and manage its note associations";
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
      s.libraryID = this.selectedNode.libraryId || Zotero.Libraries.userLibraryID;
      s.addCondition('itemType', 'is', 'note');
      if (filter) {
        s.addCondition('title', 'contains', filter);
      }
      
      const noteIDs = await s.search();
      const notes = await Zotero.Items.getAsync(noteIDs);
      
      if (notes.length === 0) {
        noteListContainer.innerHTML = "<p>No notes found</p>";
        return;
      }
      
      // 显示笔记列表
      for (const note of notes.slice(0, 50)) { // 限制显示前50个
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
          const noteDoc = parser.parseFromString(note.getNote(), 'text/html');
          let plainText = noteDoc.body ? noteDoc.body.textContent : '';
          plainText = (plainText || '').replace(/\s+/g, ' ').trim();
          notePreview.textContent = plainText.substring(0, 100) + (plainText.length > 100 ? "..." : "");
        } catch (error) {
          // 回退到正则清理
          const noteContent = note.getNote();
          const plainText = noteContent.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
          notePreview.textContent = plainText.substring(0, 100) + (plainText.length > 100 ? "..." : "");
        }
        noteItem.appendChild(notePreview);
        
        // 点击选择
        noteItem.addEventListener("click", async () => {
          await this.noteAssociationSystem.associateNote(note.id, this.selectedNode.id);
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
          targetTitle = parent.getField('title');
        }
      } else if (!item.isNote() && item.isRegularItem()) {
        // 如果是普通项目，直接设置为父项
        parentItemID = item.id;
      }
      
      // 创建新笔记
      const note = new Zotero.Item("note");
      const timestamp = new Date().toLocaleString();
      note.setNote(`<h1>Note for ${targetTitle}</h1><p>Created from Research Navigator at ${timestamp}</p><p></p>`);
      
      if (parentItemID) {
        note.parentItemID = parentItemID;
      }
      
      await note.saveTx();
      
      // 自动关联到历史节点
      await this.noteAssociationSystem.createContextualAssociation(
        note.id,
        this.selectedNode.id,
        "Created from history node",
        "manual"
      );
      
      // 选择新创建的笔记并尝试打开编辑器
      try {
        const zoteroPane = Zotero.getActiveZoteroPane();
        
        // 首先选择这个笔记
        if (zoteroPane && typeof zoteroPane.selectItem === 'function') {
          await zoteroPane.selectItem(note.id);
          Zotero.log(`[NoteRelationsTab] Selected note: ${note.id}`, "info");
        }
        
        // 然后尝试打开笔记窗口
        // 使用 setTimeout 确保 UI 已经更新
        setTimeout(() => {
          try {
            const zp = Zotero.getActiveZoteroPane();
            if (zp && typeof zp.openNoteWindow === 'function') {
              Zotero.log(`[NoteRelationsTab] Opening note window for note ID: ${note.id}`, "info");
              // 检查笔记是否真的存在
              const noteItem = Zotero.Items.get(note.id);
              if (noteItem) {
                zp.openNoteWindow(note.id);
              } else {
                Zotero.logError(`[NoteRelationsTab] Note item not found in database: ${note.id}`);
              }
            } else {
              // 如果不能打开独立窗口，至少聚焦到笔记编辑器
              const noteEditor = zp?.document.getElementById('zotero-note-editor');
              if (noteEditor) {
                noteEditor.focus();
                Zotero.log("[NoteRelationsTab] Focused on note editor", "info");
              }
            }
          } catch (error) {
            Zotero.logError(`[NoteRelationsTab] Error in setTimeout: ${error}`);
          }
        }, 100);
        
      } catch (error) {
        Zotero.logError(`[NoteRelationsTab] Error selecting/opening note: ${error}`);
      }
      
      // 刷新显示
      await this.loadNodeAssociations();
      
      Zotero.log(`[NoteRelationsTab] Created new note: ${note.id} for parent: ${parentItemID}`, "info");
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
      const searchBox = this.container?.querySelector('input[type="text"]') as HTMLInputElement;
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
    
    Zotero.log(`[NoteRelationsTab] Displayed ${results.length} search results`, "info");
  }
  
  /**
   * 过滤节点
   */
  private filterNodes(query: string): void {
    // TODO: 实现节点过滤
    Zotero.log(`[NoteRelationsTab] Filter nodes: ${query}`, "info");
  }
  
  /**
   * 销毁
   */
  destroy(): void {
    this.container = null;
    this.contentContainer = null;
    this.selectedNode = null;
    // 清除缓存（如果方法存在）
    if (typeof this.noteAssociationSystem.clearCache === 'function') {
      this.noteAssociationSystem.clearCache();
    }
  }
}