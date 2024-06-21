import React, { FC, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'next-i18next';
import { IconTrashX, IconPlus, IconInfoCircle } from "@tabler/icons-react";
import HomeContext from '@/pages/api/home/home.context';
import { getAccounts, saveAccounts } from "@/services/accountService";
import Loader from "@/components/Loader/Loader";
import { Account } from "@/types/accounts";

interface Props {
    open: boolean;
    onClose: () => void;
}

export const AccountDialog: FC<Props> = ({ open, onClose }) => {
    const { state: {featureFlags}, dispatch: homeDispatch } = useContext(HomeContext);

    const { t } = useTranslation('settings');
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [apiKeys, setApiKeys] = useState<[]>([]);
    const [defaultAccount, setDefaultAccount] = useState<string>('');
    const accountIdRef = useRef<HTMLInputElement>(null);
    const accountNameRef = useRef<HTMLInputElement>(null);
    
    const modalRef = useRef<HTMLDivElement>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [loadingMessage, setLoadingMessage] = useState<string>('Loading...');
    const noCoaAccount: Account = { id: 'general_account', name: 'No COA On File' };
    const [activeTab, setActiveTab] = useState<string>('Accounts');

    useEffect(() => {
        const fetchAccounts = async () => {
            const result = await getAccounts();

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
                    setDefaultAccount(updatedDefaultAccount.id);
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


    const handleAddAccount = () => {
        const newAccountId = accountIdRef.current?.value;
        const newAccountName = accountNameRef.current?.value;
        if (newAccountId && newAccountName) {
            const updatedAccounts = [...accounts, { id: newAccountId, name: newAccountName }];
            setAccounts(updatedAccounts);

            // Clear input fields after adding an account
            if (accountIdRef.current) accountIdRef.current.value = '';
            if (accountNameRef.current) accountNameRef.current.value = '';
        }
    };

    const handleDeleteAccount = (accountToDelete: string) => {
        // Prevent deletion of "No COA" account
        if (accountToDelete === noCoaAccount.id) {
            alert('The "No COA" account cannot be deleted.');
            return;
        }

        const updatedAccounts = accounts.filter(account => account.id !== accountToDelete);
        setAccounts(updatedAccounts);
    };

    const handleSaveSettings = () => {
        handleSave();
        //onClose();
    };

    const handleSave = async () => {

        if (accounts.length === 0) {
            alert("You must have at least one account.");
            return;
        }

        setLoadingMessage('Saving...');
        setIsLoading(true);

        let updatedAccounts = accounts.map(account => {
            return { ...account, isDefault: account.id === defaultAccount };
        });

        let updatedDefaultAccount = updatedAccounts.find((account: any) => account.isDefault);

        const result = await saveAccounts(updatedAccounts);

        if (!result.success) {
            alert("Unable to save accounts. Please try again.");
            setIsLoading(false);
        } else {
            homeDispatch({ field: 'defaultAccount', value: updatedDefaultAccount || accounts[0] });
            setIsLoading(false);
            onClose();
        }
    };

    // Render nothing if the dialog is not open.
    if (!open) {
        return <></>;
    }


    return (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 ">
            <div className="fixed inset-0 z-10 overflow-hidden">
                <div
                    className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                    <div
                        className="hidden sm:inline-block sm:h-screen sm:align-middle"
                        aria-hidden="true"
                    />
                    <div
                        ref={modalRef}
                        className={`dark:border-netural-400 inline-block transform overflow-y-auto rounded-lg border border-gray-300 bg-white px-4 pb-4 text-left align-bottom shadow-xl transition-all dark:bg-[#202123] sm:my-8 sm:max-h-[600px]] sm:w-full sm:max-w-lg sm:p-4 sm:align-middle`}
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
                                                onClick={() => setActiveTab("Accounts")}
                                                className={`p-2 rounded-t flex flex-shrink-0 ${activeTab === "Accounts" ? 'border-l border-t border-r dark:border-gray-500 dark:text-white' : 'text-gray-400 dark:text-gray-600'}`}>
                                                <h3 className="text-xl">Accounts</h3> 
                                            </button>
                                            {featureFlags.apiKeys && <button
                                                key={"API"}
                                                onClick={() => setActiveTab("API")}
                                                className={`p-2 rounded-t flex flex-shrink-0 ${activeTab === "API" ? 'border-l border-t border-r dark:border-gray-500 dark:text-white' : 'text-gray-400 dark:text-gray-600'}`}>
                                                <h3 className="text-xl">API Access</h3> 
                                            </button>}
                                </div>
                                


                            {activeTab === "Accounts" &&
                                (<> <div className="mb-4 text-l text-black dark:text-neutral-200">
                                        You can add a COA string for billing charges back to a specific account. Certain
                                        features require at least one COA string to be provided.
                                    </div>


                                    <ul className="divide-y divide-gray-200 max-h-40 overflow-y-auto overflow-x-hidden mb-2">
                                        <li key={"header"} className="flex flex-row items-center">
                                            <div className="text-left text-lg  text-black dark:text-neutral-200 ">Add Account</div>
                                        </li>
                                        <li key={"header2"} className="flex flex-row items-center py-3">
                                            <div className="text-left flex-grow min-w-0"><input
                                                ref={accountNameRef}
                                                type="text"
                                                placeholder={'Account name'}
                                                className="rounded border-gray-300 p-1 text-neutral-900 shadow-sm focus:border-neutral-500 w-full"

                                            /></div>
                                            <div className="text-left ml-2 flex-grow min-w-0">
                                                <input
                                                    ref={accountIdRef}
                                                    type="text"
                                                    placeholder={'COA String'}
                                                    className="rounded border-gray-300 p-1 text-neutral-900 shadow-sm focus:border-neutral-500 focus:ring focus:ring-neutral-500 focus:ring-opacity-50 w-full"

                                                />
                                            </div>
                                            <div className="flex-shrink-0 ml-2">
                                                <button
                                                    type="button"
                                                    title='Add Account'
                                                    className="ml-2 px-3 py-1.5 text-white rounded bg-neutral-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-500"
                                                    onClick={handleAddAccount}
                                                >
                                                    <IconPlus size={18} />
                                                </button>
                                            </div>
                                        </li>
                                    </ul>


                                    <div className=" text-lg text-black dark:text-neutral-200 border-b-2">
                                        Your Accounts
                                    </div>

                                    {accounts.length === 0 && (
                                        <div className="ml-14 mb-2 text-md italic text-black dark:text-neutral-200">
                                            You do not have any accounts set up. Add one above.
                                        </div>
                                    )}
                                    {/* Accounts List */}
                                        <ul className="divide-y divide-gray-200 h-[130px] overflow-auto">
                                            {accounts.map(account => (
                                                <li key={account.id} className="flex flex-row justify-between items-center py-3">
                                                    <div className="w-40">{account.name}</div>
                                                    <div className="w-40 truncate">{account.id}</div>
                                                    <div className="ml-6 mr-2">
                                                        {account.id !== noCoaAccount.id ? (
                                                            <button
                                                                type="button"
                                                                className="px-2 py-1.5 text-sm bg-neutral-600 text-white rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                                                onClick={() => handleDeleteAccount(account.id)}
                                                            >
                                                                <IconTrashX size={18} />
                                                            </button>
                                                        ) : (
                                                            <div className="px-2 py-1.5 text-sm opacity-0" aria-hidden="true"> {/* Invisible spacer */}
                                                                <IconTrashX size={18} />
                                                            </div>
                                                        )}
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    

                                    <div className="mb-4 text-lg text-black dark:text-neutral-200 border-b-2">
                                        Default Account
                                    </div>
                                    <select
                                        className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                        value={defaultAccount}
                                        onChange={(event) => {
                                            setDefaultAccount(event.target.value);
                                        }}
                                    >
                                        {accounts.map(account => (
                                            <option key={account.id} value={account.id}>{account.name}
                                            </option>
                                        ))}
                                    </select>

                                    <div className="flex flex-row">
                                        {/* Save Button */}
                                        <button
                                            type="button"
                                            className="mr-2 w-full px-4 py-2 mt-4 border rounded-lg shadow border-neutral-500 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-300"
                                            onClick={onClose}
                                        >
                                            {t('Cancel')}
                                        </button>
                                        <button
                                            type="button"
                                            className="w-full px-4 py-2 mt-4 border rounded-lg shadow border-neutral-500 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-300"
                                            onClick={handleSaveSettings}
                                        >
                                            {t('Save')}
                                        </button>
                                    </div>

                                </>) }

                            {activeTab === "API" &&
                                (<> 
                                <div className="mb-4 text-l text-black dark:text-neutral-200">
                                    You can create Api keys for yourself and others. 
                                    <div className="m-2 mt-4 flex items-center p-2 border border-gray-400 dark:border-gray-500 rounded ">
                                        <IconInfoCircle size={16} className='ml-1 mb-1 flex-shrink-0 text-gray-600 dark:text-gray-400' />
                                        <span className="ml-2 text-xs text-gray-600 dark:text-gray-400"> 
                                            {"Your delegates must have an active account with Amplify."}
                                            <br className='mb-1'></br>
                                            {"If your key has been compromised, deactivate it as soon as possible."}
                                        </span>
                                    </div>

                                </div>

                                <li key={"header"} className="flex flex-row items-center">
                                    <div className="text-left text-lg  text-black dark:text-neutral-200 ">Create API Keys</div>
                                </li>

                                <li key={"header2"} className="flex flex-row items-center py-3">
                                        <div className="text-left flex-grow min-w-0"><input
                                            ref={accountNameRef}
                                            type="text"
                                            placeholder={'Application'}
                                            className="rounded border-gray-300 p-1 text-neutral-900 shadow-sm focus:border-neutral-500 w-full"

                                        /></div>
                                        <div className="text-left ml-2 flex-grow min-w-0">
                                            <input
                                                ref={accountIdRef}
                                                type="text"
                                                placeholder={'Delegates'}
                                                className="rounded border-gray-300 p-1 text-neutral-900 shadow-sm focus:border-neutral-500 focus:ring focus:ring-neutral-500 focus:ring-opacity-50 w-full"

                                            />
                                        </div>
                                        <div className="flex-shrink-0 ml-2">
                                            <button
                                                type="button"
                                                title="Create Key"
                                                className="ml-2 px-3 py-1.5 text-white rounded bg-neutral-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-500"
                                                onClick={()=>{}}
                                            >
                                                <IconPlus size={18} />
                                            </button>
                                        </div>
                                </li>

                                <div className=" text-lg text-black dark:text-neutral-200 border-b">
                                        Your API Keys
                                </div>

                                {apiKeys.length === 0 && (
                                        <div className="ml-14 mb-2 text-md italic text-black dark:text-neutral-200">
                                            You do not have any API keys set up. Add one above.
                                        </div>
                                    )}
                                        <ul className="divide-y divide-gray-200 h-[130px] overflow-auto">
                                            {apiKeys.map(apiKey => (
                                                <li key={"id"} className="flex flex-row justify-between items-center py-3">
                                                    <div className="w-40">{"name"}</div>
                                                    <div className="w-40 truncate">{"id"}</div>
                                                    <div className="ml-6 mr-2">
                                                        {"id" !== noCoaAccount.id ? (
                                                            <button
                                                                type="button"
                                                                className="px-2 py-1.5 text-sm bg-neutral-600 text-white rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                                                onClick={() => handleDeleteAccount("id")}
                                                            >
                                                                <IconTrashX size={18} />
                                                            </button>
                                                        ) : (
                                                            <div className="px-2 py-1.5 text-sm opacity-0" aria-hidden="true"> {/* Invisible spacer */}
                                                                <IconTrashX size={18} />
                                                            </div>
                                                        )}
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                
                                <div className="flex flex-row">
                                        <button
                                            type="button"
                                            className="mr-2 w-full px-4 py-2 mt-4 border rounded-lg shadow border-neutral-500 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-300"
                                            onClick={onClose}
                                        >
                                            {t('Cancel')}
                                        </button>
                                        <button
                                            type="button"
                                            className="w-full px-4 py-2 mt-4 border rounded-lg shadow border-neutral-500 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-300"
                                            onClick={()=>{}}
                                        >
                                            {t('Save')}
                                        </button>
                                    </div>


                                </>)}

                        </>
                        )}
                    </div>

                </div>

            </div>
        </div>
    );
};