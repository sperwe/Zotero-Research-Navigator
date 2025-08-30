/**
 * 简化版快速笔记浮动按钮
 * 基于 v2.0.3 的成功经验，采用更直接的实现方式
 */

import { QuickNoteWindow } from './quick-note-window';
import { NoteAssociationSystem } from '../../managers/note-association-system';
import { HistoryService } from '../../services/history-service';

export class QuickNoteButtonSimple {
  private button: HTMLElement | null = null;
  private quickNoteWindow: QuickNoteWindow | null = null;
  
  constructor(
    private window: Window,
    private noteAssociationSystem: NoteAssociationSystem,
    private historyService: HistoryService
  ) {}
  
  /**
   * 初始化 - 简单直接的方式
   */
  async initialize(): Promise<void> {
    try {
      Zotero.log('[QuickNoteButtonSimple] Initializing...', 'info');
      
      // 创建快速笔记窗口实例
      this.quickNoteWindow = new QuickNoteWindow(
        this.window,
        this.noteAssociationSystem,
        this.historyService
      );
      
      // 直接创建按钮，不等待复杂的 DOM 就绪检查
      this.createButton();
      
      Zotero.log('[QuickNoteButtonSimple] Initialized successfully', 'info');
    } catch (error) {
      Zotero.logError(`[QuickNoteButtonSimple] Initialization error: ${error}`);
    }
  }
  
  /**
   * 创建浮动按钮 - 参考 v2.0.3 的简单实现
   */
  private createButton(): void {
    try {
      const doc = this.window.document;
      
      // 如果按钮已存在，先移除
      if (this.button) {
        this.button.remove();
      }
      
      // 创建按钮容器
      this.button = doc.createElement('div');
      this.button.id = 'research-navigator-quick-note-button';
      this.button.style.cssText = `
        position: fixed;
        bottom: 30px;
        right: 30px;
        width: 56px;
        height: 56px;
        background: #2196F3;
        border-radius: 50%;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        transition: all 0.3s ease;
        user-select: none;
      `;
      
      // 添加图标 - 使用 emoji 避免路径问题
      const icon = doc.createElement('span');
      icon.textContent = '📝';
      icon.style.cssText = 'font-size: 24px; line-height: 1;';
      this.button.appendChild(icon);
      
      // 添加悬停效果
      this.button.addEventListener('mouseenter', () => {
        if (this.button) {
          this.button.style.transform = 'scale(1.1)';
          this.button.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
        }
      });
      
      this.button.addEventListener('mouseleave', () => {
        if (this.button) {
          this.button.style.transform = 'scale(1)';
          this.button.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
        }
      });
      
      // 添加点击事件
      this.button.addEventListener('click', () => this.handleClick());
      
      // 添加提示
      this.button.title = 'Quick Note (Click to open)';
      
      // 查找合适的父元素并添加按钮
      // 按优先级尝试不同的父元素
      const possibleParents = [
        doc.getElementById('main-window'),
        doc.getElementById('zotero-pane'),
        doc.getElementById('browser'),
        doc.querySelector('.zotero-view-tabbox'),
        doc.documentElement,
        doc.body
      ];
      
      let appended = false;
      for (const parent of possibleParents) {
        if (parent) {
          try {
            parent.appendChild(this.button);
            appended = true;
            Zotero.log(`[QuickNoteButtonSimple] Button appended to: ${parent.id || parent.tagName}`, 'info');
            break;
          } catch (e) {
            // 继续尝试下一个
          }
        }
      }
      
      if (!appended) {
        // 如果所有尝试都失败，延迟重试
        Zotero.log('[QuickNoteButtonSimple] Failed to append button, will retry...', 'warn');
        this.window.setTimeout(() => this.createButton(), 1000);
      }
      
    } catch (error) {
      Zotero.logError(`[QuickNoteButtonSimple] Create button error: ${error}`);
      // 发生错误时延迟重试
      this.window.setTimeout(() => this.createButton(), 2000);
    }
  }
  
  /**
   * 处理点击事件
   */
  private async handleClick(): Promise<void> {
    try {
      if (!this.quickNoteWindow) {
        Zotero.logError('[QuickNoteButtonSimple] Quick note window not initialized');
        return;
      }
      
      // 获取当前选中的项目（如果有）
      const selectedItems = Zotero.getActiveZoteroPane()?.getSelectedItems();
      let nodeId: string | undefined;
      
      if (selectedItems && selectedItems.length === 1) {
        const item = selectedItems[0];
        nodeId = `item-${item.id}`;
      }
      
      // 显示快速笔记窗口
      await this.quickNoteWindow.show(nodeId);
    } catch (error) {
      Zotero.logError(`[QuickNoteButtonSimple] Click handler error: ${error}`);
    }
  }
  
  /**
   * 销毁
   */
  destroy(): void {
    // 移除按钮
    if (this.button) {
      this.button.remove();
      this.button = null;
    }
    
    // 清理快速笔记窗口
    if (this.quickNoteWindow) {
      this.quickNoteWindow.close();
      this.quickNoteWindow = null;
    }
    
    Zotero.log('[QuickNoteButtonSimple] Destroyed', 'info');
  }
}