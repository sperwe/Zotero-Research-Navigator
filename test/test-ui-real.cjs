const fs = require("fs");
const path = require("path");
const vm = require("vm");

console.log("=== Testing Research Navigator UI in Real Environment ===\n");

// 更真实的 Zotero 环境模拟
const mockWindow = {
  setTimeout: (fn, delay) => {
    console.log(`[Mock] setTimeout called with delay: ${delay}ms`);
    // 立即执行以便测试
    fn();
  },
  addEventListener: (event, handler) => {
    console.log(`[Mock] window.addEventListener: ${event}`);
  },
  document: {
    readyState: "complete",
    getElementById: (id) => {
      console.log(`[Mock] Looking for element: ${id}`);
      if (id === "zotero-tb-advanced-search") {
        return {
          parentNode: {
            insertBefore: (newNode, refNode) => {
              console.log(`✅ [UI] Toolbar button inserted!`);
              console.log(`  Button ID: ${newNode.id}`);
              console.log(`  Button class: ${newNode.className}`);
            },
          },
        };
      }
      return null;
    },
    createElement: (tag) => {
      const element = {
        tagName: tag,
        id: null,
        className: null,
        textContent: null,
        style: {},
        setAttribute: function (attr, value) {
          console.log(`[Mock] Element ${tag} setAttribute: ${attr}="${value}"`);
          this[attr] = value;
        },
        appendChild: function (child) {
          console.log(
            `[Mock] Element ${tag} appendChild: ${child.tagName || child}`,
          );
        },
        addEventListener: function (event, handler) {
          console.log(`[Mock] Element ${tag} addEventListener: ${event}`);
        },
        classList: {
          add: (className) =>
            console.log(`[Mock] Element classList.add: ${className}`),
          remove: (className) =>
            console.log(`[Mock] Element classList.remove: ${className}`),
        },
      };
      return element;
    },
    createXULElement: (tag) => {
      console.log(`[Mock] Creating XUL element: ${tag}`);
      const element = {
        tagName: tag,
        id: null,
        className: null,
        setAttribute: function (attr, value) {
          console.log(`[Mock] XUL ${tag} setAttribute: ${attr}="${value}"`);
          this[attr] = value;
        },
        appendChild: function (child) {
          console.log(
            `[Mock] XUL ${tag} appendChild: ${child.tagName || child}`,
          );
          return child;
        },
        addEventListener: function (event, handler) {
          console.log(`[Mock] XUL ${tag} addEventListener: ${event}`);
        },
        style: {},
      };
      return element;
    },
    body: {
      appendChild: (child) => {
        console.log(`✅ [UI] Appended to body: ${child.tagName}`);
        if (child.id) console.log(`  Element ID: ${child.id}`);
      },
    },
    head: {
      appendChild: (child) => {
        console.log(`✅ [UI] Appended to head: ${child.tagName}`);
        if (child.id) console.log(`  Element ID: ${child.id}`);
      },
    },
  },
};

const mockZotero = {
  initialized: true,
  log: (msg, level) => console.log(`[Zotero.${level || "info"}] ${msg}`),
  logError: (error) => console.error("[Zotero.error]", error.message || error),
  debug: (msg) => console.log(`[Zotero.debug] ${msg}`),
  getMainWindow: () => mockWindow,
  getActiveZoteroPane: () => ({
    itemsView: {
      onSelect: {
        addListener: (fn) =>
          console.log("[Mock] Added itemsView select listener"),
      },
    },
  }),
  addShutdownListener: (fn) => console.log("[Mock] Added shutdown listener"),
  DB: {
    queryAsync: async (sql) => {
      console.log("[Mock] DB query:", sql.substring(0, 50) + "...");
      return [];
    },
    executeTransaction: async (fn) => {
      console.log("[Mock] DB transaction started");
      await fn();
      console.log("[Mock] DB transaction completed");
    },
  },
  Items: {
    getAsync: async (ids) => {
      console.log("[Mock] Items.getAsync called");
      return [];
    },
  },
  Notifier: {
    registerObserver: (observer, types, id) => {
      console.log(`[Mock] Registered notifier observer for: ${types}`);
      return id;
    },
  },
  Reader: {
    registerEventListener: (event, handler) => {
      console.log(`[Mock] Registered reader event: ${event}`);
    },
  },
  Prefs: {
    get: (pref) => {
      console.log(`[Mock] Prefs.get: ${pref}`);
      return "";
    },
    set: (pref, value) => {
      console.log(`[Mock] Prefs.set: ${pref} = ${value}`);
    },
  },
};

// Mock Services
const mockServices = {
  scriptloader: {
    loadSubScript: (url, scope) => {
      console.log(`\n[Mock] Loading script: ${url}`);

      // 处理路径
      let scriptPath;
      if (url.includes("bootstrap-compiled.js")) {
        scriptPath = path.join(
          __dirname,
          "../build/addon/bootstrap-compiled.js",
        );
      } else {
        scriptPath = url.replace("resource://zotero/", "");
      }

      if (!fs.existsSync(scriptPath)) {
        throw new Error(`Script not found: ${scriptPath}`);
      }

      const scriptContent = fs.readFileSync(scriptPath, "utf8");
      const context = vm.createContext(scope);
      const script = new vm.Script(scriptContent, {
        filename: path.basename(scriptPath),
      });
      script.runInContext(context);

      console.log("[Mock] Script loaded successfully");
    },
  },
  wm: {
    getEnumerator: (type) => {
      console.log(`[Mock] Services.wm.getEnumerator: ${type}`);
      let returned = false;
      return {
        hasMoreElements: () => {
          const hasMore = !returned;
          returned = true;
          return hasMore;
        },
        getNext: () => mockWindow,
      };
    },
    addListener: (listener) => {
      console.log("[Mock] Services.wm.addListener called");
    },
    removeListener: (listener) => {
      console.log("[Mock] Services.wm.removeListener called");
    },
  },
  prompt: {
    alert: (parent, title, message) => {
      console.error(`\n❌ ALERT: ${title}\n${message}\n`);
    },
  },
};

// Mock ChromeUtils
global.ChromeUtils = {
  import: (module) => {
    console.log(`[Mock] ChromeUtils.import: ${module}`);
    return { Services: mockServices };
  },
  idleDispatch: (fn) => {
    console.log("[Mock] ChromeUtils.idleDispatch called");
    // 立即执行
    fn();
  },
};

global.Services = mockServices;
global.Components = {
  utils: { import: () => ({}) },
};
global.Ci = {
  nsIInterfaceRequestor: {},
  nsIDOMWindow: {},
};

// 设置全局 Zotero
global.Zotero = mockZotero;
mockWindow.Zotero = mockZotero;

// 加载 bootstrap.js
const loaderPath = path.join(__dirname, "../build/addon/bootstrap.js");
const loaderContent = fs.readFileSync(loaderPath, "utf8");

const loaderContext = vm.createContext({
  ChromeUtils: global.ChromeUtils,
  Components: global.Components,
  Services: mockServices,
  Ci: global.Ci,
  Zotero: mockZotero,
  window: {},
  console,
});

const loaderScript = new vm.Script(loaderContent, { filename: "bootstrap.js" });
loaderScript.runInContext(loaderContext);

const { startup, shutdown } = loaderContext;

// 运行测试
(async () => {
  try {
    console.log("\n=== Starting Plugin ===");
    await startup(
      {
        id: "research-navigator@zotero.org",
        version: "2.0.3",
        rootURI: "resource://zotero/",
      },
      0,
    );

    console.log("\n=== Testing Results ===");
    console.log(
      "✓ Zotero.ResearchNavigator exists?",
      !!mockZotero.ResearchNavigator,
    );

    if (mockZotero.ResearchNavigator) {
      console.log(
        "✓ ResearchNavigator type:",
        typeof mockZotero.ResearchNavigator,
      );
      const props = Object.keys(mockZotero.ResearchNavigator);
      console.log("✓ ResearchNavigator properties:", props);

      // 检查 UI 相关属性
      if (mockZotero.ResearchNavigator.ui) {
        console.log("✓ UI Manager initialized");
      } else {
        console.log("✗ UI Manager not found");
      }
    }

    console.log("\n✅ Test completed successfully!");
  } catch (error) {
    console.error("\n❌ Test failed:", error.message);
    console.error(error.stack);
  }
})();
