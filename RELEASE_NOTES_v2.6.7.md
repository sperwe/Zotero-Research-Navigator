# Zotero Research Navigator v2.6.7 Release Notes

## 🎯 Overview

This release focuses on **automated testing infrastructure** and **critical bug fixes** for the quick note floating window functionality.

## ✨ New Features

### 1. **Comprehensive Testing Infrastructure** 🧪

- Added complete mock environment for Zotero APIs
- Implemented unit tests for core services
- Created integration tests for plugin lifecycle
- Added UI component tests with DOM utilities
- GitHub Actions CI/CD pipeline for automated testing

### 2. **Enhanced Quick Note Functionality** 📝

- New `QuickNoteWindowV2` with improved stability
- Simplified floating button implementation
- Better DOM timing handling
- Fixed infinite delay loops

## 🐛 Bug Fixes

- **Fixed**: "Document body not available, delaying..." infinite loop
- **Fixed**: Quick note window not appearing in certain scenarios
- **Fixed**: MutationObserver compatibility issues in Zotero environment
- **Fixed**: Bootstrap security filter removing UI elements
- **Fixed**: Tab switching issues in Note Relations panel

## 🛠️ Technical Improvements

### Testing Coverage

- ✅ HistoryService
- ✅ DatabaseService
- ✅ ClosedTabsManager
- ✅ NoteAssociationSystem
- ✅ NavigationService
- ✅ MainPanel UI
- ✅ QuickNoteWindow UI

### Developer Experience

- Jest test framework configured
- Test runner scripts for convenient testing
- Smoke test script for pre-release validation
- Version consistency checks
- Improved error handling and logging

## 📦 Installation

1. Download `zotero-research-navigator.xpi` from the releases page
2. In Zotero, go to Tools → Add-ons
3. Click the gear icon → Install Add-on From File
4. Select the downloaded XPI file

## 🔧 Compatibility

- Zotero 7.0+
- All platforms (Windows, macOS, Linux)

## 🙏 Acknowledgments

Thanks to all users who reported issues and provided feedback. Special thanks for the patience during the quick note window debugging process.

## 📝 What's Next

- Further test coverage expansion
- Performance optimizations
- Enhanced note branching features
- Improved search functionality

---

**Full Changelog**: https://github.com/sperwe/Zotero-Research-Navigator/compare/v2.6.6...v2.6.7
