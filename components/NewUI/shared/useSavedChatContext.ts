import { useEffect, useRef, useState } from 'react';

import { getArtifact } from '@/services/artifactsService';

import type { Conversation, ConversationContextEntry } from '@/types/chat';

import {
  type ArtifactLibraryItem,
  hydrateArtifactLibraryItem,
} from './artifactLibraryModel';
import {
  type SavedChatContext,
  artifactAttachmentKey,
  attachSavedArtifact,
  getAttachedArtifacts,
  removeSavedArtifact,
} from './savedChatContext';

type PendingArtifact = {
  item: ArtifactLibraryItem;
  status: 'loading' | 'error';
};

export function useSavedChatContext(
  conversation: Conversation | null | undefined,
  updateConversation: (conversation: Conversation) => void,
) {
  const [draft, setDraft] = useState<SavedChatContext>({});
  const owner = conversation?.id;
  const saved = conversation ?? draft;
  const latest = useRef({ owner, saved, conversation, updateConversation });
  latest.current = { owner, saved, conversation, updateConversation };

  // Keep tokens separate from the menu's lifetime so closing it does not cancel loading.
  const requests = useRef({
    owner,
    pending: new Map<string, PendingArtifact>(),
  });
  const [, redraw] = useState(0);
  const refresh = () => redraw((current) => current + 1);
  if (requests.current.owner !== owner)
    requests.current = { owner, pending: new Map() };
  useEffect(
    () => () => {
      requests.current.pending.clear();
    },
    [],
  );

  const update = (change: (value: SavedChatContext) => SavedChatContext) => {
    const current = latest.current;
    const next = change(current.saved);
    if (next === current.saved) return;
    current.saved = next;
    if (current.conversation) {
      current.conversation = { ...current.conversation, ...next };
      current.updateConversation(current.conversation);
    } else {
      setDraft(next);
    }
  };

  const attachArtifact = async (item: ArtifactLibraryItem) => {
    const key = artifactAttachmentKey(item);
    const request = requests.current;
    if (
      request.pending.get(key)?.status === 'loading' ||
      getAttachedArtifacts(latest.current.saved).some(
        (entry) => entry.key === key,
      )
    )
      return;
    const pending: PendingArtifact = { item, status: 'loading' };
    request.pending.set(key, pending);
    refresh();
    const isCurrent = () =>
      requests.current === request && request.pending.get(key) === pending;

    try {
      let loaded = item;
      if (!item.hasContent) {
        const response = await getArtifact(
          item.artifact.key || item.artifact.artifactId,
        );
        if (!response.success || !response.data)
          throw new Error('Artifact unavailable');
        loaded = hydrateArtifactLibraryItem(item, response.data);
      }
      if (!loaded.hasContent) throw new Error('Artifact content unavailable');
      if (!isCurrent()) return;
      update((value) => attachSavedArtifact(value, loaded, key));
      request.pending.delete(key);
    } catch {
      if (!isCurrent()) return;
      request.pending.set(key, { ...pending, status: 'error' });
    }
    refresh();
  };

  const removeArtifact = (key: string) => {
    if (requests.current.pending.delete(key)) refresh();
    else update((value) => removeSavedArtifact(value, key));
  };

  const pendingArtifacts = requests.current.pending;
  const artifactChips = [
    ...getAttachedArtifacts(saved).map(({ key, name }) => ({
      key,
      name,
      status: 'ready' as const,
    })),
    ...Array.from(pendingArtifacts, ([key, { item, status }]) => ({
      key,
      name: item.name,
      status,
    })),
  ];

  return {
    conversationId: owner,
    artifactChips,
    attachArtifact,
    removeArtifact,
    retryArtifact: (key: string) => {
      const pending = requests.current.pending.get(key);
      if (pending?.status === 'error') void attachArtifact(pending.item);
    },
    conversationEntries: saved.contextConversations ?? [],
    attachConversation: (entry: ConversationContextEntry) =>
      update((value) => ({
        ...value,
        contextConversations: [
          ...(value.contextConversations ?? []).filter(
            (current) => current.conversationId !== entry.conversationId,
          ),
          entry,
        ],
      })),
    removeConversation: (id: string) =>
      update((value) => ({
        ...value,
        contextConversations: (value.contextConversations ?? []).filter(
          (entry) => entry.conversationId !== id,
        ),
      })),
    getBlockReason: () => {
      const pending = requests.current.pending;
      if (!pending.size) return '';
      return Array.from(pending.values()).some(
        (entry) => entry.status === 'error',
      )
        ? 'An artifact failed to load. Retry or remove it to send.'
        : 'Please wait for the attached artifacts to finish loading.';
    },
    draft,
    clearDraft: () => setDraft({}),
  };
}

export type SavedChatContextControls = ReturnType<typeof useSavedChatContext>;
