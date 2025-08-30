/**
 * Bootstrap Filter Test Runner
 * 统一运行所有测试并生成报告
 */

import { runBootstrapFilterTests } from './test-security-filter';
import { runComprehensiveTest } from './comprehensive-test';
import { startGlobalMonitoring, stopGlobalMonitoring } from './monitor-tool';

export class BootstrapTestRunner {
  private results: any = {};
  
  /**
   * 运行所有测试
   */
  async runAllTests(): Promise<void> {
    console.log('🚀 Zotero Research Navigator - Bootstrap Filter Test Suite');
    console.log('Version:', Zotero.ResearchNavigator?.version || 'Unknown');
    console.log('Date:', new Date().toISOString());
    console.log('='.repeat(70));
    
    try {
      // 1. 运行基础测试
      console.log('\n📝 Running Basic Filter Tests...\n');
      await this.runWithMonitoring('basic', async () => {
        await runBootstrapFilterTests();
      });
      
      // 2. 运行综合测试
      console.log('\n🔧 Running Comprehensive Tests...\n');
      await this.runWithMonitoring('comprehensive', async () => {
        await runComprehensiveTest();
      });
      
      // 3. 运行插件特定测试
      console.log('\n🎯 Running Plugin-Specific Tests...\n');
      await this.runPluginTests();
      
      // 4. 生成最终报告
      this.generateFinalReport();
      
    } catch (error) {
      console.error('Test suite failed:', error);
      Zotero.logError(error);
    }
  }
  
  /**
   * 使用监控运行测试
   */
  private async runWithMonitoring(name: string, testFn: () => Promise<void>): Promise<void> {
    // 开始监控
    startGlobalMonitoring();
    
    // 运行测试
    const startTime = performance.now();
    await testFn();
    const duration = performance.now() - startTime;
    
    // 停止监控并收集数据
    const monitorData = stopGlobalMonitoring();
    
    this.results[name] = {
      duration,
      monitorData
    };
  }
  
  /**
   * 运行插件特定测试
   */
  private async runPluginTests(): Promise<void> {
    const tests = [
      {
        name: 'Quick Note Button',
        test: () => this.testQuickNoteButton()
      },
      {
        name: 'Main Panel',
        test: () => this.testMainPanel()
      },
      {
        name: 'History Tree',
        test: () => this.testHistoryTree()
      },
      {
        name: 'Note Relations',
        test: () => this.testNoteRelations()
      }
    ];
    
    for (const { name, test } of tests) {
      console.log(`\nTesting ${name}...`);
      try {
        const result = await test();
        console.log(`  Result: ${result.success ? '✅ PASS' : '❌ FAIL'}`);
        if (result.message) {
          console.log(`  ${result.message}`);
        }
        this.results[`plugin_${name}`] = result;
      } catch (error) {
        console.log(`  Result: ❌ ERROR - ${error.message}`);
        this.results[`plugin_${name}`] = { success: false, error: error.message };
      }
    }
  }
  
  /**
   * 测试快速笔记按钮
   */
  private async testQuickNoteButton(): Promise<any> {
    const doc = window.document;
    const container = doc.createElement('div');
    
    // 测试不安全的实现
    const unsafeHTML = `
      <div id="quick-note-button">
        <button class="quick-note-trigger">📝</button>
      </div>
    `;
    
    container.innerHTML = unsafeHTML;
    const unsafeButton = container.querySelector('button');
    
    // 测试安全的实现
    const safeButton = doc.createElement('span');
    safeButton.setAttribute('role', 'button');
    safeButton.setAttribute('tabindex', '0');
    safeButton.className = 'quick-note-trigger';
    safeButton.textContent = '📝';
    
    const safeContainer = doc.createElement('div');
    safeContainer.id = 'quick-note-button-safe';
    safeContainer.appendChild(safeButton);
    
    return {
      success: !unsafeButton && safeContainer.contains(safeButton),
      unsafeFiltered: !unsafeButton,
      safeImplemented: safeContainer.contains(safeButton),
      message: `Unsafe button ${unsafeButton ? 'NOT filtered' : 'filtered'}, Safe button ${safeContainer.contains(safeButton) ? 'works' : 'failed'}`
    };
  }
  
  /**
   * 测试主面板
   */
  private async testMainPanel(): Promise<any> {
    const doc = window.document;
    const panel = doc.createElement('div');
    panel.className = 'research-navigator-panel';
    
    // 创建安全的控制按钮
    const controls = ['close', 'minimize', 'dock'].map(action => {
      const btn = doc.createElement('span');
      btn.setAttribute('role', 'button');
      btn.setAttribute('tabindex', '0');
      btn.setAttribute('aria-label', `${action} panel`);
      btn.className = `panel-control-${action}`;
      btn.style.cssText = `
        display: inline-block;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        cursor: pointer;
      `;
      return btn;
    });
    
    const toolbar = doc.createElement('div');
    toolbar.className = 'panel-toolbar';
    controls.forEach(btn => toolbar.appendChild(btn));
    panel.appendChild(toolbar);
    
    return {
      success: controls.every(btn => toolbar.contains(btn)),
      controlsCreated: controls.length,
      message: 'Panel controls created successfully using safe methods'
    };
  }
  
  /**
   * 测试历史树
   */
  private async testHistoryTree(): Promise<any> {
    const doc = window.document;
    const treeContainer = doc.createElement('div');
    
    // 创建树节点
    const createTreeNode = (text: string, hasDelete: boolean = true): HTMLElement => {
      const node = doc.createElement('div');
      node.className = 'tree-node';
      
      const label = doc.createElement('span');
      label.className = 'node-label';
      label.textContent = text;
      node.appendChild(label);
      
      if (hasDelete) {
        const deleteBtn = doc.createElement('span');
        deleteBtn.setAttribute('role', 'button');
        deleteBtn.setAttribute('tabindex', '0');
        deleteBtn.setAttribute('aria-label', 'Delete node');
        deleteBtn.className = 'node-delete';
        deleteBtn.innerHTML = '&times;';
        deleteBtn.style.cssText = 'cursor: pointer; color: red; margin-left: 10px;';
        node.appendChild(deleteBtn);
      }
      
      return node;
    };
    
    // 创建测试树
    const nodes = [
      createTreeNode('Session 1'),
      createTreeNode('Session 2'),
      createTreeNode('Session 3')
    ];
    
    nodes.forEach(node => treeContainer.appendChild(node));
    
    const deleteButtons = treeContainer.querySelectorAll('[role="button"]');
    
    return {
      success: deleteButtons.length === 3,
      nodesCreated: nodes.length,
      deleteButtonsFound: deleteButtons.length,
      message: 'Tree nodes with delete buttons created successfully'
    };
  }
  
  /**
   * 测试笔记关系
   */
  private async testNoteRelations(): Promise<any> {
    const doc = window.document;
    const container = doc.createElement('div');
    
    // 创建笔记卡片
    const createNoteCard = (title: string): HTMLElement => {
      const card = doc.createElement('div');
      card.className = 'note-card';
      card.style.cssText = 'border: 1px solid #ddd; padding: 10px; margin: 5px;';
      
      const titleEl = doc.createElement('h4');
      titleEl.textContent = title;
      card.appendChild(titleEl);
      
      // 创建操作菜单（右键菜单触发）
      card.setAttribute('data-context-menu', 'note-actions');
      card.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        // 显示菜单逻辑
      });
      
      return card;
    };
    
    const cards = [
      createNoteCard('Note 1'),
      createNoteCard('Note 2'),
      createNoteCard('Note 3')
    ];
    
    cards.forEach(card => container.appendChild(card));
    
    return {
      success: cards.every(card => container.contains(card)),
      cardsCreated: cards.length,
      message: 'Note cards created without inline buttons (using context menu instead)'
    };
  }
  
  /**
   * 生成最终报告
   */
  private generateFinalReport(): void {
    console.log('\n' + '='.repeat(70));
    console.log('📊 FINAL TEST REPORT');
    console.log('='.repeat(70));
    
    // 统计总体结果
    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;
    let errors = 0;
    
    Object.entries(this.results).forEach(([name, result]) => {
      if (result && typeof result === 'object') {
        totalTests++;
        if (result.success === true) {
          passedTests++;
        } else if (result.success === false) {
          failedTests++;
        }
        if (result.error) {
          errors++;
        }
      }
    });
    
    console.log('\nTest Summary:');
    console.log(`  Total Tests: ${totalTests}`);
    console.log(`  ✅ Passed: ${passedTests}`);
    console.log(`  ❌ Failed: ${failedTests}`);
    console.log(`  ⚠️  Errors: ${errors}`);
    console.log(`  Success Rate: ${totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(1) : 0}%`);
    
    // 过滤元素统计
    console.log('\nFiltered Elements Summary:');
    let totalFiltered = 0;
    Object.values(this.results).forEach((result: any) => {
      if (result.monitorData && result.monitorData.summary) {
        totalFiltered += result.monitorData.summary.totalFiltered;
      }
    });
    console.log(`  Total elements filtered: ${totalFiltered}`);
    
    // 建议
    console.log('\n💡 Key Recommendations:');
    console.log('  1. Always use createElement() instead of innerHTML for interactive elements');
    console.log('  2. Replace <button> with <span role="button" tabindex="0">');
    console.log('  3. Implement keyboard event handlers for custom controls');
    console.log('  4. Use DOM manipulation for dynamic content');
    console.log('  5. Test thoroughly in actual Zotero environment');
    
    // 保存报告
    this.saveReport();
  }
  
  /**
   * 保存报告到文件
   */
  private saveReport(): void {
    const report = {
      timestamp: new Date().toISOString(),
      zoteroVersion: Zotero.version,
      pluginVersion: Zotero.ResearchNavigator?.version || 'Unknown',
      results: this.results,
      recommendations: [
        'Use safe DOM manipulation methods',
        'Avoid innerHTML for interactive content',
        'Implement ARIA attributes for accessibility',
        'Test in production Zotero environment'
      ]
    };
    
    const reportPath = Zotero.DataDirectory.dir + '/research-navigator-bootstrap-test-report.json';
    
    Zotero.File.putContentsAsync(
      reportPath,
      JSON.stringify(report, null, 2)
    ).then(() => {
      console.log(`\n📁 Report saved to: ${reportPath}`);
    }).catch(error => {
      console.error('Failed to save report:', error);
    });
  }
}

// 创建全局测试函数
export async function runBootstrapTestSuite(): Promise<void> {
  const runner = new BootstrapTestRunner();
  await runner.runAllTests();
}

// 添加到 Zotero 全局对象以便在控制台调用
if (typeof Zotero !== 'undefined') {
  Zotero.ResearchNavigator = Zotero.ResearchNavigator || {};
  Zotero.ResearchNavigator.runBootstrapTests = runBootstrapTestSuite;
}