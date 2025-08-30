/**
 * Bootstrap Filter Monitor Tool
 * 实时监控 DOM 变化，捕获被过滤的元素
 */

export class BootstrapFilterMonitor {
  private observer: MutationObserver | null = null;
  private filteredElements: Map<string, any[]> = new Map();
  private isMonitoring: boolean = false;
  private startTime: number = 0;
  
  constructor(private window: Window) {}
  
  /**
   * 开始监控
   */
  start(targetElement?: Element): void {
    if (this.isMonitoring) {
      console.warn('Monitor is already running');
      return;
    }
    
    const target = targetElement || this.window.document.body;
    this.startTime = Date.now();
    this.filteredElements.clear();
    
    console.log('🔍 Bootstrap Filter Monitor Started');
    console.log(`Target: ${target.tagName}#${target.id || 'no-id'}`);
    console.log('-'.repeat(50));
    
    // 创建观察器
    this.observer = new MutationObserver((mutations) => {
      this.processMutations(mutations);
    });
    
    // 配置观察选项
    const config: MutationObserverInit = {
      childList: true,
      subtree: true,
      attributes: true,
      attributeOldValue: true,
      characterData: false
    };
    
    // 开始观察
    this.observer.observe(target, config);
    this.isMonitoring = true;
    
    // 添加实时日志
    this.setupRealtimeLogging();
  }
  
  /**
   * 停止监控
   */
  stop(): void {
    if (!this.isMonitoring) {
      return;
    }
    
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    
    this.isMonitoring = false;
    const duration = Date.now() - this.startTime;
    
    console.log('\n🛑 Monitor Stopped');
    console.log(`Duration: ${duration}ms`);
    this.generateReport();
  }
  
  /**
   * 处理 DOM 变化
   */
  private processMutations(mutations: MutationRecord[]): void {
    mutations.forEach(mutation => {
      // 处理被移除的节点
      if (mutation.type === 'childList' && mutation.removedNodes.length > 0) {
        mutation.removedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            this.recordFilteredElement(node as Element, mutation);
          }
        });
      }
      
      // 处理属性变化（某些属性可能被移除）
      if (mutation.type === 'attributes') {
        const target = mutation.target as Element;
        const attrName = mutation.attributeName;
        const oldValue = mutation.oldValue;
        
        if (oldValue && !target.getAttribute(attrName!)) {
          this.recordFilteredAttribute(target, attrName!, oldValue);
        }
      }
    });
  }
  
  /**
   * 记录被过滤的元素
   */
  private recordFilteredElement(element: Element, mutation: MutationRecord): void {
    const info = {
      timestamp: Date.now() - this.startTime,
      tagName: element.tagName.toLowerCase(),
      id: element.id,
      className: element.className,
      attributes: this.getElementAttributes(element),
      innerHTML: element.innerHTML.substring(0, 100),
      parentElement: mutation.target.nodeName,
      reason: this.detectFilterReason(element)
    };
    
    const key = info.tagName;
    if (!this.filteredElements.has(key)) {
      this.filteredElements.set(key, []);
    }
    this.filteredElements.get(key)!.push(info);
    
    // 实时输出
    console.log(`❌ [${info.timestamp}ms] Filtered: <${info.tagName}> - ${info.reason}`);
  }
  
  /**
   * 记录被过滤的属性
   */
  private recordFilteredAttribute(element: Element, attrName: string, oldValue: string): void {
    const info = {
      timestamp: Date.now() - this.startTime,
      element: element.tagName.toLowerCase(),
      attribute: attrName,
      oldValue: oldValue,
      reason: this.detectAttributeFilterReason(attrName, oldValue)
    };
    
    if (!this.filteredElements.has('attributes')) {
      this.filteredElements.set('attributes', []);
    }
    this.filteredElements.get('attributes')!.push(info);
    
    console.log(`⚠️  [${info.timestamp}ms] Attribute removed: ${attrName}="${oldValue}" from <${info.element}>`);
  }
  
  /**
   * 获取元素的所有属性
   */
  private getElementAttributes(element: Element): Record<string, string> {
    const attrs: Record<string, string> = {};
    Array.from(element.attributes).forEach(attr => {
      attrs[attr.name] = attr.value;
    });
    return attrs;
  }
  
  /**
   * 检测过滤原因
   */
  private detectFilterReason(element: Element): string {
    const tagName = element.tagName.toLowerCase();
    const attrs = this.getElementAttributes(element);
    
    // 常见的过滤原因
    if (['script', 'iframe', 'object', 'embed'].includes(tagName)) {
      return 'Potentially dangerous tag';
    }
    
    if (tagName === 'button') {
      return 'Interactive form element';
    }
    
    if (tagName === 'input' && !element.outerHTML.includes('/>')) {
      return 'Unclosed input tag';
    }
    
    // 检查危险属性
    const dangerousAttrs = ['onclick', 'onload', 'onerror', 'onmouseover'];
    for (const attr of dangerousAttrs) {
      if (attrs[attr]) {
        return `Inline event handler: ${attr}`;
      }
    }
    
    if (attrs.href && attrs.href.startsWith('javascript:')) {
      return 'JavaScript URL';
    }
    
    return 'Unknown reason';
  }
  
  /**
   * 检测属性过滤原因
   */
  private detectAttributeFilterReason(attrName: string, value: string): string {
    if (attrName.startsWith('on')) {
      return 'Event handler attribute';
    }
    
    if (attrName === 'href' && value.startsWith('javascript:')) {
      return 'JavaScript URL';
    }
    
    if (attrName === 'src' && value.startsWith('data:')) {
      return 'Data URL';
    }
    
    return 'Security policy';
  }
  
  /**
   * 设置实时日志
   */
  private setupRealtimeLogging(): void {
    // 劫持 innerHTML 设置以捕获更多信息
    const originalInnerHTML = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
    if (originalInnerHTML && originalInnerHTML.set) {
      const monitor = this;
      Object.defineProperty(Element.prototype, 'innerHTML', {
        set: function(value: string) {
          const before = this.innerHTML;
          originalInnerHTML.set!.call(this, value);
          const after = this.innerHTML;
          
          if (before !== after && value !== after) {
            console.log(`🔍 innerHTML filtered:`, {
              element: this.tagName,
              intended: value.substring(0, 100) + '...',
              actual: after.substring(0, 100) + '...'
            });
          }
        },
        get: originalInnerHTML.get,
        configurable: true
      });
    }
  }
  
  /**
   * 生成报告
   */
  private generateReport(): void {
    console.log('\n📊 Filter Report');
    console.log('='.repeat(50));
    
    if (this.filteredElements.size === 0) {
      console.log('No elements were filtered during monitoring.');
      return;
    }
    
    // 按标签统计
    console.log('\nFiltered Elements by Tag:');
    this.filteredElements.forEach((elements, tag) => {
      if (tag !== 'attributes') {
        console.log(`  ${tag}: ${elements.length} occurrences`);
        
        // 显示唯一的过滤原因
        const reasons = new Set(elements.map(e => e.reason));
        reasons.forEach(reason => {
          console.log(`    - ${reason}`);
        });
      }
    });
    
    // 属性过滤统计
    const attrFilters = this.filteredElements.get('attributes');
    if (attrFilters && attrFilters.length > 0) {
      console.log('\nFiltered Attributes:');
      const attrCounts = new Map<string, number>();
      attrFilters.forEach(af => {
        const key = `${af.attribute} (${af.reason})`;
        attrCounts.set(key, (attrCounts.get(key) || 0) + 1);
      });
      
      attrCounts.forEach((count, attr) => {
        console.log(`  ${attr}: ${count} occurrences`);
      });
    }
    
    // 时间线
    console.log('\nTimeline of Filtered Elements:');
    const allEvents = Array.from(this.filteredElements.values()).flat();
    allEvents.sort((a, b) => a.timestamp - b.timestamp);
    allEvents.slice(0, 10).forEach(event => {
      console.log(`  ${event.timestamp}ms: <${event.tagName || event.element}> - ${event.reason}`);
    });
    
    if (allEvents.length > 10) {
      console.log(`  ... and ${allEvents.length - 10} more events`);
    }
  }
  
  /**
   * 导出数据
   */
  exportData(): any {
    return {
      duration: Date.now() - this.startTime,
      filteredElements: Object.fromEntries(this.filteredElements),
      summary: {
        totalFiltered: Array.from(this.filteredElements.values()).flat().length,
        byTag: Object.fromEntries(
          Array.from(this.filteredElements.entries())
            .filter(([k]) => k !== 'attributes')
            .map(([k, v]) => [k, v.length])
        )
      }
    };
  }
}

// 创建全局监控实例
let globalMonitor: BootstrapFilterMonitor | null = null;

/**
 * 开始全局监控
 */
export function startGlobalMonitoring(): void {
  if (!globalMonitor) {
    globalMonitor = new BootstrapFilterMonitor(window);
  }
  globalMonitor.start();
}

/**
 * 停止全局监控
 */
export function stopGlobalMonitoring(): any {
  if (globalMonitor) {
    globalMonitor.stop();
    const data = globalMonitor.exportData();
    globalMonitor = null;
    return data;
  }
  return null;
}