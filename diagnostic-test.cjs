#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

console.log('🔬 Ultimate XPI Diagnostic Test\n');

const xpiPath = path.join(__dirname, 'build/zotero-research-navigator.xpi');

// 1. 检查文件完整性
console.log('1️⃣ Checking XPI file integrity...');
const stats = fs.statSync(xpiPath);
console.log(`   File size: ${stats.size} bytes`);
console.log(`   Modified: ${stats.mtime}`);

// 2. 验证 ZIP 格式
console.log('\n2️⃣ Verifying ZIP format...');
try {
  execSync(`unzip -t "${xpiPath}" 2>&1 | grep -E "testing:|No errors"`);
  console.log('   ✓ ZIP format is valid');
} catch (e) {
  console.log('   ❌ ZIP format error');
}

// 3. 检查文件顺序
console.log('\n3️⃣ Checking file order in ZIP...');
const fileList = execSync(`unzip -Z1 "${xpiPath}"`).toString().trim().split('\n');
console.log('   First 5 files:');
fileList.slice(0, 5).forEach(f => console.log(`     - ${f}`));
const manifestIndex = fileList.indexOf('manifest.json');
console.log(`   manifest.json position: ${manifestIndex + 1} of ${fileList.length}`);

// 4. 解压并深入检查
const tempDir = path.join(__dirname, 'diagnostic-temp');
execSync(`rm -rf "${tempDir}" && mkdir -p "${tempDir}"`);
execSync(`cd "${tempDir}" && unzip -q "${xpiPath}"`);

// 5. 检查 manifest.json 的所有细节
console.log('\n4️⃣ Deep inspection of manifest.json...');
const manifestPath = path.join(tempDir, 'manifest.json');
const manifestBuffer = fs.readFileSync(manifestPath);
const manifestContent = manifestBuffer.toString('utf8');

// 检查 BOM
const hasBOM = manifestBuffer[0] === 0xEF && manifestBuffer[1] === 0xBB && manifestBuffer[2] === 0xBF;
console.log(`   BOM: ${hasBOM ? '❌ Present (PROBLEM!)' : '✓ Not present'}`);

// 检查编码
console.log(`   First 3 bytes: ${manifestBuffer[0]} ${manifestBuffer[1]} ${manifestBuffer[2]}`);

// 检查行尾
const hasCRLF = manifestContent.includes('\r\n');
const hasLF = manifestContent.includes('\n');
console.log(`   Line endings: ${hasCRLF ? 'CRLF (Windows)' : hasLF ? 'LF (Unix)' : 'None'}`);

// 检查不可见字符
const invisibleChars = manifestContent.match(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g);
if (invisibleChars) {
  console.log(`   ❌ Found ${invisibleChars.length} invisible characters!`);
} else {
  console.log(`   ✓ No invisible characters`);
}

// 验证 JSON
try {
  const manifest = JSON.parse(manifestContent);
  console.log('   ✓ Valid JSON');
  
  // 检查字段
  console.log('\n   Required fields:');
  const requiredFields = ['manifest_version', 'name', 'version', 'applications'];
  requiredFields.forEach(field => {
    console.log(`     ${field}: ${manifest[field] ? '✓' : '❌ MISSING'}`);
  });
  
  if (manifest.applications && manifest.applications.zotero) {
    console.log('\n   Zotero application info:');
    console.log(`     id: ${manifest.applications.zotero.id || '❌ MISSING'}`);
    console.log(`     min_version: ${manifest.applications.zotero.strict_min_version || 'not set'}`);
    console.log(`     max_version: ${manifest.applications.zotero.strict_max_version || 'not set'}`);
  }
} catch (e) {
  console.log(`   ❌ JSON Parse Error: ${e.message}`);
}

// 6. 比较原始文件和打包后的文件
console.log('\n5️⃣ Comparing source vs packed manifest.json...');
const sourceManifest = fs.readFileSync(path.join(__dirname, 'addon/manifest.json'), 'utf8');
const sourceHash = crypto.createHash('md5').update(sourceManifest).digest('hex');
const packedHash = crypto.createHash('md5').update(manifestContent).digest('hex');
console.log(`   Source MD5: ${sourceHash}`);
console.log(`   Packed MD5: ${packedHash}`);
console.log(`   Match: ${sourceHash === packedHash ? '✓ Identical' : '❌ Different!'}`);

// 7. 检查权限
console.log('\n6️⃣ Checking file permissions in ZIP...');
const permissions = execSync(`unzip -Z "${xpiPath}" manifest.json | grep -o "^-[rwx-]*"`).toString().trim();
console.log(`   Permissions: ${permissions}`);

// 8. 模拟 Firefox 的检查
console.log('\n7️⃣ Simulating Firefox XPIInstall checks...');
// 检查是否是 ZIP 文件头
const zipHeader = fs.readFileSync(xpiPath, { length: 4 });
const isZip = zipHeader[0] === 0x50 && zipHeader[1] === 0x4B;
console.log(`   ZIP header: ${isZip ? '✓ Valid (PK)' : '❌ Invalid'}`);

// 检查 manifest.json 是否在 ZIP 根目录
const hasManifestAtRoot = fileList.includes('manifest.json');
console.log(`   manifest.json at root: ${hasManifestAtRoot ? '✓ Yes' : '❌ No'}`);

// 清理
execSync(`rm -rf "${tempDir}"`);

// 总结
console.log('\n📊 Summary:');
console.log('─'.repeat(50));
console.log('If all checks pass but Zotero still shows "Invalid XPI" error,');
console.log('the issue might be:');
console.log('1. Zotero expects a different directory structure');
console.log('2. Some undocumented requirement in XPIInstall.jsm');
console.log('3. A timing issue during installation');
console.log('\nTry using the manual test XPIs we created.');