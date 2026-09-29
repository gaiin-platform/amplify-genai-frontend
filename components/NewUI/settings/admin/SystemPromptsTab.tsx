import React, { FC } from 'react';
import { AdminConfigTypes, SystemPromptsConfig, SystemPromptRecord } from '@/types/admin';
import { BUILTIN_SYSTEM_PROMPTS } from './systemPromptDefaults';
import { MAX_SYSTEM_PROMPT_BYTES, utf8ByteLength } from './systemPromptBytes';

const PROMPT_LABELS: Record<string, { label: string; description: string; isPrimary?: boolean }> = {
  'ordinaryChat.base': {
    label: 'Ordinary Chat — Base System Prompt',
    description:
      'The primary system instruction injected into every ordinary chat request across all providers. ' +
      'Empty means use the built-in default. Visible to all providers; keep it provider-neutral.',
    isPrimary: true,
  },
  'webSearch.use': {
    label: 'Web Search — Use Instructions',
    description:
      'Added when the web-search tool is active. Guides how the model should cite and present live results.',
  },
  'artifacts.generate': {
    label: 'Artifacts — Generation Instructions',
    description:
      'Added when artifact generation is triggered. Instructs the model on artifact format, markers, and structure.',
  },
  'codeInterpreter.use': {
    label: 'Code Interpreter — Use Instructions',
    description:
      'Added when the code interpreter is selected. Explains the sandboxed execution environment to the model.',
  },
  'amplifyHelper.base': {
    label: 'Amplify Helper — Base Prompt (reserved)',
    description:
      'Reserved prompt slot for the future Amplify assistant. Editing this prompt now has no effect on chat behavior ' +
      'until the Amplify helper feature is enabled.',
  },
};

interface SystemPromptsTabProps {
  config: SystemPromptsConfig;
  setConfig: (c: SystemPromptsConfig) => void;
  updateUnsavedConfigs: (type: AdminConfigTypes) => void;
}

export const SystemPromptsTab: FC<SystemPromptsTabProps> = ({
  config,
  setConfig,
  updateUnsavedConfigs,
}) => {
  const handleChange = (key: string, text: string) => {
    setConfig({
      ...config,
      prompts: {
        ...config.prompts,
        [key]: { ...(config.prompts[key] ?? { version: 1 }), text } as SystemPromptRecord,
      },
    });
    updateUnsavedConfigs(AdminConfigTypes.SYSTEM_PROMPTS);
  };

  const promptKeys = Object.keys(PROMPT_LABELS);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Primary prompt shown first, visually distinct */}
      {promptKeys.map((key) => {
        const meta = PROMPT_LABELS[key];
        const record = config.prompts[key] ?? { version: 1, text: '' };
        const builtInText = BUILTIN_SYSTEM_PROMPTS[key] ?? '';
        const displayedText = record.text || builtInText;
        const bytes = utf8ByteLength(displayedText);
        const isOverLimit = bytes > MAX_SYSTEM_PROMPT_BYTES;
        const fieldId = `system-prompt-${key.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
        const countId = `${fieldId}-count`;
        const errorId = `${fieldId}-error`;

        return (
          <div
            key={key}
            style={{
              background: 'var(--bg-raised)',
              border: meta.isPrimary
                ? '2px solid var(--accent)'
                : '1px solid var(--border-subtle)',
              borderRadius: '12px',
              padding: '20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <h3
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  margin: 0,
                  flex: 1,
                }}
              >
                {meta.label}
              </h3>
              {meta.isPrimary && (
                <span
                  style={{
                    fontSize: '10px',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    background: 'rgba(59,130,246,0.12)',
                    color: 'var(--accent)',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Primary
                </span>
              )}
            </div>
            <p
              style={{
                fontSize: '12px',
                color: 'var(--text-secondary)',
                marginBottom: '12px',
                lineHeight: 1.5,
              }}
            >
              {meta.description}
            </p>
            <textarea
              id={fieldId}
              aria-label={meta.label}
              aria-describedby={isOverLimit ? `${countId} ${errorId}` : countId}
              aria-invalid={isOverLimit}
              rows={6}
              placeholder={builtInText ? `Built-in default for "${meta.label}"` : 'No built-in prompt is currently configured.'}
              value={displayedText}
              onChange={(e) => handleChange(key, e.target.value === builtInText ? '' : e.target.value)}
              style={{
                width: '100%',
                background: 'var(--bg-app)',
                border: isOverLimit
                  ? '1px solid var(--text-error)'
                  : '1px solid var(--border-subtle)',
                borderRadius: '6px',
                padding: '10px',
                fontSize: '13px',
                fontFamily: 'monospace',
                color: 'var(--text-primary)',
                outline: 'none',
                resize: 'vertical',
                boxSizing: 'border-box',
                lineHeight: 1.5,
              }}
            />
            <div
              id={countId}
              role="status"
              aria-live="polite"
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                marginTop: '4px',
                fontSize: '11px',
                color: isOverLimit ? 'var(--text-error)' : 'var(--text-muted)',
              }}
            >
              {bytes.toLocaleString()} / {MAX_SYSTEM_PROMPT_BYTES.toLocaleString()} UTF-8 bytes
              {!record.text && builtInText ? ' · built-in default shown (not saved)' : ''}
            </div>
            {isOverLimit && (
              <p id={errorId} role="alert" style={{ fontSize: '12px', color: 'var(--text-error)', marginTop: '4px' }}>
                This prompt is {bytes.toLocaleString()} UTF-8 bytes. The maximum is {MAX_SYSTEM_PROMPT_BYTES.toLocaleString()} bytes; shorten it before saving.
              </p>
            )}
          </div>
        );
      })}

      <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
        Empty prompt text means &ldquo;use the built-in default.&rdquo; Changes take effect on the next
        chat request. Prompt text is stored as admin configuration data — treat it as untrusted input
        and avoid embedding credentials or secrets.
      </p>
    </div>
  );
};
