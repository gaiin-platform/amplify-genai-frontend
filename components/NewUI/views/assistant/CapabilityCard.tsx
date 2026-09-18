/**
 * CapabilityCard — the collapsible card wrapping each Capabilities panel.
 *
 * Lifted out of `views/NewUIAssistantCreationModal`, where it was a local
 * component (guide §5.6: reusable components live in their own file).
 *
 * The open/close animation is a `grid-template-rows: 0fr → 1fr` transition rather
 * than the `max-height: 0 → 1400px` it used to be. That ceiling was reachable:
 * the Tools panel — search, category disclosures, composite cards and two browse
 * lists — grows past 1400px, and because the container is `overflow: hidden` the
 * excess was simply unreachable, with no scrollbar to hint at it. `0fr/1fr`
 * animates to the content's real height, whatever that is.
 *
 * `overflow: hidden` has to stay on the grid child for the collapse to clip, but
 * it is dropped once open so that popovers inside a panel are not cut off.
 */

import React, { useEffect, useRef, useState } from 'react';
import { IconChevronRight } from '@tabler/icons-react';

export interface CapabilityCardProps {
    icon: React.ReactNode;
    title: string;
    /** Accent-tinted pill shown in the header when something is configured. */
    badge?: string;
    children: React.ReactNode;
    /** Start expanded — used when a saved assistant already has this configured. */
    defaultOpen?: boolean;
}

export const CapabilityCard: React.FC<CapabilityCardProps> = ({
    icon,
    title,
    badge,
    children,
    defaultOpen = false,
}) => {
    const [open, setOpen] = useState(defaultOpen);
    /**
     * Clipping is only correct while the card is animating. Leaving
     * `overflow: hidden` on for good would cut off anything that escapes the
     * panel's box, so it is released after the transition and re-applied the
     * moment a close starts.
     */
    const [clip, setClip] = useState(!defaultOpen);
    /**
     * `hidden` keeps collapsed content out of the tab order — `0fr` + overflow
     * only hides it visually. It has to lag the close, though: applying it on the
     * same frame as `0fr` removes the element from layout and there is nothing
     * left to animate.
     */
    const [collapsed, setCollapsed] = useState(!defaultOpen);
    const bodyId = useRef(`capability-${Math.random().toString(36).slice(2, 9)}`).current;

    useEffect(() => {
        const reduced = typeof window !== 'undefined'
            && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

        if (open) {
            setCollapsed(false);
            if (reduced) { setClip(false); return; }
            const timer = window.setTimeout(() => setClip(false), 300);
            return () => window.clearTimeout(timer);
        }

        setClip(true);
        if (reduced) { setCollapsed(true); return; }
        const timer = window.setTimeout(() => setCollapsed(true), 300);
        return () => window.clearTimeout(timer);
    }, [open]);

    const highlighted = open || Boolean(badge);

    return (
        <div
            style={{
                border: `1px solid ${
                    highlighted
                        ? 'color-mix(in srgb, var(--accent) 30%, var(--border-subtle))'
                        : 'var(--border-subtle)'
                }`,
                borderRadius: 10,
                background: 'var(--bg-raised)',
                transition: 'border-color 140ms ease',
            }}
        >
            {/* ── Header ── */}
            <button
                type="button"
                aria-expanded={open}
                aria-controls={bodyId}
                onClick={() => setOpen((value) => !value)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    width: '100%',
                    padding: '12px 14px',
                    background: 'none',
                    border: 'none',
                    borderRadius: 10,
                    cursor: 'pointer',
                    textAlign: 'left',
                    outline: 'none',
                    transition: 'background 100ms ease',
                }}
                onMouseEnter={(event) => { event.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={(event) => { event.currentTarget.style.background = 'none'; }}
            >
                <span
                    aria-hidden="true"
                    style={{
                        flexShrink: 0,
                        lineHeight: 0,
                        color: highlighted ? 'var(--accent)' : 'var(--text-secondary)',
                        transition: 'color 140ms ease',
                    }}
                >
                    {icon}
                </span>

                <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
                    {title}
                </span>

                {badge && (
                    <span
                        style={{
                            fontSize: 11,
                            fontWeight: 500,
                            color: 'var(--accent)',
                            background: 'color-mix(in srgb, var(--accent) 12%, var(--bg-raised))',
                            border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)',
                            borderRadius: 20,
                            padding: '2px 8px',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {badge}
                    </span>
                )}

                <span
                    aria-hidden="true"
                    className="motion-reduce:transition-none"
                    style={{
                        flexShrink: 0,
                        lineHeight: 0,
                        color: 'var(--text-muted)',
                        transform: open ? 'rotate(90deg)' : 'none',
                        transition: 'transform 180ms ease',
                    }}
                >
                    <IconChevronRight size={16} stroke={2} />
                </span>
            </button>

            {/* ── Body — 0fr/1fr animates to the content's real height ── */}
            <div
                id={bodyId}
                role="region"
                className="motion-reduce:transition-none"
                style={{
                    display: 'grid',
                    gridTemplateRows: open ? '1fr' : '0fr',
                    transition: 'grid-template-rows 280ms ease-in-out',
                    /**
                     * Not the `hidden` attribute: `[hidden] { display: none }` comes
                     * from the UA sheet and loses to the inline `display: grid` above,
                     * so it would do nothing here. `visibility: hidden` also takes the
                     * subtree out of the tab order and the a11y tree, and unlike
                     * `display: none` it does not cancel the reopen transition.
                     */
                    visibility: collapsed ? 'hidden' : 'visible',
                }}
            >
                <div style={{ overflow: clip ? 'hidden' : 'visible', minHeight: 0 }}>
                    <div style={{ padding: 14, borderTop: '1px solid var(--border-subtle)' }}>
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CapabilityCard;
