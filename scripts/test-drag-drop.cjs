#!/usr/bin/env node

/**
 * Test script to verify drag-drop implementation
 */

const fs = require("fs");
const path = require("path");

console.log("Testing Drag & Drop Implementation...\n");

// Check if the compiled code includes drag-drop handlers
const compiledPath = path.join(
  __dirname,
  "../build/addon/bootstrap-compiled.js",
);
if (!fs.existsSync(compiledPath)) {
  console.error("❌ Compiled file not found. Run npm run build first.");
  process.exit(1);
}

const compiledCode = fs.readFileSync(compiledPath, "utf8");

// Test cases
const testCases = [
  {
    name: "DragOver Event Handler",
    pattern: /handleDragOver.*preventDefault.*stopPropagation/s,
    description: "Should handle dragover events",
  },
  {
    name: "Drop Event Handler",
    pattern: /handleDrop.*preventDefault.*dataTransfer.*text\/plain/s,
    description: "Should handle drop events and get text data",
  },
  {
    name: "Visual Feedback",
    pattern: /background-color.*#f0f8ff.*outline.*dashed/s,
    description: "Should provide visual feedback during drag",
  },
  {
    name: "Quote Formatting",
    pattern: />\s*\$\{text\.trim\(\)\}.*timestamp/s,
    description: "Should format dropped text as markdown quote",
  },
  {
    name: "Event Listeners Registration",
    pattern: /addEventListener.*dragover.*handleDragOver.*drop.*handleDrop/s,
    description: "Should register drag-drop event listeners",
  },
  {
    name: "Debug Logging",
    pattern: /DragOver event triggered.*Drop event triggered/s,
    description: "Should include debug logging",
  },
];

let passed = 0;
let failed = 0;

testCases.forEach((test) => {
  if (compiledCode.match(test.pattern)) {
    console.log(`✅ ${test.name}`);
    console.log(`   ${test.description}`);
    passed++;
  } else {
    console.log(`❌ ${test.name}`);
    console.log(`   ${test.description}`);
    console.log(`   Pattern not found: ${test.pattern}`);
    failed++;
  }
  console.log("");
});

console.log(`\nSummary: ${passed} passed, ${failed} failed`);

// Additional checks
console.log("\n📋 Event Listener Registrations Found:");
const listenerMatches = compiledCode.match(
  /addEventListener\("(dragover|drop|dragleave)"/g,
);
if (listenerMatches) {
  listenerMatches.forEach((match) => console.log(`   - ${match}`));
} else {
  console.log("   None found!");
}

// Check for potential issues
console.log("\n⚠️  Potential Issues:");
if (!compiledCode.includes("handleDragOver")) {
  console.log("   - handleDragOver method not found in compiled code");
}
if (!compiledCode.includes("handleDrop")) {
  console.log("   - handleDrop method not found in compiled code");
}
if (!compiledCode.includes("text/plain")) {
  console.log("   - text/plain MIME type not found");
}

process.exit(failed > 0 ? 1 : 0);
