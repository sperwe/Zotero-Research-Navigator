/**
 * UI Helper Functions
 * 提供UI创建的辅助函数
 */

import { config } from "@/config";

export interface ElementOptions {
  id?: string;
  classList?: string[];
  styles?: Partial<CSSStyleDeclaration>;
  properties?: Record<string, any>;
  namespace?: "html" | "xul";
  children?: (Element | string)[];
  innerHTML?: string;
}

/**
 * 创建元素的辅助函数
 */
export function createElement(
  doc: Document,
  tagName: string,
  options: ElementOptions = {},
): Element {
  let element: Element;

  // 根据命名空间创建元素
  if (options.namespace === "xul" && doc.createXULElement) {
    element = doc.createXULElement(tagName);
  } else {
    element = doc.createElement(tagName);
  }

  // 设置ID
  if (options.id) {
    element.id = options.id;
  }

  // 添加类名
  if (options.classList && options.classList.length > 0) {
    element.classList.add(...options.classList);
  }

  // 设置样式
  if (options.styles && element instanceof HTMLElement) {
    Object.assign(element.style, options.styles);
  }

  // 设置属性
  if (options.properties) {
    Object.entries(options.properties).forEach(([key, value]) => {
      (element as any)[key] = value;
    });
  }

  // 设置innerHTML
  if (options.innerHTML) {
    element.innerHTML = options.innerHTML;
  }

  // 添加子元素
  if (options.children) {
    options.children.forEach((child) => {
      if (typeof child === "string") {
        element.appendChild(doc.createTextNode(child));
      } else {
        element.appendChild(child);
      }
    });
  }

  return element;
}

/**
 * 获取本地化字符串
 */
export function getString(key: string, args?: Record<string, string>): string {
  try {
    const fullKey = `${config.addonRef}.${key}`;

    if (typeof Zotero !== "undefined" && Zotero.getString) {
      return Zotero.getString(fullKey, args);
    }

    // 备用方案：返回键名
    return key;
  } catch (error) {
    addon.ztoolkit.log(`Failed to get string for key: ${key}`, "warn");
    return key;
  }
}

/**
 * 创建分隔符
 */
export function createSeparator(
  doc: Document,
  type: "horizontal" | "vertical" = "horizontal",
): Element {
  if (doc.createXULElement) {
    return doc.createXULElement("separator");
  }

  return createElement(doc, "hr", {
    styles: {
      margin: type === "horizontal" ? "10px 0" : "0 10px",
      border: "none",
      borderTop:
        type === "horizontal"
          ? "1px solid var(--material-border, #e0e0e0)"
          : "none",
      borderLeft:
        type === "vertical"
          ? "1px solid var(--material-border, #e0e0e0)"
          : "none",
      width: type === "horizontal" ? "100%" : "1px",
      height: type === "vertical" ? "100%" : "1px",
    },
  });
}

/**
 * 创建图标按钮
 */
export function createIconButton(
  doc: Document,
  icon: string,
  tooltip: string,
  onClick: () => void,
): Element {
  const button = createElement(doc, "button", {
    classList: ["icon-button"],
    properties: {
      title: tooltip,
    },
    styles: {
      background: "transparent",
      border: "none",
      cursor: "pointer",
      padding: "4px",
      borderRadius: "4px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
  });

  // 添加图标
  if (icon.startsWith("chrome://") || icon.startsWith("resource://")) {
    const img = createElement(doc, "img", {
      properties: {
        src: icon,
      },
      styles: {
        width: "16px",
        height: "16px",
      },
    });
    button.appendChild(img);
  } else {
    // 使用文本或emoji作为图标
    button.textContent = icon;
  }

  // 添加事件监听
  button.addEventListener("click", onClick);

  // 添加悬停效果
  button.addEventListener("mouseenter", () => {
    (button as HTMLElement).style.backgroundColor =
      "var(--material-background-hover, rgba(0,0,0,0.05))";
  });

  button.addEventListener("mouseleave", () => {
    (button as HTMLElement).style.backgroundColor = "transparent";
  });

  return button;
}
