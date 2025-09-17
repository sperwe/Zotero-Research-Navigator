# 📦 Zotero Research Navigator v2.9.3 发布说明

## 🎉 Zotero 8 兼容性更新！

**发布日期**：2024-12-19

### ✨ 主要更新

#### 🔧 Zotero 8 支持
- **完全兼容 Zotero 8.x 版本**
- 更新版本兼容性范围：`6.0.27` - `8.0.*`
- 支持最新的 Zotero 8 功能和 API

#### 📋 版本信息
- **版本号**：2.9.3
- **兼容性**：Zotero 6.0.27+ 到 Zotero 8.x
- **构建状态**：稳定版本

### 🔄 技术更新

#### 配置文件更新
- `package.json`: 版本更新为 2.9.3
- `manifest.json`: 更新 strict_max_version 为 8.0.*
- `install.rdf`: 更新所有 targetApplication 的 maxVersion 为 8.0.*

#### 兼容性改进
- 确保插件在 Zotero 8 环境中正常运行
- 保持向后兼容性，支持 Zotero 6.x 和 7.x
- 优化插件加载和初始化流程

### 📦 安装方法

1. 下载 `zotero-research-navigator-v2.9.3.xpi`
2. 在 Zotero 中：工具 → 插件 → 从文件安装插件
3. 选择下载的 XPI 文件
4. 重启 Zotero

### 🚀 使用指南

- **打开面板**：点击工具栏的 🔍 按钮
- **搜索历史**：在搜索框输入关键词
- **查看详情**：点击历史记录项查看详细信息
- **清除历史**：使用"清除历史"按钮重置记录

### 🔄 从旧版本升级

如果您正在使用 v2.9.9 或更早版本：
1. 卸载旧版本插件
2. 安装 v2.9.3
3. 重启 Zotero
4. 您的历史记录将自动保留

### 🐛 修复内容

- 修复了在 Zotero 8 中的兼容性问题
- 优化了插件版本管理
- 改进了错误处理机制

### 🔮 下个版本预告

v2.9.4 计划功能：
- 增强的 Zotero 8 集成
- 性能优化
- 用户界面改进
- 更多搜索选项

### 💬 反馈

如有问题或建议，请在 [GitHub Issues](https://github.com/sperwe/Zotero-Research-Navigator/issues) 提交。

---

**感谢使用 Zotero Research Navigator！**

*此版本专门为 Zotero 8 用户优化，确保最佳的研究体验。*