# Zotero Research Navigator v2.7.0

## Release Date

2025-01-30

## Download

[zotero-research-navigator-v2.7.0.xpi](./zotero-research-navigator-v2.7.0.xpi)

## What's Fixed

### 1. ✅ Version Update Mechanism

- Fixed version numbering to properly increment from 2.6.x to 2.7.0 (not 2.6.x.xx)
- Added new version update script: `npm run version:update <version>`

### 2. ✅ Bootstrap Tests Registration

- Fixed "runBootstrapTests is not a function" error
- Tests can now be run via: `Zotero.ResearchNavigator.runBootstrapTests()`

### 3. ✅ Quick Note Window Editor

- Fixed Zotero native editor not loading in quick note window
- Now uses the same `<note-editor>` implementation as the toolbar floating window
- Properly displays Zotero's built-in note editor with all features

## Installation

1. Download the XPI file above
2. In Zotero, go to Tools → Add-ons
3. Click the gear icon → Install Add-on From File
4. Select the downloaded XPI file
5. Restart Zotero

## Testing

After installation, you can test the fixes:

1. Click the quick note button to verify the editor loads correctly
2. Open Zotero Console (Tools → Developer → Run JavaScript)
3. Run: `Zotero.ResearchNavigator.runBootstrapTests()`

## Compatibility

- Zotero 7.0+
- All features tested and working
