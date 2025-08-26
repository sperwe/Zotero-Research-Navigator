import { PluginInstance, UITool, ZoteroToolkit } from "zotero-plugin-toolkit";
import hooks from "./hooks";
import { config } from "../package.json";

class Addon implements PluginInstance {
  public data: {
    ztoolkit: ZoteroToolkit;
    locale?: {
      current: any;
    };
    prefs?: {
      window: Window | null;
    };
    initialized: boolean;
  };
  
  // Lifecycle hooks
  public hooks: typeof hooks;

  constructor() {
    this.data = {
      ztoolkit: new ZoteroToolkit(),
      initialized: false,
    };
    this.hooks = hooks;
  }

  get ztoolkit() {
    return this.data.ztoolkit;
  }
}

export default Addon;