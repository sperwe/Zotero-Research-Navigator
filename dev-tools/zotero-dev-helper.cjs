#!/usr/bin/env node

/**
 * Zotero 插件开发辅助工具
 * 提供热重载、日志监控和调试功能
 */

const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const chokidar = require('chokidar');

class ZoteroDevHelper {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '..');
    this.srcDir = path.join(this.projectRoot, 'src');
    this.buildDir = path.join(this.projectRoot, 'build');
    this.isBuilding = false;
    this.zoteroProcess = null;
    this.devProfilePath = path.join(process.env.HOME, 'zotero-dev/zotero-profile');
  }

  log(level, message) {
    const colors = {
      info: '\x1b[36m',
      success: '\x1b[32m',
      warn: '\x1b[33m',
      error: '\x1b[31m',
      debug: '\x1b[90m',
      reset: '\x1b[0m'
    };
    
    const timestamp = new Date().toTimeString().split(' ')[0];
    const color = colors[level] || colors.info;
    console.log(`[${timestamp}] ${color}[${level.toUpperCase()}]${colors.reset} ${message}`);
  }

  // 初始化开发环境
  async init() {
    this.log('info', 'Initializing Zotero development environment...');
    
    // 检查是否已经设置了 Zotero 开发环境
    if (!fs.existsSync(this.devProfilePath)) {
      this.log('warn', 'Zotero development profile not found.');
      this.log('info', 'Please run ./setup-zotero-dev.sh first');
      process.exit(1);
    }

    // 创建必要的目录
    const devToolsDir = path.dirname(__filename);
    if (!fs.existsSync(devToolsDir)) {
      fs.mkdirSync(devToolsDir, { recursive: true });
    }

    // 安装 chokidar 如果还没有安装
    try {
      require.resolve('chokidar');
    } catch (e) {
      this.log('info', 'Installing chokidar for file watching...');
      execSync('npm install --save-dev chokidar', { cwd: this.projectRoot });
    }

    this.log('success', 'Development environment initialized');
  }

  // 构建插件
  async buildPlugin() {
    if (this.isBuilding) {
      this.log('debug', 'Build already in progress, skipping...');
      return false;
    }

    this.isBuilding = true;
    this.log('info', 'Building plugin...');

    try {
      execSync('npm run build', { 
        cwd: this.projectRoot,
        stdio: 'pipe'
      });
      
      this.log('success', 'Plugin built successfully');
      
      // 复制到 Zotero 扩展目录
      await this.installToProfile();
      
      return true;
    } catch (error) {
      this.log('error', `Build failed: ${error.message}`);
      return false;
    } finally {
      this.isBuilding = false;
    }
  }

  // 安装到 Zotero 配置文件
  async installToProfile() {
    const extensionsDir = path.join(this.devProfilePath, 'extensions');
    const addonId = 'research-navigator@zotero.org';
    const targetDir = path.join(extensionsDir, addonId);

    // 确保扩展目录存在
    if (!fs.existsSync(extensionsDir)) {
      fs.mkdirSync(extensionsDir, { recursive: true });
    }

    // 删除旧的符号链接或目录
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }

    // 创建符号链接到构建输出
    const buildAddonDir = path.join(this.buildDir, 'addon');
    
    try {
      fs.symlinkSync(buildAddonDir, targetDir, 'dir');
      this.log('success', `Plugin installed to profile: ${targetDir}`);
    } catch (error) {
      this.log('error', `Failed to create symlink: ${error.message}`);
      
      // 如果符号链接失败，尝试复制
      this.log('info', 'Falling back to copy method...');
      this.copyRecursive(buildAddonDir, targetDir);
    }
  }

  // 递归复制文件
  copyRecursive(src, dest) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        this.copyRecursive(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  // 启动文件监视
  startWatcher() {
    this.log('info', 'Starting file watcher...');

    const watcher = chokidar.watch([
      path.join(this.srcDir, '**/*.ts'),
      path.join(this.srcDir, '**/*.tsx'),
      path.join(this.projectRoot, 'addon/**/*'),
      path.join(this.projectRoot, '_locales/**/*')
    ], {
      ignored: [
        /(^|[\/\\])\../,
        /node_modules/,
        /build/
      ],
      persistent: true,
      ignoreInitial: true
    });

    watcher.on('change', (filePath) => {
      const relativePath = path.relative(this.projectRoot, filePath);
      this.log('info', `File changed: ${relativePath}`);
      this.buildPlugin();
    });

    watcher.on('add', (filePath) => {
      const relativePath = path.relative(this.projectRoot, filePath);
      this.log('info', `File added: ${relativePath}`);
      this.buildPlugin();
    });

    watcher.on('unlink', (filePath) => {
      const relativePath = path.relative(this.projectRoot, filePath);
      this.log('info', `File removed: ${relativePath}`);
      this.buildPlugin();
    });

    this.log('success', 'File watcher started');
  }

  // 启动 Zotero
  startZotero() {
    const zoteroPath = this.getZoteroExecutable();
    
    if (!fs.existsSync(zoteroPath)) {
      this.log('error', `Zotero executable not found at: ${zoteroPath}`);
      this.log('info', 'Please run ./setup-zotero-dev.sh to install Zotero');
      return;
    }

    this.log('info', 'Starting Zotero...');

    this.zoteroProcess = spawn(zoteroPath, [
      '-profile', this.devProfilePath,
      '-purgecaches',
      '-jsconsole'
    ], {
      detached: false,
      stdio: 'inherit'
    });

    this.zoteroProcess.on('error', (error) => {
      this.log('error', `Failed to start Zotero: ${error.message}`);
    });

    this.zoteroProcess.on('exit', (code) => {
      this.log('info', `Zotero exited with code: ${code}`);
      this.zoteroProcess = null;
    });
  }

  // 获取 Zotero 可执行文件路径
  getZoteroExecutable() {
    const zoteroDir = path.join(process.env.HOME, 'zotero-dev/zotero-beta');
    
    if (process.platform === 'linux') {
      return path.join(zoteroDir, 'zotero');
    } else if (process.platform === 'darwin') {
      return path.join(zoteroDir, 'Contents/MacOS/zotero');
    } else {
      this.log('error', 'Unsupported platform');
      process.exit(1);
    }
  }

  // 显示开发菜单
  showMenu() {
    console.log('\n========================================');
    console.log('Zotero Plugin Development Helper');
    console.log('========================================\n');
    console.log('Commands:');
    console.log('  b - Build plugin');
    console.log('  w - Toggle file watcher');
    console.log('  z - Start/restart Zotero');
    console.log('  r - Reload plugin (restart Zotero)');
    console.log('  l - Show recent Zotero logs');
    console.log('  c - Clear console');
    console.log('  q - Quit');
    console.log('\nPress a key to execute command...\n');
  }

  // 处理用户输入
  async handleInput(key) {
    switch (key) {
      case 'b':
        await this.buildPlugin();
        break;
      
      case 'w':
        if (this.watcher) {
          this.log('info', 'Stopping file watcher...');
          this.watcher.close();
          this.watcher = null;
        } else {
          this.startWatcher();
        }
        break;
      
      case 'z':
        if (this.zoteroProcess) {
          this.log('info', 'Restarting Zotero...');
          this.zoteroProcess.kill();
          setTimeout(() => this.startZotero(), 1000);
        } else {
          this.startZotero();
        }
        break;
      
      case 'r':
        await this.buildPlugin();
        if (this.zoteroProcess) {
          this.log('info', 'Reloading plugin...');
          this.zoteroProcess.kill();
          setTimeout(() => this.startZotero(), 1000);
        }
        break;
      
      case 'l':
        this.showLogs();
        break;
      
      case 'c':
        console.clear();
        this.showMenu();
        break;
      
      case 'q':
        this.quit();
        break;
      
      default:
        this.log('warn', `Unknown command: ${key}`);
    }
  }

  // 显示日志
  showLogs() {
    const logPath = path.join(this.devProfilePath, 'zotero.log');
    
    if (fs.existsSync(logPath)) {
      this.log('info', 'Recent Zotero logs:');
      const logs = fs.readFileSync(logPath, 'utf8');
      const lines = logs.split('\n').slice(-50);
      console.log(lines.join('\n'));
    } else {
      this.log('warn', 'No log file found');
    }
  }

  // 退出
  quit() {
    this.log('info', 'Shutting down...');
    
    if (this.watcher) {
      this.watcher.close();
    }
    
    if (this.zoteroProcess) {
      this.zoteroProcess.kill();
    }
    
    process.exit(0);
  }

  // 运行开发助手
  async run() {
    await this.init();
    await this.buildPlugin();
    
    this.showMenu();
    
    // 设置输入监听
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    
    process.stdin.on('data', (key) => {
      this.handleInput(key.toString().trim());
    });

    // 处理退出信号
    process.on('SIGINT', () => this.quit());
    process.on('SIGTERM', () => this.quit());
  }
}

// 运行开发助手
if (require.main === module) {
  const helper = new ZoteroDevHelper();
  helper.run().catch(error => {
    console.error('Development helper failed:', error);
    process.exit(1);
  });
}

module.exports = ZoteroDevHelper;