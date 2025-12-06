/**
 * Template definitions for PI Planning card types
 * Each template defines the structure and default values for a card type
 */

export interface TemplateField {
  label: string;
  value: string;
}

export interface Template {
  title: string;
  fields: TemplateField[];
}

export const TEMPLATES = {
  theme: {
    title: 'Theme',
    fields: [
      { label: 'Name', value: 'Theme Name' },
      { label: 'Description', value: 'Business objective description...\n' },
      { label: 'Business Value', value: 'High' },
      { label: 'Priority Rank', value: '#' },
      {
        label: 'Acceptance Criteria',
        value: '- Criterion 1\n- Criterion 2\n- Criterion 3',
      },
    ],
  },
  milestone: {
    title: 'Milestone',
    fields: [
      { label: 'Name', value: 'Milestone Name' },
      { label: 'Target Date', value: 'MM/DD/YYYY' },
      { label: 'Description', value: 'Milestone description...\n' },
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
      { label: 'Assignee', value: 'Unassigned' },
    ],
  },
  epic: {
    title: 'Epic',
    fields: [
      { label: 'Name', value: 'Epic Name' },
      { label: 'Description', value: 'Epic description...\n' },
      { label: 'Business Value', value: 'High' },
      { label: 'Team', value: 'Team Name' },
      {
        label: 'Acceptance Criteria',
        value: '- Criterion 1\n- Criterion 2\n- Criterion 3',
      },
    ],
  },
  initiative: {
    title: 'Initiative',
    fields: [
      { label: 'Name', value: 'Initiative Name' },
      { label: 'Description', value: 'Initiative description...\n' },
      { label: 'Dependencies', value: 'None' },
      { label: 'Priority Rank', value: '#' },
      {
        label: 'Acceptance Criteria',
        value: '- Criterion 1\n- Criterion 2\n- Criterion 3',
      },
    ],
  },
  task: {
    title: 'Task',
    fields: [
      { label: 'Description', value: 'Task description...\n' },
      { label: 'Assignee', value: 'Unassigned' },
      {
        label: 'Acceptance Criteria',
        value: '- Criterion 1\n- Criterion 2\n- Criterion 3',
      },
    ],
  },
  spike: {
    title: 'Spike',
    fields: [
      { label: 'Description', value: 'Spike description...\n' },
      { label: 'Assignee', value: 'Unassigned' },
      {
        label: 'Acceptance Criteria',
        value: '- Criterion 1\n- Criterion 2\n- Criterion 3',
      },
    ],
  },
  test: {
    title: 'Test',
    fields: [
      { label: 'Given', value: '[initial context]' },
      { label: 'When', value: '[event occurs]' },
      { label: 'Then', value: '[expected outcome]' },
      { label: 'Test Type', value: 'Manual' },
      { label: 'Assignee', value: 'Unassigned' },
      {
        label: 'Acceptance Criteria',
        value: '- Criterion 1\n- Criterion 2\n- Criterion 3',
      },
    ],
  },
} as const;

