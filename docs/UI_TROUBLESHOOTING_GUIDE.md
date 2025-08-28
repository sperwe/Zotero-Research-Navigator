# UI Troubleshooting Guide for Research Navigator

## 问题：看不到插件图标和入口

### 快速诊断步骤

1. **检查插件是否正确加载**
   - 打开 Zotero
   - 进入 Tools → Developer → Run JavaScript
   - 运行以下代码：

   ```javascript
   console.log("ResearchNavigator loaded:", typeof Zotero.ResearchNavigator);
   if (Zotero.ResearchNavigator) {
     console.log("Has hooks:", !!Zotero.ResearchNavigator.hooks);
     console.log("Has data:", !!Zotero.ResearchNavigator.data);
   }
   ```

2. **检查可用的工具栏**
   运行以下代码查看哪些工具栏存在：

   ```javascript
   const toolbars = [
     "zotero-items-toolbar",
     "zotero-tb-advanced-search",
     "zotero-toolbar",
     "zotero-tb-actions",
     "nav-bar",
     "zotero-collections-toolbar",
   ];

   toolbars.forEach((id) => {
     const tb = document.getElementById(id);
     console.log(`${id}: ${tb ? "EXISTS" : "NOT FOUND"}`);
     if (tb) {
       console.log(`  - Children: ${tb.children.length}`);
     }
   });
   ```

3. **手动创建测试按钮**
   如果工具栏存在但按钮没有显示，尝试手动创建：
   ```javascript
   const toolbar = document.getElementById("zotero-items-toolbar");
   if (toolbar) {
     const button = document.createXULElement("toolbarbutton");
     button.id = "test-rn-button";
     button.label = "RN Test";
     button.tooltipText = "Research Navigator Test";
     button.style.listStyleImage =
       "url(chrome://zotero/skin/16/universal/add.svg)";
     button.addEventListener("command", () => alert("Button clicked!"));
     toolbar.appendChild(button);
     console.log("Test button added");
   }
   ```

### 已实施的改进

1. **增强的工具栏按钮创建逻辑**
   - 添加了 Zotero 7 专用的按钮创建方法
   - 支持多个工具栏位置的尝试
   - 如果所有工具栏都失败，创建浮动按钮作为后备

2. **调试模式**
   - 在开发模式下自动运行完整诊断
   - 记录所有可用的工具栏和菜单
   - 检查 Chrome URL 注册状态

3. **更好的错误处理**
   - 单个组件失败不会阻止其他组件初始化
   - 详细的错误日志记录

### 临时解决方案

如果图标仍然不显示，可以使用以下方法：

1. **使用快捷键**
   - 默认快捷键：`Ctrl+Shift+H` (Windows/Linux) 或 `Cmd+Shift+H` (Mac)

2. **使用菜单**
   - Tools → Research Navigator
   - 右键菜单 → View in Research History

3. **使用控制台命令**
   ```javascript
   // 打开历史面板
   if (Zotero.ResearchNavigator && Zotero.ResearchNavigator.modules) {
     const uiManager = Zotero.ResearchNavigator.modules.uiManager;
     if (uiManager) {
       uiManager.toggleHistoryPanel(window);
     }
   }
   ```

### 报告问题

如果问题持续存在，请收集以下信息：

1. **错误控制台日志**
   - Tools → Developer → Error Console
   - 查找包含 "Research Navigator" 的错误

2. **诊断信息**
   - 运行上述诊断代码的输出
   - Zotero 版本号
   - 操作系统

3. **截图**
   - Zotero 主界面截图
   - 工具栏区域截图

### 技术说明

Zotero 7 的 UI 结构与之前版本有较大变化：

- 工具栏 ID 可能不同
- XUL 元素逐渐被 HTML 元素替代
- Chrome URL 注册机制可能有变化

插件已经实现了多种兼容性措施，但某些环境下可能仍需要进一步调整。
