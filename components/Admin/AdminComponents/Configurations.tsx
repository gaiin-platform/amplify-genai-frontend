import { FC, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Amplify_Group, Amplify_Groups, AmplifyGroupSelect, EmailSupport, PromptCostAlert, titleLabel, UserAction } from "../AdminUI";
import { AdminConfigTypes} from "@/types/admin";
import { IconPlus, IconTrash, IconX, IconCloudFilled, IconMessage, IconCheck, IconEdit, IconFileImport } from "@tabler/icons-react";
import Checkbox from "@/components/ReusableComponents/CheckBox";
import ExpansionComponent from "@/components/Chat/ExpansionComponent";
import { RateLimiter } from "@/components/Settings/AccountComponents/RateLimit";
import { PeriodType, formatRateLimit, formatRateLimits, normalizeRateLimits, rateLimitObj, noRateLimit, RateLimit, RateLimits } from "@/types/rateLimit";
import { InfoBox } from "@/components/ReusableComponents/InfoBox";
import Search from "@/components/Search";
import ActionButton from "@/components/ReusableComponents/ActionButton";
import { useSession } from "next-auth/react";
import InputsMap from "@/components/ReusableComponents/InputMap";
import { AddEmailWithAutoComplete } from "@/components/Emails/AddEmailsAutoComplete";
import { ConversationStorage } from "@/types/conversationStorage";
import { capitalize, getUserIdentifier } from "@/utils/app/data";
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
    
    amplifyUsers: { [key: string]: string };

    rateLimits: RateLimits;
    setRateLimits: (l: RateLimits) => void;

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

export const ConfigurationsTab: FC<Props> = ({admins, setAdmins, ampGroups, setAmpGroups, amplifyUsers, allEmails,
                                              rateLimits, setRateLimits, promptCostAlert, setPromptCostAlert,
                                              defaultConversationStorage, setDefaultConversationStorage,
                                              emailSupport, setEmailSupport, aiEmailDomain, setAiEmailDomain,
                                              admin_text, updateUnsavedConfigs, onModalStateChange}) => {

    const { data: session } = useSession();
    const userEmail = getUserIdentifier(session?.user);

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
    const [tempRateLimits, setTempRateLimits] = useState<RateLimit[]>([]); // working copy for group being edited
    const [addingGroupLimitRow, setAddingGroupLimitRow] = useState<{period: PeriodType, rate: string} | null>(null);
    const [addingAdminLimitRow, setAddingAdminLimitRow] = useState<{period: PeriodType, rate: string} | null>(null);
    const [editingAdminLimitIdx, setEditingAdminLimitIdx] = useState<{idx: number, period: PeriodType, rate: string} | null>(null);
    const [hoveredAdminLimitIdx, setHoveredAdminLimitIdx] = useState<number | null>(null);
    const [editingGroupLimitIdx, setEditingGroupLimitIdx] = useState<{idx: number, period: PeriodType, rate: string} | null>(null);
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

    const handleUpdateRateLimits = (updatedRateLimits: RateLimits) => {
        setRateLimits(updatedRateLimits);
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
                                    emails={admins.map(username => amplifyUsers[username] || username)}
                                    allEmails={allEmails ?? []}
                                    handleUpdateEmails={(updatedEmails: Array<string>) => {
                                        // Convert emails back to usernames for storage
                                        const usernames = updatedEmails.map(email => {
                                            const username = Object.keys(amplifyUsers).find(key => amplifyUsers[key] === email);
                                            return username || email;
                                        });
                                        handleUpdateAdmins(usernames);
                                    }}
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
                                <span className="truncate pr-8 py-2 mr-1">{amplifyUsers[user] || user}</span>
                            
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
                        <h3 className="admin-style-settings-card-title">Chat Rate Limits</h3>
                        <button
                            title="Add Rate Limit"
                            disabled={addingAdminLimitRow !== null || rateLimits.filter(l => l.period !== 'Unlimited' && l.rate !== null).length >= 4}
                            className={`flex items-center gap-1 px-2 py-1 rounded border border-neutral-300 dark:border-white/20 text-sm transition-colors ${(addingAdminLimitRow || rateLimits.filter(l => l.period !== 'Unlimited' && l.rate !== null).length >= 4) ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700'}`}
                            onClick={() => {
                                const usedPeriods = rateLimits.filter(l => l.period !== 'Unlimited' && l.rate !== null).map(l => l.period);
                                const firstAvailable = (['Monthly', 'Daily', 'Hourly', 'Total'] as PeriodType[]).find(p => !usedPeriods.includes(p)) ?? 'Monthly';
                                setAddingAdminLimitRow({ period: firstAvailable, rate: '$0.00' });
                            }}
                        >
                            <IconPlus size={14} /> Add Limit
                        </button>
                    </div>
                    <p className="admin-style-settings-card-description">
                        Configure one or more simultaneous rate limits (e.g. Monthly $300 <strong>AND</strong> Hourly $30). All limits must pass for a user to be allowed.
                    </p>
                </div>

                <div className="px-6 pb-4">
                    {rateLimits.filter(l => l.period !== 'Unlimited' && l.rate !== null).length === 0 && !addingAdminLimitRow && (
                        <span className="text-sm text-neutral-500 dark:text-neutral-400 italic">No limits set — all users are Unlimited</span>
                    )}

                    <div className="flex flex-wrap items-center gap-2">
                        {rateLimits.filter(l => l.period !== 'Unlimited' && l.rate !== null).map((limit, idx) => (
                            editingAdminLimitIdx?.idx === idx ? (
                                <div key={idx} className="flex items-center gap-2">
                                    <RateLimiter
                                        period={editingAdminLimitIdx.period}
                                        setPeriod={(p: PeriodType) => setEditingAdminLimitIdx({ ...editingAdminLimitIdx, period: p })}
                                        rate={editingAdminLimitIdx.rate}
                                        setRate={(r: string) => setEditingAdminLimitIdx({ ...editingAdminLimitIdx, rate: r })}
                                        excludePeriods={rateLimits.filter(l => l.period !== 'Unlimited' && l.rate !== null).filter((_, i) => i !== idx).map(l => l.period)}
                                    />
                                    <button
                                        title="Confirm"
                                        className="text-green-500 hover:text-green-600"
                                        onClick={() => {
                                            const updated = rateLimits.filter(l => l.period !== 'Unlimited' && l.rate !== null);
                                            updated[idx] = rateLimitObj(editingAdminLimitIdx.period, editingAdminLimitIdx.rate);
                                            handleUpdateRateLimits(updated);
                                            setEditingAdminLimitIdx(null);
                                        }}
                                    >
                                        <IconCheck size={18} />
                                    </button>
                                    <button
                                        title="Cancel"
                                        className="text-red-400 hover:text-red-600"
                                        onClick={() => setEditingAdminLimitIdx(null)}
                                    >
                                        <IconX size={18} />
                                    </button>
                                </div>
                            ) : (
                                <div
                                    key={idx}
                                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-neutral-300 dark:border-neutral-600 bg-neutral-100 dark:bg-neutral-700"
                                    onMouseEnter={() => setHoveredAdminLimitIdx(idx)}
                                    onMouseLeave={() => setHoveredAdminLimitIdx(null)}
                                >
                                    <span className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
                                        {formatRateLimit(limit)}
                                    </span>
                                    {hoveredAdminLimitIdx === idx && (<>
                                        <button
                                            title="Edit limit"
                                            className="text-neutral-400 hover:text-blue-500 transition-colors"
                                            onClick={() => {
                                                setAddingAdminLimitRow(null);
                                                setEditingAdminLimitIdx({ idx, period: limit.period, rate: `$${(limit.rate as number).toFixed(2)}` });
                                            }}
                                        >
                                            <IconEdit size={13} />
                                        </button>
                                        <button
                                            title="Remove limit"
                                            className="text-neutral-400 hover:text-red-500 transition-colors"
                                            onClick={() => {
                                                const active = rateLimits.filter(l => l.period !== 'Unlimited' && l.rate !== null);
                                                active.splice(idx, 1);
                                                handleUpdateRateLimits(active.length > 0 ? active : []);
                                            }}
                                        >
                                            <IconTrash size={13} />
                                        </button>
                                    </>)}
                                </div>
                            )
                        ))}

                        {addingAdminLimitRow && (
                            <div className="flex items-center gap-2">
                                <RateLimiter
                                    period={addingAdminLimitRow.period}
                                    setPeriod={(p: PeriodType) => setAddingAdminLimitRow({ ...addingAdminLimitRow, period: p })}
                                    rate={addingAdminLimitRow.rate}
                                    setRate={(r: string) => setAddingAdminLimitRow({ ...addingAdminLimitRow, rate: r })}
                                    excludePeriods={rateLimits.filter(l => l.period !== 'Unlimited' && l.rate !== null).map(l => l.period)}
                                />
                                <button
                                    title="Confirm"
                                    className="text-green-500 hover:text-green-600"
                                    onClick={() => {
                                        const newLimit = rateLimitObj(addingAdminLimitRow.period, addingAdminLimitRow.rate);
                                        if (newLimit.period !== 'Unlimited') {
                                            const existing = rateLimits.filter(l => l.period !== 'Unlimited' && l.rate !== null);
                                            handleUpdateRateLimits([...existing, newLimit]);
                                        }
                                        setAddingAdminLimitRow(null);
                                    }}
                                >
                                    <IconCheck size={18} />
                                </button>
                                <button
                                    title="Cancel"
                                    className="text-red-400 hover:text-red-600"
                                    onClick={() => setAddingAdminLimitRow(null)}
                                >
                                    <IconX size={18} />
                                </button>
                            </div>
                        )}
                    </div>
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
                            To include dynamic values in the alert message, use placeholders in the following format: {"<placeholderName>"}.
                            <br className="mt-1"></br>
                                Supported Placeholders:<br></br>
                            <div className="flex justify-center text-start">
                                &nbsp;&nbsp;&nbsp;&nbsp; * {"<totalCost>"}: The estimated total cost (e.g., &quot;$0.05&quot;)
                                <br></br>
                                &nbsp;&nbsp;&nbsp;&nbsp; * {"<prompts>"}: Number of context windows needed (e.g., &quot;2&quot; if tokens exceed 1x context window)
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
                                    const {groupName, ...groupData} = isAddingAmpGroups;
                                    handleUpdateAmpGroups({...ampGroups, [name] : groupData});
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
                                emails={isAddingAmpGroups.members.map(username => amplifyUsers[username] || username)}
                                allEmails={allEmails ?? []}
                                handleUpdateEmails={(updatedEmails: Array<string>) => {
                                    // Convert emails back to usernames for storage
                                    const usernames = updatedEmails.map(email => {
                                        const username = Object.keys(amplifyUsers).find(key => amplifyUsers[key] === email);
                                        return username || email;
                                    });
                                    setIsAddingAmpGroups({...isAddingAmpGroups, members : usernames});
                                }}
                            />
                            <div className="h-[40px] rounded-r border border-neutral-500 pl-4 py-1 dark:bg-[#40414F] bg-gray-200 dark:text-neutral-100 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 overflow-x-auto">
                            {isAddingAmpGroups.members.map((user, idx) => (
                                <div key={idx} className="flex items-center gap-1 mr-1">
                                    <span className="flex flex-row gap-4 py-2 mr-4"> 
                                        {amplifyUsers[user] || user} 
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
                                    {Object.entries(ampGroups)
                                            .filter(([groupName, group]: [string, Amplify_Group]) => ampGroupSearchTerm ? 
                                                    groupName.toLowerCase().includes(ampGroupSearchTerm) : true)
                                            .map(([groupName, group]: [string, Amplify_Group]) => 
                                        <tr key={groupName}
                                            onMouseEnter={() => setHoveredAmpGroup(groupName)}
                                            onMouseLeave={() => setHoveredAmpGroup('')}>
                                            <td className="border border-neutral-500 px-4 py-2 break-words max-w-[200px]" id="groupName">
                                                {groupName}
                                            </td>

                                            <td className="flex-grow border border-neutral-500 pl-1 pr-2 max-w-[300px]">

                                            <div className={`flex items-center ${addingMembersTo === groupName ? "flex-col":'flex-row'}`}>
                                            <div
                                                className={`flex items-center ${addingMembersTo === groupName ? "flex-wrap": "overflow-x-auto"}`} >
                                                {group.members?.map((user, idx) => (
                                                <div key={idx} className="flex items-center gap-1 mr-1"
                                                    onMouseEnter={() => {
                                                        if (group.includeFromOtherGroups !== undefined)
                                                            setHoveredAmpMember( {ampGroup: groupName,     
                                                                                    username: user})
                                                    }}
                                                    onMouseLeave={() => setHoveredAmpMember(null)}>
                                                    
                                                    <span className="flex flex-row gap-1 py-2 mr-4"> {idx > 0 && <label className="opacity-60">|</label>}
                                                        { hoveredAmpMember?.ampGroup === groupName && hoveredAmpMember?.username === user ?
                                                        <button
                                                        className={`text-red-500 hover:text-red-800 `}
                                                        onClick={() => {
                                                            const updatedMembers = group.members?.filter(
                                                            (u) => u !== user
                                                            );
                                                            const updatedGroup = {...group, members: updatedMembers}
                                                            handleUpdateAmpGroups({...ampGroups, [groupName] : updatedGroup});
                                                        }} >
                                                        <IconTrash size={16} />
                                                        </button> : <div className="w-[16px]"></div>}
                                                        {amplifyUsers[user] || user} 
                                                    </span>
                                                </div>
                                                ))}
                                            </div>

                                            {addingMembersTo === groupName && 
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
                                                    emails={(group.members ?? []).map(username => amplifyUsers[username] || username)}
                                                    allEmails={allEmails ?? []}
                                                    handleUpdateEmails={(updatedEmails: Array<string>) => {
                                                        // Convert emails back to usernames for storage
                                                        const usernames = updatedEmails.map(email => {
                                                            const username = Object.keys(amplifyUsers).find(key => amplifyUsers[key] === email);
                                                            return username || email;
                                                        });
                                                        const updatedGroup = {...group, members: usernames}
                                                        handleUpdateAmpGroups({...ampGroups, [groupName] : updatedGroup});
                                                    }}
                                                /> </div>
                                                </div>
                                            ) : (
                                                (group.includeFromOtherGroups !== undefined ?
                                                <button
                                                className="ml-auto flex items-center px-2 text-blue-500 hover:text-blue-600 flex-shrink-0"
                                                onClick={() => setAddingMembersTo(groupName)}
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
                                                                                k != groupName)}
                                                    selected={group.includeFromOtherGroups}
                                                    setSelected={(selectedGroups: string[]) => {
                                                        const updatedGroup = {...group, includeFromOtherGroups: selectedGroups}
                                                        handleUpdateAmpGroups({...ampGroups, [groupName] : updatedGroup});
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
                                                        handleUpdateAmpGroups({...ampGroups, [groupName]: updatedGroup});
                                                    }}>
                                                    {group.isBillingGroup ? 
                                                        <IconCheck className="text-green-600 hover:opacity-60" size={18} /> 
                                                        : <IconX className="text-red-600 hover:opacity-60" size={18} />}
                                                </button>
                                            </td>

                                            <td className="text-center border border-neutral-500 px-1 py-2"
                                                onMouseEnter={() => setHoveredRateLimit(groupName)}
                                                onMouseLeave={() => setHoveredRateLimit(null)}>
                                                <div className="flex flex-col items-center justify-center gap-1">
                                                    {editingRateLimit === groupName ? (
                                                        // ── EDIT MODE: list editor ──────────────────────────
                                                        <div className="flex flex-col gap-1.5 w-full px-1">
                                                            <div className="flex flex-wrap items-center gap-1.5">
                                                                {tempRateLimits.filter(l => l.period !== 'Unlimited' && l.rate !== null).map((limit, idx) => (
                                                                    editingGroupLimitIdx?.idx === idx ? (
                                                                        <div key={idx} className="flex items-center gap-1 flex-wrap">
                                                                            <RateLimiter
                                                                                period={editingGroupLimitIdx.period}
                                                                                setPeriod={(p: PeriodType) => setEditingGroupLimitIdx({ ...editingGroupLimitIdx, period: p })}
                                                                                rate={editingGroupLimitIdx.rate}
                                                                                setRate={(r: string) => setEditingGroupLimitIdx({ ...editingGroupLimitIdx, rate: r })}
                                                                                excludePeriods={tempRateLimits.filter(l => l.period !== 'Unlimited' && l.rate !== null).filter((_, i) => i !== idx).map(l => l.period)}
                                                                            />
                                                                            <button
                                                                                title="Confirm"
                                                                                className="text-green-500 hover:text-green-600"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    const updated = [...tempRateLimits];
                                                                                    updated[idx] = rateLimitObj(editingGroupLimitIdx.period, editingGroupLimitIdx.rate);
                                                                                    setTempRateLimits(updated);
                                                                                    setEditingGroupLimitIdx(null);
                                                                                }}
                                                                            >
                                                                                <IconCheck size={15} />
                                                                            </button>
                                                                            <button
                                                                                title="Cancel"
                                                                                className="text-red-400 hover:text-red-600"
                                                                                onClick={(e) => { e.stopPropagation(); setEditingGroupLimitIdx(null); }}
                                                                            >
                                                                                <IconX size={15} />
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                    <div key={idx} className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-neutral-400 dark:border-neutral-500 bg-neutral-100 dark:bg-neutral-700">
                                                                        <span className="text-xs text-neutral-700 dark:text-neutral-200">{formatRateLimit(limit)}</span>
                                                                        <button
                                                                            title="Edit"
                                                                            className="text-neutral-400 hover:text-blue-500"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setAddingGroupLimitRow(null);
                                                                                setEditingGroupLimitIdx({ idx, period: limit.period, rate: `$${(limit.rate as number).toFixed(2)}` });
                                                                            }}
                                                                        >
                                                                            <IconEdit size={11} />
                                                                        </button>
                                                                        <button
                                                                            title="Remove"
                                                                            className="text-neutral-400 hover:text-red-500"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                const updated = tempRateLimits.filter((_, i) => i !== idx);
                                                                                setTempRateLimits(updated);
                                                                            }}
                                                                        >
                                                                            <IconTrash size={11} />
                                                                        </button>
                                                                    </div>
                                                                    )
                                                                ))}
                                                            </div>

                                                            {addingGroupLimitRow ? (
                                                                <div className="flex items-center gap-1 flex-wrap mt-1">
                                                                    <RateLimiter
                                                                        period={addingGroupLimitRow.period}
                                                                        setPeriod={(p: PeriodType) => setAddingGroupLimitRow({ ...addingGroupLimitRow, period: p })}
                                                                        rate={addingGroupLimitRow.rate}
                                                                        setRate={(r: string) => setAddingGroupLimitRow({ ...addingGroupLimitRow, rate: r })}
                                                                        excludePeriods={tempRateLimits.filter(l => l.period !== 'Unlimited' && l.rate !== null).map(l => l.period)}
                                                                    />
                                                                    <button
                                                                        title="Confirm add"
                                                                        className="text-green-500 hover:text-green-600"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            const newLimit = rateLimitObj(addingGroupLimitRow.period, addingGroupLimitRow.rate);
                                                                            if (newLimit.period !== 'Unlimited') {
                                                                                setTempRateLimits(prev => [...prev.filter(l => l.period !== 'Unlimited'), newLimit]);
                                                                            }
                                                                            setAddingGroupLimitRow(null);
                                                                        }}
                                                                    >
                                                                        <IconCheck size={15} />
                                                                    </button>
                                                                    <button
                                                                        title="Cancel add"
                                                                        className="text-red-400 hover:text-red-600"
                                                                        onClick={(e) => { e.stopPropagation(); setAddingGroupLimitRow(null); }}
                                                                    >
                                                                        <IconX size={15} />
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    title="Add limit"
                                                                    disabled={tempRateLimits.filter(l => l.period !== 'Unlimited' && l.rate !== null).length >= 4}
                                                                    className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-0.5 mt-0.5 disabled:opacity-40 disabled:cursor-not-allowed"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        const usedPeriods = tempRateLimits.filter(l => l.period !== 'Unlimited' && l.rate !== null).map(l => l.period);
                                                                        const firstAvailable = (['Monthly', 'Daily', 'Hourly', 'Total'] as PeriodType[]).find(p => !usedPeriods.includes(p)) ?? 'Monthly';
                                                                        setAddingGroupLimitRow({ period: firstAvailable, rate: '$0.00' });
                                                                    }}
                                                                >
                                                                    <IconPlus size={12} /> Add
                                                                </button>
                                                            )}

                                                            <div className="flex gap-1.5 mt-1">
                                                                <ActionButton
                                                                    title='Save'
                                                                    id="confirmRateLimitChange"
                                                                    className='text-green-500'
                                                                    handleClick={(e) => {
                                                                        e.stopPropagation();
                                                                        const savedLimits = tempRateLimits.filter(l => l.period !== 'Unlimited' && l.rate !== null);
                                                                        const updatedGroup = { ...group, rateLimit: savedLimits.length > 0 ? savedLimits : [noRateLimit] };
                                                                        handleUpdateAmpGroups({ ...ampGroups, [groupName]: updatedGroup });
                                                                        setEditingRateLimit(null);
                                                                        setAddingGroupLimitRow(null);
                                                                    }}
                                                                >
                                                                    <IconCheck size={16} />
                                                                </ActionButton>
                                                                <ActionButton
                                                                    title='Discard'
                                                                    id="discardRateLimitChange"
                                                                    className='text-red-500'
                                                                    handleClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setEditingRateLimit(null);
                                                                        setAddingGroupLimitRow(null);
                                                                    }}
                                                                >
                                                                    <IconX size={16} />
                                                                </ActionButton>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        // ── DISPLAY MODE ────────────────────────────────────
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            <span className="text-xs text-center leading-snug">
                                                                {(() => {
                                                                    const rl = group.rateLimit;
                                                                    if (!rl) return 'Unlimited';
                                                                    if (typeof rl === 'number') return formatRateLimit(rateLimitObj('Daily', String(rl)));
                                                                    const normalized = normalizeRateLimits(rl);
                                                                    return formatRateLimits(normalized);
                                                                })()}
                                                            </span>
                                                            {hoveredRateLimit === groupName && (
                                                                <button
                                                                    type="button"
                                                                    id="editRateLimit"
                                                                    className="text-neutral-400 hover:text-neutral-200 flex-shrink-0"
                                                                    onClick={() => {
                                                                        const rl = group.rateLimit;
                                                                        let normalized: RateLimit[];
                                                                        if (!rl) normalized = [];
                                                                        else if (typeof rl === 'number') normalized = [rateLimitObj('Daily', String(rl))];
                                                                        else normalized = normalizeRateLimits(rl);
                                                                        setTempRateLimits(normalized.filter(l => l.period !== 'Unlimited' && l.rate !== null));
                                                                        setEditingRateLimit(groupName);
                                                                        setAddingGroupLimitRow(null);
                                                                    }}
                                                                    title="Edit Rate Limits"
                                                                >
                                                                    <IconEdit size={16} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="text-center border border-neutral-500 px-4 py-2 break-words max-w-[300px]">
                                                {amplifyUsers[group.createdBy] || group.createdBy}
                                            </td>

                                            <td className="">
                                                <div className="w-[50px] flex-shrink-0">
                                                {hoveredAmpGroup === groupName && group.includeFromOtherGroups !== undefined ?
                                                <button
                                                    title={"Delete Amplify Group"}
                                                    type="button"
                                                    className="ml-2 p-1 text-sm bg-neutral-400 dark:bg-neutral-500 rounded hover:bg-red-600 dark:hover:bg-red-700 focus:outline-none"
                                                    onClick={() => {
                                                        const { [groupName]: _, ...remainingGroups } = ampGroups;
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
