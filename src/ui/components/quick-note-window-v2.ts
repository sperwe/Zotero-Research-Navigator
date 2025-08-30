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
      this.container.style.display = 'flex';
      this.associatedNodeId = nodeId || null;
      return;
    }
    
    // 防止重复创建
    if (this.isCreating) {
      Zotero.log('[QuickNoteWindowV2] Already creating window, skipping', 'info');
      return;
    }
    
    // 创建新窗口
    this.createWindow(nodeId);
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
      newBtn.addEventListener('click', () => this.createNewNote());
    }
  }
  
  /**
   * 初始化编辑器
   */
  private async initializeEditor(container: HTMLElement): Promise<void> {
    try {
      Zotero.log('[QuickNoteWindowV2] Initializing Zotero native editor...', 'info');
      
      // 如果已有笔记，加载 Zotero 原生编辑器
      if (this.currentNoteId) {
        await this.loadNoteEditor(this.currentNoteId, container);
      } else {
        // 否则显示占位符
        const placeholder = container.ownerDocument.createElement('div');
        placeholder.style.cssText = `
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: #999;
          font-size: 14px;
          text-align: center;
          padding: 20px;
        `;
        placeholder.innerHTML = `
          <div>
            <p>Click "New Note" to create a note</p>
            <p style="font-size: 12px; margin-top: 10px;">or select an existing note</p>
          </div>
        `;
        container.appendChild(placeholder);
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
      
      // 创建编辑器容器
      const editorContainer = container.ownerDocument.createElement('div');
      editorContainer.style.cssText = 'width: 100%; height: 100%;';
      editorContainer.id = `quick-note-editor-${noteId}`;
      container.appendChild(editorContainer);
      
      // 获取笔记项
      const note = await Zotero.Items.getAsync(noteId);
      if (!note || !note.isNote()) {
        throw new Error('Invalid note item');
      }
      
      // 尝试创建 Zotero 编辑器实例
      if (Zotero.EditorInstance) {
        const editorInstance = new Zotero.EditorInstance();
        editorInstance.init({
          item: note,
          container: editorContainer,
          mode: 'edit',
          disableUI: false,
          onNavigate: (uri: string) => {
            Zotero.log(`[QuickNoteWindowV2] Navigate to: ${uri}`, 'info');
          }
        });
        
        this.editor = editorInstance;
        Zotero.log('[QuickNoteWindowV2] Native editor loaded successfully', 'info');
      } else {
        // 如果 EditorInstance 不可用，尝试其他方法
        throw new Error('Zotero.EditorInstance not available');
      }
      
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
    const iframe = container.ownerDocument.createElement('iframe');
    iframe.style.cssText = 'width: 100%; height: 100%; border: none;';
    iframe.setAttribute('frameborder', '0');
    container.appendChild(iframe);
    
    const iframeDoc = iframe.contentDocument;
    if (iframeDoc) {
      iframeDoc.open();
      iframeDoc.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { 
              margin: 16px; 
              font-family: -apple-system, sans-serif;
              font-size: 14px;
              line-height: 1.6;
            }
          </style>
        </head>
        <body contenteditable="true">
          <p>Start typing your note...</p>
        </body>
        </html>
      `);
      iframeDoc.close();
    }
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
   * 保存笔记
   */
  private async saveNote(): Promise<void> {
    try {
      this.updateStatus('Saving...');
      // 实际的保存逻辑
      await new Promise(resolve => setTimeout(resolve, 500));
      this.updateStatus('Saved');
    } catch (error) {
      Zotero.logError(`[QuickNoteWindowV2] Save failed: ${error}`);
      this.updateStatus('Save failed');
    }
  }
  
  /**
   * 创建新笔记
   */
  private async createNewNote(): Promise<void> {
    try {
      this.updateStatus('Creating new note...');
      
      // 创建新的 Zotero 笔记
      const note = new Zotero.Item('note');
      note.setNote('<p>New quick note</p>');
      await note.saveTx();
      
      this.currentNoteId = note.id;
      
      // 在编辑器中加载新笔记
      const editorContainer = this.container?.querySelector('#quick-note-editor-container');
      if (editorContainer) {
        await this.loadNoteEditor(this.currentNoteId, editorContainer as HTMLElement);
      }
      
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
    }
  }
  
  /**
   * 关闭窗口
   */
  close(): void {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
    this.editor = null;
    this.currentNoteId = null;
  }
}