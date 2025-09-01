/**
 * Editor Autocomplete Component
 * Provides MagicKey-style "/" command autocomplete for Research Navigator editors
 */

import { Popup } from "./popup-autocomplete";

export interface AutocompleteCommand {
  id: string;
  title: string;
  description?: string;
  searchParts: string[];
  icon?: string;
  shortcut?: string;
  command: (context: AutocompleteContext) => void | Promise<void>;
  enabled?: (context: AutocompleteContext) => boolean;
}

export interface AutocompleteContext {
  editor: any; // Zotero.EditorInstance
  nodeId?: string;
  noteId?: number;
  window: Window;
  doc: Document;
}

export interface AutocompleteOptions {
  commands?: AutocompleteCommand[];
  enableBuiltInCommands?: boolean;
  onCommandExecute?: (command: AutocompleteCommand) => void;
}

export class EditorAutocomplete {
  private popup: Popup | null = null;
  private commands: Map<string, AutocompleteCommand> = new Map();
  private selectedIndex: number = -1;
  private context: AutocompleteContext | null = null;
  private options: AutocompleteOptions;
  private isActive: boolean = false;
  private inputValue: string = "";
  private popupClass = "rn-command-palette";

  constructor(options: AutocompleteOptions = {}) {
    this.options = options;
    this.initializeCommands();
  }

  /**
   * Initialize built-in commands
   */
  private initializeCommands(): void {
    const builtInCommands: AutocompleteCommand[] = [
      {
        id: "insert-link",
        title: "Insert Link to Item",
        description: "Insert a link to a Zotero item",
        searchParts: ["link", "il", "item"],
        icon: "🔗",
        command: async (ctx) => {
          await this.insertItemLink(ctx);
        },
      },
      {
        id: "insert-citation",
        title: "Insert Citation",
        description: "Insert a formatted citation",
        searchParts: ["cite", "ic", "citation"],
        icon: "📚",
        command: async (ctx) => {
          await this.insertCitation(ctx);
        },
      },
      {
        id: "insert-attachment",
        title: "Insert Attachment Link",
        description: "Insert a link to an attachment",
        searchParts: ["attachment", "ia", "file"],
        icon: "📎",
        command: async (ctx) => {
          await this.insertAttachmentLink(ctx);
        },
      },
      {
        id: "insert-tag",
        title: "Insert Tag",
        description: "Insert a tag reference",
        searchParts: ["tag", "it", "hashtag"],
        icon: "🏷️",
        command: async (ctx) => {
          await this.insertTag(ctx);
        },
      },
      {
        id: "insert-collection",
        title: "Insert Collection Link",
        description: "Insert a link to a collection",
        searchParts: ["collection", "folder", "ic"],
        icon: "📁",
        command: async (ctx) => {
          await this.insertCollectionLink(ctx);
        },
      },
      {
        id: "insert-note",
        title: "Insert Note Link",
        description: "Link to another note",
        searchParts: ["note", "in", "link-note"],
        icon: "📝",
        command: async (ctx) => {
          await this.insertNoteLink(ctx);
        },
      },
      {
        id: "insert-history",
        title: "Insert History Link",
        description: "Link to a navigation history item",
        searchParts: ["history", "ih", "nav"],
        icon: "🕐",
        command: async (ctx) => {
          await this.insertHistoryLink(ctx);
        },
      },
      {
        id: "insert-date",
        title: "Insert Date",
        description: "Insert current date/time",
        searchParts: ["date", "time", "id", "now"],
        icon: "📅",
        command: (ctx) => {
          this.insertDate(ctx);
        },
      },
      {
        id: "insert-todo",
        title: "Insert TODO",
        description: "Insert a TODO checkbox",
        searchParts: ["todo", "task", "checkbox"],
        icon: "☐",
        command: (ctx) => {
          this.insertTodo(ctx);
        },
      },
      {
        id: "insert-table",
        title: "Insert Table",
        description: "Insert a table",
        searchParts: ["table", "grid", "it"],
        icon: "⊞",
        command: (ctx) => {
          this.insertTable(ctx);
        },
      },
      {
        id: "heading1",
        title: "Heading 1",
        searchParts: ["h1", "heading1", "title"],
        icon: "H₁",
        command: (ctx) => {
          this.applyFormat(ctx, "heading1");
        },
      },
      {
        id: "heading2",
        title: "Heading 2",
        searchParts: ["h2", "heading2", "subtitle"],
        icon: "H₂",
        command: (ctx) => {
          this.applyFormat(ctx, "heading2");
        },
      },
      {
        id: "heading3",
        title: "Heading 3",
        searchParts: ["h3", "heading3"],
        icon: "H₃",
        command: (ctx) => {
          this.applyFormat(ctx, "heading3");
        },
      },
      {
        id: "bold",
        title: "Bold",
        searchParts: ["bold", "b", "strong"],
        icon: "B",
        shortcut: "Ctrl+B",
        command: (ctx) => {
          this.applyFormat(ctx, "bold");
        },
      },
      {
        id: "italic",
        title: "Italic",
        searchParts: ["italic", "i", "em"],
        icon: "I",
        shortcut: "Ctrl+I",
        command: (ctx) => {
          this.applyFormat(ctx, "italic");
        },
      },
      {
        id: "underline",
        title: "Underline",
        searchParts: ["underline", "u"],
        icon: "U̲",
        shortcut: "Ctrl+U",
        command: (ctx) => {
          this.applyFormat(ctx, "underline");
        },
      },
      {
        id: "bullet-list",
        title: "Bullet List",
        searchParts: ["ul", "bullet", "list", "unordered"],
        icon: "•",
        command: (ctx) => {
          this.applyFormat(ctx, "bulletList");
        },
      },
      {
        id: "numbered-list",
        title: "Numbered List",
        searchParts: ["ol", "number", "list", "ordered"],
        icon: "1.",
        command: (ctx) => {
          this.applyFormat(ctx, "orderedList");
        },
      },
      {
        id: "blockquote",
        title: "Blockquote",
        searchParts: ["quote", "bq", "blockquote"],
        icon: "❝",
        command: (ctx) => {
          this.applyFormat(ctx, "blockquote");
        },
      },
      {
        id: "code-block",
        title: "Code Block",
        searchParts: ["code", "mono", "cb", "pre"],
        icon: "{ }",
        command: (ctx) => {
          this.applyFormat(ctx, "codeBlock");
        },
      },
      {
        id: "math-block",
        title: "Math Block",
        searchParts: ["math", "latex", "mb", "equation"],
        icon: "∑",
        command: (ctx) => {
          this.applyFormat(ctx, "mathBlock");
        },
      },
      {
        id: "horizontal-rule",
        title: "Horizontal Rule",
        searchParts: ["hr", "line", "divider", "separator"],
        icon: "―",
        command: (ctx) => {
          this.insertHorizontalRule(ctx);
        },
      },
    ];

    // Add built-in commands if enabled
    if (this.options.enableBuiltInCommands !== false) {
      builtInCommands.forEach((cmd) => {
        this.commands.set(cmd.id, cmd);
      });
    }

    // Add custom commands
    if (this.options.commands) {
      this.options.commands.forEach((cmd) => {
        this.commands.set(cmd.id, cmd);
      });
    }
  }

  /**
   * Attach autocomplete to an editor
   */
  public attach(context: AutocompleteContext): void {
    this.context = context;
    this.setupEventListeners();
  }

  /**
   * Detach autocomplete from editor
   */
  public detach(): void {
    this.closePopup();
    this.context = null;
  }

  /**
   * Setup event listeners on the editor
   */
  private setupEventListeners(): void {
    if (!this.context?.editor) return;

    // Try multiple approaches to ensure we catch the events
    this.setupDirectListener();
    this.setupIframeListener();
    this.setupEditorCoreListener();
  }

  /**
   * Setup direct listener on editor element
   */
  private setupDirectListener(): void {
    const editorElement = this.getEditorElement();
    if (!editorElement) return;

    // Listen for "/" key in the editor
    editorElement.addEventListener("keydown", this.handleKeyDown.bind(this));
    Zotero.debug(`[EditorAutocomplete] Direct listener attached to ${editorElement.tagName}`);
  }

  /**
   * Setup listener on iframe if present
   */
  private setupIframeListener(): void {
    const iframe = this.context?.doc.querySelector("#note-editor-iframe") || 
                   this.context?.doc.querySelector("#quick-note-editor-iframe");
    
    if (iframe && (iframe as HTMLIFrameElement).contentWindow) {
      const iframeWin = (iframe as HTMLIFrameElement).contentWindow;
      
      // Wait for iframe to be ready
      const setupIframeEvents = () => {
        const iframeDoc = (iframe as HTMLIFrameElement).contentDocument;
        if (iframeDoc) {
          // Add listener to iframe document
          iframeDoc.addEventListener("keydown", this.handleKeyDown.bind(this));
          
          // Also try to find editor element in iframe
          const editorInIframe = iframeDoc.querySelector(
            "[contenteditable], .editor-core, .ProseMirror"
          );
          if (editorInIframe) {
            editorInIframe.addEventListener("keydown", this.handleKeyDown.bind(this));
            Zotero.debug(`[EditorAutocomplete] Iframe listener attached`);
          }
        }
      };

      // Setup immediately if ready, or wait for load
      if ((iframe as HTMLIFrameElement).contentDocument?.readyState === "complete") {
        setupIframeEvents();
      } else {
        iframe.addEventListener("load", setupIframeEvents);
      }
    }
  }

  /**
   * Setup listener via editor core if available
   */
  private setupEditorCoreListener(): void {
    if (!this.context?.editor) return;

    // Try to access editor core after a delay (in case it's not ready yet)
    setTimeout(() => {
      try {
        const editorCore = (this.context!.editor as any)._editorCore;
        if (editorCore?.view?.dom) {
          editorCore.view.dom.addEventListener("keydown", this.handleKeyDown.bind(this));
          Zotero.debug(`[EditorAutocomplete] EditorCore listener attached`);
        }
      } catch (e) {
        // Editor core might not be ready yet
      }
    }, 500);
  }

  /**
   * Get the editor's contenteditable element
   */
  private getEditorElement(): Element | null {
    if (!this.context?.editor) return null;

    try {
      // Try to get the ProseMirror view
      const view = (this.context.editor as any)._editorCore?.view;
      if (view?.dom) {
        return view.dom;
      }

      // For NoteRelationsTab, try to find the iframe
      const iframe = this.context.doc.querySelector("#note-editor-iframe") || 
                     this.context.doc.querySelector("#quick-note-editor-iframe");
      if (iframe && (iframe as HTMLIFrameElement).contentDocument) {
        const contentEditable = (iframe as HTMLIFrameElement).contentDocument!.querySelector(
          "[contenteditable], .editor-core, .ProseMirror",
        );
        if (contentEditable) {
          return contentEditable;
        }
      }

      // Try direct search in document
      const editable = this.context.doc.querySelector(
        "[contenteditable], .editor-core, .ProseMirror",
      );
      if (editable) {
        return editable;
      }
    } catch (e) {
      Zotero.debug(`[EditorAutocomplete] Failed to get editor element: ${e}`);
    }

    return null;
  }

  /**
   * Handle keydown events
   */
  private handleKeyDown(event: KeyboardEvent): void {
    if (event.key === "Escape" && this.isActive) {
      event.preventDefault();
      event.stopPropagation();
      this.closePopup();
      return;
    }

    if (event.key === "/" && !this.isActive) {
      // Check if we should open the popup
      const selection = this.context?.window.getSelection();
      if (selection && selection.isCollapsed) {
        // Delay to let the "/" character be typed first
        setTimeout(() => {
          const text = this.getTextBeforeCursor();
          if (text.endsWith("/") && !text.endsWith("//")) {
            this.openPopup();
          }
        }, 0);
      }
    }

    // Handle navigation in popup
    if (this.isActive) {
      if (event.key === "ArrowUp") {
        event.preventDefault();
        this.selectPrevious();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        this.selectNext();
      } else if (event.key === "Enter") {
        event.preventDefault();
        this.executeSelected();
      } else if (event.key === "Tab") {
        event.preventDefault();
        this.autocompleteSelected();
      }
    }
  }

  /**
   * Get text before cursor
   */
  private getTextBeforeCursor(): string {
    if (!this.context?.editor) return "";

    try {
      const view = (this.context.editor as any)._editorCore?.view;
      if (view) {
        const { state } = view;
        const { from } = state.selection;
        const text = state.doc.textBetween(
          Math.max(0, from - 50),
          from,
          "\n",
          "\n",
        );
        return text;
      }
    } catch (e) {
      Zotero.debug(`[EditorAutocomplete] Failed to get text before cursor: ${e}`);
    }

    return "";
  }

  /**
   * Open the autocomplete popup
   */
  private openPopup(): void {
    if (this.isActive) return;

    this.isActive = true;
    this.selectedIndex = 0;
    this.inputValue = "";

    // Create popup
    this.popup = new Popup(this.context!.doc, this.popupClass, [
      this.createPopupContent(),
    ]);

    // Position popup at cursor
    this.positionPopup();

    // Focus input
    const input = this.popup.container.querySelector(
      ".popup-input",
    ) as HTMLInputElement;
    if (input) {
      input.focus();
      this.setupPopupEventListeners(input);
    }

    // Update filtered commands
    this.updateFilteredCommands();
  }

  /**
   * Close the autocomplete popup
   */
  private closePopup(): void {
    if (!this.isActive) return;

    this.isActive = false;
    this.popup?.remove();
    this.popup = null;

    // Remove the "/" character
    if (this.context?.editor) {
      try {
        const view = (this.context.editor as any)._editorCore?.view;
        if (view) {
          const { state, dispatch } = view;
          const { from } = state.selection;
          const text = state.doc.textBetween(from - 1, from);
          if (text === "/") {
            const tr = state.tr.delete(from - 1, from);
            dispatch(tr);
          }
        }
      } catch (e) {
        Zotero.debug(`[EditorAutocomplete] Failed to remove slash: ${e}`);
      }
    }
  }

  /**
   * Create popup content
   */
  private createPopupContent(): DocumentFragment {
    const fragment = document.createRange().createContextualFragment(`
      <style>
        .${this.popupClass} > .popup {
          max-width: 400px;
          max-height: 360px;
          overflow: hidden;
          background: var(--material-background);
          border: 1px solid var(--material-border-quarternary);
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        .${this.popupClass} .popup-content {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 8px;
        }
        .${this.popupClass} .popup-input {
          padding: 6px 10px;
          background: var(--material-background);
          border: 1px solid var(--material-border-quarternary);
          border-radius: 6px;
          width: 100%;
          outline: none;
          font-size: 14px;
        }
        .${this.popupClass} .popup-input:focus {
          border-color: var(--fill-primary);
          box-shadow: 0 0 0 2px var(--fill-primary-alpha-20);
        }
        .${this.popupClass} .popup-list {
          display: flex;
          flex-direction: column;
          gap: 2px;
          overflow-y: auto;
          max-height: 280px;
        }
        .${this.popupClass} .popup-item {
          display: flex;
          align-items: center;
          padding: 8px 10px;
          cursor: pointer;
          border-radius: 6px;
          transition: background-color 0.1s ease;
        }
        .${this.popupClass} .popup-item[hidden] {
          display: none !important;
        }
        .${this.popupClass} .popup-item:hover {
          background-color: var(--fill-quinary);
        }
        .${this.popupClass} .popup-item.selected {
          background-color: var(--fill-primary);
          color: white;
        }
        .${this.popupClass} .popup-item-icon {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: 10px;
          font-size: 16px;
        }
        .${this.popupClass} .popup-item-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .${this.popupClass} .popup-item-title {
          font-size: 14px;
          font-weight: 500;
        }
        .${this.popupClass} .popup-item-description {
          font-size: 12px;
          opacity: 0.7;
        }
        .${this.popupClass} .popup-item-shortcut {
          margin-left: 12px;
          font-size: 12px;
          font-family: monospace;
          opacity: 0.6;
        }
        .${this.popupClass} .popup-item.selected .popup-item-description,
        .${this.popupClass} .popup-item.selected .popup-item-shortcut {
          opacity: 0.9;
        }
      </style>
      <div class="popup-content">
        <input type="text" class="popup-input" placeholder="Type to search commands..." />
        <div class="popup-list" tabindex="-1">
          ${Array.from(this.commands.entries())
            .map(
              ([id, cmd]) => `
            <div class="popup-item" data-command-id="${id}">
              <div class="popup-item-icon">${cmd.icon || "/"}</div>
              <div class="popup-item-content">
                <div class="popup-item-title">${cmd.title}</div>
                ${
                  cmd.description
                    ? `<div class="popup-item-description">${cmd.description}</div>`
                    : ""
                }
              </div>
              ${
                cmd.shortcut
                  ? `<div class="popup-item-shortcut">${cmd.shortcut}</div>`
                  : ""
              }
            </div>
          `,
            )
            .join("")}
        </div>
      </div>
    `);

    return fragment;
  }

  /**
   * Position popup at cursor
   */
  private positionPopup(): void {
    if (!this.popup || !this.context) return;

    try {
      const view = (this.context.editor as any)._editorCore?.view;
      if (view) {
        const { from } = view.state.selection;
        const coords = view.coordsAtPos(from);
        if (coords) {
          // Convert to document coordinates
          const editorRect = view.dom.getBoundingClientRect();
          const rect = {
            left: coords.left,
            right: coords.right,
            top: coords.top,
            bottom: coords.bottom,
          };
          this.popup.layoutPopup({ rect });
        }
      }
    } catch (e) {
      Zotero.debug(`[EditorAutocomplete] Failed to position popup: ${e}`);
    }
  }

  /**
   * Setup popup event listeners
   */
  private setupPopupEventListeners(input: HTMLInputElement): void {
    // Handle input changes
    input.addEventListener("input", (event) => {
      this.inputValue = (event.target as HTMLInputElement).value;
      this.updateFilteredCommands();
    });

    // Handle clicks on items
    const list = this.popup!.container.querySelector(".popup-list");
    if (list) {
      list.addEventListener("click", (event) => {
        const item = (event.target as HTMLElement).closest(".popup-item");
        if (item) {
          const commandId = item.getAttribute("data-command-id");
          if (commandId) {
            this.executeCommand(commandId);
          }
        }
      });
    }
  }

  /**
   * Update filtered commands based on input
   */
  private updateFilteredCommands(): void {
    if (!this.popup) return;

    const items = this.popup.container.querySelectorAll(".popup-item");
    let visibleIndex = 0;
    let firstVisibleIndex = -1;

    items.forEach((item, index) => {
      const commandId = item.getAttribute("data-command-id");
      if (!commandId) return;

      const command = this.commands.get(commandId);
      if (!command) return;

      const matches = this.matchesSearch(command, this.inputValue);
      item.setAttribute("hidden", matches ? "" : "true");

      if (matches) {
        if (firstVisibleIndex === -1) {
          firstVisibleIndex = visibleIndex;
        }
        if (visibleIndex === this.selectedIndex) {
          item.classList.add("selected");
        } else {
          item.classList.remove("selected");
        }
        visibleIndex++;
      }
    });

    // Auto-select first item if current selection is hidden
    if (firstVisibleIndex !== -1 && this.selectedIndex === -1) {
      this.selectedIndex = firstVisibleIndex;
      this.updateSelection();
    }
  }

  /**
   * Check if command matches search
   */
  private matchesSearch(command: AutocompleteCommand, search: string): boolean {
    if (!search) return true;

    const searchLower = search.toLowerCase();

    // Check title
    if (command.title.toLowerCase().includes(searchLower)) {
      return true;
    }

    // Check search parts
    if (
      command.searchParts.some((part) => part.toLowerCase().includes(searchLower))
    ) {
      return true;
    }

    // Check description
    if (command.description?.toLowerCase().includes(searchLower)) {
      return true;
    }

    return false;
  }

  /**
   * Select next command
   */
  private selectNext(): void {
    const visibleItems = this.getVisibleItems();
    if (visibleItems.length === 0) return;

    this.selectedIndex = (this.selectedIndex + 1) % visibleItems.length;
    this.updateSelection();
  }

  /**
   * Select previous command
   */
  private selectPrevious(): void {
    const visibleItems = this.getVisibleItems();
    if (visibleItems.length === 0) return;

    this.selectedIndex =
      this.selectedIndex <= 0
        ? visibleItems.length - 1
        : this.selectedIndex - 1;
    this.updateSelection();
  }

  /**
   * Get visible items
   */
  private getVisibleItems(): HTMLElement[] {
    if (!this.popup) return [];

    return Array.from(
      this.popup.container.querySelectorAll(".popup-item:not([hidden])"),
    ) as HTMLElement[];
  }

  /**
   * Update selection visual
   */
  private updateSelection(): void {
    const visibleItems = this.getVisibleItems();
    visibleItems.forEach((item, index) => {
      if (index === this.selectedIndex) {
        item.classList.add("selected");
        item.scrollIntoView({ block: "nearest" });
      } else {
        item.classList.remove("selected");
      }
    });
  }

  /**
   * Execute selected command
   */
  private executeSelected(): void {
    const visibleItems = this.getVisibleItems();
    const selectedItem = visibleItems[this.selectedIndex];
    if (!selectedItem) return;

    const commandId = selectedItem.getAttribute("data-command-id");
    if (commandId) {
      this.executeCommand(commandId);
    }
  }

  /**
   * Autocomplete selected command
   */
  private autocompleteSelected(): void {
    const visibleItems = this.getVisibleItems();
    const selectedItem = visibleItems[this.selectedIndex];
    if (!selectedItem) return;

    const commandId = selectedItem.getAttribute("data-command-id");
    if (!commandId) return;

    const command = this.commands.get(commandId);
    if (!command) return;

    // Set input to command title
    const input = this.popup?.container.querySelector(
      ".popup-input",
    ) as HTMLInputElement;
    if (input) {
      input.value = command.searchParts[0] || command.title.toLowerCase();
      this.inputValue = input.value;
      this.updateFilteredCommands();
    }
  }

  /**
   * Execute a command
   */
  private async executeCommand(commandId: string): Promise<void> {
    const command = this.commands.get(commandId);
    if (!command || !this.context) return;

    // Check if command is enabled
    if (command.enabled && !command.enabled(this.context)) {
      return;
    }

    // Close popup first
    this.closePopup();

    try {
      // Execute command
      await command.command(this.context);

      // Notify callback
      if (this.options.onCommandExecute) {
        this.options.onCommandExecute(command);
      }
    } catch (error) {
      Zotero.logError(`[EditorAutocomplete] Command execution failed: ${error}`);
    }
  }

  // Command implementations

  private async insertItemLink(ctx: AutocompleteContext): Promise<void> {
    // Open Zotero item picker
    const io = { dataIn: null, dataOut: null };
    ctx.window.openDialog(
      "chrome://zotero/content/selectItemsDialog.xul",
      "",
      "chrome,dialog=no,modal,centerscreen,resizable=yes",
      io,
    );

    if (io.dataOut && io.dataOut.length > 0) {
      const itemID = io.dataOut[0];
      const item = await Zotero.Items.getAsync(itemID);
      if (item) {
        const link = `zotero://select/library/items/${item.key}`;
        const title = item.getField("title");
        this.insertTextAtCursor(ctx, `[${title}](${link})`);
      }
    }
  }

  private async insertCitation(ctx: AutocompleteContext): Promise<void> {
    // Similar to insertItemLink but format as citation
    const io = { dataIn: null, dataOut: null };
    ctx.window.openDialog(
      "chrome://zotero/content/selectItemsDialog.xul",
      "",
      "chrome,dialog=no,modal,centerscreen,resizable=yes",
      io,
    );

    if (io.dataOut && io.dataOut.length > 0) {
      const citations = await Promise.all(
        io.dataOut.map(async (itemID: number) => {
          const item = await Zotero.Items.getAsync(itemID);
          if (item) {
            const creators = item.getCreators();
            const firstAuthor = creators[0]
              ? creators[0].lastName
              : "Unknown";
            const year = item.getField("year") || "n.d.";
            return `${firstAuthor}, ${year}`;
          }
          return "";
        }),
      );

      const citationText = citations.filter((c) => c).join("; ");
      if (citationText) {
        this.insertTextAtCursor(ctx, `(${citationText})`);
      }
    }
  }

  private async insertAttachmentLink(ctx: AutocompleteContext): Promise<void> {
    // Get attachments for current note's parent item
    if (ctx.noteId) {
      const note = await Zotero.Items.getAsync(ctx.noteId);
      if (note && note.parentID) {
        const parent = await Zotero.Items.getAsync(note.parentID);
        if (parent) {
          const attachments = await Zotero.Items.getAsync(
            parent.getAttachments(),
          );

          if (attachments.length === 0) {
            ctx.window.alert("No attachments found for this item.");
            return;
          }

          // If single attachment, insert directly
          if (attachments.length === 1) {
            const att = attachments[0];
            const link = `zotero://open-pdf/library/items/${att.key}`;
            const title = att.getField("title") || "Attachment";
            this.insertTextAtCursor(ctx, `[${title}](${link})`);
          } else {
            // Multiple attachments - show picker
            const selected = ctx.window.prompt(
              "Select attachment:\n" +
                attachments
                  .map((att, idx) => `${idx + 1}. ${att.getField("title")}`)
                  .join("\n"),
              "1",
            );
            if (selected) {
              const idx = parseInt(selected) - 1;
              if (idx >= 0 && idx < attachments.length) {
                const att = attachments[idx];
                const link = `zotero://open-pdf/library/items/${att.key}`;
                const title = att.getField("title") || "Attachment";
                this.insertTextAtCursor(ctx, `[${title}](${link})`);
              }
            }
          }
        }
      }
    }
  }

  private async insertTag(ctx: AutocompleteContext): Promise<void> {
    // Get all tags from library
    const tags = Zotero.Tags.getAll();
    if (tags.length === 0) {
      ctx.window.alert("No tags found in library.");
      return;
    }

    // Simple tag picker
    const tagList = tags.map((t) => t.name).join("\n");
    const selected = ctx.window.prompt(
      "Enter tag name:\n(Available tags shown below)\n\n" + tagList,
    );

    if (selected) {
      this.insertTextAtCursor(ctx, `#${selected}`);
    }
  }

  private async insertCollectionLink(ctx: AutocompleteContext): Promise<void> {
    // Get collections tree
    const collections = Zotero.Collections.getByLibrary(
      Zotero.Libraries.userLibraryID,
    );

    if (collections.length === 0) {
      ctx.window.alert("No collections found.");
      return;
    }

    // Simple collection picker
    const collectionList = collections
      .map((c) => `${c.name} (${c.key})`)
      .join("\n");
    const selected = ctx.window.prompt(
      "Select collection:\n" + collectionList,
    );

    if (selected) {
      const match = selected.match(/\(([^)]+)\)$/);
      if (match) {
        const key = match[1];
        const collection = collections.find((c) => c.key === key);
        if (collection) {
          const link = `zotero://select/library/collections/${key}`;
          this.insertTextAtCursor(ctx, `[${collection.name}](${link})`);
        }
      }
    }
  }

  private async insertNoteLink(ctx: AutocompleteContext): Promise<void> {
    // Get all notes
    const notes = await Zotero.Items.getAll(
      Zotero.Libraries.userLibraryID,
      false,
      false,
      { itemType: "note" },
    );

    if (notes.length === 0) {
      ctx.window.alert("No notes found.");
      return;
    }

    // Filter out current note
    const otherNotes = notes.filter((n) => n.id !== ctx.noteId);

    if (otherNotes.length === 0) {
      ctx.window.alert("No other notes found.");
      return;
    }

    // Simple note picker
    const noteList = otherNotes
      .slice(0, 20) // Limit to 20 for performance
      .map((n, idx) => {
        const title = n.getNoteTitle() || "Untitled Note";
        return `${idx + 1}. ${title}`;
      })
      .join("\n");

    const selected = ctx.window.prompt(
      "Select note to link:\n" + noteList,
      "1",
    );

    if (selected) {
      const idx = parseInt(selected) - 1;
      if (idx >= 0 && idx < otherNotes.length) {
        const note = otherNotes[idx];
        const link = `zotero://select/library/items/${note.key}`;
        const title = note.getNoteTitle() || "Untitled Note";
        this.insertTextAtCursor(ctx, `[${title}](${link})`);
      }
    }
  }

  private async insertHistoryLink(ctx: AutocompleteContext): Promise<void> {
    // Get recent history from Zotero_Tabs
    if (ctx.window.Zotero_Tabs && ctx.window.Zotero_Tabs._history) {
      const history = ctx.window.Zotero_Tabs._history.slice(-10); // Last 10 items

      if (history.length === 0) {
        ctx.window.alert("No history items found.");
        return;
      }

      const historyList = history
        .map((h: any, idx: number) => {
          const title = h.title || "Untitled";
          return `${idx + 1}. ${title}`;
        })
        .join("\n");

      const selected = ctx.window.prompt(
        "Select history item:\n" + historyList,
        "1",
      );

      if (selected) {
        const idx = parseInt(selected) - 1;
        if (idx >= 0 && idx < history.length) {
          const item = history[idx];
          const title = item.title || "Untitled";
          // Create a link that Research Navigator can handle
          this.insertTextAtCursor(ctx, `[[history:${title}]]`);
        }
      }
    }
  }

  private insertDate(ctx: AutocompleteContext): void {
    const now = new Date();
    const dateStr = now.toLocaleDateString();
    const timeStr = now.toLocaleTimeString();
    this.insertTextAtCursor(ctx, `${dateStr} ${timeStr}`);
  }

  private insertTodo(ctx: AutocompleteContext): void {
    this.insertTextAtCursor(ctx, "- [ ] ");
  }

  private insertTable(ctx: AutocompleteContext): void {
    const input = ctx.window.prompt(
      "Enter table dimensions (rows,columns):",
      "3,3",
    );
    if (!input) return;

    const [rows, cols] = input.split(",").map((n) => parseInt(n.trim()));
    if (isNaN(rows) || isNaN(cols)) return;

    // Create markdown table
    let table = "\n";
    
    // Header row
    table += "|";
    for (let c = 0; c < cols; c++) {
      table += ` Header ${c + 1} |`;
    }
    table += "\n";

    // Separator row
    table += "|";
    for (let c = 0; c < cols; c++) {
      table += " --- |";
    }
    table += "\n";

    // Data rows
    for (let r = 0; r < rows; r++) {
      table += "|";
      for (let c = 0; c < cols; c++) {
        table += " Cell |";
      }
      table += "\n";
    }

    this.insertTextAtCursor(ctx, table);
  }

  private insertHorizontalRule(ctx: AutocompleteContext): void {
    this.insertTextAtCursor(ctx, "\n---\n");
  }

  private applyFormat(ctx: AutocompleteContext, format: string): void {
    if (!ctx.editor) return;

    try {
      const view = (ctx.editor as any)._editorCore?.view;
      if (view) {
        // Try to apply format using ProseMirror commands
        const { state, dispatch } = view;
        let command;

        switch (format) {
          case "bold":
            command = view.state.schema.marks.strong.toggleMark;
            break;
          case "italic":
            command = view.state.schema.marks.em.toggleMark;
            break;
          case "underline":
            command = view.state.schema.marks.underline?.toggleMark;
            break;
          case "heading1":
            command = (state: any, dispatch: any) => {
              const { $from, $to } = state.selection;
              const node = state.schema.nodes.heading.create({ level: 1 });
              if (dispatch) {
                dispatch(state.tr.setBlockType($from.pos, $to.pos, node));
              }
              return true;
            };
            break;
          case "heading2":
            command = (state: any, dispatch: any) => {
              const { $from, $to } = state.selection;
              const node = state.schema.nodes.heading.create({ level: 2 });
              if (dispatch) {
                dispatch(state.tr.setBlockType($from.pos, $to.pos, node));
              }
              return true;
            };
            break;
          case "heading3":
            command = (state: any, dispatch: any) => {
              const { $from, $to } = state.selection;
              const node = state.schema.nodes.heading.create({ level: 3 });
              if (dispatch) {
                dispatch(state.tr.setBlockType($from.pos, $to.pos, node));
              }
              return true;
            };
            break;
          case "bulletList":
            command = (state: any, dispatch: any) => {
              const { $from, $to } = state.selection;
              const node = state.schema.nodes.bullet_list;
              if (dispatch) {
                dispatch(state.tr.setBlockType($from.pos, $to.pos, node));
              }
              return true;
            };
            break;
          case "orderedList":
            command = (state: any, dispatch: any) => {
              const { $from, $to } = state.selection;
              const node = state.schema.nodes.ordered_list;
              if (dispatch) {
                dispatch(state.tr.setBlockType($from.pos, $to.pos, node));
              }
              return true;
            };
            break;
          case "blockquote":
            command = (state: any, dispatch: any) => {
              const { $from, $to } = state.selection;
              const node = state.schema.nodes.blockquote;
              if (dispatch) {
                dispatch(state.tr.setBlockType($from.pos, $to.pos, node));
              }
              return true;
            };
            break;
          case "codeBlock":
            command = (state: any, dispatch: any) => {
              const { $from, $to } = state.selection;
              const node = state.schema.nodes.code_block;
              if (dispatch) {
                dispatch(state.tr.setBlockType($from.pos, $to.pos, node));
              }
              return true;
            };
            break;
        }

        if (command) {
          command(state, dispatch);
        }
      }
    } catch (e) {
      Zotero.debug(`[EditorAutocomplete] Failed to apply format: ${e}`);
    }
  }

  private insertTextAtCursor(ctx: AutocompleteContext, text: string): void {
    if (!ctx.editor) return;

    try {
      const view = (ctx.editor as any)._editorCore?.view;
      if (view) {
        const { state, dispatch } = view;
        const { from, to } = state.selection;
        const tr = state.tr.insertText(text, from, to);
        dispatch(tr);
      }
    } catch (e) {
      Zotero.debug(`[EditorAutocomplete] Failed to insert text: ${e}`);
    }
  }
}