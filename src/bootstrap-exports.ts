/**
 * Bootstrap exports for Zotero plugin
 * 这个文件确保 bootstrap 函数在全局作用域中可用
 */

import {
  startup,
  shutdown,
  uninstall,
  onMainWindowLoad,
  onMainWindowUnload,
} from "./core/bootstrap";

// 将函数导出到全局作用域
// 这是必需的，因为 Zotero 需要在 Sandbox 的全局作用域中找到这些函数
(globalThis as any).startup = startup;
(globalThis as any).shutdown = shutdown;
(globalThis as any).uninstall = uninstall;
(globalThis as any).onMainWindowLoad = onMainWindowLoad;
(globalThis as any).onMainWindowUnload = onMainWindowUnload;

// 为了调试，记录导出状态
if (typeof Zotero !== "undefined" && Zotero.debug) {
  Zotero.debug(
    "[Research Navigator] Bootstrap functions exported to global scope",
  );
  Zotero.debug(
    `[Research Navigator] - startup: ${typeof (globalThis as any).startup}`,
  );
  Zotero.debug(
    `[Research Navigator] - onMainWindowLoad: ${typeof (globalThis as any).onMainWindowLoad}`,
  );
}
