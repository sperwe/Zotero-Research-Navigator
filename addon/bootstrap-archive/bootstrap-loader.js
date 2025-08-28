/**
 * Bootstrap Loader for Research Navigator
 * This minimal loader loads the compiled TypeScript code
 */

// 等待 Zotero 初始化
async function waitForZotero() {
  if (typeof Zotero !== "undefined") {
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
    await new Promise((resolve) => {
      var listener = {
        onOpenWindow: function (aWindow) {
          let domWindow = aWindow
            .QueryInterface(Ci.nsIInterfaceRequestor)
            .getInterface(Ci.nsIDOMWindow);
          domWindow.addEventListener(
            "load",
            function () {
              domWindow.removeEventListener("load", arguments.callee, false);
              if (domWindow.Zotero) {
                Services.wm.removeListener(listener);
                Zotero = domWindow.Zotero;
                resolve();
              }
            },
            false,
          );
        },
      };
      Services.wm.addListener(listener);
    });
  }
}

// 创建一个作用域对象来存储加载的函数
var loadedFunctions = {};

// Bootstrap 函数
async function startup({ id, version, rootURI }, reason) {
  await waitForZotero();

  try {
    // 创建一个沙箱作用域
    var scope = {
      Zotero: Zotero,
      Services: Services,
      window: {},
    };

    // 加载编译后的 TypeScript 代码
    Services.scriptloader.loadSubScript(
      rootURI + "bootstrap-compiled.js",
      scope,
    );

    // 保存加载的函数
    if (scope.window) {
      loadedFunctions = scope.window;
    }

    // 调用真正的 startup
    if (loadedFunctions.startup) {
      await loadedFunctions.startup({ id, version, rootURI }, reason);
    } else {
      throw new Error("Startup function not found in compiled code");
    }
  } catch (error) {
    Zotero.logError(error);
    Services.prompt.alert(
      null,
      "Research Navigator",
      "Failed to load: " + error.message,
    );
  }
}

async function shutdown(data, reason) {
  if (loadedFunctions.shutdown) {
    await loadedFunctions.shutdown(data, reason);
  }
}

function install(data, reason) {
  if (loadedFunctions.install) {
    loadedFunctions.install(data, reason);
  }
}

function uninstall(data, reason) {
  if (loadedFunctions.uninstall) {
    loadedFunctions.uninstall(data, reason);
  }
}
