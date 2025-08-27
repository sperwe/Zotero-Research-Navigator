declare global {
  const Zotero: any;
  const ChromeUtils: any;
  const ztoolkit: any;
  const addon: any;
  const __env__: string;
  
  interface Window {
    Zotero?: any;
    addon?: any;
    ztoolkit?: any;
  }

  interface Document {
    createXULElement?(tagName: string): any;
  }
}

export {};