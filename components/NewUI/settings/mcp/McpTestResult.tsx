/**
 * McpTestResult — the inline "Test connection" result for the Add MCP server form.
 *
 * The wrapper is ALWAYS rendered and is an `aria-live="polite"` status region, so a screen reader
 * hears "Testing connection…" and then the outcome (a live region must exist before its content
 * changes). Props only — renders to static markup in tests.
 *
 * Location: components/NewUI/settings/mcp/McpTestResult.tsx
 */

import React, { FC, useId, useState } from 'react';
import { IconAlertTriangle, IconCheck, IconLoader2 } from '@tabler/icons-react';
import { DisclosureChevron } from '@/components/NewUI/shared/DisclosureChevron';
import type { McpTestOutcome } from './mcpConnectionTest';

export type McpTestView = { status: 'testing' } | { status: 'done'; outcome: McpTestOutcome } | null;

const panel: React.CSSProperties = {
  marginTop: 16,
  padding: '10px 12px',
  border: '1px solid var(--border-subtle)',
  borderRadius: 8,
  background: 'var(--bg-app)',
  fontSize: 13,
  color: 'var(--text-primary)',
};

const toggleButton =
  'inline-flex items-center gap-1 text-[12.5px] text-[--text-secondary] rounded-sm hover:text-[--text-primary] focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]';

const Disclosure: FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <div style={{ marginTop: 6 }}>
      <button
        type="button"
        className={toggleButton}
        style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer' }}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
      >
        <DisclosureChevron open={open} />
        {label}
      </button>
      {open && <div id={panelId}>{children}</div>}
    </div>
  );
};

export const McpTestResult: FC<{ view: McpTestView }> = ({ view }) => (
  <div role="status" aria-live="polite" aria-atomic="true">
    {view?.status === 'testing' && (
      <div style={{ ...panel, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)' }}>
        <IconLoader2 size={16} aria-hidden="true" className="motion-safe:animate-spin" />
        Testing connection…
      </div>
    )}

    {view?.status === 'done' && view.outcome.ok && (
      <div style={panel}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <IconCheck size={16} aria-hidden="true" style={{ color: 'var(--success-fg)', flexShrink: 0 }} />
          <span style={{ fontWeight: 600 }}>Connected</span>
          <span style={{ color: 'var(--text-secondary)' }}>
            · {view.outcome.tools.length === 1 ? '1 tool' : `${view.outcome.tools.length} tools`} found
          </span>
        </div>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
          Checked from your browser. Nothing was saved.
        </p>
        {view.outcome.tools.length > 0 && (
          <Disclosure label="Show tools">
            <ul
              aria-label="Tools found"
              style={{
                margin: '6px 0 0',
                padding: '6px 10px',
                listStyle: 'none',
                maxHeight: 160,
                overflowY: 'auto',
                border: '1px solid var(--border-subtle)',
                borderRadius: 6,
                background: 'var(--bg-elevated)',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: 12,
                color: 'var(--text-secondary)',
              }}
            >
              {view.outcome.tools.map((name, i) => (
                <li key={`${name}-${i}`} style={{ padding: '2px 0', overflowWrap: 'anywhere' }}>
                  {name}
                </li>
              ))}
            </ul>
          </Disclosure>
        )}
      </div>
    )}

    {view?.status === 'done' && !view.outcome.ok && (
      <div style={panel}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <IconAlertTriangle
            size={16}
            aria-hidden="true"
            style={{ color: 'var(--text-error)', flexShrink: 0, marginTop: 2 }}
          />
          <div style={{ minWidth: 0 }}>
            <span style={{ fontWeight: 600 }}>Couldn’t connect. </span>
            <span style={{ color: 'var(--text-secondary)' }}>{view.outcome.message}</span>
          </div>
        </div>
        <Disclosure label="Show details">
          <pre
            style={{
              margin: '6px 0 0',
              padding: '6px 10px',
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
              border: '1px solid var(--border-subtle)',
              borderRadius: 6,
              background: 'var(--bg-elevated)',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: 12,
              color: 'var(--text-secondary)',
            }}
          >
            {view.outcome.details}
          </pre>
        </Disclosure>
      </div>
    )}
  </div>
);
