# Zotero 插件测试环境构建请求

## 背景
我正在开发一个 Zotero 插件（Research Navigator），但插件安装后没有显示任何 UI 元素。需要构建一个正确的测试环境来调试问题。

## 需要的信息

### 1. Zotero 7 开发环境设置
请提供以下信息：
- 如何设置 Zotero 7 的开发环境（源码构建）
- 开发模式下如何加载和调试插件
- 如何查看插件加载的详细日志

### 2. 插件加载机制
请确认以下理解是否正确：
- Zotero 7 使用 `Zotero.Plugins.init()` 加载插件
- 插件在 Sandbox 中运行，通过 `Services.scriptloader.loadSubScriptWithOptions()` 加载
- bootstrap.js 中的函数必须在全局作用域
- `onMainWindowLoad({ window })` 接收的 window 是真实的 DOM 窗口

### 3. 调试方法
- 如何在开发环境中查看 `dump()` 输出
- 如何调试 Sandbox 中的代码
- 是否有特殊的调试标志或环境变量

### 4. 常见问题
请检查以下可能的问题：
- bootstrap.js 是否需要特定的文件编码（UTF-8 无 BOM？）
- manifest.json 的 applications.zotero.strict_min_version 是否影响加载
- chrome.manifest 是否是必需的
- 是否有权限或安全策略阻止 UI 元素创建

### 5. 测试代码
请在 Zotero 7 环境中测试以下最小化的 bootstrap.js：

```javascript
/* global dump, Components, Services */

dump("\n=== Research Navigator TEST ===\n");

function startup({ id, version, rootURI }, reason) {
  dump("[RN] startup called\n");
  
  if (typeof Zotero !== 'undefined') {
    Zotero.ResearchNavigatorTest = { loaded: true };
    dump("[RN] Set Zotero.ResearchNavigatorTest\n");
  }
}

function onMainWindowLoad({ window }, reason) {
  dump("[RN] onMainWindowLoad called\n");
  
  if (window && window.document) {
    // 创建一个简单的按钮
    const btn = window.document.createElement("button");
    btn.textContent = "RN TEST";
    btn.style.cssText = "position: fixed; top: 10px; right: 10px; z-index: 999999;";
    btn.onclick = () => window.alert("Plugin works!");
    
    window.document.documentElement.appendChild(btn);
    dump("[RN] Added button\n");
  }
}

function shutdown({ id, version, rootURI }, reason) {
  dump("[RN] shutdown called\n");
}

function install() {}
function uninstall() {}
```

### 6. 预期输出
请提供：
- 控制台输出（dump 消息）
- 是否看到按钮
- 错误控制台的任何错误信息
- `Zotero.ResearchNavigatorTest` 的值

### 7. 工作示例
如果可能，请提供：
- 一个已知可工作的最小化 Zotero 7 插件示例
- 正确的 manifest.json 配置
- 任何必需的额外文件

## 插件信息
- 名称：Zotero Research Navigator
- ID：research-navigator@zotero.org
- 版本：2.0.3
- 目标：Zotero 7.0-7.1.*

## 文件结构
```
addon/
  bootstrap.js
  manifest.json
  chrome.manifest
  content/
    icons/
      icon.svg
  locale/
    en-US/
      addon.ftl
    zh-CN/
      addon.ftl
```

请基于 Zotero 7 的实际源码和插件系统，提供准确的测试环境设置方法和调试建议。特别是如何确保插件的 UI 元素能够正确显示。

谢谢！