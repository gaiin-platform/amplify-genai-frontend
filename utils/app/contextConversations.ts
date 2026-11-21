import { Conversation, ConversationContextEntry, Message } from '@/types/chat';
import { conversationWithUncompressedMessages, isLocalConversation } from './conversation';
import { fetchRemoteConversation } from '@/services/remoteConversationService';
import {
    CachedConversationMessage,
    loadContextCache,
    saveContextCache,
} from './storage';

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

export const fetchAndCacheConversationContext = async (conversation: Conversation) => {
    const remote = await fetchRemoteConversation(conversation.id, undefined, undefined, true);
    if (!remote) throw new Error('Failed to fetch conversation from cloud.');
    const messages = messagesToCached(remote.messages ?? []);
    await saveContextCache({
        conversationId: conversation.id,
        conversationName: conversation.name,
        messages,
        fetchedAt: Date.now(),
    });
    return messages;
};

/**
 * Resolve all context entries to a single context string that can be injected
 * before the current conversation's messages at send time.
 *
 * Resolution order per entry:
 *   1. Local (in-memory, from HomeContext conversations array) — always fresh
 *   2. IndexedDB cache — used for cloud conversations, with a fetch on a cold cache
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
        if (entry.mode === 'selected' && !entry.selectedMessageIds?.length) continue;

        const conversation = localConversations.find(c => c.id === entry.conversationId);
        let messages: CachedConversationMessage[] = [];
        if (conversation && isLocalConversation(conversation)) {
            messages = messagesToCached(conversationWithUncompressedMessages(conversation).messages);
        } else {
            const cached = await loadContextCache(entry.conversationId);
            if (cached) messages = cached.messages;
            else if (conversation) {
                try {
                    messages = await fetchAndCacheConversationContext(conversation);
                } catch {
                    // The source chat may have been deleted or become unavailable.
                    continue;
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
