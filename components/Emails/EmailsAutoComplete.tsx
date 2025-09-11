import React, { useState, FC, useRef, useEffect } from 'react';


interface EmailModalProps {
    input: string;
    setInput: (input: string) => void;
    allEmails: string[] | null;
    alreadyAddedEmails?: string[];
    addMultipleUsers?: boolean;
    onEnterPressed?: () => void;
    onBlur?: () => void;
    onPaste?: (pastedText: string) => boolean;
    onSuggestionSelected?: (suggestion: string) => void;
    validationState?: 'valid' | 'invalid' | 'neutral';
}


export const EmailsAutoComplete: FC<EmailModalProps> = ({ 
    input, 
    setInput, 
    allEmails, 
    alreadyAddedEmails=[], 
    addMultipleUsers=true,
    onEnterPressed,
    onBlur,
    onPaste,
    onSuggestionSelected,
    validationState = 'neutral'
}) => {
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const suggestionRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const justSelectedSuggestion = useRef(false);

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
        setSuggestions([]);
        justSelectedSuggestion.current = true;

        // Use the new direct suggestion callback if available
        if (onSuggestionSelected && addMultipleUsers) {
            // Call parent callback and clear input immediately
            onSuggestionSelected(suggestion);
            setInput('');
            
            // Focus back on input
            if (inputRef.current) {
                inputRef.current.focus();
            }
        } else {
            // Fallback to original behavior for backward compatibility
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
        }
        
        // Reset flag after a short delay
        setTimeout(() => {
            justSelectedSuggestion.current = false;
        }, 100);
    };


    const emailSuggestions = (emailPrefix: string, curInput: string) => {
        if (!allEmails) return;
        const suggestions = allEmails.filter(email => email.startsWith(emailPrefix) && !curInput.includes(email) && !alreadyAddedEmails.includes(email));
        setSuggestions(suggestions);  
    }

    const calculateHeight = (rows: number) => rows <= 2 ? rows * 30 : 60;


        // Get border color based on validation state
        const getBorderColor = () => {
            switch (validationState) {
                case 'valid': return 'border-green-500 dark:border-green-400';
                case 'invalid': return 'border-red-500 dark:border-red-400';
                default: return 'border-[#0dcfda] dark:border-[#0dcfda]';
            }
        };

        return ( <>
            <input ref={inputRef}
                className={`w-full rounded-lg border-2 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:bg-[#40414F] dark:text-neutral-100 transition-colors duration-200 ${getBorderColor()}`}
                id="emailInput"
                type="text"
                value={input}
                onChange={async (e) => {
                    const newValue = e.target.value.toLowerCase();
                    setInput(newValue);
                    
                    // Reset the suggestion selection flag when user types
                    justSelectedSuggestion.current = false;
                    
                    // Let commas stay in input - we'll process on blur
                }}

                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === 'Enter' && onEnterPressed) {
                        e.preventDefault();
                        onEnterPressed();
                    }
                }}

                onKeyUp={async (e: React.KeyboardEvent<HTMLInputElement>) => {
                    const value = e.currentTarget.value;
                    const lastQuery = value.split(',').pop();
                    
                    if (lastQuery && lastQuery.length > 0 && lastQuery.trim().length > 0) {
                        emailSuggestions(lastQuery.trim(), input);
                    } else {
                        setSuggestions([]);
                    }
                }}

                onBlur={() => {
                    // Don't process blur if we just selected a suggestion
                    if (justSelectedSuggestion.current) {
                        return;
                    }
                    
                    if (onBlur) {
                        onBlur();
                    }
                }}

                onPaste={(e) => {
                    if (onPaste) {
                        const pastedText = e.clipboardData.getData('text');
                        const shouldPreventDefault = onPaste(pastedText);
                        if (shouldPreventDefault) {
                            e.preventDefault();
                        }
                    }
                }}

                placeholder={`Enter usernames/emails${addMultipleUsers ? ' (separate with commas, Enter/blur to add)' : ""}`}
                autoFocus
            />
            {suggestions.length > 0 && (
                <div ref={suggestionRef}  
                className="sm:w-full sm:max-w-[440px] absolute z-50 border border-neutral-300 rounded overflow-y-auto bg-white dark:border-neutral-600 bg-neutral-100 dark:bg-[#202123]"
                style={{ height: `${calculateHeight(suggestions.length)}px`}}>
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