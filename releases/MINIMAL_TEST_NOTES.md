# 最小化测试版本 - v2.0.3-minimal-test

## 目的
这是一个极简的测试版本，用于诊断为什么插件没有显示任何 UI 元素。

## 测试内容

这个版本会尝试多种方法来显示插件已加载：

1. **日志输出** - 使用 `dump()` 输出到控制台
2. **红色测试按钮** - 右上角的红色按钮
3. **工具菜单项** - "RN Minimal Test"
4. **延迟提示** - 3秒后显示提示框
5. **Zotero 属性** - 设置 `Zotero.ResearchNavigatorTest`

## 测试步骤

### 1. 启动 Zotero 时查看控制台
在命令行启动 Zotero，查看输出：
```bash
# Windows
zotero.exe -console

# Mac/Linux  
zotero -console
```

应该看到类似输出：
```
[RN-MIN] === STARTUP BEGIN ===
[RN-MIN] ID: research-navigator@zotero.org
[RN-MIN] Version: 2.0.3
```

### 2. 检查错误控制台
工具 → 开发者 → 错误控制台

查找 `[RN-MIN]` 开头的消息

### 3. 查看 UI 元素
- **右上角**：应该有一个红色的 "RN-MIN TEST" 按钮
- **工具菜单**：应该有 "RN Minimal Test" 菜单项
- **3秒后**：应该弹出提示框

### 4. 在控制台测试
打开错误控制台，在底部输入：
```javascript
Zotero.ResearchNavigatorTest
```
如果返回对象，说明插件已加载

### 5. 检查首选项
```javascript
Zotero.Prefs.get("extensions.researchnavigator.minimal.loaded")
```
应该返回 `true`

## 如果什么都看不到

1. **确认插件已启用**
   - 工具 → 附加组件
   - 确保 "Zotero Research Navigator" 已启用

2. **查看启动日志**
   - 必须从命令行启动 Zotero 才能看到 dump() 输出
   - 查找任何 `[RN-MIN] ERROR` 消息

3. **检查 Zotero 版本**
   - 这个插件需要 Zotero 6.0.27 或更高版本

4. **报告问题时提供**
   - Zotero 版本
   - 操作系统
   - 控制台输出（特别是错误信息）
   - 错误控制台的截图

## 技术细节

这个最小化版本：
- 不依赖任何外部脚本
- 直接在 bootstrap.js 中定义所有功能
- 使用多种日志方法（dump, Services.console, Zotero.debug）
- 尝试多种 UI 插入方法
- 不使用复杂的模块系统

如果这个版本也不工作，可能是：
1. Zotero 的插件 API 发生了变化
2. 权限或安全限制
3. bootstrap.js 没有被正确执行

---
版本：v2.0.3-minimal-test
日期：2025-01-27
文件：zotero-research-navigator-v2.0.3-minimal-test.xpi