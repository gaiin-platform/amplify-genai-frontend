/**
 * mcpConnectionTest — "Test connection" for a server that has NOT been saved yet. No React imports.
 *
 * It runs in the browser, on purpose. The backend's `/mcp/servers/test` refuses any URL that is not a
 * saved, *trusted* server (`mcp_servers.py#test_mcp_connection` → `_backend_trust_error`), and a new
 * server is saved untrusted — the backend must not contact it. Client-side servers are called from
 * the browser anyway (`services/mcpToolExecutor` POSTs JSON-RPC to the server URL), so this is also
 * the check that matches how such a server will actually be used. Consequence: the server has to
 * allow cross-origin requests (CORS), and a stateful server's session id is only readable if the
 * server exposes the `Mcp-Session-Id` header. Nothing is saved or changed by a test.
 *
 * Steps: `initialize` → `notifications/initialized` (best effort) → `tools/list` (paged).
 *
 * Secrecy: this module never logs. The Authorization value goes only into the request header, and
 * it is redacted from every string handed back.
 *
 * Location: components/NewUI/settings/mcp/mcpConnectionTest.ts
 */

import { MCPTransport, validateMCPServerUrlWithReason } from '@/types/mcp';
import { parseSseJsonRpc } from '@/services/mcpToolExecutor';
import { friendlyUrlError, redactSecret } from './mcpFormModel';

export type McpTestFailureKind =
  | 'invalid-url'
  | 'network'
  | 'timeout'
  | 'auth'
  | 'not-found'
  | 'wrong-method'
  | 'server-error'
  | 'http'
  | 'protocol';

export type McpTestOutcome =
  | { ok: true; tools: string[] }
  | { ok: false; kind: McpTestFailureKind; message: string; details: string };

export interface McpTestInput {
  url: string;
  transport: MCPTransport;
  authHeader: string;
}

export interface McpTestDeps {
  fetchImpl?: typeof fetch;
  /** Whole-probe budget. */
  timeoutMs?: number;
}

export const DEFAULT_TEST_TIMEOUT_MS = 15_000;
const MAX_TOOL_PAGES = 20;
const BODY_SNIPPET_CHARS = 300;

/** Plain-language message for a failure class. */
export function describeFailure(kind: McpTestFailureKind, opts: { status?: number; hadAuth: boolean }): string {
  switch (kind) {
    case 'auth':
      return opts.hadAuth
        ? 'The server rejected your credentials. Check the Authorization header.'
        : 'The server requires authentication. Add an Authorization header and try again.';
    case 'not-found':
      return 'Nothing was found at this URL. Check the address and path.';
    case 'wrong-method':
      return "The server doesn't accept requests this way. Try the other transport option.";
    case 'server-error':
      return 'The server returned an error. Try again in a moment.';
    case 'http':
      return `The server responded with an error (HTTP ${opts.status ?? 'unknown'}).`;
    case 'timeout':
      return 'The server took too long to respond.';
    case 'network':
      return "Couldn't reach the server. Check the URL and that the server is running. Browsers also block servers that don't allow requests from this site (CORS).";
    case 'invalid-url':
      return 'This URL can’t be used for an MCP server.';
    case 'protocol':
    default:
      return 'The server responded, but not with a valid MCP reply. Check that this URL is an MCP endpoint.';
  }
}

class ProbeError extends Error {
  constructor(
    public kind: McpTestFailureKind,
    message: string,
    public details: string,
  ) {
    super(message);
  }
}

const STEP_LABEL = {
  initialize: 'connecting',
  'tools/list': 'listing tools',
} as const;

function httpFailure(status: number, statusText: string, step: string, body: string, hadAuth: boolean): ProbeError {
  const base = `HTTP ${status}${statusText ? ` ${statusText}` : ''} while ${step}`;
  const details = body ? `${base}\n${body}` : base;
  const kind: McpTestFailureKind =
    status === 401 || status === 403
      ? 'auth'
      : status === 404
        ? 'not-found'
        : status === 405
          ? 'wrong-method'
          : status >= 500
            ? 'server-error'
            : 'http';
  return new ProbeError(kind, describeFailure(kind, { status, hadAuth }), details);
}

const protocolFailure = (details: string) =>
  new ProbeError('protocol', describeFailure('protocol', { hadAuth: false }), details);

/** Run the check. Never throws; every failure is an `{ ok: false }` outcome. */
export async function testMcpServerFromBrowser(
  input: McpTestInput,
  deps: McpTestDeps = {},
): Promise<McpTestOutcome> {
  const auth = input.authHeader.trim();
  const scrub = (text: string) => redactSecret(text, auth);

  const urlCheck = validateMCPServerUrlWithReason(input.url);
  if (!urlCheck.valid) {
    const message = friendlyUrlError(urlCheck.error);
    return { ok: false, kind: 'invalid-url', message, details: message };
  }

  const doFetch = deps.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? DEFAULT_TEST_TIMEOUT_MS);

  let nextId = 1;
  let sessionId: string | null = null;

  const headers = (): Record<string, string> => ({
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    ...(auth ? { Authorization: auth } : {}),
    ...(sessionId ? { 'Mcp-Session-Id': sessionId } : {}),
  });

  const call = async (method: keyof typeof STEP_LABEL, params: Record<string, unknown>) => {
    const id = nextId++;
    const step = STEP_LABEL[method];
    const response = await doFetch(input.url, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
      signal: controller.signal,
    });
    if (!response.ok) {
      let body = '';
      try {
        body = (await response.text()).trim().slice(0, BODY_SNIPPET_CHARS);
      } catch {
        // Body is only a hint.
      }
      throw httpFailure(response.status, response.statusText, step, body, !!auth);
    }
    if (method === 'initialize') sessionId = response.headers.get('mcp-session-id') || null;

    let reply: ReturnType<typeof parseSseJsonRpc>;
    try {
      reply = (response.headers.get('content-type') || '').includes('text/event-stream')
        ? parseSseJsonRpc(await response.text(), id)
        : await response.json();
    } catch {
      throw protocolFailure(`The reply while ${step} could not be read as JSON.`);
    }
    if (!reply || typeof reply !== 'object') {
      throw protocolFailure(`No JSON-RPC reply while ${step}.`);
    }
    if (reply.error) {
      const code = typeof reply.error.code === 'number' ? `${reply.error.code}: ` : '';
      throw new ProbeError(
        'protocol',
        'The server answered with an error instead of connecting.',
        `MCP error while ${step} — ${code}${String(reply.error.message ?? 'unknown error')}`,
      );
    }
    return reply.result as Record<string, unknown> | undefined;
  };

  try {
    await call('initialize', {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: 'amplify-genai', version: '1.0.0' },
    });

    // The spec requires this notification; a server that ignores or rejects it can still list tools.
    try {
      await doFetch(input.url, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
        signal: controller.signal,
      });
    } catch {
      // Best effort.
    }

    const tools: string[] = [];
    const seenCursors = new Set<string>();
    let cursor: string | undefined;
    for (let page = 0; page < MAX_TOOL_PAGES; page++) {
      const result = await call('tools/list', cursor ? { cursor } : {});
      if (!result || !Array.isArray(result.tools)) {
        throw protocolFailure('The tools/list reply had no "tools" list.');
      }
      for (const t of result.tools as unknown[]) {
        const name = (t as { name?: unknown } | null)?.name;
        if (typeof name === 'string' && name) tools.push(name);
      }
      const next = result.nextCursor;
      if (typeof next !== 'string' || !next || seenCursors.has(next)) break;
      seenCursors.add(next);
      cursor = next;
    }
    return { ok: true, tools };
  } catch (e) {
    if (e instanceof ProbeError) {
      return { ok: false, kind: e.kind, message: scrub(e.message), details: scrub(e.details) };
    }
    if (e instanceof Error && e.name === 'AbortError') {
      return {
        ok: false,
        kind: 'timeout',
        message: describeFailure('timeout', { hadAuth: !!auth }),
        details: `No reply within ${Math.round((deps.timeoutMs ?? DEFAULT_TEST_TIMEOUT_MS) / 1000)} seconds.`,
      };
    }
    // fetch() rejects with a bare TypeError for DNS failures, refused connections, TLS errors and
    // CORS blocks alike — the browser deliberately won't say which.
    return {
      ok: false,
      kind: 'network',
      message: describeFailure('network', { hadAuth: !!auth }),
      details: scrub(`Network request failed${e instanceof Error ? ` (${e.name}: ${e.message})` : ''}.`),
    };
  } finally {
    clearTimeout(timer);
  }
}
