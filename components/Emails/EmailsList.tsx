import React, { useState, FC, useCallback, useRef, useEffect, useContext } from 'react';
import { IconCircleX, IconInfoCircle, IconPlus } from '@tabler/icons-react';
import { EmailsAutoComplete } from './EmailsAutoComplete';
import { fetchAllSystemIds } from '@/services/apiKeysService';
import HomeContext from '@/pages/api/home/home.context';
import { Group } from '@/types/groups';
import { useSession } from 'next-auth/react';
import { stringToColor } from '@/utils/app/data';


interface Props {
    label?: string;
    emails: string[];
    setEmails: (emails: string[]) => void;
    addMessage?: string;
}

interface EmailModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: () => void;
    input: string;
    setInput: (input: string) => void;
    message: string;
    allEmails: string[] | null;
    alreadyAddedEmails: string[];
    containsSystemUsers: boolean;
}

export const includeGroupInfoBox = (
    <div className='mb-4 flex flex-row gap-2 text-[0.795rem]'>
        <IconInfoCircle size={14} className='mt-0.5 flex-shrink-0 text-gray-600 dark:text-gray-400' />
        {'Use the "#" symbol to automatically include all members of the group.'}
    </div>
)


const EmailModal: FC<EmailModalProps> = ({ isOpen, onClose, onSubmit, input, setInput, message, allEmails, alreadyAddedEmails, containsSystemUsers}) => {
    const { state: { featureFlags, groups}, dispatch: homeDispatch } = useContext(HomeContext);
    
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
            <div className="fixed inset-0 z-10 overflow-hidden">
                <div className="flex items-center justify-center min-h-screen pt-4 pb-20 text-center sm:block sm:p-0">
                    <div className="inline-block overflow-y-auto  overflow-x-hidden rounded-lg border border-gray-300 bg-white px-4 pt-5 text-left align-bottom shadow-xl transition-all dark:bg-[#22232b] sm:my-8 sm:w-full sm:max-w-[480px] sm:align-middle"
                        style={{ transform: 'translateY(+22%)', position: 'relative' }}>
                        <div className="max-h-[calc(100vh-10rem)] p-0.5 overflow-y-auto">
                            
                            { featureFlags.assistantAdminInterface && groups && groups.length > 0  && 
                            <>{includeGroupInfoBox}</>
                            }
                            {containsSystemUsers && 
                            <div className='mb-4 flex flex-row gap-2 text-[0.795rem]'>
                                <IconInfoCircle size={14} className='mt-0.5 flex-shrink-0 text-gray-600 dark:text-gray-400' />
                                {'Use the "@" symbol to list your API created system users.'}
                            </div>
                            }

                            {message}

                            <div className='mt-2'> 
                                <EmailsAutoComplete
                                input = {input}
                                setInput =  {setInput}
                                allEmails = {allEmails}
                                alreadyAddedEmails = {alreadyAddedEmails}
                                />
                            </div>  
                            <div className="mt-2 flex flex-row items-center justify-end p-4 bg-white dark:bg-[#22232b]">
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
                                    onClick={onSubmit}
                                >
                                    OK
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const EmailsList: FC<Props> = ({
    emails,
    setEmails,
    label = "Emails",
    addMessage = "Enter emails separated by commas:",
}) => {
    const { state: {groups, amplifyUsers}, dispatch: homeDispatch } = useContext(HomeContext);

    const [input, setInput] = useState<string>('');
    const [showModal, setShowModal] = useState<boolean>(false);
    const [allEmails, setAllEmails] = useState<Array<string> | null>(null)

    const { data: session } = useSession();
    const user = session?.user?.email;

    useEffect(() => {
        const fetchEmails = async () => {
            const emailSuggestions =  amplifyUsers;
            //  API sytem users
            const apiSysIds = await fetchAllSystemIds();
            const sysIds = apiSysIds.map((k: any) => k.systemId).filter((k: any) => k);
            // add groups  #groupName
            const groupForMembers = groups.map((group:Group) => `#${group.name}`);
            const systemIdMembers = sysIds.map((id:string) => `@${id}`);
            setAllEmails(emailSuggestions ? [...emailSuggestions, ...groupForMembers, 
                                             ...systemIdMembers].filter((e: string) => e !== user)
                                                    : []);
        };
        if (!allEmails) fetchEmails();
    }, [showModal]);


    const handleAddEmails = () => {
        const entries = input.split(',').map(email => email.trim()).filter(email => email);
        let entriesWithGroupMembers:string[] = [];

        entries.forEach((e: any) => { 
            if ( e.startsWith('#') ) {
                const group = groups.find((g:Group) => g.name === e.slice(1));
                if (group) entriesWithGroupMembers = [...entriesWithGroupMembers, 
                                                      ...Object.keys(group.members).filter((e: string) => e !== user)]; 
            } else if (e.startsWith('@') ) {
                entriesWithGroupMembers.push(e.slice(1));
            } else {
                entriesWithGroupMembers.push(e.toLowerCase());
            }
        });

        const newEmails = entriesWithGroupMembers.filter(email => (/^\S+@\S+\.\S+$/.test(email) || 
                             /^[a-zA-Z0-9-]+-\d{6}$/.test(email)) && !emails.includes(email));
        setEmails([...emails, ...newEmails]);
        setInput('');
        setShowModal(false);
    };

    return (
        <div className="flex flex-col w-full">
            <div className="mt-4 flex items-center px-1 py-1">
                <button className="text-gray-400 hover:text-gray-600 transition-all" onClick={() => setShowModal(true)}>
                    <IconPlus />
                </button>
                <div>
                    <p className="text-black dark:text-white font-medium text-sm pl-2">{label}:</p>
                </div>
            </div>
            <EmailModal
                isOpen={showModal}
                onClose={() => {
                    setShowModal(false);
                    setInput('');
                } }
                onSubmit={handleAddEmails}
                input={input}
                setInput={setInput}
                message={addMessage} allEmails={allEmails}
                alreadyAddedEmails={emails}
                containsSystemUsers={!!allEmails?.some((s:string) => s.startsWith('@'))}
                />    
            <div className="flex w-full flex-wrap pb-2 mt-2">
                {emails.map((email, index) => (
                    <div 
                        key={index}
                        className="flex items-center justify-between bg-white dark:bg-neutral-200 rounded-md px-2 py-0 mr-2 mb-2 shadow-lg"
                        style={{ backgroundColor: stringToColor(email) }}
                    >
                        <button
                            className="text-gray-800 transition-all"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setEmails(emails.filter(x => x !== email));
                            }}
                            title="Remove Email"
                        >
                            <IconCircleX size={17} />
                        </button>
                        <div className="ml-1">
                            <p className="text-gray-800 font-medium text-sm">{email}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

