import React, { FC, useContext, useState, useEffect } from 'react';
import { IconMail, IconAlertTriangle, IconCheck } from '@tabler/icons-react';
import HomeContext from '@/pages/api/home/home.context';
import ExpansionComponent from '@/components/Chat/ExpansionComponent';
import { IntegrationTabs } from '@/components/Integrations/IntegrationsTab';
import { IntegrationsMap } from '@/types/integrations';
import toast from 'react-hot-toast';
import { AssistantDefinition } from '@/types/assistant';
import Checkbox from '@/components/ReusableComponents/CheckBox';
import { InfoBox } from '@/components/ReusableComponents/InfoBox';

export interface SharedExchangeMailbox {
  email: string;
  id: string;
  name: string;
}

interface Props {
  groupId: string;
  assistantDefinition: AssistantDefinition;
  selectedSharedMailboxes: SharedExchangeMailbox[];
  onSelectedMailboxesChange: (selected: SharedExchangeMailbox[]) => void;
  enableSharedExchange: boolean;
  setEnableSharedExchange: (enabled: boolean) => void;
  disabled: boolean;
  aiEmailDomain: string;
}

export const AssistantSharedExchangeInbox: FC<Props> = ({
  groupId,
  assistantDefinition,
  selectedSharedMailboxes,
  onSelectedMailboxesChange,
  enableSharedExchange,
  setEnableSharedExchange,
  disabled,
  aiEmailDomain
}) => {
  const { state: {  } } = useContext(HomeContext);
  const [connectedExchangeIntegrations, setConnectedExchangeIntegrations] = useState<string[] | null>(null);
  const [supportedExchangeIntegrations, setSupportedExchangeIntegrations] = useState<string[] | null>(null);
  const [availableMailboxes, setAvailableMailboxes] = useState<SharedExchangeMailbox[]>([]);
  const [isLoadingMailboxes, setIsLoadingMailboxes] = useState(false);

  // ### TODO IMPLEMENTATION: Need API endpoint to list user's shared mailboxes
  // Should call: GET /microsoft/integrations/list_shared_mailboxes
  // This endpoint needs to be created in amplify-lambda-assistants-api-office365
  const fetchSharedMailboxes = async () => {
    if (!connectedExchangeIntegrations?.includes('microsoft_exchange')) {
      return;
    }

    setIsLoadingMailboxes(true);
    try {
      // ### TODO IMPLEMENTATION: Replace with actual API call
      // const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/microsoft/integrations/list_user_shared_mailboxes`, {
      //   method: 'GET',
      //   headers: {
      //     'Authorization': `Bearer ${apiKey}`,
      //     'Content-Type': 'application/json'
      //   }
      // });
      // const data = await response.json();
      
      // Mock data for now
      const mockMailboxes: SharedExchangeMailbox[] = [
        { email: 'student.accounts@vanderbilt.edu', id: 'shared-1', name: 'Student Accounts' },
        { email: 'support@vanderbilt.edu', id: 'shared-2', name: 'Support' }
      ];
      
      // Filter out already selected mailboxes
      const filtered = mockMailboxes.filter(
        mb => !selectedSharedMailboxes.some(selected => selected.id === mb.id)
      );
      
      setAvailableMailboxes(filtered);
    } catch (error) {
      console.error('Error fetching shared mailboxes:', error);
      toast.error('Failed to fetch shared mailboxes');
    } finally {
      setIsLoadingMailboxes(false);
    }
  };

  useEffect(() => {
    if (connectedExchangeIntegrations?.includes('microsoft_exchange')) {
      fetchSharedMailboxes();
    }
  }, [connectedExchangeIntegrations]);

  const handleOnConnectedIntegrations = (integrations: string[]) => {
    const exchangeConnected = integrations.filter(i => i === 'microsoft_exchange');
    setConnectedExchangeIntegrations(exchangeConnected);
  };

  const handleOnSupportedIntegrations = (integrations: IntegrationsMap) => {
    const exchangeSupported = Object.values(integrations)
      .flatMap(providerArray => providerArray.map(integration => integration.id))
      .filter(id => id === 'microsoft_exchange');
    setSupportedExchangeIntegrations(exchangeSupported);
  };

  const handleOnTabChange = (integrationProvider: string) => {
    // Exchange tab selected
  };

  const handleSelectMailbox = (mailbox: SharedExchangeMailbox) => {
    if (disabled) return;
    
    const newSelected = [...selectedSharedMailboxes, mailbox];
    onSelectedMailboxesChange(newSelected);
    
    // Remove from available list
    setAvailableMailboxes(prev => prev.filter(mb => mb.id !== mailbox.id));
    
    toast.success(`Added ${mailbox.name} (${mailbox.email})`);
  };

  const handleRemoveMailbox = (mailbox: SharedExchangeMailbox) => {
    if (disabled) return;
    
    const newSelected = selectedSharedMailboxes.filter(mb => mb.id !== mailbox.id);
    onSelectedMailboxesChange(newSelected);
    
    // Add back to available list
    setAvailableMailboxes(prev => [...prev, mailbox]);
    
    toast.success(`Removed ${mailbox.name}`);
  };

  const renderSelectedMailboxes = () => {
    if (selectedSharedMailboxes.length === 0) {
      return (
        <p className="text-sm text-gray-500 dark:text-gray-400 italic">
          No shared mailboxes configured
        </p>
      );
    }

    return (
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Configured Shared Mailboxes:
        </p>
        {selectedSharedMailboxes.map((mailbox) => {
          const aiEmail = mailbox.email.replace(/@[^@]+$/, `@${aiEmailDomain}`);
          return (
            <div 
              key={mailbox.id}
              className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <IconCheck className="w-5 h-5 text-green-500" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {mailbox.name}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {mailbox.email} → {aiEmail}
                  </p>
                </div>
              </div>
              {!disabled && (
                <button
                  onClick={() => handleRemoveMailbox(mailbox)}
                  className="px-3 py-1 text-sm text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                >
                  Remove
                </button>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderAvailableMailboxes = () => {
    if (!connectedExchangeIntegrations?.includes('microsoft_exchange')) {
      return null;
    }

    if (isLoadingMailboxes) {
      return (
        <div className="text-center py-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading mailboxes...</p>
        </div>
      );
    }

    if (availableMailboxes.length === 0) {
      return (
        <div className="text-center py-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No additional shared mailboxes available
          </p>
        </div>
      );
    }

    return (
      <div className="mt-4 space-y-2">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Available Shared Mailboxes:
        </p>
        {availableMailboxes.map((mailbox) => {
          const aiEmail = mailbox.email.replace(/@[^@]+$/, `@${aiEmailDomain}`);
          return (
            <div 
              key={mailbox.id}
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <IconMail className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {mailbox.name}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {mailbox.email} → {aiEmail}
                  </p>
                </div>
              </div>
              {!disabled && (
                <button
                  onClick={() => handleSelectMailbox(mailbox)}
                  className="px-3 py-1 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
                >
                  Add
                </button>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  if (supportedExchangeIntegrations?.length === 0) {
    return null;
  }

  return (
    <>
      <div className="mt-4 mb-2 ml-1 flex flex-row gap-3">
        <Checkbox
          id="enableSharedExchange"
          bold={true}
          label="Enable Shared Exchange Inbox"
          checked={enableSharedExchange}
          onChange={(checked) => setEnableSharedExchange(checked)}
          disabled={disabled}
        />
        <IconMail className="mt-1" size={18} />
      </div>
      <div className="mx-6 mt-[-4px] flex flex-col gap-4">
        <InfoBox
          content={
            <span className="px-4">
              This feature allows the group assistant to monitor and respond to emails from shared Exchange mailboxes.
              When enabled, configure which shared mailboxes this assistant should handle.
              <div className="text-center mt-1 font-bold">
                Emails to configured mailboxes will automatically trigger this assistant.
              </div>
            </span>
          }
        />
        <div className={`relative w-full ${enableSharedExchange ? "" : "opacity-40"}`}>
          <ExpansionComponent 
            title="Configure Shared Mailboxes" 
            closedWidget={<IconMail size={18} />} 
            content={
              <div className="space-y-4">
            {/* Selected Mailboxes Section */}
            {renderSelectedMailboxes()}

            {/* Integration Connection Section */}
            {connectedExchangeIntegrations?.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Connect Microsoft Exchange to configure shared mailboxes for this group assistant.
                </p>
                <IntegrationTabs 
                  open={true} 
                  onConnectedIntegrations={handleOnConnectedIntegrations}
                  onSupportedIntegrations={handleOnSupportedIntegrations}
                  onTabChange={handleOnTabChange}
                  allowedIntegrations={['microsoft_exchange']}
                />
              </div>
            ) : connectedExchangeIntegrations && !connectedExchangeIntegrations.includes('microsoft_exchange') ? (
              <div className="flex items-center gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <IconAlertTriangle className="w-5 h-5 text-red-500" />
                <span className="text-sm text-red-700 dark:text-red-300">
                  Microsoft Exchange integration has been disconnected. Please reconnect to manage shared mailboxes.
                </span>
              </div>
            ) : (
              <>
                {renderAvailableMailboxes()}
                
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    <strong>How it works:</strong> Emails sent to the AI domain address (e.g., student.accounts@{aiEmailDomain}) 
                    will automatically trigger this group assistant to process and respond.
                  </p>
                </div>
              </>
            )}
              </div>
            }
          />
        </div>
      </div>
    </>
  );
};

export default AssistantSharedExchangeInbox;
