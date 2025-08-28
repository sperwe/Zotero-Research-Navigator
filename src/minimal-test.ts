/**
 * Minimal test version to ensure basic functionality
 */

// Create a simple addon object
const testAddon = {
  id: "research-navigator@zotero.org",
  version: "2.0.3-test",

  data: {
    initialized: false,
    env: "production",
  },

  hooks: {
    onStartup: async function () {
      console.log("[Research Navigator TEST] onStartup called");
      this.data.initialized = true;
      return Promise.resolve();
    },

    onMainWindowLoad: async function (window) {
      console.log("[Research Navigator TEST] onMainWindowLoad called");

      // Create a simple test button
      try {
        const doc = window.document;
        const toolbar = doc.getElementById("zotero-items-toolbar");

        if (toolbar) {
          const button = doc.createXULElement("toolbarbutton");
          button.id = "research-navigator-test-button";
          button.label = "RN Test";
          button.setAttribute("tooltiptext", "Research Navigator Test");
          button.style.listStyleImage =
            "url('chrome://zotero/skin/16/universal/add.svg')";

          button.addEventListener("command", () => {
            window.alert("Research Navigator is working!");
          });

          toolbar.appendChild(button);
          console.log("[Research Navigator TEST] Test button added");
        } else {
          console.log("[Research Navigator TEST] Toolbar not found");
        }
      } catch (e) {
        console.error("[Research Navigator TEST] Error creating button:", e);
      }

      return Promise.resolve();
    },

    onShutdown: async function () {
      console.log("[Research Navigator TEST] onShutdown called");
      return Promise.resolve();
    },
  },

  // Simple module access
  modules: {
    test: true,
  },
};

// Make it available in multiple ways
if (typeof globalThis !== "undefined") {
  (globalThis as any).addon = testAddon;
  console.log("[Research Navigator TEST] Set globalThis.addon");
}

// Try to set on current context
try {
  (Function("return this")() as any).addon = testAddon;
  console.log("[Research Navigator TEST] Set context.addon");
} catch (e) {
  console.log("[Research Navigator TEST] Could not set context.addon");
}

// Register with Zotero if available
if (typeof Zotero !== "undefined") {
  (Zotero as any).ResearchNavigator = testAddon;
  console.log(
    "[Research Navigator TEST] Set Zotero.ResearchNavigator directly",
  );
}

console.log("[Research Navigator TEST] Minimal test version loaded");

// Export
export { testAddon as addon };
