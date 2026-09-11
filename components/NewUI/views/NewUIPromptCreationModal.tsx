/**
 * NewUIPromptCreationModal — new-UI creation/edit shell for prompt templates.
 *
 * Wraps the essential prompt template fields in a `CreationModalShell`.
 *
 * Implementation:
 *   - Name · Description · Prompt body (content)
 *   - "Insert Variable" button inserts {{placeholder}} at cursor position
 *   - Inline variable options section: per-variable type (text/file) + optional toggle
 *     This replaces the old "Full editor" escape hatch — the variable type and
 *     optional flag are now editable here, and changes are reflected back into
 *     the content string.
 *
 * Variable syntax written to content:
 *   text required  → {{varname}}
 *   text optional  → {{varname:text(optional:true)}}
 *   file required  → {{varname:file}}
 *   file optional  → {{varname:file(optional:true)}}
 *
 * Props mirror PromptModal exactly so PromptTemplatesSection can swap them 1:1.
 *
 * Location: components/NewUI/views/NewUIPromptCreationModal.tsx
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { IconVariable, IconInfoCircle } from '@tabler/icons-react';
import { Prompt } from '@/types/prompt';
import { CreationModalShell } from '@/components/NewUI/shared/CreationModalShell';
import { ToggleSwitch } from '@/components/NewUI/shared/ToggleSwitch';
import { parsePromptVariables, parsePromptVariableValues, getType, getName } from '@/utils/app/prompts';

// ── Info tooltip for the Variables section heading ────────────────────────────

const VarInfoTooltip: React.FC = () => {
  const [visible, setVisible] = useState(false);
  return (
    <div
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      <IconInfoCircle
        size={14}
        style={{ color: 'var(--text-muted)', cursor: 'default', flexShrink: 0 }}
        aria-label="About variables"
      />
      {visible && (
        <div
          role="tooltip"
          style={{
            position: 'absolute',
            left: 20,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 248,
            padding: '8px 10px',
            borderRadius: 8,
            background: 'var(--bg-raised)',
            border: '1px solid var(--border-subtle)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
            fontSize: 12,
            lineHeight: 1.5,
            color: 'var(--text-secondary)',
            zIndex: 20,
            pointerEvents: 'none',
            whiteSpace: 'normal',
          }}
        >
          When someone uses this template, they're prompted to fill in each variable before the conversation starts. Set the type and whether the field is required or optional.
        </div>
      )}
    </div>
  );
};

// ── Variable option state ─────────────────────────────────────────────────────

interface VarOption {
  /** Name portion — the part before `:` in the raw variable string. */
  name: string;
  type: 'text' | 'file';
  optional: boolean;
}

/**
 * Build the canonical variable syntax string for a given option.
 */
const buildVarSyntax = (name: string, type: 'text' | 'file', optional: boolean): string => {
  if (type === 'text' && !optional) return `{{${name}}}`;
  if (type === 'text' && optional) return `{{${name}:text(optional:true)}}`;
  if (type === 'file' && !optional) return `{{${name}:file}}`;
  return `{{${name}:file(optional:true)}}`;
};

/**
 * Replace every occurrence of a variable (by name) in content with new syntax.
 * Uses the same regex strategy as PromptModal.tsx#handleUpdateVariableOptionValues.
 */
const replaceVarInContent = (content: string, varName: string, newSyntax: string): string => {
  const escaped = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const search = new RegExp(`\\{\\{\\s*${escaped}\\s*(\\s*:\\s*(.*?)\\s*(\\(.*?\\))?)?\\s*\\}\\}`, 'g');
  return content.replace(search, newSyntax);
};

/**
 * Sync variable option state with the current content:
 *   - Remove vars no longer in content
 *   - Keep type/optional for existing vars
 *   - Add new vars with type/optional parsed from their syntax
 */
const syncVarOptions = (content: string, current: VarOption[]): VarOption[] => {
  const currentMap = new Map(current.map((v) => [v.name, v]));
  const rawVars = parsePromptVariables(content);
  const seenNames = new Set<string>();
  const result: VarOption[] = [];

  for (const rawVar of rawVars) {
    const name = getName(rawVar);
    if (seenNames.has(name)) continue;
    seenNames.add(name);

    const existing = currentMap.get(name);
    if (existing) {
      result.push(existing);
    } else {
      const parsedType = getType(rawVar);
      const type: 'text' | 'file' = parsedType === 'file' ? 'file' : 'text';
      const opts = parsePromptVariableValues(rawVar);
      result.push({ name, type, optional: !!opts.optional });
    }
  }

  return result;
};

// ── Shared field styles ───────────────────────────────────────────────────────

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

// ── Props ─────────────────────────────────────────────────────────────────────

export interface NewUIPromptCreationModalProps {
  prompt: Prompt;
  onSave: () => void;
  onCancel: () => void;
  onUpdatePrompt: (prompt: Prompt) => void;
  /** When provided, the modal shows "Use Template" as the primary action instead of "Save" */
  onUse?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const NewUIPromptCreationModal: React.FC<NewUIPromptCreationModalProps> = ({
  prompt,
  onSave,
  onCancel,
  onUpdatePrompt,
  onUse,
}) => {
  const [name, setName] = useState(prompt.name || '');
  const [nameError, setNameError] = useState('');
  const [description, setDescription] = useState(prompt.description || '');
  const [content, setContent] = useState(prompt.content || '');

  // Variable options — synced from content on every change
  const [varOptions, setVarOptions] = useState<VarOption[]>(() =>
    syncVarOptions(prompt.content || '', []),
  );

  // Ref to the content textarea for cursor-position tracking
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const cursorPosRef = useRef<number>(0);

  // Sync variable options whenever content changes
  const handleContentChange = useCallback(
    (newContent: string) => {
      setContent(newContent);
      setVarOptions((prev) => syncVarOptions(newContent, prev));
    },
    [],
  );

  // Track cursor position so "Insert Variable" lands at the right spot
  const trackCursor = () => {
    if (contentRef.current) {
      cursorPosRef.current = contentRef.current.selectionStart ?? content.length;
    }
  };

  // ── "Insert Variable" button ───────────────────────────────────────────
  const handleInsertVariable = () => {
    const ta = contentRef.current;
    const pos = ta ? (ta.selectionStart ?? content.length) : content.length;
    const insert = '{{placeholder}}';
    const newContent = content.slice(0, pos) + insert + content.slice(pos);
    handleContentChange(newContent);

    // Restore focus and position cursor after the inserted text
    requestAnimationFrame(() => {
      if (ta) {
        ta.focus();
        const newPos = pos + insert.length;
        ta.setSelectionRange(newPos, newPos);
        cursorPosRef.current = newPos;
      }
    });
  };

  // ── Variable option change handlers ───────────────────────────────────
  const handleVarTypeChange = (varName: string, newType: 'text' | 'file') => {
    setVarOptions((prev) => {
      const updated = prev.map((v) =>
        v.name === varName ? { ...v, type: newType } : v,
      );
      // Update content with new syntax
      const opt = updated.find((v) => v.name === varName)!;
      setContent((c) => replaceVarInContent(c, varName, buildVarSyntax(varName, opt.type, opt.optional)));
      return updated;
    });
  };

  const handleVarOptionalChange = (varName: string, optional: boolean) => {
    setVarOptions((prev) => {
      const updated = prev.map((v) =>
        v.name === varName ? { ...v, optional } : v,
      );
      const opt = updated.find((v) => v.name === varName)!;
      setContent((c) => replaceVarInContent(c, varName, buildVarSyntax(varName, opt.type, opt.optional)));
      return updated;
    });
  };

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

  // ── Use handler ───────────────────────────────────────────────────────
  const handleUse = () => {
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
    onUse?.();
    onSave();
  };

  // ── Title / labels ────────────────────────────────────────────────────
  const isNewPrompt = !prompt.description && !prompt.content;
  const shellTitle = onUse ? 'Use Template' : (isNewPrompt ? 'New Template' : 'Edit Template');
  const shellSaveLabel = onUse ? 'Use Template' : (isNewPrompt ? 'Create' : 'Save');
  const shellOnSave = onUse ? handleUse : handleSave;

  return (
    <CreationModalShell
      title={shellTitle}
      onClose={onCancel}
      onSave={shellOnSave}
      saveLabel={shellSaveLabel}
    >
      {/* ── Name ─────────────────────────────────────────────────────── */}
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
          onFocus={(e) => {
            e.target.style.borderColor = nameError ? '#e05252' : 'var(--accent)';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = nameError ? '#e05252' : 'var(--border-subtle)';
          }}
        />
        {nameError && (
          <p style={{ fontSize: 12, color: '#e05252', margin: '4px 0 0' }}>{nameError}</p>
        )}
      </div>

      {/* ── Description ──────────────────────────────────────────────── */}
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
          onFocus={(e) => {
            e.target.style.borderColor = 'var(--accent)';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = 'var(--border-subtle)';
          }}
        />
      </div>

      {/* ── Prompt body / content ─────────────────────────────────────── */}
      <div style={fieldGroupStyle}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 6,
          }}
        >
          <label htmlFor="pt-creation-content" style={{ ...labelStyle, marginBottom: 0 }}>
            Prompt
          </label>

          {/* ── "Insert Variable" button ─────────────────────────────── */}
          <button
            type="button"
            onClick={handleInsertVariable}
            title="Insert a variable placeholder at the cursor position"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              height: 28,
              padding: '0 10px',
              borderRadius: 6,
              border: '1px solid var(--border-subtle)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'background 120ms ease, border-color 120ms ease, color 120ms ease',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-hover)';
              e.currentTarget.style.borderColor = 'var(--accent)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.borderColor = 'var(--border-subtle)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            <IconVariable size={13} stroke={2} />
            Insert Variable
          </button>
        </div>

        <textarea
          id="pt-creation-content"
          ref={contentRef}
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          onSelect={trackCursor}
          onClick={trackCursor}
          onKeyUp={trackCursor}
          placeholder={`Example:\n\nSummarise the following article for me:\n\n{{Article}}\n\nFocus on the key points and keep it under {{Word Limit}} words.`}
          rows={10}
          style={{ ...inputStyle, resize: 'vertical', minHeight: 200 }}
          onFocus={(e) => {
            e.target.style.borderColor = 'var(--accent)';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = 'var(--border-subtle)';
            trackCursor();
          }}
        />
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
          Use {'{{variable}}'} syntax to add dynamic variables
        </p>
      </div>

      {/* ── Variable Options ─────────────────────────────────────────── */}
      {varOptions.length > 0 && (
        <div
          style={{
            marginBottom: 20,
            padding: '16px 16px 4px',
            borderRadius: 10,
            border: '1px solid var(--border-subtle)',
            background: 'var(--bg-app)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <p
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-secondary)',
                margin: 0,
              }}
            >
              Variables
            </p>
            {/* Info tooltip */}
            <VarInfoTooltip />
          </div>

          {varOptions.map((opt) => (
            <div
              key={opt.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                marginBottom: 12,
                padding: '8px 10px',
                borderRadius: 8,
                background: 'var(--bg-raised)',
                flexWrap: 'wrap',
              }}
            >
              {/* Variable name */}
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                  minWidth: 80,
                  flex: '1 1 80px',
                }}
              >
                {opt.name}
              </span>

              {/* Type selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Type</span>
                <div
                  style={{
                    display: 'flex',
                    borderRadius: 6,
                    border: '1px solid var(--border-subtle)',
                    overflow: 'hidden',
                  }}
                >
                  {(['text', 'file'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => handleVarTypeChange(opt.name, t)}
                      style={{
                        height: 26,
                        padding: '0 10px',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 12,
                        fontFamily: 'inherit',
                        fontWeight: opt.type === t ? 600 : 400,
                        background: opt.type === t ? 'var(--accent)' : 'transparent',
                        color: opt.type === t ? 'var(--accent-fg)' : 'var(--text-secondary)',
                        transition: 'background 120ms ease, color 120ms ease',
                      }}
                      onMouseEnter={(e) => {
                        if (opt.type !== t) {
                          e.currentTarget.style.background = 'var(--bg-hover)';
                          e.currentTarget.style.color = 'var(--text-primary)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (opt.type !== t) {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = 'var(--text-secondary)';
                        }
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Optional toggle */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  flexShrink: 0,
                  cursor: 'pointer',
                }}
                onClick={() => handleVarOptionalChange(opt.name, !opt.optional)}
              >
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Optional</span>
                <ToggleSwitch
                  checked={opt.optional}
                  onChange={(v) => handleVarOptionalChange(opt.name, v)}
                  aria-label={`Make ${opt.name} optional`}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </CreationModalShell>
  );
};

export default NewUIPromptCreationModal;
