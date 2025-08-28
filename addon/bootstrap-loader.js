/**
 * Bootstrap Loader for Research Navigator
 * This minimal loader loads the compiled TypeScript code
 */

// 等待 Zotero 初始化
async function waitForZotero() {
  if (typeof Zotero !== 'undefined') {
    return;
  }

  var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
  var windows = Services.wm.getEnumerator("navigator:browser");
  var found = false;
  while (windows.hasMoreElements()) {
    let win = windows.getNext();
    if (win.Zotero) {
      Zotero = win.Zotero;
      found = true;
      break;
    }
  }
  if (!found) {
    await new Promise(resolve => {
      var listener = {
        onOpenWindow: function (aWindow) {
          let domWindow = aWindow.QueryInterface(Ci.nsIInterfaceRequestor)
            .getInterface(Ci.nsIDOMWindow);
          domWindow.addEventListener("load", function () {
            domWindow.removeEventListener("load", arguments.callee, false);
            if (domWindow.Zotero) {
              Services.wm.removeListener(listener);
              Zotero = domWindow.Zotero;
              resolve();
            }
          }, false);
        }
      };
      Services.wm.addListener(listener);
    });
  }
}

// Bootstrap 函数
async function startup({ id, version, rootURI }, reason) {
  await waitForZotero();
  
  // 加载编译后的 TypeScript 代码
  Services.scriptloader.loadSubScript(rootURI + "bootstrap.js", {
    startup,
    shutdown,
    install,
    uninstall
  });
  
  // 调用真正的 startup
  if (typeof window !== 'undefined' && window.startup) {
    await window.startup({ id, version, rootURI }, reason);
  }
}

function shutdown(data, reason) {
  if (typeof window !== 'undefined' && window.shutdown) {
    window.shutdown(data, reason);
  }
}

function install(data, reason) {
  if (typeof window !== 'undefined' && window.install) {
    window.install(data, reason);
  }
}

function uninstall(data, reason) {
  if (typeof window !== 'undefined' && window.uninstall) {
    window.uninstall(data, reason);
  }
}