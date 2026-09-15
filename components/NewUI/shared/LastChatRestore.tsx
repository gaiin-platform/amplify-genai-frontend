/**
 * LastChatRestore — refreshing inside a chat puts you back in that chat.
 *
 * home.tsx's startup effect always selects a *fresh* `New Conversation` on load, and the
 * new UI shows NewHome (the landing / new-chat view) for any conversation with zero
 * messages. The net effect is that a browser refresh silently throws the user out of the
 * conversation they were reading. This component renders nothing and closes that gap:
 *
 *   - it records the id of the conversation being viewed (sessionStorage, per tab), and
 *   - once per load, after history has hydrated, it re-selects that conversation.
 *
 * Only the chat view is remembered. Sitting on the landing page, the Library, the
 * assistant gallery, or a brand-new empty chat all *clear* the key, so those refreshes
 * behave exactly as they do today. What counts as "has content" is decided by
 * `shared/lastViewedChat` — `messages.length` alone is wrong for two of the three record
 * shapes that live in `state.conversations` (see that file's header).
 *
 * Deliberate constraints:
 *   - Restore waits for a non-empty `availableModels`. This is not cosmetic:
 *     `handleSelectConversation` rewrites `conversation.model` to the default whenever the
 *     model is not in `availableModels`, so restoring before the model list lands would
 *     quietly rewrite the model on the user's conversation.
 *   - Hydration is gated on `conversationStateId !== 'init'` plus a non-empty
 *     `conversations`, NOT on `=== 'post-init'`. `useHomeReducer` replaces
 *     `conversationStateId` with a fresh uuid on *every* later `selectedConversation` or
 *     `conversations` dispatch — and `fetchModels` dispatches `selectedConversation`
 *     (home.tsx:786) in the same batch that populates `availableModels` — so waiting for
 *     the literal string can mean waiting forever.
 *   - It defers to the pending-message bridge. If NewHome has just written
 *     `amplify_pending_message`, a send is in flight against the new conversation and
 *     stealing the selection would strand it.
 *   - Recording is held off until the restore attempt has settled, otherwise the startup
 *     blank conversation would clear the stored id before it could ever be read.
 *   - A stored id that is not in `conversations` is left in place rather than deleted: the
 *     recording effect clears it a moment later anyway, and cloud sync can still be
 *     rewriting `conversations` at that point.
 *   - Re-entry is idempotent rather than latched by a ref, because reactStrictMode
 *     mounts → unmounts → remounts every component (see NEW_UI_GUIDE §16).
 */

import React, { useContext, useEffect, useState } from 'react';
import HomeContext from '@/pages/api/home/home.context';
import {
  LAST_CHAT_KEY,
  findRestorableConversation,
  nextRecordedChat,
} from '@/components/NewUI/shared/lastViewedChat';

export const LastChatRestore: React.FC = () => {
  const {
    state: { conversations, selectedConversation, conversationStateId, availableModels, page },
    handleSelectConversation,
  } = useContext(HomeContext);

  // State, not a ref: the recording effect below has to re-run once this flips.
  const [restoreSettled, setRestoreSettled] = useState(false);

  // ── Restore, once per load ────────────────────────────────────────────────
  useEffect(() => {
    if (restoreSettled) return;
    if (typeof window === 'undefined') return;

    // Conversation history has landed. 'init' is the only pre-hydration value;
    // see the header note on why '=== post-init' is not usable here.
    if (conversationStateId === 'init') return;
    if (!conversations || conversations.length === 0) return;
    // Guards against handleSelectConversation rewriting the conversation's model.
    if (!availableModels || Object.keys(availableModels).length === 0) return;

    setRestoreSettled(true);

    const storedId = sessionStorage.getItem(LAST_CHAT_KEY);
    if (!storedId) return;

    // A send from NewHome is mid-flight against the current conversation — leave it be.
    if (
      sessionStorage.getItem('amplify_pending_message') !== null ||
      sessionStorage.getItem('amplify_pending_message_id') !== null
    ) {
      return;
    }

    if (selectedConversation?.id === storedId) return;

    const target = findRestorableConversation(storedId, conversations);
    if (!target) return;

    // Sets page:'chat', fetches remote messages, and restores the last-used assistant.
    handleSelectConversation(target);
  }, [
    restoreSettled,
    conversationStateId,
    availableModels,
    conversations,
    selectedConversation,
    handleSelectConversation,
  ]);

  // ── Record the currently-viewed chat ──────────────────────────────────────
  useEffect(() => {
    if (!restoreSettled) return;
    if (typeof window === 'undefined') return;

    const next = nextRecordedChat(page, selectedConversation);
    if (next.action === 'record') sessionStorage.setItem(LAST_CHAT_KEY, next.id);
    else if (next.action === 'clear') sessionStorage.removeItem(LAST_CHAT_KEY);
  }, [restoreSettled, page, selectedConversation]);

  return null;
};

export default LastChatRestore;
