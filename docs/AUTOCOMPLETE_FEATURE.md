# MagicKey-Style Autocomplete Feature

## Overview

This feature brings BetterNotes-inspired MagicKey autocomplete functionality to Research Navigator's note editors. Users can type "/" to trigger a command palette with various formatting and insertion options.

## Features

### Built-in Commands

The autocomplete system includes the following commands:

#### Content Insertion
- **Insert Link to Item** (`/link`, `/il`) - Insert a link to a Zotero item
- **Insert Citation** (`/cite`, `/ic`) - Insert a formatted citation
- **Insert Attachment Link** (`/attachment`, `/ia`) - Insert a link to an attachment
- **Insert Tag** (`/tag`, `/it`) - Insert a tag reference
- **Insert Collection Link** (`/collection`, `/ic`) - Insert a link to a collection
- **Insert Note Link** (`/note`, `/in`) - Link to another note
- **Insert History Link** (`/history`, `/ih`) - Link to a navigation history item
- **Insert Date** (`/date`, `/id`) - Insert current date/time
- **Insert TODO** (`/todo`) - Insert a TODO checkbox
- **Insert Table** (`/table`, `/it`) - Insert a table with specified dimensions
- **Insert Horizontal Rule** (`/hr`) - Insert a horizontal line

#### Text Formatting
- **Heading 1-3** (`/h1`, `/h2`, `/h3`) - Convert to heading
- **Bold** (`/bold`, `/b`) - Apply bold formatting
- **Italic** (`/italic`, `/i`) - Apply italic formatting
- **Underline** (`/underline`, `/u`) - Apply underline formatting
- **Bullet List** (`/ul`, `/bullet`) - Create unordered list
- **Numbered List** (`/ol`, `/number`) - Create ordered list
- **Blockquote** (`/quote`, `/bq`) - Create blockquote
- **Code Block** (`/code`, `/cb`) - Create code block
- **Math Block** (`/math`, `/mb`) - Create math equation block

## Usage

1. **Trigger**: Type "/" in any supported editor to open the command palette
2. **Search**: Start typing to filter commands by title, description, or shortcut
3. **Navigate**: Use arrow keys (↑↓) to navigate through commands
4. **Execute**: Press Enter to execute the selected command
5. **Autocomplete**: Press Tab to autocomplete the command shortcut
6. **Cancel**: Press Escape to close the palette

## Integration

The autocomplete is automatically initialized in:
- Quick Note Window (floating notes)
- Note Relations Tab (main panel editor)

## Implementation Details

### Architecture

1. **EditorAutocomplete** (`src/ui/components/editor-autocomplete.ts`)
   - Main autocomplete engine
   - Command registry and execution
   - Event handling and keyboard shortcuts
   - Context-aware command execution

2. **Popup** (`src/ui/components/popup-autocomplete.ts`)
   - Floating UI component
   - Positioning and styling
   - Visual feedback

3. **Integration Points**
   - `QuickNoteWindowV2`: Autocomplete attached after editor initialization
   - `NoteRelationsTab`: Autocomplete attached after native editor setup

### Key Features

- **Multiple Event Listeners**: Supports both direct DOM and iframe-based editors
- **Context Awareness**: Commands receive editor context including nodeId and noteId
- **Extensible**: Easy to add custom commands via the options parameter
- **Zotero Integration**: Commands utilize Zotero's native APIs for item selection, citations, etc.

### Technical Considerations

1. **Editor Detection**: The system attempts multiple methods to find the editor element:
   - Direct ProseMirror view access
   - Iframe content document queries
   - Fallback to contenteditable elements

2. **Event Handling**: Multiple listener approaches ensure compatibility:
   - Direct element listeners
   - Iframe document listeners
   - Delayed EditorCore listeners

3. **Security**: All HTML elements use safe methods to avoid XSS:
   - Span elements instead of buttons (Bootstrap security)
   - Role and tabindex attributes for accessibility

## Future Enhancements

1. **Custom Commands**: Allow users to define their own commands
2. **Command History**: Remember frequently used commands
3. **Smart Suggestions**: Context-aware command recommendations
4. **Template System**: Support for custom text templates
5. **Markdown Support**: Enhanced markdown formatting options
6. **API Integration**: Commands for external services