import { InfoBox } from "@/components/ReusableComponents/InfoBox";
import HomeContext from "@/pages/api/home/home.context";
import { useSession } from "next-auth/react";
import { FC, ReactElement, useContext, useState } from "react";
import { AmplifyGroupSelect } from "../AdminUI";
import { Group, GroupAccessType, Members } from '@/types/groups';
import { Modal } from "@/components/ReusableComponents/Modal";
import { GroupTypesAst } from "../AssistantAdminUI";
import { IconCheck, IconPlus, IconTrashX, IconX } from "@tabler/icons-react";
import { includeGroupInfoBox } from "@/components/Emails/EmailsList";
import { AddEmailWithAutoComplete } from "@/components/Emails/AddEmailsAutoComplete";

interface CreateProps {
    createGroup: (groupData: any) => void;
    onClose: () => void;
    allEmails: Array<string> | null;
    message: string;
    amplifyGroups: string[];
    systemUsers: string[];
}


export const CreateAdminDialog: FC<CreateProps> = ({ createGroup, onClose, allEmails, message, amplifyGroups, systemUsers }) => {
    const { state: { statsService, groups }, dispatch: homeDispatch } = useContext(HomeContext);
    const { data: session } = useSession();
    const user = session?.user?.email;


    const [groupName, setGroupName] = useState<string>('');
    const [groupMembers, setGroupMembers] = useState<Members>({});

    const [groupTypes, setGroupTypes] = useState<string[]>([]);
    const [groupAmpGroups, setGroupAmpGroups] = useState<string[]>([]);
    const [groupSystemUsers, setGroupSystemUsers] = useState<string[]>([]);

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
                    ...Object.keys(group.members).filter((member: string) => member !== user)];
                }
            } else {
                entriesWithGroupMembers.push(e);
            }
        });

        // Filter valid entries (usernames/systemIds/emails) and avoid duplicates
        const newEntries = entriesWithGroupMembers.filter(entry => 
            isValidEntry(entry) && !Object.keys(groupMembers).includes(entry)
        );
        
        if (newEntries.length > 0) {
            setGroupMembers({ 
                ...groupMembers, 
                ...Object.fromEntries(newEntries.map(entry => [entry, GroupAccessType.READ])) 
            } as Members);
        }
    };


    return (
        <Modal
            width={() => window.innerWidth * 0.7}
            height={() => window.innerHeight * 0.92}
            title={"Assistant Admin Interface "}
            onCancel={() => {
                onClose()
            }}
            onSubmit={() =>
                createGroup({
                    group_name: groupName,
                    members: { ...groupMembers, [user as string]: GroupAccessType.ADMIN },
                    types: groupTypes,
                    amplify_groups: groupAmpGroups,
                    system_users: groupSystemUsers
                })
            }
            submitLabel={"Create Group"}
            content={
                <div className='mr-2'>
                    {"You will be able to manage assistants and view key metrics related to user engagement and conversation."}
                    <div className="text-sm mb-4 text-black dark:text-neutral-200">{message}</div>

                    <div className='flex flex-col gap-3 font-bold '>
                        <>
                            Group Name

                            <textarea
                                className="mb-2 rounded-md border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                style={{ resize: 'none' }}
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
                        <div className='my-2'>
                            <AddMemberAccess
                                groupMembers={groupMembers}
                                setGroupMembers={setGroupMembers}
                                allEmails={allEmails}
                                processEmailEntries={processEmailEntries}
                            />
                        </div>
                        <AmpGroupsSysUsersSelection
                            amplifyGroups={amplifyGroups}
                            selectedAmplifyGroups={groupAmpGroups}
                            setSelectedAmplifyGroups={setGroupAmpGroups}
                            systemUsers={systemUsers}
                            selectedSystemUsers={groupSystemUsers}
                            setSelectedSystemUsers={setGroupSystemUsers}
                        />
                    </div>

                </div>
            }
        />
    )

}



interface AmpSysSelectionProps {
    amplifyGroups: string[];
    selectedAmplifyGroups: string[];
    setSelectedAmplifyGroups: (selectedGroups: string[]) => void;
    systemUsers: string[];
    selectedSystemUsers: string[];
    setSelectedSystemUsers: (selectedGroups: string[]) => void;
    layout?: 'row' | 'col';

    onConfirmAmpGroups?: () => Promise<boolean>;
    onCancelAmpGroups?: () => void;
    onConfirmSystemUsers?: () => Promise<boolean>;
    onCancelSystemUsers?: () => void;

}
export const AmpGroupsSysUsersSelection: FC<AmpSysSelectionProps> = ({ amplifyGroups, selectedAmplifyGroups, setSelectedAmplifyGroups,
    systemUsers, selectedSystemUsers, setSelectedSystemUsers,
    layout = 'col',
    onConfirmAmpGroups, onCancelAmpGroups,
    onConfirmSystemUsers, onCancelSystemUsers
}) => {
    const [isUpdatingAmpGroups, setIsUpdatingAmpGroups] = useState<boolean>(false);
    const [isUpdatingSystemUsers, setIsUpdatingSystemUsers] = useState<boolean>(false);
    const manageAmpGroupChanges = (!!onConfirmAmpGroups);
    const manageSystemUserChanges = (!!onConfirmSystemUsers);

    const onAcceptAmpGroups = async () => {
        if (onConfirmAmpGroups) {
            const sucess = await onConfirmAmpGroups();
            if (sucess) setIsUpdatingAmpGroups(false);
        }
    }

    const onAcceptSystemUsers = async () => {
        if (onConfirmSystemUsers) {
            const sucess = await onConfirmSystemUsers();
            if (sucess) setIsUpdatingSystemUsers(false);
        }
    }

    const manageChanges = (onConfirm: () => void, onCancel: () => void) => {
        return <div className="mr-3 mt-1.5 flex flex-row gap-1 h-[20px]">
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

    return (
        <div className={`mb-6 ${layout === 'row' ? 'flex flex-row gap-4' : 'flex flex-col gap-4'}`}>
            {amplifyGroups.length > 0 &&
                <div className={layout === 'row' ? "flex-1" : ""}>
                    <ListSelection
                        title="Amplify Group Access"
                        infoLabel="Grant read access to users who are members of the following Amplify Groups. These users will not appear under the Group Members list."
                        selection={amplifyGroups}
                        selected={selectedAmplifyGroups}
                        setSelected={(selected: string[]) => {
                            setSelectedAmplifyGroups(selected);
                            if (manageAmpGroupChanges) setIsUpdatingAmpGroups(true);
                        }}
                        manageButtons={manageAmpGroupChanges && isUpdatingAmpGroups ?
                            <div>{manageChanges(onAcceptAmpGroups, () => {
                                if (onCancelAmpGroups) onCancelAmpGroups();
                                setIsUpdatingAmpGroups(false);
                            })}
                            </div> : <></>}
                        layout={layout}
                    />
                </div>}
            {systemUsers.length > 0 &&
                <div className={layout === 'row' ? "flex-1" : ""}>
                    <ListSelection
                        title='System User Access'
                        infoLabel='Grant read access to your API created system users.'
                        label='System Users'
                        selection={systemUsers}
                        selected={selectedSystemUsers}
                        setSelected={(selected: string[]) => {
                            setSelectedSystemUsers(selected);
                            if (manageSystemUserChanges) setIsUpdatingSystemUsers(true);
                        }}
                        manageButtons={manageSystemUserChanges && isUpdatingSystemUsers ?
                            <div> {manageChanges(onAcceptSystemUsers, () => {
                                if (onCancelSystemUsers) onCancelSystemUsers();
                                setIsUpdatingSystemUsers(false);
                            })}
                            </div> : <></>}
                        layout={layout}
                    />
                </div>}

        </div>
    );
}

interface SelectionProps {
    title: string;
    infoLabel: string;
    selection: string[];
    selected: string[];
    setSelected: (selectedGroups: string[]) => void;
    manageButtons?: ReactElement;
    label?: string;
    layout?: 'row' | 'col';
}
const ListSelection: FC<SelectionProps> = ({ title, infoLabel, selection, selected, setSelected, manageButtons = null, label, layout }) => {
    return (
        <div className={`mb-6 px-1 ${layout === 'row' ? 'text-center' : ''}`}>
            <div className='mb-1 font-bold'>{title}</div>
            <InfoBox padding={"py-1"} color='#085bd6'
            content={
                <>
                    <span className="ml-1 text-xs w-full text-center"> {infoLabel} </span>
                    <div className='ml-auto'>{manageButtons}</div>
                    {!!manageButtons}
                </>
            } />

            <AmplifyGroupSelect
                groups={selection}
                selected={selected}
                setSelected={setSelected}
                label={label}
            />
        </div>
    );
}


interface MemberAccessProps {
    groupMembers: Members;
    setGroupMembers: (m: Members) => void;
    allEmails: Array<string> | null;
    processEmailEntries: (entries: string[]) => void;
    width?: string;
}

export const accessInfoBox = <InfoBox color='#085bd6' content={
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

export const AddMemberAccess: FC<MemberAccessProps> = ({ groupMembers, setGroupMembers, allEmails, processEmailEntries, width = '500px' }) => {
    const [hoveredUser, setHoveredUser] = useState<string | null>(null);

    const handleRemoveUser = (email: string) => {
        const updatedMembers = { ...groupMembers };
        delete updatedMembers[email];
        setGroupMembers(updatedMembers);
    }

    // Convert processEmailEntries to work with the new interface
    const handleUpdateEmails = (newEmails: string[]) => {
        // Find newly added emails by comparing with current members
        const currentEmails = Object.keys(groupMembers);
        const addedEmails = newEmails.filter(email => !currentEmails.includes(email));
        
        if (addedEmails.length > 0) {
            processEmailEntries(addedEmails);
        }
    };

    return <div className='flex flex-col gap-2 mb-6'>
        <label className='font-bold'>Add Members </label>
        {accessInfoBox}
        <label className='text-sm font-normal'>List group members and their permission levels.</label>
        <>{includeGroupInfoBox}</>
        
        <AddEmailWithAutoComplete
            id="groupMembers"
            emails={Object.keys(groupMembers)}
            allEmails={allEmails || []}
            handleUpdateEmails={handleUpdateEmails}
            displayEmails={false}
        />

        {Object.keys(groupMembers).length > 0 &&
            <div>
                Set Member Access
                <table className="modern-table mt-2 w-full" style={{boxShadow: 'none', tableLayout: 'fixed'}}>
                    <thead>
                        <tr className="gradient-header">
                            <th className="border px-4 py-2">User</th>
                            <th className="border px-4 py-2">Access</th>
                        </tr>
                    </thead>
                    <tbody>

                        {Object.entries(groupMembers).map(([email, access]) => (
                            <tr key={email}>
                                <td className="border px-4 py-2 " style={{ width: width }}>
                                    <div className='flex items-center  '
                                        onMouseEnter={() => {
                                            setHoveredUser(email)
                                        }}
                                        onMouseLeave={() => {
                                            setHoveredUser(null)
                                        }}
                                    >
                                        {email}
                                        {hoveredUser === email &&
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
                                            setGroupMembers({ ...groupMembers, [email]: newAccessLevel })
                                        }} />
                                }</td>
                            </tr>
                        ))}

                    </tbody>
                </table>

            </div>}
    </div>
}



interface AccessProps {
    access: GroupAccessType;
    setAccess: (t: GroupAccessType) => void;
}

export const AccessSelect: FC<AccessProps> = ({ access, setAccess }) => {

    return (
        <select className={"w-full text-center border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"}
            value={access}
            title='Select Access Type'
            onChange={(event) => {
                setAccess(event.target.value as GroupAccessType);
            }}
        >
            {[GroupAccessType.ADMIN, GroupAccessType.READ, GroupAccessType.WRITE].map((accessType: GroupAccessType) => (
                <option key={accessType} value={accessType}>
                    {accessType}
                </option>
            ))}
        </select>
    )
}