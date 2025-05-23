import React, { FC, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'next-i18next';
import HomeContext from '@/pages/api/home/home.context';
import { Account, noCoaAccount } from "@/types/accounts";
import { Accounts } from '../../AccountComponents/Account';
import { ApiKeys } from '../../AccountComponents/ApiKeys';
import { getAccounts} from "@/services/accountService";
import { fetchAllApiKeys } from '@/services/apiKeysService';
import { ApiKey } from '@/types/apikeys';
import { noRateLimit } from '@/types/rateLimit';

interface Props {
    onSave?: () => void;
    onCancel?: () => void;
    isDirty?: (dirty: boolean) => void;
}

export const AccountPanel: FC<Props> = ({ onSave, onCancel, isDirty }) => {
    const { state: {featureFlags}, setLoadingMessage } = useContext(HomeContext);

    const { t } = useTranslation('settings');

    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<string>('Accounts');

    const [accounts, setAccounts] = useState<Account[]>([]);
    const [defaultAccount, setDefaultAccount] = useState<Account>(noCoaAccount);
    const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);

    const [accountsUnsavedChanges, setAccountsUnsavedChanges] = useState(false);
    const [apiUnsavedChanges, setApiUnsavedChanges] = useState(false);

    // Notify parent about dirty state
    useEffect(() => {
        if (isDirty) {
            isDirty(accountsUnsavedChanges || apiUnsavedChanges);
        }
    }, [accountsUnsavedChanges, apiUnsavedChanges, isDirty]);

    // Listen for parent save trigger
    useEffect(() => {
        const handleParentSave = () => {
            handleSave();
        };

        // We'll use a custom prop instead of event for save
        if (onSave) {
            // Override the onSave to use our handleSave
            (onSave as any).accountPanelSave = handleParentSave;
        }

        return () => {
            if (onSave && (onSave as any).accountPanelSave) {
                delete (onSave as any).accountPanelSave;
            }
        };
    }, [onSave]);

    // fetch data
    useEffect(() => {
        const fetchAccounts = async () => {
            const result = await getAccounts();
            if (!result.success) {
                alert("Unable to fetch accounts. Please try again.");
                setIsLoading(false);
                setLoadingMessage("");
            } else {
                // Add "No COA" account to the list if not present
                if (!result.data.some((account: any) => account.id === noCoaAccount.id)) {
                    result.data.unshift(noCoaAccount);
                }

                result.data.forEach((account: any) => {
                    if (!account.rateLimit) account.rateLimit =  noRateLimit;
                })

                setAccounts(result.data);

                const updatedDefaultAccount = result.data.find((account: Account) => account.isDefault) || result.data[0];

                if (updatedDefaultAccount) {
                    setDefaultAccount(updatedDefaultAccount);
                }
            }
        }
        
        setLoadingMessage('Loading Accounts...');
        fetchAccounts();
    }, []);

    const fetchApiKeys = async () => {
        const result = await fetchAllApiKeys();

        if (!result.success) {
            alert("Unable to fetch your API keys. Please try again.");
            setIsLoading(false);
            setLoadingMessage("");
        } else {
            setApiKeys(result.data); 
        }
    }
    
    useEffect(() => {
        fetchApiKeys();
    }, []);

    useEffect(() => {
        if (accounts && apiKeys) {
            setLoadingMessage("");
            setIsLoading(false);
        }
    }, [accounts, apiKeys])

    useEffect(() => {
        const handleEvent = (event:any) => {
            console.log("Create ApiKey was triggered", event.detail);
            fetchApiKeys();
        };
    
        window.addEventListener('createApiKeys', handleEvent);
    
        return () => {
            window.removeEventListener('createApiKeys', handleEvent);
        };
    }, []);

    const handleSave = () => {
        // Trigger save for both accounts and API keys
        window.dispatchEvent(new Event('saveAccountChanges'));
        window.dispatchEvent(new Event('saveApiKeyChanges'));
        
        setAccountsUnsavedChanges(false);
        setApiUnsavedChanges(false);
        
        if (onSave) {
            onSave();
        }
    };

    const handleCancel = () => {
        if (onCancel) {
            onCancel();
        }
        
        setApiKeys([]);
        window.dispatchEvent(new Event('cleanupApiKeys'));
        setAccountsUnsavedChanges(false);
        setApiUnsavedChanges(false);
    };

    const switchTab = (tabName : string) => {
        console.log('Switching to tab:', tabName);
        setActiveTab(tabName);
        if (tabName === 'API') {
            console.log('Switching to API tab, dispatching cleanup event');
        }
        window.dispatchEvent(new Event('cleanupApiKeys'));
    }

    // Render loading state
    if (isLoading) {
        return <div className="flex justify-center items-center h-full">Loading...</div>;
    }

    return (
        <div className="w-full h-full">
            <div className="accounts-content">
                <div className="accounts-header-section">
                    <p className="accounts-description">
                        Manage your accounts and API access settings
                        {(accountsUnsavedChanges || apiUnsavedChanges) && <span className="accounts-unsaved-indicator"> • Unsaved changes</span>}
                    </p>
                </div>
                
                {/* Tab Pills */}
                <div className="accounts-tab-bar">
                    <div className="accounts-tab-pills">
                        <button
                            onClick={() => switchTab("Accounts")}
                            className={`accounts-tab-pill ${activeTab === "Accounts" ? 'active' : ''}`}
                        >
                            <span className="accounts-tab-label">Accounts</span>
                            {accountsUnsavedChanges && <span className="accounts-tab-count">*</span>}
                        </button>

                        {featureFlags.apiKeys && (
                            <button
                                onClick={() => switchTab("API")}
                                className={`accounts-tab-pill ${activeTab === "API" ? 'active' : ''}`}
                            >
                                <span className="accounts-tab-label">API Access</span>
                                {apiUnsavedChanges && <span className="accounts-tab-count">*</span>}
                            </button>
                        )}
                    </div>
                </div>

                <div className="accounts-scrollable-content">
                    <div className="accounts-content-area">
                        {activeTab === "Accounts" && (
                            <div className="accounts-card">
                                <div className="accounts-card-content">
                                    <Accounts
                                        accounts={accounts}
                                        setAccounts={setAccounts}
                                        defaultAccount={defaultAccount}
                                        setDefaultAccount={setDefaultAccount}
                                        setUnsavedChanged={setAccountsUnsavedChanges}
                                        onClose={handleCancel}
                                    />
                                </div>
                            </div>
                        )}
                        
                        {activeTab === "API" && (
                            <div className="accounts-card">
                                <div className="accounts-card-content">
                                    <ApiKeys
                                        apiKeys={apiKeys}
                                        setApiKeys={setApiKeys}
                                        setUnsavedChanges={setApiUnsavedChanges}
                                        onClose={handleCancel}
                                        accounts={accounts}
                                        defaultAccount={defaultAccount}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};