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
      const attachments = bubble?.querySelector<HTMLElement>(
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

      // The legacy image face is a div. Give it the same keyboard affordance
      // as the existing click target without changing its React implementation.
      host
        .querySelectorAll<HTMLElement>(
          '.rounded-lg.shadow-lg.overflow-hidden.relative',
        )
        .forEach((card) => {
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
