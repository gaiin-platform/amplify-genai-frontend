import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/mcpService', () => ({ listMCPServers: vi.fn() }));

import { executeMCPTool, parseSseJsonRpc } from '@/services/mcpToolExecutor';

const reply = { jsonrpc: '2.0', id: 'req_1', result: { ok: true } };

describe('parseSseJsonRpc', () => {
  it('reads an event/data body', () => {
    expect(parseSseJsonRpc(`event: message\ndata: ${JSON.stringify(reply)}\n\n`, 'req_1')).toEqual(reply);
  });
  it('handles CRLF, no trailing blank line, and multi-line data', () => {
    expect(parseSseJsonRpc(`event: message\r\ndata: ${JSON.stringify(reply)}`, 'req_1')).toEqual(reply);
    expect(parseSseJsonRpc('data: {"jsonrpc":"2.0",\ndata: "id":"req_1","result":{"a":1}}\n\n', 'req_1')).toEqual({
      jsonrpc: '2.0',
      id: 'req_1',
      result: { a: 1 },
    });
  });
  it('prefers the matching id, falls back to the first response, skips noise', () => {
    const other = { jsonrpc: '2.0', id: 'req_0', result: { stale: true } };
    const note = { jsonrpc: '2.0', method: 'notifications/progress' };
    const body = [note, other, reply].map((m) => `data: ${JSON.stringify(m)}\n\n`).join('');
    expect(parseSseJsonRpc(`: keep-alive\n\ndata: nope\n\n${body}`, 'req_1')).toEqual(reply);
    expect(parseSseJsonRpc(body, 'req_9')).toEqual(other);
  });
  it('returns null when there is no response', () => {
    expect(parseSseJsonRpc('', 'req_1')).toBeNull();
    expect(parseSseJsonRpc('event: message\n\n', 'req_1')).toBeNull();
    expect(parseSseJsonRpc('data: [bad\n\n', 'req_1')).toBeNull();
  });
});

describe('executeMCPTool response handling', () => {
  afterEach(() => vi.unstubAllGlobals());

  const stubFetch = (body: (id: string) => string, contentType: string, status = 200) => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const { id } = JSON.parse(init.body as string);
      return new Response(body(id), { status, headers: { 'content-type': contentType } });
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  };
  const result = { content: [{ type: 'text', text: 'hello' }] };

  it('reads an event-stream reply (the DeepWiki shape)', async () => {
    const f = stubFetch(
      (id) => `event: message\ndata: ${JSON.stringify({ jsonrpc: '2.0', id, result })}\n\n`,
      'text/event-stream',
    );
    const out = await executeMCPTool('https://example.com/mcp', 'read_wiki_structure', { repoName: 'a/b' });
    expect(out).toMatchObject({ success: true, content: 'hello', isError: false });
    expect((f.mock.calls[0][1] as RequestInit).headers).toMatchObject({ Accept: 'application/json, text/event-stream' });
  });

  it('still reads a plain JSON reply', async () => {
    stubFetch((id) => JSON.stringify({ jsonrpc: '2.0', id, result }), 'application/json');
    expect(await executeMCPTool('https://example.com/mcp', 't', {})).toMatchObject({ success: true, content: 'hello' });
  });

  it('turns an event stream with no response into a failed result, not a thrown parse error', async () => {
    stubFetch(() => 'event: ping\n\n', 'text/event-stream');
    const out = await executeMCPTool('https://example.com/mcp', 't', {});
    expect(out.isError).toBe(true);
    expect(out.content).toContain('no JSON-RPC response');
  });

  it('returns a JSON-RPC error from an event stream as an error result', async () => {
    stubFetch(
      (id) => `data: ${JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32601, message: 'nope' } })}\n\n`,
      'text/event-stream',
    );
    expect(await executeMCPTool('https://example.com/mcp', 't', {})).toMatchObject({ isError: true, content: 'nope' });
  });

  it('keeps reporting HTTP errors', async () => {
    stubFetch(() => 'x', 'text/plain', 500);
    expect((await executeMCPTool('https://example.com/mcp', 't', {})).content).toContain('HTTP error: 500');
  });
});
