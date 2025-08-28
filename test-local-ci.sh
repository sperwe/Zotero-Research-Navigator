#!/bin/bash
# 模拟 GitHub Actions 测试环境

echo "=== Local CI Test ==="
echo "Simulating GitHub Actions environment..."

# 清理
echo "1. Cleaning workspace..."
rm -rf build/
rm -rf node_modules/

# 安装依赖
echo "2. Installing dependencies..."
npm install --legacy-peer-deps

# 运行 lint
echo "3. Running lint..."
npm run lint:check || echo "Lint failed (continuing...)"

# 构建
echo "4. Building plugin..."
npm run build-prod

# 运行测试
echo "5. Running tests..."
npm test

# 检查构建产物
echo "6. Checking build artifacts..."
if [ -f "build/zotero-research-navigator.xpi" ]; then
    echo "✓ XPI file exists"
    unzip -l build/zotero-research-navigator.xpi | head -20
else
    echo "✗ XPI file not found"
    exit 1
fi

echo ""
echo "=== Local CI Test Complete ==="