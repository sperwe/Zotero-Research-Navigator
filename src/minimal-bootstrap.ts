/**
 * 最小化的 bootstrap 测试
 * 用于诊断插件加载问题
 */

// 声明 dump 函数（如果不存在则使用 console.log）
declare function dump(msg: string): void;
if (typeof dump === 'undefined') {
  (globalThis as any).dump = (msg: string) => console.log(msg);
}

// 直接在全局作用域定义函数
(globalThis as any).install = function() {
  dump("[Research Navigator MINIMAL] install() called\n");
};

(globalThis as any).startup = async function({ id, version, rootURI }, reason) {
  dump("[Research Navigator MINIMAL] startup() called\n");
  dump("[Research Navigator MINIMAL] rootURI: " + rootURI + "\n");
  
  try {
    // 尝试访问 Zotero
    if (typeof Zotero !== "undefined") {
      dump("[Research Navigator MINIMAL] Zotero found\n");
      
      // 创建一个简单的通知
      Zotero.Prefs.set("extensions.researchnavigator.loaded", true);
      
      // 尝试在 Zotero 上设置一个属性
      Zotero.ResearchNavigatorMinimal = {
        version: version,
        loaded: true,
        test: function() {
          return "Research Navigator Minimal is loaded!";
        }
      };
      
      dump("[Research Navigator MINIMAL] Set Zotero.ResearchNavigatorMinimal\n");
    } else {
      dump("[Research Navigator MINIMAL] ERROR: Zotero not found\n");
    }
  } catch (e) {
    dump("[Research Navigator MINIMAL] ERROR in startup: " + e + "\n");
  }
};

(globalThis as any).onMainWindowLoad = async function({ window }, reason) {
  dump("[Research Navigator MINIMAL] onMainWindowLoad() called\n");
  
  try {
    if (window && window.document) {
      dump("[Research Navigator MINIMAL] Window location: " + window.location.href + "\n");
      
      // 尝试添加一个简单的菜单项
      if (window.document.getElementById("menu_ToolsPopup")) {
        dump("[Research Navigator MINIMAL] Found Tools menu\n");
        
        const menu = window.document.getElementById("menu_ToolsPopup");
        const menuitem = window.document.createXULElement("menuitem");
        menuitem.setAttribute("id", "research-navigator-minimal-test");
        menuitem.setAttribute("label", "Research Navigator Minimal Test");
        menuitem.addEventListener("command", function() {
          window.alert("Research Navigator Minimal is working!");
        });
        
        menu.appendChild(menuitem);
        dump("[Research Navigator MINIMAL] Added menu item\n");
      }
      
      // 尝试创建一个简单的按钮
      const button = window.document.createElement("button");
      button.textContent = "RN Test";
      button.style.cssText = "position: fixed; bottom: 10px; right: 10px; z-index: 99999;";
      button.onclick = function() {
        window.alert("Research Navigator Minimal button clicked!");
      };
      
      if (window.document.body) {
        window.document.body.appendChild(button);
        dump("[Research Navigator MINIMAL] Added test button\n");
      } else if (window.document.documentElement) {
        window.document.documentElement.appendChild(button);
        dump("[Research Navigator MINIMAL] Added test button to documentElement\n");
      }
    }
  } catch (e) {
    dump("[Research Navigator MINIMAL] ERROR in onMainWindowLoad: " + e + "\n");
  }
};

(globalThis as any).shutdown = function({ id, version, rootURI }, reason) {
  dump("[Research Navigator MINIMAL] shutdown() called\n");
  
  if (typeof Zotero !== "undefined" && Zotero.ResearchNavigatorMinimal) {
    delete Zotero.ResearchNavigatorMinimal;
  }
};

(globalThis as any).uninstall = function(data, reason) {
  dump("[Research Navigator MINIMAL] uninstall() called\n");
};

dump("[Research Navigator MINIMAL] Bootstrap functions defined\n");