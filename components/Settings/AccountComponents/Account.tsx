import React, { FC, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'next-i18next';
import { IconTrashX, IconPlus} from "@tabler/icons-react";
import HomeContext from '@/pages/api/home/home.context';
import { saveAccounts } from "@/services/accountService";
import { Account } from "@/types/accounts";

interface Props {
    accounts: Account[];
    setAccounts: (a: Account[]) => void;
    defaultAccount: string; 
    setDefaultAccount: (s:string) => void;
    onClose: () => void;
    isLoading: boolean;
    setIsLoading: (e:boolean) => void;
    setLoadingMessage: (s:string) => void;
}

export const Accounts: FC<Props> = ({ accounts, setAccounts, defaultAccount, setDefaultAccount,  onClose, isLoading,  setIsLoading, setLoadingMessage }) => {
    const {  dispatch: homeDispatch } = useContext(HomeContext);

    const { t } = useTranslation('settings');

    const accountIdRef = useRef<HTMLInputElement>(null);
    const accountNameRef = useRef<HTMLInputElement>(null);

    const noCoaAccount: Account = { id: 'general_account', name: 'No COA On File' };

    const validateCOA = (coa:string) => {
        const pattern = /^(\w{3}\.\w{2}\.\w{5}\.\w{4}\.\w{3}\.\w{3}\.\w{3}\.\w{3}\.\w{1})$/;
        const isValid = pattern.test(coa);

        if (!isValid) alert("Invalid COA\n\nPlease ensure you have correctly typed out your COA.");
        return isValid;
        
    }

    const handleAddAccount = () => {
        const newAccountId = accountIdRef.current?.value;
        const newAccountName = accountNameRef.current?.value;
        if (newAccountId && newAccountName && validateCOA(newAccountId)) {
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

    if (isLoading) return <></>

    return <> 
            <div className="mb-4 text-l text-black dark:text-neutral-200">
                    You can add a COA string for billing charges back to a specific account. 
                    Certain features require at least one COA string to be provided.
            </div>


                <ul className="divide-y divide-gray-200 max-h-40 overflow-y-auto overflow-x-hidden mb-2">
                    <li key={"header"} className="flex flex-row items-center">
                        <div className="text-left text-lg  text-black dark:text-neutral-200 ">Add Account</div>
                    </li>
                    <li key={"header2"} className="flex flex-row items-center py-3">
                        <div className="text-left flex-grow"
                            style={{width: '120px'}}>
                            <input
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
                        <div className="flex-shrink-0 ml-auto">
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
                    <div className="text-center mb-2 text-md italic text-black dark:text-neutral-200">
                        You do not have any accounts set up. Add one above.
                    </div>
                )}

                {/* Accounts List */}
                    <ul className="divide-y divide-gray-200 h-[224px] overflow-auto">
                        {accounts.map(account => (
                            <li key={account.id} className="flex flex-row justify-between items-center py-3">
                                <div className="ml-1 w-[120px]">{account.name}</div>
                                <div className="w-65 truncate">{account.id}</div>
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
                

                <div className="mb-2 text-lg text-black dark:text-neutral-200 border-b-2">
                    Default Account
                </div>
                <select
                    className="mb-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
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

                <div className="flex flex-row my-2">
                    {/* Save Button */}
                    <button
                        type="button"
                        className="mr-2 w-full px-4 py-2 border rounded-lg shadow border-neutral-500 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-300"
                        onClick={onClose}
                    >
                        {t('Cancel')}
                    </button>
                    <button
                        type="button"
                        className="w-full px-4 py-2 border rounded-lg shadow border-neutral-500 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-300"
                        onClick={handleSaveSettings}
                    >
                        {t('Save')}
                    </button>
                </div>

            </>
              


                        
};