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
  private readonly maxLogs = 100;
  private readonly enableConsole = true;

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
    if (level < this.logLevel) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: Date.now(),
      context,
      error,
    };

    if (this.logs.length >= this.maxLogs) {
      this.logs.shift();
    }
    this.logs.push(entry);

    if (this.enableConsole) {
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

  debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(
    message: string,
    error?: Error,
    context?: Record<string, unknown>
  ): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
  }

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  getLogLevel(): LogLevel {
    return this.logLevel;
  }

  getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter((entry) => entry.level === level);
  }

  getRecentErrors(count: number = 10): LogEntry[] {
    return this.logs
      .filter((entry) => entry.level === LogLevel.ERROR)
      .slice(-count);
  }
}

export const logger = new Logger(LogLevel.INFO);

