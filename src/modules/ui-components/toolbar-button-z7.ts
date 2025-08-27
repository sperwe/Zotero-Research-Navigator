/**
 * Toolbar Button Component for Zotero 7
 * 改进的工具栏按钮创建逻辑，兼容 Zotero 7 的新 UI 结构
 */

import { config } from "../../../package.json";

export async function createToolbarButtonZ7(
  win: Window,
  onClick: () => void
): Promise<Element | null> {
  const doc = win.document;
  
  addon.ztoolkit.log("Creating toolbar button for Zotero 7...");
  
  // 检查是否已存在
  const existingButton = doc.getElementById(`${config.addonRef}-toolbar-button`);
  if (existingButton) {
    addon.ztoolkit.log("Toolbar button already exists");
    return existingButton;
  }
  
  // Zotero 7 的工具栏位置（按优先级排序）
  const toolbarConfigs = [
    {
      id: "zotero-items-toolbar",
      desc: "items toolbar",
      position: "end" // 添加到末尾
    },
    {
      id: "zotero-tb-advanced-search", 
      desc: "search toolbar",
      position: "before",
      referenceId: "zotero-tb-search-dropmarker"
    },
    {
      id: "zotero-collections-toolbar",
      desc: "collections toolbar", 
      position: "end"
    }
  ];
  
  // 创建按钮元素
  const button = createButtonElement(doc, onClick);
  
  // 尝试添加到工具栏
  for (const config of toolbarConfigs) {
    const toolbar = doc.getElementById(config.id);
    if (!toolbar) {
      addon.ztoolkit.log(`Toolbar ${config.id} not found`);
      continue;
    }
    
    try {
      // 根据配置决定插入位置
      if (config.position === "before" && config.referenceId) {
        const reference = doc.getElementById(config.referenceId);
        if (reference) {
          toolbar.insertBefore(button, reference);
        } else {
          toolbar.appendChild(button);
        }
      } else {
        toolbar.appendChild(button);
      }
      
      addon.ztoolkit.log(`Toolbar button added to ${config.desc}`);
      
      // 强制刷新工具栏
      if (toolbar.parentElement) {
        toolbar.parentElement.style.display = 'none';
        toolbar.parentElement.offsetHeight; // 触发重排
        toolbar.parentElement.style.display = '';
      }
      
      return button;
    } catch (e) {
      addon.ztoolkit.log(`Failed to add button to ${config.desc}: ${e}`, 'warn');
    }
  }
  
  // 如果所有工具栏都失败，尝试创建浮动按钮
  addon.ztoolkit.log("All toolbars failed, creating floating button", 'warn');
  return createFloatingButton(doc, onClick);
}

function createButtonElement(doc: Document, onClick: () => void): Element {
  // 使用 XUL 元素（Zotero 7 仍支持）
  const button = doc.createXULElement("toolbarbutton");
  
  button.id = `${config.addonRef}-toolbar-button`;
  button.className = "zotero-tb-button";
  button.setAttribute("tooltiptext", "Open Research Navigator (Ctrl+Shift+H)");
  button.setAttribute("type", "button");
  
  // 设置图标 - 使用多种方式确保显示
  const iconUrl = `chrome://${config.addonRef}/content/icons/icon.svg`;
  button.style.listStyleImage = `url('${iconUrl}')`;
  
  // 添加额外的样式
  button.style.cssText += `
    -moz-appearance: none;
    margin: 0 4px;
    padding: 4px;
    min-width: 24px;
    min-height: 24px;
  `;
  
  // 为按钮添加图像元素作为后备
  const image = doc.createXULElement("image");
  image.setAttribute("src", iconUrl);
  image.style.width = "16px";
  image.style.height = "16px";
  button.appendChild(image);
  
  // 添加点击事件
  button.addEventListener("command", onClick);
  button.addEventListener("click", (e) => {
    e.preventDefault();
    onClick();
  });
  
  return button;
}

function createFloatingButton(doc: Document, onClick: () => void): Element | null {
  try {
    // 创建一个固定位置的按钮作为后备方案
    const container = doc.createElement("div");
    container.id = `${config.addonRef}-floating-button`;
    container.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 1000;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: #3182ce;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s;
    `;
    
    const icon = doc.createElement("img");
    icon.src = `chrome://${config.addonRef}/content/icons/icon.svg`;
    icon.style.cssText = `
      width: 24px;
      height: 24px;
      filter: brightness(0) invert(1);
    `;
    
    container.appendChild(icon);
    
    // 悬停效果
    container.addEventListener("mouseenter", () => {
      container.style.transform = "scale(1.1)";
      container.style.background = "#2563eb";
    });
    
    container.addEventListener("mouseleave", () => {
      container.style.transform = "scale(1)";
      container.style.background = "#3182ce";
    });
    
    container.addEventListener("click", onClick);
    
    // 添加到文档主体
    const mainWindow = doc.getElementById("main-window") || doc.body;
    mainWindow.appendChild(container);
    
    addon.ztoolkit.log("Created floating button as fallback");
    return container;
  } catch (e) {
    addon.ztoolkit.log(`Failed to create floating button: ${e}`, 'error');
    return null;
  }
}