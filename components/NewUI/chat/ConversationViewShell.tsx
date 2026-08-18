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
  useRef,
  useState,
} from 'react';
import { IconArrowDown } from '@tabler/icons-react';
import { Chat } from '@/components/Chat/Chat';
import { ConversationHeader } from './ConversationHeader';
import { ConversationComposer } from './ConversationComposer';
import { NewUIMessageActionsLayer } from './NewUIMessageActionsLayer';
import { NewUIUserMessageMarkdownLayer } from './NewUIUserMessageMarkdownLayer';
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

      {/* Floating action row (Copy / Edit / Read Aloud) */}
      <NewUIMessageActionsLayer />

      {/* §4/§5: Markdown rendering + collapse for user messages */}
      <NewUIUserMessageMarkdownLayer />
    </div>
  );
};

export default ConversationViewShell;
