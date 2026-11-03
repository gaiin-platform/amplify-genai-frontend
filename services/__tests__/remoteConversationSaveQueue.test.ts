import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  doRequestOp: vi.fn(),
  store: new Map<string, string>(),
  toastError: vi.fn(),
  toastDismiss: vi.fn(),
}));

vi.mock('@/services/doRequestOp', () => ({ doRequestOp: mocks.doRequestOp }));
// "compression" is just JSON in an array so the tests can inspect what was sent
vi.mock('@/utils/app/conversation', () => ({
  compressConversation: (c: unknown) => [JSON.stringify(c)] as unknown as number[],
  uncompressConversation: (a: any) => JSON.parse(a[0]),
  saveConversations: vi.fn(),
}));
vi.mock('@/utils/app/storage', () => ({
  storageGet: async (k: string) => mocks.store.get(k) ?? null,
  storageSet: async (k: string, v: string) => { mocks.store.set(k, v); },
  storageRemove: async (k: string) => { mocks.store.delete(k); },
  storageKeys: async (prefix: string) => Array.from(mocks.store.keys()).filter((k) => k.startsWith(prefix)),
}));
vi.mock('react-hot-toast', () => ({ default: { error: mocks.toastError, dismiss: mocks.toastDismiss } }));

type Svc = typeof import('@/services/remoteConversationService');
let svc: Svc;
const uploadConversation: Svc['uploadConversation'] = (...a) => svc.uploadConversation(...a);
const deleteRemoteConversation: Svc['deleteRemoteConversation'] = (...a) => svc.deleteRemoteConversation(...a);
const fetchRemoteConversation: Svc['fetchRemoteConversation'] = (...a) => svc.fetchRemoteConversation(...a);
const getPendingDeleteIds: Svc['getPendingDeleteIds'] = () => svc.getPendingDeleteIds();
const hasUnsavedConversations: Svc['hasUnsavedConversations'] = () => svc.hasUnsavedConversations();
const replayPendingConversationSync: Svc['replayPendingConversationSync'] = () => svc.replayPendingConversationSync();
const CONVERSATION_SAVE_CONFLICT_EVENT = 'conversationSaveConflict';

// retries use 1s + 3s + 8s; stay below the 30s background retry so the failing cases terminate
const settle = () => vi.advanceTimersByTimeAsync(20000);

const conv = (id: string, messages: string[], extra: Record<string, unknown> = {}) =>
  ({ id, name: `chat ${id}`, messages: messages.map((content) => ({ content })), folderId: null, ...extra }) as any;

const sentUploads = () =>
  mocks.doRequestOp.mock.calls
    .map(([op]) => op)
    .filter((op) => op.op === '/upload')
    .map((op) => ({ id: op.data.conversationId, expected: op.data.expectedVersion, conv: JSON.parse(op.data.conversation[0]) }));

describe('reliable conversation save queue', () => {
  let dispatched: any[];

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules(); // fresh queue state for every test
    svc = await import('@/services/remoteConversationService');
    svc.setConversationSyncUser('tester@x.edu'); // most tests run signed in
    mocks.store.clear();
    mocks.doRequestOp.mockReset();
    mocks.toastError.mockReset();
    dispatched = [];
    vi.stubGlobal('window', {
      addEventListener: vi.fn(),
      dispatchEvent: (e: any) => { dispatched.push(e); return true; },
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('retries a failed save and clears the pending record once acknowledged', async () => {
    mocks.doRequestOp
      .mockResolvedValueOnce({ success: false, message: 'Network Error' })
      .mockResolvedValueOnce({ success: false, message: 'Network Error' })
      .mockResolvedValue({ success: true, version: 111 });

    const promise = uploadConversation(conv('a', ['hi']), []);
    await settle();

    expect(await promise).toBe(true);
    expect(sentUploads()).toHaveLength(3);
    expect(hasUnsavedConversations()).toBe(false);
    expect(Array.from(mocks.store.keys()).some((k) => k.startsWith('pendingConversationUpload:'))).toBe(false);
  });

  describe('before anyone is signed in (login page)', () => {
    beforeEach(() => svc.setConversationSyncUser(null));

    it('sends nothing, shows no error and stores no retry record', async () => {
      mocks.doRequestOp.mockResolvedValue({ success: false, message: 'not signed in' });

      const saved = await uploadConversation(conv('startup', []), []);
      await settle();

      expect(saved).toBe(false);
      expect(mocks.doRequestOp).not.toHaveBeenCalled();
      expect(mocks.toastError).not.toHaveBeenCalled();
      expect(Array.from(mocks.store.keys()).some((k) => k.startsWith('pendingConversationUpload:'))).toBe(false);
      expect(hasUnsavedConversations()).toBe(false);
    });

    it('sends the chat once the user is known (latest version only)', async () => {
      mocks.doRequestOp.mockResolvedValue({ success: true, version: 7 });
      await uploadConversation(conv('startup', []), []);
      await uploadConversation(conv('startup', [], { name: 'newer' }), []);

      svc.setConversationSyncUser('Someone@X.edu');
      await settle();

      const sent = sentUploads();
      expect(sent).toHaveLength(1);
      expect(sent[0].conv.name).toBe('newer');
      expect(mocks.toastError).not.toHaveBeenCalled();
    });

    it('does not send a chat that was deleted while waiting for sign-in', async () => {
      mocks.doRequestOp.mockResolvedValue({ success: true });
      await uploadConversation(conv('gone', []), []);
      await deleteRemoteConversation('gone');
      mocks.doRequestOp.mockClear();

      svc.setConversationSyncUser('someone@x.edu');
      await settle();

      expect(sentUploads()).toHaveLength(0);
    });
  });

  describe('blank new chats (nothing worth saving yet)', () => {
    const blank = (id: string, extra: Record<string, unknown> = {}) => conv(id, [], { name: 'New Conversation', messageCount: 0, ...extra });

    it('is only held in this browser: no request, no retry record, no error toast', async () => {
      mocks.doRequestOp.mockResolvedValue({ success: false, message: 'down' });

      const saved = await uploadConversation(blank('b1'), []);
      await settle();

      expect(saved).toBe(true);
      expect(mocks.doRequestOp).not.toHaveBeenCalled();
      expect(mocks.toastError).not.toHaveBeenCalled();
      expect(hasUnsavedConversations()).toBe(false);
      expect(mocks.store.has('heldBlankConversation:b1')).toBe(true);
      expect(Array.from(mocks.store.keys()).some((k) => k.startsWith('pendingConversationUpload:'))).toBe(false);
    });

    it('is served to anything that opens it, without a request (and survives a reload)', async () => {
      await uploadConversation(blank('b2'), []);

      // a new page load: fresh module state, same browser storage
      vi.resetModules();
      svc = await import('@/services/remoteConversationService');
      svc.setConversationSyncUser('tester@x.edu');
      const opened = await fetchRemoteConversation('b2');

      expect(opened?.id).toBe('b2');
      expect(opened?.name).toBe('New Conversation');
      expect(mocks.doRequestOp).not.toHaveBeenCalled();
      expect(Array.from(await svc.getHeldBlankConversationIds())).toEqual(['b2']);
    });

    it('works behind the login page too, and does not pile up across reloads', async () => {
      svc.setConversationSyncUser(null);
      for (const id of ['x1', 'x2', 'x3']) await uploadConversation(blank(id), []);

      svc.setConversationSyncUser('tester@x.edu');
      await settle();

      expect(mocks.doRequestOp).not.toHaveBeenCalled(); // nothing is created in the cloud
      expect(mocks.toastError).not.toHaveBeenCalled();
    });

    it('creates the cloud chat with the first message and stops holding it', async () => {
      mocks.doRequestOp.mockResolvedValue({ success: true, version: 3 });
      await uploadConversation(blank('b3'), []);

      // the user sends their first message: the object still carries the old "known blank" marker
      const saved = await uploadConversation(conv('b3', ['hello'], { name: 'New Conversation', messageCount: 0 }), []);

      expect(saved).toBe(true);
      const sent = sentUploads();
      expect(sent).toHaveLength(1);
      expect(sent[0].conv.messages).toHaveLength(1);
      expect(sent[0].conv.messageCount).toBeUndefined(); // the stale "0" is not stored with a chat that has messages
      expect(mocks.store.has('heldBlankConversation:b3')).toBe(false);
      expect(Array.from(await svc.getHeldBlankConversationIds())).toEqual([]);
    });

    it('is forgotten when the chat is deleted', async () => {
      await uploadConversation(blank('b4'), []);
      mocks.doRequestOp.mockResolvedValue({ success: true });

      await deleteRemoteConversation('b4');

      expect(mocks.store.has('heldBlankConversation:b4')).toBe(false);
    });

    it('is forgotten when the cloud turns out to have the chat (written on another device)', async () => {
      await uploadConversation(blank('b5'), []);
      svc.releaseHeldBlankConversations(['b5']);

      expect(Array.from(await svc.getHeldBlankConversationIds())).toEqual([]);
      mocks.doRequestOp.mockResolvedValue({ success: true, version: 9, conversation: [JSON.stringify(conv('b5', ['from elsewhere']))] });
      const opened = await fetchRemoteConversation('b5');
      expect(opened?.messages).toHaveLength(1); // goes to the cloud now
    });

    it('is not held when the chat is already known to exist in the cloud', async () => {
      mocks.doRequestOp.mockResolvedValue({ success: true, version: 4 });
      await uploadConversation(conv('b6', ['real']), []); // now acknowledged: the cloud has it
      mocks.doRequestOp.mockClear();

      await uploadConversation(blank('b6'), []);

      expect(sentUploads()).toHaveLength(1); // goes through the normal path (the server decides what to do)
    });

    it('does not treat a chat of unknown size as blank (a stub must never replace a real chat)', async () => {
      mocks.doRequestOp.mockResolvedValue({ success: true, version: 1 });
      await uploadConversation(conv('s1', [], { name: 'New Conversation' }), []); // messageCount unknown

      expect(Array.from(await svc.getHeldBlankConversationIds())).toEqual([]);
    });

    it('is not shown to another account, and is dropped after 30 days of not being used', async () => {
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      await uploadConversation(blank('b7'), []);

      vi.resetModules();
      svc = await import('@/services/remoteConversationService');
      svc.setConversationSyncUser('someone-else@x.edu');
      expect(Array.from(await svc.getHeldBlankConversationIds())).toEqual([]);

      vi.resetModules();
      svc = await import('@/services/remoteConversationService');
      svc.setConversationSyncUser('tester@x.edu');
      expect(Array.from(await svc.getHeldBlankConversationIds())).toEqual(['b7']);
      vi.setSystemTime(new Date('2026-03-01T00:00:00Z'));
      vi.resetModules();
      svc = await import('@/services/remoteConversationService');
      svc.setConversationSyncUser('tester@x.edu');
      expect(Array.from(await svc.getHeldBlankConversationIds())).toEqual([]);
      expect(mocks.store.has('heldBlankConversation:b7')).toBe(false);
    });
  });

  it('retries a blank chat quietly: nothing the user could lose, so no error toast', async () => {
    mocks.doRequestOp.mockResolvedValue({ success: false, message: 'down' });
    const promise = uploadConversation(conv('blank', []), []);
    await settle();

    expect(await promise).toBe(false);
    expect(mocks.toastError).not.toHaveBeenCalled();
    expect(mocks.store.has('pendingConversationUpload:blank')).toBe(true); // still retried later
  });

  it('keeps the unsaved chat in storage when every attempt fails, and replays it later', async () => {
    mocks.doRequestOp.mockResolvedValue({ success: false, message: 'down' });
    const promise = uploadConversation(conv('b', ['important']), []);
    await settle();

    expect(await promise).toBe(false);
    expect(mocks.toastError).toHaveBeenCalled();
    expect(mocks.store.has('pendingConversationUpload:b')).toBe(true);
    // while unsaved, opening the chat returns OUR copy, not the stale server one
    mocks.doRequestOp.mockClear();
    const reopened = await fetchRemoteConversation('b');
    expect(reopened?.messages[0].content).toBe('important');
    expect(mocks.doRequestOp).not.toHaveBeenCalled();

    mocks.doRequestOp.mockResolvedValue({ success: true, version: 5 });
    svc.setConversationSyncUser('tester@x.edu');
    await replayPendingConversationSync();
    expect(sentUploads().at(-1)?.conv.messages[0].content).toBe('important');
    expect(mocks.store.has('pendingConversationUpload:b')).toBe(false);
  });

  it('serializes saves of one chat and lets the newest content win', async () => {
    let releaseFirst: (v: unknown) => void = () => undefined;
    mocks.doRequestOp
      .mockImplementationOnce(() => new Promise((resolve) => { releaseFirst = resolve; }))
      .mockResolvedValue({ success: true, version: 2 });

    const first = uploadConversation(conv('c', ['one']), []);
    await vi.advanceTimersByTimeAsync(0);
    const second = uploadConversation(conv('c', ['one', 'two']), []);
    const third = uploadConversation(conv('c', ['one', 'two', 'three']), []);
    await vi.advanceTimersByTimeAsync(0);
    expect(sentUploads()).toHaveLength(1); // nothing overlaps the in-flight request

    releaseFirst({ success: true, version: 1 });
    await settle();
    await Promise.all([first, second, third]);

    const sent = sentUploads();
    expect(sent.at(-1)?.conv.messages).toHaveLength(3);
    expect(sent.some((s) => s.conv.messages.length === 2)).toBe(false); // superseded save was skipped
  });

  it('sends the version it last saw, so concurrent edits can be detected', async () => {
    mocks.doRequestOp.mockResolvedValue({ success: true, version: 100 });
    await uploadConversation(conv('d', ['1']), []);
    await uploadConversation(conv('d', ['1', '2']), []);
    const sent = sentUploads();
    expect(sent[0].expected).toBeNull();
    expect(sent[1].expected).toBe(100);
  });

  it('keeps the user version as a separate chat on conflict instead of overwriting', async () => {
    mocks.doRequestOp.mockImplementation(async (op: any) => {
      if (op.op === '/upload' && op.data.conversationId === 'e') return { success: false, reason: 'CONFLICT', version: 9 };
      if (op.op === '/get') return { success: true, version: 9, conversation: [JSON.stringify(conv('e', ['other device']))] };
      return { success: true, version: 1 };
    });

    const promise = uploadConversation(conv('e', ['mine']), []);
    await settle();
    expect(await promise).toBe(true);

    const copies = sentUploads().filter((s) => s.id !== 'e');
    expect(copies).toHaveLength(1);
    expect(copies[0].conv.name).toContain('(conflicted copy)');
    expect(copies[0].conv.messages[0].content).toBe('mine');
    expect(dispatched[0]?.type).toBe(CONVERSATION_SAVE_CONFLICT_EVENT);
    expect(hasUnsavedConversations()).toBe(false);

    // later saves of the same chat keep updating the copy and never touch the original again
    const before = sentUploads().filter((s) => s.id === 'e').length;
    await uploadConversation(conv('e', ['mine', 'more']), []);
    expect(sentUploads().filter((s) => s.id === 'e').length).toBe(before);
    expect(sentUploads().at(-1)?.conv.messages).toHaveLength(2);
  });

  it('does not fork a copy when the "conflict" is just our own save that already landed', async () => {
    mocks.doRequestOp.mockImplementation(async (op: any) => {
      // the first attempt reports a conflict; once the fresh server version is the baseline the save goes through
      if (op.op === '/upload') return op.data.expectedVersion === 9 ? { success: true, version: 10 } : { success: false, reason: 'CONFLICT', version: 9 };
      if (op.op === '/get') return { success: true, version: 9, conversation: [JSON.stringify(conv('f', ['same']))] };
      return { success: true };
    });
    const promise = uploadConversation(conv('f', ['same']), []);
    await settle();
    expect(await promise).toBe(true);
    expect(sentUploads().map((s) => s.id)).toEqual(['f', 'f']);
    expect(dispatched).toHaveLength(0);
    expect(hasUnsavedConversations()).toBe(false);
  });

  it('writes over the server copy when it is only an EARLIER state of this chat (own earlier save landed, response lost)', async () => {
    mocks.doRequestOp.mockImplementation(async (op: any) => {
      if (op.op === '/upload') return op.data.expectedVersion === 9 ? { success: true, version: 10 } : { success: false, reason: 'CONFLICT', version: 9 };
      if (op.op === '/get') return { success: true, version: 9, conversation: [JSON.stringify(conv('p', ['one']))] };
      return { success: true };
    });
    const promise = uploadConversation(conv('p', ['one', 'two']), []);
    await settle();
    expect(await promise).toBe(true);
    expect(dispatched).toHaveLength(0); // no "(conflicted copy)"
    expect(sentUploads().at(-1)?.conv.messages).toHaveLength(2);
  });

  it('keeps the save queued (no copy) when the other copy cannot be looked at', async () => {
    mocks.doRequestOp.mockImplementation(async (op: any) => {
      if (op.op === '/upload') return { success: false, reason: 'CONFLICT', version: 9 };
      return { success: false, message: 'offline' };
    });
    const promise = uploadConversation(conv('q', ['mine']), []);
    await settle();
    expect(await promise).toBe(false);
    expect(dispatched).toHaveLength(0);
    expect(hasUnsavedConversations()).toBe(true);
    expect(sentUploads().every((s) => s.id === 'q')).toBe(true);
  });

  it('does not report a false conflict after a presigned (large) upload cleared the baseline', async () => {
    // 1st save: server reports version 5. 2nd save is huge -> presigned; it succeeds without a version.
    // 3rd save was queued while the 2nd was in flight and was created with the OLD baseline (5).
    const big = 'x'.repeat(3.2 * 1024 * 1024);
    mocks.doRequestOp.mockImplementation(async (op: any) => {
      if (op.op === '/upload') return { success: true, version: 5 };
      if (op.op === '/get-upload-url') {
        // the server saw a newer write (our own presigned one): only a request that still carries the old baseline conflicts
        return op.queryParams.expectedVersion === '5' && presignedDone ? { success: false, reason: 'CONFLICT' } : { success: true, presignedUrl: 'https://s3.example/put' };
      }
      return { success: true };
    });
    let presignedDone = false;
    let releasePut: () => void = () => undefined;
    const putStarted = vi.fn();
    vi.stubGlobal('fetch', vi.fn(() => new Promise((resolve) => {
      putStarted();
      releasePut = () => { presignedDone = true; resolve({ ok: true, status: 200 }); };
    })));
    // in the test "compression" is JSON in a one-element array, so make the payload big via the message text
    await uploadConversation(conv('big', ['1']), []);
    const second = uploadConversation(conv('big', [big]), []);
    await vi.advanceTimersByTimeAsync(0);
    expect(putStarted).toHaveBeenCalledTimes(1); // the large save is really in flight
    const third = uploadConversation(conv('big', [big, 'follow up']), []); // created with the old baseline (5)
    await vi.advanceTimersByTimeAsync(0);
    releasePut();
    await vi.advanceTimersByTimeAsync(0);
    releasePut(); // the third save's own presigned PUT
    await settle();
    await Promise.all([second, third]);

    expect(dispatched).toHaveLength(0); // no "(conflicted copy)"
    expect(sentUploads().every((s) => s.id === 'big')).toBe(true);
    expect(hasUnsavedConversations()).toBe(false);
  });

  it('cancelPendingUpload drops a queued save so a chat that must stay local is not uploaded later', async () => {
    mocks.doRequestOp.mockResolvedValue({ success: false, message: 'down' });
    const promise = uploadConversation(conv('loc', ['private']), []);
    await settle();
    expect(await promise).toBe(false);
    expect(mocks.store.has('pendingConversationUpload:loc')).toBe(true);

    svc.cancelPendingUpload('loc');

    expect(mocks.store.has('pendingConversationUpload:loc')).toBe(false);
    expect(hasUnsavedConversations()).toBe(false);
    mocks.doRequestOp.mockClear();
    svc.setConversationSyncUser('someone@x.edu');
    await replayPendingConversationSync();
    expect(sentUploads()).toHaveLength(0);
  });

  it('only replays unsent chats of the signed-in account', async () => {
    svc.setConversationSyncUser('alice@x.edu');
    mocks.doRequestOp.mockResolvedValue({ success: false, message: 'down' });
    const promise = uploadConversation(conv('alice-chat', ['alice secret']), []);
    await settle();
    await promise;
    expect(mocks.store.has('pendingConversationUpload:alice-chat')).toBe(true);

    // a new session on the same browser, another account signs in
    vi.resetModules();
    svc = await import('@/services/remoteConversationService');
    svc.setConversationSyncUser('bob@x.edu');
    mocks.doRequestOp.mockReset();
    mocks.doRequestOp.mockResolvedValue({ success: true, version: 1 });
    await replayPendingConversationSync();
    expect(sentUploads()).toHaveLength(0);
    expect(mocks.store.has('pendingConversationUpload:alice-chat')).toBe(true); // left for alice

    vi.resetModules();
    svc = await import('@/services/remoteConversationService');
    svc.setConversationSyncUser('alice@x.edu');
    await replayPendingConversationSync();
    expect(sentUploads().map((s) => s.id)).toEqual(['alice-chat']);
  });

  it('does not retry a save the server refused (empty overwrite)', async () => {
    mocks.doRequestOp.mockResolvedValue({ success: false, reason: 'EMPTY_OVERWRITE' });
    const promise = uploadConversation(conv('g', []), []);
    await settle();
    expect(await promise).toBe(false);
    expect(sentUploads()).toHaveLength(1);
    expect(mocks.store.has('pendingConversationUpload:g')).toBe(false);
  });

  it('remembers a failed delete, hides the chat from syncs, and never re-uploads it', async () => {
    mocks.doRequestOp.mockResolvedValue({ success: false, message: 'down' });
    const promise = deleteRemoteConversation('h');
    await settle();
    expect(await promise).toBe(false);

    expect((await getPendingDeleteIds()).has('h')).toBe(true);
    // a stream that finishes after the user deleted the chat must not resurrect it
    expect(await uploadConversation(conv('h', ['x']), [])).toBe(false);
    expect(sentUploads().filter((s) => s.id === 'h')).toHaveLength(0);

    mocks.doRequestOp.mockResolvedValue({ success: true });
    svc.setConversationSyncUser('tester@x.edu');
    await replayPendingConversationSync();
    expect(mocks.store.has('pendingConversationDelete:h')).toBe(false);
  });

  it('allows a deliberate re-upload of a previously deleted id (cloud -> local -> cloud)', async () => {
    mocks.doRequestOp.mockResolvedValue({ success: true, version: 1 });
    await deleteRemoteConversation('i');
    expect(await uploadConversation(conv('i', ['back']), [], null, { recreate: true })).toBe(true);
    expect((await getPendingDeleteIds()).has('i')).toBe(false);
  });
});
