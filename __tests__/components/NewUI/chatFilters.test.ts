/**
 * Tests for shared/chatFilters — the filter/sort vocabulary shared by the
 * "Chats and tasks" view and the sidebar Recents section.
 *
 * These cover the behaviours that are easy to get subtly wrong:
 *   - a filter group is only offered when it can actually discriminate
 *     (cloud-only lists must not show an Assistant filter that can never match,
 *     because remoteForConversationHistory() strips `promptTemplate`)
 *   - a stale value for a group that is no longer offered must not filter invisibly
 *   - conversations with no assistant always sort last, in both directions
 */
import { describe, it, expect } from 'vitest';
import { Conversation } from '@/types/chat';
import {
    CHAT_FILTER_DEFAULTS,
    applyChatFilters,
    buildChatFilterGroups,
    compareConversations,
    compareConversationsByMode,
    conversationAssistantName,
    countActiveChatFilters,
    isPinnedConv,
    isBlankPlaceholderConversation,
} from '@/components/NewUI/shared/chatFilters';

const conv = (over: Partial<Conversation> & { id: string; name: string }): Conversation =>
    ({
        messages: [],
        model: {} as any,
        folderId: null,
        ...over,
    }) as Conversation;

/** A conversation started from an assistant, as handleStartConversationWithPrompt builds it. */
const withAssistant = (id: string, name: string, assistantName: string, extra: Partial<Conversation> = {}) =>
    conv({
        id,
        name,
        promptTemplate: {
            id: 'p-' + id,
            name: assistantName,
            data: { assistant: { definition: { name: assistantName } } },
        } as any,
        ...extra,
    });

const local = (id: string, name: string, date?: string) =>
    conv({ id, name, isLocal: true, date });
const cloud = (id: string, name: string, date?: string) =>
    conv({ id, name, isLocal: false, date });

describe('isPinnedConv', () => {
    it('reads data.pinned and the legacy top-level flag', () => {
        expect(isPinnedConv(conv({ id: '1', name: 'a', data: { pinned: true } }))).toBe(true);
        expect(isPinnedConv({ ...conv({ id: '2', name: 'b' }), pinned: true } as any)).toBe(true);
        expect(isPinnedConv(conv({ id: '3', name: 'c' }))).toBe(false);
        expect(isPinnedConv(conv({ id: '4', name: 'd', data: { pinned: false } }))).toBe(false);
    });
});

describe('conversationAssistantName', () => {
    it('resolves the assistant name from promptTemplate', () => {
        expect(conversationAssistantName(withAssistant('1', 'chat', 'Grant Helper'))).toBe('Grant Helper');
    });

    it('returns null for a plain chat and for a non-assistant prompt template', () => {
        expect(conversationAssistantName(local('1', 'chat'))).toBeNull();
        expect(
            conversationAssistantName(conv({ id: '2', name: 'chat', promptTemplate: { id: 'p', name: 'tpl' } as any }))
        ).toBeNull();
    });
});

describe('buildChatFilterGroups', () => {
    it('offers Storage only when the list actually contains cloud conversations', () => {
        const localOnly = buildChatFilterGroups([local('1', 'a'), local('2', 'b')]);
        expect(localOnly.map((g) => g.id)).toEqual(['pinned']);

        const mixed = buildChatFilterGroups([local('1', 'a'), cloud('2', 'b')]);
        expect(mixed.map((g) => g.id)).toEqual(['pinned', 'storage']);
    });

    it('hides the Assistant group when no assistant can be resolved (cloud-only list)', () => {
        const groups = buildChatFilterGroups([cloud('1', 'a'), cloud('2', 'b')]);
        expect(groups.some((g) => g.id === 'assistant')).toBe(false);
    });

    it('offers the Assistant group as soon as one conversation resolves one', () => {
        const groups = buildChatFilterGroups([local('1', 'a'), withAssistant('2', 'b', 'Tutor')]);
        expect(groups.some((g) => g.id === 'assistant')).toBe(true);
    });

    it('honours includePinned / includeSort (sidebar configuration)', () => {
        const groups = buildChatFilterGroups([local('1', 'a')], {
            includePinned: false,
            includeSort: true,
        });
        expect(groups.map((g) => g.id)).toEqual(['sort']);
        expect(groups[0].options.map((o) => o.id)).toEqual(['recent', 'oldest', 'name']);
    });
});

describe('applyChatFilters', () => {
    const list = [
        conv({ id: '1', name: 'pinned local', isLocal: true, data: { pinned: true } }),
        local('2', 'plain local'),
        cloud('3', 'plain cloud'),
        withAssistant('4', 'assistant chat', 'Tutor', { isLocal: true }),
    ];
    const groups = buildChatFilterGroups(list);

    it('returns everything at the defaults', () => {
        expect(applyChatFilters(list, CHAT_FILTER_DEFAULTS, groups)).toHaveLength(4);
    });

    it('filters to pinned only', () => {
        const out = applyChatFilters(list, { ...CHAT_FILTER_DEFAULTS, pinned: 'pinned' }, groups);
        expect(out.map((c) => c.id)).toEqual(['1']);
    });

    it('splits cloud from local', () => {
        expect(
            applyChatFilters(list, { ...CHAT_FILTER_DEFAULTS, storage: 'cloud' }, groups).map((c) => c.id)
        ).toEqual(['3']);
        expect(
            applyChatFilters(list, { ...CHAT_FILTER_DEFAULTS, storage: 'local' }, groups).map((c) => c.id)
        ).toEqual(['1', '2', '4']);
    });

    it('splits with/without assistant', () => {
        expect(
            applyChatFilters(list, { ...CHAT_FILTER_DEFAULTS, assistant: 'with' }, groups).map((c) => c.id)
        ).toEqual(['4']);
        expect(
            applyChatFilters(list, { ...CHAT_FILTER_DEFAULTS, assistant: 'without' }, groups).map((c) => c.id)
        ).toEqual(['1', '2', '3']);
    });

    it('composes multiple filters', () => {
        const out = applyChatFilters(
            list,
            { ...CHAT_FILTER_DEFAULTS, storage: 'local', assistant: 'without' },
            groups
        );
        expect(out.map((c) => c.id)).toEqual(['1', '2']);
    });

    it('ignores a value whose group is no longer offered', () => {
        // Sidebar config: no "pinned" group, so a stale pinned=pinned must not apply
        const sidebarGroups = buildChatFilterGroups(list, { includePinned: false, includeSort: true });
        const out = applyChatFilters(list, { ...CHAT_FILTER_DEFAULTS, pinned: 'pinned' }, sidebarGroups);
        expect(out).toHaveLength(4);
    });
});

describe('countActiveChatFilters', () => {
    const list = [local('1', 'a'), cloud('2', 'b')];
    const groups = buildChatFilterGroups(list);

    it('counts only offered groups that differ from their default', () => {
        expect(countActiveChatFilters(CHAT_FILTER_DEFAULTS, groups)).toBe(0);
        expect(countActiveChatFilters({ ...CHAT_FILTER_DEFAULTS, storage: 'cloud' }, groups)).toBe(1);
        expect(
            countActiveChatFilters({ ...CHAT_FILTER_DEFAULTS, storage: 'cloud', pinned: 'pinned' }, groups)
        ).toBe(2);
        // 'assistant' is not offered for this list, so a stale value must not count
        expect(countActiveChatFilters({ ...CHAT_FILTER_DEFAULTS, assistant: 'with' }, groups)).toBe(0);
    });
});

describe('compareConversations', () => {
    it('sorts by date, newest first when descending', () => {
        const list = [
            local('old', 'old', '2024-01-01T00:00:00.000Z'),
            local('new', 'new', '2024-06-01T00:00:00.000Z'),
        ];
        expect([...list].sort(compareConversations('date', 'desc')).map((c) => c.id)).toEqual(['new', 'old']);
        expect([...list].sort(compareConversations('date', 'asc')).map((c) => c.id)).toEqual(['old', 'new']);
    });

    it('sorts undated conversations as oldest', () => {
        const list = [local('undated', 'undated'), local('dated', 'dated', '2024-06-01T00:00:00.000Z')];
        expect([...list].sort(compareConversations('date', 'desc')).map((c) => c.id)).toEqual([
            'dated',
            'undated',
        ]);
    });

    it('sorts by name case-insensitively and numerically', () => {
        const list = [local('3', 'Report 10'), local('1', 'apple'), local('2', 'Report 2')];
        expect([...list].sort(compareConversations('name', 'asc')).map((c) => c.name)).toEqual([
            'apple',
            'Report 2',
            'Report 10',
        ]);
    });

    it('keeps conversations without an assistant last in both directions', () => {
        const list = [
            local('plain', 'plain'),
            withAssistant('b', 'b', 'Zeta'),
            withAssistant('a', 'a', 'Alpha'),
        ];
        expect([...list].sort(compareConversations('assistant', 'asc')).map((c) => c.id)).toEqual([
            'a',
            'b',
            'plain',
        ]);
        expect([...list].sort(compareConversations('assistant', 'desc')).map((c) => c.id)).toEqual([
            'b',
            'a',
            'plain',
        ]);
    });

    it('breaks ties on name so the order is stable', () => {
        const same = '2024-06-01T00:00:00.000Z';
        const list = [local('2', 'beta', same), local('1', 'alpha', same)];
        expect([...list].sort(compareConversations('date', 'desc')).map((c) => c.name)).toEqual([
            'alpha',
            'beta',
        ]);
    });
});

describe('compareConversationsByMode', () => {
    const list = [
        local('mid', 'b', '2024-03-01T00:00:00.000Z'),
        local('new', 'c', '2024-06-01T00:00:00.000Z'),
        local('old', 'a', '2024-01-01T00:00:00.000Z'),
    ];

    it('maps the sidebar sort options onto the shared comparator', () => {
        expect([...list].sort(compareConversationsByMode('recent')).map((c) => c.id)).toEqual([
            'new',
            'mid',
            'old',
        ]);
        expect([...list].sort(compareConversationsByMode('oldest')).map((c) => c.id)).toEqual([
            'old',
            'mid',
            'new',
        ]);
        expect([...list].sort(compareConversationsByMode('name')).map((c) => c.name)).toEqual([
            'a',
            'b',
            'c',
        ]);
    });
});

describe('isBlankPlaceholderConversation', () => {
    it('matches an untouched placeholder from app startup / New Chat', () => {
        expect(isBlankPlaceholderConversation(conv({ id: 'a', name: 'New Conversation' }))).toBe(true);
        // A conversation whose name was never set at all is equally contentless.
        expect(isBlankPlaceholderConversation(conv({ id: 'b', name: '' }))).toBe(true);
    });

    it('never matches a conversation that holds messages in either representation', () => {
        expect(
            isBlankPlaceholderConversation(
                conv({
                    id: 'c',
                    name: 'New Conversation',
                    messages: [{ role: 'user', content: 'hi', id: 'm1' } as any],
                })
            )
        ).toBe(false);

        // Local conversations keep content in compressedMessages with messages: [].
        expect(
            isBlankPlaceholderConversation(
                conv({ id: 'd', name: 'New Conversation', compressedMessages: [1, 2, 3] })
            )
        ).toBe(false);
    });

    it('never matches a renamed conversation', () => {
        expect(isBlankPlaceholderConversation(conv({ id: 'e', name: 'Budget planning' }))).toBe(false);
    });

    it('never matches something the user deliberately marked or attached to', () => {
        expect(
            isBlankPlaceholderConversation(
                conv({ id: 'f', name: 'New Conversation', data: { pinned: true } })
            )
        ).toBe(false);
        expect(
            isBlankPlaceholderConversation(conv({ id: 'g', name: 'New Conversation', tags: ['work'] }))
        ).toBe(false);
        expect(
            isBlankPlaceholderConversation(
                conv({ id: 'h', name: 'New Conversation', artifacts: { a1: [] as any } })
            )
        ).toBe(false);
        expect(
            isBlankPlaceholderConversation(
                conv({ id: 'i', name: 'New Conversation', codeInterpreterRecordId: 'rec-1' })
            )
        ).toBe(false);
    });
});
