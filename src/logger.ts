/// <reference types="@figma/plugin-typings" />

/**
 * Log levels for structured logging
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * Log entry structure
 */
interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  context?: Record<string, unknown>;
  error?: Error;
}

/**
 * Centralized logging service for the plugin
 * Prevents memory leaks by limiting log history
 */
class Logger {
  private logLevel: LogLevel;
  private logs: LogEntry[] = [];
  private readonly maxLogs = 100; // Prevent memory leaks
  private readonly enableConsole = true; // Can be toggled for production

  constructor(logLevel: LogLevel = LogLevel.INFO) {
    this.logLevel = logLevel;
  }

  /**
   * Internal log method that handles all logging
   */
  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    error?: Error
  ): void {
    // Skip if below threshold
    if (level < this.logLevel) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: Date.now(),
      context,
      error,
    };

    // Prevent memory leaks by limiting log history
    if (this.logs.length >= this.maxLogs) {
      this.logs.shift();
    }
    this.logs.push(entry);

    // Output to console with appropriate method
    if (this.enableConsole) {
      // console.debug may not exist in all environments, fallback to console.log
      const ConsoleType = console as unknown as { debug?: typeof console.log };
      const logMethod =
        level === LogLevel.ERROR
          ? console.error
          : level === LogLevel.WARN
          ? console.warn
          : level === LogLevel.DEBUG
          ? (ConsoleType.debug || console.log)
          : console.log;

      const prefix = `[${LogLevel[level]}]`;
      if (error) {
        logMethod(prefix, message, context || '', error);
      } else if (context) {
        logMethod(prefix, message, context);
      } else {
        logMethod(prefix, message);
      }
    }
  }

  /**
   * Log debug message (development only)
   */
  debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Log info message
   */
  info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Log error message
   */
  error(
    message: string,
    error?: Error,
    context?: Record<string, unknown>
  ): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  /**
   * Get all log entries (for debugging)
   */
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Set log level
   */
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  /**
   * Get current log level
   */
  getLogLevel(): LogLevel {
    return this.logLevel;
  }

  /**
   * Get logs filtered by level
   */
  getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter((entry) => entry.level === level);
  }

  /**
   * Get recent error logs
   */
  getRecentErrors(count: number = 10): LogEntry[] {
    return this.logs
      .filter((entry) => entry.level === LogLevel.ERROR)
      .slice(-count);
  }
}

// Export singleton instance
// In development, use DEBUG level; in production, use INFO
export const logger = new Logger(
  // Could be configured via environment or plugin settings
  LogLevel.INFO
);

