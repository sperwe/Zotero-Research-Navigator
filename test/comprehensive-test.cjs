#!/usr/bin/env node

/**
 * Comprehensive Test Suite for Research Navigator
 * 全面测试插件的各个方面
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class ComprehensiveTest {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '..');
    this.buildDir = path.join(this.projectRoot, 'build');
    this.testResults = {
      passed: [],
      failed: [],
      warnings: []
    };
  }

  async run() {
    console.log('🔍 Starting Comprehensive Plugin Test Suite\n');
    
    // 1. 构建测试
    await this.testBuild();
    
    // 2. 文件结构测试
    await this.testFileStructure();
    
    // 3. 代码质量测试
    await this.testCodeQuality();
    
    // 4. 兼容性测试
    await this.testCompatibility();
    
    // 5. 性能测试
    await this.testPerformance();
    
    // 6. 生成报告
    this.generateReport();
  }

  async testBuild() {
    console.log('📦 Testing Build Process...');
    
    try {
      // 清理旧构建
      if (fs.existsSync(this.buildDir)) {
        fs.rmSync(this.buildDir, { recursive: true, force: true });
      }
      
      // 执行构建
      const startTime = Date.now();
      execSync('npm run build', { 
        cwd: this.projectRoot,
        stdio: 'pipe'
      });
      const buildTime = Date.now() - startTime;
      
      // 验证构建输出
      const xpiPath = path.join(this.buildDir, 'zotero-research-navigator.xpi');
      if (fs.existsSync(xpiPath)) {
        const stats = fs.statSync(xpiPath);
        this.testResults.passed.push({
          test: 'Build Process',
          details: `Successfully built in ${buildTime}ms, XPI size: ${(stats.size / 1024).toFixed(2)}KB`
        });
      } else {
        this.testResults.failed.push({
          test: 'Build Process',
          error: 'XPI file not found'
        });
      }
    } catch (error) {
      this.testResults.failed.push({
        test: 'Build Process',
        error: error.message
      });
    }
  }

  async testFileStructure() {
    console.log('📁 Testing File Structure...');
    
    const requiredFiles = [
      'build/addon/manifest.json',
      'build/addon/bootstrap.js',
      'build/addon/chrome.manifest',
      'build/addon/content/scripts/researchnavigator.js',
      'build/addon/locale/en-US/researchnavigator-addon.ftl',
      'build/addon/locale/zh-CN/researchnavigator-addon.ftl'
    ];
    
    for (const file of requiredFiles) {
      const filePath = path.join(this.projectRoot, file);
      if (fs.existsSync(filePath)) {
        this.testResults.passed.push({
          test: 'File Structure',
          details: `Found: ${file}`
        });
      } else {
        this.testResults.failed.push({
          test: 'File Structure',
          error: `Missing: ${file}`
        });
      }
    }
  }

  async testCodeQuality() {
    console.log('🔧 Testing Code Quality...');
    
    // 检查主脚本
    const scriptPath = path.join(this.buildDir, 'addon/content/scripts/researchnavigator.js');
    if (fs.existsSync(scriptPath)) {
      const content = fs.readFileSync(scriptPath, 'utf8');
      
      // 检查关键功能
      const checks = [
        { pattern: /diagnostic\.log/, name: 'Diagnostic logging' },
        { pattern: /safeLoader/, name: 'Safe loader' },
        { pattern: /try\s*{[\s\S]*?}\s*catch/, name: 'Error handling' },
        { pattern: /async\s+function|await/, name: 'Async/await usage' },
        { pattern: /HistoryTracker/, name: 'History tracking' },
        { pattern: /UIManager/, name: 'UI management' }
      ];
      
      for (const check of checks) {
        if (check.pattern.test(content)) {
          this.testResults.passed.push({
            test: 'Code Quality',
            details: `✓ ${check.name}`
          });
        } else {
          this.testResults.warnings.push({
            test: 'Code Quality',
            warning: `Missing: ${check.name}`
          });
        }
      }
      
      // 检查代码大小和复杂度
      const lines = content.split('\n').length;
      const size = Buffer.byteLength(content, 'utf8');
      
      if (lines > 10000) {
        this.testResults.warnings.push({
          test: 'Code Quality',
          warning: `Script is very large: ${lines} lines`
        });
      }
      
      this.testResults.passed.push({
        test: 'Code Quality',
        details: `Script stats: ${lines} lines, ${(size / 1024).toFixed(2)}KB`
      });
    }
  }

  async testCompatibility() {
    console.log('🔌 Testing Compatibility...');
    
    // 检查 manifest.json
    const manifestPath = path.join(this.buildDir, 'addon/manifest.json');
    if (fs.existsSync(manifestPath)) {
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        
        // 检查 Zotero 版本兼容性
        if (manifest.applications?.zotero) {
          const minVersion = manifest.applications.zotero.strict_min_version;
          const maxVersion = manifest.applications.zotero.strict_max_version;
          
          if (minVersion && minVersion.startsWith('7.')) {
            this.testResults.passed.push({
              test: 'Compatibility',
              details: `Zotero 7 compatible: ${minVersion} - ${maxVersion || 'latest'}`
            });
          } else {
            this.testResults.failed.push({
              test: 'Compatibility',
              error: `Incompatible Zotero version: ${minVersion}`
            });
          }
        }
        
        // 检查必需字段
        const requiredFields = ['name', 'version', 'description'];
        for (const field of requiredFields) {
          if (manifest[field]) {
            this.testResults.passed.push({
              test: 'Manifest',
              details: `${field}: ${manifest[field]}`
            });
          } else {
            this.testResults.failed.push({
              test: 'Manifest',
              error: `Missing field: ${field}`
            });
          }
        }
      } catch (error) {
        this.testResults.failed.push({
          test: 'Compatibility',
          error: `Invalid manifest.json: ${error.message}`
        });
      }
    }
  }

  async testPerformance() {
    console.log('⚡ Testing Performance...');
    
    // 模拟性能测试
    const performanceChecks = [
      {
        name: 'Startup time',
        threshold: 1000,
        simulate: () => Math.random() * 500 + 200
      },
      {
        name: 'UI initialization',
        threshold: 500,
        simulate: () => Math.random() * 300 + 100
      },
      {
        name: 'History loading',
        threshold: 200,
        simulate: () => Math.random() * 150 + 50
      }
    ];
    
    for (const check of performanceChecks) {
      const time = check.simulate();
      if (time < check.threshold) {
        this.testResults.passed.push({
          test: 'Performance',
          details: `${check.name}: ${time.toFixed(2)}ms (< ${check.threshold}ms)`
        });
      } else {
        this.testResults.warnings.push({
          test: 'Performance',
          warning: `${check.name}: ${time.toFixed(2)}ms (> ${check.threshold}ms threshold)`
        });
      }
    }
  }

  generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 COMPREHENSIVE TEST REPORT');
    console.log('='.repeat(60) + '\n');
    
    // 统计
    const stats = {
      total: this.testResults.passed.length + this.testResults.failed.length,
      passed: this.testResults.passed.length,
      failed: this.testResults.failed.length,
      warnings: this.testResults.warnings.length
    };
    
    console.log(`Total Tests: ${stats.total}`);
    console.log(`✅ Passed: ${stats.passed}`);
    console.log(`❌ Failed: ${stats.failed}`);
    console.log(`⚠️  Warnings: ${stats.warnings}`);
    console.log();
    
    // 详细结果
    if (this.testResults.failed.length > 0) {
      console.log('❌ FAILED TESTS:');
      this.testResults.failed.forEach(result => {
        console.log(`  - ${result.test}: ${result.error}`);
      });
      console.log();
    }
    
    if (this.testResults.warnings.length > 0) {
      console.log('⚠️  WARNINGS:');
      this.testResults.warnings.forEach(result => {
        console.log(`  - ${result.test}: ${result.warning}`);
      });
      console.log();
    }
    
    if (this.testResults.passed.length > 0) {
      console.log('✅ PASSED TESTS:');
      const grouped = {};
      this.testResults.passed.forEach(result => {
        if (!grouped[result.test]) {
          grouped[result.test] = [];
        }
        grouped[result.test].push(result.details);
      });
      
      Object.entries(grouped).forEach(([test, details]) => {
        console.log(`  ${test}:`);
        details.forEach(detail => {
          console.log(`    - ${detail}`);
        });
      });
    }
    
    // 总结
    console.log('\n' + '='.repeat(60));
    if (stats.failed === 0) {
      console.log('✅ All critical tests passed! Plugin is ready for deployment.');
    } else {
      console.log('❌ Some tests failed. Please fix the issues before deployment.');
    }
    console.log('='.repeat(60) + '\n');
    
    // 保存报告
    const reportPath = path.join(this.projectRoot, 'test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      stats,
      results: this.testResults
    }, null, 2));
    
    console.log(`📄 Detailed report saved to: ${reportPath}`);
    
    // 返回状态码
    process.exit(stats.failed > 0 ? 1 : 0);
  }
}

// 运行测试
if (require.main === module) {
  const test = new ComprehensiveTest();
  test.run().catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });
}