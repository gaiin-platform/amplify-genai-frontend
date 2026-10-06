import { RefObject, useEffect, useRef } from 'react';

const FOCUSABLE =
    'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

/**
 * Modal-dialog behavior for a container: focuses it on open, keeps Tab inside,
 * closes on Escape, and returns focus to whatever opened it.
 * (ConfirmDialog handles Escape in the capture phase and stops it, so a
 * confirmation opened from inside one of these closes on its own first.)
 */
export function useDialogA11y(open: boolean, containerRef: RefObject<HTMLElement>, onClose: () => void) {
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

    useEffect(() => {
        if (!open) return;
        const container = containerRef.current;
        const previouslyFocused = document.activeElement as HTMLElement | null;

        const focusTimer = setTimeout(() => {
            const first = container?.querySelector<HTMLElement>('[data-autofocus]') ??
                container?.querySelector<HTMLElement>(FOCUSABLE);
            (first ?? container)?.focus();
        }, 10);

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.stopPropagation();
                onCloseRef.current();
                return;
            }
            if (event.key !== 'Tab' || !container) return;
            const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE))
                .filter((el) => el.offsetParent !== null);
            if (focusable.length === 0) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };
        document.addEventListener('keydown', onKeyDown);
        return () => {
            clearTimeout(focusTimer);
            document.removeEventListener('keydown', onKeyDown);
            previouslyFocused?.focus?.();
        };
    }, [open, containerRef]);
}
