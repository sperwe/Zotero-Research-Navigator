const fs = require("fs");
const path = require("path");
const vm = require("vm");

// Mock Zotero environment
const mockZotero = {
  initialized: true,
  log: (msg, level) => console.log(`[${level || "info"}] ${msg}`),
  logError: (error) => console.error("[error]", error),
  debug: (msg) => console.log(`[debug] ${msg}`),
  getMainWindow: () => mockWindow,
  getActiveZoteroPane: () => ({
    itemsView: {
      onSelect: { addListener: () => {} },
    },
  }),
  addShutdownListener: () => {},
  DB: {
    queryAsync: async () => [],
    executeTransaction: async () => {},
  },
  Items: {
    getAsync: async () => [],
  },
  Notifier: {
    registerObserver: () => {},
  },
  Reader: {
    registerEventListener: () => {},
  },
  Prefs: {
    get: () => "",
    set: () => {},
  },
  ResearchNavigator: undefined, // This should be set by the plugin
};

// Mock window
const mockDocument = {
  createElement: (tag) => {
    console.log(`Creating element: ${tag}`);
    return {
      tagName: tag,
      setAttribute: (attr, value) => console.log(`  Set ${attr}="${value}"`),
      appendChild: (child) =>
        console.log(`  Appending child: ${child.tagName || child}`),
      addEventListener: () => {},
      style: {},
      classList: { add: () => {}, remove: () => {} },
    };
  },
  createXULElement: (tag) => {
    console.log(`Creating XUL element: ${tag}`);
    return {
      tagName: tag,
      setAttribute: (attr, value) => console.log(`  Set ${attr}="${value}"`),
      appendChild: (child) =>
        console.log(`  Appending child: ${child.tagName || child}`),
      addEventListener: () => {},
      style: {},
    };
  },
  getElementById: (id) => {
    console.log(`Looking for element with id: ${id}`);
    if (id === "zotero-tb-advanced-search") {
      return {
        parentNode: {
          insertBefore: (newNode, refNode) => {
            console.log(`✅ Toolbar button inserted!`);
          },
        },
      };
    }
    return null;
  },
  body: {
    appendChild: (child) => console.log(`Appending to body: ${child.tagName}`),
  },
  head: {
    appendChild: (child) => console.log(`Appending to head: ${child.tagName}`),
  },
  documentElement: {},
};

const mockWindow = {
  document: mockDocument,
  addEventListener: () => {},
  Zotero: mockZotero,
};

// Mock Services
const mockServices = {
  scriptloader: {
    loadSubScript: (url, scope) => {
      console.log(`\nLoading script: ${url}`);
      const scriptPath = url
        .replace("resource://zotero/", "")
        .replace("bootstrap-compiled.js", "build/addon/bootstrap-compiled.js");
      const scriptContent = fs.readFileSync(scriptPath, "utf8");

      // Create a context with the scope
      const context = vm.createContext(scope);

      // Run the script
      const script = new vm.Script(scriptContent, {
        filename: path.basename(scriptPath),
      });
      script.runInContext(context);

      console.log("Script loaded successfully");
    },
  },
  wm: {
    getEnumerator: () => ({
      hasMoreElements: () => true,
      getNext: () => mockWindow,
    }),
    addListener: () => {},
    removeListener: () => {},
  },
  prompt: {
    alert: (parent, title, message) => {
      console.error(`\n❌ ALERT: ${title}\n${message}\n`);
    },
  },
};

// Mock ChromeUtils
global.ChromeUtils = {
  import: () => ({ Services: mockServices }),
};

// Mock Components
global.Components = {
  utils: { import: () => ({}) },
};

global.Ci = {
  nsIInterfaceRequestor: {},
  nsIDOMWindow: {},
};

console.log("=== Testing Research Navigator Plugin UI ===\n");

// Load the bootstrap loader
const loaderPath = path.join(__dirname, "../build/addon/bootstrap.js");
console.log(`Loading bootstrap loader from: ${loaderPath}`);
const loaderContent = fs.readFileSync(loaderPath, "utf8");

// Execute the loader in a context
const loaderContext = vm.createContext({
  ChromeUtils: global.ChromeUtils,
  Components: global.Components,
  Services: mockServices,
  Ci: global.Ci,
  Zotero: mockZotero,
  window: {},
  console,
});

const loaderScript = new vm.Script(loaderContent, { filename: "bootstrap.js" });
loaderScript.runInContext(loaderContext);

// Get the exported functions
const { startup, shutdown } = loaderContext;

console.log("\nExported functions:", {
  startup: typeof startup,
  shutdown: typeof shutdown,
});

// Test startup
(async () => {
  try {
    console.log("\n=== Testing startup ===");
    await startup(
      {
        id: "research-navigator@zotero.org",
        version: "2.0.3",
        rootURI: "resource://zotero/",
      },
      "startup",
    );

    console.log("\n=== Checking results ===");
    console.log(
      "Zotero.ResearchNavigator exists?",
      !!mockZotero.ResearchNavigator,
    );
    console.log(
      "Zotero.ResearchNavigator type:",
      typeof mockZotero.ResearchNavigator,
    );

    if (mockZotero.ResearchNavigator) {
      console.log(
        "ResearchNavigator properties:",
        Object.keys(mockZotero.ResearchNavigator),
      );
    }
  } catch (error) {
    console.error("\n❌ Startup failed:", error);
    console.error(error.stack);
  }
})();
