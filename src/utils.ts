/// <reference types="@figma/plugin-typings" />

import { TEMPLATES } from './templates';
import { VALIDATION_CONFIG, BOUNDARY_DETECTION_CONFIG } from './config';
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

/**
 * Team boundary information for position-based assignment
 */
export interface TeamBoundary {
  teamName: string;
  topY: number;
  bottomY: number;
}

/**
 * Sprint column boundary information for position-based assignment
 */
export interface SprintBoundary {
  sprintName: string;
  leftX: number;
  rightX: number;
}

/**
 * Detects team swimlane boundaries by analyzing card positions on the canvas.
 * Groups cards by their Y positions to identify horizontal swimlanes (teams).
 * 
 * @returns Array of team boundaries sorted by Y position (top to bottom)
 */
export function detectTeamBoundaries(): TeamBoundary[] {
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

  // Find all card frames
  const allFrames = figma.currentPage.findAll(
    (node) => node.type === 'FRAME'
  ) as FrameNode[];

  const cardFrames = allFrames.filter((frame) => {
    // Skip epic label cards
    const isEpicLabel = frame.getPluginData('isEpicLabel') === 'true';
    if (isEpicLabel) {
      return false;
    }

    // Check if it's a template card
    if (templateNames.has(frame.name)) {
      return true;
    }

    const templateType = frame.getPluginData('templateType');
    if (templateType && templateNames.has(templateType)) {
      return true;
    }

    // Check for issueKey (imported card)
    const issueKey = frame.getPluginData('issueKey');
    if (issueKey && issueKey.trim() !== '') {
      return true;
    }

    return false;
  });

  if (cardFrames.length === 0) {
    return [];
  }

  const sortedCards = [...cardFrames].sort((a, b) => a.y - b.y);
  const TEAM_CLUSTER_TOLERANCE = BOUNDARY_DETECTION_CONFIG.TEAM_CLUSTER_TOLERANCE;
  const teams: TeamBoundary[] = [];
  let currentTeamCards: FrameNode[] = [];
  let currentTeamTop = sortedCards[0].y;
  let currentTeamBottom = sortedCards[0].y + sortedCards[0].height;

  for (let i = 0; i < sortedCards.length; i++) {
    const card = sortedCards[i];
    const cardTop = card.y;
    const cardBottom = card.y + card.height;

    const isInCurrentTeam =
      cardTop <= currentTeamBottom + TEAM_CLUSTER_TOLERANCE &&
      cardBottom >= currentTeamTop - TEAM_CLUSTER_TOLERANCE;

    if (isInCurrentTeam && currentTeamCards.length > 0) {
      currentTeamCards.push(card);
      currentTeamTop = Math.min(currentTeamTop, cardTop);
      currentTeamBottom = Math.max(currentTeamBottom, cardBottom);
    } else {
      if (currentTeamCards.length > 0) {
        const teamNameCounts: { [name: string]: number } = {};
        for (const teamCard of currentTeamCards) {
          const storedTeam = teamCard.getPluginData('team');
          if (storedTeam && storedTeam.trim() !== '') {
            const teamName = storedTeam.trim();
            teamNameCounts[teamName] = (teamNameCounts[teamName] || 0) + 1;
          }
        }
        
        let teamName = 'Unknown';
        let maxCount = 0;
        for (const [name, count] of Object.entries(teamNameCounts)) {
          if (count > maxCount) {
            maxCount = count;
            teamName = name;
          }
        }
        
        teams.push({
          teamName,
          topY: currentTeamTop,
          bottomY: currentTeamBottom,
        });
      }

      currentTeamCards = [card];
      currentTeamTop = cardTop;
      currentTeamBottom = cardBottom;
    }
  }

  if (currentTeamCards.length > 0) {
    const teamNameCounts: { [name: string]: number } = {};
    for (const teamCard of currentTeamCards) {
      const storedTeam = teamCard.getPluginData('team');
      if (storedTeam && storedTeam.trim() !== '') {
        const teamName = storedTeam.trim();
        teamNameCounts[teamName] = (teamNameCounts[teamName] || 0) + 1;
      }
    }
    
    let teamName = 'Unknown';
    let maxCount = 0;
    for (const [name, count] of Object.entries(teamNameCounts)) {
      if (count > maxCount) {
        maxCount = count;
        teamName = name;
      }
    }
    
    teams.push({
      teamName,
      topY: currentTeamTop,
      bottomY: currentTeamBottom,
    });
  }

  teams.sort((a, b) => a.topY - b.topY);

  return teams;
}

/**
 * Detects sprint column boundaries using horizontal sprint lines and vertical separator boxes.
 * 
 * @returns Array of sprint boundaries sorted by X position (left to right)
 */
export function detectSprintBoundaries(): SprintBoundary[] {
  const allNodes = figma.currentPage.findAll(
    (node) => node.type === 'LINE' || node.type === 'RECTANGLE'
  );

  const horizontalLines: LineNode[] = [];
  const verticalBoxes: RectangleNode[] = [];

  for (const node of allNodes) {
    if (node.type === 'LINE') {
      const line = node as LineNode;
      if (
        line.height < BOUNDARY_DETECTION_CONFIG.HORIZONTAL_LINE_MAX_HEIGHT &&
        line.width > BOUNDARY_DETECTION_CONFIG.HORIZONTAL_LINE_MIN_WIDTH
      ) {
        horizontalLines.push(line);
      }
    } else if (node.type === 'RECTANGLE') {
      const rect = node as RectangleNode;
      if (
        rect.width < BOUNDARY_DETECTION_CONFIG.VERTICAL_BOX_MAX_WIDTH &&
        rect.height > BOUNDARY_DETECTION_CONFIG.VERTICAL_BOX_MIN_HEIGHT
      ) {
        verticalBoxes.push(rect);
      }
    }
  }

  const allTextNodes = figma.currentPage.findAll(
    (node) => node.type === 'TEXT'
  ) as TextNode[];

  const sprintLabels: TextNode[] = [];

  for (const textNode of allTextNodes) {
    const fontSize = textNode.fontSize;
    if (
      typeof fontSize === 'number' &&
      fontSize >= BOUNDARY_DETECTION_CONFIG.SPRINT_LABEL_MIN_FONT_SIZE
    ) {
      const text = textNode.characters.trim();
      if (
        text === 'Backlog' ||
        /^[A-Za-z\s]+ \d{4}-\d{1,2}$/.test(text) ||
        /^\d{4}-\d{1,2}$/.test(text)
      ) {
        sprintLabels.push(textNode);
      }
    }
  }

  if (sprintLabels.length === 0) {
    return [];
  }

  verticalBoxes.sort((a, b) => a.x - b.x);

  const labelsByRow: { [y: number]: TextNode[] } = {};
  for (const label of sprintLabels) {
    const rowKey =
      Math.round(label.y / BOUNDARY_DETECTION_CONFIG.LABEL_ROW_GROUPING_TOLERANCE) *
      BOUNDARY_DETECTION_CONFIG.LABEL_ROW_GROUPING_TOLERANCE;
    if (!labelsByRow[rowKey]) {
      labelsByRow[rowKey] = [];
    }
    labelsByRow[rowKey].push(label);
  }

  const rowKeys = Object.keys(labelsByRow)
    .map(Number)
    .sort((a, b) => a - b);

  if (rowKeys.length === 0) {
    return [];
  }

  const firstRowLabels = labelsByRow[rowKeys[0]].sort((a, b) => a.x - b.x);

  const linesByColumn: { [x: number]: LineNode[] } = {};

  for (const line of horizontalLines) {
    const columnKey =
      Math.round(line.x / BOUNDARY_DETECTION_CONFIG.LINE_COLUMN_TOLERANCE) *
      BOUNDARY_DETECTION_CONFIG.LINE_COLUMN_TOLERANCE;
    if (!linesByColumn[columnKey]) {
      linesByColumn[columnKey] = [];
    }
    linesByColumn[columnKey].push(line);
  }

  // Sort columns by X position
  const sortedColumnKeys = Object.keys(linesByColumn)
    .map(Number)
    .sort((a, b) => a - b);

  const sprints: SprintBoundary[] = [];

  for (let i = 0; i < firstRowLabels.length; i++) {
    const label = firstRowLabels[i];
    const sprintName = label.characters.trim();
    const isBacklog = sprintName === 'Backlog';

    let leftX: number;
    let rightX: number;

    const labelCenterX = label.x + label.width / 2;
    let matchingColumnKey: number | null = null;
    let minDistance = Infinity;

    for (const columnKey of sortedColumnKeys) {
      const distance = Math.abs(columnKey - labelCenterX);
      if (
        distance < minDistance &&
        distance < BOUNDARY_DETECTION_CONFIG.LABEL_TO_COLUMN_MAX_DISTANCE
      ) {
        minDistance = distance;
        matchingColumnKey = columnKey;
      }
    }

    if (matchingColumnKey !== null && linesByColumn[matchingColumnKey]) {
      const columnLines = linesByColumn[matchingColumnKey];
      const lineLefts = columnLines.map(l => l.x).sort((a, b) => a - b);
      const lineRights = columnLines.map(l => l.x + l.width).sort((a, b) => a - b);
      
      if (lineLefts.length > 0 && lineRights.length > 0) {
        leftX = lineLefts[0];
        rightX = lineRights[lineRights.length - 1];
      } else {
        leftX = label.x - BOUNDARY_DETECTION_CONFIG.FALLBACK_BOUNDARY_OFFSET;
        rightX = label.x + BOUNDARY_DETECTION_CONFIG.FALLBACK_BOUNDARY_OFFSET;
      }
    } else {
      if (isBacklog || i === 0) {
        if (verticalBoxes.length > 0) {
          leftX = label.x - BOUNDARY_DETECTION_CONFIG.FALLBACK_BOUNDARY_OFFSET;
          rightX = verticalBoxes[0].x;
        } else {
          leftX = label.x - BOUNDARY_DETECTION_CONFIG.FALLBACK_BOUNDARY_OFFSET;
          rightX = label.x + BOUNDARY_DETECTION_CONFIG.FALLBACK_BOUNDARY_OFFSET;
        }
      } else {
        if (i === 1 && verticalBoxes.length > 0) {
          leftX = verticalBoxes[0].x;
        } else if (i - 1 < verticalBoxes.length && verticalBoxes.length > 0) {
          leftX = verticalBoxes[i - 1].x;
        } else {
          leftX = label.x - BOUNDARY_DETECTION_CONFIG.FALLBACK_BOUNDARY_OFFSET;
        }

        if (i < verticalBoxes.length && verticalBoxes.length > 0) {
          rightX = verticalBoxes[i].x;
        } else {
          rightX =
            label.x + BOUNDARY_DETECTION_CONFIG.FALLBACK_BOUNDARY_OFFSET_LARGE;
        }
      }
    }

    sprints.push({
      sprintName,
      leftX,
      rightX,
    });
  }

  sprints.sort((a, b) => a.leftX - b.leftX);

  return sprints;
}

/**
 * Assigns team and studio to a card based on its vertical position.
 * 
 * @param card - The card frame to assign team for
 * @param teamBoundaries - Optional pre-computed team boundaries
 * @returns The assigned team name, or undefined if no team could be determined
 */
export function assignTeamByPosition(
  card: FrameNode,
  teamBoundaries?: TeamBoundary[]
): string | undefined {
  const boundaries = teamBoundaries || detectTeamBoundaries();
  
  if (boundaries.length === 0) {
    return undefined;
  }

  const cardCenterY = card.y + card.height / 2;
  const cardTopY = card.y;
  const cardBottomY = card.y + card.height;

  for (const boundary of boundaries) {
    if (
      (cardCenterY >= boundary.topY && cardCenterY <= boundary.bottomY) ||
      (cardTopY >= boundary.topY && cardTopY <= boundary.bottomY) ||
      (cardBottomY >= boundary.topY && cardBottomY <= boundary.bottomY) ||
      (cardTopY <= boundary.topY && cardBottomY >= boundary.bottomY)
    ) {
      return boundary.teamName;
    }
  }

  return undefined;
}

/**
 * Assigns sprint to a card based on its horizontal position.
 * 
 * @param card - The card frame to assign sprint for
 * @param sprintBoundaries - Optional pre-computed sprint boundaries
 * @returns The assigned sprint name, or undefined if no sprint could be determined
 */
export function assignSprintByPosition(
  card: FrameNode,
  sprintBoundaries?: SprintBoundary[]
): string | undefined {
  const boundaries = sprintBoundaries || detectSprintBoundaries();
  
  if (boundaries.length === 0) {
    return undefined;
  }

  const cardCenterX = card.x + card.width / 2;
  const cardLeftX = card.x;
  const cardRightX = card.x + card.width;

  for (const boundary of boundaries) {
    if (
      (cardCenterX >= boundary.leftX && cardCenterX <= boundary.rightX) ||
      (cardLeftX >= boundary.leftX && cardLeftX <= boundary.rightX) ||
      (cardRightX >= boundary.leftX && cardRightX <= boundary.rightX) ||
      (cardLeftX <= boundary.leftX && cardRightX >= boundary.rightX)
    ) {
      const sprintName = boundary.sprintName;
      if (sprintName === 'Backlog') {
        return 'Backlog';
      }
      
      const sprintKeyMatch = sprintName.match(/(\d{4}-\d{1,2})$/);
      if (sprintKeyMatch) {
        return sprintKeyMatch[1];
      }
      
      return sprintName;
    }
  }

  return undefined;
}

