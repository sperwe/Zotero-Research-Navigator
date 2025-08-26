import { ZoteroToolkit } from "zotero-plugin-toolkit";
import hooks from "./hooks";
import { config } from "../package.json";
import { createZToolkit } from "./utils/ztoolkit";

class Addon {
  public data: {
    alive: boolean;
    config: typeof config;
    env: "development" | "production";
    initialized: boolean;
    ztoolkit: ZoteroToolkit;
    locale?: {
      current: any;
    };
    prefs?: {
      window: Window | null;
    };
  };
  
  // Lifecycle hooks
  public hooks: typeof hooks;

  constructor() {
    this.data = {
      alive: true,
      config: config,
      env: __env__,
      initialized: false,
      ztoolkit: createZToolkit(),
    };
    this.hooks = hooks;
  }

  get ztoolkit() {
    return this.data.ztoolkit;
  }
}

export default Addon;