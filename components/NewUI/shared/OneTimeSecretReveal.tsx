/**
 * OneTimeSecretReveal — the one place a value that is shown exactly once (a new or rotated
 * API key) is displayed.
 *
 *   <OneTimeSecretReveal secret copied onCopied onDone />   the calm warning callout
 *   useOneTimeSecret()                                      the state + "are you sure?" rules
 *
 * Contract:
 *  - The secret lives ONLY in the host's React state (via `useOneTimeSecret`). It is never
 *    logged, never written to storage, and `clear()` drops it, so closing the callout is the
 *    end of its life in memory.
 *  - The callout is calm (warning tokens, left-aligned): title, a read-only monospace field that
 *    selects the whole value on click and scrolls horizontally, a labelled Copy button that
 *    reads "Copied ✓" for ~2s (announced through `aria-live`), the one-time notice, and a
 *    Done button.
 *  - "Done" before the value has been copied asks "Have you saved this key?". The host reuses
 *    the same rule for anything else that would discard the value — collapsing the card,
 *    switching Settings sections, closing the modal — through `guard(action)`.
 *    Copying counts as saving, in all of those places.
 *
 * Location: components/NewUI/shared/OneTimeSecretReveal.tsx
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { IconAlertTriangle, IconCheck, IconCopy } from '@tabler/icons-react';
import { ConfirmDialog } from './ConfirmDialog';

export const COPIED_FLASH_MS = 2000;
export const KEY_NOT_SAVED_TITLE = 'Have you saved this key?';
export const KEY_NOT_SAVED_MESSAGE = "It can't be shown again.";

/** Clipboard API first, then the legacy execCommand route (non-secure contexts). */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.setAttribute('aria-hidden', 'true');
    area.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

export interface KeySavedConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const KeySavedConfirmDialog: React.FC<KeySavedConfirmDialogProps> = ({
  isOpen,
  onConfirm,
  onCancel,
}) => (
  <ConfirmDialog
    isOpen={isOpen}
    title={KEY_NOT_SAVED_TITLE}
    message={KEY_NOT_SAVED_MESSAGE}
    confirmLabel="I've saved it"
    cancelLabel="Cancel"
    variant="neutral"
    onConfirm={onConfirm}
    onCancel={onCancel}
  />
);

/** State + dismissal rules for one shown-once secret. */
export function useOneTimeSecret() {
  const [secret, setSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState<{ action: () => void } | null>(null);

  const show = useCallback((value: string) => {
    setSecret(value);
    setCopied(false);
    setPending(null);
  }, []);

  /** Drop the secret from memory. */
  const clear = useCallback(() => {
    setSecret(null);
    setCopied(false);
    setPending(null);
  }, []);

  const markCopied = useCallback(() => setCopied(true), []);

  /** True while a secret is on screen that the user has not copied. */
  const needsConfirm = secret !== null && !copied;

  /**
   * Run `action` once the secret is out of the way: immediately when there is none or it was
   * copied (the secret is cleared first), otherwise after the user confirms they saved it.
   */
  const guard = useCallback(
    (action: () => void) => {
      if (secret === null) {
        action();
      } else if (copied) {
        clear();
        action();
      } else {
        setPending({ action });
      }
    },
    [secret, copied, clear],
  );

  /** What the Done button calls. */
  const requestDone = useCallback(() => guard(() => undefined), [guard]);

  const dialog = (
    <KeySavedConfirmDialog
      isOpen={pending !== null}
      onCancel={() => setPending(null)}
      onConfirm={() => {
        const action = pending?.action;
        clear();
        action?.();
      }}
    />
  );

  return { secret, copied, show, clear, markCopied, needsConfirm, guard, requestDone, dialog };
}

export interface OneTimeSecretRevealProps {
  /** The value to show. Owned by the host (`useOneTimeSecret`). */
  secret: string;
  copied: boolean;
  onCopied: () => void;
  /** Done was pressed; the host decides whether to confirm (use `requestDone`). */
  onDone: () => void;
  title?: string;
  /** Accessible name of the read-only field. */
  fieldLabel?: string;
}

const buttonBase =
  'inline-flex items-center justify-center gap-1.5 h-[36px] px-4 rounded-[8px] text-[13px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent] disabled:opacity-50 disabled:pointer-events-none';

export const OneTimeSecretReveal: React.FC<OneTimeSecretRevealProps> = ({
  secret,
  copied,
  onCopied,
  onDone,
  title = 'Copy your new API key',
  fieldLabel = 'New API key',
}) => {
  const [flash, setFlash] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleId = useRef(`otsr-${Math.random().toString(36).slice(2, 9)}`).current;

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const handleCopy = async () => {
    const ok = await copyTextToClipboard(secret);
    if (!ok) {
      setCopyFailed(true);
      return;
    }
    setCopyFailed(false);
    onCopied();
    setFlash(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setFlash(false), COPIED_FLASH_MS);
  };

  return (
    <section
      aria-labelledby={titleId}
      style={{
        background: 'var(--warning-bg)',
        border: '1px solid var(--warning-border)',
        borderRadius: 12,
        padding: 16,
        textAlign: 'left',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <IconAlertTriangle size={18} aria-hidden="true" style={{ color: 'var(--warning-icon)', flexShrink: 0 }} />
        <h4 id={titleId} style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
          {title}
        </h4>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'stretch' }}>
        <input
          type="text"
          readOnly
          value={secret}
          aria-label={fieldLabel}
          autoComplete="off"
          spellCheck={false}
          data-lpignore="true"
          data-1p-ignore="true"
          onFocus={(e) => e.currentTarget.select()}
          onClick={(e) => e.currentTarget.select()}
          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]"
          style={{
            flex: 1,
            minWidth: 0,
            height: 36,
            boxSizing: 'border-box',
            padding: '0 10px',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
            fontSize: 13,
            color: 'var(--text-primary)',
            background: 'var(--bg-app)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 8,
            overflowX: 'auto',
            textOverflow: 'clip',
          }}
        />
        <button
          type="button"
          onClick={handleCopy}
          className={`${buttonBase} bg-[--accent] text-[--accent-fg] hover:opacity-90`}
          style={{ flexShrink: 0, minWidth: 96 }}
        >
          {flash ? <IconCheck size={16} aria-hidden="true" /> : <IconCopy size={16} aria-hidden="true" />}
          {flash ? 'Copied ✓' : 'Copy'}
        </button>
      </div>

      {/* Polite announcement for screen readers; visually hidden. */}
      <span
        aria-live="polite"
        role="status"
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          overflow: 'hidden',
          clip: 'rect(0 0 0 0)',
          whiteSpace: 'nowrap',
        }}
      >
        {flash ? 'Copied' : ''}
      </span>

      {copyFailed && (
        <p role="alert" style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text-error)' }}>
          Couldn&apos;t copy automatically. Click the key to select it, then copy it manually.
        </p>
      )}

      <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--warning-fg)' }}>
        This key won&apos;t be shown again. Store it somewhere secure, like a password manager.
      </p>

      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginTop: 14,
          paddingTop: 12,
          borderTop: '1px solid var(--warning-border)',
        }}
      >
        <button
          type="button"
          onClick={onDone}
          className={`${buttonBase} border border-[--border-subtle] bg-[--bg-app] text-[--text-primary] hover:bg-[--bg-hover]`}
        >
          Done
        </button>
      </div>
    </section>
  );
};

export default OneTimeSecretReveal;
