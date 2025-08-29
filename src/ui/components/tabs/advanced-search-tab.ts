import { AdvancedSearch, SearchOptions, SearchResult } from '../advanced-search';
import { HistoryService } from '../../../services/history-service';
import { NoteAssociationSystem } from '../../../managers/note-association-system';

export class AdvancedSearchTab {
  private container: HTMLElement | null = null;
  private advancedSearch: AdvancedSearch;
  private currentResults: SearchResult[] = [];
  
  constructor(
    private window: Window,
    private historyService: HistoryService,
    private noteAssociationSystem: NoteAssociationSystem
  ) {
    this.advancedSearch = new AdvancedSearch(window, historyService, noteAssociationSystem);
  }
  
  create(container: HTMLElement): void {
    this.container = container;
    const doc = this.window.document;
    
    container.style.cssText = `
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    `;
    
    // 搜索表单
    const searchForm = this.createSearchForm(doc);
    container.appendChild(searchForm);
    
    // 结果区域
    const resultsArea = doc.createElement('div');
    resultsArea.className = 'advanced-search-results';
    resultsArea.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 10px;
    `;
    container.appendChild(resultsArea);
    
    // 加载搜索历史
    this.loadSearchHistory();
  }
  
  private createSearchForm(doc: Document): HTMLElement {
    const form = doc.createElement('div');
    form.className = 'advanced-search-form';
    form.style.cssText = `
      padding: 15px;
      border-bottom: 1px solid var(--material-border-quarternary);
      background: var(--material-sidepane);
    `;
    
    // 搜索输入框
    const searchRow = doc.createElement('div');
    searchRow.style.cssText = `
      display: flex;
      gap: 10px;
      margin-bottom: 10px;
    `;
    
    const searchInput = doc.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Enter search query...';
    searchInput.style.cssText = `
      flex: 1;
      padding: 8px;
      border: 1px solid var(--material-border-quarternary);
      border-radius: 4px;
      font-size: 14px;
    `;
    
    const searchButton = doc.createElement('button');
    searchButton.textContent = '🔍 Search';
    searchButton.style.cssText = `
      padding: 8px 16px;
      background: var(--accent-blue);
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    `;
    
    searchRow.appendChild(searchInput);
    searchRow.appendChild(searchButton);
    form.appendChild(searchRow);
    
    // 高级选项
    const optionsRow = doc.createElement('div');
    optionsRow.style.cssText = `
      display: flex;
      gap: 15px;
      flex-wrap: wrap;
      margin-bottom: 10px;
    `;
    
    // 搜索范围
    const searchInGroup = doc.createElement('div');
    searchInGroup.innerHTML = `
      <label style="display: block; margin-bottom: 5px; font-size: 12px; color: var(--fill-secondary);">Search in:</label>
      <div style="display: flex; gap: 10px;">
        <label><input type="checkbox" value="title" checked> Title</label>
        <label><input type="checkbox" value="content" checked> Content</label>
        <label><input type="checkbox" value="notes" checked> Notes</label>
        <label><input type="checkbox" value="tags"> Tags</label>
      </div>
    `;
    optionsRow.appendChild(searchInGroup);
    
    // 排序选项
    const sortGroup = doc.createElement('div');
    sortGroup.innerHTML = `
      <label style="display: block; margin-bottom: 5px; font-size: 12px; color: var(--fill-secondary);">Sort by:</label>
      <select style="padding: 4px; border: 1px solid var(--material-border-quarternary); border-radius: 3px;">
        <option value="relevance">Relevance</option>
        <option value="date">Date</option>
        <option value="title">Title</option>
      </select>
    `;
    optionsRow.appendChild(sortGroup);
    
    form.appendChild(optionsRow);
    
    // 日期范围
    const dateRow = doc.createElement('div');
    dateRow.style.cssText = `
      display: flex;
      gap: 10px;
      align-items: center;
      margin-bottom: 10px;
    `;
    
    dateRow.innerHTML = `
      <label style="font-size: 12px; color: var(--fill-secondary);">Date range:</label>
      <input type="date" id="date-start" style="padding: 4px; border: 1px solid var(--material-border-quarternary); border-radius: 3px;">
      <span>to</span>
      <input type="date" id="date-end" style="padding: 4px; border: 1px solid var(--material-border-quarternary); border-radius: 3px;">
    `;
    form.appendChild(dateRow);
    
    // 搜索历史
    const historyRow = doc.createElement('div');
    historyRow.style.cssText = `
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid var(--material-border-quarternary);
    `;
    
    const historyLabel = doc.createElement('div');
    historyLabel.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 5px;
    `;
    historyLabel.innerHTML = `
      <span style="font-size: 12px; color: var(--fill-secondary);">Recent searches:</span>
      <button id="clear-history" style="font-size: 11px; padding: 2px 8px; border: 1px solid var(--material-border-quarternary); background: white; border-radius: 3px; cursor: pointer;">Clear</button>
    `;
    historyRow.appendChild(historyLabel);
    
    const historyList = doc.createElement('div');
    historyList.id = 'search-history-list';
    historyList.style.cssText = `
      max-height: 100px;
      overflow-y: auto;
    `;
    historyRow.appendChild(historyList);
    
    form.appendChild(historyRow);
    
    // 绑定事件
    searchButton.addEventListener('click', () => this.performSearch());
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.performSearch();
      }
    });
    
    const clearHistoryBtn = form.querySelector('#clear-history');
    clearHistoryBtn?.addEventListener('click', () => {
      this.advancedSearch.clearSearchHistory();
      this.loadSearchHistory();
    });
    
    return form;
  }
  
  private async performSearch(): Promise<void> {
    const form = this.container?.querySelector('.advanced-search-form');
    if (!form) return;
    
    const searchInput = form.querySelector('input[type="text"]') as HTMLInputElement;
    const query = searchInput.value.trim();
    if (!query) return;
    
    // 收集搜索选项
    const searchInCheckboxes = form.querySelectorAll('input[type="checkbox"]:checked');
    const searchIn = Array.from(searchInCheckboxes).map(cb => (cb as HTMLInputElement).value) as any[];
    
    const sortSelect = form.querySelector('select') as HTMLSelectElement;
    const sortBy = sortSelect.value as any;
    
    const dateStart = (form.querySelector('#date-start') as HTMLInputElement).value;
    const dateEnd = (form.querySelector('#date-end') as HTMLInputElement).value;
    
    const options: SearchOptions = {
      query,
      searchIn,
      sortBy,
      dateRange: dateStart && dateEnd ? {
        start: new Date(dateStart),
        end: new Date(dateEnd)
      } : undefined
    };
    
    // 显示加载状态
    this.showLoading();
    
    try {
      // 执行搜索
      this.currentResults = await this.advancedSearch.search(options);
      
      // 显示结果
      this.displayResults();
      
      // 更新搜索历史
      this.loadSearchHistory();
    } catch (error) {
      Zotero.logError(`[AdvancedSearchTab] Search error: ${error}`);
      this.showError('Search failed. Please check the console for details.');
    }
  }
  
  private displayResults(): void {
    const resultsArea = this.container?.querySelector('.advanced-search-results');
    if (!resultsArea) return;
    
    const doc = this.window.document;
    resultsArea.innerHTML = '';
    
    if (this.currentResults.length === 0) {
      const empty = doc.createElement('div');
      empty.style.cssText = `
        text-align: center;
        padding: 40px;
        color: var(--fill-secondary);
      `;
      empty.textContent = 'No results found';
      resultsArea.appendChild(empty);
      return;
    }
    
    // 结果统计
    const stats = doc.createElement('div');
    stats.style.cssText = `
      padding: 10px;
      background: var(--material-button);
      border-radius: 4px;
      margin-bottom: 10px;
      font-size: 13px;
    `;
    stats.textContent = `Found ${this.currentResults.length} results`;
    resultsArea.appendChild(stats);
    
    // 显示每个结果
    for (const result of this.currentResults) {
      const resultItem = this.createResultItem(doc, result);
      resultsArea.appendChild(resultItem);
    }
  }
  
  private createResultItem(doc: Document, result: SearchResult): HTMLElement {
    const item = doc.createElement('div');
    item.style.cssText = `
      padding: 12px;
      margin-bottom: 8px;
      border: 1px solid var(--material-border-quarternary);
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s;
    `;
    
    item.addEventListener('mouseenter', () => {
      item.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
    });
    
    item.addEventListener('mouseleave', () => {
      item.style.boxShadow = '';
    });
    
    // 标题
    const title = doc.createElement('div');
    title.style.cssText = `
      font-weight: bold;
      margin-bottom: 5px;
    `;
    
    if (result.node) {
      title.textContent = result.node.title || 'Untitled';
      item.addEventListener('click', () => {
        // 打开历史节点
        const ZoteroPane = Zotero.getActiveZoteroPane();
        if (ZoteroPane && result.node) {
          ZoteroPane.selectItem(result.node.itemId);
        }
      });
    } else if (result.note) {
      title.textContent = result.note.getNoteTitle() || 'Untitled Note';
      item.addEventListener('click', () => {
        // 打开笔记
        Zotero.openNoteWindow(result.note.id);
      });
    } else if (result.item) {
      title.textContent = result.item.getField('title') || 'Untitled';
      item.addEventListener('click', () => {
        // 打开项目
        const ZoteroPane = Zotero.getActiveZoteroPane();
        if (ZoteroPane) {
          ZoteroPane.selectItem(result.item.id);
        }
      });
    }
    
    item.appendChild(title);
    
    // 高亮片段
    if (result.highlights.length > 0) {
      const highlights = doc.createElement('div');
      highlights.style.cssText = `
        font-size: 12px;
        color: var(--fill-secondary);
        margin-top: 5px;
      `;
      
      for (const highlight of result.highlights) {
        const snippet = doc.createElement('div');
        snippet.style.cssText = `
          margin-bottom: 3px;
          padding: 3px 5px;
          background: var(--material-button);
          border-radius: 3px;
        `;
        snippet.innerHTML = this.highlightText(highlight.snippet, this.getCurrentQuery());
        highlights.appendChild(snippet);
      }
      
      item.appendChild(highlights);
    }
    
    // 相关性分数
    const score = doc.createElement('div');
    score.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      font-size: 11px;
      color: var(--fill-tertiary);
    `;
    score.textContent = `Score: ${result.relevanceScore}`;
    item.style.position = 'relative';
    item.appendChild(score);
    
    return item;
  }
  
  private highlightText(text: string, query: string): string {
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    return text.replace(regex, '<mark style="background: yellow; padding: 0 2px;">$1</mark>');
  }
  
  private getCurrentQuery(): string {
    const searchInput = this.container?.querySelector('input[type="text"]') as HTMLInputElement;
    return searchInput?.value || '';
  }
  
  private loadSearchHistory(): void {
    const historyList = this.container?.querySelector('#search-history-list');
    if (!historyList) return;
    
    const doc = this.window.document;
    historyList.innerHTML = '';
    
    const history = this.advancedSearch.getSearchHistory();
    
    for (const search of history.slice(0, 10)) {
      const item = doc.createElement('div');
      item.style.cssText = `
        padding: 5px;
        margin-bottom: 3px;
        background: var(--material-button);
        border-radius: 3px;
        cursor: pointer;
        font-size: 12px;
      `;
      item.textContent = search.query;
      item.title = `Search in: ${search.searchIn.join(', ')}, Sort by: ${search.sortBy}`;
      
      item.addEventListener('click', () => {
        // 恢复搜索
        const searchInput = this.container?.querySelector('input[type="text"]') as HTMLInputElement;
        if (searchInput) {
          searchInput.value = search.query;
        }
        
        // 恢复选项
        const checkboxes = this.container?.querySelectorAll('input[type="checkbox"]') as NodeListOf<HTMLInputElement>;
        checkboxes.forEach(cb => {
          cb.checked = search.searchIn.includes(cb.value as any);
        });
        
        const sortSelect = this.container?.querySelector('select') as HTMLSelectElement;
        if (sortSelect) {
          sortSelect.value = search.sortBy;
        }
        
        // 执行搜索
        this.performSearch();
      });
      
      historyList.appendChild(item);
    }
  }
  
  private showLoading(): void {
    const resultsArea = this.container?.querySelector('.advanced-search-results');
    if (!resultsArea) return;
    
    resultsArea.innerHTML = `
      <div style="text-align: center; padding: 40px;">
        <div style="font-size: 24px; margin-bottom: 10px;">🔍</div>
        <div>Searching...</div>
      </div>
    `;
  }
  
  private showError(message: string): void {
    const resultsArea = this.container?.querySelector('.advanced-search-results');
    if (!resultsArea) return;
    
    resultsArea.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--fill-error);">
        <div style="font-size: 24px; margin-bottom: 10px;">❌</div>
        <div>${message}</div>
      </div>
    `;
  }
  
  refresh(): void {
    // 如果需要刷新
  }
  
  destroy(): void {
    this.container = null;
    this.currentResults = [];
  }
}