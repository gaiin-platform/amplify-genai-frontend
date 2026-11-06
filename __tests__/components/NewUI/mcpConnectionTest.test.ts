import { describe, expect, it, vi } from 'vitest';

vi.mock('@/services/mcpService', () => ({ listMCPServers: vi.fn() }));

import { testMcpServerFromBrowser } from '@/components/NewUI/settings/mcp/mcpConnectionTest';

const URL_OK = 'https://example.com/mcp';
const input = { url: URL_OK, transport: 'http' as const, authHeader: '' };

type Handler = (body: any, init: RequestInit) => Response | Promise<Response>;

/** A fake fetch that routes by JSON-RPC method and records every request. */
const server = (handlers: Record<string, Handler>) => {
  const calls: { body: any; headers: Record<string, string> }[] = [];
  const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string);
    calls.push({ body, headers: init.headers as Record<string, string> });
    const h = handlers[body.method];
    if (!h) return new Response(null, { status: 202 });
    return h(body, init);
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
};

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

const rpcOk = (id: number, result: unknown) => ({ jsonrpc: '2.0', id, result });

describe('testMcpServerFromBrowser', () => {
  it('connects and lists tool names (JSON replies)', async () => {
    const { fetchImpl, calls } = server({
      initialize: (b) => json(rpcOk(b.id, { serverInfo: { name: 's' } }), 200, { 'mcp-session-id': 'sess-1' }),
      'tools/list': (b) => json(rpcOk(b.id, { tools: [{ name: 'search' }, { name: 'fetch' }, { nope: 1 }] })),
    });
    const out = await testMcpServerFromBrowser({ ...input, authHeader: 'Bearer abc' }, { fetchImpl });
    expect(out).toEqual({ ok: true, tools: ['search', 'fetch'] });
    // Auth is sent, and the session id from initialize is reused.
    expect(calls[0].headers.Authorization).toBe('Bearer abc');
    expect(calls.at(-1)?.headers['Mcp-Session-Id']).toBe('sess-1');
    expect(calls.map((c) => c.body.method)).toEqual(['initialize', 'notifications/initialized', 'tools/list']);
  });

  it('reads Server-Sent-Event replies and follows paging', async () => {
    let page = 0;
    const sse = (id: number, result: unknown) =>
      new Response(`event: message\ndata: ${JSON.stringify(rpcOk(id, result))}\n\n`, {
        headers: { 'content-type': 'text/event-stream' },
      });
    const { fetchImpl } = server({
      initialize: (b) => sse(b.id, {}),
      'tools/list': (b) =>
        page++ === 0 ? sse(b.id, { tools: [{ name: 'a' }], nextCursor: 'c2' }) : sse(b.id, { tools: [{ name: 'b' }] }),
    });
    expect(await testMcpServerFromBrowser(input, { fetchImpl })).toEqual({ ok: true, tools: ['a', 'b'] });
  });

  it('sends no Authorization header when none was entered', async () => {
    const { fetchImpl, calls } = server({
      initialize: (b) => json(rpcOk(b.id, {})),
      'tools/list': (b) => json(rpcOk(b.id, { tools: [] })),
    });
    await testMcpServerFromBrowser(input, { fetchImpl });
    expect(calls.every((c) => !('Authorization' in c.headers))).toBe(true);
  });

  it.each([
    [401, 'auth', /requires authentication/],
    [404, 'not-found', /Nothing was found/],
    [405, 'wrong-method', /other transport/],
    [503, 'server-error', /returned an error/],
    [418, 'http', /HTTP 418/],
  ])('maps HTTP %i to a plain message', async (status, kind, message) => {
    const { fetchImpl } = server({ initialize: () => new Response('nope', { status }) });
    const out = await testMcpServerFromBrowser(input, { fetchImpl });
    expect(out).toMatchObject({ ok: false, kind });
    if (!out.ok) {
      expect(out.message).toMatch(message);
      expect(out.details).toMatch(`HTTP ${status}`);
    }
  });

  it('says credentials were rejected when a header was sent', async () => {
    const { fetchImpl } = server({ initialize: () => new Response('', { status: 401 }) });
    const out = await testMcpServerFromBrowser({ ...input, authHeader: 'Bearer abc' }, { fetchImpl });
    expect(out.ok === false && out.message).toMatch(/rejected your credentials/);
  });

  it('never echoes the auth header, even when the server reflects it', async () => {
    const secret = 'Bearer super-secret-token';
    const { fetchImpl } = server({
      initialize: () => new Response(`invalid credential: ${secret} / super-secret-token`, { status: 403 }),
    });
    const out = await testMcpServerFromBrowser({ ...input, authHeader: secret }, { fetchImpl });
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(JSON.stringify(out)).not.toContain('super-secret-token');
      expect(out.details).toContain('[redacted]');
    }
  });

  it('reports an MCP error and a non-MCP reply as protocol failures', async () => {
    const rpcErr = server({
      initialize: (b) => json({ jsonrpc: '2.0', id: b.id, error: { code: -32601, message: 'Method not found' } }),
    });
    const a = await testMcpServerFromBrowser(input, { fetchImpl: rpcErr.fetchImpl });
    expect(a).toMatchObject({ ok: false, kind: 'protocol' });
    if (!a.ok) expect(a.details).toMatch(/-32601: Method not found/);

    const html = server({ initialize: () => new Response('<html>', { headers: { 'content-type': 'text/html' } }) });
    expect(await testMcpServerFromBrowser(input, { fetchImpl: html.fetchImpl })).toMatchObject({
      ok: false,
      kind: 'protocol',
    });
  });

  it('treats a tools/list reply without a list as a protocol failure', async () => {
    const { fetchImpl } = server({
      initialize: (b) => json(rpcOk(b.id, {})),
      'tools/list': (b) => json(rpcOk(b.id, { tools: 'many' })),
    });
    expect(await testMcpServerFromBrowser(input, { fetchImpl })).toMatchObject({ ok: false, kind: 'protocol' });
  });

  it('maps a rejected fetch to a network/CORS message', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    const out = await testMcpServerFromBrowser(input, { fetchImpl });
    expect(out).toMatchObject({ ok: false, kind: 'network' });
    if (!out.ok) expect(out.message).toMatch(/CORS/);
  });

  it('times out', async () => {
    const fetchImpl = vi.fn(
      (_u: string, init: RequestInit) =>
        new Promise<Response>((_res, rej) =>
          init.signal?.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' }))),
        ),
    ) as unknown as typeof fetch;
    const out = await testMcpServerFromBrowser(input, { fetchImpl, timeoutMs: 20 });
    expect(out).toMatchObject({ ok: false, kind: 'timeout' });
  });

  it('refuses an unsafe URL without making a request', async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const out = await testMcpServerFromBrowser({ ...input, url: 'http://localhost:8888/mcp' }, { fetchImpl });
    expect(out).toMatchObject({ ok: false, kind: 'invalid-url' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
