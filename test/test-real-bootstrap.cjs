/**
 * Test that exactly replicates what bootstrap.js does
 */

const fs = require("fs");
const path = require("path");

console.log("=== Analyzing Real Bootstrap Context ===\n");

// 1. Read the built script to understand what it expects
const scriptPath = path.join(
  __dirname,
  "../build/addon/content/scripts/researchnavigator.js",
);
const scriptContent = fs.readFileSync(scriptPath, "utf8");

// 2. Search for key patterns in the built code
console.log("Searching for key patterns in built script:\n");

// Check if script uses globalThis
if (scriptContent.includes("globalThis.addon")) {
  console.log("✓ Script sets globalThis.addon");
}

// Check if script uses _globalThis
if (scriptContent.includes("_globalThis")) {
  console.log("✓ Script uses _globalThis");

  // Find how _globalThis is used
  const matches = scriptContent.match(/_globalThis[.\[]addon/g);
  if (matches) {
    console.log(`  Found ${matches.length} instances of _globalThis.addon`);
  }
}

// Check for BasicTool usage
if (scriptContent.includes("BasicTool")) {
  console.log("✓ Script uses BasicTool");

  // Find getGlobal calls
  const getGlobalMatches = scriptContent.match(/getGlobal\(['"](.*?)['"]\)/g);
  if (getGlobalMatches) {
    console.log("  getGlobal calls found:");
    getGlobalMatches.forEach((match) => console.log(`    - ${match}`));
  }
}

// 3. Check bootstrap.js expectations
console.log("\n=== Bootstrap.js Expectations ===\n");

const bootstrapPath = path.join(__dirname, "../addon/bootstrap.js");
const bootstrapContent = fs.readFileSync(bootstrapPath, "utf8");

// Find the exact check pattern
const checkPattern = /ctx\.addon\s*\|\|\s*\(ctx\._globalThis.*?\)/;
const match = bootstrapContent.match(checkPattern);
if (match) {
  console.log("Bootstrap.js checks for addon in this order:");
  console.log(`  ${match[0]}`);
}

// 4. Analyze why the mismatch occurs
console.log("\n=== Analysis ===\n");

// Check if the built script actually creates _globalThis
const hasGlobalThisCreation =
  scriptContent.includes("const _globalThis") ||
  scriptContent.includes("var _globalThis") ||
  scriptContent.includes("let _globalThis");

if (hasGlobalThisCreation) {
  console.log("✓ Script creates _globalThis variable");
} else {
  console.log("✗ Script does NOT create _globalThis variable");
  console.log("  This could explain why ctx._globalThis is undefined!");
}

// Check how addon is actually set
console.log("\nSearching for where addon is set...");
const addonSetPatterns = [
  /globalThis\.addon\s*=/,
  /ctx\.addon\s*=/,
  /_globalThis\.addon\s*=/,
  /window\.addon\s*=/,
];

addonSetPatterns.forEach((pattern) => {
  if (pattern.test(scriptContent)) {
    console.log(`✓ Found: ${pattern.source}`);
  }
});

// 5. Look for the actual problem
console.log("\n=== Root Cause Analysis ===\n");

// Extract relevant code sections
const globalThisSection = scriptContent.match(
  /getGlobal\(["']globalThis["']\)[^;]*/g,
);
if (globalThisSection) {
  console.log('Found getGlobal("globalThis") usage:');
  globalThisSection.forEach((section, i) => {
    console.log(`  ${i + 1}. ${section.substring(0, 100)}...`);
  });
}

// Final recommendation
console.log("\n=== Conclusion ===\n");
console.log("The issue appears to be that:");
console.log("1. Bootstrap.js checks ctx._globalThis.addon");
console.log(
  "2. But the current code might not create ctx._globalThis properly",
);
console.log(
  "3. We need to verify the exact execution flow in the real Zotero environment",
);
