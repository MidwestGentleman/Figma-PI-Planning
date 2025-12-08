# Enterprise-Grade Code Review & Improvement Recommendations

## Executive Summary

This document provides a comprehensive review of the PI Planning FigJam Plugin codebase with enterprise-grade improvement recommendations. The codebase demonstrates good structure and organization, but several enhancements are recommended for enterprise deployment.

## Current Strengths

✅ **Modular Architecture**: Well-organized code with clear separation of concerns  
✅ **TypeScript Strict Mode**: Type safety enabled  
✅ **Error Handling**: Basic error handling with user notifications  
✅ **Async Operations**: Proper use of async/await  
✅ **Font Loading Optimization**: Cached font loading to prevent redundant operations  
✅ **Batch Processing**: Large CSV imports processed in batches  
✅ **Security**: Network access properly restricted in manifest  

## Critical Improvements

### 1. Manifest Configuration Enhancements

**Current State**: Missing `documentAccess` field  
**Impact**: Performance degradation with large files  
**Recommendation**: Add dynamic page loading

```json
{
  "name": "PI Planning Templates",
  "id": "pi-planning-templates",
  "api": "1.0.0",
  "main": "code.js",
  "ui": "ui.html",
  "editorType": ["figjam"],
  "documentAccess": "dynamic-page",
  "networkAccess": {
    "allowedDomains": ["none"]
  },
  "permissions": []
}
```

### 2. Error Handling & Logging Strategy

**Current State**: Basic error handling with console logging  
**Impact**: Difficult to diagnose production issues  
**Recommendations**:

#### 2.1 Structured Error Types

Create a comprehensive error handling system:

```typescript
// src/errors.ts
export enum ErrorCode {
  CSV_PARSE_ERROR = 'CSV_PARSE_ERROR',
  CSV_VALIDATION_ERROR = 'CSV_VALIDATION_ERROR',
  FONT_LOAD_ERROR = 'FONT_LOAD_ERROR',
  CARD_CREATION_ERROR = 'CARD_CREATION_ERROR',
  STORAGE_ERROR = 'STORAGE_ERROR',
  INVALID_TEMPLATE_TYPE = 'INVALID_TEMPLATE_TYPE',
  COORDINATE_OUT_OF_BOUNDS = 'COORDINATE_OUT_OF_BOUNDS',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export class PluginError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'PluginError';
  }
}

export function createError(
  code: ErrorCode,
  message: string,
  context?: Record<string, unknown>
): PluginError {
  return new PluginError(code, message, context);
}
```

#### 2.2 Centralized Logging Service

```typescript
// src/logger.ts
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  context?: Record<string, unknown>;
  error?: Error;
}

class Logger {
  private logLevel: LogLevel;
  private logs: LogEntry[] = [];
  private maxLogs = 100; // Prevent memory leaks

  constructor(logLevel: LogLevel = LogLevel.INFO) {
    this.logLevel = logLevel;
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>, error?: Error): void {
    if (level < this.logLevel) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: Date.now(),
      context,
      error
    };

    // Prevent memory leaks by limiting log history
    if (this.logs.length >= this.maxLogs) {
      this.logs.shift();
    }
    this.logs.push(entry);

    // Output to console with appropriate method
    const logMethod = level === LogLevel.ERROR ? console.error :
                     level === LogLevel.WARN ? console.warn :
                     level === LogLevel.DEBUG ? console.debug :
                     console.log;

    logMethod(`[${LogLevel[level]}] ${message}`, context || '', error || '');
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
  }
}

export const logger = new Logger(
  process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO
);
```

### 3. Input Validation & Sanitization

**Current State**: Basic validation exists, but could be more comprehensive  
**Recommendations**:

#### 3.1 Enhanced CSV Validation

```typescript
// src/validation.ts
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateCSVComprehensive(csvText: string): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: []
  };

  // Size validation
  if (csvText.length > VALIDATION_CONFIG.MAX_CSV_SIZE) {
    result.isValid = false;
    result.errors.push(`CSV exceeds maximum size of ${VALIDATION_CONFIG.MAX_CSV_SIZE} bytes`);
  }

  // Encoding validation
  try {
    // Check for valid UTF-8
    decodeURIComponent(escape(csvText));
  } catch (e) {
    result.isValid = false;
    result.errors.push('CSV contains invalid character encoding');
  }

  // Structure validation
  const lines = csvText.split('\n');
  if (lines.length < 2) {
    result.isValid = false;
    result.errors.push('CSV must contain at least a header and one data row');
  }

  // Check for suspicious patterns (potential injection)
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(csvText)) {
      result.warnings.push('CSV contains potentially unsafe content');
      break;
    }
  }

  return result;
}
```

#### 3.2 URL Validation

```typescript
export function validateJiraUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  
  try {
    const parsed = new URL(url);
    // Ensure it's HTTPS for security
    if (parsed.protocol !== 'https:') return false;
    // Validate domain format
    if (!parsed.hostname.includes('.')) return false;
    return true;
  } catch {
    return false;
  }
}
```

### 4. Performance Monitoring & Metrics

**Recommendation**: Add performance tracking

```typescript
// src/performance.ts
interface PerformanceMetric {
  operation: string;
  duration: number;
  timestamp: number;
  success: boolean;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private maxMetrics = 50;

  track<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    return fn()
      .then(result => {
        this.record(operation, performance.now() - start, true);
        return result;
      })
      .catch(error => {
        this.record(operation, performance.now() - start, false);
        throw error;
      });
  }

  private record(operation: string, duration: number, success: boolean): void {
    if (this.metrics.length >= this.maxMetrics) {
      this.metrics.shift();
    }
    this.metrics.push({
      operation,
      duration,
      timestamp: Date.now(),
      success
    });
  }

  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  getAverageDuration(operation: string): number {
    const operationMetrics = this.metrics.filter(m => m.operation === operation);
    if (operationMetrics.length === 0) return 0;
    const sum = operationMetrics.reduce((acc, m) => acc + m.duration, 0);
    return sum / operationMetrics.length;
  }
}

export const performanceMonitor = new PerformanceMonitor();
```

### 5. Retry Logic & Resilience

**Recommendation**: Add retry mechanism for critical operations

```typescript
// src/resilience.ts
export interface RetryOptions {
  maxAttempts?: number;
  delayMs?: number;
  backoffMultiplier?: number;
  retryableErrors?: string[];
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    delayMs = 1000,
    backoffMultiplier = 2,
    retryableErrors = []
  } = options;

  let lastError: Error | null = null;
  let currentDelay = delayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Check if error is retryable
      const isRetryable = retryableErrors.length === 0 ||
        retryableErrors.some(code => lastError?.message.includes(code));

      if (attempt === maxAttempts || !isRetryable) {
        throw lastError;
      }

      // Wait before retry with exponential backoff
      await new Promise(resolve => setTimeout(resolve, currentDelay));
      currentDelay *= backoffMultiplier;
    }
  }

  throw lastError || new Error('Retry failed');
}
```

### 6. Memory Management

**Current State**: No explicit memory management  
**Recommendations**:

```typescript
// src/memory.ts
class MemoryManager {
  private cleanupCallbacks: Array<() => void> = [];

  registerCleanup(callback: () => void): void {
    this.cleanupCallbacks.push(callback);
  }

  cleanup(): void {
    this.cleanupCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('Cleanup error:', error);
      }
    });
    this.cleanupCallbacks = [];
  }

  // Monitor memory usage (if available)
  getMemoryUsage(): { used: number; total: number } | null {
    // Figma API doesn't expose memory directly, but we can track our own usage
    return null;
  }
}

export const memoryManager = new MemoryManager();

// Register cleanup on plugin close
figma.on('close', () => {
  memoryManager.cleanup();
});
```

### 7. Configuration Management

**Recommendation**: Environment-aware configuration

```typescript
// src/config-manager.ts
export interface AppConfig {
  version: string;
  environment: 'development' | 'production' | 'staging';
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  maxBatchSize: number;
  enablePerformanceTracking: boolean;
  enableErrorReporting: boolean;
}

class ConfigManager {
  private config: AppConfig;

  constructor() {
    // Read from package.json or environment
    const packageJson = require('../package.json');
    this.config = {
      version: packageJson.version || '1.0.0',
      environment: this.getEnvironment(),
      logLevel: this.getEnvironment() === 'development' ? 'debug' : 'info',
      maxBatchSize: IMPORT_CONFIG.BATCH_SIZE,
      enablePerformanceTracking: true,
      enableErrorReporting: this.getEnvironment() === 'production'
    };
  }

  private getEnvironment(): 'development' | 'production' | 'staging' {
    // Could be set via plugin data or other mechanism
    return 'production';
  }

  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.config[key];
  }

  getAll(): AppConfig {
    return { ...this.config };
  }
}

export const configManager = new ConfigManager();
```

### 8. User Feedback & Progress Tracking

**Current State**: Basic notifications  
**Recommendation**: Enhanced progress tracking

```typescript
// src/progress.ts
export interface ProgressUpdate {
  current: number;
  total: number;
  message: string;
  percentage: number;
}

class ProgressTracker {
  private currentProgress: ProgressUpdate | null = null;
  private updateCallback?: (progress: ProgressUpdate) => void;

  setUpdateCallback(callback: (progress: ProgressUpdate) => void): void {
    this.updateCallback = callback;
  }

  update(current: number, total: number, message: string): void {
    const percentage = Math.round((current / total) * 100);
    this.currentProgress = { current, total, message, percentage };
    
    if (this.updateCallback) {
      this.updateCallback(this.currentProgress);
    }

    // Also update Figma notification
    figma.notify(`${message} (${current}/${total})`, {
      timeout: 1000
    });
  }

  complete(message: string): void {
    if (this.currentProgress) {
      figma.notify(`✅ ${message}`, { timeout: 3000 });
    }
    this.currentProgress = null;
  }

  getCurrentProgress(): ProgressUpdate | null {
    return this.currentProgress;
  }
}

export const progressTracker = new ProgressTracker();
```

### 9. Type Safety Enhancements

**Recommendation**: Stricter type definitions

```typescript
// src/types.ts - Enhanced
export type TemplateType = keyof typeof TEMPLATES;

// Use branded types for better type safety
export type IssueKey = string & { readonly __brand: 'IssueKey' };
export type JiraUrl = string & { readonly __brand: 'JiraUrl' };

export function createIssueKey(value: string): IssueKey {
  if (!value || value.trim() === '') {
    throw new Error('Issue key cannot be empty');
  }
  return value.trim() as IssueKey;
}

export function createJiraUrl(value: string): JiraUrl {
  if (!validateJiraUrl(value)) {
    throw new Error('Invalid Jira URL');
  }
  return value as JiraUrl;
}
```

### 10. Testing Infrastructure

**Recommendation**: Add unit testing framework

```typescript
// tests/utils.test.ts (example)
import { validateCSVText, sanitizeFieldValue } from '../src/utils';
import { VALIDATION_CONFIG } from '../src/config';

describe('Utils', () => {
  describe('validateCSVText', () => {
    it('should reject empty string', () => {
      expect(() => validateCSVText('')).toThrow();
    });

    it('should reject oversized CSV', () => {
      const largeCsv = 'a'.repeat(VALIDATION_CONFIG.MAX_CSV_SIZE + 1);
      expect(() => validateCSVText(largeCsv)).toThrow();
    });
  });

  describe('sanitizeFieldValue', () => {
    it('should truncate long values', () => {
      const longValue = 'a'.repeat(1000);
      const result = sanitizeFieldValue(longValue, 100);
      expect(result.length).toBe(100);
    });
  });
});
```

### 11. Documentation

**Recommendations**:
- Add JSDoc comments to all public functions
- Create API documentation
- Add architecture decision records (ADRs)
- Document error codes and recovery strategies

### 12. Accessibility

**Recommendation**: Enhance UI accessibility

```html
<!-- ui.html improvements -->
<button 
  id="export-new-btn" 
  class="export-button"
  aria-label="Export new cards to CSV"
  aria-describedby="export-new-description">
  Export New
</button>
<span id="export-new-description" class="sr-only">
  Exports only cards that have not been exported before
</span>
```

### 13. Version Management

**Recommendation**: Add version tracking in plugin data

```typescript
// src/version.ts
export const PLUGIN_VERSION = '1.0.0';

export async function checkVersionMigration(): Promise<void> {
  const storedVersion = await figma.clientStorage.getAsync('pluginVersion');
  
  if (!storedVersion) {
    // First run
    await figma.clientStorage.setAsync('pluginVersion', PLUGIN_VERSION);
    return;
  }

  if (storedVersion !== PLUGIN_VERSION) {
    // Perform migration if needed
    await migrateData(storedVersion, PLUGIN_VERSION);
    await figma.clientStorage.setAsync('pluginVersion', PLUGIN_VERSION);
  }
}

async function migrateData(fromVersion: string, toVersion: string): Promise<void> {
  // Handle data migrations between versions
  logger.info(`Migrating from ${fromVersion} to ${toVersion}`);
}
```

## Implementation Priority

### Phase 1 (Critical - Immediate)
1. ✅ Add `documentAccess: "dynamic-page"` to manifest
2. ✅ Implement structured error handling
3. ✅ Add comprehensive input validation
4. ✅ Implement logging service

### Phase 2 (High Priority - Next Sprint)
5. ✅ Add performance monitoring
6. ✅ Implement retry logic
7. ✅ Add progress tracking
8. ✅ Enhance type safety

### Phase 3 (Medium Priority - Future)
9. ✅ Add testing infrastructure
10. ✅ Implement memory management
11. ✅ Add configuration management
12. ✅ Enhance documentation

### Phase 4 (Nice to Have)
13. ✅ Add accessibility improvements
14. ✅ Implement version management
15. ✅ Add telemetry/analytics (if needed)

## Code Quality Metrics

### Current State
- **TypeScript Coverage**: ~95%
- **Error Handling**: Basic
- **Test Coverage**: 0%
- **Documentation**: Moderate
- **Performance Monitoring**: None

### Target State
- **TypeScript Coverage**: 100%
- **Error Handling**: Comprehensive
- **Test Coverage**: >80%
- **Documentation**: Comprehensive
- **Performance Monitoring**: Full

## Security Checklist

- ✅ Network access restricted
- ✅ Input validation in place
- ⚠️ XSS prevention (needs enhancement)
- ⚠️ URL validation (needs enhancement)
- ✅ No external dependencies with known vulnerabilities
- ⚠️ Error messages don't leak sensitive data (review needed)

## Performance Targets

- **CSV Import (1000 rows)**: < 30 seconds
- **Card Creation**: < 500ms per card
- **Font Loading**: Cached after first load
- **Memory Usage**: < 50MB for typical usage
- **UI Responsiveness**: No blocking operations > 100ms

## Monitoring & Observability

### Recommended Metrics
1. Operation success/failure rates
2. Average operation duration
3. Error frequency by type
4. Memory usage trends
5. User action patterns

### Recommended Alerts
1. Error rate > 5%
2. Operation duration > 10s
3. Memory usage > 100MB
4. Repeated failures for same operation

## Conclusion

The codebase demonstrates solid engineering practices but would benefit from the enterprise-grade enhancements outlined above. Prioritize Phase 1 improvements for immediate impact, followed by Phase 2 for enhanced reliability and observability.

