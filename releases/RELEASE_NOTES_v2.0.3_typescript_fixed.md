# Release Notes - v2.0.3 TypeScript Fixed

## 发布日期
2025-01-27

## 版本信息
- 版本号: 2.0.3-typescript-fixed
- 分支: fix/typescript-errors-and-functionality
- 文件: zotero-research-navigator-v2.0.3-typescript-fixed.xpi

## 修复内容

### TypeScript 编译错误修复
1. **BasicTool.waitForZotero() 错误**
   - 问题：BasicTool 没有 waitForZotero 方法
   - 解决：改用插件自带的 safeLoader.waitForZotero()

2. **Components 全局对象未定义**
   - 问题：TypeScript 不识别 Components 对象
   - 解决：在 typings/global.d.ts 中添加了 Components 类型定义

3. **globalThis 属性访问错误**
   - 问题：TypeScript 严格模式下无法访问 globalThis.addon 等属性
   - 解决：使用类型断言 (globalThis as any) 修复

4. **HistoryNode 搜索结果类型错误**
   - 问题：搜索结果被错误地当作包含 .node 属性的对象
   - 解决：直接使用搜索结果作为 HistoryNode

5. **package.json 版本导入问题**
   - 问题：config 对象不包含 version 属性
   - 解决：单独导入 version 字段

## 功能状态

### ✅ 已实现功能
- 历史追踪系统 (HistoryTracker)
- 智能搜索引擎 (SearchEngine)
- UI 管理系统 (UIManager)
- 工具栏按钮集成
- 侧边栏历史面板
- 快捷键支持 (Ctrl+Shift+H)
- 中英文双语支持
- 错误处理和恢复机制
- 诊断日志系统

### ⚠️ 已知问题
- WebSocket 连接错误（Zotero 内部问题，不影响插件功能）
- 右键菜单"定位到历史记录"功能待完善（非关键功能）

## 技术改进
- 所有 TypeScript 编译错误已修复
- 构建过程现在完全成功
- 代码类型安全性提升
- 更好的开发体验

## 兼容性
- Zotero 版本: 7.0 - 7.1.*
- 平台支持: Windows/Mac/Linux

## 安装说明
1. 下载 `zotero-research-navigator-v2.0.3-typescript-fixed.xpi`
2. 在 Zotero 中：工具 → 附加组件 → 从文件安装附加组件
3. 选择下载的 XPI 文件
4. 重启 Zotero

## 下一步计划
- 完善右键菜单定位功能
- 添加更多配置选项
- 优化大数据集性能
- 添加单元测试