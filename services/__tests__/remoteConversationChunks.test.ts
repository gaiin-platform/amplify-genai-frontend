import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ doRequestOp: vi.fn() }));
vi.mock('@/services/doRequestOp', () => ({ doRequestOp: mocks.doRequestOp }));
vi.mock('@/utils/app/conversation', () => ({
  compressConversation: vi.fn(),
  saveConversations: vi.fn(),
  uncompressConversation: vi.fn(),
}));

import { fetchAllRemoteConversations } from '@/services/remoteConversationService';

const respond = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response;

describe('fetchAllRemoteConversations chunk download', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns chunks in their original order even when they finish out of order', async () => {
    const urls = ['u0', 'u1', 'u2'];
    mocks.doRequestOp.mockResolvedValue({ success: true, presignedUrls: urls });
    // Earlier chunks take longer, so completion order is the reverse of request order.
    const delays: Record<string, number> = { u0: 30, u1: 15, u2: 0 };
    vi.stubGlobal('fetch', vi.fn((url: string) =>
      new Promise<Response>((resolve) => setTimeout(() => resolve(respond([url])), delays[url]))));

    expect(await fetchAllRemoteConversations()).toEqual(['u0', 'u1', 'u2']);
  });

  it('downloads chunks concurrently rather than one after another', async () => {
    mocks.doRequestOp.mockResolvedValue({ success: true, presignedUrls: ['a', 'b', 'c', 'd'] });
    let active = 0;
    let peak = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 10));
      active -= 1;
      return respond([]);
    }));

    await fetchAllRemoteConversations();

    expect(peak).toBeGreaterThan(1);
  });

  it('fails the whole read when any chunk fails', async () => {
    mocks.doRequestOp.mockResolvedValue({ success: true, presignedUrls: ['a', 'b'] });
    vi.stubGlobal('fetch', vi.fn(async (url: string) => respond([url], url !== 'b')));

    expect(await fetchAllRemoteConversations()).toBeNull();
  });

  it('returns an empty list when there are no chunks', async () => {
    mocks.doRequestOp.mockResolvedValue({ success: true, presignedUrls: [] });
    vi.stubGlobal('fetch', vi.fn());

    expect(await fetchAllRemoteConversations()).toEqual([]);
  });
});
