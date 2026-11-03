import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SitemapDataSourceGroup, SitemapDataSourceGroupProps } from '../SitemapDataSourceGroup';
import { DataSourceCard } from '@/components/NewUI/shared/DataSourceCard';

const SITEMAP = 'https://pages.github.com/sitemap.xml';
const page = (url: string) => ({
    id: `s3://scrape/${encodeURIComponent(url)}.json`,
    name: 'pages-github_2026-10-28.json',
    type: 'website/url',
    raw: null,
    data: null,
    metadata: { totalTokens: 0, sourceUrl: url, fromSitemap: SITEMAP },
}) as any;

const base = (over: Partial<SitemapDataSourceGroupProps> = {}): SitemapDataSourceGroupProps => ({
    sitemapUrl: SITEMAP,
    pages: [page('https://pages.github.com/themes/'), page('https://pages.github.com/')],
    expanded: false,
    onToggle: vi.fn(),
    summary: null,
    pageStatus: () => null,
    isUnsaved: () => false,
    canReprocess: () => false,
    onReprocess: vi.fn(),
    onRemovePage: vi.fn(),
    onRemoveAll: vi.fn(),
    onManage: vi.fn(),
    ...over,
});

const render = (over: Partial<SitemapDataSourceGroupProps> = {}) =>
    renderToStaticMarkup(<ul><SitemapDataSourceGroup {...base(over)} /></ul>);

describe('SitemapDataSourceGroup', () => {
    it('shows the sitemap URL with its page count, collapsed', () => {
        const html = render();
        expect(html).toContain(SITEMAP);
        expect(html).toContain('Sitemap · 2 pages');
        expect(html).toContain('aria-expanded="false"');
        expect(html).not.toContain('themes/');
    });

    it('uses the singular for one page', () => {
        expect(render({ pages: [page('https://pages.github.com/')] })).toContain('1 page');
    });

    it('lists the pages by URL (not the scraped file name) when expanded', () => {
        const html = render({ expanded: true });
        expect(html).toContain('aria-expanded="true"');
        expect(html).toContain('https://pages.github.com/themes/');
        expect(html).toContain('https://pages.github.com/');
        expect(html).not.toContain('pages-github_2026-10-28.json');
    });

    it('offers the manage-URLs gear with an accessible name, and hides it when read-only', () => {
        expect(render()).toContain(`Manage included and excluded URLs for ${SITEMAP}`);
        expect(render({ onManage: undefined })).not.toContain('Manage included');
    });

    it('keeps the gear and remove controls outside the toggle button', () => {
        const html = render();
        const toggle = html.slice(html.indexOf('<button'), html.indexOf('</button>'));
        expect(toggle).toContain('aria-expanded');
        expect(toggle).not.toContain('Manage included');
        expect(toggle).not.toContain('Remove');
    });

    it('marks the gear busy while the sitemap loads', () => {
        const html = render({ managing: true });
        expect(html).toContain('aria-busy="true"');
        expect(html).toContain('disabled');
    });

    it('shows the summary status in the header and each page status in its row', () => {
        const html = render({
            expanded: true,
            summary: { label: '1 failed', tone: 'error' },
            pageStatus: (p) => ((p.metadata?.sourceUrl ?? '').endsWith('themes/') ? { label: 'Failed', tone: 'error' } : { label: 'Completed', tone: 'success' }),
        });
        expect(html).toContain('1 failed');
        expect(html).toContain('Failed');
        expect(html).toContain('Completed');
    });

    it('says an unsaved page is scraped on save, and offers regenerate only where allowed', () => {
        const html = render({
            expanded: true,
            isUnsaved: (p) => (p.metadata?.sourceUrl ?? '').endsWith('themes/'),
            canReprocess: (p) => !(p.metadata?.sourceUrl ?? '').endsWith('themes/'),
        });
        expect(html).toContain('Scraped when you save');
        expect((html.match(/Regenerate text extraction/g) ?? []).length).toBeGreaterThan(0);
        // one page → one regenerate button (aria-label + title each mention it once → 2 hits)
        expect((html.match(/aria-label="Regenerate/g) ?? []).length).toBe(1);
    });

    it('scrolls a long page list inside the row, and only makes it a tab stop when it can scroll', () => {
        const long = render({ expanded: true, pages: Array.from({ length: 40 }, (_, i) => page(`https://pages.github.com/p${i}`)) });
        expect(long).toContain('max-height:320px');
        expect(long).toContain('overflow-y:auto');
        expect(long).toContain('tabindex="0"');
        expect(render({ expanded: true })).not.toContain('tabindex="0"');
    });

    it('gives every icon-only control an accessible name', () => {
        const html = render({ expanded: true });
        expect(html).toContain('aria-label="Remove page https://pages.github.com/themes/"');
        expect(html).toContain(`aria-label="Remove ${SITEMAP} and all 2 of its pages"`);
    });
});

describe('DataSourceCard embedding status', () => {
    const card = (props: Partial<React.ComponentProps<typeof DataSourceCard>> = {}) =>
        renderToStaticMarkup(<ul><DataSourceCard name="BAE_CDA.docx" type="application/vnd.openxmlformats-officedocument.wordprocessingml.document" status="ready" {...props} /></ul>);

    it('is unchanged without embedding props', () => {
        const html = card();
        expect(html).toContain('Document');
        expect(html).not.toContain('Completed');
        expect(html).not.toContain('Regenerate');
    });

    it('appends the status word after the type label', () => {
        const html = card({ embedding: { label: 'Completed', tone: 'success' } });
        expect(html).toContain('Document');
        expect(html).toContain('Completed');
    });

    it('offers regenerate when asked to', () => {
        expect(card({ onReprocess: () => {} })).toContain('aria-label="Regenerate text extraction and embeddings for BAE_CDA.docx"');
    });

    it('shows neither while the file is still uploading', () => {
        const html = card({ status: 'uploading', embedding: { label: 'Completed', tone: 'success' }, onReprocess: () => {} });
        expect(html).not.toContain('Completed');
        expect(html).not.toContain('Regenerate');
    });
});
