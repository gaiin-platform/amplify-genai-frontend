import React, { FC, useContext, useEffect, useRef, useState } from 'react';
import HomeContext from '@/pages/api/home/home.context';
import { IconCheck, IconFiles, IconPlus, IconSettings, IconX } from '@tabler/icons-react';
import { AssistantModal } from '../Promptbar/components/AssistantModal';
import { Prompt } from '@/types/prompt';
import { Group, GroupAccessType, AstGroupTypeData, GroupUpdateType, Members } from '@/types/groups';
import { createEmptyPrompt, savePrompts } from '@/utils/app/prompts';
import { useSession } from 'next-auth/react';
import { createAstAdminGroup, fetchAstAdminGroups, updateGroupAssistants } from '@/services/groupsService';
import { TagsList } from '../Chat/TagsList';
import ExpansionComponent from '../Chat/ExpansionComponent';
import { AttachFile, handleFile } from '../Chat/AttachFile';
import { COMMON_DISALLOWED_FILE_EXTENSIONS } from '@/utils/app/const';
import { AssistantDefinition, AssistantProviderID } from '@/types/assistant';
import { DataSourceSelector } from '../DataSources/DataSourceSelector';
import { AttachedDocument } from '@/types/attacheddocument';
import { ExistingFileList, FileList } from "@/components/Chat/FileList";
import { ModelSelect } from '../Chat/ModelSelect';
import { getDate } from '@/utils/app/date';
import { FolderInterface } from '@/types/folder';
import { LoadingIcon } from "@/components/Loader/LoadingIcon";
import { getGroupAssistantConversations } from '@/services/groupAssistantService';
import { getGroupAssistantDashboards } from '@/services/groupAssistantService';
import toast from 'react-hot-toast';
import { LoadingDialog } from '../Loader/LoadingDialog';
import { InfoBox } from '../ReusableComponents/InfoBox';
import Checkbox from '../ReusableComponents/CheckBox';
import { AMPLIFY_ASSISTANTS_GROUP_NAME } from '@/utils/app/amplifyAssistants';
import { Modal } from '../ReusableComponents/Modal';
import { getUserAmplifyGroups } from '@/services/adminService';
import { fetchAllSystemIds } from '@/services/apiKeysService';
import { checkAvailableModelId } from '@/utils/app/models';
import { AstUserConversation, ConversationTable } from './AssistantAdminComponents/ConversationTable';
import { Dashboard, DashboardMetrics } from './AssistantAdminComponents/Dashboard';
import { GroupManagement } from './AssistantAdminComponents/GroupManagement';
import { CreateAdminDialog } from './AssistantAdminComponents/CreateAdminGroupDialog';
import ActionButton from '../ReusableComponents/ActionButton';
import { contructGroupData } from '@/utils/app/groups';
import { getHiddenGroupFolders, saveFolders } from '@/utils/app/folders';
import { filterAstsByFeatureFlags } from '@/utils/app/assistants';


const subTabs = ['dashboard', 'conversations', 'edit_assistant', 'group'] as const;
export type SubTabType = typeof subTabs[number];

interface Props {
    open: boolean;
    openToGroup?: Group
    openToAssistant?: Prompt;
}

export const AssistantAdminUI: FC<Props> = ({ open, openToGroup, openToAssistant }) => {
    const { state: { featureFlags, statsService, groups, prompts, folders, syncingPrompts, amplifyUsers }, dispatch: homeDispatch } = useContext(HomeContext);
    const { data: session } = useSession();
    const user = session?.user?.email ?? "";

    const foldersRef = useRef(folders);

    useEffect(() => {
        foldersRef.current = folders;
    }, [folders]);

    const promptsRef = useRef(prompts);

    useEffect(() => {
        promptsRef.current = prompts;
      }, [prompts]);

    const onClose = () => {
        syncGroups();
        window.dispatchEvent(new CustomEvent('openAstAdminInterfaceTrigger', { detail: { isOpen: false } }));
    }

    const filteredForAdminAccess = (allGroups: Group[]) => {
        const hasAccessTo = allGroups.filter((g: Group) => [GroupAccessType.ADMIN, GroupAccessType.WRITE].includes(g.members[user]));
        if (!featureFlags.createAstAdminGroups && hasAccessTo.length === 0) {
            alert("You do not have access to any assistant admin groups.");
            onClose();
        }
        return hasAccessTo;
    }

    const [innderWindow, setInnerWindow] = useState({ height: window.innerHeight, width: window.innerWidth });

    const [loadingMessage, setLoadingMessage] = useState<string>('Loading Assistant Admin Interface...');
    const [loadingActionMessage, setLoadingActionMessage] = useState<string>('');
 

    const syncGroups = async () => {
        let groupResult:any = null;
        try {
            console.log("Fetching group data...");
            const userGroups = await fetchAstAdminGroups();
            if (userGroups.success) {
                groupResult = contructGroupData(userGroups.data);
                homeDispatch({ field: 'groups', value: groupResult.groups});
            } else {
                console.log("Failed to import group data: ", userGroups.message);
                return;
            }
        } catch (e) {
            console.log("Failed to import group data: ", e);
            return;
        }
        // filter out group folders that are hidden
        const hiddenFolderIds: string[] = getHiddenGroupFolders().map((f:FolderInterface) => f.id);
        const filteredGroupFolders:FolderInterface[] = groupResult.groupFolders 
                                                                  .filter((f:FolderInterface) => !hiddenFolderIds.includes(f.id));
        const updatedFolders = [...foldersRef.current.filter((f:FolderInterface) => !f.isGroupFolder), 
                                ...filteredGroupFolders]
        homeDispatch({field: 'folders', value: updatedFolders});
        saveFolders(updatedFolders);

        const groupPrompts: Prompt[] = filterAstsByFeatureFlags(groupResult.groupPrompts, featureFlags);

        const updatedPrompts = [...promptsRef.current.filter((p : Prompt) => !p.groupId ), 
                                ...groupPrompts];
        homeDispatch({field: 'prompts', value: updatedPrompts});
        savePrompts(updatedPrompts);
        console.log("Group data synced successfully");
    }

    const [adminGroups, setAdminGroups] = useState<Group[]>(groups.length > 0 ? filteredForAdminAccess(groups) : []);

    const [selectedGroup, setSelectedGroup] = useState<Group | undefined>(openToGroup || adminGroups[0]);
    const [selectedAssistant, setSelectedAssistant] = useState<Prompt | undefined>(openToAssistant || selectedGroup?.assistants[0]);

    const [activeAstTab, setActiveAstTab] = useState<string | undefined>(selectedAssistant?.data?.assistant?.definition.assistantId);
    const DEFAULT_SUB_TAB = 'dashboard' as SubTabType;
    const [activeSubTab, setActiveSubTab] = useState<SubTabType>(openToAssistant ? "edit_assistant" : DEFAULT_SUB_TAB);

    const [additionalGroupData, setAdditionalGroupData] = useState<any>({});

    const [conversations, setConversations] = useState<AstUserConversation[]>([]);
    const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics | null>(null);

    const [showCreateNewGroup, setShowCreateNewGroup] = useState<boolean>();
    const [showCreateGroupAssistant, setShowCreateGroupAssistant] = useState<string | null>(null);

    const fetchEmails = () => {
        const emailSuggestions = amplifyUsers;
        // add groups  #groupName
        const groupForMembers = groups.map((group: Group) => `#${group.name}`);
        return (emailSuggestions ? [...emailSuggestions,
        ...groupForMembers].filter((e: string) => e !== user) : []);
    };

    const allEmails: Array<string> = (fetchEmails());

    const [amplifyGroups, setAmplifyGroups] = useState<string[] | null>(null);
    const [systemUsers, setSystemUsers] = useState<string[] | null>(null);

    useEffect(() => {
        const updateInnerWindow = () => {
            setInnerWindow({ height: window.innerHeight, width: window.innerWidth });
        }
        // Listen to window resize to update the size
        window.addEventListener('resize', updateInnerWindow);
        return () => {
            window.removeEventListener('resize', updateInnerWindow);
        };
    }, []);

    useEffect(() => {
        const fetchAmpGroups = async () => {
            const ampGroupsResult = await getUserAmplifyGroups();
            setAmplifyGroups(ampGroupsResult.success ? ampGroupsResult.data : []);
            if (!ampGroupsResult.success) console.log("Failed to retrieve user amplify groups");
        }

        if (!amplifyGroups) fetchAmpGroups();

        const fetchSystemUsers = async () => {
            const apiSysIds = await fetchAllSystemIds();
            const sysIds: string[] = apiSysIds.map((k: any) => k.systemId).filter((k: any) => k);
            setSystemUsers(sysIds);
        }

        if (!systemUsers) fetchSystemUsers();

    }, [open]);

    useEffect(() => {
        setAdditionalGroupData({});
    }, [activeSubTab])

    useEffect(() => {
        setActiveAstTab(selectedAssistant?.data?.assistant?.definition.assistantId);
    }, [selectedAssistant])

    useEffect(() => {
        const nonAdminGroups = groups.filter((g: Group) => g.members[user] === GroupAccessType.READ);
        homeDispatch({ field: 'groups', value: [...adminGroups, ...nonAdminGroups] });
    }, [adminGroups]);

    const allAssistants = () => {
        return adminGroups.reduce((accumulator: Prompt[], group: Group) => {
            return accumulator.concat(group.assistants);
        }, []);
    }

    // if selectedGroup changes then set to conversation tab
    useEffect(() => {
        if (activeSubTab !== 'group') {
            if ((selectedAssistant && (selectedAssistant.groupId !== selectedGroup?.id || !(selectedGroup?.assistants.find((ast: Prompt) => ast?.data?.assistant?.definition.assistantId === selectedAssistant.data?.assistant?.definition.assistantId))))
                || (!selectedAssistant && (selectedGroup?.assistants && selectedGroup?.assistants.length > 0))) setSelectedAssistant(selectedGroup?.assistants[0]);
        } 
        if (selectedGroup === undefined && adminGroups.length > 0) {
            setSelectedGroup(adminGroups[0]);
        }

    }, [selectedGroup]);

    useEffect(() => {
        if (selectedAssistant && activeSubTab === 'group') setActiveSubTab(DEFAULT_SUB_TAB)
    }, [selectedAssistant]);


    useEffect(() => {
        if (!syncingPrompts) {
            // needs a second for groups to catch up 
            setTimeout(() => {
                setAdminGroups((groups && groups.length > 0 ? filteredForAdminAccess(groups) : []));
                setLoadingMessage('');
            }, 1000);
        }
    }, [syncingPrompts]);


    useEffect(() => {
        const fetchConversations = async () => {
            if (open && selectedGroup && selectedAssistant && !!selectedGroup?.supportConvAnalysis) {
                setLoadingActionMessage('Fetching conversations...');
                const assistantId = selectedAssistant.data?.assistant?.definition.assistantId;
                // console.log('Assistant ID:', assistantId);
                if (assistantId) {
                    statsService.getGroupAssistantConversationsEvent(assistantId);
                    const result = await getGroupAssistantConversations(assistantId);
                    if (result.success) {
                        let conversationsData = result.data;
                        setConversations(Array.isArray(conversationsData) ? conversationsData : []);
                    } else {
                        // console.error('Failed to fetch conversations:', result.message);
                        setConversations([]);
                    }
                } else {
                    console.error('Assistant ID is undefined');
                }
                setLoadingActionMessage('');
            }
        };

        fetchConversations();
    }, [open, selectedAssistant]);

    useEffect(() => {
        const fetchDashboardData = async () => {
            if (open && selectedGroup && selectedAssistant && !!selectedGroup?.supportConvAnalysis) {
                setLoadingActionMessage('Fetching dashboard data...');
                const assistantId = selectedAssistant.data?.assistant?.definition.assistantId;
                if (assistantId) {
                    statsService.getGroupAssistantDashboardsEvent(assistantId);
                    const result = await getGroupAssistantDashboards(assistantId);
                    if (result && result.success) {
                        setDashboardMetrics(result.data.dashboardData);
                    } else {
                        // console.error('Failed to fetch dashboard data:', result?.message || 'Unknown error');
                        setDashboardMetrics(null);
                    }
                } else {
                    console.error('Assistant ID is undefined');
                }
                setLoadingActionMessage('');
            }
        };

        fetchDashboardData();
    }, [open, selectedAssistant]);


    const groupCreate = async (group: any) => {
        // console.log(group);
        if (!group.group_name) {
            alert("Group name is required. Please add a group name to create the group.");
            return;
        }
        if (group.group_name === AMPLIFY_ASSISTANTS_GROUP_NAME) {
            alert(`The group name ${AMPLIFY_ASSISTANTS_GROUP_NAME} isn't available. Please choose a different group name.`);
            return;
        }
        setLoadingMessage("Creating Group...");
        setShowCreateNewGroup(false);
        // ensure group name is unique 
        if (adminGroups.find((g: Group) => g.name == group.group_name)) {
            alert("Group name must be unique to all groups you are a member of.");
            return;
        } else {
            statsService.createAstAdminGroupEvent(group);
            const resultData = await createAstAdminGroup(group);
            if (!resultData) {
                alert("We are unable to create the group at this time. Please try again later.");
                setShowCreateNewGroup(true);
            } else {
                toast("Group successfully created.");
                const newGroup: Group = resultData;
                setSelectedGroup(newGroup);
                setAdminGroups([...adminGroups, newGroup]);
                // console.log("new group", newGroup)
                //update folders 
                const newGroupFolder = {
                    id: newGroup.id,
                    date: getDate(),
                    name: newGroup.name,
                    type: 'prompt',
                    isGroupFolder: true
                } as FolderInterface
                homeDispatch({ field: 'folders', value: [...folders, newGroupFolder] });

            }
            setLoadingMessage('');
        }
    }

    const handleCreateAssistantPrompt = (group: Group) => {
        const newPrompt = createEmptyPrompt('', group.id);

        const assistantDef: AssistantDefinition = {
            name: '',
            description: "",
            instructions: "",
            tools: [],
            tags: [],
            dataSources: [],
            version: 1,
            fileKeys: [],
            provider: AssistantProviderID.AMPLIFY,
            groupId: group.id
        }
        newPrompt.id = `${group.id}_${group.assistants.length}`;
        newPrompt.groupId = group.id;
        if (!newPrompt.data) newPrompt.data = {};
        if (!newPrompt.data.assistant) newPrompt.data.assistant = {};

        newPrompt.data.assistant.definition = assistantDef;
        return newPrompt
    }


    const handleCreateAssistant = async (astDef: AssistantDefinition, updateType: GroupUpdateType) => {
        // ensure ast is part of the group if it has one 
        if (astDef.data?.groupId && astDef.data?.groupId !== selectedGroup?.id) {
            alert("Something went wrong, please close and reopen the admin interface before trying again.");
            return;
        }

        const updateAstData = { "group_id": selectedGroup?.id, "update_type": updateType, "assistants": [astDef] };
        statsService.updateGroupAssistantsEvent(updateAstData);
        const result = await updateGroupAssistants(updateAstData);
        const response = (result.success) ? result.assistantData[0]
            : {
                id: null,
                assistantId: null,
                provider: AssistantProviderID.AMPLIFY
            };
        response.data_sources = astDef.dataSources;
        response.ast_data = astDef.data;
        return response; 
    }

    const handleDeleteAssistant = async (astpId: string) => {
        if (confirm("Are you sure you want to delete this assistant? You will not be able to undo this change.\n\nWould you like to continue?")) {
            setLoadingActionMessage('Deleting Assistant');

            const updateAstData = {
                "group_id": selectedGroup?.id,
                "update_type": GroupUpdateType.REMOVE,
                "assistants": [astpId]
            };
            statsService.updateGroupAssistantsEvent(updateAstData);
            const result = await updateGroupAssistants(updateAstData);
            if (result.success && selectedGroup) {
                toast("Successfully deleted assistant.");
                const updatedGroupAssistants = selectedGroup.assistants.filter((ast: Prompt) => ast?.data?.assistant?.definition.assistantId !== astpId);
                const updatedGroup = { ...selectedGroup, assistants: updatedGroupAssistants ?? [] };

                const updatedGroups = adminGroups.map((g: Group) => {
                    if (selectedGroup?.id === g.id) return updatedGroup;
                    return g;
                })
                setSelectedGroup(updatedGroup);
                setAdminGroups(updatedGroups);
                // update prompts 
                homeDispatch({ field: 'prompts', value: prompts.filter((ast: Prompt) => ast?.data?.assistant?.definition.assistantId !== astpId) });
            } else {
                alert("Unable to delete this assistant at this time. Please try again later.");
            }
            setLoadingActionMessage('');
        }
    }


    if (!open) {
        return null;
    }

    const formatLabel = (label: string) => {
        return String(label).replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())
    }

    const renderSubTabs = () => (
        <div className="flex flex-col w-full text-[1.05rem]">
            <div className="flex flex-row gap-6 mb-4 px-4 w-full">
                {subTabs.filter((t: SubTabType) => t !== 'conversations' || selectedGroup?.supportConvAnalysis)
                    .map((label: SubTabType) =>
                        label === 'group' ? (
                            <React.Fragment key={label}>
                                {selectedAssistant && selectedAssistant?.data?.assistant?.definition &&
                                    <>
                                        <button
                                            type="button"
                                            className={`flex flex-row gap-2 p-2 bg-gradient-to-r from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/30 text-red-700 dark:text-red-300 hover:from-red-600 hover:to-red-700 hover:text-white dark:hover:from-red-700 dark:hover:to-red-600 transition-all duration-200 rounded-lg shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500`}
                                            onClick={() => handleDeleteAssistant(selectedAssistant?.data?.assistant.definition.assistantId)}>

                                            Delete Assistant
                                        </button>
                                        <label className='ml-auto mt-2 text-sm flex flex-row gap-3 text-black dark:text-neutral-100'
                                        // title={"Use the assistant id in "}
                                        >
                                            <div className={`mt-1.5 ${selectedAssistant?.data?.isPublished ? "bg-green-400 dark:bg-green-300" : "bg-gray-400 dark:bg-gray-500"}`}
                                                style={{ width: '8px', height: '8px', borderRadius: '50%' }}></div>
                                            <div className='overflow-x-auto flex grow whitespace-nowrap'>
                                                Assistant Id: {selectedAssistant.data.assistant.definition.assistantId}
                                            </div>
                                        </label>
                                    </>
                                }
                                { activeSubTab !== 'group' &&
                                <button className={`h-[36px] rounded-xl ml-auto mr-[-16px] whitespace-nowrap transition-all duration-200`}
                                    key={label}
                                    onClick={() => {
                                        setActiveSubTab(label);
                                        setSelectedAssistant(undefined);
                                    }}
                                    title="Manage users and assistant group types"
                                >
                                    <div className={`flex flex-row gap-1 text-sm text-white px-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 transition-all duration-200 py-2 rounded-lg shadow-sm`}>
                                        <IconSettings className='mt-0.5' size={16} />
                                        Group Management
                                    </div>
                                </button>}
                            </React.Fragment>
                        ) :
                            (selectedAssistant ? (
                                <button key={label} className={`${activeSubTab === label ? 'text-white flex flex-row gap-1 px-2 bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-200 ' : ' text-neutral-500 bg-gray-300 text-black dark:bg-gray-600 dark:text-white'} 
                                                                rounded-md shadow-sm px-4 py-2 ${!selectedAssistant ? 'hidden' : 'visible'}`}
                                    onClick={() => setActiveSubTab(label)}>
                                    {formatLabel(label)}
                                </button>
                            ) : <React.Fragment key={label}></React.Fragment>)
                    )}
            </div>
        </div>

    );

    const renderContent = () => {
        switch (activeSubTab) {
            case 'conversations':
                return (selectedAssistant ? <ConversationTable
                    conversations={conversations}
                    // Check BOTH group-level permission and assistant-specific setting
                    supportConvAnalysis={!!selectedGroup?.supportConvAnalysis && !!selectedAssistant?.data?.supportConvAnalysis}
                /> : <></>);
            case 'dashboard':
                if (selectedGroup?.assistants.length === 0) return null;
                if (!selectedGroup?.supportConvAnalysis) return <div className='w-full text-center text-lg text-black dark:text-white'>
                    {"Access to dashboard metrics and assistant conversation history is not currently available for this group."}
                    <br></br>
                    To request access to these features, please reach out to Amplify for approval.
                </div>

                return (
                    selectedAssistant && dashboardMetrics ?
                        <Dashboard
                            metrics={dashboardMetrics}
                            supportConvAnalysis={!!selectedGroup?.supportConvAnalysis && !!selectedAssistant?.data?.supportConvAnalysis}
                        /> :
                        <div className="text-black dark:text-white">
                            No dashboard data available for {selectedAssistant?.name}
                            (Assistant ID: {selectedAssistant?.data?.assistant?.definition.assistantId})
                        </div>
                );


            case 'edit_assistant':
                return (selectedAssistant && !showCreateGroupAssistant ? <div key="admin_edit">
                    <AssistantModal
                        assistant={selectedAssistant}
                        onSave={() => { }}
                        onCancel={() => setActiveSubTab(DEFAULT_SUB_TAB)}
                        onUpdateAssistant={(astprompt: Prompt) => {

                            setAdditionalGroupData({});
                            if (selectedGroup) {
                                astprompt.groupId = selectedGroup?.id;
                                astprompt.folderId = selectedGroup?.id;
                                const updatedAssistants = selectedGroup?.assistants.map((ast: Prompt) => {
                                    if (ast.data?.assistant?.definition.assistantId === astprompt.data?.assistant?.definition.assistantId) {
                                        astprompt.data = { ...astprompt?.data, noEdit: false };
                                        return astprompt;
                                    }
                                    return ast;
                                })
                                setSelectedAssistant(astprompt);
                                const updatedGroup = { ...selectedGroup, assistants: updatedAssistants ?? [] }
                                const updatedGroups = adminGroups.map((g: Group) => {
                                    if (selectedAssistant?.groupId === g.id) return updatedGroup;
                                    return g;
                                })
                                setSelectedGroup(updatedGroup);
                                setAdminGroups(updatedGroups);
                                // console.log(astprompt);

                                statsService.createPromptEvent(astprompt);
                                // update prompt
                                const updatedPrompts: Prompt[] = prompts.map((curPrompt: Prompt) => {
                                    if (curPrompt?.data?.assistant?.definition.assistantId ===
                                        astprompt.data?.assistant?.definition.assistantId) return astprompt;
                                    return curPrompt;
                                });
                                homeDispatch({ field: 'prompts', value: updatedPrompts });
                                setTimeout(() => {
                                    setActiveSubTab('edit_assistant');
                                }, 800);
                            } else {
                                alert("Something went wrong, please close and reopen the admin interface before trying again.")
                            }

                        }}
                        loadingMessage={`Updating Assistant '${selectedAssistant.name}'...`}
                        disableEdit={!!showCreateGroupAssistant}
                        loc={"admin_update"}
                        //  title={selectedGroup?.name + " Assistant"}
                        height={`${(innderWindow.height * 0.76) - 165}px`}
                        embed={true}
                        additionalGroupData={additionalGroupData}
                        onCreateAssistant={(astDef: AssistantDefinition) => { return handleCreateAssistant(astDef, GroupUpdateType.UPDATE) }}
                    >
                        <AssistantModalConfigs
                            groupId={selectedGroup?.id || '_'}
                            astId={selectedAssistant.id}
                            astData={selectedAssistant?.data}
                            groupTypes={selectedGroup?.groupTypes}
                            additionalGroupData={additionalGroupData}
                            setAdditionalGroupData={setAdditionalGroupData}
                            groupConvAnalysisSupport={!!selectedGroup?.supportConvAnalysis}
                        />
                    </AssistantModal>
                </div>
                    : <></>)

            case 'group':
                return selectedGroup ? <GroupManagement
                    selectedGroup={selectedGroup}
                    setSelectedGroup={setSelectedGroup}
                    members={selectedGroup?.members ?? {}}
                    allEmails={allEmails?.filter((e: string) => e !== `#${selectedGroup.name}` && !Object.keys(selectedGroup.members).includes(e)) || []}
                    setLoadingActionMessage={setLoadingActionMessage}
                    adminGroups={adminGroups}
                    setAdminGroups={setAdminGroups}
                    amplifyGroups={amplifyGroups ?? []}
                    systemUsers={systemUsers ?? []}
                />
                    : null;
            default:
                return null;
        }
    };

    return featureFlags.createAstAdminGroups && !loadingMessage &&
        (adminGroups.length === 0 || showCreateNewGroup) ?
        // Allow the option to create a new group if user has no group where they have either admin or write access. 
        (
            <CreateAdminDialog
                createGroup={groupCreate}
                onClose={onClose} // note clear for built in one
                allEmails={allEmails}
                message={adminGroups.length === 0 ? "You currently do not have admin access to any groups." : ""}
                amplifyGroups={amplifyGroups ?? []}
                systemUsers={systemUsers ?? []}
            />
        ) :
        // User has groups 
        (
        <Modal
            fullScreen={true}
            showClose={false}
            showCancel={false}
            showSubmit={false}
            onCancel={onClose}
            disableContentAnimation={true}
            content={ <div className="no-modal-animation">
                        <LoadingDialog open={!!loadingMessage} message={loadingMessage} />
                            {loadingActionMessage && (
                                <div className="absolute inset-0 flex items-center justify-center z-60" key={"loading"}
                                    style={{ transform: `translateY(-40%)` }}>
                                    <div className="p-3 flex flex-row items-center  border border-gray-500 bg-[#202123]">
                                        <LoadingIcon style={{ width: "24px", height: "24px" }} />
                                        <span className="text-lg font-bold ml-2 text-white">{loadingActionMessage + '...'}</span>
                                    </div>
                                </div>
                            )
                            }
                            {selectedGroup && showCreateGroupAssistant && (
                                <div key={'admin_add'}>
                                    <AssistantModal
                                        assistant={handleCreateAssistantPrompt(selectedGroup)}
                                        onSave={() => {
                                        }}
                                        onCancel={() => {
                                            setAdditionalGroupData({});
                                            setShowCreateGroupAssistant(null);
                                        }}
                                        onUpdateAssistant={(astprompt: Prompt) => {

                                            setAdditionalGroupData({});
                                            astprompt.groupId = selectedGroup.id;
                                            astprompt.folderId = selectedGroup.id;
                                            astprompt.data = { ...astprompt?.data, noEdit: false };
                                            setSelectedAssistant(astprompt);
                                            const updatedGroup = { ...selectedGroup, assistants: [...selectedGroup.assistants ?? [], astprompt] };
                                            const updatedGroups = adminGroups.map((g: Group) => {
                                                if (astprompt?.groupId === g.id) return updatedGroup;
                                                return g;
                                            })
                                            setSelectedGroup(updatedGroup);
                                            setAdminGroups(updatedGroups);
                                            console.log(astprompt);

                                            statsService.createPromptEvent(astprompt);

                                            // update prompts
                                            homeDispatch({ field: 'prompts', value: [...prompts, astprompt] });
                                            setShowCreateGroupAssistant(null);
                                            setActiveSubTab('edit_assistant');
                                        }}

                                        loadingMessage={`Creating Assistant for Group '${selectedGroup.name}'`}
                                        loc={"admin_add"}
                                        title={`Creating New Assistant for ${selectedGroup.name}`}
                                        height={`${innderWindow.height * 0.7}px`}
                                        additionalTemplates={allAssistants()}
                                        autofillOn={true}
                                        additionalGroupData={additionalGroupData}
                                        onCreateAssistant={(astDef: AssistantDefinition) => { return handleCreateAssistant(astDef, GroupUpdateType.ADD) }}
                                    >

                                        <AssistantModalConfigs
                                            groupId={selectedGroup.id}
                                            astId={`${selectedGroup.id}_${selectedGroup.assistants.length}`}
                                            groupTypes={selectedGroup.groupTypes}
                                            additionalGroupData={additionalGroupData}
                                            setAdditionalGroupData={setAdditionalGroupData}
                                            groupConvAnalysisSupport={!!selectedGroup.supportConvAnalysis}
                                        />
                                    </AssistantModal>

                                </div>

                            )}
                            <div key={`${selectedGroup?.id}_GroupSelect`}>
                                <GroupSelect
                                    groups={adminGroups}
                                    selectedGroup={selectedGroup}
                                    setSelectedGroup={setSelectedGroup}
                                    setShowCreateNewGroup={setShowCreateNewGroup}
                                    onClose={onClose}
                                />
                            </div>


                            {selectedGroup &&
                                <>
                                    <div key={`${selectedGroup?.id}_Assistants`}>
                                        <div className="mb-4 flex flex-row items-center justify-between bg-transparent rounded-t border-b border-neutral-400  dark:border-white/20">
                                            {selectedGroup.assistants.length === 0 && <label className='text-center text-black dark:text-white text-lg'
                                                style={{ width: `${innderWindow.width * 0.75}px` }}>
                                                You currently do not have any assistants in this group. </label>}

                                            <div className="overflow-hidden">
                                                <div className="flex flex-row gap-1 flex-nowrap ml-2 pr-2">
                                                    {selectedGroup.assistants.length > 0 && selectedGroup.assistants.map((ast: Prompt, index: number) => (
                                                        <button
                                                            key={`${ast.name}_${index}`}
                                                            onClick={() => {
                                                                setSelectedAssistant(ast)
                                                                setActiveSubTab(DEFAULT_SUB_TAB);
                                                            }}
                                                            title={selectedAssistant?.data?.isPublished ? 'Published' : 'Unpublished'}
                                                            className={`group relative rounded-t-lg flex flex-shrink-0 overflow-hidden ${activeAstTab && activeAstTab === ast.data?.assistant?.definition.assistantId ? 
                                                                       'px-4 py-2 text-blue-800 bg-blue-200 bg-opacity-50 dark:border-gray-500 dark:text-white shadow-sm font-medium scale-105' :
                                                                        'py-1 px-1.5 text-gray-400 dark:text-gray-600'}`}
                                                            style={{
                                                                transition: 'background-color 300ms, color 300ms, transform 300ms, box-shadow 300ms, padding 300ms, opacity 300ms'
                                                            }}
                                                        >
                                                            {/* Tab highlight effect */}
                                                            <span className={`absolute inset-0 ${activeAstTab && activeAstTab === ast.data?.assistant?.definition.assistantId ? 'opacity-100' : 'opacity-0'} 
                                                                transition-opacity duration-300 bg-gradient-to-br from-blue-100/50 to-blue-200/30 
                                                                dark:from-blue-800/20 dark:to-blue-900/10`}></span>
    
                                                            {/* Tab bottom border glow */}
                                                            <span className={`absolute bottom-0 left-0 right-0 h-1 transition-all duration-300 ${
                                                                activeAstTab && activeAstTab === ast.data?.assistant?.definition.assistantId ? 'opacity-100' : 'opacity-0'
                                                            }`} 
                                                            style={{
                                                                backgroundColor: activeAstTab && activeAstTab === ast.data?.assistant?.definition.assistantId ? 'rgb(10, 130, 221)' : 'transparent',
                                                                boxShadow: activeAstTab && activeAstTab === ast.data?.assistant?.definition.assistantId ? '0 0 8px rgba(5, 129, 186, 0.58)' : 'none'
                                                            }}></span>
    
                                                            {/* Content wrapper */}
                                                            <span className={`relative flex items-center justify-center transition-transform duration-300`}>
                                                                <h3 className="text-xl">{ast.name.charAt(0).toUpperCase() + ast.name.slice(1)}</h3>
                                                            </span>
                                                        </button>

                                                    ))
                                                    }
                                                </div>
                                            </div>

                                            <div className="flex items-center mb-2">
                                                <button
                                                    className="flex flex-row gap-1 text-sm text-white px-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 transition-all duration-200 py-2 rounded-lg shadow-sm"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setShowCreateGroupAssistant(selectedGroup.name);
                                                    }}
                                                >
                                                    <IconPlus className='mt-0.5 mr-2' size={16} /> Create Assistant
                                                </button>
                                            </div>
                                        </div>
                                        <div className='overflow-y-auto' style={{ maxHeight: 'calc(100% - 60px)' }}>
                                            {renderSubTabs()}
                                            {renderContent()}
                                        </div>
                                    </div>
                                </>
                            }
                 </div>}

            />

        );
};


interface SelectProps {
    groups: Group[];
    selectedGroup: Group | undefined;
    setSelectedGroup: (g: Group) => void;
    setShowCreateNewGroup: (e: boolean) => void;
    onClose: () => void;
}

const GroupSelect: FC<SelectProps> = ({ groups, selectedGroup, setSelectedGroup, setShowCreateNewGroup, onClose }) => {
    const { state: { featureFlags }, dispatch: homeDispatch } = useContext(HomeContext);

    return (
        <div className='flex flex-row gap-2 mb-2'>
            <select className={"mb-2 w-full text-[1.4rem] text-center rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100  custom-shadow"}
                    id="selectAssistantGroup"
                    value={selectedGroup?.name ?? ''}
                    title='Select Group'
                onChange={(event) => {
                    if (event.target.value === GroupUpdateType.ADD) {
                        setShowCreateNewGroup(true);
                    } else {
                        const selectedAccount = groups.find(group => group.name === event.target.value);
                        if (selectedAccount) setSelectedGroup(selectedAccount);
                    }
                }}
            >
                {groups.map((group) => (
                    <option key={group.id} value={group.name}>
                        {group.name}
                    </option>
                ))}
                {featureFlags.createAstAdminGroups &&
                    <option value={GroupUpdateType.ADD}>
                        {"+ Create New Group"}
                    </option>
                }
            </select>
            <div className='ml-auto mt-2'>
            <ActionButton
                handleClick={() => onClose()}
                title={"Close"}
            >
                <IconX size={24}/>
            </ActionButton>
            </div>
        </div>

    );
}



interface AssistantModalProps {
    groupId: string;
    astId: string;
    astData?: any;
    groupTypes?: string[];
    additionalGroupData: any;
    setAdditionalGroupData: (data: any) => void;
    groupConvAnalysisSupport: boolean;
}

// To add more configuarations to the assistant, add components here and ensure the change is set in additionalGroupData
export const AssistantModalConfigs: FC<AssistantModalProps> = ({ groupId, astId, astData = {}, groupTypes = [], additionalGroupData, setAdditionalGroupData, groupConvAnalysisSupport }) => {
    const {
        state: { availableModels }
    } = useContext(HomeContext);
    const [isPublished, setIsPublished] = useState<boolean>(astData.isPublished ?? false);
    const [enforceModel, setEnforceModel] = useState<boolean>(!!astData.model);
    const [trackConversations, setTrackConversations] = useState<boolean>(astData.trackConversations ?? false);
    const [showTrackingRequiredMessage, setShowTrackingRequiredMessage] = useState<boolean>(false);
    const [astSupportConvAnalysis, setAstSupportConvAnalysis] = useState<boolean>(astData.supportConvAnalysis ?? false);
    const [analysisCategories, setAnalysisCategories] = useState<string[]>(astData.analysisCategories ?? []);

    // Hide the message after 3 seconds when it's shown
    useEffect(() => {
        let timeout: NodeJS.Timeout;
        if (showTrackingRequiredMessage) {
            timeout = setTimeout(() => {
                setShowTrackingRequiredMessage(false);
            }, 3000);
        }
        return () => {
            if (timeout) clearTimeout(timeout);
        };
    }, [showTrackingRequiredMessage]);

    const updateCategories = (categories: string[]) => {
        setAnalysisCategories(categories);
        setAdditionalGroupData({ ...additionalGroupData, analysisCategories: categories });
    }

    const checkAvailableModel = () => {
        const isValid = checkAvailableModelId(astData.model, availableModels);
        return isValid;
    }

    const onSupportConvAnalysisChange = (isChecked: boolean) => {
        setAdditionalGroupData({
            ...additionalGroupData,
            supportConvAnalysis: isChecked,
            // Ensure trackConversations is also enabled when supportConvAnalysis is enabled
            trackConversations: isChecked ? true : additionalGroupData.trackConversations
        });

        setAstSupportConvAnalysis(isChecked);

        // If enabling analysis, also enable tracking if it's not already enabled
        if (isChecked && !trackConversations) {
            setTrackConversations(true);
        }
    };

    return <div className='flex flex-col' key={astId}>
        <div className='mb-4 flex flex-row gap-3 text-[1.05rem]'>
            <Checkbox
                id="publishAssistant"
                label="Publish assistant to read-access members"
                checked={isPublished}
                onChange={(isChecked: boolean) => {
                    setAdditionalGroupData({ ...additionalGroupData, isPublished: isChecked });

                    setIsPublished(isChecked);
                }}
            />
        </div>
        <div className='mb-1 flex flex-row gap-3 text-[1rem]'>
            <Checkbox
                id="enforceModel"
                label="Enforce Model"
                checked={enforceModel}
                onChange={(isChecked: boolean) => {
                    if (!isChecked) {
                        setAdditionalGroupData({ ...additionalGroupData, model: undefined });
                    } else if (astData.model) setAdditionalGroupData({ ...additionalGroupData, model: astData.model });

                    setEnforceModel(isChecked);
                }}
            />
        </div>
        <div className={`ml-6 flex flex-col ${enforceModel ? "" : 'opacity-40'} `}>
            All conversations will be set to this model and unable to be changed by the user.
            <ModelSelect
                applyModelFilter={false}
                isTitled={false}
                modelId={checkAvailableModel()}
                outlineColor={enforceModel && !additionalGroupData.model ? 'red-500' : ''}
                isDisabled={!enforceModel}
                disableMessage=''
                handleModelChange={(model: string) => {
                    setAdditionalGroupData({ ...additionalGroupData, model: model });
                }}
            />
        </div>

        {groupConvAnalysisSupport && <>
            <div className='mt-4 flex flex-row gap-3 text-[1.05rem]'>
                <Checkbox
                    id="trackConversations"
                    label="Track Conversations"
                    checked={trackConversations || astSupportConvAnalysis}
                    onChange={(isChecked: boolean) => {
                        // Only allow changes if analysis support is not enabled
                        // This prevents unchecking when analysis is enabled
                        if (!astSupportConvAnalysis || isChecked) {
                            setAdditionalGroupData({ ...additionalGroupData, trackConversations: isChecked });
                            setTrackConversations(isChecked);
                        } else {
                            // Show the notification message when trying to uncheck while analysis is enabled
                            setShowTrackingRequiredMessage(true);
                        }
                    }}
                />
            </div>
            <div className={`ml-6 flex flex-col ${trackConversations || astSupportConvAnalysis ? "" : 'opacity-40'}`}>
                Enable the dashboard and conversation tracking with this assistant for monitoring and review purposes.
                {astSupportConvAnalysis &&
                    <div className={`text-amber-500 mt-1 transition-opacity duration-300 ${showTrackingRequiredMessage ? 'opacity-100' : 'opacity-70'}`}>
                        <small>
                            {showTrackingRequiredMessage
                                ? "Track Conversations is required when Analyze Conversations is enabled"
                                : "Automatically enabled when Analyze Conversations is active"}
                        </small>
                    </div>
                }
            </div>

            <div className='mt-4 flex flex-row gap-3 text-[1rem]'>
                <Checkbox
                    id="supportAnalysis"
                    label="Analyze Conversations"
                    checked={astSupportConvAnalysis}
                    onChange={onSupportConvAnalysisChange}
                />
            </div>
            <div className={`ml-6 flex flex-col ${astSupportConvAnalysis ? "" : 'opacity-40'}`}>
                Enable AI-powered categorization of user interactions.
                <br></br>
                {"Define custom categories to classify interactions and evaluate the assistant's performance for quality, relevance, and effectiveness."}
                <br className='mb-2'></br>
                <ExpansionComponent
                    title='Manage Category List'
                    content={
                        <TagsList label={"Categories"}
                            addMessage={"List categories separated by commas:"}
                            tags={analysisCategories}
                            setTags={(categories) => updateCategories(categories)}
                            removeTag={(category) => updateCategories(analysisCategories.filter((t: string) => t !== category))}
                            isDisabled={!astSupportConvAnalysis} />
                    }
                />
            </div>
        </>}
        <br className='mb-1'></br>
        <GroupTypesAstData
            groupId={groupId}
            astPromptId={astId}
            assistantGroupData={astData.groupTypeData ?? {}}
            groupUserTypeQuestion={astData.groupUserTypeQuestion}
            groupTypes={groupTypes}
            additionalGroupData={additionalGroupData}
            setAdditionalGroupData={setAdditionalGroupData}
        />
    </div>
}

interface TypeProps {
    groupTypes: string[];
    setGroupTypes: (gt: string[]) => void;
    canAddTags?: boolean;
    showControlButtons?: boolean;
    onConfirm?: () => void;
    onCancel?: () => void;
}

export const GroupTypesAst: FC<TypeProps> = ({ groupTypes, setGroupTypes, canAddTags = true, showControlButtons = false, onConfirm, onCancel }) => {
    return <>
        <div className="text-md pb-1 font-bold text-black dark:text-white flex items-center">
            Group Types
        </div>
        <InfoBox color='#085bd6' content={
            <span className="ml-2 text-xs">
                • Creating group types enables the subdivision of users into subgroups when interacting with an assistant.
                <br className='mb-2'></br>
                • When creating or editing an assistant, you can select which group types to apply. This allows you to incorporate specific custom instructions and data sources tailored to each group.

                Additionally, you can specify which group types should have chat disabled, and provide reasons for this restriction.
                <br className='mb-2'></br>
                • Before engaging with an assistant that has group types defined, users must identify their subgroup by selecting which group they belong to.

                This ensures that the interaction is customized with the appropriate instructions and data sources specific to their group type.

            </span>
        } />
        <div className='flex flex-row gap-2'>

            {showControlButtons && onConfirm && onCancel &&
                <div className="mt-1.5 flex flex-row gap-1 h-[20px]">
                    <button
                        className="text-green-500 hover:text-green-700 cursor-pointer"
                        onClick={(e) => {
                            e.stopPropagation();
                            onConfirm();
                        }}
                        title={"Confirm Changes"}
                    >
                        <IconCheck size={18} />
                    </button>

                    <button
                        className="text-red-500 hover:text-red-700 cursor-pointer"
                        onClick={(e) => {
                            e.stopPropagation();
                            onCancel();
                        }}
                        title={"Cancel"}
                    >
                        <IconX size={18} />
                    </button>
                </div>
            }

            <TagsList label={"Types"}
                addMessage={"List group types separated by commas:"}
                tags={groupTypes}
                setTags={(tags) => setGroupTypes(tags)}
                removeTag={(tag) => setGroupTypes(groupTypes.filter((t: string) => t !== tag))}
                isDisabled={!canAddTags} />
        </div>
    </>
}

interface TypeAstProps {
    groupId: string;
    astPromptId: string;
    assistantGroupData: AstGroupTypeData;
    groupUserTypeQuestion: string | undefined;
    groupTypes: string[];
    additionalGroupData: any;
    setAdditionalGroupData: (data: any) => void;
}

export const GroupTypesAstData: FC<TypeAstProps> = ({ groupId, astPromptId, assistantGroupData, additionalGroupData, setAdditionalGroupData, groupUserTypeQuestion, groupTypes }) => {
    const { state: { featureFlags } } = useContext(HomeContext);
    const preexistingDSids: { [key: string]: string[] } = {};

    const initialDs = (dataSources: any) => {
        return (dataSources).map((ds: any) => {
            return {
                ...ds,
                key: (ds.key || ds.id)
            }
        });
    }

    const initialStates = (initDs: any[]) => {
        return initDs.map(ds => {
            return { [ds.id]: 100 }
        }).reduce((acc, x) => {
            acc = { ...acc, ...x };
            return acc;
        }, {});
    }

    const initializeGroupTypeData = () => {
        const updatedGroupTypeData = Object.keys(assistantGroupData).reduce((acc: any, key) => {
            if (groupTypes.includes(key)) {
                acc[key] = assistantGroupData[key];
            }
            return acc;
        }, {});

        groupTypes.forEach((type: string) => {
            if (!updatedGroupTypeData[type]) {
                updatedGroupTypeData[type] = {
                    additionalInstructions: '', dataSources: [], documentState: {},
                    isDisabled: false, disabledMessage: ''
                };
            } else {
                const initDS = initialDs(updatedGroupTypeData[type].dataSources);
                updatedGroupTypeData[type].dataSources = initDS;
                updatedGroupTypeData[type].documentState = initialStates(initDS) as { [key: string]: number };
            }
            preexistingDSids[type] = updatedGroupTypeData[type].dataSources.map((ds: any) => ds.id);
        });
        return updatedGroupTypeData;
    };

    const [selectedTypes, setSelectedTypes] = useState<string[]>(Object.keys(assistantGroupData) || []);
    const [groupTypeData, setGroupTypeData] = useState<AstGroupTypeData>(initializeGroupTypeData());
    const [userQuestion, setUserQuestion] = useState<string>(groupUserTypeQuestion || '');

    const groupTypeDataRef = useRef(groupTypeData);

    useEffect(() => {
        groupTypeDataRef.current = groupTypeData;
    }, [groupTypeData]);

    const [showDataSourceSelector, setShowDataSourceSelector] = useState<string>('');

    useEffect(() => {
        setTimeout(() => { // ensure the groupdata state has updated, both ref an d groupTypeData would be outdated some times
            const filteredGroupTypeData = Object.entries(groupTypeData).reduce((acc: any, [key, value]) => {
                if (selectedTypes.includes(key)) {
                    acc[key] = value;
                }
                return acc;
            }, {});
            setAdditionalGroupData({ ...additionalGroupData, groupTypeData: filteredGroupTypeData });

        }, 100);
    }, [groupTypeData, selectedTypes])

    useEffect(() => {
        setAdditionalGroupData({ ...additionalGroupData, groupUserTypeQuestion: userQuestion });

    }, [userQuestion])

    const updateGroupType = (type: string, property: string, value: any) => {
        // console.log("Property: ", property)
        // console.log("Value: ", value)
        setGroupTypeData(prev => ({
            ...prev,
            [type]: {
                ...prev[type],
                [property]: value
            }
        }));
    };


    const updateDocumentState = (type: string, docId: string, progress: number) => {
        setGroupTypeData(prev => ({
            ...prev,
            [type]: {
                ...prev[type],
                documentState: {
                    ...prev[type].documentState,
                    [docId]: progress,
                },
            },
        }));
    };

    const createDataSourceHandlers = (type: string) => {
        return {
            onAttach: (doc: AttachedDocument) => {
                updateGroupType(type, 'dataSources', [...groupTypeDataRef.current[type].dataSources, doc]);
            },
            onSetMetadata: (doc: AttachedDocument, metadata: any) => {
                updateGroupType(type, 'dataSources', groupTypeDataRef.current[type].dataSources.map(x =>
                    x.id === doc.id ? { ...x, metadata } : x
                ));
            },
            onSetKey: (doc: AttachedDocument, key: string) => {
                updateGroupType(type, 'dataSources', groupTypeDataRef.current[type].dataSources.map(x =>
                    x.id === doc.id ? { ...x, key } : x
                ));
            },
            onUploadProgress: (doc: AttachedDocument, progress: number) => {
                updateDocumentState(type, doc.id, progress);
            }
        };
    };

    //on save we will only save the grouptype data that is in the selected types
    if (groupTypes.length === 0) return <></>

    return <div className='my-4 text-black dark:text-neutral-200text-black dark:text-neutral-200'>
        <div className="text-md font-bold flex items-center">
            Group Types
        </div>
        Select applicable group types for this assistant. These will appear to the user as an option to choose from before chatting.
        <div className='ml-4 flex flex-row gap-2 mt-2'>
            {groupTypes.map((type: string) =>
                <div className='flex flex-row gap-2 mb-4' key={type}>
                    <input
                        className='ml-2'
                        type="checkbox"
                        checked={selectedTypes.includes(type)}
                        onChange={(e) => {
                            if (e.target.checked) {
                                // Add type to the list if checkbox is checked
                                setSelectedTypes(prevList => [...prevList, type]);
                            } else {
                                // Remove type from the list if checkbox is unchecked
                                setSelectedTypes(prevList => prevList.filter(name => name !== type));
                            }
                        }}
                    />
                    {type}
                </div>
            )}

        </div>

        {selectedTypes.length > 0 &&
            <div className='w-full flex flex-col gap-2 mb-2'>
                Prompt Message for User Group Selection
                <textarea
                    className="mb-2 rounded-md border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                    style={{ resize: 'none' }}
                    placeholder={`Message to display to user when selecting one of the group types prior to chatting.\n (default message: "Please select the group you best identify with to start chatting."')`}
                    value={userQuestion}
                    onChange={(e) => setUserQuestion(e.target.value)}
                    rows={2}
                />

                <ExpansionComponent
                    title='Manage Selected Group Type Data'
                    content={
                        Object.entries(groupTypeData)
                            .filter(([type]) => selectedTypes.includes(type))
                            .map(([type, data]) => {
                                const handlers = createDataSourceHandlers(type);
                                return <ExpansionComponent
                                    key={type}
                                    isOpened={true}
                                    title={type}
                                    content={

                                        <div className='flex flex-col gap-2 my-4 text-black dark:text-neutral-200' key={type}>
                                            <div className='flex flex-row'>
                                                {data.isDisabled ? "Disable Message For User" : "Additional Instructions"}
                                                <div className='ml-auto mr-4 flex flex-row gap-2'>
                                                    <input
                                                        className='ml-2'
                                                        type="checkbox"
                                                        checked={data.isDisabled}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                updateGroupType(type, 'isDisabled', true);
                                                            } else {
                                                                updateGroupType(type, 'isDisabled', false);
                                                            }
                                                        }}
                                                    />
                                                    Disable chat for this group type
                                                </div>

                                            </div>
                                            {data.isDisabled ?
                                                <textarea
                                                    className="mb-2 rounded-md border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                                    style={{ resize: 'none' }}
                                                    placeholder={`Message to display for selected disabled type: ${type}`}
                                                    value={data.disabledMessage}
                                                    onChange={(e) => updateGroupType(type, 'disabledMessage', e.target.value)}
                                                    rows={3}
                                                />
                                                :
                                                <textarea
                                                    className="mb-2 rounded-md border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                                    style={{ resize: 'none' }}
                                                    placeholder={`Additional instructions specific for this group type: ${type}`}
                                                    value={data.additionalInstructions}
                                                    onChange={(e) => updateGroupType(type, 'additionalInstructions', e.target.value)}
                                                    rows={3}
                                                />}

                                            {!data.isDisabled && (
                                                <>
                                                    Additional Data Sources

                                                    <div className="flex flex-row items-center">

                                                        <button
                                                            title='Add Files'
                                                            className={`left-1 top-2 rounded-sm p-1 text-neutral-800 opacity-60 hover:bg-neutral-200 hover:text-neutral-900 dark:hover:text-neutral-200 dark:bg-opacity-50 dark:text-neutral-100 `}
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                setShowDataSourceSelector(showDataSourceSelector === type ? '' : type);
                                                            }}
                                                            onKeyDown={(e) => {

                                                            }}
                                                        >
                                                            <IconFiles size={20} />
                                                        </button>

                                        <AttachFile id={`__attachFile_admin_${type}_${groupId}_${astPromptId}`}
                                                    groupId={groupId}
                                                    disallowedFileExtensions={COMMON_DISALLOWED_FILE_EXTENSIONS}
                                                    onAttach={handlers.onAttach}
                                                    onSetMetadata={handlers.onSetMetadata}
                                                    onSetKey={handlers.onSetKey}
                                                    onUploadProgress={handlers.onUploadProgress}
                                                    disableRag={false}
                                        />
                                    </div>

                                    <FileList 
                                        documents={data.dataSources.filter((ds:AttachedDocument) => !(preexistingDSids[type].includes(ds.id)))} 
                                        documentStates={data.documentState}
                                        setDocuments={(docs:AttachedDocument[]) => updateGroupType(type, 'dataSources', docs)} 
                                        onCancelUpload={(ds:AttachedDocument) => { 
                                            // Remove document from documentState
                                            const updatedDocState = {...data.documentState};
                                            delete updatedDocState[ds.id];
                                            updateGroupType(type, 'documentState', updatedDocState);
                                        }}
                                    />
                                    
                                    {showDataSourceSelector === type && (
                                        <div className="mt-[-10px] justify-center overflow-x-hidden">
                                            <div className="rounded bg-white dark:bg-[#343541]">
                                                <DataSourceSelector
                                                    disallowedFileExtensions={COMMON_DISALLOWED_FILE_EXTENSIONS}
                                                    onClose={() => setShowDataSourceSelector('')}
                                                    minWidth="500px"
                                                    onDataSourceSelected={(d) => {
                                                        const doc = {
                                                            id: d.id,
                                                            name: d.name || "",
                                                            raw: null,
                                                            type: d.type || "",
                                                            data: "",
                                                            metadata: d.metadata,
                                                        };
                                                        updateGroupType(type, 'dataSources', [...groupTypeData[type].dataSources, doc]);
                                                        updateDocumentState(type, doc.id, 100);
                                                    }}
                                                    onIntegrationDataSourceSelected={featureFlags.integrations ? 
                                                        (file: File) => { handleFile(file, handlers.onAttach, handlers.onUploadProgress, handlers.onSetKey, 
                                                                          handlers.onSetMetadata, () => {}, featureFlags.uploadDocuments, groupId, featureFlags.ragEnabled)} 
                                                        : undefined
                                                    }
                                                />
                                            </div>
                                        </div>
                                    )} 

                                                    {preexistingDSids[type].length > 0 &&
                                                        <ExistingFileList
                                                            label={`${type} Data Sources`} boldTitle={false}
                                                            documents={data.dataSources.filter((ds: AttachedDocument) => preexistingDSids[type].includes(ds.id))}
                                                            setDocuments={(docs: AttachedDocument[]) => updateGroupType(type, 'dataSources', docs)} />
                                                    }

                                                </>)}

                                        </div>
                                    } />
                            })
                    }
                />
            </div>


        }
    </div>
}