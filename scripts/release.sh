#!/bin/bash

# 发布脚本 - 用于创建新版本并触发 Zotero 自动更新

VERSION=$1

if [ -z "$VERSION" ]; then
    echo "Usage: ./scripts/release.sh <version>"
    echo "Example: ./scripts/release.sh 2.3.0"
    exit 1
fi

echo "🚀 Releasing version $VERSION..."

# 1. 确保在主分支
git checkout main
git pull origin main

# 2. 合并开发分支
git merge fix/typescript-errors-and-functionality --no-ff -m "Merge: Release v$VERSION"

# 3. 更新 update.json 中的版本
sed -i "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" update.json

# 4. 提交更改
git add update.json
git commit -m "chore: update version in update.json to $VERSION"

# 5. 创建标签
git tag -a "v$VERSION" -m "Release version $VERSION"

# 6. 推送到远程
git push origin main
git push origin "v$VERSION"

echo "✅ Version $VERSION released!"
echo ""
echo "📋 Next steps:"
echo "1. Go to https://github.com/sperwe/Zotero-Research-Navigator/releases/new"
echo "2. Select tag: v$VERSION"
echo "3. Upload the XPI file from build/"
echo "4. Publish release"
echo ""
echo "Zotero will automatically check for updates and notify users!"