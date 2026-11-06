/**
 * TagChipsInput — a list of removable tag chips with an "add" field.
 *
 * Type a tag (or several, comma-separated) and press Enter or comma, or click Add. Backspace on an
 * empty field removes the last chip. Duplicates (case-insensitive) and blanks are ignored.
 * Tokens only, so light and dark both work; the chips' remove buttons carry aria-labels.
 *
 * Location: components/NewUI/shared/TagChipsInput.tsx
 */

import React, { useId, useState } from 'react';
import { IconX } from '@tabler/icons-react';
import { TextControl } from './FormControls';
import { addTags, removeTag } from './tagList';

export interface TagChipsInputProps {
    tags: string[];
    onChange: (tags: string[]) => void;
    /** Accessible name for the add field. */
    ariaLabel: string;
    placeholder?: string;
    disabled?: boolean;
    maxTags?: number;
}

export const TagChipsInput: React.FC<TagChipsInputProps> = ({
    tags,
    onChange,
    ariaLabel,
    placeholder = 'Add a tag and press Enter',
    disabled = false,
    maxTags,
}) => {
    const [draft, setDraft] = useState('');
    const hintId = useId();

    const commit = () => {
        if (!draft.trim()) return;
        onChange(addTags(tags, draft, { maxTags }));
        setDraft('');
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, opacity: disabled ? 0.5 : 1 }}>
            {tags.length > 0 && (
                <ul
                    aria-label={`${ariaLabel} (added)`}
                    style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: 0, padding: 0, listStyle: 'none' }}
                >
                    {tags.map((tag) => (
                        <li
                            key={tag}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                height: 26,
                                padding: '0 4px 0 10px',
                                borderRadius: 13,
                                background: 'var(--bg-hover)',
                                border: '1px solid var(--border-subtle)',
                                fontSize: 12,
                                color: 'var(--text-primary)',
                            }}
                        >
                            <span>{tag}</span>
                            <button
                                type="button"
                                disabled={disabled}
                                aria-label={`Remove ${tag}`}
                                onClick={() => onChange(removeTag(tags, tag))}
                                className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]"
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: 18,
                                    height: 18,
                                    borderRadius: 9,
                                    border: 'none',
                                    background: 'transparent',
                                    color: 'var(--text-muted)',
                                    cursor: disabled ? 'not-allowed' : 'pointer',
                                }}
                            >
                                <IconX size={12} aria-hidden="true" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
                <TextControl
                    value={draft}
                    disabled={disabled}
                    aria-label={ariaLabel}
                    aria-describedby={hintId}
                    placeholder={placeholder}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                        // Enter while an IME is composing confirms a candidate; it must not add the tag.
                        if (e.nativeEvent.isComposing) return;
                        if (e.key === 'Enter' || e.key === ',') {
                            e.preventDefault();
                            commit();
                        } else if (e.key === 'Backspace' && !draft && tags.length > 0) {
                            onChange(tags.slice(0, -1));
                        }
                    }}
                />
                <button
                    type="button"
                    disabled={disabled || !draft.trim()}
                    onClick={commit}
                    className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent] disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                        flexShrink: 0,
                        height: 36,
                        padding: '0 14px',
                        borderRadius: 8,
                        border: '1px solid var(--border-subtle)',
                        background: 'var(--bg-raised)',
                        color: 'var(--text-primary)',
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: 'pointer',
                    }}
                >
                    Add
                </button>
            </div>
            <span id={hintId} style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Separate several with commas. Backspace removes the last one.
            </span>
        </div>
    );
};
