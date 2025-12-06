// This file runs in the FigJam plugin context
/// <reference types="@figma/plugin-typings" />

// Define ticket type templates
const TEMPLATES = {
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
  feature: {
    title: 'Feature',
    fields: [
      { label: 'Name', value: 'Feature Name' },
      { label: 'Description', value: 'Feature description...' },
      { label: 'Dependencies', value: 'None' },
      { label: 'Team', value: 'Team Name' },
    ],
  },
};

// Function to create a template card with custom data
async function createTemplateCard(
  templateType: keyof typeof TEMPLATES,
  customData?: { [key: string]: string }
) {
  const template = TEMPLATES[templateType];

  // Pre-load all fonts we'll need
  await Promise.all([
    figma.loadFontAsync({ family: 'Inter', style: 'Bold' }),
    figma.loadFontAsync({ family: 'Inter', style: 'Medium' }),
    figma.loadFontAsync({ family: 'Inter', style: 'Regular' }),
  ]);

  // Get the current viewport center
  const viewport = figma.viewport.center;

  // Create a frame to hold the template
  const frame = figma.createFrame();
  frame.name = (customData && customData.title) || template.title;
  frame.x = viewport.x;
  frame.y = viewport.y;
  frame.resize(400, 300);
  // Transparent background with slight tint for visibility
  frame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, opacity: 0.85 }];
  frame.strokes = [{ type: 'SOLID', color: { r: 0.8, g: 0.8, b: 0.8 } }];
  frame.cornerRadius = 8;

  // Add icon shape based on template type (right-justified)
  const iconSize = 32;
  const iconX = 400 - 20 - iconSize; // Right edge minus padding minus icon size
  let iconShape: SceneNode;

  if (templateType === 'milestone') {
    // Diamond shape for milestone (using polygon with 4 points)
    const diamond = figma.createPolygon();
    diamond.resize(iconSize, iconSize);
    diamond.pointCount = 4;
    diamond.fills = [{ type: 'SOLID', color: { r: 0.85, g: 0.2, b: 0.2 } }]; // Red
    diamond.x = iconX;
    diamond.y = 20;
    iconShape = diamond;
  } else if (templateType === 'userStory') {
    // Circle for user story
    const ellipse = figma.createEllipse();
    ellipse.resize(iconSize, iconSize);
    ellipse.fills = [{ type: 'SOLID', color: { r: 0.2, g: 0.5, b: 0.9 } }]; // Blue
    ellipse.x = iconX;
    ellipse.y = 20;
    iconShape = ellipse;
  } else if (templateType === 'epic') {
    // Triangle for epic (using polygon)
    const polygon = figma.createPolygon();
    polygon.resize(iconSize, iconSize);
    polygon.pointCount = 3;
    polygon.fills = [{ type: 'SOLID', color: { r: 0.9, g: 0.6, b: 0.1 } }]; // Orange
    polygon.x = iconX;
    polygon.y = 20;
    iconShape = polygon;
  } else {
    // Square for feature
    const rect = figma.createRectangle();
    rect.resize(iconSize, iconSize);
    rect.fills = [{ type: 'SOLID', color: { r: 0.3, g: 0.7, b: 0.3 } }]; // Green
    rect.cornerRadius = 4;
    rect.x = iconX;
    rect.y = 20;
    iconShape = rect;
  }

  frame.appendChild(iconShape);

  // Add title text (left side)
  const titleText = figma.createText();
  titleText.characters = (customData && customData.title) || template.title;
  titleText.fontSize = 24;
  titleText.fills = [{ type: 'SOLID', color: { r: 0.2, g: 0.2, b: 0.2 } }];
  titleText.x = 20;
  titleText.y = 20;
  frame.appendChild(titleText);

  // Add fields
  let yOffset = 60;
  for (const field of template.fields) {
    // Get value from custom data or use default
    const fieldValue =
      customData && customData[field.label]
        ? customData[field.label]
        : field.value;

    // Field label
    const labelText = figma.createText();
    labelText.characters = field.label + ':';
    labelText.fontSize = 12;
    labelText.fills = [{ type: 'SOLID', color: { r: 0.4, g: 0.4, b: 0.4 } }];
    labelText.x = 20;
    labelText.y = yOffset;
    frame.appendChild(labelText);

    // Field value
    const valueText = figma.createText();
    valueText.characters = fieldValue;
    valueText.fontSize = 14;
    valueText.fills = [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1 } }];
    valueText.x = 20;
    valueText.y = yOffset + 20;
    valueText.resize(360, valueText.height);
    frame.appendChild(valueText);

    yOffset += valueText.height + 40;
  }

  // Resize frame to fit content
  frame.resize(400, yOffset + 20);

  // Add to current page
  figma.currentPage.appendChild(frame);

  // Select the new frame
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
            row[header] = values[index] || '';
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
        row[header] = values[index] || '';
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
function mapJiraIssueToTemplate(issue: { [key: string]: string }): {
  templateType: keyof typeof TEMPLATES;
  data: { [key: string]: string };
} | null {
  const issueType = issue['Issue Type'] || '';
  const summary = issue['Summary'] || '';
  const description = issue['Description'] || '';
  const status = issue['Status'] || '';
  const priority = issue['Priority'] || '';
  const storyPoints = issue['Custom field (Story Points)'] || '';
  const acceptanceCriteria = issue['Custom field (Acceptance Criteria)'] || '';
  const userStory = issue['Custom field (User Story)'] || '';
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
    return {
      templateType,
      data: {
        title: summary, // Title → Summary
        'As a': asA || '[user type]',
        'I want': iWant || '[feature]',
        'So that': soThat || '[benefit]',
        'Acceptance Criteria':
          acceptanceCriteria || '- Criterion 1\n- Criterion 2\n- Criterion 3',
        'Story Points': storyPoints || '?',
        Priority: priority || 'Medium',
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
  } else {
    // Default to feature
    templateType = 'feature';
    return {
      templateType,
      data: {
        title: summary, // Title → Summary
        Name: summary, // Name → Summary
        Description: description || 'Feature description...', // Description → Description
        Dependencies: dependencies || 'None',
        Team: team || 'Team Name', // Team → Custom field (Studio)
      },
    };
  }
}

// Helper function to create card at specific position
async function createTemplateCardWithPosition(
  templateType: keyof typeof TEMPLATES,
  customData: { [key: string]: string },
  x: number,
  y: number
): Promise<FrameNode> {
  const template = TEMPLATES[templateType];

  // Pre-load all fonts we'll need
  await Promise.all([
    figma.loadFontAsync({ family: 'Inter', style: 'Bold' }),
    figma.loadFontAsync({ family: 'Inter', style: 'Medium' }),
    figma.loadFontAsync({ family: 'Inter', style: 'Regular' }),
  ]);

  // Create a frame to hold the template
  const frame = figma.createFrame();
  frame.name = (customData && customData.title) || template.title;
  frame.x = x;
  frame.y = y;
  frame.resize(400, 300);
  // Transparent background with slight tint for visibility
  frame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, opacity: 0.85 }];
  frame.strokes = [{ type: 'SOLID', color: { r: 0.8, g: 0.8, b: 0.8 } }];
  frame.cornerRadius = 8;

  // Add icon shape based on template type (right-justified)
  const iconSize = 32;
  const iconX = 400 - 20 - iconSize;
  let iconShape: SceneNode;

  if (templateType === 'milestone') {
    const diamond = figma.createPolygon();
    diamond.resize(iconSize, iconSize);
    diamond.pointCount = 4;
    diamond.fills = [{ type: 'SOLID', color: { r: 0.85, g: 0.2, b: 0.2 } }];
    diamond.x = iconX;
    diamond.y = 20;
    iconShape = diamond;
  } else if (templateType === 'userStory') {
    const ellipse = figma.createEllipse();
    ellipse.resize(iconSize, iconSize);
    ellipse.fills = [{ type: 'SOLID', color: { r: 0.2, g: 0.5, b: 0.9 } }];
    ellipse.x = iconX;
    ellipse.y = 20;
    iconShape = ellipse;
  } else if (templateType === 'epic') {
    const polygon = figma.createPolygon();
    polygon.resize(iconSize, iconSize);
    polygon.pointCount = 3;
    polygon.fills = [{ type: 'SOLID', color: { r: 0.9, g: 0.6, b: 0.1 } }];
    polygon.x = iconX;
    polygon.y = 20;
    iconShape = polygon;
  } else {
    const rect = figma.createRectangle();
    rect.resize(iconSize, iconSize);
    rect.fills = [{ type: 'SOLID', color: { r: 0.3, g: 0.7, b: 0.3 } }];
    rect.cornerRadius = 4;
    rect.x = iconX;
    rect.y = 20;
    iconShape = rect;
  }

  frame.appendChild(iconShape);

  // Add title text (left side)
  const titleText = figma.createText();
  titleText.characters = (customData && customData.title) || template.title;
  titleText.fontSize = 24;
  titleText.fills = [{ type: 'SOLID', color: { r: 0.2, g: 0.2, b: 0.2 } }];
  titleText.x = 20;
  titleText.y = 20;
  frame.appendChild(titleText);

  // Add fields
  let yOffset = 60;
  for (const field of template.fields) {
    const fieldValue =
      customData && customData[field.label]
        ? customData[field.label]
        : field.value;

    const labelText = figma.createText();
    labelText.characters = field.label + ':';
    labelText.fontSize = 12;
    labelText.fills = [{ type: 'SOLID', color: { r: 0.4, g: 0.4, b: 0.4 } }];
    labelText.x = 20;
    labelText.y = yOffset;
    frame.appendChild(labelText);

    const valueText = figma.createText();
    valueText.characters = fieldValue;
    valueText.fontSize = 14;
    valueText.fills = [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1 } }];
    valueText.x = 20;
    valueText.y = yOffset + 20;
    valueText.resize(360, valueText.height);
    frame.appendChild(valueText);

    yOffset += valueText.height + 40;
  }

  // Resize frame to fit content
  frame.resize(400, yOffset + 20);

  // Add to current page
  figma.currentPage.appendChild(frame);

  return frame;
}

// Function to import cards from CSV
async function importCardsFromCSV(csvText: string) {
  const issues = parseCSV(csvText);
  if (issues.length === 0) {
    figma.notify('❌ No data found in CSV file');
    return;
  }

  // Log for debugging
  console.log(`Parsed ${issues.length} rows from CSV`);

  const viewport = figma.viewport.center;
  let xOffset = 0;
  let yOffset = 0;
  const cardWidth = 450;
  const cardHeight = 400;
  const spacing = 50;
  const cardsPerRow = 3;

  let created = 0;
  let skipped = 0;
  const createdFrames: FrameNode[] = [];

  // Process each row exactly once
  for (let i = 0; i < issues.length; i++) {
    const issue = issues[i];

    // Skip if no summary (likely empty/invalid row)
    if (!issue['Summary'] || issue['Summary'].trim() === '') {
      skipped++;
      continue;
    }

    const mapped = mapJiraIssueToTemplate(issue);
    if (!mapped) {
      skipped++;
      continue;
    }

    try {
      // Position cards in a grid
      const x = viewport.x + xOffset;
      const y = viewport.y + yOffset;

      // Create card with custom position
      const frame = await createTemplateCardWithPosition(
        mapped.templateType,
        mapped.data,
        x,
        y
      );
      createdFrames.push(frame);

      // Update position for next card
      xOffset += cardWidth + spacing;
      if (xOffset >= (cardWidth + spacing) * cardsPerRow) {
        // New row
        xOffset = 0;
        yOffset += cardHeight + spacing;
      }

      created++;
    } catch (error) {
      skipped++;
      console.error('Error creating card:', error);
    }
  }

  // Scroll to show all created cards
  if (createdFrames.length > 0) {
    figma.viewport.scrollAndZoomIntoView(createdFrames);
  }

  figma.notify(
    `✅ Created ${created} card(s)${skipped > 0 ? `, skipped ${skipped}` : ''}`
  );
}

// Set up message handler once
figma.ui.onmessage = async (msg: {
  type: string;
  templateType?: keyof typeof TEMPLATES;
  csvText?: string;
}) => {
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
      figma.notify(`❌ Error inserting template: ${error}`);
    }
  }

  if (msg.type === 'import-csv') {
    if (!msg.csvText) {
      figma.notify('❌ No CSV data provided');
      return;
    }
    await importCardsFromCSV(msg.csvText);
  }

  if (msg.type === 'close') {
    figma.closePlugin();
  }
};

// Show the UI panel
figma.showUI(__html__, {
  width: 300,
  height: 500,
  themeColors: true,
});
