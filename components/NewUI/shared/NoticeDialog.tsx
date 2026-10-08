import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const FOCUSABLE_SELECTOR =
  'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),' +
  'textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export interface NoticeDialogProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  onClose: () => void;
  closeLabel?: string;
}

/**
 * A reusable, informational New UI dialog for blocking a consequential action
 * without presenting a confirm/cancel choice.
 */
export const NoticeDialog: React.FC<NoticeDialogProps> = ({
  open,
  title,
  message,
  onClose,
  closeLabel = 'Got it',
}) => {
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(
    null,
  );
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = 'new-ui-notice-dialog-title';

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const container = document.createElement('div');
    container.dataset.newUiShell = 'true';
    document.body.appendChild(container);
    setPortalContainer(container);
    return () => container.remove();
  }, []);

  useEffect(() => {
    if (!open) return;
    const focusTimer = window.setTimeout(
      () => closeButtonRef.current?.focus(),
      0,
    );
    return () => window.clearTimeout(focusTimer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopImmediatePropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      if (!focusable.length) return;
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
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [open, onClose]);

  if (!open || !portalContainer) return null;

  return createPortal(
    <div
      role="presentation"
      className="new-ui-notice-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: 'rgba(0, 0, 0, 0.45)',
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
        className="new-ui-notice-dialog"
        style={{
          width: 'min(400px, calc(100vw - 32px))',
          background: 'var(--bg-raised)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-panel, 12px)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.45)',
          outline: 'none',
        }}
      >
        <div style={{ padding: '24px 24px 8px' }}>
          <h2
            id={titleId}
            style={{
              margin: 0,
              color: 'var(--text-primary)',
              fontSize: 16,
              fontWeight: 600,
              lineHeight: 1.3,
            }}
          >
            {title}
          </h2>
          <div
            style={{
              marginTop: 8,
              color: 'var(--text-secondary)',
              fontSize: 13.5,
              lineHeight: 1.5,
            }}
          >
            {message}
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            padding: '12px 24px 20px',
          }}
        >
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]"
            style={{
              height: 34,
              padding: '0 16px',
              border: 0,
              borderRadius: 8,
              background: 'var(--accent)',
              color: 'var(--accent-fg)',
              cursor: 'pointer',
              fontSize: 13.5,
              fontWeight: 500,
            }}
          >
            {closeLabel}
          </button>
        </div>
      </div>
      <style>{`
        .new-ui-notice-dialog { animation: newUiNoticeDialogIn 140ms ease-out both; }
        @keyframes newUiNoticeDialogIn {
          from { opacity: 0; transform: translateY(4px) scale(0.98); }
          to { opacity: 1; transform: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          .new-ui-notice-dialog { animation: none; }
        }
      `}</style>
    </div>,
    portalContainer,
  );
};

export default NoticeDialog;
