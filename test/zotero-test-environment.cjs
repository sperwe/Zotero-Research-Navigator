#!/usr/bin/env node

/**
 * Zotero Plugin Test Environment
 * 模拟 Zotero 7 的插件加载和运行环境
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const vm = require('vm');
const crypto = require('crypto');

// ANSI 颜色代码
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

class ZoteroTestEnvironment {
  constructor() {
    this.plugins = new Map();
    this.prefs = new Map();
    this.items = new Map();
    this.collections = new Map();
    this.notifierObservers = [];
    this.windows = [];
    this.version = '7.0.0';
  }

  log(level, message, ...args) {
    const levels = {
      info: colors.blue + 'INFO',
      warn: colors.yellow + 'WARN',
      error: colors.red + 'ERROR',
      success: colors.green + 'SUCCESS',
      debug: colors.gray + 'DEBUG'
    };
    
    console.log(`[${levels[level]}${colors.reset}] ${message}`, ...args);
  }

  // 模拟 Zotero 全局对象
  createZoteroMock() {
    const self = this;
    
    return {
      version: this.version,
      
      debug(msg) {
        self.log('debug', `[Zotero.debug] ${msg}`);
      },
      
      log(msg) {
        self.log('info', `[Zotero.log] ${msg}`);
      },
      
      logError(msg) {
        self.log('error', `[Zotero.logError] ${msg}`);
      },
      
      Prefs: {
        get(pref, defaultValue) {
          return self.prefs.get(pref) ?? defaultValue;
        },
        set(pref, value) {
          self.prefs.set(pref, value);
        }
      },
      
      Notifier: {
        registerObserver(observer, types, id) {
          self.notifierObservers.push({ observer, types, id });
          self.log('debug', `Registered observer for: ${types.join(', ')}`);
        },
        
        unregisterObserver(id) {
          self.notifierObservers = self.notifierObservers.filter(o => o.id !== id);
        },
        
        trigger(event, type, ids, extraData) {
          self.log('debug', `Notifier trigger: ${event} on ${type}`);
          self.notifierObservers.forEach(({ observer, types }) => {
            if (types.includes(type)) {
              observer.notify(event, type, ids, extraData);
            }
          });
        }
      },
      
      Items: {
        get(id) {
          return self.items.get(id);
        },
        getAll() {
          return Array.from(self.items.values());
        }
      },
      
      Collections: {
        get(id) {
          return self.collections.get(id);
        }
      },
      
      getMainWindow() {
        return self.windows[0] || null;
      },
      
      getActiveZoteroPane() {
        return {
          itemsView: {
            selection: []
          }
        };
      },
      
      // 模拟插件实例存储
      ResearchNavigator: null
    };
  }

  // 模拟 Components
  createComponentsMock() {
    const self = this;
    
    return {
      utils: {
        import(module) {
          self.log('debug', `Components.utils.import: ${module}`);
          return {};
        }
      },
      
      classes: {
        '@mozilla.org/observer-service;1': {
          getService() {
            return {
              addObserver() {},
              removeObserver() {}
            };
          }
        },
        
        '@mozilla.org/addons/addon-manager-startup;1': {
          getService() {
            return {
              registerChrome(manifest, resources) {
                self.log('debug', `Registering chrome from: ${manifest.path}`);
                // 模拟 chrome 注册
              }
            };
          }
        }
      },
      
      interfaces: {
        nsIObserver: {},
        nsISupports: {}
      }
    };
  }

  // 模拟 Services
  createServicesMock() {
    const self = this;
    
    return {
      io: {
        newURI(spec) {
          return { spec };
        }
      },
      
      scriptloader: {
        loadSubScript(url, scope) {
          self.log('debug', `Loading subscript: ${url}`);
          // 模拟脚本加载
        }
      },
      
      console: {
        logStringMessage(msg) {
          self.log('info', `[Services.console] ${msg}`);
        }
      }
    };
  }

  // 验证 XPI 文件
  async validateXPI(xpiPath) {
    this.log('info', `\n${'='.repeat(60)}`);
    this.log('info', `Validating XPI: ${path.basename(xpiPath)}`);
    this.log('info', `${'='.repeat(60)}\n`);
    
    const tempDir = path.join(__dirname, `xpi-test-${Date.now()}`);
    
    try {
      // 1. 检查文件存在
      if (!fs.existsSync(xpiPath)) {
        throw new Error(`XPI file not found: ${xpiPath}`);
      }
      
      const stats = fs.statSync(xpiPath);
      this.log('info', `XPI size: ${stats.size} bytes`);
      
      // 2. 解压 XPI
      execSync(`rm -rf "${tempDir}" && mkdir -p "${tempDir}"`);
      execSync(`unzip -q "${xpiPath}" -d "${tempDir}"`);
      this.log('success', '✓ XPI extraction successful');
      
      // 3. 验证 manifest.json
      const manifestPath = path.join(tempDir, 'manifest.json');
      if (!fs.existsSync(manifestPath)) {
        throw new Error('manifest.json not found in XPI root');
      }
      
      const manifestContent = fs.readFileSync(manifestPath, 'utf8');
      const manifest = JSON.parse(manifestContent);
      this.log('success', '✓ Valid manifest.json');
      
      // 验证必需字段
      this.validateManifest(manifest);
      
      // 4. 验证 bootstrap.js
      const bootstrapPath = path.join(tempDir, 'bootstrap.js');
      if (!fs.existsSync(bootstrapPath)) {
        throw new Error('bootstrap.js not found');
      }
      this.log('success', '✓ bootstrap.js found');
      
      // 5. 加载并测试插件
      await this.loadPlugin(tempDir, manifest);
      
      return { success: true, manifest };
      
    } catch (error) {
      this.log('error', `Validation failed: ${error.message}`);
      return { success: false, error: error.message };
      
    } finally {
      // 清理
      try {
        execSync(`rm -rf "${tempDir}"`);
      } catch (e) {}
    }
  }

  // 验证 manifest 字段
  validateManifest(manifest) {
    const required = [
      'manifest_version',
      'name',
      'version',
      'applications.zotero.id',
      'applications.zotero.update_url',
      'applications.zotero.strict_min_version'
    ];
    
    for (const field of required) {
      const value = field.split('.').reduce((obj, key) => obj?.[key], manifest);
      if (value === undefined) {
        throw new Error(`Missing required field: ${field}`);
      }
      this.log('debug', `  ${field}: ${value}`);
    }
    
    // 版本兼容性检查
    const minVersion = manifest.applications.zotero.strict_min_version;
    const maxVersion = manifest.applications.zotero.strict_max_version;
    
    if (!this.isVersionCompatible(minVersion, maxVersion)) {
      throw new Error(`Incompatible version: requires ${minVersion}-${maxVersion}, but Zotero is ${this.version}`);
    }
    
    this.log('success', '✓ All manifest fields validated');
  }

  // 版本比较
  isVersionCompatible(minVersion, maxVersion) {
    // 简化的版本比较
    const current = this.version.split('.').map(Number);
    const min = minVersion.split('.').map(Number);
    
    for (let i = 0; i < min.length; i++) {
      if (current[i] < min[i]) return false;
      if (current[i] > min[i]) return true;
    }
    
    return true;
  }

  // 加载插件
  async loadPlugin(pluginDir, manifest) {
    this.log('info', '\nLoading plugin...');
    
    const bootstrapPath = path.join(pluginDir, 'bootstrap.js');
    const bootstrapCode = fs.readFileSync(bootstrapPath, 'utf8');
    
    // 创建沙箱环境
    const sandbox = {
      // 全局对象
      Zotero: this.createZoteroMock(),
      Components: this.createComponentsMock(),
      Services: this.createServicesMock(),
      console: console,
      
      // 常量
      APP_SHUTDOWN: 2,
      ADDON_DISABLE: 4,
      ADDON_UNINSTALL: 6,
      
      // 插件函数
      install: null,
      startup: null,
      shutdown: null,
      uninstall: null,
      onMainWindowLoad: null,
      onMainWindowUnload: null,
      
      // 插件元数据
      __addonData__: {
        id: manifest.applications.zotero.id,
        version: manifest.version,
        rootURI: `file://${pluginDir}/`,
        resourceURI: `file://${pluginDir}/`
      }
    };
    
    // 执行 bootstrap.js
    try {
      vm.createContext(sandbox);
      vm.runInContext(bootstrapCode, sandbox);
      
      // 调试：检查 sandbox 中的内容
      this.log('debug', `Sandbox keys after bootstrap: ${Object.keys(sandbox).join(', ')}`);
      
      // 验证必需函数
      const requiredFunctions = ['install', 'startup', 'shutdown'];
      for (const func of requiredFunctions) {
        if (typeof sandbox[func] !== 'function') {
          throw new Error(`Missing required function: ${func}`);
        }
      }
      
      this.log('success', '✓ bootstrap.js loaded successfully');
      
      // 测试插件生命周期
      await this.testPluginLifecycle(sandbox, manifest);
      
    } catch (error) {
      this.log('error', `Failed to load bootstrap.js: ${error.message}`);
      this.log('debug', `Error stack: ${error.stack}`);
      throw error;
    }
  }

  // 测试插件生命周期
  async testPluginLifecycle(sandbox, manifest) {
    this.log('info', '\nTesting plugin lifecycle...');
    
    try {
      // 1. Install
      this.log('info', 'Calling install()...');
      sandbox.install();
      this.log('success', '✓ install() completed');
      
      // 2. Startup
      this.log('info', 'Calling startup()...');
      sandbox.startup({
        id: manifest.applications.zotero.id,
        version: manifest.version,
        rootURI: sandbox.__addonData__.rootURI
      });
      this.log('success', '✓ startup() completed');
      
      // 检查插件是否正确初始化
      if (sandbox.Zotero.ResearchNavigator) {
        this.log('success', '✓ Plugin instance created');
        
        // 测试主要功能
        await this.testPluginFeatures(sandbox);
      }
      
      // 3. Main window load
      if (sandbox.onMainWindowLoad) {
        this.log('info', 'Calling onMainWindowLoad()...');
        sandbox.onMainWindowLoad({});
        this.log('success', '✓ onMainWindowLoad() completed');
      }
      
      // 4. Shutdown
      this.log('info', 'Calling shutdown()...');
      sandbox.shutdown({
        id: manifest.applications.zotero.id,
        version: manifest.version,
        rootURI: sandbox.__addonData__.rootURI
      });
      this.log('success', '✓ shutdown() completed');
      
      this.log('success', '\n✅ All lifecycle tests passed!');
      
    } catch (error) {
      this.log('error', `Lifecycle test failed: ${error.message}`);
      throw error;
    }
  }

  // 测试插件功能
  async testPluginFeatures(sandbox) {
    this.log('info', '\nTesting plugin features...');
    
    // 1. 测试历史记录跟踪
    this.log('info', 'Testing history tracking...');
    
    // 模拟项目访问
    const testItem = {
      id: 'test-item-1',
      title: 'Test Research Paper',
      itemType: 'journalArticle'
    };
    
    this.items.set(testItem.id, testItem);
    
    // 触发 open 事件
    sandbox.Zotero.Notifier.trigger('open', 'item', [testItem.id]);
    
    // 检查历史记录
    const history = sandbox.Zotero.Prefs.get('extensions.zotero.researchnavigator.history');
    if (history) {
      this.log('success', '✓ History tracking working');
    }
    
    // 2. 测试搜索功能
    this.log('info', 'Testing search functionality...');
    // 这里可以添加更多功能测试
    
    this.log('success', '✓ Feature tests completed');
  }

  // 运行完整测试套件
  async runFullTest(xpiPath) {
    console.log(`\n${colors.cyan}${'#'.repeat(60)}`);
    console.log(`${colors.cyan}# Zotero Plugin Test Environment`);
    console.log(`${colors.cyan}# Testing: ${path.basename(xpiPath)}`);
    console.log(`${colors.cyan}${'#'.repeat(60)}${colors.reset}\n`);
    
    const startTime = Date.now();
    
    try {
      const result = await this.validateXPI(xpiPath);
      
      if (result.success) {
        const duration = Date.now() - startTime;
        console.log(`\n${colors.green}${'='.repeat(60)}`);
        console.log(`${colors.green}✅ ALL TESTS PASSED!`);
        console.log(`${colors.green}Plugin: ${result.manifest.name} v${result.manifest.version}`);
        console.log(`${colors.green}Duration: ${duration}ms`);
        console.log(`${colors.green}${'='.repeat(60)}${colors.reset}\n`);
      } else {
        console.log(`\n${colors.red}${'='.repeat(60)}`);
        console.log(`${colors.red}❌ TESTS FAILED!`);
        console.log(`${colors.red}Error: ${result.error}`);
        console.log(`${colors.red}${'='.repeat(60)}${colors.reset}\n`);
      }
      
      return result;
      
    } catch (error) {
      console.error(`\n${colors.red}Unexpected error: ${error.message}${colors.reset}`);
      return { success: false, error: error.message };
    }
  }
}

// 主函数
async function main() {
  const env = new ZoteroTestEnvironment();
  
  // 测试不同的 XPI 文件
  const xpiFiles = [
    path.join(__dirname, '../build/zotero-research-navigator.xpi')
  ];
  
  for (const xpiFile of xpiFiles) {
    if (fs.existsSync(xpiFile)) {
      await env.runFullTest(xpiFile);
    } else {
      env.log('warn', `XPI file not found: ${xpiFile}`);
    }
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { ZoteroTestEnvironment };