/// <reference types="@figma/plugin-typings" />

import { TEMPLATES } from './templates';
import { VALIDATION_CONFIG } from './config';
import { validateCSVComprehensive } from './validation';
import { extractErrorInfo } from './errors';
import { logger } from './logger';

/**
 * Font loading cache to avoid reloading fonts multiple times
 */
let fontsLoadedPromise: Promise<void> | null = null;

/**
 * Loads required fonts once and caches the promise for subsequent calls.
 */
export async function ensureFontsLoaded(): Promise<void> {
  if (!fontsLoadedPromise) {
    fontsLoadedPromise = Promise.all([
      figma.loadFontAsync({ family: 'Inter', style: 'Bold' }),
      figma.loadFontAsync({ family: 'Inter', style: 'Medium' }),
      figma.loadFontAsync({ family: 'Inter', style: 'Regular' }),
    ]).then(() => undefined);
  }
  return fontsLoadedPromise;
}

/**
 * Validates that a template type exists in TEMPLATES.
 */
export function validateTemplateType(
  templateType: keyof typeof TEMPLATES
): void {
  if (!(templateType in TEMPLATES)) {
    throw new Error(
      `Invalid template type: ${templateType}. Valid types are: ${Object.keys(
        TEMPLATES
      ).join(', ')}`
    );
  }
}

/**
 * Validates that a coordinate value is a valid number within acceptable bounds.
 */
export function validateCoordinate(
  coordinate: number | undefined,
  name: string
): void {
  if (coordinate !== undefined) {
    if (
      typeof coordinate !== 'number' ||
      isNaN(coordinate) ||
      !isFinite(coordinate)
    ) {
      throw new Error(
        `Invalid ${name} coordinate: ${coordinate}. Must be a finite number.`
      );
    }
    if (
      coordinate < VALIDATION_CONFIG.MIN_COORDINATE ||
      coordinate > VALIDATION_CONFIG.MAX_COORDINATE
    ) {
      throw new Error(
        `Invalid ${name} coordinate: ${coordinate}. Must be between ${VALIDATION_CONFIG.MIN_COORDINATE} and ${VALIDATION_CONFIG.MAX_COORDINATE}.`
      );
    }
  }
}

/**
 * Validates CSV text input.
 * @deprecated Use validateCSVComprehensive from validation.ts for enhanced validation
 * This function is kept for backward compatibility
 */
export function validateCSVText(csvText: string): void {
  const result = validateCSVComprehensive(csvText);
  if (!result.isValid) {
    throw new Error(result.errors.join('; '));
  }
}

/**
 * Sanitizes a field value to prevent issues with extremely long or problematic values.
 */
export function sanitizeFieldValue(
  value: string,
  maxLength: number = VALIDATION_CONFIG.MAX_FIELD_LENGTH
): string {
  if (!value || typeof value !== 'string') {
    return '';
  }
  if (value.length > maxLength) {
    logger.warn('Field value truncated', {
      originalLength: value.length,
      maxLength,
    });
    return value.substring(0, maxLength);
  }
  return value;
}

/**
 * Truncates assignee names: if longer than 36 characters and contains '@',
 * shows only the part before the '@' sign.
 */
export function truncateAssignee(assignee: string): string {
  if (!assignee || typeof assignee !== 'string') {
    return assignee || '';
  }

  // If assignee is longer than 36 characters and contains '@'
  if (assignee.length > 36 && assignee.includes('@')) {
    const atIndex = assignee.indexOf('@');
    const beforeAt = assignee.substring(0, atIndex);
    return beforeAt;
  }

  return assignee;
}

/**
 * Determines which field should be displayed as a large number for a given template type.
 */
export function getLargeNumberField(
  templateType: keyof typeof TEMPLATES
): string | null {
  if (
    templateType === 'theme' ||
    templateType === 'epic' ||
    templateType === 'initiative'
  ) {
    return 'Priority Rank';
  } else if (
    templateType === 'userStory' ||
    templateType === 'task' ||
    templateType === 'spike' ||
    templateType === 'test'
  ) {
    return 'Story Points';
  }
  return null;
}

/**
 * Gets the background color for a template type (matches the icon color).
 */
export function getTemplateBackgroundColor(
  templateType: keyof typeof TEMPLATES
): { r: number; g: number; b: number } {
  const colors: {
    [key: string]: { r: number; g: number; b: number };
  } = {
    theme: { r: 0.4, g: 0.2, b: 0.6 },
    milestone: { r: 0.3, g: 0.7, b: 0.3 },
    userStory: { r: 1.0, g: 0.8, b: 0.6 },
    epic: { r: 0.2, g: 0.5, b: 0.9 },
    initiative: { r: 0.9, g: 0.6, b: 0.1 },
    task: { r: 0.13, g: 0.55, b: 0.13 },
    spike: { r: 0.7, g: 0.6, b: 0.4 },
    test: { r: 0.2, g: 0.5, b: 0.9 },
  };
  return colors[templateType] || { r: 0.5, g: 0.5, b: 0.5 };
}

/**
 * Determines if text should be light (white) or dark (black) based on background brightness.
 */
export function shouldUseLightText(backgroundColor: {
  r: number;
  g: number;
  b: number;
}): boolean {
  const luminance =
    0.299 * backgroundColor.r +
    0.587 * backgroundColor.g +
    0.114 * backgroundColor.b;
  return luminance < 0.5;
}

/**
 * Checks if a template type has an Assignee field.
 */
export function hasAssigneeField(
  templateType: keyof typeof TEMPLATES
): boolean {
  return (
    templateType === 'userStory' ||
    templateType === 'task' ||
    templateType === 'spike' ||
    templateType === 'test'
  );
}

/**
 * Checks if a template type has a Status field.
 */
export function hasStatusField(
  templateType: keyof typeof TEMPLATES
): boolean {
  return (
    templateType === 'theme' ||
    templateType === 'epic' ||
    templateType === 'initiative'
  );
}

/**
 * Wraps text at word boundaries when it exceeds the character limit.
 */
export function wrapTitleText(
  text: string,
  maxLength: number = 40
): string {
  if (!text || text.length <= maxLength) {
    return text;
  }

  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (
      currentLine.length > 0 &&
      (currentLine + ' ' + word).length > maxLength
    ) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      if (currentLine.length > 0) {
        currentLine += ' ' + word;
      } else {
        currentLine = word;
      }
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines.join('\n');
}

/**
 * Safely extracts error message from unknown error type.
 * @deprecated Use extractErrorInfo from errors.ts for structured error handling
 * This function is kept for backward compatibility
 */
export function getErrorMessage(error: unknown): string {
  const errorInfo = extractErrorInfo(error);
  return errorInfo.message;
}

/**
 * Yields control to allow UI updates and prevent blocking.
 */
export function yieldToUI(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

