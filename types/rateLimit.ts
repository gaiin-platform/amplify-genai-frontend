export interface RateLimit {
    period: PeriodType;
    rate: number | null;
}


export type PeriodType = "Unlimited" | "Daily" | "Hourly" | "Monthly";

export const UNLIMITED: PeriodType = 'Unlimited';

export const formatRateLimit = (limits: RateLimit) =>  {
    if (!limits.rate) return noRateLimit.period;
    return `${limits.rate.toFixed(2)}/${limits.period}`;
}

export const noRateLimit: RateLimit = {'period' : UNLIMITED, 'rate': null};


export const rateLimitObj = (period: PeriodType, rate: string) => {
    return period === UNLIMITED ? noRateLimit : {'period' : period, 'rate': Number(rate.replace('$', ''))} as RateLimit
}