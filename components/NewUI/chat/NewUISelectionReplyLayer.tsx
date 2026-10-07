import { IconArrowBackUp } from '@tabler/icons-react';
import React, {
  MutableRefObject,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { Message } from '@/types/chat';

import HomeContext from '@/pages/api/home/home.context';

const SELECTION_GAP = 8;
const EDGE_GAP = 8;

type ReplySelection = {
  text: string;
  sourceMessageId: string;
  root: HTMLElement;
  rect: DOMRect;
};

type ReplyPosition = { left: number; top: number };

function renderedMessages(messages: Message[]): Message[] {
  return messages.filter(
    (message) =>
      message.role !== 'tool' && !(message.data && message.data.actionResult),
  );
}

function rangeRect(range: Range): DOMRect {
  const rects = Array.from(range.getClientRects());
  if (rects.length === 0) return range.getBoundingClientRect();
  const left = Math.min(...rects.map((rect) => rect.left));
  const top = Math.min(...rects.map((rect) => rect.top));
  const right = Math.max(...rects.map((rect) => rect.right));
  const bottom = Math.max(...rects.map((rect) => rect.bottom));
  return new DOMRect(left, top, right - left, bottom - top);
}

function closestElement(node: Node | null): HTMLElement | null {
  if (node instanceof HTMLElement) return node;
  return node?.parentElement ?? null;
}

function isExcludedSelection(range: Range, root: HTMLElement): boolean {
  const excluded = root.querySelectorAll<HTMLElement>(
    'button, a, input, textarea, select, [role="button"], [contenteditable="true"], ' +
      '.new-ui-msg-action-row, .new-ui-selection-reply, .new-ui-sources, ' +
      '[data-nui-src-original], .new-ui-transcript-attachments',
  );
  return Array.from(excluded).some((element) => {
    try {
      return range.intersectsNode(element);
    } catch {
      return false;
    }
  });
}

function findSelection(
  shell: HTMLElement,
  messages: Message[],
): ReplySelection | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed)
    return null;

  const text = selection.toString().trim();
  if (!text) return null;

  const range = selection.getRangeAt(0);
  const startRoot = closestElement(range.startContainer)?.closest<HTMLElement>(
    '.enhanced-chat-message.assistant-message',
  );
  const endRoot = closestElement(range.endContainer)?.closest<HTMLElement>(
    '.enhanced-chat-message.assistant-message',
  );
  if (!startRoot || startRoot !== endRoot || !shell.contains(startRoot))
    return null;

  const contentRoot = startRoot.querySelector<HTMLElement>(
    '.assistantContentBlock, .enhanced-message-content',
  );
  if (
    !contentRoot ||
    !contentRoot.contains(range.startContainer) ||
    !contentRoot.contains(range.endContainer)
  ) {
    return null;
  }
  if (isExcludedSelection(range, startRoot)) return null;

  const messageElements = Array.from(
    shell.querySelectorAll<HTMLElement>(
      '.enhanced-chat-message.user-message, .enhanced-chat-message.assistant-message',
    ),
  );
  const index = messageElements.indexOf(startRoot);
  const message = index >= 0 ? messages[index] : undefined;
  if (!message || message.role !== 'assistant' || !message.id) return null;

  const rect = rangeRect(range);
  if (!rect.width && !rect.height) return null;
  const shellRect = shell.getBoundingClientRect();
  if (rect.bottom < shellRect.top || rect.top > shellRect.bottom) return null;

  return { text, sourceMessageId: message.id, root: startRoot, rect };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function calculatePosition(
  selectionRect: DOMRect,
  buttonRect: DOMRect,
  shellRect: DOMRect,
  chatRect: DOMRect,
  headerRect: DOMRect | null,
  composerRect: DOMRect | null,
): ReplyPosition {
  const minX =
    Math.max(shellRect.left, chatRect.left) - shellRect.left + EDGE_GAP;
  const maxX =
    Math.min(shellRect.right, chatRect.right) -
    shellRect.left -
    buttonRect.width -
    EDGE_GAP;
  const centeredX =
    selectionRect.left +
    selectionRect.width / 2 -
    shellRect.left -
    buttonRect.width / 2;
  const left = clamp(centeredX, minX, maxX);

  const topBound =
    Math.max(shellRect.top, chatRect.top, headerRect?.bottom ?? shellRect.top) +
    EDGE_GAP;
  const bottomBound =
    Math.min(
      shellRect.bottom,
      chatRect.bottom,
      composerRect?.top ?? shellRect.bottom,
    ) - EDGE_GAP;
  const above = selectionRect.top - buttonRect.height - SELECTION_GAP;
  const below = selectionRect.bottom + SELECTION_GAP;
  const preferredTop =
    above >= topBound ? above : below <= bottomBound ? below : above;
  const top = clamp(
    preferredTop - shellRect.top,
    topBound - shellRect.top,
    bottomBound - buttonRect.height - shellRect.top,
  );

  return { left, top };
}

export interface NewUISelectionReplyLayerProps {
  shellRef: MutableRefObject<HTMLDivElement | null>;
  selectionReplyRef: MutableRefObject<
    ((text: string, sourceMessageId?: string) => void) | null
  >;
  conversationId?: string;
}

export const NewUISelectionReplyLayer: React.FC<
  NewUISelectionReplyLayerProps
> = ({ shellRef, selectionReplyRef, conversationId }) => {
  const {
    state: { selectedConversation },
  } = useContext(HomeContext);
  const [selection, setSelection] = useState<ReplySelection | null>(null);
  const [position, setPosition] = useState<ReplyPosition | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pointerSelectingRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const selectionRef = useRef<ReplySelection | null>(null);
  selectionRef.current = selection;

  const clearSelection = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setSelection(null);
    setPosition(null);
  }, []);

  const inspectSelection = useCallback(() => {
    rafRef.current = null;
    const shell = shellRef.current;
    if (!shell) return clearSelection();
    const next = findSelection(
      shell,
      renderedMessages(selectedConversation?.messages ?? []),
    );
    if (!next) return clearSelection();
    setSelection(next);
    setPosition(null);
  }, [clearSelection, selectedConversation?.messages, shellRef]);

  const scheduleInspect = useCallback(() => {
    if (pointerSelectingRef.current || rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(inspectSelection);
  }, [inspectSelection]);

  useEffect(() => {
    const onSelectionChange = () => scheduleInspect();
    const onPointerDown = (event: PointerEvent) => {
      pointerSelectingRef.current = true;
      if (!buttonRef.current?.contains(event.target as Node)) clearSelection();
    };
    const onPointerUp = () => {
      pointerSelectingRef.current = false;
      scheduleInspect();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        clearSelection();
        window.getSelection()?.removeAllRanges();
        return;
      }
      if (event.shiftKey || event.key.startsWith('Arrow')) scheduleInspect();
    };

    document.addEventListener('selectionchange', onSelectionChange);
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('pointerup', onPointerUp, true);
    document.addEventListener('keyup', onKeyUp, true);
    return () => {
      document.removeEventListener('selectionchange', onSelectionChange);
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('pointerup', onPointerUp, true);
      document.removeEventListener('keyup', onKeyUp, true);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [clearSelection, scheduleInspect]);

  useEffect(() => {
    clearSelection();
  }, [clearSelection, conversationId]);

  // Chat.tsx still mounts the legacy Prompt/Fast Edit highlighter. The old
  // component is forbidden to edit, so suppress only its rendered popover
  // while this New UI layer is mounted. The selector is intentionally based on
  // its unique Prompt-mode title, not on generic absolute/z-index classes.
  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    const hideLegacyPopover = () => {
      shell
        .querySelectorAll<HTMLElement>(
          'button[title="Prompt will be added to the conversation thread"]',
        )
        .forEach((button) => {
          button.closest<HTMLElement>('div.absolute.z-50')?.setAttribute(
            'data-new-ui-legacy-highlighter',
            'true',
          );
        });
    };

    hideLegacyPopover();
    const observer = new MutationObserver(hideLegacyPopover);
    observer.observe(shell, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      shell
        .querySelectorAll<HTMLElement>('[data-new-ui-legacy-highlighter]')
        .forEach((element) =>
          element.removeAttribute('data-new-ui-legacy-highlighter'),
        );
    };
  }, [shellRef]);

  useEffect(() => {
    const shell = shellRef.current;
    const container = shell?.querySelector<HTMLElement>('.chatcontainer');
    if (!shell || !container) return;
    const onScroll = () => clearSelection();
    container.addEventListener('scroll', onScroll, { passive: true });
    const observer = new MutationObserver(() => {
      const current = selectionRef.current;
      if (
        !current ||
        !current.root.isConnected ||
        !shell.contains(current.root)
      )
        return;
      if (!current.root.classList.contains('assistant-message'))
        clearSelection();
    });
    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    return () => {
      container.removeEventListener('scroll', onScroll);
      observer.disconnect();
    };
  }, [clearSelection, shellRef, selectedConversation?.id]);

  useLayoutEffect(() => {
    if (!selection) return;
    const shell = shellRef.current;
    const button = buttonRef.current;
    const chat = shell?.querySelector<HTMLElement>('.chatcontainer');
    if (!shell || !button || !chat) return;
    const shellRect = shell.getBoundingClientRect();
    const header = shell.querySelector<HTMLElement>('.new-ui-header');
    const composer = shell.querySelector<HTMLElement>('.new-ui-composer-dock');
    setPosition(
      calculatePosition(
        selection.rect,
        button.getBoundingClientRect(),
        shellRect,
        chat.getBoundingClientRect(),
        header?.getBoundingClientRect() ?? null,
        composer?.getBoundingClientRect() ?? null,
      ),
    );
  }, [selection, shellRef]);

  useEffect(() => {
    if (!selection) return;
    const recompute = () => {
      const shell = shellRef.current;
      const button = buttonRef.current;
      const current = selectionRef.current;
      const chat = shell?.querySelector<HTMLElement>('.chatcontainer');
      if (!shell || !button || !chat || !current || !current.root.isConnected) {
        if (!current || !current.root.isConnected) clearSelection();
        return;
      }
      const nativeSelection = window.getSelection();
      const range = nativeSelection?.rangeCount
        ? nativeSelection.getRangeAt(0)
        : null;
      const rect = range ? rangeRect(range) : current.rect;
      if (!rect.width && !rect.height) return clearSelection();
      const header = shell.querySelector<HTMLElement>('.new-ui-header');
      const composer = shell.querySelector<HTMLElement>(
        '.new-ui-composer-dock',
      );
      setPosition(
        calculatePosition(
          rect,
          button.getBoundingClientRect(),
          shell.getBoundingClientRect(),
          chat.getBoundingClientRect(),
          header?.getBoundingClientRect() ?? null,
          composer?.getBoundingClientRect() ?? null,
        ),
      );
    };
    window.addEventListener('resize', recompute);
    const observer = new ResizeObserver(recompute);
    observer.observe(selection.root);
    if (shellRef.current) observer.observe(shellRef.current);
    return () => {
      window.removeEventListener('resize', recompute);
      observer.disconnect();
    };
  }, [clearSelection, selection, shellRef]);

  const handleReply = () => {
    const current = selectionRef.current;
    if (!current) return;
    const text = window.getSelection()?.toString().trim() || current.text;
    const sourceMessageId = current.sourceMessageId;
    selectionReplyRef.current?.(text, sourceMessageId);
    window.getSelection()?.removeAllRanges();
    clearSelection();
  };

  // Nothing mounted while idle: a full-bleed overlay must never sit over the
  // transcript unless there is a button to show.
  if (!selection) return null;

  return (
    <div className="new-ui-selection-reply-overlay">
      {selection && (
        <button
          ref={buttonRef}
          type="button"
          className="new-ui-selection-reply"
          aria-label="Reply with selected text"
          onMouseDown={(event) => event.preventDefault()}
          onClick={handleReply}
          style={
            position ? { left: position.left, top: position.top } : undefined
          }
        >
          <span>Reply</span>
          <IconArrowBackUp size={15} aria-hidden="true" />
        </button>
      )}
    </div>
  );
};
