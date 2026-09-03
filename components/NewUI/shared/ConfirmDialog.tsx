/**
 * ConfirmDialog — reusable confirmation modal for destructive or consequential actions.
 *
 * Usage:
 *   <ConfirmDialog
 *     isOpen={open}
 *     title="Delete conversation?"
 *     message={`Are you sure you want to delete "${name}"? This cannot be undone.`}
 *     confirmLabel="Delete"        // default "Delete"
 *     cancelLabel="Cancel"         // default "Cancel"
 *     variant="danger"             // default "danger" → red confirm button
 *     onConfirm={() => { doDelete(); setOpen(false); }}
 *     onCancel={() => setOpen(false)}
 *   />
 *
 * Variants:
 *   danger  → confirm button is red  (use for irreversible deletes)
 *   warning → confirm button is amber
 *   neutral → confirm button is --accent blue
 *
 * Accessibility (wiki §9 rules 12/13):
 *   • role="dialog" aria-modal="true" aria-labelledby on panel
 *   • Focus trap (Tab / Shift-Tab cycles within panel)
 *   • Cancel button focused on open (safer default — user must intentionally confirm)
 *   • Escape key cancels
 *   • Clicking the backdrop cancels
 *
 * Rendered via ReactDOM.createPortal to document.body — never clipped by overflow ancestors.
 */
import React, { useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';

const FOCUSABLE_SELECTOR =
  'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),' +
  'textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  /** Label for the confirm (action) button. Default: "Delete" */
  confirmLabel?: string;
  /** Label for the cancel button. Default: "Cancel" */
  cancelLabel?: string;
  /** Called when the user confirms the action */
  onConfirm: () => void;
  /** Called when the user cancels (Escape, backdrop click, Cancel button) */
  onCancel: () => void;
  /**
   * Visual variant for the confirm button:
   *   danger  → red   (default — for irreversible destructive actions)
   *   warning → amber
   *   neutral → accent blue
   */
  variant?: 'danger' | 'warning' | 'neutral';
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'danger',
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  // Focus the Cancel button on open — user must consciously move to confirm
  useEffect(() => {
    if (isOpen) {
      // Tiny delay lets the portal paint before focus
      const t = setTimeout(() => cancelBtnRef.current?.focus(), 10);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // Escape cancels
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      // stopImmediatePropagation, not stopPropagation: sibling listeners on the
      // same node still run after stopPropagation, and CreationModalShell also
      // listens for Escape on document in the capture phase — so a plain
      // stopPropagation here closes the dialog AND the modal behind it,
      // discarding whatever the user had typed. See NEW_UI_GUIDE §5 rule 14.
      if (e.key === 'Escape') { e.stopImmediatePropagation(); onCancel(); }
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [isOpen, onCancel]);

  // Focus trap: Tab / Shift-Tab stays within the panel
  useEffect(() => {
    if (!isOpen || !panelRef.current) return;
    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusable = Array.from(
        panelRef.current!.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', trap);
    return () => document.removeEventListener('keydown', trap);
  }, [isOpen]);

  if (!isOpen || typeof document === 'undefined') return null;

  const confirmCls =
    variant === 'danger'
      ? 'bg-red-500 hover:bg-red-600 focus-visible:ring-red-400 text-white'
      : variant === 'warning'
      ? 'bg-amber-500 hover:bg-amber-600 focus-visible:ring-amber-400 text-white'
      : 'bg-[--accent] hover:opacity-90 focus-visible:ring-[--accent] text-[--accent-fg]';

  const modal = (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 10000, background: 'rgba(0,0,0,0.45)' }}
      // Backdrop click cancels
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        tabIndex={-1}
        className="relative w-full max-w-[400px] outline-none"
        style={{
          background: 'var(--bg-raised)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-panel, 12px)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
        }}
      >
        {/* Content */}
        <div className="px-6 pt-6 pb-2">
          <h2
            id="confirm-dialog-title"
            className="text-[15px] font-semibold mb-1.5"
            style={{ color: 'var(--text-primary)' }}
          >
            {title}
          </h2>
          <div
            className="text-[13.5px] leading-relaxed"
            style={{ color: 'var(--text-secondary)' }}
          >
            {message}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 px-6 py-4">
          <button
            ref={cancelBtnRef}
            onClick={onCancel}
            className="h-[34px] px-4 rounded-[8px] text-[13.5px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[--text-secondary]"
            style={{
              color: 'var(--text-secondary)',
              background: 'transparent',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
              (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
              (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
            }}
          >
            {cancelLabel}
          </button>

          <button
            onClick={onConfirm}
            className={`h-[34px] px-4 rounded-[8px] text-[13.5px] font-medium transition-colors focus:outline-none focus-visible:ring-2 ${confirmCls}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modal, document.body);
};

export default ConfirmDialog;
