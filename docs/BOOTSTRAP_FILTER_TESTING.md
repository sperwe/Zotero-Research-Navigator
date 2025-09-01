# Bootstrap Security Filter Testing Guide

## Overview

Zotero uses a modified Bootstrap environment with security filters that automatically remove certain HTML elements deemed "unsafe". This can cause issues for plugin developers, especially when creating interactive UI elements like buttons.

## The Problem

Bootstrap's security filter removes elements like:

- `<button>` - Interactive elements
- `<input>` (if not self-closed)
- `<script>` - Script execution
- `<iframe>` - External content
- Event attributes (`onclick`, `onload`, etc.)
- JavaScript URLs (`href="javascript:..."`)

## Testing Infrastructure

We've created a comprehensive testing framework to help identify and resolve Bootstrap filter issues.

### Components

1. **Test Security Filter** (`test-security-filter.ts`)
   - Basic element filtering tests
   - Performance comparisons
   - Workaround validation

2. **Comprehensive Test** (`comprehensive-test.ts`)
   - Environment detection
   - Real-world scenario testing
   - Recommendations generation

3. **Monitor Tool** (`monitor-tool.ts`)
   - Real-time DOM monitoring
   - Captures filtered elements
   - Provides detailed filtering reasons

4. **Test Runner** (`test-runner.ts`)
   - Orchestrates all tests
   - Generates comprehensive reports
   - Plugin-specific testing

## Running Tests

### In Zotero Console

After installing the plugin, open Zotero's Error Console (Ctrl+Shift+K / Cmd+Option+K) and run:

```javascript
// Full test suite
Zotero.ResearchNavigator.runBootstrapTests();

// Quick test
Zotero.ResearchNavigator.quickBootstrapTest();

// Start monitoring
Zotero.ResearchNavigator.startFilterMonitor();
// ... perform actions ...
Zotero.ResearchNavigator.stopFilterMonitor();

// Test specific component
Zotero.ResearchNavigator.testComponent("QuickNoteButton");

// Show help
Zotero.ResearchNavigator.bootstrapHelp();
```

### From Command Line

```bash
# Run the test preparation script
node scripts/run-bootstrap-tests.js

# This will:
# 1. Compile the plugin with tests
# 2. Generate test documentation
# 3. Create quick test scripts
```

## Safe Alternatives

### Buttons

❌ **Unsafe:**

```html
<button class="my-button">Click me</button>
```

✅ **Safe:**

```javascript
const button = document.createElement("span");
button.setAttribute("role", "button");
button.setAttribute("tabindex", "0");
button.className = "my-button";
button.textContent = "Click me";

// Add keyboard support
button.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    button.click();
  }
});
```

### Input Fields

❌ **Unsafe:**

```html
<input type="text" value="test" />
```

✅ **Safe:**

```javascript
const input = document.createElement("input");
input.type = "text";
input.value = "test";
container.appendChild(input);

// Or use self-closing in HTML
container.innerHTML = '<input type="text" value="test" />';
```

### Event Handlers

❌ **Unsafe:**

```html
<div onclick="handleClick()">Click me</div>
```

✅ **Safe:**

```javascript
const div = document.createElement("div");
div.textContent = "Click me";
div.addEventListener("click", handleClick);
```

## Best Practices

1. **Always use DOM manipulation for interactive elements**
   - `createElement()` is safer than `innerHTML`
   - Add event listeners programmatically

2. **Use ARIA attributes for accessibility**
   - `role="button"` for clickable elements
   - `tabindex="0"` for keyboard navigation
   - `aria-label` for screen readers

3. **Style appropriately**

   ```css
   [role="button"] {
     cursor: pointer;
     user-select: none;
     display: inline-block;
   }

   [role="button"]:focus {
     outline: 2px solid #0084ff;
   }

   [role="button"]:hover {
     opacity: 0.8;
   }
   ```

4. **Test thoroughly**
   - Use the monitoring tool during development
   - Test in different Zotero versions
   - Verify keyboard accessibility

## Example: Safe Button Component

```typescript
export function createSafeButton(
  text: string,
  onClick: () => void,
): HTMLElement {
  const button = document.createElement("span");

  // ARIA attributes
  button.setAttribute("role", "button");
  button.setAttribute("tabindex", "0");
  button.setAttribute("aria-label", text);

  // Content and styling
  button.textContent = text;
  button.className = "safe-button";
  button.style.cssText = `
    display: inline-block;
    padding: 4px 12px;
    background: #2196F3;
    color: white;
    border-radius: 4px;
    cursor: pointer;
    user-select: none;
  `;

  // Mouse events
  button.addEventListener("click", onClick);

  // Keyboard events
  button.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  });

  // Visual feedback
  button.addEventListener("mouseenter", () => {
    button.style.opacity = "0.8";
  });

  button.addEventListener("mouseleave", () => {
    button.style.opacity = "1";
  });

  return button;
}
```

## Troubleshooting

### Elements disappearing after innerHTML assignment

- Use DOM manipulation instead
- Check the console for "Removing unsafe node" messages
- Use the monitor tool to identify what's being filtered

### Event handlers not working

- Avoid inline event attributes
- Use `addEventListener()` instead
- Check if the element still exists after insertion

### Styles not applying

- Use `style.cssText` or individual style properties
- Avoid `style` attributes in HTML strings
- Consider using CSS classes instead

## Further Reading

- [Zotero Plugin Development](https://www.zotero.org/support/dev/client_coding/plugin_development)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [Bootstrap Security Documentation](https://getbootstrap.com/docs/5.0/getting-started/javascript/#sanitizer)

## Contributing

If you discover new filtering patterns or develop better workarounds, please contribute them back to the project!
