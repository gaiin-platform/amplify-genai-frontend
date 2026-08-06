/**
 * NewUIMessageActionsLayer
 *
 * Renders a floating action row (Copy / Edit for user messages,
 * Copy / Read Aloud for assistant messages) that appears below the
 * hovered message.  It uses event delegation on the .chatcontainer
 * element rather than touching ChatMessage.tsx.
 *
 * Constraints:
 *  - No modifications to ChatMessage.tsx, Chat.tsx, or any service/hook/type.
 *  - Reads messageIsStreaming from HomeContext so actions are suppressed while
 *    the AI is still writing.
 *  - All DOM interaction is deferred to the browser (SSR-safe guards applied).
 */

import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  IconCheck,
  IconCopy,
  IconEdit,
  IconPlayerStop,
  IconVolume,
} from '@tabler/icons-react';
import HomeContext from '@/pages/api/home/home.context';

// ─── Types ───────────────────────────────────────────────────────────────────

interface HoveredMessage {
  el: HTMLElement;
  role: 'user' | 'assistant';
}

interface ActionRowPosition {
  top: number;
  left: number;
  width: number;
  align: 'left' | 'right';
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Extract readable text from a message element. */
function extractMessageText(el: HTMLElement, role: 'user' | 'assistant'): string {
  if (role === 'user') {
    const userMsgEl = el.querySelector<HTMLElement>('#userMessage');
    return (userMsgEl ?? el).innerText ?? '';
  }
  // For assistant: prefer the prose content block
  const contentBlock = el.querySelector<HTMLElement>('.assistantContentBlock');
  if (contentBlock) return contentBlock.innerText ?? '';
  const chatHover = el.querySelector<HTMLElement>('#chatHover');
  return (chatHover ?? el).innerText ?? '';
}

/** Walk up from target to find the nearest .enhanced-chat-message ancestor. */
function findMessageAncestor(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof HTMLElement)) return null;
  let el: HTMLElement | null = target;
  while (el) {
    if (el.classList.contains('enhanced-chat-message')) return el;
    el = el.parentElement;
  }
  return null;
}

/** Compute the position for the action row floating pill. */
function computePosition(
  el: HTMLElement,
  role: 'user' | 'assistant',
): ActionRowPosition {
  const rect = el.getBoundingClientRect();
  const GAP = 6; // px between bubble bottom and pill top
  // Clamp so pill never overlaps the bottom composer (~180px from bottom)
  const maxTop = window.innerHeight - 220;

  if (role === 'user') {
    // Right-align the pill to the right edge of the bubble
    const bubble = el.querySelector('#chatHover') as HTMLElement | null;
    const bubbleRect = bubble ? bubble.getBoundingClientRect() : rect;
    return {
      top: Math.min(bubbleRect.bottom + GAP, maxTop),
      left: bubbleRect.right,   // pill is right-aligned from this point
      width: 0,
      align: 'right',
    };
  }

  // Left-align the pill to the left edge of the message block
  return {
    top: Math.min(rect.bottom + GAP, maxTop),
    left: rect.left,
    width: 0,
    align: 'left',
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export const NewUIMessageActionsLayer: React.FC = () => {
  const { state } = useContext(HomeContext);
  const { messageIsStreaming } = state;

  const [hovered, setHovered] = useState<HoveredMessage | null>(null);
  const [position, setPosition] = useState<ActionRowPosition | null>(null);
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Keep a ref so event handlers can read the latest hovered state without
  // stale closures.
  const hoveredRef = useRef<HoveredMessage | null>(null);
  hoveredRef.current = hovered;

  // Track whether pointer is inside the action pill itself so we don't
  // dismiss it when the user moves to click a button.
  const overPillRef = useRef(false);

  // ── Speech synthesis cleanup on unmount ──────────────────────────────────
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // ── Cancel speech when streaming starts ──────────────────────────────────
  useEffect(() => {
    if (messageIsStreaming && typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, [messageIsStreaming]);

  // ── Update position on scroll / resize ───────────────────────────────────
  const updatePosition = useCallback(() => {
    const msg = hoveredRef.current;
    if (!msg) return;
    const pos = computePosition(msg.el, msg.role);
    setPosition(pos);
  }, []);

  // ── Event delegation on .chatcontainer (with retry if not yet mounted) ──────
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let cleanupFn: (() => void) | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const attach = () => {
      // Try .chatcontainer first, fall back to the new-ui shell div
      const container = (
        document.querySelector('.chatcontainer') ??
        document.querySelector('[data-new-ui="true"]')
      ) as HTMLElement | null;

      if (!container) {
        // DOM not ready yet — retry shortly
        retryTimer = setTimeout(attach, 200);
        return;
      }

      let hideTimer: ReturnType<typeof setTimeout> | null = null;

      const show = (msgEl: HTMLElement, role: 'user' | 'assistant') => {
        if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
        setHovered({ el: msgEl, role });
        setPosition(computePosition(msgEl, role));
        setVisible(true);
        setCopied(false);
      };

      const scheduleHide = () => {
        hideTimer = setTimeout(() => {
          if (!overPillRef.current) {
            setVisible(false);
            // Delay nulling hovered so the fade-out animation completes
            setTimeout(() => {
              if (!overPillRef.current) setHovered(null);
            }, 150);
          }
        }, 80);
      };

      const onMouseOver = (e: MouseEvent) => {
        if (messageIsStreaming) return;
        const msgEl = findMessageAncestor(e.target);
        if (!msgEl) return;

        const role = msgEl.classList.contains('user-message')
          ? 'user'
          : msgEl.classList.contains('assistant-message')
            ? 'assistant'
            : null;
        if (!role) return;

        show(msgEl, role);
      };

      const onMouseOut = (e: MouseEvent) => {
        const relatedTarget = e.relatedTarget as HTMLElement | null;
        // Still inside the same message element?
        if (relatedTarget && hoveredRef.current?.el.contains(relatedTarget)) return;
        scheduleHide();
      };

      container.addEventListener('mouseover', onMouseOver);
      container.addEventListener('mouseout', onMouseOut);
      window.addEventListener('scroll', updatePosition, { passive: true });
      window.addEventListener('resize', updatePosition, { passive: true });
      container.addEventListener('scroll', updatePosition, { passive: true });

      cleanupFn = () => {
        container.removeEventListener('mouseover', onMouseOver);
        container.removeEventListener('mouseout', onMouseOut);
        window.removeEventListener('scroll', updatePosition);
        window.removeEventListener('resize', updatePosition);
        container.removeEventListener('scroll', updatePosition);
        if (hideTimer) clearTimeout(hideTimer);
      };
    }; // end attach()

    attach();

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      if (cleanupFn) cleanupFn();
    };
    // NOTE: messageIsStreaming in the closure is intentionally read via the
    // captured value; we re-subscribe when it changes.
  }, [messageIsStreaming, updatePosition]);

  // ── Action handlers ───────────────────────────────────────────────────────

  const handleCopy = useCallback(async () => {
    if (!hovered) return;
    const text = extractMessageText(hovered.el, hovered.role);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API unavailable — silently ignore
    }
  }, [hovered]);

  const handleEdit = useCallback(() => {
    if (!hovered) return;
    // Trigger ChatMessage's existing edit flow by clicking its hidden button
    const editBtn =
      (hovered.el.querySelector('#editPrompt') as HTMLButtonElement | null) ??
      (hovered.el.querySelector('[id="editPrompt"]') as HTMLButtonElement | null);
    if (editBtn) {
      editBtn.click();
      setVisible(false);
      setHovered(null);
    }
  }, [hovered]);

  const handleReadAloud = useCallback(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    if (!hovered) return;
    const text = extractMessageText(hovered.el, 'assistant');
    if (!text.trim()) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }, [hovered, isSpeaking]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (!hovered || !position) return null;

  const pillStyle: React.CSSProperties = {
    position: 'fixed',
    top: position.top,
    zIndex: 30,
    display: 'flex',
    gap: 2,
    padding: '4px 6px',
    background: 'var(--bg-app)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 8,
    opacity: visible ? 1 : 0,
    transition: 'opacity 120ms ease',
    pointerEvents: visible ? 'auto' : 'none',
    // Subtle shadow to lift the pill off the content
    boxShadow: '0 1px 6px rgba(0,0,0,0.08)',
  };

  if (position.align === 'right') {
    // right-align: anchor right edge of pill to position.left
    Object.assign(pillStyle, { right: `calc(100vw - ${position.left}px)` });
  } else {
    Object.assign(pillStyle, { left: position.left });
  }

  return (
    <div
      style={pillStyle}
      onMouseEnter={() => { overPillRef.current = true; }}
      onMouseLeave={() => {
        overPillRef.current = false;
        setVisible(false);
        setTimeout(() => { if (!overPillRef.current) setHovered(null); }, 150);
      }}
    >
      {/* Copy button — present for both user and assistant messages */}
      <button
        className="new-ui-action-btn"
        onClick={handleCopy}
        title={copied ? 'Copied!' : 'Copy'}
        aria-label={copied ? 'Copied!' : 'Copy message'}
      >
        {copied ? <IconCheck size={15} /> : <IconCopy size={15} />}
      </button>

      {hovered.role === 'user' && (
        /* Edit — user messages only */
        <button
          className="new-ui-action-btn"
          onClick={handleEdit}
          title="Edit"
          aria-label="Edit message"
        >
          <IconEdit size={15} />
        </button>
      )}

      {hovered.role === 'assistant' && (
        /* Read Aloud — assistant messages only */
        <button
          className="new-ui-action-btn"
          onClick={handleReadAloud}
          title={isSpeaking ? 'Stop reading' : 'Read aloud'}
          aria-label={isSpeaking ? 'Stop reading' : 'Read message aloud'}
        >
          {isSpeaking ? <IconPlayerStop size={15} /> : <IconVolume size={15} />}
        </button>
      )}
    </div>
  );
};

export default NewUIMessageActionsLayer;
