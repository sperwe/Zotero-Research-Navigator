import { ZoteroToolkit } from "zotero-plugin-toolkit";
import { config } from "../../package.json";

export function createZToolkit() {
  const _ztoolkit = new ZoteroToolkit();
  initZToolkit(_ztoolkit);
  return _ztoolkit;
}

function initZToolkit(_ztoolkit: ZoteroToolkit) {
  const env = __env__;
  _ztoolkit.basicOptions.log.prefix = `[${config.addonName}]`;
  // 在 Zotero 环境中，console 不可用，所以总是禁用
  _ztoolkit.basicOptions.log.disableConsole = true;
  _ztoolkit.UI.basicOptions.ui.enableElementJSONLog = false;
  _ztoolkit.UI.basicOptions.ui.enableElementDOMLog = false;
  _ztoolkit.basicOptions.api.pluginID = config.addonID;
  _ztoolkit.ProgressWindow.setIconURI(
    "default",
    `chrome://${config.addonRef}/content/icons/favicon.png`,
  );
}