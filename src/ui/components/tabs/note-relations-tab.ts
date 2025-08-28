/**
 * 笔记关联标签页
 */

import { NoteAssociationSystem } from "../../../managers/note-association-system";
import { HistoryService } from "../../../services/history-service";

export interface NoteRelationsTabOptions {
  noteAssociationSystem: NoteAssociationSystem;
  historyService: HistoryService;
}

export class NoteRelationsTab {
  constructor(
    private window: Window,
    private options: NoteRelationsTabOptions
  ) {}
  
  async initialize(): Promise<void> {}
  
  render(): HTMLElement {
    const doc = this.window.document;
    const container = doc.createElement("div");
    container.innerHTML = "<p>Note relations view coming soon...</p>";
    return container;
  }
  
  onHide(): void {}
  destroy(): void {}
}