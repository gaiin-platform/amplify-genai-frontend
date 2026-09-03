/**
 * NewConnectorsSection — new-UI styled Connectors settings section.
 * PORT: Logic ported from components/Integrations/IntegrationsTab.tsx
 *       DO NOT MODIFY the original component.
 *
 * What this section does (all from original):
 *  - Loads available integrations via getAvailableIntegrations()
 *  - Loads connected integrations via getConnectedIntegrations()
 *  - Connect via getOauthRedirect() → opens OAuth window, polls until closed
 *  - Disconnect via deleteUserIntegration() (with browser confirm)
 *  - Per-integration loading spinners
 *  - Token-sharing shortcut (when backend shares existing OAuth token)
 *  - Tool API Keys tab (ToolApiKeysTab) gated by featureFlags.webSearch + canAddWebSearchApiKey
 *
 * Two-part layout (within the section content area):
 *  - SegmentedControl at top: "Integrations" | "Tool API Keys"
 *  - Integrations pane: flat list of integration cards across all providers
 *  - Tool API Keys pane: wraps <ToolApiKeysTab> in [data-new-ui="true"]
 *    with scoped CSS overrides in conversation-view.css to bring styling in line
 */

import React, { FC, useContext, useEffect, useRef, useState } from 'react';
import { IconLoader2, IconCheck, IconX } from '@tabler/icons-react';
import toast from 'react-hot-toast';
import HomeContext from '@/pages/api/home/home.context';
import {
  deleteUserIntegration,
  getAvailableIntegrations,
  getConnectedIntegrations,
  getOauthRedirect,
} from '@/services/oauthIntegrationsService';
import {
  Integration,
  IntegrationProviders,
  IntegrationsMap,
} from '@/types/integrations';
import { capitalize } from '@/utils/app/data';
import { SegmentedControl } from '@/components/NewUI/shared/SegmentedControl';
import { integrationIcon } from '@/components/NewUI/shared/integrationIcon';
import { ToolApiKeysTab } from '@/components/Settings/ToolApiKeysTab';

// ─────────────────────────────────────────────────────────────────────────────
// Flat integration item (provider + integration)
// ─────────────────────────────────────────────────────────────────────────────

interface FlatIntegration extends Integration {
  providerKey: string; // e.g. 'google' | 'microsoft'
  displayName: string; // e.g. 'Google Drive'
  providerSettings: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export const NewConnectorsSection: FC = () => {
  const {
    state: { featureFlags, canAddWebSearchApiKey },
  } = useContext(HomeContext);

  // ── Tab state
  const showToolApiKeys = (featureFlags.webSearch as boolean) && canAddWebSearchApiKey;
  const tabItems = [
    { id: 'integrations', label: 'Integrations' },
    ...(showToolApiKeys ? [{ id: 'toolkeys', label: 'Tool API Keys' }] : []),
  ];
  const [activeTab, setActiveTab] = useState<string>('integrations');

  // ── Integration data state
  const [integrations, setIntegrations] = useState<IntegrationsMap>({});
  const [providerSettings, setProviderSettings] = useState<Record<string, Record<string, unknown>>>({});
  const [connectedIntegrations, setConnectedIntegrations] = useState<string[]>([]);
  const [loadingIntegrations, setLoadingIntegrations] = useState(true);

  // ── Per-integration loading
  const [connectingStates, setConnectingStates] = useState<{ [key: string]: boolean }>({});
  const [loadingStates, setLoadingStates] = useState<{ [key: string]: boolean }>({});

  // ── Load integrations
  const getIntegrationData = async () => {
    const integrationSupport = await getAvailableIntegrations();
    if (integrationSupport?.success) {
      const responseData = integrationSupport.data;
      let supportedIntegrations: IntegrationsMap;
      let providerSettingsData: Record<string, Record<string, unknown>> = {};

      if (responseData && typeof responseData === 'object') {
        if ('integrations' in responseData && 'provider_settings' in responseData) {
          supportedIntegrations = responseData.integrations;
          providerSettingsData = responseData.provider_settings || {};
        } else {
          supportedIntegrations = responseData;
        }
      } else {
        supportedIntegrations = {};
      }
      setIntegrations(supportedIntegrations);
      setProviderSettings(providerSettingsData);
    } else {
      setIntegrations({});
      setProviderSettings({});
      const errorMessage = integrationSupport?.message || '';
      const isConfigError =
        errorMessage.includes('Admin Table') || errorMessage.includes('not configured');
      if (!isConfigError && integrationSupport) {
        alert('Unable to retrieve available integrations at this time. Please try again later.');
      }
    }
  };

  const getUserIntegrationData = async () => {
    const userIntegrations = await getConnectedIntegrations();
    if (userIntegrations?.success) {
      setConnectedIntegrations(userIntegrations.data || []);
    } else {
      const errorMessage = userIntegrations?.message || '';
      const isConfigError =
        errorMessage.includes('Admin Table') ||
        errorMessage.includes('not configured') ||
        errorMessage.includes('No integrations');
      if (!isConfigError && userIntegrations) {
        alert('Unable to verify connected integrations at this time. Please try again later.');
      }
      setConnectedIntegrations([]);
    }
  };

  const refreshIntegrations = async () => {
    try {
      setLoadingIntegrations(true);
      await getIntegrationData();
      await getUserIntegrationData();
    } catch (e) {
      console.error('Error refreshing integrations:', e);
    }
    setLoadingIntegrations(false);
  };

  useEffect(() => {
    refreshIntegrations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Disconnect
  const handleDisconnect = async (id: string) => {
    if (!confirm(`Disconnect this integration?`)) return;
    try {
      setLoadingStates((prev) => ({ ...prev, [id]: true }));
      const result = await deleteUserIntegration(id);
      if (result) {
        setConnectedIntegrations((prev) => prev.filter((i) => i !== id));
      }
    } catch {
      alert('An error occurred. Please try again.');
    } finally {
      setLoadingStates((prev) => ({ ...prev, [id]: false }));
    }
  };

  // ── Connect (ported verbatim from IntegrationsTab.tsx handleConnect)
  const handleConnect = async (id: string) => {
    setConnectingStates((prev) => ({ ...prev, [id]: true }));

    const provider = id.split('_')[0];
    const capitalizedProvider = provider.charAt(0).toUpperCase() + provider.slice(1);
    const settings = providerSettings[capitalizedProvider] || {};

    let location: string | null = null;
    try {
      const res = await getOauthRedirect(id, settings);

      // Token-sharing shortcut
      if (res?.body?.token_shared) {
        refreshIntegrations();
        setConnectingStates((prev) => ({ ...prev, [id]: false }));
        toast.success('Authentication Successful', { duration: 4000, position: 'top-center' });
        return;
      }

      if (res?.body?.error) {
        alert(res.body.message || 'An error occurred connecting this integration.');
        setConnectingStates((prev) => ({ ...prev, [id]: false }));
        return;
      }

      location = res.body.Location;
    } catch {
      alert('An error occurred. Please try again.');
      setConnectingStates((prev) => ({ ...prev, [id]: false }));
      return;
    }

    try {
      const isHttpsUrl = (url: string) => /^https:\/\//.test(url);
      if (location && isHttpsUrl(location)) {
        const width = 600;
        const height = 600;
        const left = (window.screen.width - width) / 2;
        const top = (window.screen.height - height) / 2;

        const authWindow = window.open(
          location,
          'Auth Window',
          `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`,
        );

        if (authWindow) {
          const checkWindow = setInterval(() => {
            if (authWindow.closed) {
              clearInterval(checkWindow);
              refreshIntegrations();
              setConnectingStates((prev) => ({ ...prev, [id]: false }));
            }
          }, 500);
          authWindow.focus();
        } else {
          setConnectingStates((prev) => ({ ...prev, [id]: false }));
        }
      } else {
        alert('An error occurred. Please try again.');
        setConnectingStates((prev) => ({ ...prev, [id]: false }));
      }
    } catch {
      alert('An error occurred. Please try again.');
      setConnectingStates((prev) => ({ ...prev, [id]: false }));
    }
  };

  // ── Flatten integrations map to a list
  const flatIntegrations: FlatIntegration[] = Object.entries(integrations)
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([providerKey, list]) =>
      (list ?? []).map((intg) => ({
        ...intg,
        providerKey,
        displayName: `${capitalize(providerKey)} ${intg.name}`,
        providerSettings: providerSettings[capitalize(providerKey)] || {},
      })),
    );

  const hasIntegrations = flatIntegrations.length > 0;

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* ─── Section tab bar ─── */}
      {tabItems.length > 1 && (
        <SegmentedControl
          items={tabItems}
          value={activeTab}
          onChange={setActiveTab}
          size="sm"
          aria-label="Connectors tabs"
        />
      )}

      {/* ════════════════════════════════════════════
          INTEGRATIONS TAB
          ════════════════════════════════════════════ */}
      {activeTab === 'integrations' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {loadingIntegrations ? (
            /* Skeleton cards while loading */
            <>
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  style={{
                    background: 'var(--bg-raised)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '10px',
                    padding: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    opacity: 0.6,
                  }}
                >
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: '8px',
                    background: 'var(--bg-active)',
                    flexShrink: 0,
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{
                      height: '14px',
                      width: '40%',
                      borderRadius: '4px',
                      background: 'var(--bg-active)',
                      marginBottom: '6px',
                    }} />
                    <div style={{
                      height: '12px',
                      width: '70%',
                      borderRadius: '4px',
                      background: 'var(--bg-active)',
                    }} />
                  </div>
                  <div style={{
                    width: 80,
                    height: 30,
                    borderRadius: '6px',
                    background: 'var(--bg-active)',
                    flexShrink: 0,
                  }} />
                </div>
              ))}
            </>
          ) : !hasIntegrations ? (
            /* Empty state */
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '48px 16px',
              color: 'var(--text-muted)',
              fontSize: '14px',
              textAlign: 'center',
              gap: '8px',
            }}>
              <span style={{ fontSize: '28px' }}>🔌</span>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                No integrations available
              </span>
              <span>
                There are currently no third-party integrations configured for this application.
                Please contact your administrator if you need access.
              </span>
            </div>
          ) : (
            /* Integration cards */
            flatIntegrations.map((intg) => {
              const isConnected = connectedIntegrations.includes(intg.id);
              const isLoading = loadingStates[intg.id] || connectingStates[intg.id];

              return (
                <div
                  key={intg.id}
                  style={{
                    background: 'var(--bg-raised)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '10px',
                    padding: '14px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                  }}
                >
                  {/* Icon */}
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: '8px',
                    background: 'var(--bg-app)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    overflow: 'hidden',
                  }}>
                    {integrationIcon(intg.id)}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: '14px',
                        fontWeight: 500,
                        color: 'var(--text-primary)',
                      }}>
                        {intg.displayName}
                      </span>
                      {isConnected && (
                        <span style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          color: '#16a34a',
                          background: 'rgba(34,197,94,0.12)',
                          borderRadius: '4px',
                          padding: '1px 7px',
                        }}>
                          <IconCheck size={11} />
                          Connected
                        </span>
                      )}
                    </div>
                    {intg.description && (
                      <p style={{
                        fontSize: '13px',
                        color: 'var(--text-secondary)',
                        marginTop: '2px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {intg.description}
                      </p>
                    )}
                  </div>

                  {/* Action button */}
                  <button
                    onClick={() => {
                      if (isConnected) {
                        handleDisconnect(intg.id);
                      } else {
                        handleConnect(intg.id);
                      }
                    }}
                    disabled={isLoading}
                    style={{
                      height: '32px',
                      padding: '0 14px',
                      borderRadius: '6px',
                      border: isConnected ? '1px solid rgba(239,68,68,0.4)' : 'none',
                      background: isConnected ? 'transparent' : 'var(--accent)',
                      color: isConnected ? '#ef4444' : '#ffffff',
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: isLoading ? 'not-allowed' : 'pointer',
                      opacity: isLoading ? 0.6 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                      transition: 'background 0.1s, color 0.1s, opacity 0.1s',
                    }}
                    onMouseEnter={(e) => {
                      if (!isLoading) {
                        if (isConnected) {
                          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.08)';
                        } else {
                          (e.currentTarget as HTMLButtonElement).style.opacity = '0.85';
                        }
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (isConnected) {
                        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                      } else {
                        (e.currentTarget as HTMLButtonElement).style.opacity = isLoading ? '0.6' : '1';
                      }
                    }}
                  >
                    {isLoading ? (
                      <IconLoader2 size={14} className="animate-spin" />
                    ) : isConnected ? (
                      <>
                        <IconX size={13} />
                        Disconnect
                      </>
                    ) : (
                      'Connect'
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════
          TOOL API KEYS TAB
          Wrapped in [data-new-ui="true"] for CSS overrides.
          DO NOT MODIFY ToolApiKeysTab.tsx.
          ════════════════════════════════════════════ */}
      {activeTab === 'toolkeys' && showToolApiKeys && (
        <div
          data-new-ui="true"
          className="new-ui-tool-api-keys"
        >
          <ToolApiKeysTab open={true} />
        </div>
      )}
    </div>
  );
};

export default NewConnectorsSection;
