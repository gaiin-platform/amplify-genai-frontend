import React, { useContext, useEffect, useState } from 'react';
import { IconChartHistogram, IconLoader2, IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import HomeContext from '@/pages/api/home/home.context';
import { RateLimit, normalizeRateLimits } from '@/types/rateLimit';
import { getUserMtdCosts, UserMtdCosts } from '@/services/mtdCostService';

// ─── helpers ────────────────────────────────────────────────────────────────

const fmt = (n: number) => {
    if (n === 0) return '$0.00';
    if (n < 0.01) return '<$0.01';
    return `$${n.toFixed(2)}`;
};

function spentForPeriod(limit: RateLimit, mtd: UserMtdCosts): number {
    switch (limit.period) {
        case 'Monthly': return mtd.totalCost;
        case 'Daily':   return mtd.dailyCost;
        case 'Hourly': {
            const nowUtc = new Date().getUTCHours();
            return mtd.hourlyCost?.[nowUtc] ?? 0;
        }
        case 'Total':   return mtd.totalCost;
        default:        return 0;
    }
}

function spentForPeriodBreakdown(limit: RateLimit, b: MtdBreakdown): number {
    switch (limit.period) {
        case 'Monthly':
        case 'Total':   return b.monthly;
        case 'Daily':   return b.daily;
        case 'Hourly':  return b.hourly;
        default:        return 0;
    }
}

function periodLabel(period: string): string {
    switch (period) {
        case 'Monthly': return 'this month';
        case 'Daily':   return 'today';
        case 'Hourly':  return 'this hour';
        case 'Total':   return 'lifetime';
        default:        return period.toLowerCase();
    }
}

function barColor(pct: number): string {
    if (pct >= 80) return 'bg-red-500';
    if (pct >= 50) return 'bg-yellow-400';
    return 'bg-blue-500';
}

function textColor(pct: number): string {
    if (pct >= 80) return 'text-red-500 dark:text-red-400';
    if (pct >= 50) return 'text-yellow-500 dark:text-yellow-400';
    return 'text-blue-500 dark:text-blue-400';
}

// ─── types ───────────────────────────────────────────────────────────────────

export interface UtilizationEntry {
    limit: RateLimit;
    spent: number;
    pct: number;
    source: 'personal' | 'admin' | 'group';
}

export interface MtdBreakdown {
    hourly: number;
    daily: number;
    monthly: number;
}

interface LimitPage {
    label: string;
    source: 'personal' | 'admin' | 'group';
    entries: UtilizationEntry[];
}

interface Props {
    variant: 'mini' | 'full';
    mtd?: UserMtdCosts | null;
    mtdBreakdown?: MtdBreakdown;
    onHasEntries?: (has: boolean) => void;
}

// ─── entry builder ────────────────────────────────────────────────────────────

function buildEntries(
    limits: RateLimit[],
    source: 'personal' | 'admin' | 'group',
    mtd: UserMtdCosts | null,
    mtdBreakdown?: MtdBreakdown,
): UtilizationEntry[] {
    return limits.map(limit => {
        const spent = mtd
            ? spentForPeriod(limit, mtd)
            : mtdBreakdown
            ? spentForPeriodBreakdown(limit, mtdBreakdown)
            : 0;
        const pct = Math.min((spent / (limit.rate as number)) * 100, 100);
        return { limit, spent, pct, source };
    });
}

// ─── shared page nav (used by both variants) ─────────────────────────────────

interface PageNavProps {
    pages: LimitPage[];
    activePage: number;
    setActivePage: (i: number) => void;
    compact?: boolean; // true = mini style, false = full style
}

const PageNav: React.FC<PageNavProps> = ({ pages, activePage, setActivePage, compact = false }) => {
    if (pages.length <= 1) return null;
    const btnBase = compact
        ? 'p-0.5 rounded disabled:opacity-30 transition-colors text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200'
        : 'p-0.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-30 transition-colors';
    return (
        <div className="flex items-center gap-1">
            <button
                onClick={() => setActivePage(Math.max(0, activePage - 1))}
                disabled={activePage === 0}
                className={btnBase}
            >
                <IconChevronLeft size={compact ? 11 : 13} className="text-neutral-500" />
            </button>
            {pages.map((page, i) => (
                <button
                    key={i}
                    onClick={() => setActivePage(i)}
                    className={`${compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-xs'} rounded-full font-medium whitespace-nowrap transition-colors ${
                        i === activePage
                            ? 'bg-blue-500 text-white'
                            : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-300 dark:hover:bg-neutral-600'
                    }`}
                >
                    {page.label}
                </button>
            ))}
            <button
                onClick={() => setActivePage(Math.min(pages.length - 1, activePage + 1))}
                disabled={activePage === pages.length - 1}
                className={btnBase}
            >
                <IconChevronRight size={compact ? 11 : 13} className="text-neutral-500" />
            </button>
        </div>
    );
};

// ─── component ───────────────────────────────────────────────────────────────

export const RateLimitUtilization: React.FC<Props> = ({ variant, mtd: externalMtd, mtdBreakdown, onHasEntries }) => {
    const {
        state: { defaultAccount, adminRateLimits, groupRateLimits },
    } = useContext(HomeContext);

    const [mtd, setMtd] = useState<UserMtdCosts | null>(externalMtd ?? null);
    const [loading, setLoading] = useState(!externalMtd && !mtdBreakdown);
    const [activePage, setActivePage] = useState(0);

    useEffect(() => {
        if (externalMtd !== undefined) {
            setMtd(externalMtd);
            setLoading(false);
            return;
        }
        if (mtdBreakdown !== undefined) {
            setLoading(false);
            return;
        }
        let cancelled = false;
        (async () => {
            setLoading(true);
            const result = await getUserMtdCosts();
            if (!cancelled) {
                setMtd(result.success ? result.data : null);
                setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [externalMtd, mtdBreakdown]);

    // ── Build pages (personal-first: if personal exists, only show personal) ──
    const personal = defaultAccount?.rateLimit;
    const hasPersonal = !!(personal && personal.rate !== null && personal.period !== 'Unlimited');

    const pages: LimitPage[] = [];

    if (hasPersonal) {
        // Personal limit is the only one that matters — backend checks this first and stops
        pages.push({
            label: 'My Limit',
            source: 'personal',
            entries: buildEntries([personal!], 'personal', mtd, mtdBreakdown),
        });
    } else {
        const activeAdminLimits = normalizeRateLimits(adminRateLimits).filter(
            l => l.rate !== null && l.period !== 'Unlimited'
        );
        if (activeAdminLimits.length > 0) {
            pages.push({
                label: 'Admin',
                source: 'admin',
                entries: buildEntries(activeAdminLimits, 'admin', mtd, mtdBreakdown),
            });
        }
        for (const group of (groupRateLimits ?? [])) {
            const activeLimits = group.limits.filter(l => l.rate !== null && l.period !== 'Unlimited');
            if (activeLimits.length > 0) {
                pages.push({
                    label: group.groupName,
                    source: 'group',
                    entries: buildEntries(activeLimits, 'group', mtd, mtdBreakdown),
                });
            }
        }
    }

    useEffect(() => {
        if (activePage >= pages.length && pages.length > 0) setActivePage(pages.length - 1);
    }, [pages.length]);

    const allEntries = pages.flatMap(p => p.entries);

    useEffect(() => {
        onHasEntries?.(allEntries.length > 0);
    }, [allEntries.length]);

    if (!loading && allEntries.length === 0) return null;

    // ── Shared spend values ───────────────────────────────────────────────────
    const hourlySpend  = mtdBreakdown?.hourly  ?? (mtd ? (mtd.hourlyCost?.[new Date().getUTCHours()] ?? 0) : 0);
    const dailySpend   = mtdBreakdown?.daily   ?? (mtd?.dailyCost  ?? 0);
    const monthlySpend = mtdBreakdown?.monthly ?? (mtd?.totalCost  ?? 0);

    function spendPct(period: 'Hourly' | 'Daily' | 'Monthly'): number | null {
        const matchPeriod = period === 'Monthly' ? ['Monthly', 'Total'] : [period];
        const entry = allEntries.find(e => matchPeriod.includes(e.limit.period));
        return entry ? entry.pct : null;
    }
    const hourlyColor  = (() => { const p = spendPct('Hourly');  return p !== null ? textColor(p) : 'text-neutral-500 dark:text-neutral-400'; })();
    const dailyColor   = (() => { const p = spendPct('Daily');   return p !== null ? textColor(p) : 'text-neutral-500 dark:text-neutral-400'; })();
    const monthlyColor = (() => { const p = spendPct('Monthly'); return p !== null ? textColor(p) : 'text-neutral-500 dark:text-neutral-400'; })();

    const currentPage = pages[Math.min(activePage, pages.length - 1)];

    // ── MINI variant ─────────────────────────────────────────────────────────
    if (variant === 'mini') {
        return (
            <div className="min-w-[200px] max-w-[260px]">
                {loading ? (
                    <div className="flex items-center gap-1.5 text-xs text-neutral-400 py-1">
                        <IconLoader2 size={12} className="animate-spin" />
                        <span>Loading…</span>
                    </div>
                ) : (
                    <div className="space-y-2.5">
                        {/* Spend row */}
                        <div className="flex items-center justify-between gap-3 pb-2 border-b border-neutral-200 dark:border-neutral-600">
                            <div className="flex flex-col items-center gap-0.5">
                                <span className="text-[10px] text-neutral-400 uppercase tracking-wide">Hourly</span>
                                <span className={`text-[12px] font-bold tabular-nums ${hourlyColor}`}>{fmt(hourlySpend)}</span>
                            </div>
                            <div className="w-px h-6 bg-neutral-200 dark:bg-neutral-600" />
                            <div className="flex flex-col items-center gap-0.5">
                                <span className="text-[10px] text-neutral-400 uppercase tracking-wide">Daily</span>
                                <span className={`text-[12px] font-bold tabular-nums ${dailyColor}`}>{fmt(dailySpend)}</span>
                            </div>
                            <div className="w-px h-6 bg-neutral-200 dark:bg-neutral-600" />
                            <div className="flex flex-col items-center gap-0.5">
                                <span className="text-[10px] text-neutral-400 uppercase tracking-wide">Monthly</span>
                                <span className={`text-[12px] font-bold tabular-nums ${monthlyColor}`}>{fmt(monthlySpend)}</span>
                            </div>
                        </div>

                        {/* Compact page nav */}
                        {pages.length > 1 && (
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] text-neutral-400 uppercase tracking-wide">Limits</span>
                                <PageNav pages={pages} activePage={activePage} setActivePage={setActivePage} compact={true} />
                            </div>
                        )}

                        {/* Current page's utilization bars */}
                        {currentPage?.entries.map(({ limit, spent, pct }, i) => (
                            <div key={i}>
                                <div className="flex justify-between items-baseline mb-1">
                                    <span className="text-[11px] font-medium text-neutral-600 dark:text-neutral-300">
                                        {limit.period} Limit
                                    </span>
                                    <span className={`text-[11px] font-bold tabular-nums ${textColor(pct)}`}>
                                        {fmt(spent)} / {fmt(limit.rate as number)}
                                    </span>
                                </div>
                                <div className="w-full bg-neutral-200 dark:bg-neutral-600 rounded-full h-1.5">
                                    <div
                                        className={`h-1.5 rounded-full transition-all duration-500 ${barColor(pct)}`}
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                                <div className={`text-right text-[10px] mt-0.5 ${textColor(pct)}`}>
                                    {pct.toFixed(0)}% {periodLabel(limit.period)}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    // ── FULL variant ─────────────────────────────────────────────────────────
    return (
        <div className="rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 p-6">

            {/* Header with page nav on the right */}
            <div className="flex items-center gap-2 mb-5">
                <IconChartHistogram size={16} className="text-neutral-400" />
                <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">
                    Rate Limit Utilization
                </span>
                <div className="ml-auto">
                    <PageNav pages={pages} activePage={activePage} setActivePage={setActivePage} compact={false} />
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-8">
                    <IconLoader2 size={28} className="animate-spin text-blue-500" />
                </div>
            ) : (
                <>
                    {/* Spend summary row */}
                    <div className="flex items-center justify-around mb-5 pb-4 border-b border-neutral-200 dark:border-neutral-700">
                        <div className="flex flex-col items-center gap-1">
                            <span className="text-xs text-neutral-400 uppercase tracking-wide">Hourly</span>
                            <span className={`text-base font-bold tabular-nums ${hourlyColor}`}>{fmt(hourlySpend)}</span>
                        </div>
                        <div className="w-px h-8 bg-neutral-200 dark:bg-neutral-700" />
                        <div className="flex flex-col items-center gap-1">
                            <span className="text-xs text-neutral-400 uppercase tracking-wide">Daily</span>
                            <span className={`text-base font-bold tabular-nums ${dailyColor}`}>{fmt(dailySpend)}</span>
                        </div>
                        <div className="w-px h-8 bg-neutral-200 dark:bg-neutral-700" />
                        <div className="flex flex-col items-center gap-1">
                            <span className="text-xs text-neutral-400 uppercase tracking-wide">Monthly</span>
                            <span className={`text-base font-bold tabular-nums ${monthlyColor}`}>{fmt(monthlySpend)}</span>
                        </div>
                    </div>

                    {/* Active page entries */}
                    {currentPage && (
                        <div className="space-y-5">
                            {currentPage.entries.map(({ limit, spent, pct }, i) => (
                                <div key={i}>
                                    <div className="flex justify-between items-baseline mb-1.5">
                                        <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                                            {limit.period} Limit
                                        </span>
                                        <span className={`text-sm font-bold tabular-nums ${textColor(pct)}`}>
                                            {fmt(spent)} <span className="font-normal text-neutral-400">/ {fmt(limit.rate as number)}</span>
                                        </span>
                                    </div>
                                    <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2.5">
                                        <div
                                            className={`h-2.5 rounded-full transition-all duration-700 ${barColor(pct)}`}
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between mt-1">
                                        <span className="text-xs text-neutral-400">{periodLabel(limit.period)}</span>
                                        <span className={`text-xs font-medium ${textColor(pct)}`}>
                                            {pct.toFixed(1)}% used
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};
