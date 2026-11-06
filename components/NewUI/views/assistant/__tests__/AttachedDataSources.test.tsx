import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// The list only reaches these over the network from effects/handlers, which a static render never runs.
vi.mock('@/services/adminService', () => ({ embeddingDocumentStatus: vi.fn() }));
vi.mock('@/services/assistantService', () => ({ getSiteMapUrls: vi.fn() }));

import { AttachedDataSources, AttachedDataSourcesProps } from '../AttachedDataSources';

const SITEMAP = 'https://pages.github.com/sitemap.xml';
const scraped = (url: string, fromSitemap?: string) => ({
    id: `s3://scrape/${encodeURIComponent(url)}.json`,
    name: `pages-github_${encodeURIComponent(url)}.json`,
    type: 'website/url',
    raw: null,
    data: null,
    metadata: { totalTokens: 0, sourceUrl: url, ...(fromSitemap ? { fromSitemap } : {}) },
}) as any;
const file = (name: string, type = 'text/csv') => ({ id: `s3://u/${name}`, name, type, raw: null, data: null, metadata: { totalTokens: 0 } }) as any;

const props = (over: Partial<AttachedDataSourcesProps> = {}): AttachedDataSourcesProps => ({
    sources: [],
    statusOf: () => 'ready',
    progressOf: () => undefined,
    errorOf: () => undefined,
    savedIds: new Set<string>(),
    downloadingId: null,
    onRemove: vi.fn(),
    onRemoveMany: vi.fn(),
    onRetry: vi.fn(),
    onOpen: vi.fn(),
    exclusionsFor: () => ({}),
    onSitemapEdit: vi.fn(),
    ...over,
});
const render = (over: Partial<AttachedDataSourcesProps> = {}) => renderToStaticMarkup(<AttachedDataSources {...props(over)} />);

const ds = (name: string) => ({ id: `s3://drive/${name}`, name, type: 'text/plain', raw: null, data: null, metadata: { totalTokens: 0 } }) as any;
const driveSelection = {
    microsoft_sharepoint: {
        folders: { 'sp:site:General/ReadMes': { 'f:1': { type: 't', datasource: ds('README_local_setup.txt') } } },
        files: {},
    },
};

describe('AttachedDataSources', () => {
    const sources = [
        file('Screenshot.png', 'image/png'),
        file('BAE_CDA.docx'),
        scraped('https://pages.github.com/themes/', SITEMAP),
        scraped('https://pages.github.com/', SITEMAP),
    ];

    it('folds sitemap pages into one row and counts rows, not pages', () => {
        const html = render({ sources });
        expect(html).toContain('Attached (3)');
        expect(html).toContain(`Sitemap · 2 pages`);
        expect(html).toContain(SITEMAP);
        // collapsed: the pages are not listed
        expect(html).not.toContain('pages.github.com/themes/');
    });

    it('names a standalone website by its URL, not the scraped file name', () => {
        const html = render({ sources: [scraped('https://example.com/docs')] });
        expect(html).toContain('https://example.com/docs');
        expect(html).not.toContain('pages-github_');
    });

    it('shows the manage gear only when the editor can apply a sitemap edit', () => {
        expect(render({ sources })).toContain('Manage included and excluded URLs');
        expect(render({ sources, onSitemapEdit: undefined })).not.toContain('Manage included and excluded URLs');
    });

    it('hides the search box for a short list and shows it for a long one', () => {
        expect(render({ sources })).not.toContain('Search attached');
        const many = Array.from({ length: 8 }, (_, i) => file(`f${i}.csv`));
        expect(render({ sources: many })).toContain('Search attached');
    });

    it('does not offer regenerate for sources the server has not seen yet', () => {
        // Nothing is "saved" and no status has loaded, so there is nothing to regenerate.
        expect(render({ sources })).not.toContain('Regenerate text extraction');
    });

    describe('at scale', () => {
        const many = Array.from({ length: 30 }, (_, i) => file(`file-${String(i).padStart(2, '0')}.csv`));

        it('draws only the first rows and offers to show more', () => {
            const html = render({ sources: many });
            expect(html).toContain('file-00.csv');
            expect(html).toContain('file-11.csv');
            expect(html).not.toContain('file-12.csv');
            expect(html).toContain('Showing 12 of 30');
            expect(html).toContain('Show 18 more');
            // 18 hidden is not more than one step, so no separate "show all"
            expect(html).not.toContain('Show all');
        });

        it('offers "Show all" only when more than one step is hidden', () => {
            const lots = Array.from({ length: 100 }, (_, i) => file(`f${i}.csv`));
            const html = render({ sources: lots });
            expect(html).toContain('Show 24 more');
            expect(html).toContain('Show all 100');
        });

        it('has no pager for a short list', () => {
            expect(render({ sources: many.slice(0, 12) })).not.toContain('Show ');
        });

        it('counts all rows in the heading, not just the drawn ones', () => {
            expect(render({ sources: many })).toContain('Attached (30)');
        });
    });

    describe('drive picks', () => {
        const drive = { selection: driveSelection as any, loaded: driveSelection as any };

        it('shows an attached drive provider even when there are no other sources', () => {
            const html = render({ sources: [], drive });
            expect(html).toContain('Attached (1)');
            expect(html).toContain('SharePoint');
            expect(html).toContain('1 folder');
        });

        it('offers "Change" only when the picker can be opened', () => {
            expect(render({ sources: [], drive })).not.toContain('Change the files selected');
            expect(render({ sources: [], drive: { ...drive, onManage: vi.fn() } })).toContain('Change the files selected from SharePoint');
        });

        it('lists drive picks before the other sources', () => {
            const html = render({ sources: [file('BAE_CDA.docx')], drive });
            expect(html.indexOf('SharePoint')).toBeLessThan(html.indexOf('BAE_CDA.docx'));
        });
    });
});

