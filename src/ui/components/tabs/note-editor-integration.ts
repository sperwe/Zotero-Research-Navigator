import { AssociatedNote } from "../../../types";

export type EditorMode = 'column' | 'tab' | 'drawer';

export class NoteEditorIntegration {
  private mode: EditorMode = 'column';
  private container: HTMLElement | null = null;
  private editorInstance: any = null;
  private currentNote: AssociatedNote | null = null;
  
  constructor(
    private window: Window,
    private onNoteUpdate: (note: AssociatedNote) => void
  ) {}
  
  /**
   * 设置编辑器模式
   */
  setMode(mode: EditorMode): void {
    this.mode = mode;
    if (this.container) {
      this.render();
    }
  }
  
  /**
   * 渲染编辑器
   */
  render(): void {
    if (!this.container) return;
    
    switch (this.mode) {
      case 'column':
        this.renderColumnMode();
        break;
      case 'tab':
        this.renderTabMode();
        break;
      case 'drawer':
        this.renderDrawerMode();
        break;
    }
  }
  
  /**
   * 创建编辑器元素
   */
  private createEditor(noteId: number): HTMLElement {
    const doc = this.window.document;
    
    // 创建编辑器容器
    const editorContainer = doc.createElement('div');
    editorContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
      min-height: 300px;
    `;
    
    // 创建 note-editor 元素
    const noteEditor = doc.createElement('note-editor') as any;
    noteEditor.style.cssText = `
      flex: 1;
      width: 100%;
    `;
    
    // 设置编辑器属性
    noteEditor.mode = 'edit';
    noteEditor.viewMode = 'library';
    
    // 加载笔记
    this.loadNoteIntoEditor(noteEditor, noteId);
    
    editorContainer.appendChild(noteEditor);
    
    return editorContainer;
  }
  
  /**
   * 加载笔记到编辑器
   */
  private async loadNoteIntoEditor(editor: any, noteId: number): Promise<void> {
    try {
      const item = await Zotero.Items.getAsync(noteId);
      if (item && item.isNote()) {
        editor.item = item;
        this.editorInstance = editor;
      }
    } catch (error) {
      Zotero.logError(`[NoteEditorIntegration] Failed to load note ${noteId}: ${error}`);
    }
  }
  
  /**
   * 分栏模式
   */
  private renderColumnMode(): void {
    // 在 note-relations-tab.ts 中实现
  }
  
  /**
   * 标签模式
   */
  private renderTabMode(): void {
    // 在 note-relations-tab.ts 中实现
  }
  
  /**
   * 抽屉模式
   */
  private renderDrawerMode(): void {
    // 在 note-relations-tab.ts 中实现
  }
  
  /**
   * 清理
   */
  destroy(): void {
    if (this.editorInstance) {
      this.editorInstance = null;
    }
    this.container = null;
    this.currentNote = null;
  }
}