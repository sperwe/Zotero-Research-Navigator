/**
 * 快速笔记浮动按钮
 * 在每个标签页右下角显示
 */

import { QuickNoteWindow } from './quick-note-window';
import { NoteAssociationSystem } from '../../managers/note-association-system';
import { HistoryService } from '../../services/history-service';

export class QuickNoteButton {
  private button: HTMLElement | null = null;
  private quickNoteWindow: QuickNoteWindow | null = null;
  private observer: MutationObserver | null = null;
  
  constructor(
    private window: Window,
    private noteAssociationSystem: NoteAssociationSystem,
    private historyService: HistoryService
  ) {}
  
  /**
   * 初始化
   */
  async initialize(): Promise<void> {
    try {
      Zotero.log('[QuickNoteButton] Initializing...', 'info');
      
      // 创建快速笔记窗口实例
      this.quickNoteWindow = new QuickNoteWindow(
        this.window,
        this.noteAssociationSystem,
        this.historyService
      );
      
      // 直接在主窗口创建按钮
      this.createFloatingButton();
      
      Zotero.log('[QuickNoteButton] Initialized successfully', 'info');
    } catch (error) {
      Zotero.logError(`[QuickNoteButton] Initialization error: ${error}`);
    }
  }
  
  /**
   * 创建浮动按钮
   */
  private createFloatingButton(): void {
    try {
      Zotero.log('[QuickNoteButton] Creating floating button...', 'info');
      
      // 检查是否已存在
      if (this.button && this.window.document.getElementById('quick-note-floating-button')) {
        Zotero.log('[QuickNoteButton] Button already exists', 'info');
        return;
      }
      
      const doc = this.window.document;
      
      // 创建按钮
      this.button = doc.createElement('div');
      this.button.id = 'quick-note-floating-button';
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
        z-index: 9999;
        transition: all 0.3s ease;
        user-select: none;
      `;
      
      // 添加图标
      this.button.innerHTML = `<span style="font-size: 24px; color: white;">📝</span>`;
      
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
      
      // 添加到文档
      doc.body.appendChild(this.button);
      
      Zotero.log('[QuickNoteButton] Button created and added to body', 'info');
    } catch (error) {
      Zotero.logError(`[QuickNoteButton] Create button error: ${error}`);
    }
  }
  
  /**
   * 监听标签页变化
   */
  private observeTabChanges(): void {
    // 监听 Zotero 标签页容器的变化
    const tabContainer = this.window.document.getElementById('zotero-tabs-deck');
    if (!tabContainer) {
      Zotero.log('[QuickNoteButton] Tab container not found', 'warn');
      return;
    }
    
    // 创建 MutationObserver 监听 DOM 变化
    this.observer = new this.window.MutationObserver(() => {
      this.updateButton();
    });
    
    // 配置观察选项
    this.observer.observe(tabContainer, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['selected']
    });
    
    // 监听标签页切换事件
    this.window.addEventListener('select', (e) => {
      if ((e.target as any)?.id === 'zotero-tabs') {
        setTimeout(() => this.updateButton(), 100);
      }
    });
  }
  
  /**
   * 更新按钮显示
   */
  private updateButton(): void {
    try {
      Zotero.log('[QuickNoteButton] updateButton called', 'info');
      
      // 获取当前活动的标签页
      const activeTab = this.getActiveTab();
      Zotero.log(`[QuickNoteButton] Active tab: ${activeTab ? activeTab.id : 'none'}`, 'info');
      
      if (!activeTab) {
        this.hideButton();
        return;
      }
      
      // 检查是否应该显示按钮
      const shouldShow = this.shouldShowButton(activeTab);
      Zotero.log(`[QuickNoteButton] Should show button: ${shouldShow}`, 'info');
      
      if (shouldShow) {
        this.showButton(activeTab);
      } else {
        this.hideButton();
      }
    } catch (error) {
      Zotero.logError(`[QuickNoteButton] Update button error: ${error}`);
    }
  }
  
  /**
   * 获取当前活动的标签页
   */
  private getActiveTab(): Element | null {
    // 获取标签页容器
    const deck = this.window.document.getElementById('zotero-tabs-deck');
    if (!deck) return null;
    
    // 获取选中的标签页
    const selectedTab = deck.querySelector('[selected="true"]');
    if (selectedTab) return selectedTab;
    
    // 备用方法：获取可见的标签页
    const visibleTab = deck.querySelector(':not([hidden="true"])');
    return visibleTab;
  }
  
  /**
   * 判断是否应该显示按钮
   */
  private shouldShowButton(tab: Element): boolean {
    const tabType = tab.getAttribute('data-tab-type') || tab.getAttribute('type');
    
    // 在这些标签页类型中显示按钮
    const allowedTypes = ['library', 'reader', 'note', 'web'];
    
    // 如果没有类型信息，检查是否是主界面
    if (!tabType) {
      return tab.id === 'zotero-pane' || tab.classList.contains('zotero-tab-content');
    }
    
    return allowedTypes.includes(tabType);
  }
  
  /**
   * 显示按钮
   */
  private showButton(container: Element): void {
    // 如果按钮已存在，先移除
    if (this.button && this.button.parentElement === container) {
      return; // 按钮已经在正确的位置
    }
    
    this.hideButton();
    
    // 创建按钮
    const doc = this.window.document;
    this.button = doc.createElement('div');
    this.button.id = 'quick-note-floating-button';
    this.button.style.cssText = `
      position: fixed;
      bottom: 30px;
      right: 30px;
      width: 56px;
      height: 56px;
      background: var(--accent-blue, #2196F3);
      border-radius: 50%;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999;
      transition: all 0.3s ease;
      user-select: none;
    `;
    
    // 添加图标
    this.button.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
        <path d="M19,2H5A3,3,0,0,0,2,5V19a3,3,0,0,0,3,3H19a3,3,0,0,0,3-3V5A3,3,0,0,0,19,2ZM19,19H5V5H19Z"/>
        <path d="M12 6v12M6 12h12" stroke="white" stroke-width="2" stroke-linecap="round"/>
      </svg>
    `;
    
    // 如果没有合适的 SVG，使用文字图标
    this.button.innerHTML = `<span style="font-size: 24px; color: white;">📝</span>`;
    
    // 添加悬停效果
    this.button.addEventListener('mouseenter', () => {
      this.button!.style.transform = 'scale(1.1)';
      this.button!.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
    });
    
    this.button.addEventListener('mouseleave', () => {
      this.button!.style.transform = 'scale(1)';
      this.button!.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
    });
    
    // 添加点击事件
    this.button.addEventListener('click', () => this.handleClick());
    
    // 添加提示
    this.button.title = 'Quick Note (Click to open)';
    
    // 添加到容器
    container.appendChild(this.button);
    
    Zotero.log('[QuickNoteButton] Button shown', 'info');
  }
  
  /**
   * 隐藏按钮
   */
  private hideButton(): void {
    if (this.button) {
      this.button.remove();
      this.button = null;
    }
  }
  
  /**
   * 处理点击事件
   */
  private async handleClick(): Promise<void> {
    try {
      if (!this.quickNoteWindow) {
        Zotero.logError('[QuickNoteButton] Quick note window not initialized');
        return;
      }
      
      // 获取当前选中的项目（如果有）
      const selectedItems = Zotero.getActiveZoteroPane()?.getSelectedItems();
      let nodeId: string | undefined;
      
      if (selectedItems && selectedItems.length === 1) {
        const item = selectedItems[0];
        if (!item.isNote()) {
          // 为选中的项目创建历史节点
          const node = await this.historyService.createOrUpdateNode(item.id, {
            title: item.getField('title'),
            url: item.getField('url')
          });
          nodeId = node.id;
        }
      }
      
      // 显示快速笔记窗口
      await this.quickNoteWindow.show(nodeId);
      
      // 添加点击动画
      this.animateClick();
      
    } catch (error) {
      Zotero.logError(`[QuickNoteButton] Click handler error: ${error}`);
    }
  }
  
  /**
   * 点击动画
   */
  private animateClick(): void {
    if (!this.button) return;
    
    // 创建涟漪效果
    const ripple = this.window.document.createElement('div');
    ripple.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      width: 0;
      height: 0;
      border-radius: 50%;
      background: rgba(255,255,255,0.5);
      transform: translate(-50%, -50%);
      pointer-events: none;
    `;
    
    this.button.appendChild(ripple);
    
    // 动画
    ripple.animate([
      { width: '0px', height: '0px', opacity: 1 },
      { width: '100px', height: '100px', opacity: 0 }
    ], {
      duration: 600,
      easing: 'ease-out'
    }).onfinish = () => ripple.remove();
  }
  
  /**
   * 销毁
   */
  destroy(): void {
    // 移除观察器
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    
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
    
    Zotero.log('[QuickNoteButton] Destroyed', 'info');
  }
}