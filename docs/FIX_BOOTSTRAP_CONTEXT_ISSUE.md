# Bootstrap Context Issue Fix Documentation

## Problem Description

### User Report
The user reported the following error:
```
[Research Navigator] ctx.addon = undefined
[Research Navigator] ctx._globalThis.addon = undefined
[Research Navigator] ERROR: No addon instance found in any expected location
```

Despite the script loading successfully, the addon instance could not be found by bootstrap.js.

### Root Cause Analysis

Through systematic testing, we identified the root cause:

1. **Bootstrap.js behavior**: When loading the plugin script, bootstrap.js creates a context object (`ctx`) and sets `ctx.globalThis = ctx` (circular reference).

2. **Bootstrap.js expectation**: The bootstrap.js checks for addon in this order:
   ```javascript
   const addon = ctx.addon || (ctx._globalThis && ctx._globalThis.addon) || ctx.globalThis.addon;
   ```

3. **Original code issue**: The original code used `BasicTool.getGlobal("globalThis")` which might return the actual global `globalThis` object, not the `ctx` object from bootstrap.js context.

4. **Result**: The addon instance was being set on the wrong object, making `ctx._globalThis` undefined.

## Solution

### Implementation (src/index.ts)

We implemented a comprehensive solution that:

1. Gets the current execution context using `(function() { return this; })()`
2. Detects if we're in bootstrap.js context by checking if `currentContext.globalThis === currentContext`
3. If in bootstrap context, explicitly creates `ctx._globalThis` with the addon instance
4. Sets addon in multiple locations for broader compatibility

```typescript
// Get current execution context
const currentContext = (function() { return this; })();

// Strategy 1: Set addon on the current execution context (ctx in bootstrap.js)
if (currentContext && typeof currentContext === "object") {
  (currentContext as any).addon = addonInstance;
  (currentContext as any).ztoolkit = addonInstance.ztoolkit;
  
  // CRITICAL FIX: Handle bootstrap.js expectation of ctx._globalThis.addon
  if (currentContext.globalThis === currentContext) {
    // We're in bootstrap.js context
    currentContext._globalThis = {
      addon: addonInstance,
      ztoolkit: addonInstance.ztoolkit
    };
  }
}
```

### Testing

We created comprehensive tests to verify the fix:

1. **test-fix-verification.cjs**: Verifies that `ctx._globalThis.addon` is correctly set
2. **test-complete-lifecycle.cjs**: Simulates the complete plugin lifecycle from bootstrap to startup

### Results

✅ **Fix Verified**: All tests pass, confirming:
- `ctx._globalThis` is now properly created
- `ctx._globalThis.addon` contains the addon instance
- Bootstrap.js can successfully find the addon
- Plugin lifecycle completes successfully

## Key Learnings

1. **Context matters**: In Zotero plugin development, understanding the execution context is crucial
2. **Bootstrap.js specifics**: The way bootstrap.js loads scripts creates a unique environment that must be handled
3. **Multiple registration points**: Setting addon in multiple locations increases compatibility
4. **Testing is essential**: Simulating the exact bootstrap environment helped identify the precise issue

## Files Modified

- `src/index.ts`: Added bootstrap context detection and `_globalThis` setup
- Created test files: `test/test-fix-verification.cjs`, `test/test-complete-lifecycle.cjs`
- Built and tested: `zotero-research-navigator-v2.0.3-fixed.xpi`

## Verification Commands

```bash
# Run fix verification test
node test/test-fix-verification.cjs

# Run complete lifecycle test  
node test/test-complete-lifecycle.cjs

# Build production version
npm run build-prod
```