

// for future rate limit tab

import { FC } from "react";



interface RateLimitProps {
    rateLimitType: string;
    setRateLimitType: (s:string) => void;
    costAmount: string;
    setCostAmount: (s:string) => void;
}

export const RatePeriodLimit: FC<RateLimitProps> = ({rateLimitType, setRateLimitType, costAmount, setCostAmount}) => {
    
    const calcCostWidth = () => {
        return Math.max(44 + ((costAmount.length - 5) * 9), 44);
    }

    const formatDollar = (value: string) => {
        if (value.length > 8)return costAmount;
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
                className="rounded border-gray-300 p-0.5 text-neutral-900 dark:text-neutral-100 shadow-sm dark:bg-[#40414F] focus:border-neutral-700 focus:ring focus:ring-neutral-500 focus:ring-opacity-50"
                style={{ width: '85px'}}
                value={rateLimitType}
                onChange={(e) => setRateLimitType(e.target.value)}
            >
                <option className="ml-6" value="Unlimited">Unlimited</option>
                <option className="ml-6" value="Monthly">Monthly</option>
                <option className="ml-6" value="Weekly">Weekly</option>
                <option className="ml-6" value="Hourly">Hourly</option>
            </select>

            {rateLimitType !== 'Unlimited' && (
                <div className='mt-1'>
                    <input
                        style={{ width: `${calcCostWidth()}px`, textAlign: 'right' }}
                        type="text"
                        placeholder="$0.00"
                        className="rounded border-gray-300 p-0.5 text-neutral-900 shadow-sm focus:border-neutral-500 focus:ring focus:ring-neutral-500 focus:ring-opacity-50 w-full"
                        value={costAmount}
                        onChange={(e) => setCostAmount(formatDollar(e.target.value))}
                    />

                </div>
            )}
            </>)

}