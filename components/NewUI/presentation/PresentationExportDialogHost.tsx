/**
 * PresentationExportDialogHost — owns "Export as PowerPoint" jobs at the new-UI root.
 *
 * Launchers (message action row, conversation title menu) fire the
 * `amplifyExportPresentation` window event; this host is mounted once by
 * home.tsx's new-UI layout block (NEW_UI_GUIDE §27), so the dialog outlives
 * whatever opened it.
 *
 * The host — not the dialog — owns polling. Closing the dialog mid-job keeps
 * polling in the background and shows a toast with a Download action when the
 * deck is ready. One job runs at a time; reopening while it runs shows its progress.
 *
 * Portal: a dedicated container element created/removed in an effect, with
 * `data-new-ui-shell="true"` for scrollbar theming (see PromptTemplateDialogHost).
 */

import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import HomeContext from '@/pages/api/home/home.context';
import { Conversation } from '@/types/chat';
import { downloadFileFromPresignedUrl } from '@/utils/app/files';
import {
  PresentationJob,
  getPresentationStatus,
  startPresentation,
} from '@/components/NewUI/shared/presentationApi';
import {
  MAX_CONSECUTIVE_POLL_ERRORS,
  POLL_INTERVAL_MS,
  POLL_TIMEOUT_MS,
  buildPresentationSource,
  isTerminal,
  pickDefaultTemplate,
  suggestTitle,
} from '@/components/NewUI/shared/presentationJobModel';
import {
  PresentationExportDialog,
  PresentationFormState,
  PresentationPhase,
} from './PresentationExportDialog';

export const EXPORT_PRESENTATION_EVENT = 'amplifyExportPresentation';

export interface ExportPresentationDetail {
  conversationId: string;
  /** Index into conversation.messages; omit to export the whole conversation. */
  messageIndex?: number;
}

export const openPresentationExport = (detail: ExportPresentationDetail) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(EXPORT_PRESENTATION_EVENT, { detail }));
};

interface Source {
  conversationId: string;
  content: string;
  scopeLabel: string;
}

export const PresentationExportDialogHost: React.FC = () => {
  const {
    state: { conversations, selectedConversation, powerPointTemplateOptions, defaultAccount },
  } = useContext(HomeContext);

  const conversationsRef = useRef<{ list: Conversation[]; selected?: Conversation }>({ list: [] });
  conversationsRef.current = { list: conversations, selected: selectedConversation };

  const [container, setContainer] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<PresentationPhase>('form');
  const [source, setSource] = useState<Source | null>(null);
  const [form, setForm] = useState<PresentationFormState>({ templateName: '', title: '', instructions: '' });
  const [job, setJob] = useState<PresentationJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const openRef = useRef(open);
  openRef.current = open;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Re-armed in the effect body so StrictMode's mount/unmount/mount cycle leaves it true (NEW_UI_GUIDE §16).
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    const el = document.createElement('div');
    el.setAttribute('data-presentation-export-portal', 'true');
    document.body.appendChild(el);
    setContainer(el);
    return () => {
      mountedRef.current = false;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      el.remove();
      setContainer(null);
    };
  }, []);

  const templates = useMemo<string[]>(() => powerPointTemplateOptions ?? [], [powerPointTemplateOptions]);

  const notifyInBackground = useCallback((finished: PresentationJob) => {
    if (openRef.current) return;
    if (finished.status === 'completed' && finished.result) {
      const { downloadUrl, fileName } = finished.result;
      toast.success(
        (t) => (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            Presentation ready
            <button
              style={{ textDecoration: 'underline', fontWeight: 500 }}
              onClick={() => {
                downloadFileFromPresignedUrl(downloadUrl, fileName);
                toast.dismiss(t.id);
              }}
            >
              Download
            </button>
          </span>
        ),
        { duration: 30000 },
      );
    } else if (finished.status === 'failed') {
      toast.error('The presentation could not be created.');
    }
  }, []);

  const poll = useCallback(
    (jobId: string, startedAt: number, errors: number) => {
      pollTimerRef.current = setTimeout(async () => {
        if (!mountedRef.current) return;
        if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
          setError('The presentation is taking longer than expected. Please try again.');
          setPhase('failed');
          return;
        }
        const response = await getPresentationStatus(jobId);
        if (!mountedRef.current) return;
        if (!response.success || !response.data) {
          if (errors + 1 >= MAX_CONSECUTIVE_POLL_ERRORS) {
            setError(response.message || 'Lost track of the presentation job.');
            setPhase('failed');
            return;
          }
          poll(jobId, startedAt, errors + 1);
          return;
        }
        const next = response.data;
        setJob(next);
        if (!isTerminal(next)) {
          poll(jobId, startedAt, 0);
          return;
        }
        setPhase(next.status === 'completed' ? 'done' : 'failed');
        notifyInBackground(next);
      }, POLL_INTERVAL_MS);
    },
    [notifyInBackground],
  );

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<ExportPresentationDetail>).detail;
      if (!detail?.conversationId) return;
      setOpen(true);
      // A running job owns the dialog until it finishes.
      if (phaseRef.current === 'running') return;

      const { list, selected } = conversationsRef.current;
      const conversation =
        selected?.id === detail.conversationId ? selected : list.find((c) => c.id === detail.conversationId);
      if (!conversation) return;
      const single = detail.messageIndex !== undefined;
      setSource({
        conversationId: conversation.id,
        content: buildPresentationSource(conversation, detail.messageIndex),
        scopeLabel: single ? 'this response' : 'this conversation',
      });
      setForm((prev) => ({
        templateName: templates.includes(prev.templateName) ? prev.templateName : pickDefaultTemplate(templates),
        title: suggestTitle(conversation),
        instructions: '',
      }));
      setJob(null);
      setError(null);
      setPhase('form');
    };
    window.addEventListener(EXPORT_PRESENTATION_EVENT, handler);
    return () => window.removeEventListener(EXPORT_PRESENTATION_EVENT, handler);
  }, [templates]);

  const handleStart = useCallback(async () => {
    if (!source || !form.templateName || isStarting) return;
    setIsStarting(true);
    setError(null);
    const response = await startPresentation({
      templateName: form.templateName,
      content: source.content,
      title: form.title.trim() || undefined,
      instructions: form.instructions.trim() || undefined,
      conversationId: source.conversationId,
      accountId: defaultAccount?.id,
    });
    if (!mountedRef.current) return;
    setIsStarting(false);
    if (!response.success || !response.data?.jobId) {
      setError(response.message || 'The presentation agent is not available right now.');
      setPhase('failed');
      return;
    }
    const jobId = response.data.jobId;
    setJob({ jobId, status: 'queued', stage: 'queued', progress: 0, templateName: form.templateName });
    setPhase('running');
    poll(jobId, Date.now(), 0);
  }, [source, form, isStarting, defaultAccount, poll]);

  const handleDownload = useCallback(() => {
    if (job?.result) downloadFileFromPresignedUrl(job.result.downloadUrl, job.result.fileName);
  }, [job]);

  const handleRetry = useCallback(() => {
    setError(null);
    setJob(null);
    setPhase('form');
  }, []);

  const handleClose = useCallback(() => setOpen(false), []);

  if (!open || !container) return null;

  return createPortal(
    <div data-new-ui-shell="true" className="text-neutral-900 dark:text-white" style={{ position: 'fixed', inset: 0, zIndex: 10001 }}>
      <PresentationExportDialog
        phase={phase}
        scopeLabel={source?.scopeLabel ?? 'this conversation'}
        templates={templates}
        form={form}
        onFormChange={setForm}
        job={job}
        error={error}
        isStarting={isStarting}
        onStart={handleStart}
        onDownload={handleDownload}
        onRetry={handleRetry}
        onClose={handleClose}
      />
    </div>,
    container,
  );
};

export default PresentationExportDialogHost;
