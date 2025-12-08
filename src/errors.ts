/// <reference types="@figma/plugin-typings" />

/**
 * Error codes for structured error handling
 */
export enum ErrorCode {
  CSV_PARSE_ERROR = 'CSV_PARSE_ERROR',
  CSV_VALIDATION_ERROR = 'CSV_VALIDATION_ERROR',
  FONT_LOAD_ERROR = 'FONT_LOAD_ERROR',
  CARD_CREATION_ERROR = 'CARD_CREATION_ERROR',
  STORAGE_ERROR = 'STORAGE_ERROR',
  INVALID_TEMPLATE_TYPE = 'INVALID_TEMPLATE_TYPE',
  COORDINATE_OUT_OF_BOUNDS = 'COORDINATE_OUT_OF_BOUNDS',
  NETWORK_ERROR = 'NETWORK_ERROR',
  INVALID_URL = 'INVALID_URL',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Custom error class for plugin errors with structured information
 */
export class PluginError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'PluginError';
    
    // Maintains proper stack trace for where error was thrown (V8 only)
    // TypeScript doesn't recognize captureStackTrace, so we use type assertion
    const ErrorConstructor = Error as unknown as {
      captureStackTrace?: (error: Error, constructor: typeof PluginError) => void;
    };
    if (ErrorConstructor.captureStackTrace) {
      ErrorConstructor.captureStackTrace(this, PluginError);
    }
  }

  /**
   * Converts error to a user-friendly message
   */
  toUserMessage(): string {
    const baseMessage = this.message;
    
    // Add context information if available
    if (this.context) {
      const contextStr = Object.entries(this.context)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
      return `${baseMessage} (${contextStr})`;
    }
    
    return baseMessage;
  }
}

/**
 * Creates a PluginError with the specified code and message
 */
export function createError(
  code: ErrorCode,
  message: string,
  context?: Record<string, unknown>
): PluginError {
  return new PluginError(code, message, context);
}

/**
 * Checks if an error is a PluginError
 */
export function isPluginError(error: unknown): error is PluginError {
  return error instanceof PluginError;
}

/**
 * Safely extracts error information from unknown error type
 */
export function extractErrorInfo(error: unknown): {
  code: ErrorCode;
  message: string;
  context?: Record<string, unknown>;
} {
  if (isPluginError(error)) {
    return {
      code: error.code,
      message: error.message,
      context: error.context,
    };
  }

  if (error instanceof Error) {
    return {
      code: ErrorCode.UNKNOWN_ERROR,
      message: error.message,
      context: { originalError: error.name },
    };
  }

  if (typeof error === 'string') {
    return {
      code: ErrorCode.UNKNOWN_ERROR,
      message: error,
    };
  }

  return {
    code: ErrorCode.UNKNOWN_ERROR,
    message: 'An unknown error occurred',
  };
}

