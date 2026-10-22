/**
 * Static-markup tests for the Add MCP server form: the visible/accessibility contract
 * (labels, preset toggle buttons, masked auth field, footer order, notice wording, live region).
 * Interactive rules are covered by mcpFormModel.test.ts and mcpConnectionTest.test.ts.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/services/mcpService', () => ({ addMCPServer: vi.fn(), listMCPServers: vi.fn() }));

import { McpAddServerForm } from '@/components/NewUI/settings/mcp/McpAddServerForm';
import { MCP_PRESETS } from '@/components/NewUI/settings/mcp/mcpPresets';
import { McpTestResult } from '@/components/NewUI/settings/mcp/McpTestResult';

const form = () =>
  renderToStaticMarkup(<McpAddServerForm onAdded={() => {}} onCancel={() => {}} onDirtyChange={() => {}} />);

describe('McpAddServerForm', () => {
  const html = form();

  it('uses sentence-case labels, each tied to a control', () => {
    for (const label of ['Server name', 'Server URL', 'Transport', 'Authorization header (optional)']) {
      expect(html).toContain(label);
    }
    expect(html.match(/<label /g)?.length).toBe(4);
    expect(html).not.toContain('Server Name');
    expect(html).not.toContain('Test Connection');
  });

  it('offers the presets as an unpressed toggle-button group', () => {
    expect(html).toContain('Start from a preset (optional)');
    expect(html).toContain('role="group"');
    expect(html.match(/aria-pressed="false"/g)?.length).toBeGreaterThanOrEqual(3);
    for (const p of MCP_PRESETS) expect(html).toContain(p.name);
    expect(html).not.toContain('local' + 'host');
  });

  it('masks the authorization header, with a show/hide toggle and the generic helper', () => {
    expect(html).toMatch(/type="password"/);
    expect(html).toContain('aria-label="Show authorization header"');
    expect(html).toContain('Sent as the Authorization header. Include the scheme, e.g. Bearer &lt;token&gt;.');
    expect(html).not.toContain('scite');
  });

  it('puts Cancel, Test connection, Add server in that order, with Add disabled while empty', () => {
    const cancel = html.indexOf('>Cancel<');
    const test = html.indexOf('Test connection');
    const add = html.indexOf('Add server');
    expect(cancel).toBeGreaterThan(0);
    expect(test).toBeGreaterThan(cancel);
    expect(add).toBeGreaterThan(test);
    expect(html).toMatch(/<button type="submit"[^>]*disabled/);
    expect(html).toMatch(/Test connection/);
  });

  it('explains client-side behaviour neutrally (no amber)', () => {
    expect(html).toContain('New servers start as client-side only.');
    expect(html).toContain('<strong style="font-weight:600;color:var(--text-primary)">Trust for server-side</strong>');
    // A full-width callout (raised token background, 1px subtle border, 8px radius, 12px padding), before the footer buttons.
    expect(html).toMatch(/padding:12px;border-radius:8px;background:var\(--bg-raised\);border:1px solid var\(--border-subtle\)/);
    expect(html.indexOf('New servers start as')).toBeLessThan(html.indexOf('>Cancel<'));
    expect(html).not.toMatch(/max-width:\s*560/);
    expect(html).not.toMatch(/amber|warning-bg/);
  });

  it('fills the content width and lays fields out as two responsive columns', () => {
    expect(html).not.toMatch(/max-width:\s*680/);
    expect(html).toMatch(/<section[^>]*width:100%/);
    // name+URL and transport+auth are two separate two-column grids that collapse to one column.
    expect(html.match(/grid-template-columns:repeat\(auto-fit, ?minmax\(min\(100%, ?340px\), ?1fr\)\)/g)?.length).toBe(2);
    // presets stretch evenly across the row
    expect(html).toMatch(/grid-template-columns:repeat\(auto-fit, ?minmax\(min\(100%, ?200px\), ?1fr\)\)/);
  });

  it('has an always-present polite live region for test results', () => {
    expect(html).toMatch(/role="status" aria-live="polite"/);
  });
});

describe('McpTestResult', () => {
  const view = (v: React.ComponentProps<typeof McpTestResult>['view']) =>
    renderToStaticMarkup(<McpTestResult view={v} />);

  it('renders an empty live region when idle', () => {
    expect(view(null)).toBe('<div role="status" aria-live="polite" aria-atomic="true"></div>');
  });

  it('shows the spinner copy while testing', () => {
    expect(view({ status: 'testing' })).toContain('Testing connection…');
  });

  it('shows Connected with a tool count and a collapsed tool list', () => {
    const out = view({ status: 'done', outcome: { ok: true, tools: ['a', 'b'] } });
    expect(out).toContain('Connected');
    expect(out).toContain('2 tools');
    expect(out).toContain('aria-expanded="false"');
    expect(out).toContain('Checked from your browser.');
    expect(out).not.toContain('Tools found'); // hidden until expanded
    expect(view({ status: 'done', outcome: { ok: true, tools: ['a'] } })).toContain('1 tool ');
    expect(view({ status: 'done', outcome: { ok: true, tools: [] } })).toContain(
      'Checked from your browser.',
    );
  });

  it('shows a plain message with collapsed details on failure', () => {
    const out = view({
      status: 'done',
      outcome: { ok: false, kind: 'auth', message: 'The server rejected your credentials.', details: 'HTTP 401' },
    });
    expect(out).toContain('The server rejected your credentials.');
    expect(out).toContain('Show details');
    expect(out).not.toContain('HTTP 401');
  });
});
