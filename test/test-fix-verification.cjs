/**
 * Test to verify the fix for ctx._globalThis.addon issue
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('=== Verifying Fix for ctx._globalThis.addon ===\n');

// First, we need to build the project
console.log('Building project...');
const { execSync } = require('child_process');
try {
  execSync('npm run build', { cwd: path.join(__dirname, '..'), stdio: 'pipe' });
  console.log('✓ Build completed\n');
} catch (e) {
  console.log('Build output:', e.stdout?.toString());
  // Continue anyway as build might succeed despite TypeScript errors
}

// Read the built script
const scriptPath = path.join(__dirname, '../build/addon/content/scripts/researchnavigator.js');
const scriptContent = fs.readFileSync(scriptPath, 'utf8');

// Create mock Zotero environment
const mockZotero = {
  debug: (msg) => console.log(`[Zotero.debug] ${msg}`),
  version: '7.0.0-beta'
};

// Create bootstrap.js-like context
const ctx = {
  Zotero: mockZotero,
  console: {
    log: (msg) => console.log(`[console] ${msg}`),
    error: (msg) => console.error(`[console] ERROR: ${msg}`)
  }
};

// CRITICAL: This is what bootstrap.js does
ctx.globalThis = ctx;

console.log('=== Bootstrap.js Context Setup ===');
console.log('- ctx object created');
console.log('- ctx.globalThis = ctx (circular reference)');
console.log('- Script will be loaded with target: ctx\n');

console.log('=== Executing Fixed Script ===\n');

try {
  // Execute script in context
  const script = new vm.Script(scriptContent, { filename: 'researchnavigator.js' });
  const vmContext = vm.createContext(ctx);
  script.runInContext(vmContext);
  
  console.log('\n=== Verification Results ===\n');
  
  // Check all the locations bootstrap.js checks
  console.log('Bootstrap.js checks:');
  console.log('1. ctx.addon =', ctx.addon ? '✓ EXISTS' : '✗ MISSING');
  console.log('2. ctx._globalThis =', ctx._globalThis ? '✓ EXISTS' : '✗ MISSING');
  if (ctx._globalThis) {
    console.log('   ctx._globalThis.addon =', ctx._globalThis.addon ? '✓ EXISTS' : '✗ MISSING');
  }
  console.log('3. ctx.globalThis.addon =', ctx.globalThis?.addon ? '✓ EXISTS' : '✗ MISSING');
  
  // Verify the exact bootstrap.js check pattern
  const addon = ctx.addon || (ctx._globalThis && ctx._globalThis.addon) || ctx.globalThis.addon;
  
  console.log('\n=== Bootstrap.js Pattern Check ===');
  console.log('const addon = ctx.addon || (ctx._globalThis && ctx._globalThis.addon) || ctx.globalThis.addon;');
  console.log('Result: addon is', addon ? '✓ FOUND' : '✗ NOT FOUND');
  
  if (addon) {
    console.log('\n✓ FIX SUCCESSFUL!');
    console.log('The addon instance would be found by bootstrap.js');
    
    // Verify addon properties
    console.log('\nAddon properties:');
    console.log('- Has hooks:', !!addon.hooks);
    console.log('- Has data:', !!addon.data);
    console.log('- Has ztoolkit:', !!addon.ztoolkit);
  } else {
    console.log('\n✗ FIX FAILED!');
    console.log('Bootstrap.js would still fail to find the addon');
  }
  
  // Check Zotero registration
  if (mockZotero.ResearchNavigator) {
    console.log('\n✓ Also registered as Zotero.ResearchNavigator');
  }
  
} catch (error) {
  console.error('\nERROR executing script:', error.message);
  console.error('Stack:', error.stack);
}