import { describe, expect, it } from 'vitest';
import {
  confirmCopy,
  EMPTY_OAUTH_FORM,
  isServerTrusted,
  oauthPanelKind,
  oauthRedirectUri,
  serverConnection,
  trustUpdate,
  validateManualOAuth,
} from '@/components/NewUI/settings/mcp/mcpServerModel';

describe('trust', () => {
  it('treats records without a trustMode as trusted (legacy servers keep working)', () => {
    expect(isServerTrusted({})).toBe(true);
    expect(isServerTrusted({ trustMode: 'trusted' })).toBe(true);
    expect(isServerTrusted({ trustMode: 'untrusted' })).toBe(false);
  });

  it('sends the same trust update the legacy list sent', () => {
    expect(trustUpdate('trusted')).toEqual({ trustMode: 'trusted', trustReason: 'manual_override' });
    expect(trustUpdate('untrusted')).toEqual({ trustMode: 'untrusted', trustReason: 'user_added' });
  });
});

describe('oauthPanelKind', () => {
  it('is never offered for a client-side-only server, even a connected one', () => {
    expect(oauthPanelKind({ trustMode: 'untrusted', oauthConnected: true, oauthDiscoverable: true })).toBe('untrusted');
  });
  it('picks connected, then discoverable, then manual', () => {
    expect(oauthPanelKind({ oauthConnected: true, oauthDiscoverable: true })).toBe('connected');
    expect(oauthPanelKind({ oauthDiscoverable: true })).toBe('discoverable');
    expect(oauthPanelKind({})).toBe('manual');
  });
});

describe('manual OAuth', () => {
  it('needs client id, authorization URL and token URL', () => {
    expect(validateManualOAuth(EMPTY_OAUTH_FORM)).toMatch(/required/);
    expect(validateManualOAuth({ ...EMPTY_OAUTH_FORM, clientId: 'a', authorizationUrl: 'https://a' })).toMatch(/required/);
    expect(
      validateManualOAuth({ ...EMPTY_OAUTH_FORM, clientId: 'a', authorizationUrl: 'https://a', tokenUrl: 'https://t' }),
    ).toBeNull();
  });
  it('uses the callback route the backend expects', () => {
    expect(oauthRedirectUri('https://app.example.com')).toBe('https://app.example.com/mcp-oauth-callback');
  });
});

describe('confirmations', () => {
  it('names the server and marks only the irreversible ones as danger', () => {
    expect(confirmCopy('delete', 'Docs')).toMatchObject({ variant: 'danger', confirmLabel: 'Remove' });
    expect(confirmCopy('delete', 'Docs').title).toContain('Docs');
    expect(confirmCopy('disconnect', 'Docs').variant).toBe('danger');
    expect(confirmCopy('trust', 'Docs').variant).toBe('neutral');
    expect(confirmCopy('untrust', 'Docs').variant).toBe('neutral');
    expect(confirmCopy('trust', 'Docs').message).toMatch(/server-side tool execution/);
  });
});

describe('serverConnection', () => {
  it('maps status to a label bucket', () => {
    expect(serverConnection({ status: 'connected' })).toBe('connected');
    expect(serverConnection({ status: 'error' })).toBe('error');
    expect(serverConnection({ status: 'disconnected' })).toBe('idle');
    expect(serverConnection({ status: 'connecting' })).toBe('idle');
  });
});
