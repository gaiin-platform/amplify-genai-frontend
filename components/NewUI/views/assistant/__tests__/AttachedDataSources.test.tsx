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
});
