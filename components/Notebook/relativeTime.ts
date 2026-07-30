// Approximation of date-fns's formatDistanceToNow(..., { addSuffix: true }),
// which the open-notebook reference UI uses for all timestamps. Keeping the
// same phrasing ("about 2 hours ago") so the ported pages read identically.
export const formatDistanceToNow = (iso?: string): string => {
    if (!iso) return '';
    const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T'));
    if (isNaN(d.getTime())) return '';
    const rawSeconds = Math.round((Date.now() - d.getTime()) / 1000);
    // A timestamp "in the future" relative to this client (server/client
    // clock skew, or a genuinely future scheduled item) previously fell
    // through the same descending magnitude checks below using a negative
    // `seconds`/`minutes`/etc, which — depending on rounding — could produce
    // backwards or literally negative text (e.g. "-73 minutes ago"). Treat
    // anything more than a small skew tolerance in the future as its own
    // case, mirroring date-fns's "in X" phrasing instead.
    const future = rawSeconds < -30;
    const seconds = Math.abs(rawSeconds);
    const minutes = Math.round(seconds / 60);
    const hours = Math.round(minutes / 60);
    const days = Math.round(hours / 24);
    const months = Math.round(days / 30.44);
    const years = Math.round(days / 365.25);

    const magnitude = (() => {
        if (seconds < 30) return 'less than a minute';
        if (minutes < 2) return '1 minute';
        if (minutes < 45) return `${minutes} minutes`;
        if (minutes < 90) return 'about 1 hour';
        if (hours < 24) return `about ${hours} hours`;
        if (days < 2) return '1 day';
        if (days < 30) return `${days} days`;
        if (months < 2) return 'about 1 month';
        if (months < 12) return `${months} months`;
        if (years < 2) return 'about 1 year';
        return `over ${years} years`;
    })();

    if (future) return magnitude === 'less than a minute' ? 'in less than a minute' : `in ${magnitude}`;
    return `${magnitude} ago`;
};
