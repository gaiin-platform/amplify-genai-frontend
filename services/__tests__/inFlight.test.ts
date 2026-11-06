import { describe, expect, it, vi } from 'vitest';
import { createTtlCache } from '@/services/inFlight';

describe('createTtlCache', () => {
  it('serves a successful result from memory until the TTL expires', async () => {
    vi.useFakeTimers();
    try {
      const cache = createTtlCache<any>(1000);
      const fetcher = vi.fn().mockResolvedValue({ success: true, data: [1] });

      await cache.get(fetcher);
      await cache.get(fetcher);
      expect(fetcher).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(1001);
      await cache.get(fetcher);
      expect(fetcher).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not cache failures, so the next caller retries', async () => {
    const cache = createTtlCache<any>(60_000);
    const fetcher = vi.fn()
      .mockResolvedValueOnce({ success: false })
      .mockResolvedValueOnce({ success: true, data: 'ok' });

    expect((await cache.get(fetcher)).success).toBe(false);
    expect((await cache.get(fetcher)).data).toBe('ok');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('shares one request between concurrent callers', async () => {
    const cache = createTtlCache<any>(60_000);
    let release: (v: any) => void = () => {};
    const fetcher = vi.fn(() => new Promise<any>((resolve) => { release = resolve; }));

    const a = cache.get(fetcher);
    const b = cache.get(fetcher);
    release({ success: true, data: 1 });

    expect(await a).toEqual({ success: true, data: 1 });
    expect(await b).toEqual({ success: true, data: 1 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('hands each caller its own copy', async () => {
    const cache = createTtlCache<any>(60_000);
    const fetcher = vi.fn().mockResolvedValue({ success: true, data: { list: [1] } });

    const first = await cache.get(fetcher);
    first.data.list.push(2);
    const second = await cache.get(fetcher);

    expect(second.data.list).toEqual([1]);
  });

  it('invalidate drops the value and ignores a response that was already in flight', async () => {
    const cache = createTtlCache<any>(60_000);
    let release: (v: any) => void = () => {};
    const slow = vi.fn(() => new Promise<any>((resolve) => { release = resolve; }));

    const inFlight = cache.get(slow);
    cache.invalidate();
    release({ success: true, data: 'stale' });
    await inFlight;

    const fresh = vi.fn().mockResolvedValue({ success: true, data: 'fresh' });
    expect((await cache.get(fresh)).data).toBe('fresh');
    expect(fresh).toHaveBeenCalledTimes(1);
  });

  it('set() primes the cache for a later cached read', async () => {
    const cache = createTtlCache<any>(60_000);
    cache.set({ success: true, data: 'primed' });
    const fetcher = vi.fn();

    expect((await cache.get(fetcher)).data).toBe('primed');
    expect(fetcher).not.toHaveBeenCalled();
  });
});
