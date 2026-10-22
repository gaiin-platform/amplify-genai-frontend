/**
 * useMcpServers — loads the user's MCP servers and runs the per-server actions.
 *
 * Same service calls as the legacy `Settings/MCPServersTab` (listMCPServers, deleteMCPServer,
 * toggleMCPServer, refreshMCPServerTools, updateMCPServer, startMCPOAuth, disconnectMCPOAuth).
 * Confirmation is the caller's job (ConfirmDialog); failures surface as toasts.
 *
 * - Reloads after an action keep the list on screen (`loading` is only true for the first load).
 * - A per-server `busy` map disables just that row's controls while its request is in flight.
 * - The OAuth popup is polled until it closes; the timers are cleared on unmount.
 *
 * Location: components/NewUI/settings/mcp/useMcpServers.ts
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import type { MCPOAuth2Config, MCPServerConfig, MCPTrustMode } from '@/types/mcp';
import {
  deleteMCPServer,
  disconnectMCPOAuth,
  listMCPServers,
  refreshMCPServerTools,
  startMCPOAuth,
  toggleMCPServer,
  updateMCPServer,
} from '@/services/mcpService';
import { oauthRedirectUri, trustUpdate, validateManualOAuth } from './mcpServerModel';

export type BusyAction = 'delete' | 'refresh' | 'toggle' | 'trust' | 'oauth-connect' | 'oauth-disconnect';

const OAUTH_POLL_MS = 1000;
const OAUTH_GIVE_UP_MS = 5 * 60 * 1000;

export interface UseMcpServers {
  servers: MCPServerConfig[];
  /** True only until the first load finishes. */
  loading: boolean;
  busy: Record<string, BusyAction | undefined>;
  reload: () => Promise<void>;
  remove: (id: string) => Promise<void>;
  setEnabled: (id: string, enabled: boolean) => Promise<void>;
  /** Resolves `'needs-auth'` when the server answered that it needs OAuth. */
  refreshTools: (id: string) => Promise<'ok' | 'needs-auth' | 'failed'>;
  setTrust: (id: string, target: MCPTrustMode) => Promise<void>;
  /** `manual` omitted = rely on the backend's OAuth auto-discovery. `onClosed` fires when the popup closes. */
  connectOAuth: (id: string, manual?: MCPOAuth2Config, onClosed?: () => void) => Promise<void>;
  disconnectOAuth: (id: string) => Promise<void>;
}

export function useMcpServers(): UseMcpServers {
  const [servers, setServers] = useState<MCPServerConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<Record<string, BusyAction | undefined>>({});

  // §16: re-armed in the effect body; a request sequence discards superseded responses.
  const alive = useRef(true);
  const loadSeq = useRef(0);
  const timers = useRef<Set<ReturnType<typeof setInterval | typeof setTimeout>>>(new Set());

  const reload = useCallback(async () => {
    const seq = ++loadSeq.current;
    try {
      const list = await listMCPServers();
      if (alive.current && seq === loadSeq.current) setServers(list);
    } catch {
      // listMCPServers already swallows and returns []; keep what we have.
    } finally {
      if (alive.current && seq === loadSeq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    void reload();
    const pending = timers.current;
    return () => {
      alive.current = false;
      pending.forEach((t) => {
        clearInterval(t as ReturnType<typeof setInterval>);
        clearTimeout(t as ReturnType<typeof setTimeout>);
      });
      pending.clear();
    };
  }, [reload]);

  const run = useCallback(
    async <T,>(id: string, action: BusyAction, work: () => Promise<T>): Promise<T | undefined> => {
      setBusy((b) => ({ ...b, [id]: action }));
      try {
        return await work();
      } finally {
        if (alive.current) setBusy((b) => ({ ...b, [id]: undefined }));
      }
    },
    [],
  );

  const remove = useCallback(
    (id: string) =>
      run(id, 'delete', async () => {
        const result = await deleteMCPServer(id);
        if (result.success) {
          toast.success('Server removed');
          await reload();
        } else {
          toast.error(result.error || 'Failed to remove the server');
        }
      }).then(() => undefined),
    [reload, run],
  );

  const setEnabled = useCallback(
    (id: string, enabled: boolean) =>
      run(id, 'toggle', async () => {
        const result = await toggleMCPServer(id, enabled);
        if (result.success) await reload();
        else toast.error(result.error || `Failed to ${enabled ? 'enable' : 'disable'} the server`);
      }).then(() => undefined),
    [reload, run],
  );

  const refreshTools = useCallback(
    async (id: string) =>
      (await run(id, 'refresh', async () => {
        const result = await refreshMCPServerTools(id);
        if (result.success) {
          await reload();
          return 'ok' as const;
        }
        if (result.requiresAuth) {
          await reload();
          return 'needs-auth' as const;
        }
        toast.error(result.error || 'Failed to refresh tools');
        return 'failed' as const;
      })) ?? 'failed',
    [reload, run],
  );

  const setTrust = useCallback(
    (id: string, target: MCPTrustMode) =>
      run(id, 'trust', async () => {
        const result = await updateMCPServer(id, trustUpdate(target));
        if (result.success) await reload();
        else toast.error(result.error || 'Failed to update the trust setting');
      }).then(() => undefined),
    [reload, run],
  );

  const connectOAuth = useCallback(
    (id: string, manual?: MCPOAuth2Config, onClosed?: () => void) =>
      run(id, 'oauth-connect', async () => {
        if (manual) {
          const problem = validateManualOAuth(manual);
          if (problem) {
            toast.error(problem);
            return;
          }
        }
        const result = await startMCPOAuth(id, manual, oauthRedirectUri(window.location.origin));
        if (!result.success || !result.authorizationUrl) {
          toast.error(result.error || 'Failed to start the OAuth sign-in');
          return;
        }
        const popup = window.open(result.authorizationUrl, '_blank', 'width=600,height=700');
        if (!popup) {
          toast.error('The sign-in window was blocked. Allow pop-ups for this site and try again.');
          return;
        }
        const poll = setInterval(() => {
          if (!popup.closed) return;
          clearInterval(poll);
          clearTimeout(giveUp);
          timers.current.delete(poll);
          timers.current.delete(giveUp);
          if (!alive.current) return;
          onClosed?.();
          void reload();
        }, OAUTH_POLL_MS);
        const giveUp = setTimeout(() => {
          clearInterval(poll);
          timers.current.delete(poll);
          timers.current.delete(giveUp);
        }, OAUTH_GIVE_UP_MS);
        timers.current.add(poll);
        timers.current.add(giveUp);
      }).then(() => undefined),
    [reload, run],
  );

  const disconnectOAuth = useCallback(
    (id: string) =>
      run(id, 'oauth-disconnect', async () => {
        const result = await disconnectMCPOAuth(id);
        if (result.success) await reload();
        else toast.error(result.error || 'Failed to disconnect OAuth');
      }).then(() => undefined),
    [reload, run],
  );

  return { servers, loading, busy, reload, remove, setEnabled, refreshTools, setTrust, connectOAuth, disconnectOAuth };
}
