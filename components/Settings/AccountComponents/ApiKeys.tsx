import React, { FC, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'next-i18next';
import { IconPlus, IconEye, IconCopy, IconCheck, IconX, IconUser, IconEdit, IconArticle, IconRobot, IconLoader2, IconExclamationCircle, IconCaretDown, IconCaretRight } from "@tabler/icons-react";
import HomeContext from '@/pages/api/home/home.context';
import ExpansionComponent from '../../Chat/ExpansionComponent';
import { EmailsAutoComplete } from '@/components/Emails/EmailsAutoComplete';
import { Account, noCoaAccount } from '@/types/accounts';
import { createApiKey, deactivateApiKey, fetchAllApiKeys, fetchApiDoc, updateApiKeys, rotateApiKey } from '@/services/apiKeysService';
import { ApiKey } from '@/types/apikeys';
import { PeriodType, formatRateLimit, UNLIMITED, rateLimitObj} from '@/types/rateLimit'
import { useSession } from 'next-auth/react';
import { LoadingIcon } from "@/components/Loader/LoadingIcon";
import { formatDateYMDToMDY, userFriendlyDate } from '@/utils/app/date';
import { AccountSelect } from './Account';
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
import { IconRotateClockwise2 } from '@tabler/icons-react';
import { ConfirmModal } from '@/components/ReusableComponents/ConfirmModal';
import { getUserMtdCosts } from '@/services/mtdCostService';
import { formatCurrency, getUserIdentifier } from "@/utils/app/data";
import { createPortal } from 'react-dom';


interface Props {
    setUnsavedChanges: (b: boolean) => void;
    accounts: Account[];
    defaultAccount: Account;
    open: boolean;
    onClose: () => void;
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

export const ApiKeys: FC<Props> = ({ setUnsavedChanges, accounts, defaultAccount, open, onClose}) => {
    const { state: { statsService, amplifyUsers}, dispatch: homeDispatch } = useContext(HomeContext);

    const { data: session } = useSession();
    const user = session?.user;
    const userEmail = user?.email;
    const userIdentifier = getUserIdentifier(user);
    const [apiKeys, setApiKeys] = useState<ApiKey[] | null>(null);

    const { t } = useTranslation('settings');
    const [validAccounts, setValidAccounts] = useState<any>(accounts.filter((a: Account) => a.id !== noCoaAccount.id));
    
    const [ownerApiKeys, setOwnerApiKeys] = useState<ApiKey[] | null>(null);
    const [delegateApiKeys, setDelegateApiKeys] = useState<ApiKey[] | null>(null);
    const [isCreating, setIsCreating] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState(true);

    // New state for the confirmation modal
    const [showNewKeyModal, setShowNewKeyModal] = useState<boolean>(false);
    const [newApiKeyValue, setNewApiKeyValue] = useState<string>('');

    const [appName, setAppName] = useState<string>("");
    const [appDescription, setAppDescriptione] = useState<string>("");
    const [delegateInput, setDelegateInput] = useState<string>('');
    const [allEmails, setAllEmails] = useState<Array<string> | null>(null);
    const [rateLimitPeriod, setRateLimitPeriod] = useState<PeriodType>(UNLIMITED);
    const [rateLimitRate, setRateLimitRate] = useState<string>('');
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [includeExpiration, setIncludeExpiration] = useState<boolean>(false);
    const [systemUse, setSystemUse] = useState<boolean>(false);
    
    const [selectedAccount, setSelectedAccount] = useState<Account | null>(defaultAccount.name === noCoaAccount.name ? validAccounts[0] || null : defaultAccount);

    const editedKeysRef = useRef<any>({});
    const delegateWrapperRef = useRef<HTMLDivElement>(null);
    const appNameRef = useRef<HTMLTextAreaElement>(null);

    // Purpose filtering state
    const [selectedPurposeFilter, setSelectedPurposeFilter] = useState<string>("All");
    const [expandedKey, setExpandedKey] = useState<string | null>(null);

    // Search / filter / sort state — Your Keys
    const [keySearch, setKeySearch] = useState<string>('');
    const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
    const [sortBy, setSortBy] = useState<'name' | 'lastAccessed' | 'expiration'>('name');

    // Search / filter / sort state — Delegated Keys
    const [delegateSearch, setDelegateSearch] = useState<string>('');
    const [delegateStatusFilter, setDelegateStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
    const [delegateSortBy, setDelegateSortBy] = useState<'name' | 'lastAccessed' | 'expiration'>('name');

    // MTD Cost state
    const [mtdCostData, setMtdCostData] = useState<any>(null);

    const [fullAccess, setFullAccess] = useState<boolean>(true);
    const [options, setOptions] = useState<Record<string, boolean>>(cloneDeep(optionChoices));
    const [showCreateForm, setShowCreateForm] = useState<boolean>(false);
    const [showDelegate, setShowDelegate] = useState<boolean>(false);

    useEffect(() => {
        if (showCreateForm) {
            const input = delegateWrapperRef.current?.querySelector('input');
            if (input) input.blur();
            appNameRef.current?.focus();
        }
    }, [showCreateForm]);

    const [documentComponent, setDocumentComponent] = useState<React.ReactElement | null>(null);

    const handleClose = () => {
        onClose();
        setApiKeys([]);
    }

    // Helper function to get unique purposes from owner API keys
    const getAvailablePurposes = () => {
        if (!ownerApiKeys) return ["All"];
        const purposes = ownerApiKeys
            .filter(key => key.purpose)
            .map(key => key.purpose!)
            .filter((purpose, index, arr) => arr.indexOf(purpose) === index);
        return ["All", ...purposes];
    };

    // Returns filtered + sorted keys — works for both owner and delegate sections
    const getFilteredSortedKeys = (
        keys: ApiKey[],
        search: string = keySearch,
        status: 'All' | 'Active' | 'Inactive' = statusFilter,
        sort: 'name' | 'lastAccessed' | 'expiration' = sortBy
    ): ApiKey[] => {
        let result = [...keys];

        // Search
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            result = result.filter(k => k.applicationName?.toLowerCase().includes(q));
        }

        // Status
        if (status === 'Active') result = result.filter(k => k.active);
        else if (status === 'Inactive') result = result.filter(k => !k.active);

        // Sort
        result.sort((a, b) => {
            if (sort === 'name') {
                return (a.applicationName || '').localeCompare(b.applicationName || '');
            }
            if (sort === 'lastAccessed') {
                const ta = a.lastAccessed ? new Date(a.lastAccessed).getTime() : 0;
                const tb = b.lastAccessed ? new Date(b.lastAccessed).getTime() : 0;
                return tb - ta;
            }
            if (sort === 'expiration') {
                const ta = a.expirationDate ? new Date(a.expirationDate).getTime() : Infinity;
                const tb = b.expirationDate ? new Date(b.expirationDate).getTime() : Infinity;
                return ta - tb;
            }
            return 0;
        });

        return result;
    };

    // Helper function to group owner API keys by purpose
    const getOwnerApiKeysByPurpose = () => {
        if (!ownerApiKeys) return {};
        
        const grouped = ownerApiKeys.reduce((acc, key) => {
            const purpose = key.purpose || "";
            if (!acc[purpose]) {
                acc[purpose] = [];
            }
            acc[purpose].push(key);
            return acc;
        }, {} as Record<string, ApiKey[]>);
        
        return grouped;
    };

    const fetchApiKeys = async () => {
       const result = await fetchAllApiKeys();
        if (!result.success) {
            alert("Unable to fetch your API keys. Please try again.");
            setIsLoading(false);
        } else {
            setApiKeys(result.data); 
        }
    }

    // Fetch MTD costs for current user
    const fetchMTDCosts = async () => {
        if (!userIdentifier) return;
        try {
            const result = await getUserMtdCosts();
            if (result.success && result.data) setMtdCostData(result.data);
        } catch (err) {
            console.error('Error fetching MTD costs:', err);
        } 
    };

    const getDisplayId = (userId: string) => {
        return amplifyUsers[userId] || userId;
    }


    // Get MTD cost for specific API key by matching api_owner_id to keyId after #
    const getApiKeyMtdCost = (apiKey: ApiKey) => {
        if (!mtdCostData?.accounts) return null;
        
        // Find matching account entry by matching api_owner_id to the part after #
        const matchingAccount = mtdCostData.accounts.find((acc: any) => {
            const accountInfoParts = acc.accountInfo.split('#');
            const [, keyId] = accountInfoParts; // Ignore account part, just get keyId
            
            // Match api_owner_id to keyId (portion after #)
            return keyId === apiKey.api_owner_id;
        });
        
        return matchingAccount ? matchingAccount.totalCost : null;
    };


    const mtdDisplay = (apiKey: ApiKey) => {
        const mtdCost = getApiKeyMtdCost(apiKey);
        if (mtdCost !== null) {
            return (
                <div className="apikeys-item-status ml-3">
                    <div className="apikeys-status-badge">
                        <span className="text-green-700 dark:text-green-400 text-[14px] font-semibold">
                            MTD: {formatCurrency(mtdCost)}
                        </span>
                    </div>
                </div>
            );
        }
        return null;
    }

    useEffect(() => {
        if (open) {
            fetchApiKeys();
            fetchMTDCosts();
        }
    }, [open, userIdentifier]);

    useEffect(() => {
            if (accounts && apiKeys) {
                setIsLoading(false);
            }
    }, [accounts, apiKeys]);

    
    useEffect(() => {
        const handleEvent = (event: any) => {
            setUnsavedChanges(true);
            console.log("editedApiKey was triggered", event.detail);
            const apiKeyId = event.detail.id;
            const updates = event.detail.edits; 

            if (updates.accessTypes && Array.isArray(updates.accessTypes)) {
                updates.accessTypes = updates.accessTypes.flat();
            }
    
            editedKeysRef.current = {
                ...editedKeysRef.current,
                [apiKeyId]: {
                    ...editedKeysRef.current[apiKeyId],
                    apiKeyId: apiKeyId, // Ensure the apiKeyId is set for each key
                    updates: updates // The updates are structured as per the schema
                }
            };

            // Update editedKeysRef directly
            const currentUpdates = editedKeysRef.current[apiKeyId] ? editedKeysRef.current[apiKeyId].updates : {};
            const mergedUpdates = { ...currentUpdates, ...updates };
            
            editedKeysRef.current = {
                ...editedKeysRef.current,
                [apiKeyId]: {
                    ...editedKeysRef.current[apiKeyId],
                    apiKeyId: apiKeyId, // Ensure the apiKeyId is set for each key
                    updates: mergedUpdates // The updates are structured as per the schema
                }
            };
        };
    
        window.addEventListener('editedApiKey', handleEvent);
        
        return () => {
            window.removeEventListener('editedApiKey', handleEvent);
        };
        
    }, []);


    useEffect(() => {
        const fetchEmails = async () => {
            const emailSuggestions = Object.values(amplifyUsers); // Extract email values for display
            setAllEmails(emailSuggestions ? emailSuggestions.filter((e: string) => e !== userEmail) : []);
        };
        if (!allEmails) fetchEmails();
    }, []);

    useEffect(() => {
        if (systemUse) setSystemUse(false);

    }, [delegateInput]);

    useEffect(() => {
        if (apiKeys) {
        setDelegateApiKeys(apiKeys.filter((k: ApiKey) => k.delegate === userIdentifier));
        setOwnerApiKeys(apiKeys.filter((k: ApiKey) => k.owner === userIdentifier));
        }
    }, [apiKeys]);



    const handleCreateApiKey = async () => {
        setIsCreating(true);
        
        const data = {
            'owner' : userIdentifier,
            'account' : selectedAccount,
            'delegate': delegateInput.length > 0 ? (Object.keys(amplifyUsers).find(key => amplifyUsers[key] === delegateInput) || delegateInput) : null,
            'appName' : appName,
            'appDescription' : appDescription,
            'rateLimit' : rateLimitObj(rateLimitPeriod, rateLimitRate),
            'expirationDate' : includeExpiration ? selectedDate : null,
            'accessTypes': fullAccess ? ["full_access"] :  Object.keys(options).filter((key) => options[key]),
            'systemUse' : systemUse && delegateInput.length === 0
        }
        const result = await createApiKey(data)
        setIsCreating(false);

        // empty out all the create key fields
        if (result.success && (result.data?.apiKey || result.data?.delegate)) {
            // Show the new API key in a confirmation modal for non delegate keys
            // console.log("result.data api key ", result.data?.apiKey);
            // console.log("result.data delegate ", result.data?.delegate);
            if (result.data?.apiKey && !result.data?.delegate) {
                setNewApiKeyValue(result.data.apiKey);
                setShowNewKeyModal(true);
            }
            
            setApiKeys([]);
            statsService.createApiKeyEvent(data);
            setDelegateApiKeys([]);
            setOwnerApiKeys([]);
            // to pull in the updated changes to the ui     
            fetchApiKeys();
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
              console.log(`Error message: ${result.message}`);
              alert(`Unable to create the API key at this time.`);
        }
    };

    const handleConfirmNewKey = () => {
        setShowNewKeyModal(false);
        setNewApiKeyValue('');
    };

    const handleDeactivateApikey = async (apiKeyId: string, name: string) => {
        if (confirm(`Are you sure you want to deactivate API key: ${name}?\nOnce deactivate, it cannot be undone.`)) {
            const result = await deactivateApiKey(apiKeyId);
            if (result && apiKeys) {
                setApiKeys(apiKeys.map((k: ApiKey) => {;
                    if (k.api_owner_id === apiKeyId) return {...k, active: false}
                    return k;
                }))
                statsService.deactivateApiKeyEvent(apiKeyId);
            } else {
                alert('Failed to deactivate key at this time. Please try again later...');
            }
        }
    };

    const handleApplyEdits = async () => {
        // call handle edits 
        toast("Saving API changes...");    
        const result = await updateApiKeys(Object.values(editedKeysRef.current));
        if (!result.success) {
            alert('failedKeys' in result ? `API keys: ${result.failedKeys.join(", ")} failed to update. Please try again.` : "We are unable to update your key(s) at this time...")
        } else {
            statsService.updateApiKeyEvent(Object.values(editedKeysRef.current));
            setUnsavedChanges(false);
            toast("API changes saved.");
        }
        editedKeysRef.current = {};
    };

    const handleSave = async () => {
        if (Object.keys(editedKeysRef.current).length !== 0) await handleApplyEdits();
    };

    useEffect(() => {
        window.addEventListener('settingsSave', handleSave);
        return () => window.removeEventListener('settingsSave', handleSave);
    }, []);


    const isExpired = (date: string) => {
        return new Date(date) <= new Date()
    }

    const getKeyTypeClass = (apiKey: ApiKey): string => {
        if (apiKey.systemId) return 'key-type-system';
        if (apiKey.delegate) return 'key-type-delegate';
        return 'key-type-personal';
    };

    const formatPurpose = (purpose: string): string => {
        if (purpose === "") return "General";
        return purpose
            .replace(/_/g, ' ')
            .replace(/\b\w/g, char => char.toUpperCase());
    };

    const activeLabel = (active: boolean, owner_id: string, applicationName: string) => {
       return  <div className="apikeys-item-status">
                    {active ? (
                        <button
                            title='Click to deactivate key'
                            className="apikeys-status-badge apikeys-status-active hover:opacity-65"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleDeactivateApikey(owner_id, applicationName);
                            }}
                        >
                            <IconCheck className='text-green-600' size={18} /> 
                            <span>Active</span>
                        </button>
                    ) : (
                        <div className="apikeys-status-badge apikeys-status-inactive">
                            <span className='px-2'>Inactive</span>
                        </div>
                    )}
                </div>
    }

    const rotationWarningLabel = () => {
        return (
            <div className="apikeys-item-status mr-[12%]">
                <div 
                    className="apikeys-status-badge"
                    title="There is no active key associated for this API key account. Rotation is required to have API access with this key account."
                >
                    <div className='flex flex-row gap-2 flex items-center'>
                        <IconExclamationCircle size={22} className='flex-shrink-0 text-red-600' />
                    </div>
                    <i className="text-red-600 text-[15px]">Rotation Required</i>
                </div>
            </div>
        );
    }

    if (documentComponent) return documentComponent;

    return  (
        <div className='flex flex-col'>
            {showNewKeyModal && (
                <ConfirmModal
                    title="🔑 New API Key Created"
                    message={ <NewApiKey newApiKey={newApiKeyValue} />}
                    confirmLabel="I have copied and stored the key safely"
                    onConfirm={handleConfirmNewKey}
                    height={250}
                    width={800}
                />
            )}
         <div className="accounts-settings-container mx-2">
            <div className="accounts-info-banner flex-col" style={{position: 'relative'}}>
                {/* Top row: title + resources */}
                <div style={{position: 'absolute', top: '16px', right: '16px'}}>
                    <APITools setDocumentElement={setDocumentComponent} onClose={handleClose}/>
                </div>
                <h3 className="accounts-info-title flex flex-row items-center gap-3 mb-2">
                    API Key Management
                    <span className="accounts-info-icon">🔐</span>
                </h3>
                {/* API Key Management */}
                <div className="accounts-info-content">
                    <p className="accounts-info-description">
                        API keys are used to authenticate and authorize access to specific Amplify services. You can create API keys for yourself and others.
                    </p>
                    <p className="accounts-info-description mt-1">
                        <strong>Important:</strong> API keys are shown only once upon creation. Make sure to copy and store your API key securely as you will not be able to view it again. If you lose your API key, you can <strong>rotate</strong> it to generate a new key while preserving all associated data and settings.
                    </p>
                    <p className="accounts-info-description mt-1">
                        The following fields are editable for your active API keys: <strong>Account</strong>, <strong>Expiration</strong>, <strong>Rate Limit</strong>, and <strong>Access Types</strong>. Remove an expiration date by clearing the date in the calendar. Always remember to confirm and save your changes. You can automatically deactivate any active API key by clicking the active button with the green check mark.
                    </p>
                </div>

                {/* Types of API Keys */}
                <div className="mt-3 space-y-2.5 text-xs text-neutral-500 dark:text-neutral-400">
                    <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">Types of API Keys</p>
                    <div className="flex flex-row gap-2 items-start">
                        <IconUser className='flex-shrink-0 mt-0.5' style={{ strokeWidth: 2.5 }} size={14}/>
                        <span><span className="font-semibold">Personal Use</span> — A Personal API Key allows you to interact directly with your Amplify account. This key acts on your behalf, granting access to all the data and permissions associated with your account. Use this key when you need to perform tasks or retrieve information as yourself within the Amplify environment.</span>
                    </div>
                    <div className="flex flex-row gap-2 items-start">
                        <IconUser className='flex-shrink-0 mt-0.5 text-green-600' style={{ strokeWidth: 2.5 }} size={14}/>
                        <span><span className="font-semibold">System Use</span> — A System API Key operates independently of any individual user account. It comes with its own set of permissions and behaves as though it is a completely separate account. This type of key is ideal for automated processes or applications that need their own dedicated permissions and do not require access linked to any specific user.</span>
                    </div>
                    <div className="flex flex-row gap-2 items-start">
                        <IconUser className='flex-shrink-0 mt-0.5 text-yellow-500' style={{ strokeWidth: 2.5 }} size={14}/>
                        <span><span className="font-semibold">Delegate Use</span> — A Delegate API Key is like a personal key for another Amplify user, but with your account being responsible for the associated payments. This type of key is useful when you want to grant someone else access or certain capabilities within their own Amplify account while ensuring that the billing responsibility falls on your account. You will not be able to see this API key at any time.</span>
                    </div>
                    <p className="pt-1 font-semibold text-amber-600 dark:text-amber-400">⚠ If your key has been compromised, rotate or deactivate it as soon as possible.</p>
                </div>

            </div>
            <div className="settings-card create-api-key-card">
                <div
                    className="settings-card-header cursor-pointer select-none"
                    style={{ justifyContent: 'space-between' }}
                    onClick={() => setShowCreateForm(v => !v)}
                    title={showCreateForm ? 'Collapse form' : 'Expand form'}
                >
                    <div>
                        <h3 className="settings-card-title">Create API Key</h3>
                        <p className="settings-card-description">Fill in the details below to generate a new key.</p>
                    </div>
                    {showCreateForm ? <IconCaretDown size={16} className="text-neutral-400 flex-shrink-0" /> : <IconCaretRight size={16} className="text-neutral-400 flex-shrink-0" />}
                </div>
                {showCreateForm && <div className="settings-card-content">
                        <div className='flex flex-col gap-2'>
                                                 <>
                        {isCreating && (
                            createPortal(
                                <div className="fixed top-14 left-1/2 transform -translate-x-1/2 z-[9999] pointer-events-none animate-float">
                                    <div className="p-3 flex flex-row items-center border border-gray-500 bg-[#202123] rounded-lg shadow-xl pointer-events-auto">
                                        <LoadingIcon style={{ width: "24px", height: "24px" }}/>
                                        <span className="text-lg font-bold ml-2 text-white">Creating API Key...</span>
                                    </div>
                                </div>,
                                document.body
                            )
                        )}
                        </>

                            <div className='flex flex-col  gap-2 w-full '>

                                   <div className='flex flex-row gap-6 flex-wrap items-center'>
                                        <div className='flex flex-col pb-1 sm:min-w-[340px]' style={{width: `${window.innerWidth * 0.35 }px` }}>
                                            <div className="text-sm font-medium text-black dark:text-neutral-200">
                                                {t('Application Name')}
                                            </div>

                                            <textarea
                                                ref={appNameRef}
                                                className= "mt-2 rounded-md border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                                style={{resize: 'none'}}
                                                id="applicationName"
                                                placeholder={`Application Name`}
                                                value={appName}
                                                onChange={(e) => setAppName(e.target.value)}
                                                rows={1}
                                            />
                                        </div>

                                        <div className='flex flex-col sm:min-w-[300px] sm:max-w-[440px] ml-6' style={{width: `${window.innerWidth * 0.35 }px` }}>
                                            {!showDelegate ? (
                                                <button
                                                    type="button"
                                                    onClick={() => setShowDelegate(true)}
                                                    className="self-start flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 border border-neutral-300 dark:border-neutral-600 rounded px-2 py-1"
                                                    title="Add a delegate user"
                                                >
                                                    <IconPlus size={14}/> Add Delegate
                                                </button>
                                            ) : (
                                                <>
                                                    <div className="flex flex-row items-center gap-2 text-sm font-medium text-black dark:text-neutral-200">
                                                        Delegate
                                                        <button
                                                            type="button"
                                                            onClick={() => { setShowDelegate(false); setDelegateInput(''); }}
                                                            className="text-xs text-neutral-400 hover:text-red-500 dark:hover:text-red-400"
                                                            title="Remove delegate"
                                                        >✕</button>
                                                    </div>
                                                    <div ref={delegateWrapperRef} className="mt-2 [&_input]:!border-neutral-300 [&_input]:dark:!border-neutral-600">
                                                        <EmailsAutoComplete
                                                            input={delegateInput}
                                                            setInput={setDelegateInput}
                                                            allEmails={allEmails}
                                                            addMultipleUsers={false}
                                                        />
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                   </div>


                                <div className="mt-2 text-sm text-black dark:text-neutral-200">
                                    {t('Application Description')}
                                </div>
                                <textarea
                                    className="mr-6 mb-2 rounded-md border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                    style={{resize: 'none'}}
                                    id="applicationDescription"
                                    placeholder={`Provide a short description on the application use of this api key.`}
                                    value={appDescription}
                                    onChange={(e) => setAppDescriptione(e.target.value)}
                                    rows={2}
                                />

                            
                            </div>

                            {validAccounts.length === 0 && (
                                <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 text-sm mr-6">
                                    <span className="text-base">⚠️</span>
                                    <span>No billing accounts found. <strong>Add an account</strong> in the Accounts tab before creating a key.</span>
                                </div>
                            )}
                            <div className='flex flex-row gap-2 mr-6'>
                                <label className="text-sm mt-1 w-[48px] ml-2 " htmlFor="BillTo">Bill To</label>
                                <AccountSelect
                                    accounts={validAccounts}
                                    defaultAccount={selectedAccount || defaultAccount}
                                    setDefaultAccount={setSelectedAccount}
                                />
                                </div>
                            
                            <div className='flex flex-col py-1 ml-8'>
                                <div className='flex flex-row justify-between'>
                                    <div className='flex flex-row gap-2 items-center flex-shrink-0 flex-nowrap' style={{width: '280px'}}>
                                        <span className="text-sm">Rate Limit</span>
                                        <RateLimiter
                                            period={rateLimitPeriod}
                                            setPeriod={setRateLimitPeriod}
                                            rate={rateLimitRate}
                                            setRate={setRateLimitRate}
                                            allowUnlimited={true}
                                        />
                                    </div>
                                    <div className='flex flex-row items-center' style={{width: '296px', whiteSpace: 'nowrap', overflowWrap: 'break-word'}}>
                                    <div className='mt-1'> <Checkbox
                                            id={`expirationDate`}
                                            label={'Set Expiration Date'}
                                            checked={includeExpiration}
                                            onChange={(checked:boolean) => setIncludeExpiration(checked)}
                                        />
                                    </div>
                                    {includeExpiration && 
                                        <input
                                            className="ml-2 rounded border-gray-300 p-0.5 text-neutral-900 dark:text-neutral-100 shadow-sm bg-neutral-200 dark:bg-[#40414F] focus:border-neutral-700 focus:ring focus:ring-neutral-500 focus:ring-opacity-50"
                                            type="date"
                                            id="expiration"
                                            value={selectedDate}
                                            min={today}
                                            onChange={(e) => setSelectedDate(e.target.value)}
                                        />}
                                    </div>


                                    <div
                                        className='mt-1 mr-6 w-[140px]'
                                        title={delegateInput.length > 0 ? 'System use is not available when a delegate is set' : 'Mark this key as a system key — not tied to any individual user'}
                                    >
                                        <div className={delegateInput.length > 0 ? 'opacity-40 cursor-not-allowed pointer-events-none select-none' : ''}>
                                            <Checkbox
                                                id={`SystemUse`}
                                                label={'For System Use'}
                                                checked={systemUse}
                                                onChange={(checked:boolean) => setSystemUse(checked)}
                                            />
                                        </div>
                                    </div>
                                </div>
                                
                            </div>
                            <div className='flex flex-row py-1 '>
                                <div className='py-1 w-full' title='Full Access is the default configuration.'>
                                    <ExpansionComponent
                                                title={`Access Controls — ${fullAccess ? 'Full Access' : Object.keys(options).filter(k => options[k]).map(k => formatAccessType(k)).join(', ') || 'None'}`}
                                                content={
                                                    <AccessTypesCheck
                                                     fullAccess={fullAccess}
                                                     setFullAccess={setFullAccess}
                                                     options={options}
                                                     setOptions={setOptions}
                                                    />
                                                }
                                    />
                                </div>

                                <button
                                    type="button"
                                    title={!selectedAccount ? 'Add a billing account before creating a key' : 'Create API Key'}
                                    id="createAPIKeyConfirm"
                                    disabled={!selectedAccount}
                                    className={`ml-auto mr-6 mt-4 px-2 py-1.5 text-white rounded focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-500 transition-colors ${
                                        !selectedAccount
                                            ? 'bg-neutral-400 dark:bg-neutral-600 cursor-not-allowed opacity-60'
                                            : 'bg-neutral-600 hover:bg-red-700 cursor-pointer'
                                    }`}
                                    style= {{width: '146px', height: '36px'}}
                                    onClick={() => handleCreateApiKey()}
                                >
                                    <div className=' flex flex-row gap-2 mr-1 truncate'>
                                    <IconPlus size={20} />
                                    Create Key
                                    </div>
                                </button>
                            </div>

                        </div>
                </div>}
            </div>

            <div className="settings-card">
                <div className="settings-card-header" style={{ justifyContent: 'space-between' }}>
                    <div>
                        <h3 className="settings-card-title">Your API Keys</h3>
                        <p className="settings-card-description">Keys you own. Click a key to view or edit its details.</p>
                    </div>
                </div>
                {/* Toolbar: search + status + sort + purpose */}
                <div className="flex flex-wrap items-center gap-2 px-3 pt-3 pb-3">
                    <input
                        type="text"
                        placeholder="Search by name…"
                        value={keySearch}
                        onChange={e => setKeySearch(e.target.value)}
                        className="flex-1 min-w-[160px] px-3 py-1.5 text-sm rounded-md border border-neutral-500 dark:border-neutral-700 bg-neutral-100 dark:bg-[#2a2b32] text-neutral-900 dark:text-neutral-100 focus:outline-none"
                    />
                    <div className="flex items-center rounded-md border border-neutral-500 dark:border-neutral-700 overflow-hidden text-sm">
                        {(['All', 'Active', 'Inactive'] as const).map(s => (
                            <button
                                key={s}
                                onClick={() => setStatusFilter(s)}
                                className={`px-3 py-1.5 transition-colors ${
                                    statusFilter === s
                                        ? 'bg-neutral-600 text-white'
                                        : 'bg-neutral-100 dark:bg-[#2a2b32] text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                                }`}
                            >{s}</button>
                        ))}
                    </div>
                    <select
                        value={sortBy}
                        onChange={e => setSortBy(e.target.value as any)}
                        className="px-2 py-1.5 text-sm rounded-md border border-neutral-500 dark:border-neutral-700 bg-neutral-100 dark:bg-[#2a2b32] text-neutral-900 dark:text-neutral-100 focus:outline-none"
                    >
                        <option value="name">Sort: Name</option>
                        <option value="lastAccessed">Sort: Last Accessed</option>
                        <option value="expiration">Sort: Expiration</option>
                    </select>
                    {getAvailablePurposes().length > 1 && (
                        <select
                            className="px-2 py-1.5 text-sm rounded-md border border-neutral-500 dark:border-neutral-700 bg-neutral-100 dark:bg-[#2a2b32] text-neutral-900 dark:text-neutral-100 focus:outline-none"
                            value={selectedPurposeFilter}
                            onChange={(e) => setSelectedPurposeFilter(e.target.value)}
                        >
                            {getAvailablePurposes().map((purpose, i) => (
                                <option key={i} value={purpose}>
                                    {purpose === 'All' ? 'All purposes' : formatPurpose(purpose)}
                                </option>
                            ))}
                        </select>
                    )}
                </div>
                <div className="settings-card-content">
                {isLoading ? <div className="flex items-center justify-center py-8">
                            <IconLoader2 size={24} className="animate-spin text-gray-500 mr-2" />
                            <span>{"Loading API Keys..."}</span>
                        </div> : (
                <div className='overflow-x-auto'>
                {ownerApiKeys && ownerApiKeys.length === 0 ? (
                    <div className="text-center text-sm italic text-neutral-400 dark:text-neutral-500 py-3">
                        You do not have any API keys set up. Add one above.
                    </div>
                ) : (
                    <div className='flex flex-col gap-4'>
                        {/* API Keys Display */}
                        {(() => {
                            const filtered = getFilteredSortedKeys(
                                Object.entries(getOwnerApiKeysByPurpose())
                                    .filter(([purpose]) => selectedPurposeFilter === "All" || purpose === selectedPurposeFilter)
                                    .flatMap(([, keys]) => keys)
                            );
                            if (filtered.length === 0) return (
                                <div className="text-center text-sm italic text-neutral-400 dark:text-neutral-500 py-4">
                                    No keys match your filters.
                                </div>
                            );
                            return Object.entries(
                                filtered.reduce((acc, key) => {
                                    const p = key.purpose || '';
                                    if (!acc[p]) acc[p] = [];
                                    acc[p].push(key);
                                    return acc;
                                }, {} as Record<string, ApiKey[]>)
                            ).map(([purpose, keys]) => (
                                <div key={purpose} className="space-y-2">
                                    {selectedPurposeFilter === "All" && purpose && (
                                        <div className="flex flex-row gap-2 text-sm font-semibold justify-center text-neutral-400 dark:text-neutral-500 border-b border-neutral-500 pb-1">
                                            {formatPurpose(purpose)} Keys
                                        </div>
                                    )}
                                    {/* Modern Card Layout */}
                                    <div className="apikeys-grid">
                                        {keys.map((apiKey: ApiKey, index: number) => {
                                            const isExpanded = expandedKey === apiKey.api_owner_id;
                                            return (
                                            <div key={apiKey.api_owner_id}
                                                 className={`apikeys-item-card ${isExpanded ? 'expanded' : ''} ${getKeyTypeClass(apiKey)}`}>
                                                <div className="apikeys-item-collapsed-view"
                                                     style={{ cursor: 'pointer' }}
                                                     title={"Click to view and manage key details"}
                                                     onClick={(e) => {
                                                        const selection = window.getSelection();
                                                        if (selection && selection.toString().length > 0) {
                                                            return;
                                                        }
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setExpandedKey(isExpanded ? null : apiKey.api_owner_id);
                                                    }}>
                                                    <div className='flex items-center gap-3 flex-1 min-w-0'>
                                                        <IconUser 
                                                            style={{ strokeWidth: 2.5 }} 
                                                            className={`flex-shrink-0 ${apiKey.systemId 
                                                                ? 'text-green-600' : apiKey.delegate ? 'text-yellow-500' : 'text-gray-600 dark:text-gray-400'}`} 
                                                            size={20}
                                                        />
                                                        <div className='flex flex-col flex-1 min-w-0'>
                                                            <div className="apikeys-item-name flex items-center">
                                                                {apiKey.applicationName}
                                                                {apiKey.systemId && <label className={`ml-4 text-green-700 text-xs`}> System ID: {apiKey.systemId}</label>}
                                                                {apiKey.delegate && <label className={`ml-4 text-amber-500 text-xs`}> Delegate: {getDisplayId(apiKey.delegate)}</label>}
                                                                {mtdDisplay(apiKey)}
                                                            </div>
                                                            <div className='apikeys-item-summary'>
                                                                <span>{apiKey.account ? `• ${apiKey.account.name}` : '• No Account'}</span>
                                                                {apiKey.expirationDate && <>•<span className={isExpired(apiKey.expirationDate) ? "text-red-600": ""}>{isExpired(apiKey.expirationDate) ? 'Expired:' : 'Expires:'} {formatDateYMDToMDY(apiKey.expirationDate)}</span></>}
                                                                {apiKey.lastAccessed && <>•<span>Last Accessed: {userFriendlyDate(apiKey.lastAccessed)}</span></>}
                                                                
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {!apiKey.delegate && apiKey.active && apiKey.needs_rotation && !apiKey.purpose && rotationWarningLabel()}
                                                    {activeLabel(apiKey.active, apiKey.api_owner_id, apiKey.applicationName)}

                                                </div>
                                                
                                                <div className={`apikeys-item-expanded-view ${isExpanded ? 'open' : ''}`}>
                                                    <div className="apikeys-item-details">
                                                        <div>
                                                            <span className="apikeys-item-label">Account:</span>
                                                            <Label 
                                                                label={apiKey.account ? `${apiKey.account.name} - ${apiKey.account.id}` : ''} 
                                                                widthPx='180px' 
                                                                editableField={apiKey.active && (userIdentifier !== apiKey.delegate)? 'account' : undefined} 
                                                                apiKey={apiKey} 
                                                                accounts={validAccounts}
                                                            />
                                                        </div>
                                                    
                                                        
                                                        <div>
                                                            <span className="apikeys-item-label">Expiration:</span>
                                                            {apiKey.expirationDate ? (
                                                                <Label 
                                                                    label={formatDateYMDToMDY(apiKey.expirationDate)} 
                                                                    textColor={isExpired(apiKey.expirationDate) ? "text-red-600": undefined} 
                                                                    editableField={apiKey.active ? 'expirationDate': undefined} 
                                                                    apiKey={apiKey}
                                                                />
                                                            ) : (
                                                                <Label 
                                                                    label={null} 
                                                                    editableField={apiKey.active ? 'expirationDate': undefined} 
                                                                    apiKey={apiKey}
                                                                />
                                                            )}
                                                        </div>
                                                        
                                                        <div>
                                                            <span className="apikeys-item-label">Rate Limit:</span>
                                                            <Label 
                                                                label={formatRateLimit(apiKey.rateLimit)} 
                                                                editableField={apiKey.active ? 'rateLimit' : undefined} 
                                                                apiKey={apiKey}
                                                            />
                                                        </div>
                                                        
                                                        <div>
                                                            <span className="apikeys-item-label">Access Types:</span>
                                                            <Label 
                                                                label={formatAccessTypes(apiKey.accessTypes).replaceAll(',', ', ')} 
                                                                widthPx="230px" 
                                                                editableField={apiKey.active ? 'accessTypes' : undefined} 
                                                                apiKey={apiKey}
                                                            />
                                                        </div>
                                                    </div>
                                                    
                                                    {!apiKey.delegate && apiKey.active && !apiKey.purpose && (
                                                    <RotateApiKey id={apiKey.api_owner_id} 
                                                        onRotate={(rotatedKeyId: string) => {
                                                                // Update owner keys
                                                                setOwnerApiKeys(prev => prev ? prev.map(key => 
                                                                    key.api_owner_id === rotatedKeyId 
                                                                        ? { ...key, needs_rotation: false }
                                                                        : key
                                                                ) : []);}
                                                            } />
                                                        )}
                                                </div>
                                            </div>
                                        )})}
                                    </div>
                                </div>
                            ));
                        })()}
                    </div>
                )}
                </div>
                )}

                </div>
            </div>

            <div className="settings-card">
                <div className="settings-card-header">
                    <div>
                        <h3 className="settings-card-title">Delegated API Keys</h3>
                        <p className="settings-card-description">Keys created by others and assigned to you. Billing is charged to the key owner&apos;s account.</p>
                    </div>
                </div>
                {/* Toolbar: only shown when there are delegated keys to filter */}
                {delegateApiKeys && delegateApiKeys.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 px-3 pt-3 pb-3">
                    <input
                        type="text"
                        placeholder="Search by name…"
                        value={delegateSearch}
                        onChange={e => setDelegateSearch(e.target.value)}
                        className="flex-1 min-w-[160px] px-3 py-1.5 text-sm rounded-md border border-neutral-500 dark:border-neutral-700 bg-neutral-100 dark:bg-[#2a2b32] text-neutral-900 dark:text-neutral-100 focus:outline-none"
                    />
                    <div className="flex items-center rounded-md border border-neutral-500 dark:border-neutral-700 overflow-hidden text-sm">
                        {(['All', 'Active', 'Inactive'] as const).map(s => (
                            <button
                                key={s}
                                onClick={() => setDelegateStatusFilter(s)}
                                className={`px-3 py-1.5 transition-colors ${
                                    delegateStatusFilter === s
                                        ? 'bg-neutral-600 text-white'
                                        : 'bg-neutral-100 dark:bg-[#2a2b32] text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                                }`}
                            >{s}</button>
                        ))}
                    </div>
                    <select
                        value={delegateSortBy}
                        onChange={e => setDelegateSortBy(e.target.value as any)}
                        className="px-2 py-1.5 text-sm rounded-md border border-neutral-500 dark:border-neutral-700 bg-neutral-100 dark:bg-[#2a2b32] text-neutral-900 dark:text-neutral-100 focus:outline-none"
                    >
                        <option value="name">Sort: Name</option>
                        <option value="lastAccessed">Sort: Last Accessed</option>
                        <option value="expiration">Sort: Expiration</option>
                    </select>
                </div>
                )}
                <div className="settings-card-content">
                {(!delegateApiKeys || delegateApiKeys.length === 0) ? (
                    <div className="text-center text-sm italic text-neutral-400 dark:text-neutral-500 py-3">
                        No keys have been delegated to you. Keys created by others for your account will appear here.
                    </div>
                ) : (
                <>
                {(() => {
                    const filteredDelegates = getFilteredSortedKeys(delegateApiKeys, delegateSearch, delegateStatusFilter, delegateSortBy);
                    if (filteredDelegates.length === 0) return (
                        <div className="text-center text-sm italic text-neutral-400 dark:text-neutral-500 py-4">
                            No delegated keys match your filters.
                        </div>
                    );
                    return (<div className="apikeys-grid">
                    {filteredDelegates.map((apiKey: ApiKey) => {
                        const isExpanded = expandedKey === apiKey.api_owner_id;
                        return (
                        <div key={apiKey.api_owner_id}
                             className={`apikeys-item-card apikeys-delegated-card ${isExpanded ? 'expanded' : ''} ${getKeyTypeClass(apiKey)}`}>
                            <div className="apikeys-item-collapsed-view"
                                 style={{ cursor: 'pointer' }}
                                 title={"Click to view the key details"}
                                 onClick={(e) => {
                                    const selection = window.getSelection();
                                    if (selection && selection.toString().length > 0) {
                                        return;
                                    }
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setExpandedKey(isExpanded ? null : apiKey.api_owner_id);
                                 }}>
                                <div className='flex items-center gap-3 flex-1 min-w-0'>
                                    <IconUser 
                                        style={{ strokeWidth: 2.5 }} 
                                        className="flex-shrink-0 text-yellow-500" 
                                        size={20}
                                    />
                                    <div className='flex flex-col flex-1 min-w-0'>
                                        <div className="apikeys-item-name">
                                            {apiKey.applicationName}
                                            <label className={`ml-4 text-gray-400 text-xs`}> Owner: {getDisplayId(apiKey.owner)}</label>
                                            {mtdDisplay(apiKey)}
                                        </div>
                                        <div className='apikeys-item-summary'>
                                            {apiKey.expirationDate && <>•<span className={isExpired(apiKey.expirationDate) ? "text-red-600": ""}>{isExpired(apiKey.expirationDate) ? 'Expired:' : 'Expires:'} {formatDateYMDToMDY(apiKey.expirationDate)}</span></>}
                                            {apiKey.lastAccessed && <>•<span>Last Accessed: {userFriendlyDate(apiKey.lastAccessed)}</span></>}

                                        </div>
                                    </div>
                                </div>
                                {apiKey.active && apiKey.needs_rotation && rotationWarningLabel()}
                                {activeLabel(apiKey.active, apiKey.api_owner_id, apiKey.applicationName)}
                                
                            </div>
                            
                            <div className={`apikeys-item-expanded-view ${isExpanded ? 'open' : ''}`}>
                                <div className="apikeys-item-details">
                                    <div>
                                        <span className="apikeys-item-label">Owner:</span>
                                        <Label label={getDisplayId(apiKey.owner)} />
                                    </div>
                                    
                                    <div>
                                        <span className="apikeys-item-label">Expiration:</span>
                                        {apiKey.expirationDate ? (
                                            <Label 
                                                label={formatDateYMDToMDY(apiKey.expirationDate)} 
                                                textColor={isExpired(apiKey.expirationDate) ? "text-red-600": undefined} 
                                            />
                                        ) : (
                                            <NALabel />
                                        )}
                                    </div>
                                    
                                    <div>
                                        <span className="apikeys-item-label">Rate Limit:</span>
                                        <Label label={formatRateLimit(apiKey.rateLimit)} widthPx="140px" />
                                    </div>
                                    
                                    <div>
                                        <span className="apikeys-item-label">Access Types:</span>
                                        <Label label={formatAccessTypes(apiKey.accessTypes).replaceAll(',', ', ')} widthPx="180px" />
                                    </div>
                                </div>
                                
                                {apiKey.active && (
                                    <RotateApiKey id={apiKey.api_owner_id} 
                                                  onRotate={(rotatedKeyId: string) => {
                                                    // Update delegate keys
                                                    setDelegateApiKeys(prev => prev ? prev.map(key => 
                                                        key.api_owner_id === rotatedKeyId 
                                                            ? { ...key, needs_rotation: false }
                                                            : key
                                                    ) : []);
                                }} />
                                )}
                            </div>
                        </div>
                    )})}
                    </div>);
                })()}
                </>
                )}
                </div>
            </div>

        </div>
        </div>

    );
};


interface NewApiKeyProps {
    newApiKey: string;
    onClose?: () => void;
}

export const NewApiKey: FC<NewApiKeyProps> = ({ newApiKey, onClose }) => {
    const [messageCopied, setMessageCopied] = useState(false);

    const copyOnClick = () => {
        if (!navigator.clipboard || !newApiKey) return;

        navigator.clipboard.writeText(newApiKey).then(() => {
            setMessageCopied(true);
            setTimeout(() => {
                setMessageCopied(false);
            }, 2000);
        });
    };
    return (
        <div 
            className="flex flex-col space-y-3 p-3 rounded-lg border-2 border-red-500 bg-yellow-100/70 dark:bg-gray-900 dark:border-red-800"
        >   <div className="relative">
                <div className="flex items-center justify-center space-x-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                    <span className="text-red-600 dark:text-amber-300 font-semibold text-sm">
                        ⚠️ NEW API KEY GENERATED - COPY NOW
                    </span>
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                </div>
                {onClose && 
                <div className="absolute right-0 flex justify-center" style={{transform: "translateY(-30px)"}}>
                    <ActionButton
                        handleClick={() => {
                            onClose(); 
                        setMessageCopied(false);
                        }}>
                        <div className="flex items-center space-x-2 px-3 py-1">
                            <IconCheck size={16} />
                            <span className="text-sm font-medium">I stored it safely</span>
                        </div>
                    </ActionButton>
                </div>}
            </div>
            <div className="relative flex items-center justify-center bg-white dark:bg-gray-800/90 px-3 rounded -mx-3">
                <div className="flex-1 text-center py-1.5">
                    <span className="font-mono text-green-600 dark:text-green-400 text-sm font-bold">
                        {newApiKey}
                    </span>
                </div>
                <div className="absolute right-5">
                {messageCopied ? (
                    <div className="flex flex-row gap-1 items-center text-green-600 dark:text-green-400">
                        <IconCheck size={18} />
                        <span className="text-xs font-medium">Copied!</span>
                    </div>
                ) : (
                    <ActionButton
                        handleClick={copyOnClick}
                        title="Copy new API key">
                        <IconCopy size={18} />
                    </ActionButton>
                )}
                </div>
            </div>
            
            <div className="text-center justify-center flex flex-row gap-2 items-center text-xs text-black dark:text-neutral-100">
                <div className="font-semibold">⚠️ This key will only be shown once!</div>
                <div>{"Copy and store it securely. If lost, you'll need to rotate this key."}</div>
            </div>
            
        </div>
    )

}

interface RotateApiKeyProps {
    id: string;
    onRotate?: (id: string) => void;
}

export const RotateApiKey: FC<RotateApiKeyProps> = ({ id, onRotate }) => {
    const { state: { statsService } } = useContext(HomeContext);
    const [isRotating, setIsRotating] = useState(false);
    const [newApiKey, setNewApiKey] = useState<string | null>(null);

    const handleRotateKey = async () => {
        if (!confirm("Are you sure you want to rotate this API key? This will generate a new key and invalidate the current one.")) {
            return;
        }

        setIsRotating(true);
        const result = await rotateApiKey(id);
        
        if (!result.success || !result.data.apiKey) {
            alert(result.error || "Unable to rotate your API key at this time...");
            setIsRotating(false);
            return;
        }

        setNewApiKey(result.data.apiKey);
        setIsRotating(false);
        onRotate?.(id);
    };


    const handleClose = () => {
        setNewApiKey(null);
    };


    // Default state - footer section with built-in divider
    return ( newApiKey ? <NewApiKey newApiKey={newApiKey} onClose={handleClose} /> :
        <div className="w-full">
            <div className="mt-4 pt-3 border-t border-gray-300 dark:border-gray-600">
                <div className="flex items-center gap-4">
                    <div className="flex flex-row gap-2 items-center">
                        <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                            Key Management
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-500">
                            Replace with a new key if compromised or lost
                        </span>
                    </div>
                    
                    <div className="flex items-center">
                        {isRotating ? (
                            <div className="flex items-center space-x-2 px-4 py-2 bg-blue-100/20 dark:bg-blue-900/20 rounded-lg border border-blue-600 dark:border-blue-500">
                                <LoadingIcon className="w-4 h-4" />
                                <span className="text-sm text-blue-500 dark:text-blue-300 font-medium">
                                    Generating new key...
                                </span>
                            </div>
                        ) : (
                            <ActionButton
                                handleClick={handleRotateKey}
                                title="Generate a new API key while preserving all settings and data">
                                <div className="flex items-center space-x-2 px-4 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                                    <IconRotateClockwise2 size={18} />
                                    <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                                        Rotate Key
                                    </span>
                                </div>
                            </ActionButton>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};


type EditableField = 'expirationDate' | 'accessTypes' | 'rateLimit' | 'account';

interface LabelProps {
    label:  string| null;
    widthPx?: string;
    textColor?: string;
    editableField?: EditableField;
    isDate?: boolean
    apiKey?: ApiKey;
    accounts?:  Account[];
    width?: string;
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
                whiteSpace: editableField === 'accessTypes' && isEditing ? 'normal' : (isDate ? 'pre-wrap' : 'nowrap'),
                overflow: editableField === 'accessTypes' && isEditing ? 'visible' : (isDate ? 'auto' : 'hidden'),
                overflowWrap: 'break-word',
                width: isEditing && editableField === 'accessTypes' ? '500px' : (isEditing && editableField === 'account' ? '300px' : widthPx),
                position: 'relative',
                height: isEditing && editableField === 'accessTypes' ? 'auto' : '36px',
                minHeight: '36px',
                flex: 'shrink-0',
            }}
            className={`mb-2 p-2 flex-1 text-sm rounded flex flex-row ${textColor || 'text-black dark:text-neutral-200'} ${isOverflowing || isDate ? 'bg-neutral-200 dark:bg-[#40414F]' : 'transparent'}`}
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
            {editableField && editableField === 'rateLimit' && (
            <div className='flex flex-row gap-3 items-center'>
                <RateLimiter
                    period={rateLimitPeriod as PeriodType}
                    setPeriod={setRateLimitPeriod}
                    rate={rateLimitRate}
                    setRate={setRateLimitRate}
                    allowUnlimited={true}
                />
            </div>)}
            {editableField && editableField === 'accessTypes' && (
                <div className='w-[220px]'>
                <AccessTypesCheck
                    fullAccess={fullAccess}
                    setFullAccess={setFullAccess}
                    options={options}
                    setOptions={setOptions}
                /></div>
            )}
            </>
        )}

        {isEditing && (
            (
                <div className="max-h-[34px] ml-2 relative z-10 flex bg-neutral-200 dark:bg-[#343541]/90 rounded"  
               >
                  <ActionButton
                  title='Confirm Change'
                    handleClick={(e) => {
                        e.stopPropagation();
                        handleEdit();
                        setIsEditing(false);
                    }}
                  >
                    <IconCheck className='text-green-500' size={18} />
                  </ActionButton>
                  <ActionButton
                    title='Discard Change'
                    handleClick={(e) => {
                      e.stopPropagation();
                      setIsEditing(false);
                    }}
                  >
                    <IconX className='text-red-500' size={18} />
                  </ActionButton>
                </div>
              )

        )}

        {editableField && isHovered && !isEditing && !isScrolling && (
            <div
                className="absolute top-1 right-0 ml-auto z-10 flex-shrink-0 bg-neutral-200 dark:bg-[#343541]/90 rounded"
                style={{ transform: `translateX(${translateX}px)` }}
            > 
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
         <div className='flex flex-wrap gap-x-3 gap-y-1 text-xs items-center' >
            <div className='flex items-center gap-1 whitespace-nowrap'>
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
                <label className="font-medium" htmlFor="fullAccessCheckbox">Full Access</label>
            </div>
            {Object.keys(options).map((key: string) => (
                <div key={key} className='flex items-center gap-1 whitespace-nowrap'>
                <input type="checkbox" id={`access-${key}`} checked={options[key]} onChange={() => {
                    setOptions((prevOptions:any) => {
                        const newOptions = { ...prevOptions, [key]: !prevOptions[key] };
                        if (!newOptions[key]) setFullAccess(false);
                        return newOptions;
                    })
                }}/>
                <label className="" htmlFor={`access-${key}`}>{formatAccessType(key)}</label>
                </div>
            ))}
        </div>
    );
}


interface ToolsProps {
    setDocumentElement: (e: React.ReactElement | null) => void;
    onClose: () => void;
}


const APITools: FC<ToolsProps> = ({setDocumentElement, onClose}) => {
    const { state: {prompts, statsService, groups, availableModels}, dispatch: homeDispatch, handleNewConversation} = useContext(HomeContext);
    const promptsRef = useRef(prompts);

    useEffect(() => {
        promptsRef.current = prompts;
      }, [prompts]);
     const [isLoading, setIsLoading] = useState(false);
    const docUrlRef = useRef<string | undefined>(undefined);
    const csvUrlRef = useRef<string | undefined>(undefined);
    const postmanUrlRef = useRef<string | undefined>(undefined);
    const fileContentsRef = useRef<any>(undefined);

    const showDocsRef = useRef<boolean | null>(null);
    // prevent recalling the getSettings function
    if (showDocsRef.current === null) showDocsRef.current = false;

    // Helper function to find assistants in AmplifyAssistants groups
    const findAssistantByTag = (tag: string): Prompt | undefined => {
        if (!groups) return undefined;

        for (const group of groups) {
            // Check if this is an AmplifyAssistants group
            if (group.id?.startsWith('AmplifyAssistants_') && group.assistants) {
                // Search through assistants in this group
                const assistant = group.assistants.find((a: Prompt) =>
                    a.data?.tags && a.data.tags.includes(tag)
                );
                if (assistant) return assistant;
            }
        }
        return undefined;
    };

    const [keyManager, setKeyManager] = useState<Prompt | undefined>(findAssistantByTag(ReservedTags.ASSISTANT_API_KEY_MANAGER));
    const [apiAst, setApiAst] = useState<Prompt | undefined>(findAssistantByTag(ReservedTags.ASSISTANT_API_HELPER));

    // Update assistants when groups change
    useEffect(() => {
        setKeyManager(findAssistantByTag(ReservedTags.ASSISTANT_API_KEY_MANAGER));
        setApiAst(findAssistantByTag(ReservedTags.ASSISTANT_API_HELPER));
    }, [groups]);

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


    useEffect(() => {
    //     console.log("showDocs", showDocs, "isLoading", isLoading);
        if (showDocsRef.current) setDocumentElement(documentComponent(isLoading));
    }, [isLoading, docUrlRef.current, csvUrlRef.current, postmanUrlRef.current, fileContentsRef.current]);

    const handleShowApiDoc = async () => {
        showDocsRef.current = true;
        //check if expired 
        const isExpired = docUrlRef.current ? isUrlExpired(docUrlRef.current) : true;
        if (isExpired) {
            setIsLoading(true);
            const result = await fetchApiDoc();
            if (result.success) {
                docUrlRef.current = result.doc_url;
                setContents(result.doc_url);
                csvUrlRef.current = result.csv_url;
                postmanUrlRef.current = result.postman_url;
            } else {
                docError();
            }
        } 
        setIsLoading(false);
    }

    const docError = () => {
        alert("Unable to display API documentation at this time. Please try again later...");
    }

    const handleStartConversation = (startPrompt: Prompt) => {
        if(isAssistant(startPrompt) && startPrompt.data){
            homeDispatch({field: 'selectedAssistant', value: startPrompt.data.assistant});
        }
        statsService.startConversationEvent(startPrompt);
        handleStartConversationWithPrompt(handleNewConversation, promptsRef.current, startPrompt, availableModels);
        onClose();
    }

    const setContents = async (url: string) => {
        const file = await fetchFile(url);
        fileContentsRef.current = file;
        if (showDocsRef.current) setDocumentElement(documentComponent(false));
    }


    const documentComponent = (loading: boolean) => {
        const handleClose = () => {
            showDocsRef.current = false;
            setDocumentElement(null);
        };
        return (
            <div className="flex flex-col">
                {/* Toolbar */}
                <div className="flex flex-row items-center gap-3 px-4 py-2 border-b border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-[#2b2c36] sticky top-0 z-10">
                    <span className="font-semibold text-neutral-800 dark:text-neutral-100 mr-auto">API Documentation</span>
                    {!loading && (
                        <>
                            {docUrlRef.current && (
                                <APIDownloadFile label="PDF" presigned_url={docUrlRef.current} IconSize={15} />
                            )}
                            {csvUrlRef.current && (
                                <APIDownloadFile label="CSV" presigned_url={csvUrlRef.current} IconSize={15} />
                            )}
                            {postmanUrlRef.current && (
                                <APIDownloadFile label="Postman" presigned_url={postmanUrlRef.current} IconSize={15} />
                            )}
                        </>
                    )}
                    <button
                        onClick={handleClose}
                        title="Close"
                        className="ml-2 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-100 transition-colors"
                    >
                        <IconX size={20} />
                    </button>
                </div>

                {/* Content */}
                {loading ? (
                    <div className="p-4 flex flex-row items-center gap-2">
                        <LoadingIcon style={{ width: "20px", height: "20px" }} />
                        <span className="text-neutral-600 dark:text-neutral-300">Loading API Documentation...</span>
                    </div>
                ) : (
                    <iframe
                        src={fileContentsRef.current}
                        style={{ width: '100%', height: `${window.innerHeight * 0.6}px`, border: 'none' }}
                        onError={() => docError()}
                    />
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-row items-center gap-3 flex-wrap">
            <div className="apitools-tabs">
                <button
                    onClick={() => handleShowApiDoc()}
                    id="amplifyDocumentationButton"
                    title="View Amplify API Documentation"
                    className="apitools-tab apitools-tab-docs"
                >
                    <IconArticle size={16}/>
                    <span>API Docs</span>
                </button>
                {keyManager && (
                    <button
                        onClick={() => handleStartConversation(keyManager)}
                        title="Chat with Amplify API Key Manager"
                        className="apitools-tab apitools-tab-manager"
                    >
                        <IconRobot size={16}/>
                        <span>Key Manager</span>
                    </button>
                )}
                {apiAst && (
                    <button
                        onClick={() => handleStartConversation(apiAst)}
                        title="Chat with Amplify API Assistant"
                        className="apitools-tab apitools-tab-assistant"
                    >
                        <IconRobot size={16}/>
                        <span>API Assistant</span>
                    </button>
                )}
            </div>
        </div>
    );
}