/**
 * BlankConversationCleanup — keeps refreshes from accumulating empty chats (UI-002).
 *
 * home.tsx's startup effect mints a fresh `New Conversation` on load and persists it
 * into conversation history, so a plain browser refresh can leave another empty chat
 * behind even though the user never pressed New Chat. Over a session those pile up in
 * Recents and in the Chats list as untitled, contentless rows.
 *
 * This component renders nothing. Once per load — after home.tsx signals
 * `conversationStateId === 'post-init'`, i.e. the startup write has already happened —
 * it drops every *other* untouched placeholder conversation from history, so the count
 * stays flat across refreshes instead of growing by one each time. The conversation the
 * user is currently sitting in is always kept, so the composer they see is never pulled
 * out from under them.
 *
 * Deliberately conservative:
 *   - Only local conversations are removed. Cloud-stored ones are stripped to metadata
 *     in local history (messages live server-side), so "no messages" locally does not
 *     prove they are empty — deleting them could destroy real content.
 *   - Pinned / tagged / artifact-bearing / renamed conversations are never touched
 *     (see isBlankPlaceholderConversation).
 *   - Runs once per mount. It reacts to startup state, not to ongoing user activity,
 *     so a placeholder created later by New Chat is left alone.
 */

import React, { useContext, useEffect, useRef } from 'react';
import HomeContext from '@/pages/api/home/home.context';
import { Conversation } from '@/types/chat';
import {
  deleteConversationCleanUp,
  isLocalConversation,
  saveConversations,
} from '@/utils/app/conversation';
import { isBlankPlaceholderConversation } from '@/components/NewUI/shared/chatFilters';

export const BlankConversationCleanup: React.FC = () => {
  const {
    state: { conversations, selectedConversation, conversationStateId },
    dispatch,
  } = useContext(HomeContext);

  const hasRunRef = useRef(false);

  useEffect(() => {
    if (hasRunRef.current) return;
    // 'post-init' is dispatched at the end of home.tsx's load effect — before that,
    // `conversations` is still the pre-hydration list and pruning would fight the init.
    if (conversationStateId !== 'post-init') return;
    if (!conversations || conversations.length === 0) return;

    hasRunRef.current = true;

    const keepId = selectedConversation?.id;
    const stale = conversations.filter(
      (c: Conversation) =>
        c.id !== keepId && isLocalConversation(c) && isBlankPlaceholderConversation(c),
    );

    if (stale.length === 0) return;

    const staleIds = new Set(stale.map((c) => c.id));
    const kept = conversations.filter((c: Conversation) => !staleIds.has(c.id));

    // Releases any side artifacts (code interpreter records) the placeholder held.
    stale.forEach(deleteConversationCleanUp);

    dispatch({ field: 'conversations', value: kept });
    saveConversations(kept);
  }, [conversationStateId, conversations, selectedConversation, dispatch]);

  return null;
};

export default BlankConversationCleanup;
