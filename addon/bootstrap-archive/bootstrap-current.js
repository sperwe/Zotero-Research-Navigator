/**
 * Bootstrap module for Zotero Research Navigator
 * Fixed version with better error handling
 */

/* global Services, Components, ChromeUtils */

if (typeof Services === "undefined") {
  // eslint-disable-next-line no-var
  var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
}

var chromeHandle;
var addonInstance;

// 定义常量（如果尚未定义）
if (typeof ADDON_DISABLE === "undefined") {
  // eslint-disable-next-line no-var
  var ADDON_DISABLE = 4;
  // eslint-disable-next-line no-var
  var APP_SHUTDOWN = 2;
}

function log(msg) {
  Services.console.logStringMessage("[Research Navigator] " + msg);
}

function install() {
  log("install() called");
}

async function startup({ id, version, resourceURI, rootURI }, reason) {
  log("startup() called with reason: " + reason);

  // Register chrome
  var aomStartup = Components.classes[
    "@mozilla.org/addons/addon-manager-startup;1"
  ].getService(Components.interfaces.amIAddonManagerStartup);
  var manifestURI = Services.io.newURI(rootURI + "manifest.json");
  chromeHandle = aomStartup.registerChrome(manifestURI, [
    ["content", "researchnavigator", rootURI + "content/"],
  ]);

  // Create a proper execution context
  const ctx = {
    Zotero: Zotero,
    Services: Services,
    ChromeUtils: ChromeUtils,
    Components: Components,
    console: {
      log: function (msg) {
        log("Console: " + msg);
      },
      error: function (msg) {
        log("ERROR: " + msg);
      },
      warn: function (msg) {
        log("WARN: " + msg);
      },
      debug: function (msg) {
        log("DEBUG: " + msg);
      },
    },
  };

  // Make ctx available as globalThis in the script
  ctx.globalThis = ctx;

  // Load main script
  const scriptPath = `${rootURI}/content/scripts/researchnavigator.js`;
  log("Attempting to load script from: " + scriptPath);

  try {
    Services.scriptloader.loadSubScriptWithOptions(scriptPath, {
      target: ctx,
      ignoreCache: true,
    });
    log("Script loaded successfully");
  } catch (e) {
    log("ERROR loading script: " + e.toString());
    log("Stack: " + (e.stack || "No stack trace"));
    return;
  }

  // Look for addon instance in various places
  log("Looking for addon instance...");
  addonInstance = ctx.addon || ctx.globalThis?.addon || ctx.addonInstance;

  if (!addonInstance) {
    // Try to find it on Zotero object
    const addonName = "ResearchNavigator";
    if (Zotero[addonName]) {
      addonInstance = Zotero[addonName];
      log("Found addon instance on Zotero." + addonName);
    }
  }

  if (addonInstance) {
    log("Addon instance found!");
    // Ensure it's available globally
    Zotero.ResearchNavigator = addonInstance;

    // Call startup hook if available
    if (addonInstance.hooks && addonInstance.hooks.onStartup) {
      log("Calling onStartup hook");
      try {
        await addonInstance.hooks.onStartup();
        log("onStartup completed successfully");
      } catch (e) {
        log("ERROR in onStartup: " + e.toString());
        log("Stack: " + (e.stack || "No stack"));
      }
    } else {
      log("No onStartup hook found");
    }
  } else {
    log("ERROR: Addon instance not found!");
    log(
      "Checked locations: ctx.addon, ctx.globalThis.addon, Zotero.ResearchNavigator",
    );

    // List all properties on ctx for debugging
    try {
      const props = Object.keys(ctx).join(", ");
      log("Available ctx properties: " + props);
    } catch (e) {
      log("Could not list ctx properties");
    }
  }
}

async function onMainWindowLoad({ window }, reason) {
  log("onMainWindowLoad() called");
  if (
    addonInstance &&
    addonInstance.hooks &&
    addonInstance.hooks.onMainWindowLoad
  ) {
    try {
      await addonInstance.hooks.onMainWindowLoad(window);
    } catch (e) {
      log("ERROR in onMainWindowLoad: " + e.toString());
    }
  } else {
    log("No addon instance or onMainWindowLoad hook available");
  }
}

async function onMainWindowUnload({ window }, reason) {
  log("onMainWindowUnload() called");
  if (
    addonInstance &&
    addonInstance.hooks &&
    addonInstance.hooks.onMainWindowUnload
  ) {
    try {
      await addonInstance.hooks.onMainWindowUnload(window);
    } catch (e) {
      log("ERROR in onMainWindowUnload: " + e.toString());
    }
  }
}

async function shutdown({ id, version, resourceURI, rootURI }, reason) {
  log("shutdown() called with reason: " + reason);
  if (reason === APP_SHUTDOWN) {
    return;
  }

  // Shutdown plugin
  if (addonInstance && addonInstance.hooks && addonInstance.hooks.onShutdown) {
    try {
      await addonInstance.hooks.onShutdown();
    } catch (e) {
      log("ERROR in onShutdown: " + e.toString());
    }
  }

  // Clear reference
  addonInstance = null;
  if (Zotero.ResearchNavigator) {
    delete Zotero.ResearchNavigator;
  }

  // Unregister chrome
  if (chromeHandle) {
    chromeHandle.destruct();
    chromeHandle = null;
  }
}

async function uninstall(data, reason) {
  log("uninstall() called");
}
