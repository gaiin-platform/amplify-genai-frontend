/**
 * mcpServerModel — the rules behind the MCP server LIST (trust, OAuth, confirmations). No React.
 *
 * Ported from the legacy `Settings/MCPServersTab` with the same behaviour and the same service
 * payloads (`updateMCPServer` trust update, `startMCPOAuth` + redirect URI). What changed is only
 * how it is presented: confirmations are dialogs, not `confirm()`, and failures are toasts, not
 * `alert()`.
 *
 * Location: components/NewUI/settings/mcp/mcpServerModel.ts
 */

import type { MCPOAuth2Config, MCPServerConfig, MCPTrustMode } from '@/types/mcp';

/** Records saved before trust existed have no `trustMode`; the backend treats them as trusted. */
export const isServerTrusted = (server: Pick<MCPServerConfig, 'trustMode'>): boolean =>
  (server.trustMode ?? 'trusted') === 'trusted';

/** What the OAuth area of a row shows. */
export type OAuthPanelKind = 'untrusted' | 'connected' | 'discoverable' | 'manual';

export function oauthPanelKind(
  server: Pick<MCPServerConfig, 'trustMode' | 'oauthConnected' | 'oauthDiscoverable'>,
): OAuthPanelKind {
  if (!isServerTrusted(server)) return 'untrusted';
  if (server.oauthConnected) return 'connected';
  if (server.oauthDiscoverable) return 'discoverable';
  return 'manual';
}

/** The `updateMCPServer` fields for a trust change — identical to the legacy handler's. */
export const trustUpdate = (target: MCPTrustMode) => ({
  trustMode: target,
  trustReason: target === 'trusted' ? 'manual_override' : 'user_added',
});

export type ServerAction = 'delete' | 'trust' | 'untrust' | 'disconnect';

export interface ConfirmCopy {
  title: string;
  message: string;
  confirmLabel: string;
  variant: 'danger' | 'neutral';
}

export function confirmCopy(action: ServerAction, serverName: string): ConfirmCopy {
  switch (action) {
    case 'delete':
      return {
        title: `Remove “${serverName}”?`,
        message: 'This removes the server and its saved settings. You can add it again later.',
        confirmLabel: 'Remove',
        variant: 'danger',
      };
    case 'trust':
      return {
        title: 'Trust this server for server-side use?',
        message:
          'This enables backend test, refresh, OAuth, and server-side tool execution for this server. Only trust servers you control or know.',
        confirmLabel: 'Trust server',
        variant: 'neutral',
      };
    case 'untrust':
      return {
        title: 'Move this server back to client-side only?',
        message:
          'This disables backend test, refresh, OAuth, and server-side tool execution for this server.',
        confirmLabel: 'Move to client-side only',
        variant: 'neutral',
      };
    case 'disconnect':
      return {
        title: 'Disconnect OAuth?',
        message: `This removes the saved OAuth token for “${serverName}”. You can sign in again later.`,
        confirmLabel: 'Disconnect',
        variant: 'danger',
      };
  }
}

export const EMPTY_OAUTH_FORM: MCPOAuth2Config = {
  clientId: '',
  clientSecret: '',
  authorizationUrl: '',
  tokenUrl: '',
  scopes: '',
};

/** Manual OAuth needs these three; anything else is optional. `null` = fine. */
export function validateManualOAuth(form: MCPOAuth2Config): string | null {
  return form.clientId && form.authorizationUrl && form.tokenUrl
    ? null
    : 'Client ID, Authorization URL and Token URL are required.';
}

/** Where the provider sends the user back to (`pages/api/mcp-oauth-callback`). */
export const oauthRedirectUri = (origin: string): string => `${origin}/mcp-oauth-callback`;

export type ServerConnection = 'connected' | 'error' | 'idle';

export const serverConnection = (server: Pick<MCPServerConfig, 'status'>): ServerConnection =>
  server.status === 'connected' ? 'connected' : server.status === 'error' ? 'error' : 'idle';
