/**
 * Direct loader - bypasses all complex initialization
 * 直接加载器 - 绕过所有复杂的初始化
 */

// 立即在全局创建对象
(function() {
  console.log("[RN Direct] Starting direct loader");
  
  // 创建基础插件对象
  const ResearchNavigator = {
    id: "research-navigator@zotero.org",
    version: "2.0.3-direct",
    initialized: false,
    
    // 模拟 modules
    modules: {
      uiManager: {
        toggleHistoryPanel: function(window) {
          console.log("[RN Direct] toggleHistoryPanel called");
          window.alert("Research Navigator Direct Mode\n\nHistory panel would open here.");
        }
      }
    },
    
    // 基础 hooks
    hooks: {
      onStartup: async function() {
        console.log("[RN Direct] onStartup called");
        ResearchNavigator.initialized = true;
      },
      
      onMainWindowLoad: async function(window) {
        console.log("[RN Direct] onMainWindowLoad called");
        
        // 直接创建一个可见的按钮
        try {
          const doc = window.document;
          
          // 尝试多个位置
          const toolbarIds = [
            "zotero-items-toolbar",
            "zotero-tb-advanced-search",
            "zotero-collections-toolbar",
            "zotero-toolbar"
          ];
          
          let added = false;
          for (const id of toolbarIds) {
            const toolbar = doc.getElementById(id);
            if (toolbar && !doc.getElementById("rn-direct-button")) {
              const button = doc.createXULElement("toolbarbutton");
              button.id = "rn-direct-button";
              button.label = "RN Direct";
              button.setAttribute("tooltiptext", "Research Navigator (Direct Mode)");
              button.style.cssText = `
                list-style-image: url('chrome://zotero/skin/16/universal/folder.svg');
                border: 2px solid blue !important;
                background-color: yellow !important;
              `;
              
              button.addEventListener("command", () => {
                ResearchNavigator.modules.uiManager.toggleHistoryPanel(window);
              });
              
              toolbar.appendChild(button);
              console.log(`[RN Direct] Button added to ${id}`);
              added = true;
              break;
            }
          }
          
          if (!added) {
            // 创建一个绝对定位的按钮
            const floater = doc.createElement("button");
            floater.id = "rn-direct-floater";
            floater.textContent = "RN";
            floater.style.cssText = `
              position: fixed !important;
              bottom: 10px !important;
              right: 10px !important;
              width: 60px !important;
              height: 60px !important;
              background-color: blue !important;
              color: white !important;
              border: none !important;
              border-radius: 50% !important;
              font-size: 20px !important;
              font-weight: bold !important;
              cursor: pointer !important;
              z-index: 99999 !important;
            `;
            
            floater.onclick = () => {
              ResearchNavigator.modules.uiManager.toggleHistoryPanel(window);
            };
            
            const container = doc.getElementById("main-window") || doc.body;
            container.appendChild(floater);
            console.log("[RN Direct] Floating button created");
          }
          
        } catch (e) {
          console.error("[RN Direct] Error creating UI:", e);
        }
      }
    }
  };
  
  // 尝试所有可能的注册方式
  try {
    // 1. 直接设置在 Zotero 上
    if (typeof Zotero !== "undefined") {
      Zotero.ResearchNavigator = ResearchNavigator;
      console.log("[RN Direct] ✓ Set on Zotero.ResearchNavigator");
    }
    
    // 2. 设置在 window.Zotero 上
    if (typeof window !== "undefined" && window.Zotero) {
      window.Zotero.ResearchNavigator = ResearchNavigator;
      console.log("[RN Direct] ✓ Set on window.Zotero.ResearchNavigator");
    }
    
    // 3. 设置 addon 变量
    if (typeof globalThis !== "undefined") {
      globalThis.addon = ResearchNavigator;
      console.log("[RN Direct] ✓ Set globalThis.addon");
    }
    
    // 4. 在当前上下文设置
    this.addon = ResearchNavigator;
    console.log("[RN Direct] ✓ Set this.addon");
    
    // 5. 尝试在 eval 上下文设置
    try {
      eval("var addon = ResearchNavigator; this.addon = ResearchNavigator;");
      console.log("[RN Direct] ✓ Set via eval");
    } catch (e) {
      console.log("[RN Direct] Could not set via eval");
    }
    
  } catch (e) {
    console.error("[RN Direct] Registration error:", e);
  }
  
  console.log("[RN Direct] Loader complete");
})();