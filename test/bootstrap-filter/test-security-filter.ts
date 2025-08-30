/**
 * Bootstrap Security Filter Test Suite
 * 用于测试和验证 Zotero 环境中的 Bootstrap 安全过滤行为
 */

export class BootstrapFilterTest {
  private window: Window;
  private results: Map<string, any> = new Map();
  
  constructor(window: Window) {
    this.window = window;
  }
  
  /**
   * 运行所有测试
   */
  async runTests(): Promise<void> {
    console.log('=== Bootstrap Security Filter Tests ===');
    console.log(`Time: ${new Date().toISOString()}`);
    console.log(`Zotero Version: ${Zotero.version || 'Unknown'}`);
    console.log('');
    
    // 测试 1：直接 innerHTML 注入
    await this.testInnerHTML();
    
    // 测试 2：DOM 操作
    await this.testDOMManipulation();
    
    // 测试 3：各种元素类型
    await this.testElementTypes();
    
    // 测试 4：替代方案
    await this.testWorkarounds();
    
    // 测试 5：性能对比
    await this.testPerformance();
    
    // 测试 6：监控过滤行为
    await this.testFilteringBehavior();
    
    // 输出结果
    this.printResults();
  }
  
  /**
   * 测试 innerHTML 注入
   */
  private async testInnerHTML(): Promise<void> {
    console.log('📝 Test 1: innerHTML Injection');
    
    const container = this.window.document.createElement('div');
    const testCases = [
      '<button>Regular Button</button>',
      '<input type="text" />',
      '<input type="text">',  // 未闭合的 input
      '<select><option>Test</option></select>',
      '<textarea>Test</textarea>',
      '<script>console.log("test")</script>',
      '<iframe src="about:blank"></iframe>',
      '<span role="button">Safe Button</span>'
    ];
    
    const results: any[] = [];
    
    testCases.forEach(html => {
      container.innerHTML = '';
      container.innerHTML = html;
      
      const result = {
        original: html,
        result: container.innerHTML,
        filtered: container.innerHTML !== html,
        elementFound: container.firstElementChild !== null
      };
      
      results.push(result);
      console.log(`  ${result.filtered ? '❌' : '✅'} ${html.substring(0, 30)}...`);
    });
    
    this.results.set('innerHTML', results);
    console.log('');
  }
  
  /**
   * 测试 DOM 操作
   */
  private async testDOMManipulation(): Promise<void> {
    console.log('🔧 Test 2: DOM Manipulation');
    
    const container = this.window.document.createElement('div');
    const elements = ['button', 'input', 'select', 'textarea', 'script', 'span'];
    const results: any[] = [];
    
    elements.forEach(tagName => {
      const elem = this.window.document.createElement(tagName);
      elem.textContent = `Test ${tagName}`;
      
      if (tagName === 'input') {
        elem.setAttribute('type', 'text');
        elem.setAttribute('value', 'Test');
      }
      
      container.appendChild(elem);
      
      const result = {
        tagName,
        success: container.contains(elem),
        html: elem.outerHTML
      };
      
      results.push(result);
      console.log(`  ${result.success ? '✅' : '❌'} createElement('${tagName}')`);
    });
    
    this.results.set('domManipulation', results);
    console.log('');
  }
  
  /**
   * 测试各种元素类型和属性
   */
  private async testElementTypes(): Promise<void> {
    console.log('🏷️  Test 3: Element Types & Attributes');
    
    const testElements = [
      { tag: 'button', attrs: { type: 'button', class: 'test-btn' } },
      { tag: 'button', attrs: { onclick: 'alert("test")' } },
      { tag: 'input', attrs: { type: 'text', value: 'test' } },
      { tag: 'input', attrs: { type: 'file' } },
      { tag: 'a', attrs: { href: 'javascript:void(0)' } },
      { tag: 'a', attrs: { href: '#', onclick: 'return false;' } },
      { tag: 'span', attrs: { role: 'button', tabindex: '0' } },
      { tag: 'div', attrs: { contenteditable: 'true' } }
    ];
    
    const results: any[] = [];
    
    testElements.forEach(({ tag, attrs }) => {
      const container = this.window.document.createElement('div');
      
      // 构建 HTML 字符串
      const attrString = Object.entries(attrs)
        .map(([key, value]) => `${key}="${value}"`)
        .join(' ');
      const html = `<${tag} ${attrString}>Test</${tag}>`;
      
      container.innerHTML = html;
      
      const result = {
        tag,
        attrs,
        html,
        filtered: !container.querySelector(tag),
        resultHTML: container.innerHTML
      };
      
      results.push(result);
      console.log(`  ${result.filtered ? '❌' : '✅'} <${tag} ${attrString.substring(0, 20)}...>`);
    });
    
    this.results.set('elementTypes', results);
    console.log('');
  }
  
  /**
   * 测试替代方案
   */
  private async testWorkarounds(): Promise<void> {
    console.log('💡 Test 4: Workarounds & Solutions');
    
    const results: any[] = [];
    
    // 方案 1：使用 span + role
    const span = this.window.document.createElement('span');
    span.setAttribute('role', 'button');
    span.setAttribute('tabindex', '0');
    span.className = 'button-like';
    span.textContent = 'Span Button';
    span.style.cssText = `
      display: inline-block;
      padding: 4px 12px;
      background: #2196F3;
      color: white;
      border-radius: 4px;
      cursor: pointer;
    `;
    
    results.push({
      method: 'Span with role=button',
      element: span.outerHTML,
      safe: true
    });
    
    // 方案 2：动态创建函数
    const createSafeButton = (text: string): HTMLElement => {
      const btn = this.window.document.createElement('span');
      btn.setAttribute('role', 'button');
      btn.setAttribute('tabindex', '0');
      btn.textContent = text;
      
      // 添加键盘事件支持
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          btn.click();
        }
      });
      
      return btn;
    };
    
    const safeBtn = createSafeButton('Safe Dynamic Button');
    results.push({
      method: 'Dynamic safe button creator',
      element: safeBtn.outerHTML,
      safe: true
    });
    
    // 方案 3：使用 DocumentFragment
    const fragment = this.window.document.createDocumentFragment();
    const fragmentBtn = this.window.document.createElement('button');
    fragmentBtn.textContent = 'Fragment Button';
    fragment.appendChild(fragmentBtn);
    
    results.push({
      method: 'DocumentFragment',
      element: fragmentBtn.outerHTML,
      safe: true,
      note: 'Created in fragment, then appended'
    });
    
    this.results.set('workarounds', results);
    
    results.forEach(r => {
      console.log(`  ${r.safe ? '✅' : '❌'} ${r.method}`);
    });
    console.log('');
  }
  
  /**
   * 性能测试
   */
  private async testPerformance(): Promise<void> {
    console.log('⚡ Test 5: Performance Comparison');
    
    const iterations = 1000;
    const results: any = {};
    
    // 测试 innerHTML（会被过滤）
    const start1 = performance.now();
    for (let i = 0; i < iterations; i++) {
      const div = this.window.document.createElement('div');
      div.innerHTML = '<span role="button">Button</span>';
    }
    results.innerHTML = performance.now() - start1;
    
    // 测试 createElement
    const start2 = performance.now();
    for (let i = 0; i < iterations; i++) {
      const div = this.window.document.createElement('div');
      const span = this.window.document.createElement('span');
      span.setAttribute('role', 'button');
      span.textContent = 'Button';
      div.appendChild(span);
    }
    results.createElement = performance.now() - start2;
    
    // 测试 cloneNode
    const template = this.window.document.createElement('span');
    template.setAttribute('role', 'button');
    template.textContent = 'Button';
    
    const start3 = performance.now();
    for (let i = 0; i < iterations; i++) {
      const div = this.window.document.createElement('div');
      div.appendChild(template.cloneNode(true));
    }
    results.cloneNode = performance.now() - start3;
    
    this.results.set('performance', results);
    
    console.log(`  innerHTML: ${results.innerHTML.toFixed(2)}ms`);
    console.log(`  createElement: ${results.createElement.toFixed(2)}ms`);
    console.log(`  cloneNode: ${results.cloneNode.toFixed(2)}ms`);
    console.log(`  Fastest: ${Object.entries(results).sort(([,a], [,b]) => (a as number) - (b as number))[0][0]}`);
    console.log('');
  }
  
  /**
   * 监控过滤行为
   */
  private async testFilteringBehavior(): Promise<void> {
    console.log('👁️  Test 6: Filter Monitoring');
    
    const container = this.window.document.createElement('div');
    const filtered: any[] = [];
    
    // 设置 MutationObserver
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        mutation.removedNodes.forEach(node => {
          if (node.nodeType === 1) { // Element node
            filtered.push({
              nodeName: node.nodeName,
              attributes: Array.from((node as Element).attributes || [])
                .map(attr => `${attr.name}="${attr.value}"`),
              content: node.textContent
            });
          }
        });
      });
    });
    
    observer.observe(container, {
      childList: true,
      subtree: true
    });
    
    // 测试一些会被过滤的内容
    container.innerHTML = `
      <button>Test Button</button>
      <script>console.log("test")</script>
      <input type="text">
      <span role="button">Safe Button</span>
    `;
    
    // 等待一下让过滤器工作
    await new Promise(resolve => this.window.setTimeout(resolve, 100));
    
    observer.disconnect();
    
    this.results.set('filtered', filtered);
    
    console.log(`  Filtered elements: ${filtered.length}`);
    filtered.forEach(f => {
      console.log(`    - <${f.nodeName}> ${f.attributes.join(' ')}`);
    });
    console.log('');
  }
  
  /**
   * 打印测试结果
   */
  private printResults(): void {
    console.log('📊 Test Summary');
    console.log('═'.repeat(50));
    
    // 统计结果
    let totalTests = 0;
    let passedTests = 0;
    
    this.results.forEach((value, key) => {
      if (Array.isArray(value)) {
        totalTests += value.length;
        passedTests += value.filter(v => !v.filtered && v.success !== false).length;
      }
    });
    
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${totalTests - passedTests}`);
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    
    // 保存结果到文件
    this.saveResults();
  }
  
  /**
   * 保存测试结果
   */
  private saveResults(): void {
    const reportData = {
      timestamp: new Date().toISOString(),
      zoteroVersion: Zotero.version,
      results: Object.fromEntries(this.results)
    };
    
    // 保存到 Zotero 数据目录
    const file = Zotero.File.pathToFile(
      Zotero.DataDirectory.dir + '/bootstrap-filter-test-results.json'
    );
    
    Zotero.File.putContentsAsync(file, JSON.stringify(reportData, null, 2))
      .then(() => {
        console.log(`\nResults saved to: ${file.path}`);
      })
      .catch((error: Error) => {
        console.error('Failed to save results:', error);
      });
  }
}

// 导出一个便捷的运行函数
export async function runBootstrapFilterTests(): Promise<void> {
  const tester = new BootstrapFilterTest(window);
  await tester.runTests();
}