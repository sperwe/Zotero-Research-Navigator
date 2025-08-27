#!/bin/bash

# Zotero 7 Beta 开发环境设置脚本

set -e

echo "====================================="
echo "Setting up Zotero 7 Development Environment"
echo "====================================="

# 创建开发目录
DEV_DIR="$HOME/zotero-dev"
ZOTERO_DIR="$DEV_DIR/zotero-beta"
PROFILE_DIR="$DEV_DIR/zotero-profile"

mkdir -p "$DEV_DIR"
cd "$DEV_DIR"

# 检查操作系统
OS="unknown"
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="mac"
else
    echo "Unsupported OS: $OSTYPE"
    exit 1
fi

# 下载 Zotero 7 Beta
echo "Downloading Zotero 7 Beta for $OS..."

if [ "$OS" == "linux" ]; then
    DOWNLOAD_URL="https://download.zotero.org/client/beta/7.0.11-beta.9%2Bf4b666322/Zotero-7.0.11-beta.9%2Bf4b666322_linux-x86_64.tar.bz2"
    FILENAME="Zotero-7-beta.tar.bz2"
    
    if [ ! -f "$FILENAME" ]; then
        wget -O "$FILENAME" "$DOWNLOAD_URL"
    fi
    
    # 解压
    echo "Extracting Zotero..."
    rm -rf "$ZOTERO_DIR"
    tar -xjf "$FILENAME"
    mv Zotero_linux-x86_64 "$ZOTERO_DIR"
    
elif [ "$OS" == "mac" ]; then
    DOWNLOAD_URL="https://download.zotero.org/client/beta/7.0.11-beta.9%2Bf4b666322/Zotero-7.0.11-beta.9%2Bf4b666322.dmg"
    FILENAME="Zotero-7-beta.dmg"
    
    if [ ! -f "$FILENAME" ]; then
        curl -L -o "$FILENAME" "$DOWNLOAD_URL"
    fi
    
    # 挂载 DMG 并复制
    echo "Mounting and copying Zotero..."
    hdiutil attach "$FILENAME" -nobrowse -noautoopen
    rm -rf "$ZOTERO_DIR"
    cp -R "/Volumes/Zotero/Zotero.app" "$ZOTERO_DIR"
    hdiutil detach "/Volumes/Zotero"
fi

# 创建开发配置文件
echo "Creating development profile..."
mkdir -p "$PROFILE_DIR"

# 创建 prefs.js 配置文件
cat > "$PROFILE_DIR/prefs.js" << 'EOF'
// Zotero 开发环境配置

// 启用开发者模式
user_pref("extensions.zotero.debug.log", true);
user_pref("extensions.zotero.debug.time", true);
user_pref("extensions.zotero.debug.store", true);
user_pref("extensions.zotero.debug.store.limit", 10000);

// 禁用自动更新
user_pref("app.update.auto", false);
user_pref("app.update.enabled", false);
user_pref("extensions.update.enabled", false);

// 启用远程调试
user_pref("devtools.debugger.remote-enabled", true);
user_pref("devtools.chrome.enabled", true);
user_pref("devtools.debugger.prompt-connection", false);

// 允许加载未签名的插件
user_pref("xpinstall.signatures.required", false);
user_pref("extensions.legacy.enabled", true);

// 显示更多错误信息
user_pref("javascript.options.showInConsole", true);
user_pref("browser.dom.window.dump.enabled", true);
user_pref("javascript.options.strict", true);
user_pref("extensions.logging.enabled", true);
user_pref("dom.report_all_js_exceptions", true);
user_pref("devtools.errorconsole.enabled", true);

// 禁用崩溃报告
user_pref("toolkit.crashreporter.enabled", false);
EOF

# 创建启动脚本
cat > "$DEV_DIR/start-zotero-dev.sh" << EOF
#!/bin/bash

# 启动 Zotero 开发环境

ZOTERO_BIN=""
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    ZOTERO_BIN="$ZOTERO_DIR/zotero"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    ZOTERO_BIN="$ZOTERO_DIR/Contents/MacOS/zotero"
fi

echo "Starting Zotero with development profile..."
echo "Profile location: $PROFILE_DIR"
echo ""
echo "To install the plugin:"
echo "1. Build the plugin: npm run build"
echo "2. In Zotero: Tools > Add-ons > Install Add-on From File"
echo "3. Select the .xpi file from the build directory"
echo ""

"\$ZOTERO_BIN" -profile "$PROFILE_DIR" -purgecaches -jsconsole
EOF

chmod +x "$DEV_DIR/start-zotero-dev.sh"

# 创建插件符号链接安装脚本
cat > "$DEV_DIR/install-plugin-symlink.sh" << EOF
#!/bin/bash

# 创建插件的符号链接用于开发

PLUGIN_DIR="$(pwd)"
EXTENSION_DIR="$PROFILE_DIR/extensions"
ADDON_ID="research-navigator@zotero.org"

mkdir -p "\$EXTENSION_DIR"

# 构建插件
echo "Building plugin..."
cd "\$PLUGIN_DIR"
npm run build

# 创建符号链接
echo "Creating symlink..."
ln -sf "\$PLUGIN_DIR/build" "\$EXTENSION_DIR/\$ADDON_ID"

echo "Plugin installed as symlink at: \$EXTENSION_DIR/\$ADDON_ID"
echo "Restart Zotero to load the plugin."
EOF

chmod +x "$DEV_DIR/install-plugin-symlink.sh"

echo ""
echo "====================================="
echo "Setup complete!"
echo "====================================="
echo ""
echo "Zotero is installed at: $ZOTERO_DIR"
echo "Profile directory: $PROFILE_DIR"
echo ""
echo "To start Zotero in development mode:"
echo "  $DEV_DIR/start-zotero-dev.sh"
echo ""
echo "To install the plugin as a symlink:"
echo "  $DEV_DIR/install-plugin-symlink.sh"
echo ""