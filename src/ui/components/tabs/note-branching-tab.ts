import { NoteBranchingSystem, NoteBranch, NoteVersion } from '../../../managers/note-branching';
import { NoteAssociationSystem } from '../../../managers/note-association-system';

export class NoteBranchingTab {
  private container: HTMLElement | null = null;
  private noteBranchingSystem: NoteBranchingSystem;
  private currentNoteId: number | null = null;
  private currentBranch = 'main';
  
  constructor(
    private window: Window,
    private noteAssociationSystem: NoteAssociationSystem
  ) {
    this.noteBranchingSystem = new NoteBranchingSystem(window, noteAssociationSystem);
  }
  
  create(container: HTMLElement): void {
    this.container = container;
    const doc = this.window.document;
    
    container.style.cssText = `
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
      background: var(--material-sidepane);
    `;
    
    // 检查是否选中了笔记
    const selectedNote = this.getSelectedNote();
    if (!selectedNote) {
      this.showEmptyState(container);
      return;
    }
    
    this.currentNoteId = selectedNote.id;
    
    // 工具栏
    const toolbar = this.createToolbar(doc);
    container.appendChild(toolbar);
    
    // 主内容区
    const mainContent = doc.createElement('div');
    mainContent.style.cssText = `
      flex: 1;
      display: flex;
      overflow: hidden;
    `;
    
    // 分支列表
    const branchList = this.createBranchList(doc);
    mainContent.appendChild(branchList);
    
    // 版本历史
    const versionHistory = this.createVersionHistory(doc);
    mainContent.appendChild(versionHistory);
    
    container.appendChild(mainContent);
    
    // 加载数据
    this.loadBranches();
  }
  
  private createToolbar(doc: Document): HTMLElement {
    const toolbar = doc.createElement('div');
    toolbar.style.cssText = `
      display: flex;
      gap: 10px;
      padding: 10px;
      border-bottom: 1px solid var(--material-border-quarternary);
      background: white;
    `;
    
    // 当前分支显示
    const branchInfo = doc.createElement('div');
    branchInfo.style.cssText = `
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 14px;
      font-weight: 500;
    `;
    branchInfo.innerHTML = `
      <span style="color: #666;">Current branch:</span>
      <span id="current-branch-name" style="color: var(--accent-blue);">${this.currentBranch}</span>
    `;
    toolbar.appendChild(branchInfo);
    
    // 操作按钮
    const actions = doc.createElement('div');
    actions.style.cssText = `
      margin-left: auto;
      display: flex;
      gap: 5px;
    `;
    
    // 新建分支按钮
    const newBranchBtn = doc.createElement('button');
    newBranchBtn.textContent = '+ New Branch';
    newBranchBtn.style.cssText = `
      padding: 5px 12px;
      border: 1px solid var(--material-border-quarternary);
      background: white;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
    `;
    newBranchBtn.addEventListener('click', () => this.createNewBranch());
    actions.appendChild(newBranchBtn);
    
    // 提交按钮
    const commitBtn = doc.createElement('button');
    commitBtn.textContent = '💾 Commit';
    commitBtn.style.cssText = `
      padding: 5px 12px;
      background: var(--accent-blue);
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
    `;
    commitBtn.addEventListener('click', () => this.commitChanges());
    actions.appendChild(commitBtn);
    
    // 合并按钮
    const mergeBtn = doc.createElement('button');
    mergeBtn.textContent = '🔀 Merge';
    mergeBtn.style.cssText = `
      padding: 5px 12px;
      border: 1px solid var(--material-border-quarternary);
      background: white;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
    `;
    mergeBtn.addEventListener('click', () => this.showMergeDialog());
    actions.appendChild(mergeBtn);
    
    toolbar.appendChild(actions);
    
    return toolbar;
  }
  
  private createBranchList(doc: Document): HTMLElement {
    const container = doc.createElement('div');
    container.style.cssText = `
      width: 250px;
      border-right: 1px solid var(--material-border-quarternary);
      display: flex;
      flex-direction: column;
    `;
    
    // 标题
    const header = doc.createElement('div');
    header.style.cssText = `
      padding: 10px;
      font-weight: 600;
      font-size: 14px;
      border-bottom: 1px solid var(--material-border-quarternary);
    `;
    header.textContent = 'Branches';
    container.appendChild(header);
    
    // 分支列表
    const list = doc.createElement('div');
    list.id = 'branch-list';
    list.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 10px;
    `;
    container.appendChild(list);
    
    return container;
  }
  
  private createVersionHistory(doc: Document): HTMLElement {
    const container = doc.createElement('div');
    container.style.cssText = `
      flex: 1;
      display: flex;
      flex-direction: column;
    `;
    
    // 标题
    const header = doc.createElement('div');
    header.style.cssText = `
      padding: 10px;
      font-weight: 600;
      font-size: 14px;
      border-bottom: 1px solid var(--material-border-quarternary);
    `;
    header.textContent = 'Version History';
    container.appendChild(header);
    
    // 版本列表
    const list = doc.createElement('div');
    list.id = 'version-list';
    list.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 10px;
    `;
    container.appendChild(list);
    
    return container;
  }
  
  private showEmptyState(container: HTMLElement): void {
    container.innerHTML = `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: #666;
        text-align: center;
        padding: 20px;
      ">
        <div style="font-size: 48px; margin-bottom: 20px;">📝</div>
        <h3 style="margin: 0 0 10px 0;">No Note Selected</h3>
        <p style="margin: 0;">Select a note to view and manage its version branches</p>
      </div>
    `;
  }
  
  private async loadBranches(): Promise<void> {
    if (!this.currentNoteId) return;
    
    try {
      // 获取所有分支
      const branches = await this.noteBranchingSystem.getAllBranches(this.currentNoteId);
      
      // 如果没有分支，创建初始版本
      if (branches.length === 0) {
        await this.noteBranchingSystem.createInitialVersion(this.currentNoteId);
        // 重新加载
        await this.loadBranches();
        return;
      }
      
      // 显示分支列表
      this.displayBranches(branches);
      
      // 加载当前分支的历史
      await this.loadVersionHistory();
      
    } catch (error) {
      Zotero.logError(`[NoteBranchingTab] Error loading branches: ${error}`);
    }
  }
  
  private displayBranches(branches: NoteBranch[]): void {
    const list = this.container?.querySelector('#branch-list');
    if (!list) return;
    
    const doc = this.window.document;
    list.innerHTML = '';
    
    for (const branch of branches) {
      const item = doc.createElement('div');
      item.style.cssText = `
        padding: 8px;
        margin-bottom: 5px;
        border-radius: 4px;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
        ${branch.name === this.currentBranch ? 
          'background: var(--accent-blue); color: white;' : 
          'background: var(--material-button);'}
      `;
      
      const name = doc.createElement('span');
      name.textContent = branch.name;
      name.style.fontWeight = branch.name === 'main' ? '600' : 'normal';
      item.appendChild(name);
      
      const date = doc.createElement('span');
      date.style.cssText = `
        font-size: 11px;
        opacity: 0.7;
      `;
      date.textContent = new Date(branch.updatedAt).toLocaleDateString();
      item.appendChild(date);
      
      item.addEventListener('click', () => this.switchBranch(branch.name));
      
      list.appendChild(item);
    }
  }
  
  private async loadVersionHistory(): Promise<void> {
    if (!this.currentNoteId) return;
    
    try {
      const versions = await this.noteBranchingSystem.getVersionHistory(
        this.currentNoteId,
        this.currentBranch
      );
      
      this.displayVersions(versions);
      
    } catch (error) {
      Zotero.logError(`[NoteBranchingTab] Error loading versions: ${error}`);
    }
  }
  
  private displayVersions(versions: NoteVersion[]): void {
    const list = this.container?.querySelector('#version-list');
    if (!list) return;
    
    const doc = this.window.document;
    list.innerHTML = '';
    
    for (const version of versions) {
      const item = doc.createElement('div');
      item.style.cssText = `
        padding: 10px;
        margin-bottom: 8px;
        border: 1px solid var(--material-border-quarternary);
        border-radius: 4px;
        background: white;
      `;
      
      // 版本信息
      const header = doc.createElement('div');
      header.style.cssText = `
        display: flex;
        justify-content: space-between;
        margin-bottom: 5px;
      `;
      
      const info = doc.createElement('div');
      info.innerHTML = `
        <div style="font-weight: 500; margin-bottom: 3px;">${version.message || 'No message'}</div>
        <div style="font-size: 12px; color: #666;">
          ${version.author} • ${new Date(version.timestamp).toLocaleString()}
        </div>
      `;
      header.appendChild(info);
      
      const actions = doc.createElement('div');
      actions.style.cssText = `
        display: flex;
        gap: 5px;
      `;
      
      // 查看差异按钮
      const diffBtn = doc.createElement('button');
      diffBtn.textContent = 'Diff';
      diffBtn.style.cssText = `
        padding: 3px 8px;
        font-size: 12px;
        border: 1px solid var(--material-border-quarternary);
        background: white;
        border-radius: 3px;
        cursor: pointer;
      `;
      diffBtn.addEventListener('click', () => this.showDiff(version.id));
      actions.appendChild(diffBtn);
      
      header.appendChild(actions);
      item.appendChild(header);
      
      // 标签
      if (version.tags.length > 0) {
        const tags = doc.createElement('div');
        tags.style.cssText = `
          display: flex;
          gap: 5px;
          margin-top: 5px;
        `;
        
        for (const tag of version.tags) {
          const tagEl = doc.createElement('span');
          tagEl.style.cssText = `
            padding: 2px 8px;
            background: #e3f2fd;
            color: #1976d2;
            border-radius: 12px;
            font-size: 11px;
          `;
          tagEl.textContent = tag;
          tags.appendChild(tagEl);
        }
        
        item.appendChild(tags);
      }
      
      list.appendChild(item);
    }
  }
  
  private async switchBranch(branchName: string): Promise<void> {
    if (!this.currentNoteId || branchName === this.currentBranch) return;
    
    try {
      await this.noteBranchingSystem.switchBranch(this.currentNoteId, branchName);
      this.currentBranch = branchName;
      
      // 更新UI
      const branchNameEl = this.container?.querySelector('#current-branch-name');
      if (branchNameEl) {
        branchNameEl.textContent = branchName;
      }
      
      // 重新加载
      await this.loadBranches();
      
      // 通知用户
      this.showNotification(`Switched to branch: ${branchName}`);
      
    } catch (error) {
      Zotero.logError(`[NoteBranchingTab] Error switching branch: ${error}`);
      this.showNotification(`Failed to switch branch: ${error}`, 'error');
    }
  }
  
  private async createNewBranch(): Promise<void> {
    if (!this.currentNoteId) return;
    
    const branchName = this.window.prompt('Enter new branch name:');
    if (!branchName) return;
    
    try {
      await this.noteBranchingSystem.createBranch(
        this.currentNoteId,
        branchName,
        this.currentBranch
      );
      
      // 切换到新分支
      await this.switchBranch(branchName);
      
      this.showNotification(`Created branch: ${branchName}`);
      
    } catch (error) {
      Zotero.logError(`[NoteBranchingTab] Error creating branch: ${error}`);
      this.showNotification(`Failed to create branch: ${error}`, 'error');
    }
  }
  
  private async commitChanges(): Promise<void> {
    if (!this.currentNoteId) return;
    
    const message = this.window.prompt('Commit message:');
    if (!message) return;
    
    try {
      await this.noteBranchingSystem.commit(
        this.currentNoteId,
        message
      );
      
      // 重新加载版本历史
      await this.loadVersionHistory();
      
      this.showNotification('Changes committed successfully');
      
    } catch (error) {
      Zotero.logError(`[NoteBranchingTab] Error committing: ${error}`);
      this.showNotification(`Failed to commit: ${error}`, 'error');
    }
  }
  
  private async showMergeDialog(): Promise<void> {
    if (!this.currentNoteId) return;
    
    const branches = await this.noteBranchingSystem.getAllBranches(this.currentNoteId);
    const otherBranches = branches.filter(b => b.name !== this.currentBranch);
    
    if (otherBranches.length === 0) {
      this.showNotification('No other branches to merge', 'warning');
      return;
    }
    
    const branchNames = otherBranches.map(b => b.name).join(', ');
    const sourceBranch = this.window.prompt(
      `Merge which branch into ${this.currentBranch}?\nAvailable: ${branchNames}`
    );
    
    if (!sourceBranch) return;
    
    try {
      const result = await this.noteBranchingSystem.mergeBranch(
        this.currentNoteId,
        sourceBranch,
        this.currentBranch
      );
      
      if (result.success) {
        this.showNotification(`Successfully merged ${sourceBranch} into ${this.currentBranch}`);
        await this.loadVersionHistory();
      } else {
        this.showNotification(
          `Merge conflicts detected: ${result.conflicts?.length} conflicts`,
          'error'
        );
      }
      
    } catch (error) {
      Zotero.logError(`[NoteBranchingTab] Error merging: ${error}`);
      this.showNotification(`Failed to merge: ${error}`, 'error');
    }
  }
  
  private async showDiff(versionId: string): Promise<void> {
    // 这里可以实现一个差异查看器
    this.showNotification('Diff viewer coming soon!', 'info');
  }
  
  private getSelectedNote(): any {
    const ZoteroPane = Zotero.getActiveZoteroPane();
    if (!ZoteroPane) return null;
    
    const selected = ZoteroPane.getSelectedItems();
    if (selected.length === 1 && selected[0].isNote()) {
      return selected[0];
    }
    
    return null;
  }
  
  private showNotification(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'success'): void {
    const progressWindow = new Zotero.ProgressWindow();
    progressWindow.changeHeadline('Note Branching');
    
    const icon = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    }[type];
    
    progressWindow.addDescription(`${icon} ${message}`);
    progressWindow.show();
    
    setTimeout(() => {
      progressWindow.close();
    }, 3000);
  }
  
  refresh(): void {
    if (this.container) {
      const doc = this.window.document;
      const tempContainer = doc.createElement('div');
      tempContainer.style.cssText = 'height: 100%; width: 100%;';
      
      const parent = this.container.parentElement;
      if (parent) {
        parent.replaceChild(tempContainer, this.container);
        this.container = tempContainer;
        this.create(this.container);
      }
    }
  }
  
  destroy(): void {
    this.container = null;
    this.currentNoteId = null;
  }
}