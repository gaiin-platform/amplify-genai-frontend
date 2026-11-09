import { describe, it, expect } from 'vitest';
import {
    DEFAULT_DRIVE_SCHEDULE,
    describeDriveSchedule,
    describeLastScanned,
    formatClockTime,
    normalizeScanFrequency,
    scheduleBadge,
    setWebsiteScanFrequency,
    toggleDriveSchedule,
    websiteFrequencyLabel,
    websiteScheduleRows,
    withDriveDefaults,
} from '../refreshScheduleModel';

const ds = (id: string, metadata: Record<string, any>): any => ({ id, name: id, type: 'website/url', raw: null, data: null, metadata: { totalTokens: 5, ...metadata } });

describe('normalizeScanFrequency', () => {
    it.each([[7, 7], ['30', 30], [1, 1]])('%j → %j', (input, out) => expect(normalizeScanFrequency(input)).toBe(out));
    it.each([null, undefined, 0, -1, 1.5, NaN, '', 'abc', {}])('%j → null', (input) => expect(normalizeScanFrequency(input)).toBeNull());
});

describe('websiteScheduleRows', () => {
    it('reads defensively: skips junk and addressless entries, dedupes, prefers sourceUrl', () => {
        const rows = websiteScheduleRows([
            null,
            'x',
            {},
            { url: 'https://a.test', scanFrequency: 7, lastScanned: '2026-01-01T00:00:00' },
            { url: 'https://ignored.test', sourceUrl: 'https://b.test', isSitemap: true },
            { sourceUrl: 'https://a.test' },
            { url: 'https://c.test', type: 'website/sitemap', scanFrequency: 'oops' },
        ]);
        expect(rows).toEqual([
            { sourceUrl: 'https://a.test', isSitemap: false, scanFrequency: 7, lastScanned: '2026-01-01T00:00:00' },
            { sourceUrl: 'https://b.test', isSitemap: true, scanFrequency: null, lastScanned: null },
            { sourceUrl: 'https://c.test', isSitemap: true, scanFrequency: null, lastScanned: null },
        ]);
    });

    it('is empty for a non-array', () => {
        expect(websiteScheduleRows(undefined)).toEqual([]);
        expect(websiteScheduleRows({})).toEqual([]);
    });
});

describe('setWebsiteScanFrequency', () => {
    it('updates the entry and only its own data source for a single page', () => {
        const urls = [{ url: 'https://a.test', sourceUrl: 'https://a.test' }, { url: 'https://b.test', sourceUrl: 'https://b.test' }];
        const sources = [ds('a', { sourceUrl: 'https://a.test' }), ds('b', { sourceUrl: 'https://b.test' })];
        const out = setWebsiteScanFrequency(urls, sources, 'https://a.test', 7);
        expect(out.websiteUrls[0].scanFrequency).toBe(7);
        expect(out.websiteUrls[1]).toBe(urls[1]);
        expect(out.dataSources[0].metadata?.scanFrequency).toBe(7);
        expect(out.dataSources[1]).toBe(sources[1]);
        expect(urls[0]).not.toHaveProperty('scanFrequency'); // input untouched
    });

    it('fans a sitemap out to every page it produced', () => {
        const urls = [{ url: 'https://s.test/map.xml', sourceUrl: 'https://s.test/map.xml', isSitemap: true }];
        const sources = [ds('p1', { fromSitemap: 'https://s.test/map.xml' }), ds('p2', { fromSitemap: 'https://s.test/map.xml' }), ds('other', { sourceUrl: 'https://o.test' })];
        const out = setWebsiteScanFrequency(urls, sources, 'https://s.test/map.xml', 30);
        expect(out.dataSources.map((d) => d.metadata?.scanFrequency)).toEqual([30, 30, undefined]);
    });

    it('clears the schedule with null and treats an invalid value as none', () => {
        const urls = [{ url: 'u', sourceUrl: 'u', scanFrequency: 7 }];
        expect(setWebsiteScanFrequency(urls, [], 'u', null).websiteUrls[0].scanFrequency).toBeNull();
        expect(setWebsiteScanFrequency(urls, [], 'u', 0).websiteUrls[0].scanFrequency).toBeNull();
    });

    it('keeps an unknown url as is', () => {
        const urls = [{ url: 'u', sourceUrl: 'u' }];
        expect(setWebsiteScanFrequency(urls, [], 'missing', 7).websiteUrls).toEqual(urls);
    });
});

describe('websiteFrequencyLabel', () => {
    it('names presets and spells out custom day counts', () => {
        expect(websiteFrequencyLabel(null)).toBe('Don’t refresh');
        expect(websiteFrequencyLabel(1)).toBe('Daily');
        expect(websiteFrequencyLabel(90)).toBe('Quarterly');
        expect(websiteFrequencyLabel(14)).toBe('Every 14 days');
    });
});

describe('describeLastScanned', () => {
    const now = new Date('2026-06-10T12:00:00Z');
    it('reads a zone-less stamp as UTC and picks the largest unit', () => {
        expect(describeLastScanned('2026-06-07T12:00:00', now)).toBe('Last checked 3 days ago');
        expect(describeLastScanned('2026-06-10T09:00:00Z', now)).toBe('Last checked 3 hours ago');
        expect(describeLastScanned('2026-06-10T11:59:00Z', now)).toBe('Last checked 1 minute ago');
        expect(describeLastScanned('2026-06-10T12:00:00Z', now)).toBe('Last checked just now');
    });
    it('says not scanned for nothing or garbage', () => {
        expect(describeLastScanned(null, now)).toBe('Not scanned yet');
        expect(describeLastScanned('not a date', now)).toBe('Not scanned yet');
    });
});

describe('drive schedule', () => {
    it('toggling on picks a frequency; off clears it', () => {
        const on = toggleDriveSchedule(withDriveDefaults({ enabled: false, frequency: 'none' }), true);
        expect(on).toMatchObject({ enabled: true, frequency: 'weekly' });
        expect(toggleDriveSchedule({ ...on, frequency: 'monthly' }, true).frequency).toBe('monthly');
        expect(toggleDriveSchedule(on, false)).toMatchObject({ enabled: false, frequency: 'none' });
    });

    it('fills what a parsed cron leaves out without overriding what it has', () => {
        expect(withDriveDefaults({ enabled: true, frequency: 'daily', time: '07:15' })).toEqual({
            enabled: true, frequency: 'daily', time: '07:15', dayOfWeek: 1, dayOfMonth: 1,
        });
        expect(withDriveDefaults({ enabled: true, frequency: 'weekly', dayOfWeek: 0 }).dayOfWeek).toBe(0);
    });

    it('describes each frequency in words, and nothing when off', () => {
        const base = { ...DEFAULT_DRIVE_SCHEDULE, enabled: true, time: '14:30' };
        expect(describeDriveSchedule({ ...base, frequency: 'daily' })).toBe('Every day at 2:30 PM');
        expect(describeDriveSchedule({ ...base, frequency: 'weekly', dayOfWeek: 5 })).toBe('Every Friday at 2:30 PM');
        expect(describeDriveSchedule({ ...base, frequency: 'monthly', dayOfMonth: 22 })).toBe('On the 22nd of every month at 2:30 PM');
        expect(describeDriveSchedule({ ...base, frequency: 'quarterly', dayOfMonth: 11 })).toBe('On the 11th every 3 months at 2:30 PM');
        expect(describeDriveSchedule({ ...base, enabled: false })).toBe('');
        expect(describeDriveSchedule(null)).toBe('');
    });

    it('formats clock times', () => {
        expect(formatClockTime('00:05')).toBe('12:05 AM');
        expect(formatClockTime('12:00')).toBe('12:00 PM');
        expect(formatClockTime('09:00')).toBe('9:00 AM');
        expect(formatClockTime('nope')).toBe('nope');
        expect(formatClockTime(undefined)).toBe('');
    });
});

describe('scheduleBadge', () => {
    const row = (scanFrequency: number | null) => ({ sourceUrl: String(Math.random()), isSitemap: false, scanFrequency, lastScanned: null });
    it('counts scheduled websites and an enabled drive schedule', () => {
        expect(scheduleBadge([row(7), row(null)], null)).toBe('1 scheduled');
        expect(scheduleBadge([row(7)], { enabled: true, frequency: 'daily' })).toBe('2 scheduled');
        expect(scheduleBadge([row(null)], { enabled: false, frequency: 'none' })).toBeUndefined();
    });
});
