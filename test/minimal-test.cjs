/**
 * 最小化测试 - 只检查构建产物
 */

const fs = require("fs");
const path = require("path");

console.log("=== Minimal Test ===");
console.log("Working directory:", process.cwd());

// 只检查 XPI 是否存在
const xpiPath = path.join(
  __dirname,
  "..",
  "build",
  "zotero-research-navigator.xpi",
);
console.log("Checking:", xpiPath);

if (fs.existsSync(xpiPath)) {
  const stats = fs.statSync(xpiPath);
  console.log("✅ XPI exists:", stats.size, "bytes");
  process.exit(0);
} else {
  console.error("❌ XPI not found");

  // 列出 build 目录内容
  const buildDir = path.join(__dirname, "..", "build");
  if (fs.existsSync(buildDir)) {
    console.log("Build directory contents:");
    console.log(fs.readdirSync(buildDir));
  } else {
    console.log("Build directory does not exist");
  }

  process.exit(1);
}
