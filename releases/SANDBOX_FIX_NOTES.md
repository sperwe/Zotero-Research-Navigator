# Sandbox 环境修复说明 - v2.0.3-sandbox-fix

## 核心问题解析

感谢您提供的深入分析，现在完全理解了问题的根源：

### 1. Sandbox 隔离环境
- 插件在完全隔离的 Sandbox 中运行
- Sandbox 没有直接访问 window 或 document 对象
- 必须通过 Zotero 传入的参数来访问真实的 DOM

### 2. onMainWindowLoad 的关键作用
- 这是插件访问主窗口 DOM 的唯一正确方式
- Zotero 传入的 `{ window }` 参数是真实的主窗口对象
- UI 创建必须在这个函数中进行，使用传入的 window 参数

## 实施的修复

### 1. 移除了错误的 UI 初始化方式
```typescript
// ❌ 错误：在 onStartup 中尝试获取 window
const win = Zotero.getMainWindow();

// ✅ 正确：在 onMainWindowLoad 中使用传入的 window
async function onMainWindowLoad({ window }) {
  const doc = window.document;
  // 使用 doc 创建 UI 元素
}
```

### 2. 确保 bootstrap 函数在全局作用域
创建了 `bootstrap-exports.ts` 文件，将所有 bootstrap 函数导出到 globalThis：
```typescript
globalThis.startup = startup;
globalThis.onMainWindowLoad = onMainWindowLoad;
// 等等...
```

### 3. 修正了函数参数格式
```typescript
// ❌ 错误
export function onMainWindowLoad(win: Window): void

// ✅ 正确
export function onMainWindowLoad({ window }: { window: Window }): void
```

### 4. 确保所有 UI 创建使用正确的 document
- 所有 DOM 操作都使用 `window.document` 而不是全局 `document`
- 使用 `doc.createElement()` 而不是 `document.createElement()`
- 使用 `doc.createXULElement()` 创建 XUL 元素

## 预期结果

1. **插件加载流程**：
   - Zotero 在 Sandbox 中执行插件代码
   - `startup()` 函数初始化核心模块
   - `onMainWindowLoad({ window })` 被 Zotero 调用，传入真实窗口
   - UI 元素使用真实窗口的 document 创建

2. **可见的 UI 元素**：
   - 工具栏按钮（如果工具栏存在）
   - 浮动调试按钮（右下角）
   - 菜单项（工具菜单）
   - 历史面板

## 验证步骤

1. 安装 `zotero-research-navigator-v2.0.3-sandbox-fix.xpi`
2. 打开 Zotero 错误控制台
3. 查找以下日志：
   - `[Research Navigator] Bootstrap functions exported to global scope`
   - `[Research Navigator DEBUG] === MAIN WINDOW LOAD BEGIN ===`
   - `[Research Navigator] UI initialized successfully`

4. 检查 UI 元素：
   - 右下角应该有圆形浮动按钮
   - 工具栏可能有按钮（取决于 Zotero 版本）
   - 工具菜单应该有 "Research Navigator" 项

## 技术细节

### Zotero 7 的插件加载机制
1. 插件在 Sandbox 中运行，具有系统权限但隔离的全局作用域
2. Zotero 通过 `Services.scriptloader.loadSubScriptWithOptions()` 加载插件
3. bootstrap 函数必须在 Sandbox 的全局作用域中
4. DOM 访问必须通过 Zotero 提供的窗口对象

### 关键代码路径
```
Zotero.Plugins._callMethod() 
  → 查找 Sandbox 中的全局函数
  → 调用 onMainWindowLoad({ window })
  → 插件使用 window.document 创建 UI
```

---
版本：v2.0.3-sandbox-fix
日期：2025-01-27
基于：Zotero 7 Sandbox 环境分析