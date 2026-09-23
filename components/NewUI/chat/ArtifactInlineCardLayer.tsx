/**
 * ArtifactInlineCardLayer — DOM observer that replaces the old
 * "Creating Your Artifact…" box with polished inline cards.
 *
 * Pattern: same as NewUISourcesLayer — MutationObserver + createPortal.
 *
 * Key fixes in this revision:
 *  - Bug 2: Card host is inserted AFTER the wrapping <pre> element (not
 *    inside it), so the card never inherits the monospace font or dark
 *    background that prose styles apply to <pre> blocks.
 *  - Bug 3: CSS (conversation-view.css) hides #artifactsButtonBlock entirely.
 *    This layer no longer needs to tag it; the CSS rule is enough.
 *  - Bug 4: isPanelOpen initial state comes from a module-level flag that is
 *    kept current by the same openArtifactsTrigger event listener, so cards
 *    rendered after the panel is opened start in the correct state.
 *  - Title fix: CardWrapper now receives msgIdx and uses it to look up
 *    artifact name from selectedConversation when selectedArtifacts is null
 *    (e.g. historical messages). Also pre-loads selectedArtifacts before
 *    opening the panel for historical artifacts so Artifacts.tsx has content.
 */

import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { IconFileText } from '@tabler/icons-react';
import { IconEye, IconEyeOff } from '@tabler/icons-react';
import HomeContext from '@/pages/api/home/home.context';

/* ─── Module-level panel open state so new cards start with the right value ── */
let _panelIsOpen = false;

// SSR-safe: only register the listener in the browser
if (typeof window !== 'undefined') {
  window.addEventListener('openArtifactsTrigger', (e: Event) => {
    const detail = (e as CustomEvent).detail;
    _panelIsOpen = !!detail?.isOpen;
  });
}

/* ─── Attribute markers ──────────────────────────────────────────────────── */
const CREATING_ATTR = 'data-nui-artifact-creating';
const CARD_HOST_ATTR = 'data-nui-inline-card-host';

/* ─────────────────────────────────────────────────────────────────────────────
   Inline Card (pure presentational)
───────────────────────────────────────────────────────────────────────────── */

interface CardProps {
  isGenerating: boolean;
  isPanelOpen: boolean;
  onTogglePanel: () => void;
  title?: string;
  type?: string;
  version?: number;
}

const ArtifactInlineCard: React.FC<CardProps> = ({
  isGenerating,
  isPanelOpen,
  onTogglePanel,
  title,
  type,
  version,
}) => {
  const displayTitle = title || 'Untitled artifact';
  const displayType = type ? type.charAt(0).toUpperCase() + type.slice(1) : 'Document';

  return (
    <div
      role="region"
      aria-label={isGenerating ? 'Generating artifact' : `Artifact: ${displayTitle}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 14px',
        borderRadius: 12,
        border: '1px solid var(--border-subtle)',
        background: 'var(--bg-raised)',
        margin: '6px 0',
        maxWidth: 480,
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
      }}
    >
      {/* Shimmer overlay while generating */}
      {isGenerating && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--accent) 8%, transparent) 50%, transparent 100%)',
            backgroundSize: '200% 100%',
            animation: 'nui-artifact-shimmer 1.6s ease infinite',
          }}
        />
      )}

      {/* Icon */}
      <div
        aria-hidden="true"
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: isGenerating
            ? 'color-mix(in srgb, var(--accent) 14%, var(--bg-active))'
            : 'var(--bg-active)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {isGenerating ? (
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
            style={{ animation: 'spin 0.9s linear infinite' }}
            aria-hidden="true"
          >
            <circle
              cx="9"
              cy="9"
              r="7"
              stroke="var(--accent)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="28 16"
            />
          </svg>
        ) : (
          <IconFileText size={18} style={{ color: 'var(--accent)' }} />
        )}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
          }}
        >
          {displayTitle}
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-muted)',
            marginTop: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
          }}
        >
          <span>{isGenerating ? 'Writing…' : displayType}</span>
          {!isGenerating && version && version > 1 && (
            <span
              style={{
                background: 'var(--bg-active)',
                borderRadius: 4,
                padding: '0 5px',
                fontSize: 11,
                color: 'var(--text-secondary)',
              }}
            >
              v{version}
            </span>
          )}
        </div>
      </div>

      {/* Open / Hide button */}
      {!isGenerating && (
        <button
          type="button"
          aria-label={isPanelOpen ? 'Hide artifact panel' : 'Open artifact panel'}
          title={isPanelOpen ? 'Hide' : 'Open'}
          onClick={onTogglePanel}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '0 10px',
            height: 28,
            borderRadius: 7,
            border: '1px solid var(--border-subtle)',
            background: 'transparent',
            color: 'var(--text-primary)',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'background 0.12s',
            fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
          }}
        >
          {isPanelOpen ? (
            <IconEyeOff size={13} aria-hidden="true" />
          ) : (
            <IconEye size={13} aria-hidden="true" />
          )}
          {isPanelOpen ? 'Hide' : 'Open'}
        </button>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────────────────────
   Card Wrapper — reads live context, manages toggle
───────────────────────────────────────────────────────────────────────────── */

interface CardWrapperProps {
  /** Index of the artifact to open when the card is clicked. -1 = use latest. */
  artifactIndex: number;
  /**
   * Index in selectedConversation.messages for this card's assistant turn.
   * Used to look up artifact name/data from the saved conversation when
   * selectedArtifacts is null (e.g. historical messages after panel close).
   * -1 when unknown.
   */
  msgIdx: number;
}

const CardWrapper: React.FC<CardWrapperProps> = ({ artifactIndex, msgIdx }) => {
  const {
    state: { artifactIsStreaming, selectedArtifacts, selectedConversation },
    dispatch: homeDispatch,
  } = useContext(HomeContext);

  // Bug 4 fix: initialise from module-level flag so cards rendered while the
  // panel is already open start in the correct "Hide" state.
  const [isPanelOpen, setIsPanelOpen] = useState(() => _panelIsOpen);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setIsPanelOpen(!!detail?.isOpen);
    };
    window.addEventListener('openArtifactsTrigger', handler);
    return () => window.removeEventListener('openArtifactsTrigger', handler);
  }, []);

  // ── Title fix: look up artifact from saved conversation when selectedArtifacts
  //    is null. This handles historical messages after the panel has been closed
  //    (cleanUp() sets selectedArtifacts → undefined). ─────────────────────────
  const getFromConversation = () => {
    if (!selectedConversation || msgIdx < 0) return null;
    const msg = selectedConversation.messages?.[msgIdx];
    // message.data.artifacts is an array of ArtifactBlockDetail
    const detail = msg?.data?.artifacts?.[0];
    if (!detail?.artifactId) return null;
    const list = (selectedConversation as any).artifacts?.[detail.artifactId];
    if (!list || list.length === 0) return null;
    // Find the version that was generated for this specific message
    let idx = list.length - 1;
    if (detail.version) {
      const found = list.findIndex((a: any) => a.version === detail.version);
      if (found !== -1) idx = found;
    }
    return { list, idx, artifactId: detail.artifactId };
  };

  const liveTarget =
    artifactIndex >= 0
      ? artifactIndex
      : selectedArtifacts
      ? selectedArtifacts.length - 1
      : 0;

  const liveArtifact =
    selectedArtifacts && selectedArtifacts.length > 0
      ? selectedArtifacts[Math.min(liveTarget, selectedArtifacts.length - 1)]
      : null;

  // Fall back to conversation data when live selectedArtifacts is null/empty
  const convData = liveArtifact ? null : getFromConversation();
  const displayArtifact: any =
    liveArtifact ?? (convData ? convData.list[convData.idx] : null);

  const handleTogglePanel = () => {
    if (isPanelOpen) {
      window.dispatchEvent(
        new CustomEvent('openArtifactsTrigger', { detail: { isOpen: false } }),
      );
    } else if (!liveArtifact && convData) {
      // Historical artifact: pre-load selectedArtifacts so Artifacts.tsx has
      // content before the panel opens (mirrors ArtifactsBlock.tsx line 73).
      homeDispatch({ field: 'selectedArtifacts', value: convData.list });
      window.dispatchEvent(
        new CustomEvent('openArtifactsTrigger', {
          detail: { isOpen: true, artifactIndex: convData.idx },
        }),
      );
    } else {
      const idx = selectedArtifacts
        ? Math.min(liveTarget, selectedArtifacts.length - 1)
        : 0;
      window.dispatchEvent(
        new CustomEvent('openArtifactsTrigger', {
          detail: { isOpen: true, artifactIndex: idx },
        }),
      );
    }
  };

  return (
    <ArtifactInlineCard
      isGenerating={!!artifactIsStreaming}
      isPanelOpen={isPanelOpen}
      onTogglePanel={handleTogglePanel}
      title={displayArtifact?.name}
      type={displayArtifact?.type}
      version={displayArtifact?.version}
    />
  );
};

/* ─────────────────────────────────────────────────────────────────────────────
   Layer
───────────────────────────────────────────────────────────────────────────── */

export const ArtifactInlineCardLayer: React.FC = () => {
  const cardHostsRef = useRef<Map<HTMLElement, { artifactIndex: number; msgIdx: number }>>(
    new Map(),
  );
  const observerRef = useRef<MutationObserver | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const instanceCounter = useRef(0);
  const [portals, setPortals] = useState<
    Array<{ host: HTMLElement; artifactIndex: number; msgIdx: number }>
  >([]);

  const processNodes = useCallback(() => {
    const chatContainer = document.querySelector('.chatcontainer');
    if (!chatContainer) return;

    let changed = false;

    // Find .flex-col.gap-4 divs containing "Creating Your Artifact…" text
    const candidates = chatContainer.querySelectorAll<HTMLElement>('div.flex-col, div.flex.flex-col');
    candidates.forEach((div) => {
      if (div.hasAttribute(CREATING_ATTR)) return;

      // Identify by text content
      const hasCreatingText = Array.from(div.querySelectorAll('*')).some(
        (el) => el.textContent?.includes('Creating Your Artifact'),
      );
      if (!hasCreatingText) return;

      // Must be a .flex-col wrapper (the outer container AutoArtifactsBlock renders)
      const hasGap4 =
        div.classList.contains('gap-4') ||
        div.style.gap === '1rem';
      if (!hasGap4) return;

      // Mark the creating block for CSS hiding
      div.setAttribute(CREATING_ATTR, 'true');

      // Bug 2 fix: insert the card host AFTER the <pre> ancestor (if any),
      // not inside it. This moves the card completely out of the <pre> element
      // so it does not inherit the monospace font or dark bg from prose styles.
      const preAncestor = div.closest('pre') as HTMLElement | null;
      const insertionTarget: HTMLElement = preAncestor ?? div;

      // Only insert one host per target
      if (insertionTarget.nextElementSibling?.hasAttribute(CARD_HOST_ATTR)) {
        return;
      }

      // Title fix: read the message index from [data-message-index] on the
      // nearest .chatContentBlock so each card knows which saved message it
      // belongs to (used in CardWrapper to look up artifact name from the
      // saved conversation when selectedArtifacts is null).
      const contentBlock = div.closest('[data-message-index]');
      const msgIdx = contentBlock
        ? parseInt((contentBlock as HTMLElement).dataset.messageIndex ?? '-1', 10)
        : -1;

      const host = document.createElement('div');
      host.setAttribute(CARD_HOST_ATTR, String(++instanceCounter.current));
      host.setAttribute('data-new-ui-shell', 'true');
      insertionTarget.insertAdjacentElement('afterend', host);
      cardHostsRef.current.set(host, { artifactIndex: -1, msgIdx });
      changed = true;
    });

    if (changed) {
      const currentPortals: Array<{ host: HTMLElement; artifactIndex: number; msgIdx: number }> = [];
      cardHostsRef.current.forEach((data, host) => {
        if (document.contains(host)) {
          currentPortals.push({ host, artifactIndex: data.artifactIndex, msgIdx: data.msgIdx });
        } else {
          cardHostsRef.current.delete(host);
        }
      });
      setPortals([...currentPortals]);
    }
  }, []);

  const startObserving = useCallback(() => {
    const chatContainer = document.querySelector('.chatcontainer');
    if (!chatContainer) {
      retryTimerRef.current = setTimeout(startObserving, 300);
      return;
    }

    processNodes();

    observerRef.current = new MutationObserver(() => processNodes());
    observerRef.current.observe(chatContainer, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }, [processNodes]);

  useEffect(() => {
    startObserving();
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      observerRef.current?.disconnect();
    };
  }, [startObserving]);

  if (portals.length === 0) return null;

  return (
    <>
      {portals.map(({ host, artifactIndex, msgIdx }) =>
        createPortal(
          <CardWrapper
            key={host.getAttribute(CARD_HOST_ATTR)}
            artifactIndex={artifactIndex}
            msgIdx={msgIdx}
          />,
          host,
        ),
      )}
    </>
  );
};

export default ArtifactInlineCardLayer;
