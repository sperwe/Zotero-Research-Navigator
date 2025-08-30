#!/usr/bin/env node

/**
 * 运行 Bootstrap 过滤器测试的脚本
 * 可以在开发时快速测试
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🧪 Bootstrap Filter Test Runner');
console.log('================================\n');

// 检查是否在正确的目录
const projectRoot = path.resolve(__dirname, '..');
if (!fs.existsSync(path.join(projectRoot, 'package.json'))) {
  console.error('❌ Error: Must run from project root');
  process.exit(1);
}

// 编译测试文件
console.log('📦 Compiling test files...');
try {
  execSync('npm run build', { 
    cwd: projectRoot,
    stdio: 'inherit'
  });
  console.log('✅ Build successful\n');
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}

// 创建测试报告目录
const reportDir = path.join(projectRoot, 'test-reports');
if (!fs.existsSync(reportDir)) {
  fs.mkdirSync(reportDir, { recursive: true });
}

// 生成测试说明
const instructions = `
📋 Bootstrap Filter Testing Instructions
========================================

The test files have been compiled and are ready to use in Zotero.

To run the tests:

1. Open Zotero with the Research Navigator plugin installed

2. Open the Zotero Error Console:
   - Windows/Linux: Ctrl+Shift+K
   - Mac: Cmd+Option+K

3. Run the test suite by typing:
   Zotero.ResearchNavigator.runBootstrapTests()

4. The tests will:
   - Check which elements get filtered by Bootstrap
   - Test safe alternatives
   - Monitor DOM changes in real-time
   - Generate a comprehensive report

5. Test results will be saved to:
   ${path.join(Zotero.DataDirectory.dir || '[Zotero Data Directory]', 'research-navigator-bootstrap-test-report.json')}

Alternative: Run individual tests:

   // Basic filter test
   Zotero.ResearchNavigator.runBasicFilterTest()
   
   // Monitor DOM changes
   Zotero.ResearchNavigator.startFilterMonitor()
   // ... perform actions ...
   Zotero.ResearchNavigator.stopFilterMonitor()
   
   // Test specific component
   Zotero.ResearchNavigator.testComponent('QuickNoteButton')

💡 Tips:
- Test after each code change
- Compare results between different Zotero versions
- Check the browser console for detailed logs
- Use the monitor tool to catch unexpected filtering
`;

console.log(instructions);

// 创建一个快速测试文件供开发使用
const quickTestContent = `
// Quick Bootstrap Filter Test
// Copy and paste this into Zotero's console

(async function() {
  console.log('Starting quick Bootstrap filter test...');
  
  // Test 1: Button element
  const container = document.createElement('div');
  container.innerHTML = '<button>Test Button</button>';
  console.log('Button test:', container.innerHTML.includes('button') ? 'NOT filtered' : 'FILTERED');
  
  // Test 2: Safe alternative
  const safeBtn = document.createElement('span');
  safeBtn.setAttribute('role', 'button');
  safeBtn.textContent = 'Safe Button';
  console.log('Safe button:', safeBtn.outerHTML);
  
  // Test 3: Monitor a specific operation
  const observer = new MutationObserver(mutations => {
    mutations.forEach(m => {
      if (m.removedNodes.length > 0) {
        console.log('Removed:', Array.from(m.removedNodes).map(n => n.nodeName));
      }
    });
  });
  
  const testDiv = document.createElement('div');
  document.body.appendChild(testDiv);
  observer.observe(testDiv, { childList: true, subtree: true });
  
  testDiv.innerHTML = '<button>Will this be filtered?</button><input type="text">';
  
  setTimeout(() => {
    observer.disconnect();
    testDiv.remove();
    console.log('Test complete. Check logs above.');
  }, 100);
})();
`;

// 保存快速测试文件
const quickTestPath = path.join(reportDir, 'quick-bootstrap-test.js');
fs.writeFileSync(quickTestPath, quickTestContent.trim());

console.log(`\n✅ Quick test script saved to: ${quickTestPath}`);
console.log('\nYou can also copy the script content and paste it directly into Zotero console.');

// 生成测试用例文档
const testCasesDoc = `
# Bootstrap Filter Test Cases

## Critical Elements to Test

### 1. Form Elements
- <button> - Usually filtered
- <input> - May be filtered if not self-closed
- <select> - Sometimes filtered
- <textarea> - Sometimes filtered
- <form> - Usually filtered

### 2. Script Elements  
- <script> - Always filtered
- <iframe> - Always filtered
- <object> - Always filtered
- <embed> - Always filtered

### 3. Event Attributes
- onclick="..." - Always filtered
- onload="..." - Always filtered
- onerror="..." - Always filtered
- Any on* attribute - Filtered

### 4. URLs
- href="javascript:..." - Filtered
- src="data:..." - Sometimes filtered

## Safe Alternatives

### Buttons
Instead of: <button>Click</button>
Use: <span role="button" tabindex="0">Click</span>

### Inputs
Instead of: <input type="text">
Use: <input type="text" /> (self-closed)
Or: createElement('input')

### Event Handlers
Instead of: onclick="doSomething()"
Use: addEventListener('click', doSomething)

### Links
Instead of: href="javascript:void(0)"
Use: href="#" with preventDefault()
`;

const testCasesPath = path.join(reportDir, 'bootstrap-filter-test-cases.md');
fs.writeFileSync(testCasesPath, testCasesDoc.trim());

console.log(`📄 Test cases documentation saved to: ${testCasesPath}`);
console.log('\n🚀 Ready to test! Follow the instructions above.');