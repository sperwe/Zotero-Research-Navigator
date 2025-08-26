import { initializeUI } from "./modules/ui";
import { HistoryTracker } from "./modules/historyTracker";
import { SearchEngine } from "./modules/searchEngine";

let historyTracker: HistoryTracker;
let searchEngine: SearchEngine;

async function onStartup() {
  await Zotero.initializationPromise;

  ztoolkit.log("[Research Navigator] Startup");
  
  // 初始化核心模块
  historyTracker = new HistoryTracker();
  searchEngine = new SearchEngine();
  
  addon.data.initialized = true;
}

async function onMainWindowLoad(win: Window): Promise<void> {
  ztoolkit.log("[Research Navigator] Main window loaded");
  
  // 初始化UI
  await initializeUI(win, historyTracker, searchEngine);
}

async function onMainWindowUnload(_win: Window): Promise<void> {
  ztoolkit.log("[Research Navigator] Main window unloaded");
  // 清理UI相关资源
}

function onShutdown(): void {
  ztoolkit.log("[Research Navigator] Shutdown");
  
  // 清理资源
  if (historyTracker) {
    historyTracker.destroy();
  }
  
  addon.data.initialized = false;
  
  // 移除所有UI元素
  ztoolkit.unregisterAll();
}

/**
 * This function is just an example of dispatcher for Preference UI events.
 * Any operations should be placed in a function to keep this funcion clear.
 * @param type event type
 * @param data event data
 */
async function onPrefsEvent(type: string, _data: { [key: string]: any }) {
  switch (type) {
    case "load":
      ztoolkit.log("[Research Navigator] Prefs window loaded");
      break;
    default:
      return;
  }
}

export default {
  onStartup,
  onMainWindowLoad,
  onMainWindowUnload,
  onShutdown,
  onPrefsEvent,
};