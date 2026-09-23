/**
 * ArtifactPanelLayer — injects a sticky header into the artifact panel (#artifactsTab).
 *
 * Responsibilities:
 *  1. Listens for `openArtifactsTrigger` window events to track panel open/close
 *     and the currently displayed artifact index.
 *  2. When open, observes #artifactsTab width via ResizeObserver and writes
 *     --nui-artifact-panel-w onto the ConversationViewShell shell div, so the
 *     composer and jump-button constrain themselves to the chat column.
 *  3. Injects a #nui-artifact-header-root div as the first child of
 *     #artifactsTab's inner flex column, then portals the header UI into it.
 *  4. Header contains (left→right):
 *       - Pencil (rename) icon button — inline rename on click/double-click
 *       - Title / version dropdown (reads selectedArtifacts from HomeContext)
 *       - Download split button: Copy MD | Download .md | Download .docx
 *       - Expand / fullscreen toggle
 *       - Close (×) button
 *  5. Esc closes the panel (or exits fullscreen first).
 *  6. Detects potentially truncated artifact content and shows a notice.
 *  7. Rename persists to selectedArtifacts + selectedConversation via HomeContext.
 *
 * Fixes applied vs. the previous version:
 *  - Bug 5: Title span no longer has maxWidth: '24ch'. The title row uses
 *    flex: 1 / min-width: 0 so the title takes all available space and
 *    truncates only when it actually collides with the right-side controls.
 *  - Bug 7: Added rename button (pencil icon) + inline rename input.
 *  - Bug 8: Added truncation detection with a warning notice.
 */

import React, {
  MutableRefObject,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import {
  IconX,
  IconMaximize,
  IconMinimize,
  IconDownload,
  IconCopy,
  IconCheck,
  IconChevronDown,
  IconPencil,
  IconAlertTriangle,
} from '@tabler/icons-react';
import HomeContext from '@/pages/api/home/home.context';
import { lzwUncompress } from '@/utils/app/lzwCompression';
import { downloadArtifacts } from '@/utils/app/artifacts';
import { extractCodeBlocksAndText } from '@/utils/app/codeblock';
import toast from 'react-hot-toast';

/** ID of the header container injected into #artifactsTab */
const HEADER_ROOT_ID = 'nui-artifact-header-root';

/** Heuristic: does the content look like it was cut off mid-generation? */
function isLikelyTruncated(content: string): boolean {
  if (!content || content.length < 20) return false;
  const tail = content.slice(-200);
  // Unclosed markdown link  [text](http...
  if (/\]\([^)]{0,100}$/.test(tail)) return true;
  // Unclosed inline backtick code span
  if (/`[^`\n]{0,100}$/.test(tail)) return true;
  // Mid-table-row (pipe at very end with no closing newline)
  if (/\|[^|\n]{0,60}$/.test(tail) && !tail.trimEnd().endsWith('|')) return true;
  // Unclosed code fence
  const fences = (content.match(/^```/gm) ?? []).length;
  if (fences % 2 !== 0) return true;
  return false;
}

interface Props {
  shellRef: MutableRefObject<HTMLDivElement | null>;
}

export const ArtifactPanelLayer: React.FC<Props> = ({ shellRef }) => {
  const {
    state: { selectedArtifacts, artifactIsStreaming, selectedConversation },
    dispatch: homeDispatch,
    handleUpdateSelectedConversation,
  } = useContext(HomeContext);

  const [isOpen, setIsOpen] = useState(false);
  const [artifactIndex, setArtifactIndex] = useState(0);
  const [headerRoot, setHeaderRoot] = useState<HTMLElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [showVersionMenu, setShowVersionMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  // Rename state
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  const downloadMenuRef = useRef<HTMLDivElement>(null);
  const versionMenuRef = useRef<HTMLDivElement>(null);
  const downloadBtnRef = useRef<HTMLButtonElement>(null);
  const versionBtnRef = useRef<HTMLButtonElement>(null);

  // ── Listen for openArtifactsTrigger ────────────────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.isOpen === false) {
        setIsOpen(false);
        setIsFullscreen(false);
        setIsRenaming(false);
      } else if (detail?.isOpen === true) {
        setIsOpen(true);
        if (typeof detail.artifactIndex === 'number') {
          setArtifactIndex(detail.artifactIndex);
        }
      }
    };
    window.addEventListener('openArtifactsTrigger', handler);
    return () => window.removeEventListener('openArtifactsTrigger', handler);
  }, []);

  // Keep artifactIndex in range when new versions are added
  useEffect(() => {
    if (selectedArtifacts && selectedArtifacts.length > 0) {
      setArtifactIndex((i) => Math.min(i, selectedArtifacts.length - 1));
    }
  }, [selectedArtifacts]);

  // ── Write --nui-artifact-panel-w CSS var ──────────────────────────────────
  useEffect(() => {
    if (!isOpen) {
      shellRef.current?.style.removeProperty('--nui-artifact-panel-w');
      return;
    }

    const measurePanel = () => {
      const panel = document.getElementById('artifactsTab');
      if (!panel || !shellRef.current) return;
      shellRef.current.style.setProperty('--nui-artifact-panel-w', `${panel.offsetWidth}px`);
    };

    const raf = requestAnimationFrame(() => {
      measurePanel();
      const panel = document.getElementById('artifactsTab');
      if (!panel) return;
      const ro = new ResizeObserver(measurePanel);
      ro.observe(panel);
      return () => ro.disconnect();
    });

    return () => cancelAnimationFrame(raf);
  }, [isOpen, shellRef]);

  // ── Inject / remove #nui-artifact-header-root ────────────────────────────
  useEffect(() => {
    if (!isOpen) {
      setHeaderRoot(null);
      return;
    }

    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const inject = () => {
      const artifactsTab = document.getElementById('artifactsTab');
      if (!artifactsTab) { retryTimer = setTimeout(inject, 100); return; }
      const inner = artifactsTab.querySelector<HTMLElement>(':scope > .flex.flex-col');
      if (!inner) { retryTimer = setTimeout(inject, 100); return; }

      // Inject the header root as a DIRECT CHILD of #artifactsTab, BEFORE the
      // inner flex-col.  This gives us the correct "flex column with non-scrolling
      // header + scrolling body" structure:
      //   #artifactsTab  (display: flex; flex-direction: column)
      //     #nui-artifact-header-root  ← flex: none, always visible
      //     .flex.flex-col.h-full      ← flex: 1; overflow-y: auto (scrolls)
      let root = document.getElementById(HEADER_ROOT_ID) as HTMLElement | null;
      if (!root) {
        root = document.createElement('div');
        root.id = HEADER_ROOT_ID;
        root.setAttribute('data-new-ui-shell', 'true');
        artifactsTab.insertBefore(root, inner);
      }
      setHeaderRoot(root);
    };

    inject();
    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      setHeaderRoot(null);
    };
  }, [isOpen]);

  // ── Fullscreen data attribute ─────────────────────────────────────────────
  useEffect(() => {
    const panel = document.getElementById('artifactsTab');
    if (!panel) return;
    if (isFullscreen) {
      panel.setAttribute('data-artifact-fullscreen', 'true');
    } else {
      panel.removeAttribute('data-artifact-fullscreen');
    }
  }, [isFullscreen]);

  // ── Esc key: exit fullscreen then close ───────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      if (isRenaming) { setIsRenaming(false); return; }
      if (isFullscreen) { setIsFullscreen(false); return; }
      window.dispatchEvent(new CustomEvent('openArtifactsTrigger', { detail: { isOpen: false } }));
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [isOpen, isFullscreen, isRenaming]);

  // ── Focus rename input when it opens ─────────────────────────────────────
  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);

  // ── Close dropdowns on outside click ─────────────────────────────────────
  useEffect(() => {
    if (!showDownloadMenu && !showVersionMenu) return;
    const onPointerDown = (e: PointerEvent) => {
      if (
        downloadMenuRef.current?.contains(e.target as Node) ||
        downloadBtnRef.current?.contains(e.target as Node) ||
        versionMenuRef.current?.contains(e.target as Node) ||
        versionBtnRef.current?.contains(e.target as Node)
      )
        return;
      setShowDownloadMenu(false);
      setShowVersionMenu(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [showDownloadMenu, showVersionMenu]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const currentIdx = selectedArtifacts
    ? Math.min(artifactIndex, selectedArtifacts.length - 1)
    : 0;

  const currentArtifact =
    selectedArtifacts && selectedArtifacts.length > 0
      ? selectedArtifacts[currentIdx]
      : null;

  const getArtifactContent = useCallback(() => {
    if (!currentArtifact) return '';
    return lzwUncompress(currentArtifact.contents);
  }, [currentArtifact]);

  const truncated = !artifactIsStreaming && currentArtifact
    ? isLikelyTruncated(getArtifactContent())
    : false;

  const handleClose = () =>
    window.dispatchEvent(new CustomEvent('openArtifactsTrigger', { detail: { isOpen: false } }));

  const handleCopyMarkdown = async () => {
    const content = getArtifactContent();
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Copy failed');
    }
    setShowDownloadMenu(false);
  };

  const handleDownloadMarkdown = () => {
    const content = getArtifactContent();
    if (!content || !currentArtifact) return;
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentArtifact.name.replace(/\s+/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
    setShowDownloadMenu(false);
  };

  const handleDownloadWord = async () => {
    const content = getArtifactContent();
    if (!content || !currentArtifact) return;
    setShowDownloadMenu(false);
    try {
      await downloadArtifacts(
        currentArtifact.name.replace(/\s+/g, '_'),
        content,
        extractCodeBlocksAndText(content),
      );
    } catch {
      toast.error('Download failed');
    }
  };

  const handleVersionSwitch = (idx: number) => {
    setArtifactIndex(idx);
    window.dispatchEvent(
      new CustomEvent('openArtifactsTrigger', { detail: { isOpen: true, artifactIndex: idx } }),
    );
    setShowVersionMenu(false);
  };

  // ── Bug 7: Rename handlers ────────────────────────────────────────────────

  const startRename = () => {
    if (!currentArtifact) return;
    setRenameValue(currentArtifact.name);
    setIsRenaming(true);
    setShowVersionMenu(false);
    setShowDownloadMenu(false);
  };

  const commitRename = () => {
    const trimmed = renameValue.trim();
    setIsRenaming(false);
    if (!trimmed || !selectedArtifacts || !currentArtifact) return;
    if (trimmed === currentArtifact.name) return;

    // Update selectedArtifacts in HomeContext
    const updatedArtifacts = selectedArtifacts.map((a, i) =>
      i === currentIdx ? { ...a, name: trimmed } : a,
    );
    homeDispatch({ field: 'selectedArtifacts', value: updatedArtifacts });

    // Persist to selectedConversation.artifacts so it survives reload
    if (selectedConversation && currentArtifact.artifactId) {
      const updatedConversation = {
        ...selectedConversation,
        artifacts: {
          ...(selectedConversation.artifacts ?? {}),
          [currentArtifact.artifactId]: updatedArtifacts,
        },
      };
      handleUpdateSelectedConversation(updatedConversation);
    }
  };

  const cancelRename = () => setIsRenaming(false);

  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commitRename();
    if (e.key === 'Escape') { e.stopPropagation(); cancelRename(); }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (!isOpen || !headerRoot) return null;

  const versionCount = selectedArtifacts?.length ?? 0;
  const currentVersion = currentArtifact?.version ?? currentIdx + 1;
  const displayName = currentArtifact?.name ?? 'Artifact';

  const header = (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 52,
        padding: '0 12px 0 16px',
        gap: 8,
        background: 'var(--bg-raised)',
        borderBottom: '1px solid var(--border-subtle)',
        position: 'relative',
        fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
      }}
    >
      {/* ── Left: rename button + title + version dropdown ── */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          position: 'relative',
        }}
      >
        {/* Pencil rename button (Bug 7) */}
        {!isRenaming && (
          <button
            type="button"
            aria-label="Rename artifact"
            title="Rename artifact"
            onClick={startRename}
            style={{ ...iconBtnStyle, width: 26, height: 26 }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
          >
            <IconPencil size={14} />
          </button>
        )}

        {/* Inline rename input */}
        {isRenaming ? (
          <input
            ref={renameInputRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={handleRenameKeyDown}
            onBlur={commitRename}
            aria-label="Artifact name"
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--text-primary)',
              background: 'var(--bg-app)',
              border: '1px solid var(--accent)',
              borderRadius: 6,
              padding: '2px 8px',
              outline: 'none',
              fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
            }}
          />
        ) : (
          /* Title trigger (with optional version dropdown) */
          <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
            <button
              ref={versionBtnRef}
              type="button"
              aria-label="Artifact title and version — click to switch version"
              aria-haspopup={versionCount > 1 ? 'listbox' : undefined}
              aria-expanded={showVersionMenu}
              onDoubleClick={startRename}
              onClick={versionCount > 1 ? () => setShowVersionMenu((v) => !v) : undefined}
              title={displayName}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 6px',
                margin: '0 -6px',
                borderRadius: 8,
                background: showVersionMenu ? 'var(--bg-active)' : 'transparent',
                border: 'none',
                cursor: versionCount > 1 ? 'pointer' : 'default',
                color: 'var(--text-primary)',
                maxWidth: '100%',
                minWidth: 0,
                fontFamily: 'inherit',
              }}
            >
              {/* Bug 5 fix: title span uses flex truncation, no fixed maxWidth */}
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  // No maxWidth — the parent flex: 1 / minWidth: 0 handles truncation
                }}
              >
                {displayName}
              </span>
              {versionCount > 1 && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, marginLeft: 2 }}>
                  v{currentVersion}
                </span>
              )}
              {versionCount > 1 && (
                <IconChevronDown
                  size={13}
                  style={{
                    color: 'var(--text-muted)',
                    flexShrink: 0,
                    transform: showVersionMenu ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.15s',
                  }}
                />
              )}
            </button>

            {/* Version dropdown */}
            {showVersionMenu && versionCount > 1 && (
              <div
                ref={versionMenuRef}
                role="listbox"
                aria-label="Select version"
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: 4,
                  background: 'var(--bg-raised)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 10,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                  zIndex: 200,
                  minWidth: 180,
                  padding: '4px 0',
                  maxHeight: 240,
                  overflowY: 'auto',
                  fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
                }}
              >
                {selectedArtifacts!.map((art, idx) => (
                  <button
                    key={idx}
                    role="option"
                    aria-selected={idx === currentIdx}
                    type="button"
                    onClick={() => handleVersionSwitch(idx)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '6px 12px',
                      border: 'none',
                      background: idx === currentIdx ? 'var(--bg-active)' : 'transparent',
                      color: 'var(--text-primary)',
                      fontSize: 13,
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: 'inherit',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background =
                        idx === currentIdx ? 'var(--bg-active)' : 'transparent';
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {art.name}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, marginLeft: 8 }}>
                      v{art.version ?? idx + 1}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Right: Download + Expand + Close ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, position: 'relative' }}>
        {/* Bug 8: truncation notice */}
        {truncated && (
          <div
            title="The artifact content may be incomplete (generation hit the token limit)"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 12,
              color: 'var(--text-secondary)',
              padding: '0 8px',
              height: 28,
              borderRadius: 7,
              border: '1px solid color-mix(in srgb, orange 40%, var(--border-subtle))',
              background: 'color-mix(in srgb, orange 8%, var(--bg-raised))',
              flexShrink: 0,
              cursor: 'default',
              fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
            }}
            role="status"
            aria-label="This artifact may be incomplete"
          >
            <IconAlertTriangle size={13} aria-hidden="true" style={{ flexShrink: 0 }} />
            <span>May be incomplete</span>
          </div>
        )}

        {/* Download button */}
        <div style={{ position: 'relative' }}>
          <button
            ref={downloadBtnRef}
            type="button"
            aria-label="Download artifact"
            aria-haspopup="true"
            aria-expanded={showDownloadMenu}
            disabled={artifactIsStreaming}
            onClick={() => setShowDownloadMenu((v) => !v)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '0 10px',
              height: 30,
              borderRadius: 8,
              border: '1px solid var(--border-subtle)',
              background: 'transparent',
              color: 'var(--text-primary)',
              fontSize: 13,
              fontWeight: 500,
              cursor: artifactIsStreaming ? 'not-allowed' : 'pointer',
              opacity: artifactIsStreaming ? 0.45 : 1,
              transition: 'background 0.12s',
              fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
            }}
            onMouseEnter={(e) => {
              if (!artifactIsStreaming)
                (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
          >
            {copied ? (
              <IconCheck size={14} style={{ color: '#22c55e' }} />
            ) : (
              <IconDownload size={14} />
            )}
            <span>Download</span>
            <IconChevronDown
              size={12}
              style={{
                transform: showDownloadMenu ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.12s',
              }}
            />
          </button>

          {showDownloadMenu && (
            <div
              ref={downloadMenuRef}
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: 4,
                background: 'var(--bg-raised)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 10,
                boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                zIndex: 200,
                minWidth: 210,
                padding: '4px 0',
                fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
              }}
            >
              {[
                {
                  icon: <IconCopy size={14} />,
                  label: 'Copy as Markdown',
                  sublabel: 'To clipboard',
                  action: handleCopyMarkdown,
                },
                {
                  icon: <IconDownload size={14} />,
                  label: 'Download as Markdown',
                  sublabel: '.md file',
                  action: handleDownloadMarkdown,
                },
                {
                  icon: <IconDownload size={14} />,
                  label: 'Download as Word',
                  sublabel: '.docx file',
                  action: handleDownloadWord,
                },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.action}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    width: '100%',
                    padding: '7px 14px',
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                  }}
                >
                  <span style={{ flexShrink: 0, color: 'var(--text-secondary)' }}>{item.icon}</span>
                  <span>
                    <span style={{ display: 'block', lineHeight: '1.3' }}>{item.label}</span>
                    <span
                      style={{
                        display: 'block',
                        fontSize: 11,
                        color: 'var(--text-muted)',
                        lineHeight: '1.2',
                      }}
                    >
                      {item.sublabel}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Expand / fullscreen */}
        <button
          type="button"
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Expand to fullscreen'}
          title={isFullscreen ? 'Exit fullscreen' : 'Expand to fullscreen'}
          onClick={() => setIsFullscreen((f) => !f)}
          style={iconBtnStyle}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
          }}
        >
          {isFullscreen ? <IconMinimize size={16} /> : <IconMaximize size={16} />}
        </button>

        {/* Close */}
        <button
          type="button"
          aria-label="Close artifact panel"
          title="Close artifact panel (Esc)"
          onClick={handleClose}
          style={iconBtnStyle}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
          }}
        >
          <IconX size={16} />
        </button>
      </div>
    </div>
  );

  return createPortal(header, headerRoot);
};

const iconBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 30,
  height: 30,
  borderRadius: 7,
  border: 'none',
  background: 'transparent',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  flexShrink: 0,
  transition: 'background 0.12s',
};

export default ArtifactPanelLayer;
