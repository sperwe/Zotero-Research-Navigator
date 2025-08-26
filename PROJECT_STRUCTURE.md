# 📁 Zotero Research Navigator - 项目结构

## 🏗️ 纯 Zotero 插件架构

经过完整重构，项目现在是一个标准的 Zotero 插件结构：

```
zotero-research-navigator/
├── addon/                      # Zotero 插件核心文件
│   ├── install.rdf            # 插件元数据和兼容性信息
│   ├── chrome.manifest        # Chrome 注册和覆盖定义
│   ├── bootstrap.js           # 插件生命周期管理
│   └── chrome/               
│       ├── content/          # UI 和功能文件
│       │   ├── overlay.xul   # Zotero UI 集成
│       │   └── icons/        # 插件图标
│       └── locale/           # 本地化文件
│           ├── en-US/        # 英文
│           └── zh-CN/        # 中文
├── src/                       # 源代码
│   ├── simple-index.js       # 主逻辑入口
│   ├── index.ts              # TypeScript 入口（待集成）
│   ├── modules/              # 功能模块
│   │   ├── historyTracker.ts # 历史追踪
│   │   └── searchEngine.ts   # 搜索引擎
│   ├── components/           # UI 组件
│   │   └── HistoryTreeView.tsx # 树形视图
│   ├── styles/               # 样式文件
│   ├── types/                # TypeScript 类型
│   └── ui/                   # UI 相关代码
├── build/                    # 构建输出（git忽略）
├── node_modules/             # 依赖（git忽略）
├── .github/                  # GitHub Actions
│   └── workflows/
│       ├── build.yml        # 自动构建
│       └── release.yml      # 自动发布
├── package.json             # Node.js 项目配置
├── webpack.config.js        # 构建配置
├── tsconfig.json           # TypeScript 配置
├── .gitignore              # Git 忽略规则
└── README.md               # 项目说明

## 🔧 构建流程

1. **开发构建**：`npm run build`
   - 生成开发版本，包含 source map
   - 输出到 `build/` 目录

2. **生产构建**：`npm run build-prod`
   - 生成压缩版本
   - 优化文件大小

3. **文件复制**：
   - `install.rdf` → 根目录
   - `chrome.manifest` → 根目录
   - `bootstrap.js` → 根目录（压缩）
   - `chrome/` → 保持目录结构
   - `index.js` → 编译后的主逻辑

4. **打包 XPI**：
   ```bash
   cd build
   zip -r ../zotero-research-navigator.xpi *
   ```

## 🚀 关键改进

### 已完成的重构：
- ✅ 删除所有 WebExtension 相关文件
- ✅ 统一为 Zotero 插件结构
- ✅ 优化构建配置
- ✅ 改进 bootstrap.js 生命周期管理
- ✅ 支持 Zotero 6 和 7 兼容性

### 待完成的优化：
- [ ] 完全迁移到 TypeScript
- [ ] 集成 React 组件到构建流程
- [ ] 添加单元测试
- [ ] 优化 XUL overlay 集成

## 📦 插件文件说明

- **install.rdf**：定义插件 ID、版本、兼容性等元数据
- **chrome.manifest**：注册 chrome URLs 和 UI 覆盖
- **bootstrap.js**：管理插件启动、关闭、安装、卸载
- **overlay.xul**：集成到 Zotero 主界面
- **DTD 文件**：本地化字符串

## 🎯 下一步计划

1. 增强树状历史可视化
2. 改进搜索功能
3. 添加卡片式预览
4. 性能优化