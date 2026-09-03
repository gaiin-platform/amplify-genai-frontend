/**
 * WorkflowTemplatePicker — Capabilities → Workflow Template, in the new UI.
 *
 * Replaces `components/AssistantWorkflows/AssistantWorkflowSelector` at this call
 * site. That component is untouched and still serves the classic editor
 * (NEW_UI_GUIDE §1); this is a new front end over the same service.
 *
 * Two things the old selector did that are deliberately dropped:
 *
 *   - Its own bold "Base Assistant Workflow Template" heading, which duplicated
 *     the CapabilityCard header directly above it.
 *   - A permanently-rendered `<AssistantWorkflowBuilder isOpen={false}>`. The
 *     builder self-guards with `if (!isOpen) return null`, but mounting it always
 *     still runs its effects; here it is early-returned instead (guide §5.2).
 */

import React, { useContext, useEffect, useRef, useState } from 'react';
import { IconLoader2, IconPlus } from '@tabler/icons-react';
import { useSession } from 'next-auth/react';
import HomeContext from '@/pages/api/home/home.context';
import { AstWorkflow } from '@/types/assistantWorkflows';
import { listAstWorkflowTemplates } from '@/services/assistantWorkflowService';
import { getUserIdentifier, snakeCaseToTitleCase } from '@/utils/app/data';
import { AssistantWorkflowBuilder } from '@/components/AssistantWorkflows/AssistantWorkflowBuilder';

export interface WorkflowTemplatePickerProps {
    /** `data.baseWorkflowTemplateId` on the assistant definition. */
    selectedTemplateId: string | undefined;
    /** Empty selection arrives as `''`; the modal maps that to `undefined`. */
    onTemplateChange: (workflowTemplateId: string) => void;
    disabled?: boolean;
}

const selectStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    borderRadius: 8,
    border: '1px solid var(--border-subtle)',
    background: 'var(--bg-app)',
    color: 'var(--text-primary)',
    padding: '8px 12px',
    fontSize: 14,
    fontFamily: 'Inter, ui-sans-serif, sans-serif',
    outline: 'none',
    cursor: 'pointer',
    transition: 'border-color 120ms ease',
};

const hintStyle: React.CSSProperties = {
    fontSize: 12,
    color: 'var(--text-muted)',
    margin: '6px 0 0',
};

export const WorkflowTemplatePicker: React.FC<WorkflowTemplatePickerProps> = ({
    selectedTemplateId,
    onTemplateChange,
    disabled = false,
}) => {
    const { data: session } = useSession();
    const user = getUserIdentifier(session?.user);
    const { state: { featureFlags, amplifyUsers } } = useContext(HomeContext);

    const [templates, setTemplates] = useState<AstWorkflow[] | null>(null);
    const [builderOpen, setBuilderOpen] = useState(false);

    // Re-armed in the effect body, not by the initial value: StrictMode mounts →
    // unmounts → remounts, and a `useRef(true)` + unmount-only cleanup latches
    // false forever, stranding the loading state (guide §16).
    const alive = useRef(true);
    useEffect(() => {
        alive.current = true;
        return () => { alive.current = false; };
    }, []);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const response = await listAstWorkflowTemplates(true, true);
                if (cancelled || !alive.current) return;
                setTemplates(response.success ? response.data?.templates ?? [] : []);
            } catch {
                if (!cancelled && alive.current) setTemplates([]);
            }
        };
        load();
        return () => { cancelled = true; };
    }, []);

    const allowCreation = Boolean(featureFlags.createAssistantWorkflows);
    const loading = templates === null;
    const isEmpty = !loading && templates.length === 0;
    const selected = templates?.find((template) => template.templateId === selectedTemplateId);

    // Guide §5.2 — one modal at a time, as an early return below every hook.
    if (builderOpen) {
        return (
            <AssistantWorkflowBuilder
                isOpen
                onClose={() => setBuilderOpen(false)}
                onRegister={(template) => {
                    if (!template.isBaseTemplate) return;
                    setTemplates((prev) => [...(prev ?? []), template]);
                    onTemplateChange(template.templateId);
                }}
            />
        );
    }

    const describe = (template: AstWorkflow): string => {
        const owner = template.user && template.user !== user
            ? ` — provided by ${amplifyUsers?.[template.user] || template.user}`
            : '';
        return `${template.description ?? ''}${owner}`;
    };

    return (
        <div>
            <label
                htmlFor="ast-workflow-template"
                style={{
                    display: 'block',
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--text-secondary)',
                    marginBottom: 6,
                }}
            >
                Base template
            </label>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                    <select
                        id="ast-workflow-template"
                        value={selectedTemplateId ?? ''}
                        disabled={loading || isEmpty || disabled}
                        onChange={(event) => onTemplateChange(event.target.value)}
                        style={{
                            ...selectStyle,
                            opacity: loading || isEmpty || disabled ? 0.5 : 1,
                            cursor: loading || isEmpty || disabled ? 'not-allowed' : 'pointer',
                            paddingRight: loading ? 34 : 12,
                        }}
                        onFocus={(event) => { event.target.style.borderColor = 'var(--accent)'; }}
                        onBlur={(event) => { event.target.style.borderColor = 'var(--border-subtle)'; }}
                    >
                        <option value="">
                            {loading
                                ? 'Loading templates…'
                                : isEmpty
                                    ? 'No templates available'
                                    : 'No template'}
                        </option>
                        {templates?.map((template) => (
                            <option
                                key={template.templateId}
                                value={template.templateId}
                                title={describe(template)}
                            >
                                {snakeCaseToTitleCase(template.name)}
                            </option>
                        ))}
                    </select>

                    {loading && (
                        <IconLoader2
                            size={14}
                            className="motion-safe:animate-spin"
                            aria-hidden="true"
                            style={{
                                position: 'absolute',
                                right: 12,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: 'var(--text-muted)',
                                pointerEvents: 'none',
                            }}
                        />
                    )}
                </div>

                {allowCreation && !disabled && (
                    <button
                        type="button"
                        id="baseAssistantWorkflowTemplateAdd"
                        aria-label="Create a new workflow template"
                        title="Create a new workflow template"
                        onClick={() => setBuilderOpen(true)}
                        style={{
                            flexShrink: 0,
                            display: 'grid',
                            placeItems: 'center',
                            width: 36,
                            height: 36,
                            borderRadius: 8,
                            border: '1px solid var(--border-subtle)',
                            background: 'var(--bg-app)',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            transition: 'background 120ms ease, color 120ms ease, border-color 120ms ease',
                        }}
                        onMouseEnter={(event) => {
                            const el = event.currentTarget;
                            el.style.background = 'var(--bg-hover)';
                            el.style.color = 'var(--accent)';
                            el.style.borderColor = 'color-mix(in srgb, var(--accent) 40%, var(--border-subtle))';
                        }}
                        onMouseLeave={(event) => {
                            const el = event.currentTarget;
                            el.style.background = 'var(--bg-app)';
                            el.style.color = 'var(--text-secondary)';
                            el.style.borderColor = 'var(--border-subtle)';
                        }}
                    >
                        <IconPlus size={16} />
                    </button>
                )}
            </div>

            {selected?.description ? (
                <p style={hintStyle}>{describe(selected)}</p>
            ) : (
                <p style={hintStyle}>
                    A base template makes this an Agent (v4) assistant and fixes the steps it runs.
                </p>
            )}
        </div>
    );
};

export default WorkflowTemplatePicker;
