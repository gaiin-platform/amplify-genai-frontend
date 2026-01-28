import { FC, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'next-i18next';
import HomeContext from '@/pages/api/home/home.context';
import { IconCheck, IconLoader2 } from '@tabler/icons-react';

import { deleteUserIntegration, getAvailableIntegrations, getOauthRedirect, getConnectedIntegrations } from '@/services/oauthIntegrationsService';
import { ActiveTabs } from '../ReusableComponents/ActiveTabs';
import { Integration, IntegrationProviders, IntegrationsMap } from '@/types/integrations';
import { capitalize } from '@/utils/app/data';
import { Loader } from '@mantine/core';
import { translateIntegrationIcon } from './IntegrationsDialog';
import { ToolApiKeysTab } from '../Settings/ToolApiKeysTab';

interface Props {
  open: boolean;
  depth?: number;
  allowedIntegrations?: string[]; // ex. google_drive, microsoft_drive etc.
  onSupportedIntegrations?: (integrations: IntegrationsMap) => void;
  onConnectedIntegrations?: (integrations: string[]) => void;
  onTabChange?: (tab: string) => void;
}

export const IntegrationTabs: FC<Props> = ({ open, depth=0, allowedIntegrations=[], onTabChange: integrationTabChange = () => {},
                                             onSupportedIntegrations = () => {}, onConnectedIntegrations = () => {}}) => {
  const { t } = useTranslation('settings');
  const { state: { featureFlags } } = useContext(HomeContext);
  const lastActiveTab = useRef<number | undefined>(undefined);

  const [connectingStates, setConnectingStates] = useState<{[key: string]: boolean}>({});

  const [connectedIntegrations, setConnectedIntegrations] = useState<string[]>([]);
  const [loadingStates, setLoadingStates] = useState<{[key: string]: boolean}>({});
  const [loadingIntegrations, setLoadingIntegrations] = useState(true);

  const [integrations, setIntegrations] = useState<IntegrationsMap>({});
  const [providerSettings, setProviderSettings] = useState<any>({});
  
  const getIntegrations = async () => {
    const integrationSupport = await getAvailableIntegrations();
    if (integrationSupport && integrationSupport.success) {
      const responseData = integrationSupport.data;

      // Handle both old format (just integrations) and new format (with provider_settings)
      let supportedIntegrations: IntegrationsMap;
      let providerSettingsData: any = {};

      if (responseData && typeof responseData === 'object') {
        // Check if this is the new nested format
        if ('integrations' in responseData && 'provider_settings' in responseData) {
          supportedIntegrations = responseData.integrations;
          providerSettingsData = responseData.provider_settings || {};
        } else {
          // Old format - just the integrations map
          supportedIntegrations = responseData;
        }
      } else {
        supportedIntegrations = {};
      }

      setIntegrations(supportedIntegrations);
      setProviderSettings(providerSettingsData);
      onSupportedIntegrations(supportedIntegrations);
    }  else {
      // Set to empty object - the UI will handle showing "No integrations" message
      setIntegrations({});
      setProviderSettings({});
      onSupportedIntegrations({});

      // Only show alert for actual errors, not when integrations just aren't configured
      const errorMessage = integrationSupport?.message || '';
      const isConfigError = errorMessage.includes('Admin Table') || errorMessage.includes('not configured');

      if (!isConfigError && integrationSupport) {
        // This is a real error (network, server, etc), not just missing config
        alert("Unable to retrieve available integrations at this time. Please try again later.");
      }
    }
  }

  const getUserIntegrations = async () => {
    const userIntegrations = await getConnectedIntegrations();
    if (userIntegrations && userIntegrations.success) {
      // Success can have either data or an empty array
      const connections = userIntegrations.data || [];
      setConnectedIntegrations(connections);
      onConnectedIntegrations(connections);
    } else {
      // Only show alert for actual errors, not when integrations just aren't configured
      const errorMessage = userIntegrations?.message || '';
      const isConfigError = errorMessage.includes('Admin Table') ||
                           errorMessage.includes('not configured') ||
                           errorMessage.includes('No integrations');

      if (!isConfigError && userIntegrations) {
        // This is a real error (network, server, etc), not just missing config
        alert("Unable to verify connected integrations at this time. Please try again later.");
      }

      // Set to empty array even on error - UI will handle showing appropriate message
      setConnectedIntegrations([]);
      onConnectedIntegrations([]);
    }
  }

  const refreshUserIntegrations = async () => {
    try {
      setLoadingIntegrations(true);
      await getIntegrations();
      await getUserIntegrations();
    } catch (e) {
      console.error("Error refreshing user integrations: ", e);
    }
    setLoadingIntegrations(false);
  }

  useEffect(() => {
    if (open) {
      refreshUserIntegrations();
    }
  }, [open]);
  

  const handleDisconnect = async (id: string) => {
    try {
      setLoadingStates(prev => ({ ...prev, [id]: true }));
      const result = await deleteUserIntegration(id);
      if (result) {
        const connected = connectedIntegrations.filter((i: string) => i !== id);
        setConnectedIntegrations(connected);
        onConnectedIntegrations(connected);
      } 
    } catch (e) {
      alert("An error occurred. Please try again.");
    } finally {
      setLoadingStates(prev => ({ ...prev, [id]: false }));
    }
  }

  const handleConnect = async (id: string) => {
    setConnectingStates(prev => ({ ...prev, [id]: true }));

    // Extract provider from integration id (e.g., "microsoft_calendar" -> "Microsoft")
    const provider = id.split('_')[0];
    const capitalizedProvider = provider.charAt(0).toUpperCase() + provider.slice(1);
    const settings = providerSettings[capitalizedProvider] || {};

    let location = null;
    try {
      const res = await getOauthRedirect(id, settings);
      location = res.body.Location;
    } catch (e) {
      alert("An error occurred. Please try again.");
      setConnectingStates(prev => ({ ...prev, [id]: false }));
      return;
    }

    try {
      const isHttpsUrl = (url: string): boolean => /^https:\/\//.test(url);
      if (isHttpsUrl(location)) {
        const width = 600;
        const height = 600;
        const left = (window.screen.width - width) / 2;
        const top = (window.screen.height - height) / 2;

        const authWindow = window.open(
          location,
          'Auth Window',
          `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`
        );

        if (authWindow) {
          const checkWindow = setInterval(() => {
            if (authWindow.closed) {
              clearInterval(checkWindow);
              refreshUserIntegrations();
              setConnectingStates(prev => ({ ...prev, [id]: false }));
            }
          }, 500);

          authWindow.focus();
        } else {
          setConnectingStates(prev => ({ ...prev, [id]: false }));
        }
      } else {
        alert("An error occurred. Please try again.");
        setConnectingStates(prev => ({ ...prev, [id]: false }));
      }
    } catch (e) {
      alert("An error occurred. Please try again.");
      setConnectingStates(prev => ({ ...prev, [id]: false }));
    }
  };

  if (!open) {
    return null;
  }


  const renderContent = (integrationIdPrefix:string, tabIndex: number) => {
    
    const  integrationsList: Integration[] | undefined= integrations[integrationIdPrefix as IntegrationProviders];

    return ( !integrationsList ? null : 
            <>
             {integrationsList.map((integration) => (
              allowedIntegrations?.length > 0 && !allowedIntegrations.includes(integration.id) ? null :
            <div key={integration.id} className="integration-card" >
               <div className="integration-card-content">
                 <div className="integration-info">
                   <div className="integration-header">
                     <div className="integration-icon-wrapper">
                       {translateIntegrationIcon(integration.id)}
                     </div>
                     <div className="integration-details">
                       <div className="integration-name-row">
                         <span className="integration-name">{`${capitalize(integrationIdPrefix)} ${integration.name}`}</span>
                         {connectedIntegrations.includes(integration.id) && (
                           <div className="integration-status-badge">
                             <IconCheck className="w-4 h-4" />
                             <span>Connected</span>
                           </div>
                         )}
                       </div>
                       <p className="integration-description">{integration.description}</p>
                     </div>
                   </div>
                 </div>
                </div>
                <div className="integration-actions ml-auto mr-4">
                <button
                  onClick={() => {
                    lastActiveTab.current = tabIndex;
                    if (connectedIntegrations.includes(integration.id)) {
                      handleDisconnect(integration.id);
                    } else {
                      handleConnect(integration.id);
                    }
                  }}
                  disabled={loadingStates[integration.id] || connectingStates[integration.id]}
                  className={`integration-action-button hover:shadow-lg py-2 rounded-md whitespace-nowrap ${
                    connectedIntegrations.includes(integration.id)
                      ? `bg-red-500 text-white ${loadingStates[integration.id] ? "px-7" :"px-4"}`
                      : 'bg-blue-500 text-white px-7'
                  } ${(loadingStates[integration.id] || connectingStates[integration.id]) ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {loadingStates[integration.id] || connectingStates[integration.id] ? (
                    <IconLoader2 className="animate-spin w-5 h-5 inline-block w-[56px]" />
                  ) : (connectedIntegrations.includes(integration.id) ? 'Disconnect' : 'Connect'
                  )}
                </button>
                </div>
            </div>
            ))}
            </>
      )
  }

  // Check if there are any integrations available
  const hasIntegrations = Object.keys(integrations).length > 0;

  if (loadingIntegrations) {
    return (
      <div className="flex flex-col items-center justify-center" style={{height: window.innerHeight * 0.4}}>
          <Loader />
          <div className="text-lg font-bold mb-2 text-black dark:text-neutral-200">Loading integrations...</div>
      </div>
    );
  }

  if (!hasIntegrations) {
    return (
      <div className="flex flex-col items-center justify-center p-8" style={{height: window.innerHeight * 0.4}}>
          <div className="text-center">
            <div className="text-xl font-bold mb-4 text-black dark:text-neutral-200">
              No Integrations Available
            </div>
            <p className="text-gray-600 dark:text-gray-400 max-w-md">
              There are currently no third-party integrations configured for this application.
              Please contact your administrator if you need access to integrations.
            </p>
          </div>
      </div>
    );
  }

  return (
    <ActiveTabs
        id="SettingsIntegrationsTab"
        depth={depth}
        initialActiveTab={lastActiveTab.current}
        onTabChange={(i: number, label: string) => integrationTabChange(label)}
        tabs={[
            ...(Object.keys(integrations).sort().map((name: string, i: number) =>
                        ({label: capitalize(name),
                        content: <>{renderContent(name, i)}</>
                        })
            )),
            ...(featureFlags.webSearch ? [{
              label: 'Web Search',
              content: <ToolApiKeysTab open={open} />
            }] : [])
          ]
        }
    />
  );
};