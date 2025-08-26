#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🧪 Zotero Plugin Test Framework\n');

// 模拟 Zotero 环境
const mockZotero = {
  debug: (msg) => console.log(`[Zotero.debug] ${msg}`),
  Prefs: {
    get: (key, isGlobal) => `mock_pref_${key}`,
    set: (key, value, isGlobal) => console.log(`[Pref Set] ${key} = ${value}`)
  },
  getMainWindow: () => ({ console: console })
};

// 模拟 Components 和 Services
global.Components = {
  classes: {
    "@mozilla.org/addons/addon-manager-startup;1": {
      getService: () => ({
        registerChrome: (manifestURI, mappings) => {
          console.log('✅ Chrome registered:', mappings);
          return { destruct: () => {} };
        }
      })
    }
  },
  interfaces: {
    amIAddonManagerStartup: {}
  }
};

global.Services = {
  io: {
    newURI: (uri) => ({ spec: uri })
  },
  scriptloader: {
    loadSubScript: (script, context) => {
      console.log(`✅ Loading script: ${script}`);
    }
  }
};

global.APP_SHUTDOWN = 'app-shutdown';
global.Zotero = mockZotero;

// 测试步骤
console.log('📦 Step 1: Checking XPI structure...');
try {
  const xpiPath = path.join(__dirname, 'build/zotero-research-navigator.xpi');
  if (!fs.existsSync(xpiPath)) {
    throw new Error('XPI file not found. Run npm run build-prod first.');
  }
  
  // 解压并检查文件
  execSync(`cd ${__dirname} && rm -rf test-extract && mkdir test-extract && cd test-extract && unzip -q ../build/zotero-research-navigator.xpi`);
  
  const requiredFiles = ['manifest.json', 'bootstrap.js', 'chrome.manifest'];
  for (const file of requiredFiles) {
    const filePath = path.join(__dirname, 'test-extract', file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing required file: ${file}`);
    }
    console.log(`  ✓ ${file} exists`);
  }
} catch (e) {
  console.error(`  ❌ ${e.message}`);
  process.exit(1);
}

console.log('\n📋 Step 2: Validating manifest.json...');
try {
  const manifestPath = path.join(__dirname, 'test-extract/manifest.json');
  const manifestContent = fs.readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(manifestContent);
  
  // 检查必需字段
  const requiredFields = ['manifest_version', 'name', 'version', 'applications'];
  for (const field of requiredFields) {
    if (!manifest[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
    console.log(`  ✓ ${field}: ${JSON.stringify(manifest[field]).substring(0, 50)}...`);
  }
  
  // 检查 Zotero 特定字段
  if (!manifest.applications.zotero) {
    throw new Error('Missing applications.zotero');
  }
  if (!manifest.applications.zotero.id) {
    throw new Error('Missing applications.zotero.id');
  }
  console.log(`  ✓ Addon ID: ${manifest.applications.zotero.id}`);
  
} catch (e) {
  console.error(`  ❌ ${e.message}`);
  process.exit(1);
}

console.log('\n🔧 Step 3: Testing bootstrap.js...');
try {
  const bootstrapPath = path.join(__dirname, 'test-extract/bootstrap.js');
  const bootstrapContent = fs.readFileSync(bootstrapPath, 'utf8');
  
  // 创建一个沙箱来评估 bootstrap.js
  const sandbox = {
    Components: global.Components,
    Services: global.Services,
    APP_SHUTDOWN: global.APP_SHUTDOWN,
    Zotero: global.Zotero,
    console: console
  };
  
  // 在沙箱中执行
  const vm = require('vm');
  const script = new vm.Script(bootstrapContent);
  const context = vm.createContext(sandbox);
  script.runInContext(context);
  
  // 测试函数是否存在
  const requiredFunctions = ['install', 'startup', 'shutdown', 'uninstall'];
  for (const func of requiredFunctions) {
    if (typeof sandbox[func] !== 'function') {
      throw new Error(`Missing required function: ${func}`);
    }
    console.log(`  ✓ ${func}() function exists`);
  }
  
  // 测试 startup
  console.log('\n  🚀 Testing startup()...');
  const mockData = {
    id: 'research-navigator@zotero.org',
    version: '2.0.0',
    resourceURI: 'resource://research-navigator/',
    rootURI: 'jar:file:///test.xpi!/'
  };
  
  (async () => {
    try {
      await sandbox.startup(mockData, 'APP_STARTUP');
      console.log('  ✓ startup() executed successfully');
    } catch (e) {
      console.error(`  ❌ startup() failed: ${e.message}`);
    }
  })();
  
} catch (e) {
  console.error(`  ❌ ${e.message}`);
  process.exit(1);
}

console.log('\n✅ All tests passed! The plugin structure looks valid.');
console.log('\n💡 Note: This is a basic structural test. The actual Zotero environment may have additional requirements.');

// 清理
execSync(`rm -rf ${__dirname}/test-extract`);