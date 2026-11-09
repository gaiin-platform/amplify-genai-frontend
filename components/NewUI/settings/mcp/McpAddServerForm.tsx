/**
 * McpAddServerForm — Settings → MCP Servers → "Add MCP server".
 *
 * New-UI replacement for the add form inside the legacy `Settings/MCPServersTab` (which the
 * classic settings dialog still uses). Same save call (`addMCPServer`) and the same payload — see
 * `mcpFormModel#buildSavePayload`; the trust mode is NOT sent, so the backend stores the new server
 * as client-side only. Layout, controls, footer and discard-confirm follow Settings → API Access.
 *
 * Location: components/NewUI/settings/mcp/McpAddServerForm.tsx
 */

import React, { FC, useEffect, useId, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  IconAlertTriangle,
  IconBook,
  IconBooks,
  IconBrandGithub,
  IconCheck,
  IconEye,
  IconEyeOff,
  IconLoader2,
  IconPlugConnected,
  IconPlus,
  IconServer,
} from '@tabler/icons-react';
import { MCPTransport } from '@/types/mcp';
import { addMCPServer } from '@/services/mcpService';
import { ConfirmDialog } from '@/components/NewUI/shared/ConfirmDialog';
import { FieldError, SelectControl, TextControl } from '@/components/NewUI/shared/FormControls';
import { InfoCallout } from '@/components/NewUI/shared/InfoCallout';
import { btnPrimary, btnSecondary } from '../apiKeys/buttonStyles';
import {
  assessServerUrl,
  buildSavePayload,
  canSubmit,
  canTestConnection,
  applyPreset,
  editField,
  emptyFormValues,
  isFormDirty,
  joinLabels,
  presetOverwrite,
  selectedPresetId,
  redactSecret,
  testSignature,
} from './mcpFormModel';
import { McpTestOutcome, testMcpServerFromBrowser } from './mcpConnectionTest';
import { MCP_PRESETS, McpPreset } from './mcpPresets';
import { McpTestResult, McpTestView } from './McpTestResult';

export const MCP_NAME_FIELD_ID = 'nui-mcp-name';

// Same card + label style as the API Access create form.
const cardShell: React.CSSProperties = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 12,
  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
};
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 };
// Two columns when the card is wide enough for ~340px fields (about 768px of content), else one.
// Container-based on purpose: the settings modal's own sidebar eats viewport width.
const fieldRow: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
  gap: '16px 24px',
  alignItems: 'start',
  marginTop: 16,
};
const helperStyle: React.CSSProperties = { margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' };

const PRESET_ICONS: Record<string, React.ComponentType<{ size?: number; 'aria-hidden'?: boolean | 'true' | 'false' }>> = {
  deepwiki: IconBrandGithub,
  mslearn: IconBook,
  context7: IconBooks,
};

const TRANSPORT_OPTIONS: { value: MCPTransport; label: string }[] = [
  { value: 'http', label: 'HTTP (recommended)' },
  { value: 'sse', label: 'SSE (Server-Sent Events)' },
];

type TestRun = { seq: number; sig: string; status: 'testing' } | { seq: number; sig: string; status: 'done'; outcome: McpTestOutcome };

export interface McpAddServerFormProps {
  /** The server was saved. The parent closes the form and reloads the list. */
  onAdded: () => void;
  /** The form was dismissed (after the discard confirmation, when there was input to lose). */
  onCancel: () => void;
  /** Whether Cancel / leaving would lose input — drives the settings modal's leave guard. */
  onDirtyChange: (dirty: boolean) => void;
}

export const McpAddServerForm: FC<McpAddServerFormProps> = ({ onAdded, onCancel, onDirtyChange }) => {
  const ids = useId().replace(/:/g, '');
  const id = (s: string) => `nui-mcp-${s}-${ids}`;

  // Just the field values. Which preset is "selected" is derived from them, never stored.
  const [values, setValues] = useState(emptyFormValues);
  const selectedId = selectedPresetId(values, MCP_PRESETS);
  const [pendingPreset, setPendingPreset] = useState<{ preset: McpPreset; labels: string[] } | null>(null);
  const [urlTouched, setUrlTouched] = useState(false);
  const [nameTouched, setNameTouched] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [run, setRun] = useState<TestRun | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // §16: re-arm in the effect body (StrictMode mounts twice).
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const seq = useRef(0);

  const dirty = isFormDirty(values);
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  const url = assessServerUrl(values.url);
  const urlError = urlTouched && url.state === 'invalid' ? url.message : undefined;
  const nameError = nameTouched && values.name.trim() === '' ? 'Enter a name for this server.' : undefined;
  const submitOk = canSubmit(values);
  const testOk = canTestConnection(values);

  // A result belongs to the url + transport + auth header it ran with; change any and it disappears.
  const sig = testSignature(values);
  const activeRun = run && run.sig === sig ? run : null;
  const testing = activeRun?.status === 'testing';
  const testView: McpTestView = !activeRun
    ? null
    : activeRun.status === 'testing'
      ? { status: 'testing' }
      : { status: 'done', outcome: activeRun.outcome };

  const set = <K extends keyof typeof values>(field: K, value: (typeof values)[K]) =>
    setValues((v) => editField(v, field, value));

  const fillPreset = (preset: McpPreset) => {
    setValues((v) => applyPreset(v, preset));
    // Show right away if a preset's address can't be saved, instead of waiting for a blur.
    setUrlTouched(true);
  };

  /** Fill the form with a preset. Ask first when that would throw away something the user typed. */
  const handlePreset = (presetId: string) => {
    const preset = MCP_PRESETS.find((p) => p.id === presetId);
    if (!preset || selectedId === preset.id) return;
    const { needsConfirm, labels } = presetOverwrite(values, preset, MCP_PRESETS);
    if (needsConfirm) setPendingPreset({ preset, labels });
    else fillPreset(preset);
  };

  const handleTest = async () => {
    if (!testOk || testing || saving) return;
    const mine = ++seq.current;
    setRun({ seq: mine, sig, status: 'testing' });
    const outcome = await testMcpServerFromBrowser({
      url: values.url,
      transport: values.transport,
      authHeader: values.authHeader,
    });
    if (!alive.current) return;
    setRun((prev) => (prev && prev.seq === mine ? { seq: mine, sig: prev.sig, status: 'done', outcome } : prev));
  };

  const handleAdd = async () => {
    if (saving) return;
    setNameTouched(true);
    setUrlTouched(true);
    if (!submitOk) return;
    setSaving(true);
    setSaveError(null);
    let result: Awaited<ReturnType<typeof addMCPServer>>;
    try {
      result = await addMCPServer(buildSavePayload(values));
    } catch {
      result = { success: false, error: 'Network error' };
    }
    if (!alive.current) return;
    setSaving(false);
    if (result.success) {
      toast.success('Server added');
      onAdded();
    } else {
      setSaveError(redactSecret(result.error || 'Failed to add server', values.authHeader));
    }
  };

  const requestCancel = () => {
    if (saving) return;
    if (dirty) setConfirmDiscard(true);
    else onCancel();
  };

  return (
    <section aria-labelledby={id('title')} style={{ ...cardShell, width: '100%', boxSizing: 'border-box' }}>
      <ConfirmDialog
        isOpen={confirmDiscard}
        title="Discard this new server?"
        message="You've started filling in a new MCP server. If you cancel now, what you entered will be lost."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        variant="danger"
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={() => {
          setConfirmDiscard(false);
          onCancel();
        }}
      />

      <ConfirmDialog
        isOpen={pendingPreset !== null}
        title={`Replace what you've entered?`}
        message={`Choosing “${pendingPreset?.preset.name ?? ''}” will replace the ${joinLabels(pendingPreset?.labels ?? [])} you've entered.`}
        confirmLabel="Replace"
        cancelLabel="Keep mine"
        variant="neutral"
        onCancel={() => setPendingPreset(null)}
        onConfirm={() => {
          if (pendingPreset) fillPreset(pendingPreset.preset);
          setPendingPreset(null);
        }}
      />

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void handleAdd();
        }}
        style={{ padding: 18 }}
      >
        <h3 id={id('title')} style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
          Add MCP server
        </h3>
        <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
          Connect a server that gives the AI extra tools.
        </p>

        {/* Presets */}
        <div style={{ marginTop: 16 }}>
          <span id={id('presets')} style={labelStyle}>
            Start from a preset (optional)
          </span>
          <div
            role="group"
            aria-labelledby={id('presets')}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 12 }}
          >
            {MCP_PRESETS.map((preset) => {
              const selected = selectedId === preset.id;
              const Icon = PRESET_ICONS[preset.id] ?? IconServer;
              return (
                <button
                  key={preset.id}
                  type="button"
                  aria-pressed={selected}
                  disabled={saving}
                  onClick={() => handlePreset(preset.id)}
                  className={`flex items-start gap-2.5 text-left rounded-[10px] px-3 py-2.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent] disabled:opacity-60 ${
                    selected ? '' : 'hover:bg-[--bg-hover]'
                  }`}
                  style={{
                    cursor: 'pointer',
                    color: 'var(--text-primary)',
                    border: `1px solid ${selected ? 'var(--accent)' : 'var(--border-subtle)'}`,
                    background: selected
                      ? 'color-mix(in srgb, var(--accent) 10%, var(--bg-elevated))'
                      : 'var(--bg-app)',
                  }}
                >
                  <span style={{ marginTop: 1, color: selected ? 'var(--accent)' : 'var(--text-secondary)', flexShrink: 0 }}>
                    <Icon size={18} aria-hidden="true" />
                  </span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 500 }}>{preset.name}</span>
                    <span
                      style={{
                        display: 'block',
                        marginTop: 1,
                        fontSize: 12,
                        lineHeight: 1.35,
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {preset.description}
                    </span>
                  </span>
                  {selected && (
                    <IconCheck size={16} aria-hidden="true" style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 1 }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Fields */}
        <div style={fieldRow}>
          <div>
            <label htmlFor={MCP_NAME_FIELD_ID} style={labelStyle}>
              Server name
            </label>
            <TextControl
              id={MCP_NAME_FIELD_ID}
              value={values.name}
              invalid={!!nameError}
              aria-describedby={id('name-err')}
              disabled={saving}
              autoComplete="off"
              onChange={(e) => set('name', e.target.value)}
              onBlur={() => setNameTouched(true)}
              placeholder="e.g. Team knowledge base"
            />
            <FieldError id={id('name-err')}>{nameError}</FieldError>
          </div>

          <div>
            <label htmlFor={id('url')} style={labelStyle}>
              Server URL
            </label>
            <TextControl
              id={id('url')}
              value={values.url}
              invalid={!!urlError}
              aria-describedby={`${id('url-help')} ${id('url-err')}`}
              disabled={saving}
              inputMode="url"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              onChange={(e) => set('url', e.target.value)}
              onBlur={() => setUrlTouched(true)}
              placeholder="https://example.com/mcp"
            />
            <FieldError id={id('url-err')}>{urlError}</FieldError>
            {url.state === 'valid' && url.insecure && urlTouched && (
              <p
                role="status"
                style={{ display: 'flex', alignItems: 'flex-start', gap: 6, margin: '6px 0 0', fontSize: 12, color: 'var(--warning-fg)' }}
              >
                <IconAlertTriangle size={14} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />
                This address uses http://, so the connection isn’t encrypted. Anything sent to it, including your
                Authorization header, can be read in transit.
              </p>
            )}
            <p id={id('url-help')} style={helperStyle}>
              The address of the server’s MCP endpoint.
            </p>
          </div>
        </div>

        <div style={fieldRow}>
          <div>
            <label htmlFor={id('transport')} style={labelStyle}>
              Transport
            </label>
            <SelectControl
              id={id('transport')}
              value={values.transport}
              disabled={saving}
              aria-describedby={id('transport-help')}
              onChange={(e) => set('transport', e.target.value as MCPTransport)}
            >
              {TRANSPORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </SelectControl>
            <p id={id('transport-help')} style={helperStyle}>
              Use HTTP unless the server’s documentation says it only supports SSE.
            </p>
          </div>

          <div>
            <label htmlFor={id('auth')} style={labelStyle}>
              Authorization header (optional)
            </label>
            <div style={{ position: 'relative' }}>
              <TextControl
                id={id('auth')}
                type={showAuth ? 'text' : 'password'}
                value={values.authHeader}
                disabled={saving}
                aria-describedby={id('auth-help')}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                data-lpignore="true"
                data-1p-ignore="true"
                onChange={(e) => set('authHeader', e.target.value)}
                placeholder="Bearer <token>"
                style={{ paddingRight: 38 }}
              />
              <button
                type="button"
                aria-label={showAuth ? 'Hide authorization header' : 'Show authorization header'}
                aria-pressed={showAuth}
                onClick={() => setShowAuth((s) => !s)}
                className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-7 h-7 rounded-md text-[--text-muted] hover:bg-[--bg-hover] hover:text-[--text-primary] focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]"
                style={{ background: 'transparent', border: 0, cursor: 'pointer' }}
              >
                {showAuth ? <IconEyeOff size={16} aria-hidden="true" /> : <IconEye size={16} aria-hidden="true" />}
              </button>
            </div>
            <p id={id('auth-help')} style={helperStyle}>
              Sent as the Authorization header. Include the scheme, e.g. {'Bearer <token>'}.
            </p>
          </div>
        </div>

        {/* Test result (announced) */}
        <McpTestResult view={testView} />

        {saveError && (
          <div role="alert" style={{ marginTop: 16, fontSize: 13, color: 'var(--text-error)' }}>
            {saveError}
          </div>
        )}

        {/* Client-side notice — see mcp_servers.py#add_mcp_server (no trustMode ⇒ "untrusted") */}
        <InfoCallout marginTop={16}>
          New servers start as client-side only. To enable OAuth, backend refresh and server-side tools, choose{' '}
          <strong style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Trust for server-side</strong> on the
          server’s row after adding it.
        </InfoCallout>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8, marginTop: 20 }}>
          <button type="button" className={btnSecondary} disabled={saving} onClick={requestCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={btnSecondary}
            disabled={!testOk || testing || saving}
            aria-busy={testing}
            onClick={() => void handleTest()}
          >
            {testing ? (
              <IconLoader2 size={15} aria-hidden="true" className="motion-safe:animate-spin" />
            ) : (
              <IconPlugConnected size={15} aria-hidden="true" />
            )}
            Test connection
          </button>
          <button type="submit" className={btnPrimary} disabled={!submitOk || saving} aria-busy={saving}>
            {saving ? (
              <IconLoader2 size={15} aria-hidden="true" className="motion-safe:animate-spin" />
            ) : (
              <IconPlus size={15} aria-hidden="true" />
            )}
            {saving ? 'Adding…' : 'Add server'}
          </button>
        </div>
      </form>
    </section>
  );
};
