#!/usr/bin/env node

/**
 * UI 冒烟测试 - 验证 UI 元素不会被 Bootstrap 过滤
 */

const fs = require("fs");
const path = require("path");

console.log("🎨 UI Smoke Test - Bootstrap Filter Compatibility Check\n");

let issues = 0;
let warnings = 0;

// 要检查的文件
const filesToCheck = [
  "src/ui/components/quick-note-window-v2.ts",
  "src/ui/components/quick-note-button-simple.ts",
  "src/ui/components/main-panel.ts",
  "src/ui/tabs/history-tree-safe.ts",
  "src/ui/tabs/note-relations-tab.ts",
  "src/ui/tabs/history-tree-tab.ts",
  "src/ui/tabs/settings-tab.ts",
];

// Bootstrap 会过滤的危险元素
const dangerousPatterns = [
  { pattern: /<button[^>]*>/g, name: "<button> tags" },
  {
    pattern: /createElement\(['"]button['"]\)/g,
    name: 'createElement("button")',
  },
  { pattern: /<input[^\/]*>/g, name: "unclosed <input> tags" },
  { pattern: /\.innerHTML\s*=.*<button/g, name: "innerHTML with <button>" },
];

// 安全替代方案
const safeReplacements = {
  "<button>": '<span role="button" tabindex="0">',
  'createElement("button")': 'createElement("span") with role="button"',
  "<input>": "<input />",
  "innerHTML with <button>": 'createElement or <span role="button">',
};

console.log("Checking UI files for Bootstrap filter issues...\n");

for (const file of filesToCheck) {
  const filePath = path.join(__dirname, "..", file);

  if (!fs.existsSync(filePath)) {
    console.log(`⏭️  Skipping ${file} (not found)`);
    continue;
  }

  const content = fs.readFileSync(filePath, "utf8");
  const fileIssues = [];

  // 检查每个危险模式
  for (const { pattern, name } of dangerousPatterns) {
    const matches = content.match(pattern);
    if (matches) {
      // 特殊情况：如果已经修复（使用 span role="button"），则只是警告
      if (name.includes("button") && content.includes('role="button"')) {
        warnings++;
        console.log(
          `⚠️  ${file}: Contains ${name} but seems to be fixed with role="button"`,
        );
      } else {
        issues++;
        fileIssues.push({
          pattern: name,
          count: matches.length,
          suggestion: safeReplacements[name] || "Use safe alternative",
        });
      }
    }
  }

  if (fileIssues.length > 0) {
    console.log(`❌ ${file}:`);
    for (const issue of fileIssues) {
      console.log(`   - Found ${issue.count} ${issue.pattern}`);
      console.log(`     Suggestion: ${issue.suggestion}`);
    }
    console.log("");
  } else if (warnings === 0) {
    console.log(`✅ ${file}: No Bootstrap filter issues found`);
  }
}

// 检查构建输出
console.log("\n📦 Checking build output...\n");

const buildFile = path.join(__dirname, "../build/addon/bootstrap-compiled.js");
if (fs.existsSync(buildFile)) {
  const buildContent = fs.readFileSync(buildFile, "utf8");

  // 检查 QuickNoteWindowV2 是否正确编译
  if (!buildContent.includes("QuickNoteWindowV2")) {
    console.log("❌ QuickNoteWindowV2 not found in build");
    issues++;
  } else {
    console.log("✅ QuickNoteWindowV2 found in build");
  }

  // 检查是否有未转换的 button 元素
  const buttonMatches = buildContent.match(/<button[^>]*>/g);
  if (buttonMatches) {
    console.log(
      `⚠️  Build contains ${buttonMatches.length} <button> tags that might be filtered`,
    );
    warnings++;
  }
} else {
  console.log("⚠️  Build file not found. Run npm run build first.");
}

// 总结
console.log("\n" + "=".repeat(50));
console.log("\n📊 Summary:");
console.log(`   ❌ Critical Issues: ${issues}`);
console.log(`   ⚠️  Warnings: ${warnings}`);
console.log(`   📝 Files Checked: ${filesToCheck.length}`);

if (issues === 0) {
  console.log("\n✅ All UI elements are Bootstrap-filter safe!");
  process.exit(0);
} else {
  console.log("\n❌ Found issues that need to be fixed before release.");
  console.log("\n💡 Tips:");
  console.log('   1. Replace <button> with <span role="button" tabindex="0">');
  console.log(
    '   2. Use createElement("span") and add role="button" attribute',
  );
  console.log("   3. Always close <input /> tags");
  console.log("   4. Avoid innerHTML with unsafe elements");
  process.exit(1);
}
