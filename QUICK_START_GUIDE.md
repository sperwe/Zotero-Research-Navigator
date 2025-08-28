# Zotero Research Navigator 快速开始指南

## 🚀 快速开始

在 `refactor/template-based-rewrite` 分支上开发 Zotero Research Navigator 插件的最快方法：

```bash
# 1. 确保在正确的分支
git checkout refactor/template-based-rewrite

# 2. 安装依赖（如果还没有）
npm install

# 3. 运行快速启动脚本
./quick-start.sh
```

## 📋 测试环境概览

我已经为您设置了完整的测试环境，包括：

### 1. **自动化脚本**

- `setup-zotero-dev.sh` - 自动下载和配置 Zotero 7 Beta
- `quick-start.sh` - 一键启动开发环境
- `dev-tools/zotero-dev-helper.cjs` - 开发助手工具

### 2. **测试工具**

- `test/plugin-test-runner.cjs` - 插件验证测试
- `test/zotero-test-environment.cjs` - 模拟 Zotero 环境测试

### 3. **构建系统**

- 已配置 TypeScript 和构建工具
- 支持热重载和自动构建
- 生成的插件位于 `build/zotero-research-navigator.xpi`

## 🔧 开发工作流

### 方法一：使用开发助手（推荐）

1. 运行 `./quick-start.sh` 并选择选项 2
2. 在开发助手中：
   - 按 `w` 启动文件监视（自动重新构建）
   - 按 `z` 启动 Zotero
   - 按 `r` 重新加载插件
   - 按 `l` 查看日志

### 方法二：手动开发

1. 构建插件：

   ```bash
   npm run build
   ```

2. 启动 Zotero：

   ```bash
   ~/zotero-dev/start-zotero-dev.sh
   ```

3. 在 Zotero 中安装插件：
   - 工具 → 附加组件 → 从文件安装
   - 选择 `build/zotero-research-navigator.xpi`

## 📁 项目结构

```
/workspace/
├── src/                    # 源代码
│   ├── index.ts           # 插件入口点
│   ├── modules/           # 功能模块
│   │   ├── historyTracker.ts  # 历史跟踪
│   │   ├── searchEngine.ts    # 搜索功能
│   │   └── ui.ts              # UI 组件
│   └── utils/             # 工具函数
├── addon/                 # 插件资源
│   ├── manifest.json      # 插件清单
│   ├── locale/            # 本地化文件
│   └── content/           # 内容文件
├── build/                 # 构建输出
├── test/                  # 测试脚本
└── dev-tools/            # 开发工具
```

## ✅ 验证插件功能

插件安装后，测试以下功能：

1. **历史记录跟踪**
   - 打开文献时应该记录访问历史
   - 检查历史面板是否显示记录

2. **导航功能**
   - 测试前进/后退导航
   - 验证快捷键 (Ctrl/Cmd+Shift+H)

3. **UI 元素**
   - 工具栏按钮是否显示
   - 右键菜单项是否存在
   - 历史面板是否正常工作

## 🐛 调试技巧

1. **查看控制台日志**
   - 在 Zotero 中：工具 → 开发者 → 错误控制台
   - 或使用开发助手按 `l` 查看日志

2. **启用调试模式**
   - 开发配置已启用所有调试选项
   - 日志会显示 `[Research Navigator]` 前缀

3. **常见问题**
   - 如果插件未加载，检查 manifest.json 中的版本兼容性
   - 如果 UI 未显示，检查 XUL 元素创建是否正确

## 📝 下一步

1. **修改代码**
   - 在 `src/` 目录中编辑文件
   - 开发助手会自动检测更改并重新构建

2. **测试更改**
   - 重启 Zotero 或使用开发助手的重载功能
   - 验证功能是否正常

3. **提交更改**
   - 运行测试：`npm test`
   - 提交到 `refactor/template-based-rewrite` 分支

## 💡 提示

- 使用开发助手可以大大提高开发效率
- 保持错误控制台打开以便及时发现问题
- 经常查看 Zotero 7 开发文档获取最新信息

## 🆘 需要帮助？

如果遇到问题：

1. 查看 `TESTING_ENVIRONMENT.md` 获取详细信息
2. 检查错误控制台的具体错误信息
3. 确保所有依赖都已正确安装

祝您开发顺利！🎉
