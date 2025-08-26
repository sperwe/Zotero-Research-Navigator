/**
 * Research Navigator - Main Entry Point
 * Zotero插件主入口文件
 */

// 最先导入初始化代码
import "./bootstrap-init";

import { setupConsolePolyfill } from "./polyfills/console";
import { BasicTool } from "zotero-plugin-toolkit";
import Addon from "./addon";
import { config } from "../package.json";

// 再次确保 console polyfill 被设置
setupConsolePolyfill();

const basicTool = new BasicTool();

if (!basicTool.getGlobal("Zotero")[config.addonInstance]) {
  _globalThis.addon = new Addon();
  defineGlobal("addon");
  defineGlobal("ztoolkit", () => {
    return _globalThis.addon.data.ztoolkit;
  });
  basicTool.getGlobal("Zotero")[config.addonInstance] = addon;
  
  // 使用 Zotero 的日志方法
  const Zotero = basicTool.getGlobal("Zotero");
  if (Zotero && Zotero.debug) {
    Zotero.debug("[Research Navigator] Addon instance created and registered");
  }
}

function defineGlobal(name: Parameters<BasicTool["getGlobal"]>[0]): void;
function defineGlobal(name: string, getter: () => any): void;
function defineGlobal(name: string, getter?: () => any) {
  Object.defineProperty(_globalThis, name, {
    get() {
      return getter ? getter() : basicTool.getGlobal(name);
    },
  });
}