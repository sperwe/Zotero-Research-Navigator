#!/bin/bash

echo "🔧 Building development version with auto-update from branch..."

# 备份原始 manifest
cp addon/manifest.json addon/manifest.json.backup

# 使用开发版 manifest
cp addon/manifest-dev.json addon/manifest.json

# 构建
npm run build-prod

# 恢复原始 manifest
mv addon/manifest.json.backup addon/manifest.json

echo "✅ Development build complete!"
echo "📦 XPI file: build/zotero-research-navigator.xpi"
echo "🔄 This version will auto-update from the fix/typescript-errors-and-functionality branch"