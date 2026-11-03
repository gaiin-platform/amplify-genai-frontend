/**
 * SitemapDataSourceGroup — a sitemap and the pages scraped from it, as one full-width
 * row in the attached data-sources grid.
 *
 * Restores what the classic list had and the card grid lost: the sitemap as a parent
 * ("<url> · N pages"), its pages underneath, the gear to choose which pages are
 * included, and the pages' embedding status.
 *
 * Structure, so keyboard and screen-reader use is sound:
 *   • the header toggle is one <button aria-expanded aria-controls> (name + count + chevron)
 *   • "Manage included/excluded URLs" and "Remove all" are sibling buttons, never nested
 *     inside the toggle
 *   • pages are a real <ul> that is only mounted while expanded
 *
 * Must render inside <DataSourceCardGrid>: it borrows that block's hover-reveal for
 * the remove button (`.nui-ds-remove`) and the icon-button / pulse styles.
 */

import React, { useId } from 'react';
import { IconSettings, IconSitemap, IconX } from '@tabler/icons-react';
import type { AttachedDocument } from '@/types/attacheddocument';
import { DisclosureChevron } from '@/components/NewUI/shared/DisclosureChevron';
import {
    EmbeddingReprocessButton,
    EmbeddingStatusText,
    EmbeddingStatusView,
} from '@/components/NewUI/shared/EmbeddingStatus';
import { dataSourceLabel } from './dataSourceGroupingModel';

export interface SitemapDataSourceGroupProps {
    sitemapUrl: string;
    pages: AttachedDocument[];
    expanded: boolean;
    onToggle: () => void;
    /** One status for the whole sitemap, summarised from its pages. */
    summary: EmbeddingStatusView | null;
    /** A page's own status; null when none is known. */
    pageStatus: (page: AttachedDocument) => EmbeddingStatusView | null;
    /** True for a page that has not been saved yet (it is scraped when the assistant is saved). */
    isUnsaved: (page: AttachedDocument) => boolean;
    canReprocess: (page: AttachedDocument) => boolean;
    onReprocess: (page: AttachedDocument) => void;
    onRemovePage: (page: AttachedDocument) => void;
    onRemoveAll: () => void;
    /** Opens the include/exclude manager. Omit to hide the gear (read-only editor). */
    onManage?: () => void;
    /** The manager is fetching the sitemap's current URL list. */
    managing?: boolean;
}

/** Tallest a sitemap's page list gets before it scrolls (about seven rows). */
const PAGE_LIST_MAX_HEIGHT = 320;
/** A list this short never scrolls, so it needs no tab stop. */
const PAGE_LIST_FOCUSABLE_FROM = 7;

const rowDivider = '1px solid color-mix(in srgb, var(--border-subtle) 55%, transparent)';

export const SitemapDataSourceGroup: React.FC<SitemapDataSourceGroupProps> = ({
    sitemapUrl,
    pages,
    expanded,
    onToggle,
    summary,
    pageStatus,
    isUnsaved,
    canReprocess,
    onReprocess,
    onRemovePage,
    onRemoveAll,
    onManage,
    managing = false,
}) => {
    const listId = useId();
    const countLabel = `${pages.length} ${pages.length === 1 ? 'page' : 'pages'}`;
    const removeAllLabel = `Remove ${sitemapUrl} and all ${pages.length} of its pages`;

    return (
        <li
            className="nui-ds-card col-span-full"
            style={{ position: 'relative', listStyle: 'none' }}
        >
            <div
                style={{
                    boxSizing: 'border-box',
                    borderRadius: 16,
                    background: 'var(--bg-card)',
                    border: '1px solid color-mix(in srgb, var(--border-subtle) 55%, transparent)',
                    overflow: 'hidden',
                }}
            >
                {/* ── Header ─────────────────────────────────────────────── */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, minHeight: 76, paddingRight: 12 }}>
                    <button
                        type="button"
                        onClick={onToggle}
                        aria-expanded={expanded}
                        aria-controls={listId}
                        title={sitemapUrl}
                        className="nui-ds-group-toggle"
                        style={{
                            flex: 1,
                            minWidth: 0,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: '14px 8px 14px 16px',
                            border: 'none',
                            background: 'transparent',
                            textAlign: 'left',
                            fontFamily: 'inherit',
                            color: 'inherit',
                            cursor: 'pointer',
                            borderRadius: 16,
                        }}
                    >
                        <span
                            aria-hidden="true"
                            style={{ width: 40, height: 40, flexShrink: 0, display: 'grid', placeItems: 'center', color: 'var(--file-icon-doc)' }}
                        >
                            <IconSitemap size={22} stroke={1.6} />
                        </span>
                        <span style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column' }}>
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
                                {sitemapUrl}
                            </span>
                            <span
                                aria-live="polite"
                                style={{
                                    marginTop: 2,
                                    fontSize: 12,
                                    color: 'var(--text-secondary)',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                Sitemap · {countLabel}
                                {summary && (
                                    <>
                                        <span aria-hidden="true"> · </span>
                                        <EmbeddingStatusText status={summary} />
                                    </>
                                )}
                            </span>
                        </span>
                        <span style={{ color: 'var(--text-muted)', flexShrink: 0, display: 'grid', placeItems: 'center' }}>
                            <DisclosureChevron open={expanded} size={16} />
                        </span>
                    </button>

                    {onManage && (
                        <button
                            type="button"
                            className={`nui-ds-icon-btn${managing ? ' nui-ds-embed--busy' : ''}`}
                            onClick={onManage}
                            disabled={managing}
                            aria-busy={managing}
                            aria-label={`Manage included and excluded URLs for ${sitemapUrl}`}
                            title={managing ? 'Loading sitemap…' : 'Manage included/excluded URLs'}
                            style={{
                                flexShrink: 0,
                                width: 32,
                                height: 32,
                                display: 'grid',
                                placeItems: 'center',
                                padding: 0,
                                borderRadius: 8,
                                border: 'none',
                                background: 'transparent',
                                color: 'var(--accent)',
                                cursor: 'pointer',
                            }}
                        >
                            <IconSettings size={18} aria-hidden="true" />
                        </button>
                    )}
                </div>

                {/* ── Pages ──────────────────────────────────────────────── */}
                {expanded && (
                    <ul
                        id={listId}
                        // A sitemap can have hundreds of pages: scroll inside the row rather than
                        // pushing the rest of the editor down. Focusable so the keyboard can scroll it.
                        tabIndex={pages.length > PAGE_LIST_FOCUSABLE_FROM ? 0 : undefined}
                        aria-label={`Pages from ${sitemapUrl}`}
                        style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: PAGE_LIST_MAX_HEIGHT, overflowY: 'auto' }}
                    >
                        {pages.map((page) => {
                            const label = dataSourceLabel(page);
                            const status = pageStatus(page);
                            const unsaved = isUnsaved(page);
                            return (
                                <li
                                    key={page.id}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 10,
                                        padding: '8px 12px 8px 28px',
                                        borderTop: rowDivider,
                                        background: 'color-mix(in srgb, var(--bg-app) 35%, transparent)',
                                    }}
                                >
                                    <span aria-hidden="true" style={{ color: 'var(--text-muted)', fontSize: 13, flexShrink: 0 }}>↳</span>
                                    <span
                                        title={label}
                                        style={{
                                            flex: 1,
                                            minWidth: 0,
                                            fontSize: 12.5,
                                            color: 'var(--text-primary)',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        {label}
                                    </span>
                                    <span style={{ fontSize: 12, flexShrink: 0, color: 'var(--text-secondary)' }}>
                                        {status
                                            ? <EmbeddingStatusText status={status} />
                                            : unsaved ? 'Scraped when you save' : null}
                                    </span>
                                    {canReprocess(page) && (
                                        <EmbeddingReprocessButton name={label} onClick={() => onReprocess(page)} />
                                    )}
                                    <button
                                        type="button"
                                        className="nui-ds-icon-btn"
                                        onClick={() => onRemovePage(page)}
                                        aria-label={`Remove page ${label}`}
                                        title="Remove this page"
                                        style={{
                                            flexShrink: 0,
                                            width: 28,
                                            height: 28,
                                            display: 'grid',
                                            placeItems: 'center',
                                            padding: 0,
                                            borderRadius: 8,
                                            border: 'none',
                                            background: 'transparent',
                                            color: 'var(--text-secondary)',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        <IconX size={14} aria-hidden="true" />
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>

            {/* ── Remove the sitemap and every page ─────────────────────── */}
            <button
                type="button"
                className="nui-ds-remove"
                aria-label={removeAllLabel}
                title={`Remove all ${countLabel} from this sitemap`}
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onRemoveAll();
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
                    cursor: 'pointer',
                    padding: 0,
                }}
            >
                <IconX size={13} />
            </button>
        </li>
    );
};

export default SitemapDataSourceGroup;
