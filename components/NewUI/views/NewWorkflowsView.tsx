/**
 * NewWorkflowsView — New UI full-pane view for Assistant Workflow Templates.
 *
 * Follows the exact two-pane layout of NewScheduledTasksView.tsx:
 *   - Sticky top bar (back → chat + title + "New Workflow" button)
 *   - Left list pane (340px): search, skeleton, cards, empty states
 *   - Right detail pane (flex-1): read-only details OR empty state
 *
 * When "New Workflow" or "Edit Workflow" is clicked, the existing
 * AssistantWorkflowBuilder is opened (wrapped in a thin class div so our
 * CSS overrides can scope to it without touching the old component).
 *
 * PORT: AssistantWorkflowBuilder is reused UNCHANGED — it already has the
 * visual builder, step editor, AI generator, and CRUD logic.
 * TODO: give the builder's internal styling a dedicated new-UI visual pass
 * in a future phase. Currently we only ensure text is readable (see
 * conversation-view.css "Workflows view — inner builder overrides").
 *
 * Feature flag: featureFlags.createAssistantWorkflows
 *   true  → full CRUD (create / edit / delete)
 *   false → read-only / browse mode (no create/edit/delete buttons)
 *
 * Services (DO NOT CHANGE):
 *   services/assistantWorkflowService.ts — listAstWorkflowTemplates,
 *   getAstWorkflowTemplate, deleteAstWorkflowTemplate
 * Types (DO NOT CHANGE):
 *   types/assistantWorkflows.ts — AstWorkflow
 *
 * Design tokens: --bg-app, --bg-sidebar, --bg-raised, --bg-hover, --bg-active,
 *                --border-subtle, --text-primary, --text-secondary, --text-muted,
 *                --accent
 */

import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  IconPuzzle,
  IconPlus,
  IconSearch,
  IconX,
  IconEdit,
  IconTrash,
  IconLoader2,
  IconChevronDown,
  IconChevronRight,
  IconChevronLeft,
} from '@tabler/icons-react';

import HomeContext from '@/pages/api/home/home.context';
import { AstWorkflow } from '@/types/assistantWorkflows';
import {
  listAstWorkflowTemplates,
  deleteAstWorkflowTemplate,
} from '@/services/assistantWorkflowService';
import { AssistantWorkflowBuilder } from '@/components/AssistantWorkflows/AssistantWorkflowBuilder';

// ── Types ──────────────────────────────────────────────────────────────────────

/** Input property derived from AstWorkflow.inputSchema.properties */
interface InputProp {
  key: string;
  type: string;
  description?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Extract a flat array of input parameters from an AstWorkflow's inputSchema */
function getInputProps(workflow: AstWorkflow): InputProp[] {
  const props = workflow.inputSchema?.properties;
  if (!props) return [];
  return Object.entries(props).map(([key, val]) => ({
    key,
    type: val.type ?? 'string',
    description: val.description,
  }));
}

/** Count non-terminate steps */
function nonTerminateStepCount(workflow: AstWorkflow): number {
  return (workflow.template?.steps ?? []).filter(
    (s) => s.tool !== 'terminate' && s.stepName !== 'done',
  ).length;
}

// ── Skeleton row ───────────────────────────────────────────────────────────────

const SkeletonCard: React.FC = () => (
  <div
    className="rounded-[8px] p-3 border border-[--border-subtle] bg-[--bg-raised] animate-pulse"
    style={{ height: 72 }}
  >
    <div className="h-3 w-3/5 rounded bg-[--bg-active] mb-2" />
    <div className="h-2 w-4/5 rounded bg-[--bg-active]" />
  </div>
);

// ── Main component ─────────────────────────────────────────────────────────────

export const NewWorkflowsView: React.FC = () => {
  const {
    state: { featureFlags },
    dispatch,
  } = useContext(HomeContext);

  const canEdit = !!featureFlags.createAssistantWorkflows;

  // ── Template list state ────────────────────────────────────────────────
  const [templates, setTemplates] = useState<AstWorkflow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  // ── Delete state ───────────────────────────────────────────────────────
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // ── Step expansion in detail pane ──────────────────────────────────────
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());

  // ── Editor state ───────────────────────────────────────────────────────
  // showEditor: whether the AssistantWorkflowBuilder modal is visible
  const [showEditor, setShowEditor] = useState(false);
  // editorTemplate: the template pre-loaded into the builder (null = create new)
  const [editorTemplate, setEditorTemplate] = useState<AstWorkflow | undefined>(undefined);

  // ── Load templates ─────────────────────────────────────────────────────
  const fetchTemplates = useCallback(async () => {
    setIsLoading(true);
    try {
      // filterBaseTemplates=true matches the existing AssistantWorkflowBuilder call
      const res = await listAstWorkflowTemplates(true);
      setTemplates(
        res.success && res.data?.templates ? res.data.templates : [],
      );
    } catch (err) {
      console.error('NewWorkflowsView: failed to load templates', err);
      setTemplates([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // ── Filtered template list ─────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return templates;
    const q = searchQuery.toLowerCase();
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.description ?? '').toLowerCase().includes(q),
    );
  }, [templates, searchQuery]);

  // Currently selected template object
  const selectedTemplate = useMemo(
    () => templates.find((t) => t.templateId === selectedId) ?? null,
    [templates, selectedId],
  );

  // ── Delete handler ─────────────────────────────────────────────────────
  const handleDelete = useCallback(
    async (templateId: string) => {
      setIsDeletingId(templateId);
      setConfirmDeleteId(null);
      try {
        const res = await deleteAstWorkflowTemplate(templateId);
        if (res.success) {
          if (selectedId === templateId) {
            setSelectedId(null);
            setExpandedSteps(new Set());
          }
          toast.success('Template deleted');
          await fetchTemplates();
        } else {
          toast.error('Failed to delete template');
        }
      } catch {
        toast.error('Failed to delete template');
      } finally {
        setIsDeletingId(null);
      }
    },
    [selectedId, fetchTemplates],
  );

  // ── Editor open helpers ────────────────────────────────────────────────
  const openCreateEditor = useCallback(() => {
    setEditorTemplate(undefined);
    setShowEditor(true);
  }, []);

  const openEditEditor = useCallback(() => {
    if (!selectedTemplate) return;
    setEditorTemplate(selectedTemplate);
    setShowEditor(true);
  }, [selectedTemplate]);

  const closeEditor = useCallback(() => {
    setShowEditor(false);
    setEditorTemplate(undefined);
  }, []);

  const handleRegister = useCallback(
    async (template: AstWorkflow) => {
      // Refresh list and select the newly saved template
      await fetchTemplates();
      setSelectedId(template.templateId);
      closeEditor();
    },
    [fetchTemplates, closeEditor],
  );

  // ── Step toggle ─────────────────────────────────────────────────────────
  const toggleStep = useCallback((idx: number) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  // ── Render left pane list ──────────────────────────────────────────────
  const renderList = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col gap-2 px-3 pt-2">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      );
    }

    if (filtered.length === 0) {
      const isFiltered = searchQuery.trim().length > 0;
      return (
        <div className="flex flex-col items-center justify-center flex-1 px-6 py-12 text-center gap-3">
          <IconPuzzle
            size={48}
            className="text-[--text-muted]"
            style={{ opacity: 0.4 }}
          />
          <p className="text-[13px] text-[--text-muted] leading-relaxed">
            {isFiltered
              ? 'No templates match your search.'
              : canEdit
              ? 'No workflow templates yet.\nCreate your first one.'
              : 'No workflow templates available.'}
          </p>
          {!isFiltered && canEdit && (
            <button
              onClick={openCreateEditor}
              className="mt-1 px-4 py-2 rounded-[10px] text-[13px] font-medium text-white transition-colors"
              style={{ background: 'var(--accent)' }}
            >
              New Workflow
            </button>
          )}
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-[6px] px-3 pt-2 pb-4">
        {filtered.map((t) => {
          const stepCount = nonTerminateStepCount(t);
          const isSelected = t.templateId === selectedId;
          const isHovered = hoveredId === t.templateId;
          const isDeleting = isDeletingId === t.templateId;

          return (
            <div
              key={t.templateId}
              onClick={() => {
                setSelectedId(isSelected ? null : t.templateId);
                setExpandedSteps(new Set());
                setConfirmDeleteId(null);
              }}
              onMouseEnter={() => setHoveredId(t.templateId)}
              onMouseLeave={() => setHoveredId(null)}
              className="relative cursor-pointer rounded-[8px] p-3 border transition-colors"
              style={{
                background: isSelected
                  ? 'var(--bg-active)'
                  : isHovered
                  ? 'var(--bg-hover)'
                  : 'var(--bg-raised)',
                borderColor: isSelected ? 'var(--accent)' : 'var(--border-subtle)',
                borderWidth: isSelected ? '1.5px' : '1px',
              }}
            >
              {/* Template name */}
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="text-[14px] font-medium truncate flex-1"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {t.name || '(Untitled)'}
                </span>
              </div>

              {/* Description (1 line clamp) */}
              {t.description && (
                <p
                  className="text-[13px] mb-2 leading-snug"
                  style={{
                    color: 'var(--text-secondary)',
                    display: '-webkit-box',
                    WebkitLineClamp: 1,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {t.description}
                </p>
              )}

              {/* Badges row */}
              <div className="flex items-center gap-[6px] flex-wrap">
                {/* Step count */}
                <span
                  className="text-[11px] px-2 py-[2px] rounded-full"
                  style={{
                    background: 'var(--bg-active)',
                    color: 'var(--text-muted)',
                  }}
                >
                  {stepCount} step{stepCount !== 1 ? 's' : ''}
                </span>
                {/* Base template badge */}
                {t.isBaseTemplate && (
                  <span
                    className="text-[11px] px-2 py-[2px] rounded-full border"
                    style={{
                      borderColor: 'var(--accent)',
                      color: 'var(--accent)',
                    }}
                  >
                    Base template
                  </span>
                )}
                {/* Public badge */}
                {t.isPublic && (
                  <span
                    className="text-[11px] px-2 py-[2px] rounded-full border"
                    style={{
                      borderColor: 'var(--text-muted)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    Public
                  </span>
                )}
              </div>

              {/* Hover action icons (edit + delete) */}
              {canEdit && (isHovered || isSelected) && !isDeleting && (
                <div
                  className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    title="Edit workflow"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedId(t.templateId);
                      setEditorTemplate(t);
                      setShowEditor(true);
                    }}
                    className="w-7 h-7 flex items-center justify-center rounded-[6px] transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = 'var(--bg-active)')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = 'transparent')
                    }
                  >
                    <IconEdit size={14} />
                  </button>
                  <button
                    title="Delete workflow"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDeleteId(t.templateId);
                    }}
                    className="w-7 h-7 flex items-center justify-center rounded-[6px] transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--bg-active)';
                      e.currentTarget.style.color = '#e05252';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'var(--text-muted)';
                    }}
                  >
                    <IconTrash size={14} />
                  </button>
                </div>
              )}

              {/* Spinner while deleting */}
              {isDeleting && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <IconLoader2 size={16} className="animate-spin text-[--text-muted]" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // ── Render right pane detail view ──────────────────────────────────────
  const renderDetail = () => {
    if (!selectedTemplate) {
      return (
        <div className="flex flex-col items-center justify-center flex-1 gap-4">
          <IconPuzzle
            size={64}
            style={{ color: 'var(--text-muted)', opacity: 0.35 }}
          />
          <p
            className="text-[15px]"
            style={{ color: 'var(--text-muted)' }}
          >
            Select a workflow to view its details
          </p>
        </div>
      );
    }

    const tpl = selectedTemplate;
    const steps = tpl.template?.steps ?? [];
    const nonTerminate = steps.filter(
      (s) => s.tool !== 'terminate' && s.stepName !== 'done',
    );
    const inputProps = getInputProps(tpl);

    return (
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {/* Header */}
        <div className="mb-6">
          <h2
            className="text-[22px] font-semibold mb-2"
            style={{ color: 'var(--text-primary)' }}
          >
            {tpl.name || '(Untitled)'}
          </h2>
          {tpl.description && (
            <p
              className="text-[15px] leading-relaxed mb-3"
              style={{ color: 'var(--text-secondary)' }}
            >
              {tpl.description}
            </p>
          )}
          {/* Meta badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-[12px] px-2.5 py-1 rounded-full"
              style={{
                background: 'var(--bg-active)',
                color: 'var(--text-muted)',
              }}
            >
              {nonTerminate.length} step{nonTerminate.length !== 1 ? 's' : ''}
            </span>
            {tpl.isBaseTemplate && (
              <span
                className="text-[12px] px-2.5 py-1 rounded-full border"
                style={{
                  borderColor: 'var(--accent)',
                  color: 'var(--accent)',
                }}
              >
                Base template
              </span>
            )}
            {tpl.isPublic && (
              <span
                className="text-[12px] px-2.5 py-1 rounded-full border"
                style={{
                  borderColor: 'var(--text-muted)',
                  color: 'var(--text-muted)',
                }}
              >
                Public
              </span>
            )}
          </div>
        </div>

        {/* Input parameters */}
        {inputProps.length > 0 && (
          <div className="mb-6">
            <h3
              className="text-[13px] font-semibold uppercase tracking-wider mb-3"
              style={{ color: 'var(--text-muted)' }}
            >
              Inputs
            </h3>
            <div
              className="rounded-[10px] border overflow-hidden"
              style={{
                borderColor: 'var(--border-subtle)',
                background: 'var(--bg-raised)',
              }}
            >
              {inputProps.map((ip, idx) => (
                <div
                  key={ip.key}
                  className="flex items-start gap-3 px-4 py-3"
                  style={{
                    borderTop:
                      idx > 0 ? '1px solid var(--border-subtle)' : undefined,
                  }}
                >
                  <code
                    className="text-[12px] font-mono mt-0.5 shrink-0 px-1.5 py-0.5 rounded"
                    style={{
                      background: 'var(--bg-active)',
                      color: 'var(--accent)',
                    }}
                  >
                    {ip.key}
                  </code>
                  <span
                    className="text-[12px] shrink-0"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {ip.type}
                  </span>
                  {ip.description && (
                    <span
                      className="text-[13px] leading-snug"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {ip.description}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Steps */}
        {nonTerminate.length > 0 && (
          <div className="mb-8">
            <h3
              className="text-[13px] font-semibold uppercase tracking-wider mb-3"
              style={{ color: 'var(--text-muted)' }}
            >
              Steps
            </h3>
            <div className="flex flex-col gap-2">
              {nonTerminate.map((step, idx) => {
                const isExpanded = expandedSteps.has(idx);
                return (
                  <div
                    key={idx}
                    className="rounded-[10px] border overflow-hidden"
                    style={{
                      borderColor: 'var(--border-subtle)',
                      background: 'var(--bg-raised)',
                    }}
                  >
                    {/* Step header */}
                    <button
                      onClick={() => toggleStep(idx)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                      style={{
                        background: isExpanded
                          ? 'var(--bg-hover)'
                          : 'transparent',
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = 'var(--bg-hover)')
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = isExpanded
                          ? 'var(--bg-hover)'
                          : 'transparent')
                      }
                    >
                      {/* Step number */}
                      <span
                        className="text-[11px] font-semibold w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                        style={{
                          background: 'var(--bg-active)',
                          color: 'var(--text-muted)',
                        }}
                      >
                        {idx + 1}
                      </span>

                      {/* Description */}
                      <span
                        className="text-[13px] font-medium flex-1 truncate"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {step.description || step.stepName || '(unnamed step)'}
                      </span>

                      {/* Tool badge */}
                      {step.tool && (
                        <code
                          className="text-[11px] font-mono px-2 py-0.5 rounded shrink-0"
                          style={{
                            background: 'var(--bg-active)',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          {step.tool}
                        </code>
                      )}

                      {/* Chevron */}
                      <span style={{ color: 'var(--text-muted)' }}>
                        {isExpanded ? (
                          <IconChevronDown size={15} />
                        ) : (
                          <IconChevronRight size={15} />
                        )}
                      </span>
                    </button>

                    {/* Expanded instructions */}
                    {isExpanded && step.instructions && (
                      <div
                        className="px-4 pb-4 pt-2 text-[13px] leading-relaxed border-t"
                        style={{
                          color: 'var(--text-secondary)',
                          borderColor: 'var(--border-subtle)',
                        }}
                      >
                        <span
                          className="text-[11px] font-semibold uppercase tracking-wider block mb-1"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          Instructions
                        </span>
                        {step.instructions}
                      </div>
                    )}

                    {/* No tool fallback */}
                    {isExpanded && !step.tool && (
                      <div
                        className="px-4 pb-3 pt-1 text-[12px] italic border-t"
                        style={{
                          color: 'var(--text-muted)',
                          borderColor: 'var(--border-subtle)',
                        }}
                      >
                        (no tool selected)
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Edit button */}
        {canEdit && (
          <div className="pb-6">
            <button
              onClick={openEditEditor}
              className="flex items-center gap-2 px-5 py-2.5 rounded-[10px] text-[14px] font-medium text-white transition-opacity hover:opacity-90 active:opacity-80"
              style={{ background: 'var(--accent)' }}
            >
              <IconEdit size={16} />
              Edit Workflow
            </button>
          </div>
        )}
      </div>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <>
      {/* Full-pane shell */}
      <div
        className="flex flex-col flex-1 h-full overflow-hidden"
        style={{ background: 'var(--bg-app)', fontFamily: 'Inter, sans-serif' }}
      >
        {/* ── Top bar ──────────────────────────────────────────────────── */}
        <div
          className="flex-shrink-0 flex items-center gap-3 px-5 h-[52px] border-b"
          style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-app)' }}
        >
          {/* Back to chat */}
          <button
            onClick={() => dispatch({ field: 'page', value: 'chat' })}
            className="w-8 h-8 flex items-center justify-center rounded-[8px] transition-colors"
            style={{ color: 'var(--text-muted)' }}
            title="Back to chat"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-hover)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
          >
            <IconChevronLeft size={18} />
          </button>

          <h1
            className="text-[16px] font-semibold flex-1"
            style={{ color: 'var(--text-primary)' }}
          >
            Workflows
          </h1>

          {/* New Workflow button — only when canEdit */}
          {canEdit && (
            <button
              onClick={openCreateEditor}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[10px] text-[13px] font-medium text-white transition-opacity hover:opacity-90"
              style={{ background: 'var(--accent)' }}
            >
              <IconPlus size={15} />
              New Workflow
            </button>
          )}
        </div>

        {/* ── Two-pane body ────────────────────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden">
          {/* ── Left pane ── */}
          <div
            className="flex flex-col flex-shrink-0 border-r overflow-hidden"
            style={{
              width: 340,
              borderColor: 'var(--border-subtle)',
              background: 'var(--bg-sidebar)',
            }}
          >
            {/* Search bar */}
            <div
              className="flex-shrink-0 px-3 pt-3 pb-2 border-b"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-[8px] border"
                style={{
                  background: 'var(--bg-raised)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                <IconSearch size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <input
                  ref={searchRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search workflows…"
                  className="flex-1 bg-transparent outline-none text-[13px] placeholder-[color:var(--text-muted)]"
                  style={{ color: 'var(--text-primary)' }}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = 'var(--text-primary)')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color = 'var(--text-muted)')
                    }
                  >
                    <IconX size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* Template list (scrollable) */}
            <div className="flex-1 overflow-y-auto">
              {renderList()}
            </div>
          </div>

          {/* ── Right pane ── */}
          <div
            className="flex flex-1 overflow-hidden"
            style={{ background: 'var(--bg-app)' }}
          >
            {renderDetail()}
          </div>
        </div>
      </div>

      {/* ── Delete confirmation dialog ────────────────────────────────────── */}
      {confirmDeleteId && (() => {
        const tpl = templates.find((t) => t.templateId === confirmDeleteId);
        return (
          <div className="fixed inset-0 z-[110] flex items-center justify-center"
               style={{ background: 'rgba(0,0,0,0.55)' }}>
            <div
              className="rounded-[14px] border px-6 py-5 shadow-xl"
              style={{
                background: 'var(--bg-raised)',
                borderColor: 'var(--border-subtle)',
                width: 380,
              }}
            >
              <h4
                className="text-[15px] font-semibold mb-2"
                style={{ color: 'var(--text-primary)' }}
              >
                Delete Template
              </h4>
              <p
                className="text-[13px] mb-5 leading-relaxed"
                style={{ color: 'var(--text-secondary)' }}
              >
                Are you sure you want to delete{' '}
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                  &ldquo;{tpl?.name}&rdquo;
                </span>
                ? This cannot be undone.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  className="px-4 py-1.5 text-[13px] rounded-[8px] border transition-colors"
                  style={{
                    borderColor: 'var(--border-subtle)',
                    color: 'var(--text-secondary)',
                    background: 'var(--bg-raised)',
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = 'var(--bg-hover)')
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = 'var(--bg-raised)')
                  }
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(confirmDeleteId)}
                  className="px-4 py-1.5 text-[13px] rounded-[8px] font-medium text-white transition-opacity hover:opacity-90"
                  style={{ background: '#e05252' }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── AssistantWorkflowBuilder — wrapped in scoping div for CSS overrides ── */}
      {/*
        The builder renders its own full-screen Modal (modal-overlay, z-50).
        We wrap it in .new-ui-workflow-editor-modal so conversation-view.css
        can scope its styling overrides (backdrop color, content bg, text colors)
        without touching the original component or global styles.
        See: styles/conversation-view.css "Workflows view — inner builder overrides"
      */}
      <div className="new-ui-workflow-editor-modal text-neutral-900 dark:text-white">
        <AssistantWorkflowBuilder
          isOpen={showEditor}
          onClose={closeEditor}
          initialTemplate={editorTemplate}
          onRegister={handleRegister}
          isBaseTemplate={true}
        />
      </div>
    </>
  );
};
