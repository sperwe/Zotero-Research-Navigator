declare global {
  const Zotero: any;
  const ChromeUtils: any;
  const ztoolkit: any;
  const addon: any;
  const __env__: "development" | "production";
  const Services: any;
  
  interface Window {
    Zotero?: any;
    addon?: any;
    ztoolkit?: any;
  }
  
  namespace globalThis {
    var Zotero: any;
    var addon: any;
    var ztoolkit: any;
  }

  interface Document {
    createXULElement?(tagName: string): any;
  }
}

export {};