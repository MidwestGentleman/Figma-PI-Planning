/// <reference types="@figma/plugin-typings" />

/**
 * Main entry point for the PI Planning FigJam Plugin
 *
 * This file orchestrates the plugin initialization, message handling,
 * and imports functionality from organized modules.
 */

// Import organized modules
import { PluginMessage, UIMessage } from './types';
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
  wrapTitleText,
  getErrorMessage,
  yieldToUI,
} from './utils';
import {
  createTemplateCard,
  createTemplateCardWithPosition,
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
 * Maps a Jira issue to a template type and extracts relevant data.
 * @returns Template type and data, or null if issue cannot be mapped
 */
function mapJiraIssueToTemplate(issue: { [key: string]: string }): {
  templateType: keyof typeof TEMPLATES;
  data: { [key: string]: string };
} | null {
  const issueType = issue['Issue Type'] || '';
  const summary = issue['Summary'] || '';
  const description = formatJiraText(issue['Description'] || '');
  const priority = issue['Priority'] || '';
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
  let templateType: keyof typeof TEMPLATES;

  // Map based on mapping: Title = Summary, Name = Summary, Team = Custom field (Studio)
  if (issueType.toLowerCase() === 'epic') {
    templateType = 'epic';
    return {
      templateType,
      data: {
        title: summary, // Title → Summary
        Name: summary, // Name → Summary
        Description: description || 'Epic description...', // Description → Description
        'Business Value': businessValue || 'High',
        Team: team || 'Team Name', // Team → Custom field (Studio)
        'Acceptance Criteria':
          acceptanceCriteria || '- Criterion 1\n- Criterion 2\n- Criterion 3',
        issueKey: issueKey, // Store issue key for hyperlink
      },
    };
  } else if (
    issueType.toLowerCase() === 'story' ||
    issueType.toLowerCase() === 'user story' ||
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
          acceptanceCriteria || '- Criterion 1\n- Criterion 2\n- Criterion 3',
        'Story Points': storyPoints || '?',
        Priority: priority || 'Medium',
        Assignee: issue['Assignee'] || 'Unassigned',
        issueKey: issueKey, // Store issue key for hyperlink
      },
    };
  } else if (dueDate || fixVersions) {
    // Use milestone for items with dates
    templateType = 'milestone';
    return {
      templateType,
      data: {
        title: summary, // Title → Summary
        Name: summary, // Name → Summary
        'Target Date': dueDate || fixVersions || 'MM/DD/YYYY',
        Description: description || 'Milestone description...', // Description → Description
        issueKey: issueKey, // Store issue key for hyperlink
      },
    };
  } else if (issueType.toLowerCase() === 'task') {
    templateType = 'task';
    return {
      templateType,
      data: {
        title: summary, // Title → Summary
        Description: description || 'Task description...', // Description → Description
        'Story Points': storyPoints || '?', // Include Story Points if available
        Assignee: issue['Assignee'] || 'Unassigned',
        'Acceptance Criteria':
          acceptanceCriteria || '- Criterion 1\n- Criterion 2\n- Criterion 3',
        issueKey: issueKey, // Store issue key for hyperlink
      },
    };
  } else if (issueType.toLowerCase() === 'spike') {
    templateType = 'spike';
    return {
      templateType,
      data: {
        title: summary, // Title → Summary
        Description: description || 'Spike description...', // Description → Description
        'Story Points': storyPoints || '?', // Include Story Points if available
        Assignee: issue['Assignee'] || 'Unassigned',
        'Acceptance Criteria':
          acceptanceCriteria || '- Criterion 1\n- Criterion 2\n- Criterion 3',
        issueKey: issueKey, // Store issue key for hyperlink
      },
    };
  } else if (issueType.toLowerCase() === 'test') {
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
          acceptanceCriteria || '- Criterion 1\n- Criterion 2\n- Criterion 3',
        issueKey: issueKey, // Store issue key for hyperlink
      },
    };
  } else if (issueType.toLowerCase() === 'theme') {
    templateType = 'theme';
    return {
      templateType,
      data: {
        title: summary, // Title → Summary
        Name: summary, // Name → Summary
        Description: description || 'Business objective description...', // Description → Description
        'Business Value': businessValue || 'High',
        'Priority Rank':
          issue['Priority'] || issue['Custom field (Priority Rank)'] || '#',
        'Acceptance Criteria':
          acceptanceCriteria || '- Criterion 1\n- Criterion 2\n- Criterion 3',
        issueKey: issueKey, // Store issue key for round-trip export
      },
    };
  } else {
    // Default to initiative
    templateType = 'initiative';
    return {
      templateType,
      data: {
        title: summary, // Title → Summary
        Name: summary, // Name → Summary
        Description: description || 'Initiative description...', // Description → Description
        Dependencies: dependencies || 'None',
        'Priority Rank':
          issue['Priority'] || issue['Custom field (Priority Rank)'] || '#',
        'Acceptance Criteria':
          acceptanceCriteria || '- Criterion 1\n- Criterion 2\n- Criterion 3',
        issueKey: issueKey, // Store issue key for round-trip export
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
  // Check all possible Sprint column variations
  // Since CSV parser may overwrite duplicate column names, check all keys
  const sprintKeys = Object.keys(issue).filter((key) =>
    key.toLowerCase().includes('sprint')
  );

  // Try each Sprint column in order
  for (const key of sprintKeys) {
    const value = issue[key];
    if (value && value.trim() !== '') {
      // Extract just the sprint name (e.g., "Triton 2025-25" from any format)
      const trimmed = value.trim();
      // If it looks like a sprint name (contains numbers or common patterns), use it
      if (trimmed.length > 0 && trimmed !== '[]') {
        return trimmed;
      }
    }
  }

  // Also check if the issue object has Sprint data in a different format
  // Sometimes CSV parsers handle duplicate columns differently
  const allKeys = Object.keys(issue);
  for (const key of allKeys) {
    if (key.toLowerCase().includes('sprint')) {
      const value = issue[key];
      if (value && value.trim() !== '' && value.trim() !== '[]') {
        return value.trim();
      }
    }
  }

  return 'Backlog';
}

/**
 * Extracts sprint dates from a Jira issue.
 */
function getSprintDates(issue: { [key: string]: string }): string {
  // Check for common sprint date field names
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

  return 'MM/DD/YYYY - MM/DD/YYYY';
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
    assigneeText.characters = assignee;
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
  columnIndex: number,
  columnHeights: number[],
  createdFrames: FrameNode[],
  spacing: number,
  jiraBaseUrl?: string
): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;
  const endIndex = Math.min(startIndex + batchSize, issues.length);

  for (let i = startIndex; i < endIndex; i++) {
    const issue = issues[i];
    const mapped = mapJiraIssueToTemplate(issue);
    if (!mapped) {
      skipped++;
      continue;
    }

    try {
      const y = cardsStartY + epicColumnHeights[epicKey];
      const frame = await createTemplateCardWithPosition(
        mapped.templateType,
        mapped.data,
        epicX,
        y,
        jiraBaseUrl
      );

      // Verify issue key and template type were stored (for debugging)
      const storedIssueKey = frame.getPluginData('issueKey');
      const storedTemplateType = frame.getPluginData('templateType');
      console.log(
        `Created card: ${mapped.data.title || 'Untitled'}, frame.name: ${
          frame.name
        }, templateType: ${storedTemplateType}, issueKey: ${storedIssueKey}`
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
      columnHeights[columnIndex] += frame.height + spacing;
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
 * Imports cards from CSV text and creates them on the FigJam canvas.
 * Groups cards by sprint and epic, and creates capacity tables.
 * Uses batched processing for large imports to prevent UI blocking.
 * @param csvText - The CSV text to import
 * @param jiraBaseUrl - Optional Jira base URL for creating hyperlinks
 * @throws {Error} If CSV text is invalid or import fails
 */
async function importCardsFromCSV(
  csvText: string,
  jiraBaseUrl?: string
): Promise<void> {
  console.log(
    'importCardsFromCSV called with csvText length:',
    (csvText && csvText.length) || 0
  );
  console.log('importCardsFromCSV called with jiraBaseUrl:', jiraBaseUrl);

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
    figma.notify(`📊 Processing ${issues.length} issues...`, { timeout: 2000 });

    try {
      await ensureFontsLoaded();
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      figma.notify(`❌ Error loading fonts: ${errorMessage}`);
      console.error('Font loading error:', error);
      return;
    }

    const issuesBySprint = groupIssuesBySprint(issues);
    const sortedSprints = Object.keys(issuesBySprint).sort();

    const viewport = figma.viewport.center;
    const cardWidth = CARD_CONFIG.WIDTH;
    const spacing = LAYOUT_CONFIG.CARD_SPACING;
    const sprintSpacing = LAYOUT_CONFIG.SPRINT_SPACING;

    let totalCreated = 0;
    let totalSkipped = 0;
    const createdFrames: FrameNode[] = [];
    const totalIssues = issues.length;
    let processedCount = 0;
    const progressInterval = Math.max(
      1,
      Math.floor(totalIssues / TIMING_CONFIG.PROGRESS_UPDATE_PERCENTAGE)
    );

    // Batch size for processing - process 10 cards at a time, then yield
    const BATCH_SIZE = 10;

    // Process each sprint
    let sprintXOffset = 0; // X position for the current sprint
    for (const sprint of sortedSprints) {
      const sprintIssues = issuesBySprint[sprint];

      // Group issues by Epic Link within this sprint
      const issuesByEpic: { [epicLink: string]: typeof sprintIssues } = {};
      for (const issue of sprintIssues) {
        // Get Epic Link - check various possible field names
        const epicLink =
          issue['Custom field (Epic Link)'] ||
          issue['Epic Link'] ||
          issue['Epic'] ||
          '';
        const epicKey = epicLink.trim() || 'No Epic'; // Use "No Epic" for items without an epic

        if (!issuesByEpic[epicKey]) {
          issuesByEpic[epicKey] = [];
        }
        issuesByEpic[epicKey].push(issue);
      }

      // Get sorted list of epics (for consistent ordering)
      const sortedEpics = Object.keys(issuesByEpic).sort();
      const numEpics = sortedEpics.length;
      const numColumns = Math.max(numEpics, 3); // Minimum 3 columns, but can have more if more epics

      // Calculate capacity per assignee for this sprint
      const capacity = calculateCapacity(sprintIssues);

      // Calculate sprint label width based on number of epic columns
      const columnWidth = cardWidth + spacing;
      const sprintLabelWidth = numColumns * columnWidth - spacing; // Total width of all epic columns
      const fixedSprintLabelY =
        viewport.y + LAYOUT_CONFIG.SPRINT_LABEL_Y_OFFSET; // Fixed Y position for sprint label
      const spacingBetweenTableAndLabel = LAYOUT_CONFIG.SPRINT_TABLE_SPACING;

      // Calculate table height first (if table exists) - use helper function
      let capacityTableHeight = 0;
      if (Object.keys(capacity).length > 0) {
        capacityTableHeight = calculateTableHeight(capacity);

        // Create the table at the correct position (growing upward from fixed label position)
        const tableX = viewport.x + sprintXOffset;
        const tableY =
          fixedSprintLabelY - capacityTableHeight - spacingBetweenTableAndLabel;

        const tableResult = await createCapacityTable(
          capacity,
          tableX,
          tableY,
          sprintLabelWidth
        );

        // Add all table nodes to createdFrames for scrolling
        for (const node of tableResult.nodes) {
          createdFrames.push(node as any);
        }
      }

      // Create sprint label - large text spanning all epic columns
      const sprintLabel = figma.createText();
      sprintLabel.characters = sprint;
      sprintLabel.fontSize = LAYOUT_CONFIG.SPRINT_LABEL_FONT_SIZE;
      try {
        sprintLabel.fontName = { family: 'Inter', style: 'Bold' };
      } catch (e) {
        console.warn('Could not set Bold font for sprint label, using default');
      }
      sprintLabel.fills = [{ type: 'SOLID', color: COLOR_CONFIG.TEXT_DARK }];

      // Position label centered above all epic columns
      sprintLabel.x =
        viewport.x + sprintXOffset + (sprintLabelWidth - sprintLabel.width) / 2; // Center the label
      sprintLabel.y = fixedSprintLabelY; // Fixed Y position - never changes

      figma.currentPage.appendChild(sprintLabel);
      createdFrames.push(sprintLabel as any); // Add to frames for scrolling

      // Get sprint dates from the first issue in this sprint (if available)
      const sprintDates =
        sprintIssues.length > 0
          ? getSprintDates(sprintIssues[0])
          : 'MM/DD/YYYY - MM/DD/YYYY';

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
        (sprintLabelWidth - sprintDatesText.width) / 2; // Center the dates
      sprintDatesText.y = sprintLabel.y + sprintLabel.height + 5; // Position below label with small spacing

      figma.currentPage.appendChild(sprintDatesText);
      createdFrames.push(sprintDatesText as any); // Add to frames for scrolling

      // Add a line under the sprint dates spanning all epic columns
      const line = figma.createLine();
      const lineY =
        sprintDatesText.y +
        sprintDatesText.height +
        LAYOUT_CONFIG.SPRINT_LINE_SPACING;
      const lineStartX = viewport.x + sprintXOffset;

      line.x = lineStartX;
      line.y = lineY;
      line.resize(sprintLabelWidth, 0); // Horizontal line spanning all epic columns
      line.strokes = [{ type: 'SOLID', color: COLOR_CONFIG.TEXT_SECONDARY }];
      line.strokeWeight = COLOR_CONFIG.BORDER_WEIGHT;

      figma.currentPage.appendChild(line);
      createdFrames.push(line as any); // Add to frames for scrolling

      // Calculate starting Y position for cards (after the line with spacing)
      const spacingAfterLine = LAYOUT_CONFIG.SPRINT_AFTER_LINE_SPACING;
      const cardsStartY = lineY + spacingAfterLine;

      // Track position for each column (epic columns + any empty columns to reach minimum of 3)
      const epicColumnHeights: { [epicKey: string]: number } = {};
      for (const epicKey of sortedEpics) {
        epicColumnHeights[epicKey] = 0;
      }
      // Initialize heights for all columns (including empty ones if needed)
      const columnHeights: number[] = new Array(numColumns).fill(0);

      // Process each epic column
      for (let epicIndex = 0; epicIndex < sortedEpics.length; epicIndex++) {
        const epicKey = sortedEpics[epicIndex];
        const epicIssues = issuesByEpic[epicKey];

        // Calculate X position for this epic column
        const epicX = viewport.x + sprintXOffset + epicIndex * columnWidth;

        // Process issues in batches to prevent UI blocking
        for (
          let batchStart = 0;
          batchStart < epicIssues.length;
          batchStart += BATCH_SIZE
        ) {
          // Show progress feedback
          processedCount += Math.min(
            BATCH_SIZE,
            epicIssues.length - batchStart
          );
          if (
            processedCount % progressInterval === 0 ||
            processedCount === totalIssues
          ) {
            const progress = Math.round((processedCount / totalIssues) * 100);
            figma.notify(
              `Processing ${processedCount}/${totalIssues} (${progress}%)...`,
              {
                timeout: TIMING_CONFIG.PROGRESS_NOTIFICATION_TIMEOUT,
              }
            );
          }

          // Process batch
          const batchResult = await processIssueBatch(
            epicIssues,
            batchStart,
            BATCH_SIZE,
            epicX,
            cardsStartY,
            epicKey,
            epicColumnHeights,
            epicIndex,
            columnHeights,
            createdFrames,
            spacing,
            jiraBaseUrl
          );

          totalCreated += batchResult.created;
          totalSkipped += batchResult.skipped;

          // Yield control to UI after each batch
          if (batchStart + BATCH_SIZE < epicIssues.length) {
            await yieldToUI();
          }
        }
      }

      // Move to next sprint position
      // Find the maximum height across all columns in this sprint (including empty columns)
      const maxSprintHeight = Math.max(...columnHeights, 0);
      // Move X position for next sprint (all epic columns width + spacing)
      sprintXOffset += sprintLabelWidth + sprintSpacing;
    }

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
function extractCardData(frame: FrameNode): {
  type: string;
  title: string;
  fields: { label: string; value: string }[];
  issueKey?: string;
} | null {
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
  const titleNode = textNodes[0];
  const actualTitle = titleNode ? titleNode.characters.trim() : frame.name;

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

  // Return extracted card data with issue key for export
  // Issue keys are preserved for imported cards to enable round-trip to Jira
  // Always include issueKey even if empty (for consistency)
  return {
    type: cardType,
    title: actualTitle, // Include the actual title from text node
    fields,
    issueKey: issueKey || undefined, // Include issue key if available (undefined if empty for cleaner export)
  };
}

/**
 * Maps internal field names to CSV column names for export.
 */
function mapFieldToCSVColumn(fieldLabel: string, templateType: string): string {
  const mapping: { [key: string]: string } = {
    // Common fields
    Summary: 'Summary',
    Name: 'Summary', // Name also maps to Summary
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
    /^Theme Name$/i,
    /^Milestone Name$/i,
    /^Epic Name$/i,
    /^Initiative Name$/i,
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
  const cards: Array<{
    type: string;
    title: string;
    fields: { label: string; value: string }[];
    issueKey?: string;
  }> = [];

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

      // Handle fields that map to the same CSV column (e.g., Name and Summary both → Summary)
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
      } else {
        // Find the internal field label(s) for this CSV column
        const internalLabels = csvColumnMap.get(csvColumn);
        if (internalLabels && internalLabels.length > 0) {
          // If multiple fields map to same column (e.g., Name and Summary), prefer Summary
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
      await importCardsFromCSV(msg.csvText, msg.jiraBaseUrl);
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

  // Collect all cards with issue keys
  allFrames.forEach((frame) => {
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
  const cardsToCheckForHyperlinks: FrameNode[] = [];
  allFrames.forEach((frame) => {
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

          // Notify user that the card has been marked for export (only if not importing)
          if (!isImporting) {
            const cardTitle =
              textNodes.length > 0 ? textNodes[0].characters.trim() : 'Card';
            figma.notify(
              `📋 Copied card "${cardTitle}" marked for export (no issue key)`
            );
          }
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
  // Small delay to ensure duplication is complete before checking
  setTimeout(() => {
    checkForDuplicates();
  }, TIMING_CONFIG.DUPLICATE_CHECK_DELAY);
});

// Also check periodically to catch any missed duplicates (especially from copy/paste)
// This ensures we catch duplicates even if selection doesn't change
// Reduced frequency to avoid unnecessary checks
setInterval(() => {
  checkForDuplicates();
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
