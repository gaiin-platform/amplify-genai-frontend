/**
 * presentationJobModel — pure logic for the "Export as PowerPoint" flow:
 * building the source document from a conversation, mapping backend job stages
 * to UI steps, and deciding poll timing. No React, so it is unit tested directly.
 */

import { Conversation, Message } from '@/types/chat';
import type { PresentationJob } from './presentationApi';

export const DEFAULT_TEMPLATE = 'vanderbilt_1.pptx';

/** Poll every 3s; give up after 25 min (the agent's own review loop is bounded well below this). */
export const POLL_INTERVAL_MS = 3000;
export const POLL_TIMEOUT_MS = 25 * 60 * 1000;
/** Transient status errors tolerated in a row before the dialog reports a failure. */
export const MAX_CONSECUTIVE_POLL_ERRORS = 5;

export interface PresentationStep {
  id: string;
  label: string;
}

/** Ordered user-facing steps. Backend stages map onto these. */
export const PRESENTATION_STEPS: PresentationStep[] = [
  { id: 'start', label: 'Starting' },
  { id: 'plan', label: 'Planning the story' },
  { id: 'build', label: 'Building slides' },
  { id: 'review', label: 'Reviewing and refining' },
  { id: 'finish', label: 'Finishing up' },
];

const STAGE_TO_STEP: Record<string, string> = {
  queued: 'start',
  loading: 'start',
  planning: 'plan',
  images: 'build',
  building: 'build',
  rendering: 'build',
  reviewing: 'review',
  finalizing: 'finish',
  completed: 'finish',
};

export function stepIndexForStage(stage: string | undefined): number {
  const step = STAGE_TO_STEP[stage ?? ''] ?? 'start';
  return Math.max(0, PRESENTATION_STEPS.findIndex((s) => s.id === step));
}

export function isTerminal(job: Pick<PresentationJob, 'status'> | null | undefined): boolean {
  return job?.status === 'completed' || job?.status === 'failed';
}

export function clampProgress(progress: number | undefined): number {
  if (typeof progress !== 'number' || Number.isNaN(progress)) return 0;
  return Math.min(100, Math.max(0, Math.round(progress)));
}

export function pickDefaultTemplate(templates: string[]): string {
  if (templates.includes(DEFAULT_TEMPLATE)) return DEFAULT_TEMPLATE;
  return templates[0] ?? '';
}

/** Messages the chat actually shows (mirrors Chat.tsx's render filter). */
function visibleMessages(messages: Message[]): Message[] {
  return messages.filter((m) => m.role !== 'tool' && !(m.data && m.data.actionResult) && m.content?.trim());
}

function roleHeading(message: Message): string {
  if (message.role === 'user') return 'User';
  if (message.role === 'assistant') return 'Assistant';
  return message.role.charAt(0).toUpperCase() + message.role.slice(1);
}

/**
 * Source material for the agent. For a single message we include the request
 * that produced it, so the planner knows the intent behind the content.
 */
export function buildPresentationSource(
  conversation: Pick<Conversation, 'name' | 'messages'>,
  messageIndex?: number,
): string {
  const messages = conversation.messages ?? [];
  const header = `# ${conversation.name || 'Conversation'}`;

  if (messageIndex !== undefined && messages[messageIndex]) {
    const target = messages[messageIndex];
    const request = [...messages.slice(0, messageIndex)].reverse().find((m) => m.role === 'user');
    const parts = [header];
    if (request && target.role !== 'user') parts.push(`## Request\n\n${request.content.trim()}`);
    parts.push(`## Content to present\n\n${target.content.trim()}`);
    return parts.join('\n\n');
  }

  const body = visibleMessages(messages)
    .map((m) => `## ${roleHeading(m)}\n\n${m.content.trim()}`)
    .join('\n\n');
  return `${header}\n\n${body}`;
}

/** Deck title suggestion: the conversation name unless it is the default placeholder. */
export function suggestTitle(conversation: Pick<Conversation, 'name'> | undefined): string {
  const name = conversation?.name?.trim() ?? '';
  return name && name !== 'New Conversation' ? name : '';
}

export function latestScore(scores: number[] | undefined): number | null {
  if (!scores || scores.length === 0) return null;
  return scores[scores.length - 1];
}
