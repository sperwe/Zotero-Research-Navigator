import { HistoryService } from '../services/history-service';
import { NoteAssociationSystem } from './note-association-system';

export interface Suggestion {
  id: string;
  type: 'related-item' | 'similar-note' | 'tag' | 'collection' | 'citation';
  score: number;
  reason: string;
  data: any;
  timestamp: Date;
}

export interface SuggestionContext {
  currentItemId?: number;
  currentNoteId?: number;
  recentItems?: number[];
  searchQuery?: string;
  tags?: string[];
}

export class SmartSuggestionSystem {
  private suggestionCache = new Map<string, Suggestion[]>();
  private userFeedback = new Map<string, number>(); // suggestion ID -> score
  
  constructor(
    private window: Window,
    private historyService: HistoryService,
    private noteAssociationSystem: NoteAssociationSystem
  ) {
    this.loadUserFeedback();
  }
  
  /**
   * 获取智能建议
   */
  async getSuggestions(context: SuggestionContext): Promise<Suggestion[]> {
    const cacheKey = this.getCacheKey(context);
    
    // 检查缓存
    if (this.suggestionCache.has(cacheKey)) {
      const cached = this.suggestionCache.get(cacheKey)!;
      if (this.isCacheValid(cached)) {
        return cached;
      }
    }
    
    // 生成新建议
    const suggestions: Suggestion[] = [];
    
    // 并行执行所有建议生成器
    const generators = [
      this.getRelatedItemSuggestions(context),
      this.getSimilarNoteSuggestions(context),
      this.getTagSuggestions(context),
      this.getCollectionSuggestions(context),
      this.getCitationSuggestions(context)
    ];
    
    const results = await Promise.all(generators);
    for (const result of results) {
      suggestions.push(...result);
    }
    
    // 根据用户反馈调整分数
    this.adjustScoresBasedOnFeedback(suggestions);
    
    // 排序并限制数量
    const sorted = suggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);
    
    // 缓存结果
    this.suggestionCache.set(cacheKey, sorted);
    
    return sorted;
  }
  
  /**
   * 获取相关条目建议
   */
  private async getRelatedItemSuggestions(context: SuggestionContext): Promise<Suggestion[]> {
    const suggestions: Suggestion[] = [];
    
    if (!context.currentItemId) return suggestions;
    
    try {
      const currentItem = await Zotero.Items.getAsync(context.currentItemId);
      if (!currentItem) return suggestions;
      
      // 获取相同作者的其他作品
      const creators = currentItem.getCreators();
      if (creators.length > 0) {
        const firstAuthor = creators[0];
        const search = new Zotero.Search();
        search.libraryID = currentItem.libraryID;
        search.addCondition('creator', 'contains', `${firstAuthor.firstName} ${firstAuthor.lastName}`);
        search.addCondition('itemID', 'isNot', currentItem.id.toString());
        
        const itemIds = await search.search();
        const items = await Zotero.Items.getAsync(itemIds.slice(0, 5));
        
        for (const item of items) {
          if (!item) continue;
          
          suggestions.push({
            id: `related-author-${item.id}`,
            type: 'related-item',
            score: 0.8,
            reason: `Other work by ${firstAuthor.firstName} ${firstAuthor.lastName}`,
            data: {
              itemId: item.id,
              title: item.getField('title'),
              itemType: item.itemType,
              creators: item.getCreators()
            },
            timestamp: new Date()
          });
        }
      }
      
      // 获取相同标签的条目
      const tags = currentItem.getTags();
      if (tags.length > 0) {
        const tagSearch = new Zotero.Search();
        tagSearch.libraryID = currentItem.libraryID;
        
        for (const tag of tags.slice(0, 3)) {
          tagSearch.addCondition('tag', 'is', tag.tag);
        }
        tagSearch.addCondition('itemID', 'isNot', currentItem.id.toString());
        
        const tagItemIds = await tagSearch.search();
        const tagItems = await Zotero.Items.getAsync(tagItemIds.slice(0, 5));
        
        for (const item of tagItems) {
          if (!item) continue;
          
          suggestions.push({
            id: `related-tag-${item.id}`,
            type: 'related-item',
            score: 0.7,
            reason: `Shares tags: ${tags.map(t => t.tag).join(', ')}`,
            data: {
              itemId: item.id,
              title: item.getField('title'),
              itemType: item.itemType,
              sharedTags: tags.map(t => t.tag)
            },
            timestamp: new Date()
          });
        }
      }
      
    } catch (error) {
      Zotero.logError(`[SmartSuggestions] Error getting related items: ${error}`);
    }
    
    return suggestions;
  }
  
  /**
   * 获取相似笔记建议
   */
  private async getSimilarNoteSuggestions(context: SuggestionContext): Promise<Suggestion[]> {
    const suggestions: Suggestion[] = [];
    
    if (!context.currentNoteId) return suggestions;
    
    try {
      const currentNote = await Zotero.Items.getAsync(context.currentNoteId);
      if (!currentNote || !currentNote.isNote()) return suggestions;
      
      const noteContent = currentNote.getNote();
      const keywords = this.extractKeywords(noteContent);
      
      if (keywords.length === 0) return suggestions;
      
      // 搜索包含相似关键词的笔记
      const search = new Zotero.Search();
      search.libraryID = currentNote.libraryID;
      search.addCondition('itemType', 'is', 'note');
      
      for (const keyword of keywords.slice(0, 3)) {
        search.addCondition('note', 'contains', keyword);
      }
      search.addCondition('itemID', 'isNot', currentNote.id.toString());
      
      const noteIds = await search.search();
      const notes = await Zotero.Items.getAsync(noteIds.slice(0, 5));
      
      for (const note of notes) {
        if (!note) continue;
        
        const similarity = this.calculateTextSimilarity(noteContent, note.getNote());
        
        suggestions.push({
          id: `similar-note-${note.id}`,
          type: 'similar-note',
          score: similarity,
          reason: `Similar content (${Math.round(similarity * 100)}% match)`,
          data: {
            noteId: note.id,
            title: note.getNoteTitle(),
            parentId: note.parentID,
            keywords: keywords
          },
          timestamp: new Date()
        });
      }
      
    } catch (error) {
      Zotero.logError(`[SmartSuggestions] Error getting similar notes: ${error}`);
    }
    
    return suggestions;
  }
  
  /**
   * 获取标签建议
   */
  private async getTagSuggestions(context: SuggestionContext): Promise<Suggestion[]> {
    const suggestions: Suggestion[] = [];
    
    if (!context.currentItemId) return suggestions;
    
    try {
      const currentItem = await Zotero.Items.getAsync(context.currentItemId);
      if (!currentItem) return suggestions;
      
      const existingTags = new Set(currentItem.getTags().map(t => t.tag));
      
      // 获取相关条目的标签
      const relatedItems = await this.getRelatedItems(currentItem);
      const tagFrequency = new Map<string, number>();
      
      for (const item of relatedItems) {
        const tags = item.getTags();
        for (const tag of tags) {
          if (!existingTags.has(tag.tag)) {
            tagFrequency.set(tag.tag, (tagFrequency.get(tag.tag) || 0) + 1);
          }
        }
      }
      
      // 转换为建议
      const sortedTags = Array.from(tagFrequency.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      
      for (const [tag, frequency] of sortedTags) {
        suggestions.push({
          id: `tag-${tag}`,
          type: 'tag',
          score: frequency / relatedItems.length,
          reason: `Used by ${frequency} related items`,
          data: {
            tag,
            frequency
          },
          timestamp: new Date()
        });
      }
      
    } catch (error) {
      Zotero.logError(`[SmartSuggestions] Error getting tag suggestions: ${error}`);
    }
    
    return suggestions;
  }
  
  /**
   * 获取分类建议
   */
  private async getCollectionSuggestions(context: SuggestionContext): Promise<Suggestion[]> {
    const suggestions: Suggestion[] = [];
    
    if (!context.currentItemId) return suggestions;
    
    try {
      const currentItem = await Zotero.Items.getAsync(context.currentItemId);
      if (!currentItem) return suggestions;
      
      const itemCollections = currentItem.getCollections();
      const allCollections = Zotero.Collections.getByLibrary(currentItem.libraryID);
      
      // 分析相似条目所在的分类
      const relatedItems = await this.getRelatedItems(currentItem);
      const collectionFrequency = new Map<number, number>();
      
      for (const item of relatedItems) {
        const collections = item.getCollections();
        for (const collectionId of collections) {
          if (!itemCollections.includes(collectionId)) {
            collectionFrequency.set(collectionId, (collectionFrequency.get(collectionId) || 0) + 1);
          }
        }
      }
      
      // 转换为建议
      const sortedCollections = Array.from(collectionFrequency.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);
      
      for (const [collectionId, frequency] of sortedCollections) {
        const collection = await Zotero.Collections.getAsync(collectionId);
        if (!collection) continue;
        
        suggestions.push({
          id: `collection-${collectionId}`,
          type: 'collection',
          score: frequency / relatedItems.length * 0.6,
          reason: `${frequency} related items in this collection`,
          data: {
            collectionId,
            name: collection.name,
            frequency
          },
          timestamp: new Date()
        });
      }
      
    } catch (error) {
      Zotero.logError(`[SmartSuggestions] Error getting collection suggestions: ${error}`);
    }
    
    return suggestions;
  }
  
  /**
   * 获取引用建议
   */
  private async getCitationSuggestions(context: SuggestionContext): Promise<Suggestion[]> {
    const suggestions: Suggestion[] = [];
    
    if (!context.currentItemId) return suggestions;
    
    try {
      const currentItem = await Zotero.Items.getAsync(context.currentItemId);
      if (!currentItem) return suggestions;
      
      // 获取被引用和引用的文献
      const relatedItems = currentItem.relatedItems;
      
      for (const relatedId of relatedItems) {
        const relatedItem = await Zotero.Items.getByLibraryAndKey(currentItem.libraryID, relatedId);
        if (!relatedItem) continue;
        
        suggestions.push({
          id: `citation-${relatedItem.id}`,
          type: 'citation',
          score: 0.9,
          reason: 'Cited or referenced',
          data: {
            itemId: relatedItem.id,
            title: relatedItem.getField('title'),
            itemType: relatedItem.itemType,
            relation: 'related'
          },
          timestamp: new Date()
        });
      }
      
    } catch (error) {
      Zotero.logError(`[SmartSuggestions] Error getting citation suggestions: ${error}`);
    }
    
    return suggestions;
  }
  
  /**
   * 提取关键词
   */
  private extractKeywords(text: string): string[] {
    // 移除 HTML 标签
    const plainText = text.replace(/<[^>]*>/g, ' ');
    
    // 分词（简单实现）
    const words = plainText
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3);
    
    // 计算词频
    const frequency = new Map<string, number>();
    for (const word of words) {
      frequency.set(word, (frequency.get(word) || 0) + 1);
    }
    
    // 排序并返回高频词
    return Array.from(frequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  }
  
  /**
   * 计算文本相似度
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = new Set(this.extractKeywords(text1));
    const words2 = new Set(this.extractKeywords(text2));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }
  
  /**
   * 获取相关条目
   */
  private async getRelatedItems(item: any): Promise<any[]> {
    const related: any[] = [];
    
    // 获取同一作者的其他作品
    const creators = item.getCreators();
    if (creators.length > 0) {
      const search = new Zotero.Search();
      search.libraryID = item.libraryID;
      search.addCondition('creator', 'contains', `${creators[0].firstName} ${creators[0].lastName}`);
      search.addCondition('itemID', 'isNot', item.id.toString());
      
      const itemIds = await search.search();
      const items = await Zotero.Items.getAsync(itemIds.slice(0, 10));
      related.push(...items.filter(i => i));
    }
    
    return related;
  }
  
  /**
   * 根据用户反馈调整分数
   */
  private adjustScoresBasedOnFeedback(suggestions: Suggestion[]): void {
    for (const suggestion of suggestions) {
      const feedback = this.userFeedback.get(suggestion.id);
      if (feedback !== undefined) {
        // 正反馈增加分数，负反馈降低分数
        suggestion.score *= (1 + feedback * 0.2);
        suggestion.score = Math.max(0, Math.min(1, suggestion.score));
      }
    }
  }
  
  /**
   * 记录用户反馈
   */
  recordFeedback(suggestionId: string, positive: boolean): void {
    const currentScore = this.userFeedback.get(suggestionId) || 0;
    const newScore = positive ? currentScore + 1 : currentScore - 1;
    this.userFeedback.set(suggestionId, newScore);
    
    this.saveUserFeedback();
  }
  
  /**
   * 获取缓存键
   */
  private getCacheKey(context: SuggestionContext): string {
    return JSON.stringify({
      itemId: context.currentItemId,
      noteId: context.currentNoteId,
      query: context.searchQuery
    });
  }
  
  /**
   * 检查缓存是否有效
   */
  private isCacheValid(suggestions: Suggestion[]): boolean {
    if (suggestions.length === 0) return false;
    
    const oldestSuggestion = suggestions[0];
    const age = Date.now() - oldestSuggestion.timestamp.getTime();
    
    // 缓存 5 分钟
    return age < 5 * 60 * 1000;
  }
  
  /**
   * 保存用户反馈
   */
  private saveUserFeedback(): void {
    const data = Object.fromEntries(this.userFeedback);
    Zotero.Prefs.set('researchnavigator.suggestionFeedback', JSON.stringify(data));
  }
  
  /**
   * 加载用户反馈
   */
  private loadUserFeedback(): void {
    try {
      const saved = Zotero.Prefs.get('researchnavigator.suggestionFeedback');
      if (saved) {
        const data = JSON.parse(saved);
        this.userFeedback = new Map(Object.entries(data));
      }
    } catch (error) {
      Zotero.logError(`[SmartSuggestions] Error loading feedback: ${error}`);
    }
  }
  
  /**
   * 清除缓存
   */
  clearCache(): void {
    this.suggestionCache.clear();
  }
}