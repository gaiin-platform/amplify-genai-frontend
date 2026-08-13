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
    state: { messageIsStreaming, selectedConversation, featureFlags },
    handleUpdateConversation,
  } = useContext(HomeContext);

  const hasFiredRef = useRef(false);
  const [showJumpBtn, setShowJumpBtn] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);

  // ── Pending-message bridge ──────────────────────────────────────────────
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

      const textarea = document.getElementById(
        'messageChatInputText',
      ) as HTMLTextAreaElement | null;
      const sendBtn = document.getElementById('sendMessage') as HTMLButtonElement | null;

      if (textarea && sendBtn) {
        hasFiredRef.current = true;

        // Consume the pending web-search/skills bridge written by NewHome.tsx
        // for brand-new conversations (see NEW_UI_DOCS.md §13 "Pending-Message
        // Bridge" / "RAG / Web Search Wiring Gap"). These two keys were
        // previously written but never read anywhere — that's the bug.
        const pendingWebSearch = sessionStorage.getItem('amplify_pending_web_search') === 'true';
        const pendingSkillsRaw = sessionStorage.getItem('amplify_pending_skills');
        let pendingSkills: string[] = [];
        if (pendingSkillsRaw) {
          try { pendingSkills = JSON.parse(pendingSkillsRaw); } catch { /* ignore malformed value */ }
        }

        if (pendingWebSearch && selectedConversation) {
          // Persist onto the freshly-created conversation so ChatInput.tsx's
          // own send handler (which reads selectedConversation.data.webSearchEnabled)
          // includes it as a per-message flag.
          handleUpdateConversation(selectedConversation, {
            key: 'data',
            value: {
              ...selectedConversation.data,
              webSearchEnabled: true,
              skills: pendingSkills,
              skillSelectionMode: 'auto',
            },
          });
        }
        if (pendingWebSearch) {
          // Ensure Chat.tsx's local `plugins` array (a separate, session-level
          // gate ANDed with the per-message flag above — see
          // useChatSendService.ts) actually contains WEB_SEARCH.
          persistWebSearchPluginPreference(featureFlags);
        }

        sessionStorage.removeItem('amplify_pending_message');
        sessionStorage.removeItem('amplify_pending_docs');
        sessionStorage.removeItem('amplify_pending_model_id');
        sessionStorage.removeItem('amplify_pending_effort');
        sessionStorage.removeItem('amplify_pending_web_search');
        sessionStorage.removeItem('amplify_pending_skills');

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
