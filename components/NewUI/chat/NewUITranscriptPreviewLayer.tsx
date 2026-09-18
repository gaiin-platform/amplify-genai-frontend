/**
 * Routes post-send attachment previews through the New UI `AttachmentPreview`.
 *
 * ── Why ────────────────────────────────────────────────────────────────────
 * Clicking an attachment card in the transcript opens `ImageModal`, which lives
 * inside `DataSourcesBlock` (classic UI, Section 2 — not ours to edit). That
 * modal renders as a child of the same `.mt-5.text-gray-800` block
 * `NewUITranscriptAttachmentsLayer` relocates, so it always mounts **inside
 * `.chatcontainer`** — which carries a top-fade `mask-image` at `!important`.
 *
 * A mask clips its whole subtree's paint (including `position: fixed`
 * descendants) *and* establishes a stacking context. Because `.chatcontainer`
 * is itself `z-index: auto`, every z-index inside it collapses into one flat
 * band, so the composer (z 25), jump-to-latest (z 28) and header (z 30) — all
 * positioned siblings one level up — paint over the preview no matter what
 * z-index it asks for. Neutralising the mask from the outside was tried and is
 * not a real fix: the modal is simply in the wrong place in the tree.
 *
 * ── What this does ─────────────────────────────────────────────────────────
 * The pre-send composer and the new-chat screen already have a preview that
 * gets this right — `shared/AttachmentPreview`, which portals to
 * `document.body`, traps focus, and closes on Escape / backdrop click. This
 * layer makes the transcript use that same component:
 *
 *   1. suppress the classic modal the instant it mounts (a MutationObserver
 *      callback is a microtask, so this lands *before* paint — no flash);
 *   2. read the full-size image URL and filename straight off it;
 *   3. render `AttachmentPreview` with the images from that message, so ← / →
 *      navigate the message's attachments exactly like the composer rail;
 *   4. on close, click the classic modal's own close button so its internal
 *      `selectedImage` state resets and the card can be opened again.
 *
 * Mirroring the classic modal (rather than intercepting the card click) is
 * deliberate: it is a single code path that catches every way the modal can be
 * opened, and its `<img src>` is the authoritative full-size URL that
 * `DataSourcesBlock` resolved — not a thumbnail we guessed at.
 *
 * Re-parenting the classic modal's DOM node was rejected: React records the
 * parent it inserted into and calls `parent.removeChild(node)` on unmount, so
 * moving it to `document.body` makes *closing* the preview throw
 * `NotFoundError`. (That is why `NewUITranscriptAttachmentsLayer` only ever
 * moves nodes *within* the message subtree React deletes as a whole.)
 */
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';

import { Message } from '@/types/chat';
import HomeContext from '@/pages/api/home/home.context';
import { AttachmentPreview } from '@/components/NewUI/shared/AttachmentPreview';
import {
  UIAttachment,
  createUIAttachmentFromDoc,
  getAttachmentMime,
} from '@/components/NewUI/shared/attachmentTypes';

/** Classic `ImageModal` root: `fixed inset-0 z-50 flex items-center …`. */
const LEGACY_MODAL_SELECTOR = '.fixed.inset-0.z-50';
/** Classic attachment card root inside `DataSourcesBlock`. */
const CARD_SELECTOR = '.rounded-lg.shadow-lg.overflow-hidden.relative';
/** The clickable image face; absent on non-image cards. */
const FACE_SELECTOR = '.absolute.inset-0.bg-cover.bg-center';

interface PreviewState {
  attachments: UIAttachment[];
  initialIndex: number;
  originRect?: DOMRect;
}

/** Mirrors NewUITranscriptAttachmentsLayer so DOM order matches message order. */
function renderedMessages(messages: Message[]): Message[] {
  return messages.filter(
    (message) =>
      message.role !== 'tool' && !(message.data && message.data.actionResult),
  );
}

/** Pulls the URL out of a computed `background-image` value. */
function cssUrl(value: string): string | undefined {
  const match = /url\((['"]?)(.*?)\1\)/.exec(value);
  const url = match?.[2];
  return url && url !== 'none' ? url : undefined;
}

export const NewUITranscriptPreviewLayer: React.FC = () => {
  const {
    state: { selectedConversation },
  } = useContext(HomeContext);
  const conversationRef = useRef(selectedConversation);
  conversationRef.current = selectedConversation;

  const [preview, setPreview] = useState<PreviewState | null>(null);
  /** The classic modal we are currently mirroring. */
  const mirroredRef = useRef<HTMLElement | null>(null);
  /** Rect of the last card the user activated — drives the FLIP entrance. */
  const originRectRef = useRef<DOMRect | undefined>(undefined);

  /**
   * Builds the attachment list for the message that owns `modal`.
   *
   * `DataSourcesBlock` renders one card per data source in order, so a card's
   * index within the message is its index into `dataSources` — that gives us
   * the real name, size and mime via the shared `createUIAttachmentFromDoc`
   * helper. The image URL itself only exists in the DOM (the blob is resolved
   * inside the classic component), so it is passed in as the thumb URL.
   */
  const build = useCallback((modal: HTMLElement): PreviewState | null => {
    const img = modal.querySelector('img');
    const openedSrc = img?.src ?? '';
    const openedName = img?.getAttribute('alt') ?? 'Attachment';

    const host = modal.closest<HTMLElement>('.new-ui-transcript-attachments');
    const messageEl = modal.closest<HTMLElement>('.enhanced-chat-message');
    const container = document.querySelector<HTMLElement>('.chatcontainer');

    // Resolve the owning message to recover the underlying data sources.
    let docs: any[] = [];
    if (container && messageEl) {
      const all = Array.from(
        container.querySelectorAll<HTMLElement>('.enhanced-chat-message'),
      );
      const index = all.indexOf(messageEl);
      const message = renderedMessages(conversationRef.current?.messages ?? [])[
        index
      ];
      docs = message?.data?.dataSources ?? [];
    }

    const attachments: UIAttachment[] = [];
    let initialIndex = -1;

    const cards = host ? Array.from(host.querySelectorAll<HTMLElement>(CARD_SELECTOR)) : [];
    cards.forEach((card, i) => {
      const face = card.querySelector<HTMLElement>(FACE_SELECTOR);
      if (!face) return; // non-image card — no preview to show
      const url = cssUrl(getComputedStyle(face).backgroundImage);
      if (!url) return;

      const doc = docs[i];
      // Only trust the positional match if it really is an image; otherwise
      // fall back to the DOM so a drifted index can't mislabel the preview.
      const docIsImage =
        doc?.name && getAttachmentMime(doc.name, doc.type).startsWith('image/');

      if (docIsImage) {
        attachments.push(createUIAttachmentFromDoc(doc, 1, url));
      } else {
        const label = card.getAttribute('aria-label') ?? '';
        const name =
          label.replace(/^Open attachment\s*/, '').trim() || openedName;
        attachments.push({
          id: `transcript-attachment-${i}-${name}`,
          kind: 'image',
          status: 'ready',
          name,
          ext: null,
          bytes: 0,
          mime: getAttachmentMime(name),
          thumbUrl: url,
          previewState: 'available',
        });
      }

      if (url === openedSrc) initialIndex = attachments.length - 1;
    });

    // Couldn't line the opened image up with a card — show it on its own rather
    // than opening the wrong attachment.
    if (initialIndex < 0) {
      if (!openedSrc) return null;
      return {
        attachments: [
          {
            id: `transcript-attachment-${openedName}`,
            kind: 'image',
            status: 'ready',
            name: openedName,
            ext: null,
            bytes: 0,
            mime: getAttachmentMime(openedName),
            thumbUrl: openedSrc,
            previewState: 'available',
          },
        ],
        initialIndex: 0,
        originRect: originRectRef.current,
      };
    }

    return { attachments, initialIndex, originRect: originRectRef.current };
  }, []);

  /** Closes our preview and resets the classic component's own state. */
  const close = useCallback(() => {
    setPreview(null);
    const modal = mirroredRef.current;
    mirroredRef.current = null;
    originRectRef.current = undefined;
    if (!modal?.isConnected) return;
    // Its close button (and its backdrop) call setSelectedImage(null). Without
    // this the classic state stays latched and clicking the same card again
    // produces no state change, so no mutation, so no reopen.
    const closeButton = modal.querySelector('button');
    if (closeButton) closeButton.click();
    else modal.click();
  }, []);

  const sync = useCallback(() => {
    const container = document.querySelector<HTMLElement>('.chatcontainer');
    const modal = container?.querySelector<HTMLElement>(LEGACY_MODAL_SELECTOR) ?? null;

    if (!modal) {
      // Closed from the classic side (its own Escape handler) — follow it.
      if (mirroredRef.current) {
        mirroredRef.current = null;
        originRectRef.current = undefined;
        setPreview(null);
      }
      return;
    }

    // Suppress before paint. Inline `!important` is the top of the cascade, so
    // this holds regardless of the classic component's own classes.
    modal.style.setProperty('display', 'none', 'important');
    modal.setAttribute('aria-hidden', 'true');

    if (modal === mirroredRef.current) return;
    mirroredRef.current = modal;
    setPreview(build(modal));
  }, [build]);

  // Record the origin rect before React opens the classic modal, so the FLIP
  // entrance expands from the card the user actually activated.
  useEffect(() => {
    const onPointerDown = (event: Event) => {
      const target = event.target as HTMLElement | null;
      const card = target?.closest?.(CARD_SELECTOR) as HTMLElement | null;
      if (card && card.closest('.new-ui-transcript-attachments')) {
        originRectRef.current = card.getBoundingClientRect();
      }
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onPointerDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onPointerDown, true);
    };
  }, []);

  useEffect(() => {
    let retry: ReturnType<typeof setTimeout> | undefined;
    let observer: MutationObserver | undefined;

    const attach = () => {
      const container = document.querySelector<HTMLElement>('.chatcontainer');
      if (!container) {
        retry = setTimeout(attach, 200);
        return;
      }
      sync();
      observer = new MutationObserver((records) => {
        // Run synchronously (no rAF/debounce) so the classic modal is hidden in
        // the same microtask it appeared, before the browser paints. To keep
        // that off the hot path while a response streams in, only look when an
        // added subtree could actually contain the modal — or when a preview is
        // already open and we need to notice it closing.
        if (mirroredRef.current) {
          sync();
          return;
        }
        for (const record of records) {
          for (const node of Array.from(record.addedNodes)) {
            if (!(node instanceof HTMLElement)) continue;
            if (
              node.matches(LEGACY_MODAL_SELECTOR) ||
              node.querySelector(LEGACY_MODAL_SELECTOR)
            ) {
              sync();
              return;
            }
          }
        }
      });
      observer.observe(container, { childList: true, subtree: true });
    };

    attach();
    return () => {
      if (retry) clearTimeout(retry);
      observer?.disconnect();
    };
  }, [sync]);

  if (!preview) return null;

  return (
    <AttachmentPreview
      attachments={preview.attachments}
      initialIndex={preview.initialIndex}
      originRect={preview.originRect}
      onClose={close}
    />
  );
};

export default NewUITranscriptPreviewLayer;
