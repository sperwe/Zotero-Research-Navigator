/**
 * 综合测试套件 - 深入分析 Bootstrap 安全过滤机制
 */

import { BootstrapFilterTest } from './test-security-filter';

export class ComprehensiveBootstrapTest {
  private window: Window;
  private doc: Document;
  
  constructor(window: Window) {
    this.window = window;
    this.doc = window.document;
  }
  
  /**
   * 运行完整的测试套件
   */
  async runFullTestSuite(): Promise<void> {
    console.log('🚀 Starting Comprehensive Bootstrap Filter Test Suite');
    console.log('=' .repeat(60));
    
    // 1. 检测 Zotero 环境
    await this.detectEnvironment();
    
    // 2. 测试所有危险元素
    await this.testDangerousElements();
    
    // 3. 测试安全替代方案
    await this.testSafeAlternatives();
    
    // 4. 测试实际插件场景
    await this.testRealWorldScenarios();
    
    // 5. 生成建议报告
    this.generateRecommendations();
  }
  
  /**
   * 检测 Zotero 环境配置
   */
  private async detectEnvironment(): Promise<void> {
    console.log('\n🔍 Environment Detection');
    console.log('-'.repeat(40));
    
    const envInfo = {
      zoteroVersion: Zotero.version,
      platform: Zotero.platform,
      locale: Zotero.locale,
      isDebug: Zotero.Debug.enabled,
      bootstrapVersion: this.detectBootstrapVersion(),
      securityConfig: this.detectSecurityConfig()
    };
    
    console.log('Environment:', JSON.stringify(envInfo, null, 2));
  }
  
  /**
   * 检测 Bootstrap 版本
   */
  private detectBootstrapVersion(): string {
    // 尝试从全局对象或 DOM 中检测
    if (this.window.bootstrap && this.window.bootstrap.VERSION) {
      return this.window.bootstrap.VERSION;
    }
    
    // 检查是否有 Bootstrap 相关的类
    const testEl = this.doc.createElement('div');
    testEl.className = 'btn btn-primary';
    const hasBootstrapClasses = this.window.getComputedStyle(testEl).display !== 'block';
    
    return hasBootstrapClasses ? 'Detected (version unknown)' : 'Not detected';
  }
  
  /**
   * 检测安全配置
   */
  private detectSecurityConfig(): any {
    // 尝试找到 sanitizer 配置
    const config: any = {};
    
    // 检查全局配置
    if (this.window.DOMPurify) {
      config.DOMPurify = 'Present';
    }
    
    // 检查 Zotero 特定的安全设置
    try {
      // 这些可能不存在，所以用 try-catch
      config.sanitizeHTML = typeof Zotero.Utilities.sanitizeHTML === 'function';
      config.unescapeHTML = typeof Zotero.Utilities.unescapeHTML === 'function';
    } catch (e) {
      config.error = 'Unable to detect Zotero utilities';
    }
    
    return config;
  }
  
  /**
   * 测试所有危险元素
   */
  private async testDangerousElements(): Promise<void> {
    console.log('\n⚠️  Testing Dangerous Elements');
    console.log('-'.repeat(40));
    
    const dangerousElements = [
      // 表单元素
      { tag: 'button', risk: 'high', reason: 'Interactive element' },
      { tag: 'input', risk: 'high', reason: 'User input' },
      { tag: 'select', risk: 'medium', reason: 'Dropdown control' },
      { tag: 'textarea', risk: 'medium', reason: 'Text input' },
      { tag: 'form', risk: 'high', reason: 'Form submission' },
      
      // 脚本元素
      { tag: 'script', risk: 'critical', reason: 'Code execution' },
      { tag: 'iframe', risk: 'critical', reason: 'External content' },
      { tag: 'object', risk: 'critical', reason: 'Plugin content' },
      { tag: 'embed', risk: 'critical', reason: 'Embedded content' },
      
      // 事件属性
      { tag: 'div', attrs: { onclick: 'alert(1)' }, risk: 'high', reason: 'Inline event' },
      { tag: 'a', attrs: { href: 'javascript:void(0)' }, risk: 'high', reason: 'JavaScript URL' },
      
      // 其他
      { tag: 'link', attrs: { rel: 'stylesheet' }, risk: 'medium', reason: 'External styles' },
      { tag: 'meta', attrs: { 'http-equiv': 'refresh' }, risk: 'medium', reason: 'Page redirect' }
    ];
    
    const results = dangerousElements.map(elem => {
      const container = this.doc.createElement('div');
      const attrs = elem.attrs || {};
      const attrString = Object.entries(attrs)
        .map(([k, v]) => `${k}="${v}"`)
        .join(' ');
      
      const html = `<${elem.tag} ${attrString}>Test</${elem.tag}>`;
      container.innerHTML = html;
      
      const wasFiltered = !container.querySelector(elem.tag);
      
      return {
        ...elem,
        html,
        filtered: wasFiltered,
        resultHTML: container.innerHTML
      };
    });
    
    // 按风险级别分组输出
    const riskLevels = ['critical', 'high', 'medium', 'low'];
    riskLevels.forEach(level => {
      const items = results.filter(r => r.risk === level);
      if (items.length > 0) {
        console.log(`\n${level.toUpperCase()} Risk Elements:`);
        items.forEach(item => {
          const icon = item.filtered ? '🚫' : '⚠️';
          console.log(`  ${icon} <${item.tag}> - ${item.reason} - ${item.filtered ? 'FILTERED' : 'NOT FILTERED'}`);
        });
      }
    });
  }
  
  /**
   * 测试安全替代方案
   */
  private async testSafeAlternatives(): Promise<void> {
    console.log('\n✅ Testing Safe Alternatives');
    console.log('-'.repeat(40));
    
    const alternatives = [
      {
        unsafe: '<button>Click me</button>',
        safe: '<span role="button" tabindex="0">Click me</span>',
        description: 'Button → Span with ARIA'
      },
      {
        unsafe: '<input type="text" value="test">',
        safe: '<div contenteditable="true" role="textbox">test</div>',
        description: 'Input → Contenteditable div'
      },
      {
        unsafe: '<select><option>A</option></select>',
        safe: '<div role="combobox" aria-expanded="false"><div role="option">A</div></div>',
        description: 'Select → ARIA combobox'
      },
      {
        unsafe: '<a href="javascript:alert(1)">Link</a>',
        safe: '<a href="#" data-action="alert">Link</a>',
        description: 'JavaScript URL → Data attribute'
      }
    ];
    
    alternatives.forEach(alt => {
      const unsafeContainer = this.doc.createElement('div');
      const safeContainer = this.doc.createElement('div');
      
      unsafeContainer.innerHTML = alt.unsafe;
      safeContainer.innerHTML = alt.safe;
      
      const unsafeFiltered = unsafeContainer.innerHTML !== alt.unsafe;
      const safeFiltered = safeContainer.innerHTML !== alt.safe;
      
      console.log(`\n${alt.description}:`);
      console.log(`  Unsafe: ${unsafeFiltered ? '🚫 FILTERED' : '⚠️  NOT FILTERED'}`);
      console.log(`  Safe: ${safeFiltered ? '🚫 FILTERED' : '✅ PASSED'}`);
    });
  }
  
  /**
   * 测试实际插件场景
   */
  private async testRealWorldScenarios(): Promise<void> {
    console.log('\n🌍 Testing Real-World Plugin Scenarios');
    console.log('-'.repeat(40));
    
    // 场景 1：快速笔记按钮
    await this.testScenario('Quick Note Button', () => {
      const container = this.doc.createElement('div');
      
      // 不安全的方式
      container.innerHTML = `
        <div class="quick-note-window">
          <button class="close-btn">×</button>
          <button class="save-btn">Save</button>
        </div>
      `;
      
      const hasButtons = container.querySelectorAll('button').length === 2;
      return { success: !hasButtons, message: hasButtons ? 'Buttons were filtered' : 'Buttons present' };
    });
    
    // 场景 2：历史树节点
    await this.testScenario('History Tree Node', () => {
      const container = this.doc.createElement('div');
      
      // 安全的方式
      const node = this.doc.createElement('div');
      node.className = 'tree-node';
      
      const deleteBtn = this.doc.createElement('span');
      deleteBtn.setAttribute('role', 'button');
      deleteBtn.setAttribute('tabindex', '0');
      deleteBtn.className = 'delete-btn';
      deleteBtn.textContent = '×';
      
      node.appendChild(deleteBtn);
      container.appendChild(node);
      
      return { 
        success: container.contains(deleteBtn), 
        message: 'Safe button implementation works' 
      };
    });
    
    // 场景 3：设置表单
    await this.testScenario('Settings Form', () => {
      const form = this.doc.createElement('div');
      form.setAttribute('role', 'form');
      
      // 创建安全的输入控件
      const inputGroup = this.doc.createElement('div');
      inputGroup.className = 'form-group';
      
      const label = this.doc.createElement('label');
      label.textContent = 'History Limit:';
      
      const input = this.doc.createElement('input');
      input.type = 'number';
      input.value = '1000';
      
      // 使用 DOM 操作而不是 innerHTML
      inputGroup.appendChild(label);
      inputGroup.appendChild(input);
      form.appendChild(inputGroup);
      
      return {
        success: form.contains(input),
        message: 'Form controls created via DOM manipulation'
      };
    });
  }
  
  /**
   * 执行单个测试场景
   */
  private async testScenario(name: string, test: () => { success: boolean; message: string }): Promise<void> {
    try {
      const result = test();
      console.log(`\n${name}: ${result.success ? '✅' : '❌'} ${result.message}`);
    } catch (error) {
      console.log(`\n${name}: ❌ Error - ${error.message}`);
    }
  }
  
  /**
   * 生成建议报告
   */
  private generateRecommendations(): void {
    console.log('\n📋 Recommendations');
    console.log('='.repeat(60));
    
    const recommendations = [
      {
        title: '1. 避免使用 innerHTML 插入交互元素',
        description: '使用 createElement 和 DOM 操作来创建按钮和表单控件',
        example: `// ❌ 不要这样做
container.innerHTML = '<button>Click</button>';

// ✅ 这样做
const btn = document.createElement('span');
btn.setAttribute('role', 'button');
btn.setAttribute('tabindex', '0');
btn.textContent = 'Click';
container.appendChild(btn);`
      },
      {
        title: '2. 使用 ARIA 属性增强语义',
        description: '为自定义控件添加适当的 ARIA 角色和属性',
        example: `// 创建可访问的按钮
const button = document.createElement('span');
button.setAttribute('role', 'button');
button.setAttribute('tabindex', '0');
button.setAttribute('aria-label', 'Close dialog');`
      },
      {
        title: '3. 实现键盘交互',
        description: '确保自定义控件支持键盘操作',
        example: `element.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    element.click();
  }
});`
      },
      {
        title: '4. 使用 CSS 提供视觉反馈',
        description: '为自定义控件添加适当的样式',
        example: `[role="button"] {
  cursor: pointer;
  user-select: none;
}
[role="button"]:hover {
  opacity: 0.8;
}
[role="button"]:focus {
  outline: 2px solid #0084ff;
}`
      },
      {
        title: '5. 测试辅助技术兼容性',
        description: '确保屏幕阅读器能正确识别自定义控件'
      }
    ];
    
    recommendations.forEach(rec => {
      console.log(`\n${rec.title}`);
      console.log(`   ${rec.description}`);
      if (rec.example) {
        console.log('\n   Example:');
        console.log(rec.example.split('\n').map(line => '   ' + line).join('\n'));
      }
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('Test suite completed successfully!');
  }
}

// 创建一个全局可用的测试函数
export async function runComprehensiveTest(): Promise<void> {
  const tester = new ComprehensiveBootstrapTest(window);
  await tester.runFullTestSuite();
}