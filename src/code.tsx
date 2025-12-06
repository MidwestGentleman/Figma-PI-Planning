// This file runs in the FigJam plugin context
/// <reference types="@figma/plugin-typings" />

// Define ticket type templates
const TEMPLATES = {
  theme: {
    title: 'Theme',
    fields: [
      { label: 'Name', value: 'Theme Name' },
      { label: 'Description', value: 'Business objective description...' },
      { label: 'Business Value', value: 'High' },
      { label: 'Status', value: 'Planning' },
      { label: 'Priority Rank', value: '#' },
    ],
  },
  milestone: {
    title: 'Milestone',
    fields: [
      { label: 'Name', value: 'Milestone Name' },
      { label: 'Target Date', value: 'MM/DD/YYYY' },
      { label: 'Status', value: 'Not Started' },
      { label: 'Description', value: 'Milestone description...' },
    ],
  },
  userStory: {
    title: 'User Story',
    fields: [
      { label: 'As a', value: '[user type]' },
      { label: 'I want', value: '[feature]' },
      { label: 'So that', value: '[benefit]' },
      {
        label: 'Acceptance Criteria',
        value: '- Criterion 1\n- Criterion 2\n- Criterion 3',
      },
      { label: 'Story Points', value: '?' },
      { label: 'Priority', value: 'Medium' },
      { label: 'Assignee', value: 'Unassigned' },
    ],
  },
  epic: {
    title: 'Epic',
    fields: [
      { label: 'Name', value: 'Epic Name' },
      { label: 'Description', value: 'Epic description...' },
      { label: 'Business Value', value: 'High' },
      { label: 'Status', value: 'Planning' },
    ],
  },
  initiative: {
    title: 'Initiative',
    fields: [
      { label: 'Name', value: 'Initiative Name' },
      { label: 'Description', value: 'Initiative description...' },
      { label: 'Dependencies', value: 'None' },
      { label: 'Team', value: 'Team Name' },
    ],
  },
  task: {
    title: 'Task',
    fields: [
      { label: 'Name', value: 'Task Name' },
      { label: 'Description', value: 'Task description...' },
      { label: 'Status', value: 'Not Started' },
      { label: 'Assignee', value: 'Unassigned' },
    ],
  },
  spike: {
    title: 'Spike',
    fields: [
      { label: 'Name', value: 'Spike Name' },
      { label: 'Description', value: 'Spike description...' },
      { label: 'Status', value: 'In Progress' },
      { label: 'Findings', value: 'Research findings...' },
      { label: 'Assignee', value: 'Unassigned' },
    ],
  },
  test: {
    title: 'Test',
    fields: [
      { label: 'Name', value: 'Test Name' },
      { label: 'Description', value: 'Test description...' },
      { label: 'Status', value: 'Not Started' },
      { label: 'Test Type', value: 'Manual' },
      { label: 'Assignee', value: 'Unassigned' },
    ],
  },
};

// Type definitions for plugin messages
type PluginMessage =
  | { type: 'insert-template'; templateType: keyof typeof TEMPLATES }
  | { type: 'import-csv'; csvText: string }
  | { type: 'export-csv' }
  | { type: 'close' };

// Font loading cache to avoid reloading fonts multiple times
let fontsLoadedPromise: Promise<void> | null = null;

/**
 * Loads required fonts once and caches the promise for subsequent calls.
 * This improves performance when creating multiple cards.
 */
async function ensureFontsLoaded(): Promise<void> {
  if (!fontsLoadedPromise) {
    fontsLoadedPromise = Promise.all([
      figma.loadFontAsync({ family: 'Inter', style: 'Bold' }),
      figma.loadFontAsync({ family: 'Inter', style: 'Medium' }),
      figma.loadFontAsync({ family: 'Inter', style: 'Regular' }),
    ]).then(() => {
      // Fonts loaded successfully
    });
  }
  return fontsLoadedPromise;
}

/**
 * Determines which field should be displayed as a large number for a given template type.
 * @param templateType - The template type
 * @returns The field label to display as large number, or null if none
 */
function getLargeNumberField(
  templateType: keyof typeof TEMPLATES
): string | null {
  if (templateType === 'theme') {
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
 * @param templateType - The template type
 * @returns RGB color object for the template type
 */
function getTemplateBackgroundColor(templateType: keyof typeof TEMPLATES): {
  r: number;
  g: number;
  b: number;
} {
  const colors: { [key: string]: { r: number; g: number; b: number } } = {
    theme: { r: 0.4, g: 0.2, b: 0.6 }, // Dark purple
    milestone: { r: 0.3, g: 0.7, b: 0.3 }, // Green
    userStory: { r: 1.0, g: 0.8, b: 0.6 }, // Light orange
    epic: { r: 0.2, g: 0.5, b: 0.9 }, // Blue
    initiative: { r: 0.9, g: 0.6, b: 0.1 }, // Orange
    task: { r: 0.13, g: 0.55, b: 0.13 }, // Forest green
    spike: { r: 0.7, g: 0.6, b: 0.4 }, // Light brown
    test: { r: 0.2, g: 0.5, b: 0.9 }, // Blue
  };
  return colors[templateType] || { r: 0.5, g: 0.5, b: 0.5 }; // Default gray
}

/**
 * Determines if text should be light (white) or dark (black) based on background brightness.
 * Uses relative luminance formula to determine contrast.
 * @param backgroundColor - RGB color object
 * @returns True if text should be light (white), false if dark (black)
 */
function shouldUseLightText(backgroundColor: {
  r: number;
  g: number;
  b: number;
}): boolean {
  // Calculate relative luminance (perceived brightness)
  // Formula: 0.299*R + 0.587*G + 0.114*B
  const luminance =
    0.299 * backgroundColor.r +
    0.587 * backgroundColor.g +
    0.114 * backgroundColor.b;
  // Use light text if background is dark (luminance < 0.5)
  return luminance < 0.5;
}

/**
 * Checks if a template type has an Assignee field.
 * @param templateType - The template type
 * @returns True if the template has an Assignee field
 */
function hasAssigneeField(templateType: keyof typeof TEMPLATES): boolean {
  return (
    templateType === 'userStory' ||
    templateType === 'task' ||
    templateType === 'spike' ||
    templateType === 'test'
  );
}

/**
 * Wraps text at word boundaries when it exceeds the character limit.
 * @param text - The text to wrap
 * @param maxLength - Maximum characters per line (default: 40)
 * @returns Text with line breaks inserted
 */
function wrapTitleText(text: string, maxLength: number = 40): string {
  if (!text || text.length <= maxLength) {
    return text;
  }

  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    // If adding this word would exceed the limit, start a new line
    if (
      currentLine.length > 0 &&
      (currentLine + ' ' + word).length > maxLength
    ) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      // Add word to current line
      if (currentLine.length > 0) {
        currentLine += ' ' + word;
      } else {
        currentLine = word;
      }
    }
  }

  // Add the last line
  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines.join('\n');
}

// Helper function to create icon shape based on template type
function createIconShape(
  templateType: keyof typeof TEMPLATES,
  iconX: number,
  iconY: number
): SceneNode {
  const iconSize = 32;
  let iconShape: SceneNode;

  if (templateType === 'theme') {
    // Elongated horizontal rectangle for theme
    const rect = figma.createRectangle();
    rect.resize(iconSize * 1.5, iconSize * 0.6);
    rect.fills = [{ type: 'SOLID', color: { r: 0.4, g: 0.2, b: 0.6 } }]; // Dark purple
    rect.cornerRadius = 2;
    rect.x = iconX - iconSize * 0.25; // Center the wider rectangle
    rect.y = iconY + (iconSize - rect.height) / 2;
    iconShape = rect;
  } else if (templateType === 'milestone') {
    // Diamond shape for milestone (using polygon with 4 points) - Green
    const diamond = figma.createPolygon();
    diamond.resize(iconSize, iconSize);
    diamond.pointCount = 4;
    diamond.fills = [{ type: 'SOLID', color: { r: 0.3, g: 0.7, b: 0.3 } }]; // Green
    diamond.x = iconX;
    diamond.y = iconY;
    iconShape = diamond;
  } else if (templateType === 'userStory') {
    // Light orange square for user story
    const rect = figma.createRectangle();
    rect.resize(iconSize, iconSize);
    rect.fills = [{ type: 'SOLID', color: { r: 1.0, g: 0.8, b: 0.6 } }]; // Light orange
    rect.cornerRadius = 4;
    rect.x = iconX;
    rect.y = iconY;
    iconShape = rect;
  } else if (templateType === 'epic') {
    // Blue circle for epic
    const ellipse = figma.createEllipse();
    ellipse.resize(iconSize, iconSize);
    ellipse.fills = [{ type: 'SOLID', color: { r: 0.2, g: 0.5, b: 0.9 } }]; // Blue
    ellipse.x = iconX;
    ellipse.y = iconY;
    iconShape = ellipse;
  } else if (templateType === 'initiative') {
    // Orange triangle for initiative
    const polygon = figma.createPolygon();
    polygon.resize(iconSize, iconSize);
    polygon.pointCount = 3;
    polygon.fills = [{ type: 'SOLID', color: { r: 0.9, g: 0.6, b: 0.1 } }]; // Orange
    polygon.x = iconX;
    polygon.y = iconY;
    iconShape = polygon;
  } else if (templateType === 'task') {
    // Forest green square for task
    const rect = figma.createRectangle();
    rect.resize(iconSize, iconSize);
    rect.fills = [{ type: 'SOLID', color: { r: 0.13, g: 0.55, b: 0.13 } }]; // Forest green
    rect.cornerRadius = 4;
    rect.x = iconX;
    rect.y = iconY;
    iconShape = rect;
  } else if (templateType === 'spike') {
    // Light brown square for spike
    const rect = figma.createRectangle();
    rect.resize(iconSize, iconSize);
    rect.fills = [{ type: 'SOLID', color: { r: 0.7, g: 0.6, b: 0.4 } }]; // Light brown
    rect.cornerRadius = 4;
    rect.x = iconX;
    rect.y = iconY;
    iconShape = rect;
  } else if (templateType === 'test') {
    // Blue diamond for test
    const diamond = figma.createPolygon();
    diamond.resize(iconSize, iconSize);
    diamond.pointCount = 4;
    diamond.fills = [{ type: 'SOLID', color: { r: 0.2, g: 0.5, b: 0.9 } }]; // Blue
    diamond.x = iconX;
    diamond.y = iconY;
    iconShape = diamond;
  } else {
    // Default fallback
    const rect = figma.createRectangle();
    rect.resize(iconSize, iconSize);
    rect.fills = [{ type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5 } }]; // Gray
    rect.cornerRadius = 4;
    rect.x = iconX;
    rect.y = iconY;
    iconShape = rect;
  }

  return iconShape;
}

// Function to create a template card with custom data
// This is a convenience wrapper that uses createTemplateCardWithPosition
// positioned at the viewport center, with selection and scroll behavior
async function createTemplateCard(
  templateType: keyof typeof TEMPLATES,
  customData?: { [key: string]: string }
) {
  // Use the reusable function to create the card (position defaults to viewport center)
  const frame = await createTemplateCardWithPosition(templateType, customData);

  // Select the new frame and scroll to it (only for menu button clicks, not imports)
  figma.currentPage.selection = [frame];
  figma.viewport.scrollAndZoomIntoView([frame]);

  return frame;
}

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

// Function to parse CSV text (handles multiline fields in quotes)
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

// Function to map Jira issue to template type and extract data
// Function to convert Jira formatting to more readable plain text
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

function mapJiraIssueToTemplate(issue: { [key: string]: string }): {
  templateType: keyof typeof TEMPLATES;
  data: { [key: string]: string };
} | null {
  const issueType = issue['Issue Type'] || '';
  const summary = issue['Summary'] || '';
  const description = formatJiraText(issue['Description'] || '');
  const status = issue['Status'] || '';
  const priority = issue['Priority'] || '';
  const storyPoints = issue['Custom field (Story Points)'] || '';
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
        Status: status || 'Planning',
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
        'Story Points': storyPoints || '#',
        Priority: priority || 'Medium',
        Assignee: issue['Assignee'] || 'Unassigned',
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
        Status: status || 'Not Started',
        Description: description || 'Milestone description...', // Description → Description
      },
    };
  } else if (issueType.toLowerCase() === 'task') {
    templateType = 'task';
    return {
      templateType,
      data: {
        title: summary, // Title → Summary
        Name: summary, // Name → Summary
        Description: description || 'Task description...', // Description → Description
        Status: status || 'Not Started',
        'Story Points': storyPoints || '?', // Include Story Points if available
        Assignee: issue['Assignee'] || 'Unassigned',
      },
    };
  } else if (issueType.toLowerCase() === 'spike') {
    templateType = 'spike';
    return {
      templateType,
      data: {
        title: summary, // Title → Summary
        Name: summary, // Name → Summary
        Description: description || 'Spike description...', // Description → Description
        Status: status || 'In Progress',
        Findings: formatJiraText(description || 'Research findings...'), // Use description as findings
        'Story Points': storyPoints || '?', // Include Story Points if available
        Assignee: issue['Assignee'] || 'Unassigned',
      },
    };
  } else if (issueType.toLowerCase() === 'test') {
    templateType = 'test';
    return {
      templateType,
      data: {
        title: summary, // Title → Summary
        Name: summary, // Name → Summary
        Description: description || 'Test description...', // Description → Description
        Status: status || 'Not Started',
        'Test Type': issue['Custom field (Test Type)'] || 'Manual',
        'Story Points': storyPoints || '?', // Include Story Points if available
        Assignee: issue['Assignee'] || 'Unassigned',
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
        Status: status || 'Planning',
        'Priority Rank':
          issue['Priority'] || issue['Custom field (Priority Rank)'] || '#',
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
        Team: team || 'Team Name', // Team → Custom field (Studio)
      },
    };
  }
}

// Helper function to create card at specific position
// This is the unified card creation function used by both menu clicks and imports
async function createTemplateCardWithPosition(
  templateType: keyof typeof TEMPLATES,
  customData?: { [key: string]: string },
  x?: number,
  y?: number
): Promise<FrameNode> {
  const template = TEMPLATES[templateType];

  // Ensure fonts are loaded (uses cache if already loaded)
  await ensureFontsLoaded();

  // Use provided position or default to viewport center
  const viewport = figma.viewport.center;
  const cardX = x !== undefined ? x : viewport.x;
  const cardY = y !== undefined ? y : viewport.y;

  // Create a frame to hold the template
  // In FigJam, frames work well for structured cards with multiple elements
  const frame = figma.createFrame();
  frame.name = (customData && customData.title) || template.title;
  frame.x = cardX;
  frame.y = cardY;
  // Larger cards to accommodate prominent number display
  const cardWidth = 500;
  frame.resize(cardWidth, 400);

  // Set background color to match icon color with 15% opacity
  const backgroundColor = getTemplateBackgroundColor(templateType);
  frame.fills = [{ type: 'SOLID', color: backgroundColor, opacity: 0.15 }];

  // Determine text color based on background brightness (for legibility)
  // Force black text for test, theme, epic, spike, and task (even with subtle backgrounds)
  const forceBlackText =
    templateType === 'test' ||
    templateType === 'theme' ||
    templateType === 'epic' ||
    templateType === 'spike' ||
    templateType === 'task';
  const useLightText = forceBlackText
    ? false
    : shouldUseLightText(backgroundColor);

  // FigJam-optimized styling: More visible border for whiteboard context
  if (figma.editorType === 'figjam') {
    // More prominent border for better visibility on whiteboard
    frame.strokes = [
      { type: 'SOLID', color: { r: 0.6, g: 0.6, b: 0.6 }, opacity: 0.8 },
    ];
    frame.strokeWeight = 2;
  } else {
    // Original styling for Figma
    frame.strokes = [{ type: 'SOLID', color: { r: 0.8, g: 0.8, b: 0.8 } }];
  }
  frame.cornerRadius = 8;

  // Make cards easier to select and interact with in FigJam
  frame.locked = false;

  // Add icon shape based on template type (right-justified)
  const iconSize = 32;
  const iconX = cardWidth - 20 - iconSize;
  const iconY = 20;
  const iconShape = createIconShape(templateType, iconX, iconY);
  frame.appendChild(iconShape);

  // Add title text (left side)
  // Title comes from Summary field in imports (mapped to 'title' in customData)
  // or uses template title for new cards
  const titleText = figma.createText();
  const titleContent = (customData && customData.title) || template.title;
  titleText.characters = wrapTitleText(titleContent, 40); // Wrap at 40 characters
  titleText.fontSize = 24;
  // Use appropriate text color based on background brightness
  titleText.fills = [
    {
      type: 'SOLID',
      color: useLightText ? { r: 1, g: 1, b: 1 } : { r: 0.2, g: 0.2, b: 0.2 },
    },
  ];
  titleText.x = 20;
  titleText.y = 20;
  // Set width to allow wrapping, then calculate actual height
  titleText.resize(cardWidth - 40, titleText.height); // cardWidth - left padding - right padding
  frame.appendChild(titleText);

  // Calculate title height after wrapping
  const titleHeight = titleText.height;

  // Add fields
  // For user stories, always use Description format (consistent between import and menu creation)
  // Replace As a/I want/So that with Description field
  let fieldsToShow = template.fields;
  if (templateType === 'userStory') {
    // Always use Description format for user stories
    const descriptionValue =
      customData && customData['Description']
        ? customData['Description']
        : 'User story description...';

    fieldsToShow = [{ label: 'Description', value: descriptionValue }].concat(
      template.fields.filter(
        (f) =>
          f.label !== 'As a' && f.label !== 'I want' && f.label !== 'So that'
      )
    );
  }

  // Filter out fields that will be displayed as large numbers or at the bottom (Assignee)
  const largeNumberField = getLargeNumberField(templateType);
  const fieldsToDisplay = fieldsToShow.filter(
    (f) =>
      (!largeNumberField || f.label !== largeNumberField) &&
      f.label !== 'Assignee' // Assignee is shown at bottom, not in fields list
  );

  // Start fields below title with proper spacing
  let yOffset = 20 + titleHeight + 20; // title y + title height + padding
  for (const field of fieldsToDisplay) {
    const fieldValue =
      customData && customData[field.label]
        ? customData[field.label]
        : field.value;

    // Field label
    const labelText = figma.createText();
    labelText.characters = field.label + ':';
    labelText.fontSize = 12;
    labelText.fills = [
      {
        type: 'SOLID',
        color: useLightText
          ? { r: 0.9, g: 0.9, b: 0.9 }
          : { r: 0.4, g: 0.4, b: 0.4 },
      },
    ];
    labelText.x = 20;
    labelText.y = yOffset;
    frame.appendChild(labelText);

    // Field value - wider text area for larger cards
    const valueText = figma.createText();
    valueText.characters = fieldValue;
    valueText.fontSize = 14;
    valueText.fills = [
      {
        type: 'SOLID',
        color: useLightText ? { r: 1, g: 1, b: 1 } : { r: 0.1, g: 0.1, b: 0.1 },
      },
    ];
    valueText.x = 20;
    valueText.y = yOffset + 20;
    valueText.resize(460, valueText.height); // Wider for larger card
    frame.appendChild(valueText);

    yOffset += valueText.height + 40;
  }

  // Calculate bottom position for number and assignee
  const bottomPadding = 20;
  const bottomY = yOffset + bottomPadding;

  // Get the value for the large number display using helper function
  // For templates with assignees (userStory, task, spike, test), always show the number
  let largeNumberValue: string | null = null;
  if (largeNumberField) {
    const numberField = template.fields.find(
      (f) => f.label === largeNumberField
    );
    const defaultValue = largeNumberField === 'Priority Rank' ? '#' : '?';
    largeNumberValue =
      (customData && customData[largeNumberField]) ||
      (numberField && numberField.value) ||
      defaultValue;
  }

  // Add large number in bottom right corner (if applicable)
  // Right-justified to the icon position
  // Always show for templates with assignees (userStory, task, spike, test)
  if (largeNumberField && largeNumberValue) {
    const largeNumberText = figma.createText();
    largeNumberText.characters = largeNumberValue;
    largeNumberText.fontSize = 24; // Same size as title
    // Make the number bold
    try {
      largeNumberText.fontName = { family: 'Inter', style: 'Bold' };
    } catch (e) {
      console.warn('Could not set Bold font for number, using default');
    }
    largeNumberText.fills = [
      {
        type: 'SOLID',
        color: useLightText ? { r: 1, g: 1, b: 1 } : { r: 0.2, g: 0.2, b: 0.2 },
      },
    ];
    frame.appendChild(largeNumberText);

    // Position in bottom right, right-aligned to icon (iconX + iconSize)
    // Icon is at iconX, so number should align to iconX + iconSize (right edge of icon)
    const iconRightEdge = iconX + iconSize;
    largeNumberText.x = iconRightEdge - largeNumberText.width;
    largeNumberText.y = bottomY;

    // Update frame height to accommodate the number
    yOffset = bottomY + largeNumberText.height + bottomPadding;
  } else {
    yOffset += bottomPadding;
  }

  // Add Assignee in bottom left (if applicable, same size, aligned with number)
  // For templates with assignees (userStory, task, spike, test), always show assignee
  if (hasAssigneeField(templateType)) {
    const assigneeField = template.fields.find((f) => f.label === 'Assignee');
    const assigneeValue =
      (customData && customData['Assignee']) ||
      (assigneeField && assigneeField.value) ||
      'Unassigned';

    // Always show assignee (now defaults to '[Assignee]' for new cards)
    if (assigneeValue) {
      const assigneeText = figma.createText();
      assigneeText.characters = assigneeValue;
      assigneeText.fontSize = 24; // Same size as title and number
      // Make the assignee text bold
      try {
        assigneeText.fontName = { family: 'Inter', style: 'Bold' };
      } catch (e) {
        console.warn('Could not set Bold font for assignee, using default');
      }
      assigneeText.fills = [
        {
          type: 'SOLID',
          color: useLightText
            ? { r: 1, g: 1, b: 1 }
            : { r: 0.2, g: 0.2, b: 0.2 },
        },
      ];
      frame.appendChild(assigneeText);

      // Position in bottom left, left-justified
      // Same Y coordinate as number to ensure they're on the same baseline
      assigneeText.x = 20; // Left padding
      assigneeText.y = bottomY; // Same Y as number - aligned on same baseline

      // Update frame height if needed (should be same as number height since same font size)
      yOffset = Math.max(
        yOffset,
        bottomY + assigneeText.height + bottomPadding
      );
    }
  }

  // Resize frame to fit content (add extra padding at bottom)
  frame.resize(cardWidth, yOffset);

  // FigJam-specific enhancements
  if (figma.editorType === 'figjam') {
    // Cards are optimized for FigJam whiteboard experience
    // They're easily selectable, movable, and collaborative
  }

  // Add to current page
  figma.currentPage.appendChild(frame);

  return frame;
}

// Function to import cards from CSV
async function importCardsFromCSV(csvText: string) {
  console.log(
    'importCardsFromCSV called with csvText length:',
    (csvText && csvText.length) || 0
  );

  if (!csvText || csvText.trim() === '') {
    figma.notify('❌ CSV file is empty');
    console.error('CSV text is empty or null');
    return;
  }

  const issues = parseCSV(csvText);
  console.log(`Parsed ${issues.length} rows from CSV`);

  if (issues.length === 0) {
    figma.notify('❌ No data found in CSV file');
    console.error('No issues parsed from CSV');
    return;
  }

  // Load fonts once before processing all cards (performance optimization)
  await ensureFontsLoaded();

  // Helper function to extract Sprint value from issue
  // CSV may have multiple "Sprint" columns, coalesce them to get the first non-empty value
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

    return 'No Sprint'; // Default for issues without sprint
  }

  // Group issues by Sprint
  const issuesBySprint: { [sprint: string]: typeof issues } = {};
  for (const issue of issues) {
    // Skip if no summary (likely empty/invalid row)
    if (!issue['Summary'] || issue['Summary'].trim() === '') {
      continue;
    }

    const sprint = getSprintValue(issue);
    if (!issuesBySprint[sprint]) {
      issuesBySprint[sprint] = [];
    }
    issuesBySprint[sprint].push(issue);
  }

  // Sort sprints for consistent ordering
  const sortedSprints = Object.keys(issuesBySprint).sort();

  const viewport = figma.viewport.center;
  const cardWidth = 500;
  const cardHeight = 500;
  const spacing = 50;
  const cardsPerColumn = 3; // 3 columns per sprint
  const sprintSpacing = 100; // Space between sprints

  let created = 0;
  let skipped = 0;
  const createdFrames: FrameNode[] = [];
  const totalIssues = issues.length;
  let processedCount = 0;
  const progressInterval = Math.max(1, Math.floor(totalIssues / 10)); // Show progress every 10%

  // Helper function to parse story points (handles "1.0", "3", "?", "#", etc.)
  function parseStoryPoints(value: string): number {
    if (!value || value.trim() === '' || value === '?' || value === '#') {
      return 0;
    }
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  }

  // Helper function to calculate capacity per assignee for a sprint
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

  // Helper function to calculate capacity table height
  function calculateTableHeight(capacity: {
    [assignee: string]: number;
  }): number {
    const rowHeight = 28; // Increased to accommodate larger font
    const headerSpacing = 10; // Slightly increased spacing

    // Count non-zero assignees
    const dataRowCount = Object.values(capacity).filter(
      (points) => points > 0
    ).length;

    // Height = header row + spacing + data rows
    return rowHeight + headerSpacing + dataRowCount * rowHeight;
  }

  // Helper function to create a capacity table
  async function createCapacityTable(
    capacity: { [assignee: string]: number },
    x: number,
    y: number,
    width: number
  ): Promise<{ height: number; nodes: SceneNode[] }> {
    await ensureFontsLoaded();
    const nodes: SceneNode[] = [];
    const rowHeight = 28; // Increased to accommodate larger font
    const columnSpacing = 20;
    const headerFontSize = 18; // Increased from 14
    const dataFontSize = 16; // Increased from 12
    let currentY = y;

    // Create header row
    const headerAssignee = figma.createText();
    headerAssignee.characters = 'Assignee';
    headerAssignee.fontSize = headerFontSize;
    try {
      headerAssignee.fontName = { family: 'Inter', style: 'Bold' };
    } catch (e) {
      console.warn('Could not set Bold font for table header, using default');
    }
    headerAssignee.fills = [
      { type: 'SOLID', color: { r: 0, g: 0, b: 0 } }, // Black for better readability
    ];
    headerAssignee.x = x;
    headerAssignee.y = currentY;
    figma.currentPage.appendChild(headerAssignee);
    nodes.push(headerAssignee);

    const headerAllocated = figma.createText();
    headerAllocated.characters = 'Allocated';
    headerAllocated.fontSize = headerFontSize;
    try {
      headerAllocated.fontName = { family: 'Inter', style: 'Bold' };
    } catch (e) {
      console.warn('Could not set Bold font for table header, using default');
    }
    headerAllocated.fills = [
      { type: 'SOLID', color: { r: 0, g: 0, b: 0 } }, // Black for better readability
    ];
    // Position second column (estimate width of first column as 200px)
    headerAllocated.x = x + 200 + columnSpacing;
    headerAllocated.y = currentY;
    figma.currentPage.appendChild(headerAllocated);
    nodes.push(headerAllocated);

    currentY += rowHeight + 10; // Add spacing after header (increased)

    // Sort assignees by name for consistent ordering
    const sortedAssignees = Object.keys(capacity).sort();

    // Create data rows
    for (const assignee of sortedAssignees) {
      const points = capacity[assignee];
      if (points === 0) continue; // Skip assignees with 0 points

      const assigneeText = figma.createText();
      assigneeText.characters = assignee;
      assigneeText.fontSize = dataFontSize;
      assigneeText.fills = [
        { type: 'SOLID', color: { r: 0, g: 0, b: 0 } }, // Black for better readability
      ];
      assigneeText.x = x;
      assigneeText.y = currentY;
      figma.currentPage.appendChild(assigneeText);
      nodes.push(assigneeText);

      const pointsText = figma.createText();
      pointsText.characters = points.toString();
      pointsText.fontSize = dataFontSize;
      pointsText.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }]; // Black for better readability
      pointsText.x = x + 200 + columnSpacing;
      pointsText.y = currentY;
      figma.currentPage.appendChild(pointsText);
      nodes.push(pointsText);

      currentY += rowHeight;
    }

    return { height: currentY - y, nodes };
  }

  // Process each sprint
  let sprintXOffset = 0; // X position for the current sprint
  for (const sprint of sortedSprints) {
    const sprintIssues = issuesBySprint[sprint];

    // Calculate capacity per assignee for this sprint
    const capacity = calculateCapacity(sprintIssues);

    // Fixed position for sprint label (doesn't move based on table size)
    const sprintLabelWidth = cardsPerColumn * (cardWidth + spacing) - spacing; // Total width of 3 columns
    const fixedSprintLabelY = viewport.y - 80; // Fixed Y position for sprint label
    const spacingBetweenTableAndLabel = 20; // Space between table and label

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

    // Create sprint label - large text spanning all 3 columns
    const sprintLabel = figma.createText();
    sprintLabel.characters = sprint;
    sprintLabel.fontSize = 48; // Extra large label
    try {
      sprintLabel.fontName = { family: 'Inter', style: 'Bold' };
    } catch (e) {
      console.warn('Could not set Bold font for sprint label, using default');
    }
    sprintLabel.fills = [{ type: 'SOLID', color: { r: 0.2, g: 0.2, b: 0.2 } }];

    // Position label centered above the sprint's 3 columns (fixed position)
    sprintLabel.x =
      viewport.x + sprintXOffset + (sprintLabelWidth - sprintLabel.width) / 2; // Center the label
    sprintLabel.y = fixedSprintLabelY; // Fixed Y position - never changes

    figma.currentPage.appendChild(sprintLabel);
    createdFrames.push(sprintLabel as any); // Add to frames for scrolling

    // Add a line under the sprint title spanning all 3 columns
    const line = figma.createLine();
    const lineY = sprintLabel.y + sprintLabel.height + 10; // Position below the label with spacing
    const lineStartX = viewport.x + sprintXOffset;

    line.x = lineStartX;
    line.y = lineY;
    line.resize(sprintLabelWidth, 0); // Horizontal line spanning all 3 columns
    line.strokes = [{ type: 'SOLID', color: { r: 0.4, g: 0.4, b: 0.4 } }];
    line.strokeWeight = 2;

    figma.currentPage.appendChild(line);
    createdFrames.push(line as any); // Add to frames for scrolling

    // Track position within this sprint (3 columns)
    const columnHeights = [0, 0, 0]; // Track height of each column
    const columnWidth = cardWidth + spacing;

    for (let i = 0; i < sprintIssues.length; i++) {
      const issue = sprintIssues[i];

      // Show progress feedback for large imports
      processedCount++;
      if (
        processedCount % progressInterval === 0 ||
        processedCount === totalIssues
      ) {
        const progress = Math.round((processedCount / totalIssues) * 100);
        figma.notify(
          `Processing ${processedCount}/${totalIssues} (${progress}%)...`,
          {
            timeout: 500,
          }
        );
      }

      const mapped = mapJiraIssueToTemplate(issue);
      if (!mapped) {
        skipped++;
        continue;
      }

      try {
        // Determine which column (0, 1, or 2) - find the shortest column
        // This creates a cascading effect where cards fill columns sequentially
        let columnIndex = 0;
        let minHeight = columnHeights[0];
        for (let col = 1; col < cardsPerColumn; col++) {
          if (columnHeights[col] < minHeight) {
            minHeight = columnHeights[col];
            columnIndex = col;
          }
        }

        // Calculate position within this sprint
        const x = viewport.x + sprintXOffset + columnIndex * columnWidth;
        const y = viewport.y + columnHeights[columnIndex];

        // Create card with custom position
        const frame = await createTemplateCardWithPosition(
          mapped.templateType,
          mapped.data,
          x,
          y
        );
        createdFrames.push(frame);

        // Update column height for next card in this column
        columnHeights[columnIndex] += frame.height + spacing;

        created++;
      } catch (error) {
        skipped++;
        console.error('Error creating card:', error);
      }
    }

    // Move to next sprint position
    // Find the maximum height across all columns in this sprint
    const maxSprintHeight = Math.max(...columnHeights);
    // Move X position for next sprint (3 columns width + spacing)
    sprintXOffset += cardsPerColumn * columnWidth + sprintSpacing;
  }

  // Scroll to show all created cards
  if (createdFrames.length > 0) {
    figma.viewport.scrollAndZoomIntoView(createdFrames);
  }

  figma.notify(
    `✅ Created ${created} card(s)${skipped > 0 ? `, skipped ${skipped}` : ''}`
  );
}

// Function to extract data from a card frame
function extractCardData(frame: FrameNode): {
  type: string;
  fields: { label: string; value: string }[];
} | null {
  // Check if this is one of our template cards by checking the name
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
  if (!cardTypes.has(frame.name)) return null;
  const cardType = frame.name;

  const fields: { label: string; value: string }[] = [];

  // Find all text nodes in the frame
  const textNodes = frame.findAll((node) => node.type === 'TEXT') as TextNode[];

  // Sort by Y position to get fields in order
  textNodes.sort((a, b) => a.y - b.y);

  // Skip the first text node (title) and process pairs (label, value)
  let i = 1; // Skip title
  while (i < textNodes.length) {
    const labelNode = textNodes[i];
    const valueNode = textNodes[i + 1];

    if (labelNode && valueNode) {
      const label = labelNode.characters.replace(':', '').trim();
      const value = valueNode.characters.trim();
      fields.push({ label, value });
      i += 2; // Move to next pair
    } else {
      i++;
    }
  }

  return {
    type: cardType,
    fields,
  };
}

/**
 * Builds a canonical field order based on template definitions.
 * Preserves the order fields appear in templates, with fields from earlier
 * templates taking precedence.
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

// Function to export cards to CSV
function exportCardsToCSV() {
  const cards: Array<{
    type: string;
    title: string;
    fields: { label: string; value: string }[];
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
  const frames = figma.currentPage.findAll(
    (node) => node.type === 'FRAME' && templateNames.has(node.name)
  ) as FrameNode[];

  // Extract data from each card
  for (const frame of frames) {
    const cardData = extractCardData(frame);
    if (cardData) {
      // Get title from frame name (which is set to the card title)
      const title = frame.name;

      // For user stories, concatenate As a/I want/So that into Description
      if (cardData.type === 'User Story') {
        const asA = cardData.fields.find((f) => f.label === 'As a');
        const iWant = cardData.fields.find((f) => f.label === 'I want');
        const soThat = cardData.fields.find((f) => f.label === 'So that');

        // If we have As a/I want/So that, concatenate them into Description
        if (asA && iWant && soThat) {
          const description = `As a ${asA.value}, I want ${iWant.value}, so that ${soThat.value}`;
          // Remove As a/I want/So that and add Description
          cardData.fields = cardData.fields.filter(
            (f) =>
              f.label !== 'As a' &&
              f.label !== 'I want' &&
              f.label !== 'So that'
          );
          // Add Description at the beginning
          cardData.fields.unshift({ label: 'Description', value: description });
        }
      }

      cards.push({
        type: cardData.type,
        title: title,
        fields: cardData.fields,
      });
    }
  }

  if (cards.length === 0) {
    figma.notify('❌ No template cards found on the page');
    return;
  }

  // Get all unique field labels across all cards
  const allFieldLabels = new Set<string>();
  cards.forEach((card) => {
    card.fields.forEach((field) => {
      allFieldLabels.add(field.label);
    });
  });

  // Use canonical field order from templates, then add any additional fields
  // that might exist in cards but not in templates (preserving template order)
  const canonicalOrder = getCanonicalFieldOrder();
  const orderedFields: string[] = [];
  const unorderedFields: string[] = [];

  // Add fields in canonical order
  canonicalOrder.forEach((label) => {
    if (allFieldLabels.has(label)) {
      orderedFields.push(label);
    }
  });

  // Add any fields that exist in cards but not in templates
  allFieldLabels.forEach((label) => {
    if (!canonicalOrder.includes(label)) {
      unorderedFields.push(label);
    }
  });

  // Combine: canonical order first, then any additional fields alphabetically
  const fieldLabels = orderedFields.concat(unorderedFields.sort());

  // Generate CSV header
  const header = ['Type', 'Title'].concat(fieldLabels).join(',');
  const rows = [header];

  // Generate CSV rows
  cards.forEach((card) => {
    const row: string[] = [card.type, card.title.replace(/"/g, '""')];

    fieldLabels.forEach((label) => {
      const field = card.fields.find((f) => f.label === label);
      const value = field ? field.value.replace(/"/g, '""') : ''; // Escape quotes
      row.push(`"${value}"`); // Wrap in quotes for CSV
    });
    rows.push(row.join(','));
  });

  const csvContent = rows.join('\n');

  // Send CSV to UI for download
  figma.ui.postMessage({
    type: 'export-csv',
    csv: csvContent,
    filename: `pi-planning-export-${
      new Date().toISOString().split('T')[0]
    }.csv`,
  });

  figma.notify(`✅ Exported ${cards.length} card(s) to CSV`);
}

// Helper function to safely get error message
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unknown error occurred';
}

// Set up message handler once
figma.ui.onmessage = async (msg: {
  type: string;
  templateType?: keyof typeof TEMPLATES;
  csvText?: string;
}) => {
  // Log for debugging
  console.log('Received message:', msg);

  if (msg.type === 'insert-template') {
    if (!msg.templateType) {
      figma.notify('❌ No template type specified');
      return;
    }
    try {
      await createTemplateCard(msg.templateType);
      figma.notify(
        `✅ ${TEMPLATES[msg.templateType].title} template inserted!`
      );
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      figma.notify(`❌ Error inserting template: ${errorMessage}`);
      console.error('Error inserting template:', error);
    }
  }

  if (msg.type === 'import-csv') {
    if (!msg.csvText) {
      figma.notify('❌ No CSV data provided');
      console.error('CSV import failed: No csvText in message', msg);
      return;
    }
    try {
      console.log('Starting CSV import, data length:', msg.csvText.length);
      await importCardsFromCSV(msg.csvText);
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      figma.notify(`❌ Error importing CSV: ${errorMessage}`);
      console.error('CSV import error:', error);
    }
  }

  if (msg.type === 'export-csv') {
    try {
      exportCardsToCSV();
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      figma.notify(`❌ Error exporting CSV: ${errorMessage}`);
      console.error('CSV export error:', error);
    }
  }

  if (msg.type === 'close') {
    figma.closePlugin();
  }
};

// Check if running in FigJam (recommended for this plugin)
if (figma.editorType !== 'figjam') {
  figma.notify(
    '⚠️ This plugin is optimized for FigJam. Some features may not work as expected in Figma.'
  );
}

// Show the UI panel
figma.showUI(__html__, {
  width: 300,
  height: 500,
  themeColors: true,
});
