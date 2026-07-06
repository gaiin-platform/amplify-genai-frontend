import { FC, useState, useCallback, useContext } from "react";
import { EmailsAutoComplete } from "./EmailsAutoComplete";
import { IconPlus, IconX, IconCheck } from "@tabler/icons-react";
import HomeContext from "@/pages/api/home/home.context";

interface AddEmailsProps {
    id: String;
    emails: string[];
    allEmails: string[]
    handleUpdateEmails: (e: Array<string>) => void;
    displayEmails?: boolean;
    disableEdit?: boolean;
}

// UUID pattern — never display raw UUIDs
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isRawUUID = (s: string) => UUID_PATTERN.test(s.trim());

// Get initials from an email or display name
const getInitials = (nameOrEmail: string): string => {
    const s = nameOrEmail.trim();
    if (s.includes('@')) {
        const local = s.split('@')[0];
        return local.slice(0, 2).toUpperCase();
    }
    const parts = s.split(/[\s._-]+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return s.slice(0, 2).toUpperCase();
};

// Deterministic color from string
const avatarColor = (s: string): string => {
    let hash = 0;
    for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash);
    const colors = [
        'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-rose-500',
        'bg-amber-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-pink-500',
    ];
    return colors[Math.abs(hash) % colors.length];
};

export const AddEmailWithAutoComplete: FC<AddEmailsProps> = ({
    id,
    emails,
    allEmails,
    handleUpdateEmails,
    displayEmails = false,
    disableEdit = false
}) => {
    const { state: { amplifyUsers }, dispatch: homeDispatch } = useContext(HomeContext);
    const [input, setInput] = useState<string>('');

    // Resolve a human-readable label for a stored value (username/uuid → email display)
    const resolveDisplayEmail = (value: string): string => {
        if (!amplifyUsers) return value;
        // If value is a UUID or plain username key, map it to the email
        if (amplifyUsers[value] && !isRawUUID(amplifyUsers[value])) {
            return amplifyUsers[value];
        }
        // If value is already an email, return as-is
        return value;
    };

    // Flexible validation for usernames/systemIds/emails
    const isValidEntry = (entry: string): boolean => {
        const trimmed = entry.trim();
        const isEmail = /^\S+@\S+\.\S+$/.test(trimmed);
        const isSystemId = /^[a-zA-Z0-9-]+-\d{6}$/.test(trimmed);
        const isValidUsername = trimmed.length >= 2 && !trimmed.includes(' ');
        return isEmail || isSystemId || isValidUsername;
    };

    // Get validation state for current input
    const getValidationState = (currentInput: string): 'valid' | 'invalid' | 'neutral' => {
        const trimmed = currentInput.trim();
        if (!trimmed) return 'neutral';

        if (trimmed.includes(',')) {
            const parts = trimmed.split(',').map(p => p.trim()).filter(p => p);
            if (parts.some(part => isValidEntry(part) && !emails.some(e => e.toLowerCase() === part.toLowerCase()))) return 'valid';
        }

        if (emails.some(e => e.toLowerCase() === trimmed.toLowerCase())) return 'invalid';
        return isValidEntry(trimmed) ? 'valid' : 'invalid';
    };

    // Process and add entries from input
    const processEntries = useCallback((inputValue: string, clearInput: boolean = true) => {
        const entries = inputValue.split(',')
            .map(entry => entry.trim())
            .filter(entry => entry);

        const validEntries = entries.filter(entry =>
            isValidEntry(entry) && !emails.some(e => e.toLowerCase() === entry.toLowerCase())
        );

        if (validEntries.length > 0) {
            handleUpdateEmails([...emails, ...validEntries]);
        }

        if (clearInput) setInput('');
    }, [emails, handleUpdateEmails]);

    const handleAddEmails = () => processEntries(input, true);

    const handleEnterAdd = useCallback(() => {
        processEntries(input, true);
    }, [input, processEntries]);

    const handleBlurAdd = useCallback(() => {
        const trimmed = input.trim();
        if (!trimmed) return;

        const trimmedLower = trimmed.toLowerCase();
        const isKnownUser = amplifyUsers && (
            Object.keys(amplifyUsers).some(key => key.toLowerCase() === trimmedLower) ||
            Object.values(amplifyUsers).some(val => val.toLowerCase() === trimmedLower)
        );

        if (isKnownUser && !emails.some(e => e.toLowerCase() === trimmedLower)) {
            processEntries(trimmed, true);
        }
    }, [input, processEntries, amplifyUsers, emails]);

    const handlePaste = useCallback((pastedText: string) => {
        if (pastedText.includes(',') || pastedText.includes(';') || pastedText.includes('\n')) {
            const entries = pastedText
                .replace(/[;\n]/g, ',')
                .split(',')
                .map(entry => entry.trim())
                .filter(entry => entry);

            const validEntries = entries.filter(entry =>
                isValidEntry(entry) && !emails.includes(entry)
            );

            if (validEntries.length > 0) {
                handleUpdateEmails([...emails, ...validEntries]);
                setInput('');
                return true;
            }
        }
        return false;
    }, [emails, handleUpdateEmails]);

    const validationState = getValidationState(input);

    return (
        <>
            {!disableEdit && (
                <div className="flex flex-col gap-2" key={JSON.stringify(id)}>
                    {/* Selected user pills */}
                    {displayEmails && emails.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {emails.map((user, index) => {
                                const displayEmail = resolveDisplayEmail(user);
                                // Skip rendering pills for raw UUIDs with no mapping
                                if (isRawUUID(displayEmail)) return null;
                                const initials = getInitials(displayEmail);
                                const color = avatarColor(displayEmail);
                                return (
                                    <span
                                        key={index}
                                        className="inline-flex items-center gap-1.5 pl-1 pr-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 text-sm text-blue-800 dark:text-blue-200 max-w-[260px]"
                                    >
                                        {/* Avatar */}
                                        <span className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-white text-[10px] font-semibold ${color}`}>
                                            {initials}
                                        </span>
                                        <span className="truncate text-xs font-medium" title={displayEmail}>
                                            {displayEmail}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => handleUpdateEmails(emails.filter((u: string) => u !== user))}
                                            className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-blue-400 hover:text-white hover:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
                                            title={`Remove ${displayEmail}`}
                                        >
                                            <IconX size={10} />
                                        </button>
                                    </span>
                                );
                            })}
                        </div>
                    )}

                    {/* Input row */}
                    <div className="flex flex-row gap-2">
                        <div className="w-full relative">
                            <EmailsAutoComplete
                                input={input}
                                setInput={setInput}
                                allEmails={allEmails.filter((e: string) => !emails.includes(e))}
                                alreadyAddedEmails={emails}
                                onEnterPressed={handleEnterAdd}
                                onBlur={handleBlurAdd}
                                onPaste={handlePaste}
                                onSuggestionSelected={(suggestion: string) => {
                                    if (!emails.includes(suggestion)) {
                                        handleUpdateEmails([...emails, suggestion]);
                                    }
                                    setInput('');
                                }}
                                validationState={validationState}
                            />
                        </div>

                        {/* Validation indicator */}
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

                        {/* Add button */}
                        <div className="flex-shrink-0 ml-[-6px]">
                            <button
                                type="button"
                                title="Add Users (auto-adds on Enter or blur)"
                                id="addUserButton"
                                className="ml-2 mt-0.5 p-2 rounded-md border border-gray-300 dark:border-white/20 transition-colors duration-200 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={handleAddEmails}
                                disabled={!input.trim() || validationState === 'invalid'}
                            >
                                <IconPlus size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Read-only pill display when editing is disabled */}
            {disableEdit && displayEmails && emails.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                    {emails.map((user, index) => {
                        const displayEmail = resolveDisplayEmail(user);
                        if (isRawUUID(displayEmail)) return null;
                        const initials = getInitials(displayEmail);
                        const color = avatarColor(displayEmail);
                        return (
                            <span
                                key={index}
                                className="inline-flex items-center gap-1.5 pl-1 pr-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300 max-w-[260px]"
                            >
                                <span className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-white text-[10px] font-semibold ${color}`}>
                                    {initials}
                                </span>
                                <span className="truncate text-xs font-medium" title={displayEmail}>
                                    {displayEmail}
                                </span>
                            </span>
                        );
                    })}
                </div>
            )}
        </>
    );
};
