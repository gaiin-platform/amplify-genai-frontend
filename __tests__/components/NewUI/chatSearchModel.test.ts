/**
 * Tests for views/chatSearchModel — the "Chats and tasks" search.
 *
 * The search must give the same results as the original filter (name + ' ' +
 * decompressed content, lowercased, substring match), while not decompressing a
 * conversation whose name already matches and not decompressing the same
 * unchanged conversation twice.
 */
import { describe, it, expect } from 'vitest';
import { Conversation, Message } from '@/types/chat';
import { compressMessages, uncompressMessages } from '@/utils/app/messages';
import { isLocalConversation } from '@/utils/app/conversation';
import {
    CHAT_SEARCH_DEBOUNCE_MS,
    createChatSearchIndex,
    searchConversations,
} from '@/components/NewUI/views/chatSearchModel';

const msg = (content: string): Message => ({ role: 'user', content } as Message);

const local = (id: string, name: string, contents: string[]): Conversation =>
    ({
        id,
        name,
        model: {} as any,
        folderId: null,
        messages: [],
        compressedMessages: compressMessages(contents.map(msg)),
    } as unknown as Conversation);

const remote = (id: string, name: string): Conversation =>
    ({ id, name, model: {} as any, folderId: null, messages: [], isLocal: false } as unknown as Conversation);

/** The filter the view used before this module existed. */
const originalFilter = (list: Conversation[], search: string) => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) => {
        let messages = '';
        if (isLocalConversation(c)) {
            const uncompressedMs = uncompressMessages(c.compressedMessages ?? []);
            if (uncompressedMs) messages = uncompressedMs.map((m) => m.content).join(' ');
        }
        const searchable = c.name.toLowerCase() + ' ' + messages;
        return searchable.toLowerCase().includes(q);
    });
};

const countingReader = () => {
    const calls: number[][] = [];
    const read = (compressed: number[]) => {
        calls.push(compressed);
        return uncompressMessages(compressed);
    };
    return { read, calls };
};

describe('chatSearchModel', () => {
    const list: Conversation[] = [
        local('a', 'Budget Planning', ['Quarterly numbers', 'Ask about the Travel fund']),
        local('b', 'Recipe ideas', ['Pasta with garlic', 'and lemon']),
        local('c', 'Trip', ['Paris in May']),
        local('d', 'Empty local', []),
        remote('e', 'Cloud Notes'),
        remote('f', 'Cloud travel log'),
    ];

    it('sets the search delay to 250 ms', () => {
        expect(CHAT_SEARCH_DEBOUNCE_MS).toBe(250);
    });

    it('gives the same results as the original filter for settled queries', () => {
        const queries = [
            '', '   ', 'budget', 'BUDGET', '  travel ', 'travel fund', 'garlic and', 'garlic  and',
            'trip paris', 'planning quarterly', 'ideas pasta', 'notes', 'cloud', 'local',
            'empty local', 'zzz', 'a', ' ', 'p', 'numbers ask', 'g quarterly', 's paris',
        ];
        for (const q of queries) {
            const index = createChatSearchIndex();
            expect(searchConversations(index, list, q).map((c) => c.id), `query "${q}"`).toEqual(
                originalFilter(list, q).map((c) => c.id),
            );
        }
    });

    it('matches a query that spans the name and the first message', () => {
        const index = createChatSearchIndex();
        expect(searchConversations(index, list, 'trip paris').map((c) => c.id)).toEqual(['c']);
        expect(searchConversations(index, list, 'trip pariss')).toEqual([]);
    });

    it('does not search remote conversations by content', () => {
        const withStaleBlob = {
            ...remote('r', 'Remote chat'),
            compressedMessages: compressMessages([msg('secret words')]),
        } as Conversation;
        const index = createChatSearchIndex();
        expect(searchConversations(index, [withStaleBlob], 'secret')).toEqual([]);
    });

    it('does not decompress a conversation whose name matches', () => {
        const { read, calls } = countingReader();
        const index = createChatSearchIndex(read);
        expect(searchConversations(index, list, 'budget').map((c) => c.id)).toEqual(['a']);
        // Only the conversations whose name did not match were read: b, c (d is empty, e/f are remote).
        expect(calls).toHaveLength(2);
        expect(calls).not.toContain(list[0].compressedMessages);
    });

    it('decompresses each unchanged conversation once across keystrokes', () => {
        const { read, calls } = countingReader();
        const index = createChatSearchIndex(read);
        for (const q of ['p', 'pa', 'par', 'pari', 'paris']) {
            searchConversations(index, list, q);
        }
        expect(calls).toHaveLength(new Set(calls).size);
        expect(calls.length).toBeLessThanOrEqual(3);
    });

    it('re-reads a conversation after its messages change', () => {
        const { read, calls } = countingReader();
        const index = createChatSearchIndex(read);
        const before = local('x', 'Chat', ['hello']);
        expect(searchConversations(index, [before], 'world')).toEqual([]);

        const after = { ...before, compressedMessages: compressMessages([msg('hello'), msg('world')]) };
        expect(searchConversations(index, [after], 'world').map((c) => c.id)).toEqual(['x']);
        expect(calls).toHaveLength(2);
    });

    it('returns the same list for an empty query without reading anything', () => {
        const { read, calls } = countingReader();
        const index = createChatSearchIndex(read);
        expect(searchConversations(index, list, '  ')).toBe(list);
        expect(calls).toHaveLength(0);
    });
});
