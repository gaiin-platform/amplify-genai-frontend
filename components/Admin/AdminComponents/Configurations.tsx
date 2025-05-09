import { FC, useState } from "react";
import { Amplify_Group, Amplify_Groups, AmplifyGroupSelect, EmailSupport, PromptCostAlert, titleLabel, UserAction } from "../AdminUI";
import { AdminConfigTypes} from "@/types/admin";
import { IconPlus, IconTrash, IconX } from "@tabler/icons-react";
import Checkbox from "@/components/ReusableComponents/CheckBox";
import ExpansionComponent from "@/components/Chat/ExpansionComponent";
import { RateLimiter } from "@/components/Settings/AccountComponents/RateLimit";
import { PeriodType } from "@/types/rateLimit";
import { InfoBox } from "@/components/ReusableComponents/InfoBox";
import Search from "@/components/Search";
import ActionButton from "@/components/ReusableComponents/ActionButton";
import { useSession } from "next-auth/react";
import InputsMap from "@/components/ReusableComponents/InputMap";
import { AddEmailWithAutoComplete } from "@/components/Emails/AddEmailsAutoComplete";
import { ConversationStorage } from "@/types/conversationStorage";
import { capitalize } from "@/utils/app/data";

interface Props {
    admins: string[];
    setAdmins: (a: string[]) => void;

    ampGroups: Amplify_Groups;
    setAmpGroups: (g: Amplify_Groups) => void;

    rateLimit: {period: PeriodType, rate: string};
    setRateLimit: (l: {period: PeriodType, rate: string}) => void;

    promptCostAlert: PromptCostAlert;
    setPromptCostAlert: (a: PromptCostAlert) => void;

    defaultConversationStorage: ConversationStorage;
    setDefaultConversationStorage: (s: ConversationStorage) => void;

    emailSupport: EmailSupport;
    setEmailSupport: (e :EmailSupport) => void;

    allEmails: Array<string> | null;

    admin_text: string;
    updateUnsavedConfigs: (t: AdminConfigTypes) => void;   
}

export const ConfigurationsTab: FC<Props> = ({admins, setAdmins, ampGroups, setAmpGroups, allEmails,
                                              rateLimit, setRateLimit, promptCostAlert, setPromptCostAlert,
                                              defaultConversationStorage, setDefaultConversationStorage,
                                              emailSupport, setEmailSupport, admin_text, updateUnsavedConfigs}) => {

    const { data: session } = useSession();
    const userEmail = session?.user?.email;

    const [isDeleting, setIsDeleting] = useState<boolean>(false);
    const [deleteUsersList, setDeleteUsersList] = useState<string[]>([]);
    const [hoveredUser, setHoveredUser] = useState<string | null>(null);
    const [addingMembersTo, setAddingMembersTo] = useState<string | null>(null);
    const [hoveredAmpGroup, setHoveredAmpGroup] = useState<string>('');  
    const [hoveredAmpMember, setHoveredAmpMember] = useState<{ ampGroup: string; username: string } | null>(null);
    const [isAddingAmpGroups, setIsAddingAmpGroups] = useState<Amplify_Group | null>(null);
    const [ampGroupSearchTerm, setAmpGroupSearchTerm] = useState<string>(''); 
    const [showAmpGroupSearch, setShowAmpGroupsSearch] = useState<boolean>(true);  


    const handleUpdateAdmins = (updatedAdmins: string[]) => {
        setAdmins(updatedAdmins);
        updateUnsavedConfigs(AdminConfigTypes.ADMINS);
    }

    const handleUpdateRateLimit = (updatedRateLimit: {period: PeriodType, rate: string }) => {
        setRateLimit(updatedRateLimit);
        updateUnsavedConfigs(AdminConfigTypes.RATE_LIMIT);
    }

    const handleUpdatePromptCostAlert = (updatedPromptCostAlert: PromptCostAlert) => {
        setPromptCostAlert(updatedPromptCostAlert);
        updateUnsavedConfigs(AdminConfigTypes.PROMPT_COST_ALERT);
    }

    const handleUpdateDefaultConversationStorage = (updatedDefaultConversationStorage: string) => {
        setDefaultConversationStorage(updatedDefaultConversationStorage as ConversationStorage);
        updateUnsavedConfigs(AdminConfigTypes.DEFAULT_CONVERSATION_STORAGE);
    }

    const handleUpdateEmailSupport = (updatedEmailSupport: EmailSupport) => {
        setEmailSupport(updatedEmailSupport);
        updateUnsavedConfigs(AdminConfigTypes.EMAIL_SUPPORT);
    }


    const handleUpdateAmpGroups = (updatedGroups: Amplify_Groups) => {
        setAmpGroups(updatedGroups);
        updateUnsavedConfigs(AdminConfigTypes.AMPLIFY_GROUPS);
    }
        

    return <> 
            {titleLabel('Admins')}
            <div className="ml-10 flex flex-col gap-6 mt-2">
                    <div className="relative z-10 flex flex-row gap-2.5 h-0" style={{ transform: `translateX(160px)` }}>
                        {admins.length > 0 &&
                        <button onClick={ () => setIsDeleting(true)} style={{ display: 'flex', cursor: 'pointer' }}
                            className="flex flex-shrink-0"
                            title={"Remove Admins"}
                            >
                            <IconTrash className="mt-0.5" size={15}/>
                            <span style={{marginLeft: '10px'}}>{"Remove Admins"}</span>
                        </button>}

                        {isDeleting && 
                        <>
                            <UserAction
                                label={"Remove Admins"}
                                onConfirm={() => {
                                    if (deleteUsersList.length > 0) {
                                        const updatedAdmins = admins.filter(admin => !deleteUsersList.includes(admin));
                                        handleUpdateAdmins(updatedAdmins);
                                    }
                                }}
                                onCancel={() => {
                                    setIsDeleting(false);
                                    setDeleteUsersList([]);
                                }}
                                top="mt-[2px]"
                            />
                            <div className="mt-[-2px]">
                                <Checkbox
                                    id={`selectAll${AdminConfigTypes.ADMINS}`}
                                    label=""
                                    checked={deleteUsersList.length === admins.length}
                                    onChange={(isChecked: boolean) => {
                                        if (isChecked) {
                                            // If checked, add all user names to the list
                                            setDeleteUsersList(admins.map((a:string) => a));
                                        } else {
                                            setDeleteUsersList([]);
                                        }
                                    }}
                                />
                            </div>
                        </>
                        }
                    </div>
                    <div className='w-full pr-20 relative min-w-[300px]'
                        style={{ transform: `translateY(-24px)` }}>

                        <ExpansionComponent 
                            title={'Add Admins'} 
                            content={ 
                                <AddEmailWithAutoComplete
                                id={String(AdminConfigTypes.ADMINS)}
                                emails={admins}
                                allEmails={allEmails ?? []}
                                handleUpdateEmails={(updatedAdmins: Array<string>) => handleUpdateAdmins(updatedAdmins)}
                                />
                            }
                            closedWidget= { <IconPlus size={18} />}
                        />

                    </div>

            </div>
                
            <div className="ml-10 pr-5 ">
            
                {admins.length === 0 ? (
                        <div className="ml-4">No admins to display</div>
                    ) : (
                        <div className="flex flex-wrap ">
                        {admins
                            .map((user, index) => (
                            <div key={index} className="border border-neutral-500 flex items-center">
                                <div
                                className="flex items-center"
                                onMouseEnter={() => setHoveredUser(user)}
                                onMouseLeave={() => setHoveredUser(null)}
                                >
                                <div className="min-w-[28px] flex items-center ml-2">
                                {hoveredUser === user && !isDeleting && (
                                    <button
                                    type="button"
                                    className="p-0.5 text-sm bg-neutral-400 dark:bg-neutral-500 rounded hover:bg-red-600 dark:hover:bg-red-700 focus:outline-none"
                                    onClick={() => handleUpdateAdmins(admins.filter((u: string) => u !== user))}
                                    >
                                    <IconTrash size={16} />
                                    </button>
                                )}
                                    {isDeleting && (
                                    <div className="ml-0.5">
                                        <Checkbox
                                            id={`${index}${AdminConfigTypes.ADMINS}`}
                                            label=""
                                            checked={deleteUsersList.includes(user)}
                                            onChange={(isChecked: boolean) => {
                                                if (isChecked) {
                                                    setDeleteUsersList((prevList) => [...prevList, user]);
                                        } else {
                                            setDeleteUsersList((prevList) =>
                                            prevList.filter((name) => name !== user)
                                            );
                                        }
                                            }}
                                        />
                                    </div>
                                    )}
                                </div>
                                <span className="truncate pr-8 py-2 mr-1">{user}</span>
                            
                                </div>
                            </div>
                            ))}
                    </div>)}

            </div>
            
            {titleLabel('Support Email')}
            <div className="px-6 mr-4">
            <Checkbox
                id="supportEmail"
                label="Activates various communication features, such as 'Send Feedback' options, allowing users to contact the system administrator or support team directly through the application."
                checked={emailSupport.isActive}
                onChange={(isChecked: boolean) => {
                    handleUpdateEmailSupport({...emailSupport, isActive: isChecked});
                }}
            />
            </div>

            <div className={`mx-12 ${emailSupport.isActive ? "" :'opacity-30'}`}>
                <InputsMap
                    id = {`${AdminConfigTypes.EMAIL_SUPPORT}`}
                    inputs={[ {label: 'Email', key: 'email', placeholder: 'Contact Email', disabled:!emailSupport.isActive} ]}
                    state ={{email : emailSupport.email ?? ''}}
                    inputChanged = {(key:string, value:string) => {
                        handleUpdateEmailSupport({...emailSupport, [key]: value});
                    }}
                />
            </div>
       
            <div className="flex flex-row gap-6">
            {titleLabel('Chat Rate Limit')}
                <span className="mt-4 h-[28px] flex flex-row gap-4">
                <RateLimiter
                    period={rateLimit.period}
                    setPeriod={(p: PeriodType) => handleUpdateRateLimit({...rateLimit, period: p})}
                    rate={rateLimit.rate ? String(rateLimit.rate) : '0'}
                    setRate={(r: string) => handleUpdateRateLimit({...rateLimit, rate: r})}
                /></span>
            
            </div>

            
            <div className="flex flex-row gap-6">
                {titleLabel('Default User Conversation Storage')}
                {["future-local", "future-cloud"].map((storage) => (
                 <label className="flex items-center mt-5" key={storage}>
                    <input type="radio" name="conversationStorage"
                    value={storage}
                    checked={defaultConversationStorage === storage}
                    onChange={(event) =>  handleUpdateDefaultConversationStorage(event.target.value as ConversationStorage)}
                    className="form-radio cursor-pointer"
                    />
                    <span className="ml-2 text-neutral-700 dark:text-neutral-200">
                        {capitalize(storage.split('-')[1])}
                    </span>
                </label>
              ))}
            </div>
        

            {titleLabel('Prompt Cost Alert')}
            <div className="px-6 mr-6">
            <Checkbox
                id="promptCostAlert"
                label="Alert the user when the cost of their prompt exceeds the set threshold"
                checked={promptCostAlert.isActive}
                onChange={(isChecked: boolean) => {
                    handleUpdatePromptCostAlert({...promptCostAlert, isActive: isChecked});
                }}
            />
            <div className={`ml-6 flex flex-col ${promptCostAlert.isActive ? "" :'opacity-30'}`}>
                <div className="text-md w-full text-center">Alert Message</div>
                <InfoBox 
                    content={
                    <span className="text-sm w-full text-center"> 
                        To include dynamic values like the total cost or the number of prompts in the alert message, use placeholders in the following format: {"<placeholderName>"}.
                        <br className="mt-1"></br>
                            Optional Supported Tags:<br></br>
                        <div className="flex justify-center text-start">
                            &nbsp;&nbsp;&nbsp;&nbsp; * {"<totalCost>"}: Displays the calculated cost of sending the prompt.
                            <br></br>
                            &nbsp;&nbsp;&nbsp;&nbsp; * {"<prompts>"}: Displays the number of prompts needed to send their prompt.
                        </div>
                    </span>
                    }
                />
                <textarea title="Parameter Description" className={`w-full ${admin_text}`}
                placeholder={"Alert message to display when the users prompt will cost over the threshold"}
                value={promptCostAlert.alertMessage} disabled={!promptCostAlert.isActive}
                onChange={(e) => {
                    handleUpdatePromptCostAlert({...promptCostAlert, alertMessage: e.target.value});
                }}
                rows={1} 
                />
                <div className="mt-2 flex flex-row gap-3">
                Cost Threshold
                <input type="number" disabled={!promptCostAlert.isActive}
                        className="text-center w-[100px] dark:bg-[#40414F] bg-gray-200"
                        min={0} step={.01} value={promptCostAlert.cost as number?? 0 }
                        onChange={(e) => {
                            const value = parseFloat(e.target.value);
                            handleUpdatePromptCostAlert({...promptCostAlert, cost: value});
                        }}
                /> 
                </div>
            </div>
            </div>

            <div className="flex flex-row gap-3 mb-2 ">
            {titleLabel('Amplify Groups')}
            <button
                title={isAddingAmpGroups ? "" : 'Add Amplify Group'}
                disabled={isAddingAmpGroups !== null}
                className={`ml-1 mt-3 flex-shrink-0 items-center gap-3 rounded-md border border-neutral-300 dark:border-white/20 px-2 transition-colors duration-200  ${ isAddingAmpGroups ? "" : " cursor-pointer hover:bg-neutral-200 dark:hover:bg-gray-500/10" }`}
                onClick={() => setIsAddingAmpGroups(emptyAmplifyGroups(userEmail ?? 'unknown'))}
            >
                <IconPlus size={16}/>
            </button>

            {isAddingAmpGroups && 
                <UserAction
                top={"mt-4"}
                label={"Add Template"}
                clearOnConfirm={false}
                onConfirm={() => {
                    const name = isAddingAmpGroups.groupName;
                    if (!name) {
                        alert(`Group name is required. Please enter a name and try again.`);
                        return;
                    }
                    if (Object.keys(ampGroups).includes(name)){
                        alert(`There already exists a group with the name ${name}.\n\n Please change the group name to create the Amplify Group.`);
                    } else {
                        setAmpGroupSearchTerm('');
                        handleUpdateAmpGroups({...ampGroups, [name] : isAddingAmpGroups});
                        setIsAddingAmpGroups(null);
                    }
                }}
                onCancel={() => {
                    setIsAddingAmpGroups(null);
                }}
            /> 
            }

            { showAmpGroupSearch && !isAddingAmpGroups && Object.keys(ampGroups).length > 0 &&
                    <div className="ml-auto mr-12" style={{transform: 'translateY(36px)'}}>
                        <Search
                        placeholder={'Search Amplify Groups...'}
                        searchTerm={ampGroupSearchTerm}
                        onSearch={(searchTerm: string) => setAmpGroupSearchTerm(searchTerm.toLocaleLowerCase())}
                        />
                    </div>}

        </div>
        
        {isAddingAmpGroups && 
            <div className="ml-6 flex flex-row flex-shrink-0 mr-4 ">
                <label className="flex-shrink-0 border border-neutral-400 dark:border-[#40414F] p-2 rounded-l text-[0.9rem] whitespace-nowrap text-center"
                >Group Name </label>
                <input
                title={"Group names must be unique"}
                className={`w-[200px] ${admin_text}`}
                placeholder={"Group Name"}
                onChange={(e) => {
                    setIsAddingAmpGroups({...isAddingAmpGroups, groupName: e.target.value});
                }}
                value={isAddingAmpGroups.groupName}
                />
                <div className="ml-4 flex-grow flex flex-col mt-[-32px] max-w-[40%]">
                    <AddEmailWithAutoComplete
                        id={`${String(AdminConfigTypes.AMPLIFY_GROUPS)}_ADD`}
                        emails={isAddingAmpGroups.members}
                        allEmails={allEmails ?? []}
                        handleUpdateEmails={(updatedEmails: Array<string>) => 
                            setIsAddingAmpGroups({...isAddingAmpGroups, members : updatedEmails})
                        }
                    />
                    <div className="h-[40px] rounded-r border border-neutral-500 pl-4 py-1 dark:bg-[#40414F] bg-gray-200 dark:text-neutral-100 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 overflow-x-auto">
                    {isAddingAmpGroups.members.map((user, idx) => (
                        <div key={idx} className="flex items-center gap-1 mr-1">
                            <span className="flex flex-row gap-4 py-2 mr-4"> 
                                {user} 
                                <button
                                className={`text-red-500 hover:text-red-800 `}
                                onClick={() => {
                                    const updatedMembers = isAddingAmpGroups.members.filter(
                                                            (u) => u !== user);
                                    setIsAddingAmpGroups({...isAddingAmpGroups, members : updatedMembers})
                                }} >
                                <IconTrash size={16} />
                                </button>
                            </span>
                        </div>
                        ))}
                    </div>
                            
                </div>
                <div className="flex-grow ml-4 flex flex-col mt-[-26px] max-w-[40%]">
                    <InfoBox content={
                            <span className="ml-1 text-xs w-full text-center"> 
                            The group will include all members from the following Amplify Groups
                            </span>
                        }/>
                        
                    <AmplifyGroupSelect 
                        groups={Object.keys(ampGroups)}
                        selected={isAddingAmpGroups.includeFromOtherGroups ?? []}
                        setSelected={(selectedGroups: string[]) => {
                            setIsAddingAmpGroups({...isAddingAmpGroups, includeFromOtherGroups: selectedGroups});
                        }}
                    /> 
                </div>
            </div>
        }


        <div className="ml-6 mt-6 mb-10">
            {Object.keys(ampGroups).length > 0 ?
                    <ExpansionComponent 
                    onOpen={() => setShowAmpGroupsSearch(true)}
                    onClose={() => {
                        setShowAmpGroupsSearch(false);
                        setAmpGroupSearchTerm('');
                    }}
                    title={'Manage Amplify Groups'} 
                    content={ 
                        <>
                        <table className="mt-4 border-collapse w-full mr-10" >
                            <thead>
                            <tr className="bg-gray-200 dark:bg-[#373844] ">
                                {['Group Name', 'Members', 'Membership by Amplify Groups', 'Created By'
                                ].map((title, i) => (
                                <th key={i}
                                    className="px-1 text-center border border-gray-500 text-neutral-600 dark:text-neutral-300"
                                    style={{width: i === 0 || i === 3 ? "15%" 
                                            : "35%", 
                                    }}> 
                                    {title}
                                </th>
                                ))}
                            </tr>
                            </thead>
                            <tbody>
                            {Object.values(ampGroups)
                                    .filter((group: Amplify_Group) => ampGroupSearchTerm ? 
                                            group.groupName.toLowerCase().includes(ampGroupSearchTerm) : true)
                                    .map((group: Amplify_Group) => 
                                <tr key={group.groupName}
                                    onMouseEnter={() => setHoveredAmpGroup(group.groupName)}
                                    onMouseLeave={() => setHoveredAmpGroup('')}>
                                    <td className="border border-neutral-500 px-4 py-2 break-words max-w-[200px]">
                                        {group.groupName}
                                    </td>

                                    <td className="flex-grow border border-neutral-500 pl-1 pr-2 max-w-[300px]">

                                    <div className={`flex items-center ${addingMembersTo === group.groupName ? "flex-col":'flex-row'}`}>
                                    <div
                                        className={`flex items-center ${addingMembersTo === group.groupName ? "flex-wrap": "overflow-x-auto"}`} >
                                        {group.members?.map((user, idx) => (
                                        <div key={idx} className="flex items-center gap-1 mr-1"
                                            onMouseEnter={() => {
                                                if (group.includeFromOtherGroups !== undefined)
                                                    setHoveredAmpMember( {ampGroup: group.groupName,     
                                                                            username: user})
                                            }}
                                            onMouseLeave={() => setHoveredAmpMember(null)}>
                                            
                                            <span className="flex flex-row gap-1 py-2 mr-4"> {idx > 0 && <label className="opacity-60">|</label>}
                                                { hoveredAmpMember?.ampGroup === group.groupName && hoveredAmpMember?.username === user ?
                                                <button
                                                className={`text-red-500 hover:text-red-800 `}
                                                onClick={() => {
                                                    const updatedMembers = group.members?.filter(
                                                    (u) => u !== user
                                                    );
                                                    const updatedGroup = {...group, members: updatedMembers}
                                                    handleUpdateAmpGroups({...ampGroups, [group.groupName] : updatedGroup});
                                                }} >
                                                <IconTrash size={16} />
                                                </button> : <div className="w-[16px]"></div>}
                                                {user} 
                                            </span>
                                        </div>
                                        ))}
                                    </div>

                                    {addingMembersTo === group.groupName && 
                                        group.includeFromOtherGroups !== undefined ? (
                                        <div className="flex flex-row pr-3 ml-2 mt-2" style={{ width: '100%' }}>
                                        <ActionButton
                                            title="Close"
                                            handleClick={() => setAddingMembersTo(null)}
                                        >
                                            <IconX size={20}/>   
                                        </ActionButton>
                                        
                                        <div className=""> <AddEmailWithAutoComplete
                                            id={`${String(AdminConfigTypes.AMPLIFY_GROUPS)}_EDIT`}
                                            emails={group.members ?? []}
                                            allEmails={allEmails ?? []}
                                            handleUpdateEmails={(updatedMembers: Array<string>) => {
                                                const updatedGroup = {...group, members: updatedMembers}
                                                handleUpdateAmpGroups({...ampGroups, [group.groupName] : updatedGroup});
                                            }}
                                        /> </div>
                                        </div>
                                    ) : (
                                        (group.includeFromOtherGroups !== undefined ?
                                        <button
                                        className="ml-auto flex items-center px-2 text-blue-500 hover:text-blue-600 flex-shrink-0"
                                        onClick={() => setAddingMembersTo(group.groupName)}
                                        >
                                        <IconPlus size={18} />
                                        {!(group.members && group.members.length > 0) && (
                                            <span>Add Members</span>
                                        )}
                                        </button> : null)
                                    )}
                                    </div>
                                </td>

                                    <td className="border border-neutral-500 max-w-[300px]">
                                        {group.includeFromOtherGroups !== undefined ?
                                        <AmplifyGroupSelect 
                                            groups={Object.keys(ampGroups).filter((k: string) => 
                                                                        k != group.groupName)}
                                            selected={group.includeFromOtherGroups}
                                            setSelected={(selectedGroups: string[]) => {
                                                const updatedGroup = {...group, includeFromOtherGroups: selectedGroups}
                                                handleUpdateAmpGroups({...ampGroups, [group.groupName] : updatedGroup});
                                            }}
                                        /> : <div className="text-center">N/A</div>
                                        }
                                    </td>

                                    <td className="text-center border border-neutral-500 px-4 py-2 break-words max-w-[300px]">
                                        {group.createdBy}
                                    </td>

                                    <td>
                                        <div className="w-[50px] flex-shrink-0">
                                        {hoveredAmpGroup === group.groupName && group.includeFromOtherGroups !== undefined ?
                                        <button
                                            title={"Delete Amplify Group"}
                                            type="button"
                                            className="ml-2 p-1 text-sm bg-neutral-400 dark:bg-neutral-500 rounded hover:bg-red-600 dark:hover:bg-red-700 focus:outline-none"
                                            onClick={() => {
                                                const { [group.groupName]: _, ...remainingGroups } = ampGroups;
                                                handleUpdateAmpGroups(remainingGroups);
                                            }}
                                            >
                                            <IconTrash size={20} />
                                        </button>
                                        
                                        : null}
                                        </div>
                                    </td>
                                </tr>     
                            )}
                            </tbody>
                        </table> 
    
                        </>
                    }
                    isOpened={true}
                />  
                    :
                    <>No Amplify Groups listed. </>
                }
        </div>
                
    </>

}


const emptyAmplifyGroups = (currentUser: string) => {
    return {
        groupName : '', // can be a cognito group per say
        members : [],
        createdBy : currentUser,
        includeFromOtherGroups : []
    } as Amplify_Group
}
