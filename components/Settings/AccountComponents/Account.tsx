import React, { FC, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'next-i18next';
import { IconTrashX, IconPlus, IconCheck, IconX, IconEdit, IconLoader2} from "@tabler/icons-react";
import HomeContext from '@/pages/api/home/home.context';
import { getAccounts, saveAccounts } from "@/services/accountService";
import { Account, noCoaAccount } from "@/types/accounts";
import { RateLimiter } from './RateLimit';
import { formatRateLimit, noRateLimit, PeriodType, RateLimit, rateLimitObj, UNLIMITED } from '@/types/rateLimit';
import ActionButton from '@/components/ReusableComponents/ActionButton';
import toast from 'react-hot-toast';
import { doMtdCostOp } from '@/services/mtdCostService';
import { useSession } from 'next-auth/react';

interface Props {
    accounts: Account[];
    setAccounts: (a: Account[]) => void;
    defaultAccount: Account; 
    setDefaultAccount: (s:Account) => void;
    setUnsavedChanged: (b: boolean) => void;
    isLoading: boolean;
}

interface AccountCostData {
    accountInfo: string;
    dailyCost: number;
    monthlyCost: number;
    totalCost: number;
}

interface UserMtdData {
    email: string;
    dailyCost: number;
    monthlyCost: number;
    totalCost: number;
    accounts: AccountCostData[];
}


export const isValidCOA = (coa: any) => {
    return coa !== null && coa !== undefined;
}

export const Accounts: FC<Props> = ({ accounts, setAccounts, defaultAccount, setDefaultAccount, setUnsavedChanged, isLoading}) => {
    const { state: {}, dispatch: homeDispatch } = useContext(HomeContext);
    const { data: session } = useSession();
    const user = session?.user;

    const { t } = useTranslation('settings');

    const accountIdRef = useRef<HTMLInputElement>(null);
    const accountNameRef = useRef<HTMLInputElement>(null);

    const [accountRateLimitPeriod, setAccountRateLimitPeriod] = useState<PeriodType>(UNLIMITED);
    const [accountRateLimitRate, setAccountRateLimitRate] = useState<string>('');
    
    // helps keep track of cases like added act (unsavechanges) -> delete newly addded act (no unsavedchanges)
    const [addedAccounts, setAddedAccounts ] = useState<string[]>([]);
    const [hasEdits, setHasEdits ] = useState(false);

    const [hoverAccount, setHoverAccount] = useState<number | null>(null);
    // MTD Cost state
    const [mtdCostData, setMtdCostData] = useState<UserMtdData | null>(null);
    const [mtdCostLoading, setMtdCostLoading] = useState(false);

    // Fetch MTD costs for current user
    const fetchMTDCosts = async () => {
        if (!user?.email) return;
        
        setMtdCostLoading(true);
        try {
            const result = await doMtdCostOp(user.email);
            console.log('MTD Costs API Result:', result);
            
            // Handle the response structure similar to UserCostsModal
            let data = result;
            if (result && typeof result === 'object' && 'success' in result) {
                if (!result.success) {
                    console.error('Failed to fetch MTD costs:', result.message);
                    return;
                }
                data = result.data || result;
            }
            
            if (data && (data.accounts || data.email)) {
                setMtdCostData(data);
            }
        } catch (err) {
            console.error('Error fetching MTD costs:', err);
        } finally {
            setMtdCostLoading(false);
        }
    };

    // Format currency helper
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    };

    // Get MTD cost for specific account
    const getAccountMtdCost = (accountId: string) => {
        if (!mtdCostData?.accounts) return null;
        return mtdCostData.accounts.find(acc => acc.accountInfo === accountId);
    };

    // Fetch MTD costs on component mount
    useEffect(() => {
        fetchMTDCosts();
    }, [user?.email]);


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
                "This does not look like a valid COA String. If this is a COA String, please verify it is valid. If this is a poet or project number, click OK to accept.\n\n" 


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
        if (accounts.length === 0) {
            alert("You must have at least one account.");
            return;
        }
        toast("Saving Account changes..."); 

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
        
    }

    useEffect(() => {
        window.addEventListener('settingsSave', handleSave);
        return () => window.removeEventListener('settingsSave', handleSave);
    }, []);

    return <div className='accounts-settings-container'> 
            <div className="accounts-info-banner">
                <div className="accounts-info-content">
                    <h3 className="accounts-info-title flex flex-row items-center gap-3">Account Management 
                        <div className="accounts-info-icon">💳</div>
                    </h3>
                    <p className="accounts-info-description">
                        Add COA strings for billing charges back to specific accounts. 
                        Certain features require at least one COA string. You can edit rate limits and must save your changes to apply them.
                    </p>
                </div>
            </div>

            <div className="settings-card">
                <div className="settings-card-header flex flex-row items-center gap-4">
                    <h3 className="settings-card-title">Add New Account</h3>
                    <p className="settings-card-description">Create a new account with COA string and rate limits</p>
                </div>
                <div className="settings-card-content">
                <div className="accounts-add-form">
                    <div className="accounts-form-row">
                        <div className="accounts-input-group">
                            <label htmlFor="accountNameInput" className="accounts-input-label">Account Name</label>
                            <input
                                ref={accountNameRef}
                                type="text"
                                id="accountNameInput"
                                placeholder="Enter account name"
                                className="accounts-input"
                            />
                        </div>
                        
                        <div className="accounts-input-group">
                            <label htmlFor="coaStringInput" className="accounts-input-label">COA String</label>
                            <input
                                ref={accountIdRef}
                                type="text"
                                id="coaStringInput"
                                placeholder="Enter COA string"
                                className="accounts-input"
                            />
                        </div>
                        
                        <div className="accounts-input-group">
                            <label className="accounts-input-label">Rate Limit</label>
                            <div className="accounts-rate-limit-wrapper">
                                <RateLimiter
                                    period={accountRateLimitPeriod}
                                    setPeriod={setAccountRateLimitPeriod}
                                    rate={accountRateLimitRate}
                                    setRate={setAccountRateLimitRate}
                                />  
                            </div>
                        </div>
                        
                        <div className="accounts-add-button-wrapper">
                            <button
                                type="button"
                                title="Add Account"
                                id="addAccountButton"
                                className="accounts-add-button"
                                onClick={handleAddAccount}
                            >
                                <IconPlus size={20} />
                                <span>Add Account</span>
                            </button>
                        </div>
                    </div>
                </div>
                </div>
            </div>

            {isLoading ? <div className="flex items-center justify-center py-8">
                            <IconLoader2 size={24} className="animate-spin text-gray-500 mr-2" />
                            <span>{"Loading Accounts..."}</span>
                        </div> :
            <>
            <div className="settings-card">
                <div className="settings-card-header flex flex-row items-center gap-4">
                    <h3 className="settings-card-title">Default Account</h3>
                    <p className="settings-card-description">Select which account to use by default for new conversations</p>
                </div>
                <div className="settings-card-content mt-[-10px]">
                    <AccountSelect
                        accounts={accounts}
                        defaultAccount={defaultAccount}
                        setDefaultAccount={(a:Account) => {
                            setHasEdits(true);
                            setDefaultAccount(a);
                        }}
                    />
                </div>
            </div>


            <div className="accounts-list-section">
                <div className="settings-card-header">
                    <h3 className="settings-card-title">Your Accounts</h3>
                    <p className="settings-card-description">Manage your existing accounts and their settings</p>
                </div>

                {accounts.length === 0 ? (
                    <div className="text-center mb-10 text-md italic text-black dark:text-neutral-200">
                        You do not have any accounts set up. Add one above.
                    </div>
                ) : 
                (<div className="accounts-table-wrapper">
                    <div className="accounts-table-container">
                        {[...accounts].map((account, index) => {
                           const accountCost = getAccountMtdCost(account.id);
                           return (<div key={index} className="accounts-table-row" onMouseEnter={() => setHoverAccount(index)} onMouseLeave={() => setHoverAccount(null)}>
                                <div className="accounts-row-content">
                                    <div className="accounts-row-info">
                                        <div className="accounts-row-main">
                                            <div className="accounts-row-name">
                                                <span className="accounts-name-label">Name:</span>
                                                <span className="accounts-name-value">{account.name}</span>
                                                {account.isDefault && <span className="ml-4 accounts-default-badge">Default</span>}
                                            </div>
                                            <div className="accounts-row-id">
                                                <span className="accounts-id-label">Account:</span>
                                                <span className="accounts-id-value">{account.id}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Month to Date Cost */}
                                    <div className="">
                                        {mtdCostLoading ? (
                                            <span className="text-gray-500">Loading...</span>
                                        ) : accountCost ? (
                                            <span className={`font-semibold ${accountCost.monthlyCost > 10 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                                {formatCurrency(accountCost.monthlyCost)}
                                            </span>
                                        ) : (
                                            <span className="text-gray-500">$0.00</span>
                                        )}
                                    </div>
                                    
                                    <div className="accounts-row-actions">
                                        <div className="accounts-rate-limit-section">
                                            <span className="accounts-rate-limit-label">Rate Limit:</span>
                                            <EditableRateLimit 
                                                account={account}
                                                handleAccountEdit={handleEdit}
                                                showEdit={hoverAccount === index}
                                            />
                                        </div>
                                        
                                        <button
                                            type="button"
                                            id="deleteAccount"
                                            disabled={account.id === noCoaAccount.id}
                                            className={`accounts-delete-button ${account.id === noCoaAccount.id ? 'invisible' : 'visible'} ${hoverAccount === index ? 'visible' : 'invisible'}`}
                                            onClick={() => handleDeleteAccount(account.name)}
                                            title="Delete Account"
                                            style={{ transform: 'translateX(-8px)' }}
                                        >
                                            <IconTrashX size={18} />
                                        </button>
                                    </div>
                                </div>
                            </div>)
                        })}
                    </div>
                </div>
                )}
            </div>
            </>}
        </div>
                        
};




interface SelectProps {
    accounts:  Account[];
    defaultAccount: Account;
    setDefaultAccount: (s:Account) => void;
    showId?: boolean
}

export const AccountSelect: FC<SelectProps> = ({accounts, defaultAccount, setDefaultAccount, showId=true}) => {
    const cn = "mb-2 w-full rounded-lg border border-neutral-500 px-4 py-1 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100  custom-shadow";
    return (
        <> 
        {accounts.length > 0 ? 
        <select className={cn}
            id="accountSelect"
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
    showEdit: boolean;
}

//rateLimit, expiration, accessTypes, account
const EditableRateLimit: FC<LabelProps> = ({ account, handleAccountEdit, showEdit}) => {
    const [displayLabel, setDisplayLabel] = useState<string | null>(formatRateLimit(account.rateLimit));
    const [isEditing, setIsEditing] = useState<boolean>(false);
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
            ref={labelRef}
            style={{
                whiteSpace:'nowrap',
                overflowWrap: 'break-word',
                position: 'relative',
                flex: 'shrink-0',
            }}
            className={`overflow-auto mb-2 p-2 flex-1 text-sm rounded flex flex-row `}
            id="accountRateLimitHover"
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
                <div>
                    <ActionButton
                        title='Confirm Change'
                        id="confirmChange"
                        className='text-green-500 p-1'
                        handleClick={(e) => {
                            e.stopPropagation();
                            handleEdit();
                        }}
                    >
                        <IconCheck size={18} />

                    </ActionButton>
                    <ActionButton
                        title='Discard Change'
                        id="discardChange"
                        className='text-red-500 p-1'
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

        {!isEditing && <button
            type="button"
            id="editRate"
            disabled={!showEdit}
            className={`accounts-rate-edit-button ${!showEdit ? 'invisible' : 'visible'}`}
            onClick={() => setIsEditing(true)}
            title="Edit Rate Limit"
            style={{ transform: 'translate(8px, -8px)' }}
        >
            <IconEdit size={18} />
        </button>}
        
        </div>
       
    );
}

