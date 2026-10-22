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
