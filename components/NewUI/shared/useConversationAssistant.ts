/**
 * useConversationAssistant — resolves the assistant that is actually driving the
 * currently selected conversation, and keeps `selectedAssistant` in sync with it.
 *
 * ── Why this exists ────────────────────────────────────────────────────────────
 * `selectedAssistant` in home state is a *global* field, not a per-conversation
 * one, and several old-UI code paths reset it:
 *
 *   • `handleNewConversation()` (home.tsx) does
 *     `dispatch({ field: 'selectedAssistant', value: paramAssistant ?? DEFAULT_ASSISTANT })`
 *     on every call — so any caller that forgets to pass `assistant` silently
 *     detaches the assistant the user just picked.
 *   • `handleSelectConversation()` only re-derives the assistant from the *last*
 *     message's `data.state.currentAssistant`, matched by prompt **name**. If the
 *     last message is a user turn, or the assistant is not in `prompts` (layered /
 *     shared assistants), nothing is dispatched and the previous conversation's
 *     assistant leaks — or the assistant is lost entirely.
 *
 * Net effect in the new UI: the composer chip vanished after the first send and
 * follow-up messages were sent with no assistant attached at all.
 *
 * ── What this hook does ───────────────────────────────────────────────────────
 * 1. RESOLVE — returns the assistant for the current conversation, in priority
 *    order: explicit `selectedAssistant` → conversation `promptTemplate` →
 *    scan of the transcript (`message.data.assistant.definition`, written by
 *    `utils/app/assistants#setAssistant`, then `data.state.currentAssistant`).
 * 2. RE-ATTACH — once per conversation id, dispatches the derived assistant back
 *    into `selectedAssistant` so ChatInput / useChatSendService actually route
 *    follow-up messages to it. Also clears a *stale* assistant that leaked in
 *    from a previously-open conversation.
 * 3. DETACH — `detach()` removes the assistant and remembers that choice for the
 *    conversation, so step 2 cannot resurrect it from the transcript.
 *
 * Read-only with respect to old-UI files: it reads HomeContext state and
 * dispatches the same field the old UI already dispatches.
 */
import { useCallback, useContext, useEffect, useMemo, useRef } from 'react';

import HomeContext from '@/pages/api/home/home.context';
import { Assistant, AssistantProviderID, DEFAULT_ASSISTANT } from '@/types/assistant';
import { Conversation, Message } from '@/types/chat';
import { Prompt } from '@/types/prompt';
import { LayeredAssistant } from '@/types/layeredAssistant';

/** True when `assistant` is a real assistant rather than "Standard Conversation". */
export const isRealAssistant = (
  assistant?: Assistant | null,
): assistant is Assistant =>
  !!assistant && assistant.id !== DEFAULT_ASSISTANT.id && !!assistant.definition;

/**
 * Conversations the user has explicitly detached an assistant from (chip ✕).
 * Module-level so the choice survives component remounts and conversation
 * switches within the session, while never being persisted across reloads.
 */
const detachedConversationIds = new Set<string>();

/** Build a display-capable Assistant from just the name/id stored on a message. */
const syntheticAssistant = (
  name: string,
  assistantId?: string,
  uri?: string,
): Assistant => ({
  id: assistantId ?? name,
  definition: {
    name,
    description: '',
    instructions: '',
    tools: [],
    tags: [],
    fileKeys: [],
    dataSources: [],
    provider: AssistantProviderID.AMPLIFY,
    ...(assistantId ? { assistantId } : {}),
    ...(uri ? { uri } : {}),
  },
});

/** Find the full Assistant object for an id/name among prompts + layered assistants. */
const lookupAssistant = (
  prompts: Prompt[],
  layered: LayeredAssistant[],
  assistantId?: string,
  name?: string,
): Assistant | null => {
  for (const p of prompts ?? []) {
    const ast: Assistant | undefined = p?.data?.assistant;
    if (!ast?.definition) continue;
    if (assistantId && ast.definition.assistantId === assistantId) {
      // Group assistants carry their groupId on the prompt, not the definition.
      return p.groupId && !ast.definition.groupId
        ? { ...ast, definition: { ...ast.definition, groupId: p.groupId } }
        : ast;
    }
  }
  if (name) {
    for (const p of prompts ?? []) {
      const ast: Assistant | undefined = p?.data?.assistant;
      if (ast?.definition?.name === name) {
        return p.groupId && !ast.definition.groupId
          ? { ...ast, definition: { ...ast.definition, groupId: p.groupId } }
          : ast;
      }
    }
  }
  for (const la of layered ?? []) {
    if (!la?.assistantId) continue;
    if (
      (assistantId && la.assistantId === assistantId) ||
      (!assistantId && name && la.name === name)
    ) {
      return {
        id: la.assistantId,
        definition: {
          name: la.name,
          description: la.description ?? '',
          assistantId: la.assistantId,
          instructions: '',
          tools: [],
          tags: [],
          fileKeys: [],
          dataSources: [],
          provider: AssistantProviderID.AMPLIFY,
          ...(la.groupId ? { groupId: la.groupId } : {}),
          data: { isLayeredAssistant: true, ...(la.model ? { model: la.model } : {}) },
        },
      };
    }
  }
  return null;
};

/**
 * How far back the transcript is scanned for an assistant.
 *
 * Every send while an assistant is attached stamps the user message, so a live
 * assistant conversation always has a stamp within the last turn or two. Bounding
 * the scan (a) keeps it O(1) on conversations that re-render per streamed token
 * and (b) stops an assistant that was detached many turns ago from being
 * resurrected on the next page load.
 */
export const ASSISTANT_SCAN_WINDOW = 8;

/**
 * Derive the assistant a conversation is using from the conversation itself.
 * Returns null for plain conversations.
 */
export const deriveConversationAssistant = (
  conversation: Conversation | null | undefined,
  prompts: Prompt[],
  layered: LayeredAssistant[],
): Assistant | null => {
  if (!conversation) return null;

  // 1. Started from an assistant (gallery / prompt template).
  const templateAssistant: Assistant | undefined =
    conversation.promptTemplate?.data?.assistant;
  if (templateAssistant?.definition) {
    return (
      lookupAssistant(
        prompts,
        layered,
        templateAssistant.definition.assistantId,
        templateAssistant.definition.name,
      ) ?? templateAssistant
    );
  }

  // 2. Newest turn that names an assistant wins.
  const messages: Message[] = conversation.messages ?? [];
  const oldest = Math.max(0, messages.length - ASSISTANT_SCAN_WINDOW);
  for (let i = messages.length - 1; i >= oldest; i--) {
    const m = messages[i];
    const stamped = m?.data?.assistant?.definition;
    if (stamped?.name) {
      return (
        lookupAssistant(prompts, layered, stamped.assistantId, stamped.name) ??
        syntheticAssistant(stamped.name, stamped.assistantId, stamped.uri)
      );
    }
    const streamed = m?.data?.state?.currentAssistant;
    if (typeof streamed === 'string' && streamed && streamed !== DEFAULT_ASSISTANT.definition.name) {
      return (
        lookupAssistant(
          prompts,
          layered,
          m?.data?.state?.currentAssistantId,
          streamed,
        ) ?? syntheticAssistant(streamed, m?.data?.state?.currentAssistantId)
      );
    }
  }

  return null;
};

/** A send may be mid-flight through the home → chat bridge; don't reconcile yet. */
const pendingBridgeSend = (): boolean => {
  if (typeof window === 'undefined') return false;
  return (
    !!sessionStorage.getItem('amplify_pending_message') ||
    !!sessionStorage.getItem('amplify_pending_message_id')
  );
};

export interface ConversationAssistantState {
  /** The assistant driving this conversation, or null for a plain chat. */
  assistant: Assistant | null;
  /** Convenience: `assistant.definition.name` or undefined. */
  assistantName: string | undefined;
  /** True when the assistant came from the transcript rather than an explicit pick. */
  isDerived: boolean;
  /** Remove the assistant from this conversation (and remember the choice). */
  detach: () => void;
}

export const useConversationAssistant = (): ConversationAssistantState => {
  const {
    state: { selectedConversation, selectedAssistant, prompts, layeredAssistants, groups },
    dispatch,
  } = useContext(HomeContext);

  const explicit = isRealAssistant(selectedAssistant) ? selectedAssistant : null;

  const allLayered: LayeredAssistant[] = useMemo(
    () => [
      ...((layeredAssistants ?? []) as LayeredAssistant[]),
      ...(((groups ?? []) as any[]).flatMap((g: any) => g.layeredAssistants ?? []) as LayeredAssistant[]),
    ],
    [layeredAssistants, groups],
  );

  const conversationId = selectedConversation?.id;
  const messageCount = selectedConversation?.messages?.length ?? 0;

  // `selectedConversation` gets a new identity on every streamed token, so the
  // derivation is memoised on a cheap signature of only the things it reads —
  // otherwise a synthetic (not-in-prompts) assistant would be a brand-new object
  // on every token and churn every downstream dependency array.
  const conversationRef = useRef(selectedConversation);
  conversationRef.current = selectedConversation;

  const derivationKey = useMemo(() => {
    const messages = selectedConversation?.messages ?? [];
    const oldest = Math.max(0, messages.length - ASSISTANT_SCAN_WINDOW);
    let key = selectedConversation?.promptTemplate?.data?.assistant?.definition?.assistantId ?? '';
    key += `|${selectedConversation?.promptTemplate?.data?.assistant?.definition?.name ?? ''}`;
    for (let i = oldest; i < messages.length; i++) {
      const d = messages[i]?.data;
      key += `#${d?.assistant?.definition?.assistantId ?? ''}~${d?.assistant?.definition?.name ?? ''}`;
      key += `~${d?.state?.currentAssistantId ?? ''}~${d?.state?.currentAssistant ?? ''}`;
    }
    return key;
  }, [selectedConversation]);

  const derived = useMemo(
    () => deriveConversationAssistant(conversationRef.current, prompts ?? [], allLayered),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [conversationId, derivationKey, prompts, allLayered],
  );

  // ── Re-attach / clear, once per conversation ────────────────────────────────
  // Keyed on the conversation id so an in-chat pick (AttachMenu → Assistant) is
  // never overwritten: that changes `explicit` but not the id.
  const reconciledIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!conversationId) return;
    if (reconciledIdRef.current === conversationId) return;
    // Nothing to reconcile against yet. Remote conversations dispatch their id
    // before their (uncompressed) messages land, and a freshly created chat is
    // legitimately empty — in both cases stay unreconciled so a later transcript
    // still gets a chance to restore its assistant.
    if (!derived && messageCount === 0) return;
    reconciledIdRef.current = conversationId;

    const detached = detachedConversationIds.has(conversationId);

    if (derived && !detached) {
      const sameAsExplicit =
        explicit &&
        (explicit.definition.assistantId === derived.definition.assistantId ||
          explicit.definition.name === derived.definition.name);
      if (!sameAsExplicit) {
        dispatch({ field: 'selectedAssistant', value: derived });
      }
      return;
    }

    // This conversation has no assistant (or the user detached it), but state
    // still holds one from the conversation we just navigated away from — drop
    // it, unless a brand-new conversation is waiting on the pending-send bridge
    // (there the user's pick is intentional and the transcript is still empty).
    if (explicit && (detached || (messageCount > 0 && !pendingBridgeSend()))) {
      dispatch({ field: 'selectedAssistant', value: DEFAULT_ASSISTANT });
    }
  }, [conversationId, messageCount, derived, explicit, dispatch]);

  const detach = useCallback(() => {
    if (conversationId) detachedConversationIds.add(conversationId);
    dispatch({ field: 'selectedAssistant', value: DEFAULT_ASSISTANT });
  }, [conversationId, dispatch]);

  const assistant =
    explicit ?? (conversationId && detachedConversationIds.has(conversationId) ? null : derived);

  return {
    assistant: assistant ?? null,
    assistantName: assistant?.definition?.name,
    isDerived: !explicit && !!assistant,
    detach,
  };
};

export default useConversationAssistant;
