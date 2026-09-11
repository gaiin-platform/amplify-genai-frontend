/**
 * driveBrowserModel — the vocabulary of the OneDrive / SharePoint picker.
 *
 * React-free on purpose: the selection algebra is the only part of the picker
 * with a real contract (what ends up in `data.integrationDriveData`), so it
 * lives apart from the pixels and can be reasoned about — and tested — alone.
 *
 * Everything here is a port of behaviour that used to live inside two old-UI
 * components, kept faithful so a definition saved by the new picker is
 * indistinguishable from one saved by the old editor:
 *
 *   components/Promptbar/components/AssistantModalComponents/
 *     AssistantDriveDataSources.tsx     — selection maps, ancestor rule
 *   components/DataSources/
 *     DataSourcesTableScrollingIntegrations.tsx — record normalization, ordering
 *
 * Both are off-limits (NEW_UI_GUIDE §2) and stay in use elsewhere; nothing here
 * modifies them.
 */

import {
    DriveFileMetadata,
    DriveFilesDataSources,
    IntegrationDriveData,
    IntegrationFileRecord,
} from '@/types/integrations';
import {
    getExtensionFromFilename,
    getFileTypeFromExtension,
    getFirstMimeTypeFromCommonName,
    mimeTypeToCommonName,
} from '@/utils/app/fileTypeTranslations';
import { capitalize } from '@/utils/app/data';
// React-free, like everything else imported here (see the header note).
import { formatBytes } from '@/components/NewUI/shared/attachmentTypes';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The honest runtime shape of a drive selection.
 *
 * `types/integrations#DriveFilesDataSources` keys the map by provider
 * (`'google' | 'microsoft'`), but every key the app actually writes is an
 * *integration* id — `google_drive`, `microsoft_drive`, `microsoft_sharepoint`.
 * `types/` is read-only reference (NEW_UI_GUIDE §2), which is why the old code
 * sprays `as keyof DriveFilesDataSources` casts. We work in the honest type and
 * cast exactly once at each props boundary, via the two helpers below.
 */
export type DriveSelection = Record<string, IntegrationDriveData>;

export const asDriveSelection = (value: DriveFilesDataSources | undefined): DriveSelection =>
    (value ?? {}) as DriveSelection;

export const asDriveDataSources = (value: DriveSelection): DriveFilesDataSources =>
    value as DriveFilesDataSources;

export type DriveSortDirection = 'asc' | 'desc';

// ─────────────────────────────────────────────────────────────────────────────
// Record normalization
// ─────────────────────────────────────────────────────────────────────────────

/** Port of DataSourcesTableScrollingIntegrations#getTypeFromCommonName. */
const displayTypeFromRaw = (rawMimeType: string, filename: string, integrationId: string): string => {
    switch (rawMimeType) {
        case 'folder':
            return `${capitalize(integrationId.split('_')[0])} Drive Folder`;
        case 'file': {
            const extension = getExtensionFromFilename(filename);
            return extension ? getFileTypeFromExtension(extension) : 'text/plain';
        }
        default:
            return rawMimeType in mimeTypeToCommonName
                ? mimeTypeToCommonName[rawMimeType]
                : rawMimeType;
    }
};

/** Port of DataSourcesTableScrollingIntegrations#getExtendedTypeFromMimeType. */
const storedTypeFromRaw = (rawMimeType: string, filename: string): string => {
    if (rawMimeType !== 'file') return rawMimeType;
    const extension = getExtensionFromFilename(filename);
    if (!extension) return 'text/plain';
    const displayName = getFileTypeFromExtension(extension);
    const resolved =
        getFirstMimeTypeFromCommonName(displayName) ??
        getFirstMimeTypeFromCommonName(displayName.split(' ')[0]);
    return resolved ?? 'text/plain';
};

/**
 * Turn a raw listing record into the shape the rest of the picker speaks.
 *
 * `mimeType` becomes a human label ("SharePoint Site", "Google Drive Folder")
 * and `type` becomes the real MIME type that gets persisted.
 *
 * Both are derived from the *raw* mimeType in one step. Deriving `type` from the
 * already-rewritten `mimeType` silently breaks every generic `'file'` record,
 * because `storedTypeFromRaw` only remaps when its input is literally `'file'`.
 */
export const normalizeDriveRecord = (
    raw: IntegrationFileRecord,
    integrationId: string,
): IntegrationFileRecord => ({
    ...raw,
    mimeType: displayTypeFromRaw(raw.mimeType, raw.name, integrationId),
    type: storedTypeFromRaw(raw.mimeType, raw.name),
});

/**
 * Is this row something you navigate into rather than attach?
 *
 * Must only ever run on a *normalized* record. The raw payload says
 * `sharepoint.site` / `sharepoint.library` / `inode/directory`, none of which
 * match this pattern — and a SharePoint root listing is nothing but sites and
 * libraries, so testing the raw value makes SharePoint unnavigable.
 */
export const isContainer = (record: IntegrationFileRecord): boolean =>
    /folder|directory|site|library/i.test(record.mimeType);

/** Level 4 files are access-restricted: no checkbox, no navigation, no attach. */
export const isBlockedBySensitivity = (record: IntegrationFileRecord): boolean =>
    !isContainer(record) && record.sensitivity === 4;

/**
 * Size worth rendering, or null.
 *
 * `types/integrations#IntegrationFileRecord` declares `size: string`, but that
 * type is wrong and `types/` is read-only (NEW_UI_GUIDE §2), so the coercion has
 * to happen here. Three shapes actually arrive:
 *
 *   - a JSON **number of bytes**, from Microsoft Graph (`item.get("size", 0)` in
 *     o365/sharepoint.py) — defaulted to the number `0` for sites and folders
 *   - the literal string `"N/A"`, from the Google/generic path (drive_files.py)
 *   - a numeric **string**, from the Google Drive metadata path
 *
 * Hence `unknown` rather than `string`: calling a string method on the Graph
 * number is what crashed this panel. Bytes are formatted rather than printed raw
 * — the old table rendered `size` straight into a `<span>`, so it showed
 * SharePoint byte counts like "1048576". `size` is display-only and never
 * persisted into `integrationDriveData`, so formatting changes no contract.
 *
 * Anything absent, zero, or sentinel returns null: an empty cell reads better
 * than "N/A" repeated down a whole column.
 */
export const displaySize = (size?: unknown): string | null => {
    if (typeof size === 'number') {
        return Number.isFinite(size) && size > 0 ? formatBytes(size) : null;
    }
    if (typeof size !== 'string') return null;

    const trimmed = size.trim();
    if (!trimmed) return null;
    if (/^(n\/?a|unknown|null|undefined|0)$/i.test(trimmed)) return null;
    if (/^\d+$/.test(trimmed)) {
        const bytes = Number(trimmed);
        return bytes > 0 ? formatBytes(bytes) : null;
    }
    return trimmed;
};

/**
 * Drop files whose extension is on the disallowed list. Folders always survive.
 *
 * DELIBERATE FIX, not a straight port: the old filter compared
 * `getExtensionFromFilename()` (which returns ".mp3", with the dot) against
 * `COMMON_DISALLOWED_FILE_EXTENSIONS` (which stores "mp3", without it), so it
 * matched nothing except the list's two accidentally-dotted entries. Both sides
 * are normalized here, which means media/archive files really are hidden now.
 */
export const filterDisallowed = (
    records: IntegrationFileRecord[],
    disallowed?: string[],
): IntegrationFileRecord[] => {
    if (!disallowed || disallowed.length === 0) return records;
    const blocked = new Set(disallowed.map((ext) => ext.replace(/^\./, '').toLowerCase()));
    return records.filter((record) => {
        if (isContainer(record)) return true;
        const extension = getExtensionFromFilename(record.name).replace(/^\./, '').toLowerCase();
        return extension ? !blocked.has(extension) : true;
    });
};

// ─────────────────────────────────────────────────────────────────────────────
// Ordering, search
// ─────────────────────────────────────────────────────────────────────────────

const byName = (a: IntegrationFileRecord, b: IntegrationFileRecord) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });

/**
 * Containers first, then name — the order every fetch used to apply, and the
 * order both sort directions preserve. Folders sinking below files on a reverse
 * sort would make the list harder to navigate, not more sorted.
 */
export const sortRecords = (
    records: IntegrationFileRecord[],
    direction: DriveSortDirection,
): IntegrationFileRecord[] =>
    [...records].sort((a, b) => {
        const aContainer = isContainer(a);
        const bContainer = isContainer(b);
        if (aContainer !== bContainer) return aContainer ? -1 : 1;
        return direction === 'asc' ? byName(a, b) : -byName(a, b);
    });

/** One query across name and type label — the two things the columns used to filter. */
export const matchesQuery = (record: IntegrationFileRecord, query: string): boolean => {
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return (
        record.name.toLowerCase().includes(needle) ||
        record.mimeType.toLowerCase().includes(needle)
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Selection reads
// ─────────────────────────────────────────────────────────────────────────────

const entryFor = (selection: DriveSelection, integration: string): IntegrationDriveData => {
    const entry = selection[integration];
    return { folders: entry?.folders ?? {}, files: entry?.files ?? {} };
};

/**
 * The id of the folder in the *current breadcrumb* that is selected, if any.
 *
 * `folderPath` is the trail of folders being viewed, including the current one
 * — not the path of any particular row. So this answers "is everything on
 * screen already covered by a folder selection?", which is exactly the question
 * the old component asked (getSelectedParentFolder). At root the path is empty,
 * so nothing is ever covered at root.
 */
export const selectedAncestorId = (
    selection: DriveSelection,
    integration: string,
    folderPath: string[],
): string | undefined => {
    const { folders } = entryFor(selection, integration);
    return folderPath.find((folderId) => folderId in folders);
};

/** Directly ticked by the user (as opposed to covered by an ancestor). */
export const isDirectlySelected = (
    selection: DriveSelection,
    integration: string,
    record: IntegrationFileRecord,
): boolean => {
    const { folders, files } = entryFor(selection, integration);
    return isContainer(record) ? record.id in folders : record.id in files;
};

/** Covered by a selected ancestor folder → shown ticked, but not untickable. */
export const isRowAutoSelected = (
    selection: DriveSelection,
    integration: string,
    folderPath: string[],
    record: IntegrationFileRecord,
): boolean => {
    if (isDirectlySelected(selection, integration, record)) return false;
    return Boolean(selectedAncestorId(selection, integration, folderPath));
};

export const isRowSelected = (
    selection: DriveSelection,
    integration: string,
    folderPath: string[],
    record: IntegrationFileRecord,
): boolean =>
    isDirectlySelected(selection, integration, record) ||
    isRowAutoSelected(selection, integration, folderPath, record);

export const selectionCounts = (
    selection: DriveSelection,
    integration: string,
): { folderCount: number; fileCount: number; total: number } => {
    const { folders, files } = entryFor(selection, integration);
    const folderCount = Object.keys(folders).length;
    const fileCount = Object.keys(files).length;
    return { folderCount, fileCount, total: folderCount + fileCount };
};

export const totalSelectionCount = (selection: DriveSelection): number =>
    Object.keys(selection).reduce((sum, integration) => sum + selectionCounts(selection, integration).total, 0);

export const hasAnySelection = (selection: DriveSelection): boolean =>
    totalSelectionCount(selection) > 0;

// ─────────────────────────────────────────────────────────────────────────────
// Selection writes
// ─────────────────────────────────────────────────────────────────────────────

/** Deep copy, exactly as AssistantDriveDataSources did before every mutation. */
const cloneSelection = (selection: DriveSelection): DriveSelection => {
    const copy: DriveSelection = {};
    Object.keys(selection).forEach((key) => {
        const entry = selection[key];
        if (!entry) return;
        copy[key] = { folders: { ...(entry.folders ?? {}) }, files: { ...(entry.files ?? {}) } };
    });
    return copy;
};

export interface ApplySelectionInput {
    integration: string;
    /** Rows to tick. */
    add?: IntegrationFileRecord[];
    /** Rows to untick. */
    remove?: IntegrationFileRecord[];
    /** Breadcrumb of the folder being viewed, including it. */
    folderPath?: string[];
    /**
     * The selection as it was when the assistant was loaded. Re-ticking a row
     * that was already saved restores its captured file list / datasource
     * pointers instead of blanking them, so an edit doesn't orphan S3 objects.
     */
    initSelection?: DriveSelection;
}

export interface ApplySelectionResult {
    selection: DriveSelection;
    /** Files skipped because a selected ancestor folder already includes them. */
    coveredByAncestor: IntegrationFileRecord[];
    /** Name of that ancestor folder, when one caused a skip. */
    ancestorFolderId?: string;
}

/**
 * The single selection mutator.
 *
 * One call per user action, however many rows it touches. The old code had a
 * per-row path that re-derived state from the `selectedDataSources` *prop* on
 * every iteration, so a loop of N rows wrote the same stale object N times and
 * kept only the last — which is why a separate batch handler had to exist. A
 * lone mutator that takes a list removes the whole failure mode.
 *
 * Note what it deliberately does NOT do: it never prunes an individually
 * selected file when its parent folder later gets selected. The old editor's
 * `cleanupRemovedDatasources` tolerates a file living in both maps and uses it
 * to decide what to delete on save; pruning here would change which
 * datasources get destroyed.
 */
export const applySelection = (
    selection: DriveSelection,
    { integration, add = [], remove = [], folderPath = [], initSelection }: ApplySelectionInput,
): ApplySelectionResult => {
    const next = cloneSelection(selection);
    if (!next[integration]) next[integration] = { folders: {}, files: {} };
    const entry = next[integration];

    const initFolders = initSelection?.[integration]?.folders ?? {};
    const initFiles = initSelection?.[integration]?.files ?? {};

    // Resolved against the incoming selection, so a folder ticked in this same
    // call doesn't retroactively reject its siblings.
    const ancestorFolderId = selectedAncestorId(selection, integration, folderPath);
    const coveredByAncestor: IntegrationFileRecord[] = [];

    remove.forEach((record) => {
        if (isContainer(record)) delete entry.folders[record.id];
        else delete entry.files[record.id];
    });

    add.forEach((record) => {
        if (isContainer(record)) {
            entry.folders[record.id] = initFolders[record.id] ?? {};
            return;
        }
        if (ancestorFolderId) {
            coveredByAncestor.push(record);
            return;
        }
        const initFile: DriveFileMetadata | undefined = initFiles[record.id];
        entry.files[record.id] = initFile ?? { type: record.type ?? record.mimeType };
    });

    return { selection: next, coveredByAncestor, ancestorFolderId };
};

/**
 * Forget everything picked from one integration.
 *
 * Deletes the key rather than emptying it: `cleanupRemovedDatasources` detects a
 * cleared integration by its absence, and an entry of two empty maps reads as
 * "still attached, nothing in it".
 */
export const clearIntegration = (selection: DriveSelection, integration: string): DriveSelection => {
    const next = cloneSelection(selection);
    delete next[integration];
    return next;
};
