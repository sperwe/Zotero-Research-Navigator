import { NoteAssociationSystem } from '../../managers/note-association-system';
import { HistoryService } from '../../services/history-service';

export class QuickNoteWindow {
  private window: Window | null = null;
  private container: HTMLElement | null = null;
  private editor: any = null;
  private currentNoteId: number | null = null;
  private associatedNodeId: string | null = null;
  
  constructor(
    private mainWindow: Window,
    private noteAssociationSystem: NoteAssociationSystem,
    private historyService: HistoryService
  ) {}
  
  /**
   * 显示快速笔记窗口
   */
  async show(nodeId?: string): Promise<void> {
    // 如果已经有窗口，聚焦它
    if (this.window && !this.window.closed) {
      this.window.focus();
      return;
    }
    
    // 创建新窗口
    this.createWindow(nodeId);
  }
  
  /**
   * 创建窗口
   */
  private createWindow(nodeId?: string): void {
    this.associatedNodeId = nodeId || null;
    
    // 创建主窗口
    const doc = this.mainWindow.document;
    
    // 创建浮动容器
    this.container = doc.createElement('div');
    this.container.id = 'quick-note-window';
    this.container.style.cssText = `
      position: fixed;
      top: 100px;
      right: 50px;
      width: 450px;
      height: 600px;
      background: white;
      border: 1px solid var(--material-border);
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      z-index: 10000;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    `;
    
    // 创建头部
    const header = this.createHeader(doc);
    this.container.appendChild(header);
    
    // 创建工具栏
    const toolbar = this.createToolbar(doc);
    this.container.appendChild(toolbar);
    
    // 创建编辑器容器
    const editorContainer = doc.createElement('div');
    editorContainer.id = 'quick-note-editor-container';
    editorContainer.style.cssText = `
      flex: 1;
      overflow: hidden;
      position: relative;
    `;
    this.container.appendChild(editorContainer);
    
    // 创建底部状态栏
    const statusBar = this.createStatusBar(doc);
    this.container.appendChild(statusBar);
    
    // 添加到文档
    doc.body.appendChild(this.container);
    
    // 初始化编辑器
    this.initializeEditor(editorContainer);
    
    // 使窗口可拖动
    this.makeDraggable(header);
  }
  
  /**
   * 创建头部
   */
  private createHeader(doc: Document): HTMLElement {
    const header = doc.createElement('div');
    header.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: #f5f5f5;
      border-bottom: 1px solid var(--material-border);
      cursor: move;
    `;
    
    // 标题
    const title = doc.createElement('h4');
    title.style.cssText = `
      margin: 0;
      font-size: 15px;
      font-weight: 600;
      color: #333;
    `;
    title.textContent = '📝 Quick Note';
    header.appendChild(title);
    
    // 关闭按钮
    const closeBtn = doc.createElement('button');
    closeBtn.style.cssText = `
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
      color: #666;
      padding: 0;
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
    `;
    closeBtn.innerHTML = '×';
    closeBtn.addEventListener('click', () => this.close());
    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.background = '#e0e0e0';
    });
    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.background = 'none';
    });
    header.appendChild(closeBtn);
    
    return header;
  }
  
  /**
   * 创建工具栏
   */
  private createToolbar(doc: Document): HTMLElement {
    const toolbar = doc.createElement('div');
    toolbar.style.cssText = `
      display: flex;
      gap: 10px;
      padding: 10px 16px;
      border-bottom: 1px solid var(--material-border);
      background: #fafafa;
    `;
    
    // 保存按钮
    const saveBtn = doc.createElement('button');
    saveBtn.style.cssText = `
      padding: 6px 16px;
      background: var(--accent-blue);
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
    `;
    saveBtn.innerHTML = '💾 Save';
    saveBtn.addEventListener('click', () => this.saveNote());
    toolbar.appendChild(saveBtn);
    
    // 新建按钮
    const newBtn = doc.createElement('button');
    newBtn.style.cssText = `
      padding: 6px 16px;
      background: white;
      border: 1px solid var(--material-border);
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
    `;
    newBtn.innerHTML = '➕ New Note';
    newBtn.addEventListener('click', () => this.createNewNote());
    toolbar.appendChild(newBtn);
    
    // 关联按钮
    if (this.associatedNodeId) {
      const associateBtn = doc.createElement('button');
      associateBtn.style.cssText = `
        padding: 6px 16px;
        background: white;
        border: 1px solid var(--material-border);
        border-radius: 4px;
        cursor: pointer;
        font-size: 13px;
        margin-left: auto;
      `;
      associateBtn.innerHTML = '🔗 Link to Current Item';
      associateBtn.addEventListener('click', () => this.associateWithCurrentItem());
      toolbar.appendChild(associateBtn);
    }
    
    return toolbar;
  }
  
  /**
   * 创建状态栏
   */
  private createStatusBar(doc: Document): HTMLElement {
    const statusBar = doc.createElement('div');
    statusBar.id = 'quick-note-status';
    statusBar.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 16px;
      border-top: 1px solid var(--material-border);
      background: #fafafa;
      font-size: 12px;
      color: #666;
    `;
    
    const status = doc.createElement('span');
    status.textContent = 'Ready';
    statusBar.appendChild(status);
    
    const wordCount = doc.createElement('span');
    wordCount.id = 'word-count';
    wordCount.textContent = '0 words';
    statusBar.appendChild(wordCount);
    
    return statusBar;
  }
  
  /**
   * 初始化编辑器
   */
  private async initializeEditor(container: HTMLElement): Promise<void> {
    try {
      // 创建一个新笔记或加载现有笔记
      if (!this.currentNoteId) {
        await this.createNewNote();
      }
      
      // 创建编辑器容器的iframe
      const doc = container.ownerDocument;
      const iframe = doc.createElement('iframe');
      iframe.style.cssText = `
        width: 100%;
        height: 100%;
        border: none;
      `;
      iframe.setAttribute('frameborder', '0');
      container.appendChild(iframe);
      
      // 等待iframe加载
      await new Promise(resolve => {
        iframe.addEventListener('load', resolve);
        iframe.src = 'about:blank';
      });
      
      // 获取iframe的window和document
      const iframeWin = iframe.contentWindow;
      const iframeDoc = iframe.contentDocument;
      
      if (!iframeWin || !iframeDoc) {
        throw new Error('Failed to access iframe');
      }
      
      // 设置iframe的内容
      iframeDoc.open();
      iframeDoc.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              margin: 0;
              padding: 16px;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              font-size: 14px;
              line-height: 1.6;
              color: #333;
            }
            note-editor {
              display: block;
              width: 100%;
              height: 100%;
            }
          </style>
        </head>
        <body>
          <note-editor></note-editor>
        </body>
        </html>
      `);
      iframeDoc.close();
      
      // 等待DOM准备好
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 创建编辑器
      const noteEditor = iframeDoc.querySelector('note-editor');
      if (noteEditor && this.currentNoteId) {
        // 使用Zotero的原生编辑器
        const note = await Zotero.Items.getAsync(this.currentNoteId);
        if (note) {
          // 初始化编辑器实例
          const editorInstance = new Zotero.EditorInstance();
          await editorInstance.init({
            item: note,
            viewMode: 'edit',
            parent: noteEditor,
            saveOnClose: true
          });
          
          this.editor = editorInstance;
          
          // 监听内容变化更新字数
          editorInstance.on('change', () => {
            this.updateWordCount();
          });
        }
      }
      
    } catch (error) {
      Zotero.logError(`[QuickNoteWindow] Failed to initialize editor: ${error}`);
      this.showError('Failed to initialize editor');
    }
  }
  
  /**
   * 创建新笔记
   */
  private async createNewNote(): Promise<void> {
    try {
      const note = new Zotero.Item('note');
      note.libraryID = Zotero.Libraries.userLibraryID;
      note.setNote('<p></p>');
      await note.saveTx();
      
      this.currentNoteId = note.id;
      
      // 如果有关联节点，创建关联
      if (this.associatedNodeId) {
        await this.noteAssociationSystem.createAssociation(
          note.id,
          this.associatedNodeId,
          'quick-note',
          { source: 'quick-note-window' }
        );
      }
      
      // 重新初始化编辑器
      if (this.editor) {
        this.editor.uninit();
      }
      
      const container = this.container?.querySelector('#quick-note-editor-container');
      if (container) {
        container.innerHTML = '';
        await this.initializeEditor(container as HTMLElement);
      }
      
      this.updateStatus('New note created');
      
    } catch (error) {
      Zotero.logError(`[QuickNoteWindow] Failed to create note: ${error}`);
      this.showError('Failed to create note');
    }
  }
  
  /**
   * 保存笔记
   */
  private async saveNote(): Promise<void> {
    try {
      if (!this.editor || !this.currentNoteId) {
        this.showError('No note to save');
        return;
      }
      
      await this.editor.saveSync();
      this.updateStatus('Note saved');
      
      // 触发一个短暂的视觉反馈
      const saveBtn = this.container?.querySelector('button');
      if (saveBtn) {
        const originalText = saveBtn.innerHTML;
        saveBtn.innerHTML = '✅ Saved';
        setTimeout(() => {
          saveBtn.innerHTML = originalText;
        }, 2000);
      }
      
    } catch (error) {
      Zotero.logError(`[QuickNoteWindow] Failed to save note: ${error}`);
      this.showError('Failed to save note');
    }
  }
  
  /**
   * 关联到当前项目
   */
  private async associateWithCurrentItem(): Promise<void> {
    try {
      const ZoteroPane = Zotero.getActiveZoteroPane();
      if (!ZoteroPane) return;
      
      const selectedItems = ZoteroPane.getSelectedItems();
      if (selectedItems.length !== 1) {
        this.showError('Please select exactly one item');
        return;
      }
      
      const item = selectedItems[0];
      if (!this.currentNoteId) return;
      
      // 创建历史节点
      const node = await this.historyService.createOrUpdateNode(item.id, {
        title: item.getField('title'),
        url: item.getField('url')
      });
      
      // 创建关联
      await this.noteAssociationSystem.createAssociation(
        this.currentNoteId,
        node.id,
        'quick-note',
        { 
          source: 'quick-note-window',
          itemId: item.id 
        }
      );
      
      this.updateStatus(`Associated with: ${item.getField('title')}`);
      
    } catch (error) {
      Zotero.logError(`[QuickNoteWindow] Failed to associate: ${error}`);
      this.showError('Failed to associate with item');
    }
  }
  
  /**
   * 更新字数统计
   */
  private updateWordCount(): void {
    if (!this.editor) return;
    
    try {
      const content = this.editor.getNote();
      const plainText = content.replace(/<[^>]*>/g, ' ');
      const words = plainText.trim().split(/\s+/).filter(w => w.length > 0);
      
      const wordCountEl = this.container?.querySelector('#word-count');
      if (wordCountEl) {
        wordCountEl.textContent = `${words.length} words`;
      }
    } catch (error) {
      // 忽略错误
    }
  }
  
  /**
   * 更新状态
   */
  private updateStatus(message: string): void {
    const statusEl = this.container?.querySelector('#quick-note-status span');
    if (statusEl) {
      statusEl.textContent = message;
    }
  }
  
  /**
   * 显示错误
   */
  private showError(message: string): void {
    this.updateStatus(`❌ ${message}`);
    setTimeout(() => {
      this.updateStatus('Ready');
    }, 3000);
  }
  
  /**
   * 使元素可拖动
   */
  private makeDraggable(element: HTMLElement): void {
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;
    
    element.addEventListener('mousedown', (e: MouseEvent) => {
      // 忽略按钮点击
      if ((e.target as HTMLElement).tagName === 'BUTTON') return;
      
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      
      const rect = this.container!.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      
      e.preventDefault();
    });
    
    this.mainWindow.addEventListener('mousemove', (e: MouseEvent) => {
      if (!isDragging || !this.container) return;
      
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      
      this.container.style.left = 'auto';
      this.container.style.right = `${this.mainWindow.innerWidth - startLeft - this.container.offsetWidth - deltaX}px`;
      this.container.style.top = `${startTop + deltaY}px`;
    });
    
    this.mainWindow.addEventListener('mouseup', () => {
      isDragging = false;
    });
  }
  
  /**
   * 关闭窗口
   */
  close(): void {
    if (this.editor) {
      this.editor.uninit();
      this.editor = null;
    }
    
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
    
    this.currentNoteId = null;
    this.associatedNodeId = null;
  }
  
  /**
   * 检查窗口是否打开
   */
  isOpen(): boolean {
    return this.container !== null;
  }
}