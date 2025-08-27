# Zotero Research Navigator 测试环境设置指南

本文档介绍如何设置和使用 Zotero Research Navigator 插件的完整测试环境。

## 快速开始

### 1. 安装项目依赖

```bash
npm install
```

### 2. 设置 Zotero 开发环境

运行自动设置脚本：

```bash
./setup-zotero-dev.sh
```

这个脚本会：
- 下载 Zotero 7 Beta 版本
- 创建开发配置文件
- 设置调试选项
- 创建启动脚本

### 3. 验证插件构建

运行测试脚本验证插件是否能正确构建：

```bash
node test/plugin-test-runner.js
```

这会检查：
- 插件结构完整性
- 本地化文件
- 脚本语法
- 配置文件

### 4. 启动开发环境

#### 方法一：使用开发助手（推荐）

```bash
node dev-tools/zotero-dev-helper.js
```

开发助手提供：
- 自动构建和热重载
- Zotero 启动管理
- 日志查看
- 交互式菜单

#### 方法二：手动启动

1. 构建插件：
   ```bash
   npm run build
   ```

2. 启动 Zotero：
   ```bash
   ~/zotero-dev/start-zotero-dev.sh
   ```

3. 在 Zotero 中安装插件：
   - 工具 → 附加组件 → 从文件安装附加组件
   - 选择 `build/zotero-research-navigator.xpi`

## 开发工作流

### 1. 文件监视和自动构建

使用开发助手的文件监视功能，当源代码改变时自动重新构建：

```bash
node dev-tools/zotero-dev-helper.js
# 按 'w' 启动文件监视
```

### 2. 调试

Zotero 开发配置已启用：
- JavaScript 控制台 (`-jsconsole`)
- 调试日志
- 远程调试

查看调试日志：
- 在 Zotero 中：工具 → 开发者 → 错误控制台
- 在开发助手中：按 'l' 查看日志

### 3. 测试插件功能

主要测试点：
- 历史记录功能是否正常
- 导航功能是否响应
- 右键菜单是否显示
- 快捷键是否生效
- 本地化是否正确

## 项目结构

```
/workspace/
├── src/                    # 源代码
│   ├── index.ts           # 插件入口
│   ├── modules/           # 功能模块
│   └── utils/             # 工具函数
├── addon/                  # 插件资源
│   ├── content/           # 内容脚本
│   ├── locale/            # 本地化文件
│   └── manifest.json      # 插件清单
├── build/                  # 构建输出
├── test/                   # 测试脚本
│   ├── plugin-test-runner.js
│   └── zotero-test-environment.cjs
└── dev-tools/             # 开发工具
    └── zotero-dev-helper.js
```

## 常见问题

### 1. 构建失败

检查：
- Node.js 版本是否满足要求
- 依赖是否正确安装
- TypeScript 配置是否正确

### 2. Zotero 无法启动

确保：
- 已运行 `setup-zotero-dev.sh`
- Zotero Beta 下载完成
- 有执行权限

### 3. 插件未加载

检查：
- 构建是否成功
- manifest.json 中的 ID 是否正确
- Zotero 版本是否兼容

### 4. 调试信息未显示

确保：
- 使用开发配置文件启动 Zotero
- 打开错误控制台
- 检查 `extensions.zotero.debug.log` 设置

## 命令参考

### 构建命令

```bash
npm run build          # 开发构建
npm run build-prod     # 生产构建
npm run lint:check     # 代码检查
npm run lint:fix       # 自动修复
```

### 测试命令

```bash
npm test                           # 运行所有测试
node test/plugin-test-runner.js    # 插件验证测试
node test/zotero-test-environment.cjs  # 模拟环境测试
```

### 开发工具

```bash
./setup-zotero-dev.sh              # 设置 Zotero 环境
node dev-tools/zotero-dev-helper.js  # 开发助手
~/zotero-dev/start-zotero-dev.sh   # 启动 Zotero
~/zotero-dev/install-plugin-symlink.sh  # 安装插件符号链接
```

## 下一步

1. 运行 `./setup-zotero-dev.sh` 设置环境
2. 使用 `node dev-tools/zotero-dev-helper.js` 启动开发
3. 在 `refactor/template-based-rewrite` 分支上进行开发
4. 提交更改前运行所有测试

## 支持

如有问题，请查看：
- [Zotero 7 开发者指南](https://www.zotero.org/support/dev/zotero_7_for_developers)
- [Zotero 源代码](https://github.com/zotero/zotero)
- 项目 Issues 页面