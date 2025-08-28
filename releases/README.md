# Research Navigator Plugin Releases

## 有效版本

### v2.0.3-functional (最新版本)

- **文件**: `zotero-research-navigator-v2.0.3-functional.xpi`
- **状态**: ✅ 完全可用
- **功能**:
  - 历史记录追踪
  - 历史面板（可关闭）
  - 右键菜单功能
  - 通知提示
  - 双击打开文献
- **说明**: [FUNCTIONAL_VERSION.md](FUNCTIONAL_VERSION.md)

### v2.0.3-minimal-working

- **文件**: `zotero-research-navigator-v2.0.3-minimal-working.xpi`
- **状态**: ✅ UI 可见（基础版本）
- **功能**:
  - 蓝色浮动按钮
  - 工具菜单项
  - 右键菜单项
  - 基本的测试对话框
- **说明**: [MINIMAL_WORKING_VERSION.md](MINIMAL_WORKING_VERSION.md)

## 安装说明

1. 下载最新的 `zotero-research-navigator-v2.0.3-functional.xpi`
2. 打开 Zotero
3. 工具 → 插件 → 齿轮图标 → Install Add-on From File
4. 选择下载的 XPI 文件
5. 重启 Zotero

## 使用说明

安装后您应该看到：

- 右下角的蓝色圆形按钮（📚）
- 工具菜单中的 "Research Navigator - History Panel"
- 文献右键菜单中的 "Add to Research History"

点击蓝色按钮或使用菜单项可打开历史面板。

## 开发历程

这个插件经历了多次重构才成功适配 Zotero 7：

- 最初使用 TypeScript + zotero-plugin-toolkit
- 遇到 Zotero 7 的 Sandbox 隔离问题
- 最终使用纯 JavaScript 重写 bootstrap.js
- 参考了 zotero-style 插件的架构

---

更新日期：2025-01-27
