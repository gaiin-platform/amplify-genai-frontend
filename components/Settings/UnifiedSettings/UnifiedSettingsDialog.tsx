import React, { FC, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'next-i18next';
import { IconX } from '@tabler/icons-react';
import { Modal } from '@/components/ReusableComponents/Modal';
import { AccountPanel } from './Panels/AccountPanel';
import { IntegrationsPanel } from './Panels/IntegrationsPanel';
import { SettingsPanel } from './Panels/SettingsPanel';
import ActionButton from '@/components/ReusableComponents/ActionButton';

interface Props {
  open: boolean;
  onClose: () => void;
}

export const UnifiedSettingsDialog: FC<Props> = ({ open, onClose }) => {
  const { t } = useTranslation('settings');
  const modalRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<string>('Account');
  const [accountDirty, setAccountDirty] = useState(false);
  const [integrationsDirty, setIntegrationsDirty] = useState(false);
  const [settingsDirty, setSettingsDirty] = useState(false);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        window.addEventListener('mouseup', handleMouseUp);
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      window.removeEventListener('mouseup', handleMouseUp);
      handleClose();
    };

    window.addEventListener('mousedown', handleMouseDown);

    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  const handleClose = () => {
    if (((accountDirty || integrationsDirty || settingsDirty) && 
         confirm("You have unsaved changes!\n\nYou will lose any unsaved data, would you still like to close?")) ||
         (!accountDirty && !integrationsDirty && !settingsDirty)) {
      onClose();
      setAccountDirty(false);
      setIntegrationsDirty(false);
      setSettingsDirty(false);
    }
  };

  const handleTabChange = (tabName: string) => {
    setActiveTab(tabName);
  };

  const handleSave = () => {
    // Call the individual panel save functions based on active tab
    if (activeTab === "Account" && accountDirty) {
      // Trigger account panel save
      window.dispatchEvent(new Event('saveAccountChanges'));
      window.dispatchEvent(new Event('saveApiKeyChanges'));
      setAccountDirty(false);
    }
    if (activeTab === "Integrations" && integrationsDirty) {
      // Trigger integrations panel save by dispatching event
      window.dispatchEvent(new Event('saveIntegrationsChanges'));
      setIntegrationsDirty(false);
    }
    if (activeTab === "Settings" && settingsDirty) {
      // Trigger settings panel save by dispatching event
      window.dispatchEvent(new Event('saveSettingsChanges'));
      setSettingsDirty(false);
    }
    
    onClose();
  };

  const handleCancel = () => {
    handleClose();
  };

  // Render nothing if the dialog is not open
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="fixed inset-0 z-10 overflow-hidden">
        <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
          <div 
            className="hidden sm:inline-block sm:h-screen sm:align-middle"
            aria-hidden="true"
          />
          <div
            ref={modalRef}
            id="unifiedSettingsModal"
            className="dark:border-neutral-600 inline-block transform rounded-lg border border-gray-300 bg-neutral-100 px-4 pb-4 text-left align-bottom shadow-xl transition-all dark:bg-[#22232b] sm:my-8 sm:min-h-[636px] sm:w-full sm:p-4 sm:align-middle"
            style={{ width: `${window.innerWidth - 560}px`, height: `${window.innerHeight * 0.9}px` }}
            role="dialog"
          >
            {/* Header with Close Button */}
            <div className="text-black dark:text-white mb-4 flex flex-row justify-between items-center bg-transparent border-b dark:border-white/20 pb-4">
              <h2 className="text-2xl font-bold">Configuration</h2>
              <ActionButton
                handleClick={handleClose}
                title="Close"
              >
                <IconX size={20} />
              </ActionButton>
            </div>

            {/* Tab Pills */}
            <div className="mb-6">
              <div className="flex gap-2">
                <button
                  onClick={() => handleTabChange("Account")}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                    activeTab === "Account" 
                      ? 'bg-blue-500 text-white shadow-md' 
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  Account{accountDirty ? " *" : ""}
                </button>
                <button
                  onClick={() => handleTabChange("Integrations")}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                    activeTab === "Integrations" 
                      ? 'bg-blue-500 text-white shadow-md' 
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  Integrations{integrationsDirty ? " *" : ""}
                </button>
                <button
                  onClick={() => handleTabChange("Settings")}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                    activeTab === "Settings" 
                      ? 'bg-blue-500 text-white shadow-md' 
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  Settings{settingsDirty ? " *" : ""}
                </button>
              </div>
            </div>

            <div id="unifiedSettingsModalScroll" className="overflow-y-auto" style={{ maxHeight: 'calc(100% - 220px)' }}>
              {activeTab === "Account" && (
                <AccountPanel 
                  onSave={handleSave}
                  onCancel={handleCancel}
                  isDirty={setAccountDirty}
                />
              )}
              
              {activeTab === "Integrations" && (
                <IntegrationsPanel 
                  onSave={() => {
                    // This gets called after IntegrationsPanel saves its data
                    setIntegrationsDirty(false);
                  }}
                  onCancel={handleCancel}
                  isDirty={setIntegrationsDirty}
                />
              )}
              
              {activeTab === "Settings" && (
                <SettingsPanel 
                  onSave={() => {
                    // This gets called after SettingsPanel saves its data
                    setSettingsDirty(false);
                  }}
                  onCancel={handleCancel}
                  isDirty={setSettingsDirty}
                />
              )}
              
            </div>

            <div className="flex justify-end space-x-2 mt-4 mb-2 border-t pt-4 dark:border-white/20">
              <button
                onClick={handleCancel}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!accountDirty && !integrationsDirty && !settingsDirty}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};