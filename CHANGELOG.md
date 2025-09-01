# Changelog

## [2.1.0] - 2024-01-28

### Added

- 🎯 **Toolbar Button**: Tree-style icon in the main toolbar for easy access
- 🌳 **History Tree View**: Hierarchical display of research history
  - Session-based organization
  - Visual indicators for active/closed tabs
  - Expandable/collapsible tree nodes
- 🗑️ **Closed Tabs Integration**: Deep integration with Zotero's tab history
  - Display recently closed tabs grouped by close time
  - One-click restoration of individual tabs or entire groups
  - Support for all tab types: PDF reader, library, search, notes
- 📝 **Note Association System**: Bidirectional linking between history and notes
  - Smart suggestions based on:
    - Parent item relationships
    - Time proximity (within 30 minutes)
    - Tag similarity
  - Dual-panel interface for easy management
  - Create notes directly from history context
- 🎨 **Enhanced UI**: Modern, responsive interface
  - Floating panel with drag and resize
  - Three-tab layout: History, Closed Tabs, Notes
  - Dark theme support with Zotero variables

### Fixed

- TypeScript compilation errors
- UI visibility issues in Zotero 7
- Database schema for better SQLite compatibility
- Chrome package registration for icons

### Technical Improvements

- Full TypeScript migration
- Modular architecture with service/manager pattern
- Comprehensive error handling
- Mock testing environment

## [2.0.3] - Previous Release

- Basic history tracking
- Simple tab management
- Initial UI implementation
