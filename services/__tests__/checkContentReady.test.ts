import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkContentReady } from '@/services/fileService';

// Minimal XHR double: each instance records itself; the test decides when and how it answers.
class FakeXhr {
  static instances: FakeXhr[] = [];
  readyState = 0;
  status = 0;
  responseText = '';
  onreadystatechange: (() => void) | null = null;
  aborted = false;
  constructor() { FakeXhr.instances.push(this); }
  open() {}
  send() {}
  abort() { this.aborted = true; }
  respond(status: number, body = '') {
    this.readyState = 4;
    this.status = status;
    this.responseText = body;
    this.onreadystatechange?.();
  }
}

describe('checkContentReady', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeXhr.instances = [];
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
    vi.stubGlobal('document', { visibilityState: 'visible' });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('waits for each request to finish before sending the next', async () => {
    const result = checkContentReady('http://s3/meta', 60);
    result.catch(() => {});

    await vi.advanceTimersByTimeAsync(500);
    expect(FakeXhr.instances).toHaveLength(1);

    // The first request is still pending: no further request may start, however long it takes.
    await vi.advanceTimersByTimeAsync(10_000);
    expect(FakeXhr.instances).toHaveLength(1);

    FakeXhr.instances[0].respond(404);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(FakeXhr.instances).toHaveLength(2);
  });

  it('backs off between attempts', async () => {
    const result = checkContentReady('http://s3/meta', 120);
    result.catch(() => {});

    for (let i = 0; i < 6; i++) {
      await vi.advanceTimersByTimeAsync(3_000);
      const latest = FakeXhr.instances[FakeXhr.instances.length - 1];
      latest?.respond(404);
    }
    // 500ms, 750ms, 1125ms, 1688ms, 2532ms, 3000ms (capped): well under one request per 500ms.
    expect(FakeXhr.instances.length).toBeLessThan(6 * 3000 / 500);
    expect(FakeXhr.instances.length).toBeGreaterThanOrEqual(6);
  });

  it('resolves with the parsed metadata once the object exists', async () => {
    const result = checkContentReady('http://s3/meta', 60);

    await vi.advanceTimersByTimeAsync(500);
    FakeXhr.instances[0].respond(200, '{"totalTokens": 12}');

    await expect(result).resolves.toEqual({ success: true, metadata: { totalTokens: 12 } });
  });

  it('does not send requests while the tab is hidden', async () => {
    vi.stubGlobal('document', { visibilityState: 'hidden' });
    const result = checkContentReady('http://s3/meta', 60);
    result.catch(() => {});

    await vi.advanceTimersByTimeAsync(10_000);

    expect(FakeXhr.instances).toHaveLength(0);
  });

  it('rejects on timeout', async () => {
    const result = checkContentReady('http://s3/meta', 2);
    const assertion = expect(result).rejects.toThrow('Timeout reached');

    await vi.advanceTimersByTimeAsync(500);
    FakeXhr.instances[0]?.respond(404);
    await vi.advanceTimersByTimeAsync(5_000);

    await assertion;
  });

  it('aborts the in-flight request and stops when the controller aborts', async () => {
    const controller = new AbortController();
    const result = checkContentReady('http://s3/meta', 60, controller);
    const assertion = expect(result).rejects.toThrow('Abort');

    await vi.advanceTimersByTimeAsync(500);
    controller.abort();
    await assertion;

    expect(FakeXhr.instances[0].aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(FakeXhr.instances).toHaveLength(1);
  });
});
