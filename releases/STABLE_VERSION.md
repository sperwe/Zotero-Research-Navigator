# Stable Version - v2.0.3-tabs-fixed

## Date: 2024-12-27

## File: addon/bootstrap-stable.js (copy of bootstrap-tabs-fixed.js)

### Working Features:

- ✅ Tab event listening (add, close, select)
- ✅ Initialize from existing tabs
- ✅ Basic tree history panel
- ✅ Session management
- ✅ Debug logging
- ✅ Tree structure with parent-child relationships
- ✅ Relation type detection
- ✅ Navigation buttons (back, forward, parent)

### Known Issues to Fix:

1. Item opening function (opens in library instead of tab)
2. Panel needs beautification
3. Panel cannot be resized
4. Content scrolling issues in panel

### Build Command:

```bash
cp addon/bootstrap-stable.js addon/bootstrap.js && npx zotero-plugin build
```
