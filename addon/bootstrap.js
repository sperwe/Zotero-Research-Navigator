/**
 * Bootstrap module for Zotero Research Navigator
 * Based on zotero-plugin-template
 */

/* global Services, Components, ChromeUtils */

if (typeof Services === 'undefined') {
  // eslint-disable-next-line no-var
  var { Services } = ChromeUtils.import('resource://gre/modules/Services.jsm');
}

var chromeHandle;

// 定义常量（如果尚未定义）
if (typeof ADDON_DISABLE === 'undefined') {
  // eslint-disable-next-line no-var
  var ADDON_DISABLE = 4;
  // eslint-disable-next-line no-var
  var APP_SHUTDOWN = 2;
}

function log(msg) {
  Services.console.logStringMessage('[Research Navigator] ' + msg);
}

function install() {
  log('install() called');
}

async function startup({ id, version, resourceURI, rootURI }, reason) {
  log('startup() called with reason: ' + reason);
  
  // Register chrome
  var aomStartup = Components.classes[
    "@mozilla.org/addons/addon-manager-startup;1"
  ].getService(Components.interfaces.amIAddonManagerStartup);
  var manifestURI = Services.io.newURI(rootURI + "manifest.json");
  chromeHandle = aomStartup.registerChrome(manifestURI, [
    ["content", "researchnavigator", rootURI + "content/"],
  ]);

  // Global variables for plugin code
  const ctx = { 
    rootURI,
    Zotero: Zotero,
    Services: Services,
    console: Services.console
  };
  ctx._globalThis = ctx;

  // Load main script
  Services.scriptloader.loadSubScript(
    `${rootURI}/content/scripts/researchnavigator.js`,
    ctx,
  );
  
  // Initialize plugin - 检查是否成功加载
  if (Zotero.ResearchNavigator && Zotero.ResearchNavigator.hooks) {
    log('Plugin loaded successfully, calling onStartup');
    await Zotero.ResearchNavigator.hooks.onStartup();
  } else {
    log('ERROR: Plugin failed to load properly!');
    // 尝试从 ctx 中获取
    if (ctx.Zotero && ctx.Zotero.ResearchNavigator) {
      log('Found plugin in context, copying to global Zotero');
      Zotero.ResearchNavigator = ctx.Zotero.ResearchNavigator;
      if (Zotero.ResearchNavigator.hooks) {
        await Zotero.ResearchNavigator.hooks.onStartup();
      }
    }
  }
}

async function onMainWindowLoad({ window }, reason) {
  log('onMainWindowLoad() called');
  if (Zotero.ResearchNavigator && Zotero.ResearchNavigator.hooks) {
    await Zotero.ResearchNavigator.hooks.onMainWindowLoad(window);
  } else {
    log('ERROR: Plugin not available in onMainWindowLoad');
  }
}

async function onMainWindowUnload({ window }, reason) {
  log('onMainWindowUnload() called');
  if (Zotero.ResearchNavigator && Zotero.ResearchNavigator.hooks) {
    await Zotero.ResearchNavigator.hooks.onMainWindowUnload(window);
  }
}

async function shutdown({ id, version, resourceURI, rootURI }, reason) {
  log('shutdown() called with reason: ' + reason);
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
  log('uninstall() called');
}