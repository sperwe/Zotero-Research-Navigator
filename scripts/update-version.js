#!/usr/bin/env node

/**
 * 版本更新脚本
 * 用于更新 package.json 和 addon/manifest.json 中的版本号
 * 确保版本号从 2.6.x 更新到 2.6.(x+1)，而不是 2.6.x.xx
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 获取命令行参数
const args = process.argv.slice(2);
const newVersion = args[0];

if (!newVersion) {
  console.error('❌ 请提供新版本号');
  console.log('用法: node scripts/update-version.js <version>');
  console.log('示例: node scripts/update-version.js 2.7.0');
  process.exit(1);
}

// 验证版本号格式 (x.y.z)
const versionRegex = /^\d+\.\d+\.\d+$/;
if (!versionRegex.test(newVersion)) {
  console.error('❌ 版本号格式错误！应该是 x.y.z 格式（如 2.7.0）');
  console.error('❌ 不要使用 x.y.z.w 格式');
  process.exit(1);
}

// 需要更新的文件
const files = [
  {
    path: 'package.json',
    update: (content) => {
      const pkg = JSON.parse(content);
      const oldVersion = pkg.version;
      pkg.version = newVersion;
      console.log(`📦 package.json: ${oldVersion} → ${newVersion}`);
      return JSON.stringify(pkg, null, 2) + '\n';
    }
  },
  {
    path: 'addon/manifest.json',
    update: (content) => {
      const manifest = JSON.parse(content);
      const oldVersion = manifest.version;
      manifest.version = newVersion;
      console.log(`📋 addon/manifest.json: ${oldVersion} → ${newVersion}`);
      return JSON.stringify(manifest, null, 2) + '\n';
    }
  },
  {
    path: 'manifest.json',
    update: (content) => {
      const manifest = JSON.parse(content);
      const oldVersion = manifest.version;
      manifest.version = newVersion;
      console.log(`📋 manifest.json: ${oldVersion} → ${newVersion}`);
      return JSON.stringify(manifest, null, 2) + '\n';
    }
  },
  {
    path: 'update.json',
    update: (content) => {
      const update = JSON.parse(content);
      const addons = update.addons;
      const addonId = 'research-navigator@zotero.org';
      
      if (addons && addons[addonId] && addons[addonId].updates) {
        const updates = addons[addonId].updates;
        if (updates.length > 0) {
          const oldVersion = updates[0].version;
          updates[0].version = newVersion;
          console.log(`🔄 update.json: ${oldVersion} → ${newVersion}`);
        }
      }
      
      return JSON.stringify(update, null, 2) + '\n';
    }
  },
  {
    path: 'update-dev.json',
    update: (content) => {
      const update = JSON.parse(content);
      const addons = update.addons;
      const addonId = 'research-navigator@zotero.org';
      
      if (addons && addons[addonId] && addons[addonId].updates) {
        const updates = addons[addonId].updates;
        if (updates.length > 0) {
          const oldVersion = updates[0].version;
          updates[0].version = newVersion;
          console.log(`🔄 update-dev.json: ${oldVersion} → ${newVersion}`);
        }
      }
      
      return JSON.stringify(update, null, 2) + '\n';
    }
  }
];

console.log(`\n🚀 开始更新版本号到 ${newVersion}...\n`);

// 更新每个文件
files.forEach(file => {
  const filePath = path.join(process.cwd(), file.path);
  
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  文件不存在: ${file.path}`);
    return;
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const updatedContent = file.update(content);
    fs.writeFileSync(filePath, updatedContent);
  } catch (error) {
    console.error(`❌ 更新 ${file.path} 失败:`, error.message);
  }
});

console.log('\n✅ 版本号更新完成！');
console.log('\n📝 下一步：');
console.log('1. 运行 npm run build 构建插件');
console.log('2. 测试插件功能');
console.log('3. 提交更改并创建发布');