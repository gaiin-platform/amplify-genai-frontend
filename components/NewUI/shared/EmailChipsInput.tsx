/**
 * EmailChipsInput — the New UI recipient/member picker: chips + Amplify-user
 * autocomplete.
 *
 * This is `GroupMemberInput`, lifted verbatim out of
 * `views/NewUIAssistantCreationModal.tsx` (where it was private) so the three
 * places that pick people from the user pool share one copy:
 *   - Assistant → "I manage it, others use it" → Specific people → Who has access
 *   - Assistant → Team → Create new group → Add members (optional)
 *   - Chat → Share → Share with
 *
 * Markup, chip styling, dropdown and Enter/Backspace behaviour are unchanged
 * from the original, so the two assistant call sites look and behave exactly as
 * before. What is new is optional and off by default:
 *   - `inputValue`/`onInputChange` make the typed text controlled, so a host can
 *     confirm a typed-but-unchipped address on submit (the share modal's
 *     "Share →" does this).
 *   - `onError` + `invalid` surface duplicate/malformed addresses.
 *   - `allEmails` may be omitted, in which case the pool comes from
 *     `state.amplifyUsers` directly.
 *   - Pasting a comma/semicolon/whitespace separated list adds every address.
 *
 * Escape: closes only the dropdown. The listener is capture-phase on `document`
 * and calls `stopImmediatePropagation()` (guide §14) — without that, Escape with
 * the dropdown open also reached `CreationModalShell`/`NewUIShareModal` and threw
 * away the half-filled form.
 *
 * Suggestion ranking, pool filtering and the username reverse-lookup live in the
 * React-free `emailSuggestions.ts`.
 *
 * Location: components/NewUI/shared/EmailChipsInput.tsx
 */

import React, {
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import ReactDOM from 'react-dom';
import { IconX } from '@tabler/icons-react';
import HomeContext from '@/pages/api/home/home.context';
import {
    buildEmailPool,
    looksLikeEmail,
    normalizeEmailPool,
    rankEmailSuggestions,
    splitEmailList,
} from './emailSuggestions';

export interface EmailChipsInputProps {
    /** Confirmed addresses. */
    selected: string[];
    onChange: (emails: string[]) => void;
    /**
     * Suggestion pool. Omit to use every address in `state.amplifyUsers`.
     * (Existing call sites pass `Object.values(amplifyUsers)`.)
     */
    allEmails?: string[];
    /** Never suggest the signed-in user. */
    currentUserEmail?: string;
    /** Further addresses/usernames to keep out of the dropdown. */
    excludeEmails?: string[];
    /** Controlled typed text. Omit to let the field own it. */
    inputValue?: string;
    onInputChange?: (next: string) => void;
    /** Duplicate / malformed-address messages. */
    onError?: (message: string) => void;
    /** Draws the error border. */
    invalid?: boolean;
    disabled?: boolean;
    placeholder?: string;
    /** Placeholder once at least one chip exists. */
    placeholderWithSelection?: string;
    /** 12 in the assistant modal's compact panels; 13 elsewhere. */
    fontSize?: number;
    inputRef?: React.RefObject<HTMLInputElement>;
    inputId?: string;
    ariaLabel?: string;
}

const fieldStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    borderRadius: 8,
    border: '1px solid var(--border-subtle)',
    background: 'var(--bg-app)',
    color: 'var(--text-primary)',
    padding: '7px 10px',
    fontSize: 13,
    fontFamily: 'Inter, ui-sans-serif, sans-serif',
    outline: 'none',
};

export const EmailChipsInput: React.FC<EmailChipsInputProps> = ({
    selected,
    onChange,
    allEmails,
    currentUserEmail,
    excludeEmails = [],
    inputValue,
    onInputChange,
    onError,
    invalid = false,
    disabled = false,
    placeholder = 'Search or type an email…',
    placeholderWithSelection = 'Add more members…',
    fontSize = 13,
    inputRef,
    inputId,
    ariaLabel = 'Email addresses',
}) => {
    const {
        state: { amplifyUsers },
    } = useContext(HomeContext);

    // Input is controlled when the host passes `inputValue`, else self-owned.
    const [ownInput, setOwnInput] = useState('');
    const input = inputValue !== undefined ? inputValue : ownInput;
    const setInput = useCallback(
        (next: string) => {
            if (onInputChange) onInputChange(next);
            if (inputValue === undefined) setOwnInput(next);
        },
        [inputValue, onInputChange],
    );

    const [showSuggestions, setShowSuggestions] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [dropdownPos, setDropdownPos] = useState<{
        top: number;
        left: number;
        width: number;
    } | null>(null);

    const ownFieldRef = useRef<HTMLInputElement>(null);
    const fieldRef = inputRef ?? ownFieldRef;
    const listRef = useRef<HTMLDivElement>(null);

    const listboxId = `${inputId ?? 'email-chips'}-listbox`;

    // ── Pool ───────────────────────────────────────────────────────────────
    const exclude = useMemo(
        () => [...selected, ...excludeEmails, currentUserEmail ?? ''].filter(Boolean),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [selected, excludeEmails.join('|'), currentUserEmail],
    );

    const available = useMemo(
        () =>
            allEmails
                ? normalizeEmailPool(allEmails, exclude)
                : buildEmailPool(amplifyUsers, exclude),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [allEmails?.join('|'), amplifyUsers, exclude],
    );

    const suggestions = useMemo(
        () => rankEmailSuggestions(available, input),
        [available, input],
    );

    const isOpen = showSuggestions && suggestions.length > 0;

    useEffect(() => {
        setActiveIndex((i) => (i >= suggestions.length ? -1 : i));
    }, [suggestions.length]);

    // ── Members ────────────────────────────────────────────────────────────
    const alreadyHas = useCallback(
        (candidate: string) =>
            selected.some((e) => e.toLowerCase() === candidate.toLowerCase()),
        [selected],
    );

    const addMember = useCallback(
        (email: string) => {
            const trimmed = email.trim();
            if (trimmed && !alreadyHas(trimmed)) onChange([...selected, trimmed]);
            setInput('');
            setShowSuggestions(false);
            setActiveIndex(-1);
            fieldRef.current?.focus();
        },
        [alreadyHas, fieldRef, onChange, selected, setInput],
    );

    /** Confirm typed text — reports why it was rejected, unlike addMember. */
    const commitTyped = useCallback(
        (raw: string) => {
            const candidate = raw.trim().replace(/,/g, '');
            if (!candidate) return;
            if (!looksLikeEmail(candidate)) {
                onError?.('Please enter a valid email address');
                return;
            }
            if (alreadyHas(candidate)) {
                onError?.('This email has already been added');
                setInput('');
                return;
            }
            addMember(candidate);
        },
        [addMember, alreadyHas, onError, setInput],
    );

    const removeMember = (email: string) => {
        onChange(selected.filter((e) => e !== email));
    };

    // ── Dropdown position (fixed, so overflow:hidden ancestors don't clip) ──
    const updateDropdownPos = useCallback(() => {
        if (fieldRef.current) {
            const rect = fieldRef.current.getBoundingClientRect();
            setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
        }
    }, [fieldRef]);

    // Reposition while an ancestor scrolls (modal bodies scroll).
    useEffect(() => {
        if (!isOpen) return;
        const handler = () => updateDropdownPos();
        window.addEventListener('scroll', handler, true);
        window.addEventListener('resize', handler);
        return () => {
            window.removeEventListener('scroll', handler, true);
            window.removeEventListener('resize', handler);
        };
    }, [isOpen, updateDropdownPos]);

    // ── Close on outside click ─────────────────────────────────────────────
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (
                !fieldRef.current?.contains(e.target as Node) &&
                !listRef.current?.contains(e.target as Node)
            ) {
                setShowSuggestions(false);
                setActiveIndex(-1);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [fieldRef]);

    // ── Escape closes only the dropdown (guide §14) ────────────────────────
    // Registered on mount, not on open: capture-phase listeners on the same node
    // fire in registration order, and the host modal registers its own Escape
    // handler in *its* mount effect — which runs after a child's. Registering
    // lazily would put this second, by which time the modal has already closed.
    const isOpenRef = useRef(false);
    isOpenRef.current = isOpen;

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key !== 'Escape' || !isOpenRef.current) return;
            e.preventDefault();
            e.stopImmediatePropagation();
            setShowSuggestions(false);
            setActiveIndex(-1);
        };
        document.addEventListener('keydown', handler, true);
        return () => document.removeEventListener('keydown', handler, true);
    }, []);

    // ── Render ─────────────────────────────────────────────────────────────
    return (
        <div style={{ position: 'relative', opacity: disabled ? 0.6 : 1 }}>
            {/* Selected member chips */}
            {selected.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                    {selected.map((email) => (
                        <span
                            key={email}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '2px 6px 2px 8px',
                                borderRadius: 20,
                                background:
                                    'color-mix(in srgb, var(--accent) 12%, var(--bg-raised))',
                                border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)',
                                fontSize: 12,
                                color: 'var(--text-primary)',
                                maxWidth: 220,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }}
                            title={email}
                        >
                            {email}
                            <button
                                type="button"
                                onClick={() => removeMember(email)}
                                aria-label={`Remove ${email}`}
                                disabled={disabled}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    background: 'none',
                                    border: 'none',
                                    cursor: disabled ? 'default' : 'pointer',
                                    padding: 0,
                                    color: 'var(--text-muted)',
                                    lineHeight: 0,
                                    flexShrink: 0,
                                }}
                            >
                                <IconX size={11} />
                            </button>
                        </span>
                    ))}
                </div>
            )}

            {/* Text input */}
            <input
                ref={fieldRef}
                id={inputId}
                type="text"
                role="combobox"
                aria-label={ariaLabel}
                aria-expanded={isOpen}
                aria-controls={listboxId}
                aria-autocomplete="list"
                aria-activedescendant={
                    isOpen && activeIndex >= 0
                        ? `${listboxId}-opt-${activeIndex}`
                        : undefined
                }
                disabled={disabled}
                value={input}
                onChange={(e) => {
                    setInput(e.target.value);
                    updateDropdownPos();
                    setShowSuggestions(true);
                    setActiveIndex(-1);
                }}
                onFocus={() => {
                    updateDropdownPos();
                    setShowSuggestions(true);
                }}
                onPaste={(e) => {
                    const parts = splitEmailList(e.clipboardData.getData('text'));
                    if (parts.length < 2) return; // single token → normal typing path
                    e.preventDefault();
                    const additions: string[] = [];
                    for (const part of parts) {
                        if (!looksLikeEmail(part)) continue;
                        if (alreadyHas(part) || additions.includes(part)) continue;
                        additions.push(part);
                    }
                    if (additions.length > 0) {
                        onChange([...selected, ...additions]);
                        setInput('');
                        setShowSuggestions(false);
                        setActiveIndex(-1);
                    }
                }}
                onKeyDown={(e) => {
                    if (isOpen && e.key === 'ArrowDown') {
                        e.preventDefault();
                        setActiveIndex((i) => (i + 1 >= suggestions.length ? 0 : i + 1));
                        return;
                    }
                    if (isOpen && e.key === 'ArrowUp') {
                        e.preventDefault();
                        setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
                        return;
                    }
                    if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
                        // Tab with nothing pending should still move focus on.
                        if (e.key === 'Tab' && !input.trim() && activeIndex < 0) return;
                        e.preventDefault();

                        if (isOpen && activeIndex >= 0) {
                            addMember(suggestions[activeIndex]);
                            return;
                        }
                        const exact = available.find(
                            (em) => em.toLowerCase() === input.trim().toLowerCase(),
                        );
                        if (exact) {
                            addMember(exact);
                        } else if (looksLikeEmail(input)) {
                            commitTyped(input);
                        } else if (input.trim() && suggestions.length > 0) {
                            addMember(suggestions[0]);
                        } else if (input.trim()) {
                            commitTyped(input); // reports the malformed address
                        }
                    } else if (e.key === 'Backspace' && !input && selected.length > 0) {
                        removeMember(selected[selected.length - 1]);
                    }
                }}
                placeholder={selected.length === 0 ? placeholder : placeholderWithSelection}
                autoComplete="off"
                style={{
                    ...fieldStyle,
                    fontSize,
                    border: `1px solid ${invalid ? 'var(--text-error)' : 'var(--border-subtle)'}`,
                }}
            />

            {/* Suggestions dropdown — portalled to document.body so overflow:hidden ancestors don't clip it */}
            {isOpen &&
                dropdownPos &&
                typeof document !== 'undefined' &&
                ReactDOM.createPortal(
                    <div
                        ref={listRef}
                        id={listboxId}
                        role="listbox"
                        aria-label="User suggestions"
                        style={{
                            position: 'fixed',
                            top: dropdownPos.top,
                            left: dropdownPos.left,
                            width: dropdownPos.width,
                            background: 'var(--bg-raised)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 8,
                            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                            zIndex: 10000,
                            overflow: 'hidden',
                            maxHeight: 200,
                            overflowY: 'auto',
                            fontFamily: 'Inter, ui-sans-serif, sans-serif',
                        }}
                    >
                        {suggestions.map((email, index) => (
                            <button
                                key={email}
                                id={`${listboxId}-opt-${index}`}
                                role="option"
                                aria-selected={index === activeIndex}
                                type="button"
                                tabIndex={-1}
                                onMouseDown={(e) => {
                                    e.preventDefault(); // prevent input blur before selection
                                    addMember(email);
                                }}
                                onMouseEnter={() => setActiveIndex(index)}
                                style={{
                                    display: 'block',
                                    width: '100%',
                                    textAlign: 'left',
                                    padding: '8px 12px',
                                    fontSize: 13,
                                    background:
                                        index === activeIndex ? 'var(--bg-hover)' : 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: 'var(--text-primary)',
                                    fontFamily: 'inherit',
                                }}
                            >
                                {email}
                            </button>
                        ))}
                    </div>,
                    document.body,
                )}
        </div>
    );
};

export default EmailChipsInput;
