import { FC, useState } from "react";
import { EmailsAutoComplete } from "./EmailsAutoComplete";
import { IconPlus, IconTrash } from "@tabler/icons-react";

interface AddEmailsProps {
    id: String;
    emails: string[];
    allEmails: string[]
    handleUpdateEmails: (e: Array<string>) => void;
    displayEmails?: boolean;
    disableEdit?: boolean;
}

export const AddEmailWithAutoComplete: FC<AddEmailsProps> = ({ id, emails, allEmails, handleUpdateEmails, displayEmails = false, disableEdit = false}) => {
    const [hoveredUser, setHoveredUser] = useState<string | null>(null);
    const [input, setInput] = useState<string>('');

    const handleAddEmails = () => {
        const entries = input.split(',').map(email => email.trim()).filter(email => email);

        const newEmails = entries.filter(email => /^\S+@\S+\.\S+$/.test(email) && !emails.includes(email));
        if (newEmails.length > 0) handleUpdateEmails([...emails, ...newEmails]);
        setInput('');
    };

    return ( 
        <>
       { !disableEdit &&
       <div className='flex flex-row gap-2' key={JSON.stringify(id)}>
            <div className='w-full relative'>
                <EmailsAutoComplete
                    input = {input}
                    setInput =  {setInput}
                    allEmails = {allEmails.filter((e:string) => !emails.includes(e))}
                    alreadyAddedEmails = {emails}
                /> 
            </div>
            <div className="flex-shrink-0 ml-[-6px]">
                <button type="button" title="Add User" id="addUserButton"
                    className="ml-2 mt-0.5 p-2 rounded-md border border-neutral-300 dark:border-white/20 transition-colors duration-200 cursor-pointer hover:bg-neutral-200 dark:hover:bg-gray-500/10 "
                    onClick={handleAddEmails}
                > <IconPlus size={18} />
                </button>
            </div>
        
        </div>}

        {displayEmails &&
            (<div className="mt-4 flex flex-wrap ">
                {emails
                    .map((user, index) => (
                    <div key={index} className="border border-neutral-500 flex items-center">
                        <div
                        className="flex items-center"
                        onMouseEnter={() => setHoveredUser(user)}
                        onMouseLeave={() => setHoveredUser(null)}
                        >
                        <div className="min-w-[28px] flex items-center ml-2">
                        {hoveredUser === user && !disableEdit && (
                            <button
                            type="button"
                            className="p-0.5 text-sm bg-neutral-400 dark:bg-neutral-500 rounded hover:bg-red-600 dark:hover:bg-red-700 focus:outline-none"
                            onClick={() => handleUpdateEmails(emails.filter((u: string) => u !== user))}
                            >
                            <IconTrash size={16} />
                            </button>
                        )}
                        </div>
                        <span className="truncate pr-8 py-2 mr-1">{user}</span>
                    
                        </div>
                    </div>
                    ))}
            </div>)
        }
        
        </>
    )
}