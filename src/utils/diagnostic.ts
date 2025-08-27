/**
 * Diagnostic utility for Research Navigator
 * 提供详细的运行时诊断和验证功能
 */

import { config, version } from "../../package.json";

export interface DiagnosticInfo {
  timestamp: number;
  phase: string;
  success: boolean;
  details: any;
  error?: Error;
}

export class DiagnosticTool {
  private static instance: DiagnosticTool;
  private diagnosticLog: DiagnosticInfo[] = [];
  private startTime: number;

  private constructor() {
    this.startTime = Date.now();
  }

  static getInstance(): DiagnosticTool {
    if (!DiagnosticTool.instance) {
      DiagnosticTool.instance = new DiagnosticTool();
    }
    return DiagnosticTool.instance;
  }

  /**
   * 记录诊断信息
   */
  log(phase: string, success: boolean, details: any, error?: Error): void {
    const info: DiagnosticInfo = {
      timestamp: Date.now() - this.startTime,
      phase,
      success,
      details,
      error
    };

    this.diagnosticLog.push(info);

    // 输出到控制台
    const prefix = `[${config.addonName} Diagnostic]`;
    const timeStr = `+${info.timestamp}ms`;
    const statusStr = success ? "✓" : "✗";
    
    if (typeof Zotero !== "undefined" && Zotero.debug) {
      Zotero.debug(`${prefix} ${timeStr} ${statusStr} ${phase}: ${JSON.stringify(details)}`);
      if (error) {
        Zotero.debug(`${prefix} Error: ${error.message}\n${error.stack}`);
      }
    } else {
      console.log(`${prefix} ${timeStr} ${statusStr} ${phase}:`, details);
      if (error) {
        console.error(`${prefix} Error:`, error);
      }
    }
  }

  /**
   * 验证 Zotero 环境
   */
  async validateEnvironment(): Promise<boolean> {
    const checks = [
      {
        name: "Zotero object",
        test: () => typeof Zotero !== "undefined" && Zotero !== null
      },
      {
        name: "Zotero version",
        test: () => {
          if (typeof Zotero !== "undefined" && Zotero.version) {
            const version = Zotero.version;
            const major = parseInt(version.split('.')[0]);
            return major >= 7;
          }
          return false;
        }
      },
      {
        name: "Services",
        test: () => typeof Services !== "undefined"
      },
      {
        name: "ChromeUtils",
        test: () => typeof ChromeUtils !== "undefined"
      },
      {
        name: "Components",
        test: () => typeof Components !== "undefined"
      }
    ];

    let allPassed = true;

    for (const check of checks) {
      try {
        const passed = check.test();
        this.log(`Environment check: ${check.name}`, passed, {
          check: check.name,
          passed
        });
        if (!passed) allPassed = false;
      } catch (error) {
        this.log(`Environment check: ${check.name}`, false, {
          check: check.name,
          error: error.message
        }, error as Error);
        allPassed = false;
      }
    }

    return allPassed;
  }

  /**
   * 验证窗口对象
   */
  validateWindow(win: any): boolean {
    const checks = [
      {
        name: "Window object exists",
        test: () => win !== null && win !== undefined
      },
      {
        name: "Window document",
        test: () => win.document !== null && win.document !== undefined
      },
      {
        name: "Window location",
        test: () => win.location && win.location.href
      },
      {
        name: "Is main Zotero window",
        test: () => win.location.href === "chrome://zotero/content/zotero.xhtml"
      },
      {
        name: "Document ready state",
        test: () => win.document.readyState === "complete"
      }
    ];

    let allPassed = true;

    for (const check of checks) {
      try {
        const passed = check.test();
        this.log(`Window check: ${check.name}`, passed, {
          check: check.name,
          passed,
          details: check.name === "Window location" && win.location ? win.location.href : undefined
        });
        if (!passed) allPassed = false;
      } catch (error) {
        this.log(`Window check: ${check.name}`, false, {
          check: check.name,
          error: error.message
        }, error as Error);
        allPassed = false;
      }
    }

    return allPassed;
  }

  /**
   * 验证 UI 元素
   */
  validateUIElements(doc: Document): void {
    const elements = [
      { id: "zotero-tb-advanced-search", name: "Search toolbar" },
      { id: "zotero-items-toolbar", name: "Items toolbar" },
      { id: "zotero-toolbar", name: "Main toolbar" },
      { id: "zotero-pane", name: "Zotero pane" },
      { id: "zotero-items-tree", name: "Items tree" }
    ];

    for (const elem of elements) {
      const exists = doc.getElementById(elem.id) !== null;
      this.log(`UI element check: ${elem.name}`, exists, {
        id: elem.id,
        name: elem.name,
        exists
      });
    }
  }

  /**
   * 测量性能
   */
  measurePerformance(operation: string, fn: () => any): any {
    const startTime = performance.now();
    let result;
    let error;

    try {
      result = fn();
    } catch (e) {
      error = e;
    }

    const duration = performance.now() - startTime;

    this.log(`Performance: ${operation}`, !error, {
      operation,
      duration: `${duration.toFixed(2)}ms`,
      error: error?.message
    }, error as Error);

    if (error) throw error;
    return result;
  }

  /**
   * 获取诊断报告
   */
  generateReport(): string {
    const report = {
      plugin: {
        name: config.addonName,
        version: version || "unknown",
        id: config.addonID
      },
      environment: {
        zoteroVersion: typeof Zotero !== "undefined" ? Zotero.version : "unknown",
        platform: typeof Zotero !== "undefined" ? Zotero.platform : "unknown"
      },
      diagnosticLog: this.diagnosticLog,
      summary: {
        totalChecks: this.diagnosticLog.length,
        passed: this.diagnosticLog.filter(d => d.success).length,
        failed: this.diagnosticLog.filter(d => !d.success).length,
        totalTime: Date.now() - this.startTime
      }
    };

    return JSON.stringify(report, null, 2);
  }

  /**
   * 清除日志
   */
  clear(): void {
    this.diagnosticLog = [];
    this.startTime = Date.now();
  }
}

// 导出单例
export const diagnostic = DiagnosticTool.getInstance();