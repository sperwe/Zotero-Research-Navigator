// Type definitions for zTree v3
// Project: https://github.com/zTree/zTree_v3
// Definitions for use in Zotero Research Navigator

interface IZTreeNode {
  id: string;
  pId?: string;
  name: string;
  title?: string;
  open?: boolean;
  isParent?: boolean;
  children?: IZTreeNode[];
  icon?: string;
  iconOpen?: string;
  iconClose?: string;
  checked?: boolean;
  halfCheck?: boolean;
  chkDisabled?: boolean;
  nocheck?: boolean;
  isHidden?: boolean;
  isLastNode?: boolean;
  isFirstNode?: boolean;
  getCheckStatus?: () => { checked: boolean; half: boolean };
  [key: string]: any;
}

interface IZTreeSetting {
  view?: {
    dblClickExpand?: boolean;
    showLine?: boolean;
    showIcon?: boolean;
    showTitle?: boolean;
    selectedMulti?: boolean;
    nameIsHTML?: boolean;
    addDiyDom?: (treeId: string, treeNode: IZTreeNode) => void;
    addHoverDom?: (treeId: string, treeNode: IZTreeNode) => void;
    removeHoverDom?: (treeId: string, treeNode: IZTreeNode) => void;
  };
  data?: {
    simpleData?: {
      enable?: boolean;
      idKey?: string;
      pIdKey?: string;
      rootPId?: any;
    };
    key?: {
      children?: string;
      name?: string;
      title?: string;
      url?: string;
      icon?: string;
    };
  };
  check?: {
    enable?: boolean;
    chkStyle?: string;
    chkboxType?: { Y: string; N: string };
    autoCheckTrigger?: boolean;
    chkDisabledInherit?: boolean;
    nocheckInherit?: boolean;
  };
  callback?: {
    beforeClick?: (treeId: string, treeNode: IZTreeNode, clickFlag: number) => boolean;
    onClick?: (event: Event, treeId: string, treeNode: IZTreeNode, clickFlag: number) => void;
    onCheck?: (event: Event, treeId: string, treeNode: IZTreeNode) => void;
    onExpand?: (event: Event, treeId: string, treeNode: IZTreeNode) => void;
    onCollapse?: (event: Event, treeId: string, treeNode: IZTreeNode) => void;
    onRightClick?: (event: Event, treeId: string, treeNode: IZTreeNode) => void;
    onDblClick?: (event: Event, treeId: string, treeNode: IZTreeNode) => void;
    beforeRemove?: (treeId: string, treeNode: IZTreeNode) => boolean;
    onRemove?: (event: Event, treeId: string, treeNode: IZTreeNode) => void;
    beforeRename?: (treeId: string, treeNode: IZTreeNode, newName: string, isCancel: boolean) => boolean;
    onRename?: (event: Event, treeId: string, treeNode: IZTreeNode, isCancel: boolean) => void;
  };
  edit?: {
    enable?: boolean;
    showRemoveBtn?: boolean;
    showRenameBtn?: boolean;
    removeTitle?: string;
    renameTitle?: string;
  };
  async?: {
    enable?: boolean;
    url?: string | ((treeId: string, treeNode: IZTreeNode) => string);
    autoParam?: string[];
    otherParam?: any;
    dataFilter?: (treeId: string, parentNode: IZTreeNode, responseData: any) => any;
  };
}

interface IZTreeObj {
  setting: IZTreeSetting;
  
  // Node operations
  getNodes(): IZTreeNode[];
  getNodeByParam(key: string, value: any, parentNode?: IZTreeNode): IZTreeNode | null;
  getNodeByTId(tId: string): IZTreeNode | null;
  getNodesByParam(key: string, value: any, parentNode?: IZTreeNode): IZTreeNode[];
  getNodesByParamFuzzy(key: string, value: string, parentNode?: IZTreeNode): IZTreeNode[];
  getNodesByFilter(filter: (node: IZTreeNode) => boolean, isSingle?: boolean, parentNode?: IZTreeNode): IZTreeNode[] | IZTreeNode;
  getNodeIndex(node: IZTreeNode): number;
  getSelectedNodes(): IZTreeNode[];
  
  // Tree operations
  addNodes(parentNode: IZTreeNode | null, newNodes: IZTreeNode | IZTreeNode[], isSilent?: boolean): IZTreeNode[];
  removeNode(node: IZTreeNode, callbackFlag?: boolean): void;
  removeChildNodes(parentNode: IZTreeNode): IZTreeNode[];
  updateNode(node: IZTreeNode, checkTypeFlag?: boolean): void;
  
  // Check operations
  checkNode(node: IZTreeNode, checked: boolean, checkTypeFlag?: boolean, callbackFlag?: boolean): void;
  checkAllNodes(checked: boolean): void;
  getCheckedNodes(checked?: boolean): IZTreeNode[];
  getChangeCheckedNodes(): IZTreeNode[];
  
  // Expand operations
  expandAll(expandFlag: boolean): boolean;
  expandNode(node: IZTreeNode, expandFlag?: boolean, sonSign?: boolean, focus?: boolean, callbackFlag?: boolean): boolean;
  
  // Selection operations
  selectNode(node: IZTreeNode, addFlag?: boolean, isSilent?: boolean): void;
  cancelSelectedNode(node?: IZTreeNode): void;
  
  // Other operations
  refresh(): void;
  destroy(): void;
  hideNode(node: IZTreeNode): void;
  hideNodes(nodes: IZTreeNode[]): void;
  showNode(node: IZTreeNode): void;
  showNodes(nodes: IZTreeNode[]): void;
  
  // Edit operations
  editName(node: IZTreeNode): void;
  cancelEditName(newName?: string): void;
}

declare namespace jQuery {
  interface fn {
    zTree: {
      init(obj: JQuery, setting: IZTreeSetting, zNodes?: IZTreeNode[]): IZTreeObj;
      getZTreeObj(treeId: string): IZTreeObj | null;
      destroy(treeId: string): void;
      _z: {
        tools: any;
        view: any;
        event: any;
        data: any;
      };
    };
  }
}

interface JQuery {
  zTree: jQuery.fn.zTree;
}