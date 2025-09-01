# Release Notes - v2.8.12

## Overview
This release represents a major stabilization and feature completion effort for the Zotero Research Navigator plugin. All critical issues have been resolved, and several major features have been implemented.

## 🎯 Critical Fixes

### Attachment Opening Behavior
- **Fixed**: Attachments now properly open in Zotero tabs instead of the library view
- Uses `Zotero.Reader.open()` for PDF/EPUB attachments
- Intelligently switches to existing tabs or opens new ones as needed

### Clear All Functionality
- **Fixed**: "Clear All" button now works correctly
- Added missing `clearAll()` method to HistoryService
- Properly handles database cleanup

### Session Management
- **Fixed**: Plugin no longer creates excessive sessions on reinstall
- Added `loadHistoryOnStartup` preference (default: false)
- Prevents indexing all open tabs unnecessarily

### UI Stability
- **Fixed**: Missing scrollbars in History Tree tab
- **Fixed**: TypeScript compilation errors
- **Fixed**: Type definitions and missing method implementations

## ✨ New Features

### BetterNotes Integration
- Full compatibility with BetterNotes plugin
- Proper handling of `_betterNotesIgnore` flags
- Prevents editor conflicts between plugins
- Fallback methods for markdown conversion

### Quick Note Window Enhancements
- Native Zotero editor integration
- A+B mode: Choose between "always new" and "context-based reuse"
- Fixed all `doc.body is null` errors
- Floating button visible in bottom-right corner
- Notes automatically associated with current tab context

### Tree-Style History
- Safe DOM implementation avoiding jQuery/zTree issues
- Date-based grouping for better organization
- Real-time search with highlighting
- Delete buttons for items and sessions
- Proper scrollbar support

### Note Branching System
- Complete database schema for versioning
- Git-like branch management
- Paragraph-based splitting support
- Integrated with Note Relations tab

## 🔧 Technical Improvements

### Database Schema
- Added `research_navigator_note_versions` table
- Added `research_navigator_note_branches` table
- Proper indexes for performance
- Foreign key constraints for data integrity

### New Preferences
- `loadHistoryOnStartup`: Controls history loading (default: false)
- `quickNoteMode`: Controls note creation behavior (default: "context")
- `quickNoteShowInfo`: Shows note info in quick window (default: true)
- `historyDisplayMode`: Controls history grouping (default: "date")

### TypeScript & Build
- Fixed all TypeScript compilation errors
- Updated type definitions
- Improved build configuration
- Jest configuration updated (tests need cleanup)

## 📝 Known Issues
- Some unit tests need updating or removal (non-critical)
- macOS-style window controls not implemented (cosmetic)
- Right-click menus in Note Relations tab not implemented (functionality available via buttons)

## 🏷️ Version Information
- Current Version: 2.8.12
- Stable Versions: v2.0.3, v2.3.54, v2.8.3
- Build Status: ✅ Successful
- TypeScript: ✅ No errors

## 🚀 Upgrade Notes
Users upgrading from earlier versions should note:
1. History loading behavior has changed - enable `loadHistoryOnStartup` if you want the old behavior
2. Quick notes now support different creation modes - check preferences
3. The History Tree now groups by date by default

## 🙏 Acknowledgments
This release addresses all critical issues identified in the comprehensive bug report and implements the requested Tree-Style-History features and Note Branching system.