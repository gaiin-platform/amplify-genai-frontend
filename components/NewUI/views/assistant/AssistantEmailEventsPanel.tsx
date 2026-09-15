/**
 * AssistantEmailEventsPanel — New-UI replacement for AssistantEmailEvents.
 *
 * Uses ToggleSwitch (not Checkbox) and design-token text colors so the panel
 * reads correctly in both light and dark mode inside the new creation modal.
 *
 * Props are identical to AssistantEmailEvents so swapping the import is the
 * only change needed in NewUIAssistantCreationModal.
 */

import React, { useContext, useEffect, useRef } from 'react';
import {
    IconAlertTriangle,
    IconBulb,
    IconCheck,
    IconLoader2,
    IconMailBolt,
    IconPencilBolt,
} from '@tabler/icons-react';
import { useSession } from 'next-auth/react';
import HomeContext from '@/pages/api/home/home.context';
import { ToggleSwitch } from '@/components/NewUI/shared/ToggleSwitch';
import {
    constructAstEventEmailAddress,
    EMAIL_EVENT_TAG_PREFIX,
    isPresetEmailEventTag,
    safeEmailEventTag,
} from '@/utils/app/assistantEmailEvents';
import { isEventTemplateTagAvailable } from '@/services/emailEventService';

// Fallback in case the util import is unavailable
const isPresetEmailEventTagFallback = (initialTag: string | undefined): boolean => {
    if (!initialTag) return false;
    return !initialTag.startsWith(EMAIL_EVENT_TAG_PREFIX);
};

interface Props {
    assistantId: string | undefined;
    initialEmailEventTag: string | undefined;
    enableEmailEvents: boolean;
    setEnableEmailEvents: (v: boolean) => void;
    emailEventTag: string | undefined;
    setEmailEventTag: (v: string | undefined) => void;
    emailEventTemplate: { systemPrompt?: string; userPrompt?: string } | undefined;
    setEmailEventTemplate: (v: { systemPrompt?: string; userPrompt?: string } | undefined) => void;
    isTagAvailable: boolean;
    setIsTagAvailable: (v: boolean) => void;
    isCheckingTag: boolean;
    setIsCheckingTag: (v: boolean) => void;
    assistantName: string;
    disableEdit: boolean;
}

export const AssistantEmailEventsPanel: React.FC<Props> = ({
    initialEmailEventTag,
    enableEmailEvents,
    setEnableEmailEvents,
    disableEdit,
    assistantName,
    assistantId,
    emailEventTag,
    setEmailEventTag,
    emailEventTemplate,
    setEmailEventTemplate,
    isTagAvailable,
    setIsTagAvailable,
    isCheckingTag,
    setIsCheckingTag,
}) => {
    const { state: { aiEmailDomain, featureFlags } } = useContext(HomeContext);
    const { data: session } = useSession();
    const userEmail = session?.user?.email ?? '';

    const isPresetCheck =
        typeof isPresetEmailEventTag === 'function'
            ? isPresetEmailEventTag
            : isPresetEmailEventTagFallback;

    const validatedTagCacheRef = useRef<{ valid: string[]; invalid: string[] }>({
        valid: [],
        invalid: [],
    });

    const handleCheckIsTagAvailable = async (tag: string) => {
        if (
            validatedTagCacheRef.current.valid.includes(tag) ||
            validatedTagCacheRef.current.invalid.includes(tag)
        ) {
            setIsTagAvailable(validatedTagCacheRef.current.valid.includes(tag));
            setIsCheckingTag(false);
            return;
        }

        const result = await isEventTemplateTagAvailable(tag, assistantId);
        let isAvailable = false;
        if (result && result.success) {
            isAvailable = result.data?.available;
            validatedTagCacheRef.current[isAvailable ? 'valid' : 'invalid'].push(tag);
            if (!featureFlags.assistantEmailEvents) {
                handleNotAvailableEditNotAllowed(tag);
                return;
            }
        }
        setIsTagAvailable(isAvailable);
        setIsCheckingTag(false);
    };

    const handleNotAvailableEditNotAllowed = (tag: string) => {
        const randomTag = `${tag}_${Math.floor(1000 + Math.random() * 9000)}`;
        setEmailEventTag(randomTag);
        setIsTagAvailable(true);
        setIsCheckingTag(false);
    };

    useEffect(() => {
        if (isCheckingTag)
            handleCheckIsTagAvailable(emailEventTag ?? safeEmailEventTag(assistantName));
    }, [isCheckingTag]);

    // ── sub-styles (all design-token based) ──────────────────────────────────

    const labelStyle: React.CSSProperties = {
        color: 'var(--text-primary)',
        fontSize: '14px',
        fontWeight: 600,
    };

    const secondaryStyle: React.CSSProperties = {
        color: 'var(--text-secondary)',
        fontSize: '14px',
    };

    const mutedStyle: React.CSSProperties = {
        color: 'var(--text-muted)',
        fontSize: '13px',
    };

    const inputStyle: React.CSSProperties = {
        width: '200px',
        marginTop: '-3px',
        borderRadius: '8px',
        border: '1px solid var(--border-subtle)',
        padding: '4px 32px 4px 12px',
        background: 'var(--bg-raised)',
        color: 'var(--text-primary)',
        fontSize: '14px',
        outline: 'none',
    };

    const textareaStyle: React.CSSProperties = {
        width: '100%',
        borderRadius: '8px',
        border: '1px solid var(--border-subtle)',
        padding: '8px 12px',
        background: 'var(--bg-raised)',
        color: 'var(--text-primary)',
        fontSize: '14px',
        outline: 'none',
    };

    // ── info box (inline replacement so we keep design tokens) ───────────────
    const infoBoxStyle: React.CSSProperties = {
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '14px 16px',
        borderRadius: '8px',
        background: 'rgba(59,130,246,0.06)',
        border: '1px solid rgba(59,130,246,0.2)',
    };

    const emailAddress = constructAstEventEmailAddress(
        emailEventTag ?? safeEmailEventTag(assistantName),
        userEmail,
        aiEmailDomain,
    );

    const [isExpanded, setIsExpanded] = React.useState(false);

    return (
        <div style={{ color: 'var(--text-primary)' }}>
            {/* ── Toggle row ── */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    marginBottom: '12px',
                    cursor: disableEdit ? 'not-allowed' : 'pointer',
                }}
                onClick={() => {
                    if (!disableEdit) setEnableEmailEvents(!enableEmailEvents);
                }}
            >
                <ToggleSwitch
                    checked={enableEmailEvents}
                    onChange={setEnableEmailEvents}
                    disabled={disableEdit}
                    aria-label="Enable Email Events"
                />
                <span style={{ ...labelStyle, cursor: disableEdit ? 'not-allowed' : 'pointer' }}>
                    Enable Email Events
                </span>
                <IconMailBolt size={18} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
            </div>

            {/* ── Info box ── */}
            <div style={{ marginLeft: '0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={infoBoxStyle}>
                    <IconMailBolt
                        size={20}
                        style={{ color: 'var(--accent)', flexShrink: 0, marginTop: '1px' }}
                    />
                    <div style={secondaryStyle}>
                        This feature allows you to email your assistant directly. When enabled, you can
                        customize the assistant&apos;s behavior by configuring the system prompt and
                        instructions given to the assistant when it receives an email.
                        <div style={{ textAlign: 'center', marginTop: '8px' }}>
                            <span style={{ ...labelStyle }}>Email the Assistant at:</span>
                            <div style={{ color: 'var(--accent)', marginTop: '2px', wordBreak: 'break-all' }}>
                                {emailAddress}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Tag + availability row ── */}
                <div
                    style={{
                        opacity: enableEmailEvents ? 1 : 0.4,
                        position: 'relative',
                        width: '100%',
                        pointerEvents: enableEmailEvents ? undefined : 'none',
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start', gap: '8px' }}>
                        <span style={secondaryStyle}>Email Identifier Tag:</span>
                        <div style={{ position: 'relative' }}>
                            <input
                                style={inputStyle}
                                value={emailEventTag || safeEmailEventTag(assistantName)}
                                disabled={!enableEmailEvents || disableEdit || isPresetCheck(initialEmailEventTag)}
                                onChange={(e) => {
                                    const userInput = e.target.value;
                                    const newTag =
                                        userInput === EMAIL_EVENT_TAG_PREFIX ||
                                        userInput.length <= EMAIL_EVENT_TAG_PREFIX.length
                                            ? EMAIL_EVENT_TAG_PREFIX
                                            : safeEmailEventTag(userInput);
                                    setEmailEventTag(newTag);
                                }}
                                onBlur={() => {
                                    if (emailEventTag === EMAIL_EVENT_TAG_PREFIX) {
                                        setEmailEventTag(initialEmailEventTag);
                                        return;
                                    }
                                    setIsCheckingTag(true);
                                }}
                            />
                            {!isPresetCheck(initialEmailEventTag) && enableEmailEvents && (
                                <div
                                    style={{
                                        position: 'absolute',
                                        right: '8px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                    }}
                                >
                                    {isCheckingTag ? (
                                        <IconLoader2
                                            className="animate-spin"
                                            size={16}
                                            style={{ color: 'var(--text-muted)' }}
                                        />
                                    ) : isTagAvailable ? (
                                        <div
                                            style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'flex-end',
                                                marginTop: '24px',
                                            }}
                                            title="Tag is available"
                                        >
                                            <IconCheck size={16} style={{ color: '#22c55e' }} />
                                            <span style={{ fontSize: '11px', color: '#22c55e', marginRight: '-6px', marginTop: '4px' }}>
                                                available
                                            </span>
                                        </div>
                                    ) : (
                                        <div
                                            style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'flex-end',
                                                marginTop: '24px',
                                            }}
                                            title="Tag is already in use by another assistant"
                                        >
                                            <IconAlertTriangle size={16} style={{ color: '#ef4444' }} />
                                            <span style={{ fontSize: '11px', color: '#ef4444', marginRight: '-6px', marginTop: '4px' }}>
                                                Not Available
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Expand/collapse email instructions ── */}
                    <div style={{ marginTop: '12px' }}>
                        <button
                            type="button"
                            onClick={() => setIsExpanded(!isExpanded)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: 'none',
                                border: 'none',
                                padding: 0,
                                cursor: 'pointer',
                                color: 'var(--text-secondary)',
                                fontSize: '14px',
                                fontWeight: 500,
                            }}
                        >
                            {isExpanded ? (
                                <IconPencilBolt size={16} style={{ color: 'var(--accent)' }} />
                            ) : (
                                <IconPencilBolt size={16} style={{ color: 'var(--text-muted)' }} />
                            )}
                            Customize assistant&apos;s email response instructions
                        </button>

                        {isExpanded && (
                            <div
                                style={{
                                    marginTop: '10px',
                                    paddingLeft: '16px',
                                    borderLeft: '2px solid var(--border-subtle)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '12px',
                                }}
                            >
                                {[
                                    {
                                        key: 'systemPrompt',
                                        label: 'System Prompt',
                                        placeholder:
                                            'Instructions for how the assistant should process emails',
                                    },
                                    {
                                        key: 'userPrompt',
                                        label: 'Instructions',
                                        placeholder:
                                            'The email content will be appended to this prompt',
                                    },
                                ].map(({ key, label, placeholder }) => (
                                    <div
                                        key={key}
                                        title={!enableEmailEvents ? 'Enable Email Events To Edit' : ''}
                                    >
                                        <div
                                            style={{
                                                ...labelStyle,
                                                fontSize: '13px',
                                                marginBottom: '6px',
                                            }}
                                        >
                                            {label}
                                        </div>
                                        <textarea
                                            style={{
                                                ...textareaStyle,
                                                resize: !enableEmailEvents || disableEdit ? 'none' : 'vertical',
                                            }}
                                            placeholder={placeholder}
                                            value={
                                                emailEventTemplate?.[
                                                    key as keyof typeof emailEventTemplate
                                                ] || ''
                                            }
                                            onChange={(e) =>
                                                setEmailEventTemplate({
                                                    ...(emailEventTemplate || {}),
                                                    [key]: e.target.value,
                                                })
                                            }
                                            rows={2}
                                            disabled={!enableEmailEvents || disableEdit}
                                        />
                                    </div>
                                ))}

                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: '6px',
                                        ...mutedStyle,
                                    }}
                                >
                                    <IconBulb
                                        size={15}
                                        style={{ flexShrink: 0, marginTop: '1px' }}
                                    />
                                    <span>
                                        Use the following valid placeholders to dynamically insert
                                        data using the format {'${placeholder}'}
                                        <br />
                                        {'Valid placeholders: sender, recipients, cc, bcc, timestamp, subject, contents'}
                                        <br />
                                        {'Example instructions: Acknowledge the email came from ${sender} with subject "${subject}" and contains: ${contents}'}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AssistantEmailEventsPanel;
