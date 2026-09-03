/**
 * Shared query vocabulary for the user's document library.
 *
 * Both the full-pane Library (views/NewLibraryView.tsx) and the assistant
 * editor's library picker (shared/DataSourceLibraryPicker.tsx) list the same
 * records through the same service, so the cursor-sanitising and query-building
 * rules live here once. No React imports.
 */

import { FileQuery, FileRecord, PageKey } from '@/services/fileService';
import { mimeTypeToCommonName } from '@/utils/app/fileTypeTranslations';

/** The index the library lists against: newest first. */
export const LIBRARY_SORT_INDEX = 'createdAt';

/**
 * The library never shows assistant-internal records. Applied both as a server
 * filter and (defensively) as a client filter, because the service does not
 * guarantee the filter is honoured for every record shape.
 */
export const LIBRARY_EXCLUDE_ASSISTANT_FILTER = {
    attribute: 'data.type',
    operator: 'not_startsWith',
    value: 'assistant',
} as const;

/**
 * Strip a pagination cursor down to the attributes DynamoDB accepts as an
 * ExclusiveStartKey for the index this query runs against.
 *
 * The files API synthesises the cursor itself whenever a query carries filters
 * (the library always filters assistant records out), and that synthesised
 * cursor carries extra attributes — notably `type`, sometimes null. DynamoDB
 * rejects a start key containing attributes outside the table/index key
 * schema, which surfaces to the client as a 502. Sending only
 * `{id, createdBy, <sort key>}` keeps every page request valid.
 */
export function sanitizePageKey(
    pageKey: PageKey | null | undefined,
    sortIndex: string = LIBRARY_SORT_INDEX,
): PageKey | null {
    if (!pageKey) return null;
    const source = pageKey as unknown as Record<string, unknown>;
    // Table primary key (id) + index partition key (createdBy) + index sort key.
    const allowed = Array.from(new Set(['id', 'createdBy', sortIndex || LIBRARY_SORT_INDEX]));
    const cleaned: Record<string, unknown> = {};
    for (const attr of allowed) {
        const value = source[attr];
        if (typeof value === 'string' && value.length > 0) cleaned[attr] = value;
    }
    // DynamoDB requires the complete key: every allowed attribute must be present,
    // otherwise the cursor is unusable and the query should start from the top.
    if (allowed.some((attr) => !cleaned[attr])) return null;
    return cleaned as unknown as PageKey;
}

/**
 * Build a library page query.
 *
 * `search` is a **name prefix**, not a substring — that is all the files service
 * supports (FileQuery.namePrefix), so callers should label their search input
 * accordingly rather than implying full-text search.
 */
export function buildLibraryQuery(opts: {
    pageSize: number;
    search?: string;
    pageKey?: PageKey | null;
}): FileQuery {
    const query: FileQuery = {
        pageSize: opts.pageSize,
        sortIndex: LIBRARY_SORT_INDEX,
        forwardScan: false, // newest first
        filters: [{ ...LIBRARY_EXCLUDE_ASSISTANT_FILTER }],
    };
    const pageKey = sanitizePageKey(opts.pageKey, LIBRARY_SORT_INDEX);
    if (pageKey) query.pageKey = pageKey;
    const search = opts.search?.trim();
    if (search) query.namePrefix = search;
    return query;
}

/** True for records the library must never show (assistant-internal files). */
export function isAssistantRecord(file: FileRecord): boolean {
    return Boolean(file?.data?.type && String(file.data.type).startsWith('assistant'));
}

/** Human-readable type label for a library record ("PDF", "Word Document", …). */
export function libraryTypeLabel(file: FileRecord): string {
    return mimeTypeToCommonName[file.type] || (file.type ? file.type.slice(0, 15) : 'Unknown');
}
