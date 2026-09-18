/**
 * CapabilityRow — one selectable tool, op, or skill in the Capabilities section.
 *
 * Replaces two near-identical old-UI cards at these call sites:
 *   components/Agent/ToolItem.tsx        — agent tools
 *   components/AssistantApi/ApiItem.tsx  — integration ops
 * Both stay in place for the classic editor (NEW_UI_GUIDE §1).
 *
 * They differed only in their data adapter, which `toolSelectionModel`'s
 * `toOpRow` / `toAgentToolRow` now normalizes — so there is one row here, not two.
 *
 * The old cards were `bg-gradient-to-br from-gray-200 via-gray-100 to-gray-300
 * … shadow-lg` with a 10px margin each, which read as a stack of floating tiles.
 * This is a flat row on a shared surface, using the multi-select vocabulary
 * already established by `shared/DataSourceLibraryPicker`: 16px faux checkbox,
 * `color-mix` accent tint when selected, inset accent focus ring.
 */

import React, { useState } from 'react';
import { IconAdjustments, IconCheck, IconChevronDown, IconChevronRight } from '@tabler/icons-react';
import { Badge } from '@/components/NewUI/shared/Badge';

export interface CapabilityRowProps {
    /** Display name. */
    label: string;
    description?: string;
    tags?: string[];
    selected: boolean;
    /** Omit to render a non-interactive row (the old `disableSelection`). */
    onToggle?: (checked: boolean) => void;
    /** Leading glyph — an op icon, an integration logo, a brain. */
    icon?: React.ReactNode;
    /** Right-aligned chips before the tags, e.g. a priority or "shared" marker. */
    badges?: string[];
    disabled?: boolean;
    /** Show the gear. Only pass when there is something to configure. */
    onConfigureToggle?: () => void;
    configureOpen?: boolean;
    /** Rendered below the row when `configureOpen` — the binding editor. */
    configurePanel?: React.ReactNode;
    /** Collapsed detail block (full description, parameter list). */
    details?: React.ReactNode;
    /** First row in a list — the container's border already divides it. */
    isFirst?: boolean;
}

export const CapabilityRow: React.FC<CapabilityRowProps> = ({
    label,
    description,
    tags = [],
    selected,
    onToggle,
    icon,
    badges = [],
    disabled = false,
    onConfigureToggle,
    configureOpen = false,
    configurePanel,
    details,
    isFirst = false,
}) => {
    const [hovered, setHovered] = useState(false);
    const [detailsOpen, setDetailsOpen] = useState(false);

    const interactive = Boolean(onToggle) && !disabled;

    const activate = () => {
        if (!interactive) return;
        onToggle?.(!selected);
    };

    return (
        <div
            style={{
                borderTop: isFirst ? 'none' : '1px solid var(--border-subtle)',
                background: selected
                    ? 'color-mix(in srgb, var(--accent) 10%, var(--bg-app))'
                    : hovered && interactive
                        ? 'var(--bg-hover)'
                        : 'transparent',
                opacity: disabled ? 0.55 : 1,
                transition: 'background 100ms ease',
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            {/* ── Main row ── */}
            <div
                role={onToggle ? 'option' : undefined}
                aria-selected={onToggle ? selected : undefined}
                aria-disabled={disabled || undefined}
                tabIndex={interactive ? 0 : -1}
                onClick={activate}
                onKeyDown={(event) => {
                    if (!interactive) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        activate();
                    }
                }}
                onFocus={(event) => {
                    if (interactive) {
                        (event.currentTarget as HTMLElement).style.boxShadow = 'inset 0 0 0 2px var(--accent)';
                    }
                }}
                onBlur={(event) => {
                    (event.currentTarget as HTMLElement).style.boxShadow = 'none';
                }}
                style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: '9px 12px',
                    cursor: interactive ? 'pointer' : 'default',
                    outline: 'none',
                }}
            >
                {/* Checkbox — omitted entirely in read-only mode */}
                {onToggle && (
                    <span
                        aria-hidden="true"
                        style={{
                            display: 'grid',
                            placeItems: 'center',
                            width: 16,
                            height: 16,
                            marginTop: 1,
                            flexShrink: 0,
                            borderRadius: 4,
                            border: `1px solid ${selected ? 'var(--accent)' : 'var(--border-subtle)'}`,
                            background: selected ? 'var(--accent)' : 'transparent',
                            color: 'var(--accent-fg)',
                        }}
                    >
                        {selected && <IconCheck size={11} />}
                    </span>
                )}

                {/* Leading icon */}
                {icon && (
                    <span
                        aria-hidden="true"
                        style={{
                            display: 'grid',
                            placeItems: 'center',
                            width: 18,
                            marginTop: 1,
                            flexShrink: 0,
                            color: selected ? 'var(--accent)' : 'var(--text-secondary)',
                        }}
                    >
                        {icon}
                    </span>
                )}

                {/* Name + description */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                            {label}
                        </span>
                        {badges.map((badge) => (
                            <Badge key={badge}>{badge}</Badge>
                        ))}
                    </div>

                    {description && (
                        <p
                            style={{
                                margin: '3px 0 0',
                                fontSize: 12,
                                lineHeight: 1.45,
                                color: 'var(--text-secondary)',
                            }}
                        >
                            {description}
                        </p>
                    )}

                    {tags.length > 0 && (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 5 }}>
                            {tags.slice(0, 4).map((tag) => (
                                <Badge key={tag}>{tag}</Badge>
                            ))}
                            {tags.length > 4 && <Badge>{`+${tags.length - 4}`}</Badge>}
                        </div>
                    )}

                    {details && (
                        <button
                            type="button"
                            aria-expanded={detailsOpen}
                            onClick={(event) => {
                                event.stopPropagation();
                                setDetailsOpen((open) => !open);
                            }}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                                marginTop: 6,
                                padding: 0,
                                border: 'none',
                                background: 'transparent',
                                color: 'var(--text-muted)',
                                fontSize: 11.5,
                                fontFamily: 'inherit',
                                cursor: 'pointer',
                            }}
                        >
                            {detailsOpen ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />}
                            {detailsOpen ? 'Hide details' : 'Details'}
                        </button>
                    )}
                </div>

                {/* Gear — only when the caller says there is something to configure */}
                {onConfigureToggle && (
                    <button
                        type="button"
                        aria-label={configureOpen ? `Hide ${label} parameters` : `Configure ${label} parameters`}
                        aria-expanded={configureOpen}
                        title="Configure parameters"
                        onClick={(event) => {
                            event.stopPropagation();
                            onConfigureToggle();
                        }}
                        style={{
                            flexShrink: 0,
                            display: 'grid',
                            placeItems: 'center',
                            width: 26,
                            height: 26,
                            borderRadius: 6,
                            border: 'none',
                            background: configureOpen ? 'var(--bg-active)' : 'transparent',
                            color: configureOpen ? 'var(--accent)' : 'var(--text-muted)',
                            cursor: 'pointer',
                            transition: 'background 100ms ease, color 100ms ease',
                        }}
                        onMouseEnter={(event) => { event.currentTarget.style.color = 'var(--accent)'; }}
                        onMouseLeave={(event) => {
                            event.currentTarget.style.color = configureOpen ? 'var(--accent)' : 'var(--text-muted)';
                        }}
                    >
                        <IconAdjustments size={15} />
                    </button>
                )}
            </div>

            {/* ── Collapsed details ── */}
            {detailsOpen && details && (
                <div style={{ padding: '0 12px 10px', paddingLeft: onToggle ? 38 : 12 }}>{details}</div>
            )}

            {/* ── Parameter configuration ── */}
            {configureOpen && configurePanel && (
                <div
                    style={{
                        padding: '10px 12px 12px',
                        paddingLeft: onToggle ? 38 : 12,
                        borderTop: '1px solid var(--border-subtle)',
                    }}
                >
                    {configurePanel}
                </div>
            )}
        </div>
    );
};

export default CapabilityRow;
