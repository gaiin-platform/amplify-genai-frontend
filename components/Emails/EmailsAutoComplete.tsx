import React, { useState, FC, useRef, useEffect, useContext } from 'react';
import HomeContext from '@/pages/api/home/home.context';

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

// UUID pattern — never display these raw to users
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isRawUUID = (s: string) => UUID_PATTERN.test(s.trim());

// Get initials from an email or display name
const getInitials = (nameOrEmail: string): string => {
    const s = nameOrEmail.trim();
    if (s.includes('@')) {
        // Use first two chars of the local part
        const local = s.split('@')[0];
        return local.slice(0, 2).toUpperCase();
    }
    const parts = s.split(/[\s._-]+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return s.slice(0, 2).toUpperCase();
};

// Deterministic pastel color from string
const avatarColor = (s: string): string => {
    let hash = 0;
    for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash);
    const colors = [
        'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-rose-500',
        'bg-amber-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-pink-500',
    ];
    return colors[Math.abs(hash) % colors.length];
};


export const EmailsAutoComplete: FC<EmailModalProps> = ({
    input,
    setInput,
    allEmails,
    alreadyAddedEmails = [],
    addMultipleUsers = true,
    onEnterPressed,
    onBlur,
    onPaste,
    onSuggestionSelected,
    validationState = 'neutral'
}) => {
    const { state: { amplifyUsers } } = useContext(HomeContext);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [activeIndex, setActiveIndex] = useState<number>(-1);
    const suggestionRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (suggestionRef.current && !suggestionRef.current.contains(event.target as Node)) {
                setSuggestions([]);
                setActiveIndex(-1);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSuggestionClick = (suggestion: string) => {
        setSuggestions([]);
        setActiveIndex(-1);

        if (onSuggestionSelected && addMultipleUsers) {
            onSuggestionSelected(suggestion);
            setInput('');
            inputRef.current?.focus();
        } else {
            if (addMultipleUsers) {
                const parts = input.split(',');
                parts.pop();
                const newInput = parts.join(',') + (parts.length ? ', ' : '') + suggestion + ', ';
                setInput(newInput);
                if (inputRef.current) {
                    inputRef.current.focus();
                    inputRef.current.setSelectionRange(newInput.length, newInput.length);
                }
            } else {
                setInput(suggestion);
            }
        }
    };

    const emailSuggestions = (emailPrefix: string, curInput: string) => {
        if (!allEmails) return;
        const prefixLower = emailPrefix.toLowerCase();
        const curLower = curInput.toLowerCase();
        const alreadyLower = alreadyAddedEmails.map(e => e.toLowerCase());

        const filtered = allEmails.filter(email => {
            // Never surface raw UUIDs in the dropdown
            if (isRawUUID(email)) return false;
            const emailLower = email.toLowerCase();
            return emailLower.startsWith(prefixLower) &&
                !curLower.includes(emailLower) &&
                !alreadyLower.includes(emailLower);
        });
        setSuggestions(filtered);
        setActiveIndex(-1);
    };

    const getBorderColor = () => {
        switch (validationState) {
            case 'valid': return 'border-green-400 dark:border-green-500 ring-1 ring-green-200 dark:ring-green-900/40';
            case 'invalid': return 'border-red-400 dark:border-red-500 ring-1 ring-red-200 dark:ring-red-900/40';
            default: return 'border-gray-300 dark:border-gray-600 focus-within:border-blue-400 dark:focus-within:border-blue-500';
        }
    };

    // Resolve a display label for a suggestion value
    // allEmails contains email addresses (Object.values(amplifyUsers))
    // We want to show: "Display Name\nemail" if a display name exists
    const getDisplayName = (email: string): string | null => {
        if (!amplifyUsers) return null;
        // amplifyUsers = { username/uuid: emailAddress }
        // email here IS the email address (value), find a matching username key
        const entry = Object.entries(amplifyUsers).find(([, v]) => v === email);
        if (!entry) return null;
        const key = entry[0];
        // If the key is a UUID, there's no useful display name
        if (isRawUUID(key)) return null;
        // If key looks like an email itself (some setups), skip
        if (key.includes('@')) return null;
        return key;
    };

    return (
        <>
            <input
                ref={inputRef}
                className={`w-full rounded-lg border px-3 py-2 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none transition-all duration-150 ${getBorderColor()}`}
                id="emailInput"
                type="text"
                value={input}
                placeholder={addMultipleUsers ? 'Add people by email…' : 'Search by email…'}
                autoFocus
                onChange={(e) => {
                    setInput(e.target.value.toLowerCase());
                }}
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                    if (suggestions.length > 0) {
                        if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            setActiveIndex(i => Math.min(i + 1, suggestions.length - 1));
                            return;
                        }
                        if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            setActiveIndex(i => Math.max(i - 1, 0));
                            return;
                        }
                        if (e.key === 'Enter' && activeIndex >= 0) {
                            e.preventDefault();
                            handleSuggestionClick(suggestions[activeIndex]);
                            return;
                        }
                        if (e.key === 'Escape') {
                            setSuggestions([]);
                            setActiveIndex(-1);
                            return;
                        }
                    }
                    if (e.key === 'Enter' && onEnterPressed) {
                        e.preventDefault();
                        onEnterPressed();
                    }
                }}
                onKeyUp={(e: React.KeyboardEvent<HTMLInputElement>) => {
                    const value = e.currentTarget.value;
                    const lastQuery = value.split(',').pop();
                    if (lastQuery && lastQuery.trim().length > 0) {
                        emailSuggestions(lastQuery.trim(), input);
                    } else {
                        setSuggestions([]);
                    }
                }}
                onBlur={() => {
                    if (onBlur) onBlur();
                }}
                onPaste={(e) => {
                    if (onPaste) {
                        const pastedText = e.clipboardData.getData('text');
                        const shouldPreventDefault = onPaste(pastedText);
                        if (shouldPreventDefault) e.preventDefault();
                    }
                }}
            />

            {suggestions.length > 0 && (
                <div
                    ref={suggestionRef}
                    className="absolute left-0 right-0 z-[9999] mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg overflow-hidden"
                    style={{ maxHeight: '220px', overflowY: 'auto' }}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    {suggestions.map((suggestion, index) => {
                        const displayName = getDisplayName(suggestion);
                        const initials = getInitials(displayName || suggestion);
                        const color = avatarColor(suggestion);
                        const isActive = index === activeIndex;

                        return (
                            <div
                                key={index}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleSuggestionClick(suggestion);
                                }}
                                onMouseEnter={() => setActiveIndex(index)}
                                className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors duration-100 ${
                                    isActive
                                        ? 'bg-blue-50 dark:bg-blue-900/30'
                                        : 'hover:bg-gray-50 dark:hover:bg-gray-700/60'
                                }`}
                            >
                                {/* Avatar circle */}
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-semibold ${color}`}>
                                    {initials}
                                </div>

                                {/* Name + email */}
                                <div className="flex flex-col min-w-0">
                                    {displayName && (
                                        <span className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                                            {displayName}
                                        </span>
                                    )}
                                    <span className={`truncate ${displayName ? 'text-xs text-gray-500 dark:text-gray-400' : 'text-sm text-gray-800 dark:text-gray-100 font-medium'}`}>
                                        {suggestion}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </>
    );
};
