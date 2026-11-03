import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { DriveSourcesRecap, DriveSourcesRecapProps } from '../DriveSourcesRecap';
import { buildDriveRecap } from '../driveRecapModel';

const ds = (name: string) => ({ id: `s3://drive/${name}`, name, type: 'text/plain', raw: null, data: null, metadata: { totalTokens: 0 } }) as any;
const SP = 'microsoft_sharepoint';
const FOLDER = 'sp:site:General/ReadMes';

// Saved earlier: two processed files and one that never produced a stored copy.
const loaded = { [SP]: { folders: { [FOLDER]: { 'f:1': { type: 't' }, 'f:2': { type: 't' }, 'f:3': { type: 't' } } }, files: { 'sp:solo': { type: 't' } } } };
const selection = {
    [SP]: {
        folders: { [FOLDER]: { 'f:1': { type: 't', datasource: ds('README_local_setup.txt') }, 'f:2': { type: 't', datasource: ds('README_pycomon.txt') }, 'f:3': { type: 't' } } },
        files: { 'sp:solo': { type: 't', datasource: ds('Budget.xlsx') }, 'sp:new': { type: 't' } },
    },
};
const [provider] = buildDriveRecap(selection as any, loaded as any);

const props = (over: Partial<DriveSourcesRecapProps> = {}): DriveSourcesRecapProps => ({
    provider,
    expanded: true,
    onToggle: vi.fn(),
    isFolderExpanded: () => true,
    onToggleFolder: vi.fn(),
    summary: null,
    fileStatus: () => null,
    canReprocess: () => false,
    onReprocess: vi.fn(),
    ...over,
});
const render = (over: Partial<DriveSourcesRecapProps> = {}) =>
    renderToStaticMarkup(<ul><DriveSourcesRecap {...props(over)} /></ul>);

describe('DriveSourcesRecap', () => {
    it('names the provider and counts its folders and files, collapsed or not', () => {
        const html = render({ expanded: false });
        expect(html).toContain('SharePoint');
        expect(html).toContain('1 folder, 2 files');
        expect(html).toContain('aria-expanded="false"');
        expect(html).not.toContain('README_local_setup.txt');
    });

    it('shows the folder, its file count and its files when open', () => {
        const html = render();
        expect(html).toContain('General/ReadMes');
        expect(html).toContain('(3)');
        expect(html).toContain('README_local_setup.txt');
        expect(html).toContain('README_pycomon.txt');
        expect(html).toContain('Budget.xlsx');
    });

    it('does not list a folder’s files when the folder row is closed', () => {
        const html = render({ isFolderExpanded: () => false });
        expect(html).toContain('General/ReadMes');
        expect(html).not.toContain('README_local_setup.txt');
        // the single files are still listed
        expect(html).toContain('Budget.xlsx');
    });

    it('flags a saved file that never produced a copy, and says a fresh pick is waiting for the save', () => {
        const html = render();
        expect(html).toContain('Couldn’t be processed');
        expect(html).toContain('sensitive data');
        expect(html).toContain('Processed when you save');
    });

    it('shows each processed file’s embedding status', () => {
        const html = render({
            fileStatus: (file) => (file.name === 'README_local_setup.txt' ? { label: 'Completed', tone: 'success' } : null),
        });
        expect(html).toContain('Completed');
    });

    it('shows the header roll-up', () => {
        expect(render({ summary: { label: '1 needs attention', tone: 'error' } })).toContain('1 needs attention');
    });

    it('says a folder picked this session is listed after the save', () => {
        const fresh = buildDriveRecap({ [SP]: { folders: { [FOLDER]: {} }, files: {} } } as any, undefined)[0];
        const html = render({ provider: fresh });
        expect(html).toContain('(not saved yet)');
        expect(html).toContain('listed after you save');
    });

    it('offers regenerate per file only where allowed', () => {
        const html = render({ canReprocess: (file) => file.name === 'README_pycomon.txt' });
        expect((html.match(/aria-label="Regenerate/g) ?? []).length).toBe(1);
    });

    it('bounds the file list so a big folder scrolls instead of growing the page', () => {
        const html = render();
        expect(html).toContain('max-height:280px');
        expect(html).toContain('overflow-y:auto');
    });

    it('keeps the toggles real buttons with state, and names the Change control', () => {
        const html = render({ onManage: vi.fn() });
        expect(html).toContain('aria-expanded="true"');
        expect(html).toContain('aria-label="Change the files selected from SharePoint"');
    });
});
