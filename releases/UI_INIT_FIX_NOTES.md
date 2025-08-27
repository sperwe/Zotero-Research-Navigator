# UI 初始化修复说明 - v2.0.3-ui-init-fix

## 问题描述
用户报告按钮完全看不到，无法使用插件。经过分析发现是因为 Zotero 7 的插件加载机制变化导致 UI 没有正确初始化。

## 根本原因
1. **Zotero 7 不再自动调用 `onMainWindowLoad`**：需要在插件启动时主动初始化 UI
2. **bootstrap.js 的 `onMainWindowLoad` 函数不会被 Zotero 自动调用**：这是 Zotero 7 的重要变化
3. **UI 初始化时机问题**：只在 `onStartup` 中初始化模块，但没有初始化 UI

## 修复方案

### 1. 在 `onStartup` 中主动初始化 UI
```typescript
// 获取主窗口并初始化 UI
const win = Zotero.getMainWindow();
if (win && win.document.readyState === "complete") {
  await moduleManager.initializeUI(win);
} else if (win) {
  // 窗口未就绪，注册加载监听器
  win.addEventListener("load", async () => {
    await moduleManager.initializeUI(win);
  }, { once: true });
}
```

### 2. 添加调试浮动按钮
为确保至少有一个可见的 UI 元素，添加了一个浮动调试按钮：
- 位置：右下角
- 样式：圆形蓝色按钮，显示 "📚 RN"
- 功能：点击打开/关闭历史面板

### 3. 改进的错误处理
- 添加了更详细的日志记录
- UI 组件初始化失败不会阻止其他组件
- 提供了多种 UI 初始化时机的处理

## 测试要点

1. **安装插件后应该能看到**：
   - 右下角的圆形浮动按钮（📚 RN）
   - 工具栏按钮（如果工具栏存在）
   - 菜单项（工具 → Research Navigator）

2. **功能验证**：
   - 点击任何按钮都应该打开/关闭历史面板
   - 快捷键 Ctrl+Shift+H 应该工作
   - 历史记录应该正常追踪

3. **查看日志**：
   - 打开 Zotero 错误控制台
   - 查找 "[Research Navigator]" 开头的日志
   - 应该看到 "UI initialized successfully" 消息

## 已知限制

1. **工具栏按钮可能不显示**：如果 Zotero 的工具栏结构发生变化
2. **浮动按钮是临时解决方案**：确保用户至少能使用插件
3. **需要进一步优化**：根据 Zotero 7 的最佳实践改进 UI 集成

## 建议

如果仍然看不到任何按钮：
1. 重启 Zotero
2. 检查错误控制台的日志
3. 尝试使用快捷键 Ctrl+Shift+H
4. 报告具体的错误信息

---
文件：zotero-research-navigator-v2.0.3-ui-init-fix.xpi
日期：2025-01-27