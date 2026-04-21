export interface RateLimit {
    period: PeriodType;
    rate: number | null;
}

// A list of rate limits (admin/group can have multiple simultaneous limits)
export type RateLimits = RateLimit[];

export const periodTypes = ["Unlimited", "Daily", "Hourly", "Monthly", "Total"] as const;
export type PeriodType = typeof periodTypes[number];


export const UNLIMITED: PeriodType = 'Unlimited';

export const formatRateLimit = (limits: RateLimit) =>  {
    if (limits.rate === null || limits.rate === undefined) return noRateLimit.period;
    return `$${limits.rate.toFixed(2)}/${limits.period}`;
}

export const noRateLimit: RateLimit = {'period' : UNLIMITED, 'rate': null};


export const rateLimitObj = (period: PeriodType, rate: string) => {
    return period === UNLIMITED ? noRateLimit : {'period' : period, 'rate': Number(rate.replace('$', ''))} as RateLimit
}

/**
 * Normalize a single RateLimit or RateLimit[] into always RateLimit[].
 * Handles backward compatibility with old single-object storage format.
 */
export const normalizeRateLimits = (limitOrList: RateLimit | RateLimit[] | null | undefined): RateLimit[] => {
    if (!limitOrList) return [];
    if (Array.isArray(limitOrList)) return limitOrList.filter(l => l && l.period);
    return [limitOrList];
};

/**
 * Find the monthly limit from a list (used for MTD utilization display).
 * Returns the most restrictive (lowest rate) monthly limit if multiple exist.
 */
export const getMonthlyLimit = (limits: RateLimit[]): RateLimit | null => {
    const monthlyLimits = limits.filter(l => l.period === 'Monthly' && l.rate !== null);
    if (monthlyLimits.length === 0) return null;
    return monthlyLimits.reduce((min, curr) =>
        (curr.rate as number) < (min.rate as number) ? curr : min
    );
};

/**
 * Format a list of rate limits as a compact display string, e.g. "$300.00/Monthly + $30.00/Hourly"
 */
export const formatRateLimits = (limits: RateLimit[]): string => {
    const active = limits.filter(l => l.rate !== null && l.period !== 'Unlimited');
    if (active.length === 0) return 'Unlimited';
    return active.map(l => formatRateLimit(l)).join(' | ');
};