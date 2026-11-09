import { afterEach, describe, expect, it, vi } from 'vitest';

import { nonJsonErrorMessage, parseErrorBody, sendChatRequestWithDocuments } from '@/services/chatService';

const chatBody: any = {
  model: { id: 'test-model' },
  messages: [{ role: 'user', content: 'hi' }],
  prompt: 'system',
  temperature: 0.5,
  maxTokens: 100,
};

const mockFetch = (res: Response) => vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res));

afterEach(() => vi.unstubAllGlobals());

describe('parseErrorBody', () => {
  it('returns the object for a JSON body', () => {
    expect(parseErrorBody('{"error":"boom"}')).toEqual({ error: 'boom' });
  });
  it('returns null for HTML, empty, and non-object JSON', () => {
    expect(parseErrorBody('<html><body>403 Forbidden</body></html>')).toBeNull();
    expect(parseErrorBody('')).toBeNull();
    expect(parseErrorBody('null')).toBeNull();
    expect(parseErrorBody('42')).toBeNull();
  });
});

describe('nonJsonErrorMessage', () => {
  it('names a 403 as a blocked request', () => {
    expect(nonJsonErrorMessage(403)).toMatch(/Request blocked \(403\)/);
  });
  it('includes the status for other codes', () => {
    expect(nonJsonErrorMessage(502)).toMatch(/\(502\)/);
  });
});

describe('sendChatRequestWithDocuments failed responses', () => {
  it('turns an HTML 403 page into a readable error instead of throwing a JSON parse error', async () => {
    mockFetch(new Response('<html><head><title>403 Forbidden</title></head></html>', {
      status: 403,
      headers: { 'Content-Type': 'text/html' },
    }));

    const response = await sendChatRequestWithDocuments(null, chatBody);

    expect(response.ok).toBe(false);
    expect(response.status).toBe(403);
    const text = await response.text();
    expect(text).toMatch(/Request blocked \(403\)/);
    expect(text).not.toMatch(/Unexpected token/);
  });

  it('still surfaces the error field of a JSON error body', async () => {
    mockFetch(new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429 }));

    const response = await sendChatRequestWithDocuments(null, chatBody);

    expect(response.status).toBe(429);
    expect(await response.text()).toBe('Rate limit exceeded');
  });

  it('reports the status for a non-403 HTML error page', async () => {
    mockFetch(new Response('<html>Bad Gateway</html>', { status: 502 }));

    const response = await sendChatRequestWithDocuments(null, chatBody);

    expect(response.status).toBe(502);
    expect(await response.text()).toMatch(/\(502\)/);
  });
});
