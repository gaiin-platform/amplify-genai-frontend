import { IconArrowUpRight, IconChevronLeft, IconChevronRight, IconCode, IconLoader2, IconX } from '@tabler/icons-react';
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { lzwCompress } from '@/utils/app/lzwCompression';

import type { Artifact } from '@/types/artifacts';

import { ArtifactContentRenderer } from './ArtifactContentRenderer';
import { ArtifactExportMenu } from './ArtifactExportMenu';
import { formatArtifactCreated, type ArtifactLibraryItem } from './artifactLibraryModel';

import Papa from 'papaparse';

interface Props {
  item: ArtifactLibraryItem;
  onClose: () => void;
  /** Opens the version currently on screen in its source chat. */
  onOpenChat?: (shown: ArtifactLibraryItem) => void;
  /** Fetches a saved version's content; older versions load only when stepped to. */
  loadVersion?: (version: ArtifactLibraryItem) => Promise<ArtifactLibraryItem>;
}

export const ArtifactPreviewModal: React.FC<Props> = ({
  item,
  onClose,
  onOpenChat,
  loadVersion,
}) => {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [showCode, setShowCode] = useState(false);
  const [mounted, setMounted] = useState(false);
  const versions = item.versions.length ? item.versions : [item];
  const [versionIndex, setVersionIndex] = useState(versions.length - 1);
  // Versions already fetched, by stableKey. `item` arrives with its content loaded.
  const [loaded, setLoaded] = useState<Record<string, ArtifactLibraryItem>>({});
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [loadFailedKey, setLoadFailedKey] = useState<string | null>(null);
  // Bumped whenever a different artifact opens, so a fetch that outlives its artifact is dropped.
  const generationRef = useRef(0);
  // Versions with a fetch in flight, so stepping back to one does not start a second.
  const inFlightRef = useRef(new Set<string>());

  useEffect(() => {
    setMounted(true);
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    generationRef.current += 1;
    inFlightRef.current = new Set();
    setShowCode(false);
    setVersionIndex(versions.length - 1);
    setLoaded({});
    setLoadingKey(null);
    setLoadFailedKey(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.stableKey]);

  const currentIndex = Math.min(versionIndex, versions.length - 1);
  const target = versions[currentIndex];
  const shown =
    target.stableKey === item.stableKey
      ? item
      : loaded[target.stableKey] ?? target;

  const showVersion = async (index: number) => {
    const next = versions[index];
    if (!next) return;
    setVersionIndex(index);
    setShowCode(false);
    setLoadFailedKey(null);
    if (next.stableKey === item.stableKey || next.hasContent || loaded[next.stableKey] || !loadVersion) return;
    if (inFlightRef.current.has(next.stableKey)) {
      setLoadingKey(next.stableKey);
      return;
    }
    const generation = generationRef.current;
    const inFlight = inFlightRef.current;
    inFlight.add(next.stableKey);
    setLoadingKey(next.stableKey);
    try {
      const hydrated = await loadVersion(next);
      if (generation !== generationRef.current) return;
      if (hydrated.hasContent) {
        setLoaded((current) => ({ ...current, [next.stableKey]: hydrated }));
        setLoadFailedKey((current) => (current === next.stableKey ? null : current));
      } else {
        setLoadFailedKey(next.stableKey);
      }
    } catch {
      if (generation === generationRef.current) setLoadFailedKey(next.stableKey);
    } finally {
      inFlight.delete(next.stableKey);
      if (generation === generationRef.current) setLoadingKey((current) => (current === next.stableKey ? null : current));
    }
  };

  if (!mounted || typeof document === 'undefined') return null;

  const artifact: Artifact = {
    ...shown.artifact,
    contents: Array.isArray(shown.artifact.contents) && shown.artifact.contents.length
      ? shown.artifact.contents
      : lzwCompress(shown.content),
  };
  const shownCreated = formatArtifactCreated(shown.created);
  const mutedStyle = { color: 'var(--text-muted)' };
  const body = loadingKey === shown.stableKey ? (
    <div className="flex items-center justify-center h-full text-[13px]" style={mutedStyle}>
      <IconLoader2 size={16} className="motion-safe:animate-spin motion-reduce:animate-none mr-2" />
      Loading version…
    </div>
  ) : loadFailedKey === shown.stableKey || !shown.hasContent ? (
    <div className="flex items-center justify-center h-full text-[13px]" style={mutedStyle}>
      Unable to load this version.
    </div>
  ) : (
    <ArtifactContentRenderer artifact={artifact} showCodeView={showCode} />
  );
  const stepButtonClass =
    'h-8 w-8 rounded-[7px] flex items-center justify-center disabled:opacity-30';

  return createPortal(
    <div
      className="fixed inset-0 z-[10011] flex items-center justify-center p-4"
      data-new-ui-shell="true"
      style={{ backgroundColor: 'rgba(0,0,0,.58)' }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="artifact-preview-title"
        className="flex flex-col w-full max-w-5xl h-[min(760px,90dvh)] rounded-[14px] border shadow-2xl"
        style={{
          backgroundColor: 'var(--bg-app)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <header
          className="flex items-center gap-3 px-5 py-4 border-b flex-shrink-0"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div className="min-w-0 flex-1">
            <h2
              id="artifact-preview-title"
              className="truncate text-[16px] font-semibold"
              style={{ color: 'var(--text-primary)' }}
            >
              {shown.name}
            </h2>
            <p
              className="text-[12px] mt-1"
              style={{ color: 'var(--text-muted)' }}
            >
              {shown.nuiType} · v{shown.artifact.version}
              {shownCreated && (
                <>
                  {' · '}
                  <time dateTime={shownCreated.iso} title={shownCreated.title}>
                    {shownCreated.date}
                    {shownCreated.time ? `, ${shownCreated.time}` : ''}
                  </time>
                </>
              )}
              {shown.source.conversation
                ? ` · ${shown.source.conversation.name}`
                : shown.source.conversationId
                ? ' · Source conversation'
                : ''}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {versions.length > 1 && (
              <div
                className="flex items-center mr-1"
                role="group"
                aria-label="Artifact versions"
                data-new-ui-artifact-versions="true"
              >
                <button
                  type="button"
                  aria-label="Previous version"
                  title="Previous version"
                  disabled={currentIndex <= 0}
                  onClick={() => void showVersion(currentIndex - 1)}
                  className={stepButtonClass}
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <IconChevronLeft size={16} />
                </button>
                <span
                  className="text-[12px] tabular-nums whitespace-nowrap px-1"
                  style={{ color: 'var(--text-secondary)' }}
                  aria-live="polite"
                >
                  v{shown.artifact.version} of {versions.length}
                </span>
                <button
                  type="button"
                  aria-label="Next version"
                  title="Next version"
                  disabled={currentIndex >= versions.length - 1}
                  onClick={() => void showVersion(currentIndex + 1)}
                  className={stepButtonClass}
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <IconChevronRight size={16} />
                </button>
              </div>
            )}
            {(shown.nuiType === 'code' || shown.nuiType === 'visualization') && (
              <button
                type="button"
                aria-label={showCode ? 'Show preview' : 'Show source'}
                title={showCode ? 'Show preview' : 'Show source'}
                onClick={() => setShowCode((value) => !value)}
                className="h-8 px-2 rounded-[7px] text-[12px] border"
                style={{
                  color: 'var(--text-secondary)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                <IconCode size={14} />
              </button>
            )}
            <ArtifactExportMenu
              type={shown.nuiType}
              name={shown.name}
              content={shown.content}
              language={shown.artifact.metadata?.language as string | undefined}
            />
            <button
              ref={closeRef}
              type="button"
              aria-label="Close artifact preview"
              title="Close"
              onClick={onClose}
              className="h-8 w-8 rounded-[7px] flex items-center justify-center"
              style={{ color: 'var(--text-secondary)' }}
            >
              <IconX size={17} />
            </button>
          </div>
        </header>
        <div
          className="flex-1 min-h-0 overflow-auto p-5"
          style={{ backgroundColor: 'var(--bg-raised)' }}
        >
          {body}
        </div>
        <footer
          className="flex items-center justify-between px-5 py-3 border-t flex-shrink-0"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <span
            className="text-[12px] truncate"
            style={{ color: 'var(--text-muted)' }}
          >
            {shown.source.conversation
              ? `Generated in ${shown.source.conversation.name}`
              : shown.source.conversationId
              ? 'Generated in source conversation'
              : 'Source conversation unavailable'}
          </span>
          <button
            type="button"
            disabled={!shown.source.conversationId || !onOpenChat}
            onClick={() => onOpenChat?.(shown)}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[7px] text-[12px] font-medium disabled:opacity-40"
            style={{
              color: 'var(--accent-fg)',
              backgroundColor: 'var(--accent)',
            }}
          >
            <IconArrowUpRight size={14} /> Open in chat
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
};

export default ArtifactPreviewModal;
