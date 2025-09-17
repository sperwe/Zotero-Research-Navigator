#!/bin/bash

echo "🚀 Creating Zotero Research Navigator v2.9.3 Release"
echo "=================================================="

# 检查是否在正确的目录
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Are you in the right directory?"
    exit 1
fi

echo "📦 Building plugin..."
npm run build-prod

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "📦 Creating XPI file..."
cd build
zip -r ../zotero-research-navigator-v2.9.3.xpi *
cd ..

if [ ! -f "zotero-research-navigator-v2.9.3.xpi" ]; then
    echo "❌ XPI creation failed!"
    exit 1
fi

echo "✅ XPI file created: zotero-research-navigator-v2.9.3.xpi"
ls -la zotero-research-navigator-v2.9.3.xpi

echo ""
echo "🎯 Next steps:"
echo "1. Go to: https://github.com/sperwe/Zotero-Research-Navigator/releases"
echo "2. Click 'Create a new release'"
echo "3. Select tag: v2.9.3"
echo "4. Upload the XPI file: zotero-research-navigator-v2.9.3.xpi"
echo "5. Use the content from RELEASE_v2.9.3.md as release description"
echo ""
echo "📁 Files ready:"
echo "   - zotero-research-navigator-v2.9.3.xpi"
echo "   - RELEASE_v2.9.3.md"