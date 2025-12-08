# Enterprise Improvements Implementation Guide

This guide shows how to integrate the new enterprise-grade improvements into the existing codebase.

## Quick Start

The following improvements have been implemented:

1. ✅ **Structured Error Handling** (`src/errors.ts`)
2. ✅ **Centralized Logging** (`src/logger.ts`)
3. ✅ **Enhanced Validation** (`src/validation.ts`)
4. ✅ **Resilience Patterns** (`src/resilience.ts`)
5. ✅ **Manifest Enhancement** (`manifest.json` - added `documentAccess`)

## Integration Steps

### Step 1: Update Error Handling in `src/code.tsx`

Replace existing error handling with structured errors:

```typescript
// At the top of code.tsx, add imports:
import { createError, extractErrorInfo, ErrorCode } from './errors';
import { logger } from './logger';
import { validateCSVComprehensive, validateAndNormalizeJiraUrl } from './validation';

// Replace existing error handling:
// OLD:
catch (error) {
  const errorMessage = getErrorMessage(error);
  figma.notify(`❌ Error: ${errorMessage}`);
}

// NEW:
catch (error) {
  const errorInfo = extractErrorInfo(error);
  logger.error('Operation failed', error instanceof Error ? error : new Error(String(error)), {
    code: errorInfo.code,
    context: errorInfo.context
  });
  figma.notify(`❌ ${errorInfo.message}`);
}
```

### Step 2: Update CSV Validation

Replace `validateCSVText` calls with comprehensive validation:

```typescript
// OLD:
validateCSVText(csvText);

// NEW:
const validationResult = validateCSVComprehensive(csvText);
if (!validationResult.isValid) {
  throw createError(
    ErrorCode.CSV_VALIDATION_ERROR,
    validationResult.errors.join('; '),
    { warnings: validationResult.warnings }
  );
}
if (validationResult.warnings.length > 0) {
  logger.warn('CSV validation warnings', { warnings: validationResult.warnings });
}
```

### Step 3: Update Jira URL Validation

```typescript
// OLD:
const jiraBaseUrl = msg.jiraBaseUrl;

// NEW:
let jiraBaseUrl: string | undefined;
if (msg.jiraBaseUrl) {
  try {
    jiraBaseUrl = validateAndNormalizeJiraUrl(msg.jiraBaseUrl);
  } catch (error) {
    logger.error('Invalid Jira URL provided', error instanceof Error ? error : undefined);
    figma.notify('❌ Invalid Jira URL format. Please use HTTPS URL.');
    return;
  }
}
```

### Step 4: Add Logging to Key Operations

```typescript
// Add logging at the start of major operations:
async function importCardsFromCSV(csvText: string, jiraBaseUrl?: string): Promise<void> {
  logger.info('Starting CSV import', {
    csvLength: csvText.length,
    hasJiraUrl: !!jiraBaseUrl
  });
  
  try {
    // ... existing code ...
    logger.info('CSV import completed successfully', { cardCount: cardsCreated });
  } catch (error) {
    logger.error('CSV import failed', error instanceof Error ? error : undefined);
    throw error;
  }
}
```

### Step 5: Add Retry Logic for Critical Operations

For operations that might fail transiently (like font loading):

```typescript
import { withRetry } from './resilience';
import { ErrorCode } from './errors';

// Wrap font loading with retry:
await withRetry(
  () => ensureFontsLoaded(),
  {
    maxAttempts: 3,
    delayMs: 500,
    retryableErrors: [ErrorCode.FONT_LOAD_ERROR]
  }
);
```

### Step 6: Update utils.ts to Use New Error System

```typescript
// In src/utils.ts, replace validateCSVText:
import { validateCSVComprehensive, createError, ErrorCode } from './validation';

export function validateCSVText(csvText: string): void {
  const result = validateCSVComprehensive(csvText);
  if (!result.isValid) {
    throw createError(
      ErrorCode.CSV_VALIDATION_ERROR,
      result.errors.join('; '),
      { warnings: result.warnings }
    );
  }
}
```

## Example: Complete Function Refactor

Here's an example of how to refactor a function with all improvements:

### Before:
```typescript
async function importCardsFromCSV(csvText: string, jiraBaseUrl?: string): Promise<void> {
  try {
    validateCSVText(csvText);
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    figma.notify(`❌ CSV validation error: ${errorMessage}`);
    return;
  }
  
  let issues: Array<{ [key: string]: string }>;
  try {
    issues = parseCSV(csvText);
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    figma.notify(`❌ Error parsing CSV: ${errorMessage}`);
    return;
  }
  
  // ... rest of function
}
```

### After:
```typescript
import { logger } from './logger';
import { createError, extractErrorInfo, ErrorCode } from './errors';
import { validateCSVComprehensive, validateAndNormalizeJiraUrl } from './validation';
import { withRetry } from './resilience';

async function importCardsFromCSV(csvText: string, jiraBaseUrl?: string): Promise<void> {
  logger.info('Starting CSV import', {
    csvLength: csvText.length,
    hasJiraUrl: !!jiraBaseUrl
  });

  // Comprehensive validation
  const validationResult = validateCSVComprehensive(csvText);
  if (!validationResult.isValid) {
    const error = createError(
      ErrorCode.CSV_VALIDATION_ERROR,
      validationResult.errors.join('; '),
      { warnings: validationResult.warnings }
    );
    logger.error('CSV validation failed', error);
    figma.notify(`❌ CSV validation error: ${error.message}`);
    throw error;
  }

  if (validationResult.warnings.length > 0) {
    logger.warn('CSV validation warnings', { warnings: validationResult.warnings });
  }

  // Validate and normalize Jira URL if provided
  let normalizedJiraUrl: string | undefined;
  if (jiraBaseUrl) {
    try {
      normalizedJiraUrl = validateAndNormalizeJiraUrl(jiraBaseUrl);
    } catch (error) {
      logger.error('Invalid Jira URL', error instanceof Error ? error : undefined);
      figma.notify('❌ Invalid Jira URL format');
      throw error;
    }
  }

  // Parse CSV with error handling
  let issues: Array<{ [key: string]: string }>;
  try {
    issues = parseCSV(csvText);
    logger.info('CSV parsed successfully', { rowCount: issues.length });
  } catch (error) {
    const errorInfo = extractErrorInfo(error);
    logger.error('CSV parsing failed', error instanceof Error ? error : undefined, {
      code: errorInfo.code
    });
    throw createError(
      ErrorCode.CSV_PARSE_ERROR,
      `Failed to parse CSV: ${errorInfo.message}`,
      errorInfo.context
    );
  }

  // ... rest of function with logging at key points
}
```

## Testing the Improvements

### Test Error Handling
```typescript
// Test that errors are properly structured
try {
  throw createError(ErrorCode.CSV_VALIDATION_ERROR, 'Test error', { test: true });
} catch (error) {
  if (isPluginError(error)) {
    console.log('Error code:', error.code);
    console.log('Error message:', error.message);
    console.log('Error context:', error.context);
  }
}
```

### Test Logging
```typescript
// Logging should appear in console
logger.debug('Debug message', { data: 'test' });
logger.info('Info message', { data: 'test' });
logger.warn('Warning message', { data: 'test' });
logger.error('Error message', new Error('test'), { data: 'test' });

// Get recent errors
const recentErrors = logger.getRecentErrors(5);
console.log('Recent errors:', recentErrors);
```

### Test Validation
```typescript
// Test CSV validation
const result = validateCSVComprehensive('header1,header2\nvalue1,value2');
console.log('Valid:', result.isValid);
console.log('Errors:', result.errors);
console.log('Warnings:', result.warnings);

// Test URL validation
const isValid = validateJiraUrl('https://company.atlassian.net');
console.log('URL valid:', isValid);
```

## Migration Checklist

- [ ] Update all error handling to use `extractErrorInfo` and `createError`
- [ ] Replace `validateCSVText` with `validateCSVComprehensive`
- [ ] Add Jira URL validation using `validateAndNormalizeJiraUrl`
- [ ] Add logging to major operations
- [ ] Add retry logic to critical operations (font loading, storage)
- [ ] Update `getErrorMessage` in utils.ts to use new error system
- [ ] Test all error paths
- [ ] Verify logging output in console
- [ ] Test with invalid inputs
- [ ] Test with edge cases

## Benefits

After implementing these changes:

1. **Better Error Tracking**: All errors have structured codes and context
2. **Improved Debugging**: Centralized logging makes troubleshooting easier
3. **Enhanced Security**: Better input validation prevents XSS and injection
4. **Better Reliability**: Retry logic handles transient failures
5. **Performance**: Dynamic page loading improves performance with large files
6. **Maintainability**: Structured code is easier to maintain and extend

## Next Steps

1. Implement the integration steps above
2. Test thoroughly with various inputs
3. Monitor logs in production
4. Consider adding performance monitoring (see ENTERPRISE_REVIEW.md)
5. Add unit tests for new modules

