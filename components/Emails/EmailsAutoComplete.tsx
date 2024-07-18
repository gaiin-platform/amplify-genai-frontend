import React, { useState, FC, useCallback, useRef, useEffect } from 'react';
import { fetchEmailSuggestions } from '@/services/emailAutocompleteService';
import debounce from 'lodash.debounce';


interface EmailModalProps {
    input: string;
    setInput: (input: string) => void;
    allEmails: string[] | null;
    alreadyAddedEmails?: string[];
    addMultipleUsers?: boolean;
}


export const EmailsAutoComplete: FC<EmailModalProps> = ({ input, setInput, allEmails, alreadyAddedEmails=[], addMultipleUsers=true}) => {
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const suggestionRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (suggestionRef.current && !suggestionRef.current.contains(event.target as Node)) {
                setSuggestions([]); 
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);



    const handleSuggestionClick = (suggestion: string) => {
        setSuggestions(suggestions.filter((email) => email !== suggestion))


        if (addMultipleUsers) {
            const parts = input.split(',');
            parts.pop(); 
            const newInput = parts.join(',') + (parts.length ? ', ' : '') + suggestion + ', '; 
             if (inputRef.current) {
                inputRef.current.focus(); 
                const length = newInput.length;
                inputRef.current.setSelectionRange(length, length); 
            }
            setInput(newInput);
        } else {
            setInput(suggestion);
        }
        setSuggestions([]); 
    };

    const debouncedFetchSuggestions = useCallback(
        debounce(async (emailPrefix: string, curInput: string) => {
            const suggestionData = await fetchEmailSuggestions(emailPrefix);
            let newSuggestions = (suggestionData && suggestionData.emails) ? suggestionData.emails : [];
            newSuggestions = newSuggestions.filter((suggestion: string) => !curInput.includes(suggestion) && !alreadyAddedEmails.includes(suggestion));
            setSuggestions(newSuggestions);  
        }, 100),
        []
    );

    const emailSuggestions = (emailPrefix: string, curInput: string) => {
        if (!allEmails) return;
        const suggestions = allEmails.filter(email => email.startsWith(emailPrefix) && !curInput.includes(email) && !alreadyAddedEmails.includes(email));
        setSuggestions(suggestions);  
    }

    const calculateHeight = (rows: number) => rows <= 2 ? rows * 30 : 60;


        return ( <>
                                <input ref={inputRef}
                                    className="w-full rounded-lg border-2 border-[#0dcfda] px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-2 border-[#0dcfda] dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                    type="text"
                                    value={input}
                                    onChange={async (e) => {
                                            setInput(e.target.value)
                                        }}

                                    onKeyUp={async (e: React.KeyboardEvent<HTMLInputElement>) => {
                                        const value = e.currentTarget.value;
                                        setInput(value);
                                        const lastQuery = value.split(',').pop();
                                        
                                        if (lastQuery && lastQuery.length > 0 && lastQuery.trim().length > 0) {
                                            if (allEmails) {
                                                emailSuggestions(lastQuery.trim(), input);
                                            } else {
                                              await debouncedFetchSuggestions(lastQuery.trim(), input);
                                            }  
                                        } else {
                                            setSuggestions([]);
                                        }
                                    }}
                                    placeholder={`Enter email address${addMultipleUsers ? 'es separated by commas' : ""}`}
                                    autoFocus
                                />
                                {suggestions.length > 0 && (
                                    <div ref={suggestionRef}  
                                    className="sm:w-full sm:max-w-[440px] z-50 border border-neutral-300 rounded overflow-y-auto bg-white dark:border-neutral-600 bg-neutral-100 dark:bg-[#202123]"
                                    style={{ height: `${calculateHeight(suggestions.length)}px` , top: '100%' }}>
                                        <ul className="suggestions-list">
                                        {suggestions.map((suggestion, index) => (
                                            <li key={index} onClick={() => handleSuggestionClick(suggestion)}
                                            className="cursor-pointer p-1 border-b border-neutral-300 dark:border-b-neutral-600 hover:bg-neutral-200 dark:hover:bg-[#343541]/90">

                                                {suggestion}
                                            </li>
                                        ))}
                                        </ul>
                                </div> 
                                )}


        </> )
}