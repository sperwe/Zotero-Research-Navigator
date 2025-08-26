/* global Components */
'use strict';

// Zotero 7 compatibility
if (typeof Components !== 'undefined' && Components.utils) {
  Components.utils.import("resource://gre/modules/Services.jsm");
}

var ResearchNavigator;

function log(msg) {
  if (typeof Zotero !== 'undefined' && Zotero.debug) {
    Zotero.debug('[Research Navigator] ' + msg);
  }
}

// Bootstrap functions for Zotero 6 and 7
function install(data, reason) {
  log('Installing...');
}

function startup(data, reason) {
  log('Starting up...');
  
  // Wait for Zotero to be ready
  if (typeof Zotero === 'undefined') {
    log('Zotero not available yet');
    return;
  }
  
  Zotero.debug('[Research Navigator] Zotero is ready, initializing plugin...', 3);
  
  try {
    // Load the main script
    var scriptPath = 'chrome://research-navigator/content/index.js';
    
    if (typeof Services !== 'undefined' && Services.scriptloader) {
      Services.scriptloader.loadSubScript(scriptPath, {});
      log('Main script loaded successfully');
    } else {
      log('Services.scriptloader not available');
    }
    
    // Initialize the plugin if the class is available
    if (typeof SimpleResearchNavigator !== 'undefined') {
      ResearchNavigator = new SimpleResearchNavigator();
      ResearchNavigator.startup();
      log('Plugin initialized successfully');
    } else {
      log('SimpleResearchNavigator not found');
    }
  } catch (e) {
    log('Error during startup: ' + e);
    if (e.stack) {
      log('Stack trace: ' + e.stack);
    }
  }
}

function shutdown(data, reason) {
  log('Shutting down...');
  
  if (ResearchNavigator && typeof ResearchNavigator.shutdown === 'function') {
    try {
      ResearchNavigator.shutdown();
      log('Plugin shutdown successfully');
    } catch (e) {
      log('Error during shutdown: ' + e);
    }
  }
  
  ResearchNavigator = undefined;
}

function uninstall(data, reason) {
  log('Uninstalling...');
}