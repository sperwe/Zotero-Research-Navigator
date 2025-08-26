/**
 * Zotero Research Navigator - Bootstrap
 * 主入口文件，管理插件生命周期
 */

/* global Components, Services */
Components.utils.import("resource://gre/modules/Services.jsm");

var ResearchNavigator;

function log(msg, level = 'info') {
  const prefix = '[Research Navigator]';
  if (level === 'error') {
    Zotero.debug(`${prefix} ${msg}`, 1);
    console.error(`${prefix} ${msg}`);
  } else {
    Zotero.debug(`${prefix} ${msg}`, 3);
    console.log(`${prefix} ${msg}`);
  }
}

async function waitForZotero() {
  if (typeof Zotero !== 'undefined' && Zotero.initializationPromise) {
    await Zotero.initializationPromise;
    return true;
  }
  
  let attempts = 0;
  const maxAttempts = 50;
  
  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 100));
    if (typeof Zotero !== 'undefined' && Zotero.initializationPromise) {
      await Zotero.initializationPromise;
      return true;
    }
    attempts++;
  }
  
  return false;
}

function loadResearchNavigator(context) {
  try {
    // 加载主脚本
    Services.scriptloader.loadSubScript(
      context.getResourceURI("index.js").spec,
      { Zotero }
    );
    
    if (typeof SimpleResearchNavigator !== 'undefined') {
      ResearchNavigator = new SimpleResearchNavigator();
      return true;
    }
  } catch (error) {
    log(`Failed to load main script: ${error}`, 'error');
  }
  return false;
}

// Zotero 7 兼容性
if (typeof onStartup === 'undefined') {
  // Bootstrap functions for Zotero 6
  var startup = async function(data, reason) {
    await waitForZotero();
    
    if (!loadResearchNavigator(data)) {
      log('Failed to initialize Research Navigator', 'error');
      return;
    }
    
    await ResearchNavigator.startup();
    log('Started successfully');
  };

  var shutdown = async function(data, reason) {
    if (ResearchNavigator && ResearchNavigator.shutdown) {
      await ResearchNavigator.shutdown();
      log('Shutdown complete');
    }
    ResearchNavigator = undefined;
  };

  var install = function(data, reason) {
    log('Installed');
  };

  var uninstall = function(data, reason) {
    log('Uninstalled');
  };
} else {
  // For Zotero 7+
  var onStartup = async ({ id, version, resourceURI, rootURI }, reason) => {
    await waitForZotero();
    
    const context = {
      getResourceURI: (path) => {
        return Services.io.newURI(rootURI + path, null, null);
      }
    };
    
    if (!loadResearchNavigator(context)) {
      log('Failed to initialize Research Navigator', 'error');
      return;
    }
    
    await ResearchNavigator.startup();
    log('Started successfully');
  };

  var onShutdown = async ({ id, version, resourceURI, rootURI }, reason) => {
    if (ResearchNavigator && ResearchNavigator.shutdown) {
      await ResearchNavigator.shutdown();
      log('Shutdown complete');
    }
    ResearchNavigator = undefined;
  };

  var onInstall = ({ id, version, resourceURI, rootURI }, reason) => {
    log('Installed');
  };

  var onUninstall = ({ id, version, resourceURI, rootURI }, reason) => {
    log('Uninstalled');
  };
}