# Zotero 插件开发资源汇总

本文档整理了 Zotero 插件开发的重要资源、工具和文档链接。

## 📚 核心开发资源

### 官方文档
- **[📖 Zotero 7 插件开发文档](https://www.zotero.org/support/dev/zotero_7_for_developers)**
  - Zotero 7 的重要变化和迁移指南
  - 新的插件架构说明
  - Bootstrap 插件开发模式

- **[📜 Zotero 源代码](https://github.com/zotero/zotero)**
  - 完整的 Zotero 源代码
  - 可以查看内部实现和 API 使用示例
  - Issues 和 PR 中有很多有用的讨论

### 开发工具

- **[🛠️ Zotero Plugin Toolkit](https://github.com/windingwind/zotero-plugin-toolkit)**
  - 简化 Zotero 插件开发的工具包
  - 提供了许多实用的辅助函数
  - [API 文档](https://github.com/windingwind/zotero-plugin-toolkit/blob/master/docs/zotero-plugin-toolkit.md)

- **[🛠️ Zotero Plugin Scaffold](https://github.com/northword/zotero-plugin-scaffold)**
  - 现代化的 Zotero 插件构建工具
  - 支持 TypeScript、热重载等特性
  - 我们项目正在使用这个工具

- **[ℹ️ Zotero Types](https://github.com/windingwind/zotero-types)**
  - Zotero 的 TypeScript 类型定义
  - 提供完整的类型支持
  - 支持代码补全和类型检查

### 模板和示例

- **[📋 Zotero Plugin Template](https://github.com/windingwind/zotero-plugin-template)**
  - 完整的插件开发模板
  - 包含最佳实践和示例代码
  - 定期更新以支持最新的 Zotero 版本

## 🔧 开发工具链配置

### 在我们的项目中使用这些工具

1. **Zotero Plugin Toolkit**
   ```bash
   # 已经在 package.json 中配置
   npm install zotero-plugin-toolkit
   ```
   
   在代码中使用：
   ```typescript
   import { BasicTool, UITool, PreferenceTool } from "zotero-plugin-toolkit";
   ```

2. **Zotero Types**
   ```bash
   # 已经安装
   npm install --save-dev zotero-types
   ```
   
   在 tsconfig.json 中配置：
   ```json
   {
     "compilerOptions": {
       "types": ["zotero-types"]
     }
   }
   ```

3. **Zotero Plugin Scaffold**
   - 我们的项目已经使用此工具进行构建
   - 配置文件：`zotero-plugin.config.ts`

## 📖 重要开发指南

### Zotero 7 迁移要点

1. **Bootstrap 架构**
   - 不再使用 overlay XUL
   - 使用 bootstrap.js 作为入口点
   - 动态创建 UI 元素

2. **Fluent 本地化**
   - 使用 .ftl 文件替代 .dtd 和 .properties
   - 新的本地化 API

3. **React 组件**
   - Zotero 7 内置 React
   - 可以使用 React 构建复杂 UI

### 调试技巧

1. **开发者工具**
   ```javascript
   // 在 Zotero 中打开开发者工具
   Zotero.openInViewer("chrome://devtools/content/devtools.xhtml");
   ```

2. **调试日志**
   ```javascript
   Zotero.debug("Your debug message");
   Zotero.log("Your log message", "warning");
   ```

3. **远程调试**
   - 启动 Zotero 时添加 `-jsdebugger` 参数
   - 使用 Firefox Developer Edition 连接调试

## 🚀 最佳实践

### 1. 使用 TypeScript
- 利用 zotero-types 获得完整的类型支持
- 避免运行时错误
- 提高代码可维护性

### 2. 模块化开发
- 将功能拆分为独立模块
- 使用 ES6 模块语法
- 保持代码整洁和可测试

### 3. 性能优化
- 避免阻塞主线程
- 使用异步操作
- 缓存频繁使用的数据

### 4. 兼容性考虑
- 测试不同 Zotero 版本
- 处理 API 变化
- 提供优雅降级

## 🔗 其他有用资源

### 社区资源
- [Zotero 论坛开发板块](https://forums.zotero.org/categories/dev)
- [Zotero 插件开发 Discord](https://discord.gg/zotero)

### 优秀插件示例
- [Better BibTeX](https://github.com/retorquere/zotero-better-bibtex)
- [Zotfile](https://github.com/jlegewie/zotfile)
- [Zotero PDF Translate](https://github.com/windingwind/zotero-pdf-translate)

### 开发博客和教程
- [Zotero 插件开发系列教程](https://zotero.yuque.com/books/share/8d230829-6004-4934-b4c6-685a7001bfa0)
- [使用 React 开发 Zotero 插件](https://github.com/windingwind/zotero-plugin-template/discussions/34)

## 📝 在我们项目中的应用

基于这些资源，我们的 Zotero Research Navigator 项目已经：

1. ✅ 使用 zotero-plugin-scaffold 作为构建工具
2. ✅ 集成 zotero-plugin-toolkit 简化开发
3. ✅ 配置 TypeScript 和类型定义
4. ✅ 遵循 Zotero 7 的开发规范
5. ✅ 实现模块化的代码结构

### 推荐阅读顺序

1. 先阅读 [Zotero 7 开发文档](https://www.zotero.org/support/dev/zotero_7_for_developers)
2. 查看 [插件模板](https://github.com/windingwind/zotero-plugin-template) 了解项目结构
3. 学习 [Toolkit API](https://github.com/windingwind/zotero-plugin-toolkit/blob/master/docs/zotero-plugin-toolkit.md)
4. 参考其他优秀插件的实现

## 💡 开发提示

- 经常查看 Zotero 源代码了解内部实现
- 加入开发者社区获取帮助
- 关注 Zotero 的更新和 API 变化
- 编写清晰的文档和注释

祝您开发顺利！如有问题，可以参考这些资源或在社区寻求帮助。