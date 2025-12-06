/// <reference types="@figma/plugin-typings" />

import { TEMPLATES } from './templates';

/**
 * Plugin message types for UI communication
 */
export type PluginMessage =
  | { type: 'insert-template'; templateType: keyof typeof TEMPLATES }
  | { type: 'import-csv'; csvText: string }
  | { type: 'export-csv' }
  | { type: 'close' };

/**
 * Template type definition
 */
export type TemplateType = keyof typeof TEMPLATES;

/**
 * Template field definition
 */
export interface TemplateField {
  label: string;
  value: string;
}

/**
 * Template definition
 */
export interface Template {
  title: string;
  fields: TemplateField[];
}

/**
 * Card data structure for export
 */
export interface CardData {
  type: string;
  title: string;
  fields: Array<{ label: string; value: string }>;
  issueKey?: string;
}

/**
 * Jira issue data structure
 */
export interface JiraIssue {
  [key: string]: string;
}

/**
 * Capacity data structure
 */
export interface Capacity {
  [assignee: string]: number;
}

