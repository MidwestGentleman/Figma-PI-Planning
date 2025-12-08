/// <reference types="@figma/plugin-typings" />

import { VALIDATION_CONFIG } from './config';
import { createError, ErrorCode } from './errors';

/**
 * Validation result structure
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Comprehensive CSV validation
 */
export function validateCSVComprehensive(csvText: string): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
  };

  // Basic existence check
  if (!csvText || typeof csvText !== 'string') {
    result.isValid = false;
    result.errors.push('CSV text must be a non-empty string');
    return result;
  }

  // Size validation
  if (csvText.length > VALIDATION_CONFIG.MAX_CSV_SIZE) {
    result.isValid = false;
    result.errors.push(
      `CSV exceeds maximum size of ${VALIDATION_CONFIG.MAX_CSV_SIZE} bytes`
    );
  }

  // Empty check
  if (csvText.trim() === '') {
    result.isValid = false;
    result.errors.push('CSV text cannot be empty');
    return result;
  }

  // Skip strict encoding validation - CSV parser handles encoding issues

  // Structure validation
  const lines = csvText.split('\n').filter((line) => line.trim() !== '');
  if (lines.length < 2) {
    result.isValid = false;
    result.errors.push('CSV must contain at least a header and one data row');
  }

  // Check for suspicious patterns (warnings only - Jira may contain legitimate HTML)
  const suspiciousPatterns = [
    { pattern: /<script[^>]*>/i, name: 'script tags' },
    { pattern: /javascript:\s*[^"'\s]/i, name: 'javascript protocol' },
    { pattern: /on\w+\s*=\s*["'][^"']*["']/i, name: 'event handlers' },
    { pattern: /<iframe[^>]*>/i, name: 'iframe tags' },
  ];

  for (const { pattern, name } of suspiciousPatterns) {
    if (pattern.test(csvText)) {
      result.warnings.push(`CSV contains potentially unsafe content: ${name}`);
      // Don't fail validation, just warn - Jira descriptions may contain HTML
    }
  }

  // Check for reasonable line count (prevent DoS)
  if (lines.length > 100000) {
    result.warnings.push(
      `CSV contains ${lines.length} lines, which may cause performance issues`
    );
  }

  return result;
}

/**
 * Validates Jira URL format and security
 */
export function validateJiraUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  const trimmed = url.trim();
  if (trimmed === '') {
    return false;
  }

  try {
    // URL constructor may not be available in Figma plugin environment
    // Use regex-based validation instead
    const urlPattern = /^https:\/\/([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(\/.*)?$/;
    
    if (!urlPattern.test(trimmed)) {
      return false;
    }
    
    // Additional validation: ensure it starts with https://
    if (!trimmed.toLowerCase().startsWith('https://')) {
      return false;
    }
    
    // Extract hostname for additional validation
    const hostnameMatch = trimmed.match(/^https:\/\/([^\/]+)/);
    if (!hostnameMatch || !hostnameMatch[1]) {
      return false;
    }
    
    const hostname = hostnameMatch[1];
    
    // Validate domain format (must contain at least one dot)
    if (!hostname.includes('.')) {
      return false;
    }
    
    // Check for valid hostname characters
    if (!/^[a-zA-Z0-9.-]+$/.test(hostname)) {
      return false;
    }
    
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Validates and normalizes Jira URL
 * Automatically adds https:// if protocol is missing
 * @throws {PluginError} If URL is invalid
 */
export function validateAndNormalizeJiraUrl(url: string): string {
  if (!url || typeof url !== 'string') {
    throw createError(
      ErrorCode.INVALID_URL,
      'Invalid Jira URL. Must be a non-empty string.',
      { url }
    );
  }

  let normalized = url.trim();

  // Add https:// if no protocol is present
  if (!normalized.match(/^https?:\/\//i)) {
    normalized = `https://${normalized}`;
  }

  // Now validate the normalized URL
  if (!validateJiraUrl(normalized)) {
    throw createError(
      ErrorCode.INVALID_URL,
      'Invalid Jira URL. Must be a valid domain name.',
      { url, normalized }
    );
  }

  // Normalize: remove trailing slash
  return normalized.replace(/\/$/, '');
}

/**
 * Validates coordinate values
 * @throws {PluginError} If coordinate is invalid
 */
export function validateCoordinateStrict(
  coordinate: number | undefined,
  name: string
): void {
  if (coordinate === undefined) {
    return; // Undefined is allowed (will use default)
  }

  if (
    typeof coordinate !== 'number' ||
    isNaN(coordinate) ||
    !isFinite(coordinate)
  ) {
    throw createError(
      ErrorCode.COORDINATE_OUT_OF_BOUNDS,
      `Invalid ${name} coordinate: must be a finite number`,
      { coordinate, name }
    );
  }

  if (
    coordinate < VALIDATION_CONFIG.MIN_COORDINATE ||
    coordinate > VALIDATION_CONFIG.MAX_COORDINATE
  ) {
    throw createError(
      ErrorCode.COORDINATE_OUT_OF_BOUNDS,
      `Invalid ${name} coordinate: must be between ${VALIDATION_CONFIG.MIN_COORDINATE} and ${VALIDATION_CONFIG.MAX_COORDINATE}`,
      { coordinate, name }
    );
  }
}

/**
 * Sanitizes string input to prevent XSS
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  // Remove potentially dangerous characters/patterns
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
}

/**
 * Validates field value length
 */
export function validateFieldLength(
  value: string,
  maxLength: number = VALIDATION_CONFIG.MAX_FIELD_LENGTH
): void {
  if (value.length > maxLength) {
    throw createError(
      ErrorCode.CSV_VALIDATION_ERROR,
      `Field value exceeds maximum length of ${maxLength} characters`,
      { length: value.length, maxLength }
    );
  }
}

