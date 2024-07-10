import React, { FC, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'next-i18next';
import HomeContext from '@/pages/api/home/home.context';
import Loader from "@/components/Loader/Loader";
import { Account } from "@/types/accounts";
import { Accounts } from './Account';
import { ApiKeys } from './ApiKeys';
import { getAccounts} from "@/services/accountService";
import { fetchAllApiKeys } from '@/services/apiKeysService';
import { ApiKey } from '@/types/apikeys';
import { IconX } from '@tabler/icons-react';
import SidebarActionButton from '@/components/Buttons/SidebarActionButton';

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
    const noCoaAccount: Account = { id: 'general_account', name: 'No COA On File' };
    const [defaultAccount, setDefaultAccount] = useState<Account>(noCoaAccount);
    const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);

 // fetch data
useEffect(() => {
    const fetchAccounts = async () => {
        // const result = await getAccounts();
        // console.log(result.data);
        const result = { success: true,
            data: [
            {
              name: "No COA On File",
              isDefault: true,
              id: "general_account",
            },
            {
              name: "test",
              isDefault: false,
              id: "KarelyTEST",
            },
            {
              name: "mockCOA",
              isDefault: false,
              id: "125.05.12510.6105.000.000.000.RES.0",
            },
          ] as Account[]}

        if (!result.success) {
            alert("Unable to fetch accounts. Please try again.");
            setIsLoading(false);
            onClose();
        } else {
            // Add "No COA" account to the list if not present
            if (!result.data.some((account: any) => account.id === noCoaAccount.id)) {
                result.data.unshift(noCoaAccount);
            }

            setAccounts(result.data);

            const updatedDefaultAccount = result.data.find((account: any) => account.isDefault) || result.data[0];

            if (updatedDefaultAccount) {
                setDefaultAccount(updatedDefaultAccount);
            }

            setIsLoading(false);
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
            // onClose();
        } else {
            setApiKeys(result.data);
            console.log(result.data)
            setIsLoading(false);
        }
    }
   useEffect(() => {
        if (open) fetchApiKeys();
    }, [open]);

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
        onClose();
        window.dispatchEvent(new Event('cleanupApiKeys'));
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
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 ">
            <div className="fixed inset-0 z-10 overflow-hidden">
                <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                    <div className="hidden sm:inline-block sm:h-screen sm:align-middle"
                        aria-hidden="true"
                    />
                    <div
                        ref={modalRef}
                        className={`dark:border-netural-400 inline-block transform rounded-lg border border-gray-300 bg-white px-4 pb-4 text-left align-bottom shadow-xl transition-all dark:bg-[#202123] sm:my-8 sm:min-h-[636px]  sm:w-full sm:p-4 sm:align-middle`}
                        style={{width: `${window.innerWidth - 560}px`, height: `${window.innerHeight - 250}px`}}
                        role="dialog">

                        {isLoading && (
                            <div className="flex flex-col items-center">
                                <Loader size="48" />
                                <div className="text-xl">{loadingMessage}</div>
                            </div>
                        )}

                        {!isLoading && (

                        <>
                            <div className="mb-4 flex flex-row gap-1 bg-neutral-100 dark:bg-[#202123] rounded-t border-b dark:border-white/20">
                                        <button
                                            key={"Accounts"}
                                            onClick={() => switchTab("Accounts")}
                                            className={`p-2 rounded-t flex flex-shrink-0 ${activeTab === "Accounts" ? 'border-l border-t border-r dark:border-gray-500 dark:text-white' : 'text-gray-400 dark:text-gray-600'}`}>
                                            <h3 className="text-xl">Accounts</h3> 
                                        </button>

                                    {featureFlags.apiKeys && 
                                        <button
                                            key={"API"}
                                            onClick={() => switchTab("API")}
                                            className={`p-2 rounded-t flex flex-shrink-0 ${activeTab === "API" ? 'border-l border-t border-r dark:border-gray-500 dark:text-white' : 'text-gray-400 dark:text-gray-600'}`}>
                                            <h3 className="text-xl">API Access</h3> 
                                        </button>}

                                        <div className='ml-auto'>
                                            <SidebarActionButton
                                                handleClick={() => onClose()}
                                                title={"See API key secret"}>
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
                                            onClose={close}
                                            isLoading={isLoading}
                                            setIsLoading={setIsLoading}
                                            setLoadingMessage={setLoadingMessage}
                                            />
                                        }
                            {/* *** Api Keys Tab *** */}
                                        {activeTab === "API" &&
                                        <ApiKeys
                                        apiKeys={apiKeys}
                                        onClose={close}
                                        isLoading={isLoading}
                                        setIsLoading={setIsLoading}
                                        setLoadingMessage={setLoadingMessage}
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