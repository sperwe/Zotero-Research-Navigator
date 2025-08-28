/**
 * 调试测试脚本
 * 找出 CI 中失败的原因
 */

const fs = require("fs");
const path = require("path");

console.log("=== Debug Test Script ===\n");

// 1. 环境信息
console.log("[ENV] Node version:", process.version);
console.log("[ENV] Current directory:", process.cwd());
console.log("[ENV] NODE_ENV:", process.env.NODE_ENV);

// 2. 检查关键文件
const files = [
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "build/addon/bootstrap.js",
  "build/addon/bootstrap-compiled.js",
  "build/zotero-research-navigator.xpi",
];

console.log("\n[FILES] Checking critical files:");
files.forEach((file) => {
  const filePath = path.join(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    console.log(`✓ ${file} (${stats.size} bytes)`);
  } else {
    console.log(`✗ ${file} NOT FOUND`);
  }
});

// 3. 尝试加载 bootstrap.js
console.log("\n[BOOTSTRAP] Attempting to load bootstrap.js:");
try {
  const bootstrapPath = path.join(process.cwd(), "build/addon/bootstrap.js");
  const bootstrapContent = fs.readFileSync(bootstrapPath, "utf8");

  // 检查是否是 loader 版本
  if (bootstrapContent.includes("bootstrap-loader.js")) {
    console.log("✓ This is the loader version");
  }

  // 检查关键函数
  const functions = ["startup", "shutdown", "install", "uninstall"];
  functions.forEach((fn) => {
    if (bootstrapContent.includes(`function ${fn}`)) {
      console.log(`✓ Contains ${fn} function`);
    } else {
      console.log(`✗ Missing ${fn} function`);
    }
  });

  // 检查是否有 loadSubScript 调用
  if (bootstrapContent.includes("loadSubScript")) {
    console.log("✓ Contains loadSubScript call");
    const match = bootstrapContent.match(/loadSubScript\([^)]+\)/);
    if (match) {
      console.log(`  Loading: ${match[0]}`);
    }
  }
} catch (error) {
  console.error("✗ Failed to load bootstrap.js:", error.message);
}

// 4. 检查依赖
console.log("\n[DEPS] Checking dependencies:");
try {
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  console.log("Dependencies:", Object.keys(pkg.dependencies || {}));
  console.log(
    "DevDependencies:",
    Object.keys(pkg.devDependencies || {}).length + " packages",
  );
} catch (error) {
  console.error("✗ Failed to read package.json:", error.message);
}

// 5. 尝试运行简单测试
console.log("\n[TEST] Running simple test:");
try {
  require("./simple-test.cjs");
} catch (error) {
  console.error("✗ Test failed:", error.message);
  console.error("Stack:", error.stack);
  process.exit(1);
}

console.log("\n=== Debug Complete ===");
