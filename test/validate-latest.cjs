#!/usr/bin/env node

/**
 * Quick validation of the latest build
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

console.log("\n🔍 Validating Latest Build\n");

const xpiPath = path.join(__dirname, "../build/zotero-research-navigator.xpi");

if (!fs.existsSync(xpiPath)) {
  console.error("❌ XPI file not found. Run npm run build-prod first.");
  process.exit(1);
}

// 1. 文件大小
const stats = fs.statSync(xpiPath);
console.log(`📦 XPI Size: ${(stats.size / 1024).toFixed(2)} KB`);

// 2. 文件列表
console.log("\n📋 Contents:");
const files = execSync(
  `unzip -l "${xpiPath}" | grep -E "(manifest|bootstrap|chrome)" | awk '{print $4}'`,
)
  .toString()
  .trim();
console.log(files);

// 3. Manifest 内容
console.log("\n📄 Manifest:");
const manifest = execSync(`unzip -p "${xpiPath}" manifest.json`).toString();
const parsed = JSON.parse(manifest);
console.log(JSON.stringify(parsed, null, 2));

// 4. 验证关键字段
console.log("\n✅ Validation:");
const checks = [
  ["manifest_version", parsed.manifest_version === 2],
  ["update_url", !!parsed.applications?.zotero?.update_url],
  ["id", parsed.applications?.zotero?.id === "research-navigator@zotero.org"],
  ["version", !!parsed.version],
];

let allPassed = true;
checks.forEach(([field, passed]) => {
  console.log(`  ${passed ? "✓" : "✗"} ${field}`);
  if (!passed) allPassed = false;
});

if (allPassed) {
  console.log("\n🎉 All checks passed! The XPI should work in Zotero.\n");
} else {
  console.log("\n❌ Some checks failed. Please fix the issues.\n");
  process.exit(1);
}
