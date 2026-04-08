import { useState, useCallback } from 'react';
import { Conversation } from '@/types/chat';
import { conversationWithUncompressedMessages, isLocalConversation } from '@/utils/app/conversation';
import { messagesToCached } from '@/utils/app/contextConversations';
import {
    CachedConversationMessage,
    isContextCacheValid,
    loadContextCache,
    saveContextCache,
} from '@/utils/app/storage';
import { fetchRemoteConversation } from '@/services/remoteConversationService';

export type FetchStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface LoadedConvState {
    status: FetchStatus;
    messages: CachedConversationMessage[];
    fromCache: boolean;
    cachedAt?: number;
    error?: string;
}

/**
 * Hook that manages on-demand loading of conversation messages for the context panel.
 *
 * - Local conversations:  resolved directly from the passed-in `localConversations` array
 *                         (no network, no cache needed, always fresh).
 * - Cloud conversations:  fetched via `fetchRemoteConversation`, then stored in IndexedDB
 *                         as a stripped `CachedConversationMessage[]` so subsequent opens
 *                         are instant.
 */
export const useConversationContextLoader = () => {
    // Per-conversation fetch state, keyed by conversationId
    const [loadedStates, setLoadedStates] = useState<Record<string, LoadedConvState>>({});

    const setConvState = useCallback((id: string, state: Partial<LoadedConvState>) => {
        setLoadedStates(prev => ({
            ...prev,
            [id]: { ...(prev[id] ?? { status: 'idle', messages: [], fromCache: false }), ...state },
        }));
    }, []);

    /**
     * Returns true if a cached entry is stale — either the TTL has expired
     * OR the conversation's own `date` (last-modified timestamp) is newer
     * than when we cached it, meaning new messages were added since.
     */
    const isCacheStale = useCallback((
        cached: { fetchedAt: number },
        conv: Conversation | undefined,
    ): boolean => {
        if (!isContextCacheValid(cached)) return true;
        if (conv?.date) {
            const convUpdatedAt = new Date(conv.date).getTime();
            if (convUpdatedAt > cached.fetchedAt) return true; // conversation was updated after cache
        }
        return false;
    }, []);

    /**
     * Eagerly resolve all entries that are already available locally or in cache
     * (no network calls).  Call this when the Conversations tab first opens.
     */
    const preloadFromCacheOrLocal = useCallback(async (
        conversationIds: string[],
        allConversations: Conversation[],
    ) => {
        for (const id of conversationIds) {
            // Already loaded — skip
            if (loadedStates[id]?.status === 'loaded') continue;

            const conv = allConversations.find(c => c.id === id && isLocalConversation(c));

            // Local
            if (conv) {
                const full = conversationWithUncompressedMessages(conv);
                const messages = messagesToCached(full.messages);
                setConvState(id, { status: 'loaded', messages, fromCache: false });
                continue;
            }

            // Cache — only use if not stale relative to the conversation's last-modified time
            const cached = await loadContextCache(id);
            if (cached && !isCacheStale(cached, conv)) {
                setConvState(id, {
                    status: 'loaded',
                    messages: cached.messages,
                    fromCache: true,
                    cachedAt: cached.fetchedAt,
                });
            }
            // If not in cache (or stale), leave as 'idle' — will be fetched fresh on expand
        }
    }, [loadedStates, setConvState, isCacheStale]);

    /**
     * Load a single conversation's messages.  For local conversations this is
     * synchronous (from memory); for cloud conversations it fetches and caches.
     *
     * The cache is automatically bypassed if the conversation's `date` (last-modified)
     * is newer than `fetchedAt`, meaning new messages were added since we last cached it.
     */
    const loadConversation = useCallback(async (
        conv: Conversation,
        allConversations: Conversation[],
        forceRefresh = false,
    ) => {
        const { id: conversationId, name: conversationName } = conv;
        setConvState(conversationId, { status: 'loading', error: undefined });

        try {
            // Local — always fresh from memory
            const localConv = allConversations.find(c => c.id === conversationId && isLocalConversation(c));
            if (localConv) {
                const full = conversationWithUncompressedMessages(localConv);
                const messages = messagesToCached(full.messages);
                setConvState(conversationId, { status: 'loaded', messages, fromCache: false });
                return;
            }

            // Cache — skip if force-refresh OR if conversation was updated after cache was written
            if (!forceRefresh) {
                const cached = await loadContextCache(conversationId);
                if (cached && !isCacheStale(cached, conv)) {
                    setConvState(conversationId, {
                        status: 'loaded',
                        messages: cached.messages,
                        fromCache: true,
                        cachedAt: cached.fetchedAt,
                    });
                    return;
                }
            }

            // Remote fetch (cache miss, stale, or force refresh)
            const remote = await fetchRemoteConversation(conversationId);
            if (!remote) {
                throw new Error('Failed to fetch conversation from cloud.');
            }

            const messages = messagesToCached(remote.messages ?? []);

            await saveContextCache({
                conversationId,
                conversationName,
                messages,
                fetchedAt: Date.now(),
            });

            setConvState(conversationId, { status: 'loaded', messages, fromCache: false });
        } catch (err: any) {
            setConvState(conversationId, {
                status: 'error',
                error: err?.message ?? 'Unknown error',
            });
        }
    }, [setConvState, isCacheStale]);

    return { loadedStates, loadConversation, preloadFromCacheOrLocal };
};
