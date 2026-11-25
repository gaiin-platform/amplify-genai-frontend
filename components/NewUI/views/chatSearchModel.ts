/**
 * chatSearchModel — text search for the "Chats and tasks" view.
 *
 * No React — pure functions over Conversation objects.
 *
 * A conversation matches when the query is found in its name or, for local
 * conversations, in its message content (remote conversations carry no messages
 * here, so only their names are searchable — same as the classic Chatbar).
 *
 * Reading message content means decompressing the stored blob, which is slow for
 * long chats. So the name is checked first, and the lowercase content is built
 * only when a conversation's name does not match, then cached against the
 * compressedMessages array. That array is replaced whenever the messages change,
 * so a changed conversation is re-read and an unchanged one never is.
 */
import { Conversation, Message } from '@/types/chat';
import { isLocalConversation } from '@/utils/app/conversation';
import { uncompressMessages } from '@/utils/app/messages';

/** How long typing must pause before the content search runs. */
export const CHAT_SEARCH_DEBOUNCE_MS = 250;

export interface ChatSearchIndex {
    /** `query` must already be trimmed and lowercased; an empty query matches everything. */
    matches: (conversation: Conversation, query: string) => boolean;
}

export function createChatSearchIndex(
    readMessages: (compressed: number[]) => Message[] = uncompressMessages,
): ChatSearchIndex {
    const contentCache = new WeakMap<number[], string>();

    const contentOf = (conversation: Conversation): string => {
        if (!isLocalConversation(conversation)) return '';
        const compressed = conversation.compressedMessages;
        if (!compressed || compressed.length === 0) return '';
        let content = contentCache.get(compressed);
        if (content === undefined) {
            const messages = readMessages(compressed);
            content = messages ? messages.map((m) => m.content).join(' ').toLowerCase() : '';
            contentCache.set(compressed, content);
        }
        return content;
    };

    const matches = (conversation: Conversation, query: string): boolean => {
        if (!query) return true;
        const name = conversation.name.toLowerCase();
        if (name.includes(query)) return true;
        const content = contentOf(conversation);
        if (content.includes(query)) return true;
        // The searched text is name + ' ' + content, so a query containing a space
        // can also match across that join.
        if (query.length < 2 || !query.includes(' ')) return false;
        const edge = query.length - 1;
        return (name.slice(-edge) + ' ' + content.slice(0, edge)).includes(query);
    };

    return { matches };
}

/** Filters `list` by the raw text from the search box; an empty or blank query returns `list` as is. */
export function searchConversations(
    index: ChatSearchIndex,
    list: Conversation[],
    rawQuery: string,
): Conversation[] {
    const query = rawQuery.trim().toLowerCase();
    if (!query) return list;
    return list.filter((c) => index.matches(c, query));
}
