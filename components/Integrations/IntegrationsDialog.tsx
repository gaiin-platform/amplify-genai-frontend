import { FC, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'next-i18next';
import HomeContext from '@/components/Home/Home.context';
import { Modal } from '../ReusableComponents/Modal';
import { IconCheck, IconLoader2} from '@tabler/icons-react';

import { deleteUserIntegration, getAvailableIntegrations, getOauthRedirect, getConnectedIntegrations } from '@/services/oauthIntegrationsService';
import Loader from '@/components/Loader/Loader';
import { ActiveTabs } from '../ReusableComponents/ActiveTabs';
import { Integration, integrationIconComponents, IntegrationProviders, IntegrationsMap } from '@/types/integrations';
import { capitalize } from '@/utils/app/data';

export const translateIntegrationIcon = (icon: string) => {
  if (icon in integrationIconComponents) {
      const IconComponent = integrationIconComponents[icon as keyof typeof integrationIconComponents];
      return <IconComponent className="w-6 h-6 mr-2" />;
    }
  return null;
}
interface Props {
  open: boolean;
  onClose: () => void;
}

export const IntegrationsDialog: FC<Props> = ({ open, onClose }) => {
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
    }  else {
      alert("Unable to retrieve available integrations at this time. Please try again later.");
    }
  }

  const getUserIntegrations = async () => {
    const userIntegrations = await getConnectedIntegrations();
    if (userIntegrations && userIntegrations.success && userIntegrations.data) {
      setConnectedIntegrations(userIntegrations.data);
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
        setConnectedIntegrations(connectedIntegrations.filter((i: string) => i !== id));
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
              <div key={integration.id} className="mr-8 flex items-start p-4 bg-gray-100 dark:bg-gray-800 rounded-lg mb-4 overflow-x-hidden">
                <div className="flex-grow mr-4">
                  <div className="flex items-center mb-2">
                    {connectedIntegrations.includes(integration.id) && (
                      <IconCheck className="w-5 h-5 mr-2 text-green-500" />
                    )}
                    {integration.icon && translateIntegrationIcon(integration.icon)}
                    <span className="text-black dark:text-white font-semibold">{`${capitalize(integrationIdPrefix)} ${integration.name}`}</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{integration.description}</p>
                </div>
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
                  className={`py-2 rounded-md whitespace-nowrap ${
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
            ))}
            </>
      )
  }

  return (
    <Modal
      width={() => window.innerWidth * 0.64}
      height={() => window.innerHeight * 0.88}
      title={'Integrations'}
      showCancel={false}
      onCancel={onClose}
      onSubmit={onClose}
      submitLabel={"OK"}
      content={
        loadingIntegrations ?
          <div className="flex flex-col items-center justify-center" style={{height: window.innerHeight * 0.4}}>
            <Loader />
            <div className="text-lg font-bold mb-2 text-black dark:text-neutral-200">Loading integrations...</div>
          </div> :
           <ActiveTabs
            initialActiveTab={lastActiveTab.current}
            width={() => window.innerWidth * 0.6}
            tabs={[
              ...(Object.keys(integrations).sort().map((name: string, i: number) =>
                          ({label: capitalize(name), 
                           content: <>{renderContent(name, i)}</>
                          })
              ))]
          }
        />
      }
    />
  );
};