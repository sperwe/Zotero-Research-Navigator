/**
 * 简单的测试脚本
 * 用于 GitHub Actions
 */

console.log('=== Running Simple Plugin Tests ===\n');

const fs = require('fs');
const path = require('path');
const MockZoteroEnvironment = require('./mock-zotero-env.cjs');

let hasErrors = false;

// 测试 1: 检查构建输出
console.log('[TEST] Checking build output...');
const xpiPath = path.join(__dirname, '..', 'build', 'zotero-research-navigator.xpi');
if (fs.existsSync(xpiPath)) {
  const stats = fs.statSync(xpiPath);
  console.log(`✓ XPI exists (${stats.size} bytes)`);
} else {
  console.error('✗ XPI not found');
  hasErrors = true;
}

// 测试 2: 检查 bootstrap.js
console.log('\n[TEST] Checking bootstrap.js...');
const bootstrapPath = path.join(__dirname, '..', 'build', 'addon', 'bootstrap.js');
if (fs.existsSync(bootstrapPath)) {
  const content = fs.readFileSync(bootstrapPath, 'utf8');
  console.log(`✓ bootstrap.js exists (${content.length} bytes)`);
  
  // 检查必要的函数
  const requiredFunctions = ['startup', 'shutdown', 'install', 'uninstall'];
  requiredFunctions.forEach(fn => {
    if (content.includes(`function ${fn}`)) {
      console.log(`✓ Contains ${fn} function`);
    } else {
      console.error(`✗ Missing ${fn} function`);
      hasErrors = true;
    }
  });
} else {
  console.error('✗ bootstrap.js not found');
  hasErrors = true;
}

// 测试 3: 检查 manifest.json
console.log('\n[TEST] Checking manifest.json...');
const manifestPath = path.join(__dirname, '..', 'build', 'addon', 'manifest.json');
if (fs.existsSync(manifestPath)) {
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    console.log(`✓ Valid manifest.json`);
    console.log(`  - name: ${manifest.name}`);
    console.log(`  - version: ${manifest.version}`);
    console.log(`  - id: ${manifest.applications?.zotero?.id}`);
  } catch (error) {
    console.error('✗ Invalid manifest.json:', error.message);
    hasErrors = true;
  }
} else {
  console.error('✗ manifest.json not found');
  hasErrors = true;
}

// 测试 4: 检查编译后的 TypeScript
console.log('\n[TEST] Checking TypeScript compilation...');
const compiledPath = path.join(__dirname, '..', 'build', 'addon', 'bootstrap-compiled.js');
if (fs.existsSync(compiledPath)) {
  const content = fs.readFileSync(compiledPath, 'utf8');
  console.log(`✓ bootstrap-compiled.js exists (${content.length} bytes)`);
  
  // 检查关键类
  const keyClasses = ['ResearchNavigator', 'DatabaseService', 'HistoryService', 'UIManager'];
  keyClasses.forEach(cls => {
    if (content.includes(cls)) {
      console.log(`✓ Contains ${cls} class`);
    } else {
      console.error(`✗ Missing ${cls} class`);
      hasErrors = true;
    }
  });
} else {
  console.error('✗ bootstrap-compiled.js not found');
  hasErrors = true;
}

// 测试 5: 功能测试
console.log('\n[TEST] Running lifecycle tests...');
(async () => {
  try {
    const env = new MockZoteroEnvironment();
    const pluginContext = await env.loadPlugin(xpiPath);
    const results = await env.testLifecycle(pluginContext);
    
    console.log(`✓ Install: ${results.install}`);
    console.log(`✓ Startup: ${results.startup}`);
    console.log(`✓ Shutdown: ${results.shutdown}`);
    console.log(`✓ Uninstall: ${results.uninstall}`);
    
    if (results.errors.length > 0) {
      console.error('✗ Errors during lifecycle:', results.errors);
      hasErrors = true;
    }
    
    if (!results.install || !results.startup || !results.shutdown || !results.uninstall) {
      hasErrors = true;
    }
  } catch (error) {
    console.error('✗ Lifecycle test failed:', error.message);
    hasErrors = true;
  }
  
  // 结果
  console.log('\n=== Test Summary ===');
  if (hasErrors) {
    console.error('❌ Some tests failed');
    process.exit(1);
  } else {
    console.log('✅ All tests passed');
    process.exit(0);
  }
})();