const toTime = (iso?: string): number => {
    const t = iso ? new Date(iso).getTime() : NaN;
    return Number.isFinite(t) ? t : 0;
};

export const formatDate = (iso?: string): string => {
    const t = toTime(iso);
    if (!t) return '';
    return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

/** "just now", "5 min ago", "3 h ago", "Yesterday", "4 d ago", else a date. */
export const formatRelative = (iso?: string, now: number = Date.now()): string => {
    const t = toTime(iso);
    if (!t) return '';
    const seconds = Math.max(0, Math.round((now - t) / 1000));
    if (seconds < 60) return 'just now';
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} h ago`;
    const days = Math.round(hours / 24);
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} d ago`;
    return formatDate(iso);
};

export const latestTimestamp = (...values: Array<string | undefined>): string => {
    let best = 0;
    let bestValue = '';
    for (const value of values) {
        const t = toTime(value);
        if (t > best) {
            best = t;
            bestValue = value as string;
        }
    }
    return bestValue;
};
