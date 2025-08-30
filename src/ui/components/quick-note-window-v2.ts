/**
 * 快速笔记窗口 V2 - 更稳定的实现
 */

import { NoteAssociationSystem } from '../../managers/note-association-system';
import { HistoryService } from '../../services/history-service';

export class QuickNoteWindowV2 {
  private container: HTMLElement | null = null;
  private editor: any = null;
  private currentNoteId: number | null = null;
  private associatedNodeId: string | null = null;
  private isCreating = false;  // 防止重复创建
  private isLoadingNote = false;  // 防止重复加载笔记
  private noteContext: string | null = null;  // 记录笔记创建时的上下文
  
  constructor(
    private noteAssociationSystem: NoteAssociationSystem,
    private historyService: HistoryService
  ) {}
  
  /**
   * 显示快速笔记窗口
   */
  async show(nodeId?: string): Promise<void> {
    Zotero.log('[QuickNoteWindowV2] show() called', 'info');
    
    // 如果已经有容器，直接显示
    if (this.container && this.container.parentElement) {
      Zotero.log(`[QuickNoteWindowV2] Reusing existing window, currentNoteId: ${this.currentNoteId}`, 'info');
      this.container.style.display = 'flex';
      
      // 检查是否需要创建新笔记
      const shouldCreateNew = this.shouldCreateNewNote(nodeId);
      
      if (shouldCreateNew || (!this.currentNoteId && !this.isLoadingNote)) {
        this.associatedNodeId = nodeId || null;
        Zotero.log('[QuickNoteWindowV2] Creating new note based on mode/context', 'info');
        setTimeout(() => this.createNewNote(), 500);
      } else {
        // 更新信息显示
        this.updateNoteInfo();
      }
      return;
    }
    
    // 防止重复创建
    if (this.isCreating) {
      Zotero.log('[QuickNoteWindowV2] Already creating window, skipping', 'info');
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
        Zotero.logError('[QuickNoteWindowV2] No main window available');
        return;
      }
      
      // 保存 window 引用
      this.window = win;
      const doc = win.document;
      
      // 创建容器
      this.container = doc.createElement('div');
      this.container.id = 'quick-note-window-v2';
      this.container.className = 'quick-note-window';
      
      // 内联样式，避免外部CSS问题
      this.container.style.cssText = `
        position: fixed;
        top: 100px;
        right: 50px;
        width: 450px;
        height: 600px;
        background: white;
        border: 1px solid #ddd;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        z-index: 10000;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      `;
      
      // 创建内容
      this.container.innerHTML = this.getWindowHTML();
      
      // 找到合适的父元素并添加
      const added = this.appendToDocument(doc);
      if (!added) {
        Zotero.logError('[QuickNoteWindowV2] Failed to add window to document');
        return;
      }
      
      // 设置事件处理
      this.setupEventHandlers();
      
      // 初始化编辑器
      const editorContainer = this.container.querySelector('#quick-note-editor-container');
      if (editorContainer) {
        this.initializeEditor(editorContainer as HTMLElement);
        
        // 窗口初始化完成后，如果没有笔记就创建一个
        setTimeout(() => {
          if (!this.currentNoteId && !this.isLoadingNote) {
            Zotero.log('[QuickNoteWindowV2] No current note, creating new note after window init', 'info');
            this.createNewNote();
          } else if (this.currentNoteId) {
            // 如果有笔记，更新信息显示
            this.updateNoteInfo();
          }
        }, 500);
      }
      
      // 使窗口可拖动
      const header = this.container.querySelector('.quick-note-header');
      if (header) {
        this.makeDraggable(header as HTMLElement);
      }
      
      Zotero.log('[QuickNoteWindowV2] Window created successfully', 'info');
      
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
        <h3 style="margin: 0; font-size: 16px; font-weight: 500;">Quick Note</h3>
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
      
      <div class="quick-note-toolbar" style="
        display: flex;
        gap: 8px;
        padding: 8px 16px;
        background: #fafafa;
        border-bottom: 1px solid #eee;
      ">
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
      { selector: '#main-window', name: 'main-window' },
      { selector: '#zotero-pane', name: 'zotero-pane' },
      { selector: '#browser', name: 'browser' },
      { selector: 'body', name: 'body' },
      { element: doc.documentElement, name: 'documentElement' }
    ];
    
    for (const target of targets) {
      try {
        const element = target.selector 
          ? doc.querySelector(target.selector) 
          : target.element;
          
        if (element && this.container) {
          element.appendChild(this.container);
          Zotero.log(`[QuickNoteWindowV2] Appended to: ${target.name}`, 'info');
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
    const closeBtn = this.container.querySelector('.quick-note-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hide());
    }
    
    // 保存按钮
    const saveBtn = this.container.querySelector('.quick-note-save');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.saveNote());
    }
    
    // 新建按钮
    const newBtn = this.container.querySelector('.quick-note-new');
    if (newBtn) {
      newBtn.addEventListener('click', () => this.forceCreateNewNote());
    }
  }
  
  /**
   * 初始化编辑器
   */
  private async initializeEditor(container: HTMLElement): Promise<void> {
    try {
      Zotero.log('[QuickNoteWindowV2] Initializing editor...', 'info');
      
      // 如果已有笔记，加载编辑器
      if (this.currentNoteId) {
        Zotero.log(`[QuickNoteWindowV2] Loading existing note ${this.currentNoteId} in editor`, 'info');
        await this.loadNoteEditor(this.currentNoteId, container);
      } else {
        // 暂时显示加载中
        const loading = container.ownerDocument.createElement('div');
        loading.id = 'editor-loading';
        loading.style.cssText = `
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: #666;
          font-size: 14px;
        `;
        loading.textContent = 'Preparing editor...';
        container.appendChild(loading);
        Zotero.log('[QuickNoteWindowV2] Editor container ready, waiting for note creation', 'info');
      }
      
    } catch (error) {
      Zotero.logError(`[QuickNoteWindowV2] Failed to initialize editor: ${error}`);
      // 回退到简单编辑器
      this.initializeSimpleEditor(container);
    }
  }
  
  /**
   * 加载 Zotero 原生编辑器
   */
  private async loadNoteEditor(noteId: number, container: HTMLElement): Promise<void> {
    try {
      // 清空容器
      container.innerHTML = '';
      
      const doc = container.ownerDocument;
      const win = doc.defaultView || this.window || Zotero.getMainWindow();
      
      // 确保自定义元素脚本已加载
      if (!win.customElements || !win.customElements.get('note-editor')) {
        Zotero.log(`[QuickNoteWindowV2] note-editor element not registered, loading scripts`, "info");
        
        if (win.Services && win.Services.scriptloader) {
          try {
            win.Services.scriptloader.loadSubScript("chrome://zotero/content/customElements.js", win);
            Zotero.log(`[QuickNoteWindowV2] Custom elements script loaded`, "info");
          } catch (e) {
            Zotero.logError(`[QuickNoteWindowV2] Failed to load custom elements: ${e}`);
            throw e;
          }
        }
      }
      
      // 创建编辑器容器
      const editorContainer = doc.createElement('div');
      editorContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        height: 100%;
        width: 100%;
        background: white;
      `;
      container.appendChild(editorContainer);
      
      // 创建 iframe
      const iframe = doc.createElement('iframe') as HTMLIFrameElement;
      iframe.id = 'quick-note-editor-iframe';
      iframe.style.cssText = `
        border: 0;
        width: 100%;
        flex-grow: 1;
        min-height: 300px;
        background: white;
      `;
      iframe.setAttribute('type', 'content');
      iframe.setAttribute('remote', 'false');
      iframe.setAttribute('src', 'resource://zotero/note-editor/editor.html');
      
      editorContainer.appendChild(iframe);
      
      // 注册 UIProperties
      if (win.Zotero.UIProperties) {
        win.Zotero.UIProperties.registerRoot(editorContainer);
      }
      
      // 先隐藏 iframe，避免闪烁
      iframe.style.visibility = 'hidden';
      
      // 标记初始化状态
      let iframeInitialized = false;
      
      // 等待 iframe 内容加载
      const initializeEditor = async () => {
        if (iframeInitialized) return;
        iframeInitialized = true;
        
        try {
          Zotero.log(`[QuickNoteWindowV2] iframe ready, initializing editor for note ${noteId}`, "info");
          
          // 等待一下确保 iframe 完全准备好
          await new Promise(resolve => setTimeout(resolve, 200));
          
          const item = await Zotero.Items.getAsync(noteId);
          if (!item || !item.isNote()) {
            throw new Error('Invalid note item');
          }
          
          // 创建 EditorInstance
          const editorInstance = new win.Zotero.EditorInstance();
          
          // 处理 BetterNotes 兼容性
          if (iframe.contentWindow && (iframe.contentWindow as any).wrappedJSObject) {
            (iframe.contentWindow as any).wrappedJSObject._betterNotesIgnore = true;
          }
          
          // 存储实例引用以便清理
          (iframe as any)._editorInstance = editorInstance;
          (editorContainer as any)._editorInstance = editorInstance;
          
          // 初始化编辑器
          await editorInstance.init({
            item: item,
            viewMode: 'library',
            readOnly: false,
            iframeWindow: iframe.contentWindow,
            popup: false,
            saveOnClose: true,
            ignoreUpdate: true
          });
          
          // 显示 iframe
          iframe.style.visibility = 'visible';
          
          this.editor = editorInstance;
          this.currentNoteId = noteId;
          
          Zotero.log('[QuickNoteWindowV2] Native editor loaded successfully', 'info');
          this.updateStatus('Note loaded');
          
        } catch (error) {
          Zotero.logError(`[QuickNoteWindowV2] Failed to initialize editor: ${error}`);
          throw error;
        }
      };
      
      // 监听 iframe 加载
      iframe.addEventListener('load', initializeEditor);
      
      // 备用：如果 load 事件没触发
      setTimeout(() => {
        if (!iframeInitialized && iframe.contentWindow) {
          initializeEditor();
        }
      }, 1000);
      
    } catch (error) {
      Zotero.logError(`[QuickNoteWindowV2] Failed to load native editor: ${error}`);
      // 回退到简单编辑器
      this.initializeSimpleEditor(container);
    }
  }
  
  /**
   * 初始化简单编辑器（备用）
   */
  private initializeSimpleEditor(container: HTMLElement): void {
    // 创建一个简单的文本区域作为备用
    const textArea = container.ownerDocument.createElement('textarea');
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
    textArea.placeholder = 'Start typing your note...';
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
        initialX = e.clientX - parseInt(this.container.style.right || '50');
        initialY = e.clientY - parseInt(this.container.style.top || '100');
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
      
      this.container.style.right = currentX + 'px';
      this.container.style.top = currentY + 'px';
    };
    
    header.addEventListener('mousedown', dragStart);
    header.ownerDocument.addEventListener('mouseup', dragEnd);
    header.ownerDocument.addEventListener('mousemove', drag);
  }
  

  
  /**
   * 判断是否需要创建新笔记
   */
  private shouldCreateNewNote(nodeId?: string): boolean {
    const mode = Zotero.Prefs.get('extensions.zotero.researchnavigator.quickNoteMode') || 'context';
    
    // A模式：总是创建新笔记
    if (mode === 'always-new') {
      return true;
    }
    
    // 当前模式：总是重用
    if (mode === 'always-reuse') {
      return false;
    }
    
    // B模式：基于上下文
    if (mode === 'context') {
      // 如果没有当前笔记，需要创建
      if (!this.currentNoteId) {
        return true;
      }
      
      // 如果上下文改变了，需要创建新笔记
      if (nodeId && nodeId !== this.noteContext) {
        Zotero.log(`[QuickNoteWindowV2] Context changed from ${this.noteContext} to ${nodeId}`, 'info');
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * 更新笔记信息显示
   */
  private async updateNoteInfo(): Promise<void> {
    const infoEl = this.container?.querySelector('.quick-note-info');
    if (!infoEl || !this.currentNoteId) return;
    
    try {
      const note = await Zotero.Items.getAsync(this.currentNoteId);
      if (note) {
        const title = note.getField('title') || 'Quick Note';
        const context = this.noteContext ? ` (${this.noteContext})` : '';
        infoEl.textContent = `${title}${context}`;
      }
    } catch (error) {
      Zotero.logError(`[QuickNoteWindowV2] Failed to update note info: ${error}`);
    }
  }
  
  /**
   * 获取节点信息
   */
  private async getNodeInfo(nodeId: string): Promise<{title: string, type: string, itemID: number, parentID?: number} | null> {
    try {
      // 解析节点ID (格式: "item-123" 或 "attachment-456" 或 "note-789")
      const [type, id] = nodeId.split('-');
      const itemId = parseInt(id);
      
      if (!itemId) return null;
      
      const item = await Zotero.Items.getAsync(itemId);
      if (!item) return null;
      
      const result: any = {
        title: item.getField('title') || 'Untitled',
        type: type,
        itemID: itemId
      };
      
      // 如果是附件，获取父项ID
      if (item.isAttachment() && item.parentID) {
        result.parentID = item.parentID;
        // 如果附件没有标题，尝试使用父项的标题
        if (result.title === 'Untitled') {
          const parent = await Zotero.Items.getAsync(item.parentID);
          if (parent) {
            result.title = parent.getField('title') || 'Untitled';
          }
        }
      } else if (item.isNote()) {
        // 如果是笔记，检查它是否有父项
        if (item.parentID) {
          // 使用笔记的父项作为新笔记的父项
          result.parentID = item.parentID;
          result.type = 'note-with-parent';
        } else {
          // 独立笔记，不能作为父项
          result.type = 'standalone-note';
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
        this.updateStatus('No note to save');
        return;
      }
      
      this.updateStatus('Saving...');
      
      // EditorInstance 会自动保存，这里只需要更新状态
      if (this.editor && typeof this.editor.saveSync === 'function') {
        this.editor.saveSync();
      }
      
      this.updateStatus('Saved');
      
      // 2秒后恢复状态
      setTimeout(() => {
        this.updateStatus('Ready');
      }, 2000);
      
    } catch (error) {
      Zotero.logError(`[QuickNoteWindowV2] Save failed: ${error}`);
      this.updateStatus('Save failed');
    }
  }
  
  /**
   * 强制创建新笔记（用户点击新建按钮）
   */
  private async forceCreateNewNote(): Promise<void> {
    Zotero.log('[QuickNoteWindowV2] User requested new note', 'info');
    // 清除当前笔记信息
    this.currentNoteId = null;
    this.noteContext = null;
    
    // 清空编辑器
    const editorContainer = this.container?.querySelector('#quick-note-editor-container');
    if (editorContainer) {
      editorContainer.innerHTML = '';
      const loading = editorContainer.ownerDocument.createElement('div');
      loading.id = 'editor-loading';
      loading.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: #666;
        font-size: 14px;
      `;
      loading.textContent = 'Creating new note...';
      editorContainer.appendChild(loading);
    }
    
    // 创建新笔记
    await this.createNewNote();
  }
  
  /**
   * 创建新笔记
   */
  private async createNewNote(): Promise<void> {
    // 防止重复创建
    if (this.isLoadingNote) {
      Zotero.log('[QuickNoteWindowV2] Already creating/loading a note, skipping', 'info');
      return;
    }
    
    try {
      this.isLoadingNote = true;
      this.updateStatus('Creating new note...');
      
      // 创建新的 Zotero 笔记
      const note = new Zotero.Item('note');
      
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
          if (nodeInfo.type === 'attachment' && nodeInfo.parentID) {
            // 附件：使用附件的父项
            parentItemID = nodeInfo.parentID;
            Zotero.log(`[QuickNoteWindowV2] Attachment node - Setting parent item ID: ${parentItemID}`, 'info');
          } else if (nodeInfo.type === 'note-with-parent' && nodeInfo.parentID) {
            // 有父项的笔记：使用相同的父项
            parentItemID = nodeInfo.parentID;
            Zotero.log(`[QuickNoteWindowV2] Note with parent - Setting parent item ID: ${parentItemID}`, 'info');
          } else if (nodeInfo.type === 'item') {
            // 普通项目：检查是否真的是普通项目
            const item = await Zotero.Items.getAsync(nodeInfo.itemID);
            if (item && item.isRegularItem()) {
              parentItemID = nodeInfo.itemID;
              Zotero.log(`[QuickNoteWindowV2] Regular item - Setting parent item ID: ${parentItemID}`, 'info');
            } else {
              Zotero.log(`[QuickNoteWindowV2] Item ${nodeInfo.itemID} is not a regular item, creating standalone note`, 'info');
            }
          } else if (nodeInfo.type === 'standalone-note') {
            // 独立笔记：创建新的独立笔记
            Zotero.log(`[QuickNoteWindowV2] Standalone note selected - Creating new standalone note`, 'info');
          }
        }
      }
      
      note.setNote(noteContent);
      
      // 设置父项（如果有）
      if (parentItemID) {
        note.parentID = parentItemID;
      }
      
      // 临时禁用项目选择通知
      const notifierID = Zotero.Notifier.registerObserver({
        notify: (event: string, type: string, ids: number[]) => {
          if (event === 'add' && type === 'item' && ids.includes(note.id)) {
            // 阻止选择新创建的笔记
            return false;
          }
        }
      }, ['item']);
      
      // 保存笔记
      await note.saveTx();
      
      // 移除通知监听
      Zotero.Notifier.unregisterObserver(notifierID);
      
      this.currentNoteId = note.id;
      this.noteContext = this.associatedNodeId;  // 记录创建时的上下文
      
      // 在编辑器中加载新笔记
      const editorContainer = this.container?.querySelector('#quick-note-editor-container');
      Zotero.log(`[QuickNoteWindowV2] Looking for editor container, found: ${!!editorContainer}`, 'info');
      
      if (editorContainer) {
        Zotero.log(`[QuickNoteWindowV2] Loading note ${this.currentNoteId} in editor...`, 'info');
        await this.loadNoteEditor(this.currentNoteId, editorContainer as HTMLElement);
        Zotero.log(`[QuickNoteWindowV2] Note loaded in editor`, 'info');
      } else {
        Zotero.logError('[QuickNoteWindowV2] Editor container not found!');
      }
      
      // 更新信息显示
      await this.updateNoteInfo();
      
      // 创建关联
      if (this.associatedNodeId) {
        await this.noteAssociationSystem.createAssociation(
          note.id,
          this.associatedNodeId,
          'quick-note',
          { source: 'quick-note-window-v2' }
        );
      }
      
      this.updateStatus('New note created');
      
    } catch (error) {
      Zotero.logError(`[QuickNoteWindowV2] Failed to create note: ${error}`);
      this.updateStatus('Failed to create note');
    } finally {
      this.isLoadingNote = false;
    }
  }
  
  /**
   * 更新状态
   */
  private updateStatus(text: string): void {
    if (!this.container) return;
    
    const statusEl = this.container.querySelector('.status-text');
    if (statusEl) {
      statusEl.textContent = text;
    }
  }
  
  /**
   * 隐藏窗口
   */
  hide(): void {
    if (this.container) {
      this.container.style.display = 'none';
      Zotero.log(`[QuickNoteWindowV2] Window hidden, keeping note ${this.currentNoteId} in memory`, 'info');
    }
  }
  
  /**
   * 关闭窗口
   */
  close(): void {
    try {
      // 清理编辑器实例
      if (this.editor && typeof this.editor.uninit === 'function') {
        Zotero.log('[QuickNoteWindowV2] Uninitializing editor', 'info');
        this.editor.uninit();
      }
      
      // 清理 iframe 的编辑器实例
      const iframe = this.container?.querySelector('#quick-note-editor-iframe');
      if (iframe && (iframe as any)._editorInstance) {
        const editorInstance = (iframe as any)._editorInstance;
        if (typeof editorInstance.uninit === 'function') {
          try {
            editorInstance.uninit();
          } catch (e) {
            Zotero.logError(`[QuickNoteWindowV2] Error uninitializing iframe editor: ${e}`);
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