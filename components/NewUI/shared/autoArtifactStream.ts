import type { Conversation, Message } from '@/types/chat';

export type AutoArtifactChunkResult = {
  artifactText: string;
  assistantText: string;
  inAssistantText: boolean;
  buffer: string;
};

/** Route streamed text to artifact content or assistant commentary. */
export function appendAutoArtifactChunk(
  buffer: string,
  chunk: string,
  inAssistantText: boolean,
  done = false,
): AutoArtifactChunkResult {
  let pending = buffer + chunk;
  let artifactText = '';
  let assistantText = '';
  let inAssistant = inAssistantText;
  const start = '<>';
  const end = '</>';

  while (pending.length > 0) {
    const marker = inAssistant ? end : start;
    const markerIndex = pending.indexOf(marker);
    if (markerIndex >= 0) {
      const section = pending.slice(0, markerIndex);
      if (inAssistant) assistantText += section;
      else artifactText += section;
      pending = pending.slice(markerIndex + marker.length);
      inAssistant = !inAssistant;
      continue;
    }

    if (done) {
      if (inAssistant) assistantText += pending;
      else artifactText += pending;
      pending = '';
      break;
    }

    const retained = markerPrefixLength(pending, marker);
    const safeLength = pending.length - retained;
    const safe = pending.slice(0, safeLength);
    if (inAssistant) assistantText += safe;
    else artifactText += safe;
    pending = pending.slice(safeLength);
    break;
  }

  return { artifactText, assistantText, inAssistantText: inAssistant, buffer: pending };
}

function markerPrefixLength(value: string, marker: string): number {
  const max = Math.min(value.length, marker.length - 1);
  for (let length = max; length > 0; length -= 1) {
    if (value.endsWith(marker.slice(0, length))) return length;
  }
  return 0;
}

/**
 * Write an artifact stream's conversation back into history by id. Used once the user has left the
 * source chat: writing it to `selectedConversation` would pull them back to it.
 */
export function replaceConversationById(
  conversations: Conversation[],
  conversation: Conversation,
  condense: (conversation: Conversation) => Conversation,
): Conversation[] {
  return conversations.map((c) => (c.id === conversation.id ? condense(conversation) : c));
}

/** Merge an artifact-stream update into the newest selected conversation snapshot. */
export function mergeAutoArtifactMessage(
  conversation: Conversation,
  messageId: string,
  update: {
    content?: string;
    state?: Record<string, unknown>;
    artifactStatus?: string;
    artifactDetails?: unknown[];
    artifactResume?: { prompt: string; type: string };
    /** Why the artifact request failed. `null` clears a previous failure (e.g. after a successful retry). */
    artifactError?: string | null;
  },
): Conversation {
  const messageIndex = conversation.messages?.findIndex((message) => message.id === messageId) ?? -1;
  if (messageIndex < 0) return conversation;

  const messages = [...conversation.messages];
  const message = messages[messageIndex];
  const existingData = (message.data ?? {}) as Record<string, any>;
  // Passing `artifactError` at all replaces the old one (null just clears it); omitting it leaves it alone.
  const { artifactError: _replaced, ...dataWithoutError } = existingData;
  const previousData = update.artifactError === undefined ? existingData : dataWithoutError;
  const previousArtifacts = Array.isArray(previousData.artifacts) ? previousData.artifacts : [];
  // A retry re-records the detail for the same artifact; replace it rather than listing it twice.
  const incomingIds = new Set((update.artifactDetails ?? []).map((d: any) => d?.artifactId).filter(Boolean));
  const keptArtifacts = previousArtifacts.filter((d: any) => !incomingIds.has(d?.artifactId));
  messages[messageIndex] = {
    ...message,
    ...(update.content !== undefined ? { content: update.content } : {}),
    data: {
      ...previousData,
      ...(update.state ? { state: { ...(previousData.state ?? {}), ...update.state } } : {}),
      ...(update.artifactStatus ? { artifactStatus: update.artifactStatus } : {}),
      ...(update.artifactDetails ? { artifacts: [...keptArtifacts, ...update.artifactDetails] } : {}),
      ...(update.artifactResume ? { artifactResume: update.artifactResume } : {}),
      ...(typeof update.artifactError === 'string' ? { artifactError: update.artifactError } : {}),
    },
  } as Message;

  return { ...conversation, messages };
}

// An edit sends the whole current version and asks for the whole new one. Asking the model to reference
// unchanged parts instead (the old `~A#` scheme) made it answer an edit with just the reference, because a
// document usually splits into a single part, so the "new" version was the old one again.
const ARTIFACT_EDIT_INSTRUCTIONS = `
You are updating an existing artifact. Its current content is below.
Apply the requested changes and output the COMPLETE updated artifact from start to finish.
- Make the requested changes. Do not return the current content unchanged.
- Keep every part the request does not ask to change as it is.
- Write out the entire artifact. Do not use placeholders or references to the current content.
- Do not describe the changes inside the artifact; mention them only in the summary.
`;

/** The part of an artifact request that hands the model the version it is editing. */
export function buildArtifactEditContext(currentContent: string): string {
  return `${ARTIFACT_EDIT_INSTRUCTIONS}\nCurrent artifact content:\n${currentContent}\n`;
}

/**
 * The user message that led to an assistant message. The artifact request otherwise carries only the
 * instructions the chat model wrote, which can be too vague to act on ("update the artifact as requested").
 */
export function findUserRequest(messages: Message[], assistantMessageId: string): string {
  const index = messages.findIndex((candidate) => candidate.id === assistantMessageId);
  for (let i = (index < 0 ? messages.length : index) - 1; i >= 0; i--) {
    if (messages[i].role === 'user') return typeof messages[i].content === 'string' ? messages[i].content.trim() : '';
  }
  return '';
}

/** What the artifact panel is showing, as told by `openArtifactsTrigger` events. */
export type PanelState = { isOpen: boolean; artifactIndex: number };

/** The index is kept across events that omit it, as the panel itself does. */
export function nextPanelState(prev: PanelState, detail: any): PanelState {
  return {
    isOpen: !!detail?.isOpen,
    artifactIndex: typeof detail?.artifactIndex === 'number' ? detail.artifactIndex : prev.artifactIndex,
  };
}

/**
 * Every card shares one panel, so a card is only "open" while the panel shows its own artifact version,
 * not whenever the panel is open.
 */
export function isCardPanelOpen(
  panel: PanelState,
  panelArtifactId: string | undefined,
  card: { artifactId: string; idx: number } | null | undefined,
): boolean {
  return panel.isOpen && !!card && panelArtifactId === card.artifactId && panel.artifactIndex === card.idx;
}

/**
 * Tells the chat model which artifacts already exist, so an edit reuses the exact id and becomes a new
 * version instead of a separate artifact. Returns '' when there are none.
 */
export function buildExistingArtifactsPrompt(artifacts: Record<string, Array<{ name?: string; version?: number }>> | undefined): string {
  const lines = Object.entries(artifacts ?? {})
    .filter(([, versions]) => Array.isArray(versions) && versions.length > 0)
    .map(([id, versions]) => {
      const latest = versions[versions.length - 1];
      return `- id: ${JSON.stringify(id)}, current name: ${JSON.stringify(latest?.name ?? '')}, latest version: ${latest?.version ?? versions.length}`;
    });
  if (lines.length === 0) return '';
  return [
    'Artifacts that already exist in this conversation:',
    ...lines,
    'When the user asks to change, extend or fix one of these, set "id" in the autoArtifacts block to its exact id from this list, even if the change renames it. Use a new id only for a genuinely new artifact.',
  ].join('\n');
}
