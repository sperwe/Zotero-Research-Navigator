#!/bin/bash

# Zotero Research Navigator 增强开发环境设置
# 基于 windingwind 的最佳实践和工具

set -e

echo "======================================"
echo "Enhanced Zotero Development Setup"
echo "======================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查 Node 版本
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo -e "${RED}错误：需要 Node.js 16 或更高版本${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Node.js 版本检查通过${NC}"

# 1. 安装/更新依赖
echo ""
echo -e "${BLUE}1. 检查并更新依赖...${NC}"

# 检查是否需要安装依赖
if [ ! -d "node_modules" ]; then
    echo "安装项目依赖..."
    npm install
else
    echo "更新依赖到最新版本..."
    npm update zotero-plugin-toolkit zotero-types zotero-plugin-scaffold
fi

# 2. 验证开发工具
echo ""
echo -e "${BLUE}2. 验证开发工具...${NC}"

# 检查 zotero-plugin-toolkit
if npm list zotero-plugin-toolkit >/dev/null 2>&1; then
    TOOLKIT_VERSION=$(npm list zotero-plugin-toolkit --depth=0 | grep zotero-plugin-toolkit | awk -F@ '{print $NF}')
    echo -e "${GREEN}✓ zotero-plugin-toolkit: $TOOLKIT_VERSION${NC}"
else
    echo -e "${RED}✗ zotero-plugin-toolkit 未安装${NC}"
fi

# 检查 zotero-types
if npm list zotero-types >/dev/null 2>&1; then
    TYPES_VERSION=$(npm list zotero-types --depth=0 | grep zotero-types | awk -F@ '{print $NF}')
    echo -e "${GREEN}✓ zotero-types: $TYPES_VERSION${NC}"
else
    echo -e "${RED}✗ zotero-types 未安装${NC}"
fi

# 检查 zotero-plugin-scaffold
if npm list zotero-plugin-scaffold >/dev/null 2>&1; then
    SCAFFOLD_VERSION=$(npm list zotero-plugin-scaffold --depth=0 | grep zotero-plugin-scaffold | awk -F@ '{print $NF}')
    echo -e "${GREEN}✓ zotero-plugin-scaffold: $SCAFFOLD_VERSION${NC}"
else
    echo -e "${RED}✗ zotero-plugin-scaffold 未安装${NC}"
fi

# 3. 设置 TypeScript 配置
echo ""
echo -e "${BLUE}3. 优化 TypeScript 配置...${NC}"

# 创建优化的 tsconfig.json
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "es2018",
    "module": "esnext",
    "lib": ["es2018", "dom"],
    "jsx": "react",
    "declaration": false,
    "outDir": "./build",
    "strict": false,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "moduleResolution": "node",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true,
    "typeRoots": ["./node_modules/@types", "./typings"],
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true
  },
  "include": ["src/**/*", "typings/**/*"],
  "exclude": ["node_modules", "build", "dist"]
}
EOF

echo -e "${GREEN}✓ TypeScript 配置已优化${NC}"

# 4. 创建开发辅助脚本
echo ""
echo -e "${BLUE}4. 创建开发辅助脚本...${NC}"

# 创建 VS Code 调试配置
mkdir -p .vscode
cat > .vscode/launch.json << 'EOF'
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "firefox",
      "request": "launch",
      "name": "Zotero Debug",
      "firefoxExecutable": "${env:HOME}/zotero-dev/zotero-beta/zotero",
      "profileDir": "${env:HOME}/zotero-dev/zotero-profile",
      "tmpDir": "${workspaceFolder}/.vscode/firefox-debug",
      "preLaunchTask": "npm: build",
      "port": 6005,
      "clearConsoleOnReload": true,
      "reAttach": true,
      "reloadOnAttach": true,
      "reloadOnChange": {
        "watch": "${workspaceFolder}/build/**/*.{js,xhtml,ftl}",
        "ignore": ""
      }
    }
  ]
}
EOF

# 创建 VS Code 任务配置
cat > .vscode/tasks.json << 'EOF'
{
  "version": "2.0.0",
  "tasks": [
    {
      "type": "npm",
      "script": "build",
      "group": {
        "kind": "build",
        "isDefault": true
      },
      "problemMatcher": [],
      "label": "npm: build",
      "detail": "Build the plugin"
    },
    {
      "type": "npm",
      "script": "start",
      "group": "build",
      "problemMatcher": [],
      "label": "npm: start",
      "detail": "Start development server"
    }
  ]
}
EOF

echo -e "${GREEN}✓ VS Code 配置已创建${NC}"

# 5. 创建测试数据生成器
cat > generate-test-data.js << 'EOF'
#!/usr/bin/env node

/**
 * 生成测试数据用于开发
 */

const fs = require('fs');
const path = require('path');

const testItems = [
  {
    id: 1,
    title: "Deep Learning for Natural Language Processing",
    authors: ["Yoav Goldberg", "Graeme Hirst"],
    type: "journalArticle",
    date: "2023-06-15",
    doi: "10.1234/example.2023.001"
  },
  {
    id: 2,
    title: "Attention Is All You Need",
    authors: ["Ashish Vaswani", "Noam Shazeer", "Niki Parmar"],
    type: "conferencePaper",
    date: "2017-06-12",
    doi: "10.5555/3295222.3295349"
  },
  {
    id: 3,
    title: "BERT: Pre-training of Deep Bidirectional Transformers",
    authors: ["Jacob Devlin", "Ming-Wei Chang", "Kenton Lee"],
    type: "preprint",
    date: "2018-10-11",
    doi: "10.48550/arXiv.1810.04805"
  }
];

const testHistory = testItems.map((item, index) => ({
  itemID: item.id,
  title: item.title,
  timestamp: Date.now() - (index * 3600000), // 1小时间隔
  action: index === 0 ? 'open' : 'view',
  metadata: {
    authors: item.authors,
    type: item.type,
    date: item.date
  }
}));

// 保存测试数据
const testDataDir = path.join(__dirname, 'test-data');
if (!fs.existsSync(testDataDir)) {
  fs.mkdirSync(testDataDir);
}

fs.writeFileSync(
  path.join(testDataDir, 'test-history.json'),
  JSON.stringify(testHistory, null, 2)
);

fs.writeFileSync(
  path.join(testDataDir, 'test-items.json'),
  JSON.stringify(testItems, null, 2)
);

console.log('✓ 测试数据已生成到 test-data/ 目录');
EOF

chmod +x generate-test-data.js

# 6. 创建性能监控工具
cat > monitor-performance.js << 'EOF'
#!/usr/bin/env node

/**
 * 监控插件性能
 */

const fs = require('fs');
const path = require('path');

class PerformanceMonitor {
  constructor() {
    this.metrics = [];
    this.logFile = path.join(__dirname, 'performance.log');
  }

  logMetric(operation, duration, metadata = {}) {
    const metric = {
      timestamp: new Date().toISOString(),
      operation,
      duration,
      ...metadata
    };
    
    this.metrics.push(metric);
    
    // 追加到日志文件
    fs.appendFileSync(this.logFile, JSON.stringify(metric) + '\n');
  }

  generateReport() {
    const operations = {};
    
    this.metrics.forEach(metric => {
      if (!operations[metric.operation]) {
        operations[metric.operation] = {
          count: 0,
          totalDuration: 0,
          avgDuration: 0,
          maxDuration: 0,
          minDuration: Infinity
        };
      }
      
      const op = operations[metric.operation];
      op.count++;
      op.totalDuration += metric.duration;
      op.maxDuration = Math.max(op.maxDuration, metric.duration);
      op.minDuration = Math.min(op.minDuration, metric.duration);
    });
    
    // 计算平均值
    Object.keys(operations).forEach(key => {
      const op = operations[key];
      op.avgDuration = op.totalDuration / op.count;
    });
    
    return operations;
  }
}

// 使用示例
const monitor = new PerformanceMonitor();

// 模拟一些操作
monitor.logMetric('history.load', 45.3);
monitor.logMetric('ui.render', 12.7);
monitor.logMetric('search.index', 156.2);
monitor.logMetric('history.load', 38.9);

console.log('性能报告:');
console.log(JSON.stringify(monitor.generateReport(), null, 2));
EOF

chmod +x monitor-performance.js

# 7. 设置 Git hooks
echo ""
echo -e "${BLUE}5. 设置 Git hooks...${NC}"

mkdir -p .git/hooks

# pre-commit hook
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
# 在提交前运行测试和代码检查

echo "运行代码检查..."
npm run lint:check

if [ $? -ne 0 ]; then
    echo "代码检查失败，请修复后再提交"
    exit 1
fi

echo "构建插件..."
npm run build

if [ $? -ne 0 ]; then
    echo "构建失败，请修复后再提交"
    exit 1
fi

echo "✓ 预提交检查通过"
EOF

chmod +x .git/hooks/pre-commit

echo -e "${GREEN}✓ Git hooks 已设置${NC}"

# 8. 创建开发文档
echo ""
echo -e "${BLUE}6. 生成开发速查表...${NC}"

cat > DEVELOPMENT_CHEATSHEET.md << 'EOF'
# Zotero Research Navigator 开发速查表

## 🚀 快速命令

```bash
# 构建
npm run build          # 开发构建
npm run build-prod     # 生产构建

# 开发
npm start             # 启动开发服务器
./quick-start.sh      # 快速启动

# 测试
npm test              # 运行所有测试
./generate-test-data.js  # 生成测试数据

# 代码质量
npm run lint:check    # 检查代码
npm run lint:fix      # 自动修复
```

## 📝 常用代码片段

### 使用 ZToolkit
```typescript
import { ztoolkit } from "./utils/ztoolkit";

// 日志
ztoolkit.log("Debug message");

// 创建 UI 元素
const button = ztoolkit.UI.createElement(doc, "button", {
  id: "my-button",
  classList: ["toolbar-button"],
  properties: {
    label: "Click me"
  }
});

// 注册菜单
ztoolkit.Menu.register("menuTools", {
  label: "My Menu Item",
  commandListener: () => console.log("Clicked!")
});
```

### 访问 Zotero API
```typescript
// 获取选中的条目
const items = Zotero.getActiveZoteroPane().getSelectedItems();

// 监听事件
Zotero.Notifier.registerObserver({
  notify: (event, type, ids) => {
    // 处理事件
  }
}, ["item"]);

// 存储偏好设置
Zotero.Prefs.set("extensions.researchnavigator.mypref", value);
const value = Zotero.Prefs.get("extensions.researchnavigator.mypref");
```

### React 组件（Zotero 7）
```tsx
import React from "react";
import { createRoot } from "react-dom/client";

const MyComponent = () => {
  return <div>Hello Zotero!</div>;
};

const container = document.getElementById("my-container");
const root = createRoot(container);
root.render(<MyComponent />);
```

## 🐛 调试技巧

1. **开启调试日志**
   ```javascript
   Zotero.Prefs.set("extensions.zotero.debug.log", true);
   ```

2. **查看错误控制台**
   - 工具 → 开发者 → 错误控制台
   - 或使用快捷键 Ctrl+Shift+J

3. **远程调试**
   ```bash
   ~/zotero-dev/zotero-beta/zotero -jsdebugger -purgecaches
   ```

## 🔧 性能优化

1. **使用异步操作**
   ```typescript
   await Zotero.DB.queryAsync(sql);
   ```

2. **批量处理**
   ```typescript
   await Zotero.DB.executeTransaction(async () => {
     // 批量操作
   });
   ```

3. **缓存频繁访问的数据**
   ```typescript
   const cache = new Map();
   ```

## 📦 发布检查清单

- [ ] 更新版本号 (package.json)
- [ ] 更新 CHANGELOG
- [ ] 运行所有测试
- [ ] 在不同 Zotero 版本测试
- [ ] 构建生产版本
- [ ] 创建 GitHub Release
- [ ] 更新 update.json
EOF

echo -e "${GREEN}✓ 开发速查表已创建${NC}"

# 完成
echo ""
echo -e "${GREEN}======================================"
echo "✨ 增强开发环境设置完成！"
echo "======================================${NC}"
echo ""
echo "下一步："
echo "1. 运行 ${YELLOW}./quick-start.sh${NC} 启动开发"
echo "2. 查看 ${YELLOW}DEVELOPMENT_CHEATSHEET.md${NC} 快速参考"
echo "3. 使用 VS Code 打开项目享受完整的开发体验"
echo ""
echo "有用的命令："
echo "- ${BLUE}./generate-test-data.js${NC} - 生成测试数据"
echo "- ${BLUE}./monitor-performance.js${NC} - 监控性能"
echo "- ${BLUE}npm start${NC} - 启动开发服务器"
echo ""
echo "祝您开发愉快！🚀"