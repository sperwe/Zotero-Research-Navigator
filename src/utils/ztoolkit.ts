import { ZoteroToolkit } from "zotero-plugin-toolkit";
import { config } from "../../package.json";

export function createZToolkit() {
  // 直接尝试创建，如果失败则返回 mock
  try {
    const _ztoolkit = new ZoteroToolkit();
    initZToolkit(_ztoolkit);
    return _ztoolkit;
  } catch (error) {
    // 返回最小 mock
    return createMinimalZToolkit();
  }
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

// 创建最小的 ztoolkit mock
function createMinimalZToolkit(): any {
  const log = (message: string, type?: string) => {
    if (typeof Zotero !== 'undefined' && Zotero.debug) {
      Zotero.debug(`[${config.addonName}] ${message}`);
    }
  };
  
  return {
    log,
    basicOptions: {
      log: {
        prefix: `[${config.addonName}]`,
        disableConsole: true
      },
      api: {
        pluginID: config.addonID
      }
    },
    UI: {
      basicOptions: {
        ui: {
          enableElementJSONLog: false,
          enableElementDOMLog: false
        }
      },
      createElement: (doc: Document, tagName: string, props?: any) => {
        const elem = doc.createElement(tagName);
        if (props?.id) elem.id = props.id;
        if (props?.className) elem.className = props.className;
        if (props?.styles) {
          Object.assign(elem.style, props.styles);
        }
        if (props?.children) {
          // Simple children support
          props.children.forEach((child: any) => {
            if (typeof child === 'string') {
              elem.appendChild(doc.createTextNode(child));
            } else if (child.tag) {
              const childElem = createMinimalZToolkit().UI.createElement(doc, child.tag, child);
              elem.appendChild(childElem);
            }
          });
        }
        if (props?.listeners) {
          props.listeners.forEach((listener: any) => {
            elem.addEventListener(listener.type, listener.listener);
          });
        }
        return elem;
      },
      appendElement: (props: any, parent: Element) => {
        const elem = createMinimalZToolkit().UI.createElement(parent.ownerDocument, props.tag, props);
        parent.appendChild(elem);
        return elem;
      }
    },
    Menu: {
      register: (menuId: string, options: any) => {
        log(`Menu.register called for ${menuId}`);
      }
    },
    Keyboard: {
      register: (callback: Function) => {
        log('Keyboard.register called');
      }
    },
    ProgressWindow: {
      setIconURI: () => {}
    },
    getGlobal: (name: string) => {
      return (globalThis as any)[name];
    }
  };
}