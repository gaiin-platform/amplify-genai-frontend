/**
 * Tests for shared/lastViewedChat — the "refresh puts me back in the chat I was
 * reading" vocabulary.
 *
 * The bug these exist to pin down: `conversation.messages` is not a reliable measure of
 * "does this chat have content?" for a record out of `state.conversations`. Three shapes
 * live in that one array — local/compressed (`messages: []` + `compressedMessages`),
 * cloud metadata (`messages` MISSING, written by updateWithRemoteConversations without
 * cleanConversationHistory's backfill), and full. Testing `messages.length > 0` refused
 * every local chat (the feature did nothing) and let an unknown-shaped cloud record
 * through to home.tsx's render, where `messages.length` threw.
 *
 * So the cases below are mostly about telling *empty* apart from *unknown*:
 *   - only the chat view is remembered; every other page CLEARS
 *   - an empty chat CLEARS (a refresh there must still show the landing page)
 *   - an unknown/compressed message state is KEPT, never cleared — clearing on unknown is
 *     how the feature silently stops working for cloud-storage users
 *   - a restored conversation always comes back with `messages` as an array
 */
import { describe, it, expect } from 'vitest';
import { Conversation } from '@/types/chat';
import {
    LAST_CHAT_KEY,
    findRestorableConversation,
    nextRecordedChat,
} from '@/components/NewUI/shared/lastViewedChat';

const conv = (over: Partial<Conversation> & { id: string }): Conversation =>
    ({
        name: 'Conversation',
        messages: [],
        model: {} as any,
        folderId: null,
        ...over,
    }) as Conversation;

const msg = (content: string) => ({ role: 'user', content, id: content } as any);

/** Shape 1: a full conversation, as a send leaves it in state. */
const full = (id: string, extra: Partial<Conversation> = {}) =>
    conv({ id, messages: [msg('hi'), msg('hello')], ...extra });

/** Shape 2: local history — content lives in compressedMessages, messages is []. */
const compressed = (id: string, extra: Partial<Conversation> = {}) =>
    conv({ id, messages: [], compressedMessages: [1, 2, 3] as any, ...extra });

/**
 * Shape 3: cloud metadata, exactly as updateWithRemoteConversations writes it — no
 * `messages` key at all. Built with a cast on purpose: a fixture built from the
 * Conversation interface cannot reproduce the missing field (NEW_UI_GUIDE §17).
 */
const cloudMeta = (id: string) =>
    ({ id, name: 'Cloud chat', model: {}, folderId: null, isLocal: false } as unknown as Conversation);

describe('LAST_CHAT_KEY', () => {
    it('is a stable key name (a rename silently breaks restore across a deploy)', () => {
        expect(LAST_CHAT_KEY).toBe('amplify_last_chat_id');
    });
});

describe('nextRecordedChat', () => {
    it('records the conversation being read in the chat view', () => {
        expect(nextRecordedChat('chat', full('c1'))).toEqual({ action: 'record', id: 'c1' });
    });

    it('clears on the new-chat view — a zero-message conversation is the landing page', () => {
        expect(nextRecordedChat('chat', conv({ id: 'blank' }))).toEqual({ action: 'clear' });
    });

    it('clears on every non-chat page so those refreshes are unchanged', () => {
        const c = full('c1');
        for (const page of ['home', 'chats', 'library', 'assistantGallery', 'scheduledTasks', 'workflows', 'notebook']) {
            expect(nextRecordedChat(page, c)).toEqual({ action: 'clear' });
        }
    });

    it('clears when there is no conversation at all', () => {
        expect(nextRecordedChat('chat', null)).toEqual({ action: 'clear' });
        expect(nextRecordedChat('chat', undefined)).toEqual({ action: 'clear' });
    });

    it('KEEPS a stored id when the message state is unknown (missing messages field)', () => {
        // Clearing here would delete a good id on the strength of a shape that says
        // nothing about emptiness — the cloud-storage regression.
        expect(nextRecordedChat('chat', cloudMeta('c1'))).toEqual({ action: 'keep' });
    });

    it('KEEPS a stored id for a still-compressed conversation', () => {
        expect(nextRecordedChat('chat', compressed('c1'))).toEqual({ action: 'keep' });
    });
});

describe('findRestorableConversation', () => {
    const history = [
        full('local-full'),
        compressed('local-compressed'),
        conv({ id: 'local-blank' }),
        cloudMeta('cloud-meta'),
        conv({ id: 'cloud-blank', isLocal: false }),
        full('cloud-full', { isLocal: false }),
    ];

    it('restores a full local conversation', () => {
        expect(findRestorableConversation('local-full', history)?.id).toBe('local-full');
    });

    it('restores a local conversation whose content is only in compressedMessages', () => {
        // The regression: messages.length is 0 for every local chat in history, so a
        // length test refused all of them and the feature did nothing.
        const found = findRestorableConversation('local-compressed', history);
        expect(found?.id).toBe('local-compressed');
        expect(found?.compressedMessages).toBeDefined();
    });

    it('refuses a local placeholder — reopening it would show the landing page anyway', () => {
        expect(findRestorableConversation('local-blank', history)).toBeNull();
    });

    it('restores cloud metadata and guarantees messages is an array', () => {
        // home.tsx renders selectedConversation.messages.length; a missing field there is
        // an unhandled TypeError, so the record must never leave here unnormalized.
        const found = findRestorableConversation('cloud-meta', history);
        expect(found?.id).toBe('cloud-meta');
        expect(Array.isArray(found?.messages)).toBe(true);
        expect(found?.messages).toHaveLength(0);
    });

    it('restores a cloud conversation with an empty local messages array', () => {
        // Messages live server-side and are fetched by handleSelectConversation.
        expect(findRestorableConversation('cloud-blank', history)?.id).toBe('cloud-blank');
    });

    it('restores a cloud conversation that does carry local messages', () => {
        expect(findRestorableConversation('cloud-full', history)?.id).toBe('cloud-full');
    });

    it('returns the original object untouched when messages already exists', () => {
        const found = findRestorableConversation('local-full', history);
        expect(found).toBe(history[0]);
    });

    it('restores nothing when the id is gone from history (deleted conversation)', () => {
        expect(findRestorableConversation('deleted-id', history)).toBeNull();
    });

    it('restores nothing without an id or without history', () => {
        expect(findRestorableConversation(null, history)).toBeNull();
        expect(findRestorableConversation('', history)).toBeNull();
        expect(findRestorableConversation('local-full', [])).toBeNull();
        expect(findRestorableConversation('local-full', null)).toBeNull();
    });
});
