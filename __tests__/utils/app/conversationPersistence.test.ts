import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  storageSet: vi.fn(),
  deleteRemote: vi.fn(),
  deleteCodeInterpreter: vi.fn(),
}));

vi.mock('@/utils/app/storage', () => ({ storageSet: mocks.storageSet }));
vi.mock('@/services/remoteConversationService', () => ({ deleteRemoteConversation: mocks.deleteRemote }));
vi.mock('@/services/codeInterpreterService', () => ({ deleteCodeInterpreterConversation: mocks.deleteCodeInterpreter }));

type Conv = typeof import('@/utils/app/conversation');
let conv: Conv;

const chat = (id: string, extra: Record<string, unknown> = {}) =>
  ({ id, name: `chat ${id}`, messages: [{ id: 'm1', role: 'user', content: 'hello' }], folderId: null, ...extra }) as any;

describe('writing the conversation history', () => {
  beforeEach(async () => {
    vi.resetModules();
    mocks.storageSet.mockReset().mockResolvedValue(undefined);
    vi.stubGlobal('alert', vi.fn());
    conv = await import('@/utils/app/conversation');
  });

  it('resolves true when the write landed', async () => {
    expect(await conv.saveConversationsAsync([chat('a')])).toBe(true);
    expect(mocks.storageSet).toHaveBeenCalledWith('conversationHistory', expect.any(String));
  });

  it('resolves FALSE and tells the user when the browser refused the write', async () => {
    mocks.storageSet.mockRejectedValue(new Error('QuotaExceededError'));
    expect(await conv.saveConversationsAsync([chat('a')])).toBe(false);
    expect(alert).toHaveBeenCalledTimes(1);
    // not once per save: the same wall would be hit again on every write
    await conv.saveConversationsAsync([chat('a')]);
    expect(alert).toHaveBeenCalledTimes(1);
  });

  it('refuses to write at all once the stored history could not be read at startup', async () => {
    conv.blockConversationHistoryWrites();
    expect(await conv.saveConversationsAsync([])).toBe(false);
    expect(mocks.storageSet).not.toHaveBeenCalled();
  });
});

describe('putting a chat back into the list', () => {
  beforeEach(async () => {
    vi.resetModules();
    mocks.deleteRemote.mockReset();
    mocks.deleteCodeInterpreter.mockReset();
    conv = await import('@/utils/app/conversation');
  });

  it('re-adds a chat that a sync dropped while it was streaming', () => {
    const list = [chat('a')];
    expect(conv.upsertConversationEntry(list, chat('b')).map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('replaces the entry with the same id', () => {
    const result = conv.upsertConversationEntry([chat('a')], chat('a', { name: 'renamed' }));
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('renamed');
  });

  it('does NOT bring back a chat the user deleted while its answer was still streaming', () => {
    conv.deleteConversationCleanUp(chat('gone', { isLocal: true }));
    const list = [chat('a')];
    expect(conv.upsertConversationEntry(list, chat('gone'))).toBe(list);
    expect(conv.updateConversation(chat('gone'), list).all.map((c) => c.id)).toEqual(['a']);
  });

  it('can be recreated on purpose', () => {
    conv.deleteConversationCleanUp(chat('x', { isLocal: true }));
    conv.forgetDeletedConversation('x');
    expect(conv.upsertConversationEntry([], chat('x')).map((c) => c.id)).toEqual(['x']);
  });
});

describe('cloud stubs and unreadable data', () => {
  beforeEach(async () => {
    vi.resetModules();
    conv = await import('@/utils/app/conversation');
  });

  it('a cloud stub remembers how many messages the chat has (so it is not taken for an empty placeholder)', () => {
    const stub = conv.remoteForConversationHistory(chat('c', { isLocal: false, messages: [{ content: 'a' }, { content: 'b' }] }));
    expect(stub.messages).toEqual([]);
    expect(stub.messageCount).toBe(2);
    // a stub built from a stub keeps the count
    expect(conv.remoteForConversationHistory(stub).messageCount).toBe(2);
  });

  it('keeps a known count of 0 (a blank new chat) but never invents one for a stub of unknown size', () => {
    const blank = conv.remoteForConversationHistory(chat('n', { isLocal: false, messages: [], messageCount: 0 }));
    expect(blank.messageCount).toBe(0);

    const unknown = conv.remoteForConversationHistory(chat('u', { isLocal: false, messages: [] }));
    expect(unknown.messageCount).toBeUndefined();

    // once it has messages the real count wins over the old marker
    const written = conv.remoteForConversationHistory(chat('w', { isLocal: false, messageCount: 0, messages: [{ content: 'a' }] }));
    expect(written.messageCount).toBe(1);
  });

  it('keeps the raw blob when stored messages cannot be decoded, instead of showing an empty chat that would overwrite it', () => {
    const broken = { id: 'b', name: 'b', isLocal: true, messages: [], compressedMessages: [999999, 1, 2] } as any;
    const opened = conv.conversationWithUncompressedMessages(broken);
    expect(opened.messages).toEqual([]);
    expect(opened.corruptCompressedMessages).toEqual([999999, 1, 2]);
    // saving it again does not throw the blob away
    const saved = conv.conversationWithCompressedMessages(opened);
    expect(saved.corruptCompressedMessages).toEqual([999999, 1, 2]);
  });

  it('round-trips non-latin messages through the stored (compressed) form', () => {
    const original = chat('r', { isLocal: true, messages: [{ id: '1', role: 'user', content: 'Привет U+0041 😀 zażółć' }] });
    const stored = conv.conversationWithCompressedMessages(original);
    expect(stored.messages).toEqual([]);
    expect(conv.conversationWithUncompressedMessages(stored).messages).toEqual(original.messages);
  });

  it('never turns real messages into an empty chat when compression fails', () => {
    const circular: any = { id: '1', role: 'user', content: 'x' };
    circular.self = circular; // JSON.stringify throws
    const original = chat('f', { isLocal: true, messages: [circular] });
    const result = conv.conversationWithCompressedMessages(original);
    expect(result.messages).toHaveLength(1);
  });
});

describe('telling other tabs about a write', () => {
  beforeEach(async () => {
    vi.resetModules();
    mocks.storageSet.mockReset().mockResolvedValue(undefined);
    conv = await import('@/utils/app/conversation');
  });

  const tick = () => new Promise((resolve) => setTimeout(resolve, 30));

  it('does not call back for this tab\'s own writes, but does for another tab\'s', async () => {
    const callback = vi.fn();
    const stop = conv.onConversationHistoryChangedInOtherTab(callback);

    await conv.saveConversationsAsync([chat('a')]);
    await tick();
    expect(callback).not.toHaveBeenCalled(); // a second channel object in the SAME tab also receives the post

    const otherTab = new BroadcastChannel('amplify-conversation-history');
    otherTab.postMessage({ tab: 'some-other-tab', type: 'updated' });
    await tick();
    expect(callback).toHaveBeenCalledTimes(1);

    otherTab.close();
    stop();
  });
});
