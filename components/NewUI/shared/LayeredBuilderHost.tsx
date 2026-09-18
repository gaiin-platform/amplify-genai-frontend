/**
 * LayeredBuilderHost — mounts the Layered Assistant Builder modal at the
 * new-UI root, outside any view that can launch it.
 *
 * WHY THIS EXISTS
 * ---------------
 * `openLayeredBuilderTrigger` is the window event used everywhere to open the
 * builder (NewAssistantsView, GroupLayeredAssistants, LayeredAssistantItem, …).
 * Its only listener is `components/Layout/UserMenu.tsx`, which is rendered only
 * in the classic-UI branch of `home.tsx`. In the new UI the event fires into
 * the void — the button appears to do nothing.
 *
 * This host provides the listener for the new-UI branch. It follows the same
 * pattern as `PromptTemplateDialogHost`: one component mounted at the root,
 * portalled to a dedicated container element it owns, so the builder survives
 * any view transition that might unmount the launcher.
 *
 * PORTAL / SCROLLBAR NOTES
 * ------------------------
 * The wrapper carries `data-new-ui-shell="true"` — required for any surface
 * portalled to document.body to get blue (not orange) scrollbars (§29 of
 * NEW_UI_GUIDE.md). The portal container is a dedicated element created and
 * removed in an effect so teardown is a single `el.remove()`.
 *
 * SAVE BUTTON WIRING
 * ------------------
 * `LayeredAssistantBuilder` does not render its own Save button when the parent
 * supplies `onRegisterSave`. The host captures the builder's internal save fn
 * via `onRegisterSave` and calls it when the user clicks the header Save button.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { IconLoader2, IconX } from '@tabler/icons-react';
import { LayeredAssistantBuilder } from '@/components/LayeredAssistants/LayeredAssistantBuilder';
import { LayeredAssistant } from '@/types/layeredAssistant';

/** Shape of the event detail fired by openLayeredBuilderTrigger callers. */
interface LayeredBuilderEventDetail {
    isOpen: boolean;
    data?: {
        title?: string;
        initialData?: LayeredAssistant;
        onSave?: (la: LayeredAssistant) => Promise<LayeredAssistant | null> | void;
        assistants?: any[];
    };
}

export const LayeredBuilderHost: React.FC = () => {
    const [builderData, setBuilderData] = useState<LayeredBuilderEventDetail['data'] | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    /** Registered by LayeredAssistantBuilder so we can trigger save from the header button. */
    const saveFnRef = useRef<(() => void) | null>(null);
    const isSavingRef = useRef<{ current: boolean }>({ current: false });

    /** Dedicated portal container — see PORTAL notes above. */
    const [container, setContainer] = useState<HTMLElement | null>(null);
    useEffect(() => {
        const el = document.createElement('div');
        el.setAttribute('data-layered-builder-portal', 'true');
        document.body.appendChild(el);
        setContainer(el);
        return () => {
            el.remove();
            setContainer(null);
        };
    }, []);

    /** Listen for openLayeredBuilderTrigger events. */
    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent<LayeredBuilderEventDetail>).detail;
            if (detail.isOpen) {
                saveFnRef.current = null;
                setIsSaving(false);
                setBuilderData(detail.data ?? {});
            } else {
                setBuilderData(null);
                saveFnRef.current = null;
            }
        };
        window.addEventListener('openLayeredBuilderTrigger', handler);
        return () => window.removeEventListener('openLayeredBuilderTrigger', handler);
    }, []);

    const handleClose = useCallback(() => {
        setBuilderData(null);
        saveFnRef.current = null;
        setIsSaving(false);
    }, []);

    const handleSave = useCallback(() => {
        saveFnRef.current?.();
    }, []);

    const handleRegisterSave = useCallback(
        (fn: () => void, savingRef?: React.MutableRefObject<boolean>) => {
            saveFnRef.current = fn;
            if (savingRef) {
                // Poll the builder's isSaving ref so the header button reflects save progress.
                // We refresh our own isSaving state whenever the ref flips.
                const poll = setInterval(() => {
                    setIsSaving(!!savingRef.current);
                }, 100);
                isSavingRef.current = { current: false };
                // Stop polling when the host unmounts (builderData gone triggers handleClose).
                // No cleanup needed on the interval here — it's harmless and stops when builder
                // sets isSaving back to false and then onSave closes the modal.
                return () => clearInterval(poll);
            }
        },
        [],
    );

    // Escape key closes the builder
    useEffect(() => {
        if (!builderData) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopImmediatePropagation(); // prevent CreationModalShell from also closing (§14)
                handleClose();
            }
        };
        document.addEventListener('keydown', handler, true);
        return () => document.removeEventListener('keydown', handler, true);
    }, [builderData, handleClose]);

    if (!builderData || !container) return null;

    return createPortal(
        <div
            data-new-ui-shell="true"
            className="text-neutral-900 dark:text-white"
            style={{ position: 'fixed', inset: 0, zIndex: 10001 }}
            role="dialog"
            aria-modal="true"
            aria-label={builderData.title || 'Layered Assistant Builder'}
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0"
                style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
                onClick={handleClose}
            />

            {/* Dialog panel — full-screen with header */}
            <div
                className="absolute inset-4 rounded-xl flex flex-col overflow-hidden"
                style={{ backgroundColor: 'var(--bg-raised)', maxHeight: 'calc(100dvh - 2rem)' }}
            >
                {/* Header */}
                <div
                    className="flex items-center justify-between px-6 py-4 flex-shrink-0 border-b"
                    style={{ borderColor: 'var(--border-subtle)' }}
                >
                    <h2
                        className="text-[15px] font-semibold"
                        style={{ color: 'var(--text-primary)' }}
                    >
                        {builderData.title || 'Layered Assistant Builder'}
                    </h2>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleClose}
                            className="h-8 px-3 rounded-lg text-[13px] font-medium transition-colors"
                            style={{
                                color: 'var(--text-secondary)',
                                backgroundColor: 'transparent',
                                border: '1px solid var(--border-subtle)',
                            }}
                            onMouseOver={e => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                            onMouseOut={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex items-center gap-1.5 h-8 px-4 rounded-lg text-[13px] font-medium text-white transition-opacity disabled:opacity-60"
                            style={{ backgroundColor: 'var(--accent)' }}
                        >
                            {isSaving && (
                                <IconLoader2
                                    size={13}
                                    className="motion-safe:animate-spin motion-reduce:animate-none"
                                />
                            )}
                            Save
                        </button>
                        <button
                            onClick={handleClose}
                            aria-label="Close"
                            className="ml-1 rounded-lg p-1.5 transition-colors"
                            style={{ color: 'var(--text-secondary)' }}
                            onMouseOver={e => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                            onMouseOut={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                            <IconX size={16} />
                        </button>
                    </div>
                </div>

                {/* Builder body — showSaveButton=true switches its height to 100% */}
                <div className="flex-1 min-h-0 overflow-hidden">
                    <LayeredAssistantBuilder
                        onClose={handleClose}
                        onSave={builderData.onSave}
                        initialData={builderData.initialData}
                        onRegisterSave={handleRegisterSave}
                        assistants={builderData.assistants}
                        showSaveButton={true}
                    />
                </div>
            </div>
        </div>,
        container,
    );
};

export default LayeredBuilderHost;
