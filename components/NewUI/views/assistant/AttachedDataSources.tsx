/**
 * AttachedDataSources — the "Attached (N)" section of the assistant editor's Data
 * Sources field.
 *
 * Replaces the flat card grid that used to be inline in NewUIAssistantCreationModal.
 * What it puts back from the classic `ExistingFileList`:
 *
 *   • Structure — sitemap pages are folded under their sitemap (expand to see them),
 *     and website sources are named by their URL rather than the scraped file's name.
 *   • Sitemap settings — the gear opens the include/exclude manager.
 *   • Embedding status — "Completed" / "Processing" / "Failed" on each saved file,
 *     with a regenerate button when it is needed.
 *   • Search — once the list is long enough to need it.
 *
 * This component owns only presentation state (expanded sitemaps, search text, the
 * manager dialog, the regenerate confirmation). Everything that changes the assistant —
 * removing sources, applying a sitemap edit — is handed back through callbacks, because
 * the modal owns `dataSources`, `websiteUrls` and the upload bookkeeping.
 */

import React, { useCallback, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import type { AttachedDocument } from '@/types/attacheddocument';
import { DataSourceCard, DataSourceCardGrid, DataSourceCardStatus } from '@/components/NewUI/shared/DataSourceCard';
import { EmbeddingStatusView } from '@/components/NewUI/shared/EmbeddingStatus';
import { ConfirmDialog } from '@/components/NewUI/shared/ConfirmDialog';
import { SearchInput } from '@/components/NewUI/shared/SearchInput';
import { SitemapExclusionManager } from '@/components/DataSources/SitemapUrlSelectionModal';
import { getSiteMapUrls } from '@/services/assistantService';
import { extractKey } from '@/utils/app/files';
import { SitemapDataSourceGroup } from './SitemapDataSourceGroup';
import { useEmbeddingStatus } from './useEmbeddingStatus';
import {
    SitemapEditResult,
    SitemapExclusions,
    buildDataSourceEntries,
    dataSourceLabel,
    describeSitemapEdit,
    embeddingBadge,
    isWebsiteSource,
    summarizeEmbeddingStatuses,
} from './dataSourceGroupingModel';

/** Below this many entries a search box is clutter; above it, finding one source is real work. */
const SEARCH_THRESHOLD = 8;

export interface AttachedDataSourcesProps {
    sources: AttachedDocument[];
    /** Card state for a source (uploading / processing / ready / error). */
    statusOf: (ds: AttachedDocument) => DataSourceCardStatus;
    progressOf: (ds: AttachedDocument) => number | undefined;
    errorOf: (ds: AttachedDocument) => string | undefined;
    /** Ids of the sources the server already has — only these have an embedding status to show. */
    savedIds: ReadonlySet<string>;
    /** Set when editing a group assistant; passed to regenerate so group-scoped files resolve. */
    groupId?: string;
    /** Id of the source whose download link is being prepared. */
    downloadingId: string | null;
    onRemove: (ds: AttachedDocument) => void;
    /** Remove several at once (a whole sitemap) so bookkeeping runs once, not per page. */
    onRemoveMany: (sources: AttachedDocument[]) => void;
    onRetry: (ds: AttachedDocument) => void;
    onOpen: (ds: AttachedDocument) => void;
    /** Exclusions currently in force for a sitemap, to seed the manager. */
    exclusionsFor: (sitemapUrl: string) => SitemapExclusions;
    /** The manager was saved. Omit to hide the gear. */
    onSitemapEdit?: (sitemapUrl: string, edit: SitemapEditResult) => void;
}

interface ManagerState {
    sitemapUrl: string;
    allUrls: string[];
    includedUrls: string[];
    exclusions: SitemapExclusions;
}

const sectionTitleStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text-muted)',
    margin: 0,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
};

export const AttachedDataSources: React.FC<AttachedDataSourcesProps> = ({
    sources,
    statusOf,
    progressOf,
    errorOf,
    savedIds,
    groupId,
    downloadingId,
    onRemove,
    onRemoveMany,
    onRetry,
    onOpen,
    exclusionsFor,
    onSitemapEdit,
}) => {
    const [query, setQuery] = useState('');
    const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
    const [manager, setManager] = useState<ManagerState | null>(null);
    const [loadingSitemap, setLoadingSitemap] = useState<string | null>(null);
    const [pendingReprocess, setPendingReprocess] = useState<AttachedDocument | null>(null);

    // The sitemap placeholder (an unsaved sitemap not yet scraped) has no file behind it.
    const embedding = useEmbeddingStatus(
        sources,
        (ds) => savedIds.has(ds.id) && ds.type !== 'website/sitemap' && !!extractKey(ds),
        groupId,
    );

    const allEntries = useMemo(() => buildDataSourceEntries(sources), [sources]);
    const entries = useMemo(() => buildDataSourceEntries(sources, query), [sources, query]);
    const searching = query.trim().length > 0;

    /** A source's embedding status as the card wants it. Regenerating overrides whatever was last known. */
    const statusViewOf = useCallback((ds: AttachedDocument): EmbeddingStatusView | null => {
        if (!savedIds.has(ds.id)) return null;
        if (embedding.isWorking(ds)) {
            return { label: 'Regenerating', tone: 'warning', busy: true, title: 'Embedding status: regenerating' };
        }
        return embeddingBadge(embedding.statusOf(ds), embedding.metadataOf(ds));
    }, [savedIds, embedding]);

    const toggle = (sitemapUrl: string) =>
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(sitemapUrl)) next.delete(sitemapUrl); else next.add(sitemapUrl);
            return next;
        });

    const openManager = async (sitemapUrl: string) => {
        setLoadingSitemap(sitemapUrl);
        try {
            const result = await getSiteMapUrls(sitemapUrl, undefined);
            if (result.success && result.data?.urls) {
                // Snapshot now: the manager re-initialises whenever these props change identity,
                // which would throw away the user's selections on any later re-render.
                const pages = sources.filter((ds) => ds.metadata?.fromSitemap === sitemapUrl);
                setManager({
                    sitemapUrl,
                    allUrls: result.data.urls,
                    includedUrls: pages.map((page) => page.metadata?.sourceUrl || page.id),
                    exclusions: exclusionsFor(sitemapUrl),
                });
            } else {
                toast.error(result.message || 'Failed to fetch sitemap URLs');
            }
        } catch (error) {
            console.error('Error fetching sitemap data:', error);
            toast.error('Error loading sitemap data');
        } finally {
            setLoadingSitemap(null);
        }
    };

    return (
        <div style={{ marginBottom: 14 }}>
            {/* 12px clearance: each card's × overlaps 8px above its top edge */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, margin: '0 0 12px' }}>
                <p style={sectionTitleStyle}>Attached ({allEntries.length})</p>
                {allEntries.length >= SEARCH_THRESHOLD && (
                    <div style={{ width: 200 }}>
                        <SearchInput
                            value={query}
                            onChange={setQuery}
                            onClear={() => setQuery('')}
                            placeholder="Search attached…"
                            aria-label="Search attached data sources"
                            fullWidth
                        />
                    </div>
                )}
            </div>

            <DataSourceCardGrid label="Attached data sources">
                {entries.map((entry) => {
                    if (entry.kind === 'sitemap') {
                        const allPages = sources.filter((ds) => ds.metadata?.fromSitemap === entry.sitemapUrl);
                        return (
                            <SitemapDataSourceGroup
                                key={entry.key}
                                sitemapUrl={entry.sitemapUrl}
                                pages={entry.pages}
                                // A search that matched inside a sitemap should show the match, not hide it.
                                expanded={searching || expanded.has(entry.sitemapUrl)}
                                onToggle={() => toggle(entry.sitemapUrl)}
                                summary={summarizeEmbeddingStatuses(
                                    allPages.map((page) => (savedIds.has(page.id) ? embedding.statusOf(page) : undefined)),
                                )}
                                pageStatus={statusViewOf}
                                isUnsaved={(page) => !savedIds.has(page.id)}
                                canReprocess={(page) => savedIds.has(page.id) && embedding.canReprocess(page)}
                                onReprocess={setPendingReprocess}
                                onRemovePage={onRemove}
                                onRemoveAll={() => onRemoveMany(allPages)}
                                onManage={onSitemapEdit ? () => openManager(entry.sitemapUrl) : undefined}
                                managing={loadingSitemap === entry.sitemapUrl}
                            />
                        );
                    }

                    const ds = entry.ds;
                    const status = statusOf(ds);
                    const progress = progressOf(ds);
                    return (
                        <DataSourceCard
                            key={entry.key}
                            name={dataSourceLabel(ds)}
                            type={ds.type}
                            status={status}
                            progress={status === 'uploading' && typeof progress === 'number' ? progress : undefined}
                            error={errorOf(ds)}
                            onRemove={() => onRemove(ds)}
                            onCancelUpload={() => onRemove(ds)}
                            onRetry={isWebsiteSource(ds) ? undefined : () => onRetry(ds)}
                            onClick={status === 'ready' && !downloadingId ? () => onOpen(ds) : undefined}
                            downloading={downloadingId === ds.id}
                            embedding={statusViewOf(ds)}
                            onReprocess={savedIds.has(ds.id) && embedding.canReprocess(ds) ? () => setPendingReprocess(ds) : undefined}
                        />
                    );
                })}
            </DataSourceCardGrid>

            {searching && entries.length === 0 && (
                <p role="status" style={{ margin: '12px 0 0', fontSize: 12.5, color: 'var(--text-muted)' }}>
                    Nothing attached matches “{query.trim()}”.
                </p>
            )}

            {manager && onSitemapEdit && (
                <SitemapExclusionManager
                    sitemapUrl={manager.sitemapUrl}
                    allUrls={manager.allUrls}
                    currentlyIncludedUrls={manager.includedUrls}
                    currentExclusions={manager.exclusions}
                    onSave={(edit) => {
                        onSitemapEdit(manager.sitemapUrl, edit);
                        setManager(null);
                        toast.success(describeSitemapEdit(edit));
                    }}
                    onCancel={() => setManager(null)}
                />
            )}

            <ConfirmDialog
                isOpen={!!pendingReprocess}
                title="Regenerate embeddings?"
                message={
                    pendingReprocess
                        ? `This regenerates the text extraction and embeddings for “${dataSourceLabel(pendingReprocess)}”. It can take a few minutes.`
                        : ''
                }
                confirmLabel="Regenerate"
                variant="neutral"
                onConfirm={() => {
                    const target = pendingReprocess;
                    setPendingReprocess(null);
                    if (target) void embedding.reprocess(target);
                }}
                onCancel={() => setPendingReprocess(null)}
            />
        </div>
    );
};

export default AttachedDataSources;
