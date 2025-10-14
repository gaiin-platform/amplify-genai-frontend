import { FC, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Amplify_Group, Amplify_Groups, AmplifyGroupSelect, EmailSupport, PromptCostAlert, titleLabel, UserAction } from "../AdminUI";
import { AdminConfigTypes} from "@/types/admin";
import { IconPlus, IconTrash, IconX, IconCloudFilled, IconMessage, IconCheck, IconEdit, IconFileImport } from "@tabler/icons-react";
import Checkbox from "@/components/ReusableComponents/CheckBox";
import ExpansionComponent from "@/components/Chat/ExpansionComponent";
import { RateLimiter } from "@/components/Settings/AccountComponents/RateLimit";
import { PeriodType, formatRateLimit, rateLimitObj, noRateLimit } from "@/types/rateLimit";
import { InfoBox } from "@/components/ReusableComponents/InfoBox";
import Search from "@/components/Search";
import ActionButton from "@/components/ReusableComponents/ActionButton";
import { useSession } from "next-auth/react";
import InputsMap from "@/components/ReusableComponents/InputMap";
import { AddEmailWithAutoComplete } from "@/components/Emails/AddEmailsAutoComplete";
import { ConversationStorage } from "@/types/conversationStorage";
import { capitalize } from "@/utils/app/data";
import { CsvUpload } from "@/components/ReusableComponents/CsvUpload";
import { CsvPreviewModal } from "@/components/ReusableComponents/CsvPreviewModal";
import { useCsvUpload } from "@/hooks/useCsvUpload";
import { AdminCsvUploadConfig, AdminCsvPreviewConfig } from "@/config/csvUploadConfigs";
import toast from "react-hot-toast";

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

    aiEmailDomain: string;
    setAiEmailDomain?: (d: string) => void;

    allEmails: Array<string> | null;

    admin_text: string;
    updateUnsavedConfigs: (t: AdminConfigTypes) => void;
    onModalStateChange?: (hasOpenModal: boolean) => void;   
}

export const ConfigurationsTab: FC<Props> = ({admins, setAdmins, ampGroups, setAmpGroups, allEmails,
                                              rateLimit, setRateLimit, promptCostAlert, setPromptCostAlert,
                                              defaultConversationStorage, setDefaultConversationStorage,
                                              emailSupport, setEmailSupport, aiEmailDomain, setAiEmailDomain,
                                              admin_text, updateUnsavedConfigs, onModalStateChange}) => {

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
    const [editingRateLimit, setEditingRateLimit] = useState<string | null>(null);
    const [tempRateLimitPeriod, setTempRateLimitPeriod] = useState<PeriodType>('Unlimited');
    const [tempRateLimitRate, setTempRateLimitRate] = useState<string>('0');  
    const [hoveredRateLimit, setHoveredRateLimit] = useState<string | null>(null);
    const [showAddAdminInput, setShowAddAdminInput] = useState<boolean>(false);
    
    // Admin CSV Upload functionality using the new generic hook
    const adminCsvUpload = useCsvUpload({
        uploadConfig: AdminCsvUploadConfig,
        previewConfig: AdminCsvPreviewConfig,
        existingItems: admins,
        onImportComplete: async (newAdmins: string[]) => {
            const updatedAdmins = [...admins, ...newAdmins];
            handleUpdateAdmins(updatedAdmins);
        },
        onImportSuccess: (newAdmins: string[]) => {
            toast.success(`Successfully imported ${newAdmins.length} admin(s)`);
        },
        onImportError: (error: Error) => {
            toast.error('Failed to import admins. Please try again.');
        }
    });

    // Notify parent about modal state changes
    useEffect(() => {
        onModalStateChange?.(adminCsvUpload.hasOpenModal);
    }, [adminCsvUpload.hasOpenModal, onModalStateChange]);

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

    const handleUpdateAiEmailDomain = (updatedAiEmailDomain: string) => {
        if (!setAiEmailDomain) return;
        setAiEmailDomain(updatedAiEmailDomain);
        updateUnsavedConfigs(AdminConfigTypes.AI_EMAIL_DOMAIN);
    }


    const handleUpdateAmpGroups = (updatedGroups: Amplify_Groups) => {
        setAmpGroups(updatedGroups);
        updateUnsavedConfigs(AdminConfigTypes.AMPLIFY_GROUPS);
    }


    return <> 
    <div className="admin-style-settings-card overflow-x-hidden">
        <div className="admin-style-settings-card-header">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="admin-style-settings-card-title">Admins</h3>
                        <p className="admin-style-settings-card-description">Manage the admins of the admin panel</p>
                    </div>
                    <button
                        title="Import Admins from CSV"
                        onClick={adminCsvUpload.openUpload}
                        className="flex items-center cursor-pointer group px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                        id="csvUploadButton"
                    >
                        <div className="icon-pop-group">
                            <IconFileImport size={18} />
                        </div>
                        <span style={{marginLeft: '10px'}}>Upload Admins</span>
                    </button>
                </div>
            </div>
                
                <div className="settings-card-content px-6">
                    <div className='w-full pr-20 relative'>
                        {/* Buttons on same line */}
                        <div className="flex items-start gap-4 mb-4">
                            {/* Add Admins button */}
                            <button 
                                className="flex items-center cursor-pointer group"
                                onClick={() => setShowAddAdminInput(!showAddAdminInput)}
                                title="Add Admins"
                            >
                                <div className="icon-pop-group">
                                    <IconPlus size={18} />
                                </div>
                                <span style={{marginLeft: '10px'}}>Add Admins</span>
                            </button>

                            {/* Remove Admins button */}
                            {admins.length > 0 && (
                                <button 
                                    onClick={() => setIsDeleting(true)} 
                                    className="flex items-center cursor-pointer group"
                                    id="removeAdminButton"
                                    title="Remove Admins"
                                >
                                    <div className="icon-pop-group">
                                        <IconTrash size={15}/>
                                    </div>
                                    <span style={{marginLeft: '10px'}}>Remove Admins</span>
                                </button>
                            )}

                            {/* Delete confirmation controls - simple, no red box */}
                            {isDeleting && (
                                <div className="flex items-center gap-3 ml-4">
                                    <UserAction
                                        label="Confirm Removal"
                                        onConfirm={() => {
                                            if (deleteUsersList.length > 0) {
                                                const updatedAdmins = admins.filter(admin => !deleteUsersList.includes(admin));
                                                handleUpdateAdmins(updatedAdmins);
                                            }
                                            setIsDeleting(false);
                                            setDeleteUsersList([]);
                                        }}
                                        onCancel={() => {
                                            setIsDeleting(false);
                                            setDeleteUsersList([]);
                                        }}
                                        top="mt-0"
                                    />
                                    <Checkbox
                                        id={`selectAll${AdminConfigTypes.ADMINS}`}
                                        label="Select All"
                                        checked={deleteUsersList.length === admins.length}
                                        onChange={(isChecked: boolean) => {
                                            if (isChecked) {
                                                setDeleteUsersList(admins.map((a:string) => a));
                                            } else {
                                                setDeleteUsersList([]);
                                            }
                                        }}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Add Admin input - full width on new line - only show when button clicked */}
                        {showAddAdminInput && (
                            <div className="w-full mb-4">
                                <AddEmailWithAutoComplete
                                    id={String(AdminConfigTypes.ADMINS)}
                                    emails={admins}
                                    allEmails={allEmails ?? []}
                                    handleUpdateEmails={(updatedAdmins: Array<string>) => handleUpdateAdmins(updatedAdmins)}
                                />
                            </div>
                        )}
                    </div>
            </div>
                
            <div className="ml-10 pr-5 ">
            
                {admins.length === 0 ? (
                        <div className="ml-4">No admins to display</div>
                    ) : (
                        <div className="flex flex-wrap ">
                        {admins
                            .map((user, index) => (
                            <div key={index} id={`adminEmail${index}`} className="border border-neutral-500 flex items-center">
                                <div
                                className="flex items-center"
                                onMouseEnter={() => setHoveredUser(user)}
                                onMouseLeave={() => setHoveredUser(null)}
                                >
                                <div className="min-w-[28px] flex items-center ml-2">
                                {hoveredUser === user && !isDeleting && (
                                    <button
                                    type="button"
                                    id="deleteAdminUser"
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
        </div>
            
            <div className="admin-style-settings-card">
                <div className="admin-style-settings-card-header">
                    <h3 className="admin-style-settings-card-title">Support Email</h3>
                    <p className="admin-style-settings-card-description">Configure email support features and contact information</p>
                </div>
                
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
            </div>
       
            {setAiEmailDomain && 
            <div className="admin-style-settings-card">
                <div className="admin-style-settings-card-header">
                    <h3 className="admin-style-settings-card-title">AI Email Domain</h3>
                    <p className="admin-style-settings-card-description">Set the email domain that allows users to email AI assistants directly (e.g., user+tag@domain.com)</p>
                </div>
                
                <div className="mx-12">
                    <InputsMap
                        id = {`${AdminConfigTypes.AI_EMAIL_DOMAIN}`}
                        inputs={[ {label: 'Domain', key: 'domain', placeholder: 'AI Email Domain', disabled: false} ]}
                        state ={{domain : aiEmailDomain ?? ''}}
                        inputChanged = {(key:string, value:string) => {
                            handleUpdateAiEmailDomain(value);
                        }}
                    />
                </div>
            </div>}
       
            <div className="admin-style-settings-card">
                <div className="admin-style-settings-card-header">
                    <div className="flex items-center gap-3 mb-2">
                        <h3 className="admin-style-settings-card-title">Chat Rate Limit</h3>
                        <div className="h-[28px] flex flex-row gap-4">
                            <RateLimiter
                                period={rateLimit.period}
                                setPeriod={(p: PeriodType) => handleUpdateRateLimit({...rateLimit, period: p})}
                                rate={rateLimit.rate ? String(rateLimit.rate) : '0'}
                                setRate={(r: string) => handleUpdateRateLimit({...rateLimit, rate: r})}
                            />
                        </div>
                    </div>
                    <p className="admin-style-settings-card-description">Configure rate limiting for chat messages to control usage</p>
                </div>
            </div>

            
            <div className="admin-style-settings-card flex flex-row gap-14">
                <div className="admin-style-settings-card-header">
                    <h3 className="admin-style-settings-card-title">Default User Conversation Storage</h3>
                    <p className="admin-style-settings-card-description">Choose the default storage location for user conversations</p>
                </div>
                
                <div className="settings-theme-options">
                    {["future-local", "future-cloud"].map((storage) => (
                        <label className="settings-theme-option" key={storage}>
                            <input 
                                type="radio" 
                                name="conversationStorage"
                                id="conversationStorageCheck"
                                value={storage}
                                checked={defaultConversationStorage === storage}
                                onChange={(event) => handleUpdateDefaultConversationStorage(event.target.value as ConversationStorage)}
                                className="settings-theme-radio"
                            />
                            <div className="settings-theme-option-content">
                                <div className="settings-theme-option-icon">
                                    {storage === 'future-cloud' ? 
                                        <IconCloudFilled className='text-blue-100 dark:text-white'/> : 
                                        <IconMessage className='text-gray-600 dark:text-white'/>
                                    }
                                </div>
                                <span className="settings-theme-option-label">
                                    {capitalize(storage.split('-')[1])}
                                </span>
                            </div>
                        </label>
                    ))}
                </div>
            </div>
        

            <div className="admin-style-settings-card">
                <div className="admin-style-settings-card-header">
                    <h3 className="admin-style-settings-card-title">Prompt Cost Alert</h3>
                    <p className="admin-style-settings-card-description">Alert the user when the cost of their prompt exceeds the set threshold</p>
                </div>
                
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
                            id="costThresholdInput"
                            min={0} step={.01} value={promptCostAlert.cost as number?? 0 }
                            onChange={(e) => {
                                const value = parseFloat(e.target.value);
                                handleUpdatePromptCostAlert({...promptCostAlert, cost: value});
                            }}
                    /> 
                    </div>
                </div>
                </div>
            </div>

            <div className="admin-style-settings-card">
                <div className="admin-style-settings-card-header">
                    <div className="flex items-center gap-3 mb-2">
                        <h3 className="admin-style-settings-card-title">Amplify Groups</h3>
                        <button
                            title={isAddingAmpGroups ? "" : 'Add Amplify Group'}
                            disabled={isAddingAmpGroups !== null}
                            id="addAmplifyGroup"
                            className={`flex-shrink-0 py-2 items-center gap-3 rounded-md border border-neutral-300 dark:border-white/20 px-2 transition-colors duration-200  ${ isAddingAmpGroups ? "" : " cursor-pointer hover:bg-neutral-200 dark:hover:bg-gray-500/10" }`}
                            onClick={() => setIsAddingAmpGroups(emptyAmplifyGroups(userEmail ?? 'unknown'))}
                        >
                            <IconPlus size={16}/>
                        </button>

                        {isAddingAmpGroups && 
                            <UserAction
                            top={"mt-0"}
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
                                <div className="ml-auto">
                                    <Search
                                    placeholder={'Search Amplify Groups...'}
                                    searchTerm={ampGroupSearchTerm}
                                    onSearch={(searchTerm: string) => setAmpGroupSearchTerm(searchTerm.toLocaleLowerCase())}
                                    />
                                </div>}
                    </div>
                    <p className="admin-style-settings-card-description">Create and manage Amplify Groups for user organization and permissions</p>
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
                        <div className="flex-grow ml-4 flex flex-col mt-[-36px] max-w-[40%]">
                            <InfoBox color="#60A5FA" padding={"py-0.5"}
                               content={
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
                                <table className="modern-table hide-last-column mt-4 w-full mr-10 " style={{boxShadow: 'none'}} id="groupTable">
                                    <thead>
                                    <tr className="gradient-header hide-last-column">
                                        {['Group Name', 'Members', 'Membership by Amplify Groups', 'Billing Group', 'Rate Limit', 'Created By'].map((title, i) => (
                                        <th key={i}
                                            id={title}
                                            className="px-4 py-2 text-center border border-gray-500 text-neutral-600 dark:text-neutral-300"
                                            style={{width: [0, 4, 5].includes(i) ? "15%" 
                                                    : i === 3 ? "10%"
                                                    : "25%", 
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
                                            <td className="border border-neutral-500 px-4 py-2 break-words max-w-[200px]" id="groupName">
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

                                            <td className="text-center border border-neutral-500 px-4 py-2">
                                                <button 
                                                    title={group.isBillingGroup ? "Disable as Billing Group" : "Enable as Billing Group"}
                                                    className="cursor-pointer flex items-center justify-center w-full"
                                                    onClick={() => {
                                                        const updatedGroup = {...group, isBillingGroup: !group.isBillingGroup};
                                                        handleUpdateAmpGroups({...ampGroups, [group.groupName]: updatedGroup});
                                                    }}>
                                                    {group.isBillingGroup ? 
                                                        <IconCheck className="text-green-600 hover:opacity-60" size={18} /> 
                                                        : <IconX className="text-red-600 hover:opacity-60" size={18} />}
                                                </button>
                                            </td>

                                            <td className="text-center border border-neutral-500 px-1 py-2"
                                                onMouseEnter={() => setHoveredRateLimit(group.groupName)}
                                                onMouseLeave={() => setHoveredRateLimit(null)}>
                                                <div className="flex items-center justify-center">
                                                    {editingRateLimit === group.groupName ? (
                                                        <div className="flex flex-row gap-2">
                                                            <RateLimiter
                                                                period={tempRateLimitPeriod}
                                                                setPeriod={setTempRateLimitPeriod}
                                                                rate={tempRateLimitRate}
                                                                setRate={setTempRateLimitRate}
                                                            />
                                                            <ActionButton
                                                                title='Confirm Change'
                                                                id="confirmRateLimitChange"
                                                                className='text-green-500'
                                                                handleClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const updatedRateLimit = rateLimitObj(tempRateLimitPeriod, tempRateLimitRate);
                                                                    const updatedGroup = {...group, rateLimit: updatedRateLimit};
                                                                    handleUpdateAmpGroups({...ampGroups, [group.groupName]: updatedGroup});
                                                                    setEditingRateLimit(null);
                                                                }}
                                                            >
                                                                <IconCheck size={18} />
                                                            </ActionButton>
                                                            <ActionButton
                                                                title='Discard Change'
                                                                id="discardRateLimitChange"
                                                                className='text-red-500'
                                                                handleClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setEditingRateLimit(null);
                                                                }}
                                                            >
                                                                <IconX size={18} />
                                                            </ActionButton>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center justify-center gap-2">
                                                            <span>{(() => {
                                                                const rateLimit = group.rateLimit;
                                                                if (!rateLimit) {
                                                                    return formatRateLimit(noRateLimit);
                                                                } else if (typeof rateLimit === 'number') {
                                                                    // Handle legacy number format
                                                                    return formatRateLimit(rateLimitObj('Daily', String(rateLimit)));
                                                                } else {
                                                                    // Proper RateLimit object
                                                                    return formatRateLimit(rateLimit);
                                                                }
                                                            })()}</span>
                                                            {hoveredRateLimit === group.groupName && (
                                                                <button
                                                                    type="button"
                                                                    id="editRateLimit"
                                                                    className="text-neutral-400 hover:text-neutral-200"
                                                                    onClick={() => {
                                                                        setEditingRateLimit(group.groupName);
                                                                        const rateLimit = group.rateLimit;
                                                                        if (!rateLimit) {
                                                                            setTempRateLimitPeriod('Unlimited');
                                                                            setTempRateLimitRate('0');
                                                                        } else if (typeof rateLimit === 'number') {
                                                                            // Handle legacy number format
                                                                            setTempRateLimitPeriod('Daily');
                                                                            setTempRateLimitRate(String(rateLimit));
                                                                        } else {
                                                                            // Proper RateLimit object
                                                                            setTempRateLimitPeriod(rateLimit.period);
                                                                            setTempRateLimitRate(rateLimit.rate ? String(rateLimit.rate) : '0');
                                                                        }
                                                                    }}
                                                                    title="Edit Rate Limit"
                                                                >
                                                                    <IconEdit size={18} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="text-center border border-neutral-500 px-4 py-2 break-words max-w-[300px]">
                                                {group.createdBy}
                                            </td>

                                            <td className="">
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
            </div>

            {/* CSV Upload Modal */}
            {adminCsvUpload.showUpload && createPortal(
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black bg-opacity-50" onClick={adminCsvUpload.handleCancel} />
                    
                    {/* Modal Content */}
                    <div className="relative max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <CsvUpload
                            config={AdminCsvUploadConfig}
                            existingItems={admins}
                            onUploadSuccess={adminCsvUpload.handleUploadSuccess}
                            onClose={adminCsvUpload.handleCancel}
                        />
                    </div>
                </div>,
                document.body
            )}

            {/* CSV Preview Modal */}
            {createPortal(
                <CsvPreviewModal
                    open={adminCsvUpload.showPreview}
                    result={adminCsvUpload.uploadResult}
                    config={AdminCsvPreviewConfig}
                    onConfirm={adminCsvUpload.handleImportConfirm}
                    onCancel={adminCsvUpload.handleCancel}
                    isProcessing={adminCsvUpload.isProcessing}
                />,
                document.body
            )}
                    
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
