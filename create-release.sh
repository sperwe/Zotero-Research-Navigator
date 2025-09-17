#!/bin/bash

# 创建Release的脚本
echo "Creating Release for v3.0.0..."

# 检查XPI文件是否存在
if [ ! -f "zotero-research-navigator-v3.0.0.xpi" ]; then
    echo "Error: XPI file not found. Building first..."
    npm run build-prod
    cd build
    zip -r ../zotero-research-navigator-v3.0.0.xpi *
    cd ..
fi

echo "XPI file ready: $(ls -la zotero-research-navigator-v3.0.0.xpi)"

# 显示XPI文件内容
echo "XPI contents:"
unzip -l zotero-research-navigator-v3.0.0.xpi | head -10

echo ""
echo "To create the release manually:"
echo "1. Go to: https://github.com/sperwe/Zotero-Research-Navigator/releases/new"
echo "2. Select tag: v3.0.0"
echo "3. Title: Zotero Research Navigator v3.0.0"
echo "4. Upload the XPI file: zotero-research-navigator-v3.0.0.xpi"
echo "5. Add release notes:"
echo ""
echo "## 🎉 Zotero Research Navigator v3.0.0"
echo ""
echo "### 📦 安装方法"
echo "1. 下载下方的 \`.xpi\` 文件"
echo "2. 在 Zotero 中：工具 → 插件 → 从文件安装插件"
echo "3. 选择下载的 XPI 文件"
echo "4. 重启 Zotero"
echo ""
echo "### ✨ 更新内容"
echo "- 支持 Zotero 7.0.0-beta.70 到 8.*.*"
echo "- 专门支持 Zotero 8 beta 版本"
echo "- 修复了构建配置问题"
echo ""
echo "### 版本兼容性"
echo "- 最低版本: Zotero 7.0.0-beta.70"
echo "- 最高版本: Zotero 8.*.*"
echo "- 支持所有 Zotero 7 和 8 版本，包括 beta 版本"