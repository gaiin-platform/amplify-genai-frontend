/**
 * CompositeToolCard — one task-based tool ("Read Email", "Send Email") in the
 * Capabilities → Tools & APIs panel.
 *
 * Replaces `CompositeActionsPanel#renderCard`. That component is untouched and
 * still serves the classic editor (NEW_UI_GUIDE §1).
 *
 * A composite is a named bundle of backend ops. Checking it selects all of them;
 * the gear opens the parameter bindings for each op in the bundle that takes
 * parameters.
 *
 * Visually this is a flat card with an accent border and a `color-mix` tint when
 * selected, replacing the old `bg-gradient-to-br from-blue-100 via-blue-50 …
 * shadow-lg` (selected) and `from-gray-200 via-gray-100 to-gray-300 … shadow-lg`
 * (default) pair.
 */

import React from 'react';
import { IconAdjustments, IconCheck } from '@tabler/icons-react';
import { OpBindingMode, OpDef } from '@/types/op';
import { CompositeFunction } from '@/utils/app/compositeFunctions';
import { getOperationIcon } from '@/utils/app/integrations';
import { ParameterBindingEditor } from './ParameterBindingEditor';
import { BindingDraft, hasConfigurableParameters } from './toolSelectionModel';

export interface CompositeToolCardProps {
    fn: CompositeFunction;
    /** Ops from the live list that this composite resolves to. */
    resolvedOps: OpDef[];
    selected: boolean;
    /** False when the integration is not connected, or no op is deployed. */
    available: boolean;
    onToggle: (checked: boolean) => void;
    /** Omit to hide the gear entirely. */
    configOpen?: boolean;
    onConfigToggle?: () => void;
    /** Per-op draft, keyed by op id. */
    draftFor?: (op: OpDef) => BindingDraft;
    onParamModeChange?: (op: OpDef, param: string, mode: OpBindingMode) => void;
    onParamValueChange?: (op: OpDef, param: string, value: string) => void;
}

export const CompositeToolCard: React.FC<CompositeToolCardProps> = ({
    fn,
    resolvedOps,
    selected,
    available,
    onToggle,
    configOpen = false,
    onConfigToggle,
    draftFor,
    onParamModeChange,
    onParamValueChange,
}) => {
    const configurableOps = resolvedOps.filter((op) => hasConfigurableParameters(op.parameters));
    const showGear = Boolean(onConfigToggle) && available && configurableOps.length > 0;

    // The old card used the first op's name to pick a glyph; kept, so a composite
    // keeps the icon users already associate with it.
    const Icon = getOperationIcon(fn.operations[0] ?? fn.id);

    const activate = () => {
        if (!available) return;
        onToggle(!selected);
    };

    return (
        <div
            style={{
                borderRadius: 8,
                border: `1px solid ${
                    selected && available
                        ? 'var(--accent)'
                        : 'var(--border-subtle)'
                }`,
                background: selected && available
                    ? 'color-mix(in srgb, var(--accent) 10%, var(--bg-app))'
                    : 'var(--bg-app)',
                opacity: available ? 1 : 0.55,
                transition: 'border-color 140ms ease, background 140ms ease',
            }}
        >
            {/* ── Header ── */}
            <div
                role="option"
                aria-selected={selected}
                aria-disabled={!available || undefined}
                tabIndex={available ? 0 : -1}
                onClick={activate}
                onKeyDown={(event) => {
                    if (!available) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        activate();
                    }
                }}
                onFocus={(event) => {
                    if (available) {
                        (event.currentTarget as HTMLElement).style.boxShadow = 'inset 0 0 0 2px var(--accent)';
                    }
                }}
                onBlur={(event) => {
                    (event.currentTarget as HTMLElement).style.boxShadow = 'none';
                }}
                title={available ? undefined : 'Connect this integration to use it'}
                style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 9,
                    padding: '9px 11px',
                    borderRadius: 8,
                    cursor: available ? 'pointer' : 'not-allowed',
                    outline: 'none',
                }}
            >
                {/* Checkbox */}
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
                        border: `1px solid ${selected && available ? 'var(--accent)' : 'var(--border-subtle)'}`,
                        background: selected && available ? 'var(--accent)' : 'transparent',
                        color: 'var(--accent-fg)',
                    }}
                >
                    {selected && <IconCheck size={11} />}
                </span>

                {/* Icon */}
                <span
                    aria-hidden="true"
                    style={{
                        display: 'grid',
                        placeItems: 'center',
                        width: 18,
                        marginTop: 1,
                        flexShrink: 0,
                        color: selected && available ? 'var(--accent)' : 'var(--text-secondary)',
                    }}
                >
                    <Icon size={17} />
                </span>

                {/* Name + description */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                        {fn.name}
                    </span>
                    {fn.description && (
                        <p
                            style={{
                                margin: '3px 0 0',
                                fontSize: 12,
                                lineHeight: 1.45,
                                color: 'var(--text-secondary)',
                            }}
                        >
                            {fn.description}
                        </p>
                    )}
                </div>

                {/* Gear */}
                {showGear && (
                    <button
                        type="button"
                        aria-label={configOpen ? `Hide ${fn.name} parameters` : `Configure ${fn.name} parameters`}
                        aria-expanded={configOpen}
                        title="Configure parameters"
                        onClick={(event) => {
                            event.stopPropagation();
                            onConfigToggle?.();
                        }}
                        style={{
                            flexShrink: 0,
                            display: 'grid',
                            placeItems: 'center',
                            width: 26,
                            height: 26,
                            borderRadius: 6,
                            border: 'none',
                            background: configOpen ? 'var(--bg-active)' : 'transparent',
                            color: configOpen ? 'var(--accent)' : 'var(--text-muted)',
                            cursor: 'pointer',
                            transition: 'background 100ms ease, color 100ms ease',
                        }}
                        onMouseEnter={(event) => { event.currentTarget.style.color = 'var(--accent)'; }}
                        onMouseLeave={(event) => {
                            event.currentTarget.style.color = configOpen ? 'var(--accent)' : 'var(--text-muted)';
                        }}
                    >
                        <IconAdjustments size={15} />
                    </button>
                )}
            </div>

            {/* ── Per-op parameter configuration ── */}
            {configOpen && configurableOps.length > 0 && (
                <div
                    style={{
                        padding: '10px 11px 12px',
                        borderTop: '1px solid var(--border-subtle)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                    }}
                >
                    {configurableOps.map((opDef) => {
                        const draft = draftFor?.(opDef) ?? { modes: {}, values: {} };
                        return (
                            <div key={opDef.id}>
                                <p
                                    style={{
                                        margin: '0 0 6px',
                                        fontSize: 11,
                                        fontWeight: 600,
                                        color: 'var(--text-muted)',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                    }}
                                >
                                    {opDef.name}
                                </p>
                                <ParameterBindingEditor
                                    paramSource={opDef.parameters}
                                    paramModes={draft.modes}
                                    paramValues={draft.values}
                                    onParamModeChange={(param, mode) => onParamModeChange?.(opDef, param, mode)}
                                    onParamValueChange={(param, value) => onParamValueChange?.(opDef, param, value)}
                                />
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default CompositeToolCard;
