/**
 * Renders sent pasted-text blocks as attachment chips above the user bubble.
 *
 * ── Why ────────────────────────────────────────────────────────────────────
 * A large paste travels on the message as `data.largeTextBlocks` — never as a
 * `dataSource` — so none of the machinery that gives files and images their
 * transcript treatment ever sees it. `ChatMessage.renderMessageWithLargeText`
 * (classic UI, Section 2 — not ours to edit) instead substitutes each
 * `[TEXT_n]` placeholder in the label with a `LargeTextDisplay` panel *inside*
 * `#userMessage`: a full-width metadata header, a "Show full text" disclosure,
 * and a 500-character verbatim reprint of the paste. That reprint restates the
 * text the chip is already named after, and it pushes the response below the
 * fold before the user has read a word of it.
 *
 * ── What this does ─────────────────────────────────────────────────────────
 * The composer rail already presents a paste correctly — `shared/AttachmentCard`
 * with `kind: 'paste'` gives a fixed-size card holding a few faded lines of
 * preview and a PASTED badge, and clicking it opens `shared/AttachmentPreview`.
 * This layer puts a sent paste through that same pair:
 *
 *   1. reuse (or create) the `.new-ui-transcript-attachments` host that
 *      `NewUITranscriptAttachmentsLayer` inserts before `#chatHover`, so paste
 *      chips and moved file/image cards share one right-aligned rail;
 *   2. portal a chip per block into that host, sized to match the moved classic
 *      cards;
 *   3. open `AttachmentPreview` on click — line count, character count and the
 *      full text live there, not in the transcript;
 *   4. mark the message so `conversation-view.css` can hide the classic panel
 *      (and the bubble itself, when the paste was sent with no prompt text).
 *
 * The prompt text stays the bubble's alone: `NewUIUserMessageMarkdownLayer`
 * renders it with the `[TEXT_n]` placeholders stripped.
 *
 * Chips are portalled rather than moved (compare `NewUITranscriptAttachmentsLayer`,
 * which relocates classic DOM) because there is no classic node worth keeping —
 * the data is on the message, so we can render the real component instead.
 */
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { Message } from '@/types/chat';
import HomeContext from '@/pages/api/home/home.context';
import { AttachmentCard } from '@/components/NewUI/shared/AttachmentCard';
import { AttachmentPreview } from '@/components/NewUI/shared/AttachmentPreview';
import {
  LargeTextBlockLike,
  UIAttachment,
  createUIAttachmentFromLargeTextBlock,
  stripLargeTextPlaceholders,
} from '@/components/NewUI/shared/attachmentTypes';

/** Matches the moved classic cards in NewUITranscriptAttachmentsLayer. */
const CHIP_WIDTH = 144;
const CHIP_HEIGHT = 136;

/** Mirrors Chat.tsx's render-time filter so DOM order matches message order. */
function renderedMessages(messages: Message[]): Message[] {
  return messages.filter(
    (message) =>
      message.role !== 'tool' && !(message.data && message.data.actionResult),
  );
}

function largeTextBlocksOf(message: Message): LargeTextBlockLike[] {
  const data = message.data as any;
  if (!data?.hasLargeText) return [];
  const blocks = data.largeTextBlocks;
  return Array.isArray(blocks) ? (blocks as LargeTextBlockLike[]) : [];
}

interface HostEntry {
  key: string;
  hostEl: HTMLElement;
  attachments: UIAttachment[];
}

interface PreviewState {
  attachments: UIAttachment[];
  initialIndex: number;
  originRect?: DOMRect;
}

// ─── One message's chip row ───────────────────────────────────────────────────

interface PastedChipsProps {
  attachments: UIAttachment[];
  onPreview: (index: number, originRect: DOMRect) => void;
}

const PastedChips: React.FC<PastedChipsProps> = ({ attachments, onPreview }) => (
  <ul
    role="list"
    aria-label={`${attachments.length} pasted text attachment${
      attachments.length !== 1 ? 's' : ''
    }`}
    className="flex flex-wrap items-start justify-end gap-[8px]"
    style={{ margin: 0, padding: 0, listStyle: 'none' }}
  >
    {attachments.map((attachment, index) => (
      <AttachmentCard
        key={attachment.id}
        attachment={attachment}
        width={CHIP_WIDTH}
        height={CHIP_HEIGHT}
        readOnly
        onPreview={(_id, originRect) => onPreview(index, originRect)}
      />
    ))}
  </ul>
);

// ─── Layer ────────────────────────────────────────────────────────────────────

export const NewUITranscriptPastedTextLayer: React.FC = () => {
  const {
    state: { selectedConversation },
  } = useContext(HomeContext);
  const conversationRef = useRef(selectedConversation);
  conversationRef.current = selectedConversation;

  const [entries, setEntries] = useState<HostEntry[]>([]);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  /**
   * The last committed entry set. The MutationObserver below fires on every
   * streamed token, and committing an equal set would remount every chip
   * (losing hover state, restarting the entry transition) for no visual change.
   *
   * Host identity is part of the comparison, not just the block ids: when React
   * unmounts and remounts a message subtree it takes our host with it, and the
   * committed portal target would otherwise stay pointed at the detached node.
   */
  const committedRef = useRef<HostEntry[]>([]);

  const scan = useCallback(() => {
    if (typeof document === 'undefined') return;
    const container = document.querySelector('.chatcontainer');
    const conversation = conversationRef.current;
    if (!container || !conversation) return;

    const messages = renderedMessages(conversation.messages ?? []);
    const messageElements = Array.from(
      container.querySelectorAll<HTMLElement>('.enhanced-chat-message'),
    );

    const next: HostEntry[] = [];

    messageElements.forEach((messageElement, index) => {
      const message = messages[index];
      if (!message || !messageElement.classList.contains('user-message')) return;

      const blocks = largeTextBlocksOf(message);
      if (blocks.length === 0) {
        messageElement.classList.remove('new-ui-has-pastes', 'new-ui-paste-only');
        return;
      }

      const content = messageElement.querySelector<HTMLElement>(
        '.enhanced-message-content',
      );
      const bubble = messageElement.querySelector<HTMLElement>('#chatHover');
      if (!content || !bubble) return;

      // Shared with NewUITranscriptAttachmentsLayer: whichever layer runs first
      // creates the rail, and both then find it. Keeping one host means a
      // message with both a file and a paste renders one row, not two.
      let host = content.querySelector<HTMLElement>(
        ':scope > .new-ui-transcript-attachments',
      );
      if (!host) {
        host = document.createElement('div');
        host.className = 'new-ui-transcript-attachments';
        content.insertBefore(host, bubble);
      }

      let chipHost = host.querySelector<HTMLElement>(
        ':scope > .new-ui-transcript-pastes',
      );
      if (!chipHost) {
        chipHost = document.createElement('div');
        chipHost.className = 'new-ui-transcript-pastes';
        host.appendChild(chipHost);
      } else if (host.lastElementChild !== chipHost) {
        // The other layer appended the classic block after us. Move once so the
        // order is always files-then-pastes; its own move is guarded, so this
        // settles rather than ping-ponging.
        host.appendChild(chipHost);
      }

      messageElement.classList.add('new-ui-has-pastes', 'new-ui-has-attachments');

      // A paste sent with no typed prompt leaves an empty bubble once the
      // placeholders are stripped — CSS collapses it away.
      const bubbleText = stripLargeTextPlaceholders(
        message.label ?? message.content ?? '',
      );
      messageElement.classList.toggle('new-ui-paste-only', !bubbleText);

      next.push({
        key: message.id ?? `paste-message-${index}`,
        hostEl: chipHost,
        attachments: blocks.map(createUIAttachmentFromLargeTextBlock),
      });
    });

    const previous = committedRef.current;
    const unchanged =
      previous.length === next.length &&
      next.every((entry, index) => {
        const before = previous[index];
        return (
          before !== undefined &&
          before.key === entry.key &&
          before.hostEl === entry.hostEl &&
          before.hostEl.isConnected &&
          before.attachments.length === entry.attachments.length &&
          before.attachments.every((a, i) => a.id === entry.attachments[i].id)
        );
      });
    if (unchanged) return;

    committedRef.current = next;
    setEntries(next);
  }, []);

  useEffect(() => {
    let retry: ReturnType<typeof setTimeout> | undefined;
    let debounce: ReturnType<typeof setTimeout> | undefined;
    let observer: MutationObserver | undefined;

    const attach = () => {
      const container = document.querySelector('.chatcontainer');
      if (!container) {
        retry = setTimeout(attach, 200);
        return;
      }
      scan();
      observer = new MutationObserver(() => {
        if (debounce) clearTimeout(debounce);
        debounce = setTimeout(scan, 80);
      });
      observer.observe(container, { childList: true, subtree: true });
    };

    attach();
    return () => {
      if (retry) clearTimeout(retry);
      if (debounce) clearTimeout(debounce);
      observer?.disconnect();
    };
  }, [scan]);

  // Backstop for the observer, matching the sibling transcript layers: a
  // conversation switch or a newly sent message settles within one tick.
  useEffect(() => {
    const timer = setTimeout(scan, 100);
    return () => clearTimeout(timer);
  }, [selectedConversation?.id, selectedConversation?.messages?.length, scan]);

  const openPreview = useMemo(
    () =>
      (attachments: UIAttachment[]) =>
      (initialIndex: number, originRect: DOMRect) => {
        setPreview({ attachments, initialIndex, originRect });
      },
    [],
  );

  return (
    <>
      {entries.map(({ key, hostEl, attachments }) =>
        createPortal(
          <PastedChips
            attachments={attachments}
            onPreview={openPreview(attachments)}
          />,
          hostEl,
          key,
        ),
      )}

      {preview && (
        <AttachmentPreview
          attachments={preview.attachments}
          initialIndex={preview.initialIndex}
          originRect={preview.originRect}
          onClose={() => setPreview(null)}
        />
      )}
    </>
  );
};

export default NewUITranscriptPastedTextLayer;
