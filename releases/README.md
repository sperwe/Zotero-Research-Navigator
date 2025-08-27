# Research Navigator Plugin Releases

## Version 2.0.3 Releases

### Latest Stable: `zotero-research-navigator-v2.0.3-ui-fix.xpi`
**Release Date**: 2024-08-27

This is the recommended version with all fixes applied:
- ✅ Fixed bootstrap.js context issue (addon instance not found)
- ✅ Enhanced UI component creation for Zotero 7 compatibility
- ✅ Added floating button fallback for toolbar issues
- ✅ Comprehensive error handling and diagnostic system
- ✅ Professional logging and performance monitoring

**Key Features**:
- Multiple toolbar location attempts
- Floating button as fallback when toolbars unavailable
- Debug mode with full diagnostic reporting
- Improved Zotero 7 compatibility

### Previous Builds

#### `zotero-research-navigator-v2.0.3-fixed.xpi`
- Fixed the critical `ctx._globalThis.addon` undefined error
- Basic functionality restored

#### `zotero-research-navigator-v2.0.3-final.xpi`
- Added professional diagnostic system
- Enhanced initialization robustness

#### `zotero-research-navigator-v2.0.3-refactored.xpi`
- Major refactoring of UI components
- Modularized architecture

#### `zotero-research-navigator-v2.0.2.xpi`
- Initial refactored version
- Base functionality

## Installation

1. Download the latest `.xpi` file (recommended: `v2.0.3-ui-fix.xpi`)
2. In Zotero, go to Tools → Add-ons
3. Click the gear icon → Install Add-on From File
4. Select the downloaded `.xpi` file
5. Restart Zotero

## Troubleshooting

If you don't see the plugin UI:
1. Try the keyboard shortcut: `Ctrl+Shift+H` (Windows/Linux) or `Cmd+Shift+H` (Mac)
2. Check Tools menu → Research Navigator
3. See [UI Troubleshooting Guide](../docs/UI_TROUBLESHOOTING_GUIDE.md)

## Known Issues

- Zotero 7 beta has different toolbar structures that may affect button placement
- Some environments may show a floating button instead of toolbar button
- WebSocket errors are Zotero internal issues, not plugin-related

## Support

For issues or questions:
1. Check the Error Console (Tools → Developer → Error Console)
2. Run diagnostic commands from the troubleshooting guide
3. Report issues with console logs and Zotero version info