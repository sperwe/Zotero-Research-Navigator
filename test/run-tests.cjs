#!/usr/bin/env node

/**
 * Test Runner for Zotero Research Navigator
 * Runs all tests and reports results
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { ZoteroTestEnvironment } = require("./zotero-test-environment.cjs");

// ANSI 颜色
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

class TestRunner {
  constructor() {
    this.tests = [];
    this.results = [];
  }

  log(level, message) {
    const prefix = {
      info: `${colors.blue}[INFO]${colors.reset}`,
      error: `${colors.red}[ERROR]${colors.reset}`,
      success: `${colors.green}[SUCCESS]${colors.reset}`,
      warn: `${colors.yellow}[WARN]${colors.reset}`,
    };

    console.log(`${prefix[level]} ${message}`);
  }

  // 添加测试
  addTest(name, testFn) {
    this.tests.push({ name, testFn });
  }

  // 运行所有测试
  async runAllTests() {
    console.log(`\n${colors.cyan}${"=".repeat(60)}`);
    console.log(`${colors.cyan}Running Zotero Plugin Test Suite`);
    console.log(`${colors.cyan}${"=".repeat(60)}${colors.reset}\n`);

    const startTime = Date.now();
    let passed = 0;
    let failed = 0;

    for (const test of this.tests) {
      try {
        this.log("info", `Running test: ${test.name}`);
        const result = await test.testFn();

        if (result.success) {
          this.log("success", `✓ ${test.name} passed`);
          passed++;
        } else {
          this.log("error", `✗ ${test.name} failed: ${result.error}`);
          failed++;
        }

        this.results.push({ name: test.name, ...result });
      } catch (error) {
        this.log("error", `✗ ${test.name} crashed: ${error.message}`);
        failed++;
        this.results.push({
          name: test.name,
          success: false,
          error: error.message,
        });
      }
    }

    const duration = Date.now() - startTime;

    // 总结
    console.log(`\n${colors.cyan}${"=".repeat(60)}`);
    console.log(`${colors.cyan}Test Summary`);
    console.log(`${colors.cyan}${"=".repeat(60)}${colors.reset}\n`);

    console.log(`Total tests: ${this.tests.length}`);
    console.log(`${colors.green}Passed: ${passed}${colors.reset}`);
    console.log(`${colors.red}Failed: ${failed}${colors.reset}`);
    console.log(`Duration: ${duration}ms\n`);

    // 详细结果
    if (failed > 0) {
      console.log(`${colors.red}Failed tests:${colors.reset}`);
      this.results
        .filter((r) => !r.success)
        .forEach((r) => {
          console.log(`  - ${r.name}: ${r.error}`);
        });
    }

    return { passed, failed, duration };
  }
}

// 测试函数
async function testBuildOutput() {
  const xpiPath = path.join(
    __dirname,
    "../build/zotero-research-navigator.xpi",
  );

  if (!fs.existsSync(xpiPath)) {
    return { success: false, error: "XPI file not found" };
  }

  const stats = fs.statSync(xpiPath);
  if (stats.size < 1000) {
    return { success: false, error: "XPI file too small" };
  }

  return { success: true };
}

async function testManifestStructure() {
  const xpiPath = path.join(
    __dirname,
    "../build/zotero-research-navigator.xpi",
  );

  try {
    const manifest = execSync(`unzip -p "${xpiPath}" manifest.json`).toString();
    const parsed = JSON.parse(manifest);

    // 检查必需字段
    const required = [
      "manifest_version",
      "name",
      "version",
      "applications.zotero.id",
      "applications.zotero.update_url",
    ];

    for (const field of required) {
      const value = field.split(".").reduce((obj, key) => obj?.[key], parsed);
      if (!value) {
        return { success: false, error: `Missing field: ${field}` };
      }
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function testPluginLifecycle() {
  const env = new ZoteroTestEnvironment();
  const xpiPath = path.join(
    __dirname,
    "../build/zotero-research-navigator.xpi",
  );

  if (!fs.existsSync(xpiPath)) {
    return { success: false, error: "XPI file not found" };
  }

  const result = await env.validateXPI(xpiPath);
  return result;
}

async function testTypeScriptBuild() {
  try {
    // 运行 TypeScript 类型检查
    execSync("npx tsc --noEmit", {
      cwd: path.join(__dirname, ".."),
      stdio: "pipe",
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: "TypeScript compilation errors" };
  }
}

async function testLinting() {
  try {
    // 运行 ESLint
    execSync("npx eslint src --max-warnings 0", {
      cwd: path.join(__dirname, ".."),
      stdio: "pipe",
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: "Linting errors found" };
  }
}

// 主函数
async function main() {
  const runner = new TestRunner();

  // 注册测试
  runner.addTest("Build Output", testBuildOutput);
  runner.addTest("Manifest Structure", testManifestStructure);
  runner.addTest("Plugin Lifecycle", testPluginLifecycle);
  runner.addTest("TypeScript Build", testTypeScriptBuild);
  runner.addTest("Code Linting", testLinting);

  // 运行测试
  const { passed, failed } = await runner.runAllTests();

  // 设置退出码
  process.exit(failed > 0 ? 1 : 0);
}

// 运行
if (require.main === module) {
  main().catch((error) => {
    console.error("Test runner failed:", error);
    process.exit(1);
  });
}

module.exports = { TestRunner };
