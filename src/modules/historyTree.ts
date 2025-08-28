/**
 * 历史树相关类型定义
 */

export enum RelationType {
  TAB = 'tab',
  LINK = 'link',
  SEARCH = 'search',
  RELATED = 'related',
  PARENT = 'parent',
  CHILD = 'child',
  MANUAL = 'manual'
}

export interface HistoryNode {
  id: string;
  itemId: number;
  parentId: string | null;
  children: HistoryNode[];
  timestamp: Date;
  sessionId: string;
  depth: number;
  expanded: boolean;
  visitCount: number;
  lastVisit: Date;
  relationType: RelationType;
  tabId: string | null;
  notes: string;
  tags: string[];
  importance: number;
  
  // 文献信息缓存
  title: string;
  creators: string;
  itemType: string;
  year: string;
  key: string;
  doi: string;
  abstract: string;
  libraryId: number | null;
  
  // 标签页状态
  isClosed?: boolean;
  closedAt?: Date;
  closedContext?: any;
  
  // 笔记关联
  hasNotes?: boolean;
}