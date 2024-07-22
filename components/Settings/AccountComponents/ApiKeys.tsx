import React, { FC, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'next-i18next';
import { IconPlus, IconInfoCircle, IconEye, IconCopy, IconCheck, IconX, IconUser, IconEdit, IconArticle, IconRobot } from "@tabler/icons-react";
import HomeContext from '@/pages/api/home/home.context';
import ExpansionComponent from '../../Chat/ExpansionComponent';
import { EmailsAutoComplete } from '@/components/Emails/EmailsAutoComplete';
import { fetchEmailSuggestions } from '@/services/emailAutocompleteService';
import { Account } from '@/types/accounts';
import { createApiKey, deactivateApiKey, fetchApiDoc, fetchApiKey, updateApiKeys } from '@/services/apiKeysService';
import { ApiKey, ApiRateLimit } from '@/types/apikeys';
import { useSession } from 'next-auth/react';
import {styled, keyframes} from "styled-components";
import {FiCommand} from "react-icons/fi";
import SidebarActionButton from '@/components/Buttons/SidebarActionButton';
import { formatDateYMDToMDY, userFriendlyDate } from '@/utils/app/date';
import { AccountSelect } from './Account';
import { RatePeriodLimit } from './RateLimit';
import cloneDeep from 'lodash/cloneDeep';
import { Prompt } from '@/types/prompt';
import { isAssistant } from '@/utils/app/assistants';
import { handleStartConversationWithPrompt } from '@/utils/app/prompts';
import { APIDownloadFile, fetchFile } from '@/components/Chat/ChatContentBlocks/APIDocBlock';

interface Props {
    apiKeys: ApiKey[];
    setApiKeys: (k:ApiKey[]) => void;
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

const today = new Date().toISOString().split('T')[0];

// current api access choices
const optionChoices = {
    assistants: true,
    chat: true,
    file_upload: true, // _ will be turned into a ' ' for displaying purposes
    share: true,
    dual_embedding: true
}

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

export const ApiKeys: FC<Props> = ({ apiKeys, setApiKeys, onClose, isLoading, setIsLoading, setLoadingMessage, accounts, defaultAccount}) => {
    const { state: {featureFlags, statsService}, dispatch: homeDispatch } = useContext(HomeContext);

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

    const [editedKeys, setEditedKeys] = useState<any>({});


    const [fullAccess, setFullAccess] = useState<boolean>(true);
    const [options, setOptions] = useState<Record<string, boolean>>(cloneDeep(optionChoices));

    const [docsIsOpen, setDocsIsOpen] = useState<boolean>(false);

    
    useEffect(() => {
        const handleEvent = (event: any) => {
            console.log("editedApiKey was triggered", event.detail);
            const apiKeyId = event.detail.id;
            const updates = event.detail.edits; 

            if (updates.accessTypes && Array.isArray(updates.accessTypes)) {
                updates.accessTypes = updates.accessTypes.flat();
            }
    
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

    useEffect(() => {
        // setKeysLoaded(false);
    }, [ownerApiKeys]);


    const handleCreateApiKey = async () => {
        setIsCreating(true);
        
        const data = {
            'owner' : user?.email,
            'account' : selectedAccount,
            'delegate': delegateInput.length > 0 ? delegateInput : null,
            'appName' : appName,
            'appDescription' : appDescription,
            'rateLimit' : {'period' : rateLimitType, 'rate': ( rateLimitType === 'Unlimited' ? null : parseFloat(costAmount.replace('$', '')))},
            'expirationDate' : includeExpiration ? selectedDate : null,
            'accessTypes': fullAccess ? ["full_access"] :  Object.keys(options).filter((key) => options[key]),
            'systemUse' : systemUse && delegateInput.length === 0
        }
        const result = await createApiKey(data)
        setIsCreating(false);

        alert(result ? "Successfuly created the API key" : "Unable to create the API key at this time. Please try again later...");
        // empty out all the create key fields
        if (result) {
            statsService.createApiKey(data);
            setAppName('');
            setAppDescriptione('');
            setDelegateInput('');
            setRateLimitType('Unlimited');
            setIncludeExpiration(false);
            setSystemUse(false);
            setOptions(optionChoices);
            setFullAccess(true);
            // to pull in the updated changes to the ui
            window.dispatchEvent(new Event('createApiKeys'));
        }
        
        
    };

    const handleDeactivateApikey = async (apiKeyId: string, name: string) => {
        if (confirm(`Are you sure you want to deactivate API key: ${name}?\nOnce deactivate, it cannot be undone.`)) {
            const result = await deactivateApiKey(apiKeyId);
            if (result) {
                setApiKeys(apiKeys.map((k: ApiKey) => {;
                    if (k.api_owner_id === apiKeyId) return {...k, active: false}
                    return k;
                }))
                statsService.deactivateApiKey(apiKeyId);
            } else {
                alert('Failed to deactivate key at this time. Please try again later...');
            }
        }
    };

    const handleApplyEdits = async () => {
        // call handle edits 
        console.log("Final edits: ", editedKeys);
        const result = await updateApiKeys(Object.values(editedKeys));
        if (!result.success) {
            alert('failedKeys' in result ? `API keys: ${result.failedKeys.join(", ")} failed to update. Please try again.` : "We are unable to update your key(s) at this time...")
        } else {
            statsService.updateApiKey(Object.values(editedKeys));
        }
    };

    const handleSave = async () => {
        if (Object.keys(editedKeys).length !== 0) handleApplyEdits();
        onClose();
    };


    const isExpired = (date: string) => {
        return new Date(date) <= new Date()
    }

    if (isLoading) return <></>


    return (
        <div className='flex flex-col'>
         <div className='flex flex-col gap-4 mx-2' > 
            <div className="text-l text-black dark:text-neutral-200">
               API keys are used to authenticate and authorize access to specific Amplify services. You can create API keys for yourself and others.  
               <br className='mb-1'></br>
               The following fields are editable for your active API keys: Account, Expiration, Rate Limit, and Access Types.
               <br className='mb-1'></br>
               You can deactive any active API key by hovering the green check mark.

                <div className="mx-5 mt-4 flex items-center p-2 border border-gray-400 dark:border-gray-500 rounded ">
                    <IconInfoCircle size={16} className='mx-2 mb-1 flex-shrink-0 text-gray-600 dark:text-gray-400' />
                    <span className="ml-2 text-xs text-gray-600 dark:text-gray-400"> 
                        <div className='mb-2 ml-5 text-[0.8rem]'> {"Types of API Keys"}</div>
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
                <div className='z-60'> 
                   <APITools setDocsIsOpen={setDocsIsOpen} onClose={onClose}/> 
                </div>
                

            </div>
            <div className='border p-2 border-gray-400 dark:border-gray-700 rounded' >
                <ExpansionComponent 
                    title={'Create API Key'} 
                    content={
                        <div className='flex flex-col gap-2 '>
                                                 <>
                        {isCreating && (
                            <div className="absolute inset-0 flex items-center justify-center" 
                            style={{ transform: `translateY(-25%)`}}>
                                <div className="p-3 flex flex-row items-center  border border-gray-500 bg-[#202123]">
                                    <LoadingIcon style={{ width: "24px", height: "24px" }}/>
                                    <span className="text-lg font-bold ml-2 text-white">Creating API Key...</span>
                                </div>
                            </div>
                        )}
                        </>

                            <div className='flex flex-col  gap-2 w-full '>

                                   <div className='flex flex-row justify-between'>
                                        <div className='flex flex-col pb-1 sm:min-w-[340px]' style={{width: `${window.innerWidth * 0.35 }px` }}>
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

                                        <div className='ml-8 mr-8 relative sm:min-w-[300px] sm:max-w-[440px]' style={{width: `${window.innerWidth * 0.35 }px` }}>

                                            <ExpansionComponent 
                                                title={'Add Delegate'} 
                                                content={ 
                                                    <div >
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

                                
                                <div className='mt-1 mr-6 w-[140px]' title='If the API key is not for personal use' >
                                   {delegateInput.length === 0 ?
                                    <> <input className="mr-2 mt-1.5" type="checkbox" checked={systemUse} onChange={(e) => setSystemUse(e.target.checked)} />
                                       <label className="m-1 pt-0.5 text-sm" htmlFor="expiration">For System Use</label></>
                                    : <></>}
                                </div>
                                
                                
                            </div>
                            <div className='flex flex-row py-1 '>
                                <div className='py-1 w-full' title='Full Access is the default configuration.'>
                                    <ExpansionComponent 
                                                title={'Access Controls'} 
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
                ) : ( !docsIsOpen && 
                    <table className='mt-[-1px] w-full text-md text-black dark:text-neutral-200'>
                        <thead>
                            <tr className="bg-gray-200 dark:bg-[#333]">
                                <th className='bg-neutral-100 dark:bg-[#202123]'></th>
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
                                            {apiKey.active ? <button title='Deactivate Key' onClick={() => handleDeactivateApikey(apiKey.api_owner_id, apiKey.applicationName)}>
                                                                 <IconCheck className= 'text-green-600 hover:text-gray-400' size={18} /> 
                                                            </button> 
                                                           : <IconX className='text-red-600' size={18} />}
                                        </div>
                                    </td>
                                    <td>{<Label label={apiKey.account ? `${apiKey.account.name + " - "} ${apiKey.account.id}` : ''} widthPx='180px' editableField={apiKey.active && (user?.email !== apiKey.delegate)? 'account' : undefined} apiKey={apiKey} accounts={accounts.filter((a: Account) => a.id !== noCoaAccount.id)}/>}</td>
                                    <td>{apiKey.delegate ? <Label label={apiKey.delegate} /> :  <NALabel />}</td>
                                    <td>{ apiKey.expirationDate ?  <Label label={formatDateYMDToMDY(apiKey.expirationDate)} 
                                                                          textColor={isExpired(apiKey.expirationDate) ? "text-red-600": undefined} 
                                                                          editableField={apiKey.active ? 'expirationDate': undefined} apiKey={apiKey}/> 
                                                                : <Label label={null} editableField={apiKey.active ? 'expirationDate': undefined} apiKey={apiKey}/>  }</td>
                                    <td>{<Label label={userFriendlyDate(apiKey.lastAccessed)} widthPx={"110px"} isDate={true}/>}</td>
                                    <td>{<Label label={formatLimits(apiKey.rateLimit)} editableField={apiKey.active ? 'rateLimit' : undefined} apiKey={apiKey}/>}</td>
                                    <td>{<Label label={formatAccessTypes(apiKey.accessTypes).replaceAll(',', ', ')} widthPx="180px" editableField={apiKey.active ? 'accessTypes' : undefined} apiKey={apiKey}/>}</td>
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
                { !docsIsOpen &&  <div style={{ overflowX: 'auto'}}>
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
                                        {apiKey.active ? <button title='Deactivate Key' onClick={() => handleDeactivateApikey(apiKey.api_owner_id, apiKey.applicationName)}>
                                                                 <IconCheck className= 'text-green-600 hover:text-neutral-700' size={18} /> 
                                                          </button> 
                                                       : <IconX  className='text-red-600' size={18} />}
                                    </div>}
                            </td>
                            <td>{<Label label={apiKey.owner} ></Label>}</td>
                            <td>{ apiKey.expirationDate ? <Label label={formatDateYMDToMDY(apiKey.expirationDate)} textColor={isExpired(apiKey.expirationDate) ? "text-red-600": undefined} /> 
                                                        : <NALabel /> }</td>
                            <td>{<Label label={userFriendlyDate(apiKey.lastAccessed)} widthPx="110px" isDate={true}></Label>}</td>
                            <td>{<Label label={formatLimits(apiKey.rateLimit)} widthPx="140px"></Label>}</td>
                            <td>{<Label label={formatAccessTypes(apiKey.accessTypes).replaceAll(',', ', ')} widthPx="180px" ></Label>}</td>
                            <td>{<HiddenAPIKey id={apiKey.api_owner_id} width='184px'/> }
                            </td>      
                        </tr>
                        ))}
                    </tbody>
                    </table>
                    </div> }
                    </div>
                    </>
                    }
                </div>
            </div>

            <br className='mb-20'></br>

            { !docsIsOpen && <div className="flex-shrink-0 flex flex-row fixed bottom-0 left-0 w-full px-4 py-2 mb-2"> 
                <button
                    type="button"
                    className="mr-2 w-full px-4 py-2 mt-2 border rounded-lg shadow border-neutral-500 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 bg-white dark:bg-white dark:text-black dark:hover:bg-neutral-300"
                    onClick={onClose}
                >
                    {t('Cancel')}
                </button>
                <button
                    type="button"
                    className="w-full px-4 py-2 mt-2 border rounded-lg shadow border-neutral-500 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 bg-white dark:bg-white dark:text-black dark:hover:bg-neutral-300"
                    onClick={handleSave}
                >
                    {t('Save Edits')}
                </button>
            </div>}
           

        </div>
                        
    );
};


interface APIKeyProps {
    id: string;
    width?: string;
}

export const HiddenAPIKey: FC<APIKeyProps> = ({ id, width=''}) => {

    const { state: {statsService}} = useContext(HomeContext);

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
        }  else {
            statsService.getApiKey(id);
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
    const [displayLabel, setDisplayLabel] = useState<string | null>(label);
    const [isOverflowing, setIsOverflowing] = useState(false);
    const [isEditing, setIsEditing] = useState<boolean>(false);
    const [isHovered, setIsHovered,] = useState(false);
    const labelRef = useRef<HTMLDivElement>(null);

    const [selectedAccount, setSelectedAccount] = useState<Account | null>(apiKey ? apiKey.account : null);
    const [rateLimitType, setRateLimitType] = useState<string>(apiKey ? apiKey.rateLimit.period : 'Unlimited');
    const [costAmount, setCostAmount] = useState<string>(apiKey && apiKey.rateLimit.rate ? String(apiKey.rateLimit.rate) : '0');
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
                editedData = [fullAccess ? "full_access" :  Object.keys(options).filter((key) => options[key])];
                setDisplayLabel(formatAccessTypes((editedData as string[])).replaceAll(',', ', '));
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

    const formattedLabel = displayLabel && isDate? displayLabel?.replace(' at ', ' \n at ') : displayLabel;

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
            {editableField && editableField === 'rateLimit' && (<>
                <RatePeriodLimit
                    rateLimitType={rateLimitType}
                    setRateLimitType={setRateLimitType}
                    costAmount={costAmount}
                    setCostAmount={setCostAmount}
                />
            </>)}
            {editableField && editableField === 'accessTypes' && (<>
                <AccessTypesCheck
                    fullAccess={fullAccess}
                    setFullAccess={setFullAccess}
                    options={options}
                    setOptions={setOptions}
                />
            </>)}
            </>
        )}

        {isEditing && (
            (
                <div className="ml-2 relative z-40 flex bg-neutral-200 dark:bg-[#343541]/90 rounded"  
               >
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

        {editableField && isHovered  && !isEditing && !isScrolling && (
            <div
            className="absolute top-1 right-0 ml-auto z-10 flex-shrink-0 bg-neutral-200 dark:bg-[#343541]/90 rounded"
           style={{ transform: `translateX(${translateX}px)` }}> 
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
         <div className='flex flex-row gap-2' >
            <input type="checkbox" checked={fullAccess} onChange={(e) => {
                    const checked = e.target.checked;
                    setFullAccess(checked);
                    setOptions((prevOptions: any)=> 
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
    );
}



interface ToolsProps {
    setDocsIsOpen: (e: boolean) => void;
    onClose: () => void;
}


const APITools: FC<ToolsProps> = ({setDocsIsOpen, onClose}) => {
    const { state: {prompts, statsService}, dispatch: homeDispatch, handleNewConversation} = useContext(HomeContext);

    const promptsRef = useRef(prompts);

    useEffect(() => {
        promptsRef.current = prompts;
      }, [prompts]);

    const [activeTab, setActiveTab] = useState<string | null>(null);
    const [showApiDoc, setShowApiDoc] = useState(false);
    const [docUrl, setDocUrl] = useState<string | undefined>(undefined);
    const [csvUrl, setCsvUrl] = useState<string | undefined>(undefined);
    const [postmanUrl, setPostmanUrl] = useState<string | undefined>(undefined);
    const [fileContents, setFileContents] = useState<any>(undefined);
    const [isLoading, setIsLoading] = useState(false);
    


    const [keyManager, setKeyManager] = useState<Prompt | undefined>(promptsRef.current.find((a: Prompt) => a.id === "ast/assistant-api-key-manager"));
    const [apiAst, setApiAst] = useState<Prompt | undefined>(promptsRef.current.find((a: Prompt) => a.id === "ast/assistant-api-doc-helper"));


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

    const handleShowDocs = (val: boolean) => {
        setDocsIsOpen(val);
        setShowApiDoc(val);
    }

    const handleShowApiDoc = async () => {
            //check if expired 
        const isExpired = docUrl ? isUrlExpired(docUrl) : true;
        if (isExpired) {
            setIsLoading(true);
            const result = await fetchApiDoc();
            if (result.success) {
                handleShowDocs(true);
                setDocUrl(result.doc_url);
                setCsvUrl(result.csv_url);
                setPostmanUrl(result.postman_url);
            } else {
                docError();
            }
        } else {
            handleShowDocs(true);
        }
        
        
    }

    useEffect( () => {
        if (docUrl || csvUrl) {
            const tabToSwitch = docUrl ? 'Doc' : csvUrl ? "Downloads" : null;
            handleTabSwitch(tabToSwitch);
            setIsLoading(false);
        }
    }, [docUrl]);

    const docError = () => {
        handleShowDocs(false);
        alert("Unable to display API documentation at this time. Please try again later...");
        setIsLoading(false);
    }

    const handleStartConversation = (startPrompt: Prompt) => {
        if(isAssistant(startPrompt) && startPrompt.data){
            homeDispatch({field: 'selectedAssistant', value: startPrompt.data.assistant});
        }
        statsService.startConversationEvent(startPrompt);
        handleStartConversationWithPrompt(handleNewConversation, promptsRef.current, startPrompt);
        onClose();
    }

    const handleTabSwitch = async (tab: string | null) => {
        if (!tab) return;
        if (docUrl && tab === "Doc") {
                    const file = await fetchFile(docUrl);
                    setFileContents(file);
        }
        setActiveTab(tab);
        console.log("Active tab: ", tab)
    }

    return (
        <>
            <div className='mt-2 ml-5 flex flex-row gap-2 mx-2 flex justify-center'>
                <div className='mt-[-3px] text-sm py-2 mr-2 text-[0.8]'>API Tools and Resources</div>
                <label className='mt-2 text-xs '>|</label>
                    <SidebarActionButton
                    handleClick={() => handleShowApiDoc()}
                    title='View Amplify API Documentation'>
                      <div className='flex flex-row gap-1 text-[0.8]'>
                        Amplify API Documentation
                        <IconArticle size={18}/>
                      </div>  
                     </SidebarActionButton> 
                { keyManager && ( 
                    <>
                    <label className='mt-2 text-xs '>|</label>
                     <SidebarActionButton
                        handleClick={()=> handleStartConversation(keyManager)}
                        title='Chat with Amplify API Key Manager'>
                        <div className='flex flex-row gap-1 text-[0.8]'>
                            Amplify API Key Manager
                            <IconRobot size={20}/>
                        </div>  
                     </SidebarActionButton> 
                    </>
                )}

                { apiAst && ( 
                    <>
                    <label className='mt-2 text-xs '>|</label>
                     <SidebarActionButton
                        handleClick={()=> handleStartConversation(apiAst)}
                        title='Chat with Amplify API Assistant'>
                        <div className='flex flex-row gap-1 text-[0.8]'>
                            Amplify API Assistant
                            <IconRobot size={20}/>
                        </div>  
                     </SidebarActionButton> 
                     </>
                )}

                </div>

            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center z-60"
                    style={{ transform: `translateY(-25%)`}}>
                    <div className="p-3 flex flex-row items-center  border border-gray-500 bg-[#202123]">
                        <LoadingIcon style={{ width: "24px", height: "24px" }}/>
                        <span className="text-lg font-bold ml-2 text-white">Loading API Documentation...</span>
                    </div>
                </div>
            )
            }


            {showApiDoc && !isLoading &&  (
                <div className="absolute inset-0 flex items-center justify-start z-60">
                    <div className="p-3 flex flex-col items-center  border border-gray-500 bg-neutral-100 dark:bg-[#202123]"
                        style={{width: `${window.innerWidth}px`, height: `${window.innerHeight * 0.9}px`}}>
                            
                            <div className="mb-auto w-full flex flex-row gap-1 bg-neutral-100 dark:bg-[#202123] rounded-t border-b dark:border-white/20 z-60">
                                    {docUrl && (
                                        <button
                                            key={"Doc"}
                                            onClick={() => handleTabSwitch("Doc")}
                                            className={`p-2 rounded-t flex flex-shrink-0 ${activeTab === "Doc" ? 'border-l border-t border-r dark:border-gray-500 dark:text-white' : 'text-gray-400 dark:text-gray-600'}`}>
                                            <h3 className="text-xl">View Amplify API</h3> 
                                        </button> )}

                                    {csvUrl && (
                                        <button
                                            key={"Downloads"}
                                            onClick={() => handleTabSwitch("Downloads")}
                                            className={`p-2 rounded-t flex flex-shrink-0 ${activeTab === "Downloads" ? 'border-l border-t border-r dark:border-gray-500 dark:text-white' : 'text-gray-400 dark:text-gray-600'}`}>
                                            <h3 className="text-xl">Downloads</h3> 
                                        </button> )}

                                        <div className='ml-auto'>
                                            <SidebarActionButton
                                                handleClick={() => handleShowDocs(false)}
                                                title={"Close"}>
                                                <IconX size={20}/>
                                            </SidebarActionButton>
                                        </div>      
                            </div> 

                        { fileContents && activeTab === "Doc" &&
                            <iframe
                                src={fileContents}
                                width={`${window.innerWidth * 0.6 }px`}
                                height={`${window.innerHeight * 0.85}px`}
                                onError={() => docError}
                                style={{ border: 'none' }} />   
                            }  

                { activeTab === "Downloads" && 
                    <div className='absolute top-20 flex justify-center mt-4 flex-col text-lg'>
                    <label className='text-xl'> Available Amplify API Documentation Formats</label>
                    <div className='ml-6'>
                        {docUrl &&
                                <APIDownloadFile
                                label="Amplify API PDF"
                                presigned_url={docUrl}
                                IconSize={24}
                                />
                        }
                        {csvUrl && 
                            <APIDownloadFile
                                label="Amplify API CSV"
                                presigned_url={csvUrl}
                                IconSize={24}
                            />
                        }
                        {postmanUrl &&
                                <APIDownloadFile
                                label="Amplify API Postman Collection"
                                presigned_url={postmanUrl}
                                IconSize={24}
                                />
                        }
                    </div>
                    </div>
                        
                    } 

                

                    </div>
                </div>
            )}
    
        </>
    );
}