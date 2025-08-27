#!/usr/bin/env node

/**
 * Zotero Research Navigator Plugin Test Runner
 * 用于自动化测试插件功能
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class PluginTestRunner {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '..');
    this.buildDir = path.join(this.projectRoot, 'build');
    this.srcDir = path.join(this.projectRoot, 'src');
    this.testResults = [];
  }

  log(level, message) {
    const colors = {
      info: '\x1b[36m',
      success: '\x1b[32m',
      warn: '\x1b[33m',
      error: '\x1b[31m',
      reset: '\x1b[0m'
    };
    
    const color = colors[level] || colors.info;
    console.log(`${color}[${level.toUpperCase()}]${colors.reset} ${message}`);
  }

  // 构建插件
  async buildPlugin() {
    this.log('info', 'Building plugin...');
    try {
      execSync('npm run build', { 
        cwd: this.projectRoot,
        stdio: 'inherit'
      });
      this.log('success', 'Plugin built successfully');
      return true;
    } catch (error) {
      this.log('error', `Build failed: ${error.message}`);
      return false;
    }
  }

  // 验证构建输出
  validateBuild() {
    this.log('info', 'Validating build output...');
    
    const requiredFiles = [
      'addon/manifest.json',
      'addon/content/scripts/researchnavigator.js',
      'addon/locale/en-US/researchnavigator.ftl',
      'addon/locale/zh-CN/researchnavigator.ftl'
    ];

    const missingFiles = [];
    
    for (const file of requiredFiles) {
      const filePath = path.join(this.buildDir, file);
      if (!fs.existsSync(filePath)) {
        missingFiles.push(file);
      }
    }

    if (missingFiles.length > 0) {
      this.log('error', `Missing required files: ${missingFiles.join(', ')}`);
      return false;
    }

    // 验证 manifest.json
    const manifestPath = path.join(this.buildDir, 'addon/manifest.json');
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      
      if (!manifest.id || manifest.id !== 'research-navigator@zotero.org') {
        this.log('error', 'Invalid addon ID in manifest.json');
        return false;
      }

      if (!manifest.applications?.zotero?.strict_min_version) {
        this.log('warn', 'Missing Zotero version requirement in manifest.json');
      }

      this.log('success', 'Build validation passed');
      return true;
    } catch (error) {
      this.log('error', `Failed to parse manifest.json: ${error.message}`);
      return false;
    }
  }

  // 运行基础功能测试
  async runBasicTests() {
    this.log('info', 'Running basic functionality tests...');
    
    const tests = [
      {
        name: 'Check plugin structure',
        test: () => this.testPluginStructure()
      },
      {
        name: 'Validate localization files',
        test: () => this.testLocalization()
      },
      {
        name: 'Check main script syntax',
        test: () => this.testScriptSyntax()
      },
      {
        name: 'Validate preferences',
        test: () => this.testPreferences()
      }
    ];

    for (const { name, test } of tests) {
      try {
        const result = await test();
        this.testResults.push({
          name,
          passed: result,
          error: null
        });
        this.log(result ? 'success' : 'error', `${name}: ${result ? 'PASSED' : 'FAILED'}`);
      } catch (error) {
        this.testResults.push({
          name,
          passed: false,
          error: error.message
        });
        this.log('error', `${name}: FAILED - ${error.message}`);
      }
    }
  }

  // 测试插件结构
  testPluginStructure() {
    const structureFiles = [
      'addon/manifest.json',
      'addon/content',
      'addon/locale',
      'addon/prefs.js'
    ];

    for (const file of structureFiles) {
      const filePath = path.join(this.buildDir, file);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Missing ${file}`);
      }
    }

    return true;
  }

  // 测试本地化文件
  testLocalization() {
    const locales = ['en-US', 'zh-CN'];
    
    for (const locale of locales) {
      const ftlPath = path.join(this.buildDir, 'addon/locale', locale, 'researchnavigator.ftl');
      
      if (!fs.existsSync(ftlPath)) {
        throw new Error(`Missing localization file for ${locale}`);
      }

      const content = fs.readFileSync(ftlPath, 'utf8');
      if (content.trim().length === 0) {
        throw new Error(`Empty localization file for ${locale}`);
      }

      // 检查必要的本地化键
      const requiredKeys = ['addon-name', 'addon-description'];
      for (const key of requiredKeys) {
        if (!content.includes(key)) {
          throw new Error(`Missing required key '${key}' in ${locale}`);
        }
      }
    }

    return true;
  }

  // 测试脚本语法
  testScriptSyntax() {
    const scriptPath = path.join(this.buildDir, 'addon/content/scripts/researchnavigator.js');
    
    if (!fs.existsSync(scriptPath)) {
      throw new Error('Main script not found');
    }

    try {
      // 基础语法检查
      const content = fs.readFileSync(scriptPath, 'utf8');
      
      // 检查是否有基本的插件结构
      if (!content.includes('Zotero')) {
        throw new Error('Script does not reference Zotero');
      }

      // 使用 Node.js 的语法检查
      new Function(content);
      
      return true;
    } catch (error) {
      throw new Error(`Script syntax error: ${error.message}`);
    }
  }

  // 测试偏好设置
  testPreferences() {
    const prefsPath = path.join(this.buildDir, 'addon/prefs.js');
    
    if (!fs.existsSync(prefsPath)) {
      this.log('warn', 'No prefs.js file found (this may be intentional)');
      return true;
    }

    const content = fs.readFileSync(prefsPath, 'utf8');
    
    // 检查偏好设置前缀
    if (!content.includes('extensions.zotero.researchnavigator')) {
      throw new Error('Invalid preference prefix');
    }

    return true;
  }

  // 生成测试报告
  generateReport() {
    console.log('\n========================================');
    console.log('TEST REPORT');
    console.log('========================================\n');

    const passed = this.testResults.filter(r => r.passed).length;
    const failed = this.testResults.filter(r => !r.passed).length;

    console.log(`Total tests: ${this.testResults.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log('');

    if (failed > 0) {
      console.log('Failed tests:');
      this.testResults
        .filter(r => !r.passed)
        .forEach(r => {
          console.log(`  - ${r.name}: ${r.error || 'Unknown error'}`);
        });
    }

    console.log('\n========================================\n');

    return failed === 0;
  }

  // 运行所有测试
  async run() {
    this.log('info', 'Starting Zotero Research Navigator Plugin Test Runner\n');

    // 构建插件
    if (!await this.buildPlugin()) {
      this.log('error', 'Build failed, aborting tests');
      process.exit(1);
    }

    // 验证构建
    if (!this.validateBuild()) {
      this.log('error', 'Build validation failed');
      process.exit(1);
    }

    // 运行测试
    await this.runBasicTests();

    // 生成报告
    const success = this.generateReport();

    if (success) {
      this.log('success', 'All tests passed! Plugin is ready for Zotero.');
      this.log('info', '\nNext steps:');
      this.log('info', '1. Run ./setup-zotero-dev.sh to set up Zotero development environment');
      this.log('info', '2. Start Zotero with: ~/zotero-dev/start-zotero-dev.sh');
      this.log('info', '3. Install the plugin from: build/zotero-research-navigator.xpi');
    } else {
      this.log('error', 'Some tests failed. Please fix the issues before proceeding.');
      process.exit(1);
    }
  }
}

// 运行测试
if (require.main === module) {
  const runner = new PluginTestRunner();
  runner.run().catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = PluginTestRunner;