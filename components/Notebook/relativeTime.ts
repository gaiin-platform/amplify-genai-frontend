// Approximation of date-fns's formatDistanceToNow(..., { addSuffix: true }),
// which the open-notebook reference UI uses for all timestamps. Keeping the
// same phrasing ("about 2 hours ago") so the ported pages read identically.
export const formatDistanceToNow = (iso?: string): string => {
    if (!iso) return '';
    const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T'));
    if (isNaN(d.getTime())) return '';
    const seconds = Math.round((Date.now() - d.getTime()) / 1000);
    const minutes = Math.round(seconds / 60);
    const hours = Math.round(minutes / 60);
    const days = Math.round(hours / 24);
    const months = Math.round(days / 30.44);
    const years = Math.round(days / 365.25);
    if (seconds < 30) return 'less than a minute ago';
    if (minutes < 2) return '1 minute ago';
    if (minutes < 45) return `${minutes} minutes ago`;
    if (minutes < 90) return 'about 1 hour ago';
    if (hours < 24) return `about ${hours} hours ago`;
    if (days < 2) return '1 day ago';
    if (days < 30) return `${days} days ago`;
    if (months < 2) return 'about 1 month ago';
    if (months < 12) return `${months} months ago`;
    if (years < 2) return 'about 1 year ago';
    return `over ${years} years ago`;
};
