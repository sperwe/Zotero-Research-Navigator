#!/bin/bash

# Zotero Research Navigator 快速启动脚本

echo "======================================"
echo "Zotero Research Navigator Quick Start"
echo "======================================"
echo ""

# 检查是否已经设置了 Zotero 开发环境
ZOTERO_DEV_DIR="$HOME/zotero-dev"
if [ ! -d "$ZOTERO_DEV_DIR" ]; then
    echo "首次运行，正在设置 Zotero 开发环境..."
    ./setup-zotero-dev.sh
    if [ $? -ne 0 ]; then
        echo "设置失败，请检查错误信息"
        exit 1
    fi
fi

# 构建插件
echo ""
echo "构建插件..."
npm run build 2>&1 | grep -E "(Building|Build finished|ERROR|WARNING)" || true

# 检查构建结果
if [ -f "build/zotero-research-navigator.xpi" ]; then
    echo "✓ 插件构建成功: build/zotero-research-navigator.xpi"
else
    echo "✗ 插件构建失败"
    exit 1
fi

# 提供选项
echo ""
echo "请选择操作："
echo "1) 启动 Zotero 并手动安装插件"
echo "2) 使用开发助手（自动构建和热重载）"
echo "3) 安装插件符号链接（用于开发）"
echo "4) 只构建插件"
echo ""
read -p "请输入选项 (1-4): " choice

case $choice in
    1)
        echo ""
        echo "启动 Zotero..."
        echo "请在 Zotero 中："
        echo "1. 工具 → 附加组件"
        echo "2. 点击齿轮图标 → 从文件安装附加组件"
        echo "3. 选择: $(pwd)/build/zotero-research-navigator.xpi"
        echo ""
        "$ZOTERO_DEV_DIR/start-zotero-dev.sh"
        ;;
    2)
        echo ""
        echo "启动开发助手..."
        echo "提示：按 'w' 启动文件监视，按 'z' 启动 Zotero"
        node dev-tools/zotero-dev-helper.cjs
        ;;
    3)
        echo ""
        echo "安装插件符号链接..."
        "$ZOTERO_DEV_DIR/install-plugin-symlink.sh"
        echo ""
        echo "符号链接已安装，现在启动 Zotero..."
        "$ZOTERO_DEV_DIR/start-zotero-dev.sh"
        ;;
    4)
        echo ""
        echo "插件已构建完成！"
        echo "XPI 文件位置: $(pwd)/build/zotero-research-navigator.xpi"
        ;;
    *)
        echo "无效的选项"
        exit 1
        ;;
esac