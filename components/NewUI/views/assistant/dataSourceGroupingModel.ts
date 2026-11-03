/**
 * dataSourceGroupingModel — pure logic behind the assistant editor's attached
 * data-sources list. No React imports.
 *
 * The classic editor (components/Chat/FileList `ExistingFileList`) showed a saved
 * assistant's sources as a tree: a sitemap is scraped into one source per page, and
 * those pages were folded back under the sitemap they came from ("<url> (N pages)"),
 * with a gear to choose which pages are included. The flat card grid lost all of that.
 * This module is the data half of putting it back:
 *
 *   • buildDataSourceEntries   — fold sitemap pages under their sitemap, apply search
 *   • applySitemapEdit         — the result of the include/exclude manager, as new sources
 *   • websiteUrlsAfterRemoval  — keep `data.websiteUrls` in step when sources are removed
 *   • withSitemapExclusions    — record the manager's exclusions on the sitemap's entry
 *   • embeddingBadge           — status → label/tone for the "embedding status" text
 *
 * Why `websiteUrls` bookkeeping matters: `data.websiteUrls` is what a rescan walks.
 * Remove one scraped page of a sitemap without recording it as excluded and the next
 * rescan quietly brings it back; remove the last page without dropping the sitemap and
 * the whole thing is re-scraped. The classic modal handled both inline; they live here
 * so they can be tested.
 */

import type { AttachedDocument } from '@/types/attacheddocument';

/** Mirrors components/DataSources/SitemapUrlSelectionModal's `SitemapExclusions`. */
export interface SitemapExclusions {
    excludedUrls?: string[];
    excludeKeywords?: string[];
}

export interface SitemapEditResult {
    exclusions: SitemapExclusions;
    urlsToAdd: string[];
    urlsToRemove: string[];
}

/** One slot in the list: a single source, or a sitemap with the pages scraped from it. */
export type DataSourceEntry =
    | { kind: 'source'; key: string; ds: AttachedDocument }
    | { kind: 'sitemap'; key: string; sitemapUrl: string; pages: AttachedDocument[] };

// ─────────────────────────────────────────────────────────────────────────────
// Identity helpers
// ─────────────────────────────────────────────────────────────────────────────

/** A page that was scraped out of a sitemap (as opposed to a URL added on its own). */
export const isSitemapPage = (ds: AttachedDocument): boolean =>
    ds.type === 'website/url' && !!ds.metadata?.fromSitemap;

export const isWebsiteSource = (ds: AttachedDocument): boolean =>
    ds.type === 'website/url' || ds.type === 'website/sitemap';

/**
 * What to call a source. Scraped website sources are stored under a generated file
 * name (`pages-github_2026-10-28T07:00:46.026889.json`), which says nothing about
 * what they are — show the page URL instead, as the classic list did.
 */
export const dataSourceLabel = (ds: AttachedDocument): string => {
    if (isWebsiteSource(ds)) return ds.metadata?.sourceUrl || ds.name || ds.id;
    return ds.name;
};

/** The URL a `websiteUrls` entry / website source is identified by. */
const entryUrl = (item: any): string | undefined => item?.sourceUrl ?? item?.url;
const sourceUrlOf = (ds: AttachedDocument): string => ds.metadata?.sourceUrl ?? ds.id;

// ─────────────────────────────────────────────────────────────────────────────
// Grouping + search
// ─────────────────────────────────────────────────────────────────────────────

const matches = (ds: AttachedDocument, needle: string): boolean =>
    (ds.name ?? '').toLowerCase().includes(needle) ||
    String(ds.metadata?.sourceUrl ?? '').toLowerCase().includes(needle);

/**
 * Fold sitemap pages under their sitemap and apply the search box.
 *
 * Order follows first appearance, so a sitemap sits where its first page was and
 * nothing jumps when a page is removed. Searching a sitemap's own URL keeps all of
 * its pages; otherwise only the matching pages are kept, and a sitemap with none
 * left drops out.
 */
export function buildDataSourceEntries(sources: AttachedDocument[], query = ''): DataSourceEntry[] {
    const needle = query.trim().toLowerCase();
    const entries: DataSourceEntry[] = [];
    const bySitemap = new Map<string, Extract<DataSourceEntry, { kind: 'sitemap' }>>();

    for (const ds of sources) {
        if (isSitemapPage(ds)) {
            const sitemapUrl = ds.metadata!.fromSitemap as string;
            let group = bySitemap.get(sitemapUrl);
            if (!group) {
                group = { kind: 'sitemap', key: `sitemap:${sitemapUrl}`, sitemapUrl, pages: [] };
                bySitemap.set(sitemapUrl, group);
                entries.push(group);
            }
            group.pages.push(ds);
        } else {
            entries.push({ kind: 'source', key: `source:${ds.id}`, ds });
        }
    }

    if (!needle) return entries;

    return entries.flatMap((entry): DataSourceEntry[] => {
        if (entry.kind === 'source') return matches(entry.ds, needle) ? [entry] : [];
        if (entry.sitemapUrl.toLowerCase().includes(needle)) return [entry];
        const pages = entry.pages.filter((page) => matches(page, needle));
        return pages.length > 0 ? [{ ...entry, pages }] : [];
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Sitemap include / exclude manager
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Apply what the include/exclude manager returned to the list of sources:
 * drop the pages that were switched off, add the ones switched on (they carry no
 * key, so the save scrapes them), and stamp the new exclusions on every page of
 * that sitemap so the backend sees the same rules on each.
 *
 * Pages of other sitemaps and every non-website source are untouched.
 */
export function applySitemapEdit(
    sources: AttachedDocument[],
    sitemapUrl: string,
    edit: SitemapEditResult,
    groupId?: string,
): AttachedDocument[] {
    const toRemove = new Set(edit.urlsToRemove);
    const have = new Set(
        sources.filter((ds) => ds.metadata?.fromSitemap === sitemapUrl).map(sourceUrlOf),
    );

    const kept = sources
        .filter((ds) => ds.metadata?.fromSitemap !== sitemapUrl || !toRemove.has(sourceUrlOf(ds)))
        .map((ds) =>
            ds.metadata?.fromSitemap === sitemapUrl
                ? ({ ...ds, metadata: { ...ds.metadata, exclusions: edit.exclusions } } as AttachedDocument)
                : ds,
        );

    const added: AttachedDocument[] = edit.urlsToAdd
        .filter((url) => !have.has(url))
        .map((url) => ({
            id: url,
            type: 'website/url',
            name: url,
            raw: null,
            data: null,
            ...(groupId ? { groupId } : {}),
            metadata: {
                fromSitemap: sitemapUrl,
                sourceUrl: url,
                exclusions: edit.exclusions,
                totalTokens: 0,
            },
        }));

    return [...kept, ...added];
}

/** One line for the toast after the manager saves; null when nothing changed. */
export function describeSitemapEdit(edit: Pick<SitemapEditResult, 'urlsToAdd' | 'urlsToRemove'>): string {
    const added = edit.urlsToAdd.length;
    const removed = edit.urlsToRemove.length;
    if (added > 0 && removed > 0) return `Added ${added} and removed ${removed} URLs. Save the assistant to apply.`;
    if (added > 0) return `Added ${added} new URL${added > 1 ? 's' : ''}. Save the assistant to scrape them.`;
    if (removed > 0) return `Removed ${removed} URL${removed > 1 ? 's' : ''}. Save the assistant to apply.`;
    return 'Exclusions updated.';
}

/**
 * Everything currently excluded from a sitemap, for the manager to start from.
 *
 * Two places record exclusions: the sitemap's `websiteUrls` entry (written when a page
 * is removed with ×) and each scraped page's own metadata (written by the manager). The
 * manager treats any URL that is neither included nor excluded as brand new and adds it,
 * so it must be given the union — otherwise a page the user already removed comes back.
 */
export function mergeSitemapExclusions(
    websiteUrls: any[],
    sitemapUrl: string,
    pages: AttachedDocument[],
): SitemapExclusions {
    const sources: SitemapExclusions[] = [
        ...websiteUrls.filter((item) => item?.isSitemap && entryUrl(item) === sitemapUrl).map((item) => item.exclusions),
        ...pages.map((page) => page.metadata?.exclusions),
    ].filter(Boolean);

    const excludedUrls = Array.from(new Set(sources.flatMap((e) => e.excludedUrls ?? [])));
    const excludeKeywords = Array.from(new Set(sources.flatMap((e) => e.excludeKeywords ?? [])));
    return {
        ...(excludedUrls.length > 0 && { excludedUrls }),
        ...(excludeKeywords.length > 0 && { excludeKeywords }),
    };
}

/** Record the manager's exclusions on the sitemap's `websiteUrls` entry (so a rescan honours them). */
export function withSitemapExclusions(
    websiteUrls: any[],
    sitemapUrl: string,
    exclusions: SitemapExclusions,
): any[] {
    return websiteUrls.map((item) =>
        item?.isSitemap && entryUrl(item) === sitemapUrl ? { ...item, exclusions } : item,
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Removal bookkeeping
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bring `data.websiteUrls` in line after `removed` sources left the editor.
 *
 *  - a standalone website URL that was removed leaves the list;
 *  - a page removed from a sitemap is added to that sitemap's `excludedUrls`, so a
 *    rescan does not re-add it;
 *  - a sitemap whose pages are all gone (and which has no placeholder source of its
 *    own) leaves the list — otherwise the next save would scrape all of it again.
 *
 * `remaining` is the full source list after the removal. Returns the same array
 * when nothing needed to change.
 */
export function websiteUrlsAfterRemoval(
    websiteUrls: any[],
    removed: AttachedDocument[],
    remaining: AttachedDocument[],
): any[] {
    let next = websiteUrls;
    const set = (value: any[]) => { next = value; };

    for (const ds of removed) {
        if (isSitemapPage(ds)) {
            const parent = ds.metadata!.fromSitemap as string;
            const url = sourceUrlOf(ds);
            set(next.map((item) => {
                if (!item?.isSitemap || entryUrl(item) !== parent) return item;
                const excluded: string[] = item.exclusions?.excludedUrls ?? [];
                if (excluded.includes(url)) return item;
                return { ...item, exclusions: { ...item.exclusions, excludedUrls: [...excluded, url] } };
            }));
        } else if (isWebsiteSource(ds)) {
            const url = sourceUrlOf(ds);
            set(next.filter((item) => entryUrl(item) !== url && item?.url !== ds.id));
        }
    }

    // A sitemap that just lost its last page — decided only for sitemaps we removed a page from,
    // so a sitemap that never scraped anything (and so never had pages) is left alone.
    const touched = new Set(removed.filter(isSitemapPage).map((ds) => ds.metadata!.fromSitemap as string));
    if (touched.size > 0) {
        const stillHasPages = (url: string) =>
            remaining.some((ds) => ds.metadata?.fromSitemap === url || (ds.type === 'website/sitemap' && sourceUrlOf(ds) === url));
        const drop = new Set(Array.from(touched).filter((url) => !stillHasPages(url)));
        if (drop.size > 0) set(next.filter((item) => !(item?.isSitemap && drop.has(entryUrl(item) as string))));
    }

    return next;
}

// ─────────────────────────────────────────────────────────────────────────────
// Scraped-file cleanup
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The stored file behind a scraped website source, or null if it has none.
 *
 * A scraped page lives in storage as a generated file belonging to this assistant alone
 * (unlike an uploaded file, which can also be in the library), so removing the source
 * leaves an orphan unless the file is deleted too. A source added in this session has no
 * file yet — its id is the page URL — and a sitemap placeholder never has one.
 */
export function scrapedFileKey(ds: AttachedDocument): string | null {
    if (ds.type !== 'website/url') return null;
    const raw = ds.key || ds.id;
    if (!raw || /^https?:\/\//i.test(raw)) return null;
    return raw.replace(/^s3:\/\//, '') || null;
}

/**
 * Which queued files to delete once a save has gone through: each once, minus any the
 * saved assistant still points at (a page can be removed and then re-included, and the
 * server may keep its existing file rather than scrape a new one).
 */
export function scrapedFilesToDelete(queued: readonly string[], savedSources: readonly AttachedDocument[]): string[] {
    const stillUsed = new Set<string>();
    savedSources.forEach((ds) => {
        const key = (ds.key || ds.id || '').replace(/^s3:\/\//, '');
        if (key) stillUsed.add(key);
    });
    return Array.from(new Set(queued.filter((key) => !!key && !stillUsed.has(key))));
}

// ─────────────────────────────────────────────────────────────────────────────
// Embedding status
// ─────────────────────────────────────────────────────────────────────────────

export type EmbeddingTone = 'success' | 'warning' | 'error' | 'neutral';

export interface EmbeddingBadge {
    label: string;
    tone: EmbeddingTone;
    /** Still working — render with the pulse. */
    busy: boolean;
    /** Hover text: label plus chunk counts / last update when known. */
    title: string;
}

export interface EmbeddingMetadata {
    failedChunks?: number;
    totalChunks?: number;
    lastUpdated?: string;
}

/**
 * Status string from the embedding-status endpoint → what to show. Labels match the
 * classic list (`getDocumentStatusConfig`) so support wording does not change.
 * Returns null for "no information" (`not_found`, unknown) — files that are never
 * embedded (images, video) land there and should show nothing rather than a dash.
 */
export function embeddingBadge(status: string | null | undefined, metadata?: EmbeddingMetadata): EmbeddingBadge | null {
    let label: string;
    let tone: EmbeddingTone;
    let busy = false;
    switch (status) {
        case 'starting': label = 'Starting'; tone = 'neutral'; busy = true; break;
        case 'processing': label = 'Processing'; tone = 'warning'; busy = true; break;
        case 'completed': label = 'Completed'; tone = 'success'; break;
        case 'failed': label = 'Failed'; tone = 'error'; break;
        case 'terminated': label = 'Error'; tone = 'error'; break;
        default: return null;
    }

    const details: string[] = [];
    if (metadata?.failedChunks !== undefined && metadata?.totalChunks !== undefined) {
        details.push(`${metadata.failedChunks}/${metadata.totalChunks} chunks failed`);
    }
    if (metadata?.lastUpdated) {
        const when = new Date(metadata.lastUpdated);
        if (!Number.isNaN(when.getTime())) details.push(`Updated: ${when.toLocaleString()}`);
    }
    return { label, tone, busy, title: [`Embedding status: ${label}`, ...details].join('\n') };
}

/**
 * One badge for a whole sitemap from its pages' statuses. Worst news wins:
 * any failure → "N failed", else anything in flight → "Processing", else
 * "Completed" only when every page is known to be complete.
 */
export function summarizeEmbeddingStatuses(statuses: Array<string | null | undefined>): EmbeddingBadge | null {
    const known = statuses.filter((s): s is string => !!embeddingBadge(s));
    if (known.length === 0) return null;

    const failed = known.filter((s) => s === 'failed' || s === 'terminated').length;
    if (failed > 0) {
        const label = `${failed} failed`;
        return { label, tone: 'error', busy: false, title: `Embedding status: ${failed} of ${statuses.length} pages failed` };
    }
    if (known.some((s) => s === 'processing' || s === 'starting')) {
        return { label: 'Processing', tone: 'warning', busy: true, title: 'Embedding status: some pages are still processing' };
    }
    if (known.length === statuses.length) {
        return { label: 'Completed', tone: 'success', busy: false, title: 'Embedding status: all pages completed' };
    }
    return null;
}
