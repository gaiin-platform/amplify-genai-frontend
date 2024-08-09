import React, { FC, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'next-i18next';
import HomeContext from '@/pages/api/home/home.context';
import Loader from "@/components/Loader/Loader";
import { Account, noCoaAccount } from "@/types/accounts";
import { Accounts } from './Account';
import { ApiKeys } from './ApiKeys';
import { getAccounts} from "@/services/accountService";
import { fetchAllApiKeys } from '@/services/apiKeysService';
import { ApiKey } from '@/types/apikeys';
import { IconX } from '@tabler/icons-react';
import SidebarActionButton from '@/components/Buttons/SidebarActionButton';
import { noRateLimit, RateLimit } from '@/types/rateLimit';

interface Props {
    open: boolean;
    onClose: () => void;
}

export const AccountDialog: FC<Props> = ({ open, onClose }) => {
    const { state: {featureFlags}, dispatch: homeDispatch } = useContext(HomeContext);

    const { t } = useTranslation('settings');

    const modalRef = useRef<HTMLDivElement>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [loadingMessage, setLoadingMessage] = useState<string>('Loading...');
    const [activeTab, setActiveTab] = useState<string>('Accounts');

    const [accounts, setAccounts] = useState<Account[]>([]);
    const [defaultAccount, setDefaultAccount] = useState<Account>(noCoaAccount);
    const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);

    const [accountsUnsavedChanges, setAccountsUnsavedChanges] = useState(false);
    const [apiUnsavedChanges, setApiUnsavedChanges] = useState(false);


 // fetch data
useEffect(() => {
    const fetchAccounts = async () => {
        const result = await getAccounts();
        if (!result.success) {
            alert("Unable to fetch accounts. Please try again.");
            setIsLoading(false);
            // onClose();
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
        setLoadingMessage('Loading...');
        setIsLoading(true);
        fetchAccounts();
    }
}, [open]);

    const fetchApiKeys = async () => {
        const result = await fetchAllApiKeys();

        if (!result.success) {
            alert("Unable to fetch your API keys. Please try again.");
            setIsLoading(false);
        } else {
            setApiKeys(result.data);
            // console.log(result.data)   
        }
    }
   useEffect(() => {
        if (open) fetchApiKeys();
    }, [open]);

    useEffect(() => {
        if (accounts && apiKeys) setIsLoading(false);
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
    if (!open) {
        return <></>;
    }

    return (
        isLoading ?(
            <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-25 z-60">
                    <div className="px-6 py-2 flex flex-row items-center  border border-gray-500 bg-neutral-200 dark:bg-[#202123]">
                    <Loader size="48" />
                    <div className="text-xl">{loadingMessage}</div>
                    </div>
                </div>

        ) :
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 ">
            <div className="fixed inset-0 z-10 overflow-hidden">
                <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                    <div className="hidden sm:inline-block sm:h-screen sm:align-middle"
                        aria-hidden="true"
                    />
                    <div
                        ref={modalRef}
                        className={`dark:border-netural-400 inline-block transform rounded-lg border border-gray-300 bg-neutral-100 px-4 pb-4 text-left align-bottom shadow-xl transition-all dark:bg-[#202123] sm:my-8 sm:min-h-[636px]  sm:w-full sm:p-4 sm:align-middle`}
                        style={{width: `${window.innerWidth - 560}px`, height: `${window.innerHeight * 0.9}px`}}
                        role="dialog">


                        {!isLoading && (

                        <>
                            <div className="mb-4 flex flex-row gap-1 bg-neutral-100 dark:bg-[#202123] rounded-t border-b dark:border-white/20">
                                        <button
                                            key={"Accounts"}
                                            onClick={() => switchTab("Accounts")}
                                            className={`p-2 rounded-t flex flex-shrink-0 ${activeTab === "Accounts" ? 'border-l border-t border-r dark:border-gray-500 dark:text-white' : 'text-gray-400 dark:text-gray-600'}`}>
                                            <h3 className="text-xl">{`Accounts${accountsUnsavedChanges ? " *" : "  "}`}</h3> 
                                        </button>

                                    {featureFlags.apiKeys && 
                                        <button
                                            key={"API"}
                                            onClick={() => switchTab("API")}
                                            className={`p-2 rounded-t flex flex-shrink-0 ${activeTab === "API" ? 'border-l border-t border-r dark:border-gray-500 dark:text-white' : 'text-gray-400 dark:text-gray-600'}`}>
                                            <h3 className="text-xl">{`API Access${apiUnsavedChanges ? " *" : "  "}`}</h3> 
                                        </button>}

                                        <div className='ml-auto'>
                                            <SidebarActionButton
                                                handleClick={() => onClose()}
                                                title={"Close"}>
                                                <IconX size={20}/>
                                            </SidebarActionButton>
                                        </div>      
                            </div>
                        </>           
                        )} 
                            <div className='overflow-y-auto' style={{ maxHeight: 'calc(100% - 60px)'}}>
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
                                        setUnsavedChanged={setApiUnsavedChanges}
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