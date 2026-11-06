/**
 * driveRecapModel — what an assistant's OneDrive / SharePoint / Google Drive picks
 * look like once they are attached: provider → folders → files, with a state per file.
 * No React imports.
 *
 * The classic editor showed this under "Attach Drive Data Sources" ("SharePoint: 1
 * Folder", expandable to the files and their embedding status). The new editor only
 * showed "N selected" inside the picker panel and nothing once it was closed, so after a
 * save there was no way to tell which picks actually made it in.
 *
 * Where the facts come from. `data.integrationDriveData` holds, per integration,
 * `folders[folderId][fileId]` and `files[fileId]`. A file the server processed carries a
 * `datasource` (the stored copy, which is what has an embedding status). So, comparing the
 * current selection with the one the assistant was loaded with:
 *
 *   datasource present                          → processed
 *   no datasource, but it was in the loaded data → blocked: saved before, never produced a
 *                                                  copy (sensitivity block / failure)
 *   no datasource, not in the loaded data        → pending: picked this session, handled on save
 */

import type { AttachedDocument } from '@/types/attacheddocument';
import type { IntegrationDriveData } from '@/types/integrations';
import { EmbeddingBadge, embeddingBadge, isFailedStatus } from './dataSourceGroupingModel';

export type DriveFileState = 'processed' | 'blocked' | 'pending';

export interface DriveRecapFile {
    id: string;
    name: string;
    state: DriveFileState;
    /** The stored copy; only for a processed file. This is what has an embedding status. */
    datasource?: AttachedDocument;
}

export interface DriveRecapFolder {
    id: string;
    name: string;
    files: DriveRecapFile[];
    /** Picked this session: the server has not listed its files yet. */
    unlisted: boolean;
}

export interface DriveRecapProvider {
    /** Integration id, e.g. `microsoft_sharepoint`. */
    integration: string;
    folders: DriveRecapFolder[];
    /** Files picked one by one (not through a folder). */
    files: DriveRecapFile[];
}

type Selection = Record<string, IntegrationDriveData | undefined>;

/** The last `:`-separated segment of a drive id — the readable part ("…:General/ReadMes" → "General/ReadMes"). */
const lastSegment = (id: string, fallback: string): string => id.split(':').pop() || fallback;

const stateOf = (datasource: AttachedDocument | undefined, wasSaved: boolean): DriveFileState =>
    datasource ? 'processed' : wasSaved ? 'blocked' : 'pending';

/**
 * Build the recap from the live selection and the one the assistant was loaded with.
 * Providers with nothing picked are left out. Order follows the selection.
 */
export function buildDriveRecap(selection: Selection | undefined, loaded: Selection | undefined): DriveRecapProvider[] {
    const out: DriveRecapProvider[] = [];

    Object.keys(selection ?? {}).forEach((integration) => {
        const data = selection?.[integration];
        if (!data || typeof data !== 'object') return;
        const savedData = loaded?.[integration];

        const folders: DriveRecapFolder[] = Object.keys(data.folders ?? {}).map((folderId) => {
            const entries = data.folders[folderId] ?? {};
            const savedFolder = savedData?.folders?.[folderId];
            return {
                id: folderId,
                name: lastSegment(folderId, 'Unknown folder'),
                unlisted: !savedFolder && Object.keys(entries).length === 0,
                files: Object.keys(entries).map((fileId) => {
                    const datasource = entries[fileId]?.datasource;
                    return {
                        id: fileId,
                        name: datasource?.name || lastSegment(fileId, 'Unknown file'),
                        state: stateOf(datasource, !!savedFolder?.[fileId]),
                        ...(datasource ? { datasource } : {}),
                    };
                }),
            };
        });

        const files: DriveRecapFile[] = Object.keys(data.files ?? {}).map((fileId) => {
            const datasource = data.files[fileId]?.datasource;
            return {
                id: fileId,
                name: datasource?.name || lastSegment(fileId, 'Unknown file'),
                state: stateOf(datasource, !!savedData?.files?.[fileId]),
                ...(datasource ? { datasource } : {}),
            };
        });

        if (folders.length > 0 || files.length > 0) out.push({ integration, folders, files });
    });

    return out;
}

/** Every file in a provider, folder contents first — what a count or a status roll-up walks. */
export const allDriveFiles = (provider: DriveRecapProvider): DriveRecapFile[] => [
    ...provider.folders.flatMap((folder) => folder.files),
    ...provider.files,
];

/** Stored copies of every processed file in the recap — the sources whose embedding status to look up. */
export const driveDatasources = (recap: DriveRecapProvider[]): AttachedDocument[] =>
    recap.flatMap((provider) => allDriveFiles(provider).flatMap((file) => (file.datasource ? [file.datasource] : [])));

/** "1 folder, 3 files" — what the collapsed header says. */
export function describeDriveCounts(provider: DriveRecapProvider): string {
    const folders = provider.folders.length;
    const files = provider.files.length;
    const parts: string[] = [];
    if (folders > 0) parts.push(`${folders} ${folders === 1 ? 'folder' : 'folders'}`);
    if (files > 0) parts.push(`${files} ${files === 1 ? 'file' : 'files'}`);
    return parts.join(', ');
}

/**
 * Keep only the files `keep` accepts (and the folders / providers that still have any).
 * Used for the "show only problems" view, so a hundred healthy files do not bury two bad ones.
 */
export function filterDriveRecap(recap: DriveRecapProvider[], keep: (file: DriveRecapFile) => boolean): DriveRecapProvider[] {
    return recap.flatMap((provider): DriveRecapProvider[] => {
        const folders = provider.folders
            .map((folder) => ({ ...folder, files: folder.files.filter(keep) }))
            .filter((folder) => folder.files.length > 0);
        const files = provider.files.filter(keep);
        return folders.length > 0 || files.length > 0 ? [{ ...provider, folders, files }] : [];
    });
}

/**
 * One line of news for a provider's header, worst first:
 *   problems (blocked or failed)  →  still working  →  waiting for a save  →  all completed.
 * Null when nothing is known yet (statuses still loading), so the header says only what is true.
 */
export function summarizeDriveProvider(
    provider: DriveRecapProvider,
    statusOf: (file: DriveRecapFile) => string | undefined,
): EmbeddingBadge | null {
    const files = allDriveFiles(provider);
    const blocked = files.filter((file) => file.state === 'blocked').length;
    const failed = files.filter((file) => file.state === 'processed' && isFailedStatus(statusOf(file))).length;
    const problems = blocked + failed;
    if (problems > 0) {
        return {
            label: `${problems} need${problems === 1 ? 's' : ''} attention`,
            tone: 'error',
            busy: false,
            title: `${blocked} could not be processed, ${failed} failed embedding`,
        };
    }

    const processed = files.filter((file) => file.state === 'processed');
    const statuses = processed.map(statusOf);
    if (statuses.some((status) => status === 'processing' || status === 'starting')) {
        return { label: 'Processing', tone: 'warning', busy: true, title: 'Embedding status: some files are still processing' };
    }

    const waiting = provider.folders.some((folder) => folder.unlisted) || files.some((file) => file.state === 'pending');
    if (waiting) {
        return { label: 'Processed when you save', tone: 'neutral', busy: false, title: 'These picks have not been saved yet' };
    }

    if (processed.length > 0 && statuses.every((status) => !!embeddingBadge(status) && status === 'completed')) {
        return { label: 'Completed', tone: 'success', busy: false, title: 'Embedding status: all files completed' };
    }
    return null;
}
