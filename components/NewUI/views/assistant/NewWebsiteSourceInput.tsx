/**
 * NewWebsiteSourceInput — new-UI replacement for components/DataSources/
 * WebsiteURLInput inside the assistant editor.
 *
 * Same contract (`onAddURL(url, isSitemap, maxPages?, exclusions?)`) and the same
 * validation + sitemap-fetch logic as the old component; only the presentation is
 * rebuilt on design tokens. The old component is left untouched for the classic UI.
 *
 * Single page vs Sitemap is a SegmentedControl rather than a checkbox, because the
 * two modes take different inputs (a sitemap also needs a page cap) and a segmented
 * control makes the mode — and therefore the extra field — legible at a glance.
 *
 * The sitemap URL picker (SitemapUrlSelectionModal) is imported as-is: it portals to
 * document.body, so it can't be restyled from a wrapper here, and rebuilding it is
 * out of scope.
 */

import React, { useState } from 'react';
import {
    IconAlertTriangle,
    IconLoader2,
    IconPlus,
    IconSitemap,
    IconWorldWww,
} from '@tabler/icons-react';
import toast from 'react-hot-toast';
import { validateUrl } from '@/utils/app/data';
import { getSiteMapUrls } from '@/services/assistantService';
import {
    SitemapUrlSelectionModal,
    SitemapExclusions,
} from '@/components/DataSources/SitemapUrlSelectionModal';
import { SegmentedControl } from '@/components/NewUI/shared/SegmentedControl';

export interface NewWebsiteSourceInputProps {
    onAddURL: (
        url: string,
        isSitemap: boolean,
        maxPages?: number | undefined,
        exclusions?: SitemapExclusions,
    ) => void;
}

/** Default cap on how many sitemap URLs to pull, matching the old component. */
const DEFAULT_MAX_PAGES = 50;

const controlStyle: React.CSSProperties = {
    boxSizing: 'border-box',
    borderRadius: 8,
    border: '1px solid var(--border-subtle)',
    background: 'var(--bg-raised)',
    color: 'var(--text-primary)',
    fontSize: 13,
    fontFamily: 'inherit',
    padding: '8px 10px',
    outline: 'none',
};

export const NewWebsiteSourceInput: React.FC<NewWebsiteSourceInputProps> = ({ onAddURL }) => {
    const [url, setUrl] = useState('');
    const [isSitemap, setIsSitemap] = useState(false);
    const [maxPages, setMaxPages] = useState(DEFAULT_MAX_PAGES);
    const [unlimitedPages, setUnlimitedPages] = useState(false);
    const [urlError, setUrlError] = useState<string | null>(null);
    const [urlWarning, setUrlWarning] = useState<string | null>(null);

    // Sitemap picker state
    const [showSitemapModal, setShowSitemapModal] = useState(false);
    const [sitemapUrls, setSitemapUrls] = useState<string[]>([]);
    const [sitemapData, setSitemapData] = useState<{ totalUrls: number; maxPages: number } | null>(null);
    const [loadingSitemap, setLoadingSitemap] = useState(false);
    const [pendingSitemapUrl, setPendingSitemapUrl] = useState('');

    const resetAfterAdd = () => {
        setUrl('');
        setIsSitemap(false);
        setMaxPages(DEFAULT_MAX_PAGES);
        setUnlimitedPages(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const validation = validateUrl(url, isSitemap);

        if (!validation.isValid) {
            setUrlError(validation.error || 'Invalid URL');
            setUrlWarning(null);
            return;
        }
        if (!validation.sanitizedUrl) return;

        setUrlWarning(validation.warning || null);
        setUrlError(null);

        if (!isSitemap) {
            onAddURL(validation.sanitizedUrl, false, undefined);
            resetAfterAdd();
            return;
        }

        // Sitemaps: fetch the URL list first so the user can choose what to include.
        setLoadingSitemap(true);
        setPendingSitemapUrl(validation.sanitizedUrl);
        try {
            const result = await getSiteMapUrls(
                validation.sanitizedUrl,
                unlimitedPages ? undefined : maxPages,
            );
            if (result.success && result.data?.urls) {
                setSitemapUrls(result.data.urls);
                setSitemapData({
                    totalUrls: result.data.totalUrls || result.data.urls.length,
                    maxPages: result.data.maxPages || maxPages,
                });
                setShowSitemapModal(true);
            } else {
                toast.error(result.message || 'Failed to fetch sitemap URLs');
                setUrlError('Unable to fetch URLs from sitemap');
            }
        } catch (error) {
            console.error('Error fetching sitemap URLs:', error);
            setUrlError('Error fetching sitemap URLs');
        } finally {
            setLoadingSitemap(false);
        }
    };

    const handleSitemapConfirm = (
        selectedUrls: string[],
        exclusions: SitemapExclusions,
        adjustedMaxPages: number,
    ) => {
        onAddURL(
            pendingSitemapUrl,
            true,
            unlimitedPages ? undefined : adjustedMaxPages,
            exclusions,
        );
        setShowSitemapModal(false);
        setSitemapUrls([]);
        setSitemapData(null);
        setPendingSitemapUrl('');
        resetAfterAdd();
        toast.success(`Added ${selectedUrls.length} URLs from sitemap`);
    };

    return (
        <form
            onSubmit={handleSubmit}
            style={{
                border: '1px solid var(--border-subtle)',
                borderRadius: 10,
                padding: '12px 14px',
                marginBottom: 12,
                background: 'var(--bg-app)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
            }}
        >
            {/* Mode: a single page, or crawl a sitemap */}
            <div style={{ width: 260 }}>
                <SegmentedControl
                    size="xs"
                    aria-label="Website source type"
                    value={isSitemap ? 'sitemap' : 'page'}
                    onChange={(id) => {
                        const sitemap = id === 'sitemap';
                        setIsSitemap(sitemap);
                        if (!sitemap) {
                            setMaxPages(DEFAULT_MAX_PAGES);
                            setUnlimitedPages(false);
                        }
                        setUrlError(null);
                        setUrlWarning(null);
                    }}
                    items={[
                        { id: 'page', label: 'Single page', icon: <IconWorldWww size={13} /> },
                        { id: 'sitemap', label: 'Sitemap', icon: <IconSitemap size={13} /> },
                    ]}
                />
            </div>

            {/* URL + submit */}
            <div style={{ display: 'flex', gap: 8 }}>
                <input
                    type="text"
                    value={url}
                    onChange={(e) => {
                        setUrl(e.target.value);
                        if (urlError) setUrlError(null);
                        if (urlWarning) setUrlWarning(null);
                    }}
                    placeholder={
                        isSitemap
                            ? 'https://example.edu/sitemap.xml'
                            : 'https://example.edu/handbook'
                    }
                    aria-label={isSitemap ? 'Sitemap URL' : 'Website URL'}
                    aria-invalid={!!urlError}
                    style={{ ...controlStyle, flex: 1 }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
                />
                <button
                    type="submit"
                    disabled={loadingSitemap || !url.trim()}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '8px 14px',
                        borderRadius: 8,
                        border: 'none',
                        background:
                            loadingSitemap || !url.trim() ? 'var(--bg-active)' : 'var(--accent)',
                        color:
                            loadingSitemap || !url.trim() ? 'var(--text-muted)' : 'var(--accent-fg)',
                        fontSize: 13,
                        fontWeight: 500,
                        fontFamily: 'inherit',
                        cursor: loadingSitemap || !url.trim() ? 'not-allowed' : 'pointer',
                        whiteSpace: 'nowrap',
                    }}
                >
                    {loadingSitemap ? (
                        <>
                            <IconLoader2 size={14} className="animate-spin" />
                            Reading sitemap…
                        </>
                    ) : (
                        <>
                            <IconPlus size={14} />
                            Add
                        </>
                    )}
                </button>
            </div>

            {/* Sitemap-only: how many URLs to pull */}
            {isSitemap && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <label
                            htmlFor="nui-sitemap-cap"
                            style={{ fontSize: 12, color: 'var(--text-secondary)' }}
                        >
                            Pages to pull
                        </label>
                        <select
                            id="nui-sitemap-cap"
                            value={unlimitedPages ? 'unlimited' : 'limited'}
                            onChange={(e) => setUnlimitedPages(e.target.value === 'unlimited')}
                            style={{ ...controlStyle, padding: '6px 8px', cursor: 'pointer' }}
                        >
                            <option value="limited">Up to</option>
                            <option value="unlimited">Every URL</option>
                        </select>
                        {unlimitedPages ? (
                            <span style={{ fontSize: 12, color: 'var(--text-error)' }}>
                                Not recommended for large sitemaps
                            </span>
                        ) : (
                            <>
                                <input
                                    type="number"
                                    min={1}
                                    max={1000}
                                    value={maxPages}
                                    onChange={(e) => setMaxPages(parseInt(e.target.value) || DEFAULT_MAX_PAGES)}
                                    aria-label="Maximum number of sitemap URLs"
                                    style={{ ...controlStyle, padding: '6px 8px', width: 78 }}
                                />
                                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                    URLs from the sitemap
                                </span>
                            </>
                        )}
                    </div>
                    <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                        Common formats: example.com/sitemap.xml, example.org/sitemap_index.txt
                    </span>
                </div>
            )}

            {/* Validation feedback — text colour only, no coloured panels */}
            {(urlError || urlWarning) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {urlError && (
                        <span
                            role="alert"
                            style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: 6,
                                fontSize: 12,
                                color: 'var(--text-error)',
                            }}
                        >
                            <IconAlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                            {urlError}
                        </span>
                    )}
                    {urlWarning && (
                        <span
                            style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: 6,
                                fontSize: 12,
                                color: 'var(--text-secondary)',
                            }}
                        >
                            <IconAlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                            {urlWarning}
                        </span>
                    )}
                </div>
            )}

            {showSitemapModal && sitemapData && (
                <SitemapUrlSelectionModal
                    sitemapUrl={pendingSitemapUrl}
                    urls={sitemapUrls}
                    totalUrls={sitemapData.totalUrls}
                    maxPages={sitemapData.maxPages}
                    onConfirm={handleSitemapConfirm}
                    onCancel={() => {
                        setShowSitemapModal(false);
                        setSitemapUrls([]);
                        setSitemapData(null);
                        setPendingSitemapUrl('');
                    }}
                />
            )}
        </form>
    );
};

export default NewWebsiteSourceInput;
