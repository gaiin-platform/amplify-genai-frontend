import { describe, it, expect } from 'vitest';
import {
    applySelection,
    clearIntegration,
    displaySize,
    filterDisallowed,
    isContainer,
    isRowAutoSelected,
    isRowSelected,
    normalizeDriveRecord,
    selectionCounts,
    sortRecords,
    DriveSelection,
} from '@/components/NewUI/views/assistant/driveBrowserModel';
import { IntegrationFileRecord } from '@/types/integrations';

const INT = 'microsoft_sharepoint';

const raw = (over: Partial<IntegrationFileRecord>): IntegrationFileRecord => ({
    id: 'id', name: 'n', mimeType: 'file', size: 'N/A', ...over,
});

describe('normalization', () => {
    it('turns sharepoint site into a navigable container', () => {
        const r = normalizeDriveRecord(raw({ id: 's1', name: 'Amplify', mimeType: 'sharepoint.site' }), INT);
        expect(r.mimeType).toBe('SharePoint Site');
        expect(isContainer(r)).toBe(true);
    });
    it('derives both fields from the raw mimeType', () => {
        const r = normalizeDriveRecord(raw({ id: 'f1', name: 'notes.pdf', mimeType: 'file' }), INT);
        expect(r.mimeType).toBe('PDF Document');
        expect(r.type).toBe('application/pdf');
        expect(isContainer(r)).toBe(false);
    });
    it('labels folders per provider', () => {
        const r = normalizeDriveRecord(raw({ id: 'd1', name: 'Docs', mimeType: 'folder' }), 'google_drive');
        expect(r.mimeType).toBe('Google Drive Folder');
        expect(isContainer(r)).toBe(true);
    });
});

describe('display helpers', () => {
    it('never surfaces N/A', () => {
        expect(displaySize('N/A')).toBeNull();
        expect(displaySize('')).toBeNull();
        expect(displaySize('12 KB')).toBe('12 KB');
    });
    /**
     * Microsoft Graph sends `size` as a number of bytes, not the string the
     * `IntegrationFileRecord` type promises. Passing one used to throw
     * "(intermediate value).trim is not a function" and take down the panel, and
     * the fixture above could not catch it — `size` is typed `string`, so only a
     * deliberate cast reaches the real payload shape.
     */
    it('formats a Graph byte count and suppresses its zero default', () => {
        expect(displaySize(1_048_576 as unknown as string)).toBe('1.00 MB');
        expect(displaySize(2_048 as unknown as string)).toBe('2.0 KB');
        expect(displaySize(512 as unknown as string)).toBe('512 B');
        // Graph defaults sites and folders to 0 — an empty cell, not "0 B".
        expect(displaySize(0 as unknown as string)).toBeNull();
        expect(displaySize(undefined)).toBeNull();
        expect(displaySize(null as unknown as string)).toBeNull();
    });
    it('formats a numeric string the same way as a number', () => {
        // The Google Drive metadata path stringifies the same byte count.
        expect(displaySize('1048576')).toBe('1.00 MB');
        expect(displaySize('0')).toBeNull();
    });
    it('filters disallowed extensions regardless of dots', () => {
        const files = [
            normalizeDriveRecord(raw({ id: 'a', name: 'song.mp3' }), INT),
            normalizeDriveRecord(raw({ id: 'b', name: 'ok.pdf' }), INT),
            normalizeDriveRecord(raw({ id: 'c', name: 'Docs', mimeType: 'folder' }), INT),
        ];
        const kept = filterDisallowed(files, ['mp3', '.stl']);
        expect(kept.map((f) => f.id)).toEqual(['b', 'c']);
    });
    it('pins containers first in both directions', () => {
        const items = [
            normalizeDriveRecord(raw({ id: 'z', name: 'zeta.pdf' }), INT),
            normalizeDriveRecord(raw({ id: 'd', name: 'Docs', mimeType: 'folder' }), INT),
            normalizeDriveRecord(raw({ id: 'a', name: 'alpha.pdf' }), INT),
        ];
        expect(sortRecords(items, 'asc').map((r) => r.id)).toEqual(['d', 'a', 'z']);
        expect(sortRecords(items, 'desc').map((r) => r.id)).toEqual(['d', 'z', 'a']);
    });
});

describe('selection algebra — the four cases', () => {
    const file = normalizeDriveRecord(raw({ id: 'f1', name: 'a.pdf' }), INT);
    const folder = normalizeDriveRecord(raw({ id: 'd1', name: 'Docs', mimeType: 'folder' }), INT);
    const child = normalizeDriveRecord(raw({ id: 'f2', name: 'b.pdf' }), INT);
    const childFolder = normalizeDriveRecord(raw({ id: 'd2', name: 'Sub', mimeType: 'folder' }), INT);

    it('1. file at root lands in files with its real MIME type', () => {
        const { selection } = applySelection({}, { integration: INT, add: [file], folderPath: [] });
        expect(selection[INT].files).toEqual({ f1: { type: 'application/pdf' } });
        expect(isRowSelected(selection, INT, [], file)).toBe(true);
        expect(isRowAutoSelected(selection, INT, [], file)).toBe(false);
    });

    it('2. folder at root lands in folders with an empty map', () => {
        const { selection } = applySelection({}, { integration: INT, add: [folder], folderPath: [] });
        expect(selection[INT].folders).toEqual({ d1: {} });
        expect(selectionCounts(selection, INT)).toEqual({ folderCount: 1, fileCount: 0, total: 1 });
    });

    it('3. a file inside a selected folder is refused and reads as auto-selected', () => {
        const base = applySelection({}, { integration: INT, add: [folder], folderPath: [] }).selection;
        const result = applySelection(base, { integration: INT, add: [child], folderPath: ['d1'] });
        expect(result.coveredByAncestor.map((r) => r.id)).toEqual(['f2']);
        expect(result.selection[INT].files).toEqual({});
        expect(isRowSelected(base, INT, ['d1'], child)).toBe(true);
        expect(isRowAutoSelected(base, INT, ['d1'], child)).toBe(true);
    });

    it('4. a folder inside a selected folder still reads as auto-selected', () => {
        const base = applySelection({}, { integration: INT, add: [folder], folderPath: [] }).selection;
        expect(isRowAutoSelected(base, INT, ['d1'], childFolder)).toBe(true);
        // and nothing is auto-selected at root
        expect(isRowAutoSelected(base, INT, [], file)).toBe(false);
    });

    it('batches many rows in one mutation', () => {
        const many = ['a', 'b', 'c'].map((id) => normalizeDriveRecord(raw({ id, name: `${id}.pdf` }), INT));
        const { selection } = applySelection({}, { integration: INT, add: many, folderPath: [] });
        expect(Object.keys(selection[INT].files)).toEqual(['a', 'b', 'c']);
    });

    it('restores saved metadata when a row is re-ticked', () => {
        const initSelection: DriveSelection = {
            [INT]: { folders: { d1: { f9: { type: 'application/pdf' } } }, files: {} },
        };
        const { selection } = applySelection({}, { integration: INT, add: [folder], folderPath: [], initSelection });
        expect(selection[INT].folders.d1).toEqual({ f9: { type: 'application/pdf' } });
    });

    it('keeps an individually selected file when its parent folder is later selected', () => {
        const withFile = applySelection({}, { integration: INT, add: [child], folderPath: [] }).selection;
        const withBoth = applySelection(withFile, { integration: INT, add: [folder], folderPath: [] }).selection;
        expect(Object.keys(withBoth[INT].files)).toEqual(['f2']);
        expect(Object.keys(withBoth[INT].folders)).toEqual(['d1']);
    });

    it('does not mutate the input selection', () => {
        const base = applySelection({}, { integration: INT, add: [file], folderPath: [] }).selection;
        const next = applySelection(base, { integration: INT, add: [folder], folderPath: [] }).selection;
        expect(Object.keys(base[INT].folders)).toEqual([]);
        expect(Object.keys(next[INT].folders)).toEqual(['d1']);
    });

    it('clear deletes the integration key rather than emptying it', () => {
        const base = applySelection({}, { integration: INT, add: [file], folderPath: [] }).selection;
        expect(INT in clearIntegration(base, INT)).toBe(false);
    });

    it('remove unticks', () => {
        const base = applySelection({}, { integration: INT, add: [file, folder], folderPath: [] }).selection;
        const next = applySelection(base, { integration: INT, remove: [file, folder], folderPath: [] }).selection;
        expect(selectionCounts(next, INT).total).toBe(0);
    });
});
