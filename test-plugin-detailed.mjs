/**
 * 详细的插件测试
 */

import fs from 'fs';
import vm from 'vm';
import path from 'path';

// 模拟 Zotero 环境
const mockZotero = {
  initialized: true,
  log: (msg, level) => {
    const timestamp = new Date().toISOString().substring(11, 19);
    console.log(`[${timestamp}] [${level || 'info'}] ${msg}`);
  },
  logError: (err) => {
    console.error('[ERROR]', err);
    if (err.stack) console.error(err.stack);
  },
  getMainWindow: () => ({
    document: {
      getElementById: (id) => {
        console.log(`  -> Looking for element: ${id}`);
        // 模拟工具栏存在
        if (id === "zotero-items-toolbar") {
          return {
            parentNode: {
              insertBefore: (newNode, refNode) => {
                console.log(`  -> Toolbar button inserted!`);
              }
            },
            nextSibling: null
          };
        }
        return null;
      },
      createXULElement: (tag) => {
        console.log(`  -> Creating XUL element: ${tag}`);
        return {
          id: null,
          className: null,
          appendChild: () => {},
          setAttribute: () => {},
          addEventListener: () => {}
        };
      },
      createElement: (tag) => {
        console.log(`  -> Creating HTML element: ${tag}`);
        return {
          id: null,
          className: null,
          style: {},
          appendChild: () => {},
          remove: () => {}
        };
      },
      getElementsByTagName: (tag) => {
        console.log(`  -> Looking for tags: ${tag}`);
        return [];
      },
      head: {
        appendChild: () => console.log(`  -> Style injected`)
      },
      body: {
        appendChild: () => console.log(`  -> Panel added to body`)
      },
      readyState: "complete"
    },
    location: { href: "chrome://zotero/content/zotero.xul" },
    Zotero: true
  }),
  getActiveZoteroPane: () => null,
  addShutdownListener: (fn) => console.log('  -> Added shutdown listener'),
  Prefs: {
    get: (key) => {
      console.log(`  -> Getting pref: ${key}`);
      return null;
    },
    set: (key, value) => console.log(`  -> Setting pref: ${key} = ${value}`)
  },
  DB: {
    queryAsync: async (sql) => {
      console.log(`  -> DB query: ${sql.substring(0, 50)}...`);
      return [];
    },
    executeTransaction: async (fn) => {
      console.log(`  -> DB transaction`);
      await fn();
    }
  },
  Notifier: {
    registerObserver: (observer, types, id) => {
      console.log(`  -> Registered observer for: ${types.join(', ')}`);
      return id;
    }
  },
  Items: {
    get: (id) => {
      console.log(`  -> Getting item: ${id}`);
      return null;
    },
    getAsync: async (id) => {
      console.log(`  -> Getting item async: ${id}`);
      return null;
    }
  },
  Libraries: {
    userLibraryID: 1
  },
  getString: (key) => key,
  ResearchNavigator: null
};

// 模拟 Services
const mockServices = {
  wm: {
    getEnumerator: (type) => {
      console.log(`  -> Enumerating windows of type: ${type}`);
      let called = false;
      return {
        hasMoreElements: () => {
          if (called) return false;
          called = true;
          return true;
        },
        getNext: () => mockZotero.getMainWindow()
      };
    },
    addListener: (listener) => console.log('  -> Window listener added'),
    removeListener: () => {}
  },
  prompt: {
    alert: (parent, title, msg) => console.log(`[ALERT] ${title}: ${msg}`)
  },
  scriptloader: {
    loadSubScript: (url, scope) => {
      console.log(`\n[SCRIPT LOADER] Loading: ${url}`);
      
      if (url.includes('bootstrap-compiled.js')) {
        // 加载编译后的代码
        const scriptPath = path.join('/workspace/build/addon', 'bootstrap-compiled.js');
        const compiledCode = fs.readFileSync(scriptPath, 'utf8');
        
        console.log(`  -> Script size: ${compiledCode.length} bytes`);
        
        // 准备执行环境
        const execScope = {
          ...scope,
          console,
          Zotero: mockZotero,
          Services: mockServices,
          ChromeUtils: mockChromeUtils,
          Ci: mockCi,
          setTimeout,
          clearTimeout,
          Promise
        };
        
        try {
          const script = new vm.Script(compiledCode, { filename: 'bootstrap.js' });
          const context = vm.createContext(execScope);
          script.runInContext(context);
          
          // 检查是否有函数被定义
          console.log(`  -> Checking for functions in scope.window...`);
          if (execScope.window) {
            Object.keys(execScope.window).forEach(key => {
              if (typeof execScope.window[key] === 'function') {
                console.log(`    ✓ Found: window.${key}`);
                scope.window[key] = execScope.window[key];
              }
            });
          }
        } catch (error) {
          console.error('  -> Script execution error:', error.message);
          console.error(error.stack);
        }
      }
    }
  }
};

const mockChromeUtils = {
  import: (url) => ({ Services: mockServices })
};

const mockCi = {
  nsIInterfaceRequestor: {},
  nsIDOMWindow: {}
};

// 测试主函数
async function testPlugin() {
  console.log('=== Research Navigator Plugin Test ===\n');
  
  // 创建测试环境
  const testEnv = {
    Zotero: mockZotero,
    Services: mockServices,
    ChromeUtils: mockChromeUtils,
    Ci: mockCi,
    console,
    window: {}
  };
  
  // 加载 bootstrap-loader.js
  const loaderPath = '/workspace/addon/bootstrap-loader.js';
  const loaderCode = fs.readFileSync(loaderPath, 'utf8');
  
  console.log('[LOADER] Executing bootstrap-loader.js...');
  const loaderScript = new vm.Script(loaderCode, { filename: 'bootstrap-loader.js' });
  const loaderContext = vm.createContext(testEnv);
  loaderScript.runInContext(loaderContext);
  
  // 检查函数
  console.log('\n[CHECK] Loaded functions:');
  ['startup', 'shutdown', 'install', 'uninstall'].forEach(fn => {
    console.log(`  - ${fn}: ${typeof testEnv[fn]}`);
  });
  
  // 调用 startup
  if (testEnv.startup) {
    console.log('\n[STARTUP] Calling startup function...\n');
    try {
      await testEnv.startup({
        id: 'research-navigator@example.com',
        version: '2.0.3',
        rootURI: 'chrome://researchnavigator/',
        resourceURI: 'chrome://researchnavigator/'
      }, 1);
      
      console.log('\n[SUCCESS] Startup completed!');
      
      // 检查插件是否已注册
      if (mockZotero.ResearchNavigator) {
        console.log('\n[CHECK] Plugin registered successfully!');
        console.log('  - ResearchNavigator available');
      } else {
        console.log('\n[WARNING] Plugin not registered to Zotero object');
      }
    } catch (error) {
      console.error('\n[ERROR] Startup failed:', error.message);
      console.error(error.stack);
    }
  } else {
    console.error('\n[ERROR] No startup function found!');
  }
  
  // 测试 shutdown
  if (testEnv.shutdown) {
    console.log('\n[SHUTDOWN] Testing shutdown...');
    await testEnv.shutdown({}, 4);
    console.log('  ✓ Shutdown completed');
  }
}

// 运行测试
testPlugin().catch(console.error);