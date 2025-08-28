/**
 * 全局类型定义
 */

declare namespace XUL {
  interface ToolBarButton extends HTMLElement {
    id: string;
    className: string;
  }

  interface MenuPopup extends HTMLElement {
    id: string;
  }
}

declare namespace Zotero {
  interface Item {
    id: number;
    libraryID: number;
    itemType: string;
    isNote(): boolean;
    isAttachment(): boolean;
    isRegularItem(): boolean;
    getNoteTitle(): string;
    getNote(): string;
    setNote(content: string): void;
    getField(field: string): string;
    getAttachments(): number[];
    parentID?: number;
    saveTx(): Promise<void>;
    addTag(tag: string): void;
    attachmentReaderType?: string;
  }

  const Items: {
    get(id: number | number[]): Item | Item[];
    getAsync(id: number): Promise<Item>;
  };

  const Libraries: {
    userLibraryID: number;
  };

  const DB: {
    queryAsync(sql: string, params?: any[]): Promise<any[]>;
  };

  const Notifier: {
    registerObserver(observer: any, types: string[], id: string): string;
    unregisterObserver(id: string): void;
  };

  const Reader: {
    open(itemID: number): Promise<void>;
  };

  const Prefs: {
    get(pref: string): any;
    set(pref: string, value: any): void;
  };

  function getString(key: string, params?: any): string;
  function logError(error: any): void;
  function log(message: string, level?: string): void;
  function getMainWindow(): Window;
  function getActiveZoteroPane(): any;
  function addShutdownListener(fn: Function): void;
}

interface Window {
  openDialog(
    url: string,
    name: string,
    features: string,
    ...args: any[]
  ): Window;
  Zotero?: typeof Zotero;
}

declare const Services: {
  wm: {
    getEnumerator(type: string): any;
    addListener(listener: any): void;
    removeListener(listener: any): void;
    getMostRecentWindow(type: string): Window;
  };
  prompt: {
    alert(parent: any, title: string, message: string): void;
  };
  scriptloader: {
    loadSubScript(url: string, scope?: any): void;
  };
};

declare const Ci: {
  nsIInterfaceRequestor: any;
  nsIDOMWindow: any;
};
