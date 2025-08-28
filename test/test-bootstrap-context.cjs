/**
 * Test to simulate exact bootstrap.js context and BasicTool behavior
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

console.log("=== Testing Bootstrap Context with BasicTool ===\n");

// Read the current built script
const scriptPath = path.join(
  __dirname,
  "../build/addon/content/scripts/researchnavigator.js",
);
const scriptContent = fs.readFileSync(scriptPath, "utf8");

// Create mock environment
const mockZotero = {
  debug: (msg) => console.log(`[Zotero.debug] ${msg}`),
  version: "7.0.0-beta",
};

// Mock BasicTool.getGlobal behavior
const mockBasicTool = {
  getGlobal: function (name) {
    console.log(`[BasicTool.getGlobal] Called with: "${name}"`);
    if (name === "Zotero") return mockZotero;
    if (name === "globalThis") {
      // This is what BasicTool would return in Zotero environment
      return ctx; // Return the execution context itself
    }
    return undefined;
  },
};

// Create execution context as bootstrap.js does
const ctx = {
  Zotero: mockZotero,
  console: {
    log: (msg) => console.log(`[console] ${msg}`),
    error: (msg) => console.error(`[console] ERROR: ${msg}`),
  },
};

// Important: Set globalThis to ctx itself (as it would be in loadSubScriptWithOptions)
ctx.globalThis = ctx;

console.log("Initial ctx properties:", Object.keys(ctx).join(", "));
console.log("\n=== Executing Script ===\n");

try {
  // Create a script that includes BasicTool mock
  const wrappedScript = `
    // Mock BasicTool in the script context
    const BasicTool = ${mockBasicTool.constructor.toString()};
    BasicTool.prototype.getGlobal = ${mockBasicTool.getGlobal.toString()};
    
    // Execute the actual script
    ${scriptContent}
  `;

  const script = new vm.Script(wrappedScript, {
    filename: "wrapped-researchnavigator.js",
  });
  const vmContext = vm.createContext(ctx);
  script.runInContext(vmContext);

  console.log("\n=== After Script Execution ===\n");

  // Check exactly what bootstrap.js checks
  console.log("Checking locations:");
  console.log("- ctx.addon =", ctx.addon ? "exists" : "undefined");
  console.log("- ctx._globalThis =", ctx._globalThis ? "exists" : "undefined");
  if (ctx._globalThis) {
    console.log(
      "- ctx._globalThis.addon =",
      ctx._globalThis.addon ? "exists" : "undefined",
    );
  }
  console.log(
    "- ctx.globalThis.addon =",
    ctx.globalThis?.addon ? "exists" : "undefined",
  );

  // Check for the exact pattern bootstrap.js uses
  const addon =
    ctx.addon ||
    (ctx._globalThis && ctx._globalThis.addon) ||
    ctx.globalThis.addon;

  console.log("\n=== Bootstrap.js Check Result ===");
  if (addon) {
    console.log("✓ ADDON FOUND using bootstrap.js logic");
  } else {
    console.log("✗ ADDON NOT FOUND using bootstrap.js logic");
    console.log("This matches the user's error!");
  }

  // Debug: List all ctx properties
  console.log("\nAll ctx properties after execution:");
  Object.keys(ctx).forEach((key) => {
    console.log(`- ${key}:`, typeof ctx[key]);
  });
} catch (error) {
  console.error("\nERROR:", error.message);
  console.error("Stack:", error.stack);
}
