import { HistoryNode } from '../../services/database-service';
import { HistoryService } from '../../services/history-service';
import { NoteAssociationSystem } from '../../managers/note-association-system';

export interface SearchOptions {
  query: string;
  searchIn: ('title' | 'content' | 'notes' | 'tags')[];
  dateRange?: { start: Date; end: Date };
  itemTypes?: string[];
  collections?: number[];
  sortBy: 'relevance' | 'date' | 'title';
  limit?: number;
}

export interface SearchResult {
  node?: HistoryNode;
  item?: any;
  note?: any;
  relevanceScore: number;
  highlights: { field: string; snippet: string }[];
}

export class AdvancedSearch {
  private searchHistory: SearchOptions[] = [];
  private maxHistorySize = 50;
  
  constructor(
    private window: Window,
    private historyService: HistoryService,
    private noteAssociationSystem: NoteAssociationSystem
  ) {
    this.loadSearchHistory();
  }
  
  /**
   * 执行高级搜索
   */
  async search(options: SearchOptions): Promise<SearchResult[]> {
    // 保存搜索历史
    this.addToHistory(options);
    
    const results: SearchResult[] = [];
    const query = options.query.toLowerCase();
    
    // 搜索历史节点
    if (options.searchIn.includes('title')) {
      const nodes = await this.searchHistoryNodes(query, options);
      results.push(...nodes);
    }
    
    // 搜索笔记内容
    if (options.searchIn.includes('content') || options.searchIn.includes('notes')) {
      const notes = await this.searchNotes(query, options);
      results.push(...notes);
    }
    
    // 搜索标签
    if (options.searchIn.includes('tags')) {
      const taggedItems = await this.searchTags(query, options);
      results.push(...taggedItems);
    }
    
    // 排序结果
    return this.sortResults(results, options.sortBy);
  }
  
  /**
   * 搜索历史节点
   */
  private async searchHistoryNodes(query: string, options: SearchOptions): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const sessions = this.historyService.getAllSessions();
    
    for (const { session, nodes } of sessions) {
      for (const node of nodes) {
        // 检查日期范围
        if (options.dateRange) {
          const nodeDate = new Date(node.timestamp);
          if (nodeDate < options.dateRange.start || nodeDate > options.dateRange.end) {
            continue;
          }
        }
        
        // 搜索标题
        const titleMatch = node.title?.toLowerCase().includes(query);
        if (titleMatch) {
          const highlights = this.extractHighlights(node.title || '', query, 'title');
          results.push({
            node,
            relevanceScore: this.calculateRelevance(query, node.title || ''),
            highlights
          });
        }
      }
    }
    
    return results;
  }
  
  /**
   * 搜索笔记
   */
  private async searchNotes(query: string, options: SearchOptions): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    
    try {
      // 使用 Zotero 的搜索 API
      const s = new Zotero.Search();
      s.libraryID = Zotero.Libraries.userLibraryID;
      s.addCondition('itemType', 'is', 'note');
      s.addCondition('note', 'contains', query);
      
      const noteIds = await s.search();
      
      for (const noteId of noteIds) {
        const note = await Zotero.Items.getAsync(noteId);
        if (!note) continue;
        
        const content = note.getNote();
        const plainText = this.stripHTML(content);
        const highlights = this.extractHighlights(plainText, query, 'content');
        
        results.push({
          note,
          relevanceScore: this.calculateRelevance(query, plainText),
          highlights
        });
      }
    } catch (error) {
      Zotero.logError(`[AdvancedSearch] Error searching notes: ${error}`);
    }
    
    return results;
  }
  
  /**
   * 搜索标签
   */
  private async searchTags(query: string, options: SearchOptions): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    
    try {
      const s = new Zotero.Search();
      s.libraryID = Zotero.Libraries.userLibraryID;
      s.addCondition('tag', 'contains', query);
      
      const itemIds = await s.search();
      
      for (const itemId of itemIds) {
        const item = await Zotero.Items.getAsync(itemId);
        if (!item) continue;
        
        const tags = item.getTags().map(t => t.tag).join(', ');
        const highlights = this.extractHighlights(tags, query, 'tags');
        
        results.push({
          item,
          relevanceScore: this.calculateRelevance(query, tags),
          highlights
        });
      }
    } catch (error) {
      Zotero.logError(`[AdvancedSearch] Error searching tags: ${error}`);
    }
    
    return results;
  }
  
  /**
   * 计算相关性分数
   */
  private calculateRelevance(query: string, text: string): number {
    const lowerText = text.toLowerCase();
    const queryWords = query.split(/\s+/);
    let score = 0;
    
    // 完全匹配
    if (lowerText.includes(query)) {
      score += 10;
    }
    
    // 词匹配
    for (const word of queryWords) {
      if (lowerText.includes(word)) {
        score += 5;
      }
    }
    
    // 开头匹配
    if (lowerText.startsWith(query)) {
      score += 5;
    }
    
    return score;
  }
  
  /**
   * 提取高亮片段
   */
  private extractHighlights(text: string, query: string, field: string): { field: string; snippet: string }[] {
    const highlights: { field: string; snippet: string }[] = [];
    const lowerText = text.toLowerCase();
    const index = lowerText.indexOf(query);
    
    if (index !== -1) {
      const start = Math.max(0, index - 50);
      const end = Math.min(text.length, index + query.length + 50);
      const snippet = text.substring(start, end);
      
      highlights.push({
        field,
        snippet: (start > 0 ? '...' : '') + snippet + (end < text.length ? '...' : '')
      });
    }
    
    return highlights;
  }
  
  /**
   * 排序结果
   */
  private sortResults(results: SearchResult[], sortBy: 'relevance' | 'date' | 'title'): SearchResult[] {
    switch (sortBy) {
      case 'relevance':
        return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
      
      case 'date':
        return results.sort((a, b) => {
          const dateA = this.getResultDate(a);
          const dateB = this.getResultDate(b);
          return dateB.getTime() - dateA.getTime();
        });
      
      case 'title':
        return results.sort((a, b) => {
          const titleA = this.getResultTitle(a).toLowerCase();
          const titleB = this.getResultTitle(b).toLowerCase();
          return titleA.localeCompare(titleB);
        });
      
      default:
        return results;
    }
  }
  
  /**
   * 获取结果日期
   */
  private getResultDate(result: SearchResult): Date {
    if (result.node) {
      return new Date(result.node.timestamp);
    }
    if (result.note) {
      return new Date(result.note.dateModified);
    }
    if (result.item) {
      return new Date(result.item.dateModified);
    }
    return new Date();
  }
  
  /**
   * 获取结果标题
   */
  private getResultTitle(result: SearchResult): string {
    if (result.node) {
      return result.node.title || '';
    }
    if (result.note) {
      return result.note.getNoteTitle() || '';
    }
    if (result.item) {
      return result.item.getField('title') || '';
    }
    return '';
  }
  
  /**
   * 去除 HTML 标签
   */
  private stripHTML(html: string): string {
    const tmp = this.window.document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }
  
  /**
   * 添加到搜索历史
   */
  private addToHistory(options: SearchOptions): void {
    // 移除重复项
    this.searchHistory = this.searchHistory.filter(
      h => JSON.stringify(h) !== JSON.stringify(options)
    );
    
    // 添加到开头
    this.searchHistory.unshift(options);
    
    // 限制大小
    if (this.searchHistory.length > this.maxHistorySize) {
      this.searchHistory = this.searchHistory.slice(0, this.maxHistorySize);
    }
    
    // 保存到存储
    this.saveSearchHistory();
  }
  
  /**
   * 获取搜索历史
   */
  getSearchHistory(): SearchOptions[] {
    return this.searchHistory;
  }
  
  /**
   * 清除搜索历史
   */
  clearSearchHistory(): void {
    this.searchHistory = [];
    this.saveSearchHistory();
  }
  
  /**
   * 保存搜索历史
   */
  private saveSearchHistory(): void {
    Zotero.Prefs.set('researchnavigator.searchHistory', JSON.stringify(this.searchHistory));
  }
  
  /**
   * 加载搜索历史
   */
  private loadSearchHistory(): void {
    try {
      const saved = Zotero.Prefs.get('researchnavigator.searchHistory');
      if (saved) {
        this.searchHistory = JSON.parse(saved);
      }
    } catch (error) {
      Zotero.logError(`[AdvancedSearch] Error loading search history: ${error}`);
    }
  }
}