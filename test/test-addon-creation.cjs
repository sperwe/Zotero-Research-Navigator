/**
 * Test script to simulate bootstrap.js execution environment
 * and verify addon instance creation
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

console.log("=== Testing Addon Instance Creation ===\n");

// 1. Read the built script
const scriptPath = path.join(
  __dirname,
  "../build/addon/content/scripts/researchnavigator.js",
);
if (!fs.existsSync(scriptPath)) {
  console.error("ERROR: Built script not found at", scriptPath);
  process.exit(1);
}

const scriptContent = fs.readFileSync(scriptPath, "utf8");
console.log(`Script loaded: ${scriptContent.length} bytes\n`);

// 2. Create a mock Zotero environment similar to bootstrap.js
const mockZotero = {
  debug: (msg) => console.log(`[Zotero.debug] ${msg}`),
  version: "7.0.0-beta",
  Schema: {
    schemaUpdatePromise: Promise.resolve(),
  },
  Prefs: {
    get: () => null,
    set: () => {},
  },
};

const mockServices = {
  console: {
    logStringMessage: (msg) => console.log(`[Services.console] ${msg}`),
  },
  scriptloader: {
    loadSubScriptWithOptions: () => {},
  },
};

const mockChromeUtils = {
  import: () => ({ Services: mockServices }),
};

const mockComponents = {
  interfaces: {},
};

// 3. Create execution context similar to bootstrap.js
const ctx = {
  Zotero: mockZotero,
  Services: mockServices,
  ChromeUtils: mockChromeUtils,
  Components: mockComponents,
  console: {
    log: (msg) => console.log(`[ctx.console] ${msg}`),
    error: (msg) => console.error(`[ctx.console] ERROR: ${msg}`),
    warn: (msg) => console.warn(`[ctx.console] WARN: ${msg}`),
    debug: (msg) => console.log(`[ctx.console] DEBUG: ${msg}`),
  },
};

// Make ctx available as globalThis in the script
ctx.globalThis = ctx;

console.log("=== Executing Script in Mock Environment ===\n");

// 4. Execute the script
try {
  const script = new vm.Script(scriptContent, {
    filename: "researchnavigator.js",
  });
  const vmContext = vm.createContext(ctx);
  script.runInContext(vmContext);

  console.log("\n=== Script Execution Complete ===\n");

  // 5. Check for addon instance in various locations
  console.log("Checking for addon instance:");
  console.log(
    "- ctx.addon:",
    typeof ctx.addon !== "undefined" ? "FOUND" : "NOT FOUND",
  );
  console.log(
    "- ctx.globalThis.addon:",
    typeof ctx.globalThis?.addon !== "undefined" ? "FOUND" : "NOT FOUND",
  );
  console.log(
    "- ctx.addonInstance:",
    typeof ctx.addonInstance !== "undefined" ? "FOUND" : "NOT FOUND",
  );

  // Check Zotero object
  const zoteroKeys = Object.keys(mockZotero);
  console.log("\nZotero object keys:", zoteroKeys.join(", "));

  // Look for ResearchNavigator
  if (mockZotero.ResearchNavigator) {
    console.log("\n✓ Found Zotero.ResearchNavigator!");
  } else {
    console.log("\n✗ Zotero.ResearchNavigator NOT FOUND");
  }

  // List all properties added to ctx
  console.log("\nAll ctx properties:");
  Object.keys(ctx).forEach((key) => {
    if (
      ![
        "Zotero",
        "Services",
        "ChromeUtils",
        "Components",
        "console",
        "globalThis",
      ].includes(key)
    ) {
      console.log(`- ${key}:`, typeof ctx[key]);
    }
  });

  // Try to find addon anywhere
  let addonFound = false;
  let addonLocation = null;

  const checkLocations = {
    "ctx.addon": ctx.addon,
    "ctx.globalThis.addon": ctx.globalThis?.addon,
    "ctx.window?.addon": ctx.window?.addon,
    "mockZotero.ResearchNavigator": mockZotero.ResearchNavigator,
  };

  for (const [location, value] of Object.entries(checkLocations)) {
    if (value && typeof value === "object") {
      addonFound = true;
      addonLocation = location;
      break;
    }
  }

  console.log("\n=== Final Result ===");
  if (addonFound) {
    console.log(`✓ ADDON INSTANCE FOUND at ${addonLocation}`);
    const addon = checkLocations[addonLocation];
    console.log("  - Has hooks:", !!addon.hooks);
    console.log("  - Has data:", !!addon.data);
    console.log("  - Has ztoolkit:", !!addon.ztoolkit);
  } else {
    console.log("✗ ADDON INSTANCE NOT FOUND");
    console.log("\nThis explains the error you're seeing in Zotero!");
  }
} catch (error) {
  console.error("\nERROR executing script:", error.message);
  console.error("Stack:", error.stack);
}
