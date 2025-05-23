import React, { FC, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'next-i18next';
import { IconPlus, IconEye, IconCopy, IconCheck, IconX, IconUser, IconEdit, IconArticle, IconRobot } from "@tabler/icons-react";
import HomeContext from '@/pages/api/home/home.context';
import ExpansionComponent from '../../Chat/ExpansionComponent';
import { EmailsAutoComplete } from '@/components/Emails/EmailsAutoComplete';
import { Account, noCoaAccount } from '@/types/accounts';
import { createApiKey, deactivateApiKey, fetchApiDoc, fetchApiKey, updateApiKeys } from '@/services/apiKeysService';
import { ApiKey } from '@/types/apikeys';
import { PeriodType, formatRateLimit, UNLIMITED, rateLimitObj} from '@/types/rateLimit'
import { useSession } from 'next-auth/react';
import { LoadingIcon } from "@/components/Loader/LoadingIcon";
import { formatDateYMDToMDY, userFriendlyDate } from '@/utils/app/date';
import { AccountSelect, isValidCOA } from './Account';
import { RateLimiter} from './RateLimit';
import cloneDeep from 'lodash/cloneDeep';
import { Prompt } from '@/types/prompt';
import { isAssistant } from '@/utils/app/assistants';
import { handleStartConversationWithPrompt } from '@/utils/app/prompts';
import { APIDownloadFile } from '@/components/Chat/ChatContentBlocks/APIDocBlock';
import { ReservedTags } from '@/types/tags';
import toast from 'react-hot-toast';
import ActionButton from '@/components/ReusableComponents/ActionButton';
import { InfoBox } from '@/components/ReusableComponents/InfoBox';
import Checkbox from '@/components/ReusableComponents/CheckBox';
import { fetchFile } from '@/utils/app/files';

interface Props {
    apiKeys: ApiKey[];
    setApiKeys: (k:ApiKey[]) => void;
    setUnsavedChanges: (b: boolean) => void;
    onClose: () => void;
    accounts: Account[];
    defaultAccount: Account;
}


const today = new Date().toISOString().split('T')[0];

// current api access choices
const optionChoices = {
    assistants: true,
    chat: true,
    file_upload: true, // _ will be turned into a ' ' for displaying purposes
    share: true,
    dual_embedding: true
}



export const formatAccessTypes = (accessTypes: string[]) => {
    return accessTypes.map((a: string) => formatAccessType(a)).join(', ')
                                                              
}

const formatAccessType = (accessType: string) => {
    return String(accessType).replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())                                                          
}

export const ApiKeys: FC<Props> = ({ apiKeys, setApiKeys, setUnsavedChanges, onClose, accounts, defaultAccount}) => {
    const { state: {featureFlags, statsService, amplifyUsers}, dispatch: homeDispatch } = useContext(HomeContext);

    const { data: session } = useSession();
    const user = session?.user?.email;


    const { t } = useTranslation('settings');
    const [validAccounts, setValidAccounts] = useState<any>(accounts.filter((a: Account) => a.id !== noCoaAccount.id));

    const [ownerApiKeys, setOwnerApiKeys] = useState<ApiKey[]>([]);
    const [delegateApiKeys, setDelegateApiKeys] = useState<ApiKey[]>([]);
    const [isCreating, setIsCreating] = useState<boolean>(false);
    const [isSaving, setIsSaving ] = useState(false);

    const [appName, setAppName] = useState<string>("");
    const [appDescription, setAppDescriptione] = useState<string>("");
    const [delegateInput, setDelegateInput] = useState<string>('');
    const [allEmails, setAllEmails] = useState<Array<string> | null>(null);
    const [rateLimitPeriod, setRateLimitPeriod] = useState<PeriodType>(UNLIMITED);
    const [rateLimitRate, setRateLimitRate] = useState<string>('');
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [includeExpiration, setIncludeExpiration] = useState<boolean>(false);
    const [systemUse, setSystemUse] = useState<boolean>(false);
    
    const [selectedAccount, setSelectedAccount] = useState<Account | null>(() => {
        try {
            return defaultAccount.name === noCoaAccount.name ? validAccounts[0] || null : defaultAccount;
        } catch (error) {
            console.error('Error initializing selectedAccount:', error);
            return null;
        }
    });

    const [editedKeys, setEditedKeys] = useState<any>({});


    const [fullAccess, setFullAccess] = useState<boolean>(true);
    const [options, setOptions] = useState<Record<string, boolean>>(cloneDeep(optionChoices));

    const [docsIsOpen, setDocsIsOpen] = useState<boolean>(false);

    
    useEffect(() => {
        const handleEvent = (event: any) => {
            setUnsavedChanges(true);
            console.log("editedApiKey was triggered", event.detail);
            const apiKeyId = event.detail.id;
            const updates = event.detail.edits; 

            if (updates.accessTypes && Array.isArray(updates.accessTypes)) {
                updates.accessTypes = updates.accessTypes.flat();
            }
    
            setEditedKeys((prevKeys: any) => {
                // Ensuring that updates for each key are structured correctly
                const currentUpdates = prevKeys[apiKeyId] ? prevKeys[apiKeyId].updates : {};
                // Merge new updates with existing updates, if any
                const mergedUpdates = { ...currentUpdates, ...updates };
    
                return {
                    ...prevKeys,
                    [apiKeyId]: {
                        ...prevKeys[apiKeyId],
                        apiKeyId: apiKeyId, // Ensure the apiKeyId is set for each key
                        updates: mergedUpdates // The updates are structured as per the schema
                    }
                };
            });

        };
    
        window.addEventListener('editedApiKey', handleEvent);
        
        return () => {
            window.removeEventListener('editedApiKey', handleEvent);
        };
        
    }, []);


    useEffect(() => {
        const fetchEmails = async () => {
            const emailSuggestions =  amplifyUsers;
            setAllEmails(emailSuggestions ? emailSuggestions.filter((e: string) => e !== user) : []);
        };
        if (!allEmails) fetchEmails();
    }, []);

    useEffect(() => {
        if (systemUse) setSystemUse(false);

    }, [delegateInput]);

    useEffect(() => {
        setDelegateApiKeys(apiKeys.filter((k: ApiKey) => k.delegate === user));
        setOwnerApiKeys(apiKeys.filter((k: ApiKey) => k.owner === user));
    }, [apiKeys]);


    const handleCreateApiKey = async () => {
        setIsCreating(true);
        
        const data = {
            'owner' : user,
            'account' : selectedAccount,
            'delegate': delegateInput.length > 0 ? delegateInput : null,
            'appName' : appName,
            'appDescription' : appDescription,
            'rateLimit' : rateLimitObj(rateLimitPeriod, rateLimitRate),
            'expirationDate' : includeExpiration ? selectedDate : null,
            'accessTypes': fullAccess ? ["full_access"] :  Object.keys(options).filter((key) => options[key]),
            'systemUse' : systemUse && delegateInput.length === 0
        }
        const result = await createApiKey(data)
        const sucess = result.success;
        setIsCreating(false);

        //done first for preloadeding keys while user handles alert 
        if (sucess) {
            setApiKeys([]);
            statsService.createApiKeyEvent(data);
            setDelegateApiKeys([]);
            setOwnerApiKeys([]);
            // to pull in the updated changes to the ui     
            window.dispatchEvent(new Event('createApiKeys'));
        }
      
        // empty out all the create key fields
        if (sucess) {
            toast("Successfuly created the API key");
            setAppName('');
            setAppDescriptione('');
            setDelegateInput('');
            setRateLimitPeriod(UNLIMITED);
            setIncludeExpiration(false);
            setSystemUse(false);
            setOptions(optionChoices);
            setFullAccess(true);
        }  else {
              alert(`Unable to create the API key at this time. \n\n Error message: ${result.message}`);
        }
    };

    const handleDeactivateApikey = async (apiKeyId: string, name: string) => {
        if (confirm(`Are you sure you want to deactivate API key: ${name}?\nOnce deactivate, it cannot be undone.`)) {
            const result = await deactivateApiKey(apiKeyId);
            if (result) {
                setApiKeys(apiKeys.map((k: ApiKey) => {
                    if (k.api_owner_id === apiKeyId) return {...k, active: false}
                    return k;
                }))
                statsService.deactivateApiKeyEvent(apiKeyId);
            } else {
                alert('Failed to deactivate key at this time. Please try again later...');
            }
        }
    };

    // Handle apply edits
    const handleApplyEdits = useCallback(async () => {
        try {
            console.log('Applying edits with keys:', Object.values(editedKeys));
            const result = await updateApiKeys(Object.values(editedKeys));
            setEditedKeys({});
            if (!result.success) {
                alert('failedKeys' in result ? `API keys: ${result.failedKeys.join(", ")} failed to update. Please try again.` : "We are unable to update your key(s) at this time...")
            } else {
                statsService.updateApiKeyEvent(Object.values(editedKeys));
                setUnsavedChanges(false);
                toast("API changes saved.");
            }
        } catch (error) {
            console.error('Error in handleApplyEdits:', error);
        }
    }, [editedKeys, statsService, setUnsavedChanges]);

    // Handle save function
    const handleSave = useCallback(async () => {
        try {
            console.log('ApiKeys handleSave called with editedKeys:', Object.keys(editedKeys));
            setIsSaving(true);
            if (Object.keys(editedKeys).length !== 0) {
                console.log('Calling handleApplyEdits...');
                await handleApplyEdits();
            } else {
                console.log('No edited keys to save');
            }
            setIsSaving(false);
        } catch (error) {
            console.error('Error in ApiKeys handleSave:', error);
            setIsSaving(false);
        }
    }, [editedKeys, handleApplyEdits]);

    // Listen for save events from parent
    useEffect(() => {
        const handleSaveEvent = () => {
            handleSave();
        };

        window.addEventListener('saveApiKeyChanges', handleSaveEvent);

        return () => {
            window.removeEventListener('saveApiKeyChanges', handleSaveEvent);
        };
    }, [handleSave]);

    const isExpired = (date: string) => {
        return new Date(date) <= new Date()
    }


    return (
        <div className="apikeys-content">
            {/* Header Section */}
            <div className="apikeys-header-section">
                <div className="apikeys-info-banner">
                    <div className="apikeys-info-icon">🔑</div>
                    <div className="apikeys-info-content">
                        <h3 className="apikeys-info-title">API Access Management</h3>
                        <p className="apikeys-info-description">
                            Create and manage API keys for secure access to Amplify services. You can create keys for yourself and delegate access to others.
                            {(Object.keys(editedKeys).length > 0) && <span className="apikeys-unsaved-indicator"> • Unsaved changes</span>}
                        </p>
                    </div>
                </div>
            </div>

            {/* API Tools Section */}
            <div className="apikeys-types-section">
                <div className='z-60'> 
                   <APITools setDocsIsOpen={setDocsIsOpen} onClose={onClose}/> 
                </div>
            </div>

            {/* Create API Key Section */}
            <div className="apikeys-card">
                <div className="apikeys-card-content">
                    <div className="apikeys-section-header">
                        <h4 className="apikeys-section-title">Create New API Key</h4>
                        <p className="apikeys-section-subtitle">Generate a new API key for yourself or delegate access to others</p>
                    </div>

                    {isCreating && (
                        <div className="apikeys-loading-overlay">
                            <div className="apikeys-loading-content">
                                <LoadingIcon style={{ width: "24px", height: "24px" }}/>
                                <span className="apikeys-loading-text">Creating API Key...</span>
                            </div>
                        </div>
                    )}

                    <div className="apikeys-form-container" style={{ opacity: isCreating ? 0.5 : 1 }}>
                        
                        <div className="apikeys-form-grid">
                            {/* Application Name */}
                            <div className="apikeys-form-group">
                                <label className="apikeys-form-label">
                                    {t('Application Name')}
                                </label>
                                <textarea
                                    className="apikeys-form-input"
                                    style={{resize: 'none'}}
                                    id="applicationName"
                                    placeholder="Enter application name"
                                    value={appName}
                                    onChange={(e) => setAppName(e.target.value)}
                                    rows={1}
                                />
                            </div>

                            {/* Delegate User */}
                            {!docsIsOpen && (
                                <div className="apikeys-form-group">
                                    <label className="apikeys-form-label">
                                        Delegate Access
                                    </label>
                                    <div className="apikeys-delegate-container">
                                        <EmailsAutoComplete
                                            input={delegateInput}
                                            setInput={setDelegateInput}
                                            allEmails={allEmails}
                                            addMultipleUsers={false}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Application Description */}
                        <div className="apikeys-form-group">
                            <label className="apikeys-form-label">
                                {t('Application Description')}
                            </label>
                            <textarea
                                className="apikeys-form-input apikeys-form-textarea"
                                style={{resize: 'none'}}
                                id="applicationDescription"
                                placeholder="Provide a short description of how this API key will be used"
                                value={appDescription}
                                onChange={(e) => setAppDescriptione(e.target.value)}
                                rows={2}
                            />

                        </div>

                        {/* Account Selection */}
                        <div className="apikeys-form-group">
                            <label className="apikeys-form-label">Bill To Account</label>
                            <div className="apikeys-account-select">
                                <AccountSelect
                                    accounts={validAccounts}
                                    defaultAccount={selectedAccount || defaultAccount}
                                    setDefaultAccount={setSelectedAccount}
                                />
                            </div>
                        </div>

                        {/* Advanced Settings */}
                        {!docsIsOpen && (
                            <div className="apikeys-advanced-settings">
                                <h5 className="apikeys-subsection-title">Advanced Settings</h5>
                                
                                <div className="apikeys-settings-grid">
                                    {/* Rate Limit */}
                                    <div className="apikeys-setting-group">
                                        <label className="apikeys-form-label">Rate Limit</label>
                                        <div className="apikeys-rate-limiter">
                                            <RateLimiter
                                                period={rateLimitPeriod}
                                                setPeriod={setRateLimitPeriod}
                                                rate={rateLimitRate}
                                                setRate={setRateLimitRate}
                                            />
                                        </div>
                                    </div>

                                    {/* Expiration */}
                                    <div className="apikeys-setting-group">
                                        <div className="apikeys-checkbox-group">
                                            <Checkbox
                                                id="expirationDate"
                                                label="Set Expiration Date"
                                                checked={includeExpiration}
                                                onChange={(checked:boolean) => setIncludeExpiration(checked)}
                                            />
                                        </div>
                                        {includeExpiration && (
                                            <input
                                                className="apikeys-date-input"
                                                type="date"
                                                id="expiration"
                                                value={selectedDate}
                                                min={today}
                                                onChange={(e) => setSelectedDate(e.target.value)}
                                            />
                                        )}
                                    </div>

                                    {/* System Use */}
                                    <div className="apikeys-setting-group">
                                        {delegateInput.length === 0 && (
                                            <div className="apikeys-checkbox-group" title="If the API key is not for personal use">
                                                <Checkbox
                                                    id="SystemUse"
                                                    label="For System Use"
                                                    checked={systemUse}
                                                    onChange={(checked:boolean) => setSystemUse(checked)}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Access Controls */}
                        <div className="apikeys-access-controls">
                            <h5 className="apikeys-subsection-title">Access Permissions</h5>
                            <div className="apikeys-access-content" title="Full Access is the default configuration">
                                <AccessTypesCheck
                                    fullAccess={fullAccess}
                                    setFullAccess={setFullAccess}
                                    options={options}
                                    setOptions={setOptions}
                                />
                            </div>
                        </div>

                        {/* Create Button */}
                        <div className="apikeys-create-button-container">
                            <button
                                type="button"
                                title="Create API Key"
                                id="createAPIKeyConfirm"
                                className={`apikeys-create-button ${!selectedAccount ? 'apikeys-create-button-disabled' : 'apikeys-create-button-enabled'}`}
                                disabled={!selectedAccount}
                                onClick={() => {
                                    if (!selectedAccount) {
                                        alert("Please add an account with a valid COA string to create an API key.")
                                    } else {
                                        handleCreateApiKey();
                                    }
                                }}
                            >
                                <IconPlus size={20} />
                                <span>Create Key</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Your API Keys Section */}
            <div className="apikeys-card">
                <div className="apikeys-card-content">
                    <div className="apikeys-section-header">
                        <h4 className="apikeys-section-title">Your API Keys</h4>
                        <p className="apikeys-section-subtitle">Manage and monitor your active API keys</p>
                    </div>

                    <div className="apikeys-list-container">
                        {ownerApiKeys.length === 0 ? (
                            <div className="apikeys-empty-state">
                                <div className="apikeys-empty-icon">🔑</div>
                                <h5 className="apikeys-empty-title">No API Keys Yet</h5>
                                <p className="apikeys-empty-description">
                                    You don&apos;t have any API keys set up. Create one above to get started.
                                </p>
                            </div>
                        ) : (
                            !docsIsOpen && (
                                <div className="apikeys-grid">{ownerApiKeys.map((apiKey, index) => (
                                    <div key={index} className="apikeys-item-card">
                                        <div className="apikeys-item-header">
                                            <div className="apikeys-item-type">
                                                <IconUser 
                                                    className={`${apiKey.systemId 
                                                        ? 'text-green-600' 
                                                        : apiKey.delegate 
                                                        ? 'text-yellow-500' 
                                                        : 'text-gray-600 dark:text-gray-400'}`} 
                                                    size={20}
                                                />
                                                <span className="apikeys-item-name">{apiKey.applicationName}</span>
                                            </div>
                                            <div className="apikeys-item-status">
                                                {apiKey.active ? (
                                                    <button 
                                                        title="Deactivate Key" 
                                                        className="apikeys-status-button apikeys-status-active"
                                                        onClick={() => handleDeactivateApikey(apiKey.api_owner_id, apiKey.applicationName)}
                                                    >
                                                        <IconCheck size={18} />
                                                        <span>Active</span>
                                                    </button>
                                                ) : (
                                                    <div className="apikeys-status-badge apikeys-status-inactive">
                                                        <IconX size={18} />
                                                        <span>Inactive</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="apikeys-item-details">
                                            <div className="apikeys-item-row">
                                                <span className="apikeys-item-label">Account:</span>
                                                <Label 
                                                    label={apiKey.account ? `${apiKey.account.name} - ${apiKey.account.id}` : ''} 
                                                    widthPx="200px" 
                                                    editableField={apiKey.active && (user !== apiKey.delegate) ? 'account' : undefined} 
                                                    apiKey={apiKey} 
                                                    accounts={validAccounts}
                                                />
                                            </div>
                                            
                                            <div className="apikeys-item-row">
                                                <span className="apikeys-item-label">Delegate:</span>
                                                {apiKey.delegate ? <Label label={apiKey.delegate} /> : <NALabel />}
                                            </div>
                                            
                                            <div className="apikeys-item-row">
                                                <span className="apikeys-item-label">Expiration:</span>
                                                {apiKey.expirationDate ? (
                                                    <Label 
                                                        label={formatDateYMDToMDY(apiKey.expirationDate)} 
                                                        textColor={isExpired(apiKey.expirationDate) ? "text-red-600" : undefined} 
                                                        editableField={apiKey.active ? 'expirationDate' : undefined} 
                                                        apiKey={apiKey}
                                                    />
                                                ) : (
                                                    <Label 
                                                        label={null} 
                                                        editableField={apiKey.active ? 'expirationDate' : undefined} 
                                                        apiKey={apiKey}
                                                    />
                                                )}
                                            </div>
                                            
                                            <div className="apikeys-item-row">
                                                <span className="apikeys-item-label">Last Accessed:</span>
                                                <Label label={userFriendlyDate(apiKey.lastAccessed)} widthPx="140px" isDate={true}/>
                                            </div>
                                            
                                            <div className="apikeys-item-row">
                                                <span className="apikeys-item-label">Rate Limit:</span>
                                                <Label 
                                                    label={formatRateLimit(apiKey.rateLimit)} 
                                                    editableField={apiKey.active ? 'rateLimit' : undefined} 
                                                    apiKey={apiKey}
                                                />
                                            </div>
                                            
                                            <div className="apikeys-item-row">
                                                <span className="apikeys-item-label">Access Types:</span>
                                                <Label 
                                                    label={formatAccessTypes(apiKey.accessTypes).replaceAll(',', ', ')} 
                                                    widthPx="220px" 
                                                    editableField={apiKey.active ? 'accessTypes' : undefined} 
                                                    apiKey={apiKey}
                                                />
                                            </div>
                                            
                                            <div className="apikeys-item-row">
                                                <span className="apikeys-item-label">System ID:</span>
                                                {apiKey.systemId ? <Label label={apiKey.systemId} /> : <NALabel />}
                                            </div>
                                            
                                            <div className="apikeys-item-row">
                                                <span className="apikeys-item-label">API Key:</span>
                                                {!apiKey.delegate ? (
                                                    <HiddenAPIKey id={apiKey.api_owner_id} width="200px"/>
                                                ) : (
                                                    <NALabel label="Not Viewable"/>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}</div>
                            )
                        )}
                    </div>
                </div>
            </div>

            {/* Delegated API Keys Section */}
            {delegateApiKeys.length > 0 && (
                <div className="apikeys-card">
                    <div className="apikeys-card-content">
                        <div className="apikeys-section-header">
                            <h4 className="apikeys-section-title">Delegated API Keys</h4>
                            <p className="apikeys-section-subtitle">API keys that have been delegated to you by others</p>
                        </div>

                        <div className="apikeys-list-container">{!docsIsOpen && (
                                <div className="apikeys-grid">{delegateApiKeys.map((apiKey: any, index: number) => (
                                    <div key={index} className="apikeys-item-card apikeys-delegated-card">
                                        <div className="apikeys-item-header">
                                            <div className="apikeys-item-type">
                                                <IconUser className="text-yellow-500" size={20} />
                                                <span className="apikeys-item-name">{apiKey.applicationName}</span>
                                                <span className="apikeys-delegated-badge">Delegated</span>
                                            </div>
                                            <div className="apikeys-item-status">
                                                {apiKey.active ? (
                                                    <button 
                                                        title="Deactivate Key" 
                                                        className="apikeys-status-button apikeys-status-active"
                                                        onClick={() => handleDeactivateApikey(apiKey.api_owner_id, apiKey.applicationName)}
                                                    >
                                                        <IconCheck size={18} />
                                                        <span>Active</span>
                                                    </button>
                                                ) : (
                                                    <div className="apikeys-status-badge apikeys-status-inactive">
                                                        <IconX size={18} />
                                                        <span>Inactive</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="apikeys-item-details">
                                            <div className="apikeys-item-row">
                                                <span className="apikeys-item-label">Owner:</span>
                                                <Label label={apiKey.owner} />
                                            </div>
                                            
                                            <div className="apikeys-item-row">
                                                <span className="apikeys-item-label">Expiration:</span>
                                                {apiKey.expirationDate ? (
                                                    <Label 
                                                        label={formatDateYMDToMDY(apiKey.expirationDate)} 
                                                        textColor={isExpired(apiKey.expirationDate) ? "text-red-600" : undefined} 
                                                    />
                                                ) : (
                                                    <NALabel />
                                                )}
                                            </div>
                                            
                                            <div className="apikeys-item-row">
                                                <span className="apikeys-item-label">Last Accessed:</span>
                                                <Label label={userFriendlyDate(apiKey.lastAccessed)} widthPx="140px" isDate={true}/>
                                            </div>
                                            
                                            <div className="apikeys-item-row">
                                                <span className="apikeys-item-label">Rate Limit:</span>
                                                <Label label={formatRateLimit(apiKey.rateLimit)} widthPx="140px"/>
                                            </div>
                                            
                                            <div className="apikeys-item-row">
                                                <span className="apikeys-item-label">Access Types:</span>
                                                <Label label={formatAccessTypes(apiKey.accessTypes).replaceAll(',', ', ')} widthPx="220px"/>
                                            </div>
                                            
                                            <div className="apikeys-item-row">
                                                <span className="apikeys-item-label">API Key:</span>
                                                <HiddenAPIKey id={apiKey.api_owner_id} width="200px"/>
                                            </div>
                                        </div>
                                    </div>
                                ))}</div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};


interface APIKeyProps {
    id: string;
    width?: string;
}

export const HiddenAPIKey: FC<APIKeyProps> = ({ id, width=''}) => {

    const { state: {statsService}} = useContext(HomeContext);

    const defaultStr = "****************************************";
    const [keyText, setKeyText] = useState<string>(defaultStr);
    const [messagedCopied, setMessageCopied] = useState(false);
    const [isLoading, setIsLoading ] = useState(false);



    useEffect(() => {
        const handleEvent = (event:any) => {
            console.log("onClose was triggered", event.detail);
            setKeyText(defaultStr);
        };
    
        window.addEventListener('cleanupApiKeys', handleEvent);
    
        return () => {
            window.removeEventListener('cleanupApiKeys', handleEvent);
        };
    }, []);

    const getApiKey = async (id:string) => {
        setIsLoading(true);
        alert("Remember, keep your API key secure and do not share it with anyone. It it has been compromised, promptly deactivate it.");
        const result = await fetchApiKey(id);
        if (!result.success)  {
            alert(result.error || "Unable to retrieve your API key at this time...");
            setIsLoading(false);
            return;
        }  else {
            statsService.getApiKeyEvent(id);
        }
        setIsLoading(false);
        setKeyText(result.data);
    }

    const copyOnClick = () => {
        if (!navigator.clipboard) return;

        navigator.clipboard.writeText(keyText).then(() => {
            setMessageCopied(true);
            setTimeout(() => {
                setMessageCopied(false);
            }, 2000);
        });
    };

    return <div 
    className="flex flex-shrink-0 items-center space-x-1 overflow-hidden rounded-md border border-neutral-500 p-1 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
    style={{ width: width, height: '34px' }}>

    <div className="flex-1 overflow-x-auto whitespace-nowrap">
        <span>{keyText}</span>
    </div>

    {keyText.includes('amp-') ?  
        (messagedCopied ? 
            <IconCheck
                size={18}
                className="min-w-[26px] text-green-500 dark:text-green-400"
            /> 
            :
            <ActionButton
                handleClick={() =>  copyOnClick()}
                title={"Copy Api key"}>
                <IconCopy size={18}/>
            </ActionButton> 
        )
        :
        (!isLoading &&
        <ActionButton
            handleClick={() => getApiKey(id)}
            title={"See API key secret"}>
            <IconEye size={18}/>
        </ActionButton>)
    }
    {isLoading && 
    <LoadingIcon className= 'min-w-[26px]' style={{ width: "18px", height: "18px" }}/>
    }
</div>
       
}


type EditableField = 'expirationDate' | 'accessTypes' | 'rateLimit' | 'account';

interface LabelProps {
    label:  string| null;
    widthPx?: string;
    textColor?: string;
    editableField?: EditableField;
    isDate?: boolean
    apiKey?: ApiKey;
    accounts?:  Account[];
}

//rateLimit, expiration, accessTypes, account
const Label: FC<LabelProps> = ({ label, widthPx='full', textColor, editableField, isDate=false, apiKey, accounts}) => {
    const [displayLabel, setDisplayLabel] = useState<string | null>(label);
    const [isOverflowing, setIsOverflowing] = useState(false);
    const [isEditing, setIsEditing] = useState<boolean>(false);
    const [isHovered, setIsHovered,] = useState(false);
    const labelRef = useRef<HTMLDivElement>(null);

    const [selectedAccount, setSelectedAccount] = useState<Account | null>(apiKey ? apiKey.account : null);
    const [rateLimitPeriod, setRateLimitPeriod] = useState<PeriodType>(apiKey ? apiKey.rateLimit.period : UNLIMITED);
    const [rateLimitRate, setRateLimitRate] = useState<string>(apiKey && apiKey.rateLimit.rate ? String(apiKey.rateLimit.rate) : '0');
    const [selectedDate, setSelectedDate] = useState<string>(apiKey?.expirationDate || '');
    const [fullAccess, setFullAccess] = useState<boolean>(true);
    const [options, setOptions] = useState<Record<string, boolean>>(cloneDeep(optionChoices));
    const [translateX, setTranslateX] = useState(0);
    const [isScrolling, setIsScrolling] = useState(false);

    useEffect(() => {
        const element = labelRef.current;
        let scrollTimeout: any;
        if (element) {
            setIsOverflowing(element.scrollWidth > element.clientWidth);

            const handleScroll = () => {
                setTranslateX(element.scrollLeft);
                setIsScrolling(true);
                clearTimeout(scrollTimeout);
                scrollTimeout = setTimeout(() => {
                    setIsScrolling(false);
                }, 150);
            };

            element.addEventListener('scroll', handleScroll);
            return () => {
                element.removeEventListener('scroll', handleScroll);
                clearTimeout(scrollTimeout);
            };
        }
    }, [displayLabel]);

    const handleEdit = () => {
        let editedData = null;
        switch (editableField) {
            case("expirationDate"):
                setDisplayLabel(selectedDate)
                editedData = selectedDate ? selectedDate : "None";
                break;
            case("account"):
                if (selectedAccount) {
                    setDisplayLabel(`${selectedAccount.name + " - "} ${selectedAccount.id}`);
                    editedData = selectedAccount;
                }
                break;
            case("rateLimit"): 
                editedData = rateLimitObj(rateLimitPeriod, rateLimitRate);
                setDisplayLabel(formatRateLimit(editedData));
                break;
            case("accessTypes"): 
                editedData = [fullAccess ? "full_access" :  Object.keys(options).filter((key) => options[key])];
                setDisplayLabel(formatAccessTypes((editedData as string[])).replaceAll(',', ', '));
                break;
        }

        if (editedData && editableField) {
            window.dispatchEvent(new CustomEvent('editedApiKey', {
                detail: {
                    id: apiKey?.api_owner_id,
                    edits: { [editableField] : editedData === "None" ? null : editedData}
                }
                }));
        }
    }

    const formattedLabel = displayLabel && isDate? displayLabel?.replace(' at ', ' \n at ') : displayLabel;

    return (
        <div
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            ref={labelRef}
            style={{
                whiteSpace: isDate ? 'pre-wrap' : 'nowrap', // 'pre-wrap' to allow line breaks
                overflowY: isDate ? 'auto' : 'hidden', // enable vertical scrolling for dates
                overflowWrap: 'break-word',
                width: widthPx,
                position: 'relative',
                height: '32px', 
                flex: 'shrink-0',
            }}
            className={`overflow-auto mb-2 p-2 flex-1 text-sm rounded flex flex-row ${textColor || 'text-black dark:text-neutral-200'} ${isOverflowing || isDate ? 'bg-neutral-200 dark:bg-[#40414F]' : 'transparent'}`}
        >
        {!isEditing && 
            <> {displayLabel ? formattedLabel :  <div className='ml-8'><NALabel/></div>}</>
        }

        {isEditing && editableField && (
            <>
            {editableField && editableField === 'expirationDate' && (<>
                <input
                    className="rounded border-gray-300 p-0.5 text-neutral-900 dark:text-neutral-100 shadow-sm bg-neutral-200 dark:bg-[#40414F] focus:border-neutral-700 focus:ring focus:ring-neutral-500 focus:ring-opacity-50"
                    type="date"
                    id="expiration"
                    value={selectedDate}
                    min={today}
                    onChange={(e) => setSelectedDate(e.target.value)}
                />
            </>)}
            {accounts && selectedAccount && editableField === 'account' && (
                <div className='w-full'>
                <AccountSelect
                    accounts={accounts}
                    defaultAccount={selectedAccount}
                    setDefaultAccount={setSelectedAccount}
                    showId={false}
                />
                </div>
            )}
            {editableField && editableField === 'rateLimit' && (<>
                <RateLimiter
                    period={rateLimitPeriod as PeriodType}
                    setPeriod={setRateLimitPeriod}
                    rate={rateLimitRate}
                    setRate={setRateLimitRate}
                />
            </>)}
            {editableField && editableField === 'accessTypes' && (<>
                <AccessTypesCheck
                    fullAccess={fullAccess}
                    setFullAccess={setFullAccess}
                    options={options}
                    setOptions={setOptions}
                />
            </>)}
            </>
        )}

        {isEditing && (
            (
                <div className="ml-2 relative z-5 flex bg-neutral-200 dark:bg-[#343541]/90 rounded"  
               >
                  <ActionButton
                  title='Confirm Change'
                    handleClick={(e) => {
                        e.stopPropagation();
                        handleEdit();
                        setIsEditing(false);
                    }}
                  >
                    <IconCheck size={18} />
                  </ActionButton>
                  <ActionButton
                    title='Discard Change'
                    handleClick={(e) => {
                      e.stopPropagation();
                      setIsEditing(false);
                    }}
                  >
                    <IconX size={18} />
                  </ActionButton>
                </div>
              )

        )}

        {editableField && isHovered  && !isEditing && !isScrolling && (
            <div
            className="absolute top-1 right-0 ml-auto z-5 flex-shrink-0 bg-neutral-200 dark:bg-[#343541]/90 rounded"
           style={{ transform: `translateX(${translateX}px)` }}> 
                <ActionButton
                    handleClick={() => {setIsEditing(true)}}
                    title="Edit">
                    <IconEdit size={18} />
                </ActionButton>
            </div>
        )}
        
        </div>
       
    );
}


interface NALabel {
    label?:  string| null;
}

const NALabel: FC<NALabel> = ({label="N/A"}) => {
    return (
         <div className='text-center text-gray-400 dark:text-gray-500'>{label}</div>
    );
}

interface AccessProps {
    fullAccess: boolean,
    setFullAccess: (e:boolean) => void;
    options: Record<string, boolean>;
    setOptions: (options: any) => void;
}

const AccessTypesCheck: FC<AccessProps> = ({fullAccess, setFullAccess, options, setOptions}) => {
    useEffect(() => {
        const allSelected = Object.keys(options).every(key => options[key]);
        if (allSelected) setFullAccess(allSelected);
    }, [options]);

    return (
         <div className='flex flex-row gap-2 text-xs' >
            <input type="checkbox" id="fullAccessCheckbox" checked={fullAccess} onChange={(e) => {
                    const checked = e.target.checked;
                    setFullAccess(checked);
                    setOptions((prevOptions: any)=> 
                        Object.keys(prevOptions).reduce((acc, key) => {
                            acc[key] = checked;
                            return acc;
                        }, {} as Record<string, boolean>)
                    );
                }} />
            <label className="mr-3 whitespace-nowrap" htmlFor="FullAccess">Full Access</label>
            {Object.keys(options).map((key: string) => (
                <div key={key} className='whitespace-nowrap'>
                <input type="checkbox" id="accessCheckboxes" checked={options[key]} onChange={() => {
                    setOptions((prevOptions:any) => {
                        const newOptions = { ...prevOptions, [key]: !prevOptions[key] };
                        if (!newOptions[key]) setFullAccess(false);
                        return newOptions;
                    })
                }}/>

                <label className="ml-2 mr-3 " htmlFor={key}>{formatAccessType(key)}</label>

                </div>
            ))}
        </div>
    );
}



interface ToolsProps {
    setDocsIsOpen: (e: boolean) => void;
    onClose: () => void;
}


const APITools: FC<ToolsProps> = ({setDocsIsOpen, onClose}) => {
    const { state: {prompts, statsService}, dispatch: homeDispatch, handleNewConversation} = useContext(HomeContext);

    const promptsRef = useRef(prompts);

    useEffect(() => {
        promptsRef.current = prompts;
      }, [prompts]);

    const [activeTab, setActiveTab] = useState<string | null>(null);
    const [showApiDoc, setShowApiDoc] = useState(false);
    const [docUrl, setDocUrl] = useState<string | undefined>(undefined);
    const [csvUrl, setCsvUrl] = useState<string | undefined>(undefined);
    const [postmanUrl, setPostmanUrl] = useState<string | undefined>(undefined);
    const [fileContents, setFileContents] = useState<any>(undefined);
    const [isLoading, setIsLoading] = useState(false);
    


    const [keyManager, setKeyManager] = useState<Prompt | undefined>(promptsRef.current.find((a: Prompt) => a.data?.tags && a.data.tags.includes(ReservedTags.ASSISTANT_API_KEY_MANAGER)));
    const [apiAst, setApiAst] = useState<Prompt | undefined>(promptsRef.current.find((a: Prompt) => a.data?.tags && a.data.tags.includes(ReservedTags.ASSISTANT_API_HELPER)));


    const isUrlExpired = (url: string): boolean => {
        const regex = /Expires=(\d+)/;
        const matches = regex.exec(url);
    
        if (matches && matches[1]) {
            const expiry = matches[1];
            const expiryDate = new Date(parseInt(expiry) * 1000);
            return expiryDate <= new Date();
        }
        return true;
      };

    const handleShowDocs = (val: boolean) => {
        setDocsIsOpen(val);
        setShowApiDoc(val);
    }

    const handleShowApiDoc = async () => {
            //check if expired 
        const isExpired = docUrl ? isUrlExpired(docUrl) : true;
        if (isExpired) {
            setIsLoading(true);
            const result = await fetchApiDoc();
            if (result.success) {
                handleShowDocs(true);
                setDocUrl(result.doc_url);
                setCsvUrl(result.csv_url);
                setPostmanUrl(result.postman_url);
            } else {
                docError();
            }
        } else {
            handleShowDocs(true);
        }
        
        
    }

    useEffect( () => {
        if (docUrl || csvUrl) {
            const tabToSwitch = docUrl ? 'Doc' : csvUrl ? "Downloads" : null;
            handleTabSwitch(tabToSwitch);
            setIsLoading(false);
        }
    }, [docUrl]);

    const docError = () => {
        handleShowDocs(false);
        alert("Unable to display API documentation at this time. Please try again later...");
        setIsLoading(false);
    }

    const handleStartConversation = (startPrompt: Prompt) => {
        if(isAssistant(startPrompt) && startPrompt.data){
            homeDispatch({field: 'selectedAssistant', value: startPrompt.data.assistant});
        }
        statsService.startConversationEvent(startPrompt);
        handleStartConversationWithPrompt(handleNewConversation, promptsRef.current, startPrompt);
        onClose();
    }

    const handleTabSwitch = async (tab: string | null) => {
        if (!tab) return;
        if (docUrl && tab === "Doc") {
                    const file = await fetchFile(docUrl);
                    setFileContents(file);
        }
        setActiveTab(tab);
        // console.log("Active tab: ", tab)
    }

    return (
        <>
            <div className="apitools-container">
                <div className="apitools-header">
                    <h5 className="apitools-title">API Tools & Resources</h5>
                    <p className="apitools-subtitle">Access documentation and chat with specialized assistants</p>
                </div>
                
                <div className="apitools-tabs">
                    <button
                        className="apitools-tab apitools-tab-docs"
                        onClick={() => handleShowApiDoc()}
                        id="amplifyDocumentationButton"
                        title="View Amplify API Documentation"
                    >
                        <IconArticle size={18}/>
                        <span>API Documentation</span>
                    </button>
                    
                    { keyManager && (
                        <button
                            className="apitools-tab apitools-tab-manager"
                            onClick={() => handleStartConversation(keyManager)}
                            title="Chat with Amplify API Key Manager"
                        >
                            <IconRobot size={18}/>
                            <span>API Key Manager</span>
                        </button>
                    )}

                    { apiAst && (
                        <button
                            className="apitools-tab apitools-tab-assistant"
                            onClick={() => handleStartConversation(apiAst)}
                            title="Chat with Amplify API Assistant"
                        >
                            <IconRobot size={18}/>
                            <span>API Assistant</span>
                        </button>
                    )}
                </div>
            </div>

            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center z-60"
                    style={{ transform: `translateY(-25%)`}}>
                    <div className="p-3 flex flex-row items-center  border border-gray-500 bg-[#202123]">
                        <LoadingIcon style={{ width: "24px", height: "24px" }}/>
                        <span className="text-lg font-bold ml-2 text-white">Loading API Documentation...</span>
                    </div>
                </div>
            )
            }


            {showApiDoc && !isLoading &&  (
                <div className="absolute inset-0 flex items-center justify-star"
                style={{
                    zIndex: '60 !important'
                  }}>
                    <div className="p-3 flex flex-col items-center  border border-gray-500 bg-neutral-100 dark:bg-[#202123]"
                        style={{width: `${window.innerWidth}px`, height: `${window.innerHeight * 0.9}px`}}>
                            
                            <div className="mb-auto w-full flex flex-row gap-1 bg-neutral-100 dark:bg-[#202123] rounded-t border-b dark:border-white/20 z-60">
                                    {docUrl && (
                                        <button
                                            key={"Doc"}
                                            onClick={() => handleTabSwitch("Doc")}
                                            id="viewAmplifyAPI"
                                            className={`p-2 rounded-t flex flex-shrink-0 ${activeTab === "Doc" ? 'border-l border-t border-r dark:border-gray-500 dark:text-white  shadow-[1px_0_1px_rgba(0,0,0,0.1),-1px_0_1px_rgba(0,0,0,0.1)] dark:shadow-[1px_0_3px_rgba(0,0,0,0.3),-1px_0_3px_rgba(0,0,0,0.3)]' : 'text-gray-400 dark:text-gray-600'}`}>
                                            <h3 className="text-xl">View Amplify API</h3> 
                                        </button> )}

                                    {csvUrl && (
                                        <button
                                            key={"Downloads"}
                                            onClick={() => handleTabSwitch("Downloads")}
                                            id="downloadsAPI"
                                            className={`p-2 rounded-t flex flex-shrink-0 ${activeTab === "Downloads" ? 'border-l border-t border-r dark:border-gray-500 dark:text-white  shadow-[1px_0_1px_rgba(0,0,0,0.1),-1px_0_1px_rgba(0,0,0,0.1)] dark:shadow-[1px_0_3px_rgba(0,0,0,0.3),-1px_0_3px_rgba(0,0,0,0.3)]' : 'text-gray-400 dark:text-gray-600'}`}>
                                            <h3 className="text-xl">Downloads</h3> 
                                        </button> )}

                                        <div className='ml-auto'>
                                            <ActionButton
                                                handleClick={() => handleShowDocs(false)}
                                                title={"Close"}>
                                                <IconX size={20}/>
                                            </ActionButton>
                                        </div>      
                            </div> 

                        { fileContents && activeTab === "Doc" &&
                            <iframe
                                src={fileContents}
                                width={`${window.innerWidth * 0.6 }px`}
                                height={`${window.innerHeight * 0.85}px`}
                                onError={() => docError}
                                style={{ border: 'none' }} />   
                            }  

                { activeTab === "Downloads" && 
                    <div className='absolute top-20 flex justify-center mt-4 flex-col text-lg'>
                    <label id="downloadsAPITabTitle" className='text-xl'> Available Amplify API Documentation Formats</label>
                    <div className='ml-6'>
                        {docUrl &&
                                <APIDownloadFile
                                label="Amplify API PDF"
                                presigned_url={docUrl}
                                IconSize={24}
                                />
                        }
                        {csvUrl && 
                            <APIDownloadFile
                                label="Amplify API CSV"
                                presigned_url={csvUrl}
                                IconSize={24}
                            />
                        }
                        {postmanUrl &&
                                <APIDownloadFile
                                label="Amplify API Postman Collection"
                                presigned_url={postmanUrl}
                                IconSize={24}
                                />
                        }
                    </div>
                    </div>
                        
                    } 

                

                    </div>
                </div>
            )}
    
        </>
    );
}