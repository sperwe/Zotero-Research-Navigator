# Zotero Research Navigator

一个强大的 Zotero 插件，用于追踪研究历史和增强笔记导航体验。

[![License](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)
[![Zotero](https://img.shields.io/badge/Zotero-7.0+-red.svg)](https://www.zotero.org/)
[![Version](https://img.shields.io/github/package-json/v/sperwe/Zotero-Research-Navigator)](package.json)
[![Build Status](https://github.com/sperwe/Zotero-Research-Navigator/actions/workflows/auto-build.yml/badge.svg)](https://github.com/sperwe/Zotero-Research-Navigator/actions/workflows/auto-build.yml)
[![Latest Release](https://img.shields.io/github/v/release/sperwe/Zotero-Research-Navigator?label=latest%20release)](https://github.com/sperwe/Zotero-Research-Navigator/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/sperwe/Zotero-Research-Navigator/total)](https://github.com/sperwe/Zotero-Research-Navigator/releases)

## ✨ 特色功能

### 🌳 树状历史追溯
- **智能分组**：按时间和类型自动分组您的访问历史
- **可视化追溯**：清晰展示您的研究轨迹和阅读路径
- **快速回溯**：一键回到之前的阅读状态
- **访问统计**：显示条目访问频率和时间

### 🔍 强大的搜索功能
- **模糊搜索**：智能匹配标题、标签和内容
- **搜索建议**：基于历史提供智能搜索建议
- **高亮显示**：搜索结果自动高亮匹配内容
- **实时过滤**：输入即时过滤历史记录

### 🎨 卡片式预览
- **美观界面**：受 ZotCard 启发的现代化卡片设计
- **快速预览**：选中项目即时显示详细信息
- **类型标识**：不同类型项目使用不同颜色标识
- **一键操作**：直接从预览面板打开或操作项目

### ⚡ 高效导航
- **快捷键支持**：`Ctrl+Shift+H` 快速打开面板
- **工具栏集成**：一键访问研究历史
- **侧边栏面板**：不干扰主工作流程
- **智能跟踪**：自动记录文献、笔记、集合访问

## 📦 安装指南

### 方式一：自动构建版本 (推荐)

每次代码推送都会自动生成最新的 XPI 文件：

1. **稳定版本（主分支）**
   - 访问 [Latest Release](https://github.com/sperwe/Zotero-Research-Navigator/releases/tag/latest)
   - 下载 `zotero-research-navigator-latest.xpi`

2. **开发版本（功能分支）**
   - 访问 [Releases 页面](https://github.com/sperwe/Zotero-Research-Navigator/releases)
   - 找到以 `dev-` 开头的版本
   - 下载对应的 `.xpi` 文件

3. **在 Zotero 中安装**：
   - 打开 `工具` → `插件`
   - 点击设置齿轮 → `从文件安装插件...`
   - 选择下载的 `.xpi` 文件
   - 重启 Zotero

### 方式二：从 GitHub Actions 获取

1. 访问 [Actions 页面](https://github.com/sperwe/Zotero-Research-Navigator/actions)
2. 选择最新的成功构建
3. 在 Artifacts 部分下载 XPI 文件

### 方式三：从源码构建

1. **克隆仓库**
   ```bash
   git clone https://github.com/YOUR_USERNAME/zotero-research-navigator.git
   cd zotero-research-navigator
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **构建插件**
   ```bash
   # 开发版本
   npm run build
   
   # 生产版本
   npm run build-prod
   ```

4. **安装到 Zotero**
   - 构建后的文件在 `build/` 目录
   - 将 `build/` 目录压缩为 `.zip` 文件
   - 重命名为 `.xpi` 后缀
   - 按照方式一的步骤安装

## 🚀 使用指南

### 基础操作

1. **打开插件面板**
   - 点击工具栏的 📊 图标
   - 使用快捷键 `Ctrl+Shift+H`
   - 菜单栏：`视图` → `Research History Panel`

2. **浏览历史记录**
   - 历史记录按时间自动分组（今天、昨天、更早）
   - 点击 📁/📂 图标折叠/展开分组
   - 单击项目查看详细预览
   - 双击项目直接打开

3. **搜索历史**
   - 在搜索框输入关键词
   - 支持标题、标签、内容模糊搜索
   - 实时显示搜索建议
   - 搜索结果自动高亮

### 高级功能

#### 🎯 智能追踪
插件会自动记录以下操作：
- 打开文献条目（双击、PDF 阅读器）
- 编辑或查看笔记
- 浏览文献集合
- 执行搜索查询

#### 🎨 卡片预览
- **文献卡片**：显示标题、作者、发表信息
- **笔记卡片**：显示内容摘要、关联文献
- **集合卡片**：显示包含的条目数量
- **搜索卡片**：显示搜索条件和结果数

#### 📊 访问统计
- 显示每个项目的访问次数
- 记录最后访问时间
- 按访问频率排序
- 导出访问报告（计划功能）

## ⚙️ 配置选项

插件提供以下配置选项（在 Zotero 首选项中）：

```javascript
// 历史记录设置
extensions.zotero.researchnavigator.maxHistorySize = 1000  // 最大历史记录数
extensions.zotero.researchnavigator.maxRecentSize = 50     // 最近访问记录数

// 界面设置
extensions.zotero.researchnavigator.showCardPreview = true  // 显示卡片预览
extensions.zotero.researchnavigator.autoExpandGroups = false // 自动展开分组

// 搜索设置
extensions.zotero.researchnavigator.searchThreshold = 0.1   // 搜索相关度阈值
extensions.zotero.researchnavigator.maxSuggestions = 5      // 最大搜索建议数
```

## 🔧 开发指南

### 开发环境设置

1. **安装依赖**
   ```bash
   npm install
   ```

2. **开发模式**
   ```bash
   npm run watch    # 监听文件变化，自动构建
   npm run serve    # 启动开发服务器（如果支持）
   ```

3. **代码规范**
   ```bash
   npm run lint     # 检查代码规范
   npm run lint:fix # 自动修复代码规范问题
   ```

### 项目结构

```
zotero-research-navigator/
├── src/                          # 源代码
│   ├── modules/                  # 核心模块
│   │   ├── historyTracker.ts     # 历史跟踪器
│   │   └── searchEngine.ts      # 搜索引擎
│   ├── components/               # UI 组件
│   │   └── HistoryTreeView.tsx   # 主界面组件
│   ├── styles/                   # 样式文件
│   │   └── main.css             # 主样式
│   └── index.ts                 # 插件入口
├── _locales/                     # 多语言支持
│   ├── en/messages.json         # 英文
│   └── zh_CN/messages.json     # 中文
├── addon/                        # 插件资源
├── manifest.json                 # 插件清单
├── package.json                  # 项目配置
├── tsconfig.json                # TypeScript 配置
├── webpack.config.js            # 构建配置
└── README.md                    # 说明文档
```

### 核心架构

#### 历史跟踪器 (`HistoryTracker`)
- 监听 Zotero 事件（`Zotero.Notifier`）
- 记录访问历史到本地存储
- 构建树状数据结构
- 提供数据查询接口

#### 搜索引擎 (`SearchEngine`)
- 实现模糊搜索算法
- 提供搜索建议功能
- 支持高级搜索条件
- 优化搜索性能

#### UI 组件 (`HistoryTreeView`)
- React 组件化设计
- 响应式布局适配
- 交互状态管理
- 事件处理逻辑

## 🤝 贡献指南

欢迎贡献代码、报告问题或提出改进建议！

### 报告问题

提交问题时请包含：
- Zotero 版本信息
- 插件版本信息
- 详细的重现步骤
- 错误日志（如有）
- 系统环境信息

### 贡献代码

1. Fork 此仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

### 开发规范

- 使用 TypeScript 开发
- 遵循 ESLint 代码规范
- 添加适当的注释和文档
- 编写单元测试（计划中）
- 保持向后兼容性

## 📄 许可证

本项目采用 [AGPL-3.0](LICENSE) 许可证。

## 🙏 致谢

### 灵感来源
- **[Tree Style History](https://github.com/ORIGINAL_REPO)** - 提供了核心的历史追踪算法和树状视图设计
- **[ZotCard](https://github.com/018/zotcard)** - 启发了卡片式界面设计
- **[Zotero Better Notes](https://github.com/windingwind/zotero-better-notes)** - 参考了笔记管理功能

### 技术支持
- **[Zotero Plugin Template](https://github.com/windingwind/zotero-plugin-template)** - 提供了现代化的插件开发框架
- **[Zotero Plugin Toolkit](https://github.com/windingwind/zotero-plugin-toolkit)** - 简化了 Zotero API 的使用

## 📞 支持与反馈

- **GitHub Issues**: [提交问题](https://github.com/YOUR_USERNAME/zotero-research-navigator/issues)
- **GitHub Discussions**: [讨论交流](https://github.com/YOUR_USERNAME/zotero-research-navigator/discussions)
- **Email**: your.email@example.com

## 🔄 更新日志

### v1.0.0 (2024-01-XX)
- ✨ 初始版本发布
- 🌳 树状历史追溯功能
- 🔍 智能搜索与过滤
- 🎨 卡片式预览界面
- 🌍 多语言支持（中文/英文）
- ⚡ Zotero 6.0+ 兼容性

---

**如果这个插件对您的研究工作有帮助，请给个 ⭐ Star 支持！**# GitHub Actions Test
