/**
 * NewUIPromptCreationModal — new-UI creation/edit shell for prompt templates.
 *
 * Wraps the essential prompt template fields in a `CreationModalShell` to give
 * consistent modal dimensions, chrome, and behaviour with the assistant creation
 * flow (wiki §9 rule 19 close-button placement, focus trap, entrance animation).
 *
 * Implementation path: Option A (ported essential fields).
 *   Ported fields: Name · Description · Prompt body (content)
 *   "Full editor →" escape hatch opens the old PromptModal for advanced options
 *   (variables, tags, message type, code/workflow templates).
 *
 * // TODO: Port remaining advanced fields (selectedTemplate/message-type selector,
 * // variableOptions, conversationTags, requiredTags, code/workflow block) to this
 * // component in a future phase. For now, "Full editor" opens the old PromptModal
 * // pre-populated with values entered so far.
 *
 * Props mirror PromptModal exactly so PromptTemplatesSection can swap them 1:1.
 *
 * Location: components/NewUI/views/NewUIPromptCreationModal.tsx
 */

import React, { useState, useRef, useEffect } from 'react';
import { IconChevronRight } from '@tabler/icons-react';
import { Prompt } from '@/types/prompt';
import { CreationModalShell } from '@/components/NewUI/shared/CreationModalShell';
import { PromptModal } from '@/components/Promptbar/components/PromptModal';

// ── Props (mirror PromptModal exactly for drop-in swap) ───────────────────────

export interface NewUIPromptCreationModalProps {
    prompt: Prompt;
    onSave: () => void;
    onCancel: () => void;
    onUpdatePrompt: (prompt: Prompt) => void;
}

// ── Shared field styles (match NewUIAssistantCreationModal) ───────────────────

const inputStyle: React.CSSProperties = {
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
    transition: 'border-color 120ms ease',
};

const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text-secondary)',
    marginBottom: 6,
};

const fieldGroupStyle: React.CSSProperties = {
    marginBottom: 20,
};

// ── Component ─────────────────────────────────────────────────────────────────

export const NewUIPromptCreationModal: React.FC<NewUIPromptCreationModalProps> = ({
    prompt,
    onSave,
    onCancel,
    onUpdatePrompt,
}) => {
    const [name, setName] = useState(prompt.name || '');
    const [nameError, setNameError] = useState('');
    const [description, setDescription] = useState(prompt.description || '');
    const [content, setContent] = useState(prompt.content || '');

    // "Full editor" escape hatch — opens old PromptModal as early return
    const [showFullEditor, setShowFullEditor] = useState(false);

    // Track current form state in a ref so the full-editor hand-off can read it
    const stateRef = useRef({ name, description, content });
    useEffect(() => {
        stateRef.current = { name, description, content };
    }, [name, description, content]);

    // ── Save handler ──────────────────────────────────────────────────────
    const handleSave = () => {
        if (!name.trim()) {
            setNameError('Name is required');
            return;
        }
        setNameError('');

        const updated: Prompt = {
            ...prompt,
            name: name.trim(),
            description: description.trim(),
            content: content.trim(),
        };
        onUpdatePrompt(updated);
        onSave();
    };

    // ── "Full editor" — build a pre-populated prompt and show PromptModal ─
    const handleOpenFullEditor = () => {
        // Pre-populate the prompt with values the user has entered so far, then
        // hand off to PromptModal (which handles all the advanced fields).
        // The onUpdatePrompt / onSave / onCancel props pass through unchanged,
        // so PromptTemplatesSection's cancel-cleanup logic still fires correctly.
        const current = stateRef.current;
        const prePopulated: Prompt = {
            ...prompt,
            name: current.name.trim() || prompt.name,
            description: current.description.trim(),
            content: current.content.trim(),
        };
        // Patch the prompt reference in place so PromptModal gets the latest values
        Object.assign(prompt, prePopulated);
        setShowFullEditor(true);
    };

    // ── If user opened full editor, render old PromptModal as early return ─
    // (wiki §9 rule 21 — modal that opens another must render as early return)
    if (showFullEditor) {
        return (
            <PromptModal
                prompt={prompt}
                onSave={onSave}
                onCancel={onCancel}
                onUpdatePrompt={onUpdatePrompt}
            />
        );
    }

    // ── Title for the shell — "New Template" for empty prompts, "Edit Template" otherwise ──
    const isNewPrompt = !prompt.description && !prompt.content;
    const shellTitle = isNewPrompt ? 'New Template' : 'Edit Template';

    return (
        <CreationModalShell
            title={shellTitle}
            onClose={onCancel}
            onSave={handleSave}
            saveLabel={isNewPrompt ? 'Create' : 'Save'}
        >
            {/* ── Name ─────────────────────────────────────────────────── */}
            <div style={fieldGroupStyle}>
                <label htmlFor="pt-creation-name" style={labelStyle}>
                    Name <span style={{ color: '#e05252' }}>*</span>
                </label>
                <input
                    id="pt-creation-name"
                    type="text"
                    value={name}
                    onChange={(e) => {
                        setName(e.target.value);
                        if (e.target.value.trim()) setNameError('');
                    }}
                    placeholder="Give your template a name"
                    maxLength={200}
                    style={{
                        ...inputStyle,
                        borderColor: nameError ? '#e05252' : 'var(--border-subtle)',
                    }}
                    onFocus={(e) => { e.target.style.borderColor = nameError ? '#e05252' : 'var(--accent)'; }}
                    onBlur={(e) => { e.target.style.borderColor = nameError ? '#e05252' : 'var(--border-subtle)'; }}
                />
                {nameError && (
                    <p style={{ fontSize: 12, color: '#e05252', margin: '4px 0 0' }}>{nameError}</p>
                )}
            </div>

            {/* ── Description ──────────────────────────────────────────── */}
            <div style={fieldGroupStyle}>
                <label htmlFor="pt-creation-description" style={labelStyle}>
                    Description
                </label>
                <textarea
                    id="pt-creation-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What does this template do?"
                    rows={2}
                    style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }}
                    onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
                    onBlur={(e) => { e.target.style.borderColor = 'var(--border-subtle)'; }}
                />
            </div>

            {/* ── Prompt body / content ─────────────────────────────────── */}
            <div style={fieldGroupStyle}>
                <label htmlFor="pt-creation-content" style={labelStyle}>
                    Prompt
                </label>
                <textarea
                    id="pt-creation-content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Enter your prompt content. Use {{variable}} for variables."
                    rows={10}
                    style={{ ...inputStyle, resize: 'vertical', minHeight: 200 }}
                    onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
                    onBlur={(e) => { e.target.style.borderColor = 'var(--border-subtle)'; }}
                />
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                    Use {'{{variable}}'} syntax to add dynamic variables
                </p>
            </div>

            {/* ── "Full editor" escape hatch ────────────────────────────── */}
            {/*
             * TODO: Port remaining advanced fields (selectedTemplate / message-type
             * selector, variableOptions editor, conversationTags, requiredTags,
             * code/workflow templates, rootPrompt/custom-instructions selector) in
             * a future phase. For now this button hands off to the old PromptModal
             * pre-populated with values entered so far.
             */}
            <div style={{ paddingTop: 20, borderTop: '1px solid var(--border-subtle)' }}>
                <button
                    onClick={handleOpenFullEditor}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-secondary)',
                        fontSize: 13,
                        fontFamily: 'inherit',
                        padding: '4px 0',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
                >
                    <IconChevronRight size={14} stroke={2} />
                    Full editor (variables, tags, message type, …)
                </button>
            </div>
        </CreationModalShell>
    );
};

export default NewUIPromptCreationModal;
