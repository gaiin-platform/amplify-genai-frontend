/**
 * NewUITruncationNoticeLayer
 *
 * Shows a small notice under an assistant reply that stopped at the output-token
 * limit, with a Continue button when continuing can finish the thought. When the
 * reply has no text at all (reasoning used the whole budget) it says so instead of
 * leaving an empty message.
 *
 * What counts as truncated, and how sure we are, lives in `shared/responseTruncation`
 * (read its header: the stream does not carry a stop reason today, so most of the
 * time only the empty-answer case can be detected).
 *
 * Mechanics follow `NewUIToolStepsLayer`: ChatMessage.tsx is off-limits (§2), so a
 * host `<div data-nui-truncation-host>` is appended to each qualifying assistant
 * message's `#chatHover` and the notice is portalled into it. Rendered messages are
 * matched to DOM nodes by replaying Chat.tsx's own render filter.
 *
 * Continue sends a plain follow-up through ChatInput's hidden textarea + send button
 * (the composer's PATH B), so assistant routing, model, effort and token budget are
 * exactly those of a typed message — no second send path to keep in step.
 */

import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconAlertTriangle } from '@tabler/icons-react';

import HomeContext from '@/components/Home/home.context';
import { blockIfOtherChatGenerating } from '@/hooks/useChatSendService';
import {
  CONTINUE_PROMPT,
  getTruncation,
  Truncation,
  truncationCopy,
} from '@/components/NewUI/shared/responseTruncation';

const HOST_ATTR = 'data-nui-truncation-host';
const SCAN_THROTTLE_MS = 120;

interface Slot {
  key: string;
  host: HTMLElement;
  truncation: Truncation;
  isLast: boolean;
}

function setNativeValue(el: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
  if (!setter) return;
  setter.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

const sameSlots = (a: Slot[], b: Slot[]) =>
  a.length === b.length &&
  a.every(
    (s, i) =>
      s.key === b[i].key &&
      s.host === b[i].host &&
      s.isLast === b[i].isLast &&
      s.truncation.kind === b[i].truncation.kind &&
      s.truncation.reported === b[i].truncation.reported &&
      s.truncation.reasoned === b[i].truncation.reasoned,
  );

export const NewUITruncationNoticeLayer: React.FC = () => {
  const {
    state: { selectedConversation, messageIsStreaming },
  } = useContext(HomeContext);

  const [slots, setSlots] = useState<Slot[]>([]);

  const conversationRef = useRef(selectedConversation);
  conversationRef.current = selectedConversation;
  const streamingRef = useRef(!!messageIsStreaming);
  streamingRef.current = !!messageIsStreaming;

  const scan = useCallback(() => {
    if (typeof document === 'undefined') return;
    const container = document.querySelector('.chatcontainer') as HTMLElement | null;
    const conversation = conversationRef.current;
    if (!container || !conversation) return;

    // Chat.tsx's render filter, replayed so Nth rendered message ↔ Nth DOM node.
    const all = Array.isArray(conversation.messages) ? conversation.messages : [];
    const rendered = all
      .map((message, index) => ({ message, index }))
      .filter(({ message }) => message.role !== 'tool' && !(message.data && message.data.actionResult));

    const els = Array.from(
      container.querySelectorAll<HTMLElement>(
        '.enhanced-chat-message.user-message, .enhanced-chat-message.assistant-message',
      ),
    );

    const next: Slot[] = [];
    const keep = new Set<HTMLElement>();
    // The DOM can lag the state by one commit (§35): if the counts disagree, don't guess.
    if (els.length === rendered.length) {
      els.forEach((el, i) => {
        const entry = rendered[i];
        if (!entry || entry.message.role !== 'assistant' || !el.classList.contains('assistant-message')) return;

        const isLast = entry.index === all.length - 1;
        const truncation = getTruncation(entry.message, { isLast, isStreaming: streamingRef.current });
        if (!truncation) return;

        const hover = el.querySelector<HTMLElement>('#chatHover');
        if (!hover) return;

        let host = hover.querySelector<HTMLElement>(`:scope > [${HOST_ATTR}]`);
        if (!host) {
          host = document.createElement('div');
          host.setAttribute(HOST_ATTR, 'true');
        }
        // Keep it as the last child, i.e. under everything the message renders.
        if (hover.lastElementChild !== host) hover.appendChild(host);
        keep.add(host);
        next.push({ key: `${conversation.id}:${entry.index}`, host, truncation, isLast });
      });
    } else {
      return; // leave the current slots; the next mutation re-scans
    }

    // A reply that no longer qualifies (a new turn started) must lose its host.
    container.querySelectorAll<HTMLElement>(`[${HOST_ATTR}]`).forEach((h) => {
      if (!keep.has(h)) h.parentElement?.removeChild(h);
    });

    setSlots((prev) => (sameSlots(prev, next) ? prev : next));
  }, []);

  useEffect(() => {
    let cleanup: (() => void) | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let scanTimer: ReturnType<typeof setTimeout> | null = null;

    // Throttled, not debounced: the transcript mutates every few ms while streaming.
    const schedule = () => {
      if (scanTimer) return;
      scanTimer = setTimeout(() => {
        scanTimer = null;
        scan();
      }, SCAN_THROTTLE_MS);
    };

    const attach = () => {
      const container = document.querySelector('.chatcontainer') as HTMLElement | null;
      if (!container) {
        retryTimer = setTimeout(attach, 200);
        return;
      }
      scan();
      const observer = new MutationObserver((records) => {
        for (const r of records) {
          if (r.target instanceof HTMLElement && r.target.closest(`[${HOST_ATTR}]`)) continue;
          schedule();
          return;
        }
      });
      observer.observe(container, { childList: true, subtree: true });
      cleanup = () => {
        observer.disconnect();
        container.querySelectorAll(`[${HOST_ATTR}]`).forEach((h) => h.parentElement?.removeChild(h));
      };
    };

    attach();
    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      if (scanTimer) clearTimeout(scanTimer);
      cleanup?.();
    };
  }, [scan]);

  // A new message, or a stream starting/stopping, changes who needs a notice.
  const messages = selectedConversation?.messages;
  const lastMessage = Array.isArray(messages) ? messages[messages.length - 1] : undefined;
  useEffect(() => {
    const t = setTimeout(scan, SCAN_THROTTLE_MS);
    return () => clearTimeout(t);
  }, [
    scan,
    selectedConversation?.id,
    Array.isArray(messages) ? messages.length : -1,
    lastMessage?.content,
    lastMessage?.data?.state,
    messageIsStreaming,
  ]);

  const conversationId = selectedConversation?.id;
  const handleContinue = useCallback(() => {
    if (streamingRef.current) return;
    if (blockIfOtherChatGenerating(conversationId)) return;
    const textarea = document.getElementById('messageChatInputText') as HTMLTextAreaElement | null;
    const send = document.getElementById('sendMessage') as HTMLButtonElement | null;
    if (!textarea || !send) return;
    setNativeValue(textarea, CONTINUE_PROMPT);
    // Same settle delay the composer uses before clicking the hidden send.
    setTimeout(() => send.click(), 60);
  }, [conversationId]);

  return (
    <>
      {slots.map((slot) =>
        createPortal(
          <TruncationNotice
            key={slot.key}
            truncation={slot.truncation}
            canContinue={slot.isLast && !messageIsStreaming}
            onContinue={handleContinue}
          />,
          slot.host,
          slot.key,
        ),
      )}
    </>
  );
};

const TruncationNotice: React.FC<{
  truncation: Truncation;
  canContinue: boolean;
  onContinue: () => void;
}> = ({ truncation, canContinue, onContinue }) => {
  const copy = useMemo(() => truncationCopy(truncation), [truncation]);
  return (
    <div
      role="status"
      data-nui-truncation-notice={truncation.kind}
      className="not-prose mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border px-3 py-2 text-[13px] leading-5"
      style={{
        borderColor: 'var(--border-subtle)',
        background: 'var(--bg-raised)',
        color: 'var(--text-secondary)',
      }}
    >
      <IconAlertTriangle size={15} stroke={1.75} aria-hidden="true" className="shrink-0" />
      <span className="min-w-0 flex-1">{copy.message}</span>
      {copy.continueLabel && canContinue && (
        <button
          type="button"
          onClick={onContinue}
          className="shrink-0 rounded-md px-2.5 py-1 text-[13px] font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{
            background: 'var(--accent)',
            color: 'var(--accent-fg)',
            outlineColor: 'var(--accent)',
          }}
        >
          {copy.continueLabel}
        </button>
      )}
    </div>
  );
};

export default NewUITruncationNoticeLayer;
