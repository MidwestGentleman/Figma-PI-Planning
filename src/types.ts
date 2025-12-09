/// <reference types="@figma/plugin-typings" />

import { TEMPLATES } from './templates';

/**
 * Plugin message types for UI communication
 */
export type PluginMessage =
  | { type: 'insert-template'; templateType: keyof typeof TEMPLATES }
  | { type: 'import-csv'; csvText: string; jiraBaseUrl?: string; importVerbose?: boolean; maxCardsPerColumn?: number; numFutureSprints?: number; futureSprintsColumns?: number }
  | { type: 'export-csv'; filterNew?: boolean }
  | { type: 'get-settings' }
  | { type: 'get-jira-url' }
  | { type: 'set-jira-url'; jiraBaseUrl: string }
  | { type: 'set-import-verbose'; importVerbose: boolean }
  | { type: 'set-max-cards-per-column'; maxCardsPerColumn: number }
  | { type: 'set-num-future-sprints'; numFutureSprints: number }
  | { type: 'set-future-sprints-columns'; futureSprintsColumns: number }
  | { type: 'close' };

export type UIMessage =
  | { type: 'settings-loaded'; jiraBaseUrl?: string; importVerbose?: boolean; maxCardsPerColumn?: number; numFutureSprints?: number; futureSprintsColumns?: number }
  | { type: 'jira-url-loaded'; jiraBaseUrl?: string };

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
  sprint?: string;
  epicLink?: string;
  team?: string; // Studio name
  teamID?: string; // Team ID (numeric or identifier)
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

