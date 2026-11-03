import { describe, it, expect } from 'vitest';
import {
    allDriveFiles,
    buildDriveRecap,
    describeDriveCounts,
    driveDatasources,
    filterDriveRecap,
    summarizeDriveProvider,
} from '../driveRecapModel';

const ds = (name: string, id = `s3://drive/${name}`) => ({ id, name, type: 'text/plain', raw: null, data: null, metadata: { totalTokens: 0 } }) as any;
const SP = 'microsoft_sharepoint';
const FOLDER = 'sp:site:drive:General/ReadMes';

describe('buildDriveRecap', () => {
    it('lists a processed folder the way the classic recap did: provider → folder → files', () => {
        const selection = {
            [SP]: { folders: { [FOLDER]: { 'f:1': { type: 'text/plain', datasource: ds('README_local_setup.txt') }, 'f:2': { type: 'text/plain', datasource: ds('README_pycomon.txt') } } }, files: {} },
        };
        const [provider] = buildDriveRecap(selection as any, selection as any);
        expect(provider.integration).toBe(SP);
        expect(provider.folders).toHaveLength(1);
        expect(provider.folders[0].name).toBe('General/ReadMes');
        expect(provider.folders[0].files.map((f) => [f.name, f.state])).toEqual([
            ['README_local_setup.txt', 'processed'],
            ['README_pycomon.txt', 'processed'],
        ]);
        expect(describeDriveCounts(provider)).toBe('1 folder');
    });

    it('marks a saved file with no stored copy as blocked, and one picked this session as pending', () => {
        const loaded = { [SP]: { folders: {}, files: { 'sp:a': { type: 'text/plain' } } } };
        const selection = { [SP]: { folders: {}, files: { 'sp:a': { type: 'text/plain' }, 'sp:b': { type: 'text/plain' } } } };
        const [provider] = buildDriveRecap(selection as any, loaded as any);
        expect(provider.files.map((f) => [f.id, f.state])).toEqual([['sp:a', 'blocked'], ['sp:b', 'pending']]);
    });

    it('treats a folder as unlisted until the server has listed its files', () => {
        const selection = { [SP]: { folders: { [FOLDER]: {} }, files: {} } };
        expect(buildDriveRecap(selection as any, undefined)[0].folders[0].unlisted).toBe(true);
        // …but a saved folder that came back empty is not "unlisted", it is just empty.
        expect(buildDriveRecap(selection as any, selection as any)[0].folders[0].unlisted).toBe(false);
    });

    it('falls back to the last id segment when a file has no stored copy', () => {
        const selection = { [SP]: { folders: {}, files: { 'sp:drive:Budget.xlsx': { type: 'x' } } } };
        expect(buildDriveRecap(selection as any, undefined)[0].files[0].name).toBe('Budget.xlsx');
    });

    it('leaves out empty providers and tolerates no selection at all', () => {
        expect(buildDriveRecap({ [SP]: { folders: {}, files: {} }, google_drive: undefined } as any, undefined)).toEqual([]);
        expect(buildDriveRecap(undefined, undefined)).toEqual([]);
    });

    it('does not mutate its input', () => {
        const selection = { [SP]: { folders: { [FOLDER]: { 'f:1': { type: 't', datasource: ds('a.txt') } } }, files: {} } };
        const copy = JSON.stringify(selection);
        buildDriveRecap(selection as any, selection as any);
        expect(JSON.stringify(selection)).toBe(copy);
    });
});

describe('helpers', () => {
    const selection = {
        [SP]: {
            folders: { [FOLDER]: { 'f:1': { type: 't', datasource: ds('a.txt') }, 'f:2': { type: 't' } } },
            files: { 'sp:x': { type: 't', datasource: ds('b.txt') } },
        },
    };
    const recap = buildDriveRecap(selection as any, selection as any);

    it('walks folder files then single files', () => {
        expect(allDriveFiles(recap[0]).map((f) => f.id)).toEqual(['f:1', 'f:2', 'sp:x']);
    });

    it('collects only the stored copies, which are what have an embedding status', () => {
        expect(driveDatasources(recap).map((d) => d.name)).toEqual(['a.txt', 'b.txt']);
    });

    it('pluralises counts', () => {
        expect(describeDriveCounts(recap[0])).toBe('1 folder, 1 file');
        expect(describeDriveCounts({ integration: SP, folders: [{ id: 'a', name: 'a', files: [], unlisted: false }, { id: 'b', name: 'b', files: [], unlisted: false }], files: [] })).toBe('2 folders');
    });

    it('filters down to matching files and drops folders and providers left empty', () => {
        const blockedOnly = filterDriveRecap(recap, (f) => f.state === 'blocked');
        expect(blockedOnly).toHaveLength(1);
        expect(blockedOnly[0].folders[0].files.map((f) => f.id)).toEqual(['f:2']);
        expect(blockedOnly[0].files).toEqual([]);
        expect(filterDriveRecap(recap, () => false)).toEqual([]);
    });
});

describe('summarizeDriveProvider', () => {
    const provider = (files: Array<[string, string]>, extra: Partial<ReturnType<typeof buildDriveRecap>[number]> = {}) => {
        const entries: Record<string, any> = {};
        files.forEach(([id, state]) => { entries[id] = state === 'processed' ? { type: 't', datasource: ds(id) } : { type: 't' }; });
        const selection = { [SP]: { folders: {}, files: entries } };
        // 'pending' = not in the loaded data; 'blocked' = in the loaded data but no stored copy
        const saved = { [SP]: { folders: {}, files: Object.fromEntries(files.filter(([, s]) => s !== 'pending').map(([id]) => [id, { type: 't' }])) } };
        return { ...buildDriveRecap(selection as any, saved as any)[0], ...extra };
    };
    const status = (map: Record<string, string>) => (file: { id: string }) => map[file.id];

    it('reports all-completed', () => {
        expect(summarizeDriveProvider(provider([['a', 'processed'], ['b', 'processed']]), status({ a: 'completed', b: 'completed' })))
            .toMatchObject({ label: 'Completed', tone: 'success' });
    });

    it('puts problems first: a blocked file and a failed embedding both count', () => {
        const p = provider([['a', 'processed'], ['b', 'blocked'], ['c', 'processed']]);
        expect(summarizeDriveProvider(p, status({ a: 'completed', c: 'failed' }))).toMatchObject({ label: '2 need attention', tone: 'error' });
        expect(summarizeDriveProvider(provider([['b', 'blocked']]), status({}))).toMatchObject({ label: '1 needs attention' });
    });

    it('reports work in progress before completion', () => {
        expect(summarizeDriveProvider(provider([['a', 'processed'], ['b', 'processed']]), status({ a: 'completed', b: 'processing' })))
            .toMatchObject({ label: 'Processing', busy: true });
    });

    it('says picks are waiting for a save, not that they failed', () => {
        expect(summarizeDriveProvider(provider([['a', 'pending']]), status({}))).toMatchObject({ label: 'Processed when you save', tone: 'neutral' });
    });

    it('says nothing while statuses are still loading', () => {
        expect(summarizeDriveProvider(provider([['a', 'processed']]), status({}))).toBeNull();
    });
});
