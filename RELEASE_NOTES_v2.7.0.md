# Release Notes - v2.7.0

## 发布日期
2025-01-30

## 修复的问题

### 1. 版本号更新机制 ✅
- **问题**: 版本号更新不正确，从 2.6.x 变成 2.6.x.xx
- **修复**: 创建了新的版本更新脚本 `scripts/update-version.js`
- **使用方法**: `npm run version:update <版本号>`
- **影响文件**:
  - package.json
  - addon/manifest.json
  - manifest.json
  - update.json
  - update-dev.json

### 2. runBootstrapTests 未定义错误 ✅
- **问题**: 在 Zotero 控制台运行 `Zotero.ResearchNavigator.runBootstrapTests()` 时报错
- **修复**: 确保 `Zotero.ResearchNavigator` 对象在测试函数注册前已存在
- **相关文件**: 
  - src/bootstrap.ts
  - src/test/bootstrap-tests.ts

### 3. 快速笔记窗口编辑器问题 ✅
- **问题**: 快速笔记窗口没有成功启动 Zotero 自带的编辑器
- **修复**: 使用与工具栏浮动窗口相同的 `<note-editor>` 实现方式
- **主要改动**:
  - 移除了 iframe 实现，直接使用 Zotero 原生的 note-editor 元素
  - 正确设置了编辑器的 mode 和 viewMode 属性
  - 异步加载笔记内容到编辑器
  - 更新了保存和字数统计方法以适配新的编辑器实现
- **相关文件**: src/ui/components/quick-note-window.ts

## 技术改进

### 编辑器集成方式
现在快速笔记窗口使用了与主面板相同的编辑器集成方式：
```typescript
// 创建 note-editor 元素
const noteEditor = doc.createElement('note-editor');
noteEditor.mode = 'edit';
noteEditor.viewMode = 'library';
noteEditor.item = noteItem;
```

### 版本管理流程
1. 运行 `npm run version:update 2.7.1` 更新版本号
2. 运行 `npm run build-prod` 构建生产版本
3. 在 `build/` 目录中找到 `zotero-research-navigator.xpi`

## 构建信息
- Node.js 版本要求: >=20.12.0
- 构建命令: `npm run build-prod`
- 输出文件: `build/zotero-research-navigator.xpi`

## 测试建议
1. 安装新版本插件
2. 测试快速笔记功能是否正常显示 Zotero 编辑器
3. 在控制台运行 `Zotero.ResearchNavigator.runBootstrapTests()` 验证测试功能
4. 验证版本号是否正确显示为 2.7.0

## 下一步
- 将 XPI 文件上传到 GitHub Releases
- 更新 update.json 中的下载链接
- 通知用户更新