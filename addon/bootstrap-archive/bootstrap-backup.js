/**
 * Bootstrap module for Zotero Research Navigator
 * Based on zotero-plugin-template
 */

/* global Services, Components, ChromeUtils */

if (typeof Services === "undefined") {
  // eslint-disable-next-line no-var
  var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
}

var chromeHandle;

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

  // Create a proper execution context with all globals
  const ctx = {
    window: {},
    document: {},
    _globalThis: null,
    globalThis: null,
    Zotero: Zotero,
    Services: Services,
    Components: Components,
    ChromeUtils: ChromeUtils,
    console: Services.console,
    _console: Services.console,
    rootURI: rootURI,
  };

  // Self references
  ctx._globalThis = ctx;
  ctx.globalThis = ctx;
  ctx.window = ctx;

  // CRITICAL: Ensure Zotero is available in globalThis to prevent recursion
  // This must be done BEFORE loading any scripts
  if (!ctx.globalThis.Zotero) {
    ctx.globalThis.Zotero = Zotero;
  }

  // Also ensure it's available as a direct property for BasicTool
  if (!ctx.Zotero) {
    ctx.Zotero = Zotero;
  }

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

  // The script should have created addon instance
  log("Checking for addon instance...");
  log("ctx.addon = " + (ctx.addon ? "exists" : "undefined"));
  log(
    "ctx._globalThis.addon = " +
      (ctx._globalThis && ctx._globalThis.addon ? "exists" : "undefined"),
  );

  // Try multiple locations where addon might be
  const addon =
    ctx.addon ||
    (ctx._globalThis && ctx._globalThis.addon) ||
    ctx.globalThis.addon;

  if (addon) {
    log("Addon instance found!");
    // Copy to global Zotero object
    Zotero.ResearchNavigator = addon;
    log("Addon registered to Zotero.ResearchNavigator");
  } else {
    log("ERROR: No addon instance found in any expected location");
  }

  // Initialize plugin
  if (Zotero.ResearchNavigator && Zotero.ResearchNavigator.hooks) {
    log("Plugin loaded successfully, calling onStartup");
    try {
      await Zotero.ResearchNavigator.hooks.onStartup();
      log("onStartup completed successfully");
    } catch (e) {
      log("ERROR in onStartup: " + e.toString());
      log("Stack: " + (e.stack || "No stack"));
    }
  } else {
    log("ERROR: Plugin failed to initialize properly!");
    log("Zotero.ResearchNavigator = " + Zotero.ResearchNavigator);
    log("Available properties in ctx: " + Object.keys(ctx).join(", "));
  }
}

async function onMainWindowLoad({ window }, reason) {
  log("onMainWindowLoad() called");
  if (Zotero.ResearchNavigator && Zotero.ResearchNavigator.hooks) {
    await Zotero.ResearchNavigator.hooks.onMainWindowLoad(window);
  } else {
    log("ERROR: Plugin not available in onMainWindowLoad");
  }
}

async function onMainWindowUnload({ window }, reason) {
  log("onMainWindowUnload() called");
  if (Zotero.ResearchNavigator && Zotero.ResearchNavigator.hooks) {
    await Zotero.ResearchNavigator.hooks.onMainWindowUnload(window);
  }
}

async function shutdown({ id, version, resourceURI, rootURI }, reason) {
  log("shutdown() called with reason: " + reason);
  if (reason === APP_SHUTDOWN) {
    return;
  }

  // Shutdown plugin
  if (Zotero.ResearchNavigator && Zotero.ResearchNavigator.hooks) {
    await Zotero.ResearchNavigator.hooks.onShutdown();
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
