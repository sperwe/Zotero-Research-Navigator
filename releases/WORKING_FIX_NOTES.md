# 工作版本修复说明 - v2.0.3-working-fix

## 修复基于的理解

基于另一个 agent 提供的 Zotero 7 插件系统深度分析，这个版本实现了正确的插件架构。

## 关键修复

### 1. Bootstrap 函数在全局作用域
所有 bootstrap 函数（startup、shutdown、onMainWindowLoad 等）都直接定义在全局作用域，而不是在模块或对象中。

### 2. 正确使用 window 参数
```javascript
function onMainWindowLoad(params, reason) {
    const { window } = params;  // 从参数中解构出真实的 window
    // 使用这个 window 来创建 UI
}
```

### 3. 多重日志输出
使用三种日志方法确保能看到输出：
- `Zotero.debug()` - Zotero 的调试日志
- `dump()` - 控制台输出
- `Services.console.logStringMessage()` - 错误控制台

### 4. 多种 UI 元素
为确保至少有一个可见的 UI 元素：
- **红色测试按钮**（右上角固定位置）
- **工具栏按钮**（尝试多个工具栏位置）
- **工具菜单项**（工具 → Research Navigator）
- **右键菜单项**（文献和集合）

## 预期效果

安装插件后应该看到：

1. **红色测试按钮**
   - 位置：右上角
   - 标签：📚 RN
   - 点击显示插件信息

2. **工具栏按钮**
   - 标签：RN
   - 提示：Research Navigator - Click to open

3. **工具菜单**
   - 位置：工具 → Research Navigator
   - 快捷键：Alt+R

4. **右键菜单**
   - 文献右键：View in Research Navigator
   - 集合右键：View Collection History

5. **首次加载提示**
   - 首次加载时会显示欢迎对话框

## 调试方法

### 查看日志
1. **控制台输出**（需要从命令行启动 Zotero）
   ```bash
   # Windows
   zotero.exe -console
   
   # Mac/Linux
   zotero -console
   ```

2. **错误控制台**
   - 工具 → 开发者 → 错误控制台
   - 查找 `[ResearchNavigator]` 开头的消息

### 验证插件加载
在错误控制台底部输入：
```javascript
Zotero.ResearchNavigator
```
应该返回插件对象。

## 技术细节

### Sandbox 隔离处理
- 插件在 Cu.Sandbox 中运行
- 没有直接的 window/document 访问
- 必须使用 onMainWindowLoad 传入的 window 参数

### UI 元素创建
- 使用 `createXULElement()` 创建 XUL 元素
- 使用 `createElement()` 创建 HTML 元素（如测试按钮）
- 尝试多个父元素确保添加成功

### 窗口管理
- 追踪所有打开的窗口
- 在窗口关闭时清理 UI
- 支持多窗口环境

## 如果还是看不到 UI

1. 检查 Zotero 版本（需要 7.0 或更高）
2. 查看错误控制台的错误信息
3. 确认插件已启用
4. 尝试重启 Zotero

---
版本：v2.0.3-working-fix
日期：2025-01-27
基于：Zotero 7 插件系统深度分析