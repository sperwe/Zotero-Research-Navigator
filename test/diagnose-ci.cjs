/**
 * 诊断 CI 环境问题
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

console.log("=== CI Environment Diagnosis ===\n");

// 1. 检查 Node 版本
console.log("[CHECK] Node.js version:");
console.log(process.version);

// 2. 检查当前目录
console.log("\n[CHECK] Current directory:");
console.log(process.cwd());

// 3. 检查 build 目录
console.log("\n[CHECK] Build directory:");
const buildDir = path.join(__dirname, "..", "build");
if (fs.existsSync(buildDir)) {
  console.log("✓ Build directory exists");

  // 列出 build 目录内容
  const buildContents = fs.readdirSync(buildDir);
  console.log("Contents:", buildContents);

  // 检查 addon 目录
  const addonDir = path.join(buildDir, "addon");
  if (fs.existsSync(addonDir)) {
    console.log("✓ Addon directory exists");
    const addonContents = fs.readdirSync(addonDir);
    console.log("Addon contents:", addonContents.slice(0, 10));
  } else {
    console.log("✗ Addon directory not found");
  }

  // 检查 XPI 文件
  const xpiFile = path.join(buildDir, "zotero-research-navigator.xpi");
  if (fs.existsSync(xpiFile)) {
    const stats = fs.statSync(xpiFile);
    console.log(`✓ XPI file exists (${stats.size} bytes)`);
  } else {
    console.log("✗ XPI file not found");
  }
} else {
  console.log("✗ Build directory not found");
  console.log("Creating build directory...");
  fs.mkdirSync(buildDir, { recursive: true });
}

// 4. 检查 package.json
console.log("\n[CHECK] Package.json:");
const packagePath = path.join(__dirname, "..", "package.json");
if (fs.existsSync(packagePath)) {
  const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  console.log(`✓ Package name: ${pkg.name}`);
  console.log(`✓ Version: ${pkg.version}`);
} else {
  console.log("✗ Package.json not found");
}

// 5. 检查依赖
console.log("\n[CHECK] Dependencies:");
const nodeModulesPath = path.join(__dirname, "..", "node_modules");
if (fs.existsSync(nodeModulesPath)) {
  console.log("✓ node_modules exists");

  // 检查关键依赖
  const keyDeps = ["zotero-plugin-toolkit", "zotero-plugin-scaffold"];
  keyDeps.forEach((dep) => {
    const depPath = path.join(nodeModulesPath, dep);
    if (fs.existsSync(depPath)) {
      console.log(`✓ ${dep} installed`);
    } else {
      console.log(`✗ ${dep} not found`);
    }
  });
} else {
  console.log("✗ node_modules not found");
}

// 6. 尝试运行构建
console.log("\n[CHECK] Testing build command:");
try {
  // 先尝试清理
  console.log("Cleaning build directory...");
  const cleanCmd = "npm run build -- --clean";
  execSync(cleanCmd, { stdio: "pipe" });
  console.log("✓ Clean completed");

  // 运行构建
  console.log("Running build...");
  const buildCmd = "npm run build";
  const output = execSync(buildCmd, { stdio: "pipe" }).toString();
  console.log("✓ Build completed");

  // 检查输出
  if (output.includes("Build finished")) {
    console.log("✓ Build output looks good");
  } else {
    console.log("⚠ Unexpected build output");
  }
} catch (error) {
  console.error("✗ Build failed:", error.message);
  if (error.stdout) {
    console.error("Stdout:", error.stdout.toString());
  }
  if (error.stderr) {
    console.error("Stderr:", error.stderr.toString());
  }
}

// 7. 检查 Git 配置
console.log("\n[CHECK] Git configuration:");
try {
  const gitVersion = execSync("git --version", { stdio: "pipe" })
    .toString()
    .trim();
  console.log(`✓ Git version: ${gitVersion}`);

  const gitStatus = execSync("git status --porcelain", {
    stdio: "pipe",
  }).toString();
  if (gitStatus) {
    console.log("⚠ Uncommitted changes:");
    console.log(gitStatus);
  } else {
    console.log("✓ Working directory clean");
  }
} catch (error) {
  console.error("✗ Git error:", error.message);
}

console.log("\n=== Diagnosis Complete ===");
