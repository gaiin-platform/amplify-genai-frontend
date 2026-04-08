import { Conversation, ConversationContextEntry, Message } from '@/types/chat';
import { conversationWithUncompressedMessages, isLocalConversation } from './conversation';
import {
    CachedConversationMessage,
    isContextCacheValid,
    loadContextCache,
    saveContextCache,
} from './storage';
import { fetchRemoteConversation } from '@/services/remoteConversationService';

/**
 * Convert a full Message[] to the stripped-down CachedConversationMessage[] format.
 * We only keep user/assistant turns and only the plain text content.
 */
export const messagesToCached = (messages: Message[]): CachedConversationMessage[] => {
    return messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({
            id: m.id,
            role: m.role,
            content: typeof m.content === 'string' ? m.content : '',
        }))
        .filter(m => m.content.trim().length > 0);
};

/**
 * Render a list of CachedConversationMessage into the simple string format:
 *   user: <message>
 *   assistant: <message>
 *   ...
 */
export const cachedMessagesToString = (messages: CachedConversationMessage[]): string => {
    return messages.map(m => `${m.role}: ${m.content}`).join('\n\n');
};

/**
 * Resolve all context entries to a single context string that can be injected
 * before the current conversation's messages at send time.
 *
 * Resolution order per entry:
 *   1. Local (in-memory, from HomeContext conversations array) — always fresh
 *   2. IndexedDB cache — used for cloud conversations
 *
 * Returns '' if there is nothing to inject.
 */
export const resolveContextString = async (
    entries: ConversationContextEntry[],
    localConversations: Conversation[],
): Promise<string> => {
    if (!entries || entries.length === 0) return '';

    const parts: string[] = [];

    for (const entry of entries) {
        let messages: CachedConversationMessage[] = [];

        // 1. Try local memory first (only for locally-stored conversations — always fresh)
        const localConv = localConversations.find(
            c => c.id === entry.conversationId && isLocalConversation(c),
        );
        if (localConv) {
            const full = conversationWithUncompressedMessages(localConv);
            messages = messagesToCached(full.messages);
        } else {
            // 2. Fall back to IndexedDB cache (populated by useConversationContextLoader).
            //    If the conversation's own `date` is newer than `fetchedAt`, the cache is stale
            //    (new messages were added after we last fetched), so re-fetch silently.
            const cached = await loadContextCache(entry.conversationId);
            if (cached) {
                const convMeta = localConversations.find(c => c.id === entry.conversationId);
                const convUpdatedAt = convMeta?.date ? new Date(convMeta.date).getTime() : 0;
                const cacheStale = !isContextCacheValid(cached) || convUpdatedAt > cached.fetchedAt;

                if (!cacheStale) {
                    messages = cached.messages;
                } else {
                    // Attempt a silent re-fetch to get the latest messages
                    try {
                        const remote = await fetchRemoteConversation(entry.conversationId);
                        if (remote) {
                            messages = messagesToCached(remote.messages ?? []);
                            await saveContextCache({
                                conversationId: entry.conversationId,
                                conversationName: convMeta?.name ?? cached.conversationName,
                                messages,
                                fetchedAt: Date.now(),
                            });
                        }
                    } catch {
                        // Re-fetch failed — fall back to stale cache rather than losing context
                        messages = cached.messages;
                    }
                }
            }
        }

        if (messages.length === 0) continue;

        // Apply message selection for cherry-pick mode
        if (entry.mode === 'selected' && entry.selectedMessageIds && entry.selectedMessageIds.length > 0) {
            const idSet = new Set(entry.selectedMessageIds);
            messages = messages.filter(m => idSet.has(m.id));
        }

        if (messages.length > 0) {
            parts.push(cachedMessagesToString(messages));
        }
    }

    return parts.join('\n\n---\n\n');
};
