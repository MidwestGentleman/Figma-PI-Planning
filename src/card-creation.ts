/// <reference types="@figma/plugin-typings" />

import { TEMPLATES } from './templates';
import {
  CARD_CONFIG,
  COLOR_CONFIG,
} from './config';
import {
  ensureFontsLoaded,
  validateTemplateType,
  validateCoordinate,
  sanitizeFieldValue,
  getLargeNumberField,
  getTemplateBackgroundColor,
  shouldUseLightText,
  hasAssigneeField,
  hasStatusField,
  wrapTitleText,
  truncateAssignee,
} from './utils';
import { logger } from './logger';

/**
 * Creates an icon shape based on template type.
 * @param isBug - If true, creates a bug icon (X shape) with red color
 * @param originalIssueType - Original issue type for custom icon styling (security, internal, subtestexecution)
 */
function createIconShape(
  templateType: keyof typeof TEMPLATES,
  iconX: number,
  iconY: number,
  isBug: boolean = false,
  originalIssueType?: string
): SceneNode {
  const iconSize = CARD_CONFIG.ICON_SIZE;
  let iconShape: SceneNode;

  // Bug icon: Simple X text in light red
  if (isBug) {
    const bugText = figma.createText();
    bugText.characters = 'X';
    bugText.fontSize = iconSize * 0.95; // Larger X icon for better visibility
    try {
      bugText.fontName = { family: 'Inter', style: 'Bold' };
    } catch (e) {
      // Fallback if font not available
    }
    bugText.fills = [{ type: 'SOLID', color: { r: 0.9, g: 0.4, b: 0.4 } }];
    bugText.x = iconX + iconSize - bugText.width;
    bugText.y = iconY + (iconSize - bugText.height) / 2;
    iconShape = bugText;
  } else if (originalIssueType === 'security') {
    // Security icon: Padlock emoji or text
    const securityText = figma.createText();
    securityText.characters = '🔒';
    securityText.fontSize = iconSize * 0.8;
    try {
      securityText.fontName = { family: 'Inter', style: 'Regular' };
    } catch (e) {
      // Fallback if font not available
    }
    securityText.fills = [{ type: 'SOLID', color: { r: 0.13, g: 0.55, b: 0.13 } }];
    securityText.x = iconX + iconSize - securityText.width;
    securityText.y = iconY + (iconSize - securityText.height) / 2;
    iconShape = securityText;
  } else if (originalIssueType === 'internal') {
    // Internal icon: Heart emoji or text
    const internalText = figma.createText();
    internalText.characters = '❤';
    internalText.fontSize = iconSize * 0.8;
    try {
      internalText.fontName = { family: 'Inter', style: 'Regular' };
    } catch (e) {
      // Fallback if font not available
    }
    internalText.fills = [{ type: 'SOLID', color: { r: 0.13, g: 0.55, b: 0.13 } }];
    internalText.x = iconX + iconSize - internalText.width;
    internalText.y = iconY + (iconSize - internalText.height) / 2;
    iconShape = internalText;
  } else if (originalIssueType === 'subtestexecution') {
    // Sub Test Execution icon: ">>" text (similar to bug "X")
    const subTestText = figma.createText();
    subTestText.characters = '>>';
    subTestText.fontSize = iconSize * 0.7;
    try {
      subTestText.fontName = { family: 'Inter', style: 'Bold' };
    } catch (e) {
      // Fallback if font not available
    }
    subTestText.fills = [{ type: 'SOLID', color: { r: 0.2, g: 0.5, b: 0.9 } }];
    subTestText.x = iconX + iconSize - subTestText.width;
    subTestText.y = iconY + (iconSize - subTestText.height) / 2;
    iconShape = subTestText;
  } else if (templateType === 'theme') {
    const rect = figma.createRectangle();
    rect.resize(iconSize * 1.5, iconSize * 0.6);
    rect.fills = [{ type: 'SOLID', color: { r: 0.4, g: 0.2, b: 0.6 } }];
    rect.cornerRadius = 2;
    rect.x = iconX - iconSize * 0.25;
    rect.y = iconY + (iconSize - rect.height) / 2;
    iconShape = rect;
  } else if (templateType === 'milestone') {
    const diamond = figma.createPolygon();
    diamond.resize(iconSize, iconSize);
    diamond.pointCount = 4;
    diamond.fills = [{ type: 'SOLID', color: { r: 0.3, g: 0.7, b: 0.3 } }];
    diamond.x = iconX;
    diamond.y = iconY;
    iconShape = diamond;
  } else if (templateType === 'userStory') {
    const rect = figma.createRectangle();
    rect.resize(iconSize, iconSize);
    rect.fills = [{ type: 'SOLID', color: { r: 1.0, g: 0.8, b: 0.6 } }];
    rect.cornerRadius = 4;
    rect.x = iconX;
    rect.y = iconY;
    iconShape = rect;
  } else if (templateType === 'epic') {
    const ellipse = figma.createEllipse();
    ellipse.resize(iconSize, iconSize);
    ellipse.fills = [{ type: 'SOLID', color: { r: 0.2, g: 0.5, b: 0.9 } }];
    ellipse.x = iconX;
    ellipse.y = iconY;
    iconShape = ellipse;
  } else if (templateType === 'initiative') {
    const polygon = figma.createPolygon();
    polygon.resize(iconSize, iconSize);
    polygon.pointCount = 3;
    polygon.fills = [{ type: 'SOLID', color: { r: 0.9, g: 0.6, b: 0.1 } }];
    polygon.x = iconX;
    polygon.y = iconY;
    iconShape = polygon;
  } else if (templateType === 'task') {
    const rect = figma.createRectangle();
    rect.resize(iconSize, iconSize);
    rect.fills = [{ type: 'SOLID', color: { r: 0.13, g: 0.55, b: 0.13 } }];
    rect.cornerRadius = 4;
    rect.x = iconX;
    rect.y = iconY;
    iconShape = rect;
  } else if (templateType === 'spike') {
    const star = figma.createStar();
    star.resize(iconSize, iconSize);
    star.pointCount = 8;
    star.fills = [{ type: 'SOLID', color: { r: 0.7, g: 0.6, b: 0.4 } }];
    star.x = iconX;
    star.y = iconY;
    iconShape = star;
  } else if (templateType === 'test') {
    const diamond = figma.createPolygon();
    diamond.resize(iconSize, iconSize);
    diamond.pointCount = 4;
    diamond.fills = [{ type: 'SOLID', color: { r: 0.2, g: 0.5, b: 0.9 } }];
    diamond.x = iconX;
    diamond.y = iconY;
    iconShape = diamond;
  } else {
    const rect = figma.createRectangle();
    rect.resize(iconSize, iconSize);
    rect.fills = [{ type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5 } }];
    rect.cornerRadius = 4;
    rect.x = iconX;
    rect.y = iconY;
    iconShape = rect;
  }

  return iconShape;
}

/**
 * Creates a simplified epic label card with only Title, icon, Status, and Priority Rank.
 * This is used as a continuation label in sprints after the first one.
 * @param title - The epic title
 * @param status - The epic status
 * @param priorityRank - The epic priority rank
 * @param issueKey - Optional issue key for hyperlink
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param jiraBaseUrl - Optional Jira base URL for hyperlink
 */
export async function createEpicLabelCard(
  title: string,
  status: string,
  priorityRank: string,
  issueKey?: string,
  x?: number,
  y?: number,
  jiraBaseUrl?: string
): Promise<FrameNode> {
  validateCoordinate(x, 'x');
  validateCoordinate(y, 'y');

  await ensureFontsLoaded();

  const viewport = figma.viewport.center;
  const cardX = x !== undefined ? x : viewport.x;
  const cardY = y !== undefined ? y : viewport.y;

  const frame = figma.createFrame();
  frame.name = 'Epic'; // Use same name for consistency
  frame.x = cardX;
  frame.y = cardY;

  // Mark this as a label card (not for export)
  frame.setPluginData('isEpicLabel', 'true');
  frame.setPluginData('templateType', 'Epic');

  if (issueKey) {
    frame.setPluginData(
      'issueKey',
      sanitizeFieldValue(issueKey, 100)
    );
  }

  const cardWidth = CARD_CONFIG.WIDTH;
  frame.resize(cardWidth, CARD_CONFIG.DEFAULT_HEIGHT);

  const backgroundColor = getTemplateBackgroundColor('epic');
  frame.fills = [
    {
      type: 'SOLID',
      color: backgroundColor,
      opacity: CARD_CONFIG.BACKGROUND_OPACITY,
    },
  ];

  // Force black text for epic labels (same as epic cards)
  const useLightText = false;

  if (figma.editorType === 'figjam') {
    frame.strokes = [
      {
        type: 'SOLID',
        color: {
          r: COLOR_CONFIG.FIGJAM_BORDER.r,
          g: COLOR_CONFIG.FIGJAM_BORDER.g,
          b: COLOR_CONFIG.FIGJAM_BORDER.b,
        },
        opacity: COLOR_CONFIG.FIGJAM_BORDER.opacity,
      },
    ];
    frame.strokeWeight = COLOR_CONFIG.BORDER_WEIGHT;
  } else {
    frame.strokes = [
      {
        type: 'SOLID',
        color: {
          r: COLOR_CONFIG.FIGMA_BORDER.r,
          g: COLOR_CONFIG.FIGMA_BORDER.g,
          b: COLOR_CONFIG.FIGMA_BORDER.b,
        },
      },
    ];
  }
  frame.cornerRadius = CARD_CONFIG.BORDER_RADIUS;
  frame.locked = false;

  const iconSize = CARD_CONFIG.ICON_SIZE;
  const iconX = cardWidth - CARD_CONFIG.PADDING - iconSize;
  const iconY = CARD_CONFIG.PADDING;
  const iconShape = createIconShape('epic', iconX, iconY, false);
  frame.appendChild(iconShape);

  const titleText = figma.createText();
  const titleContent = sanitizeFieldValue(title);
  // Don't pre-wrap - let Figma handle wrapping based on actual width
  titleText.characters = titleContent;
  titleText.fontSize = CARD_CONFIG.TITLE_FONT_SIZE;
  try {
    titleText.fontName = { family: 'Inter', style: 'Bold' };
  } catch (e) {
    logger.warn('Could not set Bold font for title, using default');
  }
  titleText.fills = [
    {
      type: 'SOLID',
      color: useLightText ? COLOR_CONFIG.TEXT_LIGHT : COLOR_CONFIG.TEXT_DARK,
    },
  ];
  titleText.x = CARD_CONFIG.PADDING;
  titleText.y = CARD_CONFIG.PADDING;
  // Ensure title doesn't overlap icon: cardWidth - left padding - icon size - right padding - spacing
  const iconSpace = CARD_CONFIG.ICON_SIZE + CARD_CONFIG.PADDING; // icon + spacing
  const maxTitleWidth = cardWidth - CARD_CONFIG.PADDING - iconSpace;
  
  frame.appendChild(titleText);
  
  // Set width with large initial height to allow wrapping
  // We'll read the actual height after Figma wraps the text
  titleText.resize(maxTitleWidth, 2000);

  // Calculate title height using accurate word-wrapping algorithm
  // Figma's height property may not accurately reflect wrapped content
  // So we calculate it ourselves based on actual word wrapping
  const lineHeight = CARD_CONFIG.TITLE_FONT_SIZE * 1.2; // Standard line height
  const avgCharWidth = CARD_CONFIG.TITLE_FONT_SIZE * 0.55; // Average char width for Bold Inter
  
  // Word-wrap the text manually to get accurate line count
  const words = titleContent.split(/\s+/);
  let currentLine = '';
  let lineCount = 1;
  
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = testLine.length * avgCharWidth;
    
    if (testWidth > maxTitleWidth && currentLine) {
      lineCount++;
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  
  const titleHeight = lineCount * lineHeight;
  titleText.resize(maxTitleWidth, titleHeight);
  
  // Set hyperlink after all text operations complete
  const epicIssueKey = issueKey;
  if (epicIssueKey && epicIssueKey.trim() !== '' && jiraBaseUrl && jiraBaseUrl.trim() !== '') {
    try {
      let baseUrl = jiraBaseUrl.trim().replace(/\/$/, '');
      if (!baseUrl.match(/^https?:\/\//i)) {
        baseUrl = `https://${baseUrl}`;
      }
      const url = `${baseUrl}/browse/${epicIssueKey.trim()}`;
      titleText.setRangeHyperlink(0, titleText.characters.length, {
        type: 'URL',
        value: url,
      });
    } catch (e) {
      logger.error('Could not set hyperlink on epic label title', e instanceof Error ? e : new Error(String(e)));
      // Don't throw - continue with card creation even if hyperlink fails
    }
  }
  
  const bottomPadding = CARD_CONFIG.PADDING;
  const bottomY = titleHeight + CARD_CONFIG.PADDING + bottomPadding;

  // Add Priority Rank (large number at bottom right)
  const priorityRankValue = priorityRank || '#';
  const largeNumberText = figma.createText();
  largeNumberText.characters = priorityRankValue;
  largeNumberText.fontSize = CARD_CONFIG.TITLE_FONT_SIZE;
  try {
    largeNumberText.fontName = { family: 'Inter', style: 'Bold' };
  } catch (e) {
    logger.warn('Could not set Bold font for priority rank, using default');
  }
  largeNumberText.fills = [
    {
      type: 'SOLID',
      color: useLightText ? COLOR_CONFIG.TEXT_LIGHT : COLOR_CONFIG.TEXT_DARK,
    },
  ];
  frame.appendChild(largeNumberText);

  const iconRightEdge = iconX + iconSize;
  largeNumberText.x = iconRightEdge - largeNumberText.width;
  largeNumberText.y = bottomY;

  // Add Status (large text at bottom left)
  const statusValue = status || 'Open';
  const statusText = figma.createText();
  statusText.characters = sanitizeFieldValue(statusValue);
  statusText.fontSize = CARD_CONFIG.TITLE_FONT_SIZE;
  try {
    statusText.fontName = { family: 'Inter', style: 'Bold' };
  } catch (e) {
    logger.warn('Could not set Bold font for status, using default');
  }
  statusText.fills = [
    {
      type: 'SOLID',
      color: useLightText
        ? COLOR_CONFIG.TEXT_LIGHT
        : COLOR_CONFIG.TEXT_DARK,
    },
  ];
  frame.appendChild(statusText);

  statusText.x = CARD_CONFIG.PADDING;
  statusText.y = bottomY;

  const finalHeight = Math.max(
    bottomY + largeNumberText.height + bottomPadding,
    bottomY + statusText.height + bottomPadding
  );

  frame.resize(cardWidth, finalHeight);
  figma.currentPage.appendChild(frame);

  return frame;
}

/**
 * Creates a template card at the specified position in the FigJam canvas.
 */
export async function createTemplateCardWithPosition(
  templateType: keyof typeof TEMPLATES,
  customData?: { [key: string]: string },
  x?: number,
  y?: number,
  jiraBaseUrl?: string,
  importVerbose: boolean = false
): Promise<FrameNode> {
  validateTemplateType(templateType);
  validateCoordinate(x, 'x');
  validateCoordinate(y, 'y');

  const template = TEMPLATES[templateType];
  await ensureFontsLoaded();

  const viewport = figma.viewport.center;
  const cardX = x !== undefined ? x : viewport.x;
  const cardY = y !== undefined ? y : viewport.y;

  const frame = figma.createFrame();
  // Always use template.title (template type name) for frame.name to ensure
  // imported cards can be found during export. The card title is stored in the
  // first text node, not in the frame name.
  frame.name = template.title;
  frame.x = cardX;
  frame.y = cardY;

  // Store template type display name in plugin data for reliable identification during export
  // This matches the frame.name and what we check against in extractCardData
  frame.setPluginData('templateType', template.title);

  if (customData && customData.issueKey) {
    frame.setPluginData(
      'issueKey',
      sanitizeFieldValue(customData.issueKey, 100)
    );
  }
  
  // Store original issue type if provided (for bug styling, etc.)
  if (customData && customData.originalIssueType) {
    frame.setPluginData(
      'originalIssueType',
      sanitizeFieldValue(customData.originalIssueType, 50)
    );
  }
  
  // Store Description and Acceptance Criteria in plugin data for export
  // This ensures they're preserved even when not displayed in non-verbose mode
  if (customData && customData['Description']) {
    frame.setPluginData('storedDescription', sanitizeFieldValue(customData['Description']));
  }
  if (customData && customData['Acceptance Criteria']) {
    frame.setPluginData('storedAcceptanceCriteria', sanitizeFieldValue(customData['Acceptance Criteria']));
  }

  const cardWidth = CARD_CONFIG.WIDTH;
  frame.resize(cardWidth, CARD_CONFIG.DEFAULT_HEIGHT);

  // Check if this is a bug (stored in customData or will be in plugin data)
  const isBug = customData && customData.originalIssueType === 'bug';
  const originalIssueType = customData && customData.originalIssueType;
  const backgroundColor = isBug
    ? { r: 0.9, g: 0.4, b: 0.4 } // Light red for bugs
    : getTemplateBackgroundColor(templateType);
  frame.fills = [
    {
      type: 'SOLID',
      color: backgroundColor,
      opacity: CARD_CONFIG.BACKGROUND_OPACITY,
    },
  ];

  const forceBlackText =
    templateType === 'test' ||
    templateType === 'theme' ||
    templateType === 'epic' ||
    templateType === 'spike' ||
    templateType === 'task';
  const useLightText = forceBlackText
    ? false
    : shouldUseLightText(backgroundColor);

  if (figma.editorType === 'figjam') {
    frame.strokes = [
      {
        type: 'SOLID',
        color: {
          r: COLOR_CONFIG.FIGJAM_BORDER.r,
          g: COLOR_CONFIG.FIGJAM_BORDER.g,
          b: COLOR_CONFIG.FIGJAM_BORDER.b,
        },
        opacity: COLOR_CONFIG.FIGJAM_BORDER.opacity,
      },
    ];
    frame.strokeWeight = COLOR_CONFIG.BORDER_WEIGHT;
  } else {
    frame.strokes = [
      {
        type: 'SOLID',
        color: {
          r: COLOR_CONFIG.FIGMA_BORDER.r,
          g: COLOR_CONFIG.FIGMA_BORDER.g,
          b: COLOR_CONFIG.FIGMA_BORDER.b,
        },
      },
    ];
  }
  frame.cornerRadius = CARD_CONFIG.BORDER_RADIUS;
  frame.locked = false;

  const iconSize = CARD_CONFIG.ICON_SIZE;
  const iconX = cardWidth - CARD_CONFIG.PADDING - iconSize;
  const iconY = CARD_CONFIG.PADDING;
  // Use the isBug variable and originalIssueType for icon styling
  const iconShape = createIconShape(templateType, iconX, iconY, isBug, originalIssueType);
  frame.appendChild(iconShape);

  const titleText = figma.createText();
  let titleContent = sanitizeFieldValue(
    (customData && customData.title) || template.title
  );
  
  // Append issue key to title with pipe separator if it exists
  if (customData && customData.issueKey && customData.issueKey.trim() !== '') {
    titleContent = `${titleContent} | ${customData.issueKey.trim()}`;
  }
  
  // Don't pre-wrap - let Figma handle wrapping based on actual width
  titleText.characters = titleContent;
  titleText.fontSize = CARD_CONFIG.TITLE_FONT_SIZE;
  try {
    titleText.fontName = { family: 'Inter', style: 'Bold' };
  } catch (e) {
    logger.warn('Could not set Bold font for title, using default');
  }
  titleText.fills = [
    {
      type: 'SOLID',
      color: useLightText ? COLOR_CONFIG.TEXT_LIGHT : COLOR_CONFIG.TEXT_DARK,
    },
  ];
  titleText.x = CARD_CONFIG.PADDING;
  titleText.y = CARD_CONFIG.PADDING;
  // Ensure title doesn't overlap icon: cardWidth - left padding - icon size - right padding - spacing
  const iconSpace = CARD_CONFIG.ICON_SIZE + CARD_CONFIG.PADDING; // icon + spacing
  const maxTitleWidth = cardWidth - CARD_CONFIG.PADDING - iconSpace;
  
  frame.appendChild(titleText);
  
  // Set width with large initial height to allow wrapping
  // We'll read the actual height after Figma wraps the text
  titleText.resize(maxTitleWidth, 2000);
  
  // Calculate title height using accurate word-wrapping algorithm
  // Figma's height property may not accurately reflect wrapped content
  // So we calculate it ourselves based on actual word wrapping
  const lineHeight = CARD_CONFIG.TITLE_FONT_SIZE * 1.2; // Standard line height
  const avgCharWidth = CARD_CONFIG.TITLE_FONT_SIZE * 0.55; // Average char width for Bold Inter
  
  // Word-wrap the text manually to get accurate line count
  const words = titleContent.split(/\s+/);
  let currentLine = '';
  let lineCount = 1;
  
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = testLine.length * avgCharWidth;
    
    if (testWidth > maxTitleWidth && currentLine) {
      lineCount++;
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  
  const titleHeight = lineCount * lineHeight;
  titleText.resize(maxTitleWidth, titleHeight);
  
  // Set hyperlink after all text operations complete
  const issueKey = customData && customData.issueKey;
  logger.debug('Hyperlink check', { issueKey, jiraBaseUrl: jiraBaseUrl ? 'provided' : 'not provided' });
  if (issueKey && issueKey.trim() !== '' && jiraBaseUrl && jiraBaseUrl.trim() !== '') {
    try {
      let baseUrl = jiraBaseUrl.trim().replace(/\/$/, '');
      if (!baseUrl.match(/^https?:\/\//i)) {
        baseUrl = `https://${baseUrl}`;
      }
      const url = `${baseUrl}/browse/${issueKey.trim()}`;
      const fullTextLength = titleText.characters.length;
      
      titleText.setRangeHyperlink(0, fullTextLength, {
        type: 'URL',
        value: url,
      });
      
    } catch (e) {
      logger.error('Could not set hyperlink on title', e instanceof Error ? e : new Error(String(e)), { issueKey });
      // Don't throw - continue with card creation even if hyperlink fails
    }
  }

  let fieldsToShow: Array<{ label: string; value: string }> = [...template.fields];
  
  // For imported cards (customData exists), filter out template-specific fields
  // "As a", "I want", "So that" should only appear for manually created user stories
  // "Given", "When", "Then" should only appear for manually created test cards
  if (customData) {
    if (templateType === 'userStory') {
      // For imported user stories, remove "As a", "I want", "So that" fields
      fieldsToShow = fieldsToShow.filter(
        (f) => f.label !== 'As a' && f.label !== 'I want' && f.label !== 'So that'
      );
      // Only add Description if importVerbose is true
      if (importVerbose && customData['Description']) {
        const descriptionValue = customData['Description'];
        fieldsToShow = [{ label: 'Description', value: descriptionValue }].concat(fieldsToShow);
      }
    } else if (templateType === 'test') {
      // For imported test cards, remove "Given", "When", "Then" fields
      fieldsToShow = fieldsToShow.filter(
        (f) => f.label !== 'Given' && f.label !== 'When' && f.label !== 'Then'
      );
      // Only add Description if importVerbose is true
      if (importVerbose && customData['Description']) {
        const descriptionValue = customData['Description'];
        fieldsToShow = [{ label: 'Description', value: descriptionValue }].concat(fieldsToShow);
      }
    } else {
      // For other template types, only add Description if importVerbose is true
      if (importVerbose && customData['Description']) {
        const descriptionValue = customData['Description'];
        // Add Description at the beginning if it doesn't already exist
        const hasDescription = fieldsToShow.some(f => f.label === 'Description');
        if (!hasDescription) {
          fieldsToShow = [{ label: 'Description', value: descriptionValue }].concat(fieldsToShow);
        } else {
          // Replace existing Description
          const descIndex = fieldsToShow.findIndex(f => f.label === 'Description');
          if (descIndex !== -1) {
            fieldsToShow[descIndex] = { label: 'Description', value: descriptionValue };
          }
        }
      }
    }
  }

  const largeNumberField = getLargeNumberField(templateType);
  const fieldsToDisplay = fieldsToShow.filter(
    (f) => {
      // Always exclude large number field, Assignee, and Status
      if (largeNumberField && f.label === largeNumberField) return false;
      if (f.label === 'Assignee') return false;
      if (f.label === 'Status') return false;
      
      // In non-verbose mode, hide Description and Acceptance Criteria
      if (!importVerbose) {
        if (f.label === 'Description' || f.label === 'Acceptance Criteria') {
          return false;
        }
      }
      
      return true;
    }
  );
  
  // Card creation in progress

  let yOffset = CARD_CONFIG.PADDING + titleHeight + CARD_CONFIG.PADDING;
  for (const field of fieldsToDisplay) {
    const fieldValue = sanitizeFieldValue(
      customData && customData[field.label] ? customData[field.label] : field.value
    );

    const labelText = figma.createText();
    labelText.characters = field.label + ':';
    labelText.fontSize = CARD_CONFIG.LABEL_FONT_SIZE;
    labelText.fills = [
      {
        type: 'SOLID',
        color: useLightText
          ? COLOR_CONFIG.TEXT_LABEL_LIGHT
          : COLOR_CONFIG.TEXT_LABEL_DARK,
      },
    ];
    labelText.x = CARD_CONFIG.PADDING;
    labelText.y = yOffset;
    frame.appendChild(labelText);

    const valueText = figma.createText();
    valueText.characters = fieldValue;
    valueText.fontSize = CARD_CONFIG.FIELD_FONT_SIZE;
    valueText.fills = [
      {
        type: 'SOLID',
        color: useLightText
          ? COLOR_CONFIG.TEXT_LIGHT
          : COLOR_CONFIG.TEXT_VALUE_DARK,
      },
    ];
    valueText.x = CARD_CONFIG.PADDING;
    valueText.y = yOffset + CARD_CONFIG.PADDING;
    valueText.resize(cardWidth - CARD_CONFIG.PADDING * 2, valueText.height);
    frame.appendChild(valueText);

    yOffset += valueText.height + CARD_CONFIG.PADDING * 2;
  }

  const bottomPadding = CARD_CONFIG.PADDING;
  const bottomY = yOffset + bottomPadding;

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

  if (largeNumberField && largeNumberValue) {
    const largeNumberText = figma.createText();
    largeNumberText.characters = largeNumberValue;
    largeNumberText.fontSize = CARD_CONFIG.TITLE_FONT_SIZE;
    try {
      largeNumberText.fontName = { family: 'Inter', style: 'Bold' };
    } catch (e) {
      logger.warn('Could not set Bold font for number, using default');
    }
    largeNumberText.fills = [
      {
        type: 'SOLID',
        color: useLightText ? COLOR_CONFIG.TEXT_LIGHT : COLOR_CONFIG.TEXT_DARK,
      },
    ];
    frame.appendChild(largeNumberText);

    const iconRightEdge = iconX + iconSize;
    largeNumberText.x = iconRightEdge - largeNumberText.width;
    largeNumberText.y = bottomY;

    yOffset = bottomY + largeNumberText.height + bottomPadding;
  } else {
    yOffset += bottomPadding;
  }

  if (hasAssigneeField(templateType)) {
    const assigneeField = template.fields.find((f) => f.label === 'Assignee');
    const assigneeValue =
      (customData && customData['Assignee']) ||
      (assigneeField && assigneeField.value) ||
      'Unassigned';

    if (assigneeValue) {
      const assigneeText = figma.createText();
      // Truncate assignee if it's an email longer than 25 characters
      const truncatedAssignee = truncateAssignee(assigneeValue);
      assigneeText.characters = sanitizeFieldValue(truncatedAssignee);
      assigneeText.fontSize = CARD_CONFIG.TITLE_FONT_SIZE;
      try {
        assigneeText.fontName = { family: 'Inter', style: 'Bold' };
      } catch (e) {
        logger.warn('Could not set Bold font for assignee, using default');
      }
      assigneeText.fills = [
        {
          type: 'SOLID',
          color: useLightText
            ? COLOR_CONFIG.TEXT_LIGHT
            : COLOR_CONFIG.TEXT_DARK,
        },
      ];
      frame.appendChild(assigneeText);

      assigneeText.x = CARD_CONFIG.PADDING;
      assigneeText.y = bottomY;

      yOffset = Math.max(
        yOffset,
        bottomY + assigneeText.height + bottomPadding
      );
    }
  }

  if (hasStatusField(templateType)) {
    const statusValue =
      (customData && customData['Status']) || 'Open';

    if (statusValue) {
      const statusText = figma.createText();
      statusText.characters = sanitizeFieldValue(statusValue);
      statusText.fontSize = CARD_CONFIG.TITLE_FONT_SIZE;
      try {
        statusText.fontName = { family: 'Inter', style: 'Bold' };
      } catch (e) {
        logger.warn('Could not set Bold font for status, using default');
      }
      statusText.fills = [
        {
          type: 'SOLID',
          color: useLightText
            ? COLOR_CONFIG.TEXT_LIGHT
            : COLOR_CONFIG.TEXT_DARK,
        },
      ];
      frame.appendChild(statusText);

      statusText.x = CARD_CONFIG.PADDING;
      statusText.y = bottomY;

      yOffset = Math.max(
        yOffset,
        bottomY + statusText.height + bottomPadding
      );
    }
  }

  frame.resize(cardWidth, yOffset);
  figma.currentPage.appendChild(frame);

  return frame;
}

/**
 * Creates a template card at the viewport center with selection and scroll behavior.
 */
export async function createTemplateCard(
  templateType: keyof typeof TEMPLATES,
  customData?: { [key: string]: string }
): Promise<FrameNode> {
  validateTemplateType(templateType);

  const frame = await createTemplateCardWithPosition(templateType, customData);

  figma.currentPage.selection = [frame];
  figma.viewport.scrollAndZoomIntoView([frame]);

  return frame;
}
