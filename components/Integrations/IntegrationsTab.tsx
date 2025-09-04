import { FC, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'next-i18next';
import HomeContext from '@/pages/api/home/home.context';
import { IconCheck, IconLoader2} from '@tabler/icons-react';

import { deleteUserIntegration, getAvailableIntegrations, getOauthRedirect, getConnectedIntegrations } from '@/services/oauthIntegrationsService';
import { ActiveTabs } from '../ReusableComponents/ActiveTabs';
import { Integration, IntegrationProviders, IntegrationsMap } from '@/types/integrations';
import { capitalize } from '@/utils/app/data';
import { Loader } from '@mantine/core';
import { translateIntegrationIcon } from './IntegrationsDialog';

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
  const { dispatch: homeDispatch, state: { statsService} } = useContext(HomeContext);
  const lastActiveTab = useRef<number | undefined>(undefined);

  const [connectingStates, setConnectingStates] = useState<{[key: string]: boolean}>({});

  const [connectedIntegrations, setConnectedIntegrations] = useState<string[]>([]);
  const [loadingStates, setLoadingStates] = useState<{[key: string]: boolean}>({});
  const [loadingIntegrations, setLoadingIntegrations] = useState(true);

  const [integrations, setIntegrations] = useState<IntegrationsMap>({});
  
  const getIntegrations = async () => {
    const integrationSupport = await getAvailableIntegrations();
    if (integrationSupport && integrationSupport.success) {
      const supportedIntegrations = integrationSupport.data;
      setIntegrations(supportedIntegrations);
      onSupportedIntegrations(supportedIntegrations);
    }  else {
      onSupportedIntegrations({});
      alert("Unable to retrieve available integrations at this time. Please try again later.");
    }
  }

  const getUserIntegrations = async () => {
    const userIntegrations = await getConnectedIntegrations();
    if (userIntegrations && userIntegrations.success && userIntegrations.data) {
      setConnectedIntegrations(userIntegrations.data);
      onConnectedIntegrations(userIntegrations.data);
    } else {
      alert("Unable to verify connected integrations at this time. Please try again later.");
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

    let location = null;
    try {
      const res = await getOauthRedirect(id);
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

  return (
    loadingIntegrations ?
    <div className="flex flex-col items-center justify-center" style={{height: window.innerHeight * 0.4}}>
        <Loader />
        <div className="text-lg font-bold mb-2 text-black dark:text-neutral-200">Loading integrations...</div>
    </div> :
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
            ))]
        }
    />
  );
};