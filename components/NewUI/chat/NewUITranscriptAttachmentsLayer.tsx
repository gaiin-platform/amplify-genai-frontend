/**
 * Moves the existing post-send DataSourcesBlock out of user message bubbles.
 *
 * ChatMessage/DataSourcesBlock are classic UI components and intentionally
 * remain untouched. Moving their rendered node keeps their existing preview,
 * download, loading, and metadata behavior while giving the New UI an
 * independent attachment surface above the text bubble.
 */
import React, { useCallback, useContext, useEffect, useRef } from 'react';

import { Message } from '@/types/chat';

import HomeContext from '@/pages/api/home/home.context';

function renderedMessages(messages: Message[]): Message[] {
  return messages.filter(
    (message) =>
      message.role !== 'tool' && !(message.data && message.data.actionResult),
  );
}

/** Thumbnail edge length in the transcript rail (classic UI renders 200px). */
const CARD_WIDTH = 144;
const CARD_HEIGHT = 136;
/** Space between the attachment rail and the text bubble below it. */
const RAIL_TO_BUBBLE_GAP = 6;

/**
 * Writes declarations at `!important` priority.
 *
 * DataSourcesBlock hard-codes `width: 200px; height: 200px` as a React inline
 * style on the card and relies on Tailwind margin utilities (`mr-3 mb-3`) on the
 * wrappers. A stylesheet rule can beat the inline style, but only if its
 * selector matches — and the classic UI markup those selectors depend on is not
 * ours to keep stable. Writing the geometry straight onto the element removes
 * that dependency: an `!important` inline declaration is the top of the cascade,
 * so the rail lands on exact pixels regardless of which utility classes survive.
 */
function force(element: HTMLElement, declarations: Record<string, string>): void {
  Object.entries(declarations).forEach(([property, value]) => {
    element.style.setProperty(property, value, 'important');
  });
}

function middleEllipsis(value: string, maxLength = 30): string {
  if (value.length <= maxLength) return value;
  const extensionIndex = value.lastIndexOf('.');
  const extension = extensionIndex > 0 ? value.slice(extensionIndex) : '';
  const stem = extension ? value.slice(0, extensionIndex) : value;
  const available = Math.max(1, maxLength - extension.length - 1);
  const left = Math.ceil(available / 2);
  const right = Math.floor(available / 2);
  return `${stem.slice(0, left)}…${stem.slice(-right)}${extension}`;
}

export const NewUITranscriptAttachmentsLayer: React.FC = () => {
  const {
    state: { selectedConversation },
  } = useContext(HomeContext);
  const conversationRef = useRef(selectedConversation);
  conversationRef.current = selectedConversation;

  const scan = useCallback(() => {
    const container = document.querySelector('.chatcontainer');
    const conversation = conversationRef.current;
    if (!container || !conversation) return;

    const messages = renderedMessages(conversation.messages ?? []);
    const messageElements = Array.from(
      container.querySelectorAll<HTMLElement>('.enhanced-chat-message'),
    );

    messageElements.forEach((messageElement, index) => {
      const message = messages[index];
      if (!message || !messageElement.classList.contains('user-message'))
        return;

      const content = messageElement.querySelector<HTMLElement>(
        '.enhanced-message-content',
      );
      const bubble = messageElement.querySelector<HTMLElement>('#chatHover');
      // Scoped to the message, not the bubble: after the first pass the block
      // lives in the sibling host, and every later pass must still find it so
      // React re-renders (image loads, spinner teardown) get re-normalized.
      const attachments = messageElement.querySelector<HTMLElement>(
        '.mt-5.text-gray-800',
      );
      if (!content || !bubble || !attachments) return;

      let host = content.querySelector<HTMLElement>(
        ':scope > .new-ui-transcript-attachments',
      );
      if (!host) {
        host = document.createElement('div');
        host.className = 'new-ui-transcript-attachments';
        content.insertBefore(host, bubble);
      }

      if (attachments.parentElement !== host) host.appendChild(attachments);
      messageElement.classList.add('new-ui-has-attachments');

      const hasText = Boolean((message.label ?? message.content ?? '').trim());
      messageElement.classList.toggle('new-ui-attachments-only', !hasText);

      // ── Geometry: one flush right edge, one small gap ────────────────────
      // The rail shrink-wraps its thumbnails and pins to the column's right
      // edge, which is where the bubble's right edge also sits.
      force(host, {
        'align-self': 'flex-end',
        display: 'flex',
        'justify-content': 'flex-end',
        'flex-wrap': 'wrap',
        // No text bubble below means no gap to open up.
        margin: `0 0 ${hasText ? RAIL_TO_BUBBLE_GAP : 0}px 0`,
        padding: '0',
        width: 'fit-content',
        'max-width': '100%',
      });
      // The bubble supplies no top margin of its own; the rail owns the gap.
      force(bubble, { 'margin-top': '0' });
      // `mt-5 w-full` on the moved block would reintroduce a block-level gap
      // and stretch the rail past its thumbnails.
      force(attachments, {
        margin: '0',
        padding: '0',
        width: 'auto',
        'max-width': '100%',
      });

      const grid = attachments.querySelector<HTMLElement>(
        ':scope > .flex.flex-wrap',
      );
      if (grid) {
        force(grid, {
          display: 'flex',
          'flex-wrap': 'wrap',
          'justify-content': 'flex-end',
          gap: '8px',
          margin: '0',
          padding: '0',
        });

        // Wrapper divs keep `mr-3 mb-3` and shrink-wrap around the 200px card.
        // Pinning them to the card's real size is what removes the dead space
        // on the right of and below the thumbnail.
        grid
          .querySelectorAll<HTMLElement>(':scope > div')
          .forEach((item) => {
            force(item, {
              margin: '0',
              padding: '0',
              flex: '0 0 auto',
              width: `${CARD_WIDTH}px`,
              height: `${CARD_HEIGHT}px`,
            });
            const inner = item.querySelector<HTMLElement>(':scope > .relative');
            if (inner) {
              force(inner, {
                margin: '0',
                padding: '0',
                display: 'block',
                width: `${CARD_WIDTH}px`,
                height: `${CARD_HEIGHT}px`,
              });
            }
          });
      }

      // The "Included documents:" caption is redundant once the thumbnails read
      // as part of the message, and it is the tallest slice of the stray gap.
      Array.from(attachments.children).forEach((child) => {
        if (
          child !== grid &&
          child instanceof HTMLElement &&
          child.classList.contains('mr-3')
        ) {
          force(child, { display: 'none' });
        }
      });

      // The legacy image face is a div. Give it the same keyboard affordance
      // as the existing click target without changing its React implementation.
      host
        .querySelectorAll<HTMLElement>(
          '.rounded-lg.shadow-lg.overflow-hidden.relative',
        )
        .forEach((card) => {
          // Overrides the component's own 200px inline width/height.
          force(card, {
            margin: '0',
            padding: '0',
            width: `${CARD_WIDTH}px`,
            height: `${CARD_HEIGHT}px`,
          });
          card.setAttribute('role', 'button');
          card.setAttribute('tabindex', '0');
          const label = card.querySelector<HTMLElement>(
            '.absolute.bottom-0.left-0.right-0',
          );
          const name = label?.textContent?.replace(/^\s*\d+\.\s*/, '').trim();
          if (name) {
            card.setAttribute('aria-label', `Open attachment ${name}`);
            if (label && label.textContent !== middleEllipsis(name))
              label.textContent = middleEllipsis(name);
          }
          if (!card.dataset.newUiKeyboard) {
            card.dataset.newUiKeyboard = 'true';
            card.addEventListener('keydown', (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                card.click();
              }
            });
          }
        });
    });
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

  useEffect(() => {
    const timer = setTimeout(scan, 100);
    return () => clearTimeout(timer);
  }, [selectedConversation?.messages?.length, scan]);

  return null;
};

export default NewUITranscriptAttachmentsLayer;
