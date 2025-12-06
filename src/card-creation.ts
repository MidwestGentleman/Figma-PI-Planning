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
  wrapTitleText,
} from './utils';

/**
 * Creates an icon shape based on template type.
 */
function createIconShape(
  templateType: keyof typeof TEMPLATES,
  iconX: number,
  iconY: number
): SceneNode {
  const iconSize = CARD_CONFIG.ICON_SIZE;
  let iconShape: SceneNode;

  if (templateType === 'theme') {
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
 * Creates a template card at the specified position in the FigJam canvas.
 */
export async function createTemplateCardWithPosition(
  templateType: keyof typeof TEMPLATES,
  customData?: { [key: string]: string },
  x?: number,
  y?: number
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
  frame.name = (customData && customData.title) || template.title;
  frame.x = cardX;
  frame.y = cardY;

  if (customData && customData.issueKey) {
    frame.setPluginData(
      'issueKey',
      sanitizeFieldValue(customData.issueKey, 100)
    );
  }

  const cardWidth = CARD_CONFIG.WIDTH;
  frame.resize(cardWidth, CARD_CONFIG.DEFAULT_HEIGHT);

  const backgroundColor = getTemplateBackgroundColor(templateType);
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
  const iconShape = createIconShape(templateType, iconX, iconY);
  frame.appendChild(iconShape);

  const titleText = figma.createText();
  const titleContent = sanitizeFieldValue(
    (customData && customData.title) || template.title
  );
  titleText.characters = wrapTitleText(
    titleContent,
    CARD_CONFIG.TITLE_WRAP_LENGTH
  );
  titleText.fontSize = CARD_CONFIG.TITLE_FONT_SIZE;
  try {
    titleText.fontName = { family: 'Inter', style: 'Bold' };
  } catch (e) {
    console.warn('Could not set Bold font for title, using default');
  }
  titleText.fills = [
    {
      type: 'SOLID',
      color: useLightText ? COLOR_CONFIG.TEXT_LIGHT : COLOR_CONFIG.TEXT_DARK,
    },
  ];
  titleText.x = CARD_CONFIG.PADDING;
  titleText.y = CARD_CONFIG.PADDING;
  titleText.resize(cardWidth - CARD_CONFIG.PADDING * 2, titleText.height);

  const issueKey = customData && customData.issueKey;
  if (issueKey && issueKey.trim() !== '') {
    try {
      const url = `https://myjira.com/browse/${issueKey.trim()}`;
      titleText.setRangeHyperlink(0, titleText.characters.length, {
        type: 'URL',
        value: url,
      });
    } catch (e) {
      console.warn('Could not set hyperlink on title:', e);
    }
  }

  frame.appendChild(titleText);
  const titleHeight = titleText.height;

  let fieldsToShow: Array<{ label: string; value: string }> = [...template.fields];
  if (templateType === 'userStory') {
    if (customData && customData['Description']) {
      const descriptionValue = customData['Description'];
      fieldsToShow = [{ label: 'Description', value: descriptionValue }].concat(
        template.fields.filter(
          (f) =>
            f.label !== 'As a' && f.label !== 'I want' && f.label !== 'So that'
        )
      );
    }
  } else if (templateType === 'test') {
    if (customData && customData['Description']) {
      const descriptionValue = customData['Description'];
      fieldsToShow = [{ label: 'Description', value: descriptionValue }].concat(
        template.fields.filter(
          (f) => f.label !== 'Given' && f.label !== 'When' && f.label !== 'Then'
        )
      );
    }
  }

  const largeNumberField = getLargeNumberField(templateType);
  const fieldsToDisplay = fieldsToShow.filter(
    (f) =>
      (!largeNumberField || f.label !== largeNumberField) &&
      f.label !== 'Assignee'
  );

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
      console.warn('Could not set Bold font for number, using default');
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
      assigneeText.characters = sanitizeFieldValue(assigneeValue);
      assigneeText.fontSize = CARD_CONFIG.TITLE_FONT_SIZE;
      try {
        assigneeText.fontName = { family: 'Inter', style: 'Bold' };
      } catch (e) {
        console.warn('Could not set Bold font for assignee, using default');
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

