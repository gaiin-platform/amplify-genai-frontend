import HomeContext from "@/pages/api/home/home.context";
import { useSession } from "next-auth/react";
import { FC, useContext, useEffect, useState } from "react";
import { deleteAstAdminGroup, updateGroupAmplifyGroups, updateGroupMembers, updateGroupMembersPermissions, updateGroupSystemUsers, updateGroupTypes } from '@/services/groupsService';
import Search from '../../Search';
import { accessInfoBox, AccessSelect, AddMemberAccess, AmpGroupsSysUsersSelection } from "./CreateAdminGroupDialog";
import { Group, GroupAccessType, GroupUpdateType, Members } from '@/types/groups';
import { IconCheck, IconTrashX, IconX } from "@tabler/icons-react";
import toast from "react-hot-toast";
import { Prompt } from "@/types/prompt";
import { FolderInterface } from "@/types/folder";
import { getDateName } from '@/utils/app/date';
import { GroupTypesAst } from "../AssistantAdminUI";
import { Checkbox } from '../../ReusableComponents/CheckBox';

interface User {
    name: string;
    // dateAdded: string;
    accessLevel: GroupAccessType;
}

interface ManagementProps {
    selectedGroup: Group;
    setSelectedGroup: (g: Group | undefined) => void;
    members: Members;
    allEmails: Array<string> | null;
    setLoadingActionMessage: (s: string) => void;
    adminGroups: Group[];
    setAdminGroups: (groups: Group[]) => void;
    amplifyGroups: string[];
    systemUsers: string[];
}


export const GroupManagement: FC<ManagementProps> = ({ selectedGroup, setSelectedGroup, members, allEmails, setLoadingActionMessage,
    adminGroups, setAdminGroups, amplifyGroups, systemUsers }) => {
    const { state: { groups, prompts, folders, statsService }, dispatch: homeDispatch } = useContext(HomeContext);
    const { data: session } = useSession();
    const userEmail = session?.user?.email;

    const [hasAdminAccess, setHasAdminAccess] = useState<boolean>((userEmail && selectedGroup.members[userEmail] === GroupAccessType.ADMIN) || false);
    const [groupTypes, setGroupTypes] = useState<string[]>(selectedGroup.groupTypes);
    const [groupAmpGroups, setGroupAmpGroups] = useState<string[]>(selectedGroup.amplifyGroups ?? []);
    const [groupSystemUsers, setGroupSystemUsers] = useState<string[]>(selectedGroup.systemUsers ?? []);

    const initUniqueSystemUsers = () => {
        const uniqueSystemUsers = new Set([
            ...(systemUsers ?? []),
            ...(selectedGroup?.systemUsers ?? [])
        ]);
        
        return Array.from(uniqueSystemUsers);
    }
    const [availableSystemUsers, setAvailableSystemUsers] = useState<string[]>(initUniqueSystemUsers());


    const [searchTerm, setSearchTerm] = useState<string>('');
    const [isDeleting, setIsDeleting] = useState<boolean>(false);
    const [deleteUsersList, setDeleteUsersList] = useState<string[]>([]);


    const [isAddingUsers, setIsAddingUsers] = useState<boolean>(false);
    const [newGroupMembers, setNewGroupMembers] = useState<Members>({});


    const [isEditingAccess, setIsEditingAccess] = useState<boolean>(false);
    const [editAccessMap, setEditAccessMap] = useState<Members>({});

    const [allGroupEmails, setAllGroupEmails] = useState<Array<string> | null>(allEmails);

    useEffect(() => {
        setIsDeleting(false);
        setDeleteUsersList([]);
        setIsAddingUsers(false);
        setNewGroupMembers({});
        setIsEditingAccess(false);
        setEditAccessMap({});
        setGroupTypes(selectedGroup.groupTypes);
    }, [selectedGroup]);

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

    const [users, setUsers] = useState<User[]>(usersmap);

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
        const updatedGroup = { ...selectedGroup, groupTypes: groupTypes };
        setSelectedGroup(updatedGroup);
        const updatedAdminGroups = adminGroups.map((g: Group) => {
            if (selectedGroup?.id === g.id) return updatedGroup;
            return g;
        });
        setAdminGroups(updatedAdminGroups);
        setLoadingActionMessage('');
    }

    const onUpdateAmpGroups = async () => {
        if (!hasAdminAccess) {
            alert("You are not authorized to update this group's Amplify Group list.");
            return false;
        }
        setLoadingActionMessage('Updating Amplify Group List');
        const updateData = {
            "group_id": selectedGroup.id,
            "amplify_groups": groupAmpGroups
        };
        // statsService.updateGroupAmplifyGroupsEvent(updateData); 
        const result = await updateGroupAmplifyGroups(updateData);
        if (!result.success) {
            alert(`Unable to update amplify group list at this time. Please try again later.`);
            setLoadingActionMessage('');
            return false;;
        } else {
            toast(`Successfully updated Amplify group list.`);
        }

        //update groups home dispatch 
        const updatedGroup = { ...selectedGroup, amplifyGroups: groupAmpGroups };
        setSelectedGroup(updatedGroup);
        const updatedAdminGroups = adminGroups.map((g: Group) => {
            if (selectedGroup?.id === g.id) return updatedGroup;
            return g;
        });
        setAdminGroups(updatedAdminGroups);
        setLoadingActionMessage('');
        return true;
    }

    const onUpdateSystemUsers = async () => {
        if (!hasAdminAccess) {
            alert("You are not authorized to update this group's system users list.");
            return false;
        }
        setLoadingActionMessage('Updating System User List');
        const updateData = {
            "group_id": selectedGroup.id,
            "system_users": groupSystemUsers
        };
        // statsService.updateGroupSystemUsersEvent(updateData); 
        const result = await updateGroupSystemUsers(updateData);
        if (!result.success) {
            alert(`Unable to update the system users list at this time. Please try again later.`);
            setLoadingActionMessage('');
            return false;
        } else {
            toast(`Successfully updated group's system users list.`);
        }

        //update groups home dispatch 
        const updatedGroup = { ...selectedGroup, systemUsers: groupSystemUsers };
        setSelectedGroup(updatedGroup);
        const updatedAdminGroups = adminGroups.map((g: Group) => {
            if (selectedGroup?.id === g.id) return updatedGroup;
            return g;
        });
        setAdminGroups(updatedAdminGroups);
        setLoadingActionMessage('');
        return true;
    }


    function arraysEqual(a: string[], b: string[]) {
        return a.length === b.length && a.every(element => b.includes(element)) && b.every(element => a.includes(element));
    }

    const removeUserFromGroup = (groupId: string) => {
        const filteredAdminGroups = adminGroups.filter((g: Group) => g.id !== groupId);
        setAdminGroups(filteredAdminGroups);
        setSelectedGroup(filteredAdminGroups[0]);
        //update folders and prompts
        homeDispatch({ field: 'prompts', value: prompts.filter((p: Prompt) => p.groupId !== groupId) });
        homeDispatch({ field: 'folders', value: folders.filter((f: FolderInterface) => f.id !== groupId) });
        homeDispatch({ field: 'groups', value: groups.filter((g: Group) => g.id !== groupId) });

    }

    const handleDeleteGroup = async (groupId: string) => {
        if (!hasAdminAccess) {
            alert("You are not authorized to delete this group.");
            return;
        }

        if (confirm("Are you sure you want to delete this group? You will not be able to undo this change.\n\nWould you like to continue?")) {
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

    // Flexible validation for usernames/systemIds/emails
    const isValidEntry = (entry: string): boolean => {
        const trimmed = entry.trim();
        return trimmed.length > 0 && 
               !trimmed.includes(' ') && // No spaces
               trimmed.length >= 2;      // Minimum length
    };

    // Process emails and handle group expansion
    const processEmailEntries = (entries: string[]) => {
        let entriesWithGroupMembers: string[] = [];

        entries.forEach((e: string) => {
            if (e.startsWith('#')) {
                const group = groups.find((g: Group) => g.name === e.slice(1));
                if (group) {
                    entriesWithGroupMembers = [...entriesWithGroupMembers,
                    ...Object.keys(group.members).filter((member: string) => member !== userEmail)];
                }
            } else {
                entriesWithGroupMembers.push(e);
            }
        });

        // Filter valid entries (usernames/systemIds/emails) and avoid duplicates
        const newEntries = entriesWithGroupMembers.filter(entry => 
            isValidEntry(entry) && 
            !Object.keys(newGroupMembers).includes(entry) &&
            !Object.keys(selectedGroup.members).includes(entry)
        );
        
        if (newEntries.length > 0) {
            setNewGroupMembers({ 
                ...newGroupMembers, 
                ...Object.fromEntries(newEntries.map(entry => [entry, GroupAccessType.READ])) 
            } as Members);
        }
    };

    // Convert processEmailEntries to work with the new interface
    const handleUpdateEmails = (newEmails: string[]) => {
        // Find newly added emails by comparing with current members
        const currentEmails = Object.keys(newGroupMembers);
        const addedEmails = newEmails.filter(email => !currentEmails.includes(email));
        
        if (addedEmails.length > 0) {
            processEmailEntries(addedEmails);
        }
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
            const updatedGroup = { ...selectedGroup, members: { ...selectedGroup.members, ...newGroupMembers } };
            setSelectedGroup(updatedGroup);
            const updatedAdminGroups = adminGroups.map((g: Group) => {
                if (selectedGroup?.id === g.id) return updatedGroup;
                return g;
            });
            setAdminGroups(updatedAdminGroups);
            setNewGroupMembers({});
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
            setUsers(users.filter((user: User) => !deleteUsersList.includes(user.name)));
            setAllGroupEmails([...(allEmails ?? []), ...deleteUsersList]);
            const updatedMembers = { ...selectedGroup.members };
            deleteUsersList.forEach(user => {
                delete updatedMembers[user]; // Remove the user from members
            });
            const updatedGroup = { ...selectedGroup, members: updatedMembers }
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
            if (removingSelfFromGroup) {
                setSelectedGroup(updatedAdminGroups[0]);
            } else {
                setSelectedGroup(updatedGroup);
            }
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
                    if (editAccessMap.hasOwnProperty(name)) {
                        mergedMemberPerms[name] = editAccessMap[name];
                    } else {
                        mergedMemberPerms[name] = selectedGroup.members[name];
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
                const updatedPrompts = prompts.map((p: Prompt) => {
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
            const updatedGroup = { ...selectedGroup, members: { ...selectedGroup.members, ...editAccessMap } };
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
            if (removingAdminInterfaceAccess) {
                setSelectedGroup(updatedAdminGroups[0]);
            } else {
                setSelectedGroup(updatedGroup);
            }

            setEditAccessMap({});
            setIsEditingAccess(false);
        }
        if (result) {
            toast(`Successfully updated users group access.`);
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
                    showControlButtons={!arraysEqual(groupTypes, selectedGroup.groupTypes)}
                    onConfirm={() => onUpdateTypes()}
                    onCancel={() => setGroupTypes(selectedGroup.groupTypes)}
                />

                {isAddingUsers &&
                    <AddMemberAccess
                        groupMembers={newGroupMembers}
                        setGroupMembers={setNewGroupMembers}
                        allEmails={allGroupEmails}
                        processEmailEntries={handleUpdateEmails}
                        width='840px'
                    />
                }
                <label className="font-bold">Group Members</label>

                <div className="flex justify-between gap-6 items-center">
                    <Search
                        placeholder={'Search...'}
                        searchTerm={searchTerm}
                        onSearch={(searchTerm: string) => {
                            setSearchTerm(searchTerm);
                            setUsers(users.filter((u: User) => u.name.startsWith(searchTerm)))
                        }
                        }
                        disabled={isDeleting}
                    />
                    <div className='ml-auto flex flex-row gap-1'>
                        {hasAdminAccess && <button
                            className="px-4 py-2 navy-gradient-btn"
                            onClick={() => setIsAddingUsers(true)}
                        >
                            Add Users
                        </button>}
                        {isAddingUsers && <div className=" flex flex-row gap-0.5 bg-neutral-200 dark:bg-[#343541]/90 w-[36px]">
                            <button
                                className="text-green-500 hover:text-green-700 cursor-pointer"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (Object.keys(newGroupMembers).length > 0) {
                                        addUsers();
                                    } else {
                                        setIsAddingUsers(false);
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

                                }}
                                title={"Cancel"}
                            >
                                <IconX size={16} />
                            </button>
                        </div>}
                    </div>
                    {hasAdminAccess && <>
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
                {isEditingAccess && accessInfoBox}

                {users.length === 0 ? <div className='ml-4'> No members to display</div> :
                    <div className='overflow-y-auto max-h-[300px]'>
                        <table className="modern-table w-full" style={{boxShadow: 'none', tableLayout: 'fixed'}}>
                            <thead>
                                <tr className="gradient-header">
                                    {isDeleting ? 
                                    <th className="py-2">
                                        <Checkbox
                                            id="select-all-users"
                                            label="Select All"
                                            checked={deleteUsersList.length === users.length}
                                            onChange={(checked) => {
                                                if (checked) {
                                                    setDeleteUsersList(users.map((user: User) => user.name));
                                                } else {
                                                    setDeleteUsersList([]);
                                                }
                                            }}
                                        />
                                    </th> : <th className="border px-4 py-2">Name</th>}
                                    <th className="border px-4 py-2">Access Level</th>

                                </tr>
                            </thead>
                            <tbody>
                                {[...users].map((user, index) => (
                                    <tr key={index}>
                                        {isDeleting ?
                                            <td className="py-2 px-3">
                                                <Checkbox
                                                    id={`user-${index}`}
                                                    label={`${user.name} ${userEmail === user.name ? '   (You)' : ''}`}
                                                    checked={deleteUsersList.includes(user.name)}
                                                    onChange={(checked) => {
                                                        if (checked) {
                                                            setDeleteUsersList(prevList => [...prevList, user.name]);
                                                        } else {
                                                            setDeleteUsersList(prevList => prevList.filter(name => name !== user.name));
                                                        }
                                                    }}
                                                />
                                            </td> :
                                            <td className="border px-4 py-2">{user.name}
                                                <label className='ml-2 opacity-50'>{`${userEmail === user.name ? ' (You)' : ''}`}</label>
                                            </td>
                                        }
                                        {/* <td className="border px-4 py-2">{user.dateAdded}</td> */}
                                        <td className={`border ${isEditingAccess ? '' : 'px-4 py-2'}`}>{
                                            isEditingAccess ? <AccessSelect
                                                access={user.accessLevel}
                                                setAccess={(newAccessLevel: GroupAccessType) => {
                                                    setUsers(prevUsers =>
                                                        prevUsers.map((u, i) =>
                                                            i === index ? { ...u, accessLevel: newAccessLevel } : u
                                                        )
                                                    );
                                                    setEditAccessMap({ ...editAccessMap, [user.name]: newAccessLevel })
                                                }} />
                                                : user.accessLevel
                                        }</td>
                            
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                }

                <AmpGroupsSysUsersSelection
                    amplifyGroups={amplifyGroups}
                    selectedAmplifyGroups={groupAmpGroups}
                    setSelectedAmplifyGroups={setGroupAmpGroups}
                    systemUsers={availableSystemUsers}
                    selectedSystemUsers={groupSystemUsers}
                    setSelectedSystemUsers={setGroupSystemUsers}
                    onConfirmAmpGroups={onUpdateAmpGroups}
                    onCancelAmpGroups={() => setGroupAmpGroups(selectedGroup.amplifyGroups ?? [])}
                    onConfirmSystemUsers={onUpdateSystemUsers}
                    onCancelSystemUsers={() => setGroupSystemUsers(selectedGroup.systemUsers ?? [])}
                    layout='row'
                />

                {hasAdminAccess &&
                    <button
                        type="button"
                        className={`flex flex-row mt-auto gap-2 ml-auto mt-4 p-2 text-sm bg-neutral-500 text-white rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500`}
                        onClick={() => { handleDeleteGroup(selectedGroup.id) }}
                    >
                        <IconTrashX size={18} />
                        Delete Group
                    </button>
                }
            </div>
        </div>
    );
};


interface ActionProps {
    condition: boolean;
    label: string;
    title: string;
    clickAction: () => void;
    onConfirm: () => void;
    onCancel: () => void;
}

const UsersAction: FC<ActionProps> = ({ condition, label, title, clickAction, onConfirm, onCancel }) => {

    return (condition ? (
        <div className="flex flex-row gap-1">
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
    ) : (
        <button
            className={`px-4 py-2 navy-gradient-btn`}
            onClick={clickAction}
        >
            {title}
        </button>
    )
    )
}