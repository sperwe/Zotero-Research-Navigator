# 🔍 Zotero Research Navigator 兼容性分析报告

## 📅 分析日期：2024-08-26

## 🎯 核心问题

当前项目虽然命名为 "Zotero Research Navigator"，但包含了混合的架构元素：
- 浏览器扩展（WebExtension）的 `manifest.json`
- Zotero 插件的结构（addon 目录、bootstrap.js）
- 混合的 API 使用

## 🚨 主要兼容性问题

### 1. **文件结构混乱**
```
问题文件：
├── manifest.json (❌ WebExtension 格式，Zotero 不支持)
├── _locales/ (⚠️ WebExtension 本地化格式)
├── addon/
│   ├── bootstrap.js (✅ Zotero 格式)
│   ├── chrome.manifest (✅ Zotero 格式)
│   └── install.rdf (✅ 新添加，Zotero 格式)
```

### 2. **构建系统问题**
- webpack 配置同时复制了 `manifest.json` 和 Zotero 文件
- 最终的 XPI 包含了不兼容的文件混合
- 导致 Zotero 无法识别插件格式

### 3. **API 使用分析**
✅ **正确使用的 Zotero API：**
- `Zotero.Notifier`
- `Zotero.Items`
- `Zotero.Collections`
- `Zotero.Prefs`

⚠️ **需要注意的浏览器 API：**
- `document.getElementById()` - 在 Zotero 中可用，但使用方式不同
- `document.createElement()` - 需要在正确的窗口上下文中使用

❌ **不存在但可能误用的 API：**
- 没有发现 `chrome.*` 或 `browser.*` API（好消息）
- 没有使用 localStorage/sessionStorage（正确使用了 Zotero.Prefs）

### 4. **本地化系统冲突**
- `_locales/` 是 WebExtension 格式
- `chrome/locale/` 是 Zotero 格式
- 两套系统同时存在，造成混乱

## 📊 兼容性评估

| 组件 | 状态 | 问题描述 |
|------|------|----------|
| 核心逻辑 | ✅ 兼容 | 使用了正确的 Zotero API |
| 文件结构 | ❌ 不兼容 | 混合了两种插件格式 |
| 构建系统 | ⚠️ 部分兼容 | 需要清理不必要的文件 |
| UI 实现 | ✅ 基本兼容 | 使用标准 DOM API |
| 存储机制 | ✅ 兼容 | 正确使用 Zotero.Prefs |
| 本地化 | ❌ 混乱 | 两套系统冲突 |

## 🛠️ 修复计划

### 第一阶段：清理项目结构（必须）
1. **删除 WebExtension 相关文件**
   - 删除根目录的 `manifest.json`
   - 删除或转换 `_locales/` 目录
   
2. **修改构建配置**
   - 更新 webpack.config.js，只复制 Zotero 相关文件
   - 确保不包含 WebExtension 文件

3. **统一本地化系统**
   - 只使用 `chrome/locale/` (Zotero 格式)
   - 转换 `_locales/` 内容到 DTD 格式

### 第二阶段：优化 Zotero 集成（推荐）
1. **完善 install.rdf**
   - 添加更详细的元数据
   - 设置正确的更新 URL

2. **改进 bootstrap.js**
   - 添加正确的生命周期管理
   - 处理插件卸载时的清理

3. **UI 集成优化**
   - 使用 XUL overlay 正确集成到 Zotero UI
   - 添加菜单项和快捷键

### 第三阶段：功能增强（可选）
1. **利用 Zotero 特有功能**
   - 集成到 Zotero 的标签系统
   - 使用 Zotero 的高级搜索功能
   - 支持 Zotero 的同步机制

## 🎯 立即行动建议

**最小可行修复（让插件能安装）：**
1. 删除根目录 `manifest.json`
2. 修改 webpack 配置，不复制 manifest.json
3. 确保 install.rdf 在 XPI 根目录
4. 重新构建和打包

**完整修复（推荐）：**
1. 创建新的分支进行大改造
2. 彻底分离 WebExtension 和 Zotero 代码
3. 建立纯 Zotero 插件架构
4. 重新设计构建流程

## 📝 结论

当前项目是一个**混合架构**，试图同时兼容浏览器扩展和 Zotero 插件。这是导致安装失败的根本原因。需要决定：

1. **选项 A**：完全转向 Zotero 插件（推荐）
   - 删除所有 WebExtension 相关代码
   - 专注于 Zotero 功能

2. **选项 B**：维护两个独立版本
   - 分离代码库
   - 各自独立构建

3. **选项 C**：快速修复
   - 最小改动让插件能安装
   - 后续逐步重构

建议采用**选项 C**作为短期方案，**选项 A**作为长期目标。