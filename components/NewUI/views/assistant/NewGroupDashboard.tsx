/**
 * NewGroupDashboard — metrics for one group assistant: key numbers, then distributions.
 *
 * Replaces the old admin interface's `Dashboard`. Same data (`DashboardMetrics`), but token colours
 * (light + dark), real headings/lists instead of hand-rolled SVG, and no layout tied to
 * `window.innerHeight`. Charts are plain horizontal bars — one series per chart, each bar labelled
 * with its value and share, so nothing depends on colour alone. The bar fill animates only when the
 * user hasn't asked for reduced motion.
 */

import React from 'react';
import { RatingStars } from './RatingStars';
import {
    DashboardMetrics,
    DistributionBar,
    distributionToBars,
    formatDecimal,
    normalizeRating,
    routedLabel,
    stripAssistantPrefix,
} from './groupInsightsModel';

export interface NewGroupDashboardProps {
    metrics: DashboardMetrics;
    /** Analysis-only charts (entry point, category, group type, system rating) need this. */
    supportConvAnalysis: boolean;
    /** Layered assistants: `{ leafAssistantId: name }` so Routing reads names, not ids. */
    leafNameMap?: Record<string, string>;
}

const card: React.CSSProperties = {
    border: '1px solid var(--border-subtle)',
    borderRadius: 10,
    background: 'var(--bg-raised)',
    padding: 16,
};

const StatTile: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div style={card}>
        <h3
            style={{
                margin: 0,
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--text-muted)',
            }}
        >
            {label}
        </h3>
        <div style={{ marginTop: 8, fontSize: 26, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.1 }}>
            {children}
        </div>
    </div>
);

const BarList: React.FC<{ title: string; description?: string; bars: DistributionBar[]; format?: (label: string) => string }> = ({
    title,
    description,
    bars,
    format = (label) => label,
}) => {
    if (bars.length === 0) return null;
    return (
        <section style={card} aria-label={title}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</h3>
            {description && (
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>{description}</p>
            )}
            <ul style={{ listStyle: 'none', margin: '14px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {bars.map((bar) => (
                    <li key={bar.label}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12.5 }}>
                            <span
                                title={format(bar.label)}
                                style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            >
                                {format(bar.label)}
                            </span>
                            <span style={{ flexShrink: 0, color: 'var(--text-secondary)' }}>
                                {bar.value} <span style={{ color: 'var(--text-muted)' }}>· {bar.percent}%</span>
                            </span>
                        </div>
                        <div
                            aria-hidden="true"
                            style={{ marginTop: 4, height: 8, borderRadius: 4, background: 'var(--bg-hover)', overflow: 'hidden' }}
                        >
                            <div className="nui-insight-bar" style={{ width: `${bar.width}%`, height: '100%', borderRadius: 4, background: 'var(--accent)' }} />
                        </div>
                    </li>
                ))}
            </ul>
        </section>
    );
};

const RatingCompare: React.FC<{ label: string; value: unknown }> = ({ label, value }) => {
    const rating = normalizeRating(value);
    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                <span style={{ color: 'var(--text-primary)' }}>{label}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{rating === null ? 'No rating' : `${formatDecimal(rating)} / 5`}</span>
            </div>
            <div aria-hidden="true" style={{ marginTop: 4, height: 8, borderRadius: 4, background: 'var(--bg-hover)', overflow: 'hidden' }}>
                <div
                    className="nui-insight-bar"
                    style={{ width: `${rating === null ? 0 : (rating / 5) * 100}%`, height: '100%', borderRadius: 4, background: 'var(--accent)' }}
                />
            </div>
        </div>
    );
};

export const NewGroupDashboard: React.FC<NewGroupDashboardProps> = ({ metrics, supportConvAnalysis, leafNameMap }) => {
    const entryPoints = supportConvAnalysis ? distributionToBars(metrics.entryPointDistribution) : [];
    const categories = supportConvAnalysis ? distributionToBars(metrics.categoryDistribution) : [];
    const groupTypes = supportConvAnalysis ? distributionToBars(metrics.employeeTypeDistribution) : [];
    const routedTo = distributionToBars(metrics.routedToAssistantDistribution);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Honours reduced motion: the transition simply doesn't exist for those users. */}
            <style>{`
                @media (prefers-reduced-motion: no-preference) {
                    .nui-insight-bar { transition: width 400ms ease-out; }
                }
            `}</style>

            <div>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {metrics.assistantName}
                </h2>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                    Assistant ID: {stripAssistantPrefix(metrics.assistantId)}
                </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
                <StatTile label="Unique users">{metrics.numUsers ?? 0}</StatTile>
                <StatTile label="Conversations">{metrics.totalConversations ?? 0}</StatTile>
                <StatTile label="Prompts per conversation">{formatDecimal(metrics.averagePromptsPerConversation)}</StatTile>
                <StatTile label="User satisfaction">
                    <RatingStars value={metrics.averageUserRating} size={16} />
                </StatTile>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
                <BarList
                    title="Routing"
                    description="Turns routed to each leaf assistant across all conversations"
                    bars={routedTo}
                    format={(id) => routedLabel(id, leafNameMap)}
                />
                <BarList title="Entry points" bars={entryPoints} />
                <BarList title="Categories" bars={categories} />
                <BarList title="Group types" bars={groupTypes} />

                {(normalizeRating(metrics.averageUserRating) !== null ||
                    (supportConvAnalysis && normalizeRating(metrics.averageSystemRating) !== null)) && (
                    <section style={card} aria-label="Performance">
                        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Performance</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
                            <RatingCompare label="User rating" value={metrics.averageUserRating} />
                            {supportConvAnalysis && <RatingCompare label="System rating" value={metrics.averageSystemRating} />}
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
};
