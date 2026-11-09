/**
 * McpServerList — Settings → MCP Servers → the list of saved servers.
 *
 * New-UI replacement for the list half of the legacy `Settings/MCPServersTab`: same actions (trust,
 * refresh tools, enable, remove, OAuth), tokens instead of purple, `ConfirmDialog` instead of
 * `confirm()`, toasts instead of `alert()`. State and requests live in `useMcpServers`; this file
 * only holds presentation state (expanded rows, open OAuth panels, the pending confirmation).
 *
 * Location: components/NewUI/settings/mcp/McpServerList.tsx
 */

import React, { FC, ReactNode, useId, useState } from 'react';
import {
  IconCheck,
  IconLoader2,
  IconPlugConnected,
  IconPlugConnectedX,
  IconRefresh,
  IconServer,
  IconTrash,
} from '@tabler/icons-react';
import type { MCPOAuth2Config, MCPServerConfig } from '@/types/mcp';
import { ConfirmDialog } from '@/components/NewUI/shared/ConfirmDialog';
import { DisclosureChevron } from '@/components/NewUI/shared/DisclosureChevron';
import { IconButton } from '@/components/NewUI/shared/IconButton';
import { TextControl } from '@/components/NewUI/shared/FormControls';
import { ToggleSwitch } from '@/components/NewUI/shared/ToggleSwitch';
import { btnPrimary, btnSecondary } from '../apiKeys/buttonStyles';
import {
  confirmCopy,
  EMPTY_OAUTH_FORM,
  isServerTrusted,
  oauthPanelKind,
  ServerAction,
  serverConnection,
} from './mcpServerModel';
import type { UseMcpServers } from './useMcpServers';

const cardShell: React.CSSProperties = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 12,
  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
};
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 };
const pillBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  height: 22,
  padding: '0 9px',
  fontSize: 12,
  fontWeight: 500,
  borderRadius: 999,
  whiteSpace: 'nowrap',
};
const linkButton =
  'text-[12.5px] rounded-sm underline text-[--text-secondary] hover:text-[--text-primary] focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent] disabled:opacity-50 disabled:pointer-events-none';

const CONNECTION_LABEL = { connected: 'Connected', error: 'Connection error', idle: 'Not connected' } as const;

type Api = Pick<
  UseMcpServers,
  'busy' | 'setEnabled' | 'refreshTools' | 'connectOAuth'
> & { ask: (action: ServerAction, server: MCPServerConfig) => void };

// ── OAuth area ───────────────────────────────────────────────────────────────

const ManualOAuthForm: FC<{ server: MCPServerConfig; api: Api; onClosed: () => void }> = ({ server, api, onClosed }) => {
  const uid = useId().replace(/:/g, '');
  const [form, setForm] = useState<MCPOAuth2Config>(EMPTY_OAUTH_FORM);
  const connecting = api.busy[server.id] === 'oauth-connect';
  const field = (key: keyof MCPOAuth2Config, label: string, extra: Partial<React.ComponentProps<typeof TextControl>> = {}) => (
    <div>
      <label htmlFor={`${uid}-${key}`} style={labelStyle}>
        {label}
      </label>
      <TextControl
        id={`${uid}-${key}`}
        value={form[key] ?? ''}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        {...extra}
      />
    </div>
  );
  return (
    <div style={{ marginTop: 12, padding: 12, border: '1px solid var(--border-subtle)', borderRadius: 8, background: 'var(--bg-app)' }}>
      <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600 }}>OAuth 2.0 settings</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        {field('clientId', 'Client ID')}
        {field('clientSecret', 'Client secret', { type: 'password' })}
        <div style={{ gridColumn: '1 / -1' }}>
          {field('authorizationUrl', 'Authorization URL', { placeholder: 'https://provider.com/oauth/authorize' })}
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          {field('tokenUrl', 'Token URL', { placeholder: 'https://provider.com/oauth/token' })}
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          {field('scopes', 'Scopes (optional, space-separated)', { placeholder: 'read write' })}
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <button
          type="button"
          className={btnPrimary}
          disabled={connecting}
          aria-busy={connecting}
          onClick={() => void api.connectOAuth(server.id, form, onClosed)}
        >
          {connecting ? (
            <IconLoader2 size={15} aria-hidden="true" className="motion-safe:animate-spin" />
          ) : (
            <IconPlugConnected size={15} aria-hidden="true" />
          )}
          {connecting ? 'Redirecting…' : 'Authorize'}
        </button>
      </div>
    </div>
  );
};

const OAuthArea: FC<{
  server: MCPServerConfig;
  api: Api;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}> = ({ server, api, open, onOpenChange }) => {
  const kind = oauthPanelKind(server);
  const connecting = api.busy[server.id] === 'oauth-connect';
  const disconnecting = api.busy[server.id] === 'oauth-disconnect';
  const closePanel = () => onOpenChange(false);

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
      {kind === 'untrusted' && (
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-muted)' }}>
          OAuth sign-in is off for client-side-only servers. Trust the server to use it.
        </p>
      )}

      {kind === 'connected' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--success-fg)' }}>
            <IconCheck size={15} aria-hidden="true" />
            OAuth connected
          </span>
          <span style={{ display: 'inline-flex', gap: 14 }}>
            <button type="button" className={linkButton} disabled={connecting} onClick={() => void api.connectOAuth(server.id, undefined, closePanel)}>
              {connecting ? 'Signing in…' : 'Re-authenticate'}
            </button>
            <button type="button" className={`${linkButton} !text-[--text-error]`} disabled={disconnecting} onClick={() => api.ask('disconnect', server)}>
              {disconnecting ? 'Disconnecting…' : 'Disconnect'}
            </button>
          </span>
        </div>
      )}

      {kind === 'discoverable' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
          <button
            type="button"
            className={btnSecondary}
            disabled={connecting}
            aria-busy={connecting}
            onClick={() => void api.connectOAuth(server.id, undefined, closePanel)}
          >
            {connecting ? (
              <IconLoader2 size={15} aria-hidden="true" className="motion-safe:animate-spin" />
            ) : (
              <IconPlugConnected size={15} aria-hidden="true" />
            )}
            {connecting ? 'Signing in…' : `Sign in with ${server.name}`}
          </button>
          <button type="button" className={linkButton} aria-expanded={open} onClick={() => onOpenChange(!open)}>
            {open ? 'Hide advanced' : 'Advanced (manual config)'}
          </button>
        </div>
      )}

      {kind === 'manual' && (
        <button type="button" className={`${linkButton} inline-flex items-center gap-1.5 no-underline`} aria-expanded={open} onClick={() => onOpenChange(!open)}>
          <IconPlugConnected size={14} aria-hidden="true" />
          {open ? 'Cancel OAuth setup' : 'Connect with OAuth 2.0'}
        </button>
      )}

      {open && (kind === 'discoverable' || kind === 'manual') && (
        <ManualOAuthForm server={server} api={api} onClosed={closePanel} />
      )}
    </div>
  );
};

// ── One server ───────────────────────────────────────────────────────────────

const ServerCard: FC<{
  server: MCPServerConfig;
  api: Api;
  oauthOpen: boolean;
  onOauthOpenChange: (open: boolean) => void;
  onNeedsAuth: (id: string) => void;
}> = ({ server, api, oauthOpen, onOauthOpenChange, onNeedsAuth }) => {
  const toolsId = useId();
  const [toolsOpen, setToolsOpen] = useState(false);
  const trusted = isServerTrusted(server);
  const connection = serverConnection(server);
  const busy = api.busy[server.id];
  const tools = server.tools ?? [];
  const ConnIcon = connection === 'connected' ? IconPlugConnected : IconPlugConnectedX;

  return (
    <li style={{ ...cardShell, padding: 16, listStyle: 'none' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0, flex: '1 1 260px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <span
              role="img"
              aria-label={CONNECTION_LABEL[connection]}
              title={CONNECTION_LABEL[connection]}
              style={{
                display: 'inline-flex',
                color: connection === 'connected' ? 'var(--success-fg)' : connection === 'error' ? 'var(--text-error)' : 'var(--text-muted)',
              }}
            >
              <ConnIcon size={16} aria-hidden="true" />
            </span>
            <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, overflowWrap: 'anywhere' }}>{server.name}</h4>
            {trusted ? (
              <span style={{ ...pillBase, color: 'var(--success-fg)', background: 'var(--success-bg)' }}>
                <IconCheck size={13} stroke={2.5} aria-hidden="true" />
                Trusted
              </span>
            ) : (
              <span style={{ ...pillBase, color: 'var(--text-secondary)', background: 'var(--bg-active)' }}>Client-side only</span>
            )}
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--text-muted)', overflowWrap: 'anywhere', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
            {server.url}
          </p>
          {!trusted && (
            <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--text-muted)' }}>
              Not trusted for server-side use. Backend refresh, OAuth and server-side tool execution are off.
            </p>
          )}
          {server.lastError && (
            <p role="status" style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--text-error)', overflowWrap: 'anywhere' }}>
              Last error: {server.lastError}
            </p>
          )}
          {tools.length > 0 && (
            <button
              type="button"
              className="mt-2 inline-flex items-center gap-1 text-[12.5px] text-[--text-secondary] rounded-sm hover:text-[--text-primary] focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]"
              style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer' }}
              aria-expanded={toolsOpen}
              aria-controls={toolsId}
              onClick={() => setToolsOpen((o) => !o)}
            >
              <DisclosureChevron open={toolsOpen} />
              {tools.length === 1 ? '1 tool available' : `${tools.length} tools available`}
            </button>
          )}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
          <button
            type="button"
            className={btnSecondary}
            disabled={busy === 'trust'}
            aria-busy={busy === 'trust'}
            onClick={() => api.ask(trusted ? 'untrust' : 'trust', server)}
          >
            {busy === 'trust' ? 'Saving…' : trusted ? 'Make client-side only' : 'Trust for server-side'}
          </button>
          <IconButton
            aria-label={`Refresh tools for ${server.name}`}
            title={trusted ? 'Refresh tools' : 'Trust this server to refresh its tools'}
            disabled={!trusted || busy === 'refresh'}
            onClick={() => void api.refreshTools(server.id).then((r) => r === 'needs-auth' && onNeedsAuth(server.id))}
          >
            {busy === 'refresh' ? (
              <IconLoader2 size={16} aria-hidden="true" className="motion-safe:animate-spin" />
            ) : (
              <IconRefresh size={16} aria-hidden="true" />
            )}
          </IconButton>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text-secondary)' }}>
            <span id={`${toolsId}-en`}>{server.enabled ? 'Enabled' : 'Disabled'}</span>
            <ToggleSwitch
              checked={server.enabled}
              disabled={busy === 'toggle'}
              aria-labelledby={`${toolsId}-en`}
              onChange={(next) => void api.setEnabled(server.id, next)}
            />
          </span>
          <IconButton
            aria-label={`Remove ${server.name}`}
            title="Remove server"
            disabled={busy === 'delete'}
            onClick={() => api.ask('delete', server)}
          >
            {busy === 'delete' ? (
              <IconLoader2 size={16} aria-hidden="true" className="motion-safe:animate-spin" />
            ) : (
              <IconTrash size={16} aria-hidden="true" />
            )}
          </IconButton>
        </div>
      </div>

      {toolsOpen && tools.length > 0 && (
        <ul
          id={toolsId}
          aria-label={`Tools from ${server.name}`}
          style={{ margin: '12px 0 0', padding: '8px 12px', listStyle: 'none', border: '1px solid var(--border-subtle)', borderRadius: 8, background: 'var(--bg-app)', maxHeight: 240, overflowY: 'auto' }}
        >
          {tools.map((tool) => (
            <li key={tool.name} style={{ padding: '4px 0' }}>
              <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12.5 }}>{tool.name}</span>
              {tool.description && (
                <p style={{ margin: '1px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>{tool.description}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      <OAuthArea server={server} api={api} open={oauthOpen} onOpenChange={onOauthOpenChange} />
    </li>
  );
};

// ── The list ─────────────────────────────────────────────────────────────────

export interface McpServerListProps {
  servers: UseMcpServers;
  /** Hide the "no servers yet" text (e.g. while the add form is open). */
  hideEmpty?: boolean;
  /** Rendered in the empty state, e.g. a hint pointing at the Add server button. */
  emptyHint?: ReactNode;
}

export const McpServerList: FC<McpServerListProps> = ({ servers: hook, hideEmpty = false, emptyHint }) => {
  const [oauthOpenId, setOauthOpenId] = useState<string | null>(null);
  const [pending, setPending] = useState<{ action: ServerAction; server: MCPServerConfig } | null>(null);

  const api: Api = {
    busy: hook.busy,
    setEnabled: hook.setEnabled,
    refreshTools: hook.refreshTools,
    connectOAuth: hook.connectOAuth,
    ask: (action, server) => setPending({ action, server }),
  };

  const confirm = () => {
    if (!pending) return;
    const { action, server } = pending;
    setPending(null);
    if (action === 'delete') void hook.remove(server.id);
    else if (action === 'trust') void hook.setTrust(server.id, 'trusted');
    else if (action === 'untrust') void hook.setTrust(server.id, 'untrusted');
    else void hook.disconnectOAuth(server.id);
  };
  const copy = pending ? confirmCopy(pending.action, pending.server.name) : null;

  if (hook.servers.length === 0) {
    if (hideEmpty) return null;
    return (
      <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
        <IconServer size={40} aria-hidden="true" style={{ margin: '0 auto 8px', opacity: 0.6 }} />
        <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)' }}>No MCP servers yet.</p>
        {emptyHint && <p style={{ margin: '4px 0 0', fontSize: 13 }}>{emptyHint}</p>}
      </div>
    );
  }

  return (
    <section aria-label="Your MCP servers">
      <ConfirmDialog
        isOpen={!!copy}
        title={copy?.title ?? ''}
        message={copy?.message ?? ''}
        confirmLabel={copy?.confirmLabel}
        cancelLabel="Cancel"
        variant={copy?.variant ?? 'neutral'}
        onCancel={() => setPending(null)}
        onConfirm={confirm}
      />
      <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Your servers</h3>
      <ul style={{ margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {hook.servers.map((server) => (
          <ServerCard
            key={server.id}
            server={server}
            api={api}
            oauthOpen={oauthOpenId === server.id}
            onOauthOpenChange={(open) => setOauthOpenId(open ? server.id : null)}
            onNeedsAuth={setOauthOpenId}
          />
        ))}
      </ul>
    </section>
  );
};
