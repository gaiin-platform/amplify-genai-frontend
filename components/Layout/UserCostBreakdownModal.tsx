import React, { useContext, useEffect, useMemo, useState } from 'react';
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
    IconUser,
    IconBan,
} from '@tabler/icons-react';
import { getUserMtdCosts, getUserCostHistory, UserMtdCosts, UserCostHistory } from '@/services/mtdCostService';
import { fetchAllApiKeys } from '@/services/apiKeysService';
import { ApiKey } from '@/types/apikeys';
import { RateLimitUtilization } from './RateLimitUtilization';
import HomeContext from '@/pages/api/home/home.context';

interface Props {
    email: string;
    onClose: () => void;
}

const fmt = (n: number) => n > 0 && n < 0.01 ? '<$0.01' : `$${n.toFixed(2)}`;

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
    const { state: { defaultAccount, honorPersonalRateLimit } } = useContext(HomeContext);
    const [mtd, setMtd] = useState<UserMtdCosts | null>(null);
    const [history, setHistory] = useState<UserCostHistory | null>(null);
    const [loading, setLoading] = useState(true);
    const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);

    // Map api_owner_id → ApiKey for fast lookup
    const apiKeyMap = useMemo(() => {
        const map = new Map<string, ApiKey>();
        apiKeys.forEach(k => { if (k.api_owner_id) map.set(k.api_owner_id, k); });
        return map;
    }, [apiKeys]);

    const personal = defaultAccount?.rateLimit;
    const honorEnabled = !!(honorPersonalRateLimit?.enabled);
    const honorScope = honorPersonalRateLimit?.scope ?? 'both';

    // Returns true if this account type should show % against its rate limit cap
    // isApiKey=true  → honored when scope is 'both' or 'apiKey'
    // isApiKey=false → honored when scope is 'both' or 'amplifyAccount'
    const isAccountHonored = (isApiKey: boolean): boolean => {
        if (!honorEnabled) return false;
        if (isApiKey) return honorScope === 'both' || honorScope === 'apiKey';
        return honorScope === 'both' || honorScope === 'amplifyAccount';
    };

    useEffect(() => {
        const load = async () => {
            const [mtdResult, histResult, keysResult] = await Promise.all([
                getUserMtdCosts(),
                getUserCostHistory(email, 6),
                fetchAllApiKeys(),
            ]);
            if (mtdResult.success) setMtd(mtdResult.data);
            if (histResult.success) setHistory(histResult.data ?? null);
            if (keysResult.success && keysResult.data) {
                // result.data is a flat ApiKey array (same shape as ApiKeys.tsx uses)
                // Exclude delegate keys — those bill to someone else, not this user
                const all: ApiKey[] = (Array.isArray(keysResult.data) ? keysResult.data : [])
                    .filter((k: ApiKey) => !k.delegate);
                setApiKeys(all);
            } else {
                console.warn('[UserCostBreakdownModal] fetchAllApiKeys failed or no data:', keysResult);
            }
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

    // Stable color palette for accounts across months
    const ACCOUNT_COLORS = [
        'bg-blue-400 dark:bg-blue-500',
        'bg-violet-400 dark:bg-violet-500',
        'bg-emerald-400 dark:bg-emerald-500',
        'bg-orange-400 dark:bg-orange-500',
        'bg-pink-400 dark:bg-pink-500',
        'bg-cyan-400 dark:bg-cyan-500',
        'bg-yellow-400 dark:bg-yellow-500',
        'bg-red-400 dark:bg-red-500',
    ];
    const ACCOUNT_COLORS_HEX = [
        '#60a5fa','#a78bfa','#34d399','#fb923c','#f472b6','#22d3ee','#facc15','#f87171',
    ];

    // Stable ordered list of all accounts across history, by total spend desc
    const historyAccounts = useMemo(() => {
        const totals = new Map<string, number>();
        historyBars.forEach(m => {
            (m.accounts ?? []).forEach(({ accountInfo, cost }: { accountInfo: string; cost: number }) => {
                totals.set(accountInfo, (totals.get(accountInfo) ?? 0) + cost);
            });
        });
        return Array.from(totals.entries())
            .filter(([, total]) => total > 0)
            .sort((a, b) => b[1] - a[1])
            .map(([accountInfo]) => accountInfo);
    }, [historyBars]);

    const accountColorMap = useMemo(() => {
        const m = new Map<string, { cls: string; hex: string }>();
        historyAccounts.forEach((a, i) => {
            m.set(a, { cls: ACCOUNT_COLORS[i % ACCOUNT_COLORS.length], hex: ACCOUNT_COLORS_HEX[i % ACCOUNT_COLORS_HEX.length] });
        });
        return m;
    }, [historyAccounts]);

    const accountLabel = (accountInfo: string) => {
        const parts = accountInfo.split('#');
        const keyId = parts[1];
        const accountType = parts[0];
        const matched = keyId && keyId !== 'NA' ? apiKeyMap.get(keyId) : undefined;
        const labelMap: Record<string, string> = {
            'general_account': 'General Account',
            'scheduled_task_account': 'Scheduled Task',
            'email_event_account': 'Email Agent',
            'agent_event_account': 'Agent Event',
        };
        return matched?.applicationName || labelMap[accountType] || accountType;
    };

    // Merge: start with billing accounts, then append any API keys that have no spend entry yet
    const mergedAccounts = useMemo(() => {
        if (!mtd) return [];
        const existing = new Set(mtd.accounts.map(a => a.accountInfo));
        const zeroEntries = apiKeys
            .filter(k => k.api_owner_id && !Array.from(existing).some(e => e.includes(k.api_owner_id)))
            .map(k => ({
                accountInfo: `api_key#${k.api_owner_id}`,
                dailyCost: 0,
                monthlyCost: 0,
                totalCost: 0,
                timestamp: null,
            }));
        return [...mtd.accounts, ...zeroEntries];
    }, [mtd, apiKeys]);

    const maxAccountCost = Math.max(...(mergedAccounts.map(a => a.totalCost) ?? []), 0.01);

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

                            {/* Row 1: Hourly + Rate Limit side by side */}
                            <div className="grid grid-cols-2 gap-5">

                                {/* LEFT: Hourly Activity */}
                                <div>
                                    <div className="rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 p-6">
                                        <div className="flex items-center justify-between mb-5">
                                            <div className="flex items-center gap-2">
                                                <IconClock size={16} className="text-neutral-400" />
                                                <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">Today&apos;s Hourly Activity</span>
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

                                </div>

                                {/* RIGHT: Rate Limit Utilization */}
                                <div>
                                <RateLimitUtilization variant="full" mtd={mtd} />
                                </div>

                            </div>

                            {/* Row 2: 6-Month History full width */}
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
                                            const sortedAccounts = [...(month.accounts ?? [])]
                                                .filter(a => a.cost > 0)
                                                .sort((a, b) => b.cost - a.cost);
                                            const totalBarHeight = Math.max(heightPct, 3);
                                            return (
                                                <div key={month.month} className="group relative flex-1 flex flex-col items-center justify-end h-full">
                                                    {/* Stacked bar */}
                                                    <div
                                                        className="w-full rounded-t overflow-hidden flex flex-col-reverse transition-all duration-500"
                                                        style={{ height: `${totalBarHeight}%` }}
                                                    >
                                                        {sortedAccounts.length > 0 ? (
                                                            sortedAccounts.map((acct) => {
                                                                const segPct = (acct.cost / month.totalCost) * 100;
                                                                const color = accountColorMap.get(acct.accountInfo);
                                                                return (
                                                                    <div
                                                                        key={acct.accountInfo}
                                                                        className={`w-full transition-all duration-500 ${color?.cls ?? 'bg-neutral-300 dark:bg-neutral-600'}`}
                                                                        style={{ height: `${segPct}%` }}
                                                                    />
                                                                );
                                                            })
                                                        ) : (
                                                            <div className={`w-full h-full ${month.isCurrent ? 'bg-blue-500 dark:bg-blue-400' : 'bg-neutral-300 dark:bg-neutral-600'}`} />
                                                        )}
                                                    </div>
                                                    {/* Hover tooltip */}
                                                    <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-start z-10 pointer-events-none min-w-[140px]">
                                                        <div className="bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-xs font-medium px-2.5 py-2 rounded shadow-lg w-full">
                                                            <div className="font-semibold mb-1.5 border-b border-white/20 dark:border-neutral-900/20 pb-1">
                                                                {month.displayMonth} · {fmt(month.totalCost)}
                                                            </div>
                                                            {sortedAccounts.map((acct) => {
                                                                const color = accountColorMap.get(acct.accountInfo);
                                                                return (
                                                                    <div key={acct.accountInfo} className="flex items-center gap-1.5 mt-0.5">
                                                                        <div
                                                                            className="w-2 h-2 rounded-sm shrink-0"
                                                                            style={{ backgroundColor: color?.hex ?? '#9ca3af' }}
                                                                        />
                                                                        <span className="truncate max-w-[140px]">{accountLabel(acct.accountInfo)}</span>
                                                                        <span className="ml-auto pl-2 tabular-nums">{fmt(acct.cost)}</span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                        <div className="w-2 h-2 bg-neutral-900 dark:bg-neutral-100 rotate-45 -mt-1 self-center" />
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

                                    {/* Account color legend */}
                                    {historyAccounts.length > 0 && (
                                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                                            {historyAccounts.map((acct) => {
                                                const color = accountColorMap.get(acct);
                                                return (
                                                    <div key={acct} className="flex items-center gap-1.5">
                                                        <div
                                                            className="w-2.5 h-2.5 rounded-sm shrink-0"
                                                            style={{ backgroundColor: color?.hex ?? '#9ca3af' }}
                                                        />
                                                        <span className="text-[11px] text-neutral-500 dark:text-neutral-400">{accountLabel(acct)}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

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

                            {/* Row 3: Account Breakdown full width */}
                            {mtd && mergedAccounts.length > 0 && (
                                <div className="min-h-[200px] h-[20%] rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 p-6 flex flex-col overflow-hidden">
                                        <div className="flex items-center justify-between mb-5 shrink-0">
                                            <div className="flex items-center gap-2">
                                                <IconCreditCard size={16} className="text-neutral-400" />
                                                <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">Account Breakdown</span>
                                            </div>
                                            <span className="text-xs text-neutral-400">{mergedAccounts.length} account{mergedAccounts.length !== 1 ? 's' : ''}</span>
                                        </div>
                                        <div className="space-y-4 pr-1 overflow-y-auto flex-1 min-h-0">
                                            {[...mergedAccounts].sort((a, b) => {
                                                const aParts = a.accountInfo?.split('#') ?? [];
                                                const bParts = b.accountInfo?.split('#') ?? [];
                                                const aType = aParts[0] ?? a.accountInfo;
                                                const bType = bParts[0] ?? b.accountInfo;
                                                const aKeyId = aParts[1];
                                                const bKeyId = bParts[1];
                                                const aIsApiKey = !!(aKeyId && aKeyId !== 'NA');
                                                const bIsApiKey = !!(bKeyId && bKeyId !== 'NA');
                                                const aActive = aIsApiKey ? (apiKeyMap.get(aKeyId)?.active !== false) : true;
                                                const bActive = bIsApiKey ? (apiKeyMap.get(bKeyId)?.active !== false) : true;
                                                const aIsGeneral = aType === 'general_account' && !aIsApiKey;
                                                const bIsGeneral = bType === 'general_account' && !bIsApiKey;
                                                // 0 = general_account, 1 = active API keys / other accounts, 2 = inactive keys
                                                const aOrder = aIsGeneral ? 0 : !aActive ? 2 : 1;
                                                const bOrder = bIsGeneral ? 0 : !bActive ? 2 : 1;
                                                if (aOrder !== bOrder) return aOrder - bOrder;
                                                return b.totalCost - a.totalCost;
                                            }).map((acc) => {
                                                const parts = acc.accountInfo?.split('#') ?? [];
                                                const accountType = parts[0] ?? acc.accountInfo;
                                                const keyId = parts[1];
                                                const isApiKey = !!(keyId && keyId !== 'NA');
                                                const matchedKey = isApiKey ? apiKeyMap.get(keyId) : undefined;

                                                // Key type derived from the path segment in the keyId itself:
                                                // email/systemKey/uuid → system, email/delegateKey/uuid → delegate, */ownerKey/uuid → personal
                                                const isSystem = isApiKey && keyId.includes('/systemKey/');
                                                const isDelegate = isApiKey && keyId.includes('/delegateKey/');
                                                const keyIconColor = isSystem
                                                    ? 'text-green-500 dark:text-green-400'
                                                    : isDelegate
                                                    ? 'text-yellow-500 dark:text-yellow-400'
                                                    : 'text-neutral-400 dark:text-neutral-500';

                                                // Rate limit: per-key if available, else honor personal, else relative
                                                const keyLimit = matchedKey?.rateLimit;
                                                const hasKeyLimit = !!(keyLimit && keyLimit.rate !== null && keyLimit.period !== 'Unlimited');
                                                const honored = isAccountHonored(isApiKey);

                                                let barPct: number;
                                                let capLabel: string | null = null;
                                                let pct: number | null = null;

                                                if (isApiKey && hasKeyLimit && keyLimit!.rate) {
                                                    // Use the key's own rate limit
                                                    pct = Math.min((acc.totalCost / keyLimit!.rate) * 100, 100);
                                                    barPct = pct;
                                                    capLabel = fmt(keyLimit!.rate);
                                                } else if (!isApiKey && honored && personal?.rate) {
                                                    // Amplify account + honor enabled
                                                    pct = Math.min((acc.totalCost / personal.rate) * 100, 100);
                                                    barPct = pct;
                                                    capLabel = fmt(personal.rate);
                                                } else {
                                                    // Relative bar, no cap shown
                                                    barPct = (acc.totalCost / maxAccountCost) * 100;
                                                }

                                                const barColor = isApiKey && hasKeyLimit
                                                    ? isSystem ? 'bg-green-400 dark:bg-green-500'
                                                      : isDelegate ? 'bg-yellow-400 dark:bg-yellow-500'
                                                      : 'bg-blue-400 dark:bg-blue-500'
                                                    : honored
                                                    ? 'bg-blue-400 dark:bg-blue-500'
                                                    : 'bg-indigo-400 dark:bg-indigo-500';

                                                // Human-readable labels for internal account type buckets
                                                const accountTypeLabel: Record<string, string> = {
                                                    'general_account': 'General Account',
                                                    'scheduled_task_account': 'Scheduled Task',
                                                    'email_event_account': 'Email Agent',
                                                    'agent_event_account': 'Agent Event',
                                                };
                                                // For non-API-key entries, use the mapped label or the COA string as-is
                                                const nonKeyDisplayName = accountTypeLabel[accountType] ?? accountType;
                                                // Display name: API key application name, else human-readable account type
                                                const displayName = matchedKey?.applicationName || nonKeyDisplayName;
                                                // Sub-label: purpose > description > COA account name (all from the matched API key)
                                                const keyAccountName = matchedKey?.account?.name ?? null;
                                                const subLabel = (matchedKey?.purpose || matchedKey?.applicationDescription || keyAccountName) || null;

                                                return (
                                                    <div key={acc.accountInfo} className="group">
                                                        <div className="flex justify-between items-start mb-1.5">
                                                            <div className="flex items-start gap-2 min-w-0 mr-2">
                                                                {isApiKey && (
                                                                    <div className={`mt-0.5 shrink-0 ${keyIconColor}`}>
                                                                        <IconUser size={13} strokeWidth={2.5} />
                                                                    </div>
                                                                )}
                                                                <div className="flex flex-col min-w-0">
                                                                    <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 truncate leading-tight" title={displayName}>
                                                                        {displayName}
                                                                    </span>
                                                                    {subLabel && (
                                                                        <span className="text-[11px] text-neutral-400 truncate leading-tight mt-0.5" title={subLabel}>{subLabel}</span>
                                                                    )}
                                                                    {isApiKey && (
                                                                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                                            {isSystem && (
                                                                                <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-1.5 py-0.5 rounded-full">
                                                                                    System
                                                                                </span>
                                                                            )}
                                                                            {isDelegate && (
                                                                                <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 px-1.5 py-0.5 rounded-full">
                                                                                    Delegate
                                                                                </span>
                                                                            )}
                                                                            {matchedKey && !matchedKey.active && (
                                                                                <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded-full">
                                                                                    <IconBan size={9} /> Inactive
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="flex flex-col items-end shrink-0">
                                                                <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100 tabular-nums leading-tight">
                                                                    {capLabel
                                                                        ? <>{fmt(acc.totalCost)} <span className="text-xs font-normal text-neutral-400">/ {capLabel}</span></>
                                                                        : fmt(acc.totalCost)
                                                                    }
                                                                </span>
                                                                {pct !== null && (
                                                                    <span className="text-[11px] text-neutral-400 tabular-nums">{pct.toFixed(1)}%</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-1 mb-1.5">
                                                            <div
                                                                className={`h-1 rounded-full transition-all duration-500 ${barColor}`}
                                                                style={{ width: `${barPct}%` }}
                                                            />
                                                        </div>
                                                        <div className="flex gap-4">
                                                            <span className="text-xs text-neutral-400">Today <span className="text-neutral-600 dark:text-neutral-300 font-semibold">{fmt(acc.dailyCost)}</span></span>
                                                            <span className="text-xs text-neutral-400">Month <span className="text-neutral-600 dark:text-neutral-300 font-semibold">{fmt(acc.monthlyCost)}</span></span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                            )}

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
