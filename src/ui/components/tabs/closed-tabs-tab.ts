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
    private options: ClosedTabsTabOptions,
  ) {}

  create(container: HTMLElement): void {
    const doc = this.window.document;
    container.innerHTML = "<p>Closed tabs view coming soon...</p>";
  }

  onHide(): void {}
  destroy(): void {}
}
