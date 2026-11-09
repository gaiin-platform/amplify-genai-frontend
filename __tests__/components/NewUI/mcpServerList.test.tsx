/**
 * Static-markup tests for the MCP server list: the accessible contract and the trusted vs
 * client-side-only presentation. Request behaviour lives in useMcpServers (thin over mcpService).
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/services/mcpService', () => ({}));

import { McpServerList } from '@/components/NewUI/settings/mcp/McpServerList';
import type { UseMcpServers } from '@/components/NewUI/settings/mcp/useMcpServers';

const server = (over: Record<string, unknown> = {}): any => ({
  id: 'mcp_1_a',
  name: 'Docs',
  url: 'https://example.com/mcp',
  transport: 'http',
  enabled: true,
  tools: [],
  status: 'disconnected',
  ...over,
});

const hook = (servers: any[], busy: UseMcpServers['busy'] = {}): UseMcpServers => ({
  servers,
  loading: false,
  busy,
  reload: async () => {},
  remove: async () => {},
  setEnabled: async () => {},
  refreshTools: async () => 'ok',
  setTrust: async () => {},
  connectOAuth: async () => {},
  disconnectOAuth: async () => {},
});

const render = (servers: any[], props: Record<string, unknown> = {}, busy: UseMcpServers['busy'] = {}) =>
  renderToStaticMarkup(<McpServerList servers={hook(servers, busy)} {...props} />);

describe('McpServerList', () => {
  it('shows an empty state, and nothing while the add form is open', () => {
    expect(render([], { emptyHint: 'Use Add server.' })).toContain('No MCP servers yet.');
    expect(render([], { hideEmpty: true })).toBe('');
  });

  it('presents a client-side-only server with a Trust action and no OAuth', () => {
    const html = render([server({ trustMode: 'untrusted' })]);
    expect(html).toContain('Client-side only');
    expect(html).toContain('Trust for server-side');
    expect(html).toContain('Not trusted for server-side use');
    expect(html).toContain('OAuth sign-in is off for client-side-only servers');
    expect(html).not.toContain('Sign in with');
    // Refresh needs a trusted server.
    expect(html).toMatch(/aria-label="Refresh tools for Docs"[^>]*disabled/);
  });

  it('presents a trusted (or legacy) server with its server-side actions', () => {
    const html = render([server({ oauthDiscoverable: true })]);
    expect(html).toContain('Trusted');
    expect(html).toContain('Make client-side only');
    expect(html).toContain('Sign in with Docs');
    expect(html).toContain('Advanced (manual config)');
    expect(html).not.toMatch(/aria-label="Refresh tools for Docs"[^>]*disabled/);
  });

  it('gives every control an accessible name and uses no purple/amber classes', () => {
    const html = render([server({ status: 'connected', tools: [{ name: 'search', description: 'd' }] })]);
    expect(html).toContain('aria-label="Connected"');
    expect(html).toContain('aria-label="Remove Docs"');
    expect(html).toContain('role="switch"');
    expect(html).toContain('1 tool available');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toMatch(/purple|amber/);
  });

  it('shows a last error as text, not hidden', () => {
    expect(render([server({ lastError: 'boom' })])).toContain('Last error: boom');
  });

  it('disables a row while its request is in flight', () => {
    const html = render([server({ trustMode: 'untrusted' })], {}, { mcp_1_a: 'trust' });
    expect(html).toContain('Saving…');
  });

  it('shows OAuth connected with re-authenticate and disconnect', () => {
    const html = render([server({ oauthConnected: true })]);
    expect(html).toContain('OAuth connected');
    expect(html).toContain('Re-authenticate');
    expect(html).toContain('Disconnect');
  });
});
