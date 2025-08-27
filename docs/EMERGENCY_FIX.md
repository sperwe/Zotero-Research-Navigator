# 紧急修复指南 - Research Navigator 无法显示

## 问题症状
- `Zotero.ResearchNavigator` 返回 undefined
- 看不到工具栏按钮
- Tools 菜单中没有 Research Navigator
- 右键菜单中没有相关选项

## 立即尝试的解决方案

### 方案 1：手动初始化插件（临时解决）

在 Zotero 中打开 Tools → Developer → Run JavaScript，运行以下代码：

```javascript
// 手动查找并初始化插件
(async function() {
  // 检查是否有隐藏的 addon 实例
  const possibleLocations = [
    window.addon,
    globalThis.addon,
    this.addon,
    document.addon
  ];
  
  let addon = null;
  for (const loc of possibleLocations) {
    if (loc && loc.hooks) {
      addon = loc;
      console.log('Found addon at:', possibleLocations.indexOf(loc));
      break;
    }
  }
  
  if (addon) {
    // 手动注册到 Zotero
    Zotero.ResearchNavigator = addon;
    console.log('Manually registered addon to Zotero.ResearchNavigator');
    
    // 尝试初始化 UI
    if (addon.hooks && addon.hooks.onMainWindowLoad) {
      try {
        await addon.hooks.onMainWindowLoad(window);
        console.log('UI initialization attempted');
      } catch (e) {
        console.error('UI initialization failed:', e);
      }
    }
  } else {
    console.error('No addon instance found anywhere');
  }
})();
```

### 方案 2：创建临时访问按钮

如果上面的方法不行，运行这个代码创建一个临时按钮：

```javascript
// 创建临时按钮
(function() {
  const doc = window.document;
  
  // 移除旧按钮
  const oldBtn = doc.getElementById('rn-temp-button');
  if (oldBtn) oldBtn.remove();
  
  // 查找工具栏
  const toolbars = [
    'zotero-items-toolbar',
    'zotero-tb-advanced-search',
    'zotero-collections-toolbar'
  ];
  
  let toolbar = null;
  for (const id of toolbars) {
    toolbar = doc.getElementById(id);
    if (toolbar) break;
  }
  
  if (toolbar) {
    // 创建按钮
    const button = doc.createXULElement('toolbarbutton');
    button.id = 'rn-temp-button';
    button.label = 'Research Nav';
    button.tooltipText = 'Open Research Navigator (Temporary)';
    button.style.listStyleImage = 'url(chrome://zotero/skin/16/universal/folder.svg)';
    button.style.border = '1px solid red';
    
    button.addEventListener('command', () => {
      // 尝试打开历史面板
      if (Zotero.ResearchNavigator && Zotero.ResearchNavigator.modules) {
        const uiManager = Zotero.ResearchNavigator.modules.uiManager;
        if (uiManager && uiManager.toggleHistoryPanel) {
          uiManager.toggleHistoryPanel(window);
        } else {
          alert('UI Manager not available');
        }
      } else {
        alert('Research Navigator not loaded.\n\nTry:\n1. Restart Zotero\n2. Disable and re-enable the plugin\n3. Reinstall the plugin');
      }
    });
    
    toolbar.appendChild(button);
    console.log('Temporary button created in ' + toolbar.id);
  } else {
    // 创建浮动按钮
    const floater = doc.createElement('div');
    floater.id = 'rn-temp-floater';
    floater.innerHTML = 'RN';
    floater.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 50px;
      height: 50px;
      background: red;
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 9999;
      font-weight: bold;
    `;
    
    floater.onclick = () => {
      alert('Research Navigator emergency button clicked.\n\nPlugin not properly loaded.');
    };
    
    doc.body.appendChild(floater);
    console.log('Emergency floating button created');
  }
})();
```

### 方案 3：完全重新安装

1. **完全卸载插件**
   - Tools → Add-ons
   - 找到 Research Navigator
   - 点击 Remove
   - 重启 Zotero

2. **清理残留**
   - 关闭 Zotero
   - 删除 Zotero 配置目录中的插件相关文件
   - Windows: `%APPDATA%\Zotero\Zotero\Profiles\*.default\extensions\research-navigator@zotero.org.xpi`
   - Mac: `~/Library/Application Support/Zotero/Profiles/*.default/extensions/research-navigator@zotero.org.xpi`
   - Linux: `~/.zotero/zotero/*.default/extensions/research-navigator@zotero.org.xpi`

3. **安装测试版本**
   - 下载 `zotero-research-navigator-v2.0.3-minimal-test.xpi`
   - 这是一个最小化测试版本，应该能显示基本功能
   - 安装后应该能看到一个 "RN Test" 按钮

## 诊断信息收集

运行以下代码收集诊断信息：

```javascript
// 收集诊断信息
console.log('=== Research Navigator Diagnostic ===');
console.log('Zotero version:', Zotero.version);
console.log('Platform:', Zotero.platform);

// 检查插件加载
console.log('\nPlugin status:');
console.log('typeof Zotero.ResearchNavigator:', typeof Zotero.ResearchNavigator);

// 检查 bootstrap 环境
console.log('\nBootstrap environment:');
console.log('typeof addon:', typeof addon);
console.log('typeof globalThis.addon:', typeof globalThis.addon);
console.log('typeof window.addon:', typeof window.addon);

// 检查工具栏
console.log('\nToolbars:');
['zotero-items-toolbar', 'zotero-tb-advanced-search'].forEach(id => {
  const tb = document.getElementById(id);
  console.log(`${id}:`, tb ? 'exists' : 'not found');
});

// 检查已加载的插件
console.log('\nLoaded plugins:');
if (Zotero.getInstalledExtensions) {
  Zotero.getInstalledExtensions().then(exts => {
    exts.forEach(ext => {
      if (ext.id.includes('research') || ext.id.includes('navigator')) {
        console.log(`- ${ext.name} (${ext.id}) v${ext.version}`);
      }
    });
  });
}
```

## 根本原因

插件加载过程中的某个环节失败了：
1. Bootstrap.js 成功加载了脚本
2. 但 addon 实例没有正确暴露到 Zotero.ResearchNavigator
3. 导致所有 UI 组件无法初始化

## 下一步

1. 尝试上述临时解决方案
2. 收集诊断信息
3. 报告具体的错误信息和环境
4. 我们将提供针对性的修复版本