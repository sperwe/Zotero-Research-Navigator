/**
 * Test to verify Zotero.ResearchNavigator registration
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('=== Testing Zotero.ResearchNavigator Registration ===\n');

// Read the built script
const scriptPath = path.join(__dirname, '../build/addon/content/scripts/researchnavigator.js');
const scriptContent = fs.readFileSync(scriptPath, 'utf8');

// Create mock environment matching bootstrap.js
const mockZotero = {
  debug: (msg) => console.log(`[Zotero.debug] ${msg}`),
  version: '7.0.0-beta'
};

const ctx = {
  Zotero: mockZotero,
  console: {
    log: (msg) => console.log(`[console] ${msg}`),
    error: (msg) => console.error(`[console] ERROR: ${msg}`)
  }
};

// Critical: This is what bootstrap.js does
ctx.globalThis = ctx;

console.log('1. Before script execution:');
console.log(`   Zotero.ResearchNavigator = ${mockZotero.ResearchNavigator}`);

try {
  // Execute script
  const script = new vm.Script(scriptContent, { filename: 'researchnavigator.js' });
  const vmContext = vm.createContext(ctx);
  script.runInContext(vmContext);
  
  console.log('\n2. After script execution:');
  console.log(`   Zotero.ResearchNavigator = ${mockZotero.ResearchNavigator}`);
  console.log(`   ctx.addon = ${ctx.addon ? 'exists' : 'undefined'}`);
  console.log(`   ctx._globalThis.addon = ${ctx._globalThis?.addon ? 'exists' : 'undefined'}`);
  
  // Simulate what bootstrap.js does
  const addonInstance = ctx.addon || (ctx._globalThis && ctx._globalThis.addon) || ctx.globalThis?.addon;
  
  if (addonInstance) {
    console.log('\n3. Bootstrap.js would find addon instance');
    
    // This is what bootstrap.js line 93 does
    mockZotero.ResearchNavigator = addonInstance;
    console.log('   Setting Zotero.ResearchNavigator = addonInstance');
  } else {
    console.log('\n3. Bootstrap.js would NOT find addon instance');
  }
  
  console.log('\n4. Final state:');
  console.log(`   Zotero.ResearchNavigator = ${mockZotero.ResearchNavigator ? 'SET' : 'UNDEFINED'}`);
  
  // Test what user would see
  console.log('\n5. User console.log test:');
  console.log(`   typeof Zotero.ResearchNavigator = ${typeof mockZotero.ResearchNavigator}`);
  if (mockZotero.ResearchNavigator) {
    console.log(`   Has hooks: ${!!mockZotero.ResearchNavigator.hooks}`);
    console.log(`   Has data: ${!!mockZotero.ResearchNavigator.data}`);
  }
  
} catch (error) {
  console.error('\nERROR:', error.message);
}