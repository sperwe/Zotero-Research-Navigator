/**
 * Toolbar Button Component
 * 创建和管理工具栏按钮
 */

import { config } from "../../../package.json";
import { createElement } from "../../utils/ui-helper";

export async function createToolbarButton(
  win: Window,
  onClick: () => void
): Promise<Element | null> {
  const doc = win.document;
  
  // 查找合适的工具栏位置
  const toolbarLocations = [
    { id: "zotero-items-toolbar", desc: "items toolbar" },
    { id: "zotero-toolbar", desc: "main toolbar" },
    { id: "nav-bar", desc: "navigation bar" }
  ];
  
  for (const location of toolbarLocations) {
    const toolbar = doc.getElementById(location.id);
    if (toolbar) {
      // 检查是否已存在
      const existingButton = doc.getElementById(`${config.addonRef}-toolbar-button`);
      if (existingButton) {
        addon.ztoolkit.log("Toolbar button already exists");
        return existingButton;
      }
      
      // 创建按钮
      const button = createButton(doc, onClick);
      
      // 添加到工具栏
      toolbar.appendChild(button);
      
      addon.ztoolkit.log(`Toolbar button added to ${location.desc}`);
      return button;
    }
  }
  
  addon.ztoolkit.log("No suitable toolbar found", 'warn');
  return null;
}

function createButton(doc: Document, onClick: () => void): Element {
  const props = {
    id: `${config.addonRef}-toolbar-button`,
    class: "zotero-tb-button",
    tooltiptext: "Open Research Navigator (Ctrl+Shift+H)",
    style: `
      list-style-image: url(chrome://${config.addonRef}/content/icons/icon.svg);
      -moz-appearance: none;
      margin: 0 2px;
      padding: 2px;
    `
  };
  
  // 尝试创建 XUL 元素，如果失败则创建 HTML 元素
  let button: Element;
  
  if (doc.createXULElement) {
    button = doc.createXULElement("toolbarbutton");
    Object.assign(button, props);
  } else {
    button = createElement(doc, "button", {
      namespace: "html",
      id: props.id,
      classList: [props.class],
      properties: {
        title: props.tooltiptext
      },
      styles: {
        backgroundImage: `url(chrome://${config.addonRef}/content/icons/icon.svg)`,
        backgroundSize: "16px 16px",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        width: "24px",
        height: "24px",
        border: "none",
        background: "transparent",
        cursor: "pointer",
        margin: "0 2px",
        padding: "2px"
      }
    });
  }
  
  // 添加点击事件
  button.addEventListener("click", (e) => {
    e.preventDefault();
    onClick();
  });
  
  // 添加悬停效果
  button.addEventListener("mouseenter", () => {
    (button as HTMLElement).style.opacity = "0.8";
  });
  
  button.addEventListener("mouseleave", () => {
    (button as HTMLElement).style.opacity = "1";
  });
  
  return button;
}