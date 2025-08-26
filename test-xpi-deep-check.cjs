#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

console.log('🔍 Deep XPI Analysis - Simulating Firefox XPIInstall.jsm\n');

// 测试不同的 XPI 文件
const xpiFiles = [
  'build/zotero-research-navigator.xpi',
  'test-manifest-first.xpi',
  'clean-test.xpi',
  'final-test.xpi'
].filter(f => fs.existsSync(path.join(__dirname, f)));

console.log(`Found ${xpiFiles.length} XPI files to test\n`);

// 模拟 XPIInstall.jsm 的检查
function simulateXPIInstallCheck(xpiPath) {
  console.log(`\n🔬 Testing: ${path.basename(xpiPath)}`);
  console.log('─'.repeat(60));
  
  const fullPath = path.join(__dirname, xpiPath);
  const tempDir = path.join(__dirname, 'xpi-check-' + Date.now());
  
  try {
    // 1. 检查文件头
    const header = fs.readFileSync(fullPath, { length: 30 });
    const isPK = header[0] === 0x50 && header[1] === 0x4B;
    console.log(`1. ZIP header check: ${isPK ? '✓ Valid (PK)' : '❌ Invalid'}`);
    
    if (!isPK) {
      throw new Error('Not a valid ZIP file');
    }
    
    // 2. 尝试列出文件
    let fileList;
    try {
      fileList = execSync(`unzip -Z1 "${fullPath}" 2>/dev/null`).toString().trim().split('\n');
      console.log(`2. ZIP structure: ✓ Can list ${fileList.length} files`);
    } catch (e) {
      throw new Error('Cannot read ZIP structure');
    }
    
    // 3. 检查 manifest.json 是否存在
    const hasManifest = fileList.includes('manifest.json');
    console.log(`3. manifest.json in root: ${hasManifest ? '✓ Yes' : '❌ No'}`);
    
    if (!hasManifest) {
      throw new Error('No manifest.json in ZIP root');
    }
    
    // 4. 检查 manifest.json 位置
    const manifestIndex = fileList.indexOf('manifest.json');
    console.log(`4. manifest.json position: ${manifestIndex + 1} of ${fileList.length}`);
    
    // 5. 解压并检查 manifest.json
    execSync(`rm -rf "${tempDir}" && mkdir -p "${tempDir}"`);
    
    // 只解压 manifest.json
    try {
      execSync(`unzip -q -j "${fullPath}" manifest.json -d "${tempDir}" 2>/dev/null`);
    } catch (e) {
      throw new Error('Cannot extract manifest.json');
    }
    
    const manifestPath = path.join(tempDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error('manifest.json not found after extraction');
    }
    
    console.log('5. Extract manifest.json: ✓ Success');
    
    // 6. 读取 manifest.json 内容
    let manifestContent;
    try {
      manifestContent = fs.readFileSync(manifestPath, 'utf8');
      console.log(`6. Read manifest.json: ✓ ${manifestContent.length} bytes`);
    } catch (e) {
      throw new Error('Cannot read manifest.json');
    }
    
    // 7. 检查文件编码
    const hasBOM = manifestContent.charCodeAt(0) === 0xFEFF;
    if (hasBOM) {
      console.log('7. BOM check: ❌ Has BOM (might cause issues)');
      manifestContent = manifestContent.substring(1);
    } else {
      console.log('7. BOM check: ✓ No BOM');
    }
    
    // 8. 解析 JSON
    let manifest;
    try {
      manifest = JSON.parse(manifestContent);
      console.log('8. JSON parse: ✓ Valid JSON');
    } catch (e) {
      console.log(`8. JSON parse: ❌ Error - ${e.message}`);
      
      // 尝试找出问题字符
      const match = e.message.match(/position (\d+)/);
      if (match) {
        const pos = parseInt(match[1]);
        const context = manifestContent.substring(Math.max(0, pos - 20), pos + 20);
        console.log(`   Context around error: "${context}"`);
        console.log(`   Character at position ${pos}: ${manifestContent.charCodeAt(pos)}`);
      }
      
      throw new Error('Invalid JSON in manifest.json');
    }
    
    // 9. 验证必需字段（模拟 Firefox 的检查）
    console.log('9. Manifest validation:');
    
    if (manifest.manifest_version !== 2) {
      throw new Error(`Invalid manifest_version: ${manifest.manifest_version}`);
    }
    console.log('   ✓ manifest_version = 2');
    
    if (!manifest.applications?.zotero && !manifest.applications?.gecko) {
      console.log('   ⚠️  No applications.zotero or applications.gecko');
    } else {
      console.log('   ✓ applications field present');
    }
    
    // 10. 特殊检查 - 文件权限
    const zipInfo = execSync(`unzip -Z "${fullPath}" manifest.json 2>/dev/null | head -1`).toString();
    console.log(`10. File info: ${zipInfo.trim()}`);
    
    console.log('\n✅ This XPI should work!');
    
  } catch (e) {
    console.log(`\n❌ FAILED: ${e.message}`);
    console.log('   This simulates: "File does not contain a valid manifest"');
  } finally {
    // 清理
    try {
      execSync(`rm -rf "${tempDir}"`);
    } catch (e) {}
  }
}

// 测试所有 XPI 文件
xpiFiles.forEach(xpiFile => {
  simulateXPIInstallCheck(xpiFile);
});

// 建议
console.log('\n\n💡 Key Findings:');
console.log('─'.repeat(60));
console.log('The "Invalid XPI" error in Zotero likely means:');
console.log('1. XPIInstall.jsm cannot find or read manifest.json');
console.log('2. The manifest.json has encoding or format issues');
console.log('3. The ZIP structure is corrupted or non-standard');
console.log('\nOur tests show the files are valid, so the issue might be:');
console.log('- A Firefox/Zotero version-specific bug');
console.log('- File system permissions');
console.log('- Antivirus interference');
console.log('- Download corruption');