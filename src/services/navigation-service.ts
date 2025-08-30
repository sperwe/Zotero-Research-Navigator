/**
 * Navigation Service
 * Handles navigation tracking and history
 */

import { HistoryService } from './history-service';

export class NavigationService {
  constructor(private historyService: HistoryService) {}

  /**
   * Navigate to an item
   */
  async navigateToItem(itemId: number): Promise<void> {
    const item = Zotero.Items.get(itemId);
    if (!item) return;

    // Track navigation based on item type
    if (item.isAttachment()) {
      await this.historyService.createOrUpdateNode(itemId);
    } else if (item.isNote()) {
      // Don't track note navigation
      return;
    } else if (item.isRegularItem()) {
      await this.historyService.createOrUpdateNode(itemId);
    }
  }

  /**
   * Navigate to a collection
   */
  async navigateToCollection(collectionId: number): Promise<void> {
    const collection = Zotero.Collections.get(collectionId);
    if (!collection) return;

    // Track collection navigation as a special node
    await this.historyService.createOrUpdateNode(collectionId, 'collection');
  }

  /**
   * Navigate by URL
   */
  async navigateToUrl(url: string): Promise<void> {
    // Extract item ID from URL if possible
    const match = url.match(/\/items\/(\d+)/);
    if (match) {
      const itemId = parseInt(match[1]);
      await this.navigateToItem(itemId);
    }
  }

  /**
   * Get navigation history
   */
  async getHistory(limit: number = 50): Promise<any[]> {
    return await this.historyService.getRecentNodes(limit);
  }

  /**
   * Get filtered history
   */
  async getFilteredHistory(filter: string, limit: number = 50): Promise<any[]> {
    const allHistory = await this.historyService.getRecentNodes(limit * 2);
    return allHistory.filter(node => 
      node.title?.toLowerCase().includes(filter.toLowerCase())
    ).slice(0, limit);
  }

  /**
   * Clear navigation history
   */
  async clearHistory(since?: Date): Promise<void> {
    if (since) {
      await this.historyService.clearHistorySince(since);
    } else {
      await this.historyService.clearAllHistory();
    }
  }

  /**
   * Handle navigation errors
   */
  private handleError(error: any, context: string): void {
    Zotero.logError(`[NavigationService] Error in ${context}: ${error}`);
  }
}