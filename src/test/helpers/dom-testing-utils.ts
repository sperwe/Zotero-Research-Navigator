/**
 * DOM Testing Utilities
 * 用于测试 UI 组件的 DOM 操作
 */

export class DOMTestingUtils {
  private container: HTMLElement;

  constructor() {
    this.container = document.createElement("div");
    document.body.appendChild(this.container);
  }

  cleanup() {
    this.container.remove();
  }

  /**
   * 查询元素
   */
  query(selector: string): HTMLElement | null {
    return this.container.querySelector(selector);
  }

  queryAll(selector: string): NodeListOf<HTMLElement> {
    return this.container.querySelectorAll(selector);
  }

  /**
   * 模拟点击
   */
  click(element: HTMLElement | string) {
    const el = typeof element === "string" ? this.query(element) : element;
    if (el) {
      el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    }
  }

  /**
   * 模拟输入
   */
  type(element: HTMLElement | string, text: string) {
    const el = typeof element === "string" ? this.query(element) : element;
    if (el && (el as HTMLInputElement).value !== undefined) {
      (el as HTMLInputElement).value = text;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  /**
   * 等待元素出现
   */
  async waitForElement(selector: string, timeout = 3000): Promise<HTMLElement> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const element = this.query(selector);
      if (element) {
        return element;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    throw new Error(`Element ${selector} not found within ${timeout}ms`);
  }

  /**
   * 等待条件满足
   */
  async waitFor(condition: () => boolean, timeout = 3000): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (condition()) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    throw new Error(`Condition not met within ${timeout}ms`);
  }

  /**
   * 获取元素文本
   */
  getText(element: HTMLElement | string): string {
    const el = typeof element === "string" ? this.query(element) : element;
    return el?.textContent?.trim() || "";
  }

  /**
   * 检查元素是否可见
   */
  isVisible(element: HTMLElement | string): boolean {
    const el = typeof element === "string" ? this.query(element) : element;
    if (!el) return false;

    const style = window.getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden";
  }

  /**
   * 模拟拖拽
   */
  drag(from: HTMLElement | string, to: HTMLElement | string) {
    const fromEl = typeof from === "string" ? this.query(from) : from;
    const toEl = typeof to === "string" ? this.query(to) : to;

    if (!fromEl || !toEl) return;

    // Simulate drag start
    fromEl.dispatchEvent(
      new DragEvent("dragstart", {
        bubbles: true,
        dataTransfer: new DataTransfer(),
      }),
    );

    // Simulate drag over
    toEl.dispatchEvent(
      new DragEvent("dragover", {
        bubbles: true,
        dataTransfer: new DataTransfer(),
      }),
    );

    // Simulate drop
    toEl.dispatchEvent(
      new DragEvent("drop", {
        bubbles: true,
        dataTransfer: new DataTransfer(),
      }),
    );

    // Simulate drag end
    fromEl.dispatchEvent(
      new DragEvent("dragend", {
        bubbles: true,
      }),
    );
  }

  /**
   * 获取容器
   */
  getContainer(): HTMLElement {
    return this.container;
  }
}
