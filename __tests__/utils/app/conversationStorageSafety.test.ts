import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  saveResult: true as boolean,
  held: new Set<string>(),
  release: vi.fn(),
  cancelPending: vi.fn(),
  unsaved: new Map<string, any>(),
  fetchMultiple: vi.fn(),
  deleteMultiple: vi.fn(),
  deleteOne: vi.fn(),
  pendingDeletes: new Set<string>(),
  order: [] as string[],
}));

vi.mock('@/services/remoteConversationService', () => ({
  deleteMultipleRemoteConversations: (...a: any[]) => { mocks.order.push('delete'); return mocks.deleteMultiple(...a); },
  deleteRemoteConversation: mocks.deleteOne,
  fetchMultipleRemoteConversations: mocks.fetchMultiple,
  fetchRemoteConversation: vi.fn(),
  getPendingDeleteIds: async () => mocks.pendingDeletes,
  getUnsavedConversations: async () => mocks.unsaved,
  getKnownRemoteVersion: () => undefined,
  hasPendingUpload: () => false,
  cancelPendingUpload: mocks.cancelPending,
  getHeldBlankConversationIds: async () => mocks.held,
  releaseHeldBlankConversations: mocks.release,
  uploadConversation: vi.fn(),
}));
vi.mock('@/utils/app/storage', () => ({ storageGet: vi.fn(async () => null) }));
vi.mock('@/utils/app/conversation', () => ({
  // mirrors the real function: an already compressed chat is returned as it is
  conversationWithCompressedMessages: (c: any) => (!c.messages?.length && c.compressedMessages) ? c : ({ ...c, messages: [], compressedMessages: c.messages?.map((m: any) => m.content) ?? [] }),
  conversationWithUncompressedMessages: (c: any) => c,
  isLocalConversation: (c: any) => !('isLocal' in c) || c.isLocal,
  isRemoteConversation: (c: any) => 'isLocal' in c && !c.isLocal,
  remoteForConversationHistory: (c: any) => ({ id: c.id, name: c.name, isLocal: false, messages: [] }),
  saveConversations: vi.fn(),
  isConversationDeleted: () => false,
  saveConversationsAsync: async () => { mocks.order.push('saved-locally'); return mocks.saveResult; },
}));
vi.mock('@/utils/app/basePrompts', () => ({ baseAgentFolder: { id: 'agents' } }));

import {
  handleStorageSelection,
  reconcileSelectedAfterStorageChange,
  updateWithRemoteConversations,
} from '@/utils/app/conversationStorage';

const stub = (id: string, extra: Record<string, unknown> = {}) => ({ id, name: `chat ${id}`, isLocal: false, messages: [], folderId: null, ...extra }) as any;
const full = (id: string) => ({ id, name: `chat ${id}`, messages: [{ content: `body ${id}` }], folderId: null }) as any;
const stats = { moveConversationFromRemoteEvent: vi.fn(), moveConversationRemoteEvent: vi.fn() };

describe('moving every chat to local storage', () => {
  beforeEach(() => {
    mocks.fetchMultiple.mockReset();
    mocks.deleteMultiple.mockReset().mockResolvedValue(true);
    mocks.deleteOne.mockReset();
    mocks.order.length = 0;
    mocks.saveResult = true;
    mocks.unsaved.clear();
    mocks.held.clear();
    mocks.release.mockReset();
    mocks.cancelPending.mockReset();
    vi.stubGlobal('alert', vi.fn());
  });

  it('deletes only the cloud chats that were downloaded, and only after saving them locally', async () => {
    mocks.fetchMultiple.mockResolvedValue({ data: [full('ok')], failed: ['broken'], failedByNoSuchKey: [] });

    const result = await handleStorageSelection('local-only', [stub('ok'), stub('broken')], [], stats);

    expect(mocks.deleteMultiple).toHaveBeenCalledWith(['ok']); // never 'broken'
    expect(mocks.order).toEqual(['saved-locally', 'delete']);
    const byId = Object.fromEntries((result ?? []).map((c: any) => [c.id, c]));
    expect(byId.ok.isLocal).toBe(true);
    expect(byId.broken.isLocal).toBe(false); // still a cloud chat
  });

  it('deletes nothing from the cloud when the download failed entirely', async () => {
    mocks.fetchMultiple.mockResolvedValue({ data: null });

    const result = await handleStorageSelection('local-only', [stub('a'), stub('b')], [], stats);

    expect(mocks.deleteMultiple).not.toHaveBeenCalled();
    expect(result?.map((c: any) => c.id).sort()).toEqual(['a', 'b']);
  });

  it('deletes NOTHING from the cloud when the local write failed (storage full / unavailable)', async () => {
    mocks.fetchMultiple.mockResolvedValue({ data: [full('a'), full('b')] });
    mocks.saveResult = false;

    const result = await handleStorageSelection('local-only', [stub('a'), stub('b')], [], stats);

    expect(mocks.deleteMultiple).not.toHaveBeenCalled();
    expect(mocks.deleteOne).not.toHaveBeenCalled();
    // the chats are returned unchanged: still cloud chats
    expect((result ?? []).every((c: any) => c.isLocal === false)).toBe(true);
  });

  it('uses the unsent local version of a chat instead of the older cloud copy', async () => {
    const newer = { ...full('a'), messages: [{ content: 'body a' }, { content: 'typed just now' }] };
    mocks.fetchMultiple.mockResolvedValue({ data: [full('a')] });
    mocks.unsaved.set('a', newer);

    const result = await handleStorageSelection('local-only', [stub('a')], [], stats);

    const entry = (result ?? []).find((c: any) => c.id === 'a') as any;
    expect(entry.compressedMessages).toEqual(['body a', 'typed just now']);
  });

  it('cancels queued uploads of the chats it moved to local, so they do not return to the cloud', async () => {
    mocks.fetchMultiple.mockResolvedValue({ data: [full('a')] });

    await handleStorageSelection('local-only', [stub('a')], [], stats);

    expect(mocks.cancelPending).toHaveBeenCalledWith('a');
  });

  it('falls back to the retrying per-chat delete if the bulk delete fails', async () => {
    mocks.fetchMultiple.mockResolvedValue({ data: [full('a'), full('b')] });
    mocks.deleteMultiple.mockResolvedValue(false);

    await handleStorageSelection('local-only', [stub('a'), stub('b')], [], stats);

    expect(mocks.deleteOne).toHaveBeenCalledTimes(2);
  });
});

describe('merging the cloud list into the local list', () => {
  const remote = (conversation: any, folder: any = null) => ({ conversation, folder });

  it('merges into the LIVE list, so chats created during the download survive', async () => {
    const dispatch = vi.fn();
    const staleSnapshot = [full('old')];
    const live = [full('old'), full('created-while-syncing')];

    await updateWithRemoteConversations([remote({ id: 'cloud1', name: 'c1', folderId: null })], staleSnapshot, [], dispatch, () => live);

    const ids = dispatch.mock.calls[0][0].value.map((c: any) => c.id);
    expect(ids).toEqual(['old', 'created-while-syncing', 'cloud1']);
  });

  it('never replaces a private/local chat that has messages with a cloud stub', async () => {
    const dispatch = vi.fn();
    const local = { ...full('mine'), isLocal: true, compressedMessages: ['x'] };

    await updateWithRemoteConversations([remote({ id: 'mine', name: 'stale cloud name', folderId: null })], [local], [], dispatch);

    const merged = dispatch.mock.calls[0]?.[0].value ?? [local];
    const entry = merged.find((c: any) => c.id === 'mine');
    expect(entry.isLocal).toBe(true);
    expect(entry.compressedMessages).toEqual(['x']);
  });

  it('does not bring back a chat whose cloud delete has not been confirmed', async () => {
    mocks.pendingDeletes.add('gone');
    const dispatch = vi.fn();

    const result = await updateWithRemoteConversations([remote({ id: 'gone', name: 'g', folderId: null })], [], [], dispatch);

    expect(dispatch).not.toHaveBeenCalled();
    expect(result.newfolders).toEqual([]);
    mocks.pendingDeletes.clear();
  });

  it('keeps date and code interpreter id that the list response lacks', async () => {
    const dispatch = vi.fn();
    const known = stub('x', { date: '2026-01-01T00:00:00Z', codeInterpreterRecordId: 'rec-1' });

    await updateWithRemoteConversations(
      [remote({ id: 'x', name: 'renamed', folderId: null, date: null, codeInterpreterRecordId: null })], [known], [], dispatch);

    const entry = dispatch.mock.calls[0][0].value[0];
    expect(entry.name).toBe('renamed');
    expect(entry.date).toBe('2026-01-01T00:00:00Z');
    expect(entry.codeInterpreterRecordId).toBe('rec-1');
  });
});

describe('open chat after a bulk storage change', () => {
  it('stays the full in-memory chat; only the storage fields come from the list', () => {
    const open = { ...full('c'), isLocal: true, folderId: null } as any;
    const listStub = stub('c', { folderId: 'f1' });

    const result = reconcileSelectedAfterStorageChange(open, [listStub]) as any;

    expect(result.messages).toHaveLength(1);
    expect(result.isLocal).toBe(false);
    expect(result.folderId).toBe('f1');
  });
});


describe('blank chats held only in this browser', () => {
  beforeEach(() => {
    mocks.held.clear();
    mocks.release.mockReset();
  });

  it('stops holding a blank chat once the cloud list contains it', async () => {
    const { updateWithRemoteConversations } = await import('@/utils/app/conversationStorage');
    mocks.held.add('blank-1');
    const remote = [
      { conversation: { id: 'blank-1', name: 'New Conversation', folderId: null }, folder: null },
      { conversation: { id: 'other', name: 'Other', folderId: null }, folder: null },
    ];

    await updateWithRemoteConversations(remote as any, [], [], vi.fn());

    expect(mocks.release).toHaveBeenCalledWith(['blank-1']);
  });

  it('does not touch anything when no held chat is in the cloud list', async () => {
    const { updateWithRemoteConversations } = await import('@/utils/app/conversationStorage');
    mocks.held.add('blank-1');

    await updateWithRemoteConversations([{ conversation: { id: 'other', name: 'Other', folderId: null }, folder: null }] as any, [], [], vi.fn());

    expect(mocks.release).not.toHaveBeenCalled();
  });
});

describe('bulk move result vs the live list', () => {
  it('keeps chats created while the move was running', async () => {
    const { mergeStorageChangeWithLiveList } = await import('@/utils/app/conversationStorage');
    const result = [full('a')];
    const live = [full('a'), full('new-during-move')];

    expect(mergeStorageChangeWithLiveList(result, live).map((c: any) => c.id)).toEqual(['a', 'new-during-move']);
  });
});
