/**
 * 基本的 bootstrap 测试
 * 验证插件是否能正常加载
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 模拟最小的 Zotero 环境
global.Zotero = {
  initialized: true,
  log: (msg, level) => console.log(`[${level || "info"}] ${msg}`),
  logError: (err) => console.error("[error]", err),
  getMainWindow: () => ({
    document: {
      getElementById: () => null,
      readyState: "complete",
    },
  }),
  getActiveZoteroPane: () => null,
  addShutdownListener: () => {},
  Prefs: { get: () => null, set: () => {} },
  DB: {
    queryAsync: async () => [],
    executeTransaction: async (fn) => await fn(),
  },
  Notifier: {
    registerObserver: () => "observer-id",
    unregisterObserver: () => {},
  },
  Items: { get: () => null, getAsync: async () => null },
  Libraries: { userLibraryID: 1 },
};

global.Services = {
  wm: {
    getEnumerator: () => ({ hasMoreElements: () => false }),
    addListener: () => {},
    removeListener: () => {},
  },
  prompt: { alert: () => {} },
  scriptloader: { loadSubScript: () => {} },
};

global.ChromeUtils = { import: () => ({ Services: global.Services }) };
global.Ci = {};

console.log("=== Basic Bootstrap Test ===\n");

// 测试加载 bootstrap-loader.js
try {
  const loaderPath = path.join(
    __dirname,
    "..",
    "build",
    "addon",
    "bootstrap.js",
  );
  const loaderCode = fs.readFileSync(loaderPath, "utf8");

  console.log(`✓ Found bootstrap.js (${loaderCode.length} bytes)`);

  // 检查是否包含必要的函数
  const hasStartup = loaderCode.includes("function startup");
  const hasShutdown = loaderCode.includes("function shutdown");
  const hasInstall = loaderCode.includes("function install");
  const hasUninstall = loaderCode.includes("function uninstall");

  console.log(`✓ Contains startup: ${hasStartup}`);
  console.log(`✓ Contains shutdown: ${hasShutdown}`);
  console.log(`✓ Contains install: ${hasInstall}`);
  console.log(`✓ Contains uninstall: ${hasUninstall}`);

  if (hasStartup && hasShutdown && hasInstall && hasUninstall) {
    console.log("\n✅ Bootstrap structure is valid!");
    process.exit(0);
  } else {
    console.log("\n❌ Bootstrap structure is invalid!");
    process.exit(1);
  }
} catch (error) {
  console.error("❌ Test failed:", error.message);
  process.exit(1);
}
