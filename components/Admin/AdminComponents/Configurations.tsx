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
        

    return <div className="admin-configurations-content"> 
            <div className="admin-config-section">
                <div className="admin-config-header">Admins</div>
                <div className="flex flex-col gap-6">
                    <div className="relative z-10 flex flex-row gap-2.5 h-0" style={{ transform: `translateX(160px)` }}>
                        {admins.length > 0 &&
                        <button onClick={ () => setIsDeleting(true)} 
                            className="admin-action-btn admin-action-btn-danger"
                            id="removeAdminButton"
                            title={"Remove Admins"}
                            >
                            <IconTrash size={15}/>
                            Remove Admins
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
                
                <div className="admin-user-list">
                    {admins.length === 0 ? (
                        <div className="text-center text-gray-500 dark:text-gray-400 w-full py-4">No admins to display</div>
                    ) : (
                        admins.map((user, index) => (
                            <div key={index} 
                                 id={`adminEmail${index}`} 
                                 className="admin-user-item"
                                 onMouseEnter={() => setHoveredUser(user)}
                                 onMouseLeave={() => setHoveredUser(null)}>
                                
                                {hoveredUser === user && !isDeleting && (
                                    <button
                                        type="button"
                                        id="deleteAdminUser"
                                        className="admin-action-btn admin-action-btn-danger text-xs px-2 py-1"
                                        onClick={() => handleUpdateAdmins(admins.filter((u: string) => u !== user))}
                                    >
                                        <IconTrash size={12} />
                                    </button>
                                )}
                                
                                {isDeleting && (
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
                                )}
                                
                                <span className="truncate">{user}</span>
                            </div>
                        ))
                    )}
                </div>
            </div>
            
            <div className="admin-config-section">
                <div className="admin-config-header">Support Email</div>
                <div className="flex flex-col gap-4">
                    <Checkbox
                        id="supportEmail"
                        label="Activates various communication features, such as 'Send Feedback' options, allowing users to contact the system administrator or support team directly through the application."
                        checked={emailSupport.isActive}
                        onChange={(isChecked: boolean) => {
                            handleUpdateEmailSupport({...emailSupport, isActive: isChecked});
                        }}
                    />

                    <div className={`${emailSupport.isActive ? "" :'opacity-30'}`}>
                        <InputsMap
                            id = {`${AdminConfigTypes.EMAIL_SUPPORT}`}
                            inputs={[ {label: 'Email', key: 'email', placeholder: 'Contact Email', disabled:!emailSupport.isActive} ]}
                            state ={{email : emailSupport.email ?? ''}}
                            inputChanged = {(key:string, value:string) => {
                                handleUpdateEmailSupport({...emailSupport, [key]: value});
                            }}
                        />
                    </div>
                </div>
            </div>
       
            <div className="admin-config-section">
                <div className="admin-config-header">Chat Rate Limit</div>
                <div className="flex flex-row gap-4">
                    <RateLimiter
                        period={rateLimit.period}
                        setPeriod={(p: PeriodType) => handleUpdateRateLimit({...rateLimit, period: p})}
                        rate={rateLimit.rate ? String(rateLimit.rate) : '0'}
                        setRate={(r: string) => handleUpdateRateLimit({...rateLimit, rate: r})}
                    />
                </div>
            </div>

            <div className="admin-config-section">
                <div className="admin-config-header">Default User Conversation Storage</div>
                <div className="flex flex-row gap-6">
                    {["future-local", "future-cloud"].map((storage) => (
                     <label className="flex items-center cursor-pointer" key={storage}>
                        <input type="radio" name="conversationStorage"
                        id="conversationStorageCheck"
                        value={storage}
                        checked={defaultConversationStorage === storage}
                        onChange={(event) =>  handleUpdateDefaultConversationStorage(event.target.value as ConversationStorage)}
                        className="admin-enhanced-checkbox mr-3"
                        />
                        <span className="text-gray-700 dark:text-gray-300 font-medium">
                            {capitalize(storage.split('-')[1])}
                        </span>
                    </label>
                  ))}
                </div>
            </div>
        

            <div className="admin-config-section">
                <div className="admin-config-header">Prompt Cost Alert</div>
                <div className="flex flex-col gap-4">
                    <Checkbox
                        id="promptCostAlert"
                        label="Alert the user when the cost of their prompt exceeds the set threshold"
                        checked={promptCostAlert.isActive}
                        onChange={(isChecked: boolean) => {
                            handleUpdatePromptCostAlert({...promptCostAlert, isActive: isChecked});
                        }}
                    />
                    
                    <div className={`flex flex-col gap-4 ${promptCostAlert.isActive ? "" :'opacity-30'}`}>
                        <div className="text-lg font-semibold text-center text-gray-700 dark:text-gray-300">Alert Message</div>
                        
                        <InfoBox 
                            content={
                            <span className="text-sm text-center"> 
                                To include dynamic values like the total cost or the number of prompts in the alert message, use placeholders in the following format: {"<placeholderName>"}.
                                <br className="mt-1"></br>
                                    Optional Supported Tags:<br></br>
                                <div className="text-start mt-2">
                                    &nbsp;&nbsp;&nbsp;&nbsp; * {"<totalCost>"}: Displays the calculated cost of sending the prompt.
                                    <br></br>
                                    &nbsp;&nbsp;&nbsp;&nbsp; * {"<prompts>"}: Displays the number of prompts needed to send their prompt.
                                </div>
                            </span>
                            }
                        />
                        
                        <textarea title="Parameter Description" 
                        className="admin-enhanced-input w-full"
                        placeholder="Alert message to display when the users prompt will cost over the threshold"
                        value={promptCostAlert.alertMessage} 
                        disabled={!promptCostAlert.isActive}
                        onChange={(e) => {
                            handleUpdatePromptCostAlert({...promptCostAlert, alertMessage: e.target.value});
                        }}
                        rows={3} 
                        />
                        
                        <div className="flex flex-row items-center gap-3">
                            <label className="text-gray-700 dark:text-gray-300 font-medium">Cost Threshold</label>
                            <input type="number" 
                                disabled={!promptCostAlert.isActive}
                                className="admin-enhanced-input text-center w-[120px]"
                                id="costThresholdInput"
                                min={0} step={.01} 
                                value={promptCostAlert.cost as number ?? 0}
                                onChange={(e) => {
                                    const value = parseFloat(e.target.value);
                                    handleUpdatePromptCostAlert({...promptCostAlert, cost: value});
                                }}
                            /> 
                        </div>
                    </div>
                </div>
            </div>

            <div className="admin-config-section">
                <div className="admin-config-header">Amplify Groups</div>
                <div className="flex flex-row gap-3 mb-4">
                    <button
                        title={isAddingAmpGroups ? "" : 'Add Amplify Group'}
                        disabled={isAddingAmpGroups !== null}
                        id="addAmplifyGroup"
                        className="admin-action-btn"
                        onClick={() => setIsAddingAmpGroups(emptyAmplifyGroups(userEmail ?? 'unknown'))}
                    >
                        <IconPlus size={16}/>
                        Add Group
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
                id="groupName"
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
                        <table className="admin-enhanced-table mt-4 w-full" id="groupTable">
                            <thead>
                            <tr>
                                {['Group Name', 'Members', 'Membership by Amplify Groups', 'Created By'
                                ].map((title, i) => (
                                <th key={i}
                                    id={title}
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
                                    <td className="px-4 py-2 break-words max-w-[200px]" id="groupName">
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
                                        className="admin-action-btn text-sm px-2 py-1"
                                        onClick={() => setAddingMembersTo(group.groupName)}
                                        >
                                        <IconPlus size={16} />
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
                                            className="admin-action-btn admin-action-btn-danger text-xs px-2 py-1"
                                            onClick={() => {
                                                const { [group.groupName]: _, ...remainingGroups } = ampGroups;
                                                handleUpdateAmpGroups(remainingGroups);
                                            }}
                                            >
                                            <IconTrash size={16} />
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
        </div>
    </div>

}


const emptyAmplifyGroups = (currentUser: string) => {
    return {
        groupName : '', // can be a cognito group per say
        members : [],
        createdBy : currentUser,
        includeFromOtherGroups : []
    } as Amplify_Group
}
