/**
 * AttachedDataSources — the "Attached (N)" section of the assistant editor's Data
 * Sources field.
 *
 * Replaces the flat card grid that used to be inline in NewUIAssistantCreationModal.
 * What it puts back from the classic editor:
 *
 *   • Structure — sitemap pages are folded under their sitemap (expand to see them),
 *     and website sources are named by their URL rather than the scraped file's name.
 *   • Sitemap settings — the gear opens the include/exclude manager.
 *   • Embedding status — "Completed" / "Processing" / "Failed" on each saved file,
 *     with a regenerate button when it is needed.
 *   • The drive recap — OneDrive / SharePoint / Google Drive picks as provider →
 *     folder → file, with each file's status and the ones that never made it in.
 *
 * And it stays usable at scale (an assistant can have hundreds of sources):
 *
 *   • Only the first rows render; "Show more" reveals the rest in steps.
 *   • A recap line ("198 completed · 2 need attention") with a "problems only" view, so
 *     the two files that failed are not buried among the ones that did not.
 *   • Search across everything, including inside sitemaps and drive folders.
 *   • Long inner lists (a sitemap's pages, a folder's files) scroll in a bounded region.
 *
 * This component owns only presentation state (expanded rows, search text, how many rows
 * are shown, the manager dialog, the regenerate confirmation). Everything that changes the
 * assistant — removing sources, applying a sitemap edit — is handed back through
 * callbacks, because the modal owns `dataSources`, `websiteUrls` and the upload bookkeeping.
 */

import React, { useCallback, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import type { AttachedDocument } from '@/types/attacheddocument';
import type { IntegrationDriveData } from '@/types/integrations';
import { DataSourceCard, DataSourceCardGrid, DataSourceCardStatus } from '@/components/NewUI/shared/DataSourceCard';
import { EmbeddingStatusView } from '@/components/NewUI/shared/EmbeddingStatus';
import { ConfirmDialog } from '@/components/NewUI/shared/ConfirmDialog';
import { SearchInput } from '@/components/NewUI/shared/SearchInput';
import { SitemapExclusionManager } from '@/components/DataSources/SitemapUrlSelectionModal';
import { getSiteMapUrls } from '@/services/assistantService';
import { extractKey } from '@/utils/app/files';
import { SitemapDataSourceGroup } from './SitemapDataSourceGroup';
import { DriveSourcesRecap } from './DriveSourcesRecap';
import { useEmbeddingStatus } from './useEmbeddingStatus';
import {
    SitemapEditResult,
    SitemapExclusions,
    buildDataSourceEntries,
    dataSourceLabel,
    describeSitemapEdit,
    embeddingBadge,
    filterEntries,
    isFailedStatus,
    isWebsiteSource,
    summarizeEmbeddingStatuses,
    tallyEmbeddingStatuses,
} from './dataSourceGroupingModel';
import {
    DriveRecapFile,
    allDriveFiles,
    buildDriveRecap,
    driveDatasources,
    filterDriveRecap,
    summarizeDriveProvider,
} from './driveRecapModel';

/** Below this many rows a search box is clutter; above it, finding one source is real work. */
const SEARCH_THRESHOLD = 8;
/** Rows drawn before "Show more": six rows of the two-column grid. */
const INITIAL_VISIBLE = 12;
/** Rows each "Show more" adds. */
const VISIBLE_STEP = 24;

export interface AttachedDriveSelection {
    /** Current picks, `data.integrationDriveData`. */
    selection: Record<string, IntegrationDriveData | undefined> | undefined;
    /** The picks as the assistant was loaded — tells a file that failed from one picked a minute ago. */
    loaded: Record<string, IntegrationDriveData | undefined> | undefined;
    /** Opens the picker. Omit when it cannot be opened (integrations off, or a collaborative assistant). */
    onManage?: () => void;
}

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
    /** OneDrive / SharePoint / Google Drive picks. Omit when the editor has none. */
    drive?: AttachedDriveSelection;
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

const linkButtonStyle: React.CSSProperties = {
    padding: 0,
    border: 'none',
    background: 'transparent',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    cursor: 'pointer',
    textDecoration: 'underline',
    textUnderlineOffset: 2,
};

const pagerButtonStyle: React.CSSProperties = {
    height: 32,
    padding: '0 14px',
    borderRadius: 8,
    border: '1px solid var(--border-subtle)',
    background: 'var(--bg-raised)',
    color: 'var(--text-secondary)',
    fontSize: 12.5,
    fontFamily: 'inherit',
    cursor: 'pointer',
};

const toggled = (set: ReadonlySet<string>, key: string): ReadonlySet<string> => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
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
    drive,
}) => {
    const [query, setQueryState] = useState('');
    const [visible, setVisible] = useState(INITIAL_VISIBLE);
    const [problemsOnly, setProblemsOnlyState] = useState(false);
    const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
    const [manager, setManager] = useState<ManagerState | null>(null);
    const [loadingSitemap, setLoadingSitemap] = useState<string | null>(null);
    const [pendingReprocess, setPendingReprocess] = useState<AttachedDocument | null>(null);

    // Changing what is listed starts the pager over — otherwise a search could land on row 300.
    const setQuery = (value: string) => { setQueryState(value); setVisible(INITIAL_VISIBLE); };
    const setProblemsOnly = (value: boolean) => { setProblemsOnlyState(value); setVisible(INITIAL_VISIBLE); };

    // ── Drive picks ────────────────────────────────────────────────────
    const driveRecap = useMemo(
        () => buildDriveRecap(drive?.selection, drive?.loaded),
        [drive?.selection, drive?.loaded],
    );
    const driveCopies = useMemo(() => driveDatasources(driveRecap), [driveRecap]);
    const driveCopyIds = useMemo(() => new Set(driveCopies.map((ds) => ds.id)), [driveCopies]);
    const driveFileCount = useMemo(
        () => driveRecap.reduce((sum, provider) => sum + allDriveFiles(provider).length, 0),
        [driveRecap],
    );

    // ── Embedding status: one store for the sources and the drive files' stored copies ──
    // A source the server has not seen (added this session) has no embedding record yet.
    const isSaved = useCallback(
        (ds: AttachedDocument) => savedIds.has(ds.id) || driveCopyIds.has(ds.id),
        [savedIds, driveCopyIds],
    );
    const statusSources = useMemo(() => [...sources, ...driveCopies], [sources, driveCopies]);
    const embedding = useEmbeddingStatus(
        statusSources,
        // The sitemap placeholder (an unsaved sitemap not yet scraped) has no file behind it.
        (ds) => isSaved(ds) && ds.type !== 'website/sitemap' && !!extractKey(ds),
        groupId,
    );

    /** A source's embedding status as the card wants it. Regenerating overrides whatever was last known. */
    const statusViewOf = useCallback((ds: AttachedDocument): EmbeddingStatusView | null => {
        if (!isSaved(ds)) return null;
        if (embedding.isWorking(ds)) {
            return { label: 'Regenerating', tone: 'warning', busy: true, title: 'Embedding status: regenerating' };
        }
        return embeddingBadge(embedding.statusOf(ds), embedding.metadataOf(ds));
    }, [isSaved, embedding]);

    // ── What counts as a problem ───────────────────────────────────────
    const sourceHasProblem = useCallback(
        (ds: AttachedDocument) => !!errorOf(ds) || (isSaved(ds) && isFailedStatus(embedding.statusOf(ds))),
        [errorOf, isSaved, embedding],
    );
    const fileHasProblem = useCallback(
        (file: DriveRecapFile) =>
            file.state === 'blocked' || (!!file.datasource && isFailedStatus(embedding.statusOf(file.datasource))),
        [embedding],
    );

    // ── Recap line ─────────────────────────────────────────────────────
    const recap = useMemo(() => {
        const tally = tallyEmbeddingStatuses(
            statusSources.filter((ds) => isSaved(ds) && ds.type !== 'website/sitemap').map(embedding.statusOf),
        );
        const blocked = driveRecap.reduce(
            (sum, provider) => sum + allDriveFiles(provider).filter((file) => file.state === 'blocked').length,
            0,
        );
        return { ...tally, problems: tally.failed + blocked };
        // `embedding` changes identity with every status update, which is exactly when to recount.
    }, [statusSources, isSaved, embedding, driveRecap]);

    const showProblemsOnly = problemsOnly && recap.problems > 0;
    const needle = query.trim().toLowerCase();
    const searching = needle.length > 0;

    // ── What to draw ───────────────────────────────────────────────────
    const allEntries = useMemo(() => buildDataSourceEntries(sources), [sources]);
    const entries = useMemo(() => {
        const found = buildDataSourceEntries(sources, query);
        return showProblemsOnly ? filterEntries(found, sourceHasProblem) : found;
    }, [sources, query, showProblemsOnly, sourceHasProblem]);

    const shownDrive = useMemo(() => {
        let recapRows = driveRecap;
        if (showProblemsOnly) recapRows = filterDriveRecap(recapRows, fileHasProblem);
        if (searching) recapRows = filterDriveRecap(recapRows, (file) => file.name.toLowerCase().includes(needle));
        return recapRows;
    }, [driveRecap, showProblemsOnly, fileHasProblem, searching, needle]);

    const shownEntries = entries.slice(0, visible);
    const hiddenCount = entries.length - shownEntries.length;
    const totalRows = allEntries.length + driveRecap.length;
    const nothingMatches = (searching || showProblemsOnly) && entries.length === 0 && shownDrive.length === 0;

    const toggle = (key: string) => setExpanded((prev) => toggled(prev, key));

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

    const recapParts: Array<{ key: string; node: React.ReactNode }> = [];
    if (recap.completed > 0) {
        recapParts.push({ key: 'completed', node: <span style={{ color: 'var(--success-fg)', fontWeight: 500 }}>{recap.completed} completed</span> });
    }
    if (recap.working > 0) {
        recapParts.push({ key: 'working', node: <span className="nui-ds-embed--busy" style={{ color: 'var(--warning-fg)', fontWeight: 500 }}>{recap.working} processing</span> });
    }
    if (recap.problems > 0) {
        recapParts.push({
            key: 'problems',
            node: (
                <>
                    <span style={{ color: 'var(--text-error)', fontWeight: 500 }}>{recap.problems} {recap.problems === 1 ? 'needs' : 'need'} attention</span>
                    {' — '}
                    <button
                        type="button"
                        aria-pressed={showProblemsOnly}
                        onClick={() => setProblemsOnly(!showProblemsOnly)}
                        style={{ ...linkButtonStyle, color: 'var(--text-secondary)' }}
                    >
                        {showProblemsOnly ? 'show all' : 'show only these'}
                    </button>
                </>
            ),
        });
    }

    return (
        <div style={{ marginBottom: 14 }}>
            {/* 12px clearance: each card's × overlaps 8px above its top edge */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, margin: '0 0 12px' }}>
                <p style={sectionTitleStyle}>Attached ({totalRows})</p>
                {(allEntries.length >= SEARCH_THRESHOLD || driveFileCount >= SEARCH_THRESHOLD) && (
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

            {recapParts.length > 0 && (
                <p role="status" style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--text-secondary)' }}>
                    {recapParts.map((part, index) => (
                        <React.Fragment key={part.key}>
                            {index > 0 && <span aria-hidden="true"> · </span>}
                            {part.node}
                        </React.Fragment>
                    ))}
                </p>
            )}

            <DataSourceCardGrid label="Attached data sources">
                {/* Drive picks first: there are few, and they say the most at a glance. */}
                {shownDrive.map((provider) => {
                    const providerKey = `drive:${provider.integration}`;
                    const folderKey = (folderId: string) => `${providerKey}|${folderId}`;
                    // A search or the problems view should show its matches, not hide them behind a closed row.
                    const forceOpen = searching || showProblemsOnly;
                    const fileStatus = (file: DriveRecapFile) =>
                        file.datasource ? statusViewOf(file.datasource) : null;
                    return (
                        <DriveSourcesRecap
                            key={providerKey}
                            provider={provider}
                            expanded={forceOpen || expanded.has(providerKey)}
                            onToggle={() => toggle(providerKey)}
                            isFolderExpanded={(folder) => forceOpen || expanded.has(folderKey(folder.id))}
                            onToggleFolder={(folder) => toggle(folderKey(folder.id))}
                            summary={summarizeDriveProvider(provider, (file) =>
                                file.datasource ? embedding.statusOf(file.datasource) : undefined)}
                            fileStatus={fileStatus}
                            canReprocess={(file) => !!file.datasource && embedding.canReprocess(file.datasource)}
                            onReprocess={(file) => file.datasource && setPendingReprocess(file.datasource)}
                            onManage={drive?.onManage}
                        />
                    );
                })}

                {shownEntries.map((entry) => {
                    if (entry.kind === 'sitemap') {
                        const allPages = sources.filter((ds) => ds.metadata?.fromSitemap === entry.sitemapUrl);
                        return (
                            <SitemapDataSourceGroup
                                key={entry.key}
                                sitemapUrl={entry.sitemapUrl}
                                pages={entry.pages}
                                expanded={searching || showProblemsOnly || expanded.has(entry.sitemapUrl)}
                                onToggle={() => toggle(entry.sitemapUrl)}
                                summary={summarizeEmbeddingStatuses(
                                    allPages.map((page) => (isSaved(page) ? embedding.statusOf(page) : undefined)),
                                )}
                                pageStatus={statusViewOf}
                                isUnsaved={(page) => !isSaved(page)}
                                canReprocess={(page) => isSaved(page) && embedding.canReprocess(page)}
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
                            onReprocess={isSaved(ds) && embedding.canReprocess(ds) ? () => setPendingReprocess(ds) : undefined}
                        />
                    );
                })}
            </DataSourceCardGrid>

            {hiddenCount > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                    <span role="status" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        Showing {shownEntries.length} of {entries.length}
                    </span>
                    <button type="button" style={pagerButtonStyle} onClick={() => setVisible((n) => n + VISIBLE_STEP)}>
                        Show {Math.min(VISIBLE_STEP, hiddenCount)} more
                    </button>
                    {hiddenCount > VISIBLE_STEP && (
                        <button type="button" style={pagerButtonStyle} onClick={() => setVisible(entries.length)}>
                            Show all {entries.length}
                        </button>
                    )}
                </div>
            )}

            {nothingMatches && (
                <p role="status" style={{ margin: '12px 0 0', fontSize: 12.5, color: 'var(--text-muted)' }}>
                    {searching ? `Nothing attached matches “${query.trim()}”.` : 'Nothing needs attention.'}
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
