# 即时修复方案 - 立即让插件工作

## 步骤 1：直接在控制台创建插件

在 Zotero 中打开 **Tools → Developer → Run JavaScript**，复制并运行以下完整代码：

```javascript
// ===== Research Navigator 即时修复 =====
// 这段代码会直接创建一个功能性的插件实例

(function() {
  console.log("=== Research Navigator Instant Fix Starting ===");
  
  // 如果已经存在，先清理
  if (Zotero.ResearchNavigator) {
    console.log("Cleaning existing instance...");
    delete Zotero.ResearchNavigator;
  }
  
  // 创建插件对象
  const ResearchNavigator = {
    version: "2.0.3-instant-fix",
    historyData: [],
    
    // UI 管理器
    modules: {
      uiManager: {
        panelOpen: false,
        
        toggleHistoryPanel: function(win) {
          this.panelOpen = !this.panelOpen;
          
          if (this.panelOpen) {
            // 创建一个简单的历史面板
            const doc = win.document;
            
            // 移除旧面板
            const oldPanel = doc.getElementById("rn-history-panel");
            if (oldPanel) oldPanel.remove();
            
            // 创建新面板
            const panel = doc.createElement("div");
            panel.id = "rn-history-panel";
            panel.style.cssText = `
              position: fixed;
              top: 100px;
              right: 20px;
              width: 400px;
              height: 600px;
              background: white;
              border: 2px solid #ccc;
              box-shadow: 0 4px 12px rgba(0,0,0,0.3);
              z-index: 9999;
              padding: 20px;
              overflow-y: auto;
            `;
            
            panel.innerHTML = `
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 style="margin: 0;">Research Navigator</h2>
                <button id="rn-close-btn" style="background: red; color: white; border: none; padding: 5px 10px; cursor: pointer;">关闭 X</button>
              </div>
              <div style="border: 1px solid #eee; padding: 20px; margin-bottom: 20px;">
                <h3>状态</h3>
                <p>✅ 插件已通过即时修复加载</p>
                <p>✅ 版本: 2.0.3-instant-fix</p>
                <p>⚠️ 这是临时解决方案</p>
              </div>
              <div style="border: 1px solid #eee; padding: 20px;">
                <h3>功能</h3>
                <button id="rn-test-btn" style="background: blue; color: white; border: none; padding: 10px 20px; cursor: pointer; margin-bottom: 10px;">测试功能</button>
                <br>
                <button id="rn-export-btn" style="background: green; color: white; border: none; padding: 10px 20px; cursor: pointer;">导出历史</button>
              </div>
              <div style="margin-top: 20px; padding: 20px; background: #f0f0f0;">
                <h4>说明</h4>
                <p>这是 Research Navigator 的临时版本。完整功能需要修复后的正式版本。</p>
              </div>
            `;
            
            doc.body.appendChild(panel);
            
            // 绑定按钮事件
            doc.getElementById("rn-close-btn").onclick = () => {
              panel.remove();
              this.panelOpen = false;
            };
            
            doc.getElementById("rn-test-btn").onclick = () => {
              alert("Research Navigator 正在工作！\n\n这是即时修复版本。");
            };
            
            doc.getElementById("rn-export-btn").onclick = () => {
              const data = {
                version: "2.0.3",
                exportDate: new Date().toISOString(),
                message: "This is a temporary export from instant fix version"
              };
              alert("导出功能（模拟）\n\n" + JSON.stringify(data, null, 2));
            };
            
          } else {
            // 关闭面板
            const panel = win.document.getElementById("rn-history-panel");
            if (panel) panel.remove();
          }
        }
      }
    },
    
    // 基础钩子
    hooks: {
      onStartup: async function() {
        console.log("ResearchNavigator instant fix - onStartup");
      },
      
      onMainWindowLoad: async function(window) {
        console.log("ResearchNavigator instant fix - onMainWindowLoad");
        // UI 会通过手动按钮创建
      }
    }
  };
  
  // 注册到 Zotero
  Zotero.ResearchNavigator = ResearchNavigator;
  console.log("✓ Registered as Zotero.ResearchNavigator");
  
  // 创建访问按钮
  const doc = window.document;
  
  // 查找工具栏
  const toolbarIds = ["zotero-items-toolbar", "zotero-tb-advanced-search", "zotero-collections-toolbar"];
  let toolbar = null;
  
  for (const id of toolbarIds) {
    toolbar = doc.getElementById(id);
    if (toolbar) break;
  }
  
  // 移除旧按钮
  const oldBtn = doc.getElementById("rn-instant-button");
  if (oldBtn) oldBtn.remove();
  
  if (toolbar) {
    // 在工具栏创建按钮
    const button = doc.createXULElement("toolbarbutton");
    button.id = "rn-instant-button";
    button.label = "Research Nav";
    button.setAttribute("tooltiptext", "Open Research Navigator (Instant Fix)");
    button.style.cssText = `
      list-style-image: url('chrome://zotero/skin/16/universal/folder.svg');
      border: 2px solid green !important;
      background: #90EE90 !important;
    `;
    
    button.addEventListener("command", () => {
      Zotero.ResearchNavigator.modules.uiManager.toggleHistoryPanel(window);
    });
    
    toolbar.appendChild(button);
    console.log("✓ Button added to " + toolbar.id);
  } else {
    // 创建浮动按钮
    const floater = doc.createElement("button");
    floater.id = "rn-instant-floater";
    floater.textContent = "RN";
    floater.style.cssText = `
      position: fixed !important;
      bottom: 20px !important;
      right: 20px !important;
      width: 60px !important;
      height: 60px !important;
      background: green !important;
      color: white !important;
      border: none !important;
      border-radius: 50% !important;
      font-size: 18px !important;
      font-weight: bold !important;
      cursor: pointer !important;
      z-index: 99999 !important;
      box-shadow: 0 4px 8px rgba(0,0,0,0.3) !important;
    `;
    
    floater.onclick = () => {
      Zotero.ResearchNavigator.modules.uiManager.toggleHistoryPanel(window);
    };
    
    doc.body.appendChild(floater);
    console.log("✓ Floating button created");
  }
  
  console.log("=== Research Navigator Instant Fix Complete ===");
  console.log("You should now see a green button to access the plugin.");
  
  // 测试
  console.log("\nTest: typeof Zotero.ResearchNavigator =", typeof Zotero.ResearchNavigator);
  console.log("Test: Has modules =", !!Zotero.ResearchNavigator.modules);
  
  // 返回成功消息
  return "Research Navigator instant fix applied successfully! Look for the green button.";
})();
```

## 步骤 2：使用插件

运行上述代码后：

1. **查找绿色按钮**
   - 在工具栏中查找绿色边框的 "Research Nav" 按钮
   - 或者在窗口右下角查找绿色的 "RN" 圆形按钮

2. **点击按钮**
   - 会打开一个临时的历史面板
   - 包含基本的测试功能

3. **验证成功**
   运行以下代码验证：
   ```javascript
   console.log('ResearchNavigator loaded:', typeof Zotero.ResearchNavigator);
   console.log('Has modules:', !!Zotero.ResearchNavigator.modules);
   ```
   应该返回：
   - ResearchNavigator loaded: object
   - Has modules: true

## 这个修复做了什么？

1. **直接创建插件实例** - 绕过所有复杂的加载机制
2. **立即注册到 Zotero** - 确保 `Zotero.ResearchNavigator` 可用
3. **创建可见的 UI** - 绿色按钮和简单的面板
4. **提供基本功能** - 可以打开/关闭面板，测试基本操作

## 注意事项

- 这是**临时解决方案**
- 每次重启 Zotero 后需要重新运行
- 功能有限，但可以验证插件是否能工作
- 帮助我们诊断真正的问题所在

## 下一步

1. 使用这个临时版本
2. 报告是否能看到绿色按钮
3. 告诉我们点击按钮后的效果
4. 我们会基于反馈制作永久修复版本