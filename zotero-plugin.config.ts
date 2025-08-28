import { defineConfig } from "zotero-plugin-scaffold";
import pkg from "./package.json";

export default defineConfig({
  source: ["addon", "package.json"],
  dist: "build",
  name: pkg.config.addonName,
  id: pkg.config.addonID,
  namespace: pkg.config.addonRef,
  updateURL: undefined, // 明确设置为 undefined 以防止自动添加
  xpiDownloadLink:
    "https://github.com/sperwe/Zotero-Research-Navigator/releases/download/v{{version}}/{{xpiName}}.xpi",

  build: {
    makeManifest: {
      enable: false, // 禁用自动修改 manifest.json
    },
    assets: [
      "addon/**/*.*",
      "!addon/bootstrap-archive/**/*", // 排除 bootstrap-archive 目录
    ],
    define: {
      // 不使用任何占位符，避免替换问题
      __env__: `"${process.env.NODE_ENV || "development"}"`,
    },
    prefs: {
      prefix: pkg.config.prefsPrefix,
    },
    esbuildOptions: [
      {
        entryPoints: [process.env.DEBUG_BUILD ? "src/bootstrap-debug.ts" : "src/bootstrap.ts"],
        define: {
          __env__: `"${process.env.NODE_ENV || "development"}"`,
        },
        bundle: true,
        target: "firefox115",
        outfile: `build/addon/bootstrap-compiled.js`,
        format: "iife",
        banner: {
          js: `// Research Navigator Bootstrap\n// Auto-generated from TypeScript source\n`,
        },
      },
    ],
  },

  test: {
    waitForPlugin: `() => Zotero.${pkg.config.addonInstance}.data.initialized`,
  },

  // For debugging
  logLevel: "info",
});
