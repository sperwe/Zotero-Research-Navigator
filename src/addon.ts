import { ZoteroToolkit } from "zotero-plugin-toolkit";
import hooks from "./hooks";
import { config } from "../package.json";

class Addon {
  public data: {
    ztoolkit: ZoteroToolkit;
    locale?: {
      current: any;
    };
    prefs?: {
      window: Window | null;
    };
    initialized: boolean;
    config: typeof config;
  };
  
  // Lifecycle hooks
  public hooks: typeof hooks;

  constructor() {
    this.data = {
      ztoolkit: new ZoteroToolkit(),
      initialized: false,
      config: config,
    };
    this.hooks = hooks;
  }

  get ztoolkit() {
    return this.data.ztoolkit;
  }
}

export default Addon;