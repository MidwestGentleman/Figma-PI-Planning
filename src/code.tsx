/// <reference types="@figma/plugin-typings" />

/**
 * Main entry point for the PI Planning FigJam Plugin
 *
 * This file orchestrates the plugin initialization, message handling,
 * and imports functionality from organized modules.
 */

// Import organized modules
import { PluginMessage, UIMessage, CardData } from './types';
import { TEMPLATES } from './templates';
import {
  CARD_CONFIG,
  LAYOUT_CONFIG,
  TABLE_CONFIG,
  UI_CONFIG,
  TIMING_CONFIG,
  COLOR_CONFIG,
  VALIDATION_CONFIG,
  IMPORT_CONFIG,
} from './config';
import {
  ensureFontsLoaded,
  validateTemplateType,
  validateCoordinate,
  validateCSVText,
  sanitizeFieldValue,
  getLargeNumberField,
  getTemplateBackgroundColor,
  shouldUseLightText,
  hasAssigneeField,
  hasStatusField,
  wrapTitleText,
  getErrorMessage,
  yieldToUI,
  truncateAssignee,
} from './utils';
import {
  createTemplateCard,
  createTemplateCardWithPosition,
  createEpicLabelCard,
} from './card-creation';

// All constants, types, and utility functions are now imported from organized modules above
// CSV parsing, card creation, and other functionality continues below

// Card creation functions are now imported from card-creation.ts module

// Helper to parse a CSV line (handles quoted fields)
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  // Add last field
  result.push(current.trim());
  return result;
}

/**
 * Parses CSV text into an array of objects, handling multiline fields in quotes.
 */
function parseCSV(csvText: string): Array<{ [key: string]: string }> {
  if (!csvText || csvText.trim() === '') return [];

  // Parse header first
  let headerEnd = 0;
  let inQuotes = false;
  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        i++; // Skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === '\n' && !inQuotes) {
      headerEnd = i;
      break;
    }
  }

  const headerLine = csvText.substring(0, headerEnd);
  const headers = parseCSVLine(headerLine);

  if (headers.length === 0) return [];

  const rows: Array<{ [key: string]: string }> = [];
  let currentLine = '';
  inQuotes = false;
  let lineStart = headerEnd + 1;

  // Parse data rows, handling multiline fields
  for (let i = lineStart; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentLine += '"';
        i++; // Skip escaped quote
      } else {
        inQuotes = !inQuotes;
        currentLine += char;
      }
    } else if (char === '\n' && !inQuotes) {
      // End of row
      if (currentLine.trim() !== '') {
        const values = parseCSVLine(currentLine);
        if (values.length > 0 && values[0].trim() !== '') {
          const row: { [key: string]: string } = {};
          headers.forEach((header, index) => {
            const value = values[index] || '';
            // Handle duplicate column names (like multiple "Sprint" columns)
            // For duplicate names, coalesce values - use first non-empty value
            if (header in row) {
              // Column name already exists, coalesce: keep existing if non-empty, otherwise use new value
              if (!row[header] || row[header].trim() === '') {
                if (value && value.trim() !== '') {
                  row[header] = value;
                }
              }
              // If existing value is non-empty, keep it (don't overwrite)
            } else {
              // First occurrence of this column name
              row[header] = value;
            }
          });

          // Only add if has data
          const hasData = Object.values(row).some(
            (val) => val && val.trim() !== ''
          );
          if (hasData) {
            rows.push(row);
          }
        }
      }
      currentLine = '';
    } else {
      currentLine += char;
    }
  }

  // Handle last row if no trailing newline
  if (currentLine.trim() !== '') {
    const values = parseCSVLine(currentLine);
    if (values.length > 0 && values[0].trim() !== '') {
      const row: { [key: string]: string } = {};
      headers.forEach((header, index) => {
        const value = values[index] || '';
        // Handle duplicate column names (like multiple "Sprint" columns)
        // For duplicate names, coalesce values - use first non-empty value
        if (header in row) {
          // Column name already exists, coalesce: keep existing if non-empty, otherwise use new value
          if (!row[header] || row[header].trim() === '') {
            if (value && value.trim() !== '') {
              row[header] = value;
            }
          }
          // If existing value is non-empty, keep it (don't overwrite)
        } else {
          // First occurrence of this column name
          row[header] = value;
        }
      });

      const hasData = Object.values(row).some(
        (val) => val && val.trim() !== ''
      );
      if (hasData) {
        rows.push(row);
      }
    }
  }

  return rows;
}

/**
 * Converts Jira formatting to plain text (removes markdown, links, etc.)
 */
function formatJiraText(text: string): string {
  if (!text) return text;

  let formatted = text;

  // Convert Jira links [url|text] to "text (url)" or just "url" if no text
  // Handle [url|text] format first
  formatted = formatted.replace(/\[([^\]]+)\|([^\]]+)\]/g, '$2 ($1)');
  // Then handle simple [url] format
  formatted = formatted.replace(/\[([^\]]+)\]/g, '$1');

  // Convert Jira bold *text* to bold text (remove asterisks but keep emphasis)
  // Handle single asterisks for bold
  formatted = formatted.replace(/\*([^*\n]+)\*/g, '$1');
  // Handle double asterisks
  formatted = formatted.replace(/\*\*([^*\n]+)\*\*/g, '$1');

  // Convert Jira headings # text to bold headings
  formatted = formatted.replace(/^#+\s+(.+)$/gm, '$1');

  // Convert horizontal rules ---- to separator line
  formatted = formatted.replace(/^----\s*$/gm, '─────────────────────────');

  // Preserve bullet points and indentation
  // Convert Jira list items to clean bullet points
  formatted = formatted.replace(/^(\s*)[-*]\s+/gm, '$1• ');

  // Clean up excessive blank lines (more than 2 consecutive)
  formatted = formatted.replace(/\n{3,}/g, '\n\n');

  // Trim whitespace from each line while preserving structure
  const lines = formatted.split('\n');
  const cleanedLines = lines.map((line) => {
    // Preserve indentation for list items and structured content
    if (/^\s*[•-]/.test(line) || /^\s*[A-Z][a-z]+:/.test(line)) {
      return line.trimStart();
    }
    return line.trim();
  });
  formatted = cleanedLines.join('\n').trim();

  return formatted;
}

/**
 * Truncates description to 160 characters, adding "..." if truncated.
 * Used for Theme, Epic, and Initiative cards to keep them compact.
 */
function truncateDescription(
  description: string,
  maxLength: number = 160
): string {
  if (!description || description.length <= maxLength) {
    return description;
  }
  // Truncate to maxLength - 3 to make room for "..."
  return description.substring(0, maxLength - 3) + '...';
}

/**
 * Maps a Jira issue to a template type and extracts relevant data.
 * @returns Template type and data, or null if issue cannot be mapped
 */
function mapJiraIssueToTemplate(issue: { [key: string]: string }): {
  templateType: keyof typeof TEMPLATES;
  data: { [key: string]: string };
} | null {
  // Normalize issue type: trim whitespace and convert to lowercase for comparison
  const rawIssueType = issue['Issue Type'] || '';
  const issueType = rawIssueType.trim().toLowerCase();
  const summary = issue['Summary'] || '';

  // Debug logging for initiatives to help diagnose mapping issues
  if (
    summary &&
    (summary.includes('PCEC') ||
      summary.includes('Adventure Era') ||
      summary.includes('SEAS CAP'))
  ) {
    console.log(
      `[DEBUG] Mapping issue: "${summary}"`,
      `Raw Issue Type: "${rawIssueType}"`,
      `Normalized: "${issueType}"`,
      `Due Date: "${issue['Due Date'] || ''}"`,
      `Fix Versions: "${issue['Fix Version/s'] || ''}"`,
      `All issue keys:`,
      Object.keys(issue).filter((k) => k.toLowerCase().includes('issue'))
    );
  }
  const description = formatJiraText(issue['Description'] || '');
  const priority = issue['Priority'] || '';
  const status = issue['Status'] || 'Open';
  // Parse and round story points to whole number
  const storyPointsRaw = issue['Custom field (Story Points)'] || '';
  const storyPoints =
    storyPointsRaw && storyPointsRaw !== '?' && storyPointsRaw !== '#'
      ? Math.round(parseFloat(storyPointsRaw) || 0).toString()
      : storyPointsRaw || '?';
  const acceptanceCriteria = formatJiraText(
    issue['Custom field (Acceptance Criteria)'] || ''
  );
  const userStory = formatJiraText(issue['Custom field (User Story)'] || '');
  const issueKey = issue['Issue key'] || '';
  const team =
    issue['Custom field (Studio)'] || issue['Custom field (Team)'] || '';
  const dueDate = issue['Due Date'] || '';
  const fixVersions = issue['Fix Version/s'] || '';
  const businessValue = issue['Custom field (Business Value)'] || '';
  const dependencies = issue['Outward issue link (Blocks)'] || '';

  // Parse user story format from description or custom field
  let asA = '';
  let iWant = '';
  let soThat = '';

  const storyText = userStory || description;
  const asAMatch = storyText.match(/\*As\s+a\*[:\s]+(.+?)(?:\n|\*|$)/i);
  const iWantMatch = storyText.match(/\*I\s+want\*[:\s]+(.+?)(?:\n|\*|$)/i);
  const soThatMatch = storyText.match(/\*So\s+that\*[:\s]+(.+?)(?:\n|\*|$)/i);

  if (asAMatch) asA = asAMatch[1].trim();
  if (iWantMatch) iWant = iWantMatch[1].trim();
  if (soThatMatch) soThat = soThatMatch[1].trim();

  // Map issue type to template
  // IMPORTANT: Check explicit issue types BEFORE checking dates to avoid
  // incorrectly mapping Initiatives/Themes with dates to Milestones
  // Issue type is already normalized to lowercase and trimmed above
  let templateType: keyof typeof TEMPLATES;

  // Map based on mapping: Title = Summary, Team = Custom field (Studio)
  // Note: issueType is already normalized to lowercase and trimmed
  if (issueType === 'epic') {
    templateType = 'epic';
    // Truncate description for display, but store full description for export
    const displayDescription = description
      ? truncateDescription(description)
      : 'Epic description...';
    return {
      templateType,
      data: {
        title: summary, // Title → Summary
        Description: displayDescription, // Truncated description for display
        'Priority Rank':
          issue['Priority'] || issue['Custom field (Priority Rank)'] || '#',
        'Acceptance Criteria':
          acceptanceCriteria || '- Criterion 1\n- Criterion 2',
        Status: status, // Status field for display at bottom
        issueKey: issueKey, // Store issue key for hyperlink
        // Note: Full description and Team/Studio are stored in plugin data for export preservation
      },
    };
  } else if (
    issueType === 'story' ||
    issueType === 'user story' ||
    (asA && iWant && soThat)
  ) {
    templateType = 'userStory';
    // For imported user stories, use Description instead of As a/I want/So that
    return {
      templateType,
      data: {
        title: summary, // Title → Summary
        Description: description || 'User story description...', // Use Description for imports
        'Acceptance Criteria':
          acceptanceCriteria || '- Criterion 1\n- Criterion 2',
        'Story Points': storyPoints || '?',
        Priority: priority || 'Medium',
        Assignee: issue['Assignee'] || 'Unassigned',
        issueKey: issueKey, // Store issue key for hyperlink
      },
    };
  } else if (issueType === 'bug' || issueType === 'defect') {
    // Bugs use task template but with special styling (red color, bug icon)
    templateType = 'task';
    return {
      templateType,
      data: {
        title: summary, // Title → Summary
        Description: description || 'Bug description...', // Description → Description
        'Story Points': storyPoints || '?', // Include Story Points if available
        Assignee: issue['Assignee'] || 'Unassigned',
        'Acceptance Criteria':
          acceptanceCriteria || '- Criterion 1\n- Criterion 2',
        issueKey: issueKey, // Store issue key for hyperlink
        originalIssueType: 'bug', // Store original type for icon/color styling
      },
    };
  } else if (issueType === 'task') {
    templateType = 'task';
    return {
      templateType,
      data: {
        title: summary, // Title → Summary
        Description: description || 'Task description...', // Description → Description
        'Story Points': storyPoints || '?', // Include Story Points if available
        Assignee: issue['Assignee'] || 'Unassigned',
        'Acceptance Criteria':
          acceptanceCriteria || '- Criterion 1\n- Criterion 2',
        issueKey: issueKey, // Store issue key for hyperlink
      },
    };
  } else if (issueType === 'spike') {
    templateType = 'spike';
    return {
      templateType,
      data: {
        title: summary, // Title → Summary
        Description: description || 'Spike description...', // Description → Description
        'Story Points': storyPoints || '?', // Include Story Points if available
        Assignee: issue['Assignee'] || 'Unassigned',
        'Acceptance Criteria':
          acceptanceCriteria || '- Criterion 1\n- Criterion 2',
        issueKey: issueKey, // Store issue key for hyperlink
      },
    };
  } else if (issueType === 'test') {
    templateType = 'test';
    return {
      templateType,
      data: {
        title: summary, // Title → Summary
        Description: description || 'Test description...', // Description → Description
        'Test Type': issue['Custom field (Test Type)'] || 'Manual',
        'Story Points': storyPoints || '?', // Include Story Points if available
        Assignee: issue['Assignee'] || 'Unassigned',
        'Acceptance Criteria':
          acceptanceCriteria || '- Criterion 1\n- Criterion 2',
        issueKey: issueKey, // Store issue key for hyperlink
      },
    };
  } else if (issueType === 'theme') {
    templateType = 'theme';
    // Truncate description for display, but store full description for export
    const displayDescription = description
      ? truncateDescription(description)
      : 'Business objective description...';
    return {
      templateType,
      data: {
        title: summary, // Title → Summary
        Description: displayDescription, // Truncated description for display
        'Priority Rank':
          issue['Priority'] || issue['Custom field (Priority Rank)'] || '#',
        'Acceptance Criteria':
          acceptanceCriteria || '- Criterion 1\n- Criterion 2',
        Status: status, // Status field for display at bottom
        issueKey: issueKey, // Store issue key for round-trip export
        // Note: Full description is stored in plugin data for export preservation
      },
    };
  } else if (issueType === 'initiative') {
    // Initiative must be checked BEFORE date-based milestone detection
    // to prevent initiatives with dates from being incorrectly mapped to milestones
    console.log(
      `[DEBUG] Mapping to Initiative: "${summary}", issueType="${issueType}", raw="${rawIssueType}"`
    );
    templateType = 'initiative';
    // Truncate description for display, but store full description for export
    const displayDescription = description
      ? truncateDescription(description)
      : 'Initiative description...';
    return {
      templateType,
      data: {
        title: summary, // Title → Summary
        Description: displayDescription, // Truncated description for display
        Dependencies: dependencies || 'None',
        'Priority Rank':
          issue['Priority'] || issue['Custom field (Priority Rank)'] || '#',
        'Acceptance Criteria':
          acceptanceCriteria || '- Criterion 1\n- Criterion 2',
        issueKey: issueKey, // Store issue key for round-trip export
        // Note: Full description is stored in plugin data for export preservation
      },
    };
  } else if (issueType === 'milestone') {
    // Explicit milestone type
    templateType = 'milestone';
    return {
      templateType,
      data: {
        title: summary, // Title → Summary
        'Target Date': dueDate || fixVersions || 'MM/DD/YYYY',
        Description: description || 'Milestone description...', // Description → Description
        issueKey: issueKey, // Store issue key for hyperlink
      },
    };
  } else if (dueDate || fixVersions) {
    // Use milestone for items with dates ONLY if issue type is not explicitly defined
    // This is a fallback for unknown issue types that have dates
    console.log(
      `[DEBUG] Mapping to Milestone (date-based fallback): "${summary}", issueType="${issueType}", raw="${rawIssueType}", dueDate="${dueDate}", fixVersions="${fixVersions}"`
    );
    templateType = 'milestone';
    return {
      templateType,
      data: {
        title: summary, // Title → Summary
        'Target Date': dueDate || fixVersions || 'MM/DD/YYYY',
        Description: description || 'Milestone description...', // Description → Description
        issueKey: issueKey, // Store issue key for hyperlink
      },
    };
  } else {
    // Default to task for unknown issue types (not initiatives/themes/milestones)
    templateType = 'task';
    return {
      templateType,
      data: {
        title: summary, // Title → Summary
        Description: description || 'Task description...', // Description → Description
        'Story Points': storyPoints || '?', // Include Story Points if available
        Assignee: issue['Assignee'] || 'Unassigned',
        'Acceptance Criteria':
          acceptanceCriteria || '- Criterion 1\n- Criterion 2',
        issueKey: issueKey, // Store issue key for hyperlink
        originalIssueType: issueType, // Store original type for reference
      },
    };
  }
}

// Card creation functions are imported from card-creation.ts module
// CSV parsing and import/export functions continue below

/**
 * Extracts sprint value from a Jira issue, handling multiple sprint column variations.
 */
function getSprintValue(issue: { [key: string]: string }): string {
  // First, prioritize exact "Sprint" column matches (case-insensitive)
  // This handles the most common case where columns are named exactly "Sprint"
  const exactSprintKeys = Object.keys(issue).filter(
    (key) => key.toLowerCase() === 'sprint'
  );

  // Try exact "Sprint" matches first
  for (const key of exactSprintKeys) {
    const value = issue[key];
    if (value && value.trim() !== '') {
      const trimmed = value.trim();
      // Skip empty values, empty arrays, and non-sprint-looking values
      if (
        trimmed.length > 0 &&
        trimmed !== '[]' &&
        !trimmed.startsWith('Checklist(') // Exclude Smart Checklist values
      ) {
        return trimmed;
      }
    }
  }

  // Then check for columns that contain "sprint" but exclude "Custom field" columns
  // This handles variations like "Sprint Name" but avoids false matches
  const sprintKeys = Object.keys(issue).filter((key) => {
    const lowerKey = key.toLowerCase();
    return (
      lowerKey.includes('sprint') &&
      !lowerKey.includes('custom field') && // Exclude Custom field columns
      lowerKey !== 'sprint' // Already checked above, but be safe
    );
  });

  // Try each Sprint column variation
  for (const key of sprintKeys) {
    const value = issue[key];
    if (value && value.trim() !== '') {
      const trimmed = value.trim();
      // Skip empty values, empty arrays, and non-sprint-looking values
      if (
        trimmed.length > 0 &&
        trimmed !== '[]' &&
        !trimmed.startsWith('Checklist(') // Exclude Smart Checklist values
      ) {
        return trimmed;
      }
    }
  }

  return 'Backlog';
}

/**
 * Calculates the first Wednesday of a given year.
 * @param year - The year (e.g., 2026)
 * @returns Date object for the first Wednesday of the year
 */
function getFirstWednesdayOfYear(year: number): Date {
  // January 1st of the year
  const jan1 = new Date(year, 0, 1);
  // Get day of week: 0 = Sunday, 1 = Monday, 2 = Tuesday, 3 = Wednesday, 4 = Thursday, 5 = Friday, 6 = Saturday
  const dayOfWeek = jan1.getDay();

  // Calculate days to add to get to the first Wednesday
  // If Jan 1 is Sunday (0), first Wednesday is Jan 3 (add 3 days)
  // If Jan 1 is Monday (1), first Wednesday is Jan 2 (add 1 day)
  // If Jan 1 is Tuesday (2), first Wednesday is Jan 1 (add 0 days) - wait, that's wrong
  // If Jan 1 is Tuesday (2), first Wednesday is Jan 2 (add 1 day)
  // If Jan 1 is Wednesday (3), first Wednesday is Jan 1 (add 0 days)
  // If Jan 1 is Thursday (4), first Wednesday is Jan 7 (add 6 days)
  // If Jan 1 is Friday (5), first Wednesday is Jan 6 (add 5 days)
  // If Jan 1 is Saturday (6), first Wednesday is Jan 5 (add 4 days)

  // Calculate days to add to get to the first Wednesday
  // Formula: (3 - dayOfWeek + 7) % 7 handles all cases
  // If Jan 1 is Sunday (0): (3 - 0 + 7) % 7 = 3 (Jan 4, but that's wrong - should be Jan 3)
  // Actually, we need: if dayOfWeek <= 3, use (3 - dayOfWeek), else use (10 - dayOfWeek)
  let daysToAdd: number;
  if (dayOfWeek <= 3) {
    // Sunday (0), Monday (1), Tuesday (2), or Wednesday (3)
    // First Wednesday is: 3 - dayOfWeek days away (or same day if Wednesday)
    daysToAdd = dayOfWeek === 3 ? 0 : 3 - dayOfWeek;
  } else {
    // Thursday (4), Friday (5), or Saturday (6)
    // First Wednesday is in the next week: 7 - (dayOfWeek - 3)
    daysToAdd = 7 - (dayOfWeek - 3);
  }

  const firstWednesday = new Date(year, 0, 1 + daysToAdd);
  return firstWednesday;
}

/**
 * Calculates sprint dates based on year and sprint number.
 * Sprints always start on Wednesday and are 14 days long (2 weeks).
 * Exception: Sprint 25 ends on the first Wednesday of the next year (spans holidays).
 * @param year - The year (e.g., 2026)
 * @param sprintNumber - The sprint number (e.g., 1, 2, 25)
 * @returns Formatted date string "M/D/YYYY - M/D/YYYY"
 */
function calculateSprintDates(year: number, sprintNumber: number): string {
  // Get the first Wednesday of the year
  const firstWednesday = getFirstWednesdayOfYear(year);

  // Calculate start date: first Wednesday + (sprintNumber - 1) * 14 days
  const startDate = new Date(firstWednesday);
  startDate.setDate(startDate.getDate() + (sprintNumber - 1) * 14);

  // Calculate end date
  let endDate: Date;
  if (sprintNumber === 25) {
    // Sprint 25 exception: ends on the first Wednesday of the next year
    const nextYear = year + 1;
    endDate = getFirstWednesdayOfYear(nextYear);
  } else {
    // Standard sprints: start date + 13 days (14 days total, inclusive)
    endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 13);
  }

  // Format dates as M/D/YYYY
  const formatDate = (date: Date): string => {
    const month = date.getMonth() + 1; // getMonth() returns 0-11
    const day = date.getDate();
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  };

  return `${formatDate(startDate)} - ${formatDate(endDate)}`;
}

/**
 * Extracts sprint dates from a Jira issue, or calculates them from sprint key.
 * @param issue - The Jira issue object
 * @param sprintKey - Optional sprint key (e.g., "2026-1") for calculation fallback
 */
function getSprintDates(
  issue: { [key: string]: string },
  sprintKey?: string
): string {
  // First, try to extract dates from the issue
  const dateKeys = Object.keys(issue).filter((key) => {
    const lowerKey = key.toLowerCase();
    return (
      lowerKey.includes('sprint') &&
      (lowerKey.includes('date') ||
        lowerKey.includes('start') ||
        lowerKey.includes('end'))
    );
  });

  // Try to find start and end dates
  let startDate = '';
  let endDate = '';

  for (const key of dateKeys) {
    const value = issue[key];
    if (value && value.trim() !== '') {
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes('start')) {
        startDate = value.trim();
      } else if (lowerKey.includes('end')) {
        endDate = value.trim();
      }
    }
  }

  // If we found both dates, format them
  if (startDate && endDate) {
    return `${startDate} - ${endDate}`;
  } else if (startDate) {
    return startDate;
  } else if (endDate) {
    return endDate;
  }

  // If no dates found in issue, try to calculate from sprint key
  if (sprintKey) {
    const match = sprintKey.match(/^(\d{4})-(\d+)$/);
    if (match) {
      const year = parseInt(match[1], 10);
      const sprintNumber = parseInt(match[2], 10);
      if (!isNaN(year) && !isNaN(sprintNumber)) {
        return calculateSprintDates(year, sprintNumber);
      }
    }
  }

  return 'MM/DD/YYYY - MM/DD/YYYY';
}

/**
 * Checks if a string is a numeric team ID (like "1.0", "2.0", "1039") rather than a team name.
 * Team names should contain letters, not just numbers.
 * @param value - The string to check
 * @returns true if the value looks like a numeric ID, false if it looks like a team name
 */
function isNumericTeamID(value: string): boolean {
  if (!value || value.trim() === '') {
    return false;
  }
  const trimmed = value.trim();
  // Check if it's purely numeric (e.g., "1039", "1040")
  // or a version-like number (e.g., "1.0", "2.0", "3.0")
  // Pattern matches: pure numbers, or numbers with optional decimal point and digits
  const numericPattern = /^\d+(\.\d+)?$/;
  return numericPattern.test(trimmed);
}

/**
 * Parses a sprint name to extract team, year, and sprint number.
 * Expected format: "{Team Name} {Year}-{Sprint Number}"
 * Returns null if the format doesn't match (e.g., "Backlog" or invalid format)
 * Rejects sprint names where the team part is purely numeric (like "1.0 2025-20")
 */
function parseSprintName(sprintName: string): {
  team: string;
  year: number;
  sprintNumber: number;
  sprintKey: string; // "{Year}-{Sprint Number}" for grouping concurrent sprints
} | null {
  if (!sprintName || sprintName.trim() === '' || sprintName === 'Backlog') {
    return null;
  }

  // Pattern: "{Team Name} {Year}-{Sprint Number}"
  // Examples: "Triton 2025-25", "Crush 2025-25", "GH 2025-24"
  const match = sprintName.trim().match(/^(.+?)\s+(\d{4})-(\d+)$/);
  if (!match) {
    return null; // Doesn't match the expected format
  }

  const team = match[1].trim();
  // Reject if team name is purely numeric (e.g., "1.0", "2.0", "1039")
  // These are team IDs, not team names
  if (isNumericTeamID(team)) {
    return null; // Invalid: team part is numeric, not a team name
  }

  const year = parseInt(match[2], 10);
  const sprintNumber = parseInt(match[3], 10);
  const sprintKey = `${year}-${sprintNumber}`;

  if (isNaN(year) || isNaN(sprintNumber)) {
    return null;
  }

  return { team, year, sprintNumber, sprintKey };
}

/**
 * Groups issues by sprint name.
 */
function groupIssuesBySprint(issues: Array<{ [key: string]: string }>): {
  [sprint: string]: Array<{ [key: string]: string }>;
} {
  const issuesBySprint: { [sprint: string]: Array<{ [key: string]: string }> } =
    {};
  for (const issue of issues) {
    if (!issue['Summary'] || issue['Summary'].trim() === '') {
      continue;
    }
    const sprint = getSprintValue(issue);
    if (!issuesBySprint[sprint]) {
      issuesBySprint[sprint] = [];
    }
    issuesBySprint[sprint].push(issue);
  }
  return issuesBySprint;
}

/**
 * Preprocesses issues for multi-team swimlane layout.
 * Returns organized data structure for creating swimlanes.
 */
function preprocessMultiTeamData(issues: Array<{ [key: string]: string }>): {
  teams: string[];
  sprintKeys: string[]; // Sorted list of "{Year}-{Sprint Number}" keys
  issuesByTeamAndSprint: {
    [team: string]: {
      [sprintKey: string]: Array<{ [key: string]: string }>;
    };
  };
  issuesByTeamAndBacklog: {
    [team: string]: Array<{ [key: string]: string }>;
  };
  sprintColumnWidths: { [sprintKey: string]: number }; // Max epics per sprint across all teams
  epicIssues: Array<{ [key: string]: string }>;
} {
  // Collect all sprints and parse them
  const sprintMap = new Map<string, ReturnType<typeof parseSprintName>>();
  const teamSet = new Set<string>();
  const issuesByTeamAndSprint: {
    [team: string]: {
      [sprintKey: string]: Array<{ [key: string]: string }>;
    };
  } = {};
  const issuesByTeamAndBacklog: {
    [team: string]: Array<{ [key: string]: string }>;
  } = {};
  const epicIssues: Array<{ [key: string]: string }> = [];

  // First pass: parse sprints and identify teams
  for (const issue of issues) {
    if (!issue['Summary'] || issue['Summary'].trim() === '') {
      continue;
    }

    const issueType = (issue['Issue Type'] || '').trim().toLowerCase();
    if (issueType === 'epic') {
      epicIssues.push(issue);
    }

    const sprintName = getSprintValue(issue);
    const parsed = parseSprintName(sprintName);

    // If sprint parses correctly, add it to sprintMap (regardless of team source)
    if (parsed) {
      sprintMap.set(sprintName, parsed);
    }

    // Get team with priority: Custom field (Studio) > Custom field (Team) > Sprint name
    // Custom field (Studio) typically contains the written team name (e.g., "Triton", "Gadget Hackwrench")
    // Custom field (Team) may contain an ID (e.g., "1039", "1040") or a name - validate it's not numeric
    let team = '';
    // First priority: Custom field (Studio) - written team name
    if (
      issue['Custom field (Studio)'] &&
      issue['Custom field (Studio)'].trim() !== ''
    ) {
      team = issue['Custom field (Studio)'].trim();
    }
    // Second priority: Custom field (Team) - may be ID or name
    // Only use it if it looks like a team name (not a numeric ID like "1.0", "2.0", "1039")
    else if (
      issue['Custom field (Team)'] &&
      issue['Custom field (Team)'].trim() !== ''
    ) {
      const teamFieldValue = issue['Custom field (Team)'].trim();
      // Only use Custom field (Team) if it's not a numeric ID
      if (!isNumericTeamID(teamFieldValue)) {
        team = teamFieldValue;
      }
    }
    // Third priority: Extract from sprint name (only if parsed successfully and team is valid)
    if (!team && parsed && !isNumericTeamID(parsed.team)) {
      team = parsed.team;
    }
    // Fallback: Unknown
    if (!team) {
      team = 'Unknown';
    }

    if (team && team.trim() !== '') {
      teamSet.add(team.trim());
      const teamKey = team.trim();

      if (!issuesByTeamAndSprint[teamKey]) {
        issuesByTeamAndSprint[teamKey] = {};
      }
      if (!issuesByTeamAndBacklog[teamKey]) {
        issuesByTeamAndBacklog[teamKey] = [];
      }

      if (parsed) {
        const sprintKey = parsed.sprintKey;
        if (!issuesByTeamAndSprint[teamKey][sprintKey]) {
          issuesByTeamAndSprint[teamKey][sprintKey] = [];
        }
        issuesByTeamAndSprint[teamKey][sprintKey].push(issue);
      } else {
        // Backlog or invalid sprint
        issuesByTeamAndBacklog[teamKey].push(issue);
      }
    }
  }

  // Collect all unique sprint keys and sort them
  // Only include sprint keys that have at least one issue with a valid team (not "Unknown" or numeric IDs)
  const sprintKeySet = new Set<string>();
  for (const teamKey of teamSet) {
    // Skip "Unknown" team and numeric team IDs - don't create sprints for issues without valid teams
    if (
      teamKey === 'Unknown' ||
      teamKey.trim() === '' ||
      isNumericTeamID(teamKey)
    ) {
      continue;
    }

    const teamSprints = issuesByTeamAndSprint[teamKey];
    if (teamSprints) {
      for (const sprintKey of Object.keys(teamSprints)) {
        sprintKeySet.add(sprintKey);
      }
    }
  }

  const sprintKeys = Array.from(sprintKeySet).sort((a, b) => {
    // Sort by year first, then sprint number
    const [yearA, sprintA] = a.split('-').map(Number);
    const [yearB, sprintB] = b.split('-').map(Number);
    if (yearA !== yearB) {
      return yearA - yearB;
    }
    return sprintA - sprintB;
  });

  // Add 6 future sprints for PI planning purposes
  // Calculate the next 6 sprints after the last sprint in the data
  const futureSprintKeys: string[] = [];
  if (sprintKeys.length > 0) {
    const lastSprintKey = sprintKeys[sprintKeys.length - 1];
    const [lastYear, lastSprintNumber] = lastSprintKey.split('-').map(Number);

    // Calculate the next 6 sprints
    for (let i = 1; i <= 6; i++) {
      let nextYear = lastYear;
      let nextSprintNumber = lastSprintNumber + i;

      // Handle year rollover (sprints go up to 25, then roll to next year)
      if (nextSprintNumber > 25) {
        nextYear = lastYear + 1;
        nextSprintNumber = nextSprintNumber - 25;
      }

      const futureSprintKey = `${nextYear}-${nextSprintNumber}`;
      futureSprintKeys.push(futureSprintKey);
      sprintKeys.push(futureSprintKey);
    }
  }

  // Calculate sprint column widths (accounting for epics that span multiple columns)
  const sprintColumnWidths: { [sprintKey: string]: number } = {};
  const MAX_CARDS_PER_COLUMN = 5; // Match the constant used in processTeamSprintTickets
  for (const sprintKey of sprintKeys) {
    // Future sprints are always 6 columns wide for PI planning
    if (futureSprintKeys.includes(sprintKey)) {
      sprintColumnWidths[sprintKey] = 6;
      continue;
    }

    let maxColumns = 0;
    for (const team of teamSet) {
      const teamSprintIssues =
        (issuesByTeamAndSprint[team] &&
          issuesByTeamAndSprint[team][sprintKey]) ||
        [];
      // Group by epic and count columns needed (epics with >5 tickets need multiple columns)
      const epicTicketCounts: { [epicKey: string]: number } = {};
      for (const issue of teamSprintIssues) {
        const epicLink =
          issue['Custom field (Epic Link)'] ||
          issue['Epic Link'] ||
          issue['Epic'] ||
          '';
        const epicKey = epicLink.trim() || 'No Epic';
        epicTicketCounts[epicKey] = (epicTicketCounts[epicKey] || 0) + 1;
      }
      // Calculate total columns needed: each epic needs columns based on total items (epic card + tickets)
      // Epic cards count toward the MAX_CARDS_PER_COLUMN limit, so we calculate: ceil((1 epic card + tickets) / MAX_CARDS_PER_COLUMN)
      let totalColumns = 0;
      for (const epicKey in epicTicketCounts) {
        const ticketCount = epicTicketCounts[epicKey];
        // Epic card (1) + tickets, all count toward the column limit
        const totalItems = 1 + ticketCount;
        const columnsForEpic = Math.ceil(totalItems / MAX_CARDS_PER_COLUMN);
        totalColumns += columnsForEpic;
      }
      maxColumns = Math.max(maxColumns, totalColumns);
    }
    // Minimum 1 column
    sprintColumnWidths[sprintKey] = Math.max(1, maxColumns);
  }

  // Filter out "Unknown" teams and numeric team IDs - only include teams that have valid names
  const teams = Array.from(teamSet)
    .filter(
      (team) =>
        team !== 'Unknown' && team.trim() !== '' && !isNumericTeamID(team)
    )
    .sort();

  return {
    teams,
    sprintKeys,
    issuesByTeamAndSprint,
    issuesByTeamAndBacklog,
    sprintColumnWidths,
    epicIssues,
  };
}

/**
 * Parses story points from a string value.
 */
function parseStoryPoints(value: string): number {
  if (!value || value.trim() === '' || value === '?' || value === '#') {
    return 0;
  }
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : Math.round(parsed);
}

/**
 * Calculates capacity per assignee for a set of issues.
 */
function calculateCapacity(issues: { [key: string]: string }[]): {
  [assignee: string]: number;
} {
  const capacity: { [assignee: string]: number } = {};
  for (const issue of issues) {
    const assignee = issue['Assignee'] || 'Unassigned';
    const storyPointsStr = issue['Custom field (Story Points)'] || '';
    const points = parseStoryPoints(storyPointsStr);
    capacity[assignee] = (capacity[assignee] || 0) + points;
  }
  return capacity;
}

/**
 * Calculates the height needed for a capacity table.
 */
function calculateTableHeight(capacity: {
  [assignee: string]: number;
}): number {
  const rowHeight = TABLE_CONFIG.ROW_HEIGHT;
  const headerSpacing = TABLE_CONFIG.HEADER_SPACING;
  const dataRowCount = Object.values(capacity).filter(
    (points) => points > 0
  ).length;
  return rowHeight + headerSpacing + dataRowCount * rowHeight;
}

/**
 * Creates a capacity table showing allocated story points per assignee.
 */
async function createCapacityTable(
  capacity: { [assignee: string]: number },
  x: number,
  y: number,
  width: number
): Promise<{ height: number; nodes: SceneNode[] }> {
  await ensureFontsLoaded();
  const nodes: SceneNode[] = [];
  const rowHeight = TABLE_CONFIG.ROW_HEIGHT;
  const columnSpacing = TABLE_CONFIG.COLUMN_SPACING;
  const headerFontSize = TABLE_CONFIG.HEADER_FONT_SIZE;
  const dataFontSize = TABLE_CONFIG.DATA_FONT_SIZE;
  let currentY = y;

  // Create header row - Allocated first, then Assignee
  const headerAllocated = figma.createText();
  headerAllocated.characters = 'Allocated';
  headerAllocated.fontSize = headerFontSize;
  try {
    headerAllocated.fontName = { family: 'Inter', style: 'Bold' };
  } catch (e) {
    console.warn('Could not set Bold font for table header, using default');
  }
  headerAllocated.fills = [{ type: 'SOLID', color: COLOR_CONFIG.TABLE_TEXT }];
  headerAllocated.x = x; // First column
  headerAllocated.y = currentY;
  figma.currentPage.appendChild(headerAllocated);
  nodes.push(headerAllocated);

  const headerAssignee = figma.createText();
  headerAssignee.characters = 'Assignee';
  headerAssignee.fontSize = headerFontSize;
  try {
    headerAssignee.fontName = { family: 'Inter', style: 'Bold' };
  } catch (e) {
    console.warn('Could not set Bold font for table header, using default');
  }
  headerAssignee.fills = [{ type: 'SOLID', color: COLOR_CONFIG.TABLE_TEXT }];
  // Position second column (estimate width of first column)
  headerAssignee.x = x + TABLE_CONFIG.FIRST_COLUMN_WIDTH + columnSpacing;
  headerAssignee.y = currentY;
  figma.currentPage.appendChild(headerAssignee);
  nodes.push(headerAssignee);

  currentY += rowHeight + TABLE_CONFIG.HEADER_SPACING;

  // Sort assignees by allocation (highest to lowest)
  const sortedAssignees = Object.keys(capacity).sort((a, b) => {
    return capacity[b] - capacity[a]; // Descending order
  });

  // Create data rows
  for (const assignee of sortedAssignees) {
    const points = capacity[assignee];
    if (points === 0) continue; // Skip assignees with 0 points

    // Allocated column (first)
    const pointsText = figma.createText();
    pointsText.characters = points.toString();
    pointsText.fontSize = dataFontSize;
    pointsText.fills = [{ type: 'SOLID', color: COLOR_CONFIG.TABLE_TEXT }];
    pointsText.x = x; // First column
    pointsText.y = currentY;
    figma.currentPage.appendChild(pointsText);
    nodes.push(pointsText);

    // Assignee column (second)
    const assigneeText = figma.createText();
    // Truncate assignee if it's an email longer than 25 characters
    assigneeText.characters = truncateAssignee(assignee);
    assigneeText.fontSize = dataFontSize;
    assigneeText.fills = [{ type: 'SOLID', color: COLOR_CONFIG.TABLE_TEXT }];
    assigneeText.x = x + TABLE_CONFIG.FIRST_COLUMN_WIDTH + columnSpacing; // Second column
    assigneeText.y = currentY;
    figma.currentPage.appendChild(assigneeText);
    nodes.push(assigneeText);

    currentY += rowHeight;
  }

  return { height: currentY - y, nodes };
}

/**
 * Processes a batch of issues and creates cards, yielding control periodically.
 * @param issues - Array of issues to process
 * @param startIndex - Starting index in the issues array
 * @param batchSize - Number of issues to process in this batch
 * @param epicX - X coordinate for the epic column
 * @param cardsStartY - Starting Y coordinate for cards
 * @param epicKey - Epic key for this column
 * @param epicColumnHeights - Track of column heights
 * @param columnIndex - Index of the column
 * @param columnHeights - Array of column heights
 * @param createdFrames - Array to collect created frames
 * @param spacing - Spacing between cards
 * @param sprint - Sprint name for this batch of issues
 * @param epicLink - Epic link value for this batch of issues
 * @returns Object with created count, skipped count, and updated heights
 */
async function processIssueBatch(
  issues: Array<{ [key: string]: string }>,
  startIndex: number,
  batchSize: number,
  epicX: number,
  cardsStartY: number,
  epicKey: string,
  epicColumnHeights: { [epicKey: string]: number },
  epicColumnCardCounts: { [epicKey: string]: number },
  epicColumnOffsets: { [epicKey: string]: number },
  columnIndex: number,
  columnHeights: number[],
  createdFrames: FrameNode[],
  spacing: number,
  columnWidth: number,
  jiraBaseUrl?: string,
  sprint?: string,
  epicLink?: string,
  importVerbose: boolean = true
): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;
  const endIndex = Math.min(startIndex + batchSize, issues.length);
  const MAX_CARDS_PER_COLUMN = 5;

  for (let i = startIndex; i < endIndex; i++) {
    const issue = issues[i];
    const mapped = mapJiraIssueToTemplate(issue);
    if (!mapped) {
      skipped++;
      continue;
    }

    try {
      // Check if we need to roll over to a new column (15 card limit)
      if (epicColumnCardCounts[epicKey] >= MAX_CARDS_PER_COLUMN) {
        // Reset height and card count for new column, increment column offset
        epicColumnHeights[epicKey] = 0;
        epicColumnCardCounts[epicKey] = 0;
        epicColumnOffsets[epicKey] += 1;
      }

      // Calculate X position for current column (accounting for rollover)
      const currentX = epicX + epicColumnOffsets[epicKey] * columnWidth;
      const y = cardsStartY + epicColumnHeights[epicKey];
      const frame = await createTemplateCardWithPosition(
        mapped.templateType,
        mapped.data,
        currentX,
        y,
        jiraBaseUrl,
        importVerbose
      );

      // Store sprint and epic link in plugin data for round-trip export
      // Extract sprint from issue if not provided, or use the sprint parameter
      const issueSprint = sprint || getSprintValue(issue);
      if (
        issueSprint &&
        issueSprint.trim() !== '' &&
        issueSprint !== 'Backlog'
      ) {
        frame.setPluginData('sprint', issueSprint);
      }

      // Extract epic link from issue if not provided, or use the epicLink parameter
      const issueEpicLink =
        epicLink ||
        issue['Custom field (Epic Link)'] ||
        issue['Epic Link'] ||
        issue['Epic'] ||
        '';
      if (issueEpicLink && issueEpicLink.trim() !== '') {
        frame.setPluginData('epicLink', issueEpicLink.trim());
      }

      // Store team/studio value in plugin data for round-trip export
      // Extract team from issue (Custom field (Studio) or Custom field (Team))
      const issueTeam =
        issue['Custom field (Studio)'] || issue['Custom field (Team)'] || '';
      if (issueTeam && issueTeam.trim() !== '') {
        frame.setPluginData('team', issueTeam.trim());
      }

      // Store full description in plugin data for Theme, Epic, and Initiative
      // This preserves the full description for export even though display is truncated
      if (
        mapped.templateType === 'theme' ||
        mapped.templateType === 'epic' ||
        mapped.templateType === 'initiative'
      ) {
        // Get the original description from the issue (before truncation)
        const originalDescription = issue['Description'] || '';
        if (originalDescription && originalDescription.trim() !== '') {
          // Format the description (remove Jira formatting) before storing
          const formattedDescription = formatJiraText(originalDescription);
          frame.setPluginData('fullDescription', formattedDescription);
        }
      }

      // Verify issue key and template type were stored (for debugging)
      const storedIssueKey = frame.getPluginData('issueKey');
      const storedTemplateType = frame.getPluginData('templateType');
      console.log(
        `Created card: ${mapped.data.title || 'Untitled'}, frame.name: ${
          frame.name
        }, templateType: ${storedTemplateType}, issueKey: ${storedIssueKey}, sprint: ${issueSprint}, epicLink: ${issueEpicLink}`
      );
      if (mapped.data.issueKey && !storedIssueKey) {
        console.warn(
          `Issue key not stored for card: ${mapped.data.title}, issueKey: ${mapped.data.issueKey}`
        );
      }
      if (!storedTemplateType) {
        console.warn(
          `Template type not stored for card: ${mapped.data.title}, frame.name: ${frame.name}`
        );
      }

      createdFrames.push(frame);
      epicColumnHeights[epicKey] += frame.height + spacing;
      epicColumnCardCounts[epicKey] += 1; // Increment card count
      // Update column height for the base column (epicIndex)
      // This tracks the maximum height across all rollover columns for this epic
      columnHeights[columnIndex] = Math.max(
        columnHeights[columnIndex],
        epicColumnHeights[epicKey]
      );
      created++;
    } catch (error) {
      skipped++;
      console.error('Error creating card:', error);
    }
  }

  return { created, skipped };
}

// yieldToUI is imported from utils.ts

/**
 * Processes tickets for a team in a specific sprint column, organized by epic.
 * Returns an object with the maximum Y position reached and the actual number of columns used.
 * Uses cumulative X offset like the original single-team implementation.
 */
async function processTeamSprintTickets(
  team: string,
  sprintKey: string,
  issues: Array<{ [key: string]: string }>,
  sprintX: number,
  startY: number,
  columnWidth: number,
  epicIssues: Array<{ [key: string]: string }>,
  epicToFirstSprintKey: { [epicKey: string]: string },
  createdFrames: FrameNode[],
  jiraBaseUrl?: string,
  updateLastCardBottom?: (bottom: number) => void,
  importVerbose: boolean = true
): Promise<{ maxY: number; columnsUsed: number }> {
  const spacing = LAYOUT_CONFIG.CARD_SPACING;
  const cardWidth = CARD_CONFIG.WIDTH;
  const MAX_CARDS_PER_COLUMN = 5;

  // Group issues by epic
  const issuesByEpic: { [epicKey: string]: Array<{ [key: string]: string }> } =
    {};
  for (const issue of issues) {
    const epicLink =
      issue['Custom field (Epic Link)'] ||
      issue['Epic Link'] ||
      issue['Epic'] ||
      '';
    const epicKey = epicLink.trim() || 'No Epic';
    if (!issuesByEpic[epicKey]) {
      issuesByEpic[epicKey] = [];
    }
    issuesByEpic[epicKey].push(issue);
  }

  const sortedEpics = Object.keys(issuesByEpic).sort();
  let currentY = startY;

  // Track heights, card counts, and offsets for each epic (for rollover columns)
  const epicHeights: { [epicKey: string]: number } = {};
  const epicCardCounts: { [epicKey: string]: number } = {};
  const epicOffsets: { [epicKey: string]: number } = {};
  // Track epic label/card frames so we can resize them if they span multiple columns
  const epicLabelFrames: { [epicKey: string]: FrameNode } = {};
  // Track epic card/label height separately so cards in wrapped columns align properly
  const epicCardHeights: { [epicKey: string]: number } = {};
  for (const epicKey of sortedEpics) {
    epicHeights[epicKey] = 0;
    epicCardCounts[epicKey] = 0;
    epicOffsets[epicKey] = 0;
    epicCardHeights[epicKey] = 0;
  }

  // Track cumulative X offset for positioning epics (accounts for rollover columns)
  let cumulativeXOffset = 0;

  // Process each epic column
  for (let epicIndex = 0; epicIndex < sortedEpics.length; epicIndex++) {
    const epicKey = sortedEpics[epicIndex];
    const epicColumnIssues = issuesByEpic[epicKey];

    // Calculate X position for this epic column (accounting for previous epics' rollover columns)
    const baseEpicX = sprintX + cumulativeXOffset;
    let currentEpicX = baseEpicX;

    // Find epic card to place (if any)
    let epicCardToPlace: { [key: string]: string } | null = null;
    let isFirstSprintForEpic = false;
    if (epicKey !== 'No Epic') {
      // Find the epic issue from all epic issues in the CSV
      for (const epic of epicIssues) {
        const epicIssueKey = epic['Issue key'] || '';
        if (epicIssueKey.trim() === epicKey.trim()) {
          epicCardToPlace = epic;
          break;
        }
      }

      // Check if this is the first sprint for this epic
      if (epicCardToPlace) {
        const epicIssueKey = epicCardToPlace['Issue key'] || '';
        const firstSprintKey = epicToFirstSprintKey[epicIssueKey];
        isFirstSprintForEpic = firstSprintKey === sprintKey;
      }
    }

    // Place epic card/label if needed
    // Full epic card appears in the first sprint, simplified labels in all sprints with tickets
    if (epicCardToPlace && epicColumnIssues.length > 0) {
      try {
        const epicIssueKey = epicCardToPlace['Issue key'] || '';
        const epicTitle = epicCardToPlace['Summary'] || 'Epic';
        const epicStatus = epicCardToPlace['Status'] || 'Open';
        const epicPriorityRank =
          epicCardToPlace['Priority'] ||
          epicCardToPlace['Custom field (Priority Rank)'] ||
          '#';

        if (isFirstSprintForEpic) {
          const mapped = mapJiraIssueToTemplate(epicCardToPlace);
          if (mapped && mapped.templateType === 'epic') {
            const y = startY + epicHeights[epicKey];
            const frame = await createTemplateCardWithPosition(
              mapped.templateType,
              mapped.data,
              currentEpicX,
              y,
              jiraBaseUrl,
              importVerbose
            );

            const issueSprint = getSprintValue(epicCardToPlace);
            if (
              issueSprint &&
              issueSprint.trim() !== '' &&
              issueSprint !== 'Backlog'
            ) {
              frame.setPluginData('sprint', issueSprint);
            }
            if (epicIssueKey && epicIssueKey.trim() !== '') {
              frame.setPluginData('epicLink', epicIssueKey.trim());
            }

            const issueTeam =
              epicCardToPlace['Custom field (Studio)'] ||
              epicCardToPlace['Custom field (Team)'] ||
              '';
            if (issueTeam && issueTeam.trim() !== '') {
              frame.setPluginData('team', issueTeam.trim());
            }

            const originalDescription = epicCardToPlace['Description'] || '';
            if (originalDescription && originalDescription.trim() !== '') {
              const formattedDescription = formatJiraText(originalDescription);
              frame.setPluginData('fullDescription', formattedDescription);
            }

            createdFrames.push(frame);
            epicCardHeights[epicKey] = frame.height + spacing; // Store epic card height separately
            epicHeights[epicKey] += frame.height + spacing;
            epicCardCounts[epicKey] += 1;
            currentY = Math.max(currentY, startY + epicHeights[epicKey]);
            // Store reference to epic card for potential resizing
            epicLabelFrames[epicKey] = frame;
            // Track epic card bottom for vertical line calculation
            const epicCardBottom = y + frame.height;
            if (updateLastCardBottom) {
              updateLastCardBottom(epicCardBottom);
            }
          }
        } else {
          // Place simplified epic label in subsequent sprints (all sprints with tickets)
          const y = startY + epicHeights[epicKey];
          const labelFrame = await createEpicLabelCard(
            epicTitle,
            epicStatus,
            epicPriorityRank,
            epicIssueKey,
            currentEpicX,
            y,
            jiraBaseUrl
          );

          createdFrames.push(labelFrame);
          epicCardHeights[epicKey] = labelFrame.height + spacing; // Store epic label height separately
          epicHeights[epicKey] += labelFrame.height + spacing;
          // Don't count label cards toward the 15-card limit
          currentY = Math.max(currentY, startY + epicHeights[epicKey]);
          // Store reference to epic label for potential resizing
          epicLabelFrames[epicKey] = labelFrame;
          // Track epic label bottom for vertical line calculation
          const epicLabelBottom = y + labelFrame.height;
          if (updateLastCardBottom) {
            updateLastCardBottom(epicLabelBottom);
          }
        }
      } catch (error) {
        console.error('Error creating epic card/label:', error);
      }
    }

    // Filter out the epic issue from the list of issues to process (if it was included)
    let issuesToProcess = epicColumnIssues.filter(
      (issue: { [key: string]: string }) => {
        const issueType = (issue['Issue Type'] || '').trim().toLowerCase();
        const issueKey = issue['Issue key'] || '';
        // Exclude the epic issue itself if it matches the epic key
        if (
          epicCardToPlace &&
          issueType === 'epic' &&
          issueKey.trim() === epicKey.trim()
        ) {
          return false; // Skip the epic issue, it's already placed
        }
        return true;
      }
    );

    // Sort by story points (highest to lowest)
    issuesToProcess.sort((a, b) => {
      const getStoryPoints = (issue: {
        [key: string]: string;
      }): number | null => {
        const storyPointsStr = issue['Custom field (Story Points)'] || '';
        if (
          !storyPointsStr ||
          storyPointsStr.trim() === '' ||
          storyPointsStr.trim() === '?'
        ) {
          return null;
        }
        return parseStoryPoints(storyPointsStr);
      };

      const pointsA = getStoryPoints(a);
      const pointsB = getStoryPoints(b);

      if (pointsA === null && pointsB === null) return 0;
      if (pointsA === null) return 1;
      if (pointsB === null) return -1;
      return pointsB - pointsA;
    });

    // Process tickets in batches
    const BATCH_SIZE = 10;
    for (
      let batchStart = 0;
      batchStart < issuesToProcess.length;
      batchStart += BATCH_SIZE
    ) {
      const batchEnd = Math.min(
        batchStart + BATCH_SIZE,
        issuesToProcess.length
      );
      const batch = issuesToProcess.slice(batchStart, batchEnd);

      for (const issue of batch) {
        // Check if we need to roll over to a new column (5 card limit)
        if (epicCardCounts[epicKey] >= MAX_CARDS_PER_COLUMN) {
          // Reset height and card count for new column, increment column offset
          // Cards in wrapped columns should align with cards in first column (after epic card)
          epicHeights[epicKey] = epicCardHeights[epicKey]; // Start after epic card height
          epicCardCounts[epicKey] = 0;
          epicOffsets[epicKey] += 1;
        }

        // Calculate X position for current column (accounting for rollover)
        const currentX = baseEpicX + epicOffsets[epicKey] * columnWidth;
        const mapped = mapJiraIssueToTemplate(issue);
        if (!mapped) continue;

        try {
          const y = startY + epicHeights[epicKey];
          const frame = await createTemplateCardWithPosition(
            mapped.templateType,
            mapped.data,
            currentX,
            y,
            jiraBaseUrl,
            importVerbose
          );

          const issueSprint = getSprintValue(issue);
          if (
            issueSprint &&
            issueSprint.trim() !== '' &&
            issueSprint !== 'Backlog'
          ) {
            frame.setPluginData('sprint', issueSprint);
          }

          const issueEpicLink =
            issue['Custom field (Epic Link)'] ||
            issue['Epic Link'] ||
            issue['Epic'] ||
            '';
          if (issueEpicLink && issueEpicLink.trim() !== '') {
            frame.setPluginData('epicLink', issueEpicLink.trim());
          }

          const issueTeam =
            issue['Custom field (Studio)'] ||
            issue['Custom field (Team)'] ||
            '';
          if (issueTeam && issueTeam.trim() !== '') {
            frame.setPluginData('team', issueTeam.trim());
          }

          if (
            mapped.templateType === 'theme' ||
            mapped.templateType === 'epic' ||
            mapped.templateType === 'initiative'
          ) {
            const originalDescription = issue['Description'] || '';
            if (originalDescription && originalDescription.trim() !== '') {
              const formattedDescription = formatJiraText(originalDescription);
              frame.setPluginData('fullDescription', formattedDescription);
            }
          }

          createdFrames.push(frame);
          epicHeights[epicKey] += frame.height + spacing;
          epicCardCounts[epicKey] += 1; // Increment card count
          // Track the actual bottom of the card (y + height), not including spacing after
          const cardBottom = y + frame.height;
          currentY = Math.max(currentY, cardBottom);

          // Update the last card bottom tracker if provided
          if (updateLastCardBottom) {
            updateLastCardBottom(cardBottom);
          }
        } catch (error) {
          console.error('Error creating card:', error);
        }
      }
    }

    // Resize epic label/card if it spans multiple columns
    if (epicLabelFrames[epicKey] && epicOffsets[epicKey] > 0) {
      const epicLabelFrame = epicLabelFrames[epicKey];
      // Calculate total width to span all columns used by this epic
      const totalColumnsForThisEpic = 1 + epicOffsets[epicKey];
      const newWidth = totalColumnsForThisEpic * columnWidth - spacing;
      const oldWidth = epicLabelFrame.width;
      const originalHeight = epicLabelFrame.height; // Store original height

      // Resize the epic label frame to span all columns, keeping the same height
      epicLabelFrame.resize(newWidth, originalHeight);

      // Update child elements to fill the new width
      const padding = CARD_CONFIG.PADDING;
      const iconSize = CARD_CONFIG.ICON_SIZE;

      // Find and update elements:
      // 1. Title text (first text node at top, left-aligned) - expand width
      // 2. Icon (shape/vector/frame/group at top right) - right-justify
      // 3. Priority rank (large number at bottom right) - right-justify
      // 4. Status (text at bottom left) - stays at left
      // 5. Field value text nodes (for full epic cards) - expand width

      // Track which elements we've found
      let titleTextFound = false;
      let iconFound = false;
      const iconRightEdge = newWidth - padding;

      for (const child of epicLabelFrame.children) {
        if (child.type === 'TEXT') {
          const textNode = child as TextNode;
          // Title is typically the first text node at the top (y = padding)
          if (!titleTextFound && textNode.y === padding) {
            // Title text - expand to fill new width (accounting for icon on right)
            // Calculation: newWidth - left padding - icon size - right padding
            const titleMaxWidth = newWidth - padding - iconSize - padding;

            // Get the original unwrapped text (remove newlines that were added by wrapTitleText)
            const originalText = textNode.characters.replace(/\n/g, ' ');

            // Store original title height for comparison
            const originalTitleHeight = textNode.height;

            // Remove newlines and update text - this allows the text to flow naturally at new width
            textNode.characters = originalText;

            // Resize to new width - Figma will automatically wrap text based on the width
            // We need to set a height that's large enough, then let it auto-adjust
            // Use a large initial height, then resize based on actual content
            textNode.resize(titleMaxWidth, 1000); // Large height to allow wrapping
            // Now resize to actual height (Figma calculates this automatically)
            const newTitleHeight = textNode.height;

            // Adjust frame height if title height changed
            if (Math.abs(newTitleHeight - originalTitleHeight) > 1) {
              const heightDiff = newTitleHeight - originalTitleHeight;
              const newFrameHeight = originalHeight + heightDiff;
              epicLabelFrame.resize(newWidth, newFrameHeight);
            } else {
              // Keep original frame dimensions
              epicLabelFrame.resize(newWidth, originalHeight);
            }
            titleTextFound = true;
          } else {
            // Check if this is a field value text (for full epic cards)
            // Field values are resized to cardWidth - PADDING * 2, so check if width matches old width
            if (Math.abs(textNode.width - (oldWidth - padding * 2)) < 5) {
              // This is likely a field value text - expand to new width
              // Store original height to prevent auto-growth
              const originalTextHeight = textNode.height;
              textNode.resize(newWidth - padding * 2, originalTextHeight);
              // Ensure frame height doesn't change (Figma might auto-resize)
              if (epicLabelFrame.height !== originalHeight) {
                epicLabelFrame.resize(newWidth, originalHeight);
              }
            } else {
              // Bottom text (status or priority) - check x position to identify
              // Status is at left (x = padding), priority is at right
              if (textNode.x === padding) {
                // Status - stays at left, no change needed
              } else {
                // Priority rank - always right-justify to new width
                // Identify by: not at left (x !== padding) and at bottom (y > padding + some threshold)
                // For epic labels, priority is always at bottom right
                textNode.x = iconRightEdge - textNode.width;
              }
            }
          }
        } else if (
          child.type === 'VECTOR' ||
          child.type === 'ELLIPSE' ||
          child.type === 'RECTANGLE' ||
          child.type === 'POLYGON' ||
          child.type === 'STAR' ||
          child.type === 'LINE'
        ) {
          // Icon shape - right-justify to new width
          if (!iconFound && child.y === padding) {
            child.x = iconRightEdge - iconSize;
            iconFound = true;
          }
        } else if (child.type === 'FRAME' || child.type === 'GROUP') {
          // Icon might be in a frame or group - check if it's at the top right
          // Icon is typically at y = padding and x near the right edge
          if (!iconFound && child.y === padding && child.x > oldWidth * 0.7) {
            child.x = iconRightEdge - iconSize;
            iconFound = true;
          }
        }
      }

      // Final check: ensure frame height hasn't changed (Figma might auto-resize)
      if (epicLabelFrame.height !== originalHeight) {
        epicLabelFrame.resize(newWidth, originalHeight);
      }
    }

    // Update cumulative X offset for next epic (base column + all rollover columns)
    // Add 1 for base column, plus any rollover columns
    const totalColumnsForThisEpic = 1 + epicOffsets[epicKey];
    cumulativeXOffset += totalColumnsForThisEpic * columnWidth;
  }

  // Calculate total columns used (sum of all epic columns)
  let totalColumnsUsed = 0;
  for (const epicKey of sortedEpics) {
    totalColumnsUsed += 1 + epicOffsets[epicKey];
  }

  return { maxY: currentY, columnsUsed: totalColumnsUsed };
}

/**
 * Imports cards from CSV text and creates them on the FigJam canvas.
 * Creates a multi-team swimlane layout where teams are rows and sprints are columns.
 * Uses batched processing for large imports to prevent UI blocking.
 * @param csvText - The CSV text to import
 * @param jiraBaseUrl - Optional Jira base URL for creating hyperlinks
 * @throws {Error} If CSV text is invalid or import fails
 */
async function importCardsFromCSV(
  csvText: string,
  jiraBaseUrl?: string,
  importVerbose: boolean = true
): Promise<void> {
  console.log(
    'importCardsFromCSV called with csvText length:',
    (csvText && csvText.length) || 0
  );
  console.log('importCardsFromCSV called with jiraBaseUrl:', jiraBaseUrl);
  console.log(
    'importCardsFromCSV called with importVerbose:',
    importVerbose,
    'type:',
    typeof importVerbose
  );

  try {
    validateCSVText(csvText);
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    figma.notify(`❌ CSV validation error: ${errorMessage}`);
    console.error('CSV validation error:', error);
    return;
  }

  let issues: Array<{ [key: string]: string }>;
  try {
    issues = parseCSV(csvText);
    console.log(`Parsed ${issues.length} rows from CSV`);
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    figma.notify(`❌ Error parsing CSV: ${errorMessage}`);
    console.error('CSV parsing error:', error);
    return;
  }

  if (issues.length === 0) {
    figma.notify('❌ No data found in CSV file');
    console.error('No issues parsed from CSV');
    return;
  }

  // Set importing flag to suppress duplicate notifications during import
  isImporting = true;

  try {
    // Show initial progress
    figma.notify(
      `📊 Processing ${issues.length} issues... this may take a minute or two`,
      { timeout: 2000 }
    );

    try {
      await ensureFontsLoaded();
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      figma.notify(`❌ Error loading fonts: ${errorMessage}`);
      console.error('Font loading error:', error);
      return;
    }

    // Preprocess data for multi-team swimlane layout
    const preprocessed = preprocessMultiTeamData(issues);
    const {
      teams,
      sprintKeys,
      issuesByTeamAndSprint,
      issuesByTeamAndBacklog,
      sprintColumnWidths,
      epicIssues,
    } = preprocessed;

    console.log('Preprocessing results:');
    console.log(`  Teams found: ${teams.length}`, teams);
    console.log(`  Sprint keys found: ${sprintKeys.length}`, sprintKeys);
    console.log(`  Epic issues: ${epicIssues.length}`);
    console.log(
      '  Issues by team and sprint:',
      Object.keys(issuesByTeamAndSprint)
    );
    console.log(
      '  Issues by team and backlog:',
      Object.keys(issuesByTeamAndBacklog)
    );

    if (teams.length === 0) {
      figma.notify('❌ No teams found in CSV file');
      console.error('No teams identified from sprint names or issue fields');
      console.error('Sample issue for debugging:', issues[0]);
      return;
    }

    if (sprintKeys.length === 0) {
      figma.notify('⚠️ No valid sprints found, using single-team layout');
      console.error(
        'No valid sprints found. Sample sprint values:',
        issues.slice(0, 10).map((issue) => getSprintValue(issue))
      );
      // Fall back to original single-team logic if no valid sprints
      // (Keep existing single-team code here for backward compatibility)
      return;
    }

    // Build epic to first sprint key mapping
    const epicToFirstSprintKey: { [epicKey: string]: string } = {};
    for (const epic of epicIssues) {
      const epicKey = epic['Issue key'] || '';
      if (!epicKey) continue;

      // Find the first sprint key (in sorted order) that has tickets linked to this epic
      for (const sprintKey of sprintKeys) {
        let hasLinkedTickets = false;
        for (const team of teams) {
          const teamSprintIssues =
            (issuesByTeamAndSprint[team] &&
              issuesByTeamAndSprint[team][sprintKey]) ||
            [];
          hasLinkedTickets = teamSprintIssues.some((issue) => {
            const epicLink =
              issue['Custom field (Epic Link)'] ||
              issue['Epic Link'] ||
              issue['Epic'] ||
              '';
            return epicLink.trim() === epicKey.trim();
          });
          if (hasLinkedTickets) break;
        }

        if (hasLinkedTickets) {
          epicToFirstSprintKey[epicKey] = sprintKey;
          break;
        }
      }
    }

    const viewport = figma.viewport.center;
    const cardWidth = CARD_CONFIG.WIDTH;
    const spacing = LAYOUT_CONFIG.CARD_SPACING;
    const sprintSpacing = LAYOUT_CONFIG.SPRINT_SPACING;
    const columnWidth = cardWidth + spacing;

    let totalCreated = 0;
    let totalSkipped = 0;
    const createdFrames: FrameNode[] = [];

    // Create sprint column headers (vertical labels at top)
    const fixedSprintLabelY = viewport.y + LAYOUT_CONFIG.SPRINT_LABEL_Y_OFFSET;
    const sprintHeaderHeight = 100; // Space for sprint labels and dates

    // Calculate backlog column width based on actual columns needed (accounting for epics spanning multiple columns)
    const MAX_CARDS_PER_COLUMN = 5; // Match the constant used in processTeamSprintTickets
    let maxBacklogColumns = 0;
    for (const team of teams) {
      const backlogIssues = issuesByTeamAndBacklog[team] || [];
      // Filter out epics from backlog if they exist in sprints (same logic as below)
      const filteredBacklogIssues = backlogIssues.filter((issue) => {
        const issueType = (issue['Issue Type'] || '').trim().toLowerCase();
        if (issueType === 'epic') {
          const epicIssueKey = issue['Issue key'] || '';
          // If this epic has a designated sprint (not backlog), exclude it from backlog
          if (epicIssueKey && epicToFirstSprintKey[epicIssueKey]) {
            return false; // Exclude epic from backlog if it has a designated sprint
          }
        }
        return true; // Keep non-epic issues and epics without a designated sprint
      });

      // Group by epic and count columns needed (epics with >5 tickets need multiple columns)
      const epicTicketCounts: { [epicKey: string]: number } = {};
      for (const issue of filteredBacklogIssues) {
        const epicLink =
          issue['Custom field (Epic Link)'] ||
          issue['Epic Link'] ||
          issue['Epic'] ||
          '';
        const epicKey = epicLink.trim() || 'No Epic';
        epicTicketCounts[epicKey] = (epicTicketCounts[epicKey] || 0) + 1;
      }
      // Calculate total columns needed: each epic needs columns based on total items (epic card + tickets)
      // Epic cards count toward the MAX_CARDS_PER_COLUMN limit, so we calculate: ceil((1 epic card + tickets) / MAX_CARDS_PER_COLUMN)
      let totalColumns = 0;
      for (const epicKey in epicTicketCounts) {
        const ticketCount = epicTicketCounts[epicKey];
        // Epic card (1) + tickets, all count toward the column limit
        const totalItems = 1 + ticketCount;
        const columnsForEpic = Math.ceil(totalItems / MAX_CARDS_PER_COLUMN);
        totalColumns += columnsForEpic;
      }
      maxBacklogColumns = Math.max(maxBacklogColumns, totalColumns);
    }
    // Minimum 6 columns (as originally specified), but use actual needed columns if more
    const backlogColumnWidth =
      Math.max(6, maxBacklogColumns) * columnWidth - spacing;

    // Calculate sprint column positions (for vertical boxes and separators)
    // We'll create sprint labels per team below
    let totalSprintWidth = 0;
    for (const sprintKey of sprintKeys) {
      const sprintColumnWidth =
        sprintColumnWidths[sprintKey] * columnWidth - spacing;
      totalSprintWidth += sprintColumnWidth + sprintSpacing;
    }
    totalSprintWidth -= sprintSpacing; // Subtract last spacing

    // Calculate total width for separator (backlog + all sprints)
    const totalWidth = backlogColumnWidth + sprintSpacing + totalSprintWidth;

    // Store X positions for vertical boxes at midpoints between columns
    // (will be created after all teams are processed)
    // Backlog box: midpoint between backlog end and first sprint start
    const backlogVerticalBoxX =
      viewport.x + backlogColumnWidth + sprintSpacing / 2;

    // Sprint boxes: midpoints between each sprint column
    const sprintVerticalBoxPositions: number[] = [];
    let currentSprintX = viewport.x + backlogColumnWidth + sprintSpacing;
    for (let i = 0; i < sprintKeys.length; i++) {
      const sprintKey = sprintKeys[i];
      const sprintColumnWidth =
        sprintColumnWidths[sprintKey] * columnWidth - spacing;

      // If not the last sprint, calculate midpoint to next sprint
      if (i < sprintKeys.length - 1) {
        const nextSprintStart =
          currentSprintX + sprintColumnWidth + sprintSpacing;
        const midpoint = currentSprintX + sprintColumnWidth + sprintSpacing / 2;
        sprintVerticalBoxPositions.push(midpoint);
      }

      currentSprintX += sprintColumnWidth + sprintSpacing;
    }

    // Process each team (horizontal swimlanes)
    // Each team gets its own sprint labels, dates, lines, and capacity charts
    let teamYOffset = fixedSprintLabelY + sprintHeaderHeight;
    const teamSpacing = 50; // Space between teams
    const spacingAfterLine = LAYOUT_CONFIG.SPRINT_AFTER_LINE_SPACING;
    const spacingBetweenTableAndLabel = LAYOUT_CONFIG.SPRINT_TABLE_SPACING;

    // Track the actual bottom of the last card across all teams (for vertical box height)
    // This will be updated as each card is created
    let lastCardBottom = 0;
    // Track actual columns used per sprint to update widths dynamically
    const actualSprintColumns: { [sprintKey: string]: number } = {};
    // Track where cards actually start (for vertical box start position)
    let firstTeamCardsStartY: number | null = null;

    for (let teamIndex = 0; teamIndex < teams.length; teamIndex++) {
      const team = teams[teamIndex];
      // Track this team's last card bottom - will be initialized when we know cards start position
      let teamLastCardBottom = 0;
      // Track the maximum capacity table height for this team (across all sprints)
      // This is needed to add spacing so cards don't overlap with the next team's table
      let teamMaxCapacityTableHeight = 0;
      const teamSprintLabelY =
        teamYOffset + LAYOUT_CONFIG.SPRINT_LABEL_Y_OFFSET;

      // Process backlog for this team (at the beginning)
      let sprintXOffset = 0;
      const backlogIssues = issuesByTeamAndBacklog[team] || [];

      // Filter out epics from backlog if they exist in sprints
      const filteredBacklogIssues = backlogIssues.filter((issue) => {
        const issueType = (issue['Issue Type'] || '').trim().toLowerCase();
        if (issueType === 'epic') {
          const epicIssueKey = issue['Issue key'] || '';
          // If this epic has a designated sprint (not backlog), exclude it from backlog
          if (epicIssueKey && epicToFirstSprintKey[epicIssueKey]) {
            return false; // Exclude epic from backlog if it has a designated sprint
          }
        }
        return true; // Keep non-epic issues and epics without a designated sprint
      });

      // Create backlog label for this team (similar to sprint labels)
      const backlogLabel = figma.createText();
      backlogLabel.characters = 'Backlog';
      backlogLabel.fontSize = LAYOUT_CONFIG.SPRINT_LABEL_FONT_SIZE;
      try {
        backlogLabel.fontName = { family: 'Inter', style: 'Bold' };
      } catch (e) {
        console.warn(
          'Could not set Bold font for backlog label, using default'
        );
      }
      backlogLabel.fills = [{ type: 'SOLID', color: COLOR_CONFIG.TEXT_DARK }];

      // Position label centered above backlog column
      backlogLabel.x =
        viewport.x +
        sprintXOffset +
        (backlogColumnWidth - backlogLabel.width) / 2;
      backlogLabel.y = teamSprintLabelY;
      figma.currentPage.appendChild(backlogLabel);
      createdFrames.push(backlogLabel as any);

      // Create a dummy dates text to calculate the same spacing as sprint labels
      // This ensures the backlog line aligns with sprint lines
      const dummyDatesText = figma.createText();
      dummyDatesText.characters = 'MM/DD/YYYY - MM/DD/YYYY';
      dummyDatesText.fontSize = LAYOUT_CONFIG.SPRINT_DATES_FONT_SIZE;
      // Don't append to page, just use for height calculation
      const datesTextHeight = dummyDatesText.height;
      dummyDatesText.remove(); // Clean up

      // Add a line under the backlog label (aligned with sprint lines)
      // Match the sprint line calculation: label.y + label.height + 5 + dates.height + lineSpacing
      const backlogLine = figma.createLine();
      const backlogLineY =
        backlogLabel.y +
        backlogLabel.height +
        5 + // Same spacing as sprint dates (5px)
        datesTextHeight +
        LAYOUT_CONFIG.SPRINT_LINE_SPACING;
      const backlogLineStartX = viewport.x + sprintXOffset;

      backlogLine.x = backlogLineStartX;
      backlogLine.y = backlogLineY;
      backlogLine.resize(backlogColumnWidth, 0); // Horizontal line spanning backlog column
      backlogLine.strokes = [
        { type: 'SOLID', color: COLOR_CONFIG.TEXT_SECONDARY },
      ];
      backlogLine.strokeWeight = COLOR_CONFIG.BORDER_WEIGHT;

      figma.currentPage.appendChild(backlogLine);
      createdFrames.push(backlogLine as any);

      // Calculate starting Y position for backlog cards (after the line with spacing)
      // This matches the sprint cardsStartY calculation
      const backlogCardsStartY = backlogLineY + spacingAfterLine;

      // Track the first team's cards start position for vertical box positioning
      if (firstTeamCardsStartY === null) {
        firstTeamCardsStartY = backlogCardsStartY;
      }

      // Initialize teamLastCardBottom to backlog cards start position
      // This ensures proper positioning even if there are no cards
      if (teamLastCardBottom === 0) {
        teamLastCardBottom = backlogCardsStartY;
      }

      if (filteredBacklogIssues.length > 0) {
        const backlogResult = await processTeamSprintTickets(
          team,
          'Backlog',
          filteredBacklogIssues,
          viewport.x + sprintXOffset,
          backlogCardsStartY, // Align with sprint cards
          columnWidth,
          epicIssues,
          epicToFirstSprintKey,
          createdFrames,
          jiraBaseUrl,
          (bottom: number) => {
            lastCardBottom = Math.max(lastCardBottom, bottom);
            teamLastCardBottom = Math.max(teamLastCardBottom, bottom);
          },
          importVerbose
        );
      } else {
        // Even if no backlog issues, ensure teamLastCardBottom is at least at the cards start position
        teamLastCardBottom = Math.max(teamLastCardBottom, backlogCardsStartY);
      }
      sprintXOffset += backlogColumnWidth + sprintSpacing;

      // Process each sprint column for this team
      // Always process all sprints, even if team has no tickets in that sprint
      for (const sprintKey of sprintKeys) {
        const sprintColumnWidth =
          sprintColumnWidths[sprintKey] * columnWidth - spacing;
        const teamSprintIssues =
          (issuesByTeamAndSprint[team] &&
            issuesByTeamAndSprint[team][sprintKey]) ||
          [];

        // Use team name consistently for all sprints in this team row
        // The team variable from preprocessing should already be the full team name
        // (prioritizes Custom field (Studio) > Custom field (Team) > Sprint name)
        // Special case: Gadget Hackwrench uses "GH" abbreviation in sprint labels
        // Format: "{Team Name} {Sprint Key}" (e.g., "Triton 2025-25" or "GH 2025-25")
        let teamLabel = team;
        if (team === 'Gadget Hackwrench') {
          teamLabel = 'GH';
        }
        const sprintName = `${teamLabel} ${sprintKey}`;

        // Calculate capacity per assignee for this team's sprint
        // Only show allocation table if there are tickets
        const capacity = calculateCapacity(teamSprintIssues);

        // Calculate table height first (if table exists and there are tickets)
        let capacityTableHeight = 0;
        if (teamSprintIssues.length > 0 && Object.keys(capacity).length > 0) {
          capacityTableHeight = calculateTableHeight(capacity);
          // Track the maximum table height for this team (needed for spacing)
          teamMaxCapacityTableHeight = Math.max(
            teamMaxCapacityTableHeight,
            capacityTableHeight
          );

          // Create the table at the correct position (growing upward from label position)
          const tableX = viewport.x + sprintXOffset;
          const tableY =
            teamSprintLabelY -
            capacityTableHeight -
            spacingBetweenTableAndLabel;

          const tableResult = await createCapacityTable(
            capacity,
            tableX,
            tableY,
            sprintColumnWidth
          );

          // Add all table nodes to createdFrames for scrolling
          for (const node of tableResult.nodes) {
            createdFrames.push(node as any);
          }
        }

        // Create sprint label - large text spanning all epic columns
        const sprintLabel = figma.createText();
        sprintLabel.characters = sprintName;
        sprintLabel.fontSize = LAYOUT_CONFIG.SPRINT_LABEL_FONT_SIZE;
        try {
          sprintLabel.fontName = { family: 'Inter', style: 'Bold' };
        } catch (e) {
          console.warn(
            'Could not set Bold font for sprint label, using default'
          );
        }
        sprintLabel.fills = [{ type: 'SOLID', color: COLOR_CONFIG.TEXT_DARK }];

        // Position label centered above all epic columns
        sprintLabel.x =
          viewport.x +
          sprintXOffset +
          (sprintColumnWidth - sprintLabel.width) / 2;
        sprintLabel.y = teamSprintLabelY;
        figma.currentPage.appendChild(sprintLabel);
        createdFrames.push(sprintLabel as any);

        // Get sprint dates from the first issue in this sprint (if available)
        // If no tickets, try to find dates from any issue with this sprint key across all teams
        // If no dates found, calculate from sprint key (year-sprintNumber)
        let sprintDates = 'MM/DD/YYYY - MM/DD/YYYY';
        if (teamSprintIssues.length > 0) {
          sprintDates = getSprintDates(teamSprintIssues[0], sprintKey);
        } else {
          // Try to find dates from another team's sprint with the same sprint key
          for (const otherTeam of teams) {
            const otherTeamSprintIssues =
              (issuesByTeamAndSprint[otherTeam] &&
                issuesByTeamAndSprint[otherTeam][sprintKey]) ||
              [];
            if (otherTeamSprintIssues.length > 0) {
              sprintDates = getSprintDates(otherTeamSprintIssues[0], sprintKey);
              break;
            }
          }
          // If still no dates found, calculate from sprint key
          if (sprintDates === 'MM/DD/YYYY - MM/DD/YYYY') {
            sprintDates = getSprintDates({}, sprintKey);
          }
        }

        // Create sprint dates text - smaller font, positioned under the sprint label
        const sprintDatesText = figma.createText();
        sprintDatesText.characters = sprintDates;
        sprintDatesText.fontSize = LAYOUT_CONFIG.SPRINT_DATES_FONT_SIZE;
        sprintDatesText.fills = [
          { type: 'SOLID', color: COLOR_CONFIG.TEXT_SECONDARY },
        ];

        // Position dates centered under the sprint label
        sprintDatesText.x =
          viewport.x +
          sprintXOffset +
          (sprintColumnWidth - sprintDatesText.width) / 2;
        sprintDatesText.y = sprintLabel.y + sprintLabel.height + 5;

        figma.currentPage.appendChild(sprintDatesText);
        createdFrames.push(sprintDatesText as any);

        // Add a line under the sprint dates spanning all epic columns
        const line = figma.createLine();
        const lineY =
          sprintDatesText.y +
          sprintDatesText.height +
          LAYOUT_CONFIG.SPRINT_LINE_SPACING;
        const lineStartX = viewport.x + sprintXOffset;

        line.x = lineStartX;
        line.y = lineY;
        line.resize(sprintColumnWidth, 0); // Horizontal line spanning all epic columns
        line.strokes = [{ type: 'SOLID', color: COLOR_CONFIG.TEXT_SECONDARY }];
        line.strokeWeight = COLOR_CONFIG.BORDER_WEIGHT;

        figma.currentPage.appendChild(line);
        createdFrames.push(line as any);

        // Calculate starting Y position for cards (after the line with spacing)
        const cardsStartY = lineY + spacingAfterLine;

        // Track the first team's cards start position for vertical box positioning
        if (firstTeamCardsStartY === null) {
          firstTeamCardsStartY = cardsStartY;
        }

        if (teamSprintIssues.length > 0) {
          const result = await processTeamSprintTickets(
            team,
            sprintKey,
            teamSprintIssues,
            viewport.x + sprintXOffset,
            cardsStartY,
            columnWidth,
            epicIssues,
            epicToFirstSprintKey,
            createdFrames,
            jiraBaseUrl,
            (bottom: number) => {
              lastCardBottom = Math.max(lastCardBottom, bottom);
              teamLastCardBottom = Math.max(teamLastCardBottom, bottom);
            },
            importVerbose
          );
          // Track actual columns used (take max across teams)
          actualSprintColumns[sprintKey] = Math.max(
            actualSprintColumns[sprintKey] || 0,
            result.columnsUsed
          );
        } else {
          // Even if no sprint issues, ensure teamLastCardBottom is at least at the cards start position
          teamLastCardBottom = Math.max(teamLastCardBottom, cardsStartY);
        }

        sprintXOffset += sprintColumnWidth + sprintSpacing;
      }

      // Move to next team position (calculate based on last processed cards)
      // Move to next team position (calculate based on this team's last card bottom)
      if (teamIndex < teams.length - 1) {
        // Position next team below this team's last card with spacing
        // Also add space for the capacity table so cards don't overlap with the next team's table
        // The table extends upward from the label, so we need to account for its height
        const capacityTableSpacing =
          teamMaxCapacityTableHeight > 0
            ? teamMaxCapacityTableHeight + spacingBetweenTableAndLabel + 20 // Extra spacing for safety
            : 0;
        teamYOffset = teamLastCardBottom + teamSpacing + capacityTableSpacing;
      }
    }

    // Create vertical boxes (skinny rectangles) after all teams are processed
    // Use the actual bottom of the last card that was created
    const verticalBoxStartY = firstTeamCardsStartY || fixedSprintLabelY;
    // Stop at the actual bottom of the last card (lastCardBottom tracks this exactly)
    const verticalBoxHeight = lastCardBottom - verticalBoxStartY;
    const verticalBoxWidth = COLOR_CONFIG.BORDER_WEIGHT; // Use border weight as width for skinny boxes

    // Create backlog vertical box
    const backlogVerticalBox = figma.createRectangle();
    backlogVerticalBox.x = backlogVerticalBoxX;
    backlogVerticalBox.y = verticalBoxStartY;
    backlogVerticalBox.resize(verticalBoxWidth, verticalBoxHeight);
    backlogVerticalBox.fills = [
      { type: 'SOLID', color: COLOR_CONFIG.TEXT_SECONDARY },
    ];
    backlogVerticalBox.strokes = [];
    figma.currentPage.appendChild(backlogVerticalBox);
    createdFrames.push(backlogVerticalBox as any);

    // Create sprint vertical boxes
    for (const boxX of sprintVerticalBoxPositions) {
      const sprintVerticalBox = figma.createRectangle();
      sprintVerticalBox.x = boxX;
      sprintVerticalBox.y = verticalBoxStartY;
      sprintVerticalBox.resize(verticalBoxWidth, verticalBoxHeight);
      sprintVerticalBox.fills = [
        { type: 'SOLID', color: COLOR_CONFIG.TEXT_SECONDARY },
      ];
      sprintVerticalBox.strokes = [];
      figma.currentPage.appendChild(sprintVerticalBox);
      createdFrames.push(sprintVerticalBox as any);
    }

    // Count total created cards
    totalCreated = createdFrames.filter((frame) => {
      return frame.type === 'FRAME' && frame.getPluginData('templateType');
    }).length;

    // Scroll to show all created cards
    if (createdFrames.length > 0) {
      figma.viewport.scrollAndZoomIntoView(createdFrames);
    }

    const message =
      totalCreated > 0
        ? `✅ Import completed: ${totalCreated} card(s) created${
            totalSkipped > 0 ? `, ${totalSkipped} skipped` : ''
          }`
        : `⚠️ Import completed: No cards created${
            totalSkipped > 0 ? `, ${totalSkipped} skipped` : ''
          }`;
    figma.notify(message, { timeout: 3000 });
  } finally {
    // Always clear importing flag, even if there was an error
    isImporting = false;
  }
}

/**
 * Maps template display name to template key for lookups in TEMPLATES.
 */
function getTemplateKeyFromDisplayName(
  displayName: string
): keyof typeof TEMPLATES | null {
  // Map display names to template keys
  const displayNameToKey: { [key: string]: keyof typeof TEMPLATES } = {
    Theme: 'theme',
    Initiative: 'initiative',
    Milestone: 'milestone',
    Epic: 'epic',
    'User Story': 'userStory',
    Task: 'task',
    Spike: 'spike',
    Test: 'test',
  };
  return displayNameToKey[displayName] || null;
}

// Function to extract data from a card frame
function extractCardData(frame: FrameNode): CardData | null {
  // Check if this is one of our template cards by checking the name or plugin data
  // Use Set for O(1) lookup performance
  const cardTypes = new Set([
    'Theme',
    'Initiative',
    'Milestone',
    'Epic',
    'User Story',
    'Task',
    'Spike',
    'Test',
  ]);

  // First check frame name (primary method)
  let cardType = frame.name;

  // If frame name doesn't match, check plugin data for template type
  // This ensures imported cards are found even if frame name was changed
  if (!cardTypes.has(cardType)) {
    const templateTypeFromData = frame.getPluginData('templateType');
    if (templateTypeFromData && cardTypes.has(templateTypeFromData)) {
      cardType = templateTypeFromData;
    } else {
      // If we have an issueKey, this is likely an imported card
      // Try to infer the type from the frame structure or use a default
      const issueKey = frame.getPluginData('issueKey');
      if (issueKey && issueKey.trim() !== '') {
        // This is an imported card - try to infer type from frame structure
        // Check if frame has children that match our card structure
        const textNodes = frame.findAll(
          (node) => node.type === 'TEXT'
        ) as TextNode[];
        if (textNodes.length > 0) {
          // Try to match based on frame structure or default to 'User Story'
          // For now, default to 'User Story' as it's the most common type
          // The actual type should be stored in plugin data, but if it's missing,
          // we'll try to extract what we can
          cardType = 'User Story'; // Default fallback for imported cards
          console.warn(
            `Card with issueKey ${issueKey} missing templateType in plugin data, defaulting to User Story`
          );
        } else {
          // Not one of our template cards
          return null;
        }
      } else {
        // Not one of our template cards
        return null;
      }
    }
  }

  // Convert display name to template key for lookups in TEMPLATES
  let templateKey = getTemplateKeyFromDisplayName(cardType);
  if (!templateKey) {
    // If we can't identify the type but have an issueKey, try to infer from structure
    const issueKey = frame.getPluginData('issueKey');
    if (issueKey && issueKey.trim() !== '') {
      // This is an imported card - use a reasonable default
      // Check frame structure to try to infer type, or default to 'userStory'
      templateKey = 'userStory'; // Default fallback
      cardType = 'User Story'; // Update cardType to match
      console.warn(
        `Could not identify card type for imported card with issueKey ${issueKey}, defaulting to User Story. Frame name: ${
          frame.name
        }, templateType from data: ${frame.getPluginData('templateType')}`
      );
    } else {
      // Invalid card type and no issueKey, skip this card
      console.log(
        `Skipping frame ${frame.name} - not a template card and no issueKey`
      );
      return null;
    }
  }

  const fields: { label: string; value: string }[] = [];

  // Find all text nodes in the frame
  const textNodes = frame.findAll((node) => node.type === 'TEXT') as TextNode[];

  // Sort by Y position to get fields in order
  textNodes.sort((a, b) => a.y - b.y);

  // Extract title from the first text node (which is the title)
  // This ensures we get the updated title if the user edited it
  // Strip the issue key suffix (| ISSUE-KEY) if it exists
  const titleNode = textNodes[0];
  let actualTitle = titleNode ? titleNode.characters.trim() : frame.name;

  // Remove issue key suffix if present (format: "Title | ISSUE-KEY")
  const issueKeySuffixMatch = actualTitle.match(/\s+\|\s+([A-Z]+-\d+)$/);
  if (issueKeySuffixMatch) {
    actualTitle = actualTitle.substring(0, issueKeySuffixMatch.index).trim();
  }

  // Skip the first text node (title) and process pairs (label, value)
  // But skip large text nodes at the bottom (Assignee and Story Points) - they'll be extracted separately
  let i = 1; // Skip title
  const bottomYThreshold = frame.height - 80; // Bottom area where large text nodes are

  while (i < textNodes.length) {
    const labelNode = textNodes[i];
    const valueNode = textNodes[i + 1];

    if (labelNode && valueNode) {
      // Skip if these are bottom-positioned large text nodes (they'll be extracted separately)
      const isBottomNode =
        labelNode.y > bottomYThreshold || valueNode.y > bottomYThreshold;

      if (!isBottomNode) {
        const label = labelNode.characters.replace(':', '').trim();
        const value = valueNode.characters.trim();
        // Skip if label is empty or looks like a value (not a label)
        if (label && !/^[\d?#]+$/.test(label)) {
          fields.push({ label, value });
        }
      }
      i += 2; // Move to next pair
    } else {
      i++;
    }
  }

  // Extract large number field (Story Points or Priority Rank) from bottom right FIRST
  // Do this before extracting Assignee to avoid confusion
  // These are displayed as large numbers (24px, bold) at the bottom of the card
  const largeNumberField = getLargeNumberField(templateKey);
  if (largeNumberField) {
    // Find the large number text node
    // Large numbers are positioned at bottom right
    // Strategy: Find the rightmost text node at the bottom that looks like a number

    // Get all text nodes except title, sorted by Y (bottom to top), then by X (right to left)
    const candidateNodes = textNodes
      .filter((node) => node !== titleNode && node.characters.trim())
      .sort((a, b) => {
        // First sort by Y (bottom first)
        const yDiff = b.y - a.y;
        if (Math.abs(yDiff) > 10) return yDiff; // Different rows
        // Same row, sort by X (right first)
        return b.x - a.x;
      });

    // Look for the rightmost node at the bottom that matches number pattern
    // Check the bottom 20% of the frame or nodes within last 80px
    const bottomThreshold = Math.max(frame.height * 0.8, frame.height - 80);

    let foundNumber = false;
    for (const node of candidateNodes) {
      const text = node.characters.trim();
      if (!text) continue;

      const nodeX = node.x;
      const nodeY = node.y;

      // Check if text looks like a number (Story Points or Priority Rank)
      // Can be digits, '?', or '#'
      const looksLikeNumber = /^[\d?#]+$/.test(text);

      // Check if it's on the right side (right 30% of card)
      const isRightSide = nodeX > frame.width * 0.3;

      // Check if it's near the bottom
      const isBottom = nodeY > bottomThreshold;

      if (looksLikeNumber && isRightSide && isBottom) {
        // This is likely the large number field
        const existingField = fields.find((f) => f.label === largeNumberField);
        if (!existingField) {
          fields.push({ label: largeNumberField, value: text });
          foundNumber = true;
        } else {
          existingField.value = text;
          foundNumber = true;
        }
        break; // Found it
      }
    }

    // If still not found, try a more aggressive search - just find the rightmost number at the bottom
    if (!foundNumber) {
      // Get the bottommost nodes (lowest Y values)
      const bottomNodes = candidateNodes.filter((node) => {
        const nodeY = node.y;
        return nodeY > bottomThreshold;
      });

      // Find the rightmost node that looks like a number
      for (const node of bottomNodes.sort((a, b) => b.x - a.x)) {
        const text = node.characters.trim();
        if (/^[\d?#]+$/.test(text)) {
          const existingField = fields.find(
            (f) => f.label === largeNumberField
          );
          if (!existingField) {
            fields.push({ label: largeNumberField, value: text });
            foundNumber = true;
          } else {
            existingField.value = text;
            foundNumber = true;
          }
          break;
        }
      }
    }

    // If not found, fallback logic will handle it below
  }

  // Extract Assignee from bottom left (if applicable)
  // Assignee is displayed as large text (24px, bold) at the bottom left
  if (templateKey && hasAssigneeField(templateKey)) {
    // Get all text nodes except title, sorted by Y (bottom to top), then by X (left to right)
    const candidateNodes = textNodes
      .filter((node) => node !== titleNode && node.characters.trim())
      .sort((a, b) => {
        // First sort by Y (bottom first)
        const yDiff = b.y - a.y;
        if (Math.abs(yDiff) > 10) return yDiff; // Different rows
        // Same row, sort by X (left first)
        return a.x - b.x;
      });

    // Check the bottom 20% of the frame or nodes within last 80px
    const bottomThreshold = Math.max(frame.height * 0.8, frame.height - 80);

    // Look for the leftmost node at the bottom that doesn't match number pattern
    let foundAssignee = false;
    for (const node of candidateNodes) {
      const text = node.characters.trim();
      if (!text) continue;

      const nodeX = node.x;
      const nodeY = node.y;

      // Check if it's on the left side (left 70% of card for more lenient matching)
      const isLeftSide = nodeX < frame.width * 0.7;

      // Check if it's near the bottom
      const isBottom = nodeY > bottomThreshold;

      // Check if this looks like an assignee (not a number, not empty)
      const isNotNumber = !/^[\d?#]+$/.test(text);

      // Also check it's not a field label (doesn't end with colon)
      const isNotLabel = !text.endsWith(':');

      if (isLeftSide && isNotNumber && isBottom && isNotLabel) {
        // Check if we already have Assignee
        const existingAssigneeField = fields.find(
          (f) => f.label === 'Assignee'
        );
        if (!existingAssigneeField) {
          fields.push({ label: 'Assignee', value: text });
          foundAssignee = true;
          break; // Found it
        }
      }
    }

    // If still not found, try a more aggressive search - just find the leftmost non-number at the bottom
    if (!foundAssignee) {
      // Get the bottommost nodes (lowest Y values)
      const bottomNodes = candidateNodes.filter((node) => {
        const nodeY = node.y;
        return nodeY > bottomThreshold;
      });

      // Find the leftmost node that doesn't look like a number and isn't a label
      for (const node of bottomNodes.sort((a, b) => a.x - b.x)) {
        const text = node.characters.trim();
        const isNotNumber = !/^[\d?#]+$/.test(text);
        const isNotLabel = !text.endsWith(':');

        if (isNotNumber && isNotLabel && text) {
          const existingAssigneeField = fields.find(
            (f) => f.label === 'Assignee'
          );
          if (!existingAssigneeField) {
            fields.push({ label: 'Assignee', value: text });
            foundAssignee = true;
            break;
          }
        }
      }
    }

    // If not found, fallback logic will handle it below
  }

  // Extract issue key from frame metadata if available
  // This is critical for round-trip export to Jira
  const issueKey = frame.getPluginData('issueKey') || '';

  // Ensure Assignee is always included if the card type should have it
  // This is critical for export - assignee must be extracted
  if (templateKey && hasAssigneeField(templateKey)) {
    const hasAssignee = fields.some((f) => f.label === 'Assignee');
    if (!hasAssignee) {
      // Try to find it in any text node at the bottom left
      const bottomNodes = textNodes
        .filter((node) => node !== titleNode && node.characters.trim())
        .filter(
          (node) => node.y > frame.height * 0.7 && node.x < frame.width * 0.5
        )
        .filter((node) => {
          const text = node.characters.trim();
          return text && !/^[\d?#]+$/.test(text) && !text.endsWith(':');
        })
        .sort((a, b) => a.x - b.x); // Leftmost first

      if (bottomNodes.length > 0) {
        fields.push({
          label: 'Assignee',
          value: bottomNodes[0].characters.trim(),
        });
      } else {
        // Default to Unassigned if we can't find it
        // This ensures assignee field is always present for export
        fields.push({ label: 'Assignee', value: 'Unassigned' });
      }
    }
  }

  // Extract Status from bottom left (if applicable)
  // Status is displayed as large text (24px, bold) at the bottom left for Theme, Epic, and Initiative
  if (templateKey && hasStatusField(templateKey)) {
    // Get all text nodes except title, sorted by Y (bottom to top), then by X (left to right)
    const candidateNodes = textNodes
      .filter((node) => node !== titleNode && node.characters.trim())
      .sort((a, b) => {
        // First sort by Y (bottom first)
        const yDiff = b.y - a.y;
        if (Math.abs(yDiff) > 10) return yDiff; // Different rows
        // Same row, sort by X (left first)
        return a.x - b.x;
      });

    // Check the bottom 20% of the frame or nodes within last 80px
    const bottomThreshold = Math.max(frame.height * 0.8, frame.height - 80);

    // Look for the leftmost node at the bottom that doesn't match number pattern
    let foundStatus = false;
    for (const node of candidateNodes) {
      const text = node.characters.trim();
      if (!text) continue;

      const nodeX = node.x;
      const nodeY = node.y;

      // Check if it's on the left side (left 70% of card for more lenient matching)
      const isLeftSide = nodeX < frame.width * 0.7;

      // Check if it's near the bottom
      const isNearBottom = nodeY >= bottomThreshold;

      // Status should not be a number or special character pattern
      const isNotNumber = !/^[\d?#]+$/.test(text) && !text.endsWith(':');

      if (isLeftSide && isNearBottom && isNotNumber) {
        // Found Status - add it to fields
        fields.push({ label: 'Status', value: text });
        foundStatus = true;
        break;
      }
    }

    // If not found, fallback logic will handle it below
  }

  // Ensure Status is always included if the card type should have it
  // This is critical for export - status must be extracted
  if (templateKey && hasStatusField(templateKey)) {
    const hasStatus = fields.some((f) => f.label === 'Status');
    if (!hasStatus) {
      // Try to find it in any text node at the bottom left
      const bottomNodes = textNodes
        .filter((node) => node !== titleNode && node.characters.trim())
        .filter(
          (node) => node.y > frame.height * 0.7 && node.x < frame.width * 0.5
        )
        .filter((node) => {
          const text = node.characters.trim();
          // Status is usually a word like "Open", "In Progress", etc., not a number
          return text && !/^[\d?#]+$/.test(text) && !text.endsWith(':');
        })
        .sort((a, b) => a.x - b.x); // Leftmost first

      if (bottomNodes.length > 0) {
        fields.push({
          label: 'Status',
          value: bottomNodes[0].characters.trim(),
        });
      } else {
        // Default to Open if we can't find it
        // This ensures status field is always present for export
        fields.push({ label: 'Status', value: 'Open' });
      }
    }
  }

  const largeNumberFieldForFallback = templateKey
    ? getLargeNumberField(templateKey)
    : null;
  if (largeNumberFieldForFallback) {
    const hasLargeNumber = fields.some(
      (f) => f.label === largeNumberFieldForFallback
    );
    if (!hasLargeNumber) {
      // Try to find it in any text node at the bottom right
      const bottomNodes = textNodes
        .filter((node) => node !== titleNode && node.characters.trim())
        .filter(
          (node) => node.y > frame.height * 0.7 && node.x > frame.width * 0.5
        )
        .filter((node) => {
          const text = node.characters.trim();
          return text && /^[\d?#]+$/.test(text);
        })
        .sort((a, b) => b.x - a.x); // Rightmost first

      if (bottomNodes.length > 0) {
        fields.push({
          label: largeNumberFieldForFallback,
          value: bottomNodes[0].characters.trim(),
        });
      } else {
        // Default value based on field type
        const defaultValue =
          largeNumberFieldForFallback === 'Priority Rank' ? '#' : '?';
        fields.push({
          label: largeNumberFieldForFallback,
          value: defaultValue,
        });
      }
    }
  }

  // Extract sprint, epic link, team, and full description from plugin data (stored during import)
  const sprint = frame.getPluginData('sprint') || undefined;
  const epicLink = frame.getPluginData('epicLink') || undefined;
  const team = frame.getPluginData('team') || undefined;
  const fullDescription = frame.getPluginData('fullDescription') || undefined;

  // Extract stored Description and Acceptance Criteria from plugin data
  // These are stored even when not displayed in non-verbose mode
  const storedDescription =
    frame.getPluginData('storedDescription') || undefined;
  const storedAcceptanceCriteria =
    frame.getPluginData('storedAcceptanceCriteria') || undefined;

  // For Theme, Epic, and Initiative cards, replace truncated Description with full description
  if (
    fullDescription &&
    (cardType === 'Theme' || cardType === 'Epic' || cardType === 'Initiative')
  ) {
    // Find and replace the Description field with the full description
    const descriptionIndex = fields.findIndex((f) => f.label === 'Description');
    if (descriptionIndex !== -1) {
      fields[descriptionIndex] = {
        label: 'Description',
        value: fullDescription,
      };
    } else {
      // If Description field doesn't exist, add it
      fields.unshift({ label: 'Description', value: fullDescription });
    }
  } else if (storedDescription) {
    // Use stored description if fullDescription is not available
    const descriptionIndex = fields.findIndex((f) => f.label === 'Description');
    if (descriptionIndex !== -1) {
      fields[descriptionIndex] = {
        label: 'Description',
        value: storedDescription,
      };
    } else {
      fields.unshift({ label: 'Description', value: storedDescription });
    }
  }

  // Add stored Acceptance Criteria if it exists and is not already in fields
  if (storedAcceptanceCriteria) {
    const acceptanceCriteriaIndex = fields.findIndex(
      (f) => f.label === 'Acceptance Criteria'
    );
    if (acceptanceCriteriaIndex !== -1) {
      fields[acceptanceCriteriaIndex] = {
        label: 'Acceptance Criteria',
        value: storedAcceptanceCriteria,
      };
    } else {
      // Add after Description if it exists, otherwise at the beginning
      const descriptionIndex = fields.findIndex(
        (f) => f.label === 'Description'
      );
      if (descriptionIndex !== -1) {
        fields.splice(descriptionIndex + 1, 0, {
          label: 'Acceptance Criteria',
          value: storedAcceptanceCriteria,
        });
      } else {
        fields.unshift({
          label: 'Acceptance Criteria',
          value: storedAcceptanceCriteria,
        });
      }
    }
  }

  // Return extracted card data with issue key, sprint, epic link, and team for export
  // These are preserved for imported cards to enable round-trip to Jira
  return {
    type: cardType,
    title: actualTitle, // Include the actual title from text node
    fields,
    issueKey: issueKey || undefined, // Include issue key if available (undefined if empty for cleaner export)
    sprint: sprint || undefined, // Include sprint if available
    epicLink: epicLink || undefined, // Include epic link if available
    team: team || undefined, // Include team/studio if available
  };
}

/**
 * Maps internal field names to CSV column names for export.
 */
function mapFieldToCSVColumn(fieldLabel: string, templateType: string): string {
  const mapping: { [key: string]: string } = {
    // Common fields
    Summary: 'Summary',
    Description: 'Description',
    Priority: 'Priority',
    Assignee: 'Assignee',
    'Story Points': 'Custom field (Story Points)',
    'Acceptance Criteria': 'Custom field (Acceptance Criteria)',
    'Business Value': 'Custom field (Business Value)',
    'Target Date': 'Due Date',
    Dependencies: 'Outward issue link (Blocks)',
    Team: 'Custom field (Studio)',
    'Priority Rank': 'Custom field (Priority Rank)',
    'Test Type': 'Custom field (Test Type)',
  };

  return mapping[fieldLabel] || fieldLabel; // Return original if no mapping
}

/**
 * Gets the default value for a field in a template type.
 * Returns null if the field doesn't exist in the template.
 */
function getDefaultValueForField(
  templateType: string,
  fieldLabel: string
): string | null {
  const templateKey = getTemplateKeyFromDisplayName(templateType);
  if (!templateKey) {
    return null;
  }

  const template = TEMPLATES[templateKey];
  if (!template) {
    return null;
  }

  const field = template.fields.find((f) => f.label === fieldLabel);
  return field ? field.value : null;
}

/**
 * Checks if a field value matches a default value (case-insensitive, trimmed).
 * Also handles common variations and placeholder patterns.
 */
function isDefaultValue(value: string, defaultValue: string | null): boolean {
  if (!defaultValue) {
    return false;
  }

  const normalizedValue = value.trim();
  const normalizedDefault = defaultValue.trim();

  // Exact match
  if (normalizedValue === normalizedDefault) {
    return true;
  }

  // Check for placeholder patterns
  const placeholderPatterns = [
    /^\[.+\]$/, // [something]
    /^\.\.\.$/, // ...
    /^MM\/DD\/YYYY$/, // Date placeholder
    /^#+$/, // Just # symbols
    /^\?+$/, // Just ? symbols
  ];

  for (const pattern of placeholderPatterns) {
    if (pattern.test(normalizedValue) && pattern.test(normalizedDefault)) {
      return true;
    }
  }

  // Check if value contains only placeholder text
  if (/^\[.+\]$/.test(normalizedValue)) {
    return true;
  }

  // Special case: Story Points with "?" should always be treated as default
  // regardless of whether there's a matching default value
  if (normalizedValue === '?' || normalizedValue === '#') {
    return true;
  }

  // Check for common default patterns (case-insensitive, with flexible whitespace)
  const defaultPatterns = [
    /^Task description\.\.\.$/i,
    /^Spike description\.\.\.$/i,
    /^Epic description\.\.\.$/i,
    /^Milestone description\.\.\.$/i,
    /^Initiative description\.\.\.$/i,
    /^Business objective description\.\.\.$/i,
    /^User story description\.\.\.$/i,
    /^Team Name$/i,
    /^None$/i,
    /^Unassigned$/i,
    /^High$/i,
    // Acceptance Criteria default pattern (flexible whitespace)
    /^-?\s*Criterion\s+1\s*-?\s*Criterion\s+2\s*-?\s*Criterion\s+3\s*$/i,
  ];

  for (const pattern of defaultPatterns) {
    if (pattern.test(normalizedValue) && pattern.test(normalizedDefault)) {
      return true;
    }
  }

  // Check for concatenated descriptions that contain only default values
  // e.g., "As a [user type], I want [feature], so that [benefit]"
  if (
    normalizedValue.includes('[user type]') &&
    normalizedValue.includes('[feature]') &&
    normalizedValue.includes('[benefit]')
  ) {
    return true;
  }

  // Check for test descriptions with only default values
  // e.g., "Given [initial context], When [event occurs], Then [expected outcome]"
  if (
    normalizedValue.includes('[initial context]') &&
    normalizedValue.includes('[event occurs]') &&
    normalizedValue.includes('[expected outcome]')
  ) {
    return true;
  }

  return false;
}

/**
 * Cleans card data by removing default values (sets them to empty string).
 */
function cleanCardData(cardData: {
  type: string;
  title: string;
  fields: { label: string; value: string }[];
  issueKey?: string;
}): {
  type: string;
  title: string;
  fields: { label: string; value: string }[];
  issueKey?: string;
} {
  const cleanedFields = cardData.fields.map((field) => {
    const defaultValue = getDefaultValueForField(cardData.type, field.label);

    // Always treat "?" and "#" as default values for Story Points and Priority Rank
    // even if there's no default value defined in the template
    if (
      (field.label === 'Story Points' || field.label === 'Priority Rank') &&
      (field.value.trim() === '?' || field.value.trim() === '#')
    ) {
      return { label: field.label, value: '' };
    }

    if (isDefaultValue(field.value, defaultValue)) {
      return { label: field.label, value: '' };
    }
    return field;
  });

  return {
    type: cardData.type,
    title: cardData.title,
    fields: cleanedFields,
    issueKey: cardData.issueKey,
  };
}

/**
 * Maps template type to Jira Issue Type for CSV export.
 */
function mapTemplateTypeToIssueType(templateType: string): string {
  const mapping: { [key: string]: string } = {
    Theme: 'Theme',
    Initiative: 'Initiative',
    Milestone: 'Milestone',
    Epic: 'Epic',
    'User Story': 'Story',
    Task: 'Task',
    Spike: 'Spike',
    Test: 'Test',
  };

  return mapping[templateType] || templateType;
}

/**
 * Returns canonical field order based on template definitions.
 */
function getCanonicalFieldOrder(): string[] {
  const fieldOrder: string[] = [];
  const seenFields = new Set<string>();

  // Iterate through templates in order
  for (const template of Object.values(TEMPLATES)) {
    for (const field of template.fields) {
      if (!seenFields.has(field.label)) {
        fieldOrder.push(field.label);
        seenFields.add(field.label);
      }
    }
  }

  return fieldOrder;
}

/**
 * Exports template cards on the current page to CSV format.
 * @param filterNew - If true, only export cards without issue keys (new cards). If false, export all cards.
 */
function exportCardsToCSV(filterNew: boolean = false): void {
  const cards: CardData[] = [];

  // Find all frames on the current page that match our template names
  // Use Set for O(1) lookup performance instead of O(n) array.includes()
  const templateNames = new Set([
    'Theme',
    'Initiative',
    'Milestone',
    'Epic',
    'User Story',
    'Task',
    'Spike',
    'Test',
  ]);

  // Find frames by name (primary method) or by plugin data templateType (fallback for imported cards)
  const allFrames = figma.currentPage.findAll(
    (node) => node.type === 'FRAME'
  ) as FrameNode[];

  const frames = allFrames.filter((frame) => {
    // Skip epic label cards (they're just visual labels, not for export)
    const isEpicLabel = frame.getPluginData('isEpicLabel') === 'true';
    if (isEpicLabel) {
      return false;
    }

    // Check frame name first (primary method for template-created cards)
    if (templateNames.has(frame.name)) {
      return true;
    }

    // Check plugin data for template type (ensures imported cards are found)
    const templateType = frame.getPluginData('templateType');
    if (templateType && templateNames.has(templateType)) {
      return true;
    }

    // Also check if frame has issueKey (indicates it's an imported card)
    // This is a fallback for cards that might not have templateType set correctly
    const issueKey = frame.getPluginData('issueKey');
    if (issueKey && issueKey.trim() !== '') {
      // This is definitely an imported card - include it
      // extractCardData will handle type inference
      return true;
    }

    // Last resort: check if frame structure looks like one of our cards
    // Our cards have specific characteristics:
    // - They are frames with text nodes
    // - They have a specific width (CARD_CONFIG.WIDTH = 500)
    // - They have rounded corners
    const textNodes = frame.findAll(
      (node) => node.type === 'TEXT'
    ) as TextNode[];
    if (textNodes.length >= 2) {
      // Has multiple text nodes (title + at least one field)
      // Check if it has our card characteristics
      const cornerRadius =
        typeof frame.cornerRadius === 'number' ? frame.cornerRadius : 0;
      const frameWidth = typeof frame.width === 'number' ? frame.width : 0;
      const hasRoundedCorners = cornerRadius > 0;
      const hasReasonableWidth = frameWidth > 400 && frameWidth < 600; // Close to our 500px width
      if (hasRoundedCorners && hasReasonableWidth) {
        // This looks like one of our cards - include it
        console.log(
          `Including frame "${String(
            frame.name
          )}" based on structure (width: ${frameWidth}, corners: ${cornerRadius}, textNodes: ${
            textNodes.length
          })`
        );
        return true;
      }
    }

    return false;
  });

  // Log for debugging if no frames found
  if (frames.length === 0) {
    if (allFrames.length > 0) {
      console.log(
        'No template cards found. All frames on page:',
        allFrames.map((f) => ({
          name: f.name,
          templateType: f.getPluginData('templateType'),
          issueKey: f.getPluginData('issueKey'),
          hasTextNodes: f.findAll((n) => n.type === 'TEXT').length > 0,
        }))
      );
    } else {
      console.log('No frames found on page at all');
    }
  } else {
    // Log what we found for debugging
    console.log(
      `Found ${frames.length} potential card(s):`,
      frames.map((f) => ({
        name: f.name,
        templateType: f.getPluginData('templateType'),
        issueKey: f.getPluginData('issueKey'),
      }))
    );
  }

  // Extract data from each card
  for (const frame of frames) {
    // Skip epic label cards (they're just visual labels, not for export)
    const isEpicLabel = frame.getPluginData('isEpicLabel') === 'true';
    if (isEpicLabel) {
      continue;
    }

    const cardData = extractCardData(frame);
    if (!cardData) {
      console.warn(
        `extractCardData returned null for frame:`,
        frame.name,
        'templateType:',
        frame.getPluginData('templateType'),
        'issueKey:',
        frame.getPluginData('issueKey')
      );
      continue;
    }
    if (cardData) {
      // Skip milestones - they won't be exported to Jira
      if (cardData.type === 'Milestone') {
        continue;
      }

      // If filtering for new cards only, skip cards with issue keys
      if (filterNew && cardData.issueKey && cardData.issueKey.trim() !== '') {
        continue;
      }

      // Get title from extracted card data (which comes from the actual text node)
      const title = cardData.title;

      // For user stories, concatenate As a/I want/So that into Description
      if (cardData.type === 'User Story') {
        const asA = cardData.fields.find((f) => f.label === 'As a');
        const iWant = cardData.fields.find((f) => f.label === 'I want');
        const soThat = cardData.fields.find((f) => f.label === 'So that');

        // If we have As a/I want/So that, concatenate them into Description
        if (asA && iWant && soThat) {
          // Format: "As a [user type], I want [feature], so that [benefit]"
          const description = `As a ${asA.value}, I want ${iWant.value}, so that ${soThat.value}`;

          // Remove As a/I want/So that fields
          cardData.fields = cardData.fields.filter(
            (f) =>
              f.label !== 'As a' &&
              f.label !== 'I want' &&
              f.label !== 'So that'
          );

          // Remove any existing Description field (in case it was imported)
          cardData.fields = cardData.fields.filter(
            (f) => f.label !== 'Description'
          );

          // Add Description at the beginning with concatenated values
          cardData.fields.unshift({ label: 'Description', value: description });
        }
      }

      // For test tickets, concatenate Given/When/Then into Description
      if (cardData.type === 'Test') {
        const given = cardData.fields.find((f) => f.label === 'Given');
        const when = cardData.fields.find((f) => f.label === 'When');
        const then = cardData.fields.find((f) => f.label === 'Then');

        // If we have Given/When/Then, concatenate them into Description
        if (given && when && then) {
          // Format: "Given [initial context], When [event occurs], Then [expected outcome]"
          const description = `Given ${given.value}, When ${when.value}, Then ${then.value}`;

          // Remove Given/When/Then fields
          cardData.fields = cardData.fields.filter(
            (f) =>
              f.label !== 'Given' && f.label !== 'When' && f.label !== 'Then'
          );

          // Remove any existing Description field (in case it was imported)
          cardData.fields = cardData.fields.filter(
            (f) => f.label !== 'Description'
          );

          // Add Description at the beginning with concatenated values
          cardData.fields.unshift({ label: 'Description', value: description });
        }
      }

      // Get issue key directly from frame metadata (more reliable than extracted data)
      // This ensures we get the issue key even if extraction missed it
      const frameIssueKey = frame.getPluginData('issueKey') || '';
      const finalIssueKey = cardData.issueKey || frameIssueKey;

      // Clean the card data by removing default values before exporting
      const cleanedCardData = cleanCardData({
        type: cardData.type,
        title: title,
        fields: cardData.fields,
        issueKey: finalIssueKey || undefined,
      });

      cards.push(cleanedCardData);
    }
  }

  if (cards.length === 0) {
    figma.notify('❌ No template cards found on the page');
    return;
  }

  // Map all fields to CSV column names and collect unique CSV columns
  // Maps CSV column name to array of internal field labels (for fields that map to same column)
  const csvColumnMap = new Map<string, string[]>();
  const allCSVColumns = new Set<string>();

  cards.forEach((card) => {
    card.fields.forEach((field) => {
      // Skip fields with invalid labels (like "?" or empty)
      if (!field.label || field.label.trim() === '' || field.label === '?') {
        return;
      }

      const csvColumn = mapFieldToCSVColumn(field.label, card.type);

      // Skip if mapping returns invalid column name
      if (!csvColumn || csvColumn.trim() === '' || csvColumn === '?') {
        return;
      }

      // Handle fields that map to the same CSV column
      if (!csvColumnMap.has(csvColumn)) {
        csvColumnMap.set(csvColumn, []);
      }
      const fieldLabels = csvColumnMap.get(csvColumn)!;
      if (!fieldLabels.includes(field.label)) {
        fieldLabels.push(field.label);
      }

      allCSVColumns.add(csvColumn);
    });

    // Add Issue key column if any card has an issue key
    // This enables round-trip export to Jira for imported cards
    if (card.issueKey && card.issueKey.trim() !== '') {
      allCSVColumns.add('Issue key');
    }

    // Add Sprint column if any card has a sprint value
    // This preserves sprint information for round-trip export
    if (card.sprint && card.sprint.trim() !== '') {
      allCSVColumns.add('Sprint');
    }

    // Add Epic Link column if any card has an epic link
    // This preserves epic link information for round-trip export
    if (card.epicLink && card.epicLink.trim() !== '') {
      allCSVColumns.add('Custom field (Epic Link)');
    }

    // Add Team/Studio column if any card has a team value
    // This preserves team/studio information for round-trip export
    if (card.team && card.team.trim() !== '') {
      allCSVColumns.add('Custom field (Studio)');
    }
  });

  // Build ordered list of CSV columns
  // Priority order: Summary, Issue key, Issue Type, then other fields
  const orderedCSVColumns: string[] = [];
  const remainingColumns: string[] = [];

  // Always include these columns first
  orderedCSVColumns.push('Summary'); // Always include Summary (title)
  if (allCSVColumns.has('Issue key')) {
    orderedCSVColumns.push('Issue key');
  }
  orderedCSVColumns.push('Issue Type'); // Always include Issue Type

  // Add Sprint, Epic Link, and Team/Studio early in the order (important for round-trip)
  if (allCSVColumns.has('Sprint')) {
    orderedCSVColumns.push('Sprint');
  }
  if (allCSVColumns.has('Custom field (Epic Link)')) {
    orderedCSVColumns.push('Custom field (Epic Link)');
  }
  if (allCSVColumns.has('Custom field (Studio)')) {
    orderedCSVColumns.push('Custom field (Studio)');
  }

  // Add remaining columns in a logical order
  const priorityOrder = [
    'Description',
    'Status',
    'Priority',
    'Assignee',
    'Custom field (Story Points)',
    'Custom field (Acceptance Criteria)',
    'Custom field (Business Value)',
    'Due Date',
    'Outward issue link (Blocks)',
    'Custom field (Studio)',
    'Custom field (Priority Rank)',
    'Custom field (Test Type)',
  ];

  priorityOrder.forEach((col) => {
    if (allCSVColumns.has(col)) {
      orderedCSVColumns.push(col);
    }
  });

  // Add any remaining columns alphabetically
  allCSVColumns.forEach((col) => {
    if (!orderedCSVColumns.includes(col) && col !== 'Issue Type') {
      remainingColumns.push(col);
    }
  });
  remainingColumns.sort();
  const finalCSVColumns = orderedCSVColumns.concat(remainingColumns);

  // Generate CSV header
  const header = finalCSVColumns.join(',');
  const rows = [header];

  // Generate CSV rows
  cards.forEach((card) => {
    const row: string[] = [];

    finalCSVColumns.forEach((csvColumn) => {
      let value = '';

      if (csvColumn === 'Summary') {
        value = card.title;
      } else if (csvColumn === 'Issue key') {
        value = card.issueKey || '';
      } else if (csvColumn === 'Issue Type') {
        value = mapTemplateTypeToIssueType(card.type);
      } else if (csvColumn === 'Sprint') {
        value = card.sprint || '';
      } else if (csvColumn === 'Custom field (Epic Link)') {
        value = card.epicLink || '';
      } else if (csvColumn === 'Custom field (Studio)') {
        value = card.team || '';
      } else {
        // Find the internal field label(s) for this CSV column
        const internalLabels = csvColumnMap.get(csvColumn);
        if (internalLabels && internalLabels.length > 0) {
          // If multiple fields map to same column, use the first one found
          const preferredLabel = internalLabels.includes('Summary')
            ? 'Summary'
            : internalLabels[0];
          const field = card.fields.find((f) => f.label === preferredLabel);
          value = field ? field.value : '';
        }
      }

      // Escape quotes and wrap in quotes for CSV
      const escapedValue = value.replace(/"/g, '""');
      row.push(`"${escapedValue}"`);
    });

    rows.push(row.join(','));
  });

  const csvContent = rows.join('\n');

  // Send CSV to UI for download
  const exportType = filterNew ? 'new' : 'all';
  figma.ui.postMessage({
    type: 'export-csv',
    csv: csvContent,
    filename: `pi-planning-export-${exportType}-${
      new Date().toISOString().split('T')[0]
    }.csv`,
  });

  figma.notify(`✅ Exported ${cards.length} card(s) to CSV (${exportType})`);
}

// getErrorMessage is imported from utils.ts

// Set up message handler once with proper typing
figma.ui.onmessage = async (msg: PluginMessage) => {
  // Log for debugging
  console.log('Received message:', msg);

  if (msg.type === 'insert-template') {
    // TypeScript now knows msg.templateType exists
    try {
      const templateType = msg.templateType as keyof typeof TEMPLATES;
      await createTemplateCard(templateType);
      const template = TEMPLATES[templateType];
      figma.notify(`✅ ${template.title} template inserted!`);
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      figma.notify(`❌ Error inserting template: ${errorMessage}`);
      console.error('Error inserting template:', error);
    }
  } else if (msg.type === 'import-csv') {
    // TypeScript now knows msg.csvText exists
    try {
      console.log('Starting CSV import, data length:', msg.csvText.length);
      console.log('Jira Base URL received:', msg.jiraBaseUrl);
      const importVerbose =
        msg.importVerbose !== undefined ? msg.importVerbose : true;
      console.log(
        'Import CSV - importVerbose value:',
        importVerbose,
        'type:',
        typeof importVerbose
      );
      await importCardsFromCSV(msg.csvText, msg.jiraBaseUrl, importVerbose);
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      figma.notify(`❌ Error importing CSV: ${errorMessage}`);
      console.error('CSV import error:', error);
    }
  } else if (msg.type === 'export-csv') {
    try {
      const filterNew = msg.filterNew || false;
      exportCardsToCSV(filterNew);
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      figma.notify(`❌ Error exporting CSV: ${errorMessage}`);
      console.error('CSV export error:', error);
    }
  } else if (msg.type === 'get-jira-url') {
    try {
      const savedUrl = await figma.clientStorage.getAsync('jiraBaseUrl');
      figma.ui.postMessage({
        type: 'jira-url-loaded',
        jiraBaseUrl: savedUrl || undefined,
      } as UIMessage);
    } catch (error) {
      console.error('Error loading Jira URL:', error);
      figma.ui.postMessage({
        type: 'jira-url-loaded',
        jiraBaseUrl: undefined,
      } as UIMessage);
    }
  } else if (msg.type === 'set-jira-url') {
    try {
      await figma.clientStorage.setAsync('jiraBaseUrl', msg.jiraBaseUrl);
    } catch (error) {
      console.error('Error saving Jira URL:', error);
    }
  } else if (msg.type === 'close') {
    figma.closePlugin();
  }
};

/**
 * Handles card duplication detection - removes issue key from duplicates.
 */
/**
 * Handles card duplication detection - removes issue key from duplicates.
 * Only processes cards that haven't been processed yet to avoid unnecessary work.
 * @returns true if any duplicates were found and processed, false otherwise
 */
async function handleCardDuplication(): Promise<boolean> {
  // Skip duplicate detection during import to avoid notifications
  if (isImporting) {
    return false;
  }
  const templateNames = new Set([
    'Theme',
    'Initiative',
    'Milestone',
    'Epic',
    'User Story',
    'Task',
    'Spike',
    'Test',
  ]);

  // Find all template cards on the current page
  // Check both frame name and plugin data to ensure imported cards are included
  const allFramesNodes = figma.currentPage.findAll(
    (node) => node.type === 'FRAME'
  ) as FrameNode[];

  const allFrames = allFramesNodes.filter((frame) => {
    // Check frame name first
    if (templateNames.has(frame.name)) {
      return true;
    }
    // Check plugin data for template type (ensures imported cards are found)
    const templateType = frame.getPluginData('templateType');
    return templateType && templateNames.has(templateType);
  });

  // Track issue keys and their associated node IDs (ordered by creation/position)
  const issueKeyToNodes = new Map<
    string,
    Array<{ id: string; created: number; frame: FrameNode; isCopy: boolean }>
  >();

  // Collect all cards with issue keys (excluding epic labels)
  allFrames.forEach((frame) => {
    // Skip epic label cards from duplication detection
    const isEpicLabel = frame.getPluginData('isEpicLabel') === 'true';
    if (isEpicLabel) {
      return;
    }

    const issueKey = frame.getPluginData('issueKey');
    if (issueKey && issueKey.trim() !== '') {
      if (!issueKeyToNodes.has(issueKey)) {
        issueKeyToNodes.set(issueKey, []);
      }
      // Check if this card is already marked as a copy
      const isCopy = frame.getPluginData('isCopy');
      // Use a combination of x and y position as a proxy for creation order
      // (earlier cards are typically positioned first)
      // Also prioritize cards that are NOT marked as copies
      const position = frame.x + frame.y * 10000;
      const sortKey = isCopy === 'true' ? position + 1000000000 : position; // Push copies to end
      issueKeyToNodes.get(issueKey)!.push({
        id: frame.id,
        created: sortKey,
        frame: frame,
        isCopy: isCopy === 'true',
      });
    }
  });

  // Also check for cards marked as copies that might have hyperlinks but no issue key
  // (cards that were copied but issue key was already removed)
  // Exclude epic labels from this check
  const cardsToCheckForHyperlinks: FrameNode[] = [];
  allFrames.forEach((frame) => {
    const isEpicLabel = frame.getPluginData('isEpicLabel') === 'true';
    if (isEpicLabel) {
      return; // Skip epic labels
    }
    const isCopy = frame.getPluginData('isCopy');
    if (isCopy === 'true') {
      cardsToCheckForHyperlinks.push(frame);
    }
  });

  let duplicatesProcessed = false;

  // Only process issue key duplicates if there are cards with issue keys
  if (issueKeyToNodes.size === 0 && cardsToCheckForHyperlinks.length === 0) {
    return false; // No cards with issue keys and no copies to check, nothing to process
  }

  // If an issue key appears in multiple cards, remove it from duplicates
  // Keep the first one (not marked as copy, lowest position) as original
  for (const [issueKey, nodes] of issueKeyToNodes.entries()) {
    if (nodes.length > 1) {
      // Sort: non-copies first, then by position
      nodes.sort((a, b) => {
        // If one is a copy and the other isn't, non-copy comes first
        if (a.isCopy !== b.isCopy) {
          return a.isCopy ? 1 : -1;
        }
        // Otherwise sort by position
        return a.created - b.created;
      });
      const original = nodes[0];
      const duplicates = nodes.slice(1);

      // Process duplicates sequentially to allow async operations
      for (const duplicate of duplicates) {
        const duplicateFrame = duplicate.frame;
        // Check if this duplicate hasn't been processed yet
        const isCopy = duplicateFrame.getPluginData('isCopy');
        const frameId = duplicateFrame.id;

        if (isCopy !== 'true' && !processedCards.has(frameId)) {
          // Remove issue key from duplicate so it's treated as a new card
          // This ensures duplicates are exported as new cards (without issue key)
          duplicateFrame.setPluginData('issueKey', '');
          // Mark as copy for tracking
          duplicateFrame.setPluginData('isCopy', 'true');
          // Track that we've processed this card
          processedCards.add(frameId);

          // Remove hyperlink from the title by recreating the text node without hyperlink
          const textNodes = duplicateFrame.findAll(
            (node) => node.type === 'TEXT'
          ) as TextNode[];
          if (textNodes.length > 0) {
            const titleNode = textNodes[0]; // First text node is the title
            try {
              const textLength = titleNode.characters.length;
              if (textLength > 0) {
                // Check if hyperlink exists
                let hasHyperlink = false;
                try {
                  const existingHyperlink = titleNode.getRangeHyperlink(
                    0,
                    textLength
                  );
                  if (
                    existingHyperlink &&
                    existingHyperlink !== figma.mixed &&
                    existingHyperlink.type === 'URL' &&
                    'value' in existingHyperlink &&
                    existingHyperlink.value
                  ) {
                    hasHyperlink = true;
                  }
                } catch (e) {
                  // Check character by character
                  for (let i = 0; i < textLength && !hasHyperlink; i++) {
                    try {
                      const charHyperlink = titleNode.getRangeHyperlink(
                        i,
                        i + 1
                      );
                      if (
                        charHyperlink &&
                        charHyperlink !== figma.mixed &&
                        charHyperlink.type === 'URL' &&
                        'value' in charHyperlink &&
                        charHyperlink.value
                      ) {
                        hasHyperlink = true;
                        break;
                      }
                    } catch (charError) {
                      // Continue
                    }
                  }
                }

                if (hasHyperlink) {
                  // Save text content and properties
                  const textContent = titleNode.characters;
                  const fontSize = titleNode.fontSize;
                  const fontName = titleNode.fontName;
                  const fills = titleNode.fills;
                  const x = titleNode.x;
                  const y = titleNode.y;
                  const width = titleNode.width;
                  const textAlignHorizontal = titleNode.textAlignHorizontal;
                  const textAlignVertical = titleNode.textAlignVertical;
                  const textAutoResize = titleNode.textAutoResize;

                  // Create new text node without hyperlink
                  const newTitleNode = figma.createText();

                  // Set font name first (before loading and setting characters)
                  if (fontName !== figma.mixed) {
                    newTitleNode.fontName = fontName;
                    // Load font after setting font name
                    await figma.loadFontAsync(fontName);
                  }

                  // Now set characters (font is loaded)
                  newTitleNode.characters = textContent;
                  newTitleNode.fontSize = fontSize;
                  newTitleNode.fills = fills;
                  newTitleNode.x = x;
                  newTitleNode.y = y;
                  newTitleNode.resize(width, newTitleNode.height);
                  if (textAlignHorizontal) {
                    newTitleNode.textAlignHorizontal = textAlignHorizontal;
                  }
                  if (textAlignVertical) {
                    newTitleNode.textAlignVertical = textAlignVertical;
                  }
                  if (textAutoResize) {
                    newTitleNode.textAutoResize = textAutoResize;
                  }

                  // Replace old text node with new one
                  const parent = titleNode.parent;
                  if (parent) {
                    const index = parent.children.indexOf(titleNode);
                    parent.insertChild(index, newTitleNode);
                    titleNode.remove();
                    // Update textNodes array to reference the new node instead of the removed one
                    textNodes[0] = newTitleNode;
                  }

                  console.log(
                    `Removed hyperlink from copied card by recreating text node: ${duplicateFrame.name}`
                  );
                }
              }
            } catch (e) {
              // Hyperlink removal failed, log but continue
              console.warn('Error removing hyperlink from copied card:', e);
            }
          }

          // Duplicate detection and processing is logged to console
          // No toast notification needed - duplicate detection runs silently
          duplicatesProcessed = true;
        }
      }
    }
  }

  // Also remove hyperlinks from cards marked as copies (even if they don't have issue keys)
  // This ensures that when a card is copied, the hyperlink is removed
  for (const copyFrame of cardsToCheckForHyperlinks) {
    // Skip if this card was already processed above
    const frameId = copyFrame.id;
    if (processedCards.has(frameId)) {
      continue;
    }

    const textNodes = copyFrame.findAll(
      (node) => node.type === 'TEXT'
    ) as TextNode[];
    if (textNodes.length > 0) {
      const titleNode = textNodes[0]; // First text node is the title
      try {
        const textLength = titleNode.characters.length;
        if (textLength > 0) {
          // Check if hyperlink exists
          let hasHyperlink = false;
          try {
            const existingHyperlink = titleNode.getRangeHyperlink(
              0,
              textLength
            );
            if (
              existingHyperlink &&
              existingHyperlink !== figma.mixed &&
              existingHyperlink.type === 'URL' &&
              'value' in existingHyperlink &&
              existingHyperlink.value
            ) {
              hasHyperlink = true;
            }
          } catch (e) {
            // Check character by character
            for (let i = 0; i < textLength && !hasHyperlink; i++) {
              try {
                const charHyperlink = titleNode.getRangeHyperlink(i, i + 1);
                if (
                  charHyperlink &&
                  charHyperlink !== figma.mixed &&
                  charHyperlink.type === 'URL' &&
                  'value' in charHyperlink &&
                  charHyperlink.value
                ) {
                  hasHyperlink = true;
                  break;
                }
              } catch (charError) {
                // Continue
              }
            }
          }

          if (hasHyperlink) {
            // Save text content and properties
            const textContent = titleNode.characters;
            const fontSize = titleNode.fontSize;
            const fontName = titleNode.fontName;
            const fills = titleNode.fills;
            const x = titleNode.x;
            const y = titleNode.y;
            const width = titleNode.width;
            const textAlignHorizontal = titleNode.textAlignHorizontal;
            const textAlignVertical = titleNode.textAlignVertical;
            const textAutoResize = titleNode.textAutoResize;

            // Create new text node without hyperlink
            const newTitleNode = figma.createText();

            // Set font name first (before loading and setting characters)
            if (fontName !== figma.mixed) {
              newTitleNode.fontName = fontName;
              // Load font after setting font name
              await figma.loadFontAsync(fontName);
            }

            // Now set characters (font is loaded)
            newTitleNode.characters = textContent;
            newTitleNode.fontSize = fontSize;
            newTitleNode.fills = fills;
            newTitleNode.x = x;
            newTitleNode.y = y;
            newTitleNode.resize(width, newTitleNode.height);
            if (textAlignHorizontal) {
              newTitleNode.textAlignHorizontal = textAlignHorizontal;
            }
            if (textAlignVertical) {
              newTitleNode.textAlignVertical = textAlignVertical;
            }
            if (textAutoResize) {
              newTitleNode.textAutoResize = textAutoResize;
            }

            // Replace old text node with new one
            const parent = titleNode.parent;
            if (parent) {
              const index = parent.children.indexOf(titleNode);
              parent.insertChild(index, newTitleNode);
              titleNode.remove();
            }

            console.log(
              `Removed hyperlink from copied card (marked as copy): ${copyFrame.name}`
            );
            processedCards.add(frameId);
            duplicatesProcessed = true;
          }
        }
      } catch (e) {
        // Log error but don't throw - continue processing other cards
        console.warn('Error removing hyperlink from copied card:', e);
      }
    }
  }

  return duplicatesProcessed;
}

// Track processed cards to avoid duplicate notifications
const processedCards = new Set<string>();

// Flag to suppress duplicate notifications during import
let isImporting = false;

/**
 * Checks for duplicate cards and marks copies appropriately.
 * Only logs when duplicates are actually found and processed.
 */
async function checkForDuplicates(): Promise<void> {
  const duplicatesFound = await handleCardDuplication();
  // Only log if duplicates were actually processed (for debugging)
  // Removed verbose logging to reduce console spam
}

// Run duplicate check immediately on plugin load (silently)
checkForDuplicates();

// Listen for selection changes to detect when cards are duplicated
figma.on('selectionchange', () => {
  // Skip duplicate check during import
  if (isImporting) {
    return;
  }
  // Small delay to ensure duplication is complete before checking
  setTimeout(() => {
    checkForDuplicates();
  }, TIMING_CONFIG.DUPLICATE_CHECK_DELAY);
});

// Also check periodically to catch any missed duplicates (especially from copy/paste)
// This ensures we catch duplicates even if selection doesn't change
// Reduced frequency to avoid unnecessary checks
setInterval(() => {
  // Skip duplicate check during import
  if (!isImporting) {
    checkForDuplicates();
  }
}, TIMING_CONFIG.DUPLICATE_CHECK_INTERVAL);

// Check if running in FigJam (recommended for this plugin)
if (figma.editorType !== 'figjam') {
  figma.notify(
    '⚠️ This plugin is optimized for FigJam. Some features may not work as expected in Figma.'
  );
}

// Show the UI panel
figma.showUI(__html__, {
  width: UI_CONFIG.WIDTH,
  height: UI_CONFIG.HEIGHT,
  themeColors: true,
});

// Load and send saved Jira URL to UI
(async () => {
  try {
    const savedUrl = await figma.clientStorage.getAsync('jiraBaseUrl');
    figma.ui.postMessage({
      type: 'jira-url-loaded',
      jiraBaseUrl: savedUrl || undefined,
    } as UIMessage);
  } catch (error) {
    console.error('Error loading Jira URL on startup:', error);
  }
})();
