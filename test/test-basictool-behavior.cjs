/**
 * Test BasicTool.getGlobal behavior in bootstrap context
 */

console.log('=== Testing BasicTool.getGlobal("globalThis") Behavior ===\n');

// Simulate what happens in bootstrap.js context
const ctx = {
  Zotero: { debug: (msg) => console.log(`[Zotero] ${msg}`) },
  console: console,
};

// Make ctx.globalThis point to ctx itself (as bootstrap.js does)
ctx.globalThis = ctx;

console.log("Bootstrap context setup:");
console.log("- ctx is the execution context");
console.log("- ctx.globalThis = ctx (circular reference)");
console.log("- Script is loaded with target: ctx\n");

// Now simulate what BasicTool.getGlobal("globalThis") would return
console.log('What would BasicTool.getGlobal("globalThis") return?');
console.log(
  "Option 1: If it returns the actual global globalThis, then _globalThis !== ctx",
);
console.log("Option 2: If it returns ctx.globalThis, then _globalThis === ctx");
console.log("Option 3: If it returns something else entirely\n");

// The key insight
console.log("=== The Key Problem ===\n");
console.log("In bootstrap.js:");
console.log("1. Script is loaded into ctx");
console.log("2. ctx.globalThis = ctx");
console.log(
  '3. But basicTool.getGlobal("globalThis") might return the REAL globalThis',
);
console.log("4. So _globalThis.addon gets set on the REAL globalThis, not ctx");
console.log("5. Bootstrap.js checks ctx._globalThis which doesn't exist!\n");

// The fix needed
console.log("=== What Needs to Happen ===\n");
console.log("The script needs to set addon on:");
console.log(
  "1. The current execution context (this or arguments.callee.caller...)",
);
console.log("2. Or detect it's running in bootstrap and set ctx._globalThis");
console.log("3. Or use a different approach entirely\n");

// Let's check what zotero-plugin-toolkit actually does
try {
  const toolkitPath = require.resolve("zotero-plugin-toolkit");
  const toolkit = require("zotero-plugin-toolkit");
  console.log("Found zotero-plugin-toolkit at:", toolkitPath);

  // Try to understand BasicTool implementation
  if (toolkit.BasicTool) {
    console.log("\nBasicTool class found");
    // Note: We can't easily test the actual behavior without Zotero environment
  }
} catch (e) {
  console.log("Could not load zotero-plugin-toolkit:", e.message);
}
