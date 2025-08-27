/* global dump, Components, Services */

dump("\n\n=== Research Navigator MINIMAL TEST ===\n");
dump("Bootstrap.js loading...\n");

var chromeHandle;

function log(msg) {
  dump("[RN-MIN] " + msg + "\n");
  
  // Try multiple logging methods
  try {
    Services.console.logStringMessage("[RN-MIN] " + msg);
  } catch (e) {}
  
  try {
    if (typeof Zotero !== 'undefined' && Zotero.debug) {
      Zotero.debug("[RN-MIN] " + msg);
    }
  } catch (e) {}
}

function install() {
  log("install() called");
}

async function startup({ id, version, rootURI }, reason) {
  log("=== STARTUP BEGIN ===");
  log("ID: " + id);
  log("Version: " + version);
  log("RootURI: " + rootURI);
  log("Reason: " + reason);
  
  try {
    // Register chrome
    log("Registering chrome...");
    const aomStartup = Components.classes[
      "@mozilla.org/addons/addon-manager-startup;1"
    ].getService(Components.interfaces.amIAddonManagerStartup);
    const manifestURI = Services.io.newURI(rootURI + "manifest.json");
    chromeHandle = aomStartup.registerChrome(manifestURI, [
      ["content", "researchnavigator", rootURI + "content/"],
    ]);
    log("Chrome registered");
  } catch (e) {
    log("ERROR registering chrome: " + e);
  }
  
  // Test Zotero availability
  log("Testing Zotero availability...");
  log("typeof Zotero: " + (typeof Zotero));
  log("typeof Services: " + (typeof Services));
  log("typeof Components: " + (typeof Components));
  
  if (typeof Zotero !== 'undefined') {
    log("Zotero is available!");
    
    // Set a test property
    Zotero.ResearchNavigatorTest = {
      loaded: true,
      version: version,
      message: "Minimal test loaded successfully"
    };
    log("Set Zotero.ResearchNavigatorTest");
    
    // Try to set a pref
    try {
      Zotero.Prefs.set("extensions.researchnavigator.minimal.loaded", true);
      log("Set preference successfully");
    } catch (e) {
      log("Error setting preference: " + e);
    }
  } else {
    log("ERROR: Zotero is not available!");
  }
  
  log("=== STARTUP END ===");
}

async function onMainWindowLoad({ window }, reason) {
  log("=== MAIN WINDOW LOAD BEGIN ===");
  log("Window: " + (window ? "exists" : "null"));
  
  if (window) {
    log("Window location: " + window.location.href);
    log("Document ready state: " + window.document.readyState);
    
    // Method 1: Simple alert button
    try {
      const btn = window.document.createElement("button");
      btn.textContent = "RN-MIN TEST";
      btn.style.cssText = "position: fixed; top: 10px; right: 10px; z-index: 999999; background: red; color: white; padding: 10px;";
      btn.onclick = function() {
        window.alert("Research Navigator Minimal is working!");
      };
      
      // Try multiple insertion points
      if (window.document.body) {
        window.document.body.appendChild(btn);
        log("Added button to body");
      } else {
        window.document.documentElement.appendChild(btn);
        log("Added button to documentElement");
      }
    } catch (e) {
      log("Error adding button: " + e);
    }
    
    // Method 2: Menu item
    try {
      const menuTools = window.document.getElementById("menu_ToolsPopup");
      if (menuTools) {
        const menuitem = window.document.createXULElement
          ? window.document.createXULElement("menuitem")
          : window.document.createElement("menuitem");
        
        menuitem.setAttribute("label", "RN Minimal Test");
        menuitem.addEventListener("command", function() {
          window.alert("Menu item clicked!");
        });
        
        menuTools.appendChild(menuitem);
        log("Added menu item");
      } else {
        log("Tools menu not found");
      }
    } catch (e) {
      log("Error adding menu: " + e);
    }
    
    // Method 3: Direct Zotero alert
    try {
      window.setTimeout(function() {
        if (window.Zotero && window.Zotero.alert) {
          window.Zotero.alert(null, "Research Navigator", "Minimal test loaded - delayed alert");
        }
      }, 3000);
      log("Scheduled delayed alert");
    } catch (e) {
      log("Error scheduling alert: " + e);
    }
  }
  
  log("=== MAIN WINDOW LOAD END ===");
}

function shutdown({ id, version, rootURI }, reason) {
  log("shutdown() called, reason: " + reason);
  
  if (chromeHandle) {
    chromeHandle.destruct();
    chromeHandle = null;
  }
  
  if (typeof Zotero !== 'undefined' && Zotero.ResearchNavigatorTest) {
    delete Zotero.ResearchNavigatorTest;
  }
}

function uninstall(data, reason) {
  log("uninstall() called");
}

log("Bootstrap.js loaded successfully");
log("Functions defined: startup=" + (typeof startup) + ", onMainWindowLoad=" + (typeof onMainWindowLoad));