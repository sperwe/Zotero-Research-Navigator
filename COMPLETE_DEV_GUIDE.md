# Zotero Research Navigator 完整开发指南

## 📚 概述

本指南整合了 windingwind 的 Zotero 插件开发最佳实践和工具，为您在 `refactor/template-based-rewrite` 分支上的开发提供完整支持。

## 🛠️ 核心工具链

### 1. **Zotero Plugin Toolkit** ⭐
我们使用这个强大的工具包简化开发：

```typescript
import { BasicTool, UITool, PreferenceTool, ProgressWindow } from "zotero-plugin-toolkit";

// 示例：创建进度窗口
const progressWindow = new ProgressWindow(config.addonName);
progressWindow.createLine({
  text: "Processing items...",
  type: "default",
  progress: 0
});
```

[完整 API 文档](https://github.com/windingwind/zotero-plugin-toolkit/blob/master/docs/zotero-plugin-toolkit.md)

### 2. **Zotero Plugin Scaffold** ⭐
构建系统已配置在 `zotero-plugin.config.ts`：

```typescript
export default defineConfig({
  source: ["addon", "package.json"],
  dist: "build",
  name: pkg.config.addonName,
  id: pkg.config.addonID,
  namespace: pkg.config.addonRef,
  build: {
    esbuildOptions: [{
      entryPoints: ["src/index.ts"],
      bundle: true,
      target: "firefox115",
    }]
  }
});
```

### 3. **Zotero Types** ⭐
提供完整的 TypeScript 支持：

```typescript
// 类型安全的 Zotero API 使用
const item: Zotero.Item = await Zotero.Items.getAsync(itemID);
const library: Zotero.Library = item.library;
```

## 🚀 快速开始工作流

### 初始设置（只需运行一次）

```bash
# 1. 增强开发环境设置
./setup-enhanced-dev.sh

# 2. 设置 Zotero
./setup-zotero-dev.sh
```

### 日常开发流程

```bash
# 选项 1：使用快速启动（推荐）
./quick-start.sh
# 选择选项 2 使用开发助手

# 选项 2：手动命令
npm start          # 启动开发服务器
npm run build      # 构建插件
```

## 📝 代码示例和最佳实践

### 1. 插件初始化模式

```typescript
// src/index.ts
import { BasicTool } from "zotero-plugin-toolkit";
import { config } from "../package.json";

async function onStartup() {
  await BasicTool.waitForZotero();
  
  // 初始化插件
  addon.data.ztoolkit = new ZoteroToolkit();
  addon.data.ztoolkit.basicOptions.log.prefix = `[${config.addonName}]`;
  
  // 注册通知监听器
  registerNotifier();
  
  // 等待主窗口
  await waitForMainWindow();
}

async function waitForMainWindow() {
  await new Promise<void>((resolve) => {
    if (window.location.href === "chrome://zotero/content/zotero.xhtml") {
      resolve();
    } else {
      const observer = {
        observe: (subject: any) => {
          if (subject.location.href === "chrome://zotero/content/zotero.xhtml") {
            Services.wm.removeListener(observer);
            resolve();
          }
        }
      };
      Services.wm.addListener(observer);
    }
  });
}
```

### 2. UI 创建最佳实践

```typescript
// 使用 ztoolkit 创建 UI
import { UITool } from "zotero-plugin-toolkit";

function createToolbarButton(doc: Document) {
  const props: XUL.Attributes = {
    id: `${config.addonRef}-toolbar-button`,
    class: "zotero-tb-button",
    tooltiptext: getString("toolbar-button-tooltip"),
    style: "list-style-image: url(chrome://researchnavigator/content/icons/icon.svg)",
    onclick: "ResearchNavigator.togglePanel()"
  };
  
  return UITool.createElement(doc, "toolbarbutton", props);
}

// 创建 React 组件（Zotero 7）
function createReactPanel(doc: Document) {
  const container = UITool.createElement(doc, "div", {
    id: `${config.addonRef}-react-panel`,
    classList: ["research-navigator-panel"]
  });
  
  const React = require("react");
  const ReactDOM = require("react-dom");
  
  ReactDOM.render(
    <HistoryPanel 
      history={addon.data.history}
      onItemClick={handleItemClick}
    />,
    container
  );
  
  return container;
}
```

### 3. 数据存储模式

```typescript
// 使用 Zotero 偏好设置系统
class DataManager {
  private prefix = config.prefsPrefix;
  
  async saveData(key: string, data: any) {
    const serialized = JSON.stringify(data);
    Zotero.Prefs.set(`${this.prefix}.${key}`, serialized);
  }
  
  async loadData(key: string): Promise<any> {
    const serialized = Zotero.Prefs.get(`${this.prefix}.${key}`);
    return serialized ? JSON.parse(serialized) : null;
  }
  
  // 使用 Zotero 数据库存储大量数据
  async saveLargeData(key: string, data: any) {
    await Zotero.DB.queryAsync(
      "INSERT OR REPLACE INTO settings (setting, key, value) VALUES (?, ?, ?)",
      [config.addonID, key, JSON.stringify(data)]
    );
  }
}
```

### 4. 事件处理和通知

```typescript
// 注册 Notifier
function registerNotifier() {
  const notifierID = Zotero.Notifier.registerObserver({
    notify: async (
      event: string,
      type: string,
      ids: number[] | string[],
      extraData: any
    ) => {
      if (type === "item") {
        switch (event) {
          case "add":
            await handleItemsAdded(ids as number[]);
            break;
          case "modify":
            await handleItemsModified(ids as number[]);
            break;
          case "delete":
            await handleItemsDeleted(ids as number[]);
            break;
        }
      }
    }
  }, ["item", "collection", "search"]);
  
  // 在关闭时注销
  addon.data.notifierID = notifierID;
}

// 清理
function unregisterNotifier() {
  if (addon.data.notifierID) {
    Zotero.Notifier.unregisterObserver(addon.data.notifierID);
  }
}
```

### 5. 本地化 (Fluent)

```ftl
# addon/locale/en-US/addon.ftl
addon-name = Research Navigator
addon-description = Track research history in Zotero

toolbar-button-tooltip = Open Research Navigator
history-panel-title = Research History
clear-history = Clear History
clear-history-confirm = Are you sure you want to clear all history?
```

```typescript
// 使用本地化字符串
function getString(key: string, args?: Record<string, string>) {
  return Zotero.getString(`${config.addonRef}.${key}`, args);
}

// 在 UI 中使用
const button = {
  label: getString("toolbar-button-label"),
  tooltiptext: getString("toolbar-button-tooltip")
};
```

## 🐛 调试技巧

### 1. 启用详细日志

```typescript
// 在开发环境中启用
if (__env__ === "development") {
  Zotero.Prefs.set("extensions.zotero.debug.log", true);
  Zotero.Prefs.set("extensions.zotero.debug.level", 5);
}
```

### 2. 使用 Zotero 调试工具

```javascript
// 打开浏览器工具箱
Zotero.openInViewer("chrome://devtools/content/devtools-browser-toolbox/index.xhtml");

// 检查对象
Zotero.debug(JSON.stringify(myObject, null, 2));

// 性能计时
console.time("myOperation");
// ... 代码 ...
console.timeEnd("myOperation");
```

### 3. VS Code 远程调试

使用我们创建的 `.vscode/launch.json` 配置，按 F5 启动调试。

## 📊 性能优化

### 1. 异步操作

```typescript
// ❌ 不好：同步操作
const items = Zotero.Items.get(itemIDs);

// ✅ 好：异步操作
const items = await Zotero.Items.getAsync(itemIDs);
```

### 2. 批量数据库操作

```typescript
// ❌ 不好：多次查询
for (const id of itemIDs) {
  await Zotero.DB.queryAsync("UPDATE items SET ...", [id]);
}

// ✅ 好：事务批处理
await Zotero.DB.executeTransaction(async function () {
  for (const id of itemIDs) {
    await Zotero.DB.queryAsync("UPDATE items SET ...", [id]);
  }
});
```

### 3. 防抖和节流

```typescript
import { debounce, throttle } from "./utils";

// 搜索输入防抖
const debouncedSearch = debounce((query: string) => {
  performSearch(query);
}, 300);

// 滚动事件节流
const throttledScroll = throttle(() => {
  updateVisibleItems();
}, 100);
```

## 🚀 高级特性

### 1. 使用 React (Zotero 7)

```tsx
// components/HistoryList.tsx
import React, { useState, useEffect } from "react";

export const HistoryList: React.FC<{ items: HistoryItem[] }> = ({ items }) => {
  const [filter, setFilter] = useState("");
  
  const filteredItems = items.filter(item => 
    item.title.toLowerCase().includes(filter.toLowerCase())
  );
  
  return (
    <div className="history-list">
      <input 
        type="search"
        placeholder="Filter history..."
        onChange={(e) => setFilter(e.target.value)}
      />
      <ul>
        {filteredItems.map(item => (
          <li key={item.id} onClick={() => openItem(item.id)}>
            {item.title}
          </li>
        ))}
      </ul>
    </div>
  );
};
```

### 2. Web Worker 支持

```typescript
// worker.js
self.addEventListener("message", async (event) => {
  const { action, data } = event.data;
  
  switch (action) {
    case "buildIndex":
      const index = await buildSearchIndex(data);
      self.postMessage({ action: "indexBuilt", data: index });
      break;
  }
});

// 主线程
const worker = new Worker("chrome://researchnavigator/content/worker.js");
worker.postMessage({ action: "buildIndex", data: items });
```

## 📦 发布流程

### 1. 版本更新

```bash
# 更新版本号
npm version patch  # 或 minor, major

# 构建生产版本
npm run build-prod

# 创建发布
npm run release
```

### 2. 更新 update.json

```json
{
  "addons": {
    "research-navigator@zotero.org": {
      "updates": [
        {
          "version": "2.0.3",
          "update_link": "https://github.com/user/repo/releases/download/v2.0.3/zotero-research-navigator.xpi",
          "applications": {
            "zotero": {
              "strict_min_version": "7.0.0"
            }
          }
        }
      ]
    }
  }
}
```

## 🔗 重要资源

- [Zotero 7 开发文档](https://www.zotero.org/support/dev/zotero_7_for_developers)
- [Zotero 源代码](https://github.com/zotero/zotero)
- [Plugin Toolkit API](https://github.com/windingwind/zotero-plugin-toolkit/blob/master/docs/zotero-plugin-toolkit.md)
- [插件模板](https://github.com/windingwind/zotero-plugin-template)
- [开发论坛](https://forums.zotero.org/categories/dev)

## 💡 专业提示

1. **经常查看其他插件源码**，特别是 windingwind 的插件
2. **使用 TypeScript** 获得更好的开发体验
3. **遵循 Zotero 的 UI 规范**，保持一致性
4. **测试不同语言环境**，确保国际化正确
5. **关注性能**，特别是对大型文库的处理

祝您开发顺利！如需帮助，请查阅资源或在社区提问。🚀