/**
 * NewUIMessageActionsLayer
 *
 * Renders one hover-action row per rendered chat message (user + assistant),
 * per chat-pane-migration-spec.md §1/§2. Single component with a `side`
 * concept (user rows right-align, assistant rows left-align) rather than two
 * separate components, per the spec's explicit instruction.
 *
 * ── Phase 33 positioning rewrite (READ THIS BEFORE EDITING) ─────────────────
 *
 *  The rows used to be `position: fixed`, positioned from getBoundingClientRect()
 *  and stored in React state, updated on every scroll frame via rAF. That model
 *  is intrinsically laggy: when the user scrolls, the DOM moves instantly but the
 *  React state only catches up on the next rAF, so there is always ≥1 paint frame
 *  where the fixed row's viewport position doesn't match the message's new scroll
 *  position — the row appears to "detach" / lag behind the message.
 *
 *  The fix: rows are now `position: absolute` children of an overlay div that is
 *  portaled DIRECTLY INTO `.chatcontainer` (the scrolling element). Because the
 *  rows live *inside* the scroller, they scroll with the content automatically —
 *  exactly like any other element — with ZERO scroll listeners, ZERO rAF, and no
 *  per-frame position state. Positions are pure layout values (offsetTop /
 *  offsetLeft relative to `.chatcontainer`) that are stable regardless of scroll
 *  position; they only change when the DOM layout changes (message added / removed
 *  / resized) or the window resizes, both of which trigger a `scan()`.
 *
 *  `.chatcontainer` is made `position: relative` in conversation-view.css so it is
 *  the offsetParent / containing block for the overlay and its rows.
 *
 * Other architecture notes:
 *  - Zero modifications to ChatMessage.tsx / Chat.tsx / ExpansionComponent.tsx.
 *    The overlay is injected via createPortal (same proven pattern as
 *    NewUIUserMessageMarkdownLayer, which portals into each #chatHover).
 *  - Message discovery is DOM-based (a MutationObserver-driven rescan of
 *    `.chatcontainer`), matched back to real `Message` objects from HomeContext
 *    by replicating Chat.tsx's own render-filter exactly:
 *    `messages.filter(m => m.role !== 'tool' && !(m.data && m.data.actionResult))`
 *    — so the Nth surviving message corresponds to the Nth
 *    `.enhanced-chat-message.user-message/.assistant-message` element in the DOM.
 *  - Real, native keyboard accessibility: each row is a normal DOM subtree with
 *    normal tab order. Visibility is opacity/pointer-events driven (NOT
 *    display:none, so no layout shift) and revealed by (a) DOM mouse-hover
 *    delegation on the corresponding message element, OR (b) the row's own native
 *    `:focus-within` when a user tabs onto one of its buttons. There is NO
 *    always-visible last-assistant row (Phase 33 §2: removed per user request —
 *    rows appear on hover only, for every message including the last).
 *  - Retry ("Try again" only) is achieved via the edit-and-resubmit DOM bridge:
 *    click the hidden `#editPrompt` button on the relevant user message, wait for
 *    `UserMessageEditor` to mount its `#editResponse` textarea, toggle a trailing
 *    space (ChatMessage's handleEditMessage only resends if content differs), then
 *    click `#saveTextChange`. For an assistant row, "the relevant user message" is
 *    the nearest preceding `.enhanced-chat-message.user-message` sibling.
 *  - Good/bad rating persists to `message.data.newUiRating` / `newUiFeedback` via
 *    the always-safe `handleUpdateSelectedConversation` context handler (see
 *    NEW_UI_DOCS.md §12 Phase 28 for why it deliberately does NOT call the
 *    group-assistant-scoped `saveUserRating` endpoint).
 */

import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import {
  IconCheck,
  IconCopy,
  IconEdit,
  IconPlayerStop,
  IconRefresh,
  IconThumbDown,
  IconThumbDownFilled,
  IconThumbUp,
  IconThumbUpFilled,
  IconVolume,
} from '@tabler/icons-react';
import HomeContext from '@/pages/api/home/home.context';
import { Conversation, Message } from '@/types/chat';
import {
  formatAbsoluteTime,
  useRelativeTime,
} from '@/components/NewUI/shared/relativeTimestamp';

// ─── Types ───────────────────────────────────────────────────────────────────

type Role = 'user' | 'assistant';

interface Slot {
  key: string;
  el: HTMLElement;
  role: Role;
  message: Message;
  rawIndex: number;
  /** Layout position within .chatcontainer scroll coordinates (computed in scan). */
  top: number;
  align: 'left' | 'right';
  left?: number;
  right?: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Mirrors Chat.tsx's exact render-time message filter (tool msgs + action-result msgs never render as .user-message/.assistant-message). */
function filterRenderedMessages(messages: Message[]): Message[] {
  return messages.filter(
    (m) => m.role !== 'tool' && !(m.data && m.data.actionResult),
  );
}

/** Extract readable text from a message element for copy/read-aloud.
 *
 * Fix 40 — user messages: when the markdown layer is active, #userMessage is
 * hidden (display:none via .new-ui-has-markdown), so #userMessage.innerText
 * returns "". Read from the markdown-rendered inner div instead, which has
 * clean text without the @Amplify: prefix from getAtBlock().
 *
 * When the markdown layer is NOT active (e.g. hasLargeText messages), fall
 * back to #userMessage. The .enhanced-at-block span (display:none via CSS)
 * is excluded from innerText by modern browsers; user-select:none in CSS
 * (Fix 40 CSS change) prevents manual-selection clipboard inclusion too.
 */
function extractMessageText(el: HTMLElement, role: Role): string {
  if (role === 'user') {
    // Prefer the markdown-rendered content (present when NewUIUserMessageMarkdownLayer
    // is active). The inner collapsible div contains the ReactMarkdown output only,
    // without the Show-more/Show-less button text or the @Amplify: prefix.
    const mdInner = el.querySelector<HTMLElement>('.new-ui-user-markdown > div:first-child');
    if (mdInner) {
      const text = mdInner.innerText ?? '';
      if (text.trim()) return text;
    }
    // Fallback: read from the original #userMessage element (markdown layer inactive).
    const userMsgEl = el.querySelector<HTMLElement>('#userMessage');
    return (userMsgEl ?? el).innerText ?? '';
  }
  const contentBlock = el.querySelector<HTMLElement>('.assistantContentBlock');
  if (contentBlock) return contentBlock.innerText ?? '';
  const chatHover = el.querySelector<HTMLElement>('#chatHover');
  return (chatHover ?? el).innerText ?? '';
}

/**
 * Sum offsetTop / offsetLeft up the offsetParent chain from `el` to `container`,
 * giving `el`'s top-left edge in `container`'s scroll coordinate system.
 *
 * Because offsetTop/offsetLeft are always measured relative to the element's
 * offsetParent (skipping non-positioned ancestors), and `.chatcontainer` is the
 * nearest positioned ancestor of the whole message subtree (it's made
 * position:relative in CSS), the walk terminates at `container` and the summed
 * value is exact — regardless of scroll position. These are pure layout values,
 * so they never need recomputing on scroll.
 */
function offsetWithin(
  el: HTMLElement,
  container: HTMLElement,
): { top: number; left: number } {
  let top = 0;
  let left = 0;
  let node: HTMLElement | null = el;
  while (node && node !== container) {
    top += node.offsetTop;
    left += node.offsetLeft;
    node = node.offsetParent as HTMLElement | null;
  }
  return { top, left };
}

/**
 * Compute the row's absolute position within `.chatcontainer` scroll coordinates.
 *
 * Anchors to `#chatHover` (the visible bubble/content), not the outer
 * `.enhanced-chat-message` (whose offsetHeight now includes a reserved
 * padding-bottom — see conversation-view.css Phase 33). The row sits GAP px
 * below the visible content, inside that reserved padding region.
 */
function computePosition(
  el: HTMLElement,
  role: Role,
  container: HTMLElement,
): Pick<Slot, 'top' | 'align' | 'left' | 'right'> {
  const GAP = role === 'user' ? 2 : 1;
  const anchor = el.querySelector<HTMLElement>('#chatHover') ?? el;
  const { top: anchorTop, left: anchorLeft } = offsetWithin(anchor, container);
  const top = anchorTop + anchor.offsetHeight + GAP;

  if (role === 'user') {
    // Right edge of the bubble = right edge of the column. Set CSS `right`
    // relative to the overlay (which spans the container's client box).
    const right = container.clientWidth - (anchorLeft + anchor.offsetWidth);
    return { top, right, align: 'right' };
  }
  // Assistant: left-align to the content's left edge.
  return { top, left: anchorLeft, align: 'left' };
}

/** Find the nearest preceding user-message sibling (for assistant-row retry). */
function findPrecedingUserMessage(el: HTMLElement): HTMLElement | null {
  let sib: Element | null = el.previousElementSibling;
  while (sib) {
    if (sib.classList.contains('enhanced-chat-message') && sib.classList.contains('user-message')) {
      return sib as HTMLElement;
    }
    sib = sib.previousElementSibling;
  }
  return null;
}

/** Click #editPrompt on `userMsgEl`, then resubmit its textarea with a trivial no-op change. */
function retryFromUserMessageEl(userMsgEl: HTMLElement) {
  const editBtn = userMsgEl.querySelector<HTMLButtonElement>('#editPrompt');
  if (!editBtn) return;
  editBtn.click();

  let attempts = 0;
  const tryResubmit = () => {
    attempts += 1;
    const textarea = userMsgEl.querySelector<HTMLTextAreaElement>('#editResponse');
    const saveBtn = userMsgEl.querySelector<HTMLButtonElement>('#saveTextChange');
    if (textarea && saveBtn) {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value',
      )?.set;
      // Trivial no-op change: handleEditMessage only resends if content differs.
      const nextValue = textarea.value.endsWith(' ')
        ? textarea.value.slice(0, -1)
        : `${textarea.value} `;
      setter?.call(textarea, nextValue);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      setTimeout(() => saveBtn.click(), 30);
    } else if (attempts < 15) {
      setTimeout(tryResubmit, 40);
    }
  };
  setTimeout(tryResubmit, 40);
}

// ─── Row sub-component ───────────────────────────────────────────────────────

interface ActionRowProps {
  slot: Slot;
  hovered: boolean;
  onHoverChange: (key: string, hovered: boolean) => void;
  onCopy: (slot: Slot) => Promise<boolean>;
  onEdit: (slot: Slot) => void;
  onRetry: (slot: Slot) => void;
  onReadAloud: (slot: Slot) => void;
  isSpeaking: boolean;
  onRate: (slot: Slot, rating: 'good' | 'bad' | null, feedback?: string) => void;
}

const ActionRow: React.FC<ActionRowProps> = ({
  slot,
  hovered,
  onHoverChange,
  onCopy,
  onEdit,
  onRetry,
  onReadAloud,
  isSpeaking,
  onRate,
}) => {
  const [copied, setCopied] = useState(false);
  const [focused, setFocused] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const relTime = useRelativeTime(slot.message.timestamp);
  const absTime = slot.message.timestamp ? formatAbsoluteTime(slot.message.timestamp) : '';

  const currentRating: 'good' | 'bad' | null = slot.message.data?.newUiRating ?? null;

  // Phase 33 §2: rows appear on hover (or keyboard focus) only — for every
  // message including the last. No always-visible last-assistant behaviour.
  const visible = hovered || focused;

  const handleCopyClick = async () => {
    const ok = await onCopy(slot);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  const handleBadClick = () => {
    if (currentRating === 'bad') {
      onRate(slot, null);
      setShowFeedback(false);
      return;
    }
    onRate(slot, 'bad');
    setShowFeedback(true);
  };

  const handleGoodClick = () => {
    onRate(slot, currentRating === 'good' ? null : 'good');
    setShowFeedback(false);
  };

  const submitFeedback = () => {
    onRate(slot, 'bad', feedbackText.trim() || undefined);
    setShowFeedback(false);
  };

  // Position is a pure layout value computed in scan() and passed via `slot`.
  // The row is position:absolute inside the overlay portaled into .chatcontainer,
  // so it scrolls with the content automatically — no scroll listener, no rAF.
  const rowStyle: React.CSSProperties = {
    position: 'absolute',
    top: slot.top,
    left: slot.align === 'left' ? slot.left : undefined,
    right: slot.align === 'right' ? slot.right : undefined,
    zIndex: 30,
    display: 'flex',
    alignItems: 'center',
    // No gap on the outer row — spacing is applied per spec §2.1/§2.2:
    //   user:      20px between timestamp and first icon, 18px between icons
    //   assistant: 22px between icons, 8px before the (trailing) timestamp
    opacity: visible ? 1 : 0,
    // pointer-events auto only when visible, so an invisible row can never
    // intercept clicks meant for the message beneath it (the overlay host is
    // pointer-events:none; each visible row re-enables them for itself).
    pointerEvents: visible ? 'auto' : 'none',
    transition: 'opacity 120ms ease',
  };

  // Icon cluster gets the uniform icon-to-icon gap; the timestamp sits
  // outside it with its own (different) margin to the nearest icon.
  // Phase 37: tightened gaps — consistent 4px for both roles
  const iconClusterStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  };

  const timestampNode = absTime || relTime ? (
    <span
      title={absTime}
      className="new-ui-msg-timestamp"
      style={{
        fontSize: 12,
        color: 'var(--text-muted)',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        // Phase 37: reduced from 10px/6px → 6px/4px
        marginRight: slot.role === 'user' ? 6 : 0,
        marginLeft: slot.role === 'assistant' ? 4 : 0,
      }}
    >
      {relTime}
    </span>
  ) : null;

  return (
    <div
      className="new-ui-msg-action-row"
      style={rowStyle}
      onMouseEnter={() => onHoverChange(slot.key, true)}
      onMouseLeave={() => onHoverChange(slot.key, false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        // Only unfocus if focus is truly leaving the row.
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocused(false);
      }}
    >
      {slot.role === 'user' ? (
        <>
          {timestampNode}
          <div style={iconClusterStyle}>
            <button
              className="new-ui-action-btn new-ui-action-btn-lg"
              onClick={() => onRetry(slot)}
              title="Retry"
              aria-label="Retry — regenerate response"
            >
              <IconRefresh size={16} />
            </button>
            <button
              className="new-ui-action-btn new-ui-action-btn-lg"
              onClick={() => onEdit(slot)}
              title="Edit"
              aria-label="Edit message"
            >
              <IconEdit size={16} />
            </button>
            <button
              className="new-ui-action-btn new-ui-action-btn-lg"
              onClick={handleCopyClick}
              title={copied ? 'Copied!' : 'Copy'}
              aria-label={copied ? 'Copied!' : 'Copy message'}
            >
              {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
            </button>
          </div>
        </>
      ) : (
        <>
          <div style={iconClusterStyle}>
            <button
              className="new-ui-action-btn new-ui-action-btn-lg"
              onClick={handleCopyClick}
              title={copied ? 'Copied!' : 'Copy'}
              aria-label={copied ? 'Copied!' : 'Copy message'}
            >
              {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
            </button>
            <button
              className="new-ui-action-btn new-ui-action-btn-lg"
              onClick={() => onReadAloud(slot)}
              title={isSpeaking ? 'Stop reading' : 'Read aloud'}
              aria-label={isSpeaking ? 'Stop reading' : 'Read message aloud'}
            >
              {isSpeaking ? <IconPlayerStop size={16} /> : <IconVolume size={16} />}
            </button>
            <button
              className="new-ui-action-btn new-ui-action-btn-lg"
              onClick={handleGoodClick}
              title="Good response"
              aria-label="Mark as a good response"
              aria-pressed={currentRating === 'good'}
              style={currentRating === 'good' ? { color: 'var(--accent)' } : undefined}
            >
              {currentRating === 'good' ? <IconThumbUpFilled size={16} /> : <IconThumbUp size={16} />}
            </button>
            <button
              className="new-ui-action-btn new-ui-action-btn-lg"
              onClick={handleBadClick}
              title="Bad response"
              aria-label="Mark as a bad response"
              aria-pressed={currentRating === 'bad'}
              style={currentRating === 'bad' ? { color: 'var(--accent)' } : undefined}
            >
              {currentRating === 'bad' ? <IconThumbDownFilled size={16} /> : <IconThumbDown size={16} />}
            </button>
            <button
              className="new-ui-action-btn new-ui-action-btn-lg"
              onClick={() => onRetry(slot)}
              title="Retry"
              aria-label="Retry — regenerate response"
            >
              <IconRefresh size={16} />
            </button>
          </div>
          {timestampNode}
        </>
      )}

      {showFeedback && (
        <div
          className="new-ui-feedback-input"
          style={{
            position: 'absolute',
            top: '100%',
            left: slot.role === 'assistant' ? 0 : undefined,
            right: slot.role === 'user' ? 0 : undefined,
            marginTop: 6,
          }}
          onMouseEnter={() => onHoverChange(slot.key, true)}
        >
          <input
            autoFocus
            type="text"
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitFeedback();
              if (e.key === 'Escape') setShowFeedback(false);
            }}
            placeholder="What went wrong? (optional)"
          />
          <button onClick={submitFeedback} title="Submit feedback" aria-label="Submit feedback">
            <IconCheck size={14} />
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Component ───────────────────────────────────────────────────────────────

export const NewUIMessageActionsLayer: React.FC = () => {
  const {
    state: { messageIsStreaming, selectedConversation },
    handleUpdateSelectedConversation,
  } = useContext(HomeContext);

  const [slots, setSlots] = useState<Slot[]>([]);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [overlayEl, setOverlayEl] = useState<HTMLElement | null>(null);
  const speakingKeyRef = useRef<string | null>(null);

  const conversationRef = useRef<Conversation | undefined>(selectedConversation);
  conversationRef.current = selectedConversation;

  // ── Speech synthesis cleanup ──────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    if (messageIsStreaming && typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      speakingKeyRef.current = null;
    }
  }, [messageIsStreaming]);

  // ── Scan .chatcontainer and build slots (with layout positions) ────────────
  const scan = useCallback(() => {
    if (typeof document === 'undefined') return;
    const container = document.querySelector('.chatcontainer') as HTMLElement | null;
    if (!container || !conversationRef.current) return;

    const rendered = filterRenderedMessages(conversationRef.current.messages ?? []);
    const els = Array.from(
      container.querySelectorAll<HTMLElement>(
        '.enhanced-chat-message.user-message, .enhanced-chat-message.assistant-message',
      ),
    );

    const nextSlots: Slot[] = [];
    els.forEach((el, i) => {
      const message = rendered[i];
      if (!message) return; // DOM/state momentarily out of sync — skip until next scan
      const role: Role = el.classList.contains('assistant-message') ? 'assistant' : 'user';
      const key = message.id ?? `${role}-${i}`;
      el.setAttribute('data-new-ui-msg-key', key);
      const rawIndex = (conversationRef.current?.messages ?? []).indexOf(message);
      const pos = computePosition(el, role, container);
      nextSlots.push({ key, el, role, message, rawIndex, ...pos });
    });

    setSlots(nextSlots);
  }, []);

  // ── Attach: find container, create the absolute overlay, observe, scan ─────
  //
  // The overlay is a position:absolute; inset:0; pointer-events:none;
  // overflow:visible div portaled directly into .chatcontainer. Because it (and
  // its absolutely-positioned row children) live inside the scroller, they scroll
  // with the content for free — no scroll listeners anywhere in this component.
  useEffect(() => {
    let cleanupFn: (() => void) | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let overlay: HTMLDivElement | null = null;

    const attach = () => {
      const container = document.querySelector('.chatcontainer') as HTMLElement | null;
      if (!container) {
        retryTimer = setTimeout(attach, 200);
        return;
      }

      // Create (or reuse) the overlay host as a direct child of .chatcontainer.
      let existing = container.querySelector<HTMLDivElement>(':scope > .new-ui-actions-overlay');
      if (!existing) {
        existing = document.createElement('div');
        existing.className = 'new-ui-actions-overlay';
        existing.style.position = 'absolute';
        existing.style.inset = '0';
        existing.style.pointerEvents = 'none';
        existing.style.overflow = 'visible';
        container.appendChild(existing);
      }
      overlay = existing;
      setOverlayEl(existing);

      scan();

      const debouncedScan = () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(scan, 120);
      };

      // subtree:true — message elements + their content mutate a level or two
      // below .chatcontainer (streaming appends content blocks, markdown layer
      // injects hosts, images load). The 120ms debounce keeps this cheap.
      // We ignore mutations inside our own overlay to avoid a rescan loop.
      const observer = new MutationObserver((records) => {
        for (const r of records) {
          if (overlay && (overlay === r.target || overlay.contains(r.target as Node))) {
            continue;
          }
          debouncedScan();
          return;
        }
      });
      observer.observe(container, { childList: true, subtree: true });

      // A window resize changes the column width → row left/right edges. This is
      // a layout change (not a scroll), so recompute on a debounced resize. This
      // is intentionally NOT a scroll listener — the whole point of the rewrite.
      const onResize = () => debouncedScan();
      window.addEventListener('resize', onResize, { passive: true });

      cleanupFn = () => {
        observer.disconnect();
        window.removeEventListener('resize', onResize);
        if (debounceTimer) clearTimeout(debounceTimer);
        if (overlay && overlay.parentElement) overlay.parentElement.removeChild(overlay);
      };
    };

    attach();
    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      if (cleanupFn) cleanupFn();
    };
  }, [scan]);

  // Rescan whenever the message count or streaming state changes.
  const messageCount = selectedConversation?.messages?.length ?? 0;
  useEffect(() => {
    const t = setTimeout(scan, 100);
    return () => clearTimeout(t);
  }, [messageCount, messageIsStreaming, scan]);

  // ── Hover delegation (message → row) ──────────────────────────────────────
  //
  // Show a message's row when the pointer is over that message. Keep it alive
  // when the pointer moves onto the row itself (handleRowHoverChange). Because
  // the row now sits in the message's reserved padding-bottom region — only 6px
  // below the visible content and inside the same scroll container — the pointer
  // travel is tiny, so a short 200ms grace timer is plenty to bridge the gap
  // between leaving the message and entering the row.
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const container = document.querySelector('.chatcontainer') as HTMLElement | null;
    if (!container) return;

    const onMouseOver = (e: MouseEvent) => {
      if (messageIsStreaming) return;
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>('.enhanced-chat-message');
      const key = el?.getAttribute('data-new-ui-msg-key');
      if (!key) return;
      if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null; }
      setHoveredKey(key);
    };

    const onMouseOut = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const related = e.relatedTarget as HTMLElement | null;
      // Phase 35 Fix 3: ignore mouseout events that ORIGINATE inside the action
      // overlay (a row or one of its icon buttons). Because the rows are portaled
      // into .new-ui-actions-overlay — a real DOM child of .chatcontainer — their
      // native mouseout events bubble up to this container listener during
      // intra-row pointer movement (button → gap → button). Left unguarded, that
      // arms the hide timer even though the pointer is still on the row, and
      // nothing cancels it (the row's mouseenter/mouseleave don't re-fire for
      // child-to-child transitions). Row exit is now handled authoritatively by
      // the row container's own `mouseleave` (see handleRowHoverChange), so we
      // simply never treat an overlay-originated mouseout as "left the message."
      if (target && target.closest('.new-ui-actions-overlay')) return;
      // If the pointer is heading FROM the message toward its action row, keep
      // the row alive; the row's own mouseenter takes over from here.
      if (related && related.closest('.new-ui-actions-overlay')) return;
      const el = target?.closest<HTMLElement>('.enhanced-chat-message');
      if (el && related && el.contains(related)) return;
      hideTimerRef.current = setTimeout(() => {
        hideTimerRef.current = null;
        setHoveredKey(null);
      }, 200);
    };

    container.addEventListener('mouseover', onMouseOver);
    container.addEventListener('mouseout', onMouseOut);
    return () => {
      container.removeEventListener('mouseover', onMouseOver);
      container.removeEventListener('mouseout', onMouseOut);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [messageIsStreaming]);

  const handleRowHoverChange = useCallback((key: string, hovered: boolean) => {
    if (hovered) {
      // Pointer entered the row — cancel any pending hide timer.
      if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null; }
      setHoveredKey(key);
    } else {
      // Phase 35 Fix 3: this is now driven by `mouseleave` on the row container
      // div (see ActionRow's onMouseLeave). mouseleave does NOT bubble and does
      // NOT fire when the pointer moves between child buttons of the same row —
      // it only fires when the pointer genuinely exits the entire row container.
      // So the row's own leave no longer needs a grace timer: clear immediately.
      // (The old container-level onMouseOut delegation still uses its own 200ms
      // grace timer to bridge the DOM gap between the .enhanced-chat-message
      // element and the row while travelling toward it.)
      if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null; }
      setHoveredKey((prev) => (prev === key ? null : prev));
    }
  }, []);

  // ── Action handlers ───────────────────────────────────────────────────────

  const handleCopy = useCallback(async (slot: Slot): Promise<boolean> => {
    const text = extractMessageText(slot.el, slot.role);
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }, []);

  const handleEdit = useCallback((slot: Slot) => {
    if (slot.role !== 'user') return;
    const editBtn = slot.el.querySelector<HTMLButtonElement>('#editPrompt');
    editBtn?.click();
  }, []);

  const handleRetry = useCallback((slot: Slot) => {
    const targetUserEl = slot.role === 'user' ? slot.el : findPrecedingUserMessage(slot.el);
    if (targetUserEl) retryFromUserMessageEl(targetUserEl);
  }, []);

  const handleReadAloud = useCallback((slot: Slot) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    if (speakingKeyRef.current === slot.key) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      speakingKeyRef.current = null;
      return;
    }
    window.speechSynthesis.cancel();
    const text = extractMessageText(slot.el, 'assistant');
    if (!text.trim()) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => { setIsSpeaking(false); speakingKeyRef.current = null; };
    utterance.onerror = () => { setIsSpeaking(false); speakingKeyRef.current = null; };
    speakingKeyRef.current = slot.key;
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }, []);

  const handleRate = useCallback(
    (slot: Slot, rating: 'good' | 'bad' | null, feedback?: string) => {
      const conversation = conversationRef.current;
      if (!conversation) return;
      const idx = slot.rawIndex;
      if (idx < 0 || !conversation.messages[idx]) return;

      const updatedMessages = [...conversation.messages];
      updatedMessages[idx] = {
        ...updatedMessages[idx],
        data: {
          ...updatedMessages[idx].data,
          newUiRating: rating,
          newUiFeedback: feedback,
        },
      };
      handleUpdateSelectedConversation({ ...conversation, messages: updatedMessages });
    },
    [handleUpdateSelectedConversation],
  );

  // ── Render ────────────────────────────────────────────────────────────────

  if (!overlayEl || !slots.length) return null;

  // Rows are portaled into the overlay div living inside .chatcontainer, so they
  // share the scroller's coordinate system and scroll with the content for free.
  return createPortal(
    <>
      {slots.map((slot) => (
        <ActionRow
          key={slot.key}
          slot={slot}
          hovered={hoveredKey === slot.key}
          onHoverChange={handleRowHoverChange}
          onCopy={handleCopy}
          onEdit={handleEdit}
          onRetry={handleRetry}
          onReadAloud={handleReadAloud}
          isSpeaking={isSpeaking && speakingKeyRef.current === slot.key}
          onRate={handleRate}
        />
      ))}
    </>,
    overlayEl,
  );
};

export default NewUIMessageActionsLayer;
