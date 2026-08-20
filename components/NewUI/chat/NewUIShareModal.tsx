/**
 * NewUIShareModal — send-side share modal for the new UI.
 *
 * Triggered by: ConversationHeader "Share" button, ConversationRow "Share" menu item.
 *
 * UX:
 *   1. Recipient email chips — Enter/comma/Tab confirms an address into a pill;
 *      Backspace removes the last chip; × removes a specific chip.
 *   2. Optional personal message, max 500 chars with char counter.
 *   3. "Share →" calls shareItems() from shareService.
 *   4. Success: replaces form body with centered ✓ + "Conversation shared", auto-closes 1.5 s.
 *   5. Error: inline error banner below the form (modal stays open).
 *
 * Dimensions: maxWidth 600 px, height min(480 px, 90dvh) — narrower than creation modals.
 * Chrome: position:fixed overlay, focus trap, Escape closes, backdrop click closes.
 * Accessibility: role="dialog" aria-modal="true" aria-labelledby="share-modal-heading"
 * Dark mode: all colours use CSS vars from globals.css.
 * Reduced motion: the only animation is the `animate-spin` spinner, which is
 *   suppressed via `motion-reduce:animate-none`.
 *
 * Service wiring:
 *   shareItems(sharedBy, sharedWith, message, sharedData) from services/shareService.ts
 *   where sharedData = await createExport([conversation], [], [], "share", false)
 *
 * Location: components/NewUI/chat/NewUIShareModal.tsx
 */

import React, { useContext, useEffect, useRef, useState } from 'react';
import { IconX, IconLoader2, IconCheck } from '@tabler/icons-react';
import HomeContext from '@/pages/api/home/home.context';
import { shareItems } from '@/services/shareService';
import { createExport } from '@/utils/app/importExport';
import { useSession } from 'next-auth/react';
import { getUserIdentifier } from '@/utils/app/data';

// ── Focus-trap selector ───────────────────────────────────────────────────────
const FOCUSABLE_SEL = [
    'button:not([disabled])',
    'input:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(', ');

// ── Props ─────────────────────────────────────────────────────────────────────
interface NewUIShareModalProps {
    conversationId: string;
    conversationTitle?: string;
    onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
export const NewUIShareModal: React.FC<NewUIShareModalProps> = ({
    conversationId,
    conversationTitle,
    onClose,
}) => {
    const {
        state: { conversations, amplifyUsers },
    } = useContext(HomeContext);

    const { data: session } = useSession();
    const sharedBy = getUserIdentifier(session?.user) ?? 'Unknown';

    // ── Form state ──────────────────────────────────────────────────────────
    const [recipientInput, setRecipientInput] = useState('');
    const [recipients, setRecipients] = useState<string[]>([]);
    const [inputError, setInputError] = useState('');
    const [message, setMessage] = useState('');
    const [isSharing, setIsSharing] = useState(false);
    const [shareSuccess, setShareSuccess] = useState(false);
    const [shareError, setShareError] = useState('');

    const panelRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // ── Focus panel on open, then move to recipient input ─────────────────
    useEffect(() => {
        panelRef.current?.focus();
        const t = setTimeout(() => inputRef.current?.focus(), 60);
        return () => clearTimeout(t);
    }, []);

    // ── Focus trap + Escape ────────────────────────────────────────────────
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                onClose();
                return;
            }
            if (e.key === 'Tab') {
                const panel = panelRef.current;
                if (!panel) return;
                const all = Array.from(
                    panel.querySelectorAll<HTMLElement>(FOCUSABLE_SEL)
                ).filter((el) => !el.closest('[aria-hidden="true"]'));
                if (all.length === 0) return;
                const first = all[0];
                const last = all[all.length - 1];
                if (e.shiftKey) {
                    if (
                        document.activeElement === first ||
                        document.activeElement === panel
                    ) {
                        e.preventDefault();
                        last.focus();
                    }
                } else {
                    if (document.activeElement === last) {
                        e.preventDefault();
                        first.focus();
                    }
                }
            }
        };
        document.addEventListener('keydown', handleKeyDown, true);
        return () => document.removeEventListener('keydown', handleKeyDown, true);
    }, [onClose]);

    // ── Add recipient chip ─────────────────────────────────────────────────
    const addRecipient = (raw: string) => {
        const trimmed = raw.trim().replace(/,/g, '').toLowerCase();
        if (!trimmed) return;
        if (!trimmed.includes('@')) {
            setInputError('Please enter a valid email address');
            return;
        }
        if (recipients.includes(trimmed)) {
            setInputError('This email has already been added');
            setRecipientInput('');
            return;
        }
        setRecipients((prev) => [...prev, trimmed]);
        setRecipientInput('');
        setInputError('');
    };

    const removeRecipient = (email: string) => {
        setRecipients((prev) => prev.filter((r) => r !== email));
    };

    // ── Input keydown handling ─────────────────────────────────────────────
    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            addRecipient(recipientInput);
            return;
        }
        if (e.key === ',') {
            e.preventDefault();
            addRecipient(recipientInput);
            return;
        }
        if (e.key === 'Backspace' && recipientInput === '' && recipients.length > 0) {
            setRecipients((prev) => prev.slice(0, -1));
            return;
        }
        // Clear inline error on any other key
        if (inputError) setInputError('');
    };

    // ── Submit ─────────────────────────────────────────────────────────────
    const handleShare = async () => {
        // Confirm any pending typed-but-not-yet-chipped input
        const currentInput = recipientInput.trim().replace(/,/g, '').toLowerCase();
        let finalRecipients = recipients;

        if (currentInput) {
            if (!currentInput.includes('@')) {
                setInputError('Please enter a valid email address');
                return;
            }
            finalRecipients = [...recipients, currentInput];
            setRecipients(finalRecipients);
            setRecipientInput('');
            setInputError('');
        }

        if (finalRecipients.length === 0) return;

        const conversation = conversations.find((c) => c.id === conversationId);
        if (!conversation) {
            setShareError('Conversation not found. Please try again.');
            return;
        }

        setIsSharing(true);
        setShareError('');

        try {
            const sharedData = await createExport([conversation], [], [], 'share', false);

            // Convert display emails back to usernames via the amplifyUsers map
            const sharedWith = finalRecipients.map((email) => {
                const username = Object.keys(amplifyUsers).find(
                    (key) => amplifyUsers[key] === email
                );
                return username ?? email; // fall back to email if no mapping
            });

            const result = await shareItems(sharedBy, sharedWith, message, sharedData);

            if (result.success) {
                setIsSharing(false);
                setShareSuccess(true);
                setTimeout(() => onClose(), 1500);
            } else {
                setIsSharing(false);
                setShareError('Sharing failed. Please try again.');
            }
        } catch {
            setIsSharing(false);
            setShareError('An unexpected error occurred. Please try again.');
        }
    };

    // ── Derived state ──────────────────────────────────────────────────────
    // "Share →" is enabled when there's at least one confirmed chip OR the
    // input contains a valid email that would be confirmed on click.
    const canShare =
        recipients.length > 0 || recipientInput.trim().includes('@');
    const msgLen = message.length;

    // ── Styles (inline; no Tailwind class needed for new-UI layout) ────────
    const s: Record<string, React.CSSProperties> = {
        overlay: {
            position: 'fixed',
            inset: 0,
            margin: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 16px',
            fontFamily: 'Inter, ui-sans-serif, sans-serif',
        },
        panel: {
            width: '100%',
            maxWidth: 600,
            height: 'min(480px, 90dvh)',
            background: 'var(--bg-raised)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 14,
            boxShadow:
                '0 24px 80px rgba(0,0,0,0.28), 0 4px 16px rgba(0,0,0,0.12)',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            overflow: 'hidden',
            outline: 'none',
        },
        headerRow: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 24px 16px 24px',
            flexShrink: 0,
        },
        heading: {
            fontSize: 18,
            fontWeight: 700,
            margin: 0,
            color: 'var(--text-primary)',
            lineHeight: '1.2',
        },
        closeBtn: {
            flexShrink: 0,
            width: 32,
            height: 32,
            borderRadius: 8,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-secondary)',
            transition: 'background 120ms ease, color 120ms ease',
            fontFamily: 'inherit',
        },
        scrollBody: {
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: '4px 24px 24px',
        },
        footer: {
            flexShrink: 0,
            padding: '12px 24px 20px',
            display: 'flex',
            gap: 8,
            justifyContent: 'flex-end',
            borderTop: '1px solid var(--border-subtle)',
        },
        label: {
            display: 'block',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text-secondary)',
            marginBottom: 6,
            letterSpacing: '0.05em',
            textTransform: 'uppercase' as const,
        },
    };

    // ── Render ─────────────────────────────────────────────────────────────
    return (
        <div style={s.overlay} onClick={onClose} aria-label="Dialog backdrop">
            {/* Panel — stops backdrop click */}
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="share-modal-heading"
                tabIndex={-1}
                onClick={(e) => e.stopPropagation()}
                style={s.panel}
            >
                {/* ── Header row (wiki §9 rule 19) ─────────────────────── */}
                <div style={s.headerRow}>
                    <h2 id="share-modal-heading" style={s.heading}>
                        Share this conversation
                    </h2>
                    <button
                        aria-label="Close"
                        onClick={onClose}
                        style={s.closeBtn}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--bg-hover)';
                            e.currentTarget.style.color = 'var(--text-primary)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = 'var(--text-secondary)';
                        }}
                    >
                        <IconX size={20} stroke={2} />
                    </button>
                </div>

                {/* ── Scrollable body ────────────────────────────────────── */}
                <div style={s.scrollBody}>
                    {shareSuccess ? (
                        /* ── Success state ─────────────────────────── */
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                height: '100%',
                                gap: 14,
                                paddingTop: 8,
                            }}
                        >
                            <div
                                style={{
                                    width: 56,
                                    height: 56,
                                    borderRadius: '50%',
                                    background: 'var(--accent)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <IconCheck
                                    size={28}
                                    style={{ color: 'var(--accent-fg)' }}
                                />
                            </div>
                            <p
                                style={{
                                    fontSize: 16,
                                    fontWeight: 600,
                                    color: 'var(--text-primary)',
                                    margin: 0,
                                }}
                            >
                                Conversation shared
                            </p>
                        </div>
                    ) : (
                        /* ── Form ──────────────────────────────────────── */
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

                            {/* Share with */}
                            <div>
                                <label style={s.label}>Share with</label>

                                {/* Chip + input container */}
                                <div
                                    style={{
                                        minHeight: 42,
                                        padding: '6px 10px',
                                        borderRadius: 8,
                                        border: `1px solid ${inputError ? '#e05252' : 'var(--border-subtle)'}`,
                                        background: 'var(--bg-app)',
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        gap: 6,
                                        alignItems: 'center',
                                        transition: 'border-color 120ms ease',
                                        cursor: 'text',
                                    }}
                                    onClick={() => inputRef.current?.focus()}
                                >
                                    {/* Chips */}
                                    {recipients.map((email) => (
                                        <span
                                            key={email}
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: 4,
                                                padding: '3px 6px 3px 10px',
                                                borderRadius: 6,
                                                background: 'var(--bg-active)',
                                                color: 'var(--text-primary)',
                                                fontSize: 13,
                                                fontWeight: 500,
                                                flexShrink: 0,
                                            }}
                                        >
                                            {email}
                                            <button
                                                type="button"
                                                aria-label={`Remove ${email}`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    removeRecipient(email);
                                                }}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    width: 16,
                                                    height: 16,
                                                    borderRadius: 4,
                                                    border: 'none',
                                                    background: 'transparent',
                                                    cursor: 'pointer',
                                                    color: 'var(--text-muted)',
                                                    padding: 0,
                                                    fontFamily: 'inherit',
                                                    flexShrink: 0,
                                                    transition: 'color 100ms ease',
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.color =
                                                        'var(--text-primary)';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.color =
                                                        'var(--text-muted)';
                                                }}
                                            >
                                                <IconX size={11} stroke={2.5} />
                                            </button>
                                        </span>
                                    ))}

                                    {/* Text input */}
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={recipientInput}
                                        onChange={(e) => {
                                            setRecipientInput(e.target.value);
                                            if (inputError) setInputError('');
                                        }}
                                        onKeyDown={handleInputKeyDown}
                                        placeholder={
                                            recipients.length === 0
                                                ? 'Enter an email address…'
                                                : ''
                                        }
                                        style={{
                                            flex: '1 1 120px',
                                            minWidth: 120,
                                            border: 'none',
                                            background: 'transparent',
                                            outline: 'none',
                                            fontSize: 14,
                                            color: 'var(--text-primary)',
                                            fontFamily: 'inherit',
                                            padding: 0,
                                        }}
                                    />
                                </div>

                                {/* Hint / error */}
                                {inputError ? (
                                    <p
                                        style={{
                                            margin: '5px 0 0',
                                            fontSize: 12,
                                            color: '#e05252',
                                        }}
                                    >
                                        {inputError}
                                    </p>
                                ) : (
                                    <p
                                        style={{
                                            margin: '5px 0 0',
                                            fontSize: 12,
                                            color: 'var(--text-muted)',
                                        }}
                                    >
                                        Press Enter, comma, or Tab to add an address
                                    </p>
                                )}
                            </div>

                            {/* Personal message */}
                            <div>
                                <label style={s.label}>
                                    Personal message{' '}
                                    <span
                                        style={{
                                            fontWeight: 400,
                                            textTransform: 'none',
                                            letterSpacing: 0,
                                        }}
                                    >
                                        (optional)
                                    </span>
                                </label>
                                <textarea
                                    value={message}
                                    onChange={(e) =>
                                        setMessage(e.target.value.slice(0, 500))
                                    }
                                    placeholder="Add a note about what you're sharing…"
                                    rows={3}
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        borderRadius: 8,
                                        border: '1px solid var(--border-subtle)',
                                        background: 'var(--bg-app)',
                                        color: 'var(--text-primary)',
                                        fontSize: 14,
                                        fontFamily: 'inherit',
                                        lineHeight: 1.5,
                                        resize: 'none',
                                        outline: 'none',
                                        boxSizing: 'border-box',
                                        transition: 'border-color 120ms ease',
                                    }}
                                    onFocus={(e) => {
                                        e.currentTarget.style.borderColor =
                                            'var(--border-composer-active)';
                                    }}
                                    onBlur={(e) => {
                                        e.currentTarget.style.borderColor =
                                            'var(--border-subtle)';
                                    }}
                                />
                                <p
                                    style={{
                                        margin: '4px 0 0',
                                        fontSize: 12,
                                        color: 'var(--text-muted)',
                                        textAlign: 'right',
                                    }}
                                >
                                    {msgLen}/500
                                </p>
                            </div>

                            {/* Inline error banner */}
                            {shareError && (
                                <p
                                    style={{
                                        margin: 0,
                                        padding: '10px 14px',
                                        borderRadius: 8,
                                        background: 'rgba(224, 82, 82, 0.1)',
                                        color: '#e05252',
                                        fontSize: 13,
                                        border: '1px solid rgba(224, 82, 82, 0.25)',
                                    }}
                                >
                                    {shareError}
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Footer — hidden in success state ──────────────────── */}
                {!shareSuccess && (
                    <div style={s.footer}>
                        {/* Cancel */}
                        <button
                            onClick={onClose}
                            disabled={isSharing}
                            style={{
                                height: 36,
                                padding: '0 16px',
                                borderRadius: 8,
                                border: '1px solid var(--border-subtle)',
                                background: 'transparent',
                                color: 'var(--text-secondary)',
                                fontSize: 13,
                                fontWeight: 500,
                                cursor: isSharing ? 'default' : 'pointer',
                                fontFamily: 'inherit',
                                opacity: isSharing ? 0.5 : 1,
                                transition: 'background 120ms ease',
                            }}
                            onMouseEnter={(e) => {
                                if (!isSharing)
                                    e.currentTarget.style.background = 'var(--bg-hover)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                            }}
                        >
                            Cancel
                        </button>

                        {/* Share → */}
                        <button
                            onClick={canShare && !isSharing ? handleShare : undefined}
                            disabled={!canShare || isSharing}
                            aria-label="Share conversation"
                            style={{
                                height: 36,
                                padding: '0 20px',
                                borderRadius: 8,
                                border: 'none',
                                background:
                                    !canShare || isSharing
                                        ? 'var(--bg-active)'
                                        : 'var(--accent)',
                                color:
                                    !canShare || isSharing
                                        ? 'var(--text-muted)'
                                        : 'var(--accent-fg)',
                                fontSize: 13,
                                fontWeight: 500,
                                cursor: !canShare || isSharing ? 'default' : 'pointer',
                                fontFamily: 'inherit',
                                transition: 'background 120ms ease, color 120ms ease',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                minWidth: 90,
                                justifyContent: 'center',
                            }}
                        >
                            {isSharing ? (
                                <>
                                    {/* animate-spin: Tailwind class; motion-reduce:animate-none suppresses it */}
                                    <IconLoader2
                                        size={14}
                                        className="animate-spin motion-reduce:animate-none"
                                        style={{ flexShrink: 0 }}
                                    />
                                    Sharing…
                                </>
                            ) : (
                                'Share →'
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default NewUIShareModal;
