#!/usr/bin/env node

/**
 * Test script for Quick Note History Navigation
 */

// 模拟 QuickNoteWindowV2 的历史导航逻辑
class QuickNoteHistoryTest {
  constructor() {
    this.noteHistory = [];
    this.currentHistoryIndex = -1;
  }

  // 模拟 addToHistory 方法
  addToHistory(noteId) {
    console.log(`\n[addToHistory] Adding note ${noteId}`);
    console.log(`Before: history=[${this.noteHistory}], index=${this.currentHistoryIndex}`);
    
    // 如果已在历史中，先移除
    const existingIndex = this.noteHistory.indexOf(noteId);
    if (existingIndex !== -1) {
      this.noteHistory.splice(existingIndex, 1);
      console.log(`Removed existing note ${noteId} from index ${existingIndex}`);
    }
    
    // 添加到历史末尾
    this.noteHistory.push(noteId);
    
    // 限制历史记录数量
    if (this.noteHistory.length > 10) {
      this.noteHistory.shift();
    }
    
    // 更新当前索引
    this.currentHistoryIndex = this.noteHistory.length - 1;
    
    console.log(`After: history=[${this.noteHistory}], index=${this.currentHistoryIndex}`);
    this.updateHistoryButtons();
  }

  // 模拟 updateHistoryButtons 方法
  updateHistoryButtons() {
    const canGoPrev = this.currentHistoryIndex > 0;
    const canGoNext = this.currentHistoryIndex < this.noteHistory.length - 1;
    
    console.log(`[updateHistoryButtons] Prev: ${canGoPrev ? 'ENABLED' : 'DISABLED'}, Next: ${canGoNext ? 'ENABLED' : 'DISABLED'}`);
  }

  // 模拟 navigateHistory 方法
  navigateHistory(direction) {
    const newIndex = this.currentHistoryIndex + direction;
    
    console.log(`\n[navigateHistory] Direction: ${direction > 0 ? 'NEXT' : 'PREV'}`);
    console.log(`Current index: ${this.currentHistoryIndex}, New index: ${newIndex}`);
    
    if (newIndex < 0 || newIndex >= this.noteHistory.length) {
      console.log(`Out of bounds! (0 to ${this.noteHistory.length - 1})`);
      return;
    }
    
    this.currentHistoryIndex = newIndex;
    const noteId = this.noteHistory[newIndex];
    console.log(`Navigated to note ${noteId} at index ${newIndex}`);
    this.updateHistoryButtons();
  }

  // 运行测试场景
  runTest() {
    console.log('=== Quick Note History Navigation Test ===\n');
    
    // 场景1：添加5个不同的笔记
    console.log('--- Scenario 1: Adding 5 different notes ---');
    for (let i = 1; i <= 5; i++) {
      this.addToHistory(1000 + i);
    }
    
    // 场景2：尝试导航
    console.log('\n--- Scenario 2: Testing navigation ---');
    console.log('Current position:', this.currentHistoryIndex, 'of', this.noteHistory.length - 1);
    
    console.log('\nTrying to go NEXT:');
    this.navigateHistory(1);
    
    console.log('\nTrying to go PREV:');
    this.navigateHistory(-1);
    
    console.log('\nTrying to go PREV again:');
    this.navigateHistory(-1);
    
    // 场景3：重复添加相同的笔记
    console.log('\n--- Scenario 3: Adding same note multiple times ---');
    this.noteHistory = [];
    this.currentHistoryIndex = -1;
    
    for (let i = 0; i < 5; i++) {
      this.addToHistory(2000); // 同一个笔记ID
    }
    
    console.log('\nFinal state:', {
      history: this.noteHistory,
      currentIndex: this.currentHistoryIndex,
      historyLength: this.noteHistory.length
    });
    
    // 场景4：混合场景
    console.log('\n--- Scenario 4: Mixed scenario ---');
    this.noteHistory = [];
    this.currentHistoryIndex = -1;
    
    this.addToHistory(3001);
    this.addToHistory(3002);
    this.addToHistory(3003);
    this.addToHistory(3002); // 重复
    this.addToHistory(3004);
    
    console.log('\nTrying navigation after mixed adds:');
    this.navigateHistory(-1); // 应该可以后退
    this.navigateHistory(-1); // 应该可以再后退
    this.navigateHistory(1);  // 应该可以前进
  }
}

// 运行测试
const test = new QuickNoteHistoryTest();
test.runTest();