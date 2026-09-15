/**
 * NewUISourcesLayer
 *
 * Portal-based layer that replaces the old ChatSourcesBlock / ExpansionComponent
 * "Sources" disclosure with a polished, accessible pill-style disclosure in the
 * new UI design language.
 *
 * ── Architecture ─────────────────────────────────────────────────────────────
 *
 * ChatSourcesBlock renders a `<div class="mt-3">` wrapping an ExpansionComponent
 * with id="expandComponent" and title="Sources".  That element is inside the
 * assistant message's #chatHover content tree, which we cannot modify (Chat.tsx /
 * ChatMessage.tsx are off-limits per NEW_UI_GUIDE §2).
 *
 * This layer:
 *   1. Observes .chatcontainer for assistant messages via MutationObserver.
 *   2. For each assistant message, scans for a `button#expandComponent` whose
 *      `.font-medium` span text is exactly "Sources", then walks up to find
 *      the `.mt-3` wrapper element.
 *   3. Sets `data-nui-src-original="true"` on that wrapper so CSS can hide it.
 *   4. Creates (or reuses) a sibling `<div data-nui-src-host>` right after the
 *      original wrapper — this is the portal mount point.
 *   5. Reads source data from HomeContext (`message.data?.state?.sources`) by
 *      matching DOM elements to message objects via the same position-based
 *      filterRenderedMessages approach used by NewUIMessageActionsLayer.
 *   6. createPortal-s a <SourcesPill> into each host div.
 *
 * The original Sources wrapper is hidden via conversation-view.css:
 *   [data-new-ui="true"] [data-nui-src-original="true"] { display: none !important; }
 *
 * ── Edge cases ───────────────────────────────────────────────────────────────
 *
 * • If `message.data.state.sources` is empty or all groups have no items, the
 *   component skips that message (same as ChatSourcesBlock's own guard).
 * • If the only sources belong to `documentContext` (user-uploaded attachments
 *   in this same conversation turn), the pill is hidden — see the
 *   `isDocumentContextOnly` check below.  This aligns with the design brief's
 *   edge-case guidance: a "Sources" disclosure that only names the file the user
 *   just uploaded adds no information and should be hidden.
 * • "Show N more" appears when total flattened source count exceeds MAX_VISIBLE.
 * • Sources with a `.url` field open in a new tab; others trigger download
 *   through the same DOM bridge as ChatSource.tsx (clicking the underlying
 *   #sourceName link or download button).
 */

import React, {
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import {
  IconChevronDown,
  IconExternalLink,
  IconFile,
  IconFileText,
  IconFileSpreadsheet,
  IconPhoto,
  IconWorld,
} from '@tabler/icons-react';
import HomeContext from '@/pages/api/home/home.context';
import { Message } from '@/types/chat';
import { NewUILoadingStatus } from '@/components/NewUI/shared/NewUILoadingStatus';
import DOMPurify from 'dompurify';
import { useSession } from 'next-auth/react';
import {
  isBedrockKbDatasource,
  downloadBedrockKbFile,
  extractKbId,
} from '@/utils/app/bedrockKb';
import { downloadDataSourceFile } from '@/utils/app/files';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Max sources shown before a "Show N more" button appears. */
const MAX_VISIBLE = 4;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Mirror of NewUIMessageActionsLayer's filter — must stay in sync. */
function filterRenderedMessages(messages: Message[]): Message[] {
  return messages.filter(
    (m) => m.role !== 'tool' && !(m.data && m.data.actionResult),
  );
}

type RawSources = Record<string, { sources: any[] }>;

interface FlatSource {
  raw: any;
  index: number;    // 1-based index within the full flat list
  groupName: string;
}

/** Flatten the grouped sources dict into a single ordered list. */
function flattenSources(rawSources: RawSources): FlatSource[] {
  const flat: FlatSource[] = [];
  // Stable iteration order: deterministic for any reasonable JS engine
  for (const groupName of Object.keys(rawSources)) {
    const group = rawSources[groupName];
    if (!group?.sources) continue;
    for (const src of group.sources) {
      flat.push({ raw: src, index: flat.length + 1, groupName });
    }
  }
  return flat;
}

/**
 * Returns true if every source belongs to the `documentContext` group (the user's
 * own uploaded file for this turn).  When true, the pill is hidden — it reveals
 * no information the user doesn't already know.
 */
function isDocumentContextOnly(rawSources: RawSources): boolean {
  const keys = Object.keys(rawSources).filter(
    (k) => rawSources[k]?.sources?.length > 0,
  );
  return keys.length > 0 && keys.every((k) => k === 'documentContext');
}

/** Pluralise "1 source" / "N sources". */
function countLabel(n: number): string {
  return n === 1 ? '1 source' : `${n} sources`;
}

/** Try to extract the human-readable hostname from a URL string. */
function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** Choose a leading icon for a source. */
function SourceIcon({
  src,
  groupName,
  size = 16,
}: {
  src: any;
  groupName: string;
  size?: number;
}) {
  if (src.url) {
    return <IconWorld size={size} />;
  }
  if (groupName === 'images') {
    return <IconPhoto size={size} />;
  }
  const name: string = src.name ?? '';
  const ext = name.includes('.') ? name.split('.').pop()?.toLowerCase() ?? '' : '';
  if (['pdf'].includes(ext)) return <IconFileText size={size} style={{ color: 'var(--file-icon-pdf)' }} />;
  if (['xls', 'xlsx', 'csv'].includes(ext)) return <IconFileSpreadsheet size={size} style={{ color: 'var(--file-icon-sheet)' }} />;
  if (['doc', 'docx', 'txt', 'md'].includes(ext)) return <IconFileText size={size} style={{ color: 'var(--file-icon-doc)' }} />;
  return <IconFile size={size} />;
}

// ─── Source card ─────────────────────────────────────────────────────────────

interface SourceCardProps {
  item: FlatSource;
}

const SourceCard: React.FC<SourceCardProps> = ({ item }) => {
  const { raw, index, groupName } = item;
  const { data: session } = useSession();
  const user: any = session?.user;
  const [downloading, setDownloading] = useState(false);

  const name: string = raw.name ?? raw.url ?? 'Source';
  const hasUrl = !!raw.url;
  const secondary = hasUrl ? getDomain(raw.url) : (raw.type ?? null);

  const handleClick = async () => {
    // 1. Plain URL source — open in new tab.
    if (hasUrl) {
      const safe = DOMPurify.sanitize(raw.url);
      if (safe) window.open(safe, '_blank', 'noopener,noreferrer');
      return;
    }

    // 2. Bedrock Knowledge Base source — trigger presigned download.
    if (isBedrockKbDatasource(raw)) {
      const kbId = extractKbId(raw);
      // Try each location entry (mirrors ChatSource.tsx behaviour).
      const locations: any[] = Array.isArray(raw.locations) ? raw.locations : [];
      for (const loc of locations) {
        const s3Uri: string = loc?.source ?? '';
        if (kbId && s3Uri.startsWith('s3://')) {
          setDownloading(true);
          try {
            const success = await downloadBedrockKbFile(kbId, s3Uri);
            if (!success) alert('Unable to download file. Please try again later.');
          } finally {
            setDownloading(false);
          }
          return;
        }
      }
      return;
    }

    // 3. User-uploaded file source (has contentKey) — trigger file download.
    if (
      raw.contentKey &&
      !raw.contentKey.includes('global/') &&
      (raw.contentKey.includes(user?.email) ||
        raw.contentKey.includes(user?.username) ||
        raw.groupId)
    ) {
      setDownloading(true);
      try {
        await downloadDataSourceFile(
          { id: raw.contentKey, name: raw.name, type: raw.type },
          raw.groupId,
        );
      } finally {
        setDownloading(false);
      }
      return;
    }

    // 4. Nothing actionable for this source type — no-op.
  };

  return (
    <>
      <NewUILoadingStatus open={downloading} message="Downloading file…" />
      <div
        className="nui-src-card"
        role={hasUrl ? 'link' : 'button'}
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } }}
        aria-label={`Source ${index}: ${name}${hasUrl ? ' (opens in new tab)' : ''}`}
        title={name}
      >
      {/* Index */}
      <span className="nui-src-index" aria-hidden="true">{index}</span>

      {/* Icon */}
      <span className="nui-src-icon" aria-hidden="true">
        <SourceIcon src={raw} groupName={groupName} size={15} />
      </span>

      {/* Text */}
      <span className="nui-src-text">
        <span className="nui-src-title">{name}</span>
        {secondary && (
          <span className="nui-src-secondary">{secondary}</span>
        )}
      </span>

      {/* External link icon (shown on hover via CSS) */}
      {hasUrl && (
        <span className="nui-src-ext-icon" aria-hidden="true">
          <IconExternalLink size={12} />
        </span>
      )}
    </div>
    </>
  );
};

// ─── Sources pill + expanded panel ────────────────────────────────────────────

interface SourcesPillProps {
  rawSources: RawSources;
}

const SourcesPill: React.FC<SourcesPillProps> = ({ rawSources }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  // Stable IDs for aria-expanded / aria-controls linkage (React 18 useId)
  const uid = useId();
  const panelId = `nui-src-panel-${uid}`;
  const btnId = `nui-src-toggle-${uid}`;

  const flat = flattenSources(rawSources);
  const total = flat.length;
  if (total === 0) return null;

  // Multiple groups present?
  const groups = Array.from(new Set(flat.map((f) => f.groupName)));
  const multiGroup = groups.length > 1;

  const visible = showAll ? flat : flat.slice(0, MAX_VISIBLE);
  const remaining = total - MAX_VISIBLE;

  return (
    <div className="nui-src-root">
      {/* Pill toggle button */}
      <button
        id={btnId}
        className="nui-src-pill"
        onClick={() => { setIsOpen((v) => !v); }}
        aria-expanded={isOpen}
        aria-controls={panelId}
      >
        <span className="nui-src-pill-label">{countLabel(total)}</span>
        <span
          className="nui-src-pill-chevron"
          aria-hidden="true"
          data-open={isOpen ? 'true' : 'false'}
        >
          <IconChevronDown size={13} />
        </span>
      </button>

      {/* Expanded panel */}
      {isOpen && (
        <div
          id={panelId}
          className="nui-src-panel"
          role="region"
          aria-label="Sources"
        >
          {/* Optional group headers (only when multiple types) */}
          {multiGroup ? (
            groups.map((grp) => {
              const items = visible.filter((f) => f.groupName === grp);
              if (items.length === 0) return null;
              return (
                <div key={grp} className="nui-src-group">
                  <div className="nui-src-group-label" aria-hidden="true">
                    {grp === 'images' ? 'Images' :
                     grp === 'rag' ? 'Document search' :
                     grp === 'documentContext' ? 'Attached documents' :
                     grp === 'documentCacheContext' ? 'Advanced RAG' :
                     grp}
                  </div>
                  {items.map((item) => (
                    <SourceCard key={item.index} item={item}  />
                  ))}
                </div>
              );
            })
          ) : (
            visible.map((item) => (
              <SourceCard key={item.index} item={item}  />
            ))
          )}

          {/* Show more */}
          {!showAll && remaining > 0 && (
            <button
              className="nui-src-show-more"
              onClick={() => setShowAll(true)}
            >
              Show {remaining} more
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Slot tracker ─────────────────────────────────────────────────────────────

interface Slot {
  key: string;
  host: HTMLElement;
  rawSources: RawSources;
}

// ─── Layer component ──────────────────────────────────────────────────────────

export const NewUISourcesLayer: React.FC = () => {
  const {
    state: { selectedConversation, messageIsStreaming },
  } = useContext(HomeContext);

  const [slots, setSlots] = useState<Slot[]>([]);
  const conversationRef = useRef(selectedConversation);
  conversationRef.current = selectedConversation;
  const messageIsStreamingRef = useRef(messageIsStreaming);
  messageIsStreamingRef.current = messageIsStreaming;

  // ── Scan ─────────────────────────────────────────────────────────────────
  const scan = useCallback(() => {
    if (typeof document === 'undefined') return;
    const container = document.querySelector('.chatcontainer') as HTMLElement | null;
    if (!container || !conversationRef.current) return;

    const conversation = conversationRef.current;
    const messages = conversation.messages ?? [];
    const rendered = filterRenderedMessages(messages);

    // Collect all rendered message DOM elements (both user + assistant) in order
    const msgEls = Array.from(
      container.querySelectorAll<HTMLElement>(
        '.enhanced-chat-message.user-message, .enhanced-chat-message.assistant-message',
      ),
    );

    const nextSlots: Slot[] = [];

    msgEls.forEach((el, i) => {
      const message = rendered[i];
      if (!message || message.role !== 'assistant') return;

      // Don't show Sources while this message is streaming
      if (messageIsStreamingRef.current) {
        const allMsgEls = Array.from(
          container.querySelectorAll<HTMLElement>('.enhanced-chat-message'),
        );
        if (allMsgEls[allMsgEls.length - 1] === el) return;
      }

      const rawSources: RawSources | undefined = message.data?.state?.sources;
      if (!rawSources || Object.keys(rawSources).length === 0) return;

      // Edge case: skip if only documentContext sources (user's own uploads)
      if (isDocumentContextOnly(rawSources)) return;

      // Count real items
      const totalItems = Object.values(rawSources).reduce(
        (sum, g) => sum + (g?.sources?.length ?? 0),
        0,
      );
      if (totalItems === 0) return;

      // Locate the original Sources .mt-3 wrapper within this message element
      let wrapper: HTMLElement | null = null;
      const expBtns = Array.from(
        el.querySelectorAll<HTMLElement>('button#expandComponent'),
      );
      for (const btn of expBtns) {
        const labelSpan = btn.querySelector('.font-medium') as HTMLElement | null;
        if (labelSpan && labelSpan.textContent?.trim() === 'Sources') {
          wrapper = btn.closest('.mt-3') as HTMLElement | null;
          break;
        }
      }
      if (!wrapper) return;

      // Hide the original wrapper
      wrapper.setAttribute('data-nui-src-original', 'true');

      // Find or create the sibling portal host
      let host = wrapper.nextElementSibling as HTMLElement | null;
      if (!host || host.getAttribute('data-nui-src-host') !== 'true') {
        host = document.createElement('div');
        host.setAttribute('data-nui-src-host', 'true');
        wrapper.parentElement?.insertBefore(host, wrapper.nextSibling);
      }

      const key = message.id ?? `assistant-${i}`;
      nextSlots.push({ key, host, rawSources });
    });

    setSlots(nextSlots);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Attach MutationObserver and ResizeObserver ────────────────────────────
  useEffect(() => {
    let cleanupFn: (() => void) | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const attach = () => {
      const container = document.querySelector('.chatcontainer') as HTMLElement | null;
      if (!container) {
        retryTimer = setTimeout(attach, 200);
        return;
      }

      scan();

      const debouncedScan = () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(scan, 150);
      };

      const observer = new MutationObserver((records) => {
        for (const r of records) {
          // Ignore mutations inside our own portal hosts to avoid rescan loops
          if (
            r.target instanceof HTMLElement &&
            (r.target.hasAttribute('data-nui-src-host') ||
              r.target.closest('[data-nui-src-host]'))
          ) {
            continue;
          }
          debouncedScan();
          return;
        }
      });
      observer.observe(container, { childList: true, subtree: true });

      cleanupFn = () => {
        observer.disconnect();
        if (debounceTimer) clearTimeout(debounceTimer);
        // Clean up all portal hosts
        container
          .querySelectorAll('[data-nui-src-host]')
          .forEach((h) => h.parentElement?.removeChild(h));
        container
          .querySelectorAll('[data-nui-src-original]')
          .forEach((w) => w.removeAttribute('data-nui-src-original'));
      };
    };

    attach();
    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      if (cleanupFn) cleanupFn();
    };
  }, [scan]);

  // Re-scan on message count / streaming state change
  const messageCount = selectedConversation?.messages?.length ?? 0;
  useEffect(() => {
    const t = setTimeout(scan, 120);
    return () => clearTimeout(t);
  }, [messageCount, messageIsStreaming, scan]);

  // ── Render portals ────────────────────────────────────────────────────────
  if (!slots.length) return null;

  return (
    <>
      {slots.map((slot) =>
        createPortal(
          <SourcesPill key={slot.key} rawSources={slot.rawSources} />,
          slot.host,
        ),
      )}
    </>
  );
};

export default NewUISourcesLayer;
