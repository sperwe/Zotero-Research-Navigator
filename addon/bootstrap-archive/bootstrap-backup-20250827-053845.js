/**
 * Debug version of bootstrap.js with enhanced logging
 */

/* global Services, Components, ChromeUtils */

if (typeof Services === "undefined") {
  var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
}

var chromeHandle;
var addonInstance;

// Constants
if (typeof ADDON_DISABLE === "undefined") {
  var ADDON_DISABLE = 4;
  var APP_SHUTDOWN = 2;
}

function log(msg) {
  Services.console.logStringMessage("[Research Navigator DEBUG] " + msg);
  // Also try Zotero.debug if available
  if (typeof Zotero !== "undefined" && Zotero.debug) {
    Zotero.debug("[Research Navigator DEBUG] " + msg);
  }
}

function install() {
  log("install() called");
}

async function startup({ id, version, resourceURI, rootURI }, reason) {
  log("=== STARTUP BEGIN ===");
  log("startup() called with reason: " + reason);
  log("rootURI: " + rootURI);

  // Register chrome
  try {
    var aomStartup = Components.classes[
      "@mozilla.org/addons/addon-manager-startup;1"
    ].getService(Components.interfaces.amIAddonManagerStartup);
    var manifestURI = Services.io.newURI(rootURI + "manifest.json");
    chromeHandle = aomStartup.registerChrome(manifestURI, [
      ["content", "researchnavigator", rootURI + "content/"],
    ]);
    log("Chrome registered successfully");
  } catch (e) {
    log("ERROR registering chrome: " + e);
    return;
  }

  // Create execution context
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
        log("Console ERROR: " + msg);
      },
      warn: function (msg) {
        log("Console WARN: " + msg);
      },
      debug: function (msg) {
        log("Console DEBUG: " + msg);
      },
    },
  };

  // Critical: Set up globalThis
  ctx.globalThis = ctx;
  log("Context created with ctx.globalThis = ctx");

  // Load main script
  const scriptPath = `${rootURI}/content/scripts/researchnavigator.js`;
  log("Loading script from: " + scriptPath);

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

  // Debug: List all properties on ctx
  log("=== Context properties after script load ===");
  try {
    const props = Object.keys(ctx);
    props.forEach((prop) => {
      if (prop !== "globalThis") {
        // Avoid circular reference in logging
        log("ctx." + prop + " = " + typeof ctx[prop]);
      }
    });
  } catch (e) {
    log("Error listing ctx properties: " + e);
  }

  // Look for addon instance
  log("=== Looking for addon instance ===");

  // Check ctx.addon
  if (ctx.addon) {
    log("✓ Found ctx.addon");
    addonInstance = ctx.addon;
  }

  // Check ctx._globalThis.addon
  if (!addonInstance && ctx._globalThis && ctx._globalThis.addon) {
    log("✓ Found ctx._globalThis.addon");
    addonInstance = ctx._globalThis.addon;
  }

  // Check ctx.globalThis.addon
  if (!addonInstance && ctx.globalThis && ctx.globalThis.addon) {
    log("✓ Found ctx.globalThis.addon");
    addonInstance = ctx.globalThis.addon;
  }

  if (addonInstance) {
    log("=== Addon instance found! ===");
    log("Has hooks: " + !!addonInstance.hooks);
    log("Has data: " + !!addonInstance.data);
    log("Has modules: " + !!addonInstance.modules);

    // CRITICAL: Register to Zotero
    log("Registering as Zotero.ResearchNavigator...");
    try {
      Zotero.ResearchNavigator = addonInstance;
      log("✓ Successfully set Zotero.ResearchNavigator");

      // Verify it was set
      log(
        "Verification: typeof Zotero.ResearchNavigator = " +
          typeof Zotero.ResearchNavigator,
      );

      // Also try setting on window.Zotero if different
      if (
        typeof window !== "undefined" &&
        window.Zotero &&
        window.Zotero !== Zotero
      ) {
        window.Zotero.ResearchNavigator = addonInstance;
        log("Also set window.Zotero.ResearchNavigator");
      }
    } catch (e) {
      log("ERROR setting Zotero.ResearchNavigator: " + e);
    }

    // Call startup hook
    if (addonInstance.hooks && addonInstance.hooks.onStartup) {
      log("Calling onStartup hook...");
      try {
        await addonInstance.hooks.onStartup();
        log("✓ onStartup completed successfully");
      } catch (e) {
        log("ERROR in onStartup: " + e.toString());
        log("Stack: " + (e.stack || "No stack"));
      }
    } else {
      log("WARNING: No onStartup hook found");
    }
  } else {
    log("=== ERROR: Addon instance NOT FOUND! ===");
    log("Checked: ctx.addon, ctx._globalThis.addon, ctx.globalThis.addon");
  }

  log("=== STARTUP END ===");
}

async function onMainWindowLoad({ window }, reason) {
  log("=== MAIN WINDOW LOAD BEGIN ===");
  log(
    "Window location: " +
      (window && window.location ? window.location.href : "unknown"),
  );

  // Double-check Zotero.ResearchNavigator
  log("Zotero.ResearchNavigator check: " + typeof Zotero.ResearchNavigator);

  if (!addonInstance) {
    log("ERROR: No addon instance available");

    // Try to recover it from Zotero
    if (Zotero.ResearchNavigator) {
      log("Recovering addon instance from Zotero.ResearchNavigator");
      addonInstance = Zotero.ResearchNavigator;
    } else {
      log("ERROR: Cannot recover addon instance");
      return;
    }
  }

  if (
    addonInstance &&
    addonInstance.hooks &&
    addonInstance.hooks.onMainWindowLoad
  ) {
    try {
      log("Calling onMainWindowLoad hook...");
      await addonInstance.hooks.onMainWindowLoad(window);
      log("✓ onMainWindowLoad completed");
    } catch (e) {
      log("ERROR in onMainWindowLoad: " + e.toString());
      log("Stack: " + (e.stack || "No stack"));
    }
  } else {
    log("WARNING: No onMainWindowLoad hook available");
  }

  log("=== MAIN WINDOW LOAD END ===");
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

  if (addonInstance && addonInstance.hooks && addonInstance.hooks.onShutdown) {
    try {
      await addonInstance.hooks.onShutdown();
    } catch (e) {
      log("ERROR in onShutdown: " + e.toString());
    }
  }

  addonInstance = null;
  if (Zotero.ResearchNavigator) {
    delete Zotero.ResearchNavigator;
  }

  if (chromeHandle) {
    chromeHandle.destruct();
    chromeHandle = null;
  }
}

async function uninstall(data, reason) {
  log("uninstall() called");
}
