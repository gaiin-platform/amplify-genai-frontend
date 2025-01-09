import React, { FC, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'next-i18next';
import { IconTrashX, IconPlus, IconCheck, IconX, IconEdit} from "@tabler/icons-react";
import HomeContext from '@/pages/api/home/home.context';
import { saveAccounts } from "@/services/accountService";
import { Account, noCoaAccount } from "@/types/accounts";
import { RateLimiter } from './RateLimit';
import { formatRateLimit, PeriodType, RateLimit, rateLimitObj, UNLIMITED } from '@/types/rateLimit';
import ActionButton from '@/components/ReusableComponents/ActionButton';
import toast from 'react-hot-toast';


interface Props {
    accounts: Account[];
    setAccounts: (a: Account[]) => void;
    defaultAccount: Account; 
    setDefaultAccount: (s:Account) => void;
    setUnsavedChanged: (b: boolean) => void;
    onClose: () => void;
}

export const isValidCOA = (coa:any) => {
    if (!coa) return false;    
    const pattern = /^(\w{3}\.\w{2}\.\w{5}\.\w{4}\.\w{3}\.\w{3}\.\w{3}\.\w{3}\.\w{1})$/;
    return pattern.test(coa);
}

export const Accounts: FC<Props> = ({ accounts, setAccounts, defaultAccount, setDefaultAccount, setUnsavedChanged, onClose}) => {
    const {  dispatch: homeDispatch } = useContext(HomeContext);

    const { t } = useTranslation('settings');

    const accountIdRef = useRef<HTMLInputElement>(null);
    const accountNameRef = useRef<HTMLInputElement>(null);

    const [accountRateLimitPeriod, setAccountRateLimitPeriod] = useState<PeriodType>(UNLIMITED);
    const [accountRateLimitRate, setAccountRateLimitRate] = useState<string>('');

    const [isSaving, setIsSaving ] = useState(false);
    
    // helps keep track of cases like added act (unsavechanges) -> delete newly addded act (no unsavedchanges)
    const [addedAccounts, setAddedAccounts ] = useState<string[]>([]);
    const [hasEdits, setHasEdits ] = useState(false);


    const handleAddAccount = () => {
        const newAccountId = accountIdRef.current?.value;
        const newAccountName = accountNameRef.current?.value;
        if (newAccountId && newAccountName && validateCOA(newAccountId)) {
            if (accounts.find((a:Account) => a.name === newAccountName)) {
                alert("Account name must be unique.\n\nPlease rename the current account you are trying to add.");
                return 
            }
            const updatedAccounts = [...accounts, { id: newAccountId, name: newAccountName, rateLimit: rateLimitObj(accountRateLimitPeriod, accountRateLimitRate)}];
            setAccounts(updatedAccounts);
            setAddedAccounts([...addedAccounts, newAccountName]);

            // Clear input fields after adding an account
            if (accountIdRef.current) accountIdRef.current.value = '';
            if (accountNameRef.current) accountNameRef.current.value = '';
            setAccountRateLimitPeriod(UNLIMITED);
            setAccountRateLimitRate('');
        } 
    };

    const validateCOA = (coa: string) => {
        const isValid = isValidCOA(coa);
        if (!isValid) {
            const message = "Invalid COA\n\n" +
                "This does not look like a valid COA String. If this is a COA String, please verify it is valid. If this is a poet or project number, click OK to accept.\n\n" +
                "Example Valid COA String: 125.05.12510.6105.000.000.000.RES.0\n\n" +
                "Click OK to accept this COA, or Cancel to reject it.\n\n" + 
                "Visit https://finance.vanderbilt.edu/accounting/documents/Chart_of_Accounts.pdf for more information on COAs.";

            const userChoice = confirm(message);

            return userChoice;
        }
        return true;
    }

    useEffect(() => {
        setUnsavedChanged(!(addedAccounts.length === 0 && !hasEdits));
    }, [addedAccounts, hasEdits]);

    const handleDeleteAccount = (accountToDelete: string) => {
        // Prevent deletion of "No COA" account
        if (accountToDelete === noCoaAccount.id) {
            alert('The "No COA" account cannot be deleted.');
            return;
        }
        if (addedAccounts.includes(accountToDelete)) {
            setAddedAccounts(addedAccounts.filter((name:string) => name !== accountToDelete));
        } else {
            // old acct is deleted
            setHasEdits(true);
        }
        const updatedAccounts = accounts.filter(account => account.name !== accountToDelete);
        setAccounts(updatedAccounts);

    };
    const handleEdit = (accountName: string, rateLimit: RateLimit) => {
        setHasEdits(true);
        setAccounts(accounts.map((a: Account) => {
            if (a.name === accountName) return {...a, rateLimit: rateLimit}
            return a;
        }));
    }

    const handleSave = async () => {
        // console.log("accts saved: ", accounts)

        if (accounts.length === 0) {
            alert("You must have at least one account.");
            return;
        }
        setIsSaving(true);

        let updatedAccounts = accounts.map(account => {
            return { ...account, isDefault: account.name === defaultAccount.name };
        });

        let updatedDefaultAccount = updatedAccounts.find((account: any) => account.isDefault);

        const result = await saveAccounts(updatedAccounts);

        if (!result.success) {
            alert("Unable to save accounts. Please try again.");
        } else {
            homeDispatch({ field: 'defaultAccount', value: updatedDefaultAccount || accounts[0] });
            setUnsavedChanged(false);
            setHasEdits(false);
            setAddedAccounts([]);
            toast("Account changes saved.");
        }
        setIsSaving(false);
        
    };


    return <div className='flex flex-col h-full'> 
            <div className="mb-4 text-l text-black dark:text-neutral-200 px-2">
                    You can add a COA string for billing charges back to a specific account. 
                    Certain features require at least one COA string to be provided. You can always edit the Rate Limit set for an account. Always remember to confirm and save your changes. 
            </div>

                <ul className="divide-y divide-gray-200 max-h-40 overflow-y-auto overflow-x-hidden mb-2">
                    <li key={"header"} className="flex flex-row items-center">
                        <div className="text-left text-lg  text-black dark:text-neutral-200 ">Add Account</div>
                    </li>
                    <li key={"header2"} className="flex flex-row py-3">
                        <div className="flex-shrink-0 ml-[-6px] mr-2">
                            <button
                                type="button"
                                title='Add Account'
                                className="ml-2 mt-2.5 px-3 py-1.5 text-white rounded bg-neutral-500 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-500"
                                onClick={handleAddAccount}
                            >
                                <IconPlus size={18} />
                            </button>
                        </div>
                        <div className="text-left flex-grow py-2 mt-1"
                            style={{width: '120px'}}>
                            <input
                            ref={accountNameRef}
                            type="text"
                            placeholder={'Account name'}
                            className="rounded border-gray-300 p-1 text-neutral-900 shadow-sm focus:border-neutral-500 w-full"

                        /></div>
                        <div className="text-left ml-2 flex-grow min-w-0 py-2 mt-1">
                            <input
                                ref={accountIdRef}
                                type="text"
                                placeholder={'COA String'}
                                className="rounded border-gray-300 p-1 text-neutral-900 shadow-sm focus:border-neutral-500 focus:ring focus:ring-neutral-500 focus:ring-opacity-50 w-full"

                            />
                        </div>
                        
                        <div className='relative ml-2 flex flex-col gap-1 mt-[-14px]' style={{ height: '68px', whiteSpace: 'nowrap', overflowWrap: 'break-word'}}>
                            <label className="text-sm mt-1" htmlFor="rateLimitType">Rate Limit</label>
                                <RateLimiter
                                period={accountRateLimitPeriod}
                                setPeriod= {setAccountRateLimitPeriod}
                                rate={accountRateLimitRate}
                                setRate={setAccountRateLimitRate}
                                />  
                        </div>
                        
                    </li>
                </ul>

                <div className="mb-2 text-lg text-black dark:text-neutral-200 border-b">
                    Default Account
                </div>
                <AccountSelect
                    accounts={accounts}
                    defaultAccount={defaultAccount}
                    setDefaultAccount={(a:Account) => {
                        setHasEdits(true);
                        setDefaultAccount(a);
                    }}
                />


                <div className="mt-6 text-lg text-black dark:text-neutral-200 border-b-2">
                    Your Accounts
                </div>

                {accounts.length === 0 ? (
                    <div className="text-center mb-10 text-md italic text-black dark:text-neutral-200">
                        You do not have any accounts set up. Add one above.
                    </div>
                ) : 
                (
                    <table className='mt-[-1px] w-full text-md text-black dark:text-neutral-200'>
                                    <thead>
                                        <tr className="bg-gray-200 dark:bg-[#333]">
                                        { ["Name", "Account", "Rate Limit"]
                                        .map((i) => (
                                            <th key={i} className="p-0.5 border border-gray-400 text-neutral-600 dark:text-neutral-300">
                                                {i}
                                            </th>
                                            ))}
                                        </tr>
                                    </thead>
                                <tbody>
                                    {[...accounts].map((account, index) => (
                                        <tr key={index} >
                                            <td className='w-full'> {account.name}</td>
                                            <td className='w-full pr-20'> 
                                                {account.id}
                                            </td>
                                            <td>
                                                <div className='flex justify-between items-center p-3 w-[320px]'>
                                                    <EditableRateLimit 
                                                    account={account}
                                                    handleAccountEdit={handleEdit}
                                                    />
                                                        <button
                                                            type="button"
                                                            className={`ml-auto mt-[-4px] px-2 py-1.5 text-sm bg-neutral-500 text-white rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 ${account.id === noCoaAccount.id ? 'invisible' : 'visible'}`}
                                                            onClick={() => handleDeleteAccount(account.name)}
                                                        >
                                                            <IconTrashX size={18} />
                                                        </button>
                                                </div>
                                              
                                            </td>
                                            
                                        </tr>
                                    ))}
                                </tbody>
                            </table>)
                    }
                
                <br className='mb-20'></br>
                
                <div className="flex flex-row my-2 w-full fixed bottom-0 left-0 px-4 py-2">
                    {/* Save Button */}
                    <button
                        type="button"
                        className="mr-2 w-full px-4 py-2 border rounded-lg shadow border-neutral-500 text-neutral-900 bg-neutral-100 hover:bg-neutral-200 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-300"
                        onClick={onClose}
                    >
                        {t('Cancel')}
                    </button>
                    <button
                        type="button"
                        className="w-full px-4 py-2 border rounded-lg shadow border-neutral-500 text-neutral-900 bg-neutral-100 hover:bg-neutral-200 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-300"
                        onClick={handleSave}
                    >
                        {isSaving ? 'Saving Changes...' :'Save Changes'}
                    </button>
                </div>

            </div>
                        
};




interface SelectProps {
    accounts:  Account[];
    defaultAccount: Account;
    setDefaultAccount: (s:Account) => void;
    showId?: boolean
}

export const AccountSelect: FC<SelectProps> = ({accounts, defaultAccount, setDefaultAccount, showId=true}) => {
    const cn = "mb-2 w-full rounded-lg border border-neutral-500 px-4 py-1 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100  shadow-[0_2px_4px_rgba(0,0,0,0.1)] dark:shadow-[0_2px_4px_rgba(0,0,0,0.3)]";
    return (
        <> 
        {accounts.length > 0 ? 
        <select className={cn}
            value={defaultAccount.name}
            onChange={(event) => {
                const selectedAccount = accounts.find(acc => acc.name === event.target.value);
                if (selectedAccount) {
                    setDefaultAccount(selectedAccount);
                }
            }}
        > 
            {accounts.map((account) => (
                <option key={account.name} value={account.name}>
                    {`${account.name}${showId ? ` - ${account.id}`:""}`}
                </option>
            ))}
        </select>

        :
            <div className={cn}>YOU HAVE NO VALID ACCOUNTS TO LIST</div>
        }
        
        </>
    );
}




interface LabelProps {
    account: Account;
    handleAccountEdit: (name: string, rateLimit: RateLimit) => void;
}

//rateLimit, expiration, accessTypes, account
const EditableRateLimit: FC<LabelProps> = ({ account, handleAccountEdit}) => {
    const [displayLabel, setDisplayLabel] = useState<string | null>(formatRateLimit(account.rateLimit));
    const [isEditing, setIsEditing] = useState<boolean>(false);
    const [isHovered, setIsHovered,] = useState(false);
    const labelRef = useRef<HTMLDivElement>(null);

    const [rateLimitPeriod, setRateLimitPeriod] = useState<PeriodType>(account.rateLimit.period);
    const [rateLimitRate, setRateLimitRate] = useState<string>(account.rateLimit.rate ? String(account.rateLimit.rate) : '0');


    const handleEdit = () => {
        const updatedRateLimit = rateLimitObj(rateLimitPeriod, rateLimitRate);
        handleAccountEdit(account.name, updatedRateLimit);
        setDisplayLabel(formatRateLimit(updatedRateLimit));
        setIsEditing(false);
    }

    return (
        <div
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            ref={labelRef}
            style={{
                whiteSpace:'nowrap',
                overflowWrap: 'break-word',
                position: 'relative',
                flex: 'shrink-0',
            }}
            className={`overflow-auto mb-2 p-2 flex-1 text-sm rounded flex flex-row `}
        >
        {!isEditing && <> {displayLabel}</>}

        {isEditing && (
            (
                <div className="flex flex-row gap-2 relative z-40"  >
                 <RateLimiter
                    period={rateLimitPeriod as PeriodType}
                    setPeriod={setRateLimitPeriod}
                    rate={rateLimitRate}
                    setRate={setRateLimitRate}
                />
                <div className='bg-neutral-200 dark:bg-[#343541]/90 rounded'>
                    <ActionButton
                        title='Confirm Change'
                        handleClick={(e) => {
                            e.stopPropagation();
                            handleEdit();
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
                </div>
              )

        )}

        { isHovered  && !isEditing && (
            <div
            className="absolute top-1 right-0 mr-6 z-10 flex-shrink-0 bg-neutral-200 dark:bg-[#343541]/90 rounded"> 
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
