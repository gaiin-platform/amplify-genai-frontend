/**
 * SearchInput — the new UI's toolbar search field.
 *
 * Lifted out of `views/NewAssistantsView`, where it existed verbatim as a local
 * component, and duplicated character-for-character in
 * `views/NewScheduledTasksView` and `settings/PromptTemplatesSection`.
 *
 * Deliberately does NOT try to cover every search box in the new UI. The fields in
 * `ChatsListView`, `NewLibraryView`, `DataSourceLibraryPicker`, `DriveFileBrowser`
 * and `AttachMenu` each diverge for a reason — different heights, external refs,
 * prefix-match copy, menu semantics — and folding them in here would mean a prop
 * for each divergence. This is the 34px toolbar field, plus `fullWidth` for use
 * inside a card.
 */

import React from 'react';
import { IconSearch, IconX } from '@tabler/icons-react';

export interface SearchInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    /** Stretch to the container instead of the 200px toolbar width. */
    fullWidth?: boolean;
    /**
     * Accessible name. The field has no visible <label>, so without this a screen
     * reader announces only "search" from the placeholder, which is not reliable
     * (WCAG 2.1 SC 4.1.2).
     */
    'aria-label'?: string;
    /** Show a clear button once there is text. */
    onClear?: () => void;
    id?: string;
    disabled?: boolean;
    autoFocus?: boolean;
}

export const SearchInput: React.FC<SearchInputProps> = ({
    value,
    onChange,
    placeholder = 'Search…',
    fullWidth = false,
    'aria-label': ariaLabel,
    onClear,
    id,
    disabled = false,
    autoFocus = false,
}) => {
    const showClear = Boolean(onClear) && value.length > 0;

    return (
        <div className="relative" style={fullWidth ? { width: '100%' } : undefined}>
            <IconSearch
                size={15}
                aria-hidden="true"
                className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: 'var(--text-muted)' }}
            />
            <input
                id={id}
                type="text"
                role="searchbox"
                value={value}
                disabled={disabled}
                autoFocus={autoFocus}
                aria-label={ariaLabel ?? placeholder}
                onChange={(event) => onChange(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key === 'Escape' && onClear && value) {
                        // Clear rather than letting Escape bubble to a host modal
                        // and close the whole form (guide §14).
                        event.stopPropagation();
                        onClear();
                    }
                }}
                placeholder={placeholder}
                className={`h-[34px] pl-9 rounded-[8px] text-[13px] border focus:outline-none transition-colors ${
                    fullWidth ? 'w-full' : 'w-[200px]'
                } ${showClear ? 'pr-9' : 'pr-3'}`}
                style={{
                    backgroundColor: 'var(--bg-raised)',
                    borderColor: 'var(--border-subtle)',
                    color: 'var(--text-primary)',
                    opacity: disabled ? 0.5 : 1,
                }}
            />
            {showClear && (
                <button
                    type="button"
                    aria-label="Clear search"
                    onClick={onClear}
                    className="absolute right-2 top-1/2 -translate-y-1/2 grid place-items-center rounded transition-colors"
                    style={{ width: 20, height: 20, color: 'var(--text-muted)', border: 'none', background: 'transparent', cursor: 'pointer' }}
                    onMouseEnter={(event) => { event.currentTarget.style.color = 'var(--text-primary)'; }}
                    onMouseLeave={(event) => { event.currentTarget.style.color = 'var(--text-muted)'; }}
                >
                    <IconX size={13} />
                </button>
            )}
        </div>
    );
};

export default SearchInput;
