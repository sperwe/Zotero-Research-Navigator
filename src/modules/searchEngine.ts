/**
 * Search engine module for Research Navigator
 * Provides fuzzy search functionality for history items
 */

import { HistoryNode } from './historyTracker';

export interface SearchResult {
  node: HistoryNode;
  score: number;
  matches: {
    field: string;
    indices: [number, number][];
  }[];
}

export class SearchEngine {
  private searchIndex: Map<string, HistoryNode>;

  constructor() {
    this.searchIndex = new Map();
  }

  /**
   * 构建搜索索引
   */
  buildIndex(nodes: HistoryNode[]): void {
    this.searchIndex.clear();
    this.indexNodes(nodes);
    ztoolkit.log(`[Research Navigator] Search index built with ${this.searchIndex.size} items`);
  }

  private indexNodes(nodes: HistoryNode[]): void {
    for (const node of nodes) {
      this.searchIndex.set(node.itemID, node);
      if (node.children && node.children.length > 0) {
        this.indexNodes(node.children);
      }
    }
  }

  /**
   * 执行模糊搜索
   */
  search(query: string, limit: number = 50): SearchResult[] {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const results: SearchResult[] = [];
    const queryLower = query.toLowerCase();
    const queryTerms = queryLower.split(/\s+/).filter(term => term.length > 0);

    for (const node of this.searchIndex.values()) {
      const result = this.scoreNode(node, queryTerms);
      if (result.score > 0) {
        results.push(result);
      }
    }

    // 按分数排序
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, limit);
  }

  /**
   * 计算节点的匹配分数
   */
  private scoreNode(node: HistoryNode, queryTerms: string[]): SearchResult {
    const result: SearchResult = {
      node,
      score: 0,
      matches: []
    };

    // 搜索标题
    const titleScore = this.scoreField(node.title, queryTerms, 'title', 2.0);
    if (titleScore.score > 0) {
      result.score += titleScore.score;
      result.matches.push(titleScore.match);
    }

    // 搜索项目类型
    const typeScore = this.scoreField(node.itemType, queryTerms, 'itemType', 0.5);
    if (typeScore.score > 0) {
      result.score += typeScore.score;
      result.matches.push(typeScore.match);
    }

    // 访问频率加成
    const accessCount = node.accessRecords?.length || 0;
    if (accessCount > 0) {
      result.score *= (1 + Math.log10(accessCount) * 0.1);
    }

    // 最近访问加成
    const daysSinceAccess = (Date.now() - node.lastAccessed) / (1000 * 60 * 60 * 24);
    if (daysSinceAccess < 7) {
      result.score *= (1 + (7 - daysSinceAccess) / 7 * 0.2);
    }

    return result;
  }

  /**
   * 计算字段的匹配分数
   */
  private scoreField(text: string, queryTerms: string[], fieldName: string, weight: number): {
    score: number;
    match: { field: string; indices: [number, number][] };
  } {
    if (!text) {
      return { score: 0, match: { field: fieldName, indices: [] } };
    }

    const textLower = text.toLowerCase();
    let totalScore = 0;
    const indices: [number, number][] = [];

    for (const term of queryTerms) {
      let index = textLower.indexOf(term);
      if (index !== -1) {
        // 完全匹配
        totalScore += weight;
        indices.push([index, index + term.length - 1]);
      } else {
        // 模糊匹配
        const fuzzyScore = this.fuzzyMatch(textLower, term);
        if (fuzzyScore > 0) {
          totalScore += fuzzyScore * weight * 0.5;
        }
      }
    }

    return {
      score: totalScore,
      match: { field: fieldName, indices }
    };
  }

  /**
   * 简单的模糊匹配算法
   */
  private fuzzyMatch(text: string, query: string): number {
    let queryIndex = 0;
    let matchCount = 0;

    for (let i = 0; i < text.length && queryIndex < query.length; i++) {
      if (text[i] === query[queryIndex]) {
        matchCount++;
        queryIndex++;
      }
    }

    return queryIndex === query.length ? matchCount / query.length : 0;
  }

  /**
   * 高亮搜索结果
   */
  highlightText(text: string, indices: [number, number][]): string {
    if (!indices || indices.length === 0) {
      return text;
    }

    // 按索引位置排序
    indices.sort((a, b) => a[0] - b[0]);

    let result = '';
    let lastIndex = 0;

    for (const [start, end] of indices) {
      if (start > lastIndex) {
        result += text.substring(lastIndex, start);
      }
      result += `<mark>${text.substring(start, end + 1)}</mark>`;
      lastIndex = end + 1;
    }

    if (lastIndex < text.length) {
      result += text.substring(lastIndex);
    }

    return result;
  }
}