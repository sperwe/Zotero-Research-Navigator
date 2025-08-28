/**
 * 模拟 Zotero 插件加载环境测试
 */

import fs from 'fs';
import vm from 'vm';

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
        // 读取实际的编译文件
        const compiledCode = fs.readFileSync('/workspace/build/addon/bootstrap.js', 'utf8');
        
        // 创建一个新的沙箱来执行编译后的代码
        const compiledSandbox = {
          ...scope,
          window: scope,
          Zotero,
          Services,
          console
        };
        
        try {
          const compiledScript = new vm.Script(compiledCode);
          const compiledContext = vm.createContext(compiledSandbox);
          compiledScript.runInContext(compiledContext);
          
          // 将函数复制回原始作用域
          if (compiledSandbox.window) {
            scope.window = compiledSandbox.window;
            if (compiledSandbox.window.startup) scope.startup = compiledSandbox.window.startup;
            if (compiledSandbox.window.shutdown) scope.shutdown = compiledSandbox.window.shutdown;
            if (compiledSandbox.window.install) scope.install = compiledSandbox.window.install;
            if (compiledSandbox.window.uninstall) scope.uninstall = compiledSandbox.window.uninstall;
          }
        } catch (error) {
          console.error('Error loading compiled code:', error);
        }
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
const loaderCode = fs.readFileSync('/workspace/addon/bootstrap-loader.js', 'utf8');

// 创建沙箱执行环境
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
  console.log('startup:', typeof sandbox.startup);
  console.log('shutdown:', typeof sandbox.shutdown);
  console.log('install:', typeof sandbox.install);
  console.log('uninstall:', typeof sandbox.uninstall);
  console.log('window exists:', !!sandbox.window);
  if (sandbox.window) {
    console.log('window.startup:', typeof sandbox.window.startup);
    console.log('window.shutdown:', typeof sandbox.window.shutdown);
  }
}, 1000);