/**
 * DataSourceLibraryPicker — pick already-uploaded files out of the user's
 * library, in the new UI's visual language.
 *
 * Replaces the old MantineReactTable picker (components/DataSources/
 * DataSourceSelector.tsx) at the assistant-editor call site. It lists the same
 * records as the full-pane Library through the same shared query helpers
 * (shared/libraryQuery.ts), so "browse library" and the Library page can never
 * disagree about what exists.
 *
 * Renders as an inline panel, not a modal: the assistant editor is already a
 * modal, and NEW_UI_GUIDE standing rule 2 allows only one at a time.
 *
 * Multi-select is the point — attaching five files to an assistant should be
 * one trip, so rows toggle and a footer button commits the batch.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    IconAlertCircle,
    IconCheck,
    IconLoader2,
    IconSearch,
    IconX,
} from '@tabler/icons-react';
import { FileRecord, PageKey, queryUserFiles } from '@/services/fileService';
import { buildLibraryQuery, isAssistantRecord, libraryTypeLabel, sanitizePageKey } from './libraryQuery';
import { resolveDataSourceType } from './DataSourceCard';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The shape the assistant editor (and the old DataSourceSelector before it)
 * hands to `dataSources`.
 *
 * `id` is the record's raw S3 key and `key` is deliberately absent: the editor's
 * save step prefixes a keyless source with `s3://`, and would skip that prefix
 * if `key` were set. See NewUIAssistantCreationModal's processedDataSources.
 */
export interface PickedLibraryFile {
    id: string;
    name: string;
    type: string;
    metadata: Record<string, any>;
}

export interface DataSourceLibraryPickerProps {
    /** Called with every newly picked file when the user commits the selection. */
    onSelect: (files: PickedLibraryFile[]) => void;
    /** Close the panel without adding anything. */
    onClose: () => void;
    /** Ids already attached — rows render as "Added" and cannot be re-picked. */
    attachedIds?: string[];
    /** Scroll height of the row list. */
    listHeight?: number;
}

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 350;

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export const DataSourceLibraryPicker: React.FC<DataSourceLibraryPickerProps> = ({
    onSelect,
    onClose,
    attachedIds = [],
    listHeight = 268,
}) => {
    const [search, setSearch] = useState('');
    const [committedSearch, setCommittedSearch] = useState('');
    const [items, setItems] = useState<FileRecord[]>([]);
    const [selected, setSelected] = useState<Record<string, PickedLibraryFile>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [isPaging, setIsPaging] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [nextPageKey, setNextPageKey] = useState<PageKey | null>(null);

    const attached = useMemo(() => new Set(attachedIds), [attachedIds]);
    const selectedCount = Object.keys(selected).length;

    // Debounce the search box so typing doesn't fire a request per keystroke.
    useEffect(() => {
        const timer = setTimeout(() => setCommittedSearch(search), SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [search]);

    // A stale response from an earlier search must not overwrite a newer one.
    const requestSeq = useRef(0);

    const fetchPage = useCallback(async (searchTerm: string, pageKey: PageKey | null) => {
        const seq = ++requestSeq.current;
        if (pageKey) setIsPaging(true);
        else setIsLoading(true);
        try {
            const result = await queryUserFiles(
                buildLibraryQuery({ pageSize: PAGE_SIZE, search: searchTerm, pageKey }),
                null,
            );
            if (seq !== requestSeq.current) return; // superseded
            if (!result.success || !result.data) {
                setError('Could not load your library. Try again.');
                return;
            }
            const page = (result.data.items || []).filter((f: FileRecord) => !isAssistantRecord(f));
            setItems((prev) => (pageKey ? [...prev, ...page] : page));
            setNextPageKey(sanitizePageKey(result.data.pageKey));
            setError(null);
        } catch {
            if (seq === requestSeq.current) setError('Could not load your library. Try again.');
        } finally {
            if (seq === requestSeq.current) {
                setIsLoading(false);
                setIsPaging(false);
            }
        }
    }, []);

    // First page + every committed search re-runs from the top.
    useEffect(() => {
        setNextPageKey(null);
        fetchPage(committedSearch, null);
    }, [committedSearch, fetchPage]);

    const toggle = (file: FileRecord) => {
        if (attached.has(file.id)) return;
        setSelected((prev) => {
            const next = { ...prev };
            if (next[file.id]) delete next[file.id];
            else {
                next[file.id] = {
                    id: file.id,
                    name: file.name || '',
                    type: file.type || '',
                    metadata: {
                        createdAt: file.createdAt,
                        tags: file.tags,
                        totalTokens: file.totalTokens,
                        ...(file.data?.metadata ?? {}),
                    },
                };
            }
            return next;
        });
    };

    const commit = () => {
        if (selectedCount === 0) return;
        onSelect(Object.values(selected));
        setSelected({});
    };

    return (
        <div
            style={{
                border: '1px solid var(--border-subtle)',
                borderRadius: 10,
                background: 'var(--bg-app)',
                marginBottom: 12,
                overflow: 'hidden',
            }}
        >
            {/* ── Header: search + close ── */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 12px',
                    borderBottom: '1px solid var(--border-subtle)',
                }}
            >
                <div style={{ position: 'relative', flex: 1 }}>
                    <IconSearch
                        size={14}
                        style={{
                            position: 'absolute',
                            left: 9,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: 'var(--text-muted)',
                            pointerEvents: 'none',
                        }}
                    />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        // namePrefix is a prefix match, not a substring search —
                        // say so instead of letting "report" fail to find
                        // "Q3-report.pdf".
                        placeholder="Search files by starting letters…"
                        aria-label="Search your library by file name prefix"
                        style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            padding: '6px 10px 6px 28px',
                            borderRadius: 8,
                            border: '1px solid var(--border-subtle)',
                            background: 'var(--bg-raised)',
                            color: 'var(--text-primary)',
                            fontSize: 13,
                            fontFamily: 'inherit',
                            outline: 'none',
                        }}
                    />
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close library picker"
                    style={{
                        display: 'grid',
                        placeItems: 'center',
                        width: 26,
                        height: 26,
                        borderRadius: 7,
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        flexShrink: 0,
                    }}
                    onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
                        (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                    }}
                    onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                        (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
                    }}
                >
                    <IconX size={15} />
                </button>
            </div>

            {/* ── Rows ── */}
            <div
                role="listbox"
                aria-multiselectable="true"
                aria-label="Your library"
                style={{ height: listHeight, overflowY: 'auto' }}
            >
                {isLoading ? (
                    <div style={centeredState}>
                        <IconLoader2 size={16} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
                        <span>Loading your library…</span>
                    </div>
                ) : error ? (
                    <div style={centeredState}>
                        <IconAlertCircle size={16} style={{ color: 'var(--text-muted)' }} />
                        <span>{error}</span>
                        <button type="button" onClick={() => fetchPage(committedSearch, null)} style={linkButton}>
                            Retry
                        </button>
                    </div>
                ) : items.length === 0 ? (
                    <div style={centeredState}>
                        <span>
                            {committedSearch
                                ? `No files start with “${committedSearch}”.`
                                : 'Your library is empty. Upload a file from your computer first.'}
                        </span>
                    </div>
                ) : (
                    items.map((file) => {
                        const isAttached = attached.has(file.id);
                        const isSelected = Boolean(selected[file.id]);
                        const descriptor = resolveDataSourceType(file.name, file.type);
                        return (
                            <div
                                key={file.id}
                                role="option"
                                aria-selected={isSelected}
                                aria-disabled={isAttached}
                                tabIndex={isAttached ? -1 : 0}
                                onClick={() => toggle(file)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        toggle(file);
                                    }
                                }}
                                title={file.name}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10,
                                    padding: '8px 12px',
                                    cursor: isAttached ? 'default' : 'pointer',
                                    opacity: isAttached ? 0.55 : 1,
                                    background: isSelected
                                        ? 'color-mix(in srgb, var(--accent) 10%, var(--bg-app))'
                                        : 'transparent',
                                    outline: 'none',
                                }}
                                onMouseEnter={(e) => {
                                    if (!isSelected && !isAttached) {
                                        (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (!isSelected) {
                                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                                    }
                                }}
                                onFocus={(e) => {
                                    (e.currentTarget as HTMLElement).style.boxShadow =
                                        'inset 0 0 0 2px var(--accent)';
                                }}
                                onBlur={(e) => {
                                    (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                                }}
                            >
                                {/* Checkbox */}
                                <span
                                    aria-hidden="true"
                                    style={{
                                        display: 'grid',
                                        placeItems: 'center',
                                        width: 16,
                                        height: 16,
                                        flexShrink: 0,
                                        borderRadius: 4,
                                        border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border-subtle)'}`,
                                        background: isSelected ? 'var(--accent)' : 'transparent',
                                        color: 'var(--accent-fg)',
                                    }}
                                >
                                    {(isSelected || isAttached) && <IconCheck size={11} />}
                                </span>

                                {/* Type icon */}
                                <span
                                    aria-hidden="true"
                                    style={{ display: 'grid', placeItems: 'center', width: 20, flexShrink: 0, color: descriptor.color }}
                                >
                                    {descriptor.icon}
                                </span>

                                {/* Name */}
                                <span
                                    style={{
                                        flex: 1,
                                        minWidth: 0,
                                        fontSize: 13,
                                        color: 'var(--text-primary)',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    {file.name}
                                </span>

                                {/* Type label / attached marker */}
                                <span
                                    style={{
                                        fontSize: 11.5,
                                        color: 'var(--text-muted)',
                                        flexShrink: 0,
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    {isAttached ? 'Added' : libraryTypeLabel(file)}
                                </span>
                            </div>
                        );
                    })
                )}

                {/* Pagination */}
                {!isLoading && !error && nextPageKey && (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 12px' }}>
                        <button
                            type="button"
                            onClick={() => fetchPage(committedSearch, nextPageKey)}
                            disabled={isPaging}
                            style={{
                                ...linkButton,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                cursor: isPaging ? 'default' : 'pointer',
                            }}
                        >
                            {isPaging && <IconLoader2 size={13} className="animate-spin" />}
                            {isPaging ? 'Loading…' : 'Load more'}
                        </button>
                    </div>
                )}
            </div>

            {/* ── Footer ── */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    borderTop: '1px solid var(--border-subtle)',
                }}
            >
                <span aria-live="polite" style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1 }}>
                    {selectedCount > 0 ? `${selectedCount} selected` : 'Select files to attach'}
                </span>
                <button
                    type="button"
                    onClick={onClose}
                    style={{
                        padding: '6px 12px',
                        borderRadius: 8,
                        border: '1px solid var(--border-subtle)',
                        background: 'transparent',
                        color: 'var(--text-secondary)',
                        fontSize: 13,
                        fontFamily: 'inherit',
                        cursor: 'pointer',
                    }}
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={commit}
                    disabled={selectedCount === 0}
                    style={{
                        padding: '6px 14px',
                        borderRadius: 8,
                        border: 'none',
                        background: selectedCount === 0 ? 'var(--bg-active)' : 'var(--accent)',
                        color: selectedCount === 0 ? 'var(--text-muted)' : 'var(--accent-fg)',
                        fontSize: 13,
                        fontWeight: 500,
                        fontFamily: 'inherit',
                        cursor: selectedCount === 0 ? 'not-allowed' : 'pointer',
                    }}
                >
                    {selectedCount > 1 ? `Attach ${selectedCount} files` : 'Attach'}
                </button>
            </div>
        </div>
    );
};

const centeredState: React.CSSProperties = {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
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

export default DataSourceLibraryPicker;
