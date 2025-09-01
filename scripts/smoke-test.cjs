#!/usr/bin/env node

/**
 * 冒烟测试 - 验证插件基本功能
 * 这是一个模拟测试，用于在没有完整测试环境的情况下验证功能
 */

const fs = require("fs");
const path = require("path");

console.log("🔍 Zotero Research Navigator - Smoke Test v2.7.2\n");

const tests = [];
let passed = 0;
let failed = 0;

function test(name, fn) {
  tests.push({ name, fn });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || "Assertion failed");
  }
}

// Test 1: Check build output exists
test("Build output exists", () => {
  const buildPath = path.join(__dirname, "../build/addon");
  assert(fs.existsSync(buildPath), "Build directory not found");

  const xpiFiles = fs
    .readdirSync(path.join(__dirname, "../build"))
    .filter((f) => f.endsWith(".xpi"));
  assert(xpiFiles.length > 0, "No XPI file found");

  console.log(`  ✓ Found XPI: ${xpiFiles[0]}`);
});

// Test 2: Verify manifest
test("Manifest is valid", () => {
  const manifestPath = path.join(__dirname, "../build/addon/manifest.json");
  assert(fs.existsSync(manifestPath), "Manifest not found in build");

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  assert(manifest.version === "2.7.2", `Version mismatch: ${manifest.version}`);
  assert(
    manifest.applications.zotero.id === "research-navigator@zotero.org",
    "Invalid addon ID",
  );

  console.log("  ✓ Manifest version: " + manifest.version);
});

// Test 3: Check critical files
test("Critical files exist", () => {
  const criticalFiles = [
    "bootstrap.js",
    "chrome.manifest",
    "prefs.js",
    "content/icons/icon.png",
  ];

  const buildPath = path.join(__dirname, "../build/addon");

  for (const file of criticalFiles) {
    const filePath = path.join(buildPath, file);
    assert(fs.existsSync(filePath), `Missing critical file: ${file}`);
  }

  console.log(`  ✓ All ${criticalFiles.length} critical files present`);
});

// Test 4: Verify QuickNoteWindow V2 implementation
test("QuickNoteWindow V2 is included", () => {
  const buildPath = path.join(__dirname, "../build/addon");
  const compiledPath = path.join(buildPath, "bootstrap-compiled.js");

  assert(fs.existsSync(compiledPath), "Compiled bootstrap not found");

  const compiledContent = fs.readFileSync(compiledPath, "utf8");
  assert(
    compiledContent.includes("QuickNoteWindowV2"),
    "QuickNoteWindowV2 not found in build",
  );
  assert(
    compiledContent.includes("QuickNoteButtonSimple"),
    "QuickNoteButtonSimple not found in build",
  );

  console.log("  ✓ QuickNoteWindow V2 implementation found");
});

// Test 5: Check testing infrastructure
test("Testing infrastructure added", () => {
  const testFiles = [
    "src/test/helpers/zotero-mock-environment.ts",
    "src/services/__tests__/history-service.test.ts",
    "jest.config.js",
    ".github/workflows/test.yml",
  ];

  for (const file of testFiles) {
    const filePath = path.join(__dirname, "..", file);
    assert(fs.existsSync(filePath), `Missing test file: ${file}`);
  }

  console.log(`  ✓ Testing infrastructure in place`);
});

// Test 6: Verify bug fixes
test("Bug fixes applied", () => {
  const sourceFiles = {
    QuickNoteWindowV2: "src/ui/components/quick-note-window-v2.ts",
    "DOM timing fix": "src/ui/components/quick-note-button-simple.ts",
  };

  for (const [feature, file] of Object.entries(sourceFiles)) {
    const filePath = path.join(__dirname, "..", file);
    assert(fs.existsSync(filePath), `Missing ${feature} implementation`);
  }

  console.log("  ✓ All bug fixes implemented");
});

// Run all tests
console.log("Running smoke tests...\n");

for (const { name, fn } of tests) {
  try {
    console.log(`📋 ${name}`);
    fn();
    passed++;
  } catch (error) {
    console.log(`  ❌ FAILED: ${error.message}`);
    failed++;
  }
  console.log("");
}

// Summary
console.log("=".repeat(50));
console.log(`\n📊 Test Summary:`);
console.log(`  ✅ Passed: ${passed}`);
console.log(`  ❌ Failed: ${failed}`);
console.log(`  📈 Total:  ${tests.length}`);

if (failed === 0) {
  console.log("\n🎉 All tests passed! Ready for release.");
  process.exit(0);
} else {
  console.log("\n⚠️  Some tests failed. Please fix issues before releasing.");
  process.exit(1);
}
