import React, { FC, useContext, useEffect, useRef, useState } from 'react';
import HomeContext from '@/pages/api/home/home.context';
import { IconCheck, IconFiles, IconPlus, IconSettings, IconTrashX, IconX } from '@tabler/icons-react';
import Loader from "@/components/Loader/Loader";
import { AssistantModal } from '../Promptbar/components/AssistantModal';
import { Prompt } from '@/types/prompt';
import { Group, GroupAccessType, AstGroupTypeData, GroupUpdateType, Members } from '@/types/groups';
import { createEmptyPrompt } from '@/utils/app/prompts';
import { useSession } from 'next-auth/react';
import { EmailsAutoComplete } from '@/components/Emails/EmailsAutoComplete';
import { createAstAdminGroup, deleteAstAdminGroup, updateGroupAssistants, updateGroupMembers, updateGroupMembersPermissions, updateGroupTypes } from '@/services/groupsService';
import Search from '../Search';
import { TagsList } from '../Chat/TagsList';
import ExpansionComponent from '../Chat/ExpansionComponent';
import { AttachFile } from '../Chat/AttachFile';
import { COMMON_DISALLOWED_FILE_EXTENSIONS } from '@/utils/app/const';
import { AssistantDefinition } from '@/types/assistant';
import { DataSourceSelector } from '../DataSources/DataSourceSelector';
import { AttachedDocument } from '@/types/attacheddocument';
import {ExistingFileList, FileList} from "@/components/Chat/FileList";
import { ModelSelect } from '../Chat/ModelSelect';
import { getDate, getDateName } from '@/utils/app/date';
import { FolderInterface } from '@/types/folder';
import { LoadingIcon } from "@/components/Loader/LoadingIcon";
import { getGroupAssistantConversations } from '@/services/groupAssistantService';
import { getGroupAssistantDashboards } from '@/services/groupAssistantService';
import { getGroupConversationData } from '@/services/groupAssistantService';
import toast from 'react-hot-toast';
import ActionButton from '../ReusableComponents/ActionButton';
import { LoadingDialog } from '../Loader/LoadingDialog';
import { InfoBox } from '../ReusableComponents/InfoBox';
import { includeGroupInfoBox } from '../Emails/EmailsList';
import Checkbox from '../ReusableComponents/CheckBox';
import { AMPLIFY_ASSISTANTS_GROUP_NAME } from '@/utils/app/amplifyAssistants';


interface Conversation {
    assistantName: string;
    user: string;
    employeeType: string;
    entryPoint: string;
    numberPrompts: number;
    modelUsed: string;
    timestamp: string;
    s3Location: string;
    userRating: number;
    systemRating: number;
    category: string;
    userFeedback: string;
    conversationId: string;
    assistantId: string;
}

const ConversationTable: FC<{ conversations: Conversation[] }> = ({ conversations }) => {
    const [sortColumn, setSortColumn] = useState<keyof Conversation>('timestamp');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);

    const openPopup = (conversation: Conversation) => {
        setSelectedConversation(conversation);
    };

    if (conversations.length === 0) {
        return <p>No conversations available</p>;
    }

    const columnOrder: (keyof Conversation)[] = [
        'assistantName',
        'user',
        'employeeType',
        'entryPoint',
        'numberPrompts',
        'modelUsed',
        'timestamp',
        'userRating',
        'systemRating',
        'category',
        'userFeedback',
        'conversationId',
        'assistantId'
    ];

    const handleSort = (column: keyof Conversation) => {
        if (sortColumn === column) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    };

    const sortedConversations = [...conversations].sort((a, b) => {
        if (sortColumn) {
            const aValue = a[sortColumn];
            const bValue = b[sortColumn];

            // Handle empty, null, or undefined values
            if (aValue == null && bValue == null) return 0;
            if (aValue == null) return sortDirection === 'asc' ? 1 : -1;
            if (bValue == null) return sortDirection === 'asc' ? -1 : 1;

            // Special handling for timestamp
            if (sortColumn === 'timestamp') {
                return sortDirection === 'asc'
                    ? new Date(aValue as string).getTime() - new Date(bValue as string).getTime()
                    : new Date(bValue as string).getTime() - new Date(aValue as string).getTime();
            }

            // Special handling for specific columns
            if (['modelUsed', 'category'].includes(sortColumn)) {
                return sortDirection === 'asc'
                    ? String(aValue).localeCompare(String(bValue))
                    : String(bValue).localeCompare(String(aValue));
            }

            if (['userRating', 'systemRating'].includes(sortColumn)) {
                return sortDirection === 'asc'
                    ? Number(aValue) - Number(bValue)
                    : Number(bValue) - Number(aValue);
            }

            // Default comparison for other columns
            if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        }
        return 0;
    });

    return (
        <>
            <div className="overflow-x-auto overflow-y-auto"  style={{ height: `${window.innerHeight * 0.65 }px` }}>
                <table className="w-full border-collapse text-black dark:text-white">
                    <thead className="sticky top-0 bg-white dark:bg-gray-800">
                        <tr>
                            {columnOrder.map((key) => (
                                <th
                                    key={key}
                                    className="border px-4 py-2 cursor-pointer"
                                    onClick={() => handleSort(key as keyof Conversation)}
                                >
                                    {key}
                                    {sortColumn === key && (
                                        <span className="ml-1">
                                            {sortDirection === 'asc' ? '▲' : '▼'}
                                        </span>
                                    )}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {sortedConversations.map((conv) => (
                            <tr key={conv.conversationId} onClick={() => openPopup(conv)} className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700">
                                {columnOrder.map((key) => (
                                    <td key={key} className="border px-4 py-2">
                                        {conv[key as keyof Conversation] !== undefined
                                            ? typeof conv[key as keyof Conversation] === 'boolean'
                                                ? conv[key as keyof Conversation].toString()
                                                : conv[key as keyof Conversation]
                                            : '-'}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {selectedConversation && (
                <ConversationPopup
                    conversation={selectedConversation}
                    onClose={() => setSelectedConversation(null)}
                />
            )}
        </>
    );
};

const ConversationPopup: FC<{ conversation: Conversation; onClose: () => void }> = ({ conversation, onClose }) => {
    const [content, setContent] = useState<string>('Loading...');
    const { state: { statsService } } = useContext(HomeContext);


    useEffect(() => {
        const fetchContent = async () => {
            try {
                statsService.getGroupConversationDataEvent(conversation.assistantId, conversation.conversationId);
                const result = await getGroupConversationData(conversation.assistantId, conversation.conversationId);
                if (result.success) {
                    const parsedContent = JSON.parse(result.data.body);
                    const formattedContent = parsedContent.content.replace(/\\n/g, '\n').replace(/#dataSource:/g, '');
                    setContent(formattedContent);

                } else {
                    setContent('Error loading conversation content.');
                }
            } catch (error) {
                setContent('Error loading conversation content.');
            }
        };

        fetchContent();
    }, [conversation.assistantId, conversation.conversationId]);

    // Define the fields you want to show and their order
    const fieldsToShow: (keyof Conversation)[] = [
        'timestamp',
        'assistantName',
        'user',
        'employeeType',
        'entryPoint',
        'numberPrompts',
        'modelUsed',
        'userRating',
        'systemRating',
        'category'
    ];

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg max-w-5xl w-full h-[80vh]">
                <h2 className="flex flex-row text-xl font-bold mb-4">Conversation Content
                <div className='ml-auto mr-[-6px]'>
                            <ActionButton
                                handleClick={onClose}
                                title={"Close"}
                            >
                                <IconX size={24}/>
                            </ActionButton>
                            </div>  

                </h2>
                <div className='overflow-y-auto h-[66vh]'>
                    <pre className="whitespace-pre-wrap mb-4">{content}</pre>

                    <h3 className="text-lg font-semibold mb-2">Conversation Metadata</h3>
                    <div className="grid grid-cols-1 gap-2">
                        {fieldsToShow.map((key) => (
                            <div key={key} className="mb-1">
                                <span className="font-medium">{key}: </span>
                                <span>{String(conversation[key])}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

interface DashboardMetrics {
    assistantId: string;
    assistantName: string;
    numUsers: number;
    totalConversations: number;
    averagePromptsPerConversation: number;
    entryPointDistribution: { [key: string]: number };
    categoryDistribution: { [key: string]: number };
    employeeTypeDistribution: { [key: string]: number };
    averageUserRating: number | null;
    averageSystemRating: number | null;
}

const Dashboard: FC<{ metrics: DashboardMetrics }> = ({ metrics }) => {
    return (
        <div className="p-4 text-black dark:text-white">
            <h2 className="text-2xl font-bold mb-4">Dashboard Metrics for {metrics.assistantName}</h2>

            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
                    <h3 className="text-lg font-semibold mb-2">General Stats</h3>
                    <p>Number of Unique Users: {metrics.numUsers}</p>
                    <p>Number of Conversations: {metrics.totalConversations}</p>
                    <p>Average Number of Prompts per Conversation: {metrics.averagePromptsPerConversation.toFixed(2)}</p>
                    <p>Average User Rating: {metrics.averageUserRating ? metrics.averageUserRating.toFixed(2) : 'N/A'}</p>
                    <p>Average System Rating: {metrics.averageSystemRating ? metrics.averageSystemRating.toFixed(2) : 'N/A'}</p>
                </div>

                <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
                    <h3 className="text-lg font-semibold mb-2">Entry Point Distribution</h3>
                    <ul>
                        {Object.entries(metrics.entryPointDistribution).map(([entryPoint, count]) => (
                            <li key={entryPoint}>{entryPoint}: {count}</li>
                        ))}
                    </ul>
                </div>

                <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
                    <h3 className="text-lg font-semibold mb-2">Category Distribution</h3>
                    <ul>
                        {Object.entries(metrics.categoryDistribution).map(([category, count]) => (
                            <li key={category}>{category}: {count}</li>
                        ))}
                    </ul>
                </div>

                <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
                    <h3 className="text-lg font-semibold mb-2">Employee Type Distribution</h3>
                    <ul>
                        {Object.entries(metrics.employeeTypeDistribution).map(([employeeType, count]) => (
                            <li key={employeeType}>{employeeType}: {count}</li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
};

interface User {
    name: string;
    // dateAdded: string;
    accessLevel: GroupAccessType;
}

interface ManagementProps {
    selectedGroup: Group;
    setSelectedGroup: (g:Group | undefined) => void;
    members: Members;
    allEmails: Array<string> | null;
    setLoadingActionMessage: (s:string) => void;
    adminGroups: Group[];
    setAdminGroups: (groups:Group[]) => void;
}


const GroupManagement: FC<ManagementProps> = ({selectedGroup, setSelectedGroup, members, allEmails, setLoadingActionMessage, adminGroups, setAdminGroups}) => {
    const { state: { featureFlags, groups, prompts, folders, statsService}, dispatch: homeDispatch } = useContext(HomeContext);
    const { data: session } = useSession();
    const userEmail = session?.user?.email;

    const [hasAdminAccess, setHasAdminAccess] = useState<boolean>((userEmail && selectedGroup.members[userEmail] === GroupAccessType.ADMIN) || false);
    const [groupTypes, setGroupTypes] = useState<string[]>(selectedGroup.groupTypes);

    const [searchTerm, setSearchTerm] = useState<string>('');
    const [isDeleting, setIsDeleting] = useState<boolean>(false);
    const [deleteUsersList, setDeleteUsersList] = useState<string[]>([]);


    const [input, setInput] = useState<string>('');
    const [isAddingUsers, setIsAddingUsers] = useState<boolean>(false);
    const [newGroupMembers, setNewGroupMembers] = useState< Members>({});


    const [isEditingAccess, setIsEditingAccess] = useState<boolean>(false);
    const [editAccessMap, setEditAccessMap] = useState<Members>({});

    const [allGroupEmails, setAllGroupEmails] = useState<Array<string> | null>(allEmails);

    useEffect( () => {
        setIsDeleting(false);
        setDeleteUsersList([]);
        setIsAddingUsers(false);
        setNewGroupMembers({});
        setIsEditingAccess(false);
        setEditAccessMap({});
        setGroupTypes(selectedGroup.groupTypes);
    },[selectedGroup]);

    const usersmap = Object.entries(members)
                           .map(([email, accessLevel]) => ({
                                    name: email,
                                    dateAdded: '2023-01-15',
                                    accessLevel: accessLevel,
                            }))
                            .sort((a, b) => {
                                if (a.name === userEmail) {
                                    return -1; // Move a to the top if it matches userEmail
                                }
                                if (b.name === userEmail) {
                                    return 1; // Move b to the top if it matches userEmail
                                }
                                // Otherwise, sort alphabetically by name
                                return a.name.localeCompare(b.name);
                            });;


    useEffect(() => {
        if (!searchTerm) {
            setUsers(usersmap);
        }
    
    }, [searchTerm]);

    const [users, setUsers] = useState<User[]>( usersmap);

    const onUpdateTypes = async () => {
        if (!hasAdminAccess) {
            alert("You are not authorized to update this group's types.");
            return 
        }
        setLoadingActionMessage('Updating Group Types');
        const updateData = {
                        "group_id": selectedGroup.id,
                        "types": groupTypes
                    };
        statsService.updateGroupTypesEvent(updateData);
        const result = await updateGroupTypes(updateData);
        if (!result) {
            alert(`Unable to update group types at this time. Please try again later.`);
            setLoadingActionMessage('');
            return;
        } else {
            toast(`Successfully updated group types.`);
        }
        
        //update groups home dispatch 
        const updatedGroup = {...selectedGroup, groupTypes: groupTypes};
        setSelectedGroup(updatedGroup);
        const updatedAdminGroups = adminGroups.map((g: Group) => {
                if (selectedGroup?.id === g.id) return updatedGroup;
                    return g;
            });
        setAdminGroups(updatedAdminGroups);
        setLoadingActionMessage('');
    }


    function arraysEqual(a: string[], b: string[]) {
        return a.length === b.length && a.every(element => b.includes(element)) && b.every(element => a.includes(element));
    }

    const removeUserFromGroup = (groupId: string) => {
        const filteredAdminGroups = adminGroups.filter((g:Group) => g.id !== groupId);
        setAdminGroups(filteredAdminGroups);
        setSelectedGroup(filteredAdminGroups[0]);
        //update folders and prompts
        homeDispatch({ field: 'prompts', value: prompts.filter((p:Prompt) => p.groupId !== groupId) });
        homeDispatch({ field: 'folders', value: folders.filter((f:FolderInterface) => f.id !== groupId)});
        homeDispatch({ field: 'groups', value: groups.filter((g:Group) => g.id !== groupId)});
        
    }

    const handleDeleteGroup = async (groupId: string) => {
        if (!hasAdminAccess) {
            alert("You are not authorized to delete this group.");
            return;
        }
        
        if (confirm("Are you sure you want to delete this group? You will not be able to undo this change.\n\nWould you like to continue?")){
            setLoadingActionMessage('Deleting Group');
            statsService.deleteAstAdminGroupEvent(groupId);
            const result = await deleteAstAdminGroup(groupId);
          
            if (result) {
                removeUserFromGroup(groupId);
                toast(`Successfully deleted group.`);
            } else {
                  alert(`Unable to delete this group at this time. Please try again later.`);
            }
            setLoadingActionMessage('');
        }
    }

    const handleAddEmails = () => {
        const entries = input.split(',').map(email => email.trim()).filter(email => email);
        let entriesWithGroupMembers:string[] = [];

        entries.forEach((e: any) => { 
            if ( e.startsWith('#')) {
                const group = groups.find((g:Group) => g.name === e.slice(1));
                if (group) entriesWithGroupMembers = [...entriesWithGroupMembers, 
                                                      ...Object.keys(group.members).filter((e: string) => e !== userEmail)]; 
            } else {
                entriesWithGroupMembers.push(e);
            }
        });

        const newEmails = entriesWithGroupMembers.filter(email => /^\S+@\S+\.\S+$/.test(email) && !Object.keys(newGroupMembers).includes(email) 
                                                                                               && !Object.keys(selectedGroup.members).includes(email)
                                                                                            );
        setNewGroupMembers({...newGroupMembers, ...Object.fromEntries(newEmails.map(email => [email, GroupAccessType.READ] ))} as Members);
        setInput('');
    };

    const addUsers = async () => {
        if (!hasAdminAccess) {
            alert("You are not authorized to add users to the group.");
            return;
        }
        setLoadingActionMessage('Adding Users');

        const updateData = {
            "group_id": selectedGroup.id,
            "update_type": GroupUpdateType.ADD,
            "members": newGroupMembers
        };
        statsService.updateGroupMembersEvent(updateData);
        const result = await updateGroupMembers(updateData);
        if (result) {
            setIsAddingUsers(false);
            const newUserEntries = Object.entries(newGroupMembers).map(([email, accessLevel]) => ({
                                        name: email,
                                        dateAdded: getDateName(),
                                        accessLevel: accessLevel,
                                    }))
            setUsers([...users, ...newUserEntries]); 
           //update groups 
           const updatedGroup =  { ...selectedGroup, members: {...selectedGroup.members, ...newGroupMembers}};
           setSelectedGroup(updatedGroup);
            const updatedAdminGroups = adminGroups.map((g: Group) => {
                if (selectedGroup?.id === g.id) return updatedGroup;
                    return g;
                });
            setAdminGroups(updatedAdminGroups);
            setNewGroupMembers({});
            setInput('');
        }
        if (result) {
            toast(`Successfully added users to the group.`);
        } else {
           alert(`Unable to add users to the group at this time. Please try again later.`); 
        }
        
        setLoadingActionMessage('');
    }

    const deleteUsers = async () => {
        if (!hasAdminAccess) {
            alert("You are not authorized to delete users from the group.");
            return;
        }
        const removingSelfFromGroup = userEmail && deleteUsersList.includes(userEmail);
        if (removingSelfFromGroup) {
            if (!confirm("Are you sure you want to remove yourself from the group? You will no longer have access to the admin interface or group assistants. You will not be able to undo this change.\n\nWould you like to continue?")) return;
            removeUserFromGroup(selectedGroup.id);
        }
        setLoadingActionMessage('Deleting Users');
        const updateData = {
            "group_id": selectedGroup.id,
            "update_type": GroupUpdateType.REMOVE,
            "members": deleteUsersList
        }
        statsService.updateGroupMembersEvent(updateData);
        const result = await updateGroupMembers(updateData);

        if (result) {
            setIsDeleting(false);
            setUsers(users.filter((user: User) => !deleteUsersList.includes( user.name ))); 
            setAllGroupEmails([...(allEmails??[]), ...deleteUsersList]);
            const updatedMembers = { ...selectedGroup.members };
            deleteUsersList.forEach(user => {
                delete updatedMembers[user]; // Remove the user from members
            });
            const updatedGroup =  { ...selectedGroup, members: updatedMembers }
           //update groups 
            const updatedAdminGroups = adminGroups.reduce((acc: Group[], g: Group) => {
                    if (removingSelfFromGroup && g.id === selectedGroup?.id) return acc;
                    if (selectedGroup?.id === g.id) {
                        acc.push(updatedGroup);
                    } else {
                        acc.push(g);
                    }
                    return acc;
            }, []);
            setAdminGroups(updatedAdminGroups);
            if (removingSelfFromGroup) setSelectedGroup(updatedAdminGroups[0]);
            setDeleteUsersList([]);
        }
        setLoadingActionMessage('');

        if (result) {
            toast(`Successfully removed users from group.`);
        } else {
             alert(`Unable to remove users from the group at this time. Please try again later.`)

        }
       
    };

    const isSoleAdmin = (userEmail: string, privileges: Members) => {
        // Count the number of 'admin' users
        const adminCount = Object.values(privileges).filter(priv => priv === 'admin').length;
        // Return true if the count is exactly 1
        return adminCount === 0;
      }

    const editUsersAccess = async () => {
        if (!hasAdminAccess) {
            alert("You are not authorized to update user access to the group.");
            return;
        }
        let removingAdminInterfaceAccess = false;
        let removingAdminAceesToWrite = false;
        if (userEmail) {
            removingAdminInterfaceAccess = editAccessMap[userEmail] === GroupAccessType.READ;
            removingAdminAceesToWrite = editAccessMap[userEmail] === GroupAccessType.WRITE;

            const mergedMemberPerms = {} as Members;
            Object.keys(selectedGroup.members)
                  .forEach((name: string) => {
                    if  (editAccessMap.hasOwnProperty(name)) {
                        mergedMemberPerms[name] = editAccessMap[name];
                    } else {
                        mergedMemberPerms[name] =  selectedGroup.members[name];
                    }
                    
                });
            if ((removingAdminInterfaceAccess || removingAdminAceesToWrite) && isSoleAdmin(userEmail, mergedMemberPerms)) {
                alert("You are currently the only admin in the group, your admin access will be unchanged at this time. Please confirm updated user access changes again.");
                const { [userEmail]: _, ...newEditAccessMap } = editAccessMap;
                setEditAccessMap(newEditAccessMap);
                setUsers(prevUsers => 
                    prevUsers.map((u, i) => 
                        u.name === userEmail ? { ...u, accessLevel: GroupAccessType.ADMIN } : u
                    )
                );
                return;
            } else if (removingAdminInterfaceAccess) {
                if (!confirm("Please note, by setting your group access permissions to 'read', you will lose access to the group's assistant admin interface.\n\n Would you like to continue?")) return;
                // update prompts access 
                const updatedPrompts = prompts.map((p:Prompt) => {
                                            if (p.groupId == selectedGroup.id) {
                                                const newData = { ...p.data, noEdit: true };
                                                return { ...p, data: newData };
                                            } 
                                            return p;
                                        })
                homeDispatch({ field: 'prompts', value: updatedPrompts });  
                
            } else if (removingAdminAceesToWrite && selectedGroup.members[userEmail] === GroupAccessType.ADMIN) {
                // if you are changing from admin to write but are not the only admin in the group.
                if (!confirm("Please note, by setting your group access permissions to 'write', you will no longer be able to make changes to the group itself; however, you will retain the ability to modify the group's assistants.\n\n Would you like to continue?")) return;
                setHasAdminAccess(false);
            }
        }
        setLoadingActionMessage('Updating Group Member Permissions');

        const permsData = {
                    "group_id": selectedGroup.id,
                    "affected_members": editAccessMap
                };

        statsService.updateGroupMembersPermissionsEvent(permsData);
        const result = await updateGroupMembersPermissions(permsData);

        if (result) {
           //update groups with edit access map, set users is already taken care of
            const updatedGroup = { ...selectedGroup, members: {...selectedGroup.members, ...editAccessMap} };
            const updatedAdminGroups = adminGroups.reduce((acc: Group[], g: Group) => {
                                if (removingAdminInterfaceAccess && g.id === selectedGroup?.id) return acc;
                                if (selectedGroup?.id === g.id) {
                                    acc.push(updatedGroup);
                                } else {
                                    acc.push(g);
                                }
                                return acc;
            }, []);
            
            setAdminGroups(updatedAdminGroups);
            if (removingAdminInterfaceAccess) setSelectedGroup(updatedAdminGroups[0]);
            
            setEditAccessMap({});
            setIsEditingAccess(false);    
        }
        if (result) {
            toast( `Successfully updated users group access.`);
        } else {
            alert(`Unable to update users group access at this time. Please try again later.`); 
        }
       
        setLoadingActionMessage('');
    };

    return (
        <div key={selectedGroup.id} className="mt-[-50px] px-4 text-black dark:text-white"
        style={{ height: `${window.innerHeight * 0.78}px` }}
        >
            <h2 className="text-2xl font-bold">Group Management</h2>
        <div className='mt-4 overflow overflow-y-auto flex flex-col gap-4'>
                <GroupTypesAst 
                    groupTypes={groupTypes}
                    setGroupTypes={setGroupTypes}
                    canAddTags={hasAdminAccess}
                    showControlButtons = {!arraysEqual(groupTypes, selectedGroup.groupTypes)}
                    onConfirm={() => onUpdateTypes()}
                    onCancel={() => setGroupTypes(selectedGroup.groupTypes)}
                />
               
            { isAddingUsers && 
                <div className='mx-10'>
                     <AddMemberAccess
                        groupMembers={newGroupMembers}
                        setGroupMembers={setNewGroupMembers}
                        input={input}
                        setInput={setInput}
                        allEmails={allGroupEmails}
                        handleAddEmails={handleAddEmails}
                        width='840px'

                    />
                </div>
                }
            <label className="text-2lg font-bold">Group Members</label>
            
            <div className="flex justify-between gap-6 items-center">
                <Search
                placeholder={'Search...'}
                searchTerm={searchTerm}
                onSearch={(searchTerm: string) => {
                    setSearchTerm(searchTerm);
                    setUsers(users.filter((u:User) => u.name.startsWith(searchTerm)))}
                }
                disabled={isDeleting}
                />
                <div className='ml-auto flex flex-row gap-1'>
                    { hasAdminAccess && <button
                        className="px-4 py-2 bg-blue-800 text-white hover:bg-blue-600 transition-colors"
                        onClick={() => setIsAddingUsers(true)}
                    >
                        Add Users
                    </button> }
                    { isAddingUsers && <div className=" flex flex-row gap-0.5 bg-neutral-200 dark:bg-[#343541]/90 w-[36px]">
                        <button 
                                className="text-green-500 hover:text-green-700 cursor-pointer" 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (Object.keys(newGroupMembers).length > 0){
                                        addUsers();
                                    } else {
                                        setIsAddingUsers(false);
                                        setInput('');
                                    }
                                }}
                                title={"Add Users"} 
                            >
                                <IconCheck size={16} />
                            </button>
                        
                        <button
                            className="text-red-500 hover:text-red-700 cursor-pointer"
                            onClick={(e) => {
                            e.stopPropagation();
                            setIsAddingUsers(false);
                            setNewGroupMembers({});
                            setInput('');

                            }}
                            title={"Cancel"}
                        >
                            <IconX size={16} />
                        </button>
                    </div>}
                </div>
                { hasAdminAccess && <>
                    <UsersAction
                     condition={isDeleting}
                     label='Deleting Users'
                     title='Delete Users'
                     clickAction={() => {
                        setIsDeleting(true)
                        setSearchTerm('')
                     }}
                     onConfirm={() => {
                        if (deleteUsersList.length > 0) {
                            deleteUsers();
                        } else {
                            setIsDeleting(false);
                        }
                     }}
                     onCancel={() => {
                        setIsDeleting(false);
                        setDeleteUsersList([]);
                     }}
                    />

                <UsersAction
                    condition={isEditingAccess}
                     label='Updating Users Access'
                     title='Update Users access'
                     clickAction={() => {
                        setIsEditingAccess(true)
                        setSearchTerm('')
                     }}
                     onConfirm={() => {
                        if (Object.keys(editAccessMap).length > 0) {
                            editUsersAccess();
                        } else {
                            setIsEditingAccess(false);
                        }
                     }}
                     onCancel={() => {
                        setUsers(usersmap);
                        setIsEditingAccess(false);
                        setEditAccessMap({});
                     }}

                 />
                </>}

            </div>
            { isEditingAccess && accessInfoBox}
            
            { users.length === 0 ? <div className='ml-4'> No members to display</div> :
                <table className="w-full border-collapse">
                    <thead>
                        <tr>
                        {isDeleting && <th className="py-2">{
                                <input
                                    type="checkbox"
                                    title='Select All'
                                    checked={deleteUsersList.length === users.length}
                                    onChange={(e) => {
                                        if (e.target.checked) {
                                            // If checked, add all user names to the list
                                            setDeleteUsersList(users.map((user: User) => user.name));
                                        } else {
                                            setDeleteUsersList([]);
                                        }

                                    }}
                                />
                                }</th>}
                            <th className="border px-4 py-2">Name</th>
                            {/* <th className="border px-4 py-2">Date Added</th> */}
                            <th className="border px-4 py-2">Access Level</th>
                            
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((user, index) => (
                            <tr key={index}>
                                {isDeleting &&   
                                <td className="py-2">
                                        <input
                                            type="checkbox"
                                            checked={deleteUsersList.includes(user.name)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    // Add user name to the list if checkbox is checked
                                                    setDeleteUsersList(prevList => [...prevList, user.name]);
                                                } else {
                                                    // Remove user name from the list if checkbox is unchecked
                                                    setDeleteUsersList(prevList => prevList.filter(name => name !== user.name));
                                                } 
                                            }}
                                        />
                                </td> }
                                <td className="border px-4 py-2">{user.name} 
                                    <label className='ml-2 opacity-50'>{`${userEmail === user.name? ' (You)':''}`}</label>
                                </td>
                                {/* <td className="border px-4 py-2">{user.dateAdded}</td> */}
                                <td className={`border ${isEditingAccess? '' :'px-4 py-2'}`}>{
                                    isEditingAccess ? <AccessSelect
                                                    access={user.accessLevel}
                                                    setAccess={(newAccessLevel: GroupAccessType) => {
                                                        setUsers(prevUsers => 
                                                            prevUsers.map((u, i) => 
                                                                i === index ? { ...u, accessLevel: newAccessLevel } : u
                                                            )
                                                        );
                                                        setEditAccessMap({...editAccessMap, [user.name]: newAccessLevel})
                                                    }} /> 
                                                    : user.accessLevel
                                }</td>
                                
                            </tr>
                        ))}
                    </tbody>
                </table>
            }
                { hasAdminAccess &&
                    <button
                        type="button"
                        className={`flex flex-row mt-auto gap-2 ml-auto mt-4 p-2 text-sm bg-neutral-500 text-white rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500`}
                        onClick={() => {handleDeleteGroup(selectedGroup.id)}}
                    >
                        <IconTrashX size={18} />
                        Delete Group
                    </button>
                }
            </div>
        </div>
    );
};

const subTabs = ['dashboard', 'conversations', 'edit_assistant', 'group'] as const;
export type SubTabType = typeof subTabs[number];

interface Props {
    open: boolean;
    openToGroup?: Group
    openToAssistant?: Prompt;
}

export const AssistantAdminUI: FC<Props> = ({ open, openToGroup, openToAssistant }) => {
    const { state: { featureFlags, statsService, groups, prompts, folders, syncingPrompts, amplifyUsers}, dispatch: homeDispatch } = useContext(HomeContext);
    const { data: session } = useSession();
    const user = session?.user?.email ?? "";

    const onClose = () => {
        window.dispatchEvent(new CustomEvent('openAstAdminInterfaceTrigger', { detail: { isOpen: false }} ));
    }    

    const filteredForAdminAccess = (allGroups: Group[]) => {
        return allGroups.filter((g: Group) => [GroupAccessType.ADMIN, GroupAccessType.WRITE ].includes(g.members[user]));
    }

    const [innderWindow, setInnerWindow] = useState({height: window.innerHeight, width: window.innerWidth});

    const modalRef = useRef<HTMLDivElement>(null);

    const [loadingMessage, setLoadingMessage] = useState<string>('Loading Assistant Admin Interface...');
    const [loadingActionMessage, setLoadingActionMessage] = useState<string>('');


    const [adminGroups, setAdminGroups] = useState<Group[]>(groups.length > 0 ?  filteredForAdminAccess(groups) : []);

    const [selectedGroup, setSelectedGroup] = useState<Group | undefined>(openToGroup || adminGroups[0]);
    const [selectedAssistant, setSelectedAssistant] = useState<Prompt | undefined>(openToAssistant || selectedGroup?.assistants[0]);

    const [activeAstTab, setActiveAstTab] = useState<string | undefined>(selectedAssistant?.data?.assistant?.definition.assistantId);
    const DEFAULT_SUB_TAB = 'dashboard' as SubTabType;
    const [activeSubTab, setActiveSubTab] = useState<SubTabType>(openToAssistant ? "edit_assistant" : DEFAULT_SUB_TAB);

    const [additionalGroupData, setAdditionalGroupData] = useState<any>({});

    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics | null>(null);

    const [showCreateNewGroup, setShowCreateNewGroup] = useState<boolean>();
    const [showCreateGroupAssistant, setShowCreateGroupAssistant] = useState<string | null>(null);

    const [allEmails, setAllEmails] = useState<Array<string> | null>(null);

    useEffect(() => {
        const updateInnerWindow = () => {
            setInnerWindow({height: window.innerHeight, width: window.innerWidth});
        }
        // Listen to window resize to update the size
        window.addEventListener('resize', updateInnerWindow);
        return () => {
          window.removeEventListener('resize', updateInnerWindow);
        };
      }, []);

    useEffect(() => {
        const fetchEmails = async () => {
            const emailSuggestions = amplifyUsers;
            // add groups  #groupName
            const groupForMembers = groups.map((group:Group) => `#${group.name}`);
            setAllEmails(emailSuggestions ? [...emailSuggestions,
                                             ...groupForMembers].filter((e: string) => e !== user) : []);
        };
        if (!allEmails) fetchEmails();
    }, [open]);


    useEffect(()=>{
        setActiveAstTab(selectedAssistant?.data?.assistant?.definition.assistantId);
    }, [selectedAssistant])

    useEffect(() => {
        const nonAdminGroups = groups.filter((g: Group) => g.members[user] === GroupAccessType.READ);
        homeDispatch({ field: 'groups', value: [...adminGroups, ...nonAdminGroups]});
    }, [adminGroups]);

    const allAssistants = () => {
        return  adminGroups.reduce((accumulator:Prompt[], group:Group) => {
                return accumulator.concat(group.assistants);
            }, []);
    }

    // if selectedGroup changes then set to conversation tab
    useEffect(() => {
        if ((selectedAssistant && (selectedAssistant.groupId !== selectedGroup?.id 
                               || !(selectedGroup?.assistants.find((ast:Prompt) => ast?.data?.assistant?.definition.assistantId === selectedAssistant.data?.assistant?.definition.assistantId)))) 
             || (!selectedAssistant && (selectedGroup?.assistants && selectedGroup?.assistants.length > 0))) setSelectedAssistant(selectedGroup?.assistants[0]);
        if (activeSubTab === 'group') setActiveSubTab(DEFAULT_SUB_TAB)
    }, [selectedGroup]);


    useEffect(() => {
        if (!syncingPrompts) {
            // needs a second for groups to catch up 
            setTimeout(() => {
            setAdminGroups((groups && groups.length > 0 ?  filteredForAdminAccess(groups) : []));
            setLoadingMessage('');
            }, 1000);
        }
    }, [syncingPrompts]);


    useEffect(() => {
        const fetchConversations = async () => {
            if (open && selectedAssistant) {
                setLoadingActionMessage('Fetching conversations...');
                const assistantId = selectedAssistant.data?.assistant?.definition.assistantId;
                // console.log('Assistant ID:', assistantId);
                if (assistantId) {
                    statsService.getGroupAssistantConversationsEvent(assistantId);
                    const result = await getGroupAssistantConversations(assistantId);
                    // console.log('Full result from service:', result);
                    if (result.success) {
                        let conversationsData;
                        if (typeof result.data.body === 'string') {
                            conversationsData = JSON.parse(result.data.body);
                        } else {
                            conversationsData = result.data.body;
                        }
                        // console.log('Parsed conversations data:', conversationsData);
                        setConversations(Array.isArray(conversationsData) ? conversationsData : []);
                    } else {
                        console.error('Failed to fetch conversations:', result.message);
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
            if (open && selectedAssistant) {
                setLoadingActionMessage('Fetching dashboard data...');
                const assistantId = selectedAssistant.data?.assistant?.definition.assistantId;
                if (assistantId) {
                    statsService.getGroupAssistantDashboardsEvent(assistantId);
                    const result = await getGroupAssistantDashboards(assistantId);
                    if (result && result.success) {
                        setDashboardMetrics(result.data.dashboardData);
                    } else {
                        console.error('Failed to fetch dashboard data:', result?.message || 'Unknown error');
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
        console.log(group);
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
        if (adminGroups.find((g:Group) => g.name == group.group_name)) {
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
                    id: newGroup.id ,
                    date: getDate(),
                    name: newGroup.name,
                    type: 'prompt',
                    isGroupFolder: true
                } as FolderInterface
                homeDispatch({ field: 'folders', value: [...folders, newGroupFolder]});
                
            }
            setLoadingMessage('');
        }
    }

    const handleCreateAssistantPrompt = (group: Group) => {
        
        setAdditionalGroupData({});
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
                            provider: 'Amplify',
                            groupId: group.id
                            }
        newPrompt.id = `${group.id}_${group.assistants.length}`;
        newPrompt.groupId= group.id;
        if (!newPrompt.data) newPrompt.data = {};  
        if (!newPrompt.data.assistant) newPrompt.data.assistant = {};

        newPrompt.data.assistant.definition = assistantDef;
        return newPrompt
    }


    const handleCreateAssistant = async (astDef: AssistantDefinition, updateType: GroupUpdateType) => {
        // if (updateType === GroupUpdateType.ADD) setCurNewAstPrompt(null); 

        const updateAstData = { "group_id": selectedGroup?.id, "update_type": updateType, "assistants": [astDef] };
        statsService.updateGroupAssistantsEvent(updateAstData);
        const result = await updateGroupAssistants(updateAstData);
        return (result.success) ? result.assistantData[0]  
                                : {
                                    id: null,
                                    assistantId: null,
                                    provider: 'amplify'
                                  };
    }

    const handleDeleteAssistant = async (astpId: string) => {
        if (confirm("Are you sure you want to delete this assistant? You will not be able to undo this change.\n\nWould you like to continue?")){
            setLoadingActionMessage('Deleting Assistant');

            const updateAstData = {
                        "group_id": selectedGroup?.id,
                        "update_type": GroupUpdateType.REMOVE,
                        "assistants": [astpId]
                    };
            statsService.updateGroupAssistantsEvent(updateAstData);
            const result = await updateGroupAssistants(updateAstData);
            if (result.success && selectedGroup) {
                toast( "Successfully deleted assistant.");
                const updatedGroupAssistants = selectedGroup.assistants.filter((ast:Prompt) =>  ast?.data?.assistant?.definition.assistantId !== astpId);
                const updatedGroup = {...selectedGroup, assistants: updatedGroupAssistants?? []};
                
                const updatedGroups = adminGroups.map((g:Group) => {
                    if (selectedGroup?.id === g.id) return updatedGroup;
                    return g;
                    })
                setSelectedGroup(updatedGroup);
                setAdminGroups(updatedGroups);
                // update prompts 
                homeDispatch({ field: 'prompts', value: prompts.filter((ast:Prompt) =>  ast?.data?.assistant?.definition.assistantId !== astpId)});
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
                {subTabs.filter((t: SubTabType) =>  t !== 'conversations' || selectedGroup?.supportConvAnalysis)
                    .map((label: SubTabType) => 
                     label === 'group' ? (
                        <>
                        {selectedAssistant && selectedAssistant?.data?.assistant?.definition && 
                            <> 
                            <button
                                type="button"
                                className={`flex flex-row gap-2 p-2 bg-neutral-200 dark:bg-gray-600  text-black dark:text-white hover:text-white dark:hover:bg-red-700 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500`}
                                onClick={() => handleDeleteAssistant(selectedAssistant?.data?.assistant.definition.assistantId)}>
                            
                                Delete Assistant
                            </button>
                            <label className='ml-auto mt-2 mr-20 text-sm flex flex-row gap-3 text-black dark:text-neutral-100'
                                // title={"Use the assistant id in "}
                                > 
                                    <div className={`mt-1.5 ${selectedAssistant?.data?.isPublished ? "bg-green-400 dark:bg-green-300": "bg-gray-400 dark:bg-gray-500"}`} 
                                                                    style={{width: '8px', height: '8px', borderRadius: '50%'}}></div>
                                        Assistant Id: {selectedAssistant.data.assistant.definition.assistantId}
                            </label>
                            </>
                        }
                            <button className={`${activeSubTab === label ? 'bg-blue-500 text-white' : 'bg-gray-200 text-black dark:bg-gray-600 dark:text-white'} h-[36px] rounded-md ml-auto mr-[-16px] whitespace-nowrap`} 
                            key={label}
                            onClick={() => {
                                setActiveSubTab(label);
                                setSelectedAssistant(undefined);
                                
                                setAdditionalGroupData({});
                                }}
                            title="Manage users and assistant group types"
                            >
                                <div className={`flex flex-row gap-1 text-sm text-white px-2 bg-blue-500 hover:bg-blue-600 transition-colors py-2 rounded`}> 
                                    <IconSettings className='mt-0.5' size={16}/>
                                    Group Management
                                </div>
                                
                            </button>  
                        </> 
                    ) :
                    (selectedAssistant ? ( 
                        <button key={label} className={`${activeSubTab === label ? 'bg-blue-500 text-white' : 'bg-gray-200 text-black dark:bg-gray-600 dark:text-white'} 
                                                        px-4 py-2 ${!selectedAssistant?'hidden':'visible'}`} 
                        onClick={() => setActiveSubTab( label )}>
                            {formatLabel(label)}
                        </button>    
                    ): <></> )
                ) }
            </div>
        </div>

    );

    const renderContent = () => {
        switch (activeSubTab) {
            case 'conversations':
                return ( selectedAssistant ? <ConversationTable conversations={conversations} /> : <></>);
            case 'dashboard':
                if (!selectedGroup?.supportConvAnalysis) return <div className='w-full text-center text-lg'>
                {"Access to dashboard metrics and assistant conversation history is not currently available for this group."} 
                <br></br>
                To request access to these features, please reach out to Amplify for approval.
                </div>
                  
                return (
                    selectedAssistant && dashboardMetrics ?
                        <Dashboard metrics={dashboardMetrics} /> :
                        <div className="text-black dark:text-white">
                            No dashboard data available for {selectedAssistant?.name}
                            (Assistant ID: {selectedAssistant?.data?.assistant?.definition.assistantId})
                        </div>
            );
                
               
            case 'edit_assistant':
                return ( selectedAssistant ? <div key="admin_edit"> 
                    <AssistantModal
                         assistant={selectedAssistant}
                         onSave={ () => {} }
                         onCancel={ () => setActiveSubTab(DEFAULT_SUB_TAB)}  
                         onUpdateAssistant={ (astprompt: Prompt) => {
                            
                            setAdditionalGroupData({});
                            if (selectedGroup)  {
                                astprompt.groupId = selectedGroup?.id;
                                astprompt.folderId = selectedGroup?.id;
                                const updatedAssistants = selectedGroup?.assistants.map((ast: Prompt) => {
                                                        if (ast.data?.assistant?.definition.assistantId === astprompt.data?.assistant?.definition.assistantId) {
                                                            astprompt.data = {...astprompt?.data, noEdit: false}; 
                                                            return astprompt;
                                                        }
                                                        return ast;
                                                    })
                                setSelectedAssistant(astprompt);
                                const updatedGroup =  {...selectedGroup, assistants: updatedAssistants ?? []}
                                const updatedGroups = adminGroups.map((g:Group) => {
                                                            if (selectedAssistant?.groupId === g.id) return updatedGroup;
                                                            return g;
                                                        })
                                setSelectedGroup(updatedGroup); 
                                setAdminGroups(updatedGroups);
                                console.log(astprompt);
                            
                                statsService.createPromptEvent(astprompt);
                                // update prompt
                                const updatedPrompts: Prompt[] = prompts.map((curPrompt: Prompt) => {
                                                            if (curPrompt?.data?.assistant?.definition.assistantId === 
                                                                astprompt.data?.assistant?.definition.assistantId) return astprompt;
                                                            return curPrompt;
                                                            });
                                homeDispatch({ field: 'prompts', value: updatedPrompts });
                                setActiveSubTab('edit_assistant'); 
                            } else {
                                alert("Something went wrong, please close and reopen the admin interface before trying again.")
                            }

                        }}
                         loadingMessage={`Updating Assistant '${selectedAssistant.name}'...`}
                         disableEdit={!!showCreateGroupAssistant}
                         loc={"admin_update"} 
                        //  title={selectedGroup?.name + " Assistant"}
                         width={`${innderWindow.width - 140}px`}
                         height={`${(innderWindow.height * 0.76) - 165}px`}
                         translateY={'-5%'}
                         embed={true}
                         blackoutBackground={false}
                         additionalGroupData={additionalGroupData} 
                         onCreateAssistant={(astDef:AssistantDefinition) => { return handleCreateAssistant(astDef, GroupUpdateType.UPDATE)}}
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
                        members={selectedGroup?.members?? {}}
                        allEmails={allEmails?.filter((e:string) => e !== `#${selectedGroup.name}` && !Object.keys(selectedGroup.members).includes(e)) || []}
                        setLoadingActionMessage={setLoadingActionMessage}
                        adminGroups={adminGroups}
                        setAdminGroups={setAdminGroups}
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
                    message={adminGroups.length === 0 ? "You currently do not have admin access to any groups." : "" }
                />  
        ):
        // User has groups 
        (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-20">
            <div className="fixed inset-0 z-10 overflow-hidden">
                <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                    <div className="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true" />

                    {loadingMessage ? (
                        <LoadingDialog open={true} message={loadingMessage}/>
                    ) : (
                        <div
                            ref={modalRef} key={selectedGroup?.id}
                            className="inline-block transform rounded-lg border border-gray-300 dark:border-neutral-600 bg-neutral-100 px-4 pb-4 text-left align-bottom shadow-xl transition-all dark:bg-[#22232b] sm:my-8 sm:min-h-[636px] sm:w-full sm:p-4 sm:align-middle"
                            style={{ width: `${innderWindow.width - 100}px`, height: `${innderWindow.height * 0.95}px` }}
                            role="dialog"
                        >
                            {loadingActionMessage && (
                                <div className="absolute inset-0 flex items-center justify-center z-60" key={"loading"}
                                    style={{ transform: `translateY(-40%)`}}>
                                    <div className="p-3 flex flex-row items-center  border border-gray-500 bg-[#202123]">
                                        <LoadingIcon style={{ width: "24px", height: "24px" }}/>
                                        <span className="text-lg font-bold ml-2 text-white">{loadingActionMessage + '...'}</span>
                                    </div>
                                </div>
                            )
                            }
                            {selectedGroup && showCreateGroupAssistant && ( 
                                        <div key={'admin_add'}>
                                        <AssistantModal
                                            assistant={handleCreateAssistantPrompt(selectedGroup)}
                                            onSave={()=> {
                                            }}
                                            onCancel={()=>{
                                                setShowCreateGroupAssistant(null);
                                            }}
                                            onUpdateAssistant={ (astprompt: Prompt) => {
                                                
                                                setAdditionalGroupData({});
                                                astprompt.groupId = selectedGroup.id;
                                                astprompt.folderId = selectedGroup.id;
                                                astprompt.data = {...astprompt?.data, noEdit: false}; 
                                                setSelectedAssistant(astprompt);
                                                const updatedGroup =  {...selectedGroup, assistants: [...selectedGroup.assistants, astprompt]};
                                                const updatedGroups = adminGroups.map((g:Group) => {
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
                                                                    
                                            loadingMessage = {`Creating Assistant for Group '${selectedGroup.name}'`}
                                            loc={"admin_add"}
                                            title={`Creating New Assistant for ${selectedGroup.name}`}
                                            height={`${innderWindow.height * 0.7}px`}
                                            additionalTemplates={allAssistants()}
                                            autofillOn={true}
                                            translateY='-4%'
                                            additionalGroupData={additionalGroupData}
                                            onCreateAssistant={(astDef:AssistantDefinition) => { return handleCreateAssistant(astDef, GroupUpdateType.ADD)}}
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
                            <div className='flex flex-row gap-2' key={`${selectedGroup?.id}_GroupSelect`}> 
                                <GroupSelect
                                    groups={adminGroups}
                                    selectedGroup={selectedGroup}
                                    setSelectedGroup={setSelectedGroup}
                                    setShowCreateNewGroup={setShowCreateNewGroup}
                                />
                                <div className='w-[26px]'> 
                                    <div className='absolute top-5 right-2'> 
                                    <ActionButton
                                            handleClick={onClose}
                                            title="Close"
                                        >
                                            <IconX size={28} />
                                        </ActionButton> 
                                    </div>
                                </div>
                                

                            </div>
                            

                            { selectedGroup && 
                            <>
                                <div key={`${selectedGroup?.id}_Assistants`}>
                                    <div className="mb-4 flex flex-row items-center justify-between bg-transparent rounded-t border-b border-neutral-400  dark:border-white/20">
                                        {selectedGroup.assistants.length === 0 && <label className='text-center text-black dark:text-white text-lg'
                                                                                    style={{width: `${innderWindow.width * 0.75}px`}}>
                                                                                   You currently do not have any assistants in this group. </label>}
                                        
                                        <div className="overflow-y-auto">
                                            <div className="flex flex-row gap-1">
                                                {selectedGroup.assistants.length > 0 && selectedGroup.assistants.map((ast: Prompt) => (
                                                    <button
                                                        key={ast.name}
                                                        onClick={() => {
                                                            setSelectedAssistant(ast)
                                                            setActiveSubTab(DEFAULT_SUB_TAB);
                                                            setAdditionalGroupData({});
                                                        }}
                                                        title={selectedAssistant?.data?.isPublished ? 'Published':'Unpublished'}
                                                        className={`p-2 rounded-t flex flex-shrink-0 ${activeAstTab && activeAstTab === ast.data?.assistant?.definition.assistantId ? 'border-l border-t border-r border-neutral-400 text-black dark:border-gray-500 dark:text-white shadow-[2px_0_1px_rgba(0,0,0,0.1),-2px_0_1px_rgba(0,0,0,0.1)] dark:shadow-[1px_0_3px_rgba(0,0,0,0.3),-1px_0_3px_rgba(0,0,0,0.3)]' : 'text-gray-400 dark:text-gray-600'}`}
                                                    >
                                                        <h3 className="text-xl">{ast.name.charAt(0).toUpperCase() + ast.name.slice(1)}</h3>
                                                    </button>
                                                    
                                                ))
                                            }
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center">
                                            <button
                                                className="flex flex-row ml-auto px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                                                onClick={() => {
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
                            
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};


interface CreateProps {
    createGroup: (groupData:any) => void;
    onClose: () => void;
    allEmails: Array<string> | null;
    message: string;
}


export const CreateAdminDialog: FC<CreateProps> = ({ createGroup, onClose, allEmails, message}) => {
    const { state: { statsService, groups }, dispatch: homeDispatch } = useContext(HomeContext);
    const { data: session } = useSession();
    const user = session?.user?.email;

    const [input, setInput] = useState<string>('');
   
    const [groupName, setGroupName] = useState<string>('');
    const [groupMembers, setGroupMembers] = useState< Members>({});

    const [groupTypes, setGroupTypes] = useState<string[]>([]);


    const handleAddEmails = () => {
        const entries = input.split(',').map(email => email.trim()).filter(email => email);
        let entriesWithGroupMembers:string[] = [];

        entries.forEach((e: any) => { 
            if ( e.startsWith('#')) {
                const group = groups.find((g:Group) => g.name === e.slice(1));
                if (group) entriesWithGroupMembers = [...entriesWithGroupMembers, 
                                                      ...Object.keys(group.members).filter((e: string) => e !== user)]; 
            } else {
                entriesWithGroupMembers.push(e);
            }
        });

        const newEmails = entriesWithGroupMembers.filter(email => /^\S+@\S+\.\S+$/.test(email) && !Object.keys(groupMembers).includes(email));
        setGroupMembers({...groupMembers, ...Object.fromEntries(newEmails.map(email => [email, GroupAccessType.READ]))} as Members);
        setInput('');
    };


    return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-20">
        <div className="fixed inset-0 z-10 overflow-hidden">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="hidden sm:inline-block sm:h-screen sm:align-middle"
              aria-hidden="true"
            />
            
            <div className="dark:border-neutral-600 inline-block h-[600px] transform overflow-hidden rounded-lg border border-gray-300 bg-white px-4 pt-5 pb-4 text-left align-bottom shadow-xl transition-all dark:bg-[#22232b] sm:my-8 w-[750px] sm:p-6 sm:align-middle"
                            style={{ height: `${window.innerHeight * 0.92}px` }}
                            role="dialog" >
        
                
                <div className='max-h-[calc(100vh-10rem)] h-full flex flex-col overflow overflow-y-auto text-black dark:text-white'>  
                    <div className="text-lg font-bold text-black dark:text-neutral-200 flex items-center">
                            Assistant Admin Interface 
                    </div> 
                    {"You will be able to manage assistants and view key metrics related to user engagement and conversation."}
                            <div className="text-sm mb-4 text-black dark:text-neutral-200">{message}</div>

                            <div className='flex flex-col gap-2 font-bold '>
                                <>
                                    Group Name

                                    <textarea
                                        className= "mb-2 rounded-md border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                        style={{resize: 'none'}}
                                        placeholder={`Group Name`}
                                        value={groupName}
                                        onChange={(e) => setGroupName(e.target.value)}
                                        rows={1}
                                    />
                                </>

                                <GroupTypesAst 
                                    groupTypes={groupTypes}
                                    setGroupTypes={setGroupTypes}
                                />
                                <div className='mt-2'>
                                    <AddMemberAccess
                                        groupMembers={groupMembers}
                                        setGroupMembers={setGroupMembers}
                                        input={input}
                                        setInput={setInput}
                                        allEmails={allEmails}
                                        handleAddEmails={handleAddEmails}
                                    /> 
                                </div>
                            </div>
                        
                

                </div>
                    
                    <div className="mt-2 w-full flex flex-row items-center justify-end bg-white dark:bg-[#22232b]">
                                    
                                    <button
                                        type="button"
                                        className="mr-2 w-full px-4 py-2 border rounded-lg shadow border-neutral-500 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-300"
                                        onClick={onClose}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        className="w-full px-4 py-2 border rounded-lg shadow border-neutral-500 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-300"
                                        onClick={()=>{ 
                                                createGroup({ group_name: groupName,
                                                              members: {...groupMembers, [user as string]: GroupAccessType.ADMIN},
                                                              types: groupTypes
                                                            }
                                        )
                                        }}
                                    >
                                        Create Group
                                    </button>
                    </div>
           
           </div>
          </div>
        </div>
    </div> )
}




interface MemberAccessProps {
    groupMembers: Members;
    setGroupMembers: (m: Members) => void;
    input: string;
    setInput: (s: string) => void;
    allEmails: Array<string> | null;
    handleAddEmails: () => void;
    width? : string;


}

const accessInfoBox =  <InfoBox content={
        <span className="ml-2 text-xs text-gray-600 dark:text-gray-400"> 
            <label className='font-bold text-[0.8rem]'> Read Access </label>
            can view assistants in the prompt bar and engage in conversation. They do not have access to the admin interface.
            <br className='mb-2'></br>
            <label className='font-bold text-[0.8rem'> Write Access </label>
            have the ability to view and chat with assistants. They can also create and edit assistants and have access to the admin interface.
            <br className='mb-2'></br>
            <label className='font-bold text-[0.8rem'> Admin Access </label> have full administrative control. They can delete the group, manage members, and modify access levels. Admins are responsible for all aspects of group management and inherit all permissions from above.
            
        </span>}
/>

export const AddMemberAccess: FC<MemberAccessProps> = ({ groupMembers, setGroupMembers, input, setInput, allEmails, handleAddEmails, width='500px'}) => {
    const [hoveredUser, setHoveredUser] = useState<string | null>(null);


    const handleRemoveUser = (email: string) => {
        const updatedMembers = { ...groupMembers }; 
        delete updatedMembers[email]; 
        setGroupMembers(updatedMembers);
    }

    return <div className='flex flex-col gap-2 mb-6'>
                {accessInfoBox}
                Add Members 
                <label className='text-sm font-normal'>List group members and their permission levels.</label>
                <>{includeGroupInfoBox}</>
                <div className='flex flex-row gap-2'>
                    <div className="flex-shrink-0 ml-[-6px] mr-2">
                        <button
                            type="button"
                            title='Add Account'
                            className="ml-2 mt-1 px-3 py-1.5 text-white rounded bg-neutral-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-500"
                            onClick={handleAddEmails}
                        >
                            <IconPlus size={18} />
                        </button>
                    </div>
                    <div className='w-full relative'>
                        <EmailsAutoComplete
                            input = {input}
                            setInput =  {setInput}
                            allEmails = {allEmails}
                            alreadyAddedEmails = {Object.keys(groupMembers)}
                        /> 
                    </div>
                    
                </div>
        
                {/* <div className='overflow overflow-y-auto' style={{maxHeight:'200px'}}> */}
               
                {Object.keys(groupMembers).length > 0 &&
                    <div>
                     Set Member Access 
                     <table className="mt-2 w-full border-collapse">
                        <thead>
                            <tr>
                                <th className="border px-4 py-2">User</th>
                                <th className="border px-4 py-2">Access</th>
                            </tr>
                        </thead>
                        <tbody>

                            {Object.entries(groupMembers).map(([email, access]) => (
                                <tr key={email}>
                                    <td className="border px-4 py-2 " style={{width: width}}> 
                                        <div className='flex items-center  '
                                        onMouseEnter={() => {
                                            setHoveredUser(email)
                                        }}
                                        onMouseLeave={() => {
                                            setHoveredUser(null)
                                        }} 
                                        >
                                            {email}
                                            { hoveredUser === email && 
                                                <button
                                                    type="button"
                                                    className={`ml-auto p-0.5 text-sm bg-neutral-500 text-white rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500`}
                                                    onClick={() => handleRemoveUser(email)}
                                                >
                                                    <IconTrashX size={16} />
                                                </button>}   
                                        </div>


                                    </td>
                                    <td className={`border`}>{
                                            <AccessSelect
                                            access={access}
                                            setAccess={(newAccessLevel: GroupAccessType) => {
                                            setGroupMembers({...groupMembers, [email]:newAccessLevel})
                                            }} /> 
                                        }</td>
                                </tr>
                            ))}
                            
                        </tbody>
                    </table>
                     

                    </div>}
                {/* </div>  */}
            </div>
}


interface AccessProps {
    access: GroupAccessType;
    setAccess: (t: GroupAccessType) => void;
}

export const AccessSelect: FC<AccessProps> = ({ access, setAccess}) => {
    
    return ( 
        <select className={"w-full text-center border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"}
            value={access}
            title='Select Access Type'
            onChange={(event) => {
                setAccess(event.target.value as GroupAccessType);
            }}
        > 
            {[GroupAccessType.ADMIN, GroupAccessType.READ, GroupAccessType.WRITE].map((accessType:GroupAccessType) => (
                <option key={accessType} value={accessType}>
                    {accessType}
                </option>
            ))}
        </select>
    )
}

interface SelectProps {
    groups:  Group[];
    selectedGroup: Group | undefined;
    setSelectedGroup: (g:Group) => void;
    setShowCreateNewGroup: (e: boolean) => void;
}

export const GroupSelect: FC<SelectProps> = ({groups, selectedGroup, setSelectedGroup, setShowCreateNewGroup}) => {
    const { state: { featureFlags }, dispatch: homeDispatch } = useContext(HomeContext);

     return (
        <select className={"mb-2 w-full text-xl text-center rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100  shadow-[0_2px_4px_rgba(0,0,0,0.1)] dark:shadow-[0_2px_4px_rgba(0,0,0,0.3)]"} 
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
            { featureFlags.createAstAdminGroups &&
            <option value={GroupUpdateType.ADD}>
                    {"+ Create New Group"}
            </option>
            } 
        </select>
        
    );
}


interface ActionProps {
    condition: boolean;
    label:  string;
    title:  string;
    clickAction: () => void;
    onConfirm: () => void;
    onCancel: () => void;
}

export const UsersAction: FC<ActionProps> = ({condition, label, title, clickAction, onConfirm, onCancel}) => {

    return ( condition ? (
        <div className="text-xs flex flex-row gap-1">
        <label className={`px-4 py-2 text-white  bg-gray-700`}>  {label}</label>
        <div className="flex flex-row gap-0.5 bg-neutral-200 dark:bg-[#343541]/90 ">
            <button 
                    className="text-green-500 hover:text-green-700 cursor-pointer" 
                    onClick={(e) => {
                        e.stopPropagation();
                        onConfirm();
                    }}
                    
                    title={title} 
                >
                    <IconCheck size={16} />
            </button>
            
            <button
                className="text-red-500 hover:text-red-700 cursor-pointer"
                onClick={(e) => {
                e.stopPropagation();
                onCancel();

                }}
                title={"Cancel"}
            >
                <IconX size={16} />
            </button>
        </div>
    </div>
    )  : (     
            <button
                className={`px-4 py-2 bg-blue-800 text-white  hover:bg-blue-600 transition-colors`}
                onClick={clickAction}
            >
                {title}
            </button>
    )
)
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
export const AssistantModalConfigs: FC<AssistantModalProps> = ({ groupId, astId, astData = {}, groupTypes=[], additionalGroupData, setAdditionalGroupData, groupConvAnalysisSupport}) => {
    const [isPublished, setIsPublished] = useState<boolean>(astData.isPublished ?? false);
    const [enforceModel, setEnforceModel] = useState<boolean>(!!astData.model);

    const [astSupportConvAnalysis, setAstSupportConvAnalysis] = useState<boolean>(astData.supportConvAnalysis ?? false);
    const [analysisCategories, setAnalysisCategories] = useState<string[]>(astData.analysisCategories ?? []);

    const updateCategories = (categories: string[]) => {
        setAnalysisCategories(categories);
        setAdditionalGroupData({...additionalGroupData, analysisCategories: categories });
    }


    return <div className='flex flex-col' key={astId}> 
            <div className='mb-4 flex flex-row gap-3 text-[1.05rem]'>
                <Checkbox
                    id="publishAssistant"
                    label="Publish assistant to read-access members"
                    checked={isPublished}
                    onChange={(isChecked: boolean) => {
                        setAdditionalGroupData({...additionalGroupData, isPublished: isChecked });

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
                        if (!isChecked)  setAdditionalGroupData({...additionalGroupData, model: undefined});

                        setEnforceModel(isChecked);
                    }}
                />
            </div>
            <div className={`ml-6 flex flex-col ${enforceModel ? "" :'opacity-40'}`}>
                All conversations will be set to this model and unable to be changed by the user.
                <ModelSelect
                    isTitled={false}
                    modelId={astData.model}
                    isDisabled={!enforceModel}
                    disableMessage=''
                    handleModelChange={(model:string) => {
                        setAdditionalGroupData({...additionalGroupData, model: model});
                    }}
                />
            </div>

            { groupConvAnalysisSupport && <>
            <div className='mt-4 flex flex-row gap-3 text-[1rem]'>
                <Checkbox
                    id="supportAnalysis"
                    label="Support Conversation Analysis"
                    checked={astSupportConvAnalysis}
                    onChange={(isChecked: boolean) => {
                        setAdditionalGroupData({...additionalGroupData, supportConvAnalysis: isChecked});

                        setAstSupportConvAnalysis(isChecked);
                    }}
                />
            </div>
            <div className={`ml-6 flex flex-col ${astSupportConvAnalysis ? "" :'opacity-40'}`}>
                Allow access to view user conversations with the assistant and perform analysis.
                <br></br>
                {"Define custom categories to classify interactions and evaluate the assistant's performance for quality, relevance, and effectiveness."}

                <TagsList label={"Categories"}
                    addMessage={"List categories separated by commas:"}
                    tags={analysisCategories}
                    setTags={(categories) => updateCategories(categories)}
                    removeTag={(category) => updateCategories(analysisCategories.filter((t:string) => t !== category))}
                    isDisabled={!astSupportConvAnalysis}/>

            </div></>}
        <br className='my-1'></br>
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
    showControlButtons?:boolean;
    onConfirm?: () => void;
    onCancel?: () => void;
}

export const GroupTypesAst: FC<TypeProps> = ({groupTypes, setGroupTypes, canAddTags=true, showControlButtons=false, onConfirm, onCancel}) => {
    return <>
        <div className="text-md pb-1 font-bold text-black dark:text-neutral-200 flex items-center">
                Group Types
        </div>
        <InfoBox content={
                    <span className="ml-2 text-xs"> 
                    Creating group types enables the subdivision of users into subgroups when interacting with an assistant.
                    <br className='mb-2'></br>
                    When creating or editing an assistant, you can select which group types to apply. This allows you to incorporate specific custom instructions and data sources tailored to each group.
                    
                    Additionally, you can specify which group types should have chat disabled, and provide reasons for this restriction.
                    <br className='mb-2'></br>
                    Before engaging with an assistant that has group types defined, users must identify their subgroup by selecting which group they belong to. 
                    
                    This ensures that the interaction is customized with the appropriate instructions and data sources specific to their group type.

                    </span>
        }/>
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
                    removeTag={(tag) =>  setGroupTypes(groupTypes.filter((t:string) => t !== tag))}
                    isDisabled={!canAddTags}/>
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

export const GroupTypesAstData: FC<TypeAstProps> = ({groupId, astPromptId, assistantGroupData, additionalGroupData, setAdditionalGroupData, groupUserTypeQuestion, groupTypes}) => {
    const preexistingDSids: {[key:string]:string[]} = {};

    const initialDs = (dataSources: any) => {
        return (dataSources).map((ds:any) => {
        return {
            ...ds,
            key: (ds.key || ds.id)
        }
    });
    }

    const initialStates = (initDs: any[]) => {
        return initDs.map(ds => {
            return {[ds.id]: 100}
        }).reduce((acc, x) => {
            acc = {...acc, ...x};
            return acc;
        }, {});
    }   

    const initializeGroupTypeData = () => {
        const updatedGroupTypeData = Object.keys(assistantGroupData).reduce((acc:any, key) => {
            if (groupTypes.includes(key)) {
                acc[key] = assistantGroupData[key];
            }
            return acc;
        }, {});
        
        groupTypes.forEach((type:string) => {
            if (!updatedGroupTypeData[type]) {
                updatedGroupTypeData[type] = {additionalInstructions: '', dataSources: [], documentState: {},
                                              isDisabled: false, disabledMessage: ''};
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
        const filteredGroupTypeData = Object.entries(groupTypeData).reduce((acc:any, [key, value]) => {
            if (selectedTypes.includes(key)) {    
                acc[key] = value; 
            }
            return acc;
        }, {});
        setAdditionalGroupData({...additionalGroupData, groupTypeData: filteredGroupTypeData});

        }, 100);
    },[groupTypeData, selectedTypes])

    useEffect(() => {
        setAdditionalGroupData({...additionalGroupData, groupUserTypeQuestion: userQuestion});

    },[userQuestion])

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
                    className= "mb-2 rounded-md border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                    style={{resize: 'none'}}
                    placeholder={`Message to display to user when selecting one of the group types prior to chatting.\n (default message: "Please select the group you best identify with to start chatting."')`}
                    value={userQuestion}
                    onChange={(e) =>  setUserQuestion(e.target.value)}
                    rows={2}
                />
            </div>
        }

        { Object.entries(groupTypeData)
                .filter(([type]) => selectedTypes.includes(type))
                .map(([type, data]) => (
                    <ExpansionComponent 
                    key={type}
                    isOpened={true}
                    title={type}
                    content={
                        
                        <div className='flex flex-col gap-2 my-4 text-black dark:text-neutral-200' key={type}> 
                            <div className='flex flex-row'>
                                {data.isDisabled ? "Disable Message For User" : "Additional Instructions" }
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
                                    className= "mb-2 rounded-md border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                    style={{resize: 'none'}}
                                    placeholder={`Message to display for selected disabled type: ${type}`}
                                    value={data.disabledMessage}
                                    onChange={(e) =>  updateGroupType(type, 'disabledMessage', e.target.value)}
                                    rows={3}
                                />
                                :
                                <textarea
                                className= "mb-2 rounded-md border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                style={{resize: 'none'}}
                                placeholder={`Additional instructions specific for this group type: ${type}`}
                                value={data.additionalInstructions}
                                onChange={(e) => updateGroupType(type, 'additionalInstructions', e.target.value)}
                                rows={3}
                            />}
                            
                            { !data.isDisabled &&  (
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
                                    <IconFiles size={20}/>
                                </button>

                                <AttachFile id={`__attachFile_admin_${type}_${groupId}_${astPromptId}`}
                                            groupId={groupId}
                                            disallowedFileExtensions={COMMON_DISALLOWED_FILE_EXTENSIONS}
                                            onAttach={(doc) => { 
                                                console.log("onAttach")

                                                updateGroupType(type, 'dataSources', [...groupTypeDataRef.current[type].dataSources, doc]);
                                            }}
                                            onSetMetadata={(doc, metadata) => {
                                                updateGroupType(type, 'dataSources', groupTypeDataRef.current[type].dataSources.map(x =>
                                                    x.id === doc.id ? { ...x, metadata } : x
                                                ));
                                            }}
                                            onSetKey={(doc, key) => {
                                                updateGroupType(type, 'dataSources', groupTypeDataRef.current[type].dataSources.map(x =>
                                                    x.id === doc.id ? { ...x, key } : x
                                                ));
                                            }}
                                            onUploadProgress={(doc, progress) => {
                                                updateDocumentState(type, doc.id, progress);
                                            }}
                                />
                            </div>

                            <FileList 
                                documents={data.dataSources.filter((ds:AttachedDocument) => !(preexistingDSids[type].includes(ds.id)))} 
                                documentStates={data.documentState}
                                setDocuments={(docs:AttachedDocument[]) => updateGroupType(type, 'dataSources', docs)} 
                            />
                            
                            {showDataSourceSelector === type && (
                                 <div className="mt-[-40px] flex flex-col justify-center overflow-x-hidden">
                                    <div className="relative top-[306px] left-1">
                                        <button
                                            type="button" style={{width: "100px"}}
                                            className="px-4 py-3 rounded-lg hover:text-gray-900 hover:bg-blue-100 bg-gray-100 w-full dark:hover:bg-gray-700 dark:hover:text-white bg-50 dark:bg-gray-800"
                                            onClick={() => {
                                                setShowDataSourceSelector('');
                                            }}
                                        >
                                            Close
                                        </button>
                                    </div>
                                    <div className="rounded bg-white dark:bg-[#343541]">
                                        <DataSourceSelector
                                            minWidth="500px"
                                            height='310px'
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
                                        />
                                    </div>
                                </div>
                            )} 

                            { preexistingDSids[type].length > 0  &&
                                <ExistingFileList 
                                    label={`${type} Data Sources`} boldTitle={false}
                                    documents={data.dataSources.filter((ds:AttachedDocument) => preexistingDSids[type].includes(ds.id))} 
                                    setDocuments={(docs:AttachedDocument[]) => updateGroupType(type, 'dataSources', docs)} />
                            }   

                        </>)}

                        </div>
                    } />
            ))
            
        }
    </div>
}