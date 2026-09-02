/**
 * ConversationViewShell — applies new-UI styling and layout over Chat.tsx.
 *
 * Layout: the shell is position:relative; Chat fills the full space via CSS
 * (height:100% overrides Chat's JS-computed height). ConversationHeader and
 * ConversationComposer are absolute overlays on top of Chat.
 *
 * Other responsibilities:
 *   1. Wraps <Chat /> with data-new-ui="true" for CSS scoping
 *   2. Overlays ConversationHeader (hides Chat's old sticky bar via CSS)
 *   3. Renders ConversationComposer as an absolute overlay at bottom
 *   4. Handles pending-message injection from NewHome via sessionStorage
 *      — text-only: injects into #messageChatInputText + clicks #sendMessage
 *      — with docs: calls useSendService().handleSend() directly so that
 *        the already-uploaded AttachedDocuments (which carry doc.key) are
 *        included in the ChatRequest without re-uploading.
 *   5. Renders scroll-to-latest button (spec §6 / defect #7)
 *   6. Renders NewUIMessageActionsLayer (hover copy/edit/read-aloud)
 */
import React, {
  MutableRefObject,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { IconArrowDown } from '@tabler/icons-react';
import { Chat } from '@/components/Chat/Chat';
import { ConversationHeader } from './ConversationHeader';
import { ConversationComposer } from './ConversationComposer';
import { NewUIMessageActionsLayer } from './NewUIMessageActionsLayer';
import { NewUIUserMessageMarkdownLayer } from './NewUIUserMessageMarkdownLayer';
import { NewUITranscriptAttachmentsLayer } from './NewUITranscriptAttachmentsLayer';
import { NewUITranscriptPreviewLayer } from './NewUITranscriptPreviewLayer';
import HomeContext from '@/pages/api/home/home.context';
import { persistWebSearchPluginPreference } from '@/components/NewUI/shared/webSearchPreference';
// Imports for the direct-send path (pending docs with S3 keys)
import { useSendService, type ChatRequest } from '@/hooks/useChatSendService';
import { newMessage, MessageType } from '@/types/chat';
import { getActivePlugins } from '@/utils/app/plugin';
import { getSettings } from '@/utils/app/settings';
import { setAssistant as setAssistantInMsg } from '@/utils/app/assistants';
import { DEFAULT_ASSISTANT } from '@/types/assistant';
import type { AttachedDocument } from '@/types/attacheddocument';

interface ConversationViewShellProps {
  stopConversationRef: MutableRefObject<boolean>;
}

/** Inject value into a React-controlled textarea via native setter trick. */
function setNativeValue(element: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    'value',
  )?.set;
  if (setter) {
    setter.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

/** Distance from bottom before the jump-to-latest button appears. */
const SCROLL_THRESHOLD = 200;

/**
 * Height of the ConversationHeader overlay, in px. Used to inset the shell so
 * .chatcontainer starts exactly at the header's bottom edge — keeping the
 * scrollbar track fully visible (not clipped behind the header).
 */
const HEADER_H = 52;

/**
 * Phase 41 Fix 1 / scrollbar-clip fix — where the just-sent prompt is parked,
 * measured from the TOP of .chatcontainer (the scroll container).
 *
 * Spec: ~24px below the top of the scroll area.
 *
 * Previously (before the scrollbar-clip fix) the shell had no top inset, so
 * .chatcontainer started at y=0 of the shell and the header (52px) was an
 * absolute overlay. The padding-top on .chatcontainer was 80px (= 52px header +
 * 24px spec gap + 4px mask buffer) to push content below both the header and the
 * fade ramp.
 *
 * After the fix, the shell has paddingTop:HEADER_H (52px) so .chatcontainer
 * starts at y=52 of the shell — exactly at the header's bottom edge. The
 * chatcontainer padding-top is now 28px (24px spec gap + 4px mask buffer), and
 * the mask fades to full opacity at 28px. We use 28 so that anchoring at 24
 * doesn't leave the top 4px of the bubble inside the fade ramp.
 */
const ANCHOR_TOP_OFFSET = 28;

/**
 * Slack kept between the anchored position and the very bottom of the scroller,
 * so that being parked at the anchor does not read as "at the bottom".
 *
 * Chat.tsx treats "within 30px of the bottom" as at-the-bottom (handleScroll,
 * ~L905-935) and we use the same notion to detect "the user scrolled down to
 * follow the output". If the anchor sat exactly at the scroll maximum, a 1px
 * nudge of the scrollbar would look like a request to follow. 48 > 30.
 */
const ANCHOR_BOTTOM_MARGIN = 48;

/** Chat.tsx's own at-bottom tolerance, so both agree on what "bottom" means. */
const BOTTOM_TOLERANCE = 30;

/**
 * How often, while streaming, we re-assert the scroll freeze and hand reserved
 * room back. Matches Chat.tsx's own 100ms streaming cadence.
 */
const STREAM_TICK_MS = 100;

/**
 * Scroll events dispatched within this window after our own programmatic
 * scroll are ignored, so we don't mistake our own anchor scroll for the user
 * scrolling. Instant scroll dispatches one event on the next frame; the margin
 * covers slower machines / coalesced events.
 */
const PROG_SCROLL_GRACE_MS = 250;

export const ConversationViewShell: React.FC<ConversationViewShellProps> = ({
  stopConversationRef,
}) => {
  const {
    state: { messageIsStreaming, selectedConversation, featureFlags, selectedAssistant },
    handleUpdateConversation,
  } = useContext(HomeContext);

  // ── Direct-send service (for pending docs path) ───────────────────────────
  // useSendService is the same hook Chat.tsx uses. We call it here so that
  // when NewHome attached docs (already uploaded to S3) need to travel with
  // the first message, we can include them in the ChatRequest without going
  // through ChatInput's internal documents state (which has no injection API).
  const { handleSend: sendViaService } = useSendService();
  // Keep a ref so the tryInject closure ([] deps) always calls the fresh copy.
  const sendViaServiceRef = useRef(sendViaService);
  useEffect(() => {
    sendViaServiceRef.current = sendViaService;
  }, [sendViaService]);

  const hasFiredRef = useRef(false);
  const [showJumpBtn, setShowJumpBtn] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);

  // ── Issue 1: "Waiting for response" pending indicator ─────────────────────
  //
  // ROOT CAUSE (verified by reading hooks/useChatSendService.ts):
  // `messageIsStreaming` is dispatched TRUE at line 295 — at SEND time, batched
  // with the `selectedConversation` update at line 289, BEFORE the API call is
  // even made. It does NOT mean "tokens are arriving".
  //
  // So the blank window is precisely: messageIsStreaming === true, but the
  // assistant message has not been appended yet (last message is still the
  // user's). During that window:
  //   - ChatLoader IS mounted (Chat.tsx renders it on `loading`), but its dot is
  //     hidden by our own Phase 43 Fix 1b CSS ([data-streaming="true"] …
  //     .animate-pulse { visibility: hidden }).
  //   - PromptStatus has NOT mounted — it renders inside the last message's
  //     assistant-message wrapper, which doesn't exist yet, and needs status
  //     events that haven't arrived.
  // Result: nothing visible. That is the bug.
  //
  // CORRECT CONDITION: streaming has begun AND no assistant turn exists yet.
  // `lastMessage.role === 'user'` is exactly that test, and it also makes the
  // `sentThisTurn` guard from the previous attempt unnecessary:
  //   - Historical conversations ending in a user message: messageIsStreaming is
  //     false → no indicator. No false positive.
  //   - The 5 other places that dispatch messageIsStreaming true for automatic
  //     follow-up work (PromptHighlightedText, AutoArtifactBlock, AutonomousBlock,
  //     InvokeBlock) all run with an assistant message already present, so
  //     lastMessage.role is 'assistant' → no indicator.
  //
  // Handoff: the moment the assistant message is appended, lastMessage.role
  // becomes 'assistant', this attribute clears, and PromptStatus's breathing dot
  // takes over. Both use var(--accent), so the transition is seamless.
  //
  // IMPLEMENTATION: rather than injecting a new DOM node into `.chatcontainer`
  // (whose children React owns), we re-reveal the dot on the ChatLoader element
  // that Chat.tsx ALREADY mounts for exactly this window — verified:
  // `loading` is dispatched true at useChatSendService.ts:294 (send) and false at
  // :801 (HTTP response body received), and Chat.tsx renders
  // `{loading && <ChatLoader/>}` at :1741. That element is already column-aligned
  // (Phase 38/39) and its dot is already styled as an accent breathing dot
  // (Phase 27), reduced-motion gated. Our Phase 43 Fix 1b rule was the only thing
  // hiding it. So this is a one-attribute CSS unhide — no DOM injection, no
  // alignment work, nothing to keep in sync.
  const messages = selectedConversation?.messages ?? [];
  const lastMessage = messages[messages.length - 1];

  const showPendingIndicator =
    messageIsStreaming && lastMessage?.role === 'user';

  useEffect(() => {
    if (!shellRef.current) return;
    if (showPendingIndicator) {
      shellRef.current.setAttribute('data-awaiting-first-token', 'true');
    } else {
      shellRef.current.removeAttribute('data-awaiting-first-token');
    }
  }, [showPendingIndicator]);

  // ── Scrollbar-clip fix: inset the shell bottom to match composer height ──
  //
  // The shell has paddingTop:HEADER_H (52px) set inline so Chat.tsx starts
  // below the header. For the bottom, we need paddingBottom to equal the
  // composer dock's actual rendered height so .chatcontainer ends above the
  // composer overlay. This is dynamic because the composer grows when the
  // attachment rail opens.
  //
  // We set the value via CSS custom property (--nui-composer-inset) rather than
  // React state, so ResizeObserver callbacks don't trigger re-renders.
  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    const updateInset = () => {
      const dock = shell.querySelector<HTMLElement>('.new-ui-composer-dock');
      if (dock) {
        shell.style.setProperty('--nui-composer-inset', `${dock.offsetHeight}px`);
      }
    };
    updateInset();
    const ro = new ResizeObserver(updateInset);
    const dock = shell.querySelector<HTMLElement>('.new-ui-composer-dock');
    if (dock) ro.observe(dock);
    return () => ro.disconnect();
  }, []); // shellRef.current is stable after mount

  // ── Pending-message bridge ──────────────────────────────────────────────
  //
  // Two paths:
  //
  // A) WITH pending docs (images / files already uploaded to S3 by NewHome):
  //    - Read amplify_pending_docs, parse AttachedDocument[] with doc.key set
  //    - Call useSendService().handleSend() directly so the docs are included
  //      in the ChatRequest.documents field (ChatInput's internal documents
  //      state is unreachable from outside without modifying ChatInput.tsx).
  //    - Skip the #sendMessage DOM click to avoid a double send.
  //
  // B) WITHOUT pending docs (text-only send):
  //    - Use the existing textarea injection + #sendMessage click approach.
  //    - ChatInput handles everything through its own pipeline.
  //
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tryInject = () => {
      if (hasFiredRef.current) return;

      const pendingMessage =
        typeof window !== 'undefined'
          ? sessionStorage.getItem('amplify_pending_message')
          : null;

      if (!pendingMessage) {
        timer = setTimeout(tryInject, 150);
        return;
      }

      // ── Read shared context keys ─────────────────────────────────────────
      const pendingWebSearch = sessionStorage.getItem('amplify_pending_web_search') === 'true';
      const pendingSkillsRaw = sessionStorage.getItem('amplify_pending_skills');
      let pendingSkills: string[] = [];
      if (pendingSkillsRaw) {
        try { pendingSkills = JSON.parse(pendingSkillsRaw); } catch { /* ignore */ }
      }

      // ── Read pending docs (written by NewHome, previously never consumed) ─
      const pendingDocsRaw = sessionStorage.getItem('amplify_pending_docs');
      let pendingDocs: AttachedDocument[] = [];
      if (pendingDocsRaw) {
        try { pendingDocs = JSON.parse(pendingDocsRaw); } catch { /* ignore */ }
      }
      // Only use docs that completed their S3 upload (doc.key is set by the
      // async onSetKey callback in handleFile after addFile() resolves).
      const docsWithKeys = pendingDocs.filter((d) => !!d.key);

      // Helper: apply web-search preferences onto the new conversation
      const applyWebSearch = () => {
        if (pendingWebSearch && selectedConversation) {
          handleUpdateConversation(selectedConversation, {
            key: 'data',
            value: {
              ...selectedConversation.data,
              webSearchEnabled: true,
              skills: pendingSkills,
              skillSelectionMode: 'auto',
            },
          });
          persistWebSearchPluginPreference(featureFlags);
        }
      };

      // Helper: clean up all pending sessionStorage keys
      const clearPending = () => {
        sessionStorage.removeItem('amplify_pending_message');
        sessionStorage.removeItem('amplify_pending_docs');
        sessionStorage.removeItem('amplify_pending_model_id');
        sessionStorage.removeItem('amplify_pending_effort');
        sessionStorage.removeItem('amplify_pending_web_search');
        sessionStorage.removeItem('amplify_pending_skills');
      };

      // ── PATH A: pending docs with S3 keys ──────────────────────────────────
      if (docsWithKeys.length > 0 && selectedConversation) {
        hasFiredRef.current = true;
        applyWebSearch();
        clearPending();

        // Build the message
        let msg = newMessage({
          role: 'user',
          content: pendingMessage,
          type: MessageType.PROMPT,
          data: {
            enableWebSearch: pendingWebSearch,
            skills: pendingSkills,
            skillSelectionMode: 'auto',
            // Pre-populate dataSources so the useSendService fallback path
            // (message.data.dataSources) also carries the docs in case
            // request.documents is not processed for some reason.
            dataSources: docsWithKeys.map((d) => ({
              id: d.key!.includes('://') ? d.key! : `s3://${d.key!}`,
              type: d.type,
              name: d.name || '',
              metadata: d.metadata || {},
            })),
          },
        });

        // Apply the active assistant to the message (mirrors ChatInput.tsx:758)
        msg = setAssistantInMsg(msg, selectedAssistant ?? DEFAULT_ASSISTANT);

        // Build assistant options for the ChatRequest (mirrors Chat.tsx routeMessage)
        let assistantOptions: Record<string, unknown> | undefined;
        if (selectedAssistant && selectedAssistant.id !== DEFAULT_ASSISTANT.id) {
          assistantOptions = {
            assistantName: selectedAssistant.definition?.name,
            assistantId: selectedAssistant.definition?.assistantId,
            groupId: selectedAssistant.definition?.groupId,
            groupType: selectedConversation.groupType,
          };
        }

        // Compute active plugins (same as Chat.tsx's local plugins state init)
        const settings = typeof window !== 'undefined' ? getSettings(featureFlags) : null;
        const plugins = settings ? getActivePlugins(settings, featureFlags) : [];

        const request: ChatRequest = {
          message: msg,
          deleteCount: 0,
          documents: docsWithKeys,
          plugins,
          conversationId: selectedConversation.id,
          ...(assistantOptions ? { options: assistantOptions } : {}),
        };

        // Fire the send. sendViaServiceRef always holds the freshest closure
        // (updated via the effect above) so it reads current selectedConversation.
        sendViaServiceRef.current(request, () => stopConversationRef.current === true);
        return;
      }

      // ── PATH B: no pending docs — existing DOM bridge ──────────────────────
      const textarea = document.getElementById(
        'messageChatInputText',
      ) as HTMLTextAreaElement | null;
      const sendBtn = document.getElementById('sendMessage') as HTMLButtonElement | null;

      if (textarea && sendBtn) {
        hasFiredRef.current = true;
        applyWebSearch();
        clearPending();

        setTimeout(() => {
          setNativeValue(textarea, pendingMessage);
          setTimeout(() => {
            sendBtn.click();
          }, 80);
        }, 80);
      } else {
        timer = setTimeout(tryInject, 150);
      }
    };

    tryInject();
    return () => { if (timer) clearTimeout(timer); };
  }, []);

  // ── Asterisk two-state: set data-streaming on the shell ─────────────────
  useEffect(() => {
    if (shellRef.current) {
      if (messageIsStreaming) {
        shellRef.current.setAttribute('data-streaming', 'true');
      } else {
        shellRef.current.removeAttribute('data-streaming');
      }
    }
  }, [messageIsStreaming]);

  // ══ PHASE 41 FIX 1 (rev 2) — prompt-at-top anchoring, then freeze ═════════
  //
  // Desired behaviour:
  //   1. On send, scroll so the new prompt sits ~24px below the header, with the
  //      tail of the previous answer pushed out of view.
  //   2. After that, never programmatically move the viewport again.
  //   3. Exception: if the user scrolls down to follow the output, let the
  //      output-following behaviour resume.
  //
  // ── MECHANISM: neutralise the one choke point ────────────────────────────
  // Chat.tsx (DO-NOT-CHANGE) has three programmatic scrolls, and ALL THREE go
  // through `.scrollIntoView()` on the SAME DOM node — `messagesEndRef`:
  //     scrollToBottom            ~L898   scrollIntoView({behavior:'smooth'})
  //     throttled scrollDown      ~L1036/1067  scrollIntoView(true)
  //     100ms streaming interval  ~L1090  scrollIntoView(false)
  // So we install a no-op `scrollIntoView` as an OWN PROPERTY on that single
  // node while the viewport should be frozen, and `delete` it to restore the
  // prototype method when following should resume. One lever, three scrolls.
  //
  // WHY NOT the obvious alternative — satisfying Chat.tsx's own gates by leaving
  // the scroller far from the bottom: `autoScrollEnabled` has THREE writers
  // (handleScroll ~L905, an IntersectionObserver ~L1185, handleScrollDown ~L940),
  // two of which depend on `scrollHeight` geometry that our own reserved room
  // changes. Two shipped attempts at that failed in different ways — the worst
  // being that the sentinel IS the bottom spacer (one div, `className="h-[300px]"`
  // + `ref={messagesEndRef}`, ~L1743-1746), so resizing it to make room made the
  // observer report `isIntersecting` and re-enabled the very auto-scroll we were
  // suppressing, dragging the prompt off the top of the screen every 100ms.
  // See NEW_UI_DOCS.md Phase 41a. This approach is immune to all of that: the
  // scrolls are inert regardless of what `autoScrollEnabled` says, so no layout
  // measurement can undo the freeze.
  //
  // The user-facing jump-to-latest button is deliberately unaffected:
  // handleScrollDown (~L940) uses `chatContainerRef.current.scrollTo(...)`, not
  // scrollIntoView, so it keeps working while the freeze is on — and the scroll
  // it produces lands at the bottom, which is exactly our "resume following"
  // trigger below.
  //
  // ⚠ MAINTENANCE NOTE: patching a method on a DOM node is invisible to anyone
  // reading Chat.tsx. It is confined to this file, applied to exactly one node,
  // reverted by `delete` (restoring prototype lookup exactly), re-asserted on a
  // 100ms tick in case React swaps the node, and cleaned up on unmount.
  const progScrollUntilRef = useRef(0);
  const prevStreamingRef = useRef(false);
  /** The node whose scrollIntoView we have currently stubbed out, if any. */
  const frozenNodeRef = useRef<HTMLElement | null>(null);
  /** Reserved room currently applied via --new-ui-anchor-room, in px. */
  const appliedRoomRef = useRef(0);

  const getContainer = useCallback(
    () => document.querySelector('.chatcontainer') as HTMLElement | null,
    [],
  );

  /**
   * Chat.tsx's bottom spacer, which is also `messagesEndRef` and its
   * IntersectionObserver sentinel. The class is literally `h-[300px]`, so the
   * brackets need CSS escaping.
   */
  const getSentinel = useCallback(
    (container: HTMLElement) =>
      container.querySelector<HTMLElement>('.h-\\[300px\\]'),
    [],
  );

  /** Make Chat.tsx's three scrolls inert. Idempotent; safe to call every tick. */
  const freezeScroll = useCallback((sentinel: HTMLElement) => {
    if (frozenNodeRef.current === sentinel) return;
    // A different node (React remounted the tree) — release the old one first.
    if (frozenNodeRef.current) {
      delete (frozenNodeRef.current as unknown as Record<string, unknown>)
        .scrollIntoView;
      frozenNodeRef.current = null;
    }
    // Only ever shadow an inherited method. If something else already installed
    // an own property here, leave it alone rather than clobbering it.
    if (Object.prototype.hasOwnProperty.call(sentinel, 'scrollIntoView')) return;
    (sentinel as unknown as Record<string, unknown>).scrollIntoView = () => {
      /* frozen by Phase 41: the new-UI shell owns scroll position */
    };
    frozenNodeRef.current = sentinel;
  }, []);

  /** Restore the real scrollIntoView, handing scrolling back to Chat.tsx. */
  const releaseScroll = useCallback(() => {
    const node = frozenNodeRef.current;
    if (!node) return;
    // `delete` removes our own property so the Element.prototype method is found
    // again — an exact restore, with no stale function reference to keep around.
    delete (node as unknown as Record<string, unknown>).scrollIntoView;
    frozenNodeRef.current = null;
  }, []);

  /** The scrollTop that parks the newest prompt at ANCHOR_TOP_OFFSET. */
  const measureAnchorTarget = useCallback((container: HTMLElement) => {
    const msgs = container.querySelectorAll<HTMLElement>(
      '.enhanced-chat-message.user-message',
    );
    const last = msgs[msgs.length - 1];
    if (!last) return null;
    const bubble =
      (last.querySelector('#chatHover') as HTMLElement | null) ?? last;
    // getBoundingClientRect deltas absorb the container's own padding-top.
    const delta =
      bubble.getBoundingClientRect().top -
      container.getBoundingClientRect().top;
    return Math.max(0, container.scrollTop + delta - ANCHOR_TOP_OFFSET);
  }, []);

  /**
   * Apply (or clear) reserved room, as a CSS custom property on our own shell;
   * conversation-view.css turns it into margin-top on the spacer. The CSS falls
   * back to 0px, so a missing property degrades to "no anchoring", never to a
   * broken layout.
   *
   * 🛑 The room is margin ABOVE the spacer, never the spacer's height — see the
   * Phase 41a note in conversation-view.css.
   */
  const applyRoom = useCallback((room: number) => {
    const shell = shellRef.current;
    if (!shell) return;
    appliedRoomRef.current = Math.max(0, room);
    if (appliedRoomRef.current <= 0) {
      shell.removeAttribute('data-anchor-freeze');
      shell.style.removeProperty('--new-ui-anchor-room');
      return;
    }
    shell.setAttribute('data-anchor-freeze', 'true');
    shell.style.setProperty(
      '--new-ui-anchor-room',
      `${Math.round(appliedRoomRef.current)}px`,
    );
  }, []);

  /**
   * Room needed purely for REACHABILITY: `scrollTop` cannot exceed
   * `scrollHeight - clientHeight`, so parking a short prompt near the top of a
   * tall window needs roughly a viewport of content beneath it or the browser
   * clamps and the prompt lands mid-screen instead.
   *
   * Note this is much less room than the previous attempt reserved: that one
   * additionally had to push the sentinel entirely past the fold to keep
   * Chat.tsx's observer quiet. Freezing scrollIntoView directly makes the
   * observer irrelevant, so all we need is reachability plus enough slack that
   * the anchor does not read as "at the bottom".
   */
  const computeRoom = useCallback(
    (container: HTMLElement, anchorTarget: number) => {
      const natural = container.scrollHeight - appliedRoomRef.current;
      return Math.max(
        0,
        anchorTarget +
          container.clientHeight +
          ANCHOR_BOTTOM_MARGIN -
          natural,
      );
    },
    [],
  );

  /**
   * Reduce reserved room towards `desired`, never by more than is safe right now.
   * THE INVARIANT: never let scrollHeight drop below `scrollTop + clientHeight`.
   * Removing room lowers scrollHeight, and the moment that pushes the scroll
   * maximum above where the user sits, the browser clamps scrollTop and the
   * content visibly slides. So the cap is their distance to the bottom:
   *
   *     safe = max(0, (scrollHeight - clientHeight) - scrollTop)
   *
   * Measured during development: an all-or-nothing release while the user sat at
   * the bottom moved content 431px; capping at `safe` moves it 0px. It also means
   * a user parked at the bottom has the reserved blank space consumed by the
   * arriving text itself, at the rate it arrives, with nothing moving on screen.
   * Growth is refused outright so content is never pushed down mid-stream.
   */
  const reduceRoomTo = useCallback(
    (container: HTMLElement, desired: number) => {
      const room = appliedRoomRef.current;
      if (room <= 0) return;
      const target = Math.max(0, desired);
      if (target >= room) return; // never grow
      const safe = Math.max(
        0,
        container.scrollHeight - container.clientHeight - container.scrollTop,
      );
      const removal = Math.min(room - target, safe);
      if (removal > 0) applyRoom(room - removal);
    },
    [applyRoom],
  );

  /** Park the newest user prompt at ANCHOR_TOP_OFFSET from the container top. */
  const anchorNewPrompt = useCallback(() => {
    let attempts = 0;

    const run = () => {
      const container = getContainer();
      const sentinel = container ? getSentinel(container) : null;
      if (!container || !sentinel || !shellRef.current) {
        if (attempts++ < 20) setTimeout(run, 50);
        return;
      }

      // 1. Freeze FIRST, so nothing can move the viewport while we measure.
      freezeScroll(sentinel);

      // 2. Measure with no room applied so `natural` height is honest.
      applyRoom(0);
      void container.scrollHeight;

      // The just-sent message may not have mounted yet — retry briefly.
      const anchorTarget = measureAnchorTarget(container);
      if (anchorTarget === null) {
        if (attempts++ < 20) setTimeout(run, 50);
        return;
      }

      // 3. Reserve reachability room, then land on the anchor.
      applyRoom(computeRoom(container, anchorTarget));
      void container.scrollHeight;

      progScrollUntilRef.current = Date.now() + PROG_SCROLL_GRACE_MS;

      // INSTANT, deliberately not `behavior:'smooth'`. Not because of a race any
      // more (the freeze removes that), but because a ~400ms animation emits a
      // stream of scroll events starting from the OLD position — which is
      // normally the bottom — and the listener below would read those as "the
      // user scrolled to the bottom, resume following" and undo the freeze.
      container.scrollTop = anchorTarget;
    };

    run();
  }, [
    getContainer,
    getSentinel,
    freezeScroll,
    applyRoom,
    measureAnchorTarget,
    computeRoom,
  ]);

  // Anchor when a message is actually SENT, and hand scrolling back to Chat.tsx
  // when the response finishes.
  //
  // ⚠ "streaming started" is NOT the same as "the user sent something".
  // `messageIsStreaming` is dispatched true from five places besides the send
  // path — PromptHighlightedText (L998), AutoArtifactBlock (L207),
  // AutonomousBlock (L415/478) and InvokeBlock (L215/344) — for automatic
  // follow-up work with no new user prompt. Anchoring on those would yank the
  // viewport for something the user never asked for. So we additionally require
  // that the number of user messages has GROWN, which is the precise definition
  // of "a prompt was just sent".
  //
  // We key on the LAST USER MESSAGE'S ID rather than on a streaming transition or
  // a message count. `Message` carries a stable `id` (types/chat.ts L32), so
  // "there is a user message we have not anchored to yet, and a response is
  // streaming" is exactly the condition we want — and unlike a count comparison
  // it does not depend on whether React batches the `selectedConversation` and
  // `messageIsStreaming` dispatches into one render (useChatSendService L289-295
  // issues them back to back, but that is an implementation detail we should not
  // be coupled to). `anchorNewPrompt` also retries for up to 1s for the element
  // to mount.
  //
  // Known, deliberate: "regenerate" replaces the assistant answer without adding
  // a new user message, so it does not re-anchor — leaving the view where it is
  // is the safer default.
  const lastUserMessageId = useMemo(() => {
    const msgs = selectedConversation?.messages ?? [];
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === 'user') return msgs[i].id ?? `idx-${i}`;
    }
    return null;
  }, [selectedConversation?.messages]);
  const anchoredMessageIdRef = useRef<string | null>(null);

  useEffect(() => {
    const wasStreaming = prevStreamingRef.current;
    prevStreamingRef.current = messageIsStreaming;

    if (
      messageIsStreaming &&
      lastUserMessageId &&
      lastUserMessageId !== anchoredMessageIdRef.current
    ) {
      anchoredMessageIdRef.current = lastUserMessageId;
      anchorNewPrompt();
    } else if (!messageIsStreaming && wasStreaming) {
      // Streaming is over: there is nothing left to auto-scroll, so restore the
      // real method and give the reserved room back as far as is safe.
      releaseScroll();
      const container = getContainer();
      if (container) reduceRoomTo(container, 0);
    }
  }, [
    messageIsStreaming,
    lastUserMessageId,
    anchorNewPrompt,
    releaseScroll,
    getContainer,
    reduceRoomTo,
  ]);

  // While streaming: re-assert the freeze (in case React swapped the sentinel
  // node) and hand reserved room back as real content arrives, so the reserved
  // blank space is transient rather than permanent.
  useEffect(() => {
    if (!messageIsStreaming) return;
    const id = setInterval(() => {
      const container = getContainer();
      if (!container) return;
      // Only re-assert while we still consider the view frozen; once the user
      // has asked to follow the output (below) frozenNodeRef is null and must
      // stay null.
      if (frozenNodeRef.current) {
        const sentinel = getSentinel(container);
        if (sentinel) freezeScroll(sentinel);
      }
      if (appliedRoomRef.current > 0) {
        const anchorTarget = measureAnchorTarget(container);
        if (anchorTarget !== null) {
          reduceRoomTo(container, computeRoom(container, anchorTarget));
        }
      }
    }, STREAM_TICK_MS);
    return () => clearInterval(id);
  }, [
    messageIsStreaming,
    getContainer,
    getSentinel,
    freezeScroll,
    measureAnchorTarget,
    computeRoom,
    reduceRoomTo,
  ]);

  // Spec exception 3: if the user scrolls to the bottom, they are asking to
  // follow the output — restore Chat.tsx's scrolling and let it take over. Any
  // other scroll (including scrolling up) leaves the freeze in place, and only
  // hands back room to the extent that is provably jump-free.
  useEffect(() => {
    let cleanupFn: (() => void) | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const attach = () => {
      const container = getContainer();
      if (!container) {
        retryTimer = setTimeout(attach, 200);
        return;
      }
      const onScroll = () => {
        if (Date.now() < progScrollUntilRef.current) return; // our own scroll
        const atBottom =
          container.scrollTop + container.clientHeight >=
          container.scrollHeight - BOTTOM_TOLERANCE;
        if (atBottom) releaseScroll();
        if (appliedRoomRef.current > 0) reduceRoomTo(container, 0);
      };
      container.addEventListener('scroll', onScroll, { passive: true });
      cleanupFn = () => container.removeEventListener('scroll', onScroll);
    };

    attach();
    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      if (cleanupFn) cleanupFn();
    };
  }, [getContainer, releaseScroll, reduceRoomTo]);

  // Switching conversations must not inherit a stale frozen/anchored state, and
  // must not treat the newly-opened conversation's existing last prompt as
  // something to anchor to (which would scroll the view on mere navigation).
  // Seeding anchoredMessageIdRef marks whatever is already there as "handled".
  useEffect(() => {
    releaseScroll();
    applyRoom(0);
    prevStreamingRef.current = false;
    anchoredMessageIdRef.current = lastUserMessageId;
    // Must run ONLY on a conversation change. `lastUserMessageId` is read as a
    // snapshot here; including it in the deps would re-seed on every new message
    // and defeat the anchor entirely.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversation?.id, releaseScroll, applyRoom]);

  // Never leave a patched node behind on unmount.
  useEffect(() => releaseScroll, [releaseScroll]);

  // ── Chat font: set data-body-face from localStorage ──────────────────────
  useEffect(() => {
    if (!shellRef.current) return;
    const savedFont = typeof window !== 'undefined'
      ? (localStorage.getItem('amplify_chat_font') ?? 'serif')
      : 'serif';
    shellRef.current.setAttribute('data-body-face', savedFont);

    // Listen for settings-change events so the font updates without reload
    const handler = () => {
      if (!shellRef.current) return;
      const f = localStorage.getItem('amplify_chat_font') ?? 'serif';
      shellRef.current.setAttribute('data-body-face', f);
    };
    window.addEventListener('amplifyChatFontChanged', handler);
    return () => window.removeEventListener('amplifyChatFontChanged', handler);
  }, []);

  // ── aria-live on PromptStatus container (WCAG SC 4.1.3) ──────────────────
  // PromptStatus.tsx (DO-NOT-CHANGE) renders `.rounded-xl.shadow-lg` while
  // the assistant is streaming. We cannot add `aria-live` via CSS, so this
  // DOM-effect injects it after mount and re-runs whenever streaming starts/
  // stops (same MutationObserver + DOM-ready-retry pattern as the overlay).
  // We use aria-live="polite" so screen-reader users hear updates without
  // interrupting what they're currently reading.
  useEffect(() => {
    let observer: MutationObserver | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const applyAriaLive = () => {
      const containers = document.querySelectorAll<HTMLElement>(
        '[data-new-ui="true"] .rounded-xl.shadow-lg',
      );
      containers.forEach((el) => {
        if (!el.hasAttribute('aria-live')) {
          el.setAttribute('aria-live', 'polite');
          el.setAttribute('aria-atomic', 'false');
        }
      });
    };

    const startObserving = () => {
      const chatContainer = document.querySelector('.chatcontainer');
      if (!chatContainer) {
        retryTimer = setTimeout(startObserving, 300);
        return;
      }
      applyAriaLive();
      observer = new MutationObserver(applyAriaLive);
      observer.observe(chatContainer, { childList: true, subtree: true });
    };

    startObserving();
    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      observer?.disconnect();
    };
  }, []);

  // ── Phase 43 Fix 2: "Thinking…" loading text in PromptStatus container ──────
  //
  // Phase 40b hid the PromptStatus status text (.mt-0.pt-0) leaving only the
  // breathing dot. This effect injects a <span class="new-ui-loading-text"
  // aria-hidden="true"> into .mt-0.ml-3 (the step-line row) when PromptStatus
  // mounts, providing calm "Thinking…" text alongside the dot. The span is
  // aria-hidden because screen readers already receive updates via the aria-live
  // region injected by the effect above.
  //
  // CSS in conversation-view.css (Phase 43) controls the visual appearance:
  //   - display:inline so it flows after the ::before dot on the same line
  //   - ::after { content: "Thinking…" } (CSS-generated, not DOM text)
  //   - 2s opacity pulse animation, prefers-reduced-motion gated
  //
  // Lifecycle:
  //   - inject: when .rounded-xl.shadow-lg .mt-0.ml-3 appears (PromptStatus mounts)
  //   - cleanup: when .rounded-xl.shadow-lg disappears (PromptStatus unmounts)
  //   - idempotent: skips if span already present inside .mt-0.ml-3
  useEffect(() => {
    let observer: MutationObserver | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const LOADING_TEXT_CLASS = 'new-ui-loading-text';

    /** Inject the span into any .mt-0.ml-3 row that doesn't yet have one. */
    const injectLoadingText = () => {
      const rows = document.querySelectorAll<HTMLElement>(
        '[data-new-ui="true"] .rounded-xl.shadow-lg .mt-0.ml-3',
      );
      rows.forEach((row) => {
        // Idempotent: skip if already injected
        if (row.querySelector(`.${LOADING_TEXT_CLASS}`)) return;
        const span = document.createElement('span');
        span.className = LOADING_TEXT_CLASS;
        // aria-hidden: screen readers use the aria-live region on the
        // .rounded-xl.shadow-lg ancestor (injected by the effect above).
        span.setAttribute('aria-hidden', 'true');
        row.appendChild(span);
      });
    };

    /**
     * Remove spans whose PromptStatus ancestor is no longer in the DOM.
     * Runs after every mutation so orphaned spans are cleaned up promptly.
     */
    const cleanupOrphanedText = () => {
      document
        .querySelectorAll<HTMLElement>(`.${LOADING_TEXT_CLASS}`)
        .forEach((el) => {
          if (!el.closest('[data-new-ui="true"] .rounded-xl.shadow-lg')) {
            el.remove();
          }
        });
    };

    const startObserving = () => {
      const chatContainer = document.querySelector('.chatcontainer');
      if (!chatContainer) {
        retryTimer = setTimeout(startObserving, 300);
        return;
      }
      // Inject immediately in case PromptStatus is already mounted
      injectLoadingText();
      observer = new MutationObserver(() => {
        injectLoadingText();
        cleanupOrphanedText();
      });
      observer.observe(chatContainer, { childList: true, subtree: true });
    };

    startObserving();

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      observer?.disconnect();
      // Clean up all loading text spans on unmount
      document
        .querySelectorAll<HTMLElement>(`.${LOADING_TEXT_CLASS}`)
        .forEach((el) => el.remove());
    };
  }, []);

  // ── Scroll-to-latest button ─────────────────────────────────────────────
  const checkScrollPosition = useCallback(() => {
    const container = document.querySelector('.chatcontainer') as HTMLElement | null;
    if (!container) return;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    setShowJumpBtn(distanceFromBottom > SCROLL_THRESHOLD);
  }, []);

  useEffect(() => {
    let cleanupFn: (() => void) | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const attach = () => {
      const container = document.querySelector('.chatcontainer') as HTMLElement | null;
      if (!container) {
        retryTimer = setTimeout(attach, 200);
        return;
      }
      container.addEventListener('scroll', checkScrollPosition, { passive: true });
      checkScrollPosition();
      cleanupFn = () => container.removeEventListener('scroll', checkScrollPosition);
    };

    attach();
    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      if (cleanupFn) cleanupFn();
    };
  }, [checkScrollPosition]);

  const handleJumpToLatest = () => {
    const container = document.querySelector('.chatcontainer') as HTMLElement | null;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
  };

  return (
    <div
      ref={shellRef}
      data-new-ui="true"
      className="new-ui-chat-shell"
      style={{
        position: 'relative',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        // Inset Chat.tsx below the header so .chatcontainer's scrollbar track
        // starts exactly at the header's bottom edge (not behind it).
        // The bottom inset is managed imperatively via --nui-composer-inset
        // (set by the ResizeObserver effect above) so the scrollbar track also
        // ends above the composer, regardless of the composer's height.
        paddingTop: HEADER_H,
      }}
    >
      {/* Chat fills the entire shell — CSS handles height:100% on .chatcontainer */}
      <Chat stopConversationRef={stopConversationRef} />

      {/* Header overlay — hides Chat's own sticky header via CSS */}
      <ConversationHeader />

      {/* Composer overlay — position:absolute at bottom (handled inside ConversationComposer) */}
      <ConversationComposer />

      {/* Jump-to-latest button — centered on the message column, above the composer */}
      <div
        style={{
          position: 'absolute',
          bottom: 190,
          left: 0,
          right: 0,
          height: 0,
          overflow: 'visible',
          pointerEvents: 'none',
          zIndex: 28,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: 'min(74ch, calc(100% - 48px))',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <button
            type="button"
            aria-label="Scroll to latest message"
            onClick={handleJumpToLatest}
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'var(--bg-active)',
              border: '1px solid var(--border-subtle)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-primary)',
              opacity: showJumpBtn ? 1 : 0,
              pointerEvents: showJumpBtn ? 'auto' : 'none',
              transition: 'opacity 140ms ease',
            }}
          >
            <IconArrowDown size={18} />
          </button>
        </div>
      </div>

      {/* Phase 66 — accessible announcement for the pre-response window.
          The visible "Sending…" label is CSS ::after content on ChatLoader, which
          screen readers do not announce; and PromptStatus's aria-live host (injected
          by the effect above) does not exist yet during this window. This polite
          live region covers the gap per wiki §9 standing rule 15. Emptying it when
          the window ends stops the message being re-announced. */}
      <span className="sr-only" aria-live="polite">
        {showPendingIndicator ? 'Message sent, waiting for a response' : ''}
      </span>

      {/* Floating action row (Copy / Edit / Read Aloud) */}
      <NewUIMessageActionsLayer />

      {/* §4/§5: Markdown rendering + collapse for user messages */}
      <NewUIUserMessageMarkdownLayer />
      <NewUITranscriptAttachmentsLayer />

      {/* Routes post-send attachment previews through shared/AttachmentPreview —
          the same component the composer uses — instead of the classic modal,
          which is trapped inside .chatcontainer's mask/stacking context */}
      <NewUITranscriptPreviewLayer />
    </div>
  );
};

export default ConversationViewShell;
