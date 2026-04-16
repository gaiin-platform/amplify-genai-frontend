import React, { useEffect, useState } from 'react';
import {
    IconX,
    IconTrendingUp,
    IconTrendingDown,
    IconMinus,
    IconLoader2,
    IconCreditCard,
    IconClock,
    IconChartBar,
    IconWallet,
} from '@tabler/icons-react';
import { getUserMtdCosts, getUserCostHistory, UserMtdCosts, UserCostHistory } from '@/services/mtdCostService';
import { RateLimitUtilization } from './RateLimitUtilization';

interface Props {
    email: string;
    onClose: () => void;
}

const fmt = (n: number) => `$${n.toFixed(2)}`;

const utcToLocalHours = (hourlyCost: number[]): { hour: number; label: string; cost: number }[] => {
    const offsetMinutes = new Date().getTimezoneOffset();
    const offsetHours = offsetMinutes / 60;
    return Array.from({ length: 24 }, (_, utcHour) => {
        const localHour = ((utcHour - offsetHours) % 24 + 24) % 24;
        const label = localHour === 0 ? '12a' : localHour < 12 ? `${localHour}a` : localHour === 12 ? '12p' : `${localHour - 12}p`;
        return { hour: localHour, label, cost: hourlyCost[utcHour] || 0 };
    }).sort((a, b) => a.hour - b.hour);
};

const currentLocalHour = () => new Date().getHours();

export const UserCostBreakdownModal: React.FC<Props> = ({ email, onClose }) => {
    const [mtd, setMtd] = useState<UserMtdCosts | null>(null);
    const [history, setHistory] = useState<UserCostHistory | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            const [mtdResult, histResult] = await Promise.all([
                getUserMtdCosts(),
                getUserCostHistory(email, 6),
            ]);
            if (mtdResult.success) setMtd(mtdResult.data);
            if (histResult.success) setHistory(histResult.data ?? null);
            setLoading(false);
        };
        load();
    }, [email]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    const hourlyData = mtd ? utcToLocalHours(mtd.hourlyCost) : [];
    const maxHourlyCost = Math.max(...hourlyData.map(h => h.cost), 0.01);
    const nowHour = currentLocalHour();

    const trend = history?.summary?.trend;
    const TrendIcon = trend?.direction === 'up' ? IconTrendingUp : trend?.direction === 'down' ? IconTrendingDown : IconMinus;
    const trendColor = trend?.direction === 'up' ? 'text-red-500' : trend?.direction === 'down' ? 'text-green-500' : 'text-neutral-400';

    const historyBars = history?.history?.slice(0, 6).reverse() ?? [];
    const maxHistoryCost = Math.max(...historyBars.map(m => m.totalCost), 0.01);
    const maxAccountCost = Math.max(...(mtd?.accounts?.map(a => a.totalCost) ?? []), 0.01);

    return (
        <div
            className="fixed inset-0 z-[10000] flex items-center justify-center p-6"
            onClick={onClose}
        >
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

            <div
                className="relative w-[95vw] max-w-7xl max-h-[90vh] flex flex-col bg-white dark:bg-[#2b2c36] rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-600 overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-8 py-5 border-b border-neutral-200 dark:border-neutral-600 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30">
                            <IconWallet size={22} className="text-blue-500 dark:text-blue-400" />
                        </div>
                        <div>
                            <div className="text-xl font-bold text-neutral-900 dark:text-neutral-100">Cost Breakdown</div>
                            <div className="text-sm text-neutral-400 dark:text-neutral-500">{email}</div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                    >
                        <IconX size={20} className="text-neutral-500 dark:text-neutral-400" />
                    </button>
                </div>

                {/* Scrollable body */}
                <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-32 gap-4">
                            <IconLoader2 size={40} className="animate-spin text-blue-500" />
                            <div className="text-base text-neutral-400">Loading your usage data…</div>
                        </div>
                    ) : (
                        <>
                            {/* Summary Cards */}
                            <div className="grid grid-cols-3 gap-5">
                                {[
                                    { label: 'Today', value: mtd?.dailyCost ?? 0, sub: 'current day spend', icon: <IconClock size={20} />, colorClass: 'text-blue-500 dark:text-blue-400', bgClass: 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800/40' },
                                    { label: 'Prior Days', value: mtd?.monthlyCost ?? 0, sub: 'carried this month', icon: <IconCreditCard size={20} />, colorClass: 'text-indigo-500 dark:text-indigo-400', bgClass: 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800/40' },
                                    { label: 'MTD Total', value: mtd?.totalCost ?? 0, sub: 'month-to-date', icon: <IconWallet size={20} />, colorClass: 'text-violet-500 dark:text-violet-400', bgClass: 'bg-violet-50 dark:bg-violet-900/20 border-violet-100 dark:border-violet-800/40' },
                                ].map(({ label, value, sub, icon, colorClass, bgClass }) => (
                                    <div key={label} className={`rounded-xl border p-6 flex flex-col gap-2 ${bgClass}`}>
                                        <div className={`flex items-center gap-2 text-sm font-semibold ${colorClass}`}>
                                            {icon}
                                            <span>{label}</span>
                                        </div>
                                        <div className="text-4xl font-bold text-neutral-900 dark:text-neutral-100 tabular-nums mt-1">
                                            {fmt(value)}
                                        </div>
                                        <div className="text-xs text-neutral-400 dark:text-neutral-500">{sub}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Two-column layout */}
                            <div className="grid grid-cols-2 gap-5">

                                {/* LEFT: Hourly + History */}
                                <div className="space-y-5">

                                    {/* Hourly Activity */}
                                    <div className="rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 p-6">
                                        <div className="flex items-center justify-between mb-5">
                                            <div className="flex items-center gap-2">
                                                <IconClock size={16} className="text-neutral-400" />
                                                <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">Today's Hourly Activity</span>
                                            </div>
                                            <span className="text-xs text-neutral-400">local time · hover for $</span>
                                        </div>
                                        {(mtd?.dailyCost ?? 0) === 0 ? (
                                            <div className="text-center text-sm text-neutral-400 py-12">No activity recorded today</div>
                                        ) : (
                                            <>
                                                <div className="flex items-end gap-0.5 h-36">
                                                    {hourlyData.map(({ hour, label, cost }) => {
                                                        const heightPct = (cost / maxHourlyCost) * 100;
                                                        const isCurrent = hour === nowHour;
                                                        const hasActivity = cost > 0;
                                                        return (
                                                            <div key={hour} className="group relative flex-1 flex flex-col items-center justify-end h-full">
                                                                <div
                                                                    className={`w-full rounded-sm transition-all duration-300 ${
                                                                        isCurrent
                                                                            ? 'bg-blue-500 dark:bg-blue-400'
                                                                            : hasActivity
                                                                            ? 'bg-blue-300 dark:bg-blue-600 group-hover:bg-blue-400 dark:group-hover:bg-blue-500'
                                                                            : 'bg-neutral-200 dark:bg-neutral-700'
                                                                    }`}
                                                                    style={{ height: hasActivity ? `${Math.max(heightPct, 4)}%` : '2px' }}
                                                                />
                                                                {hasActivity && (
                                                                    <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
                                                                        <div className="bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-xs font-medium px-2 py-1 rounded whitespace-nowrap shadow-lg">
                                                                            {label} · {fmt(cost)}
                                                                        </div>
                                                                        <div className="w-2 h-2 bg-neutral-900 dark:bg-neutral-100 rotate-45 -mt-1" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                <div className="flex justify-between mt-2">
                                                    {['12a', '3a', '6a', '9a', '12p', '3p', '6p', '9p', 'now'].map((l, i) => (
                                                        <span key={i} className={`text-[10px] ${l === 'now' ? 'text-blue-400 font-semibold' : 'text-neutral-400'}`}>{l}</span>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* 6-Month History */}
                                    {historyBars.length > 0 && (
                                        <div className="rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 p-6">
                                            <div className="flex items-center justify-between mb-5">
                                                <div className="flex items-center gap-2">
                                                    <IconChartBar size={16} className="text-neutral-400" />
                                                    <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">6-Month History</span>
                                                </div>
                                                {trend && trend.direction !== 'flat' && (
                                                    <div className={`flex items-center gap-1.5 text-xs font-medium ${trendColor}`}>
                                                        <TrendIcon size={14} />
                                                        <span>{trend.percentage.toFixed(0)}% vs last month</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex items-end gap-4 h-36">
                                                {historyBars.map((month) => {
                                                    const heightPct = (month.totalCost / maxHistoryCost) * 100;
                                                    return (
                                                        <div key={month.month} className="group relative flex-1 flex flex-col items-center justify-end h-full">
                                                            <div
                                                                className={`w-full rounded-t transition-all duration-500 ${
                                                                    month.isCurrent
                                                                        ? 'bg-blue-500 dark:bg-blue-400'
                                                                        : 'bg-neutral-300 dark:bg-neutral-600 group-hover:bg-neutral-400 dark:group-hover:bg-neutral-500'
                                                                }`}
                                                                style={{ height: `${Math.max(heightPct, 3)}%` }}
                                                            />
                                                            <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
                                                                <div className="bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-xs font-medium px-2 py-1 rounded whitespace-nowrap shadow-lg">
                                                                    {month.displayMonth} · {fmt(month.totalCost)}
                                                                </div>
                                                                <div className="w-2 h-2 bg-neutral-900 dark:bg-neutral-100 rotate-45 -mt-1" />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            <div className="flex gap-4 mt-2">
                                                {historyBars.map((month) => (
                                                    <span key={month.month} className={`flex-1 text-center text-xs ${month.isCurrent ? 'text-blue-500 dark:text-blue-400 font-semibold' : 'text-neutral-400'}`}>
                                                        {month.displayMonth.split(' ')[0]}
                                                    </span>
                                                ))}
                                            </div>
                                            {history?.summary && (
                                                <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700 grid grid-cols-2 gap-4">
                                                    <div>
                                                        <div className="text-xs text-neutral-400 mb-1">Avg / month</div>
                                                        <div className="text-xl font-bold text-neutral-800 dark:text-neutral-200 tabular-nums">{fmt(history.summary.avgMonthlySpend)}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs text-neutral-400 mb-1">All-time ({history.summary.monthCount} mo)</div>
                                                        <div className="text-xl font-bold text-neutral-800 dark:text-neutral-200 tabular-nums">{fmt(history.summary.totalSpendAllTime)}</div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* RIGHT: Account Breakdown + Rate Limit Utilization */}
                                <div className="space-y-5">
                                <RateLimitUtilization variant="full" mtd={mtd} />
                                {mtd && mtd.accounts.length > 0 && (
                                    <div className="rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 p-6 flex flex-col">
                                        <div className="flex items-center justify-between mb-5 shrink-0">
                                            <div className="flex items-center gap-2">
                                                <IconCreditCard size={16} className="text-neutral-400" />
                                                <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">Account Breakdown</span>
                                            </div>
                                            <span className="text-xs text-neutral-400">{mtd.accounts.length} account{mtd.accounts.length !== 1 ? 's' : ''}</span>
                                        </div>
                                        <div className="space-y-5 pr-1 overflow-y-auto max-h-[250px]">
                                            {mtd.accounts.map((acc) => {
                                                const barPct = (acc.totalCost / maxAccountCost) * 100;
                                                const label = acc.accountInfo?.split('#')[0] ?? acc.accountInfo;
                                                const keyId = acc.accountInfo?.split('#')[1];
                                                return (
                                                    <div key={acc.accountInfo}>
                                                        <div className="flex justify-between items-start mb-2">
                                                            <div className="flex flex-col min-w-0 mr-3">
                                                                <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300 truncate" title={acc.accountInfo}>
                                                                    {label}
                                                                </span>
                                                                {keyId && keyId !== 'NA' && (
                                                                    <span className="text-[10px] text-neutral-400 truncate font-mono mt-0.5">{keyId}</span>
                                                                )}
                                                            </div>
                                                            <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100 tabular-nums shrink-0">
                                                                {fmt(acc.totalCost)}
                                                            </span>
                                                        </div>
                                                        <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-1.5 mb-2">
                                                            <div
                                                                className="h-1.5 rounded-full bg-indigo-400 dark:bg-indigo-500 transition-all duration-500"
                                                                style={{ width: `${barPct}%` }}
                                                            />
                                                        </div>
                                                        <div className="flex gap-5">
                                                            <span className="text-xs text-neutral-400">Today <span className="text-neutral-600 dark:text-neutral-300 font-semibold">{fmt(acc.dailyCost)}</span></span>
                                                            <span className="text-xs text-neutral-400">Month <span className="text-neutral-600 dark:text-neutral-300 font-semibold">{fmt(acc.monthlyCost)}</span></span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                                </div>
                            </div>

                            {mtd?.lastUpdated && (
                                <div className="text-center text-xs text-neutral-400 dark:text-neutral-600 pt-1">
                                    Last activity {new Date(mtd.lastUpdated).toLocaleString()}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
