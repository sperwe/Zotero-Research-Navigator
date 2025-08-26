#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 XPI Manifest Validator (Simulating XPIInstall.jsm)\n');

// 模拟 XPIInstall.jsm 的 loadManifest 函数
function loadManifest(xpiPath) {
  console.log(`Loading manifest from: ${xpiPath}`);
  
  // 1. 检查文件是否存在
  if (!fs.existsSync(xpiPath)) {
    throw new Error(`XPI file not found: ${xpiPath}`);
  }
  
  // 2. 解压 XPI
  const tempDir = path.join(__dirname, 'temp-xpi-test');
  execSync(`rm -rf "${tempDir}" && mkdir -p "${tempDir}"`);
  
  try {
    execSync(`cd "${tempDir}" && unzip -q "${xpiPath}"`);
  } catch (e) {
    throw new Error('Failed to unzip XPI file');
  }
  
  // 3. 查找 manifest.json
  const manifestPath = path.join(tempDir, 'manifest.json');
  console.log(`Looking for manifest at: ${manifestPath}`);
  
  if (!fs.existsSync(manifestPath)) {
    // 模拟 XPIInstall.jsm:685 的错误
    throw new Error('File does not contain a valid manifest');
  }
  
  // 4. 读取并解析 manifest.json
  let manifestContent;
  try {
    manifestContent = fs.readFileSync(manifestPath, 'utf8');
    console.log(`\nRaw manifest content (first 200 chars):\n${manifestContent.substring(0, 200)}...`);
  } catch (e) {
    throw new Error('Failed to read manifest.json');
  }
  
  // 5. 检查文件编码和 BOM
  const hasBOM = manifestContent.charCodeAt(0) === 0xFEFF;
  if (hasBOM) {
    console.warn('⚠️  Warning: BOM detected in manifest.json');
    manifestContent = manifestContent.substring(1);
  }
  
  // 6. 尝试解析 JSON
  let manifest;
  try {
    manifest = JSON.parse(manifestContent);
  } catch (e) {
    console.error('JSON Parse Error:', e.message);
    console.error('Character at error position:', manifestContent.charCodeAt(e.message.match(/position (\d+)/)?.[1] || 0));
    throw new Error('Invalid JSON in manifest.json');
  }
  
  // 7. 验证必需字段（模拟 Zotero 的验证）
  console.log('\n📋 Validating manifest fields...');
  
  if (manifest.manifest_version !== 2) {
    throw new Error(`Invalid manifest_version: ${manifest.manifest_version}`);
  }
  console.log('  ✓ manifest_version: 2');
  
  if (!manifest.name || typeof manifest.name !== 'string') {
    throw new Error('Missing or invalid name field');
  }
  console.log(`  ✓ name: "${manifest.name}"`);
  
  if (!manifest.version || typeof manifest.version !== 'string') {
    throw new Error('Missing or invalid version field');
  }
  console.log(`  ✓ version: "${manifest.version}"`);
  
  if (!manifest.applications || !manifest.applications.zotero) {
    throw new Error('Missing applications.zotero field');
  }
  console.log('  ✓ applications.zotero exists');
  
  if (!manifest.applications.zotero.id) {
    throw new Error('Missing applications.zotero.id');
  }
  console.log(`  ✓ id: "${manifest.applications.zotero.id}"`);
  
  // 8. 检查特殊字符和格式
  const jsonString = JSON.stringify(manifest);
  if (jsonString.includes('\r')) {
    console.warn('  ⚠️  Warning: Carriage return (\\r) detected');
  }
  
  // 清理
  execSync(`rm -rf "${tempDir}"`);
  
  return manifest;
}

// 运行测试
const xpiPath = path.join(__dirname, 'build/zotero-research-navigator.xpi');

try {
  const manifest = loadManifest(xpiPath);
  console.log('\n✅ SUCCESS: Manifest loaded successfully!');
  console.log('\nManifest summary:');
  console.log(JSON.stringify(manifest, null, 2));
} catch (e) {
  console.error(`\n❌ ERROR: ${e.message}`);
  console.error('\nThis simulates the error: loadManifest@XPIInstall.jsm:685:11');
  process.exit(1);
}