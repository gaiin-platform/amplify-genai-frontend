import { afterEach, describe, expect, it, vi } from 'vitest';
import { gzipSync } from 'zlib';

import { encodeProxyPayload, postToChatProxy } from '@/utils/app/chatProxy';
import { decodeProxyRequestBody, ProxyBodyError, MAX_DECODED_PROXY_BODY_BYTES } from '@/utils/server/chatProxyBody';
import { killRequest, sendChatRequestWithDocuments } from '@/services/chatService';

afterEach(() => vi.unstubAllGlobals());

// Content that the WAF's CrossSiteScripting_BODY / SQLi rules flag when sent as plain JSON.
const hostile =
  '<!DOCTYPE html><html><body onload="init()"><script>document.write("<img src=x onerror=alert(1)>")</script>' +
  '<a href="javascript:void(0)">x</a> ✓ 日本語 😀 \' OR 1=1 --</body></html>';

const payload = {
  endpoint: null,
  body: { messages: [{ role: 'user', content: hostile }], options: { requestId: 'r1' } },
};

describe('encodeProxyPayload', () => {
  it('produces a body with no markup or quote characters beyond the fixed envelope', async () => {
    const wire = await encodeProxyPayload(payload);
    const envelope = JSON.parse(wire);

    expect(Object.keys(envelope).sort()).toEqual(['data', 'enc']);
    expect(envelope.data).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(wire).not.toMatch(/[<>()]/);
    expect(wire).not.toContain('script');
  });

  it('round-trips through the server decoder, including non-ASCII content', async () => {
    const decoded = decodeProxyRequestBody(JSON.parse(await encodeProxyPayload(payload)));
    expect(decoded).toEqual(payload);
  });

  it('round-trips a payload much larger than one base64 slice', async () => {
    const big = { endpoint: null, body: { messages: [{ role: 'user', content: hostile.repeat(20000) }] } };
    const decoded = decodeProxyRequestBody(JSON.parse(await encodeProxyPayload(big)));
    expect(decoded).toEqual(big);
  });

  it('falls back to plain base64 when CompressionStream is unavailable', async () => {
    vi.stubGlobal('CompressionStream', undefined);
    const envelope = JSON.parse(await encodeProxyPayload(payload));
    expect(envelope.enc).toBe('b64');
    expect(decodeProxyRequestBody(envelope)).toEqual(payload);
  });
});

describe('decodeProxyRequestBody', () => {
  it('passes a legacy plain body through unchanged', () => {
    expect(decodeProxyRequestBody(payload)).toBe(payload);
  });

  it('treats a missing body as empty', () => {
    expect(decodeProxyRequestBody(undefined)).toEqual({});
  });

  it('rejects undecodable envelopes', () => {
    expect(() => decodeProxyRequestBody({ enc: 'gzip-b64', data: 'bm90IGd6aXA=' })).toThrow(ProxyBodyError);
    expect(() => decodeProxyRequestBody({ enc: 'b64', data: Buffer.from('{nope').toString('base64') })).toThrow(ProxyBodyError);
    expect(() => decodeProxyRequestBody({ enc: 'rot13', data: 'abc' })).toThrow(ProxyBodyError);
  });

  it('refuses to inflate a payload past the decoded size cap', () => {
    const bomb = gzipSync(Buffer.alloc(MAX_DECODED_PROXY_BODY_BYTES + 1024, 'a')).toString('base64');
    expect(() => decodeProxyRequestBody({ enc: 'gzip-b64', data: bomb })).toThrow(ProxyBodyError);
  });
});

describe('callers use the encoded transport', () => {
  const stubFetch = () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  };

  it('postToChatProxy sends the envelope as JSON to the proxy', async () => {
    const fetchMock = stubFetch();
    await postToChatProxy(payload);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/chat/proxy');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(decodeProxyRequestBody(JSON.parse(init.body))).toEqual(payload);
  });

  it('sendChatRequestWithDocuments never puts message content on the wire in clear text', async () => {
    const fetchMock = stubFetch();
    const chatBody: any = {
      model: { id: 'm' },
      messages: [{ role: 'user', content: hostile }],
      prompt: 'system',
      temperature: 0.5,
      maxTokens: 100,
    };
    await sendChatRequestWithDocuments(null, chatBody);

    const [, init] = fetchMock.mock.calls[0];
    expect(init.body).not.toMatch(/[<>]/);
    const decoded = decodeProxyRequestBody(JSON.parse(init.body));
    expect(decoded.body.messages[1].content).toBe(hostile);
    expect(decoded.endpoint).toBeNull();
  });

  it('killRequest uses the encoded transport', async () => {
    const fetchMock = stubFetch();
    expect(await killRequest('req-1')).toBe(true);
    const decoded = decodeProxyRequestBody(JSON.parse(fetchMock.mock.calls[0][1].body));
    expect(decoded.body).toEqual({ killSwitch: { requestId: 'req-1', value: true } });
  });
});
