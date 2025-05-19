

// for future rate limit tab

import { PeriodType, periodTypes, UNLIMITED } from "@/types/rateLimit";
import React from "react";
import { FC } from "react";



interface RateLimitProps {
    period: PeriodType;
    setPeriod: (s:PeriodType) => void;
    rate: string;
    setRate: (s:string) => void; 
}

export const RateLimiter: FC<RateLimitProps> = ({period, setPeriod, rate, setRate}) => {
    
    const calcCostWidth = () => {
        return Math.max(44 + ((rate.length - 5) * 9), 44);
    }

    const formatDollar = (value: string) => {
        if (value.length > 8)return rate;
        const numericValue = value.replace(/[^\d]/g, '');
        const integerValue = parseInt(numericValue, 10);
        if (isNaN(integerValue)) {
            return '$0.00';
        }
        const dollars = Math.floor(integerValue / 100);
        const cents = integerValue % 100;
        return `$${dollars}.${cents.toString().padStart(2, '0')}`;
    };
    
    return (
            <>
            <select
                id="rateLimitType"
                className="rounded border-gray-300 p-0.5 text-neutral-900 dark:text-neutral-100 shadow-sm dark:bg-[#40414F] focus:border-neutral-700 focus:ring focus:ring-neutral-500 focus:ring-opacity-50  custom-shadow"
                style={{ width: '92px'}}
                value={period}
                onChange={(e) => setPeriod(e.target.value as PeriodType)}
            >
                {periodTypes.map(p =>  <option key={p} className="ml-6" value={p}>{p}</option>)}
            </select>

            {period !== UNLIMITED && (
                <div className='mt-1'>
                    <input
                        style={{ width: `${calcCostWidth()}px`, textAlign: 'right' }}
                        type="text"
                        placeholder="$0.00"
                        id="rateLimitAmount"
                        className="rounded border-gray-300  text-neutral-900 shadow-sm focus:border-neutral-500 focus:ring focus:ring-neutral-500 focus:ring-opacity-50 w-full"
                        value={rate}
                        onChange={(e) => setRate(formatDollar(e.target.value))}
                    />

                </div>
            )}
            </>)

}