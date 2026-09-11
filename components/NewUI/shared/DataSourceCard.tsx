/**
 * DataSourceCard — a 76px-tall file card for attached data sources.
 *
 * Core principle: **state lives in the icon slot and the subtitle, never in the
 * card surface.** An uploading card and a ready card are pixel-identical apart
 * from the 40×40 leading icon slot and the second text line. No colored fills,
 * no state-derived accents, no yellow "still working" background.
 *
 * The three icon layers (spinner · file-type icon · warning) are all mounted at
 * all times and cross-faded with opacity, so the card never remounts between
 * states and nothing reflows when a file finishes uploading.
 *
 * Progress model (matches components/Chat/AttachFile.tsx):
 *   no progress entry → indeterminate spinner, "Uploading…"
 *   0–94             → determinate ring,      "Uploading…"
 *   95               → indeterminate spinner, "Processing…"  (server-side extract)
 *   100              → file-type icon,        type label
 *
 * Design rules (NEW_UI_GUIDE.md):
 *   • Tokens only — no hardcoded hex (file-type hues are --file-icon-* tokens).
 *   • Light + dark supported through the tokens.
 *   • prefers-reduced-motion replaces the rotating arc with an opacity pulse.
 *   • The remove button always carries an aria-label.
 *
 * Render cards inside <DataSourceCardGrid> — the grid owns the one <style>
 * block that both components rely on (hover reveal, spinner keyframes).
 */

import React from 'react';
import {
    IconAlertTriangle,
    IconDatabase,
    IconFile,
    IconFileCode,
    IconFileSpreadsheet,
    IconFileText,
    IconFileTypeCsv,
    IconFileTypeDocx,
    IconFileTypePdf,
    IconFileTypeXls,
    IconMovie,
    IconPhoto,
    IconPresentation,
    IconRefresh,
    IconSitemap,
    IconWorld,
    IconX,
} from '@tabler/icons-react';
import { getAttachmentMime } from './attachmentTypes';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type DataSourceCardStatus = 'uploading' | 'processing' | 'ready' | 'error';

export interface DataSourceCardProps {
    /** Filename (or URL for website sources). Truncates with an ellipsis. */
    name: string;
    /** MIME type, or a pseudo-type: website/url, website/sitemap, bedrock/knowledge-base. */
    type?: string;
    status: DataSourceCardStatus;
    /**
     * Real upload percentage, 0–100. Omit (or pass undefined) for an
     * indeterminate spinner. Ignored unless status is 'uploading'.
     */
    progress?: number;
    /** Failure reason — shown on the subtitle line in the error color. */
    error?: string;
    /** Remove the source. Ignored while uploading/processing (cancel instead). */
    onRemove?: () => void;
    /** Abort an in-flight upload. Enables the × while uploading/processing. */
    onCancelUpload?: () => void;
    /** Retry affordance for the error state. Omit to hide the Retry button. */
    onRetry?: () => void;
    /**
     * Called when the user clicks the card body (not the ×/Retry buttons).
     * Only fires when status is 'ready'. Use for e.g. download-on-click.
     */
    onClick?: () => void;
    /**
     * When true, overlays the icon slot with a spinner and changes the subtitle
     * to "Preparing download…" to signal an async download operation.
     */
    downloading?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// File-type resolution — icon, hue, and the subtitle label for the ready state
// ─────────────────────────────────────────────────────────────────────────────

const NEUTRAL = 'var(--text-muted)';

interface TypeDescriptor {
    label: string;
    color: string;
    icon: React.ReactNode;
}

const iconProps = { size: 22, stroke: 1.6 } as const;

/** Map a data source's name + type onto its icon, hue, and type label. */
export function resolveDataSourceType(name: string, rawType?: string): TypeDescriptor {
    // Pseudo-types first — these never have a real MIME type.
    if (rawType === 'website/sitemap') {
        return { label: 'Sitemap', color: 'var(--file-icon-doc)', icon: <IconSitemap {...iconProps} /> };
    }
    if (rawType === 'website/url') {
        return { label: 'Website', color: 'var(--file-icon-doc)', icon: <IconWorld {...iconProps} /> };
    }
    if (rawType === 'bedrock/knowledge-base') {
        return { label: 'Knowledge base', color: NEUTRAL, icon: <IconDatabase {...iconProps} /> };
    }

    const mime = getAttachmentMime(name, rawType);
    const ext = name.split('.').pop()?.toLowerCase() ?? '';

    if (mime.includes('pdf')) {
        return { label: 'PDF', color: 'var(--file-icon-pdf)', icon: <IconFileTypePdf {...iconProps} /> };
    }
    if (mime.includes('csv') || ext === 'csv' || ext === 'tsv') {
        return { label: 'Spreadsheet', color: 'var(--file-icon-sheet)', icon: <IconFileTypeCsv {...iconProps} /> };
    }
    if (mime.includes('spreadsheetml') || mime.includes('excel') || mime.includes('xls') || ext === 'xls' || ext === 'xlsx') {
        return { label: 'Spreadsheet', color: 'var(--file-icon-sheet)', icon: <IconFileTypeXls {...iconProps} /> };
    }
    if (mime.includes('sheet') || ext === 'ods' || ext === 'numbers') {
        return { label: 'Spreadsheet', color: 'var(--file-icon-sheet)', icon: <IconFileSpreadsheet {...iconProps} /> };
    }
    if (mime.includes('wordprocessingml') || mime.includes('msword') || mime.includes('doc') ||
        ['doc', 'docx', 'rtf', 'odt'].includes(ext)) {
        return { label: 'Document', color: 'var(--file-icon-doc)', icon: <IconFileTypeDocx {...iconProps} /> };
    }
    if (mime.includes('presentation') || mime.includes('powerpoint') || ['ppt', 'pptx', 'odp', 'key'].includes(ext)) {
        return { label: 'Presentation', color: NEUTRAL, icon: <IconPresentation {...iconProps} /> };
    }
    if (mime.startsWith('image/')) {
        return { label: 'Image', color: NEUTRAL, icon: <IconPhoto {...iconProps} /> };
    }
    if (mime.startsWith('video/')) {
        return { label: 'Video', color: NEUTRAL, icon: <IconMovie {...iconProps} /> };
    }
    if (mime.includes('json') || mime.includes('xml') || mime.includes('html') ||
        ['json', 'xml', 'html', 'htm', 'yaml', 'yml', 'js', 'ts', 'py'].includes(ext)) {
        return { label: 'Code', color: NEUTRAL, icon: <IconFileCode {...iconProps} /> };
    }
    if (mime.startsWith('text/') || ['txt', 'md'].includes(ext)) {
        return { label: 'Text', color: NEUTRAL, icon: <IconFileText {...iconProps} /> };
    }
    return {
        label: ext && ext.length <= 5 ? ext.toUpperCase() : 'File',
        color: NEUTRAL,
        icon: <IconFile {...iconProps} />,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Determinate progress ring — used when a real upload percentage is available
// ─────────────────────────────────────────────────────────────────────────────

const RING_SIZE = 28;
const RING_STROKE = 2;
const RING_R = (RING_SIZE - RING_STROKE) / 2;
const RING_C = 2 * Math.PI * RING_R;
const RING_TRACK = 'color-mix(in srgb, var(--text-muted) 28%, transparent)';

const DeterminateRing: React.FC<{ value: number }> = ({ value }) => {
    const pct = Math.max(0, Math.min(100, value));
    return (
        <svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} aria-hidden="true">
            <circle
                cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_R}
                fill="none" stroke={RING_TRACK} strokeWidth={RING_STROKE}
            />
            <circle
                cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_R}
                fill="none" stroke="var(--accent)" strokeWidth={RING_STROKE} strokeLinecap="round"
                strokeDasharray={RING_C}
                strokeDashoffset={RING_C * (1 - pct / 100)}
                style={{
                    transform: 'rotate(-90deg)',
                    transformOrigin: '50% 50%',
                    transition: 'stroke-dashoffset 200ms linear',
                }}
            />
        </svg>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Card
// ─────────────────────────────────────────────────────────────────────────────

const CARD_HEIGHT = 76;

export const DataSourceCard: React.FC<DataSourceCardProps> = ({
    name,
    type,
    status,
    progress,
    error,
    onRemove,
    onCancelUpload,
    onRetry,
    onClick,
    downloading = false,
}) => {
    const busy = (status === 'uploading' || status === 'processing') && !downloading;
    const isError = status === 'error' && !downloading;
    const determinate = status === 'uploading' && typeof progress === 'number' && !downloading;

    const descriptor = resolveDataSourceType(name, type);
    const displayName = name || 'Untitled document';

    const subtitle = downloading
        ? 'Preparing download…'
        : isError
            ? error || 'Something went wrong'
            : status === 'processing'
                ? 'Processing…'
                : status === 'uploading'
                    ? 'Uploading…'
                    : descriptor.label;

    // While a file is in flight the × cancels the upload rather than removing a
    // half-written source; with no cancel handler it is simply disabled.
    const dismiss = busy ? onCancelUpload : onRemove;
    const dismissLabel = busy ? `Cancel upload of ${displayName}` : `Remove ${displayName}`;
    const showDismiss = Boolean(onRemove || onCancelUpload);

    return (
        <li
            className="nui-ds-card"
            style={{ position: 'relative', listStyle: 'none' }}
        >
            <div
                title={displayName}
                role={onClick && status === 'ready' ? 'button' : undefined}
                tabIndex={onClick && status === 'ready' ? 0 : undefined}
                aria-label={onClick && status === 'ready' ? `Download ${displayName}` : undefined}
                onClick={onClick && status === 'ready' ? onClick : undefined}
                onKeyDown={onClick && status === 'ready' ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); }
                } : undefined}
                style={{
                    boxSizing: 'border-box',
                    height: CARD_HEIGHT,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '14px 16px',
                    borderRadius: 16,
                    // One visible step off the surrounding surface. Never varies by state.
                    background: 'var(--bg-card)',
                    border: '1px solid color-mix(in srgb, var(--border-subtle) 55%, transparent)',
                    cursor: onClick && status === 'ready' ? 'pointer' : undefined,
                    outline: 'none',
                }}
            >
                {/* ── Icon slot — the only thing that changes between states ── */}
                <div
                    className={`nui-ds-slot${(busy || downloading) ? ' nui-ds-slot--busy' : ''}`}
                    style={{
                        position: 'relative',
                        width: 40,
                        height: 40,
                        flexShrink: 0,
                        display: 'grid',
                        placeItems: 'center',
                    }}
                >
                    {/* Spinner / progress ring */}
                    <div className="nui-ds-layer" style={{ opacity: (busy || downloading) ? 1 : 0 }} aria-hidden="true">
                        {determinate
                            ? <DeterminateRing value={progress as number} />
                            : <span className="nui-ds-spinner" />}
                    </div>

                    {/* File-type icon */}
                    <div
                        className="nui-ds-layer"
                        style={{ opacity: status === 'ready' && !downloading ? 1 : 0, color: descriptor.color }}
                        aria-hidden="true"
                    >
                        {descriptor.icon}
                    </div>

                    {/* Failure — muted warning, never a red card */}
                    <div
                        className="nui-ds-layer"
                        style={{ opacity: isError ? 1 : 0, color: 'var(--text-muted)' }}
                        aria-hidden="true"
                    >
                        <IconAlertTriangle {...iconProps} />
                    </div>
                </div>

                {/* ── Text stack ── */}
                <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <span
                        style={{
                            fontSize: 13.5,
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {displayName}
                    </span>
                    <span
                        aria-live="polite"
                        style={{
                            marginTop: 2,
                            fontSize: 12,
                            fontWeight: 400,
                            color: isError ? 'var(--text-error)' : 'var(--text-secondary)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {subtitle}
                    </span>
                </div>

                {/* ── Retry affordance (error only) ── */}
                {isError && onRetry && (
                    <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); onRetry(); }}
                        aria-label={`Retry ${displayName}`}
                        className="nui-ds-retry"
                        style={{
                            flexShrink: 0,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '5px 10px',
                            borderRadius: 8,
                            border: '1px solid var(--border-subtle)',
                            background: 'transparent',
                            color: 'var(--text-secondary)',
                            fontSize: 12,
                            fontFamily: 'inherit',
                            cursor: 'pointer',
                        }}
                    >
                        <IconRefresh size={13} />
                        Retry
                    </button>
                )}
            </div>

            {/* ── Remove / cancel ── */}
            {showDismiss && (
                <button
                    type="button"
                    className="nui-ds-remove"
                    aria-label={dismissLabel}
                    title={dismissLabel}
                    disabled={!dismiss}
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        dismiss?.();
                    }}
                    style={{
                        position: 'absolute',
                        top: -8,
                        right: -8,
                        width: 24,
                        height: 24,
                        display: 'grid',
                        placeItems: 'center',
                        borderRadius: '50%',
                        border: '1px solid var(--border-subtle)',
                        background: 'var(--bg-app)',
                        color: 'var(--text-secondary)',
                        cursor: dismiss ? 'pointer' : 'not-allowed',
                        padding: 0,
                    }}
                >
                    <IconX size={13} />
                </button>
            )}
        </li>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Grid — 2 columns on desktop, 1 column below 640px, 12px gap
// ─────────────────────────────────────────────────────────────────────────────

export interface DataSourceCardGridProps {
    children: React.ReactNode;
    /** Accessible name for the list, e.g. "Attached data sources". */
    label: string;
}

export const DataSourceCardGrid: React.FC<DataSourceCardGridProps> = ({ children, label }) => (
    <>
        <ul
            aria-label={label}
            className="nui-ds-grid grid grid-cols-1 sm:grid-cols-2"
            style={{ gap: 12, listStyle: 'none', margin: 0, padding: 0 }}
        >
            {children}
        </ul>

        <style>{`
            .nui-ds-grid { list-style: none; }

            /* Icon layers are stacked and cross-faded — the card never remounts. */
            .nui-ds-layer {
                position: absolute;
                inset: 0;
                display: grid;
                place-items: center;
                transition: opacity 150ms ease;
            }

            @keyframes nuiDsRotate { to { transform: rotate(360deg); } }
            @keyframes nuiDsPulse  { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }

            .nui-ds-spinner {
                width: ${RING_SIZE}px;
                height: ${RING_SIZE}px;
                border-radius: 50%;
                border: ${RING_STROKE}px solid ${RING_TRACK};
                border-top-color: var(--accent);
                animation: nuiDsRotate 0.9s linear infinite;
            }

            /* Remove button: hidden until hover / keyboard focus, always on touch. */
            .nui-ds-remove { opacity: 0; transition: opacity 120ms ease; }
            .nui-ds-card:hover .nui-ds-remove,
            .nui-ds-card:focus-within .nui-ds-remove { opacity: 1; }
            .nui-ds-remove:focus-visible {
                opacity: 1;
                outline: 2px solid var(--accent);
                outline-offset: 2px;
            }
            .nui-ds-remove:not(:disabled):hover {
                color: var(--text-primary);
                border-color: var(--text-muted);
            }
            .nui-ds-remove:disabled { opacity: 0; }
            @media (hover: none) {
                .nui-ds-remove:not(:disabled) { opacity: 1; }
            }

            .nui-ds-retry:hover {
                color: var(--text-primary);
                border-color: var(--text-muted);
            }

            /* Reduced motion: no rotation — the slot pulses instead. */
            @media (prefers-reduced-motion: reduce) {
                .nui-ds-spinner { animation: none; }
                .nui-ds-slot--busy { animation: nuiDsPulse 1.6s ease-in-out infinite; }
                .nui-ds-layer { transition: none; }
                .nui-ds-remove { transition: none; }
            }
        `}</style>
    </>
);

export default DataSourceCard;
