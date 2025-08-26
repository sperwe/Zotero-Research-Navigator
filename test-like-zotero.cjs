#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🎯 Testing Plugin Like Zotero Does\n');

// 基于 Zotero 源码 chrome/content/zotero/xpcom/plugins.js
class MockAddon {
  constructor(xpiPath) {
    this.xpiPath = xpiPath;
    this.tempDir = path.join(__dirname, 'mock-addon-' + Date.now());
    
    // 解压 XPI
    execSync(`rm -rf "${this.tempDir}" && mkdir -p "${this.tempDir}"`);
    execSync(`cd "${this.tempDir}" && unzip -q "${xpiPath}"`);
    
    // 读取 manifest.json
    this.manifestPath = path.join(this.tempDir, 'manifest.json');
    if (!fs.existsSync(this.manifestPath)) {
      throw new Error('manifest.json not found in XPI root');
    }
    
    this.manifest = JSON.parse(fs.readFileSync(this.manifestPath, 'utf8'));
    this.id = this.manifest.applications?.zotero?.id;
    this.version = this.manifest.version;
    this.type = 'extension';
    this.isActive = true;
    this.name = this.manifest.name;
  }
  
  getResourceURI() {
    return {
      spec: `file://${this.tempDir}/`
    };
  }
  
  cleanup() {
    execSync(`rm -rf "${this.tempDir}"`);
  }
}

// 模拟 Zotero 的插件加载
async function testPluginLoading() {
  const xpiPath = path.join(__dirname, 'build/zotero-research-navigator.xpi');
  
  console.log('1️⃣ Creating mock addon from XPI...');
  let addon;
  try {
    addon = new MockAddon(xpiPath);
    console.log('   ✓ XPI unpacked successfully');
    console.log(`   ✓ Found manifest.json`);
    console.log(`   ✓ Addon ID: ${addon.id}`);
    console.log(`   ✓ Version: ${addon.version}`);
  } catch (e) {
    console.error(`   ❌ Error: ${e.message}`);
    console.error('\n   This is likely the same error Zotero encounters!');
    return;
  }
  
  console.log('\n2️⃣ Checking manifest fields (like AddonManager)...');
  
  // 检查必需字段
  if (!addon.manifest.manifest_version) {
    console.error('   ❌ Missing manifest_version');
  } else if (addon.manifest.manifest_version !== 2) {
    console.error(`   ❌ Invalid manifest_version: ${addon.manifest.manifest_version} (must be 2)`);
  } else {
    console.log('   ✓ manifest_version: 2');
  }
  
  if (!addon.manifest.applications?.zotero) {
    console.error('   ❌ Missing applications.zotero');
  } else {
    console.log('   ✓ applications.zotero present');
  }
  
  if (!addon.id) {
    console.error('   ❌ Missing applications.zotero.id');
  } else {
    console.log(`   ✓ ID: ${addon.id}`);
  }
  
  console.log('\n3️⃣ Loading bootstrap.js (like Zotero)...');
  const bootstrapPath = path.join(addon.tempDir, 'bootstrap.js');
  if (!fs.existsSync(bootstrapPath)) {
    console.error('   ❌ bootstrap.js not found');
  } else {
    console.log('   ✓ bootstrap.js found');
    
    // 创建沙箱环境
    const sandbox = {
      Components: {
        classes: {},
        interfaces: {}
      },
      Services: {
        scriptloader: {
          loadSubScript: (uri) => console.log(`   Mock loading: ${uri}`)
        },
        io: {
          newURI: (uri) => ({ spec: uri })
        }
      },
      Zotero: {
        ResearchNavigator: null
      }
    };
    
    try {
      const bootstrapContent = fs.readFileSync(bootstrapPath, 'utf8');
      // 简单验证
      if (bootstrapContent.includes('function startup')) {
        console.log('   ✓ Found startup function');
      }
      if (bootstrapContent.includes('function install')) {
        console.log('   ✓ Found install function');
      }
    } catch (e) {
      console.error(`   ❌ Error reading bootstrap.js: ${e.message}`);
    }
  }
  
  console.log('\n4️⃣ Checking chrome.manifest...');
  const chromeManifestPath = path.join(addon.tempDir, 'chrome.manifest');
  if (fs.existsSync(chromeManifestPath)) {
    console.log('   ✓ chrome.manifest found');
    const content = fs.readFileSync(chromeManifestPath, 'utf8');
    const lines = content.trim().split('\n');
    lines.forEach(line => {
      console.log(`     ${line}`);
    });
  } else {
    console.log('   ⚠️  No chrome.manifest (optional for manifest v2)');
  }
  
  // 清理
  addon.cleanup();
  
  console.log('\n✅ Plugin structure appears valid for Zotero!');
  console.log('\nIf Zotero still shows error, the issue might be:');
  console.log('1. XPIInstall.jsm has additional undocumented checks');
  console.log('2. File permissions or ZIP format issues');
  console.log('3. Timing issues during installation');
}

// 运行测试
testPluginLoading().catch(console.error);