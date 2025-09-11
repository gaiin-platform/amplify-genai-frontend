import { FC, useState, useCallback } from "react";
import { EmailsAutoComplete } from "./EmailsAutoComplete";
import { IconPlus, IconTrash, IconCheck, IconX } from "@tabler/icons-react";

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

    // Flexible validation for usernames/systemIds/emails
    const isValidEntry = (entry: string): boolean => {
        const trimmed = entry.trim();
        return trimmed.length > 0 && 
               !trimmed.includes(' ') && // No spaces
               trimmed.length >= 2;      // Minimum length
    };

    // Get validation state for current input
    const getValidationState = (currentInput: string): 'valid' | 'invalid' | 'neutral' => {
        const trimmed = currentInput.trim();
        if (!trimmed) return 'neutral';
        
        if (trimmed.includes(',')) {
            const parts = trimmed.split(',').map(p => p.trim()).filter(p => p);
            if (parts.some(part => isValidEntry(part) && !emails.includes(part))) return 'valid';
        }
        
        if (emails.includes(trimmed)) return 'invalid'; // Duplicate
        return isValidEntry(trimmed) ? 'valid' : 'invalid';
    };

    // Process and add entries from input
    const processEntries = useCallback((inputValue: string, clearInput: boolean = true) => {
        const entries = inputValue.split(',')
            .map(entry => entry.trim())
            .filter(entry => entry);

        const validEntries = entries.filter(entry => 
            isValidEntry(entry) && !emails.includes(entry)
        );
        
        if (validEntries.length > 0) {
            handleUpdateEmails([...emails, ...validEntries]);
        }
        
        if (clearInput) {
            setInput('');
        }
    }, [emails, handleUpdateEmails]);

    // Handle manual add button click
    const handleAddEmails = () => {
        processEntries(input, true);
    };

    // Remove comma detection - let users type commas naturally

    // Handle Enter key
    const handleEnterAdd = useCallback(() => {
        processEntries(input, true);
    }, [input, processEntries]);

    // Handle input blur
    const handleBlurAdd = useCallback(() => {
        if (input.trim()) {
            processEntries(input, true);
        }
    }, [input, processEntries]);

    // Handle paste event with multiple entries
    const handlePaste = useCallback((pastedText: string) => {
        if (pastedText.includes(',') || pastedText.includes(';') || pastedText.includes('\n')) {
            const entries = pastedText
                .replace(/[;\n]/g, ',') // Replace semicolons and newlines with commas
                .split(',')
                .map(entry => entry.trim())
                .filter(entry => entry);
            
            const validEntries = entries.filter(entry => 
                isValidEntry(entry) && !emails.includes(entry)
            );
            
            if (validEntries.length > 0) {
                handleUpdateEmails([...emails, ...validEntries]);
                setInput('');
                return true; // Prevent default paste
            }
        }
        return false; // Allow default paste
    }, [emails, handleUpdateEmails]);

    const validationState = getValidationState(input);

    return ( 
        <>
       { !disableEdit &&
       <div className='flex flex-row gap-2' key={JSON.stringify(id)}>
            <div className='w-full relative'>
                <EmailsAutoComplete
                    input={input}
                    setInput={setInput}
                    allEmails={allEmails.filter((e:string) => !emails.includes(e))}
                    alreadyAddedEmails={emails}
                    onEnterPressed={handleEnterAdd}
                    onBlur={handleBlurAdd}
                    onPaste={handlePaste}
                    onSuggestionSelected={(suggestion: string) => {
                        // Parse existing input for complete entries
                        const existingEntries = input.split(',')
                            .map(entry => entry.trim())
                            .filter(entry => entry && isValidEntry(entry) && !emails.includes(entry));
                        
                        // Combine existing entries with the suggestion
                        const allNewEntries = [...existingEntries];
                        if (!emails.includes(suggestion) && !allNewEntries.includes(suggestion)) {
                            allNewEntries.push(suggestion);
                        }
                        
                        // Add all entries in a single update
                        if (allNewEntries.length > 0) {
                            handleUpdateEmails([...emails, ...allNewEntries]);
                        }
                        
                        // Clear input
                        setInput('');
                    }}
                    validationState={validationState}
                /> 
            </div>
            
            {/* Visual validation indicator */}
            <div className="flex-shrink-0 flex items-center">
                {validationState === 'valid' && (
                    <div className="p-1 text-green-500" title="Valid entry">
                        <IconCheck size={16} />
                    </div>
                )}
                {validationState === 'invalid' && (
                    <div className="p-1 text-red-500" title="Invalid or duplicate entry">
                        <IconX size={16} />
                    </div>
                )}
            </div>

            {/* Manual add button - now optional since we have auto-add */}
            <div className="flex-shrink-0 ml-[-6px]">
                <button 
                    type="button" 
                    title="Add Users (Auto-adds on Enter or blur)" 
                    id="addUserButton"
                    className="ml-2 mt-0.5 p-2 rounded-md border border-neutral-300 dark:border-white/20 transition-colors duration-200 cursor-pointer hover:bg-neutral-200 dark:hover:bg-gray-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleAddEmails}
                    disabled={!input.trim() || validationState === 'invalid'}
                > 
                    <IconPlus size={18} />
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