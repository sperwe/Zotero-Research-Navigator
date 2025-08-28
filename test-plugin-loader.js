/**
 * 模拟 Zotero 插件加载环境测试
 */

// 模拟 Zotero 全局对象
const Zotero = {
  initialized: true,
  log: (msg, level) => console.log(`[${level || 'info'}] ${msg}`),
  logError: (err) => console.error('[error]', err),
  getMainWindow: () => ({ document: { getElementById: () => null } }),
  getActiveZoteroPane: () => null,
  addShutdownListener: (fn) => console.log('Added shutdown listener'),
  Prefs: {
    get: (key) => null,
    set: (key, value) => console.log(`Set pref ${key} = ${value}`)
  },
  DB: {
    queryAsync: async () => []
  },
  Notifier: {
    registerObserver: () => 'observer-id'
  },
  Items: {
    get: () => null,
    getAsync: async () => null
  },
  Libraries: {
    userLibraryID: 1
  }
};

// 模拟 Services
const Services = {
  wm: {
    getEnumerator: () => ({ hasMoreElements: () => false, getNext: () => null }),
    addListener: () => {},
    removeListener: () => {}
  },
  prompt: {
    alert: (parent, title, msg) => console.log(`Alert: ${title} - ${msg}`)
  },
  scriptloader: {
    loadSubScript: (url, scope) => {
      console.log(`Loading script: ${url}`);
      // 模拟加载编译后的代码
      if (url.includes('bootstrap.js')) {
        // 模拟编译后代码的结构
        scope.window = scope;
        scope.startup = async ({ id, version, rootURI }, reason) => {
          console.log(`Compiled startup called: ${version}, reason: ${reason}`);
        };
        scope.shutdown = () => console.log('Compiled shutdown called');
        scope.install = () => console.log('Compiled install called');
        scope.uninstall = () => console.log('Compiled uninstall called');
      }
    }
  }
};

// 模拟 ChromeUtils
const ChromeUtils = {
  import: (url) => ({ Services })
};

// 模拟 Ci
const Ci = {
  nsIInterfaceRequestor: {},
  nsIDOMWindow: {}
};

// 创建测试作用域
const testScope = {
  Zotero,
  Services,
  ChromeUtils,
  Ci
};

// 执行 bootstrap-loader.js
console.log('=== Testing bootstrap-loader.js ===\n');

// 读取并执行 loader
const fs = require('fs');
const loaderCode = fs.readFileSync('/workspace/addon/bootstrap-loader.js', 'utf8');

// 创建沙箱执行环境
const vm = require('vm');
const sandbox = { ...testScope, console };
const script = new vm.Script(loaderCode);
const context = vm.createContext(sandbox);
script.runInContext(context);

// 测试 startup 函数
console.log('\n=== Testing startup ===');
if (sandbox.startup) {
  sandbox.startup({ 
    id: 'research-navigator@example.com', 
    version: '2.0.3', 
    rootURI: 'chrome://researchnavigator/' 
  }, 1).then(() => {
    console.log('Startup completed');
  }).catch(err => {
    console.error('Startup error:', err);
  });
} else {
  console.error('No startup function found!');
}

// 检查是否正确加载了编译后的代码
setTimeout(() => {
  console.log('\n=== Checking loaded functions ===');
  console.log('window.startup:', typeof sandbox.window?.startup);
  console.log('window.shutdown:', typeof sandbox.window?.shutdown);
  console.log('window.install:', typeof sandbox.window?.install);
  console.log('window.uninstall:', typeof sandbox.window?.uninstall);
}, 100);