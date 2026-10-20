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
 * Skipped while the conversation is streaming: `handleUpdateConversation` rebuilds
 * from the object it is handed, so a mid-stream write would revert streamed text.
 */
import { useContext, useEffect } from 'react';

import HomeContext from '@/components/Home/home.context';
import { Assistant } from '@/types/assistant';
import { maxTokensForRequest } from './outputTokenBudget';

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
  // An unhydrated cloud record has no `messages` key (§36); don't write over it.
  const hydrated = Array.isArray(selectedConversation?.messages);

  useEffect(() => {
    if (!selectedConversation || !hydrated || messageIsStreaming) return;
    if (desired === undefined || current === desired) return;
    handleUpdateConversation(selectedConversation, { key: 'maxTokens', value: desired });
    // selectedConversation is read fresh each run; the deps below are the triggers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, current, desired, hydrated, messageIsStreaming]);
}
