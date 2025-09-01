// 测试插件功能的脚本
const mockEnv = require("./mock-zotero-env.cjs");
const fs = require("fs");
const path = require("path");

// 使用模拟环境
const { Zotero, Services, ChromeUtils, Components, window, document } = mockEnv;

// 设置全局变量
global.Zotero = Zotero;
global.Services = Services;
global.ChromeUtils = ChromeUtils;
global.Components = Components;
global.Ci = Components.interfaces;
global.window = window;

// 加载编译后的代码
console.log("\n=== 加载插件代码 ===");
const bootstrapCode = fs.readFileSync(
  path.join(__dirname, "../build/addon/bootstrap-compiled.js"),
  "utf8",
);

// 执行代码
eval(bootstrapCode);

// 测试插件功能
async function testPlugin() {
  console.log("\n=== 测试插件启动 ===");

  // 启动插件
  await window.startup(
    {
      id: "test@example.com",
      version: "2.1.0",
      rootURI: "chrome://test/",
    },
    "startup",
  );

  console.log("\n=== 检查核心组件 ===");
  console.log("Zotero.ResearchNavigator:", typeof Zotero.ResearchNavigator);

  if (Zotero.ResearchNavigator) {
    console.log("- initialized:", Zotero.ResearchNavigator.initialized);
    console.log("- historyService:", !!Zotero.ResearchNavigator.historyService);
    console.log("- uiManager:", !!Zotero.ResearchNavigator.uiManager);
    console.log(
      "- databaseService:",
      !!Zotero.ResearchNavigator.databaseService,
    );
    console.log(
      "- noteAssociationSystem:",
      !!Zotero.ResearchNavigator.noteAssociationSystem,
    );
    console.log(
      "- closedTabsManager:",
      !!Zotero.ResearchNavigator.closedTabsManager,
    );
  }

  console.log("\n=== 模拟用户操作 ===");

  // 模拟选择文献
  console.log("1. 模拟选择文献...");
  const mockItem = {
    id: 123,
    getField: (field) => (field === "title" ? "Test Article" : ""),
    isNote: () => false,
  };

  // 添加到模拟的 Items
  Zotero.Items._items.set(123, mockItem);

  // 触发 item select 事件
  if (Zotero.Notifier._observers.length > 0) {
    console.log("   - 找到 " + Zotero.Notifier._observers.length + " 个观察者");
    for (const observer of Zotero.Notifier._observers) {
      if (observer.notify) {
        console.log("   - 触发 item select 事件");
        await observer.notify("select", "item", [123], {});
      }
    }
  } else {
    console.log("   ❌ 没有找到事件观察者！");
  }

  // 检查历史服务
  console.log("\n2. 检查历史服务状态...");
  if (Zotero.ResearchNavigator && Zotero.ResearchNavigator.historyService) {
    const historyService = Zotero.ResearchNavigator.historyService;
    console.log("   - currentSessionId:", historyService.currentSessionId);
    console.log("   - nodeCache size:", historyService.nodeCache?.size || 0);
    console.log("   - sessions:", historyService.getAllSessions());
  }

  // 检查 UI 组件
  console.log("\n3. 检查 UI 组件...");
  const toolbarButton = document.getElementById("research-navigator-button");
  console.log("   - 工具栏按钮:", !!toolbarButton);

  const mainPanel = document.getElementById("research-navigator-main-panel");
  console.log("   - 主面板:", !!mainPanel);

  // 模拟点击工具栏按钮
  if (toolbarButton) {
    console.log("   - 模拟点击工具栏按钮...");
    toolbarButton.click();

    // 检查面板是否显示
    const panelVisible = mainPanel && mainPanel.style.display !== "none";
    console.log("   - 面板可见:", panelVisible);
  }

  console.log("\n=== 测试完成 ===");
}

// 运行测试
testPlugin().catch(console.error);
