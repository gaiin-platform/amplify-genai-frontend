/**
 * ParameterBindingEditor — per-parameter AI/Manual binding, in the new UI.
 *
 * Replaces `components/AssistantApi/ApiParameterBindingEditor` at this call site;
 * that component is untouched and still serves the classic editor
 * (NEW_UI_GUIDE §1). Prop names are kept identical so the port is a swap.
 *
 * This component is deliberately controlled and stateless: the draft
 * (`paramModes` / `paramValues`) lives in the panel, which seeds it from the
 * op's saved bindings via `toolSelectionModel#bindingsToDraft`. The old editors
 * kept the draft locally and mounted it *empty*, so editing one parameter of a
 * saved op rebuilt the binding map from nothing and wiped every other parameter
 * the user had configured.
 *
 * Required/optional is a label rather than the old red asterisk / green dash
 * pair, which spent two semantic colors on a distinction that reads better as a
 * word.
 */

import React from 'react';
import { IconRobot, IconUserCog } from '@tabler/icons-react';
import { OpBindingMode, Schema } from '@/types/op';

export interface ParameterBindingEditorProps {
    paramSource: Schema | undefined;
    paramModes: Record<string, OpBindingMode>;
    paramValues: Record<string, string>;
    onParamModeChange: (param: string, mode: OpBindingMode) => void;
    onParamValueChange: (param: string, value: string) => void;
}

/** Port of ApiParameterBindingEditor#formatOperationName. */
const formatParamName = (name: string): string =>
    name
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
        .replace(/([A-Z])/g, ' $1')
        .trim()
        .replace(/\s+/g, ' ');

const MODES: { id: OpBindingMode; label: string; icon: typeof IconRobot; title: string }[] = [
    {
        id: 'ai',
        label: 'AI',
        icon: IconRobot,
        title: 'Let AI generate the parameter value. Add hints to influence it (optional).',
    },
    {
        id: 'manual',
        label: 'Manual',
        icon: IconUserCog,
        title: 'Manually specify the parameter value.',
    },
];

export const ParameterBindingEditor: React.FC<ParameterBindingEditorProps> = ({
    paramSource,
    paramModes,
    paramValues,
    onParamModeChange,
    onParamValueChange,
}) => {
    const properties = paramSource?.properties;

    if (!properties || Object.keys(properties).length === 0) {
        return (
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                No parameters to configure.
            </p>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.entries(properties).map(([paramName, paramInfo]: [string, any]) => {
                const mode: OpBindingMode = paramModes[paramName] ?? 'ai';
                const required = paramSource?.required?.includes(paramName);
                const inputId = `binding-${paramName}`;

                return (
                    <div
                        key={paramName}
                        style={{
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 8,
                            background: 'var(--bg-card)',
                            padding: 10,
                        }}
                    >
                        {/* Name + type + required */}
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'baseline',
                                gap: 6,
                                flexWrap: 'wrap',
                                marginBottom: 8,
                            }}
                        >
                            <label
                                htmlFor={inputId}
                                style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-primary)' }}
                            >
                                {formatParamName(paramName)}
                            </label>
                            {paramInfo?.type && (
                                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                    {paramInfo.type}
                                </span>
                            )}
                            <span
                                style={{
                                    fontSize: 11,
                                    color: required ? 'var(--text-secondary)' : 'var(--text-muted)',
                                    fontWeight: required ? 500 : 400,
                                }}
                            >
                                {required ? 'required' : 'optional'}
                            </span>
                        </div>

                        {/* Mode toggle + value */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <div
                                role="group"
                                aria-label={`How to fill ${formatParamName(paramName)}`}
                                style={{
                                    display: 'flex',
                                    flexShrink: 0,
                                    border: '1px solid var(--border-subtle)',
                                    borderRadius: 6,
                                    overflow: 'hidden',
                                }}
                            >
                                {MODES.map(({ id, label, icon: Icon, title }) => {
                                    const active = mode === id;
                                    return (
                                        <button
                                            key={id}
                                            type="button"
                                            title={title}
                                            aria-pressed={active}
                                            onClick={() => onParamModeChange(paramName, id)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 4,
                                                padding: '5px 9px',
                                                border: 'none',
                                                background: active ? 'var(--accent)' : 'transparent',
                                                color: active ? 'var(--accent-fg)' : 'var(--text-secondary)',
                                                fontSize: 11.5,
                                                fontWeight: active ? 500 : 400,
                                                fontFamily: 'inherit',
                                                cursor: 'pointer',
                                                transition: 'background 100ms ease, color 100ms ease',
                                            }}
                                        >
                                            <Icon size={13} aria-hidden="true" />
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>

                            <input
                                id={inputId}
                                type="text"
                                value={paramValues[paramName] ?? ''}
                                onChange={(event) => onParamValueChange(paramName, event.target.value)}
                                placeholder={
                                    mode === 'manual'
                                        ? `Enter ${formatParamName(paramName)}…`
                                        : 'Hints for the AI (optional)'
                                }
                                style={{
                                    flex: 1,
                                    minWidth: 140,
                                    boxSizing: 'border-box',
                                    borderRadius: 6,
                                    border: '1px solid var(--border-subtle)',
                                    background: 'var(--bg-app)',
                                    color: 'var(--text-primary)',
                                    padding: '6px 9px',
                                    fontSize: 12.5,
                                    fontFamily: 'inherit',
                                    outline: 'none',
                                    transition: 'border-color 120ms ease',
                                }}
                                onFocus={(event) => { event.target.style.borderColor = 'var(--accent)'; }}
                                onBlur={(event) => { event.target.style.borderColor = 'var(--border-subtle)'; }}
                            />
                        </div>

                        {paramInfo?.description && (
                            <p style={{ margin: '7px 0 0', fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.45 }}>
                                {paramInfo.description}
                            </p>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default ParameterBindingEditor;
