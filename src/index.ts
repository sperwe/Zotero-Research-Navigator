/**
 * Research Navigator - Main Entry Point
 * Zotero插件主入口文件
 */

// 立即输出到控制台
if (typeof console !== 'undefined') {
  console.log("[Research Navigator] index.ts loading...");
}

import { BasicTool } from "zotero-plugin-toolkit";
import Addon from "./addon";
import { config } from "../package.json";

// 确认导入成功
if (typeof console !== 'undefined') {
  console.log("[Research Navigator] imports completed, config:", config);
}

const basicTool = new BasicTool();

if (!basicTool.getGlobal("Zotero")[config.addonInstance]) {
  console.log("[Research Navigator] Creating addon instance");
  _globalThis.addon = new Addon();
  defineGlobal("addon");
  defineGlobal("ztoolkit", () => {
    return _globalThis.addon.data.ztoolkit;
  });
  basicTool.getGlobal("Zotero")[config.addonInstance] = addon;
  console.log("[Research Navigator] Addon registered as:", config.addonInstance);
} else {
  console.log("[Research Navigator] Addon already exists");
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