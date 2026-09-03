/**
 * DriveFileBrowser — browse and pick files from one connected drive service.
 *
 * Replaces the MantineReactTable browser (components/DataSources/
 * DataSourcesTableScrollingIntegrations.tsx, still used by the old-UI chat
 * picker and left untouched) for the assistant editor. What changed, and why:
 *
 *   one header band          the old table stacked column labels, a filter row
 *                            and the rows in three different greys — ~90px of
 *                            chrome before the first result
 *   one search field         per-column filter inputs were unlabelled grey
 *                            blocks; once you typed you couldn't tell which
 *                            column you'd filtered
 *   breadcrumb on top        it used to sit *below* the table, so the path
 *                            appeared after the thing it described
 *   no Size/Type columns     every Size read "N/A" and every Type read
 *                            "SharePoint Site" — a third of the width spent
 *                            repeating one fact. Size returns only when a row
 *                            in view actually has one.
 *
 * The browser owns the folder trail, so switching integrations must remount it
 * (`key={integration}` at the call site). The old split — table owned the trail,
 * parent owned a mirror of it — left the parent pointing at the previous
 * integration's path right after a switch, which quietly mis-answered "is this
 * row covered by a selected folder?".
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    IconAlertTriangle,
    IconChevronDown,
    IconCornerLeftUp,
    IconFolder,
    IconFolderOff,
    IconLoader2,
    IconSearch,
    IconX,
} from '@tabler/icons-react';
import toast from 'react-hot-toast';
import { listIntegrationFiles } from '@/services/oauthIntegrationsService';
import { IntegrationFileRecord } from '@/types/integrations';
import { getIntegrationName } from '@/utils/app/integrations';
import { DriveFileRow, DRIVE_ROW_HEIGHT } from './DriveFileRow';
import {
    ApplySelectionInput,
    DriveSelection,
    DriveSortDirection,
    displaySize,
    filterDisallowed,
    isBlockedBySensitivity,
    isDirectlySelected,
    isRowAutoSelected,
    isRowSelected,
    matchesQuery,
    normalizeDriveRecord,
    selectedAncestorId,
    selectionCounts,
    sortRecords,
} from './driveBrowserModel';

const HEADER_HEIGHT = 40;
/** Cap the list on a whole-row boundary so no row is ever clipped mid-height. */
const VISIBLE_ROWS = 8;
const LIST_MAX_HEIGHT = VISIBLE_ROWS * DRIVE_ROW_HEIGHT;

interface FolderCrumb {
    id: string;
    name: string;
}

export interface DriveFileBrowserProps {
    /** Integration id, e.g. `microsoft_sharepoint`. */
    integration: string;
    selection: DriveSelection;
    /** Mutate the selection; the panel funnels this through `applySelection`. */
    onApply: (input: Omit<ApplySelectionInput, 'integration' | 'folderPath'> & { folderPath?: string[] }) => void;
    onClear: () => void;
    /**
     * Re-run the OAuth flow. `/user/list` can still call an integration
     * connected after its token has gone stale, so a listing failure needs a way
     * out that isn't "disconnect, then connect again".
     */
    onReconnect: () => void;
    disallowedFileExtensions?: string[];
}

export const DriveFileBrowser: React.FC<DriveFileBrowserProps> = ({
    integration,
    selection,
    onApply,
    onClear,
    onReconnect,
    disallowedFileExtensions,
}) => {
    const [crumbs, setCrumbs] = useState<FolderCrumb[]>([]);
    const [records, setRecords] = useState<IntegrationFileRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState('');
    const [sortDirection, setSortDirection] = useState<DriveSortDirection>('asc');
    const [headerHovered, setHeaderHovered] = useState(false);

    // Listings are stable enough to reuse, and re-fetching on every "back" made
    // shallow browsing feel like a network app.
    const cache = useRef<Record<string, IntegrationFileRecord[]>>({});
    // A slow response for a folder the user already left must not land.
    const requestSeq = useRef(0);
    const selectAllRef = useRef<HTMLInputElement>(null);

    const folderPath = useMemo(() => crumbs.map((crumb) => crumb.id), [crumbs]);
    const currentFolderId = crumbs.length > 0 ? crumbs[crumbs.length - 1].id : '';

    // Rebuilt from a joined key so an inline array literal from the caller can't
    // give `load` a new identity every render — which would refetch forever.
    const disallowedKey = (disallowedFileExtensions ?? []).join(',');
    const disallowed = useMemo(
        () => (disallowedKey ? disallowedKey.split(',') : undefined),
        [disallowedKey],
    );

    const load = useCallback(async (folderId: string) => {
        const seq = ++requestSeq.current;
        const cacheKey = folderId || 'root';
        const cached = cache.current[cacheKey];
        if (cached) {
            setRecords(cached);
            setError(null);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            const result = await listIntegrationFiles({
                integration,
                ...(folderId ? { folder_id: folderId } : {}),
            });
            if (seq !== requestSeq.current) return; // superseded
            if (!result?.success) {
                setRecords([]);
                setError('Could not load this folder.');
                return;
            }
            // Normalize before anything else looks at the records: container
            // detection, the type label and the persisted type all read the
            // normalized fields.
            const normalized = filterDisallowed(
                (result.data ?? []).map((raw: IntegrationFileRecord) => normalizeDriveRecord(raw, integration)),
                disallowed,
            );
            cache.current[cacheKey] = normalized;
            setRecords(normalized);
        } catch (err) {
            console.error('Error listing integration files:', err);
            if (seq === requestSeq.current) {
                setRecords([]);
                setError('Could not load this folder.');
            }
        } finally {
            if (seq === requestSeq.current) setIsLoading(false);
        }
    }, [integration, disallowed]);

    useEffect(() => { load(''); }, [load]);

    // ── Navigation ───────────────────────────────────────────────────────────
    // The query deliberately survives navigation: someone who searched for
    // "budget", opened a folder and came back expects their filter intact.

    const openFolder = (record: IntegrationFileRecord) => {
        setCrumbs((prev) => [...prev, { id: record.id, name: record.name }]);
        load(record.id);
    };

    const navigateTo = (index: number) => {
        if (index < 0) {
            setCrumbs([]);
            load('');
            return;
        }
        const next = crumbs.slice(0, index + 1);
        setCrumbs(next);
        load(next[index].id);
    };

    // ── Visible rows ─────────────────────────────────────────────────────────
    // Filtering is synchronous and in-memory: `listIntegrationFiles` accepts
    // only {integration, folder_id}, so there is no server search to debounce
    // and nothing to search beyond the folder currently listed.

    const visible = useMemo(
        () => sortRecords(records.filter((record) => matchesQuery(record, query)), sortDirection),
        [records, query, sortDirection],
    );

    const showSize = useMemo(
        () => visible.some((record) => displaySize(record.size) !== null),
        [visible],
    );

    const ancestorId = selectedAncestorId(selection, integration, folderPath);
    const coveringFolderName = ancestorId
        ? crumbs.find((crumb) => crumb.id === ancestorId)?.name
        : undefined;

    // ── Select-all ───────────────────────────────────────────────────────────

    const selectable = useMemo(
        () => visible.filter((record) => !isBlockedBySensitivity(record)),
        [visible],
    );
    const directlySelectedCount = selectable.filter(
        (record) => isDirectlySelected(selection, integration, record),
    ).length;
    const allSelected = selectable.length > 0 && directlySelectedCount === selectable.length;
    const someSelected = directlySelectedCount > 0 && !allSelected;

    // Inside a folder that is itself selected every row is already covered, so
    // the box is checked and inert — firing a batch here would add redundant
    // individual entries beneath a folder that already includes them.
    const selectAllDisabled = selectable.length === 0 || Boolean(ancestorId);

    useEffect(() => {
        if (selectAllRef.current) {
            selectAllRef.current.indeterminate = !ancestorId && someSelected;
        }
    }, [someSelected, ancestorId]);

    const toggleSelectAll = () => {
        if (selectAllDisabled) return;
        if (allSelected) onApply({ remove: selectable, folderPath });
        else {
            const toAdd = selectable.filter(
                (record) => !isDirectlySelected(selection, integration, record),
            );
            onApply({ add: toAdd, folderPath });
        }
    };

    const toggleRow = (record: IntegrationFileRecord) => {
        if (isRowAutoSelected(selection, integration, folderPath, record)) return;
        const on = isDirectlySelected(selection, integration, record);
        onApply(on ? { remove: [record], folderPath } : { add: [record], folderPath });
    };

    const counts = selectionCounts(selection, integration);
    const serviceName = getIntegrationName(integration);

    // ── Render ───────────────────────────────────────────────────────────────

    return (
        <div>
            {/* ── Breadcrumb: where you are, above what you're looking at ── */}
            <nav
                aria-label="Folder path"
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 2,
                    minHeight: 24,
                    marginBottom: 8,
                    fontSize: 12,
                }}
            >
                {crumbs.length > 0 && (
                    <button
                        type="button"
                        onClick={() => navigateTo(crumbs.length - 2)}
                        aria-label="Up one level"
                        title="Up one level"
                        style={{
                            display: 'grid',
                            placeItems: 'center',
                            width: 22,
                            height: 22,
                            marginRight: 4,
                            borderRadius: 6,
                            border: 'none',
                            background: 'transparent',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                        }}
                    >
                        <IconCornerLeftUp size={14} />
                    </button>
                )}
                <button
                    type="button"
                    onClick={() => navigateTo(-1)}
                    disabled={crumbs.length === 0}
                    style={{
                        border: 'none',
                        background: 'transparent',
                        padding: '0 2px',
                        fontFamily: 'inherit',
                        fontSize: 12,
                        color: crumbs.length === 0 ? 'var(--text-primary)' : 'var(--accent)',
                        cursor: crumbs.length === 0 ? 'default' : 'pointer',
                    }}
                >
                    {serviceName}
                </button>
                {crumbs.map((crumb, index) => {
                    const isCurrent = index === crumbs.length - 1;
                    return (
                        <React.Fragment key={crumb.id}>
                            <span style={{ color: 'var(--text-muted)' }}>/</span>
                            <button
                                type="button"
                                onClick={() => navigateTo(index)}
                                disabled={isCurrent}
                                style={{
                                    border: 'none',
                                    background: 'transparent',
                                    padding: '0 2px',
                                    fontFamily: 'inherit',
                                    fontSize: 12,
                                    maxWidth: 180,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    color: isCurrent ? 'var(--text-primary)' : 'var(--accent)',
                                    cursor: isCurrent ? 'default' : 'pointer',
                                }}
                            >
                                {crumb.name}
                            </button>
                        </React.Fragment>
                    );
                })}
            </nav>

            {/* ── One search field, outside the scroll region ── */}
            <div style={{ position: 'relative', marginBottom: 8 }}>
                <IconSearch
                    size={15}
                    aria-hidden="true"
                    style={{
                        position: 'absolute',
                        left: 11,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-muted)',
                        pointerEvents: 'none',
                    }}
                />
                <input
                    type="text"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    // Folder-scoped, and it says so: the listing endpoint takes a
                    // folder id and no search term, so there is nothing here to
                    // match beyond what this folder returned.
                    placeholder="Search files and folders in this folder"
                    aria-label="Search files and folders in this folder"
                    style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        height: 36,
                        padding: query ? '0 34px 0 32px' : '0 12px 0 32px',
                        borderRadius: 8,
                        border: '1px solid var(--border-subtle)',
                        background: 'var(--bg-raised)',
                        color: 'var(--text-primary)',
                        fontSize: 13,
                        fontFamily: 'inherit',
                        outline: 'none',
                    }}
                    onFocus={(event) => { event.currentTarget.style.borderColor = 'var(--accent)'; }}
                    onBlur={(event) => { event.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
                />
                {query && (
                    <button
                        type="button"
                        onClick={() => setQuery('')}
                        aria-label="Clear search"
                        title="Clear search"
                        style={{
                            position: 'absolute',
                            right: 7,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            display: 'grid',
                            placeItems: 'center',
                            width: 22,
                            height: 22,
                            borderRadius: 6,
                            border: 'none',
                            background: 'transparent',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                        }}
                    >
                        <IconX size={14} />
                    </button>
                )}
            </div>

            {/* ── Covered-by-folder notice ──
                Without it, a folder full of ticked, un-untickable rows has no
                explanation anywhere on screen. */}
            {coveringFolderName && (
                <p
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        margin: '0 0 8px',
                        fontSize: 12,
                        color: 'var(--accent)',
                    }}
                >
                    <IconFolder size={13} style={{ flexShrink: 0 }} />
                    {`Everything in “${coveringFolderName}” is already selected.`}
                </p>
            )}

            {/* ── Table ── */}
            <div
                style={{
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 10,
                    background: 'var(--bg-app)',
                    overflow: 'hidden',
                }}
            >
                {/* Header: one band, one tone, no column dividers. The whole
                    Name cell is the sort control. */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        height: HEADER_HEIGHT,
                        background: 'var(--bg-raised)',
                        borderBottom: '1px solid var(--border-subtle)',
                    }}
                >
                    <div style={{ width: 44, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                        <input
                            ref={selectAllRef}
                            type="checkbox"
                            checked={allSelected || Boolean(ancestorId)}
                            disabled={selectAllDisabled}
                            onChange={toggleSelectAll}
                            aria-label={allSelected ? 'Deselect all shown' : 'Select all shown'}
                            title={
                                ancestorId
                                    ? 'Everything here is included by the selected parent folder.'
                                    : allSelected ? 'Deselect all shown' : 'Select all shown'
                            }
                            style={{
                                width: 15,
                                height: 15,
                                accentColor: 'var(--accent)',
                                cursor: selectAllDisabled ? 'not-allowed' : 'pointer',
                                opacity: selectAllDisabled ? 0.5 : 1,
                            }}
                        />
                    </div>

                    <button
                        type="button"
                        aria-label={`Sort by name, currently ${sortDirection === 'asc' ? 'A to Z' : 'Z to A'}`}
                        onClick={() => setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                        onMouseEnter={() => setHeaderHovered(true)}
                        onMouseLeave={() => setHeaderHovered(false)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            flex: 1,
                            minWidth: 0,
                            height: '100%',
                            padding: '0 8px 0 32px',
                            border: 'none',
                            background: headerHovered ? 'var(--bg-hover)' : 'transparent',
                            color: 'var(--text-secondary)',
                            fontFamily: 'inherit',
                            fontSize: 13,
                            fontWeight: 500,
                            textAlign: 'left',
                            cursor: 'pointer',
                        }}
                    >
                        Name
                        <IconChevronDown
                            size={13}
                            aria-hidden="true"
                            style={{
                                transform: sortDirection === 'asc' ? 'rotate(180deg)' : undefined,
                                transition: 'transform 120ms ease',
                            }}
                        />
                    </button>

                    {showSize && (
                        <span
                            style={{
                                width: 74,
                                textAlign: 'right',
                                fontSize: 13,
                                fontWeight: 500,
                                color: 'var(--text-secondary)',
                                flexShrink: 0,
                            }}
                        >
                            Size
                        </span>
                    )}
                    <span style={{ width: 26, flexShrink: 0 }} aria-hidden="true" />
                </div>

                {/* Rows. Capped on a row boundary with a sticky-free header above
                    it, so the last visible row is always whole. */}
                <div
                    role="listbox"
                    aria-multiselectable="true"
                    aria-label={`${serviceName} files and folders`}
                    style={{
                        position: 'relative',
                        maxHeight: LIST_MAX_HEIGHT,
                        overflowY: 'auto',
                    }}
                >
                    {isLoading ? (
                        <div style={emptyState}>
                            <IconLoader2 size={16} className="animate-spin" />
                            <span>Loading…</span>
                        </div>
                    ) : error ? (
                        <div style={emptyState}>
                            <IconAlertTriangle size={16} />
                            <span>{error}</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        delete cache.current[currentFolderId || 'root'];
                                        load(currentFolderId);
                                    }}
                                    style={linkButton}
                                >
                                    Try again
                                </button>
                                <button type="button" onClick={onReconnect} style={linkButton}>
                                    {`Reconnect ${serviceName}`}
                                </button>
                            </span>
                        </div>
                    ) : visible.length === 0 ? (
                        <div style={emptyState}>
                            <IconFolderOff size={16} />
                            <span>
                                {query
                                    ? `Nothing here matches “${query}”.`
                                    : 'This folder is empty.'}
                            </span>
                        </div>
                    ) : (
                        visible.map((record, index) => (
                            <DriveFileRow
                                key={record.id}
                                record={record}
                                isFirst={index === 0}
                                selected={isRowSelected(selection, integration, folderPath, record)}
                                autoSelected={isRowAutoSelected(selection, integration, folderPath, record)}
                                blocked={isBlockedBySensitivity(record)}
                                showSize={showSize}
                                onToggle={() => toggleRow(record)}
                                onOpen={() => openFolder(record)}
                                onBlockedClick={() => toast.error(
                                    record.attentionNote
                                    || 'This file is access-restricted and cannot be attached.',
                                )}
                            />
                        ))
                    )}

                    {/* A clipped row should read as intentional. */}
                    {!isLoading && !error && visible.length > VISIBLE_ROWS && (
                        <div
                            aria-hidden="true"
                            style={{
                                position: 'sticky',
                                bottom: 0,
                                height: 24,
                                marginTop: -24,
                                pointerEvents: 'none',
                                background: 'linear-gradient(to bottom, transparent, var(--bg-app))',
                            }}
                        />
                    )}
                </div>
            </div>

            {/* Match count, only while filtering */}
            {query && !isLoading && !error && (
                <p
                    aria-live="polite"
                    style={{ margin: '6px 0 0', fontSize: 11.5, color: 'var(--text-muted)' }}
                >
                    {`${visible.length} of ${records.length} item${records.length === 1 ? '' : 's'} match`}
                </p>
            )}

            {/* Selection bar — space reserved so it never shifts the table */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    height: 32,
                    marginTop: 4,
                }}
            >
                {counts.total > 0 && (
                    <>
                        <span style={{ flex: 1, fontSize: 12, color: 'var(--text-secondary)' }}>
                            {[
                                counts.folderCount > 0
                                    ? `${counts.folderCount} folder${counts.folderCount === 1 ? '' : 's'}`
                                    : null,
                                counts.fileCount > 0
                                    ? `${counts.fileCount} file${counts.fileCount === 1 ? '' : 's'}`
                                    : null,
                            ].filter(Boolean).join(' · ')}
                            {' selected'}
                        </span>
                        <button
                            type="button"
                            onClick={onClear}
                            style={linkButton}
                            title={`Remove everything selected from ${serviceName}`}
                        >
                            Clear
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

const emptyState: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: DRIVE_ROW_HEIGHT * 3,
    padding: '0 24px',
    fontSize: 12.5,
    color: 'var(--text-muted)',
    textAlign: 'center',
};

const linkButton: React.CSSProperties = {
    border: 'none',
    background: 'transparent',
    color: 'var(--accent)',
    fontSize: 12.5,
    fontFamily: 'inherit',
    cursor: 'pointer',
    padding: 0,
};

export default DriveFileBrowser;
