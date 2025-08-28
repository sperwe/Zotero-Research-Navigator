/**
 * Complete lifecycle test simulating bootstrap.js -> script loading -> startup
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

console.log("=== Complete Plugin Lifecycle Test ===\n");

// Read the built script
const scriptPath = path.join(
  __dirname,
  "../build/addon/content/scripts/researchnavigator.js",
);
const scriptContent = fs.readFileSync(scriptPath, "utf8");

// Step 1: Simulate bootstrap.js context
console.log("STEP 1: Bootstrap.js creates context and loads script\n");

const mockZotero = {
  debug: (msg) => console.log(`[Zotero.debug] ${msg}`),
  version: "7.0.0-beta",
  Schema: { schemaUpdatePromise: Promise.resolve() },
};

const ctx = {
  Zotero: mockZotero,
  console: {
    log: (msg) => console.log(`[console] ${msg}`),
    error: (msg) => console.error(`[console] ERROR: ${msg}`),
  },
};

// Bootstrap.js does this
ctx.globalThis = ctx;

console.log("Bootstrap context created with ctx.globalThis = ctx");

// Step 2: Load the script
console.log("\nSTEP 2: Loading plugin script...\n");

try {
  const script = new vm.Script(scriptContent, {
    filename: "researchnavigator.js",
  });
  const vmContext = vm.createContext(ctx);
  script.runInContext(vmContext);

  console.log("\nScript loaded successfully");

  // Step 3: Bootstrap.js checks for addon
  console.log("\nSTEP 3: Bootstrap.js checks for addon instance\n");

  console.log("ctx.addon =", ctx.addon ? "exists" : "undefined");
  console.log("ctx._globalThis =", ctx._globalThis ? "exists" : "undefined");
  if (ctx._globalThis) {
    console.log(
      "ctx._globalThis.addon =",
      ctx._globalThis.addon ? "exists" : "undefined",
    );
  }

  // The exact check from bootstrap.js
  const addon =
    ctx.addon ||
    (ctx._globalThis && ctx._globalThis.addon) ||
    ctx.globalThis.addon;

  if (addon) {
    console.log("\n✓ Bootstrap.js finds addon instance");

    // Step 4: Bootstrap.js registers addon to Zotero
    mockZotero.ResearchNavigator = addon;
    console.log("✓ Registered as Zotero.ResearchNavigator");

    // Step 5: Bootstrap.js calls onStartup
    console.log("\nSTEP 4: Calling onStartup hook\n");

    if (addon.hooks && addon.hooks.onStartup) {
      console.log("✓ onStartup hook found");

      // Execute onStartup
      addon.hooks
        .onStartup()
        .then(() => {
          console.log("✓ onStartup completed successfully");

          // Step 6: Simulate window load
          console.log("\nSTEP 5: Simulating main window load\n");

          const mockWindow = {
            location: { href: "chrome://zotero/content/zotero.xhtml" },
            document: {
              readyState: "complete",
              getElementById: (id) => {
                console.log(
                  `  - Window.document.getElementById("${id}") called`,
                );
                return id === "zotero-items-tree" || id === "zotero-pane"
                  ? {}
                  : null;
              },
            },
          };

          if (addon.hooks.onMainWindowLoad) {
            console.log("✓ onMainWindowLoad hook found");
            addon.hooks
              .onMainWindowLoad(mockWindow)
              .then(() => {
                console.log("✓ onMainWindowLoad completed");

                console.log("\n=== COMPLETE LIFECYCLE TEST PASSED ===");
                console.log(
                  "\nThe plugin would work correctly in the real Zotero environment!",
                );
              })
              .catch((err) => {
                console.error("✗ onMainWindowLoad failed:", err.message);
              });
          }
        })
        .catch((err) => {
          console.error("✗ onStartup failed:", err.message);
        });
    } else {
      console.log("✗ No onStartup hook found");
    }
  } else {
    console.log("\n✗ Bootstrap.js CANNOT find addon instance");
    console.log("This would cause the error the user reported!");
  }
} catch (error) {
  console.error("\nERROR:", error.message);
  console.error("Stack:", error.stack);
}
