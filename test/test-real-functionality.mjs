/**
 * 测试插件的实际功能
 */

import fs from "fs";
import vm from "vm";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 更真实的 Zotero 模拟
const mockZotero = {
  initialized: true,
  log: (msg, level) => {
    console.log(`[${level || "info"}] ${msg}`);
  },
  logError: (err) => {
    console.error("[ERROR]", err);
    if (err.stack) console.error(err.stack);
  },
  getMainWindow: () => {
    const mockWindow = {
      document: {
        readyState: "complete",
        body: {
          appendChild: (element) => {
            console.log(
              `  ✓ Added element to body: ${element.id || element.className}`,
            );
          },
        },
        head: {
          appendChild: (element) => {
            console.log(`  ✓ Added style to head`);
          },
        },
        getElementById: (id) => {
          console.log(`  → Looking for element: ${id}`);
          if (id === "zotero-items-toolbar") {
            return {
              parentNode: {
                insertBefore: (newNode, refNode) => {
                  console.log(`  ✓ Toolbar button inserted!`);
                },
              },
              nextSibling: null,
            };
          }
          return null;
        },
        createXULElement: (tag) => {
          console.log(`  → Creating XUL element: ${tag}`);
          return {
            id: null,
            className: null,
            style: {},
            appendChild: () => {},
            setAttribute: (name, value) => {
              if (name === "id") console.log(`    - Set ID: ${value}`);
            },
            addEventListener: () => {},
            remove: () => {},
          };
        },
        createElement: (tag) => {
          console.log(`  → Creating HTML element: ${tag}`);
          return {
            id: null,
            className: null,
            style: { cssText: "" },
            appendChild: () => {},
            remove: () => {},
          };
        },
        getElementsByTagName: (tag) => [],
      },
      addEventListener: () => {},
      removeEventListener: () => {},
      location: { href: "chrome://zotero/content/zotero.xul" },
    };
    return mockWindow;
  },
  getActiveZoteroPane: () => null,
  addShutdownListener: (fn) => {
    console.log("  ✓ Added shutdown listener");
  },
  Prefs: {
    get: () => null,
    set: () => {},
  },
  DB: {
    queryAsync: async (sql) => {
      console.log(`  → DB query: ${sql.substring(0, 60)}...`);
      return [];
    },
    executeTransaction: async (fn) => {
      await fn();
    },
  },
  Notifier: {
    registerObserver: (observer, types) => {
      console.log(`  ✓ Registered observer for: ${types.join(", ")}`);
      return "observer-id";
    },
    unregisterObserver: () => {},
  },
  Items: {
    get: () => null,
    getAsync: async () => null,
  },
  Libraries: {
    userLibraryID: 1,
  },
};

// 执行测试
async function testPlugin() {
  console.log("=== Testing Research Navigator Plugin ===\n");

  // 加载 bootstrap-loader.js
  const loaderPath = path.join(
    __dirname,
    "..",
    "build",
    "addon",
    "bootstrap.js",
  );
  const loaderCode = fs.readFileSync(loaderPath, "utf8");

  // 创建测试环境
  const testEnv = {
    Zotero: mockZotero,
    Services: {
      wm: {
        getEnumerator: () => ({
          hasMoreElements: () => true,
          getNext: () => mockZotero.getMainWindow(),
          _count: 0,
        }),
        addListener: () => console.log("  ✓ Window listener added"),
        removeListener: () => {},
      },
      prompt: {
        alert: (parent, title, msg) =>
          console.error(`[ALERT] ${title}: ${msg}`),
      },
      scriptloader: {
        loadSubScript: (url, scope) => {
          console.log(`\n[Loading] ${url}`);
          if (url.includes("bootstrap-compiled.js")) {
            const compiledPath = path.join(
              __dirname,
              "..",
              "build",
              "addon",
              "bootstrap-compiled.js",
            );
            const compiledCode = fs.readFileSync(compiledPath, "utf8");

            // 执行编译后的代码
            const sandbox = {
              ...scope,
              Zotero: mockZotero,
              Services: testEnv.Services,
              ChromeUtils: testEnv.ChromeUtils,
              Components: testEnv.Components,
              Ci: {},
              setTimeout,
              clearTimeout,
              console,
              window: scope.window || {},
            };

            const script = new vm.Script(compiledCode, {
              filename: "bootstrap-compiled.js",
            });
            const context = vm.createContext(sandbox);
            script.runInContext(context);

            // 复制函数
            if (sandbox.window) {
              Object.assign(scope.window, sandbox.window);
            }
          }
        },
      },
    },
    ChromeUtils: {
      import: () => ({ Services: testEnv.Services }),
    },
    Components: {
      utils: {},
      interfaces: {},
    },
  };

  // 执行 loader
  const script = new vm.Script(loaderCode, { filename: "bootstrap.js" });
  const context = vm.createContext(testEnv);
  script.runInContext(context);

  // 测试启动
  console.log("\n[TEST] Starting plugin...\n");
  if (testEnv.startup) {
    try {
      await testEnv.startup(
        {
          id: "research-navigator@zotero.org",
          version: "2.0.3",
          rootURI: "chrome://researchnavigator/",
          resourceURI: "chrome://researchnavigator/",
        },
        3,
      );

      console.log("\n✅ Plugin started successfully!");

      // 等待异步操作
      await new Promise((resolve) => setTimeout(resolve, 200));

      // 检查是否有错误
      if (mockZotero.ResearchNavigator) {
        console.log("✅ ResearchNavigator instance created");
      } else {
        console.error("❌ ResearchNavigator instance NOT found!");
      }
    } catch (error) {
      console.error("\n❌ Startup failed:", error.message);
      console.error(error.stack);
    }
  } else {
    console.error("❌ No startup function found!");
  }
}

testPlugin().catch(console.error);
