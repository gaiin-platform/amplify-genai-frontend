import React, { FC, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'next-i18next';
import { IconTrashX, IconPlus, IconInfoCircle, IconEye, IconCopy, IconCheck, IconX, IconUser, IconEdit } from "@tabler/icons-react";
import HomeContext from '@/pages/api/home/home.context';
import ExpansionComponent from '../../Chat/ExpansionComponent';
import { EmailsAutoComplete } from '@/components/Emails/EmailsAutoComplete';
import { fetchEmailSuggestions } from '@/services/emailAutocompleteService';
import { Account } from '@/types/accounts';
import { createApiKey, fetchApiKey, updateApiKeys } from '@/services/apiKeysService';
import { ApiKey, ApiRateLimit } from '@/types/apikeys';
import { useSession } from 'next-auth/react';
import {styled, keyframes} from "styled-components";
import {FiCommand} from "react-icons/fi";
import SidebarActionButton from '@/components/Buttons/SidebarActionButton';
import { formatDateYMDToMDY, userFriendlyDate } from '@/utils/app/date';
import { AccountSelect } from './Account';
import { RatePeriodLimit } from './RateLimit';

interface Props {
    apiKeys: ApiKey[];
    onClose: () => void;
    isLoading: boolean;
    setIsLoading: (e:boolean) => void;
    setLoadingMessage: (s:string) => void;
    accounts: Account[];
    defaultAccount: Account;
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

export const formatLimits = (limits: ApiRateLimit) =>  {
    if (limits.rate === null) return 'Unlimited';
    return `$${limits.rate}${limits.rate.toString().includes('.') ? '' : '.00'}/${limits.period}`
}


export const formatAccessTypes = (accessTypes: string[]) => {
    return accessTypes.map((a: string) => formatAccessType(a)).join(', ')
                                                              
}

const formatAccessType = (accessType: string) => {
    return String(accessType).replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())
                                                              
}

export const ApiKeys: FC<Props> = ({ apiKeys, onClose, isLoading, setIsLoading, setLoadingMessage, accounts, defaultAccount}) => {
    const { state: {featureFlags}, dispatch: homeDispatch } = useContext(HomeContext);

    const { data: session } = useSession();
    const user = session?.user;


    const { t } = useTranslation('settings');

    const [ownerApiKeys, setOwnerApiKeys] = useState<ApiKey[]>([]);
    const [delegateApiKeys, setDelegateApiKeys] = useState<ApiKey[]>([]);
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
    const noCoaAccount: Account = { id: 'general_account', name: 'No COA On File' };
    const [selectedAccount, setSelectedAccount] = useState<Account | null>(defaultAccount.name === noCoaAccount.name ? null : defaultAccount);
    const today = new Date().toISOString().split('T')[0];

    const [fullAccess, setFullAccess] = useState<boolean>(true);

    const [editedKeys, setEditedKeys] = useState<any>({});


    
    const [options, setOptions] = useState<Record<string, boolean>>({
            assistants: true,
            chat: true,
            file_upload: true, // _ will be turned into a ' ' for displaying purposes
            share: true,
            dual_embedding: true
        });

    
    useEffect(() => {
        const handleEvent = (event: any) => {
            console.log("editedApiKey was triggered", event.detail);
            const apiKeyId = event.detail.id;
            const updates = event.detail.edits; 
            console.log(event.detail)
    
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
            console.log(editedKeys);

        };
    
        window.addEventListener('editedApiKey', handleEvent);
    
        return () => {
            window.removeEventListener('editedApiKey', handleEvent);
        };
    }, []);


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
        setDelegateApiKeys(apiKeys.filter((k: ApiKey) => k.delegate === user?.email));
        setOwnerApiKeys(apiKeys.filter((k: ApiKey) => k.owner === user?.email));
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
            'accessTypes': [fullAccess ? "full_access" :  Object.keys(options).filter((key) => options[key]) ],
            'systemUse' : systemUse && delegateInput.length === 0
        }
        const result = await createApiKey(data)
        setIsCreating(false);

        alert(result ? "Successfuly created the API key" : "Unable to create the API key at this time. Please try again later...");
        // empty out all the create key fields
        if (result) {
            setAppName('');
            setAppDescriptione('');
            setDelegateInput('');
            setRateLimitType('Unlimited');
            setIncludeExpiration(false);
            setSystemUse(false);
            // to pull in the updated changes to the ui
            window.dispatchEvent(new Event('createApiKeys'));
        }
        
        
    };

    const handleDeactivateApikey = (accountToDelete: string) => {

    };

    const handleApplyEdits = async () => {
        // call handle edits 
        const result = await updateApiKeys(editedKeys);
        if (!result.success) {
            alert('failedKeys' in result ? `API keys: ${result.failedKeys.join(", ")} failed to update. Please try again.` : "We are unable to update your key(s) at this time...")
        }
    };

    const handleSave = async () => {
        if (Object.keys(editedKeys).length === 0) handleApplyEdits();
        onClose();
    };


    const isExpired = (date: string) => {
        return new Date(date) <= new Date()
    }

    useEffect(() => {
        const allSelected = Object.keys(options).every(key => options[key]);
        if (allSelected) setFullAccess(allSelected);
    }, [options]);


    if (isLoading) return <></>


    return (
        <div className='flex flex-col'>
         <div className='flex flex-col gap-4 mx-2' > 
            <div className="text-l text-black dark:text-neutral-200">
                You can create Api keys for yourself and others. 
                <div className="mx-5 mt-4 flex items-center p-2 border border-gray-400 dark:border-gray-500 rounded ">
                    <IconInfoCircle size={16} className='mx-2 mb-1 flex-shrink-0 text-gray-600 dark:text-gray-400' />
                    <span className="ml-2 text-xs text-gray-600 dark:text-gray-400"> 
                        <div className='mb-2 ml-5 '> {"Types of API Keys"}</div>
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
                            <IconUser className='flex-shrink-0 text-yellow-500' style={{ strokeWidth: 2.5 }} size={16}/>
                            Delegate Use
                            <br className='mb-1'></br>
                            A Delegate API Key is like a personal key for another Amplify user, but with your account being responsible for the associated payments. This type of key is useful when you want to grant someone else access or certain capabilities within their own Amplify account while ensuring that the billing responsibility falls on your account. You will not be able to see this API key at any time.
                        </div>
                        <div className='mt-2 text-black dark:text-neutral-200 text-sm text-center'> {"*** If your key has been compromised, deactivate it as soon as possible ***"} </div>
                        
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

                            <div className='flex flex-col  gap-2 w-full '>

                                   <div className='flex flex-row gap-20'>
                                        <div className='flex flex-col pb-1 w-[340px] '>
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

                                        <div className='mr-8' style={{width: '300px'}}>

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
                                    className="mr-6 mb-2 rounded-md border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                    style={{resize: 'none'}}
                                    placeholder={`Provide a short description on the application use of this api key.`}
                                    value={appDescription}
                                    onChange={(e) => setAppDescriptione(e.target.value)}
                                    rows={2}
                                />

                            
                            </div>

                            <div className='flex flex-row gap-2 mr-6'>
                                <label className="text-sm mt-1 w-[48px] ml-2 " htmlFor="BillTo">Bill To</label>
                                <AccountSelect
                                    accounts={accounts.filter((a: Account) => a.id !== noCoaAccount.id)}
                                    defaultAccount={defaultAccount}
                                    setDefaultAccount={setSelectedAccount}
                                />
                                </div>
                            
                            <div className='flex flex-row justify-between mx-8 py-1'>
                                <div className='flex flex-row gap-4' style={{ width: '240px', whiteSpace: 'nowrap', overflowWrap: 'break-word'}}>
                                    <label className="text-sm mt-1" htmlFor="rateLimitType">Rate Limit</label>
                                    <RatePeriodLimit
                                        rateLimitType={rateLimitType}
                                        setRateLimitType={setRateLimitType}
                                        costAmount={costAmount}
                                        setCostAmount={setCostAmount}
                                    />
                                 </div>

                                <div className='flex flex-row' style={{width: '296px', whiteSpace: 'nowrap', overflowWrap: 'break-word'}}> 
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

                                {delegateInput.length == 0 && (
                                    <div className='mt-1 mr-4' title='If the API key is not for personal use'>
                                        <input className="mr-2 mt-1.5" type="checkbox" checked={systemUse} onChange={(e) => setSystemUse(e.target.checked)} />
                                        <label className="m-1 pt-0.5 text-sm" htmlFor="expiration">For System Use</label>
                                    </div>)
                                }
                                
                            </div>
                            <div className='flex flex-row py-1 '>
                                <div className='py-1 w-full' title='Full Access is the default configuration.'>
                                    <ExpansionComponent 
                                                title={'Access Controls'} 
                                                content={ 
                                                    <div className='flex flex-row gap-2' >
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
                                                        <label className="text-sm mr-3" htmlFor="FullAccess">Full Access</label>
                                                        {Object.keys(options).map((key: string) => (
                                                            <>
                                                            <input type="checkbox" checked={options[key]} onChange={() => {
                                                                setOptions((prevOptions:any) => {
                                                                    const newOptions = { ...prevOptions, [key]: !prevOptions[key] };
                                                                    if (!newOptions[key]) setFullAccess(false);
                                                                    return newOptions;
                                                                })
                                                            }}/>

                                                            <label className="text-sm mr-3" htmlFor={key}>{formatAccessType(key)}</label>

                                                            </>
                                                        ))}
                                                    </div>
                                                }
                                    />
                                </div>

                                <button
                                    type="button"
                                    title='Create Api Key'
                                    className={`ml-auto mr-6 mt-4 px-2 py-1.5 text-white rounded bg-neutral-600 hover:bg-${!selectedAccount ? 'red': 'green'}-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-500`}
                                    style= {{width: '146px', height: '36px'}}
                                    onClick={() => {
                                        if (!selectedAccount) {
                                            alert("Please add an account with a valid COA string to create an API key.")
                                        } else {
                                           handleCreateApiKey();
                                        }
                                        
                                    }}
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
                <div className="text-lg text-black dark:text-neutral-200 border-b border-gray-400 ">
                        Your API Keys
                </div>
                

                <div className='overflow-x-auto'>
                {ownerApiKeys.length === 0 ? (
                    <div className="text-center text-md italic text-black dark:text-neutral-200">
                        You do not have any API keys set up. Add one above.
                    </div>
                ) : (
                    <table className='mt-[-1px] w-full text-md text-black dark:text-neutral-200'>
                        <thead>
                            <tr className="bg-gray-200 dark:bg-[#333]">
                                <th className='bg-white dark:bg-[#202123]'></th>
                               { ["Name", "Active", "Account", "Delegate", "Expiration", "Last Accessed", "Rate Limit", "Access Types", "System ID", "API Key"
                            ].map((i) => (
                                <th
                                    key={i}
                                    className="p-0.5 border border-gray-400 text-neutral-600 dark:text-neutral-300">
                                    {i}
                                </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {ownerApiKeys.map((apiKey, index) => (
                                <tr key={index}>
                                    <td>{
                                        <IconUser style={{ strokeWidth: 2.5 }} className={`mb-2 mr-2 flex-shrink-0 ${apiKey.systemId 
                                            ? 'text-green-600' : apiKey.delegate ? 'text-yellow-500' : 'text-gray-600 dark:text-gray-400'}`} size={20}/>
                                        }</td>
                                    <td>{<Label label={apiKey.applicationName} />}</td>
                                    <td>
                                        <div className='flex justify-center items-center' style={{width: '60px'}}>
                                            {apiKey.active ? <IconCheck className= 'text-green-600' size={18} /> : <IconX className='text-red-600' size={18} />}
                                        </div>
                                    </td>
                                    <td>{<Label label={apiKey.account ? `${apiKey.account.name + " - "} ${apiKey.account.id}` : ''} widthPx='180px' editableField={apiKey.active ? 'account' : undefined} apiKey={apiKey} accounts={accounts.filter((a: Account) => a.id !== noCoaAccount.id)}/>}</td>
                                    <td>{apiKey.delegate ? <Label label={apiKey.delegate} /> :  <NALabel />}</td>
                                    <td>{ apiKey.expirationDate ?  <Label label={formatDateYMDToMDY(apiKey.expirationDate)} 
                                                                          textColor={isExpired(apiKey.expirationDate) ? "text-red-600": undefined} 
                                                                          editableField={apiKey.active ? 'expirationDate': undefined} apiKey={apiKey}/> 
                                                                : <NALabel /> }</td>
                                    <td>{<Label label={userFriendlyDate(apiKey.lastAccessed)} widthPx={"104px"} isDate={true}/>}</td>
                                    <td>{<Label label={formatLimits(apiKey.rateLimit)} editableField={apiKey.active ? 'rateLimit' : undefined} apiKey={apiKey}/>}</td>
                                    <td>{<Label label={formatAccessTypes(apiKey.accessTypes)} widthPx="160px" editableField={apiKey.active ? 'accessTypes' : undefined} apiKey={apiKey}/>}</td>
                                    <td>{apiKey.systemId ? <Label label={apiKey.systemId } />:   <NALabel />}</td>
                                    <td>{!apiKey.delegate ? <HiddenAPIKey id={apiKey.api_owner_id} width='184px'/>: <NALabel label={"Not Viewable"}/>}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>



            </div>
            <div>
                { delegateApiKeys.length > 0 &&
                <>
                <div className="text-lg text-black dark:text-neutral-200 border-b">
                        Delegated API Keys
                </div>
            <div>
                <div style={{ overflowX: 'auto'}}>
                <table className='mt-[-1px] w-full text-md text-black dark:text-neutral-200'>
                    <thead>
                            <tr className="bg-gray-200 dark:bg-[#333]">
                               { ["Name", "Active", "Owner", "Expiration", "Last Accessed", "Rate Limit", "Access Types", "API Key"
                            ].map((i) => (
                                <th
                                    key={i}
                                    className="p-0.5 border border-gray-400 text-neutral-600 dark:text-neutral-300">
                                    {i}
                                </th>
                                ))}
                            </tr>
                    </thead>
                    <tbody >
                        {delegateApiKeys.map((apiKey:any) => (
                        <tr key={apiKey.id}>
                            <td>{<Label label={apiKey.applicationName} widthPx="120px"></Label>}</td>
                            <td> {<div className='flex justify-center items-center' style={{width: '60px'}}>
                                        {apiKey.active ? <IconCheck className= 'text-green-600' size={18} /> : <IconX  className='text-red-600' size={18} />}
                                    </div>}
                            </td>
                            <td>{<Label label={apiKey.owner} ></Label>}</td>
                            <td>{ apiKey.expirationDate ? <Label label={formatDateYMDToMDY(apiKey.expirationDate)} textColor={isExpired(apiKey.expirationDate) ? "text-red-600": undefined} /> 
                                                        : <NALabel /> }</td>
                            <td>{<Label label={userFriendlyDate(apiKey.lastAccessed)} widthPx="104px" isDate={true}></Label>}</td>
                            <td>{<Label label={formatLimits(apiKey.rateLimit)} widthPx="140px"></Label>}</td>
                            <td>{<Label label={formatAccessTypes(apiKey.accessTypes)} widthPx="160px" ></Label>}</td>
                            <td>{<HiddenAPIKey id={apiKey.api_owner_id} width='184px'/> }
                            </td>      
                        </tr>
                        ))}
                    </tbody>
                    </table>
                    </div>
                    </div>
                    </>
                    }
                </div>
            </div>

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
                        
    );
};


interface APIKeyProps {
    id: string;
    width?: string;
}

export const HiddenAPIKey: FC<APIKeyProps> = ({ id, width=''}) => {

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
    const [displayLabel, setDisplayLabel] = useState(label);
    const [isOverflowing, setIsOverflowing] = useState(false);
    const [isEditing, setIsEditing] = useState<boolean>(false);
    const [isHovered, setIsHovered,] = useState(false);
    const labelRef = useRef<HTMLDivElement>(null);

    const [selectedAccount, setSelectedAccount] = useState<Account | null>(apiKey ? apiKey.account : null);
    const [rateLimitType, setRateLimitType] = useState<string>(apiKey ? apiKey.rateLimit.period : 'Unlimited');
    const [costAmount, setCostAmount] = useState<string>(apiKey && apiKey.rateLimit.rate ? String(apiKey.rateLimit.rate) : '0');
    const [selectedDate, setSelectedDate] = useState<string>(apiKey?.expirationDate || '');


    useEffect(() => {
        const element = labelRef.current;
        if (element) {
            setIsOverflowing(element.scrollWidth > element.clientWidth);
        }
    }, [displayLabel]);

    const handleEdit = () => {
        let editedData = null;
        switch (editableField) {
            case("expirationDate"):
                editedData = selectedDate;
                break;
            case("account"):
                if (selectedAccount) {
                    setDisplayLabel(`${selectedAccount.name + " - "} ${selectedAccount.id}`);
                    editedData = selectedAccount;
                }
                
                break;
            case("rateLimit"): 
                editedData = {'period' : rateLimitType, 'rate': ( rateLimitType === 'Unlimited' ? null : parseFloat(costAmount.replace('$', '')))}
                setDisplayLabel(formatLimits(editedData));
                break;
            case("accessTypes"): 
                editedData = null
                break;
        }

        if (editedData && editableField) {
            window.dispatchEvent(new CustomEvent('editedApiKey', {
                detail: {
                    id: apiKey?.api_owner_id,
                    edits: { [editableField] : editedData }
                }
                }));
        }
    }

    const formattedLabel = isDate ? displayLabel?.replace(' at ', ' \n at ') : displayLabel;

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
        {!isEditing && formattedLabel}

        {isEditing && editableField && (
            <>
            {editableField && editableField === 'expirationDate' && (<>
            </>)}
            {accounts && selectedAccount && editableField === 'account' && (
                <div>
                <AccountSelect
                    accounts={accounts}
                    defaultAccount={selectedAccount}
                    setDefaultAccount={setSelectedAccount}
                    showId={false}
                />
                </div>
            )}
            {editableField && editableField === 'rateLimit' && (<>
                <RatePeriodLimit
                    rateLimitType={rateLimitType}
                    setRateLimitType={setRateLimitType}
                    costAmount={costAmount}
                    setCostAmount={setCostAmount}
                />
            </>)}
            {editableField && editableField === 'accessTypes' && (<>
            </>)}
            </>
        )}

        {isEditing && (
            (
                <div className="absolute right-0 z-10 flex bg-neutral-200 dark:bg-[#343541]/90 rounded">
                  <SidebarActionButton
                    handleClick={(e) => {
                        e.stopPropagation();
                        handleEdit();
                        setIsEditing(false);
                    }}
                  >
                    <IconCheck size={18} />
                  </SidebarActionButton>
                  <SidebarActionButton
                    handleClick={(e) => {
                      e.stopPropagation();
                      setIsEditing(false);
                    }}
                  >
                    <IconX size={18} />
                  </SidebarActionButton>
                </div>
              )

        )}

        {editableField && isHovered && !isEditing && (
            <div
            className="absolute top-1 right-0 ml-auto  z-10 flex-shrink-0 bg-neutral-200 dark:bg-[#343541]/90 rounded">
                <SidebarActionButton
                    handleClick={() => {setIsEditing(true)}}
                    title="Edit">
                    <IconEdit size={18} />
                </SidebarActionButton>
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