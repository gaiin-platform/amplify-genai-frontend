import React, { useState, FC, useCallback, useRef, useEffect } from 'react';
import { IconCircleX, IconPlus } from '@tabler/icons-react';
import { fetchEmailSuggestions } from '@/services/emailAutocompleteService';
import debounce from 'lodash.debounce';
import { EmailsAutoComplete } from './EmailsAutoComplete';
import { setEngine } from 'crypto';
import { fetchAllSystemIds } from '@/services/apiKeysService';


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
    alreadyAddedEmails: string[]
}

function stringToColor(str: string): string {
    const colors = [
        "#fbfbfb", "#979197", "#f69833", "#419bf9", "#f7f7f7",
        "#ee6723", "#fecf33", "#c8cf2d", "#0dcfda", "#edeced",
        "#c1bec1", "#fdbd39"
    ];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    hash = Math.abs(hash);
    const index = hash % colors.length;
    return colors[index];
}



const EmailModal: FC<EmailModalProps> = ({ isOpen, onClose, onSubmit, input, setInput, message, allEmails, alreadyAddedEmails}) => {
    
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
            <div className="fixed inset-0 z-10 overflow-hidden">
                <div className="flex items-center justify-center min-h-screen pt-4 pb-20 text-center sm:block sm:p-0">
                    <div className="inline-block overflow-y-auto  overflow-x-hidden rounded-lg border border-gray-300 bg-white px-4 pt-5 text-left align-bottom shadow-xl transition-all dark:bg-[#202123] sm:my-8 sm:w-full sm:max-w-[480px] sm:align-middle"
                        style={{ transform: 'translateY(+22%)', position: 'relative' }}>
                        <div className="max-h-[calc(100vh-10rem)] p-0.5 overflow-y-auto">
                            {message}
                            <div className='mt-2'> 
                                <EmailsAutoComplete
                                input = {input}
                                setInput =  {setInput}
                                allEmails = {allEmails}
                                alreadyAddedEmails = {alreadyAddedEmails}

                                />
                            </div>  
                            <div className="mt-2 flex flex-row items-center justify-end p-4 bg-white dark:bg-[#202123]">
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
    const [input, setInput] = useState<string>('');
    const [showModal, setShowModal] = useState<boolean>(false);
    const [allEmails, setAllEmails] = useState<Array<string> | null>(null)

    useEffect(() => {
        const fetchEmails = async () => {
            const emailSuggestions = await fetchEmailSuggestions("*");
            const apiSysIds = await fetchAllSystemIds();
            console.log(apiSysIds)
            setAllEmails(emailSuggestions.emails ? [...emailSuggestions.emails, ...apiSysIds] : []);
        };
        if (!allEmails) fetchEmails();
    }, [showModal]);


    const handleAddEmails = () => {
        const newEmails = input.split(',')
            .map(email => email.trim())
            .filter(email => /^\S+@\S+\.\S+$/.test(email) && !emails.includes(email));
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
                alreadyAddedEmails={emails}/>    
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

