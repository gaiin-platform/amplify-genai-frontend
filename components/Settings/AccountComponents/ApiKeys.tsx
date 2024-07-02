import React, { FC, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'next-i18next';
import { IconTrashX, IconPlus, IconInfoCircle, IconEye, IconCopy, IconCheck, IconX, IconUser, IconEdit } from "@tabler/icons-react";
import HomeContext from '@/pages/api/home/home.context';
import ExpansionComponent from '../../Chat/ExpansionComponent';
import { EmailsAutoComplete } from '@/components/Emails/EmailsAutoComplete';
import { fetchEmailSuggestions } from '@/services/emailAutocompleteService';
import { Account } from '@/types/accounts';
import { createApiKey, fetchApiKey, separateOwnerDelegateApiKeys } from '@/services/apiKeysService';
import { ApiKey, ApiRateLimit } from '@/types/apikeys';
import { useSession } from 'next-auth/react';
import {styled, keyframes} from "styled-components";
import {FiCommand} from "react-icons/fi";
import SidebarActionButton from '@/components/Buttons/SidebarActionButton';
import { userFriendlyDate } from '@/utils/app/date';

interface Props {
    apiKeys: ApiKey[];
    onClose: () => void;
    isLoading: boolean;
    setIsLoading: (e:boolean) => void;
    setLoadingMessage: (s:string) => void;
    accounts: Account[];
    defaultAccount: string;
}


const animate = keyframes`
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(720deg);
  }
`;

const LoadingIcon = styled(FiCommand)`
  color: lightgray;
  font-size: 1rem;
  animation: ${animate} 2s infinite;
`;

export const ApiKeys: FC<Props> = ({ apiKeys, onClose, isLoading, setIsLoading, setLoadingMessage, accounts, defaultAccount}) => {
    const { state: {featureFlags}, dispatch: homeDispatch } = useContext(HomeContext);

    const { data: session } = useSession();
    const user = session?.user;


    const { t } = useTranslation('settings');
   
    const [ownerApiKeys, setOwnerApiKeys] = useState<ApiKey[] | null>(null);
    const [delegateApiKeys, setDelegateApiKeys] = useState<ApiKey[] | null>(null);

    const [isCreating, setIsCreating] = useState<boolean>(false);

    const [appName, setAppName] = useState<string>("");
    const [appDescription, setAppDescriptione] = useState<string>("");
    const [delegateInput, setDelegateInput] = useState<string>('');
    const [allEmails, setAllEmails] = useState<Array<string> | null>(null);
    const [rateLimitType, setRateLimitType] = useState<string>('Unlimited');
    const [costAmount, setCostAmount] = useState<string>('');
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [includeExpiration, setIncludeExpiration] = useState<boolean>(false);
    const [systemUse, setSystemUse] = useState<boolean>(false);
    const [selectedAccount, setSelectedAccount] = useState<string>(defaultAccount);
    const today = new Date().toISOString().split('T')[0];

    const [fullAccess, setFullAccess] = useState<boolean>(true);

    
    const [options, setOptions] = useState<Record<string, boolean>>({
            assistants: true,
            chat: true,
            file_Upload: true, // _ will be turned into a ' ' for displaying purposes
            share: true
        });


    useEffect(() => {
        const fetchEmails = async () => {
            const emailSuggestions = await fetchEmailSuggestions("*");
            setAllEmails(emailSuggestions.emails ? emailSuggestions.emails.filter((e: string) => e !== user) : []);
        };
        if (!allEmails) fetchEmails();
    }, []);

    useEffect(() => {
        if (systemUse) setSystemUse(false);

    }, [delegateInput]);

    useEffect(() => {
       const lists = separateOwnerDelegateApiKeys(apiKeys)
       setDelegateApiKeys(lists.delegated);
       setOwnerApiKeys(lists.owner);

    }, [apiKeys]);


    const handleCreateApiKey = async () => {
        setIsCreating(true);
        
        const data = {
            'owner' : user,
            'account' : selectedAccount,
            'delegate': delegateInput.length > 0 ? delegateInput : null,
            'appName' : appName,
            'appDescription' : appDescription,
            'rateLimit' : {'period' : rateLimitType, 'rate': ( rateLimitType === 'Unlimited' ? null : parseFloat(costAmount.replace('$', '')))},
            'expiration' : includeExpiration ? selectedDate : null,
            'accessTypes': [fullAccess ? "Full Access" :  Object.keys(options).filter((key) => options[key]) ],
            'systemUse' : systemUse && delegateInput.length === 0
        }
        const result = await createApiKey(data)
        setIsCreating(false);

        alert(result ? "Successfuly created the API key" : "Unable to create the API key at this time. Please try again later...")
        // empty out all the create key fields
        if (result) {
            setAppName('');
            setAppDescriptione('');
            setDelegateInput('');
            setRateLimitType('Unlimited');
            setIncludeExpiration(false);
            setSystemUse(false);
        }
        
        
    };

    const handleDeactivateApikey = (accountToDelete: string) => {
    
        // // Prevent deletion of "No COA" account
        // if (accountToDelete === noCoaAccount.id) {
        //     alert('The "No COA" account cannot be deleted.');
        //     return;
        // }

        // const updatedAccounts = accounts.filter(account => account.id !== accountToDelete);
        // setAccounts(updatedAccounts);
    };

    const handleApplyEdits = () => {
        handleSave();
        onClose();
    };

    const handleSave = async () => {
    };

    const formatDollar = (value: string) => {
        if (value.length > 8)return costAmount;
        const numericValue = value.replace(/[^\d]/g, '');
        const integerValue = parseInt(numericValue, 10);
        if (isNaN(integerValue)) {
            return '$0.00';
        }
        const dollars = Math.floor(integerValue / 100);
        const cents = integerValue % 100;
        return `$${dollars}.${cents.toString().padStart(2, '0')}`;
    };

    const calcCostWidth = () => {
        return Math.max(44 + ((costAmount.length - 5) * 9), 44);
    }


    const formatLimits = (limits: ApiRateLimit) =>  {
        //@ts-ignore
        return `$${limits.rate}${limits.rate.toString().includes('.') ? '' : '.00'}/${limits.period}`
    }

    useEffect(() => {
        const allSelected = Object.keys(options).every(key => options[key]);
        if (allSelected) setFullAccess(allSelected);
    }, [options]);

    if (isLoading) return <></>


    return (
        <>
         <div className='flex flex-col gap-4 mx-2 overflow-y-auto h-[400px]'> 
            <div className="text-l text-black dark:text-neutral-200">
                You can create Api keys for yourself and others. 
                <div className="mx-5 mt-4 flex items-center p-2 border border-gray-400 dark:border-gray-500 rounded ">
                    <IconInfoCircle size={16} className='mx-2 mb-1 flex-shrink-0 text-gray-600 dark:text-gray-400' />
                    <span className="ml-2 text-xs text-gray-600 dark:text-gray-400"> 
                        <div className='font-bold mb-2 ml-5'> {"Types of API Keys"}</div>
                        {/* <br className='mb-1'></br> */}
                        <div className='mt-1 flex flex-row gap-2'>          
                            <IconUser className='flex-shrink-0' style={{ strokeWidth: 2.5}} size={16}/>
                            Personal Use
                            <br className='mb-1'></br>
                            A Personal API Key allows you to interact directly with your Amplify account. This key acts on your behalf, granting access to all the data and permissions associated with your account. Use this key when you need to perform tasks or retrieve information as yourself within the Amplify environment.
                        </div>
                        <div className='mt-1 flex flex-row gap-2'> 
                            <IconUser className='flex-shrink-0 text-green-600' style={{ strokeWidth: 2.5 }} size={16}/>
                            System Use
                            <br className='mb-1'></br>
                            A System API Key operates independently of any individual user account. It comes with its own set of permissions and behaves as though it is a completely separate account. This type of key is ideal for automated processes or applications that need their own dedicated permissions and do not require access linked to any specific user.
                        </div>
                        <div className='mt-1 flex flex-row gap-2'> 
                            <IconUser className='flex-shrink-0 text-blue-600' style={{ strokeWidth: 2.5 }} size={16}/>
                            Delegate Use
                            <br className='mb-1'></br>
                            A Delegate API Key is like a personal key for another Amplify user, but with your account being responsible for the associated payments. This type of key is useful when you want to grant someone else access or certain capabilities within their own Amplify account while ensuring that the billing responsibility falls on your account.
                        </div>
                        <br className='mb-1'></br>
                        <div className='text-center'> {"*** If your key has been compromised, deactivate it as soon as possible. ***"} </div>
                        
                    </span>
                </div>

            </div>
            <div className='border p-2 border-gray-400 dark:border-gray-700 rounded' >
                <ExpansionComponent 
                    title={'Create API Key'} 
                    content={
                        <div className='flex flex-col gap-2 '>
                                                 <>
                        {isCreating && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-25">
                                <div className="p-3 flex flex-row items-center  border border-gray-500 dark:bg-[#202123]">
                                    <LoadingIcon style={{ width: "24px", height: "24px" }}/>
                                    <span className="text-lg font-bold ml-2 text-white">Creating API Key...</span>
                                </div>
                            </div>
                        )}
                        </>

                            <div className='flex flex-col gap-2 w-full'>

                                   <div className='flex flex-row'>
                                        <div className='flex flex-col w-[300px] pb-1'>
                                            <div className="text-sm text-black dark:text-neutral-200">
                                                {t('Application Name')}
                                            </div>

                                            <textarea
                                                className= "mt-2 rounded-md border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                                style={{resize: 'none'}}
                                                placeholder={`Application Name`}
                                                value={appName}
                                                onChange={(e) => setAppName(e.target.value)}
                                                rows={1}
                                            />
                                        </div>

                                    <div className='ml-8'
                                        style={{width: '250px'}}>

                                        <ExpansionComponent 
                                            title={'Add Delegate'} 
                                            content={ 
                                                <div>
                                                    <EmailsAutoComplete
                                                        input = {delegateInput}
                                                        setInput =  {setDelegateInput}
                                                        allEmails = {allEmails}
                                                        addMultipleUsers={false}

                                                    />
                                                </div>
                                            }
                                            closedWidget= { <IconPlus size={18} />}
                                        />
                                     </div>
                                </div>


                                <div className="mt-2 text-sm text-black dark:text-neutral-200">
                                    {t('Application Description')}
                                </div>
                                <textarea
                                    className="mr-2 mb-2 rounded-md border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                    style={{resize: 'none'}}
                                    placeholder={`Provide a short description on the application use of this api key.`}
                                    value={appDescription}
                                    onChange={(e) => setAppDescriptione(e.target.value)}
                                    rows={2}
                                />

                            
                            </div>
                            
                            <div className='flex flex-row gap-2 py-1'>

                              <label className="text-sm mt-1" htmlFor="rateLimitType">Bill To</label>

                                <select
                                    className="rounded-lg border border-neutral-500 p-1 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                    style={{ width: '270px'}}
                                    value={selectedAccount}
                                    onChange={(event) => {
                                        setSelectedAccount(event.target.value);
                                    }}
                                >
                                    {accounts.map(account => (
                                        <option key={account.id} value={account.id}>{account.name}
                                        </option>
                                    ))}
                                </select>
                                <>
                                <label className="ml-5 text-sm mt-1" htmlFor="rateLimitType">Rate Limit</label>
                               
                                <select
                                    id="rateLimitType"
                                    className="rounded border-gray-300 p-0.5 text-neutral-900 dark:text-neutral-100 shadow-sm dark:bg-[#40414F] focus:border-neutral-700 focus:ring focus:ring-neutral-500 focus:ring-opacity-50"
                                    style={{ width: '85px'}}
                                    value={rateLimitType}
                                    onChange={(e) => setRateLimitType(e.target.value)}
                                >
                                    <option className="ml-6" value="Unlimited">Unlimited</option>
                                    <option className="ml-6" value="Monthly">Monthly</option>
                                    <option className="ml-6" value="Weekly">Weekly</option>
                                    <option className="ml-6" value="Hourly">Hourly</option>
                                </select>

                                {rateLimitType !== 'Unlimited' && (
                                    <div className='mt-1 ml-1'>
                                        <input
                                            style={{ width: `${calcCostWidth()}px`, textAlign: 'right' }}
                                             type="text"
                                             placeholder="$0.00"
                                             className="rounded border-gray-300 p-0.5 text-neutral-900 shadow-sm focus:border-neutral-500 focus:ring focus:ring-neutral-500 focus:ring-opacity-50 w-full"
                                             value={costAmount}
                                             onChange={(e) => setCostAmount(formatDollar(e.target.value))}
                                        />

                                    </div>
                                 )}
                                 </>

                                <div className='ml-auto flex flex-row' style={{width: '296px'}}>
                                    <input type="checkbox" checked={includeExpiration} onChange={(e) => setIncludeExpiration(e.target.checked)} />
                                    <label className="m-1 ml-2 pt-0.5 text-sm" htmlFor="expiration">Set Expiration Date</label>
                                    {includeExpiration && 
                                        <input
                                            className="rounded border-gray-300 p-0.5 text-neutral-900 dark:text-neutral-100 shadow-sm bg-neutral-200 dark:bg-[#40414F] focus:border-neutral-700 focus:ring focus:ring-neutral-500 focus:ring-opacity-50"
                                            type="date"
                                            id="expiration"
                                            value={selectedDate}
                                            min={today}
                                            onChange={(e) => setSelectedDate(e.target.value)}
                                        />}
                                </div>
                                
                            </div>

                            <div className='py-1 w-full' title='Full Access is the default configuration.'>
                                <ExpansionComponent 
                                            title={'Access Controls'} 
                                            content={ 
                                                <div className='flex flex-row gap-1.5' >
                                                    <input type="checkbox" checked={fullAccess} onChange={(e) => {
                                                            const checked = e.target.checked;
                                                            setFullAccess(checked);
                                                            setOptions(prevOptions => 
                                                                Object.keys(prevOptions).reduce((acc, key) => {
                                                                    acc[key] = checked;
                                                                    return acc;
                                                                }, {} as Record<string, boolean>)
                                                            );
                                                        }} />
                                                    <label className="text-sm mr-2" htmlFor="FullAccess">Full Access</label>
                                                    {Object.keys(options).map((key: string) => (
                                                        <>
                                                        <input type="checkbox" checked={options[key]} onChange={() => {
                                                            setOptions((prevOptions:any) => {
                                                                const newOptions = { ...prevOptions, [key]: !prevOptions[key] };
                                                                if (!newOptions[key]) setFullAccess(false);
                                                                return newOptions;
                                                            })
                                                        }}/>

                                                        <label className="text-sm mr-2" htmlFor={key}>{key.charAt(0).toUpperCase() + key.replace(/_/g, ' ').slice(1)}</label>

                                                        </>
                                                    ))}
                                                </div>
                                            }
                                />
                            </div>

                            <div className='flex flex-row gap-2 py-1 ml-1'>
                                {delegateInput.length == 0 && (
                                <div className='mt-1' title='If the API key is not for personal use'>
                                 <input className="mr-2 mt-1.5" type="checkbox" checked={systemUse} onChange={(e) => setSystemUse(e.target.checked)} />
                                 <label className="m-1 pt-0.5 text-sm" htmlFor="expiration">For System Use</label>
                                </div>)
                                }
                                <button
                                    type="button"
                                    title='Create Api Key'
                                    className="ml-auto mr-6 px-2 py-1.5 text-white rounded bg-neutral-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-500"
                                    onClick={handleCreateApiKey}
                                >
                                    <div className=' flex flex-row gap-2 mr-1'>
                                    <IconPlus size={20} />
                                    Create Key
                                    </div>
                                </button>
                            </div>

                        </div>
                    }   
                    closedWidget= { <IconPlus size={18} />}                            

                    />
            </div>
            
            <div>
                <div className="text-lg text-black dark:text-neutral-200 border-b">
                        Your API Keys
                </div>
                <div className='overflow-x-auto'>
                    {apiKeys.length === 0 ? (
                            <div className="text-center text-md italic text-black dark:text-neutral-200">
                                You do not have any API keys set up. Add one above.
                            </div>) 
                            :
                            (<div className="ml-4 text-md text-black dark:text-neutral-200 flex flex-row p-2">
                                {[["Name", "120px"], ["Account", "140px"], ["Delegate", "80px"], ["Active", "60px"], 
                                ["Expiration", "100px"], ["Last Accessed", "234px"], ["Rate Limit", "140px"], ["Access Types", "220px"],
                                ["System ID", "176px"], ["API Key", "184px"]
                                ].map((col:any, index:number) => ( 
                                    <div key={index} className="ml-[-1px] px-2 border border-gray-500 flex flex-shrink-0" style={{width: col[1]}}>
                                        <>{col[0]}</>
                                    </div>
                                ))}
                            </div>)
                        }
                        <div className="divide-y divide-gray-400 dark:divide-gray-200 w-full"> 
                            {ownerApiKeys && [...ownerApiKeys, ...(delegateApiKeys ? delegateApiKeys : [])].map((apiKey:any, index: number) => (
                                <div key={index} className="flex flex-row justify-between items-center py-3">
                                    <IconUser style={{ strokeWidth: 2.5 }} className={`mb-2 mr-2 flex-shrink-0 ${apiKey.systemId 
                                                                           ? 'text-green-600' : apiKey.delegate 
                                                                           ? 'text-blue-600' : 'text-gray-600 dark:text-gray-400'}`} size={20}/>
                                                                    
                                    <Label label={apiKey.applicationName} widthPx="120px"></Label>
                                    <Label label={apiKey.account} widthPx="140px" editable={true}></Label>
                                    <Label label={apiKey.delegate || "N/A"} widthPx="80px"></Label>
                                    {<div className='items-center' style={{width: '60px'}}>
                                        {apiKey.active ? <IconCheck size={18} /> : <IconX size={18} />}
                                    </div>}
                                    <Label label={apiKey.expirationDate || "N/A"} widthPx="100px" editable={true}></Label>
                                    <Label label={userFriendlyDate(apiKey.lastAccessed)} widthPx="234px"></Label>
                                    <Label label={apiKey.rateLimit.rate ? formatLimits(apiKey.rateLimit) : 'Unlimited'} widthPx="140px" editable={true}></Label>
                                    <Label label={apiKey.accessTypes.join(', ')} widthPx="220px" editable={true}></Label>
                                    <Label label={apiKey.systemId || "N/A"} widthPx="176px"></Label>
                                    
                                    {!apiKey.delegate && (
                                        <HiddenAPIKey   
                                        id={apiKey.api_owner_id} 
                                        />  
                                    )}
                                    <div className="ml-6 mr-2">
                                        {false ? (
                                            <button
                                                type="button"
                                                className="px-2 py-1.5 text-sm bg-neutral-600 text-white rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                                onClick={() => {}}
                                            >
                                                <IconTrashX size={18} />
                                            </button>
                                        ) : (
                                            <div className="px-2 py-1.5 text-sm opacity-0" aria-hidden="true"> {/* Invisible spacer */}
                                                <IconTrashX size={18} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                </div>
            </div>
            <div>
                { apiKeys.length > 0 &&
                <>
                <div className="text-lg text-black dark:text-neutral-200 border-b">
                        Delegated API Keys
                </div>
                        {/* api_owner_id: string;
                        owner: string, 
                        delegate:  string, 
                        applicationName: string;
                        applicationDescription: string;
                        account: string | null;
                        rateLimit: rateLimit
                        active: boolean;
                        expiration: string | null;
                        accessTypes: string[];
                        systemId: string;
                        lastAccessed: string; */}
                        <ul className="divide-y divide-gray-200 overflow-auto"> 
                        {/* h-[130px] */}
                            {delegateApiKeys && delegateApiKeys.map((apiKey:any) => (
                                <li key={"id"} className="flex flex-row justify-between items-center py-3">
                                    <Label label={apiKey.owner} widthPx="120px"></Label>
                                    <Label label={apiKey.applicationName} widthPx="120px"></Label>
                                    {<div className='items-center' style={{width: '60px'}}>
                                        {apiKey.active ? <IconCheck size={18} /> : <IconX size={18} />}
                                    </div>}
                                    <Label label={apiKey.expirationDate || "N/A"} widthPx="100px" ></Label>
                                    <Label label={userFriendlyDate(apiKey.lastAccessed)} widthPx="234px"></Label>
                                    <Label label={apiKey.rateLimit.rate ? formatLimits(apiKey.rateLimit) : 'Unlimited'} widthPx="140px"></Label>
                                    <Label label={apiKey.accessTypes.join(', ')} widthPx="220px"></Label>
                                    <HiddenAPIKey   
                                        id={apiKey.api_owner_id} 
                                    />  
                                    <div className="ml-6 mr-2">
                                        {false ? (
                                            <button
                                                type="button"
                                                className="px-2 py-1.5 text-sm bg-neutral-600 text-white rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                                onClick={() => {}}
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
                        </>
                    }
            </div>
            </div>
            <div className="flex flex-col">
                    <div className="flex-shrink-0 flex flex-row mt-auto">
                        <button
                            type="button"
                            className="mr-2 w-full px-4 py-2 mt-6 border rounded-lg shadow border-neutral-500 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-300"
                            onClick={onClose}
                        >
                            {t('Cancel')}
                        </button>
                        <button
                            type="button"
                            className="w-full px-4 py-2 mt-6 border rounded-lg shadow border-neutral-500 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-300"
                            onClick={handleApplyEdits}
                        >
                            {t('Save Edits')}
                        </button>
                    </div>
            </div>

        </>
                        
    );
};


interface APIKeyProps {
    id: string;
}

const HiddenAPIKey: FC<APIKeyProps> = ({ id}) => {

    const defaultStr = "********************";
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
            alert(result.error);
            return;
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
    style={{ width: '184px', height: '34px' }}>

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
            <SidebarActionButton
                handleClick={() =>  copyOnClick()}
                title={"Copy Api key"}>
                <IconCopy size={18}/>
            </SidebarActionButton> 
        )
        :
        (!isLoading &&
        <SidebarActionButton
            handleClick={() => getApiKey(id)}
            title={"See API key secret"}>
            <IconEye size={18}/>
        </SidebarActionButton>)
    }
    {isLoading && 
    <LoadingIcon className= 'min-w-[26px]' style={{ width: "18px", height: "18px" }}/>
    }
</div>
       
}



interface LabelProps {
    label: string;
    widthPx: string;
    editable?: boolean;
}

//rateLimit, expiration, accessTypes, account
const Label: FC<LabelProps> = ({ label, widthPx, editable = false}) => {
    const [isOverflowing, setIsOverflowing] = useState(false);
    const labelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const element = labelRef.current;
        if (element) {
            setIsOverflowing(element.scrollWidth > element.clientWidth);
        }
    }, [label]);

    return (
         <div
                ref={labelRef}
                style={{
                    whiteSpace: 'nowrap',
                    overflowWrap: 'break-word',
                    width: widthPx,
                    position: 'relative',
                    fontSize: '0.875rem',
                    height: '34px',
                    flex:'shrink-0'
                }}
                className={`overflow-x-auto, overflow-y-hidden mb-2 p-2 flex-1 text-black dark:text-neutral-200 text-sm text-black rounded dark:text-neutral-200 ${isOverflowing ? 'bg-neutral-200 dark:bg-[#40414F]' : 'transparent'}`}
            >
                {label}
            
            {/* {editable &&  <SidebarActionButton
                handleClick={() =>  () =>{}}
                title={"Edit"}>
                <IconEdit size={18}/>
            </SidebarActionButton>} */}
        </div>
 
    );
}