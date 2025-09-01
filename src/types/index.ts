/**
 * Central type definitions for Research Navigator
 */

// Re-export types from services
export type { HistoryNode, NoteRelation } from '../services/database-service';

// Re-export types from managers
export type { 
  NoteAssociation,
  AssociatedNote,
  RelationType,
  SearchCriteria 
} from '../managers/note-association-system';

// Additional type definitions
export interface NoteBlock {
  id: string;
  content: string;
  hash?: string;
  type: 'paragraph' | 'heading' | 'list' | 'code' | 'quote' | 'other';
  metadata?: Record<string, any>;
}

export interface NavigationContext {
  fromNodeId?: string;
  toNodeId?: string;
  timestamp: Date;
  action: 'click' | 'search' | 'back' | 'forward' | 'refresh';
}

// Extend global Window interface
declare global {
  interface Window {
    Zotero_Tabs?: {
      _history?: any[];
      selectedID?: string;
      select?(id: string): void;
    };
  }
}