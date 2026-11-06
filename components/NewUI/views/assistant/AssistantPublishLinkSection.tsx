/**
 * AssistantPublishLinkSection — the "Publish at a link" setting every assistant type offers: a switch,
 * and when it is on the shared `AssistantPathField` for the `/assistants/<path>` address.
 *
 * Turning it off and saving unpublishes the assistant (its link stops working); see
 * `assistantLinkModel` for what a save sends. State and the availability checks live in the modal; the
 * wording of who can open the link depends on the assistant type, so the host passes it in.
 */

import React, { useId } from 'react';
import { ToggleSwitch } from '@/components/NewUI/shared/ToggleSwitch';
import { AssistantPathField, AssistantPathFieldProps } from './AssistantPathField';

export interface AssistantPublishLinkSectionProps {
    enabled: boolean;
    onEnabledChange: (enabled: boolean) => void;
    /** Who can open the link, in this assistant type's terms. */
    description: React.ReactNode;
    /** The assistant is published right now — switching off will take that link down on save. */
    isPublishedNow: boolean;
    field: Omit<AssistantPathFieldProps, 'id'>;
    /**
     * Who can open the published link: anyone, or only people with access. Omitted when the audience is
     * fixed (a group's link is for the group's members). The wording of each choice depends on the
     * assistant type, so the host supplies it.
     */
    audience?: {
        restricted: boolean;
        onChange: (restricted: boolean) => void;
        anyone: AudienceOptionCopy;
        restrictedOption: AudienceOptionCopy;
    };
}

export interface AudienceOptionCopy {
    title: string;
    description: string;
}

const title: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0 };
const muted: React.CSSProperties = { fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' };

/** One choice of the "who can open it" list: a native radio (so arrow keys and screen readers just work) on a card. */
const AudienceOption: React.FC<{
    name: string;
    checked: boolean;
    onSelect: () => void;
    copy: AudienceOptionCopy;
}> = ({ name, checked, onSelect, copy }) => (
    <label
        style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            padding: '10px 12px',
            borderRadius: 8,
            cursor: 'pointer',
            border: `1px solid ${checked ? 'var(--accent)' : 'var(--border-subtle)'}`,
            background: checked ? 'var(--bg-active)' : 'var(--bg-app)',
        }}
    >
        <input
            type="radio"
            name={name}
            checked={checked}
            onChange={onSelect}
            style={{ marginTop: 2, accentColor: 'var(--accent)', flexShrink: 0 }}
        />
        <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{copy.title}</span>
            <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{copy.description}</span>
        </span>
    </label>
);

export const AssistantPublishLinkSection: React.FC<AssistantPublishLinkSectionProps> = ({
    enabled,
    onEnabledChange,
    description,
    isPublishedNow,
    field,
    audience,
}) => {
    const baseId = useId();
    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                <div style={{ minWidth: 0 }}>
                    <span id={`${baseId}-publish-url`} style={title}>Publish at a link</span>
                    <p style={muted}>{description}</p>
                </div>
                <ToggleSwitch
                    checked={enabled}
                    onChange={onEnabledChange}
                    aria-labelledby={`${baseId}-publish-url`}
                />
            </div>

            {enabled && audience && (
                <fieldset style={{ border: 'none', margin: '14px 0 0', padding: 0 }}>
                    <legend style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', padding: 0, marginBottom: 6 }}>
                        Who can open the link
                    </legend>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <AudienceOption
                            name={`${baseId}-audience`}
                            checked={!audience.restricted}
                            onSelect={() => audience.onChange(false)}
                            copy={audience.anyone}
                        />
                        <AudienceOption
                            name={`${baseId}-audience`}
                            checked={audience.restricted}
                            onSelect={() => audience.onChange(true)}
                            copy={audience.restrictedOption}
                        />
                    </div>
                </fieldset>
            )}

            {enabled && (
                <div style={{ marginTop: 14 }}>
                    <AssistantPathField id={`${baseId}-path`} {...field} />
                </div>
            )}

            {!enabled && isPublishedNow && (
                <p role="status" style={{ ...muted, marginTop: 8, color: 'var(--warning-fg)' }}>
                    Saving will unpublish this assistant — its current link will stop working.
                </p>
            )}
        </div>
    );
};
