import React, { FC, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'next-i18next';
import HomeContext from '@/pages/api/home/home.context';
import { Account, noCoaAccount } from "@/types/accounts";
import { Accounts } from './Account';
import { ApiKeys } from './ApiKeys';
import { getAccounts} from "@/services/accountService";
import { fetchAllApiKeys } from '@/services/apiKeysService';
import { ApiKey } from '@/types/apikeys';
import { IconX } from '@tabler/icons-react';
import { noRateLimit } from '@/types/rateLimit';
import ActionButton from '@/components/ReusableComponents/ActionButton';

interface Props {
    open: boolean;
    onClose: () => void;
}

export const AccountDialog: FC<Props> = ({ open, onClose }) => {
    const { state: {featureFlags}, dispatch: homeDispatch, setLoadingMessage } = useContext(HomeContext);

    const { t } = useTranslation('settings');

    const modalRef = useRef<HTMLDivElement>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<string>('Accounts');

    const [accounts, setAccounts] = useState<Account[]>([]);
    const [defaultAccount, setDefaultAccount] = useState<Account>(noCoaAccount);
    const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);

    const [accountsUnsavedChanges, setAccountsUnsavedChanges] = useState(false);
    const [apiUnsavedChanges, setApiUnsavedChanges] = useState(false);

    useEffect(() => {
        const handleMouseDown = (e: MouseEvent) => {
          if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
            window.addEventListener('mouseup', handleMouseUp);
          }
        };
    
        const handleMouseUp = (e: MouseEvent) => {
          window.removeEventListener('mouseup', handleMouseUp);
          onClose();
        };
    
        window.addEventListener('mousedown', handleMouseDown);
    
        return () => {
          window.removeEventListener('mousedown', handleMouseDown);
        };
      }, [onClose]);

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
    if (open) {
        setLoadingMessage('Loading Accounts...');
        fetchAccounts();
    }
}, [open]);

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
        if (open) fetchApiKeys();
    }, [open]);

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


    const close = () => {
        if (( (accountsUnsavedChanges || apiUnsavedChanges) && confirm("You have unsaved changes!\n\nYou will lose any unsaved data, would you still like to close Manage Accounts?")) ||
            (!accountsUnsavedChanges && !apiUnsavedChanges)) {
            onClose();
            setApiKeys([]);
            window.dispatchEvent(new Event('cleanupApiKeys'));
            setAccountsUnsavedChanges(false);
            setApiUnsavedChanges(false);
        }
       
    }

    const switchTab = (tabName : string) => {
        setActiveTab(tabName);
        window.dispatchEvent(new Event('cleanupApiKeys'));

    }

    // Render nothing if the dialog is not open.
    if (!open || isLoading) {
        return <></>;
    }

    return (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 ">
            <div className="fixed inset-0 z-10 overflow-hidden">
                <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                    <div className="hidden sm:inline-block sm:h-screen sm:align-middle"
                        aria-hidden="true"
                    />
                    <div
                        ref={modalRef}
                        id="accountModal"
                        className={`dark:border-neutral-600 inline-block transform rounded-lg border border-gray-300 bg-neutral-100 px-4 pb-4 text-left align-bottom shadow-xl transition-all dark:bg-[#22232b] sm:my-8 sm:min-h-[636px]  sm:w-full sm:p-4 sm:align-middle`}
                        style={{width: `${window.innerWidth - 560}px`, height: `${window.innerHeight * 0.9}px`}}
                        role="dialog">


                        {!isLoading && (

                        <>
                            <div className="text-black dark:text-white mb-4 flex flex-row gap-1 bg-transparent rounded-t border-b dark:border-white/20">
                                        <button
                                            key={"Accounts"}
                                            onClick={() => switchTab("Accounts")}
                                            id="accountsTab"
                                            className={`p-2 rounded-t flex flex-shrink-0 ${activeTab === "Accounts" ? 'border-l border-t border-r dark:border-gray-500 dark:text-white shadow-[1px_0_1px_rgba(0,0,0,0.1),-1px_0_1px_rgba(0,0,0,0.1)] dark:shadow-[1px_0_3px_rgba(0,0,0,0.3),-1px_0_3px_rgba(0,0,0,0.3)]' : 'text-gray-400 dark:text-gray-600'}`}>
                                            <h3 className="text-xl">{`Accounts${accountsUnsavedChanges ? " *" : "  "}`}</h3> 
                                        </button>

                                    {featureFlags.apiKeys && 
                                        <button
                                            key={"API"}
                                            onClick={() => switchTab("API")}
                                            id="apiTab"
                                            className={`p-2 rounded-t flex flex-shrink-0 ${activeTab === "API" ? 'border-l border-t border-r dark:border-gray-500 dark:text-white shadow-[1px_0_1px_rgba(0,0,0,0.1),-1px_0_1px_rgba(0,0,0,0.1)] dark:shadow-[1px_0_3px_rgba(0,0,0,0.3),-1px_0_3px_rgba(0,0,0,0.3)]' : 'text-gray-400 dark:text-gray-600'}`}>
                                            <h3 className="text-xl">{`API Access${apiUnsavedChanges ? " *" : "  "}`}</h3> 
                                        </button>}

                                        <div className='ml-auto'>
                                            <ActionButton
                                                handleClick={() => onClose()}
                                                title={"Close"}>
                                                <IconX size={20}/>
                                            </ActionButton>
                                        </div>      
                            </div>
                        </>           
                        )} 
                            <div id="accountModalScroll" className='overflow-y-auto' style={{ maxHeight: 'calc(100% - 60px)'}}>
                            {/* *** Accounts Tab *** */}
                                        {activeTab === "Accounts" &&
                                            <Accounts
                                            accounts={accounts}
                                            setAccounts={setAccounts}
                                            defaultAccount={defaultAccount}
                                            setDefaultAccount={setDefaultAccount}
                                            setUnsavedChanged={setAccountsUnsavedChanges}
                                            onClose={close}
                                            />
                                        }
                            {/* *** Api Keys Tab *** */}
                                        {activeTab === "API" &&
                                        <ApiKeys
                                        apiKeys={apiKeys}
                                        setApiKeys={setApiKeys}
                                        setUnsavedChanges={setApiUnsavedChanges}
                                        onClose={close}
                                        accounts={accounts}
                                        defaultAccount={defaultAccount}
                                        />
                                        }
                            </div>    
                    </div>
                    

                </div>

            </div>
        </div>
    );
};