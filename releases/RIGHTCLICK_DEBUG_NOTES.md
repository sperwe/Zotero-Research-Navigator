# 右键菜单和调试版本 - v2.0.3-rightclick-debug

## 新增功能

### 1. 增强的右键菜单
在文献条目上右键点击，会看到以下新菜单项：
- **Research Navigator Test** - 简单的测试项，点击显示对话框确认插件工作
- **Show Item History** - 显示选中项目的详细信息
- **View in Research History** - 在历史面板中查看

在集合上右键点击：
- **View Collection History** - 查看集合历史

### 2. 详细的调试日志
所有操作都会记录详细日志，包括：
- `[DEBUG]` - 调试信息
- `[Menu]` - 菜单操作
- `[UIManager]` - UI 管理器操作
- `[Research Navigator]` - 一般信息

## 测试步骤

### 1. 安装插件
1. 下载 `zotero-research-navigator-v2.0.3-rightclick-debug.xpi`
2. 在 Zotero 中：工具 → 附加组件 → 从文件安装附加组件
3. 重启 Zotero

### 2. 打开错误控制台
工具 → 开发者 → 错误控制台

### 3. 测试右键菜单
1. 选择任意文献条目
2. 右键点击
3. 找到 "Research Navigator Test" 并点击
4. 应该看到一个对话框显示 "Plugin is working!"

### 4. 查看调试日志
在错误控制台中查找：
- `[Research Navigator DEBUG]` - bootstrap.js 的日志
- `[DEBUG] onMainWindowLoad called` - 窗口加载日志
- `[Menu] Starting menu registration` - 菜单注册日志
- `[UIManager] Initialize called` - UI 初始化日志

## 预期日志序列

```
[Research Navigator DEBUG] === STARTUP BEGIN ===
[Research Navigator DEBUG] Bootstrap functions exported to global scope
[Research Navigator DEBUG] === MAIN WINDOW LOAD BEGIN ===
[DEBUG] onMainWindowLoad called
[DEBUG] Window location: chrome://zotero/content/zoteroPane.xhtml
[UIManager] Initialize called
[Menu] Starting menu registration...
[Menu] All menu items registered successfully
```

## 故障排查

### 如果看不到右键菜单项：
1. 检查错误控制台是否有错误
2. 查找 `[Menu] Error registering menu items` 消息
3. 确认选中了文献条目再右键

### 如果点击菜单没反应：
1. 查看错误控制台的日志
2. 应该看到 `[Menu] Test menu item clicked!`
3. 检查是否有 JavaScript 错误

### 如果完全没有日志：
1. 确认插件已正确安装
2. 检查插件是否启用
3. 尝试重启 Zotero

## 工具菜单

除了右键菜单，还可以通过：
- 工具 → Research Navigator
- 文件 → Export Research History...

## 技术细节

### 菜单注册使用 ztoolkit.Menu.register
- "item" - 文献条目右键菜单
- "collection" - 集合右键菜单
- "menuTools" - 工具菜单
- "menuFile" - 文件菜单

### 对话框使用两种方法
1. `Components.interfaces.nsIPromptService` - 标准对话框
2. `Zotero.alert()` - Zotero 内置对话框

---
版本：v2.0.3-rightclick-debug
日期：2025-01-27
目的：提供可测试的右键菜单和详细调试信息