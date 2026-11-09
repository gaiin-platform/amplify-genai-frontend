/**
 * Refresh-schedule vocabulary for an assistant's website and OneDrive/SharePoint sources — the
 * React-free half of "keep attachments up to date".
 *
 * Two different shapes, because the backend has two different jobs:
 *   - Websites: each URL carries its own `scanFrequency` (days). The scheduled task wakes up often
 *     enough for the shortest one (`utils/app/scheduledTasks#determineWebsiteScanCron`) and the
 *     backend rescans only the URLs that are due.
 *   - Drive files: one schedule for the whole assistant (`DriveRescanSchedule`: frequency, time of day,
 *     day of week / month) that becomes the task's cron expression.
 *
 * Both are saved as scheduled tasks whose ids ride on `data.scheduledTaskIds` (see `rescanTaskSync`).
 * No React imports.
 */

import type { AttachedDocument } from '@/types/attacheddocument';
import type { DriveRescanSchedule } from '@/components/Promptbar/components/AssistantModalComponents/AssistantDriveDataSources';

// ── Websites ─────────────────────────────────────────────────────────────

export const WEBSITE_FREQUENCIES: readonly { days: number; label: string }[] = [
    { days: 1, label: 'Daily' },
    { days: 7, label: 'Weekly' },
    { days: 30, label: 'Monthly' },
    { days: 90, label: 'Quarterly' },
];

export interface WebsiteScheduleRow {
    /** The URL the user added (a sitemap's own URL for a sitemap). Identifies the row. */
    sourceUrl: string;
    isSitemap: boolean;
    /** Days between rescans, or `null` for a one-time scan. */
    scanFrequency: number | null;
    lastScanned: string | null;
}

/** A usable "days between scans": a positive whole number. Anything else means no schedule. */
export const normalizeScanFrequency = (value: unknown): number | null => {
    const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
    return typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : null;
};

/**
 * One row per website the user added. `websiteUrls` comes off the stored assistant, so entries are
 * read defensively: no address, no row; the same address twice, one row.
 */
export const websiteScheduleRows = (websiteUrls: unknown): WebsiteScheduleRow[] => {
    if (!Array.isArray(websiteUrls)) return [];
    const seen = new Set<string>();
    const rows: WebsiteScheduleRow[] = [];
    for (const item of websiteUrls) {
        if (!item || typeof item !== 'object') continue;
        const record = item as Record<string, unknown>;
        const sourceUrl = typeof record.sourceUrl === 'string' && record.sourceUrl
            ? record.sourceUrl
            : typeof record.url === 'string' ? record.url : '';
        if (!sourceUrl || seen.has(sourceUrl)) continue;
        seen.add(sourceUrl);
        rows.push({
            sourceUrl,
            isSitemap: record.isSitemap === true || record.type === 'website/sitemap',
            scanFrequency: normalizeScanFrequency(record.scanFrequency),
            lastScanned: typeof record.lastScanned === 'string' && record.lastScanned ? record.lastScanned : null,
        });
    }
    return rows;
};

const urlKey = (item: Record<string, any>) => item.sourceUrl ?? item.url;

/**
 * Set one website's rescan frequency everywhere the backend and the schedule read it: the
 * `websiteUrls` entry (what the backend rescans from) and the matching data sources' metadata
 * (what the cron is derived from). A sitemap fans out into many data sources, so its children are
 * matched by `fromSitemap`. Returns new arrays; nothing is mutated.
 */
export const setWebsiteScanFrequency = (
    websiteUrls: any[],
    dataSources: AttachedDocument[],
    sourceUrl: string,
    days: number | null,
): { websiteUrls: any[]; dataSources: AttachedDocument[] } => {
    const frequency = normalizeScanFrequency(days);
    const target = websiteUrls.find((item) => item && urlKey(item) === sourceUrl);
    const isSitemap = !!target && (target.isSitemap === true || target.type === 'website/sitemap');

    return {
        websiteUrls: websiteUrls.map((item) =>
            item && urlKey(item) === sourceUrl ? { ...item, scanFrequency: frequency } : item,
        ),
        dataSources: dataSources.map((ds) => {
            const meta = ds.metadata;
            const belongs = isSitemap
                ? meta?.fromSitemap === sourceUrl || meta?.sourceUrl === sourceUrl
                : meta?.sourceUrl === sourceUrl;
            return belongs
                ? { ...ds, metadata: { ...meta, totalTokens: meta?.totalTokens || 0, scanFrequency: frequency } }
                : ds;
        }),
    };
};

/** "Every 14 days" for a value the presets don't cover, else the preset's name. */
export const websiteFrequencyLabel = (days: number | null): string => {
    if (days === null) return 'Don’t refresh';
    const preset = WEBSITE_FREQUENCIES.find((f) => f.days === days);
    return preset ? preset.label : `Every ${days} days`;
};

/**
 * "Last checked 3 days ago". The backend stamps UTC without a zone suffix, so it is read as UTC.
 * `now` is a parameter so this stays testable.
 */
export const describeLastScanned = (lastScanned: string | null, now: Date = new Date()): string => {
    if (!lastScanned) return 'Not scanned yet';
    const date = new Date(lastScanned.endsWith('Z') ? lastScanned : `${lastScanned}Z`);
    if (Number.isNaN(date.getTime())) return 'Not scanned yet';
    const diffMs = now.getTime() - date.getTime();
    const days = Math.floor(diffMs / 86_400_000);
    if (days > 0) return `Last checked ${days} day${days > 1 ? 's' : ''} ago`;
    const hours = Math.floor(diffMs / 3_600_000);
    if (hours > 0) return `Last checked ${hours} hour${hours > 1 ? 's' : ''} ago`;
    const minutes = Math.floor(diffMs / 60_000);
    if (minutes > 0) return `Last checked ${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Last checked just now';
};

// ── Drive files ──────────────────────────────────────────────────────────

export const DEFAULT_DRIVE_SCHEDULE: DriveRescanSchedule = {
    enabled: false,
    frequency: 'none',
    time: '09:00',
    dayOfWeek: 1,
    dayOfMonth: 1,
};

export const DRIVE_FREQUENCIES: readonly { id: Exclude<DriveRescanSchedule['frequency'], 'none'>; label: string }[] = [
    { id: 'daily', label: 'Daily' },
    { id: 'weekly', label: 'Weekly' },
    { id: 'monthly', label: 'Monthly' },
    { id: 'quarterly', label: 'Quarterly' },
];

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

/** Fill what a schedule parsed from a cron expression leaves out (it has no day for a daily one). */
export const withDriveDefaults = (schedule: DriveRescanSchedule): DriveRescanSchedule => ({
    ...DEFAULT_DRIVE_SCHEDULE,
    ...schedule,
    time: schedule.time || DEFAULT_DRIVE_SCHEDULE.time,
    dayOfWeek: schedule.dayOfWeek ?? DEFAULT_DRIVE_SCHEDULE.dayOfWeek,
    dayOfMonth: schedule.dayOfMonth ?? DEFAULT_DRIVE_SCHEDULE.dayOfMonth,
});

/** Turn the schedule on or off, choosing a sensible frequency when turning on from "none". */
export const toggleDriveSchedule = (schedule: DriveRescanSchedule, enabled: boolean): DriveRescanSchedule => ({
    ...schedule,
    enabled,
    frequency: enabled ? (schedule.frequency === 'none' ? 'weekly' : schedule.frequency) : 'none',
});

const ordinal = (n: number): string => {
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
    return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
};

/** "09:30" → "9:30 AM". An unparseable value is shown as typed. */
export const formatClockTime = (time: string | undefined): string => {
    const match = /^(\d{1,2}):(\d{2})$/.exec(time ?? '');
    if (!match) return time ?? '';
    const hour = Number(match[1]);
    const minute = match[2];
    if (hour > 23) return time ?? '';
    return `${hour % 12 === 0 ? 12 : hour % 12}:${minute} ${hour < 12 ? 'AM' : 'PM'}`;
};

/** One sentence for a drive schedule — "Every Monday at 9:00 AM". Empty when it is off. */
export const describeDriveSchedule = (schedule: DriveRescanSchedule | null): string => {
    if (!schedule || !schedule.enabled || schedule.frequency === 'none') return '';
    const at = formatClockTime(schedule.time || DEFAULT_DRIVE_SCHEDULE.time);
    const day = schedule.dayOfMonth ?? DEFAULT_DRIVE_SCHEDULE.dayOfMonth!;
    switch (schedule.frequency) {
        case 'daily': return `Every day at ${at}`;
        case 'weekly': return `Every ${WEEKDAYS[schedule.dayOfWeek ?? 1] ?? 'Monday'} at ${at}`;
        case 'monthly': return `On the ${ordinal(day)} of every month at ${at}`;
        case 'quarterly': return `On the ${ordinal(day)} every 3 months at ${at}`;
        default: return '';
    }
};

// ── Summary ──────────────────────────────────────────────────────────────

/** The card's badge — how many sources are on a schedule — or `undefined` when none is. */
export const scheduleBadge = (rows: WebsiteScheduleRow[], drive: DriveRescanSchedule | null): string | undefined => {
    const scheduled = rows.filter((r) => r.scanFrequency !== null).length + (drive?.enabled && drive.frequency !== 'none' ? 1 : 0);
    return scheduled > 0 ? `${scheduled} scheduled` : undefined;
};
