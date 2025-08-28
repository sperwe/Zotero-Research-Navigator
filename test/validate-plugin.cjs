#!/usr/bin/env node

/**
 * 验证插件构建结果
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

class PluginValidator {
  constructor() {
    this.projectRoot = path.resolve(__dirname, "..");
    this.buildDir = path.join(this.projectRoot, "build");
    this.errors = [];
    this.warnings = [];
  }

  log(level, message) {
    const colors = {
      info: "\x1b[36m",
      success: "\x1b[32m",
      warn: "\x1b[33m",
      error: "\x1b[31m",
      reset: "\x1b[0m",
    };

    const color = colors[level] || colors.info;
    console.log(`${color}[${level.toUpperCase()}]${colors.reset} ${message}`);
  }

  validate() {
    this.log("info", "Starting plugin validation...\n");

    // 1. 检查构建输出
    this.checkBuildOutput();

    // 2. 验证 manifest.json
    this.validateManifest();

    // 3. 检查本地化文件
    this.checkLocalization();

    // 4. 验证主脚本
    this.validateMainScript();

    // 5. 检查 XPI 文件
    this.checkXPIFile();

    // 6. 报告结果
    this.report();
  }

  checkBuildOutput() {
    this.log("info", "Checking build output...");

    const requiredFiles = [
      "addon/manifest.json",
      "addon/bootstrap.js",
      "addon/chrome.manifest",
      "addon/prefs.js",
      "addon/content/scripts/researchnavigator.js",
      "zotero-research-navigator.xpi",
    ];

    for (const file of requiredFiles) {
      const filePath = path.join(this.buildDir, file);
      if (fs.existsSync(filePath)) {
        this.log("success", `✓ ${file}`);
      } else {
        this.errors.push(`Missing required file: ${file}`);
        this.log("error", `✗ ${file}`);
      }
    }
  }

  validateManifest() {
    this.log("info", "\nValidating manifest.json...");

    const manifestPath = path.join(this.buildDir, "addon/manifest.json");
    if (!fs.existsSync(manifestPath)) {
      this.errors.push("manifest.json not found");
      return;
    }

    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

      // 检查必需字段
      const requiredFields = [
        "id",
        "version",
        "name",
        "description",
        "author",
        "applications",
      ];
      for (const field of requiredFields) {
        if (manifest[field]) {
          this.log("success", `✓ ${field}: ${JSON.stringify(manifest[field])}`);
        } else {
          this.errors.push(`Missing required field in manifest: ${field}`);
          this.log("error", `✗ Missing: ${field}`);
        }
      }

      // 检查 Zotero 兼容性
      if (manifest.applications?.zotero) {
        const minVersion = manifest.applications.zotero.strict_min_version;
        const maxVersion = manifest.applications.zotero.strict_max_version;
        this.log(
          "info",
          `Zotero compatibility: ${minVersion || "?"} - ${maxVersion || "?"}`,
        );

        if (!minVersion || !minVersion.startsWith("7.")) {
          this.warnings.push("Plugin may not be compatible with Zotero 7");
        }
      }
    } catch (error) {
      this.errors.push(`Invalid manifest.json: ${error.message}`);
    }
  }

  checkLocalization() {
    this.log("info", "\nChecking localization files...");

    const locales = ["en-US", "zh-CN"];
    for (const locale of locales) {
      const ftlPath = path.join(
        this.buildDir,
        "addon/locale",
        locale,
        "researchnavigator-addon.ftl",
      );

      if (fs.existsSync(ftlPath)) {
        const content = fs.readFileSync(ftlPath, "utf8");
        const lines = content.trim().split("\n").length;
        this.log("success", `✓ ${locale}: ${lines} lines`);

        // 检查关键字符串
        const requiredKeys = ["addon-name", "addon-description"];
        for (const key of requiredKeys) {
          if (!content.includes(key)) {
            this.warnings.push(
              `Missing localization key '${key}' in ${locale}`,
            );
          }
        }
      } else {
        this.errors.push(`Missing localization file for ${locale}`);
        this.log("error", `✗ ${locale}`);
      }
    }
  }

  validateMainScript() {
    this.log("info", "\nValidating main script...");

    const scriptPath = path.join(
      this.buildDir,
      "addon/content/scripts/researchnavigator.js",
    );
    if (!fs.existsSync(scriptPath)) {
      this.errors.push("Main script not found");
      return;
    }

    const content = fs.readFileSync(scriptPath, "utf8");
    const stats = {
      size: (fs.statSync(scriptPath).size / 1024).toFixed(2) + " KB",
      lines: content.split("\n").length,
      hasBootstrap: content.includes("bootstrap"),
      hasZotero: content.includes("Zotero"),
      hasAddon: content.includes("addon"),
    };

    this.log("info", `Script size: ${stats.size}`);
    this.log("info", `Lines of code: ${stats.lines}`);

    if (stats.hasBootstrap && stats.hasZotero && stats.hasAddon) {
      this.log("success", "✓ Main script appears to be valid");
    } else {
      this.warnings.push("Main script may be missing required components");
      this.log("warn", "⚠ Script validation warnings");
    }
  }

  checkXPIFile() {
    this.log("info", "\nChecking XPI file...");

    const xpiPath = path.join(this.buildDir, "zotero-research-navigator.xpi");
    if (!fs.existsSync(xpiPath)) {
      this.errors.push("XPI file not found");
      return;
    }

    const stats = fs.statSync(xpiPath);
    const size = (stats.size / 1024).toFixed(2);

    this.log("info", `XPI size: ${size} KB`);

    if (stats.size > 0) {
      this.log("success", "✓ XPI file created successfully");

      // 验证 XPI 内容
      try {
        const output = execSync(`unzip -l "${xpiPath}"`, { encoding: "utf8" });
        const fileCount = output.match(/\d+ files?/)?.[0] || "0 files";
        this.log("info", `XPI contains ${fileCount}`);
      } catch (error) {
        // unzip 可能不可用
        this.log(
          "warn",
          "Could not inspect XPI contents (unzip not available)",
        );
      }
    } else {
      this.errors.push("XPI file is empty");
    }
  }

  report() {
    console.log("\n" + "=".repeat(50));
    console.log("VALIDATION REPORT");
    console.log("=".repeat(50) + "\n");

    if (this.errors.length === 0 && this.warnings.length === 0) {
      this.log("success", "✅ All validation checks passed!");
      this.log("success", "The plugin is ready for installation in Zotero.");
    } else {
      if (this.errors.length > 0) {
        this.log("error", `Found ${this.errors.length} errors:`);
        this.errors.forEach((err) => console.log(`  - ${err}`));
      }

      if (this.warnings.length > 0) {
        this.log("warn", `\nFound ${this.warnings.length} warnings:`);
        this.warnings.forEach((warn) => console.log(`  - ${warn}`));
      }
    }

    console.log("\n" + "=".repeat(50) + "\n");

    // 返回状态码
    process.exit(this.errors.length > 0 ? 1 : 0);
  }
}

// 运行验证
if (require.main === module) {
  const validator = new PluginValidator();
  validator.validate();
}
