/**
 * PresentationExportDialog — "Export as PowerPoint" for the new UI.
 *
 * Presentational only: PresentationExportDialogHost owns the job (start, poll,
 * background completion) so closing this dialog never cancels a running deck.
 *
 * Phases:
 *   form     → template picker, title, optional instructions  [Create presentation]
 *   running  → step list + progress bar (no footer; Cancel just closes)
 *   done     → slide thumbnails                               [Download .pptx]
 *   failed   → error message                                  [Try again]
 */

import React from 'react';
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconCircleDashed,
  IconLoader2,
  IconPresentation,
} from '@tabler/icons-react';
import { CreationModalShell } from '@/components/NewUI/shared/CreationModalShell';
import type { PresentationJob } from '@/components/NewUI/shared/presentationApi';
import {
  PRESENTATION_STEPS,
  clampProgress,
  stepIndexForStage,
} from '@/components/NewUI/shared/presentationJobModel';

export type PresentationPhase = 'form' | 'running' | 'done' | 'failed';

export interface PresentationFormState {
  templateName: string;
  title: string;
  instructions: string;
}

interface Props {
  phase: PresentationPhase;
  scopeLabel: string;
  templates: string[];
  form: PresentationFormState;
  onFormChange: (next: PresentationFormState) => void;
  job: PresentationJob | null;
  error: string | null;
  isStarting: boolean;
  onStart: () => void;
  onDownload: () => void;
  onRetry: () => void;
  onClose: () => void;
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--text-secondary)',
  marginBottom: 6,
};

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
};

const helpStyle: React.CSSProperties = { fontSize: 12.5, color: 'var(--text-muted)', marginTop: 6 };

export const PresentationExportDialog: React.FC<Props> = ({
  phase,
  scopeLabel,
  templates,
  form,
  onFormChange,
  job,
  error,
  isStarting,
  onStart,
  onDownload,
  onRetry,
  onClose,
}) => {
  const shellProps =
    phase === 'form'
      ? { onSave: onStart, saveLabel: 'Create presentation', isSaving: isStarting, saveDisabled: !form.templateName }
      : phase === 'done'
        ? { onSave: onDownload, saveLabel: 'Download .pptx' }
        : phase === 'failed'
          ? { onSave: onRetry, saveLabel: 'Try again' }
          : {};

  return (
    <CreationModalShell title="Export as PowerPoint" onClose={onClose} {...shellProps}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '8px 4px 24px' }}>
        {phase === 'form' && (
          <FormPhase scopeLabel={scopeLabel} templates={templates} form={form} onFormChange={onFormChange} />
        )}
        {phase === 'running' && <RunningPhase job={job} />}
        {phase === 'done' && job?.result && <DonePhase job={job} />}
        {phase === 'failed' && <FailedPhase error={error ?? job?.error ?? job?.message ?? null} />}
      </div>
    </CreationModalShell>
  );
};

const FormPhase: React.FC<{
  scopeLabel: string;
  templates: string[];
  form: PresentationFormState;
  onFormChange: (next: PresentationFormState) => void;
}> = ({ scopeLabel, templates, form, onFormChange }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
    <div
      style={{
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
        padding: 14,
        borderRadius: 10,
        border: '1px solid var(--border-subtle)',
        background: 'var(--bg-app)',
      }}
    >
      <IconPresentation size={20} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 1 }} />
      <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        An AI agent plans a storyline from {scopeLabel}, builds the slides in your template with charts,
        tables and diagrams, then reviews every slide and fixes layout problems. This usually takes a few
        minutes. You can close this window and keep working.
      </div>
    </div>

    <div>
      <label htmlFor="presentation-template" style={labelStyle}>
        Template
      </label>
      <select
        id="presentation-template"
        style={inputStyle}
        value={form.templateName}
        onChange={(e) => onFormChange({ ...form, templateName: e.target.value })}
      >
        {templates.map((t) => (
          <option key={t} value={t}>
            {t.replace(/\.pptx$/i, '')}
          </option>
        ))}
      </select>
    </div>

    <div>
      <label htmlFor="presentation-title" style={labelStyle}>
        Title <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
      </label>
      <input
        id="presentation-title"
        style={inputStyle}
        value={form.title}
        maxLength={300}
        placeholder="Let the agent choose a title"
        onChange={(e) => onFormChange({ ...form, title: e.target.value })}
      />
    </div>

    <div>
      <label htmlFor="presentation-instructions" style={labelStyle}>
        Instructions <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
      </label>
      <textarea
        id="presentation-instructions"
        style={{ ...inputStyle, minHeight: 96, resize: 'vertical' }}
        value={form.instructions}
        maxLength={4000}
        placeholder="e.g. 10 slides for the dean's council, focus on budget impact, end with a clear ask"
        onChange={(e) => onFormChange({ ...form, instructions: e.target.value })}
      />
      <div style={helpStyle}>Audience, length, emphasis, or anything the deck must include.</div>
    </div>
  </div>
);

const RunningPhase: React.FC<{ job: PresentationJob | null }> = ({ job }) => {
  const current = stepIndexForStage(job?.stage);
  const progress = clampProgress(job?.progress);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingTop: 16 }}>
      <div>
        <div
          style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}
        >
          <span role="status" aria-live="polite">
            {job?.message || 'Starting presentation agent'}
          </span>
          <span>{progress}%</span>
        </div>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          aria-label="Presentation progress"
          style={{ height: 6, borderRadius: 3, background: 'var(--bg-active)', overflow: 'hidden' }}
        >
          <div
            className="motion-safe:transition-[width] motion-safe:duration-500"
            style={{ width: `${Math.max(progress, 3)}%`, height: '100%', background: 'var(--accent)' }}
          />
        </div>
      </div>

      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {PRESENTATION_STEPS.map((step, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={step.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
              {done ? (
                <IconCircleCheck size={18} style={{ color: 'var(--accent)' }} />
              ) : active ? (
                <IconLoader2 size={18} className="motion-safe:animate-spin" style={{ color: 'var(--accent)' }} />
              ) : (
                <IconCircleDashed size={18} style={{ color: 'var(--text-muted)' }} />
              )}
              <span style={{ color: done || active ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: active ? 500 : 400 }}>
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

const DonePhase: React.FC<{ job: PresentationJob }> = ({ job }) => {
  const result = job.result!;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <IconCircleCheck size={20} style={{ color: 'var(--accent)' }} />
        <div>
          <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>{result.fileName}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {result.slideCount} slides · {job.templateName?.replace(/\.pptx$/i, '')}
          </div>
        </div>
      </div>
      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}
        aria-label="Slide previews"
      >
        {result.slides.map((src, i) => (
          <figure key={src} style={{ margin: 0 }}>
            {/* Short-lived presigned S3 URLs: next/image optimization does not apply. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={`Slide ${i + 1} preview`}
              loading="lazy"
              style={{
                width: '100%',
                aspectRatio: '16 / 9',
                objectFit: 'contain',
                borderRadius: 6,
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-app)',
              }}
            />
            <figcaption style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Slide {i + 1}</figcaption>
          </figure>
        ))}
      </div>
      <div style={helpStyle}>Previews are rendered with LibreOffice and may differ slightly from PowerPoint.</div>
    </div>
  );
};

const FailedPhase: React.FC<{ error: string | null }> = ({ error }) => (
  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', paddingTop: 16 }} role="alert">
    <IconAlertTriangle size={20} style={{ color: '#f87171', flexShrink: 0 }} />
    <div>
      <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>
        The presentation could not be created
      </div>
      <div style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>{error || 'Please try again in a moment.'}</div>
    </div>
  </div>
);

export default PresentationExportDialog;
