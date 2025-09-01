import { NoteAssociationSystem } from './note-association-system';

export interface NoteBlock {
  id: string;
  content: string;
  type: 'paragraph' | 'heading' | 'list' | 'quote' | 'code';
  metadata: {
    position: number;
    hash: string;
    parentBlockId?: string;
  };
}

export interface NoteVersion {
  id: string;
  noteId: number;
  branchName: string;
  parentVersionId?: string;
  blocks: NoteBlock[];
  timestamp: Date;
  author: string;
  message?: string;
  tags: string[];
}

export interface NoteBranch {
  name: string;
  currentVersionId: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  parentBranch?: string;
}

export interface MergeConflict {
  blockId: string;
  baseContent: string;
  currentContent: string;
  incomingContent: string;
}

export class NoteBranchingSystem {
  private versions = new Map<string, NoteVersion>();
  private branches = new Map<string, NoteBranch>();
  private currentBranch = 'main';
  
  constructor(
    private window: Window,
    private noteAssociationSystem: NoteAssociationSystem
  ) {
    this.initializeDatabase();
  }
  
  /**
   * 初始化数据库表
   */
  private async initializeDatabase(): Promise<void> {
    try {
      // 创建版本表
      await Zotero.DB.queryAsync(`
        CREATE TABLE IF NOT EXISTS research_navigator_note_versions (
          id TEXT PRIMARY KEY,
          note_id INTEGER NOT NULL,
          branch_name TEXT NOT NULL,
          parent_version_id TEXT,
          blocks TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          author TEXT NOT NULL,
          message TEXT,
          tags TEXT,
          FOREIGN KEY(note_id) REFERENCES items(itemID) ON DELETE CASCADE
        )
      `);
      
      // 创建分支表
      await Zotero.DB.queryAsync(`
        CREATE TABLE IF NOT EXISTS research_navigator_note_branches (
          name TEXT PRIMARY KEY,
          note_id INTEGER NOT NULL,
          current_version_id TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          is_active INTEGER NOT NULL DEFAULT 1,
          parent_branch TEXT,
          FOREIGN KEY(note_id) REFERENCES items(itemID) ON DELETE CASCADE,
          FOREIGN KEY(current_version_id) REFERENCES research_navigator_note_versions(id)
        )
      `);
      
      // 创建索引
      await Zotero.DB.queryAsync(`
        CREATE INDEX IF NOT EXISTS idx_versions_note_id ON research_navigator_note_versions(note_id)
      `);
      
      await Zotero.DB.queryAsync(`
        CREATE INDEX IF NOT EXISTS idx_branches_note_id ON research_navigator_note_branches(note_id)
      `);
      
    } catch (error) {
      Zotero.logError(`[NoteBranchingSystem] Database initialization error: ${error}`);
    }
  }
  
  /**
   * 创建初始版本
   */
  async createInitialVersion(noteId: number): Promise<NoteVersion> {
    const note = await Zotero.Items.getAsync(noteId);
    if (!note || !note.isNote()) {
      throw new Error('Invalid note ID');
    }
    
    const content = note.getNote();
    const blocks = this.parseNoteContent(content);
    
    const version: NoteVersion = {
      id: this.generateVersionId(),
      noteId,
      branchName: 'main',
      blocks,
      timestamp: new Date(),
      author: Zotero.Users.getCurrentUsername() || 'Unknown',
      message: 'Initial version',
      tags: []
    };
    
    // 保存版本
    await this.saveVersion(version);
    
    // 创建主分支
    const branch: NoteBranch = {
      name: 'main',
      currentVersionId: version.id,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true
    };
    
    await this.saveBranch(noteId, branch);
    
    return version;
  }
  
  /**
   * 创建新分支
   */
  async createBranch(
    noteId: number,
    branchName: string,
    fromBranch: string = 'main'
  ): Promise<NoteBranch> {
    // 检查分支是否存在
    const existing = await this.getBranch(noteId, branchName);
    if (existing) {
      throw new Error(`Branch ${branchName} already exists`);
    }
    
    // 获取源分支
    const sourceBranch = await this.getBranch(noteId, fromBranch);
    if (!sourceBranch) {
      throw new Error(`Source branch ${fromBranch} not found`);
    }
    
    // 获取源分支的当前版本
    const sourceVersion = await this.getVersion(sourceBranch.currentVersionId);
    if (!sourceVersion) {
      throw new Error('Source version not found');
    }
    
    // 创建新版本
    const newVersion: NoteVersion = {
      ...sourceVersion,
      id: this.generateVersionId(),
      branchName,
      parentVersionId: sourceVersion.id,
      timestamp: new Date(),
      message: `Created branch ${branchName} from ${fromBranch}`
    };
    
    await this.saveVersion(newVersion);
    
    // 创建新分支
    const branch: NoteBranch = {
      name: branchName,
      currentVersionId: newVersion.id,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
      parentBranch: fromBranch
    };
    
    await this.saveBranch(noteId, branch);
    
    return branch;
  }
  
  /**
   * 切换分支
   */
  async switchBranch(noteId: number, branchName: string): Promise<void> {
    const branch = await this.getBranch(noteId, branchName);
    if (!branch) {
      throw new Error(`Branch ${branchName} not found`);
    }
    
    // 获取分支的当前版本
    const version = await this.getVersion(branch.currentVersionId);
    if (!version) {
      throw new Error('Branch version not found');
    }
    
    // 更新笔记内容
    const note = await Zotero.Items.getAsync(noteId);
    if (!note) {
      throw new Error('Note not found');
    }
    
    const content = this.blocksToHTML(version.blocks);
    note.setNote(content);
    await note.saveTx();
    
    this.currentBranch = branchName;
  }
  
  /**
   * 提交更改
   */
  async commit(
    noteId: number,
    message: string,
    tags: string[] = []
  ): Promise<NoteVersion> {
    const note = await Zotero.Items.getAsync(noteId);
    if (!note || !note.isNote()) {
      throw new Error('Invalid note');
    }
    
    // 获取当前分支
    const branch = await this.getBranch(noteId, this.currentBranch);
    if (!branch) {
      throw new Error('Current branch not found');
    }
    
    // 解析当前内容
    const content = note.getNote();
    const blocks = this.parseNoteContent(content);
    
    // 创建新版本
    const version: NoteVersion = {
      id: this.generateVersionId(),
      noteId,
      branchName: this.currentBranch,
      parentVersionId: branch.currentVersionId,
      blocks,
      timestamp: new Date(),
      author: Zotero.Users.getCurrentUsername() || 'Unknown',
      message,
      tags
    };
    
    await this.saveVersion(version);
    
    // 更新分支
    branch.currentVersionId = version.id;
    branch.updatedAt = new Date();
    await this.saveBranch(noteId, branch);
    
    return version;
  }
  
  /**
   * 合并分支
   */
  async mergeBranch(
    noteId: number,
    sourceBranch: string,
    targetBranch: string,
    strategy: 'merge' | 'rebase' | 'squash' = 'merge'
  ): Promise<{ success: boolean; conflicts?: MergeConflict[] }> {
    const source = await this.getBranch(noteId, sourceBranch);
    const target = await this.getBranch(noteId, targetBranch);
    
    if (!source || !target) {
      throw new Error('Branch not found');
    }
    
    const sourceVersion = await this.getVersion(source.currentVersionId);
    const targetVersion = await this.getVersion(target.currentVersionId);
    
    if (!sourceVersion || !targetVersion) {
      throw new Error('Version not found');
    }
    
    // 查找共同祖先
    const baseVersion = await this.findCommonAncestor(sourceVersion, targetVersion);
    
    // 执行三方合并
    const mergeResult = this.threeWayMerge(
      baseVersion?.blocks || [],
      targetVersion.blocks,
      sourceVersion.blocks
    );
    
    if (mergeResult.conflicts.length > 0) {
      return {
        success: false,
        conflicts: mergeResult.conflicts
      };
    }
    
    // 创建合并提交
    const mergeVersion: NoteVersion = {
      id: this.generateVersionId(),
      noteId,
      branchName: targetBranch,
      parentVersionId: targetVersion.id,
      blocks: mergeResult.merged,
      timestamp: new Date(),
      author: Zotero.Users.getCurrentUsername() || 'Unknown',
      message: `Merge ${sourceBranch} into ${targetBranch}`,
      tags: []
    };
    
    await this.saveVersion(mergeVersion);
    
    // 更新目标分支
    target.currentVersionId = mergeVersion.id;
    target.updatedAt = new Date();
    await this.saveBranch(noteId, target);
    
    return { success: true };
  }
  
  /**
   * 比较版本差异
   */
  async diff(versionId1: string, versionId2: string): Promise<{
    added: NoteBlock[];
    removed: NoteBlock[];
    modified: { old: NoteBlock; new: NoteBlock }[];
  }> {
    const version1 = await this.getVersion(versionId1);
    const version2 = await this.getVersion(versionId2);
    
    if (!version1 || !version2) {
      throw new Error('Version not found');
    }
    
    const blocks1Map = new Map(version1.blocks.map(b => [b.id, b]));
    const blocks2Map = new Map(version2.blocks.map(b => [b.id, b]));
    
    const added: NoteBlock[] = [];
    const removed: NoteBlock[] = [];
    const modified: { old: NoteBlock; new: NoteBlock }[] = [];
    
    // 查找已删除和修改的块
    for (const [id, block1] of blocks1Map) {
      const block2 = blocks2Map.get(id);
      if (!block2) {
        removed.push(block1);
      } else if (block1.metadata.hash !== block2.metadata.hash) {
        modified.push({ old: block1, new: block2 });
      }
    }
    
    // 查找新增的块
    for (const [id, block2] of blocks2Map) {
      if (!blocks1Map.has(id)) {
        added.push(block2);
      }
    }
    
    return { added, removed, modified };
  }
  
  /**
   * 获取版本历史
   */
  async getVersionHistory(
    noteId: number,
    branchName?: string
  ): Promise<NoteVersion[]> {
    let query = `
      SELECT * FROM research_navigator_note_versions
      WHERE note_id = ?
    `;
    const params: any[] = [noteId];
    
    if (branchName) {
      query += ` AND branch_name = ?`;
      params.push(branchName);
    }
    
    query += ` ORDER BY timestamp DESC`;
    
    const rows = await Zotero.DB.queryAsync(query, params);
    
    return rows.map(row => ({
      id: row.id,
      noteId: row.note_id,
      branchName: row.branch_name,
      parentVersionId: row.parent_version_id,
      blocks: JSON.parse(row.blocks),
      timestamp: new Date(row.timestamp),
      author: row.author,
      message: row.message,
      tags: row.tags ? JSON.parse(row.tags) : []
    }));
  }
  
  /**
   * 解析笔记内容为块
   */
  private parseNoteContent(html: string): NoteBlock[] {
    const blocks: NoteBlock[] = [];
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const elements = doc.body.children;
    
    let position = 0;
    for (const element of Array.from(elements)) {
      const block = this.elementToBlock(element, position++);
      if (block) {
        blocks.push(block);
      }
    }
    
    return blocks;
  }
  
  /**
   * 将元素转换为块
   */
  private elementToBlock(element: Element, position: number): NoteBlock | null {
    const tagName = element.tagName.toLowerCase();
    let type: NoteBlock['type'];
    
    switch (tagName) {
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6':
        type = 'heading';
        break;
      case 'ul':
      case 'ol':
        type = 'list';
        break;
      case 'blockquote':
        type = 'quote';
        break;
      case 'pre':
        type = 'code';
        break;
      case 'p':
      default:
        type = 'paragraph';
    }
    
    const content = element.innerHTML;
    const hash = this.hashContent(content);
    
    return {
      id: this.generateBlockId(),
      content,
      type,
      metadata: {
        position,
        hash
      }
    };
  }
  
  /**
   * 将块转换为 HTML
   */
  private blocksToHTML(blocks: NoteBlock[]): string {
    const sortedBlocks = [...blocks].sort((a, b) => 
      a.metadata.position - b.metadata.position
    );
    
    const html = sortedBlocks.map(block => {
      switch (block.type) {
        case 'heading':
          return `<h2>${block.content}</h2>`;
        case 'list':
          return block.content;
        case 'quote':
          return `<blockquote>${block.content}</blockquote>`;
        case 'code':
          return `<pre>${block.content}</pre>`;
        case 'paragraph':
        default:
          return `<p>${block.content}</p>`;
      }
    }).join('\n');
    
    return html;
  }
  
  /**
   * 三方合并算法
   */
  private threeWayMerge(
    base: NoteBlock[],
    current: NoteBlock[],
    incoming: NoteBlock[]
  ): { merged: NoteBlock[]; conflicts: MergeConflict[] } {
    const merged: NoteBlock[] = [];
    const conflicts: MergeConflict[] = [];
    
    const baseMap = new Map(base.map(b => [b.id, b]));
    const currentMap = new Map(current.map(b => [b.id, b]));
    const incomingMap = new Map(incoming.map(b => [b.id, b]));
    
    const allIds = new Set([
      ...baseMap.keys(),
      ...currentMap.keys(),
      ...incomingMap.keys()
    ]);
    
    for (const id of allIds) {
      const baseBlock = baseMap.get(id);
      const currentBlock = currentMap.get(id);
      const incomingBlock = incomingMap.get(id);
      
      if (!baseBlock) {
        // 新增的块
        if (currentBlock && incomingBlock) {
          // 两边都新增了相同 ID 的块
          if (currentBlock.metadata.hash === incomingBlock.metadata.hash) {
            merged.push(currentBlock);
          } else {
            conflicts.push({
              blockId: id,
              baseContent: '',
              currentContent: currentBlock.content,
              incomingContent: incomingBlock.content
            });
          }
        } else if (currentBlock) {
          merged.push(currentBlock);
        } else if (incomingBlock) {
          merged.push(incomingBlock);
        }
      } else {
        // 已存在的块
        if (!currentBlock && !incomingBlock) {
          // 两边都删除了
          continue;
        } else if (!currentBlock) {
          // 当前分支删除了
          if (incomingBlock.metadata.hash === baseBlock.metadata.hash) {
            // incoming 没有修改，接受删除
            continue;
          } else {
            // incoming 修改了，冲突
            conflicts.push({
              blockId: id,
              baseContent: baseBlock.content,
              currentContent: '',
              incomingContent: incomingBlock.content
            });
          }
        } else if (!incomingBlock) {
          // incoming 分支删除了
          if (currentBlock.metadata.hash === baseBlock.metadata.hash) {
            // current 没有修改，接受删除
            continue;
          } else {
            // current 修改了，冲突
            conflicts.push({
              blockId: id,
              baseContent: baseBlock.content,
              currentContent: currentBlock.content,
              incomingContent: ''
            });
          }
        } else {
          // 两边都存在
          if (currentBlock.metadata.hash === incomingBlock.metadata.hash) {
            // 相同的修改或都没修改
            merged.push(currentBlock);
          } else if (currentBlock.metadata.hash === baseBlock.metadata.hash) {
            // 只有 incoming 修改了
            merged.push(incomingBlock);
          } else if (incomingBlock.metadata.hash === baseBlock.metadata.hash) {
            // 只有 current 修改了
            merged.push(currentBlock);
          } else {
            // 两边都修改了，冲突
            conflicts.push({
              blockId: id,
              baseContent: baseBlock.content,
              currentContent: currentBlock.content,
              incomingContent: incomingBlock.content
            });
          }
        }
      }
    }
    
    return { merged, conflicts };
  }
  
  /**
   * 查找共同祖先
   */
  private async findCommonAncestor(
    version1: NoteVersion,
    version2: NoteVersion
  ): Promise<NoteVersion | null> {
    const ancestors1 = await this.getAncestors(version1);
    const ancestors2 = await this.getAncestors(version2);
    
    const ancestors2Set = new Set(ancestors2.map(v => v.id));
    
    for (const ancestor of ancestors1) {
      if (ancestors2Set.has(ancestor.id)) {
        return ancestor;
      }
    }
    
    return null;
  }
  
  /**
   * 获取版本的所有祖先
   */
  private async getAncestors(version: NoteVersion): Promise<NoteVersion[]> {
    const ancestors: NoteVersion[] = [];
    let current: NoteVersion | null = version;
    
    while (current && current.parentVersionId) {
      const parent = await this.getVersion(current.parentVersionId);
      if (parent) {
        ancestors.push(parent);
        current = parent;
      } else {
        break;
      }
    }
    
    return ancestors;
  }
  
  /**
   * 保存版本
   */
  private async saveVersion(version: NoteVersion): Promise<void> {
    await Zotero.DB.queryAsync(`
      INSERT OR REPLACE INTO research_navigator_note_versions
      (id, note_id, branch_name, parent_version_id, blocks, timestamp, author, message, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      version.id,
      version.noteId,
      version.branchName,
      version.parentVersionId,
      JSON.stringify(version.blocks),
      version.timestamp.getTime(),
      version.author,
      version.message,
      JSON.stringify(version.tags)
    ]);
    
    this.versions.set(version.id, version);
  }
  
  /**
   * 保存分支
   */
  private async saveBranch(noteId: number, branch: NoteBranch): Promise<void> {
    await Zotero.DB.queryAsync(`
      INSERT OR REPLACE INTO research_navigator_note_branches
      (name, note_id, current_version_id, created_at, updated_at, is_active, parent_branch)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      branch.name,
      noteId,
      branch.currentVersionId,
      branch.createdAt.getTime(),
      branch.updatedAt.getTime(),
      branch.isActive ? 1 : 0,
      branch.parentBranch
    ]);
    
    this.branches.set(`${noteId}-${branch.name}`, branch);
  }
  
  /**
   * 获取版本
   */
  private async getVersion(versionId: string): Promise<NoteVersion | null> {
    if (this.versions.has(versionId)) {
      return this.versions.get(versionId)!;
    }
    
    const rows = await Zotero.DB.queryAsync(`
      SELECT * FROM research_navigator_note_versions WHERE id = ?
    `, [versionId]);
    
    if (rows.length === 0) {
      return null;
    }
    
    const row = rows[0];
    const version: NoteVersion = {
      id: row.id,
      noteId: row.note_id,
      branchName: row.branch_name,
      parentVersionId: row.parent_version_id,
      blocks: JSON.parse(row.blocks),
      timestamp: new Date(row.timestamp),
      author: row.author,
      message: row.message,
      tags: row.tags ? JSON.parse(row.tags) : []
    };
    
    this.versions.set(versionId, version);
    return version;
  }
  
  /**
   * 获取分支
   */
  private async getBranch(noteId: number, branchName: string): Promise<NoteBranch | null> {
    const key = `${noteId}-${branchName}`;
    if (this.branches.has(key)) {
      return this.branches.get(key)!;
    }
    
    const rows = await Zotero.DB.queryAsync(`
      SELECT * FROM research_navigator_note_branches
      WHERE note_id = ? AND name = ?
    `, [noteId, branchName]);
    
    if (rows.length === 0) {
      return null;
    }
    
    const row = rows[0];
    const branch: NoteBranch = {
      name: row.name,
      currentVersionId: row.current_version_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      isActive: row.is_active === 1,
      parentBranch: row.parent_branch
    };
    
    this.branches.set(key, branch);
    return branch;
  }
  
  /**
   * 生成版本 ID
   */
  private generateVersionId(): string {
    return `v-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * 生成块 ID
   */
  private generateBlockId(): string {
    return `b-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * 计算内容哈希
   */
  private hashContent(content: string): string {
    // 简单的哈希实现
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }
  
  /**
   * 获取所有分支
   */
  async getAllBranches(noteId: number): Promise<NoteBranch[]> {
    const rows = await Zotero.DB.queryAsync(`
      SELECT * FROM research_navigator_note_branches
      WHERE note_id = ?
      ORDER BY updated_at DESC
    `, [noteId]);
    
    return rows.map(row => ({
      name: row.name,
      currentVersionId: row.current_version_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      isActive: row.is_active === 1,
      parentBranch: row.parent_branch
    }));
  }
  
  /**
   * 删除分支
   */
  async deleteBranch(noteId: number, branchName: string): Promise<void> {
    if (branchName === 'main') {
      throw new Error('Cannot delete main branch');
    }
    
    await Zotero.DB.queryAsync(`
      DELETE FROM research_navigator_note_branches
      WHERE note_id = ? AND name = ?
    `, [noteId, branchName]);
    
    const key = `${noteId}-${branchName}`;
    this.branches.delete(key);
  }
}