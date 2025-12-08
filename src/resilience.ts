/// <reference types="@figma/plugin-typings" />

import { logger } from './logger';
import { extractErrorInfo, ErrorCode } from './errors';

/**
 * Retry options for resilient operations
 */
export interface RetryOptions {
  maxAttempts?: number;
  delayMs?: number;
  backoffMultiplier?: number;
  retryableErrors?: ErrorCode[];
  onRetry?: (attempt: number, error: Error) => void;
}

/**
 * Default retry options
 */
const DEFAULT_RETRY_OPTIONS: Required<Omit<RetryOptions, 'onRetry'>> = {
  maxAttempts: 3,
  delayMs: 1000,
  backoffMultiplier: 2,
  retryableErrors: [],
};

/**
 * Executes a function with retry logic and exponential backoff
 * @param fn - Function to execute
 * @param options - Retry configuration
 * @returns Promise that resolves with the function result
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = DEFAULT_RETRY_OPTIONS.maxAttempts,
    delayMs = DEFAULT_RETRY_OPTIONS.delayMs,
    backoffMultiplier = DEFAULT_RETRY_OPTIONS.backoffMultiplier,
    retryableErrors = DEFAULT_RETRY_OPTIONS.retryableErrors,
    onRetry,
  } = options;

  let lastError: Error | null = null;
  let currentDelay = delayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Extract error info to check if retryable
      const errorInfo = extractErrorInfo(error);
      const isRetryable =
        retryableErrors.length === 0 ||
        retryableErrors.includes(errorInfo.code);

      // Don't retry on last attempt or if error is not retryable
      if (attempt === maxAttempts || !isRetryable) {
        logger.error(
          `Operation failed after ${attempt} attempt(s)`,
          lastError,
          { attempt, maxAttempts, isRetryable }
        );
        throw lastError;
      }

      // Call retry callback if provided
      if (onRetry) {
        try {
          onRetry(attempt, lastError);
        } catch (callbackError) {
          logger.warn('Error in retry callback', { error: callbackError });
        }
      }

      logger.warn(`Retrying operation (attempt ${attempt}/${maxAttempts})`, {
        error: errorInfo.message,
        delay: currentDelay,
      });

      // Wait before retry with exponential backoff
      await new Promise((resolve) => setTimeout(resolve, currentDelay));
      currentDelay *= backoffMultiplier;
    }
  }

  throw lastError || new Error('Retry failed');
}

/**
 * Wraps an async function with timeout
 * @param fn - Function to execute
 * @param timeoutMs - Timeout in milliseconds
 * @returns Promise that resolves with the function result or rejects on timeout
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number
): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Operation timed out after ${timeoutMs}ms`)),
        timeoutMs
      )
    ),
  ]);
}

/**
 * Executes multiple operations in parallel with concurrency limit
 * @param operations - Array of functions to execute
 * @param concurrency - Maximum number of concurrent operations
 * @returns Promise that resolves with array of results
 */
export async function withConcurrencyLimit<T>(
  operations: Array<() => Promise<T>>,
  concurrency: number
): Promise<T[]> {
  const results: T[] = [];
  const executing: Promise<void>[] = [];

  for (const operation of operations) {
    const promise = operation().then((result) => {
      results.push(result);
    });

    executing.push(promise);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
      executing.splice(
        executing.findIndex((p) => p === promise),
        1
      );
    }
  }

  await Promise.all(executing);
  return results;
}

/**
 * Circuit breaker pattern for preventing cascading failures
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime: number | null = null;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private readonly failureThreshold: number = 5,
    private readonly resetTimeout: number = 60000, // 1 minute
    private readonly halfOpenMaxAttempts: number = 2
  ) {}

  /**
   * Executes a function through the circuit breaker
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (this.shouldAttemptReset()) {
        this.state = 'half-open';
        logger.info('Circuit breaker entering half-open state');
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return true;
    return Date.now() - this.lastFailureTime > this.resetTimeout;
  }

  private onSuccess(): void {
    this.failures = 0;
    this.lastFailureTime = null;
    if (this.state === 'half-open') {
      this.state = 'closed';
      logger.info('Circuit breaker closed after successful operation');
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.state === 'half-open') {
      this.state = 'open';
      logger.warn('Circuit breaker opened after half-open failure');
    } else if (this.failures >= this.failureThreshold) {
      this.state = 'open';
      logger.error(
        'Circuit breaker opened due to failure threshold',
        undefined,
        {
          failures: this.failures,
          threshold: this.failureThreshold,
        }
      );
    }
  }

  /**
   * Gets current circuit breaker state
   */
  getState(): 'closed' | 'open' | 'half-open' {
    return this.state;
  }

  /**
   * Resets the circuit breaker manually
   */
  reset(): void {
    this.failures = 0;
    this.lastFailureTime = null;
    this.state = 'closed';
    logger.info('Circuit breaker manually reset');
  }
}

