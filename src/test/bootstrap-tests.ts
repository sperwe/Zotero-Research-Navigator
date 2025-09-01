/**
 * Bootstrap Filter Tests - Plugin Integration
 * 这个文件会被编译到插件中，可以在 Zotero 控制台直接调用
 */

// import { runBootstrapTestSuite } from '../../test/bootstrap-filter/test-runner';
// import { startGlobalMonitoring, stopGlobalMonitoring } from '../../test/bootstrap-filter/monitor-tool';

// Stub functions since test files were removed
function runBootstrapTestSuite(): void {
  Zotero.log("[Bootstrap Tests] Test suite has been removed", "warn");
}

function startGlobalMonitoring(): void {
  Zotero.log("[Bootstrap Tests] Monitoring tool has been removed", "warn");
}

function stopGlobalMonitoring(): void {
  Zotero.log("[Bootstrap Tests] Monitoring tool has been removed", "warn");
}

export class BootstrapTests {
  static instance: BootstrapTests | null = null;

  static getInstance(): BootstrapTests {
    if (!BootstrapTests.instance) {
      BootstrapTests.instance = new BootstrapTests();
    }
    return BootstrapTests.instance;
  }

  /**
   * 运行完整测试套件
   */
  async runFullTests(): Promise<void> {
    console.log("🧪 Running Bootstrap Filter Tests...");
    await runBootstrapTestSuite();
  }

  /**
   * 运行快速测试
   */
  runQuickTest(): void {
    console.log("⚡ Quick Bootstrap Filter Test");
    console.log("-".repeat(40));

    const doc = window.document;
    const results: any = {};

    // Test 1: Button
    const btnContainer = doc.createElement("div");
    btnContainer.innerHTML = "<button>Test</button>";
    results.button = !btnContainer.querySelector("button");

    // Test 2: Input
    const inputContainer = doc.createElement("div");
    inputContainer.innerHTML = '<input type="text">';
    results.inputUnclosed = !inputContainer.querySelector("input");

    inputContainer.innerHTML = '<input type="text" />';
    results.inputClosed = !inputContainer.querySelector("input");

    // Test 3: Script
    const scriptContainer = doc.createElement("div");
    scriptContainer.innerHTML = "<script>alert(1)</script>";
    results.script = !scriptContainer.querySelector("script");

    // Test 4: Event handler
    const eventContainer = doc.createElement("div");
    eventContainer.innerHTML = '<div onclick="alert(1)">Click</div>';
    const hasOnclick =
      eventContainer.firstElementChild?.hasAttribute("onclick");
    results.eventHandler = !hasOnclick;

    // Output results
    console.log("Results:");
    Object.entries(results).forEach(([test, filtered]) => {
      console.log(
        `  ${test}: ${filtered ? "🚫 FILTERED" : "⚠️  NOT FILTERED"}`,
      );
    });

    console.log(
      "\nRecommendation: Use safe alternatives for filtered elements.",
    );
  }

  /**
   * 开始监控
   */
  startMonitoring(): void {
    console.log("👁️  Starting Bootstrap filter monitoring...");
    console.log(
      "Perform actions and then call stopMonitoring() to see results.",
    );
    startGlobalMonitoring();
  }

  /**
   * 停止监控
   */
  stopMonitoring(): void {
    const data = stopGlobalMonitoring();
    if (data) {
      console.log("📊 Monitoring stopped. Results:", data);
    } else {
      console.log("⚠️  No monitoring session was active.");
    }
  }

  /**
   * 测试特定组件
   */
  testComponent(componentName: string): void {
    console.log(`🔍 Testing ${componentName}...`);

    const tests: Record<string, () => void> = {
      QuickNoteButton: this.testQuickNoteButton.bind(this),
      MainPanel: this.testMainPanel.bind(this),
      HistoryTree: this.testHistoryTree.bind(this),
      NoteRelations: this.testNoteRelations.bind(this),
    };

    const test = tests[componentName];
    if (test) {
      test();
    } else {
      console.log(`❌ Unknown component: ${componentName}`);
      console.log("Available components:", Object.keys(tests).join(", "));
    }
  }

  private testQuickNoteButton(): void {
    const doc = window.document;
    console.log("\nTesting Quick Note Button implementations:\n");

    // Unsafe version
    const unsafe = doc.createElement("div");
    unsafe.innerHTML = '<button class="quick-note">📝</button>';
    console.log("❌ Unsafe: <button> element");
    console.log("   Result:", unsafe.innerHTML || "[FILTERED]");

    // Safe version
    const safe = doc.createElement("div");
    const btn = doc.createElement("span");
    btn.setAttribute("role", "button");
    btn.setAttribute("tabindex", "0");
    btn.className = "quick-note";
    btn.textContent = "📝";
    safe.appendChild(btn);
    console.log('\n✅ Safe: <span role="button">');
    console.log("   Result:", safe.innerHTML);
  }

  private testMainPanel(): void {
    console.log("\nTesting Main Panel controls:\n");

    const controls = ["close", "minimize", "dock"];
    controls.forEach((action) => {
      console.log(`${action} button:`);
      console.log(`  ❌ <button class="${action}">X</button>`);
      console.log(`  ✅ <span role="button" class="${action}">X</span>`);
    });
  }

  private testHistoryTree(): void {
    console.log("\nTesting History Tree nodes:\n");

    console.log("Delete button implementations:");
    console.log('  ❌ <button onclick="deleteNode()">Delete</button>');
    console.log('  ✅ <span role="button" data-action="delete">Delete</span>');
    console.log('     with: element.addEventListener("click", deleteNode)');
  }

  private testNoteRelations(): void {
    console.log("\nTesting Note Relations UI:\n");

    console.log("Note card actions:");
    console.log(
      "  ❌ Inline buttons: <button>Edit</button><button>Delete</button>",
    );
    console.log("  ✅ Context menu: right-click → Edit, Delete, etc.");
    console.log(
      '  ✅ Icon buttons: <span role="button" class="icon-edit">✏️</span>',
    );
  }

  /**
   * 显示帮助信息
   */
  showHelp(): void {
    console.log(`
🧪 Bootstrap Filter Test Commands
=================================

Available commands in Zotero console:

1. Run full test suite:
   Zotero.ResearchNavigator.runBootstrapTests()

2. Quick test:
   Zotero.ResearchNavigator.quickBootstrapTest()

3. Start monitoring:
   Zotero.ResearchNavigator.startFilterMonitor()
   // ... perform actions ...
   Zotero.ResearchNavigator.stopFilterMonitor()

4. Test specific component:
   Zotero.ResearchNavigator.testComponent('QuickNoteButton')
   Zotero.ResearchNavigator.testComponent('MainPanel')
   Zotero.ResearchNavigator.testComponent('HistoryTree')
   Zotero.ResearchNavigator.testComponent('NoteRelations')

5. Show this help:
   Zotero.ResearchNavigator.bootstrapHelp()

💡 Tips:
- Check browser console for detailed logs
- Test results are saved to Zotero data directory
- Use monitoring to catch unexpected filtering
    `);
  }
}

// 注册到全局 Zotero 对象
export function registerBootstrapTests(): void {
  if (typeof Zotero !== "undefined") {
    Zotero.ResearchNavigator = Zotero.ResearchNavigator || {};

    const tests = BootstrapTests.getInstance();

    // 注册测试函数
    Zotero.ResearchNavigator.runBootstrapTests = () => tests.runFullTests();
    Zotero.ResearchNavigator.quickBootstrapTest = () => tests.runQuickTest();
    Zotero.ResearchNavigator.startFilterMonitor = () => tests.startMonitoring();
    Zotero.ResearchNavigator.stopFilterMonitor = () => tests.stopMonitoring();
    Zotero.ResearchNavigator.testComponent = (name: string) =>
      tests.testComponent(name);
    Zotero.ResearchNavigator.bootstrapHelp = () => tests.showHelp();

    console.log(
      "✅ Bootstrap tests registered. Type Zotero.ResearchNavigator.bootstrapHelp() for commands.",
    );
  }
}
