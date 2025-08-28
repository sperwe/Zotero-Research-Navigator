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
    isNote(): boolean;
    getNoteTitle(): string;
    getNote(): string;
    setNote(content: string): void;
    getField(field: string): string;
    parentID?: number;
    saveTx(): Promise<void>;
  }
  
  const Items: {
    get(id: number | number[]): Item | Item[];
  };
  
  const Libraries: {
    userLibraryID: number;
  };
  
  function getString(key: string, params?: any): string;
  function logError(error: any): void;
}

interface Window {
  openDialog(
    url: string,
    name: string,
    features: string,
    ...args: any[]
  ): Window;
}