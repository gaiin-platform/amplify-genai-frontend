/**
 * useOutputTokenBudget — keeps `conversation.maxTokens` equal to the budget for the
 * conversation's model and effective reasoning effort (see ./outputTokenBudget).
 *
 * `useChatSendService` has no per-request token field: it sends
 * `updatedConversation.maxTokens || outputTokenLimit / 2`. So, like effort (§31),
 * the value only takes effect if it lives on the conversation.
 *
 * Idempotent and difference-based (§33): it writes only when the stored value
 * disagrees with the computed one. That matters because the classic `Chat.tsx`
 * is still mounted and rewrites `maxTokens` from its hidden response-length slider
 * whenever its own model state changes; this hook simply corrects it on the next
 * render, and the two settle immediately since Chat only writes on a model change.
 *
 * It also keeps `temperature` valid (see ./temperature): a new empty chat gets the
 * default, anything else is clamped to 0–1. Both fields are written from this one
 * effect, threading the intermediate object through, because
 * `handleUpdateConversation` rebuilds from the object it is handed — two writes of
 * the same stale conversation would revert the first.
 *
 * Skipped while the conversation is streaming: `handleUpdateConversation` rebuilds
 * from the object it is handed, so a mid-stream write would revert streamed text.
 */
import { useContext, useEffect } from 'react';

import HomeContext from '@/components/Home/home.context';
import { Assistant } from '@/types/assistant';
import { maxTokensForRequest } from './outputTokenBudget';
import { resolveConversationTemperature } from './temperature';

export function useOutputTokenBudget(assistant?: Assistant | null): void {
  const {
    state: { selectedConversation, availableModels, messageIsStreaming },
    handleUpdateConversation,
  } = useContext(HomeContext);

  const assistantData = assistant?.definition?.data as
    | { model?: unknown; enforceThinkingLevel?: unknown; thinkingLevel?: unknown }
    | undefined;

  const desired = maxTokensForRequest({
    model: selectedConversation?.model,
    conversationEffort: selectedConversation?.data?.reasoningLevel,
    assistantData,
    availableModels,
  });

  const conversationId = selectedConversation?.id;
  const current = selectedConversation?.maxTokens;
  const currentTemperature = selectedConversation?.temperature;
  // An unhydrated cloud record has no `messages` key (§36); don't write over it.
  const hydrated = Array.isArray(selectedConversation?.messages);
  const desiredTemperature = selectedConversation
    ? resolveConversationTemperature(selectedConversation)
    : undefined;

  useEffect(() => {
    if (!selectedConversation || !hydrated || messageIsStreaming) return;
    let base = selectedConversation;
    if (desiredTemperature !== undefined && currentTemperature !== desiredTemperature) {
      handleUpdateConversation(base, { key: 'temperature', value: desiredTemperature });
      base = { ...base, temperature: desiredTemperature };
    }
    if (desired !== undefined && current !== desired) {
      handleUpdateConversation(base, { key: 'maxTokens', value: desired });
    }
    // selectedConversation is read fresh each run; the deps below are the triggers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, current, desired, currentTemperature, desiredTemperature, hydrated, messageIsStreaming]);
}
