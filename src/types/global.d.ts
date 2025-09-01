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
    isTopLevelItem(): boolean;
    getNoteTitle(): string;
    getNote(): string;
    setNote(content: string): void;
    getField(field: string): string;
    getAttachments(): number[];
    getNotes(): number[];
    parentID?: number;
    parentItemID?: number;
    saveTx(): Promise<void>;
    addTag(tag: string): void;
    removeTag(tag: string): void;
    attachmentReaderType?: string;
    dateModified: Date | string;
    deleted?: boolean;
    eraseTx(): Promise<void>;
    getCreators(): any[];
    getTags(): { tag: string }[];
    getCollections(): number[];
    relatedItems: string[];
    getDisplayTitle(): string;
    getBestAttachment?(): Promise<Item | null>;
    getBestAttachments?(): Promise<Item[]>;
    isPDFAttachment?(): boolean;
  }

  const Items: {
    get(id: number | number[]): Item | Item[];
    getAsync(id: number): Promise<Item>;
    getAll?(libraryID: number): Promise<Item[]>;
    getByLibraryAndKey?(libraryID: number, key: string): Promise<Item | null>;
  };

  const Libraries: {
    userLibraryID: number;
    get?(id: number): any;
  };

  const DB: {
    queryAsync(sql: string, params?: any[]): Promise<any[]>;
  };

  const Notifier: {
    registerObserver(observer: any, types: string[], id?: string): string;
    unregisterObserver(id: string): void;
  };

  const Reader: {
    open(itemID: number): Promise<void>;
    getByTabID?(tabID: string): any;
  };

  const Prefs: {
    get(pref: string, global?: boolean): any;
    set(pref: string, value: any): void;
  };

  function getString(key: string, params?: any): string;
  function logError(error: any): void;
  function log(message: string, level?: string): void;
  function getMainWindow(): Window;
  function getActiveZoteroPane(): any;
  function addShutdownListener(fn: Function): void;
  
  // Additional missing types
  let initialized: boolean | undefined;
  let version: string | undefined;
  let platform: string | undefined;
  let debug: ((message: string) => void) | undefined;
  
  let ResearchNavigator: any;
  
  const Item: new (type: string) => Item;
  
  const ProgressWindow: new () => {
    show(): void;
    close(): void;
    changeHeadline(text: string): void;
    startCloseTimer(ms: number): void;
    addDescription(text: string): void;
    addLines(lines: string[], icons?: string[]): void;
  };
  
  const Search: new () => {
    libraryID?: number;
    addCondition(condition: string, operator: string, value: any): void;
    search(): Promise<number[]>;
  };
  
  let Session: {
    state?: {
      windows?: Array<{
        tabs?: any[];
      }>;
    };
  } | undefined;
  
  let Users: {
    getCurrentUsername(): string;
  } | undefined;
  
  let Collections: {
    getByLibrary(libraryID: number): any[];
    getAsync(id: number): Promise<any>;
  } | undefined;
  
  let Plugins: {
    getRootURI(pluginID: string): Promise<string>;
  } | undefined;
  
  let File: {
    getContentsFromURL(url: string): Promise<string>;
  } | undefined;
  
  let HTTP: {
    request(method: string, url: string, options?: any): Promise<{ 
      status: number; 
      responseText: string; 
      response: string 
    }>;
  } | undefined;
  
  let EditorInstance: (new () => any) | undefined;
  
  let UIProperties: {
    registerRoot(element: Element): void;
  } | undefined;
  
  let openNoteWindow: ((noteID: number) => void) | undefined;
  let BetterNotes: any;
}

interface Window {
  openDialog(
    url: string,
    name: string,
    features: string,
    ...args: any[]
  ): Window;
  Zotero?: typeof Zotero;
  ZoteroPane?: {
    selectItem: (itemID: number, inLibraryRoot?: boolean) => Promise<void>;
    itemsView?: any;
    [key: string]: any;
  };
  setTimeout?: (callback: Function, delay: number) => number;
  Services?: typeof Services;
  BetterNotesEditorAPI?: any;
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
