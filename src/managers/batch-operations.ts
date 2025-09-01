import { HistoryNode } from '../services/database-service';
import { HistoryService } from '../services/history-service';
import { NoteAssociationSystem } from './note-association-system';

export type BatchOperation = 
  | 'delete'
  | 'archive' 
  | 'restore'
  | 'export'
  | 'addTag'
  | 'removeTag'
  | 'associate'
  | 'dissociate'
  | 'changeStatus';

export interface BatchOperationOptions {
  operation: BatchOperation;
  targets: string[]; // Node IDs or Item IDs
  params?: any;
}

export interface BatchOperationResult {
  success: boolean;
  processed: number;
  failed: number;
  errors: { id: string; error: string }[];
}

export class BatchOperationManager {
  private inProgress = false;
  private currentOperation: BatchOperation | null = null;
  private abortController: AbortController | null = null;
  
  constructor(
    private window: Window,
    private historyService: HistoryService,
    private noteAssociationSystem: NoteAssociationSystem
  ) {}
  
  /**
   * 执行批量操作
   */
  async execute(options: BatchOperationOptions): Promise<BatchOperationResult> {
    if (this.inProgress) {
      throw new Error('Another batch operation is in progress');
    }
    
    this.inProgress = true;
    this.currentOperation = options.operation;
    this.abortController = new AbortController();
    
    const result: BatchOperationResult = {
      success: true,
      processed: 0,
      failed: 0,
      errors: []
    };
    
    // 显示进度
    const progressWindow = this.showProgress(options.targets.length);
    
    try {
      for (let i = 0; i < options.targets.length; i++) {
        // 检查是否中止
        if (this.abortController.signal.aborted) {
          break;
        }
        
        const targetId = options.targets[i];
        
        try {
          await this.executeOperation(options.operation, targetId, options.params);
          result.processed++;
        } catch (error) {
          result.failed++;
          result.errors.push({
            id: targetId,
            error: error instanceof Error ? error.message : String(error)
          });
        }
        
        // 更新进度
        this.updateProgress(progressWindow, i + 1, options.targets.length);
      }
      
      result.success = result.failed === 0;
      
    } finally {
      this.inProgress = false;
      this.currentOperation = null;
      this.abortController = null;
      
      // 关闭进度窗口
      setTimeout(() => {
        progressWindow.close();
      }, 1000);
    }
    
    return result;
  }
  
  /**
   * 执行单个操作
   */
  private async executeOperation(
    operation: BatchOperation,
    targetId: string,
    params?: any
  ): Promise<void> {
    switch (operation) {
      case 'delete':
        await this.deleteNode(targetId);
        break;
        
      case 'archive':
        await this.archiveNode(targetId);
        break;
        
      case 'restore':
        await this.restoreNode(targetId);
        break;
        
      case 'export':
        await this.exportNode(targetId, params);
        break;
        
      case 'addTag':
        await this.addTag(targetId, params.tag);
        break;
        
      case 'removeTag':
        await this.removeTag(targetId, params.tag);
        break;
        
      case 'associate':
        await this.associateNote(targetId, params.noteId);
        break;
        
      case 'dissociate':
        await this.dissociateNote(targetId, params.noteId);
        break;
        
      case 'changeStatus':
        await this.changeStatus(targetId, params.status);
        break;
        
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }
  
  /**
   * 删除节点
   */
  private async deleteNode(nodeId: string): Promise<void> {
    await this.historyService.removeNode(nodeId);
  }
  
  /**
   * 归档节点
   */
  private async archiveNode(nodeId: string): Promise<void> {
    const node = await this.historyService.getNode(nodeId);
    if (!node) throw new Error('Node not found');
    
    await this.historyService.updateNode(nodeId, {
      status: 'archived'
    });
  }
  
  /**
   * 恢复节点
   */
  private async restoreNode(nodeId: string): Promise<void> {
    const node = await this.historyService.getNode(nodeId);
    if (!node) throw new Error('Node not found');
    
    await this.historyService.updateNode(nodeId, {
      status: 'active'
    });
  }
  
  /**
   * 导出节点
   */
  private async exportNode(nodeId: string, format: string): Promise<void> {
    // 实现导出逻辑
    const node = await this.historyService.getNode(nodeId);
    if (!node) throw new Error('Node not found');
    
    // 这里可以集成 ExportImportManager
  }
  
  /**
   * 添加标签
   */
  private async addTag(itemId: string, tag: string): Promise<void> {
    const item = await Zotero.Items.getAsync(parseInt(itemId));
    if (!item) throw new Error('Item not found');
    
    item.addTag(tag);
    await item.saveTx();
  }
  
  /**
   * 移除标签
   */
  private async removeTag(itemId: string, tag: string): Promise<void> {
    const item = await Zotero.Items.getAsync(parseInt(itemId));
    if (!item) throw new Error('Item not found');
    
    item.removeTag(tag);
    await item.saveTx();
  }
  
  /**
   * 关联笔记
   */
  private async associateNote(nodeId: string, noteId: number): Promise<void> {
    await this.noteAssociationSystem.createAssociation(
      noteId,
      nodeId,
      'reference',
      { source: 'batch' }
    );
  }
  
  /**
   * 取消关联笔记
   */
  private async dissociateNote(nodeId: string, noteId: number): Promise<void> {
    await this.noteAssociationSystem.removeAssociation(noteId, nodeId);
  }
  
  /**
   * 更改状态
   */
  private async changeStatus(nodeId: string, status: string): Promise<void> {
    await this.historyService.updateNode(nodeId, { status });
  }
  
  /**
   * 显示进度窗口
   */
  private showProgress(total: number): any {
    const progressWindow = new Zotero.ProgressWindow();
    progressWindow.changeHeadline('Batch Operation');
    progressWindow.addDescription(`Processing ${total} items...`);
    
    const progressLine = progressWindow.addLines(1)[0];
    progressLine.progress = 0;
    
    progressWindow.show();
    
    return {
      window: progressWindow,
      line: progressLine,
      close: () => progressWindow.close()
    };
  }
  
  /**
   * 更新进度
   */
  private updateProgress(progress: any, current: number, total: number): void {
    const percent = Math.round((current / total) * 100);
    progress.line.progress = percent;
    progress.line.setText(`${current} / ${total} (${percent}%)`);
  }
  
  /**
   * 中止当前操作
   */
  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }
  
  /**
   * 获取可用的批量操作
   */
  getAvailableOperations(): { operation: BatchOperation; label: string; icon: string }[] {
    return [
      { operation: 'delete', label: 'Delete', icon: '🗑️' },
      { operation: 'archive', label: 'Archive', icon: '📦' },
      { operation: 'restore', label: 'Restore', icon: '♻️' },
      { operation: 'export', label: 'Export', icon: '📤' },
      { operation: 'addTag', label: 'Add Tag', icon: '🏷️' },
      { operation: 'removeTag', label: 'Remove Tag', icon: '🏷️' },
      { operation: 'associate', label: 'Associate Note', icon: '🔗' },
      { operation: 'dissociate', label: 'Remove Association', icon: '🔗' },
      { operation: 'changeStatus', label: 'Change Status', icon: '📊' }
    ];
  }
  
  /**
   * 验证操作参数
   */
  validateParams(operation: BatchOperation, params: any): boolean {
    switch (operation) {
      case 'addTag':
      case 'removeTag':
        return params?.tag && typeof params.tag === 'string';
        
      case 'associate':
      case 'dissociate':
        return params?.noteId && typeof params.noteId === 'number';
        
      case 'changeStatus':
        return params?.status && ['active', 'archived', 'deleted'].includes(params.status);
        
      case 'export':
        return params?.format && ['json', 'csv', 'html'].includes(params.format);
        
      default:
        return true;
    }
  }
  
  /**
   * 预览批量操作
   */
  async preview(options: BatchOperationOptions): Promise<{
    affected: any[];
    warnings: string[];
  }> {
    const affected = [];
    const warnings = [];
    
    for (const targetId of options.targets) {
      try {
        const node = await this.historyService.getNode(targetId);
        if (node) {
          affected.push(node);
          
          // 检查警告
          if (options.operation === 'delete' && node.status === 'open') {
            warnings.push(`Node "${node.title}" is active`);
          }
        }
      } catch (error) {
        warnings.push(`Failed to load node ${targetId}`);
      }
    }
    
    return { affected, warnings };
  }
}