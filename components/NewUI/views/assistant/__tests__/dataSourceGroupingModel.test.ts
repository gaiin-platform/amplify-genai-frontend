import { describe, it, expect } from 'vitest';
import {
    applySitemapEdit,
    buildDataSourceEntries,
    dataSourceLabel,
    describeSitemapEdit,
    mergeSitemapExclusions,
    scrapedFileKey,
    scrapedFilesToDelete,
    embeddingBadge,
    filterEntries,
    tallyEmbeddingStatuses,
    summarizeEmbeddingStatuses,
    websiteUrlsAfterRemoval,
    withSitemapExclusions,
} from '../dataSourceGroupingModel';

const file = (id: string, name = id) => ({ id, name, type: 'text/csv', raw: null, data: null, metadata: { totalTokens: 0 } }) as any;
const page = (url: string, sitemap: string, extra: Record<string, any> = {}) => ({
    id: `s3://scrape/${encodeURIComponent(url)}.json`,
    name: `scrape-${encodeURIComponent(url)}.json`,
    type: 'website/url',
    raw: null,
    data: null,
    metadata: { totalTokens: 0, sourceUrl: url, fromSitemap: sitemap, ...extra },
}) as any;
const standalone = (url: string) => ({
    id: `s3://scrape/${encodeURIComponent(url)}.json`,
    name: 'scrape.json',
    type: 'website/url',
    raw: null,
    data: null,
    metadata: { totalTokens: 0, sourceUrl: url },
}) as any;

const SITEMAP = 'https://a.test/sitemap.xml';

describe('dataSourceLabel', () => {
    it('shows the page URL for website sources, not the generated file name', () => {
        expect(dataSourceLabel(page('https://a.test/x', SITEMAP))).toBe('https://a.test/x');
        expect(dataSourceLabel(standalone('https://b.test/'))).toBe('https://b.test/');
    });
    it('keeps the file name for ordinary files', () => {
        expect(dataSourceLabel(file('k1', 'report.docx'))).toBe('report.docx');
    });
});

describe('buildDataSourceEntries', () => {
    it('folds sitemap pages under one sitemap entry, where its first page was', () => {
        const a = page('https://a.test/1', SITEMAP);
        const f = file('f1', 'a.png');
        const b = page('https://a.test/2', SITEMAP);
        const entries = buildDataSourceEntries([a, f, b]);
        expect(entries).toHaveLength(2);
        expect(entries[0]).toMatchObject({ kind: 'sitemap', sitemapUrl: SITEMAP });
        expect((entries[0] as any).pages).toEqual([a, b]);
        expect(entries[1]).toMatchObject({ kind: 'source', ds: f });
    });

    it('keeps a standalone website URL and an unsaved sitemap placeholder as plain sources', () => {
        const placeholder = { id: SITEMAP, name: SITEMAP, type: 'website/sitemap', raw: null, data: null, metadata: { totalTokens: 0, sourceUrl: SITEMAP, isSitemap: true } } as any;
        const entries = buildDataSourceEntries([standalone('https://b.test/'), placeholder]);
        expect(entries.map((e) => e.kind)).toEqual(['source', 'source']);
    });

    it('keeps separate sitemaps separate', () => {
        const entries = buildDataSourceEntries([page('https://a.test/1', SITEMAP), page('https://c.test/1', 'https://c.test/sitemap.xml')]);
        expect(entries.map((e) => (e as any).sitemapUrl)).toEqual([SITEMAP, 'https://c.test/sitemap.xml']);
    });

    describe('search', () => {
        const sources = [page('https://a.test/themes/', SITEMAP), page('https://a.test/about', SITEMAP), file('f1', 'budget.csv')];

        it('returns everything for a blank query', () => {
            expect(buildDataSourceEntries(sources, '   ')).toHaveLength(2);
        });
        it('keeps only matching pages inside a sitemap', () => {
            const [entry] = buildDataSourceEntries(sources, 'themes');
            expect((entry as any).pages).toHaveLength(1);
        });
        it('keeps all pages when the sitemap URL itself matches', () => {
            const [entry] = buildDataSourceEntries(sources, 'sitemap.xml');
            expect((entry as any).pages).toHaveLength(2);
        });
        it('matches files by name, case-insensitively, and drops sitemaps with no match', () => {
            const entries = buildDataSourceEntries(sources, 'BUDGET');
            expect(entries).toHaveLength(1);
            expect(entries[0]).toMatchObject({ kind: 'source' });
        });
    });
});

describe('applySitemapEdit', () => {
    const p1 = page('https://a.test/1', SITEMAP);
    const p2 = page('https://a.test/2', SITEMAP);
    const other = page('https://c.test/1', 'https://c.test/sitemap.xml');
    const doc = file('f1', 'a.csv');
    const exclusions = { excludedUrls: ['https://a.test/2'] };

    it('removes switched-off pages and adds switched-on ones without a key', () => {
        const out = applySitemapEdit([p1, p2, doc], SITEMAP, { exclusions, urlsToAdd: ['https://a.test/3'], urlsToRemove: ['https://a.test/2'] });
        expect(out.map((d) => d.metadata?.sourceUrl ?? d.id)).toEqual(['https://a.test/1', 'f1', 'https://a.test/3']);
        const added = out[out.length - 1];
        expect(added).toMatchObject({ id: 'https://a.test/3', type: 'website/url', metadata: { fromSitemap: SITEMAP, sourceUrl: 'https://a.test/3' } });
        expect(added.key).toBeUndefined();
    });

    it('stamps the new exclusions on every remaining page of that sitemap only', () => {
        const out = applySitemapEdit([p1, other, doc], SITEMAP, { exclusions, urlsToAdd: [], urlsToRemove: [] });
        expect(out[0].metadata?.exclusions).toEqual(exclusions);
        expect(out[1]).toBe(other);
        expect(out[2]).toBe(doc);
    });

    it('does not duplicate a page that is already there', () => {
        const out = applySitemapEdit([p1], SITEMAP, { exclusions: {}, urlsToAdd: ['https://a.test/1'], urlsToRemove: [] });
        expect(out).toHaveLength(1);
    });

    it('carries the group id onto new pages of a group assistant', () => {
        const out = applySitemapEdit([p1], SITEMAP, { exclusions: {}, urlsToAdd: ['https://a.test/9'], urlsToRemove: [] }, 'grp-1');
        expect(out[1].groupId).toBe('grp-1');
    });

    it('does not mutate its input', () => {
        const input = [p1, p2];
        applySitemapEdit(input, SITEMAP, { exclusions, urlsToAdd: [], urlsToRemove: ['https://a.test/2'] });
        expect(input).toEqual([p1, p2]);
        expect(p1.metadata.exclusions).toBeUndefined();
    });
});

describe('describeSitemapEdit', () => {
    it.each([
        [{ urlsToAdd: ['a', 'b'], urlsToRemove: ['c'] }, 'Added 2 and removed 1 URLs. Save the assistant to apply.'],
        [{ urlsToAdd: ['a'], urlsToRemove: [] }, 'Added 1 new URL. Save the assistant to scrape them.'],
        [{ urlsToAdd: [], urlsToRemove: ['a', 'b'] }, 'Removed 2 URLs. Save the assistant to apply.'],
        [{ urlsToAdd: [], urlsToRemove: [] }, 'Exclusions updated.'],
    ])('%j', (edit, text) => {
        expect(describeSitemapEdit(edit)).toBe(text);
    });
});

describe('mergeSitemapExclusions', () => {
    it('unions the sitemap entry and every page, without duplicates', () => {
        const urls = [{ url: SITEMAP, sourceUrl: SITEMAP, isSitemap: true, exclusions: { excludedUrls: ['https://a.test/x'], excludeKeywords: ['old'] } }];
        const pages = [
            page('https://a.test/1', SITEMAP, { exclusions: { excludedUrls: ['https://a.test/y', 'https://a.test/x'] } }),
            page('https://a.test/2', SITEMAP, { exclusions: { excludeKeywords: ['old', 'draft'] } }),
        ];
        expect(mergeSitemapExclusions(urls, SITEMAP, pages)).toEqual({
            excludedUrls: ['https://a.test/x', 'https://a.test/y'],
            excludeKeywords: ['old', 'draft'],
        });
    });
    it('ignores other sitemaps and returns an empty object when nothing is excluded', () => {
        const urls = [{ url: 'https://c.test/sitemap.xml', isSitemap: true, exclusions: { excludedUrls: ['z'] } }];
        expect(mergeSitemapExclusions(urls, SITEMAP, [page('https://a.test/1', SITEMAP)])).toEqual({});
    });
});

describe('withSitemapExclusions', () => {
    it('sets exclusions on the matching sitemap entry only', () => {
        const urls = [{ url: SITEMAP, sourceUrl: SITEMAP, isSitemap: true }, { url: 'https://b.test', sourceUrl: 'https://b.test', isSitemap: false }];
        const out = withSitemapExclusions(urls, SITEMAP, { excludedUrls: ['x'] });
        expect(out[0].exclusions).toEqual({ excludedUrls: ['x'] });
        expect(out[1]).toBe(urls[1]);
    });
});

describe('websiteUrlsAfterRemoval', () => {
    const sitemapEntry = { url: SITEMAP, sourceUrl: SITEMAP, isSitemap: true };

    it('excludes a removed sitemap page so a rescan does not bring it back', () => {
        const p1 = page('https://a.test/1', SITEMAP);
        const p2 = page('https://a.test/2', SITEMAP);
        const out = websiteUrlsAfterRemoval([sitemapEntry], [p1], [p2]);
        expect(out[0].exclusions.excludedUrls).toEqual(['https://a.test/1']);
    });

    it('does not list the same exclusion twice', () => {
        const p1 = page('https://a.test/1', SITEMAP);
        const p2 = page('https://a.test/2', SITEMAP);
        const entry = { ...sitemapEntry, exclusions: { excludedUrls: ['https://a.test/1'] } };
        const out = websiteUrlsAfterRemoval([entry], [p1], [p2]);
        expect(out).toEqual([entry]);
    });

    it('keeps existing keyword exclusions while adding the URL', () => {
        const p1 = page('https://a.test/1', SITEMAP);
        const p2 = page('https://a.test/2', SITEMAP);
        const entry = { ...sitemapEntry, exclusions: { excludeKeywords: ['archive'] } };
        const [out] = websiteUrlsAfterRemoval([entry], [p1], [p2]);
        expect(out.exclusions).toEqual({ excludeKeywords: ['archive'], excludedUrls: ['https://a.test/1'] });
    });

    it('drops the sitemap once its last page is gone', () => {
        const p1 = page('https://a.test/1', SITEMAP);
        const out = websiteUrlsAfterRemoval([sitemapEntry, { url: 'https://b.test', sourceUrl: 'https://b.test' }], [p1], []);
        expect(out.map((u) => u.url)).toEqual(['https://b.test']);
    });

    it('keeps the sitemap while its placeholder source is still in the editor', () => {
        const p1 = page('https://a.test/1', SITEMAP);
        const placeholder = { id: SITEMAP, name: SITEMAP, type: 'website/sitemap', raw: null, data: null, metadata: { totalTokens: 0, sourceUrl: SITEMAP } } as any;
        const out = websiteUrlsAfterRemoval([sitemapEntry], [p1], [placeholder]);
        expect(out).toHaveLength(1);
    });

    it('removes a standalone website URL from the list', () => {
        const ds = standalone('https://b.test');
        const out = websiteUrlsAfterRemoval([sitemapEntry, { url: 'https://b.test', sourceUrl: 'https://b.test' }], [ds], []);
        expect(out).toEqual([sitemapEntry]);
    });

    it('removes a just-added (unsaved) website URL, keyed by its id', () => {
        const ds = { id: 'https://n.test', name: 'https://n.test', type: 'website/url', raw: null, data: null, metadata: { totalTokens: 0, sourceUrl: 'https://n.test' } } as any;
        const out = websiteUrlsAfterRemoval([{ url: 'https://n.test' }], [ds], []);
        expect(out).toEqual([]);
    });

    it('leaves a sitemap that never scraped any pages alone when an unrelated file is removed', () => {
        const urls = [sitemapEntry];
        expect(websiteUrlsAfterRemoval(urls, [file('f1')], [])).toBe(urls);
    });

    it('returns the same array when nothing changes', () => {
        const urls = [sitemapEntry];
        expect(websiteUrlsAfterRemoval(urls, [], [])).toBe(urls);
    });
});

describe('embeddingBadge', () => {
    it('maps the endpoint statuses to the classic labels', () => {
        expect(embeddingBadge('completed')).toMatchObject({ label: 'Completed', tone: 'success', busy: false });
        expect(embeddingBadge('processing')).toMatchObject({ label: 'Processing', tone: 'warning', busy: true });
        expect(embeddingBadge('starting')).toMatchObject({ label: 'Starting', busy: true });
        expect(embeddingBadge('failed')).toMatchObject({ label: 'Failed', tone: 'error' });
        expect(embeddingBadge('terminated')).toMatchObject({ label: 'Error', tone: 'error' });
    });

    it('shows nothing for files with no embedding record', () => {
        expect(embeddingBadge('not_found')).toBeNull();
        expect(embeddingBadge(undefined)).toBeNull();
        expect(embeddingBadge('???')).toBeNull();
    });

    it('puts chunk counts in the tooltip', () => {
        const badge = embeddingBadge('failed', { failedChunks: 2, totalChunks: 9 });
        expect(badge?.title).toContain('2/9 chunks failed');
    });
});

describe('summarizeEmbeddingStatuses', () => {
    it('reports failures first', () => {
        expect(summarizeEmbeddingStatuses(['completed', 'failed', 'processing', 'terminated'])).toMatchObject({ label: '2 failed', tone: 'error' });
    });
    it('reports in-flight work next', () => {
        expect(summarizeEmbeddingStatuses(['completed', 'processing'])).toMatchObject({ label: 'Processing', busy: true });
    });
    it('says Completed only when every page is known complete', () => {
        expect(summarizeEmbeddingStatuses(['completed', 'completed'])).toMatchObject({ label: 'Completed' });
        expect(summarizeEmbeddingStatuses(['completed', undefined])).toBeNull();
    });
    it('says nothing when nothing is known', () => {
        expect(summarizeEmbeddingStatuses([undefined, 'not_found'])).toBeNull();
        expect(summarizeEmbeddingStatuses([])).toBeNull();
    });
});

describe('scrapedFileKey', () => {
    it('is the stored file of a saved scraped page, without the s3:// scheme', () => {
        expect(scrapedFileKey(page('https://a.test/1', SITEMAP))).toBe(`scrape/${encodeURIComponent('https://a.test/1')}.json`);
        expect(scrapedFileKey(standalone('https://b.test/'))).toBe(`scrape/${encodeURIComponent('https://b.test/')}.json`);
    });

    it('prefers an explicit key', () => {
        expect(scrapedFileKey({ ...standalone('https://b.test/'), key: 'user/abc.json' })).toBe('user/abc.json');
    });

    it('accepts a saved id that has no scheme', () => {
        expect(scrapedFileKey({ ...standalone('https://b.test/'), id: 'user/abc.json' })).toBe('user/abc.json');
    });

    it('is null for a source added this session (its id is the URL)', () => {
        const fresh = { id: 'https://n.test', name: 'https://n.test', type: 'website/url', raw: null, data: null, metadata: { totalTokens: 0, sourceUrl: 'https://n.test' } } as any;
        expect(scrapedFileKey(fresh)).toBeNull();
    });

    it('is null for a sitemap placeholder and for ordinary files (those may live in the library)', () => {
        const placeholder = { id: SITEMAP, name: SITEMAP, type: 'website/sitemap', raw: null, data: null, metadata: { totalTokens: 0 } } as any;
        expect(scrapedFileKey(placeholder)).toBeNull();
        expect(scrapedFileKey(file('s3://u/report.docx'))).toBeNull();
    });
});

describe('scrapedFilesToDelete', () => {
    const kept = page('https://a.test/kept', SITEMAP);
    const keptKey = scrapedFileKey(kept)!;

    it('returns each queued key once', () => {
        expect(scrapedFilesToDelete(['a', 'b', 'a'], [])).toEqual(['a', 'b']);
    });

    it('never deletes a file the saved assistant still uses', () => {
        expect(scrapedFilesToDelete(['gone', keptKey], [kept])).toEqual(['gone']);
    });

    it('compares against saved sources whether or not their id carries s3://', () => {
        expect(scrapedFilesToDelete(['user/abc.json'], [{ ...standalone('https://b.test/'), id: 's3://user/abc.json' }])).toEqual([]);
    });

    it('ignores empty keys', () => {
        expect(scrapedFilesToDelete(['', 'a'], [])).toEqual(['a']);
    });
});

describe('filterEntries', () => {
    const good = page('https://a.test/ok', SITEMAP);
    const bad = page('https://a.test/bad', SITEMAP);
    const f = file('f1', 'a.csv');
    const entries = buildDataSourceEntries([good, bad, f]);

    it('keeps only matching pages of a sitemap, and matching standalone sources', () => {
        const out = filterEntries(entries, (ds) => ds === bad);
        expect(out).toHaveLength(1);
        expect((out[0] as any).pages).toEqual([bad]);
    });

    it('drops a sitemap with no matching page', () => {
        const out = filterEntries(entries, (ds) => ds === f);
        expect(out.map((e) => e.kind)).toEqual(['source']);
    });
});

describe('tallyEmbeddingStatuses', () => {
    it('counts what is known and ignores what is not', () => {
        expect(tallyEmbeddingStatuses(['completed', 'completed', 'processing', 'starting', 'failed', 'terminated', 'not_found', undefined]))
            .toEqual({ completed: 2, working: 2, failed: 2 });
    });
    it('is all zeros for nothing', () => {
        expect(tallyEmbeddingStatuses([])).toEqual({ completed: 0, working: 0, failed: 0 });
    });
});
