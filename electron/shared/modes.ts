import type { ModeId } from './types';

export interface ModeConfig {
  id: ModeId;
  label: string;
  description: string;
}

export const MODES: ModeConfig[] = [
  {
    id: 'clean',
    label: 'Clean Transcript',
    description: 'Clean text with punctuation, no filler words',
  },
  {
    id: 'meeting',
    label: 'Meeting Notes',
    description: 'Structured meeting notes with summary, decisions, action items',
  },
  {
    id: 'tasks',
    label: 'Task List',
    description: 'Extract action items as checkbox list',
  },
  {
    id: 'email',
    label: 'Email Draft',
    description: 'Professional email draft from voice input',
  },
  {
    id: 'ticket',
    label: 'Ticket/Issue',
    description: 'Jira-style ticket with title, description, acceptance criteria',
  },
  {
    id: 'devnote',
    label: 'Dev Note',
    description: 'Developer note or changelog entry',
  },
  {
    id: 'reminder',
    label: 'Reminder',
    description: 'Create a reminder with what and when',
  },
];

export const getModeById = (id: ModeId): ModeConfig | undefined => {
  return MODES.find((m) => m.id === id);
};
