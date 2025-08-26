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
    assets: ["addon/**/*.*"],
    define: {
      ...pkg.config,
      author: pkg.author,
      description: pkg.description,
      homepage: pkg.homepage,
      buildVersion: pkg.version,
      buildTime: "{{buildTime}}",
    },
    prefs: {
      prefix: pkg.config.prefsPrefix,
    },
    esbuildOptions: [
      {
        entryPoints: ["src/index.ts"],
        define: {
          __env__: `"${process.env.NODE_ENV || "development"}"`,
        },
        bundle: true,
        target: "firefox115",
        outfile: `build/addon/content/scripts/${pkg.config.addonRef}.js`,
      },
    ],
  },

  test: {
    waitForPlugin: `() => Zotero.${pkg.config.addonInstance}.data.initialized`,
  },

  // For debugging
  logLevel: "info",
});