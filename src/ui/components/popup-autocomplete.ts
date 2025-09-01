/**
 * Popup Component for Editor Autocomplete
 * Based on BetterNotes' popup implementation
 */

export class Popup {
  private _popup: HTMLDivElement;
  private _hasHover: boolean = false;
  private _className: string;

  get container(): HTMLDivElement {
    return this._popup;
  }

  get popup(): HTMLDivElement {
    return this._popup.querySelector(".popup") as HTMLDivElement;
  }

  constructor(
    doc: Document,
    className?: string,
    children: (HTMLElement | DocumentFragment)[] = [],
  ) {
    this._className = className || "";
    this._popup = doc.createElement("div");
    this._popup.className = `popup-container ${className}`;
    this._popup.innerHTML = `
      <div class="popup popup-bottom">
      </div>
    `;
    
    this.popup.append(...children);
    
    // Find appropriate parent element
    const parent = this.findParentElement(doc);
    if (parent) {
      parent.appendChild(this._popup);
    }

    // Setup hover tracking
    this._popup.addEventListener("mouseenter", () => {
      this._hasHover = true;
    });

    this._popup.addEventListener("mouseleave", () => {
      this._hasHover = false;
    });

    // Add base styles
    this.addStyles(doc);
  }

  /**
   * Find appropriate parent element for the popup
   */
  private findParentElement(doc: Document): Element | null {
    // Try to find editor container first
    const editorContainer = doc.querySelector(".editor-core");
    if (editorContainer) {
      // Create or find relative container
      let relativeContainer = editorContainer.querySelector(".relative-container");
      if (!relativeContainer) {
        relativeContainer = doc.createElement("div");
        relativeContainer.className = "relative-container";
        relativeContainer.style.cssText = `
          position: relative;
          width: 100%;
          height: 100%;
        `;
        editorContainer.appendChild(relativeContainer);
      }
      return relativeContainer;
    }

    // Fallback to other containers
    const fallbacks = [
      "#quick-note-editor-container",
      "#note-editor-container",
      ".editor-container",
      "body",
    ];

    for (const selector of fallbacks) {
      const element = doc.querySelector(selector);
      if (element) {
        return element;
      }
    }

    return doc.body;
  }

  /**
   * Add base popup styles
   */
  private addStyles(doc: Document): void {
    if (doc.querySelector("#popup-autocomplete-styles")) return;

    const style = doc.createElement("style");
    style.id = "popup-autocomplete-styles";
    style.textContent = `
      .popup-container {
        position: absolute;
        z-index: 10000;
        pointer-events: none;
      }
      .popup-container > .popup {
        pointer-events: auto;
        background: white;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        padding: 0;
        min-width: 200px;
      }
      .popup-container > .popup.popup-top {
        margin-bottom: 5px;
      }
      .popup-container > .popup.popup-bottom {
        margin-top: 5px;
      }
      .popup-container > .popup.popup-top::after {
        content: "";
        position: absolute;
        bottom: -5px;
        left: 50%;
        transform: translateX(-50%);
        width: 0;
        height: 0;
        border-left: 5px solid transparent;
        border-right: 5px solid transparent;
        border-top: 5px solid white;
      }
      .popup-container > .popup.popup-bottom::before {
        content: "";
        position: absolute;
        top: -5px;
        left: 50%;
        transform: translateX(-50%);
        width: 0;
        height: 0;
        border-left: 5px solid transparent;
        border-right: 5px solid transparent;
        border-bottom: 5px solid white;
      }
    `;

    if (doc.head) {
      doc.head.appendChild(style);
    } else if (doc.documentElement) {
      doc.documentElement.appendChild(style);
    }
  }

  /**
   * Layout popup relative to a rect or element
   */
  layoutPopup(pluginState: { rect?: DOMRect; node?: HTMLElement }): void {
    const rect = pluginState.rect || pluginState.node?.getBoundingClientRect();
    if (!rect) return;

    const padding = 10;
    const popupParent = this.container.parentElement;
    if (!popupParent) return;

    const parentRect = popupParent.getBoundingClientRect();
    const popupHeight = this.popup.offsetHeight;
    const popupWidth = this.popup.offsetWidth;

    // Calculate available space
    const spaceAbove = rect.top - parentRect.top;
    const spaceBelow = parentRect.bottom - rect.bottom;

    let top: number;
    let left: number;

    // Determine vertical position
    if (spaceBelow >= popupHeight + padding || spaceBelow > spaceAbove) {
      // Position below
      top = rect.bottom - parentRect.top + padding;
      this.popup.classList.remove("popup-top");
      this.popup.classList.add("popup-bottom");
    } else {
      // Position above
      top = rect.top - parentRect.top - popupHeight - padding;
      this.popup.classList.remove("popup-bottom");
      this.popup.classList.add("popup-top");
    }

    // Determine horizontal position (centered on cursor/rect)
    left = rect.left - parentRect.left + (rect.width / 2) - (popupWidth / 2);

    // Keep within bounds
    const maxLeft = parentRect.width - popupWidth - padding;
    left = Math.max(padding, Math.min(left, maxLeft));

    // Apply position
    this._popup.style.top = `${top}px`;
    this._popup.style.left = `${left}px`;
  }

  /**
   * Remove the popup
   */
  remove(): void {
    this._popup.remove();
  }

  /**
   * Check if popup has hover
   */
  get hasHover(): boolean {
    return this._hasHover;
  }
}