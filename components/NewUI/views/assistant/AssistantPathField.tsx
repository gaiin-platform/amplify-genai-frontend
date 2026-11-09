/**
 * AssistantPathField — the "URL path" text input for publishing an assistant at
 * `/assistants/<path>`, with its inline status icon and message.
 *
 * Presentational only: the host owns the value and runs the checks (shape, reserved words,
 * appropriateness, not taken — see `assistantPathRules` and the modal's availability check) and
 * passes the outcome in. Shared by the "Anyone with the link" panel of a managed assistant and the
 * "Publish at a link" setting of a group assistant so the two always look and read the same.
 */

import React from 'react';
import { IconAlertTriangle, IconCheck, IconLoader2 } from '@tabler/icons-react';
import { SLUG_MAX_LENGTH } from './assistantPathRules';

export interface AssistantPathFieldProps {
    /** DOM id for the input; the status text is `${id}-status`. */
    id: string;
    value: string;
    /** Receives the raw typed text — the host cleans it (`cleanSlug`) and validates. */
    onChange: (raw: string) => void;
    /** Why the path was rejected ('' when fine). */
    error: string;
    checking: boolean;
    /** True once the path passed every check; null = not checked yet. */
    available: boolean | null;
    /** Shown with the "will be at …" line when available, e.g. "Available" or "Current path". */
    availableMessage: string;
    placeholder?: string;
}

const inputStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    borderRadius: 8,
    border: '1px solid var(--border-subtle)',
    background: 'var(--bg-app)',
    color: 'var(--text-primary)',
    padding: '7px 10px',
    paddingRight: 34,
    fontSize: 13,
    fontFamily: 'ui-monospace, SFMono-Regular, monospace',
    outline: 'none',
};

const statusText: React.CSSProperties = { fontSize: 11, margin: '4px 0 0' };

export const AssistantPathField: React.FC<AssistantPathFieldProps> = ({
    id,
    value,
    onChange,
    error,
    checking,
    available,
    availableMessage,
    placeholder = 'my-assistant',
}) => {
    const statusId = `${id}-status`;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';

    return (
        <div>
            <label htmlFor={id} style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                URL path<span style={{ color: '#e05252' }}> *</span>
            </label>
            <div style={{ position: 'relative' }}>
                <input
                    id={id}
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    maxLength={SLUG_MAX_LENGTH}
                    aria-invalid={!!error || undefined}
                    aria-describedby={statusId}
                    style={{
                        ...inputStyle,
                        borderColor: error ? '#e05252' : available === true ? '#3aa764' : 'var(--border-subtle)',
                    }}
                />
                {value && (
                    <span
                        aria-hidden="true"
                        style={{
                            position: 'absolute',
                            right: 10,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            lineHeight: 0,
                            pointerEvents: 'none',
                        }}
                    >
                        {checking ? (
                            <IconLoader2
                                size={14}
                                className="motion-safe:animate-spin motion-reduce:animate-none"
                                style={{ color: 'var(--text-muted)' }}
                            />
                        ) : available === true ? (
                            <IconCheck size={14} style={{ color: '#3aa764' }} />
                        ) : error ? (
                            <IconAlertTriangle size={14} style={{ color: '#e05252' }} />
                        ) : null}
                    </span>
                )}
            </div>
            <div id={statusId} role="status">
                {error ? (
                    <p style={{ ...statusText, color: '#e05252' }}>{error}</p>
                ) : checking ? (
                    <p style={{ ...statusText, color: 'var(--text-muted)' }}>Checking availability…</p>
                ) : available === true ? (
                    <p style={{ ...statusText, color: '#3aa764' }}>
                        {availableMessage} — will be at {origin}/assistants/{value}
                    </p>
                ) : value ? (
                    <p style={{ ...statusText, color: 'var(--text-muted)' }}>We’ll check availability after you stop typing.</p>
                ) : null}
            </div>
        </div>
    );
};
