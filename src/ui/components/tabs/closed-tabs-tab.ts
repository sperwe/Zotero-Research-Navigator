/**
 * 已关闭标签页标签
 */

import { ClosedTabsManager } from "../../../managers/closed-tabs-manager";

export interface ClosedTabsTabOptions {
  closedTabsManager: ClosedTabsManager;
}

export class ClosedTabsTab {
  constructor(
    private window: Window,
    private options: ClosedTabsTabOptions
  ) {}
  
  async initialize(): Promise<void> {}
  
  render(): HTMLElement {
    const doc = this.window.document;
    const container = doc.createElement("div");
    container.innerHTML = "<p>Closed tabs view coming soon...</p>";
    return container;
  }
  
  onHide(): void {}
  destroy(): void {}
}