/**
 * BetterNotes 兼容性工具
 * 
 * 处理与 BetterNotes 插件的交互和兼容性问题
 */

export class BetterNotesCompat {
  /**
   * 检查 BetterNotes 是否已安装并启用
   */
  static isInstalled(): boolean {
    const win = Zotero.getMainWindow();
    return !!(win.Zotero.BetterNotes || win.window?.BetterNotesEditorAPI);
  }
  
  /**
   * 获取 BetterNotes API
   */
  static getAPI(): any {
    const win = Zotero.getMainWindow();
    return win.window?.BetterNotesEditorAPI || null;
  }
  
  /**
   * 标记编辑器实例以避免 BetterNotes 干扰
   */
  static markEditorAsManaged(editorInstance: any, iframe?: HTMLIFrameElement): void {
    // 标记编辑器实例
    editorInstance._researchNavigatorManaged = true;
    editorInstance._betterNotesIgnore = true;
    
    // 标记 iframe
    if (iframe?.contentWindow) {
      try {
        const contentWin = iframe.contentWindow as any;
        if (contentWin.wrappedJSObject) {
          contentWin.wrappedJSObject._betterNotesIgnore = true;
          contentWin.wrappedJSObject._researchNavigatorEditor = true;
        }
        contentWin._betterNotesIgnore = true;
        contentWin._researchNavigatorEditor = true;
      } catch (e) {
        // 忽略跨域错误
      }
    }
  }
  
  /**
   * 等待 BetterNotes 初始化完成
   */
  static async waitForInitialization(timeout: number = 200): Promise<void> {
    if (this.isInstalled()) {
      await new Promise(resolve => setTimeout(resolve, timeout));
    }
  }
  
  /**
   * 转换 Markdown 为 HTML（如果 BetterNotes 可用）
   */
  static async markdownToHTML(markdown: string): Promise<string | null> {
    const api = this.getAPI();
    if (api?.md2html && typeof api.md2html === 'function') {
      try {
        return await api.md2html(markdown);
      } catch (e) {
        Zotero.logError(`BetterNotes markdown conversion failed: ${e}`);
      }
    }
    return null;
  }
  
  /**
   * 使用 BetterNotes 插入内容到编辑器
   */
  static async insertWithBetterNotes(
    editor: any, 
    markdown: string
  ): Promise<boolean> {
    if (!this.isInstalled() || !editor._editorCore) {
      return false;
    }
    
    const api = this.getAPI();
    if (!api) return false;
    
    try {
      const html = await this.markdownToHTML(markdown);
      if (!html) return false;
      
      const state = editor._editorCore.view.state;
      const slice = api.getSliceFromHTML(state, html);
      
      const tr = state.tr.replaceSelection(slice);
      editor._editorCore.view.dispatch(tr);
      
      return true;
    } catch (e) {
      Zotero.logError(`BetterNotes insertion failed: ${e}`);
      return false;
    }
  }
  
  /**
   * 安全清理编辑器（处理 BetterNotes 钩子）
   */
  static cleanupEditor(editor: any): void {
    if (!editor) return;
    
    // 通知 BetterNotes
    if (editor._betterNotesCleanup && typeof editor._betterNotesCleanup === 'function') {
      try {
        editor._betterNotesCleanup();
      } catch (e) {
        // 忽略错误
      }
    }
    
    // 标记为已销毁
    editor._destroyed = true;
  }
  
  /**
   * 检查编辑器是否应该被 BetterNotes 处理
   */
  static shouldBetterNotesHandle(editorInstance: any): boolean {
    return !editorInstance._researchNavigatorManaged && 
           !editorInstance._betterNotesIgnore;
  }
}