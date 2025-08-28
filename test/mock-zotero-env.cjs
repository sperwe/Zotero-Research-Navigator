/**
 * 模拟 Zotero 环境
 * 用于测试 TypeScript 编译后的插件
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

class MockZoteroEnvironment {
  constructor() {
    this.setupGlobals();
  }

  setupGlobals() {
    // 模拟 Zotero 全局对象
    global.Zotero = {
      initialized: true,
      log: (msg, level = "info") => {
        if (process.env.DEBUG) {
          console.log(`[${new Date().toISOString()}] [${level}] ${msg}`);
        }
      },
      debug: (msg) => {
        if (process.env.DEBUG) {
          console.log(`[DEBUG] ${msg}`);
        }
      },
      logError: (err) => {
        console.error("[ERROR]", err);
        if (err.stack && process.env.DEBUG) {
          console.error(err.stack);
        }
      },
      getMainWindow: () => ({
        document: {
          getElementById: (id) => {
            // 模拟找到工具栏
            if (id === "zotero-items-toolbar") {
              return {
                parentNode: {
                  insertBefore: () => {},
                },
                nextSibling: null,
              };
            }
            return null;
          },
          createXULElement: (tag) => ({
            id: null,
            className: null,
            appendChild: () => {},
            setAttribute: () => {},
            addEventListener: () => {},
            remove: () => {},
            style: {},
          }),
          createElement: (tag) => ({
            id: null,
            className: null,
            style: {},
            appendChild: () => {},
            remove: () => {},
          }),
          getElementsByTagName: () => [],
          head: { appendChild: () => {} },
          body: { appendChild: () => {} },
          readyState: "complete",
        },
        addEventListener: () => {},
        removeEventListener: () => {},
      }),
      getActiveZoteroPane: () => null,
      addShutdownListener: () => {},
      Prefs: {
        get: () => null,
        set: () => {},
      },
      DB: {
        queryAsync: async () => [],
        executeTransaction: async (fn) => await fn(),
      },
      Notifier: {
        registerObserver: () => "observer-id",
        unregisterObserver: () => {},
      },
      Items: {
        get: () => null,
        getAsync: async () => null,
      },
      Libraries: {
        userLibraryID: 1,
      },
      getString: (key) => key,
    };

    // 模拟 Services
    global.Services = {
      wm: {
        getEnumerator: () => ({
          hasMoreElements: () => false,
          getNext: () => null,
        }),
        addListener: () => {},
        removeListener: () => {},
      },
      prompt: {
        alert: (parent, title, msg) => {
          console.log(`[ALERT] ${title}: ${msg}`);
        },
      },
      scriptloader: {
        loadSubScript: (url, scope) => {
          // 模拟加载编译后的代码
          if (url.includes("bootstrap-compiled.js")) {
            const scriptPath = path.join(
              __dirname,
              "..",
              "build",
              "addon",
              "bootstrap-compiled.js",
            );
            if (fs.existsSync(scriptPath)) {
              const scriptContent = fs.readFileSync(scriptPath, "utf8");

              // 创建沙箱环境
              const sandbox = {
                ...scope,
                Zotero: global.Zotero,
                Services: global.Services,
                ChromeUtils: global.ChromeUtils,
                Ci: global.Ci,
                Components: global.Components,
                console: console,
                setTimeout: setTimeout,
                clearTimeout: clearTimeout,
                Promise: Promise,
                window: scope.window || {},
              };

              try {
                const script = new vm.Script(scriptContent, {
                  filename: "bootstrap-compiled.js",
                });
                const context = vm.createContext(sandbox);
                script.runInContext(context);

                // 复制函数回 scope
                if (sandbox.window) {
                  Object.assign(scope.window, sandbox.window);
                }
              } catch (error) {
                console.error("Script execution error:", error);
                throw error;
              }
            }
          }
        },
      },
    };

    // 模拟 ChromeUtils
    global.ChromeUtils = {
      import: () => ({ Services: global.Services }),
    };

    // 模拟 Ci
    global.Ci = {
      nsIInterfaceRequestor: {},
      nsIDOMWindow: {},
    };

    // 模拟 Components
    global.Components = {
      utils: global.ChromeUtils,
      interfaces: global.Ci,
      classes: {},
      results: {},
    };
  }

  async loadPlugin(xpiPath) {
    // 加载 bootstrap.js
    const bootstrapPath = path.join(
      __dirname,
      "..",
      "build",
      "addon",
      "bootstrap.js",
    );
    const bootstrapContent = fs.readFileSync(bootstrapPath, "utf8");

    // 创建插件上下文
    const pluginContext = {
      Zotero: global.Zotero,
      Services: global.Services,
      ChromeUtils: global.ChromeUtils,
      Components: global.Components,
      Ci: global.Ci,
      console: console,
    };

    // 执行 bootstrap.js
    const script = new vm.Script(bootstrapContent, {
      filename: "bootstrap.js",
    });
    const context = vm.createContext(pluginContext);
    script.runInContext(context);

    return pluginContext;
  }

  async testLifecycle(pluginContext) {
    const results = {
      install: false,
      startup: false,
      shutdown: false,
      uninstall: false,
      errors: [],
    };

    try {
      // 测试 install
      if (typeof pluginContext.install === "function") {
        pluginContext.install({}, 5);
        results.install = true;
      }

      // 测试 startup
      if (typeof pluginContext.startup === "function") {
        await pluginContext.startup(
          {
            id: "research-navigator@zotero.org",
            version: "2.0.3",
            rootURI: "chrome://researchnavigator/",
            resourceURI: "chrome://researchnavigator/",
          },
          3,
        );
        results.startup = true;
      }

      // 等待一下让异步操作完成
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 测试 shutdown
      if (typeof pluginContext.shutdown === "function") {
        await pluginContext.shutdown({}, 4);
        results.shutdown = true;
      }

      // 测试 uninstall
      if (typeof pluginContext.uninstall === "function") {
        pluginContext.uninstall({}, 6);
        results.uninstall = true;
      }
    } catch (error) {
      results.errors.push(error.message);
    }

    return results;
  }
}

module.exports = MockZoteroEnvironment;
