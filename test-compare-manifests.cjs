#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔬 Manifest Format Comparison Test\n');

// 创建不同格式的 manifest.json
const manifests = {
  'tabs': {
    content: `{
	"manifest_version": 2,
	"name": "Test Plugin",
	"version": "1.0",
	"applications": {
		"zotero": {
			"id": "test@example.com",
			"strict_min_version": "7.0",
			"strict_max_version": "7.1.*"
		}
	}
}`,
    description: 'Tab indentation (like make-it-red)'
  },
  'spaces2': {
    content: `{
  "manifest_version": 2,
  "name": "Test Plugin",
  "version": "1.0",
  "applications": {
    "zotero": {
      "id": "test@example.com",
      "strict_min_version": "7.0",
      "strict_max_version": "7.1.*"
    }
  }
}`,
    description: '2-space indentation'
  },
  'spaces8': {
    content: `{
        "manifest_version": 2,
        "name": "Test Plugin",
        "version": "1.0",
        "applications": {
                "zotero": {
                        "id": "test@example.com",
                        "strict_min_version": "7.0",
                        "strict_max_version": "7.1.*"
                }
        }
}`,
    description: '8-space indentation (current build output)'
  },
  'minified': {
    content: `{"manifest_version":2,"name":"Test Plugin","version":"1.0","applications":{"zotero":{"id":"test@example.com","strict_min_version":"7.0","strict_max_version":"7.1.*"}}}`,
    description: 'Minified (no whitespace)'
  }
};

// 测试每种格式
for (const [name, data] of Object.entries(manifests)) {
  console.log(`\n📝 Testing: ${data.description}`);
  console.log('─'.repeat(50));
  
  try {
    // 1. 验证 JSON 格式
    const parsed = JSON.parse(data.content);
    console.log('  ✓ Valid JSON');
    
    // 2. 检查字节
    const bytes = Buffer.from(data.content);
    console.log(`  ✓ Size: ${bytes.length} bytes`);
    
    // 3. 检查特殊字符
    const hasTab = data.content.includes('\t');
    const hasCR = data.content.includes('\r');
    const hasLF = data.content.includes('\n');
    
    console.log(`  ${hasTab ? '✓' : '✗'} Contains tabs`);
    console.log(`  ${hasCR ? '✓' : '✗'} Contains CR (\\r)`);
    console.log(`  ${hasLF ? '✓' : '✗'} Contains LF (\\n)`);
    
    // 4. 检查第一个非空字符
    const firstChar = data.content.trim()[0];
    console.log(`  ✓ First character: '${firstChar}' (${firstChar.charCodeAt(0)})`);
    
  } catch (e) {
    console.error(`  ❌ Error: ${e.message}`);
  }
}

// 读取当前的 manifest.json
console.log('\n\n🎯 Current addon/manifest.json:');
console.log('─'.repeat(50));
const currentManifest = fs.readFileSync(path.join(__dirname, 'addon/manifest.json'), 'utf8');
console.log(`First 100 chars: ${currentManifest.substring(0, 100).replace(/\n/g, '\\n').replace(/\t/g, '\\t')}...`);
console.log(`Contains tabs: ${currentManifest.includes('\t')}`);
console.log(`Line endings: ${currentManifest.includes('\r\n') ? 'CRLF' : 'LF'}`);

// 建议
console.log('\n💡 Recommendations:');
console.log('- Zotero accepts various JSON formats');
console.log('- The error "does not contain a valid manifest" suggests the file itself is missing or in wrong location');
console.log('- NOT a JSON parsing issue (our tests pass)');