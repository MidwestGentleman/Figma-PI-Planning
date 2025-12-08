# Remaining Work - Action Plan

## Status Overview

✅ **Completed:**
- Enterprise review documentation
- New infrastructure modules (errors.ts, logger.ts, validation.ts, resilience.ts)
- Manifest.json enhancement (documentAccess)
- Implementation guides

⏳ **Remaining:**
- Integration of new modules into existing codebase
- Testing and validation
- Optional Phase 2/3 improvements

## Priority 1: Core Integration (Required)

### 1.1 Update Error Handling in `src/code.tsx`
**Status:** Not Started  
**Effort:** ~30 minutes  
**Files:** `src/code.tsx`

**Tasks:**
- [ ] Import new error handling modules at top of file
- [ ] Replace all `getErrorMessage(error)` calls with `extractErrorInfo(error)`
- [ ] Replace all `console.log/error/warn` with `logger` calls
- [ ] Update error notifications to use structured errors
- [ ] Add error context where helpful

**Locations to update:**
- Line ~3424: `console.log('Received message:', msg)` → `logger.info('Received message', { type: msg.type })`
- Line ~3434-3436: Error handling in `insert-template` handler
- Line ~3441-3447: Error handling in `import-csv` handler
- Line ~3454-3456: Error handling in `export-csv` handler
- Line ~3466: Error handling in `get-jira-url` handler
- Line ~1733: CSV validation error
- Line ~1744: CSV parsing error
- Line ~1750: No data found error
- Line ~1760: Font loading error
- Line ~1799: No teams found error
- Line ~1806: No valid sprints warning
- Line ~2317: Progress notification
- Line ~3246: No template cards error
- Line ~3416: Export success notification

**Example transformation:**
```typescript
// BEFORE:
catch (error) {
  const errorMessage = getErrorMessage(error);
  figma.notify(`❌ Error: ${errorMessage}`);
  console.error('Error:', error);
}

// AFTER:
catch (error) {
  const errorInfo = extractErrorInfo(error);
  logger.error('Operation failed', error instanceof Error ? error : new Error(String(error)), {
    code: errorInfo.code,
    context: errorInfo.context
  });
  figma.notify(`❌ ${errorInfo.message}`);
}
```

### 1.2 Update Validation in `src/code.tsx`
**Status:** Not Started  
**Effort:** ~20 minutes  
**Files:** `src/code.tsx`

**Tasks:**
- [ ] Replace `validateCSVText()` with `validateCSVComprehensive()`
- [ ] Add Jira URL validation using `validateAndNormalizeJiraUrl()`
- [ ] Handle validation warnings appropriately

**Locations:**
- Line ~1730: `validateCSVText(csvText)` → Use comprehensive validation
- Line ~3443: Add Jira URL validation before passing to `importCardsFromCSV`

### 1.3 Update `src/utils.ts`
**Status:** Not Started  
**Effort:** ~15 minutes  
**Files:** `src/utils.ts`

**Tasks:**
- [ ] Update `validateCSVText()` to use new validation system (or deprecate)
- [ ] Update `getErrorMessage()` to use `extractErrorInfo()` (or deprecate)
- [ ] Add logging to utility functions where appropriate

**Options:**
1. **Keep for backward compatibility** - Have them call new functions internally
2. **Deprecate** - Mark as deprecated and update all callers
3. **Remove** - Replace all usages and remove

**Recommended:** Option 1 (backward compatibility wrapper)

### 1.4 Update `src/card-creation.ts`
**Status:** Not Started  
**Effort:** ~15 minutes  
**Files:** `src/card-creation.ts`

**Tasks:**
- [ ] Replace `console.warn` with `logger.warn`
- [ ] Replace `console.error` with `logger.error`
- [ ] Add error context to card creation errors
- [ ] Use structured errors for validation failures

**Locations:**
- Line ~244: Font loading warning
- Line ~275: Hyperlink error
- Line ~298: Font loading warning
- Line ~320: Font loading warning
- Line ~467: Font loading warning
- Line ~497: Hyperlink error
- Line ~601: Font loading warning
- Line ~634: Font loading warning
- Line ~667: Font loading warning

### 1.5 Add Retry Logic for Critical Operations
**Status:** Not Started  
**Effort:** ~20 minutes  
**Files:** `src/code.tsx`, `src/utils.ts`

**Tasks:**
- [ ] Wrap font loading with retry logic
- [ ] Wrap storage operations with retry logic
- [ ] Add appropriate retry configurations

**Locations:**
- `ensureFontsLoaded()` in `src/utils.ts` - Add retry wrapper
- `figma.clientStorage.getAsync/setAsync` calls - Add retry wrapper

## Priority 2: Testing & Validation (Recommended)

### 2.1 Manual Testing
**Status:** Not Started  
**Effort:** ~1 hour

**Test Cases:**
- [ ] Test error handling with invalid inputs
- [ ] Test CSV import with various file sizes
- [ ] Test Jira URL validation (valid/invalid URLs)
- [ ] Test logging output in console
- [ ] Test retry logic with simulated failures
- [ ] Test error notifications display correctly
- [ ] Test with edge cases (empty CSV, malformed data, etc.)

### 2.2 Integration Testing
**Status:** Not Started  
**Effort:** ~30 minutes

**Test Scenarios:**
- [ ] Full workflow: Import CSV → Export CSV
- [ ] Error recovery: Invalid CSV → Correct CSV
- [ ] Performance: Large CSV import (1000+ rows)
- [ ] Memory: Multiple imports/exports

## Priority 3: Optional Enhancements (Future)

### 3.1 Performance Monitoring
**Status:** Not Started  
**Effort:** ~2 hours  
**Files:** `src/performance.ts` (to be created)

**Tasks:**
- [ ] Create performance monitoring module
- [ ] Add tracking to key operations
- [ ] Display performance metrics in logs
- [ ] Add performance warnings for slow operations

### 3.2 Progress Tracking
**Status:** Not Started  
**Effort:** ~1.5 hours  
**Files:** `src/progress.ts` (to be created)

**Tasks:**
- [ ] Create progress tracking module
- [ ] Add progress updates to CSV import
- [ ] Add progress updates to card creation
- [ ] Update UI with progress information

### 3.3 Configuration Management
**Status:** Not Started  
**Effort:** ~1 hour  
**Files:** `src/config-manager.ts` (to be created)

**Tasks:**
- [ ] Create configuration manager
- [ ] Add environment detection
- [ ] Add feature flags
- [ ] Add runtime configuration

### 3.4 Testing Infrastructure
**Status:** Not Started  
**Effort:** ~3-4 hours

**Tasks:**
- [ ] Set up Jest or Vitest
- [ ] Write unit tests for utilities
- [ ] Write unit tests for validation
- [ ] Write unit tests for error handling
- [ ] Write integration tests for workflows

## Quick Start: Integration Checklist

### Step 1: Update Imports (5 minutes)
```typescript
// At top of src/code.tsx, add:
import { createError, extractErrorInfo, ErrorCode, isPluginError } from './errors';
import { logger } from './logger';
import { validateCSVComprehensive, validateAndNormalizeJiraUrl } from './validation';
import { withRetry } from './resilience';
```

### Step 2: Replace Error Handling (15 minutes)
- Find all `getErrorMessage` calls → Replace with `extractErrorInfo`
- Find all `console.log/error/warn` → Replace with `logger` methods
- Update error notifications to use structured errors

### Step 3: Update Validation (10 minutes)
- Replace `validateCSVText` with `validateCSVComprehensive`
- Add Jira URL validation

### Step 4: Add Logging (10 minutes)
- Add `logger.info()` at start of major operations
- Add `logger.error()` in all catch blocks
- Add `logger.warn()` for warnings

### Step 5: Test (30 minutes)
- Test all error paths
- Verify logging output
- Test with invalid inputs

**Total Estimated Time:** ~1.5 hours for core integration

## Files That Need Updates

### High Priority
1. `src/code.tsx` - Main plugin code (60+ locations)
2. `src/utils.ts` - Utility functions (3 locations)
3. `src/card-creation.ts` - Card creation (9 locations)

### Medium Priority
4. `src/types.ts` - Type definitions (may need updates)
5. `ui.html` - UI code (may need error handling updates)

### Low Priority
6. Documentation updates
7. README updates

## Current Code Statistics

- **Console.log/error/warn calls:** ~60 instances
- **getErrorMessage calls:** ~10 instances
- **validateCSVText calls:** ~2 instances
- **Error handling blocks:** ~15 locations

## Recommended Approach

1. **Start Small:** Update one function at a time
2. **Test Frequently:** Test after each major change
3. **Use Find & Replace:** For common patterns (with care)
4. **Keep Backward Compatibility:** Update utils.ts to wrap new functions
5. **Document Changes:** Note any behavior changes

## Success Criteria

✅ All error handling uses structured errors  
✅ All logging uses centralized logger  
✅ All validation uses enhanced validation  
✅ All critical operations have retry logic  
✅ No console.log/error/warn in production code  
✅ All tests pass  
✅ Plugin works as before with better error handling

## Estimated Timeline

- **Priority 1 (Core Integration):** 1.5-2 hours
- **Priority 2 (Testing):** 1-1.5 hours
- **Priority 3 (Enhancements):** 5-8 hours (optional)

**Total for Core Work:** ~2.5-3.5 hours  
**Total with Enhancements:** ~8-12 hours

