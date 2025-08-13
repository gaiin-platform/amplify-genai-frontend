export interface RateLimit {
    period: PeriodType;
    rate: number | null;
}

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