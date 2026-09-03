/**
 * NewLibraryView — New UI full-pane view of the user's uploaded documents (Library).
 *
 * Replaces LibraryView.tsx's old DataSourcesTable (MantineReactTable) with the
 * same clean, token-driven list-row design used in NewAssistantsView.
 *
 * Data-fetching logic is adapted from DataSourcesTable.tsx (same service calls,
 * no changes to any service/util files).
 *
 * Design tokens: --bg-app, --bg-sidebar, --bg-raised, --bg-hover, --bg-active,
 *                --border-subtle, --text-primary, --text-secondary, --text-muted, --accent
 */

import React, {
    useContext, useEffect, useMemo, useRef, useState, useCallback
} from 'react';
import toast from 'react-hot-toast';
import {
    IconX,
    IconSearch,
    IconCloudUpload,
    IconDownload,
    IconTrash,
    IconRefresh,
    IconReload,
    IconLoader2,
    IconFile,
    IconFileTypePdf,
    IconFileTypeCsv,
    IconFileTypeDoc,
    IconFileTypeDocx,
    IconFileTypePng,
    IconFileTypeJpg,
    IconFileTypeXls,
    IconFileText,
    IconFileCode,
    IconFileSpreadsheet,
    IconMovie,
    IconAlertCircle,
    IconCheckbox,
    IconSquare,
    IconEye,
    IconPaperclip,
} from '@tabler/icons-react';
import HomeContext from '@/pages/api/home/home.context';
import {
    FileRecord, FileQuery, PageKey, queryUserFiles, setTags, getFileDownloadUrl
} from '@/services/fileService';
import {
    downloadDataSourceFile, deleteDatasourceFile, extractKey,
    getDocumentStatusConfig, getFileAction, startFileStatusPolling,
    startFileReprocessingWithPolling, disableSupportReprocess
} from '@/utils/app/files';
import { getMimeTypeFromExtension, mimeTypeToCommonName } from '@/utils/app/fileTypeTranslations';
import { embeddingDocumentStatus } from '@/services/adminService';
import { capitalize } from '@/utils/app/data';
import { handleFile } from '@/components/Chat/AttachFile';
import type { AttachedDocument } from '@/types/attacheddocument';
import AttachmentPreview from '@/components/NewUI/shared/AttachmentPreview';
import ConfirmDialog from '@/components/NewUI/shared/ConfirmDialog';
import NewUILoadingStatus from '@/components/NewUI/shared/NewUILoadingStatus';
import { SortableHeader } from '@/components/NewUI/shared/SortableHeader';
import { UIAttachment } from '@/components/NewUI/shared/attachmentTypes';
import {
    LIBRARY_SORT_INDEX, buildLibraryQuery, isAssistantRecord, libraryTypeLabel, sanitizePageKey,
} from '@/components/NewUI/shared/libraryQuery';

// ── Helpers ───────────────────────────────────────────────────────────────────
// sanitizePageKey / buildLibraryQuery live in shared/libraryQuery.ts so the
// assistant editor's library picker lists the same records the same way.

function formatDate(isoString: string): string {
    try {
        return new Date(isoString).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
        });
    } catch {
        return '—';
    }
}

function formatTime(isoString: string): string {
    try {
        return new Date(isoString).toLocaleTimeString('en-US', {
            hour: 'numeric', minute: '2-digit', hour12: true,
        });
    } catch {
        return '';
    }
}

/** Return the byte count stored on a library record by the file service. */
function getFileBytes(file: FileRecord): number {
    const record = file as FileRecord & { size?: unknown; contentLength?: unknown; bytes?: unknown };
    const candidates = [
        record.size,
        record.contentLength,
        record.bytes,
        file.data?.size,
        file.data?.file_size,
        file.data?.fileSize,
        file.data?.bytes,
        file.data?.sizeBytes,
        file.data?.contentLength,
        file.data?.metadata?.size,
        file.data?.metadata?.file_size,
        file.data?.metadata?.fileSize,
        file.data?.metadata?.bytes,
        file.data?.metadata?.sizeBytes,
        file.data?.metadata?.contentLength,
    ];

    const value = candidates.find((candidate) => {
        const numeric = typeof candidate === 'string' ? Number(candidate) : candidate;
        return typeof numeric === 'number' && Number.isFinite(numeric) && numeric >= 0;
    });
    return typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : 0;
}

/** Measure a file-download response, including the base64 payload returned by the file service. */
async function getDownloadPayloadBytes(response: Response): Promise<number> {
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    const payload = await response.arrayBuffer();
    if (!payload.byteLength) return 0;

    // Some deployments return the object as base64 text while labeling it as
    // octet-stream. Decode that representation when it is valid base64; binary
    // responses fall back to their actual byte length.
    if (contentType.includes('text') || contentType.includes('json') || contentType.includes('octet-stream')) {
        const text = new TextDecoder().decode(payload).trim();
        let candidate = text;
        if (contentType.includes('json')) {
            try {
                const parsed = JSON.parse(text);
                candidate = typeof parsed === 'string' ? parsed : parsed?.data ?? parsed?.body ?? text;
            } catch {
                // Continue with the raw response below.
            }
        }
        const candidateText = typeof candidate === 'string' ? candidate : text;
        const dataUrlPayload = candidateText.indexOf(',');
        const base64 = (dataUrlPayload >= 0 ? candidateText.slice(dataUrlPayload + 1) : candidateText)
            .replace(/\s/g, '');
        if (base64 && /^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
            try {
                return window.atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')).length;
            } catch {
                // It was a binary payload despite its response headers.
            }
        }
    }
    return payload.byteLength;
}

/** Return the appropriate Tabler file-type icon for a mime type. */
function FileTypeIcon({ mime, name = '', size = 18 }: { mime: string; name?: string; size?: number }) {
    const color = 'var(--text-muted)';
    const s = size;
    if (mime.startsWith('video/') || /\.(avi|m4v|mkv|mov|mp4|mpeg|mpg|webm|wmv)$/i.test(name)) {
        return <IconMovie size={s} style={{ color }} />;
    }
    if (!mime) return <IconFile size={s} style={{ color }} />;
    if (mime.includes('pdf')) return <IconFileTypePdf size={s} style={{ color }} />;
    if (mime.includes('csv')) return <IconFileTypeCsv size={s} style={{ color }} />;
    if (mime.includes('docx') || mime.includes('wordprocessingml'))
        return <IconFileTypeDocx size={s} style={{ color }} />;
    if (mime.includes('doc')) return <IconFileTypeDoc size={s} style={{ color }} />;
    if (mime.includes('png')) return <IconFileTypePng size={s} style={{ color }} />;
    if (mime.includes('jpg') || mime.includes('jpeg')) return <IconFileTypeJpg size={s} style={{ color }} />;
    if (mime.includes('xls') || mime.includes('spreadsheetml'))
        return <IconFileTypeXls size={s} style={{ color }} />;
    if (mime.includes('text/plain')) return <IconFileText size={s} style={{ color }} />;
    if (mime.includes('json') || mime.includes('xml') || mime.includes('html'))
        return <IconFileCode size={s} style={{ color }} />;
    if (mime.includes('sheet') || mime.includes('excel'))
        return <IconFileSpreadsheet size={s} style={{ color }} />;
    return <IconFile size={s} style={{ color }} />;
}

/** Status badge styled with new-UI tokens */
function StatusBadge({ status }: { status: string | undefined }) {
    if (!status) return null;
    const config = getDocumentStatusConfig(status);
    if (!config) return null;

    const statusMap: Record<string, { bg: string; fg: string; dot?: boolean }> = {
        completed:   { bg: 'var(--bg-raised)',  fg: 'var(--text-secondary)' },
        processing:  { bg: '#3A2A0A',            fg: '#E8A030', dot: true },
        starting:    { bg: 'rgba(80,120,200,0.15)', fg: '#6090D8', dot: true },
        failed:      { bg: 'rgba(200,60,60,0.15)',  fg: '#E05252', dot: true },
        terminated:  { bg: 'rgba(100,100,100,0.15)',fg: 'var(--text-muted)', dot: true },
        not_found:   { bg: 'transparent',          fg: 'var(--text-muted)' },
    };

    const style = statusMap[status] ?? { bg: 'var(--bg-raised)', fg: 'var(--text-muted)' };

    return (
        <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap"
            style={{ backgroundColor: style.bg, color: style.fg }}
        >
            {style.dot && (
                <span
                    className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        status === 'processing' || status === 'starting' ? 'animate-pulse' : ''
                    }`}
                    style={{ backgroundColor: style.fg }}
                />
            )}
            {config.text === '-----' ? '—' : capitalize(config.text)}
        </span>
    );
}

// ── Tag chip ──────────────────────────────────────────────────────────────────

function TagChip({ label }: { label: string }) {
    return (
        <span
            className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] whitespace-nowrap"
            style={{ backgroundColor: 'var(--bg-active)', color: 'var(--text-muted)' }}
        >
            {label}
        </span>
    );
}

// ── Empty state ───────────────────────────────────────────────────────────────

const EmptyState: React.FC<{ message: string; subMessage?: string; onUpload?: () => void }> = ({
    message, subMessage, onUpload,
}) => (
    <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
        <IconCloudUpload size={36} className="mb-4 opacity-20" style={{ color: 'var(--text-muted)' }} />
        <p className="text-[14px] font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
            {message}
        </p>
        {subMessage && (
            <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>{subMessage}</p>
        )}
        {onUpload && (
            <button
                onClick={onUpload}
                className="mt-5 flex items-center gap-1.5 h-[34px] px-4 rounded-[8px] text-[13px] font-medium text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: 'var(--accent)' }}
            >
                <IconCloudUpload size={14} />
                Upload a file
            </button>
        )}
    </div>
);

// ── File row ─────────────────────────────────────────────────────────────────

interface FileRowProps {
    file: FileRecord & { commonType?: string };
    embeddingStatus: Record<string, string> & { metadata?: Record<string, any> } | null;
    fetchedKeys: Set<string>;
    pollingFiles: Set<string>;
    isDeleteMode: boolean;
    isSelected: boolean;
    onToggleSelect: () => void;
    onDownload: () => void;
    onDelete: () => void;
    onReprocess: () => void;
    onStatusRefresh: () => void;
    onAttachToConversation: () => void;
    imagePreviewUrl?: string;
    imagePreviewLoading?: boolean;
    onPreview: (originRect: DOMRect) => void;
}

const FileRow: React.FC<FileRowProps> = ({
    file,
    embeddingStatus,
    fetchedKeys,
    pollingFiles,
    isDeleteMode,
    isSelected,
    onToggleSelect,
    onDownload,
    onDelete,
    onReprocess,
    onStatusRefresh,
    onAttachToConversation,
    imagePreviewUrl,
    imagePreviewLoading = false,
    onPreview,
}) => {
    const [hovered, setHovered] = useState(false);
    const key = extractKey(file);
    const status = embeddingStatus?.[key];
    const isPolling = pollingFiles.has(file.id);
    const hasFetched = fetchedKeys.has(key);
    const action = hasFetched && status ? getFileAction(file.createdAt, status, embeddingStatus?.metadata?.[key]) : null;
    const canReprocess = !disableSupportReprocess(file.type);

    return (
        <div
            className="group flex items-center gap-3 px-4 py-2.5 rounded-[8px] transition-colors duration-100 cursor-default"
            style={{ backgroundColor: hovered ? 'var(--bg-hover)' : 'transparent' }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            {/* Select checkbox (delete mode) */}
            {isDeleteMode && (
                <button
                    className="flex-shrink-0 flex items-center justify-center w-5 h-5"
                    onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
                    title={isSelected ? 'Deselect' : 'Select'}
                >
                    {isSelected
                        ? <IconCheckbox size={18} style={{ color: 'var(--accent)' }} />
                        : <IconSquare size={18} style={{ color: 'var(--text-muted)' }} />
                    }
                </button>
            )}

            {/* File type tile / image preview */}
            <div
                className="group/file-tile relative flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-[8px] overflow-hidden"
                style={{ backgroundColor: 'var(--bg-raised)' }}
            >
                {imagePreviewUrl ? (
                    <img src={imagePreviewUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                    <FileTypeIcon mime={file.type} name={file.name} size={16} />
                )}
                {imagePreviewLoading && (
                    <div
                        className="absolute inset-0 flex items-center justify-center"
                        role="status"
                        aria-label="Loading preview"
                        style={{ backgroundColor: 'rgba(0, 0, 0, 0.42)', color: 'white' }}
                    >
                        <IconLoader2 size={16} className="animate-spin" />
                    </div>
                )}
                <button
                    type="button"
                    aria-label={'Preview ' + file.name}
                    title="Preview"
                    onClick={(e) => {
                        e.stopPropagation();
                        onPreview(e.currentTarget.parentElement?.getBoundingClientRect() ?? new DOMRect());
                    }}
                    className="absolute inset-0 flex items-center justify-center opacity-0 pointer-events-none group-hover/file-tile:opacity-100 group-hover/file-tile:pointer-events-auto focus-visible:opacity-100 focus-visible:pointer-events-auto transition-opacity duration-100"
                    style={{ backgroundColor: 'rgba(0, 0, 0, 0.48)', color: 'white' }}
                >
                    <IconEye size={17} strokeWidth={2} />
                </button>
            </div>

            {/* Name + tags */}
            <div className="flex-1 min-w-0">
                <p
                    className="text-[13px] font-medium truncate"
                    style={{ color: 'var(--text-primary)' }}
                    title={file.name}
                >
                    {file.name}
                </p>
                {file.tags && file.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-0.5">
                        {file.tags.slice(0, 4).map((tag) => (
                            <TagChip key={tag} label={tag} />
                        ))}
                        {file.tags.length > 4 && (
                            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                +{file.tags.length - 4}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Type label */}
            <span
                className="hidden sm:block text-[12px] w-[80px] text-right flex-shrink-0"
                style={{ color: 'var(--text-muted)' }}
            >
                {file.commonType || (file.type ? file.type.slice(0, 12) : '—')}
            </span>

            {/* Date */}
            <span
                className="hidden md:block text-[12px] w-[90px] text-right flex-shrink-0"
                style={{ color: 'var(--text-muted)' }}
                title={formatDate(file.createdAt) + ' ' + formatTime(file.createdAt)}
            >
                {formatDate(file.createdAt)}
            </span>

            {/* Status */}
            <div className="flex items-center gap-1 w-[100px] justify-end flex-shrink-0">
                {!hasFetched ? (
                    <IconLoader2 size={14} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
                ) : (
                    <StatusBadge status={status} />
                )}
                {/* Polling spinner */}
                {isPolling && (
                    <IconLoader2 size={13} className="animate-spin ml-1" style={{ color: 'var(--text-muted)' }} />
                )}
                {/* Action buttons (refresh / reprocess) */}
                {!isPolling && hasFetched && canReprocess && action === 'refresh' && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onStatusRefresh(); }}
                        className="flex items-center justify-center h-5 w-5 rounded-[4px] transition-colors"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#6090D8'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                        title="Check status update"
                    >
                        <IconRefresh size={13} />
                    </button>
                )}
                {!isPolling && hasFetched && canReprocess && action === 'reprocess' && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Regenerate text extraction and embeddings for this file?')) {
                                onReprocess();
                            }
                        }}
                        className="flex items-center justify-center h-5 w-5 rounded-[4px] transition-colors"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#E8A030'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                        title="Regenerate embeddings"
                    >
                        <IconReload size={13} />
                    </button>
                )}
            </div>

            {/* Hover actions */}
            <div
                className={`flex items-center gap-1 transition-opacity duration-100 ${
                    hovered && !isDeleteMode ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    className="flex items-center justify-center h-[28px] w-[28px] rounded-[6px] transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-active)';
                        (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                    }}
                    onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                        (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
                    }}
                    onClick={onDownload}
                    title="Download"
                >
                    <IconDownload size={14} />
                </button>
                <button
                    className="flex items-center justify-center h-[28px] w-[28px] rounded-[6px] transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-active)';
                        (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                    }}
                    onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                        (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
                    }}
                    onClick={onAttachToConversation}
                    title="Attach to new conversation"
                    aria-label={'Attach ' + file.name + ' to a new conversation'}
                >
                    <IconPaperclip size={14} />
                </button>
                <button
                    className="flex items-center justify-center h-[28px] w-[28px] rounded-[6px] transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-active)';
                        (e.currentTarget as HTMLElement).style.color = '#E05252';
                    }}
                    onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                        (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
                    }}
                    onClick={onDelete}
                    title="Delete"
                >
                    <IconTrash size={14} />
                </button>
            </div>
        </div>
    );
};

// Column headers are rendered by the shared SortableHeader component.

type LibrarySortKey = 'name' | 'type' | 'createdAt' | 'status';

const SORT_ACTION_WIDTH = 92;

// ── Main component ────────────────────────────────────────────────────────────

export const NewLibraryView: React.FC = () => {
    const {
        state: { featureFlags },
        dispatch,
        setLoadingMessage,
        handleNewConversation,
    } = useContext(HomeContext);

    // ── Data state ─────────────────────────────────────────────────────────────
    const [data, setData] = useState<(FileRecord & { commonType?: string })[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isRefetching, setIsRefetching] = useState(false);
    const [isError, setIsError] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    // Pagination
    const [pageIndex, setPageIndex] = useState(0);
    const [pageKeys, setPageKeys] = useState<PageKey[]>([]);
    const pageKeysRef = useRef<PageKey[]>([]);
    const [hasMore, setHasMore] = useState(false);
    const PAGE_SIZE = 50;

    // Embedding status
    const [embeddingStatus, setEmbeddingStatus] = useState<Record<string, string> & { metadata?: Record<string, any> } | null>(null);
    const [isLoadingStatus, setIsLoadingStatus] = useState(false);
    const fetchedStatusKeys = useRef<Set<string>>(new Set());
    const [pollingFiles, setPollingFiles] = useState<Set<string>>(new Set());

    // Delete mode
    const [isDeleteMode, setIsDeleteMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<FileRecord | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    // Remembers the count in-flight so the loading message stays correct even
    // after selectedIds is cleared mid-deletion.
    const [deletingCount, setDeletingCount] = useState(0);

    // Search
    const [search, setSearch] = useState('');
    const [committedSearch, setCommittedSearch] = useState('');
    const searchRef = useRef<HTMLInputElement>(null);
    const [sort, setSort] = useState<{ key: LibrarySortKey; direction: 'asc' | 'desc' }>({
        key: 'createdAt',
        direction: 'desc',
    });

    // Upload
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [imagePreviewUrls, setImagePreviewUrls] = useState<Record<string, string>>({});
    const [imagePreviewLoading, setImagePreviewLoading] = useState<Record<string, boolean>>({});
    const [previewBytes, setPreviewBytes] = useState<Record<string, number>>({});
    const imagePreviewUrlsRef = useRef<Record<string, string>>({});
    const [previewAttachment, setPreviewAttachment] = useState<UIAttachment | null>(null);
    const [previewOriginRect, setPreviewOriginRect] = useState<DOMRect | undefined>(undefined);

    // ── Fetch ──────────────────────────────────────────────────────────────────

    const fetchPage = useCallback(async (newSearch: string, newPageIndex: number, keys: PageKey[]) => {
        if (!data.length) setIsLoading(true);
        else setIsRefetching(true);

        try {
            const pageKeyIndex = newPageIndex - 1;
            const SORT_INDEX = LIBRARY_SORT_INDEX;
            const query: FileQuery = buildLibraryQuery({
                pageSize: PAGE_SIZE,
                search: newSearch,
                pageKey: pageKeyIndex >= 0 ? keys[pageKeyIndex] : null,
            });

            const result = await queryUserFiles(query, null);

            if (!result.success || !result.data) {
                setIsError(true);
                return;
            }

            const items: (FileRecord & { commonType?: string })[] = (result.data.items || [])
                .filter((f: FileRecord) => !isAssistantRecord(f))
                .map((f: FileRecord) => ({ ...f, commonType: libraryTypeLabel(f) }));

            setData(items);

            // Store the cursor already normalised so every later page request
            // sends a start key DynamoDB will accept.
            const nextKey = sanitizePageKey(result.data.pageKey, SORT_INDEX);
            setHasMore(!!nextKey);

            if ((pageKeyIndex >= keys.length - 1 || keys.length === 0) && nextKey) {
                setPageKeys((prev) => {
                    const updated = [...prev];
                    updated[newPageIndex] = nextKey;
                    pageKeysRef.current = updated;
                    return updated;
                });
            }

            setIsError(false);
        } catch (e) {
            console.error(e);
            setIsError(true);
        } finally {
            setIsLoading(false);
            setIsRefetching(false);
        }
    }, [data.length]);

    // Initial + refresh fetch
    useEffect(() => {
        setPageIndex(0);
        pageKeysRef.current = [];
        setPageKeys([]);
        fetchPage(committedSearch, 0, []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [committedSearch, refreshKey]);

    // Subsequent page fetches
    useEffect(() => {
        if (pageIndex === 0) return; // handled above
        fetchPage(committedSearch, pageIndex, pageKeys);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageIndex]);

    // ── Embedding status ───────────────────────────────────────────────────────

    useEffect(() => {
        if (data.length === 0 || isLoadingStatus) return;

        const keys = data.map((f) => ({ key: extractKey(f), type: f.type })).filter((k) => k.key);
        const pendingKeys = keys.filter(({ key }) => !fetchedStatusKeys.current.has(key));
        if (!pendingKeys.length) return;
        setIsLoadingStatus(true);

        const CHUNK = 25;
        const chunks: typeof keys[] = [];
        for (let i = 0; i < pendingKeys.length; i += CHUNK) chunks.push(pendingKeys.slice(i, i + CHUNK));

        const promises = chunks.map((chunk) =>
            embeddingDocumentStatus(chunk)
                .then((resp) => {
                    if (resp?.success && resp?.data) {
                        setEmbeddingStatus((prev) => ({
                            ...prev,
                            ...resp.data,
                            ...(resp.metadata && { metadata: { ...prev?.metadata, ...resp.metadata } }),
                        }));
                    }
                    chunk.forEach((item) => fetchedStatusKeys.current.add(item.key));
                })
                .catch(() => { chunk.forEach((item) => fetchedStatusKeys.current.add(item.key)); })
        );

        Promise.allSettled(promises).finally(() => setIsLoadingStatus(false));
    }, [data, isLoadingStatus]);

    const sortedData = useMemo(() => {
        const direction = sort.direction === 'asc' ? 1 : -1;
        return [...data].sort((a, b) => {
            let comparison = 0;
            if (sort.key === 'name') {
                comparison = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
            } else if (sort.key === 'type') {
                const aType = a.commonType || a.type || '';
                const bType = b.commonType || b.type || '';
                comparison = aType.localeCompare(bType, undefined, { numeric: true, sensitivity: 'base' });
            } else if (sort.key === 'createdAt') {
                comparison = (Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0);
            } else {
                const aStatus = embeddingStatus?.[extractKey(a)] || '';
                const bStatus = embeddingStatus?.[extractKey(b)] || '';
                comparison = aStatus.localeCompare(bStatus, undefined, { sensitivity: 'base' });
            }
            return comparison === 0 ? a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) : comparison * direction;
        });
    }, [data, embeddingStatus, sort]);

    const toggleSort = (key: LibrarySortKey) => {
        setSort((current) => current.key === key
            ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
            : { key, direction: key === 'createdAt' ? 'desc' : 'asc' });
    };

    const sortableHeader = (label: string, key: LibrarySortKey) => (
        <SortableHeader
            label={label}
            sortKey={key}
            activeKey={sort.key}
            direction={sort.direction}
            onSort={toggleSort}
        />
    );

    // Fetch signed URLs so image files can use their type tile as a thumbnail.
    // Keep already-fetched URLs when the list changes (for example after a
    // delete), otherwise every surviving image flashes and downloads again.
    useEffect(() => {
        let active = true;
        const imageFiles = data.filter((file) => file.type.startsWith('image/'));
        const imageIds = new Set(imageFiles.map((file) => file.id));
        Object.entries(imagePreviewUrlsRef.current).forEach(([id, url]) => {
            if (!imageIds.has(id)) {
                URL.revokeObjectURL(url);
                delete imagePreviewUrlsRef.current[id];
            }
        });
        setImagePreviewUrls((current) => Object.fromEntries(
            Object.entries(current).filter(([id]) => imageIds.has(id))
        ));
        setImagePreviewLoading((current) => Object.fromEntries(
            Object.entries(current).filter(([id]) => imageIds.has(id))
        ));
        setPreviewBytes((current) => Object.fromEntries(
            Object.entries(current).filter(([id]) => imageIds.has(id))
        ));

        const missingImageFiles = imageFiles.filter((file) => !imagePreviewUrlsRef.current[file.id]);
        if (!missingImageFiles.length) return () => { active = false; };
        setImagePreviewLoading((current) => ({
            ...current,
            ...Object.fromEntries(missingImageFiles.map((file) => [file.id, true])),
        }));

        Promise.all(
            missingImageFiles.map(async (file) => {
                try {
                    const response = await getFileDownloadUrl(extractKey(file), undefined);
                    if (!response.success || !response.downloadUrl) return null;

                    // The file service returns image downloads as base64 text. Convert
                    // that payload to an object URL before giving it to <img>.
                    const imageResponse = await fetch(response.downloadUrl);
                    if (!imageResponse.ok) return null;
                    const base64 = await imageResponse.text();
                    const byteCharacters = window.atob(base64);
                    const byteArray = Uint8Array.from(byteCharacters, (char) => char.charCodeAt(0));
                    const objectUrl = URL.createObjectURL(new Blob([byteArray], { type: file.type }));
                    if (!active) {
                        URL.revokeObjectURL(objectUrl);
                        return null;
                    }
                    imagePreviewUrlsRef.current[file.id] = objectUrl;
                    setPreviewBytes((current) => ({ ...current, [file.id]: byteArray.byteLength }));
                    return [file.id, objectUrl] as const;
                } catch {
                    return null;
                }
            })
        ).then((results) => {
            if (!active) return;
            setImagePreviewUrls((current) => ({
                ...current,
                ...Object.fromEntries(results.filter((result): result is readonly [string, string] => result !== null)),
            }));
            setImagePreviewLoading((current) => ({
                ...current,
                ...Object.fromEntries(missingImageFiles.map((file) => [file.id, false])),
            }));
        });

        return () => { active = false; };
    }, [data]);

    useEffect(() => () => {
        Object.values(imagePreviewUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
    }, []);

    const handlePreview = async (file: FileRecord & { commonType?: string }, originRect: DOMRect) => {
        setPreviewOriginRect(originRect);
        const isImage = file.type.startsWith('image/');
        const isText = file.type.startsWith('text/') || /\.(csv|tsv|json|xml|html?|md)$/i.test(file.name);
        const isVideo = file.type.startsWith('video/') || /\.(avi|m4v|mkv|mov|mp4|mpeg|mpg|webm|wmv)$/i.test(file.name);
        const bytes = getFileBytes(file);
        const existingUrl = imagePreviewUrls[file.id];
        const knownBytes = previewBytes[file.id];
        const previewState = isImage || isText
            ? (existingUrl ? 'available' : 'pending')
            : 'unsupported';

        setPreviewAttachment({
            id: file.id,
            kind: isImage ? 'image' : 'file',
            status: 'ready',
            name: file.name,
            ext: isImage ? null : (file.name.split('.').pop()?.toUpperCase() ?? null),
            bytes: knownBytes ?? bytes,
            mime: file.type || 'application/octet-stream',
            previewUrl: existingUrl,
            thumbUrl: existingUrl,
            previewState,
        });

        if (existingUrl) return;
        if (previewState === 'unsupported' && !isVideo) return;
        try {
            const response = await getFileDownloadUrl(extractKey(file), undefined);
            if (response.success && response.downloadUrl) {
                if (isVideo) {
                    // HEAD is unreliable for this endpoint (it may return 0 even
                    // when the subsequent download contains the full object).
                    const videoResponse = await fetch(response.downloadUrl);
                    if (!videoResponse.ok) throw new Error('Preview request failed: ' + videoResponse.status);
                    const contentLength = await getDownloadPayloadBytes(videoResponse);
                    if (contentLength > 0) {
                        setPreviewBytes((current) => ({ ...current, [file.id]: contentLength }));
                        setPreviewAttachment((current) => current ? { ...current, bytes: contentLength } : current);
                    }
                    return;
                }
                let previewUrl = response.downloadUrl;
                let loadedBytes: number | undefined;
                if (isImage) {
                    const imageResponse = await fetch(response.downloadUrl);
                    if (!imageResponse.ok) throw new Error('Preview request failed: ' + imageResponse.status);
                    const base64 = await imageResponse.text();
                    const byteCharacters = window.atob(base64);
                    const byteArray = Uint8Array.from(byteCharacters, (char) => char.charCodeAt(0));
                    previewUrl = URL.createObjectURL(new Blob([byteArray], { type: file.type }));
                    loadedBytes = byteArray.byteLength;
                    setPreviewBytes((current) => ({ ...current, [file.id]: byteArray.byteLength }));
                } else {
                    const textResponse = await fetch(response.downloadUrl);
                    if (!textResponse.ok) throw new Error('Preview request failed: ' + textResponse.status);
                    const text = await textResponse.text();
                    loadedBytes = new TextEncoder().encode(text).byteLength;
                    setPreviewBytes((current) => ({ ...current, [file.id]: loadedBytes! }));
                }
                setPreviewAttachment((current) => current ? {
                    ...current,
                    previewUrl,
                    thumbUrl: isImage ? previewUrl : undefined,
                    bytes: loadedBytes ?? previewBytes[file.id] ?? bytes,
                    previewState: 'available',
                } : current);
            } else {
                setPreviewAttachment((current) => current ? { ...current, previewState: 'failed' } : current);
            }
        } catch {
            setPreviewAttachment((current) => current ? { ...current, previewState: 'failed' } : current);
        }
    };

    // ── Actions ────────────────────────────────────────────────────────────────

    const handleDownload = (file: FileRecord & { commonType?: string }) => {
        downloadDataSourceFile({ id: file.id, name: file.name, type: file.type });
    };

    const handleAttachToConversation = (file: FileRecord & { commonType?: string }) => {
    const type = file.type || getMimeTypeFromExtension(file.name.split('.').pop()?.toLowerCase() || '') || 'application/octet-stream';
        const document: AttachedDocument = {
            id: file.id,
            name: file.name,
            raw: { size: getFileBytes(file) },
            type,
            data: null,
            key: extractKey(file),
            metadata: (file.data?.metadata || {}) as AttachedDocument['metadata'],
        };
        // Keep the handoff available while the new conversation is being
        // created and its composer mounts. The document is already uploaded,
        // so this is metadata only; the composer reuses its normal send path.
        if (typeof window !== 'undefined') {
            sessionStorage.setItem('amplify_pending_library_doc', JSON.stringify(document));
        }
        handleNewConversation({});
    };

    const handleDelete = async (file: FileRecord) => {
        setDeleteTarget(file);
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        const file = deleteTarget;
        setDeleteTarget(null);
        setIsDeleting(true);
        try {
            const result = await deleteDatasourceFile({ id: file.id, name: file.name });
            if (result.success) {
                // Remove the row in place. Cursors stay valid because a page
                // key only records a position in the index, so there is no need
                // to refetch the page and re-resolve previews/statuses.
                setData((current) => current.filter((item) => item.id !== file.id));
                toast.success('File deleted');
            } else {
                toast.error('Failed to delete file');
            }
        } finally {
            setIsDeleting(false);
        }
    };

    const handleBatchDelete = async () => {
        if (!selectedIds.size) return;
        const count = selectedIds.size;
        setDeletingCount(count);
        // Close the confirm dialog *before* awaiting so the loading overlay
        // (z-index 9999) isn't hidden behind the dialog (z-index 10000).
        setShowDeleteConfirm(false);
        setIsDeleting(true);
        try {
            const deletions = await Promise.all(
                Array.from(selectedIds).map((id) => {
                    const f = data.find((x) => x.id === id);
                    return deleteDatasourceFile({ id, name: f?.name }, false).then((result) => ({ id, result }));
                })
            );
            const failed = deletions.filter(({ result }) => !result.success);
            const successfulIds = new Set(deletions.filter(({ result }) => result.success).map(({ id }) => id));
            const ok = successfulIds.size;
            if (!failed.length) toast.success(`Deleted ${ok} file${ok !== 1 ? 's' : ''}`);
            else toast.error(`Deleted ${ok}, failed ${failed.length}`);
            setData((current) => current.filter((file) => !successfulIds.has(file.id)));
            setSelectedIds(new Set());
            setIsDeleteMode(false);
        } catch (e) {
            toast.error('Unexpected error during batch deletion');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleReprocess = async (file: FileRecord) => {
        await startFileReprocessingWithPolling({
            key: extractKey(file),
            fileType: file.type,
            setPollingFiles,
            setEmbeddingStatus,
            setLoadingMessage,
        });
    };

    const handleStatusRefresh = (file: FileRecord) => {
        startFileStatusPolling({
            key: extractKey(file),
            fileType: file.type,
            setPollingFiles,
            setEmbeddingStatus,
        });
    };

    // ── Upload ─────────────────────────────────────────────────────────────────

    const handleUploadChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || !files.length) return;
        setUploading(true);
        setLoadingMessage('Uploading file…');
        try {
            for (const file of Array.from(files)) {
                await handleFile(
                    file,
                    () => { /* onAttach — we'll refresh list */ },
                    () => {},
                    () => {},
                    () => {},
                    () => {},
                    featureFlags.uploadDocuments ?? false,
                    undefined,
                    false,
                    {},
                    []
                );
            }
            // Refresh after upload
            setRefreshKey((k) => k + 1);
        } finally {
            setUploading(false);
            setLoadingMessage('');
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // ── Search ─────────────────────────────────────────────────────────────────

    const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') setCommittedSearch(search);
        if (e.key === 'Escape') { setSearch(''); setCommittedSearch(''); }
    };

    // ── Select all ────────────────────────────────────────────────────────────

    const toggleSelectAll = () => {
        if (selectedIds.size === data.length) setSelectedIds(new Set());
        else setSelectedIds(new Set(data.map((f) => f.id)));
    };

    // ── Pagination ─────────────────────────────────────────────────────────────

    const loadNextPage = () => setPageIndex((i) => i + 1);
    const loadPrevPage = () => setPageIndex((i) => Math.max(0, i - 1));

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <div
            className="flex flex-col h-full w-full overflow-hidden"
            style={{ backgroundColor: 'var(--bg-app)', fontFamily: 'Inter, sans-serif' }}
        >
            {/* ── Top bar ───────────────────────────────────────────────────── */}
            <div
                className="flex-shrink-0 flex items-center justify-between px-6 border-b"
                style={{
                    backgroundColor: 'var(--bg-sidebar)',
                    borderColor: 'var(--border-subtle)',
                    height: 56,
                }}
            >
                {/* Left: close + title */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => dispatch({ field: 'page', value: 'chat' })}
                        className="flex items-center justify-center h-8 w-8 rounded-[8px] transition-colors flex-shrink-0"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)';
                            (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                        }}
                        onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                            (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
                        }}
                        title="Close"
                    >
                        <IconX size={16} />
                    </button>
                    <h1
                        className="text-[17px] font-semibold tracking-tight"
                        style={{ color: 'var(--text-primary)', fontFamily: '"Newsreader", "Georgia", serif' }}
                    >
                        Library
                    </h1>
                </div>

                {/* Right: search + actions */}
                <div className="flex items-center gap-2">
                    {/* Search */}
                    <div className="relative">
                        <IconSearch
                            size={14}
                            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                            style={{ color: 'var(--text-muted)' }}
                        />
                        <input
                            ref={searchRef}
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={handleSearchKeyDown}
                            placeholder="Search files… (Enter)"
                            className="h-[32px] pl-8 pr-3 rounded-[8px] text-[12px] border focus:outline-none w-[200px] transition-colors"
                            style={{
                                backgroundColor: 'var(--bg-raised)',
                                borderColor: 'var(--border-subtle)',
                                color: 'var(--text-primary)',
                            }}
                        />
                    </div>

                    {/* Refresh */}
                    <button
                        onClick={() => setRefreshKey((k) => k + 1)}
                        className="flex items-center justify-center h-[32px] w-[32px] rounded-[8px] transition-colors"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)';
                            (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                        }}
                        onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                            (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
                        }}
                        title="Refresh"
                    >
                        <IconRefresh size={15} />
                    </button>

                    {/* Delete mode toggle */}
                    <button
                        onClick={() => {
                            if (isDeleteMode) { setIsDeleteMode(false); setSelectedIds(new Set()); setShowDeleteConfirm(false); }
                            else setIsDeleteMode(true);
                        }}
                        className="flex items-center justify-center h-[32px] w-[32px] rounded-[8px] transition-colors"
                        style={{
                            color: isDeleteMode ? '#E05252' : 'var(--text-muted)',
                            backgroundColor: isDeleteMode ? 'rgba(224,82,82,0.1)' : 'transparent',
                        }}
                        onMouseEnter={(e) => {
                            if (!isDeleteMode) {
                                (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)';
                                (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (!isDeleteMode) {
                                (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                                (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
                            }
                        }}
                        title={isDeleteMode ? 'Cancel selection' : 'Select files to delete'}
                    >
                        <IconTrash size={15} />
                    </button>

                    {/* Upload */}
                    {featureFlags.uploadDocuments && (
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-1.5 h-[32px] px-3 rounded-[8px] text-[12px] font-medium text-white transition-opacity hover:opacity-90"
                            style={{ backgroundColor: 'var(--accent)' }}
                            disabled={uploading}
                        >
                            {uploading
                                ? <IconLoader2 size={13} className="animate-spin" />
                                : <IconCloudUpload size={13} />
                            }
                            Upload
                        </button>
                    )}
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handleUploadChange}
                    />
                </div>
            </div>

            {/* ── Batch-delete confirmation bar ─────────────────────────────── */}
            {isDeleteMode && (
                <div
                    className="flex-shrink-0 flex items-center gap-3 px-6 py-2 border-b text-[13px]"
                    style={{
                        backgroundColor: 'var(--bg-raised)',
                        borderColor: 'var(--border-subtle)',
                        color: 'var(--text-secondary)',
                    }}
                >
                    <button
                        onClick={toggleSelectAll}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-[6px] transition-colors"
                        style={{ color: 'var(--text-secondary)' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                    >
                        {selectedIds.size === data.length && data.length > 0 ? 'Deselect all' : 'Select all'}
                    </button>
                    <span style={{ color: 'var(--text-muted)' }}>{selectedIds.size} selected</span>
                    <button
                        onClick={() => setShowDeleteConfirm(true)}
                        disabled={selectedIds.size === 0}
                        className="flex items-center gap-1 px-3 py-1 rounded-[6px] text-white text-[12px] font-medium transition-opacity disabled:opacity-40"
                        style={{ backgroundColor: 'var(--accent)' }}
                    >
                        <IconTrash size={12} /> Delete {selectedIds.size > 0 ? selectedIds.size : ''} file(s)
                    </button>
                </div>
            )}

            {/* ── Column headers ────────────────────────────────────────────── */}
            <div
                className="flex-shrink-0 flex items-center gap-3 px-4 py-2 border-b"
                style={{ borderColor: 'var(--border-subtle)' }}
            >
                {isDeleteMode && <div className="w-5 flex-shrink-0" />}
                <div className="w-9 flex-shrink-0" />
                <div className="flex-1">
                    {sortableHeader('Name', 'name')}
                </div>
                <div className="hidden sm:block w-[80px] text-right flex-shrink-0">
                    {sortableHeader('Type', 'type')}
                </div>
                <div className="hidden md:block w-[90px] text-right flex-shrink-0">
                    {sortableHeader('Date', 'createdAt')}
                </div>
                <div className="w-[100px] text-right flex-shrink-0">
                    {sortableHeader('Status', 'status')}
                </div>
                {/* Actions spacer */}
                <div className="flex-shrink-0" style={{ width: SORT_ACTION_WIDTH }} />
            </div>

            {/* ── File list ─────────────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto py-1">
                {isLoading ? (
                    /* Skeleton rows */
                    <div className="flex flex-col gap-1 pt-2 px-2">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div
                                key={i}
                                className="flex items-center gap-3 px-4 py-2.5 rounded-[8px] animate-pulse"
                            >
                                <div
                                    className="w-9 h-9 rounded-[8px] flex-shrink-0"
                                    style={{ backgroundColor: 'var(--bg-raised)' }}
                                />
                                <div className="flex-1 flex flex-col gap-1.5">
                                    <div
                                        className="h-3 rounded w-1/3"
                                        style={{ backgroundColor: 'var(--bg-raised)' }}
                                    />
                                    <div
                                        className="h-2.5 rounded w-1/5"
                                        style={{ backgroundColor: 'var(--bg-raised)', opacity: 0.6 }}
                                    />
                                </div>
                                <div
                                    className="h-5 w-16 rounded-full hidden sm:block"
                                    style={{ backgroundColor: 'var(--bg-raised)' }}
                                />
                                <div
                                    className="h-5 w-16 rounded-full hidden md:block"
                                    style={{ backgroundColor: 'var(--bg-raised)' }}
                                />
                                <div
                                    className="h-5 w-20 rounded-full"
                                    style={{ backgroundColor: 'var(--bg-raised)' }}
                                />
                            </div>
                        ))}
                    </div>
                ) : isError ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <IconAlertCircle size={32} className="opacity-40" style={{ color: '#E05252' }} />
                        <p className="text-[14px]" style={{ color: 'var(--text-secondary)' }}>
                            Failed to load files
                        </p>
                        <button
                            onClick={() => setRefreshKey((k) => k + 1)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[13px] transition-colors"
                            style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-secondary)' }}
                        >
                            <IconRefresh size={13} /> Try again
                        </button>
                    </div>
                ) : data.length === 0 ? (
                    <EmptyState
                        message={committedSearch ? 'No files match your search' : 'No files uploaded yet'}
                        subMessage={!committedSearch ? 'Upload a file to get started' : undefined}
                        onUpload={!committedSearch && featureFlags.uploadDocuments ? () => fileInputRef.current?.click() : undefined}
                    />
                ) : (
                    <>
                        {sortedData.map((file) => (
                            <FileRow
                                key={file.id}
                                file={file}
                                embeddingStatus={embeddingStatus}
                                fetchedKeys={fetchedStatusKeys.current}
                                pollingFiles={pollingFiles}
                                isDeleteMode={isDeleteMode}
                                isSelected={selectedIds.has(file.id)}
                                onToggleSelect={() => {
                                    const n = new Set(selectedIds);
                                    n.has(file.id) ? n.delete(file.id) : n.add(file.id);
                                    setSelectedIds(n);
                                }}
                                onDownload={() => handleDownload(file)}
                                onDelete={() => handleDelete(file)}
                                onReprocess={() => handleReprocess(file)}
                                onStatusRefresh={() => handleStatusRefresh(file)}
                                onAttachToConversation={() => handleAttachToConversation(file)}
                            imagePreviewUrl={imagePreviewUrls[file.id]}
                            imagePreviewLoading={file.type.startsWith('image/') && imagePreviewLoading[file.id]}
                            onPreview={(originRect) => handlePreview(file, originRect)}
                            />
                        ))}

                        {/* Load-more / pagination */}
                        <div className="flex items-center justify-center gap-3 py-4 mt-2">
                            {pageIndex > 0 && (
                                <button
                                    onClick={loadPrevPage}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-[8px] text-[12px] transition-colors"
                                    style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-secondary)' }}
                                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)'; }}
                                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-raised)'; }}
                                >
                                    ← Previous
                                </button>
                            )}
                            {isRefetching && (
                                <IconLoader2 size={16} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
                            )}
                            {hasMore && !isRefetching && (
                                <button
                                    onClick={loadNextPage}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-[8px] text-[12px] transition-colors"
                                    style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-secondary)' }}
                                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)'; }}
                                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-raised)'; }}
                                >
                                    Next →
                                </button>
                            )}
                            {!hasMore && !isRefetching && data.length > 0 && (
                                <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                                    {data.length} file{data.length !== 1 ? 's' : ''}
                                    {pageIndex > 0 ? ` on page ${pageIndex + 1}` : ''}
                                </span>
                            )}
                        </div>
                    </>
                )}
            </div>
            {previewAttachment && (
                <AttachmentPreview
                    attachments={[previewAttachment]}
                    initialIndex={0}
                    originRect={previewOriginRect}
                    onClose={() => { setPreviewAttachment(null); setPreviewOriginRect(undefined); }}
                />
            )}
            <ConfirmDialog
                isOpen={!!deleteTarget}
                title="Delete file?"
                message={<>Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.</>}
                onConfirm={confirmDelete}
                onCancel={() => setDeleteTarget(null)}
            />
            <ConfirmDialog
                isOpen={showDeleteConfirm}
                title="Delete files?"
                message={`Are you sure you want to delete ${selectedIds.size} file(s)? This cannot be undone.`}
                onConfirm={handleBatchDelete}
                onCancel={() => setShowDeleteConfirm(false)}
            />
            <NewUILoadingStatus
                open={isDeleting}
                message={deletingCount > 1 ? `Deleting ${deletingCount} file${deletingCount !== 1 ? 's' : ''}…` : 'Deleting file…'}
            />
        </div>
    );
};

export default NewLibraryView;
