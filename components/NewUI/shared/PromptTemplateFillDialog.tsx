/**
 * PromptTemplateFillDialog — new-UI "populate and use this template" dialog.
 *
 * Replaces the old VariableModal as the fill-in popup for prompt templates.
 * Uses design tokens from NEW_UI_GUIDE §3. Portalled to document.body above
 * everything (zIndex 10001) by the caller.
 *
 * Supports: text (textarea), file (AttachFile), boolean (toggle), options (select).
 * Conversation/template variable types fall back to a text input.
 *
 * An optional `onEdit` prop renders an edit icon in the header — when clicked it
 * fires the callback so PromptTemplateDialogHost can switch to edit mode.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  IconX,
  IconPencil,
  IconFile,
  IconUpload,
  IconLibrary,
} from '@tabler/icons-react';
import { Prompt } from '@/types/prompt';
import { AttachedDocument } from '@/types/attacheddocument';
import { AttachFile } from '@/components/Chat/AttachFile';
import { COMMON_DISALLOWED_FILE_EXTENSIONS } from '@/utils/app/const';
import { parsePromptVariableValues, getType } from '@/utils/app/prompts';
import { DataSourceLibraryPicker, PickedLibraryFile } from '@/components/NewUI/shared/DataSourceLibraryPicker';
import { libraryFileToAttachedDocument } from '@/components/NewUI/shared/libraryAttachment';
import { ModelPicker, EffortLevel } from '@/components/NewUI/shared/ModelPicker';

// ── Helpers ───────────────────────────────────────────────────────────────────

export const parseVariableName = (variable: string): string => {
  if (variable.indexOf(':') > -1) return variable.split(':')[0];
  return variable;
};

const isRequired = (variable: string): boolean =>
  !parsePromptVariableValues(variable).optional;

const isFileType = (variable: string): boolean => {
  const t = getType(variable);
  return t === 'file' || t === 'files';
};

const isBooleanType = (variable: string): boolean => getType(variable) === 'boolean';

const isOptionsType = (variable: string): boolean => getType(variable) === 'options';

const getSelectOptions = (variable: string): string[] => {
  const opts = parsePromptVariableValues(variable);
  return opts.values || [];
};

// ── Shared inline styles ──────────────────────────────────────────────────────

const inputBase: React.CSSProperties = {
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

// ── Props ─────────────────────────────────────────────────────────────────────

export interface PromptTemplateFillDialogProps {
  prompt: Prompt;
  variables: string[];
  onSubmit: (updatedVariables: string[], documents: AttachedDocument[] | null) => void;
  onClose: () => void;
  /** When provided, renders an edit icon in the header. */
  onEdit?: () => void;
  /** Currently selected model ID — when provided, renders a ModelPicker in the footer. */
  selectedModelId?: string;
  /** Current reasoning effort level. */
  selectedEffort?: EffortLevel;
  /** Called when the user picks a different model. */
  onModelChange?: (modelId: string) => void;
  /** Called when the user changes the reasoning effort. */
  onEffortChange?: (effort: EffortLevel) => void;
  /** When true the template enforces a specific model, so the picker is disabled. */
  enforcedByAssistant?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const PromptTemplateFillDialog: React.FC<PromptTemplateFillDialogProps> = ({
  prompt,
  variables,
  onSubmit,
  onClose,
  onEdit,
  selectedModelId,
  selectedEffort = 'medium',
  onModelChange,
  onEffortChange,
  enforcedByAssistant = false,
}) => {
  // Text + boolean + options values (one per variable, indexed)
  const [values, setValues] = useState<string[]>(() =>
    variables.map((v) => {
      const opts = parsePromptVariableValues(v);
      if (isBooleanType(v)) return 'false';
      if (isOptionsType(v)) {
        const options = getSelectOptions(v);
        return options.length > 0 ? options[0] : '';
      }
      return opts.default || '';
    }),
  );

  // File values per index
  const [fileValues, setFileValues] = useState<Record<number, AttachedDocument>>({});
  const [fileKeys, setFileKeys] = useState<Record<string, string>>({});
  const [fileProgress, setFileProgress] = useState<Record<string, number>>({});
  const [submitError, setSubmitError] = useState('');
  /** Index of the variable whose library picker is currently open, or null. */
  const [libraryPickerIndex, setLibraryPickerIndex] = useState<number | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);

  // Focus trap + Escape (use stopImmediatePropagation per §14)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKey, true);
    return () => document.removeEventListener('keydown', handleKey, true);
  }, [onClose]);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  const updateValue = (index: number, val: string) => {
    setValues((prev) => {
      const next = [...prev];
      next[index] = val;
      return next;
    });
    setSubmitError('');
  };

  const handleSubmit = () => {
    // Validate required fields
    for (let i = 0; i < variables.length; i++) {
      const v = variables[i];
      if (!isRequired(v)) continue;
      if (isFileType(v)) {
        if (!fileValues[i]) {
          setSubmitError(`"${parseVariableName(v)}" requires a file.`);
          return;
        }
        // Check upload complete
        const doc = fileValues[i];
        const prog = fileProgress[doc.id];
        if (prog !== undefined && prog < 100 && !fileKeys[doc.id]) {
          setSubmitError('Please wait for files to finish uploading.');
          return;
        }
      } else if (!isBooleanType(v)) {
        if (!values[i]?.trim()) {
          setSubmitError(`"${parseVariableName(v)}" is required.`);
          return;
        }
      }
    }

    const finalValues = variables.map((v, i) => {
      if (isFileType(v)) return '';
      return values[i] || '';
    });

    const documents: AttachedDocument[] = [];
    variables.forEach((v, i) => {
      if (isFileType(v) && fileValues[i]) {
        const doc: AttachedDocument = {
          ...fileValues[i],
          name: parseVariableName(v),
        };
        if (fileKeys[doc.id]) doc.key = fileKeys[doc.id];
        documents.push(doc);
      }
    });

    onSubmit(finalValues, documents.length > 0 ? documents : null);
  };

  return (
    <div
      className="text-neutral-900 dark:text-white"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
        padding: 16,
        fontFamily: 'Inter, ui-sans-serif, sans-serif',
      }}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ptfd-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 560,
          maxHeight: '85dvh',
          background: 'var(--bg-raised)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 14,
          boxShadow: '0 24px 80px rgba(0,0,0,0.28), 0 4px 16px rgba(0,0,0,0.12)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          outline: 'none',
        }}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            padding: '20px 20px 16px 24px',
            flexShrink: 0,
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2
              id="ptfd-title"
              style={{
                fontSize: 18,
                fontWeight: 700,
                margin: 0,
                color: 'var(--text-primary)',
                lineHeight: 1.3,
                wordBreak: 'break-word',
              }}
            >
              {prompt.name}
            </h2>
            {prompt.description && (
              <p
                style={{
                  fontSize: 13,
                  color: 'var(--text-muted)',
                  margin: '4px 0 0',
                  lineHeight: 1.45,
                }}
              >
                {prompt.description}
              </p>
            )}
          </div>

          {/* Header action buttons */}
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            {onEdit && (
              <button
                aria-label="Edit template"
                title="Edit this template"
                onClick={onEdit}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-secondary)',
                  transition: 'background 120ms ease, color 120ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg-hover)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }}
              >
                <IconPencil size={16} stroke={2} />
              </button>
            )}
            <button
              aria-label="Close"
              onClick={onClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-secondary)',
                transition: 'background 120ms ease, color 120ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-hover)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              <IconX size={18} stroke={2} />
            </button>
          </div>
        </div>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: '20px 24px',
          }}
        >
          {variables.length === 0 ? (
            <p
              style={{
                color: 'var(--text-muted)',
                fontSize: 14,
                textAlign: 'center',
                padding: '24px 0',
              }}
            >
              No variables to fill in.
            </p>
          ) : (
            variables.map((variable, index) => {
              const name = parseVariableName(variable);
              const required = isRequired(variable);

              return (
                <div key={index} style={{ marginBottom: 20 }}>
                  {/* Label (not shown for boolean — label is next to toggle) */}
                  {!isBooleanType(variable) && (
                    <label
                      htmlFor={`ptfd-var-${index}`}
                      style={{
                        display: 'block',
                        fontSize: 13,
                        fontWeight: 500,
                        color: 'var(--text-secondary)',
                        marginBottom: 6,
                      }}
                    >
                      {name}
                      {required && (
                        <span style={{ color: '#e05252', marginLeft: 2 }}>*</span>
                      )}
                    </label>
                  )}

                  {/* Text input (default + conversation + template types) */}
                  {!isFileType(variable) && !isBooleanType(variable) && !isOptionsType(variable) && (
                    <textarea
                      id={`ptfd-var-${index}`}
                      value={values[index]}
                      onChange={(e) => updateValue(index, e.target.value)}
                      placeholder={`Enter ${name}…`}
                      rows={3}
                      style={{ ...inputBase, resize: 'vertical', minHeight: 72 }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = 'var(--accent)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-subtle)';
                      }}
                    />
                  )}

                  {/* Options (select dropdown) */}
                  {isOptionsType(variable) && (
                    <select
                      id={`ptfd-var-${index}`}
                      value={values[index]}
                      onChange={(e) => updateValue(index, e.target.value)}
                      style={inputBase}
                      onFocus={(e) => {
                        (e.currentTarget as HTMLSelectElement).style.borderColor =
                          'var(--accent)';
                      }}
                      onBlur={(e) => {
                        (e.currentTarget as HTMLSelectElement).style.borderColor =
                          'var(--border-subtle)';
                      }}
                    >
                      {getSelectOptions(variable).map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Boolean (pill toggle) */}
                  {isBooleanType(variable) && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        cursor: 'pointer',
                      }}
                      onClick={() => updateValue(index, values[index] === 'true' ? 'false' : 'true')}
                    >
                      <button
                        id={`ptfd-var-${index}`}
                        type="button"
                        role="switch"
                        aria-checked={values[index] === 'true'}
                        aria-label={name}
                        onClick={(e) => {
                          e.stopPropagation();
                          updateValue(index, values[index] === 'true' ? 'false' : 'true');
                        }}
                        style={{
                          width: 36,
                          height: 20,
                          borderRadius: 9999,
                          border: 'none',
                          cursor: 'pointer',
                          background:
                            values[index] === 'true' ? 'var(--accent)' : 'var(--bg-hover)',
                          position: 'relative',
                          flexShrink: 0,
                          transition: 'background 150ms ease',
                          padding: 0,
                        }}
                      >
                        <span
                          style={{
                            position: 'absolute',
                            top: 2,
                            left: values[index] === 'true' ? 18 : 2,
                            width: 16,
                            height: 16,
                            borderRadius: '50%',
                            background: '#ffffff',
                            transition: 'left 150ms ease',
                          }}
                        />
                      </button>
                      <span
                        style={{ fontSize: 13, color: 'var(--text-primary)' }}
                      >
                        {name}
                        {required && (
                          <span style={{ color: '#e05252', marginLeft: 2 }}>*</span>
                        )}
                      </span>
                    </div>
                  )}

                  {/* File upload */}
                  {isFileType(variable) && (
                    <div>
                      {!fileValues[index] ? (
                        <div>
                          {/* Hidden AttachFile — provides file-input + S3 upload logic.
                              We hide its own button and drive it from our styled button below. */}
                          <div style={{ display: 'none' }}>
                            <AttachFile
                              id={`__ptfd_file_${index}`}
                              disallowedFileExtensions={COMMON_DISALLOWED_FILE_EXTENSIONS}
                              onSetKey={(doc, key) =>
                                setFileKeys((prev) => ({ ...prev, [doc.id]: key }))
                              }
                              onUploadProgress={(doc, progress) =>
                                setFileProgress((prev) => ({ ...prev, [doc.id]: progress }))
                              }
                              onAttach={(doc) => {
                                setFileValues((prev) => ({ ...prev, [index]: doc }));
                                setLibraryPickerIndex(null);
                                setSubmitError('');
                              }}
                            />
                          </div>

                          {/* ── Two source buttons ── */}
                          <div style={{ display: 'flex', gap: 8, marginBottom: libraryPickerIndex === index ? 10 : 0 }}>
                            {/* Upload from computer — clicks the hidden AttachFile input */}
                            <button
                              type="button"
                              onClick={() =>
                                (document.getElementById(`__ptfd_file_${index}`) as HTMLInputElement | null)?.click()
                              }
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                height: 34,
                                padding: '0 12px',
                                borderRadius: 8,
                                border: '1px solid var(--border-subtle)',
                                background: 'transparent',
                                color: 'var(--text-secondary)',
                                fontSize: 13,
                                fontWeight: 500,
                                cursor: 'pointer',
                                fontFamily: 'inherit',
                                transition: 'background 120ms ease, color 120ms ease',
                                flexShrink: 0,
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'var(--bg-hover)';
                                e.currentTarget.style.color = 'var(--text-primary)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = 'var(--text-secondary)';
                              }}
                            >
                              <IconUpload size={14} stroke={2} />
                              Upload from computer
                            </button>

                            {/* From library */}
                            <button
                              type="button"
                              onClick={() =>
                                setLibraryPickerIndex((prev) => (prev === index ? null : index))
                              }
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                height: 34,
                                padding: '0 12px',
                                borderRadius: 8,
                                border: `1px solid ${libraryPickerIndex === index ? 'var(--accent)' : 'var(--border-subtle)'}`,
                                background: libraryPickerIndex === index ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
                                color: libraryPickerIndex === index ? 'var(--accent)' : 'var(--text-secondary)',
                                fontSize: 13,
                                fontWeight: 500,
                                cursor: 'pointer',
                                fontFamily: 'inherit',
                                transition: 'background 120ms ease, border-color 120ms ease, color 120ms ease',
                                flexShrink: 0,
                              }}
                              onMouseEnter={(e) => {
                                if (libraryPickerIndex !== index) {
                                  e.currentTarget.style.background = 'var(--bg-hover)';
                                  e.currentTarget.style.color = 'var(--text-primary)';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (libraryPickerIndex !== index) {
                                  e.currentTarget.style.background = 'transparent';
                                  e.currentTarget.style.color = 'var(--text-secondary)';
                                }
                              }}
                            >
                              <IconLibrary size={14} stroke={2} />
                              From library
                            </button>
                          </div>

                          {/* Inline library picker */}
                          {libraryPickerIndex === index && (
                            <div
                              style={{
                                marginTop: 8,
                                borderRadius: 10,
                                border: '1px solid var(--border-subtle)',
                                overflow: 'hidden',
                              }}
                            >
                              <DataSourceLibraryPicker
                                surface="inline"
                                listHeight={220}
                                onClose={() => setLibraryPickerIndex(null)}
                                onSelect={(files: PickedLibraryFile[]) => {
                                  const first = files[0];
                                  if (!first) return;
                                  const doc = libraryFileToAttachedDocument(first);
                                  if (!doc) return;
                                  setFileValues((prev) => ({ ...prev, [index]: doc }));
                                  setLibraryPickerIndex(null);
                                  setSubmitError('');
                                }}
                              />
                            </div>
                          )}
                        </div>
                      ) : (
                        /* File attached — show name + progress + remove button */
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '8px 12px',
                            borderRadius: 8,
                            border: '1px solid var(--border-subtle)',
                            background: 'var(--bg-app)',
                          }}
                        >
                          <IconFile
                            size={16}
                            style={{ color: 'var(--text-muted)', flexShrink: 0 }}
                          />
                          <span
                            style={{
                              flex: 1,
                              fontSize: 13,
                              color: 'var(--text-primary)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {fileValues[index].name}
                          </span>
                          {fileProgress[fileValues[index].id] !== undefined &&
                            fileProgress[fileValues[index].id] < 100 && (
                              <span
                                style={{ fontSize: 12, color: 'var(--accent)', flexShrink: 0 }}
                              >
                                {fileProgress[fileValues[index].id]}%
                              </span>
                            )}
                          <button
                            aria-label={`Remove ${name}`}
                            type="button"
                            onClick={() =>
                              setFileValues((prev) => {
                                const next = { ...prev };
                                delete next[index];
                                return next;
                              })
                            }
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: 4,
                              border: 'none',
                              background: 'transparent',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'var(--text-muted)',
                              flexShrink: 0,
                              transition: 'color 120ms ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = 'var(--text-primary)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = 'var(--text-muted)';
                            }}
                          >
                            <IconX size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Error message */}
          {submitError && (
            <p style={{ color: '#e05252', fontSize: 13, margin: '4px 0 8px' }}>
              {submitError}
            </p>
          )}

          {/* Required legend */}
          {variables.some(isRequired) && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
              * Required
            </p>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div
          style={{
            flexShrink: 0,
            padding: '12px 16px 20px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          {/* Model picker — left side of footer */}
          {onModelChange && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <ModelPicker
                selectedModelId={selectedModelId}
                selectedEffort={selectedEffort}
                onModelChange={onModelChange}
                onEffortChange={onEffortChange ?? (() => {})}
                isNewChat={true}
                enforcedByAssistant={enforcedByAssistant}
                menuZIndex={10002}
              />
            </div>
          )}

          {/* Action buttons — right side */}
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', flexShrink: 0 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                height: 36,
                padding: '0 16px',
                borderRadius: 8,
                border: '1px solid var(--border-subtle)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'background 120ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              style={{
                height: 36,
                padding: '0 20px',
                borderRadius: 8,
                border: 'none',
                background: 'var(--accent)',
                color: 'var(--accent-fg)',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'opacity 120ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.88';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
              }}
            >
              Use Template
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromptTemplateFillDialog;
