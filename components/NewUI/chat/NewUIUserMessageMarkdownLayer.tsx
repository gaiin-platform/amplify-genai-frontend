/**
 * NewUIUserMessageMarkdownLayer
 *
 * Implements chat-pane-migration-spec.md §4 (markdown in user messages) and
 * §5 (collapsing long user messages).
 *
 * Per One-Directory Rule: zero modifications to ChatMessage.tsx, Chat.tsx,
 * or any file outside components/NewUI/.
 *
 * Architecture:
 *   - Scans .chatcontainer for .user-message elements using the same
 *     MutationObserver + message-count fallback pattern as
 *     NewUIMessageActionsLayer.
 *   - For each user message appends a .new-ui-user-md-host div to the #chatHover
 *     bubble container — the same div that provides the bubble
 *     background/radius/padding — if not already present.
 *   - hasLargeText messages are included, with their `[TEXT_n]` paste
 *     placeholders stripped: NewUITranscriptPastedTextLayer owns the pastes as
 *     chips above the bubble, so the bubble renders the typed prompt only.
 *   - Renders ReactDOM.createPortal content into each host div, so the
 *     markdown is rendered inside the bubble's React tree.
 *   - Adds the class .new-ui-has-markdown to each processed .user-message
 *     element; conversation-view.css uses this class to hide the original
 *     #userMessage (raw whitespace-pre-wrap text).
 *   - During editing (#editResponse present) the markdown host is hidden via
 *     :has(#editResponse) CSS so the inline UserMessageEditor is unobstructed.
 *
 * Spec §4 scope restriction:
 *   Renders paragraphs, line breaks, fenced code, inline code, lists, bold,
 *   italic ONLY. Headings are downgraded to bold paragraphs; images are
 *   omitted; tables are not rendered (remark-gfm is intentionally not used
 *   for user bubbles so GFM table syntax renders as literal pipe characters
 *   rather than a table). Bubble text stays sans-serif regardless of any
 *   future serif "Chat font" setting (font-family forced via CSS).
 *
 * Spec §5 collapse:
 *   Measures scrollHeight on the rendered markdown content via useLayoutEffect
 *   (NOT character count) after first paint. If > 380px, collapses with
 *   a bottom fade mask + left-aligned plain-text "Show more" / "Show less"
 *   toggle. Expand animates max-height over 240ms ease-out. Per-message,
 *   non-persisted state (re-collapses on reload).
 */

import React, {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import HomeContext from '@/pages/api/home/home.context';
import { Message } from '@/types/chat';
import { stripLargeTextPlaceholders } from '@/components/NewUI/shared/attachmentTypes';

// ─── Inline remark-breaks plugin ─────────────────────────────────────────────

/**
 * Treats single newlines within paragraph text as hard line breaks (<br>),
 * matching the behaviour of the `remark-breaks` npm package (not installed).
 *
 * Implementation: walks the unist AST and splits text nodes on `\n`,
 * inserting `{type:'break'}` nodes between the resulting parts.
 *
 * Safe for fenced-code blocks: those are represented as `{type:'code'}` AST
 * nodes (not `text` nodes) and are therefore never visited by this walk.
 */
function remarkInlineBreaks() {
  return (tree: any): void => {
    const walk = (node: any): void => {
      if (!node.children) return;
      const next: any[] = [];
      for (const child of node.children) {
        if (child.type === 'text' && (child.value as string).includes('\n')) {
          const parts = (child.value as string).split('\n');
          parts.forEach((part: string, i: number) => {
            if (i > 0) next.push({ type: 'break' });
            if (part) next.push({ type: 'text', value: part });
          });
        } else {
          walk(child);
          next.push(child);
        }
      }
      node.children = next;
    };
    walk(tree);
  };
}

// ─── Restricted markdown component overrides (spec §4) ───────────────────────

/**
 * Headings are not allowed in user bubbles per spec §4 ("Do not render
 * headings…in a user bubble"). Downgrade h1–h6 to bold paragraphs so that
 * someone who pastes a Markdown document doesn't get a large `<h1>` inside
 * their own message.
 */
const HeadingAsParagraph = ({
  children,
}: {
  children?: React.ReactNode;
}) => (
  <p>
    <strong>{children}</strong>
  </p>
);

const USER_MD_COMPONENTS = {
  h1: HeadingAsParagraph,
  h2: HeadingAsParagraph,
  h3: HeadingAsParagraph,
  h4: HeadingAsParagraph,
  h5: HeadingAsParagraph,
  h6: HeadingAsParagraph,
  // Images are not rendered in user bubbles per spec §4.
  img: () => null,
  // Fenced code blocks and inline code are styled entirely via
  // conversation-view.css (.new-ui-user-markdown pre, .new-ui-user-inline-code).
  // The custom className prop makes inline vs block distinguishable by CSS
  // without needing a custom React renderer here.
  code: ({
    inline,
    children,
    ...rest
  }: {
    inline?: boolean;
    children?: React.ReactNode;
    [key: string]: any;
  }) => {
    if (inline) {
      return (
        <code className="new-ui-user-inline-code" {...rest}>
          {children}
        </code>
      );
    }
    return (
      <pre className="new-ui-user-code-block">
        <code>{children}</code>
      </pre>
    );
  },
} as const;

// ─── Collapse constants (spec §5) ────────────────────────────────────────────

/** Collapse threshold from spec §5: "collapse when rendered height > 380px". */
const COLLAPSE_THRESHOLD_PX = 380;

// ─── Per-message markdown + collapse component ───────────────────────────────

interface UserMsgMarkdownProps {
  content: string;
}

const UserMsgMarkdown: React.FC<UserMsgMarkdownProps> = ({ content }) => {
  const innerRef = useRef<HTMLDivElement>(null);
  const [needsCollapse, setNeedsCollapse] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [measuredHeight, setMeasuredHeight] = useState(0);
  // Suppress the transition on initial collapse so the page doesn't animate
  // a collapsing message on every load. Transitions only start after the user
  // first clicks "Show more" or "Show less".
  const hasInteractedRef = useRef(false);

  // Measure rendered height after every content change. useLayoutEffect fires
  // synchronously after DOM commit and before paint, so the user never sees
  // the full-height flash before the collapse kicks in.
  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    // Temporarily remove max-height so we measure the true full content height.
    // (At this point innerStyle has not yet been applied — this is the initial
    // render with no max-height — so scrollHeight IS the full content height.)
    const h = el.scrollHeight;
    if (h > COLLAPSE_THRESHOLD_PX) {
      setNeedsCollapse(true);
      setMeasuredHeight(h);
      setIsExpanded(false);
    } else {
      // Content fits — reset everything (handles shrinking after an edit).
      setNeedsCollapse(false);
      setMeasuredHeight(0);
      setIsExpanded(false);
    }
  }, [content]);

  const handleToggle = () => {
    hasInteractedRef.current = true;
    setIsExpanded((v) => !v);
  };

  // Build the inline style for the collapsible inner wrapper.
  let innerStyle: React.CSSProperties = {};
  if (needsCollapse) {
    const transition = hasInteractedRef.current
      ? { transition: 'max-height 240ms ease-out' }
      : {};

    if (isExpanded) {
      // Animate open: concrete px value so the CSS transition can interpolate.
      innerStyle = {
        maxHeight: measuredHeight,
        overflow: 'hidden',
        maskImage: 'none',
        WebkitMaskImage: 'none',
        ...transition,
      };
    } else {
      // Collapsed state: fade the bottom 72px per spec §5.
      innerStyle = {
        maxHeight: COLLAPSE_THRESHOLD_PX,
        overflow: 'hidden',
        maskImage:
          'linear-gradient(to bottom, #000 0, #000 calc(100% - 72px), transparent 100%)',
        WebkitMaskImage:
          'linear-gradient(to bottom, #000 0, #000 calc(100% - 72px), transparent 100%)',
        ...transition,
      };
    }
  }

  return (
    <div className="new-ui-user-markdown">
      {/* The collapsible wrapper — styled inline for the mask/max-height animation */}
      <div ref={innerRef} style={innerStyle}>
        <ReactMarkdown
          remarkPlugins={[remarkInlineBreaks as any]}
          components={USER_MD_COMPONENTS as any}
        >
          {content}
        </ReactMarkdown>
      </div>

      {/* Show more / Show less control (spec §5):
          Plain text, left-aligned inside the right-aligned bubble, no icon,
          no background. 14px gap below the faded edge via padding-top. */}
      {needsCollapse && (
        <button
          type="button"
          className="new-ui-show-more"
          onClick={handleToggle}
        >
          {isExpanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
};

// ─── Portal host tracking ─────────────────────────────────────────────────────

interface HostEntry {
  key: string;
  hostEl: HTMLElement;
  content: string;
}

/**
 * Mirrors Chat.tsx's render-time message filter exactly (same as
 * NewUIMessageActionsLayer) so that the Nth element in this filtered list
 * corresponds 1:1 to the Nth .enhanced-chat-message in the DOM.
 */
function filterRenderedMessages(messages: Message[]): Message[] {
  return messages.filter(
    (m) => m.role !== 'tool' && !(m.data && m.data.actionResult),
  );
}

// ─── Main layer component ─────────────────────────────────────────────────────

export const NewUIUserMessageMarkdownLayer: React.FC = () => {
  const {
    state: { selectedConversation },
  } = useContext(HomeContext);

  const [hostEntries, setHostEntries] = useState<HostEntry[]>([]);
  const convRef = useRef(selectedConversation);
  convRef.current = selectedConversation;

  /**
   * Scans .chatcontainer for user message elements, inserts .new-ui-user-md-host
   * divs into each #chatHover, and builds the hostEntries state that drives the
   * portal renders below.
   *
   * Inserting the host div is idempotent: querySelector checks before creating.
   * Adding .new-ui-has-markdown is also idempotent (classList.add is a no-op
   * when the class is already present).
   */
  const scan = useCallback(() => {
    if (typeof document === 'undefined') return;
    const container = document.querySelector('.chatcontainer');
    if (!container || !convRef.current) return;

    const rendered = filterRenderedMessages(convRef.current.messages ?? []);
    const msgEls = Array.from(
      container.querySelectorAll<HTMLElement>('.enhanced-chat-message'),
    );

    const nextEntries: HostEntry[] = [];

    for (let i = 0; i < msgEls.length; i++) {
      const msgEl = msgEls[i];
      const message = rendered[i];
      if (!message) continue;

      // Only process user messages.
      if (!msgEl.classList.contains('user-message')) continue;

      // Pasted-text messages carry a `[TEXT_n]` placeholder per paste in their
      // label. NewUITranscriptPastedTextLayer renders those pastes as chips
      // above the bubble, so the bubble owns the typed prompt *only* — strip the
      // placeholders and let CSS hide #userMessage (whose classic
      // renderMessageWithLargeText output re-prints the paste inline).
      const raw = message.label ?? message.content ?? '';
      const content = (message.data as any)?.hasLargeText
        ? stripLargeTextPlaceholders(raw)
        : raw.trim();
      // Nothing typed alongside the paste — there is no bubble to render.
      if (!content) {
        msgEl.classList.remove('new-ui-has-markdown');
        continue;
      }

      // #chatHover is the bubble container (--bg-raised bg, 12px 18px padding).
      const chatHover = msgEl.querySelector<HTMLElement>('#chatHover');
      if (!chatHover) continue;

      // Find or create the portal host inside the bubble.
      let hostEl = chatHover.querySelector<HTMLElement>('.new-ui-user-md-host');
      if (!hostEl) {
        hostEl = document.createElement('div');
        hostEl.className = 'new-ui-user-md-host';
        chatHover.appendChild(hostEl);
      }

      // Mark the element so CSS can hide #userMessage (the raw pre-wrap text).
      msgEl.classList.add('new-ui-has-markdown');

      const key = message.id ?? `user-md-${i}`;
      nextEntries.push({ key, hostEl, content });
    }

    setHostEntries(nextEntries);
  }, []);

  // ── Attach MutationObserver on .chatcontainer (same pattern as ActionLayer) ─

  useEffect(() => {
    let cleanupFn: (() => void) | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const attach = () => {
      const container = document.querySelector('.chatcontainer');
      if (!container) {
        retryTimer = setTimeout(attach, 200);
        return;
      }
      scan();
      const debouncedScan = () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(scan, 120);
      };
      const observer = new MutationObserver(debouncedScan);
      observer.observe(container, { childList: true, subtree: true });
      cleanupFn = () => {
        observer.disconnect();
        if (debounceTimer) clearTimeout(debounceTimer);
      };
    };

    attach();
    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      if (cleanupFn) cleanupFn();
    };
  }, [scan]);

  // Rescan whenever message count changes (new message sent/received).
  const msgCount = selectedConversation?.messages?.length ?? 0;
  useEffect(() => {
    const t = setTimeout(scan, 100);
    return () => clearTimeout(t);
  }, [msgCount, scan]);

  // ── Render portals into each host element ────────────────────────────────

  return (
    <>
      {hostEntries.map(({ key, hostEl, content }) =>
        createPortal(
          <UserMsgMarkdown content={content} />,
          hostEl,
          key,
        ),
      )}
    </>
  );
};

export default NewUIUserMessageMarkdownLayer;
