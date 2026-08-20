/**
 * CreationModalShell — reusable single-column creation modal shell.
 *
 * Shared by:
 *   - NewUIAssistantCreationModal (assistant creation)
 *   - NewUIPromptCreationModal (prompt template creation)
 *
 * Dimensions match NewSettingsModal / NewAdminModal:
 *   maxWidth: 1100px, height: min(820px, 90dvh)
 *
 * Layout (wiki §9 rule 19 — close button lives in a header row, never inside
 * the scroll container):
 *
 *   overlay (fixed inset-0, z-9999, --bg-overlay at 0.5 opacity, backdrop-click → onClose)
 *   └── panel (maxWidth:1100px, height:min(820px,90dvh), flex-col)
 *       ├── header row (flexShrink:0)  [title ...... ×]
 *       ├── scroll body (flex:1, minHeight:0, overflowY:auto)
 *       │   └── {children}
 *       └── footer (flexShrink:0, only when onSave is provided)  [Cancel] [Save]
 *
 * Accessibility:
 *   - role="dialog" aria-modal="true" aria-labelledby="creation-modal-title"
 *   - Focus trap (Tab / Shift-Tab cycles within focusable elements in panel)
 *   - panelRef.current?.focus() on open (tabIndex={-1} on panel)
 *   - Escape → onClose
 *
 * Entrance animation: opacity 0→1 + translateY(8px→0), 150ms ease-out.
 *   Defined in conversation-view.css under "CreationModalShell entrance animation".
 *   Skipped via prefers-reduced-motion.
 *
 * Location: components/NewUI/shared/CreationModalShell.tsx
 */

import React, { useRef, useEffect, ReactNode } from 'react';
import { IconX, IconLoader2 } from '@tabler/icons-react';

// ── Focusable selector for focus-trap ──────────────────────────────────────────
const FOCUSABLE_SEL = [
    'button:not([disabled])',
    'input:not([disabled])',
    'textarea:not([disabled])',
    'select:not([disabled])',
    'a[href]',
    '[role="button"]:not([aria-disabled="true"])',
    '[tabindex]:not([tabindex="-1"])',
].join(', ');

// ── Props ──────────────────────────────────────────────────────────────────────
export interface CreationModalShellProps {
    /** Title shown in the header row */
    title: string;
    /** Called when the modal should close (× button, backdrop, Escape) */
    onClose: () => void;
    /**
     * When provided, the footer is rendered with Cancel + Save buttons.
     * When omitted, no footer is rendered (useful if the content manages its own actions).
     */
    onSave?: () => void;
    /** Label for the primary action button. Default: "Save" */
    saveLabel?: string;
    /** Shows a spinner on the Save button instead of the label */
    isSaving?: boolean;
    /** Disables the Save button (in addition to when isSaving is true) */
    saveDisabled?: boolean;
    children: ReactNode;
}

// ── Component ──────────────────────────────────────────────────────────────────
export const CreationModalShell: React.FC<CreationModalShellProps> = ({
    title,
    onClose,
    onSave,
    saveLabel = 'Save',
    isSaving = false,
    saveDisabled = false,
    children,
}) => {
    const panelRef = useRef<HTMLDivElement>(null);

    // ── Focus panel on open ──────────────────────────────────────────────────
    useEffect(() => {
        panelRef.current?.focus();
    }, []);

    // ── Keyboard: focus trap + Escape ────────────────────────────────────────
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
                    if (document.activeElement === first || document.activeElement === panel) {
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

    // ── Render ──────────────────────────────────────────────────────────────
    return (
        <div
            // Overlay
            style={{
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
            }}
            onClick={onClose}
            aria-label="Dialog backdrop"
        >
            {/* Panel */}
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="creation-modal-title"
                tabIndex={-1}
                onClick={(e) => e.stopPropagation()}
                className="new-ui-creation-modal-panel"
                style={{
                    width: '100%',
                    maxWidth: 1100,
                    height: 'min(820px, 90dvh)',
                    background: 'var(--bg-raised)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 14,
                    boxShadow: '0 24px 80px rgba(0,0,0,0.28), 0 4px 16px rgba(0,0,0,0.12)',
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: 0,
                    overflow: 'hidden',
                    outline: 'none',
                }}
            >
                {/* ── Header row (wiki §9 rule 19) ─────────────────────────────── */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '20px 24px 16px 24px',
                        flexShrink: 0,
                    }}
                >
                    <h2
                        id="creation-modal-title"
                        style={{
                            fontSize: 18,
                            fontWeight: 700,
                            margin: 0,
                            color: 'var(--text-primary)',
                            lineHeight: '1.2',
                        }}
                    >
                        {title}
                    </h2>

                    {/* Close × button — borderless per wiki §9 rule 19 */}
                    <button
                        aria-label="Close"
                        onClick={onClose}
                        style={{
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
                        }}
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

                {/* ── Scrollable body ───────────────────────────────────────── */}
                <div
                    style={{
                        flex: 1,
                        minHeight: 0,
                        overflowY: 'auto',
                        padding: '0 24px 24px',
                    }}
                >
                    {children}
                </div>

                {/* ── Footer (only when onSave is provided) ────────────────── */}
                {onSave && (
                    <div
                        style={{
                            flexShrink: 0,
                            padding: '12px 24px 20px',
                            display: 'flex',
                            gap: 8,
                            justifyContent: 'flex-end',
                            borderTop: '1px solid var(--border-subtle)',
                        }}
                    >
                        {/* Cancel */}
                        <button
                            onClick={onClose}
                            disabled={isSaving}
                            style={{
                                height: 36,
                                padding: '0 16px',
                                borderRadius: 8,
                                border: '1px solid var(--border-subtle)',
                                background: 'transparent',
                                color: 'var(--text-secondary)',
                                fontSize: 13,
                                fontWeight: 500,
                                cursor: isSaving ? 'default' : 'pointer',
                                fontFamily: 'inherit',
                                opacity: isSaving ? 0.5 : 1,
                                transition: 'background 120ms ease',
                            }}
                            onMouseEnter={(e) => {
                                if (!isSaving)
                                    e.currentTarget.style.background = 'var(--bg-hover)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                            }}
                        >
                            Cancel
                        </button>

                        {/* Save / primary action */}
                        <button
                            onClick={isSaving || saveDisabled ? undefined : onSave}
                            disabled={isSaving || saveDisabled}
                            aria-label={saveLabel}
                            style={{
                                height: 36,
                                padding: '0 20px',
                                borderRadius: 8,
                                border: 'none',
                                background:
                                    isSaving || saveDisabled
                                        ? 'var(--bg-active)'
                                        : 'var(--accent)',
                                color:
                                    isSaving || saveDisabled
                                        ? 'var(--text-muted)'
                                        : 'var(--accent-fg)',
                                fontSize: 13,
                                fontWeight: 500,
                                cursor:
                                    isSaving || saveDisabled ? 'default' : 'pointer',
                                fontFamily: 'inherit',
                                transition: 'background 120ms ease, color 120ms ease',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                minWidth: 80,
                                justifyContent: 'center',
                            }}
                        >
                            {isSaving ? (
                                <>
                                    <IconLoader2
                                        size={14}
                                        className="animate-spin"
                                        style={{ flexShrink: 0 }}
                                    />
                                    Saving…
                                </>
                            ) : (
                                saveLabel
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CreationModalShell;
