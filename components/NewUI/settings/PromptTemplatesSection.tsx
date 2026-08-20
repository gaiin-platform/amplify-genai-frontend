/**
 * PromptTemplatesSection — Settings → Customize → Prompt Templates
 *
 * Extracted from NewAssistantsView.tsx's PromptTemplatesTab component.
 * Renders the same three-section layout (Quick Actions / System Instructions / Your Templates)
 * with the same search, PromptModal open/close flow, and create/edit handlers.
 *
 * PORT: Extracted from components/NewUI/views/NewAssistantsView.tsx (PromptTemplatesTab).
 * Logic is preserved exactly. Local helper components (SectionHeading, SearchInput,
 * EmptyState, TemplateRow) are copied here since they are not exported from NewAssistantsView.
 */

import React, { useContext, useState, useMemo, useRef, useEffect } from 'react';
import {
  IconTemplate,
  IconPlus,
  IconSearch,
  IconRobot,
  IconPencil,
} from '@tabler/icons-react';
import HomeContext from '@/pages/api/home/home.context';
import { Prompt } from '@/types/prompt';
import { handleStartConversationWithPrompt, createEmptyPrompt, savePrompts } from '@/utils/app/prompts';
import { isAssistant } from '@/utils/app/assistants';
import { PromptModal } from '@/components/Promptbar/components/PromptModal';

// ── Local helper components ──────────────────────────────────────────────────

const SectionHeading: React.FC<{ label: string; count?: number }> = ({ label, count }) => (
  <div className="flex items-center gap-2 px-3 pt-5 pb-1.5">
    <span
      className="text-[11px] font-semibold uppercase tracking-wider"
      style={{ color: 'var(--text-muted)' }}
    >
      {label}
    </span>
    {count !== undefined && (
      <span
        className="text-[11px] px-1.5 py-0.5 rounded-full"
        style={{
          backgroundColor: 'var(--bg-raised)',
          color: 'var(--text-muted)',
        }}
      >
        {count}
      </span>
    )}
  </div>
);

const EmptyState: React.FC<{
  message: string;
  subMessage?: string;
  onAction?: () => void;
  actionLabel?: string;
}> = ({ message, subMessage, onAction, actionLabel }) => (
  <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
    <IconRobot size={32} className="mb-4 opacity-20" style={{ color: 'var(--text-muted)' }} />
    <p className="text-[14px] font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
      {message}
    </p>
    {subMessage && (
      <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
        {subMessage}
      </p>
    )}
    {onAction && actionLabel && (
      <button
        onClick={onAction}
        className="mt-4 flex items-center gap-1.5 h-[34px] px-4 rounded-[8px] text-[13px] font-medium text-white transition-opacity hover:opacity-90"
        style={{ backgroundColor: 'var(--accent)' }}
      >
        <IconPlus size={14} />
        {actionLabel}
      </button>
    )}
  </div>
);

const SearchInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}> = ({ value, onChange, placeholder = 'Search…' }) => (
  <div className="relative">
    <IconSearch
      size={15}
      className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
      style={{ color: 'var(--text-muted)' }}
    />
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-[34px] pl-9 pr-3 rounded-[8px] text-[13px] border focus:outline-none w-[200px] transition-colors"
      style={{
        backgroundColor: 'var(--bg-raised)',
        borderColor: 'var(--border-subtle)',
        color: 'var(--text-primary)',
      }}
    />
  </div>
);

interface TemplateRowProps {
  icon?: React.ReactNode;
  name: string;
  description?: string;
  onClick: () => void;
  onEdit?: (e: React.MouseEvent) => void;
}

const TemplateRow: React.FC<TemplateRowProps> = ({ icon, name, description, onClick, onEdit }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="group relative flex items-center gap-3 px-3 py-2.5 rounded-[8px] cursor-pointer transition-colors duration-100"
      style={{ backgroundColor: hovered ? 'var(--bg-hover)' : 'transparent' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      {/* Icon square */}
      <div
        className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-[8px]"
        style={{ backgroundColor: 'var(--bg-raised)' }}
      >
        {icon || <IconTemplate size={18} style={{ color: 'var(--text-muted)' }} />}
      </div>

      {/* Name + description */}
      <div className="flex-1 min-w-0">
        <p
          className="text-[14px] font-medium truncate"
          style={{ color: 'var(--text-primary)' }}
        >
          {name}
        </p>
        {description && (
          <p
            className="text-[12px] truncate mt-0.5"
            style={{ color: 'var(--text-muted)' }}
          >
            {description}
          </p>
        )}
      </div>

      {/* Hover actions */}
      {hovered && onEdit && (
        <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onEdit}
            className="flex items-center justify-center w-7 h-7 rounded-[6px] transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-active)';
              (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
              (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
            }}
            title="Edit template"
          >
            <IconPencil size={14} />
          </button>
        </div>
      )}
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

/**
 * PromptTemplatesSection
 * Extracted from PromptTemplatesTab in NewAssistantsView.tsx.
 * All logic is preserved exactly — same useContext(HomeContext) access,
 * same three-section layout, same search, same PromptModal open/close flow,
 * same create/edit/cancel handlers.
 */
const PromptTemplatesSection: React.FC = () => {
  const {
    state: { prompts, statsService, availableModels, featureFlags },
    dispatch: homeDispatch,
    handleNewConversation,
  } = useContext(HomeContext);

  const promptsRef = useRef(prompts);
  useEffect(() => { promptsRef.current = prompts; }, [prompts]);

  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Prompt | null>(null);

  // Mirrors Promptbar.tsx's visiblePrompts filter: hide prompts marked data.hidden
  // unless featureFlags.overrideInvisiblePrompts is set.
  const isVisible = (p: Prompt) => featureFlags.overrideInvisiblePrompts || !p.data?.hidden;

  const allTemplates = useMemo(
    () => prompts.filter((p: Prompt) => !isAssistant(p) && isVisible(p)),
    [prompts, featureFlags.overrideInvisiblePrompts],
  );

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const match = (p: Prompt) =>
      !q ||
      p.name.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q));

    const quickActions = allTemplates
      .filter((p: Prompt) => p.folderId === 'amplify_helpers' && match(p))
      .sort((a: Prompt, b: Prompt) => a.name.localeCompare(b.name));

    const systemInstructions = allTemplates
      .filter(
        (p: Prompt) =>
          p.type === 'root_prompt' &&
          p.folderId !== 'amplify_helpers' &&
          match(p),
      )
      .sort((a: Prompt, b: Prompt) => a.name.localeCompare(b.name));

    const yourTemplates = allTemplates
      .filter(
        (p: Prompt) =>
          p.folderId !== 'amplify_helpers' &&
          p.type !== 'root_prompt' &&
          match(p),
      )
      .sort((a: Prompt, b: Prompt) => a.name.localeCompare(b.name));

    return { quickActions, systemInstructions, yourTemplates };
  }, [allTemplates, search]);

  const hasResults =
    grouped.quickActions.length > 0 ||
    grouped.systemInstructions.length > 0 ||
    grouped.yourTemplates.length > 0;

  const handleStartConversation = (p: Prompt) => {
    statsService.startConversationEvent(p);
    handleStartConversationWithPrompt(handleNewConversation, promptsRef.current, p, availableModels);
    homeDispatch({ field: 'page', value: 'chat' });
  };

  const handleCreateTemplate = () => {
    const newPrompt = createEmptyPrompt(
      `Template ${promptsRef.current.filter((p: Prompt) => !isAssistant(p)).length + 1}`,
      null,
    );
    const updatedPrompts = [...promptsRef.current, newPrompt];
    homeDispatch({ field: 'prompts', value: updatedPrompts });
    savePrompts(updatedPrompts);
    setSelectedTemplate(newPrompt);
    setShowModal(true);
  };

  const handleEditTemplate = (e: React.MouseEvent, p: Prompt) => {
    e.stopPropagation();
    setSelectedTemplate(p);
    setShowModal(true);
  };

  const handleUpdatePrompt = (updated: Prompt) => {
    homeDispatch({
      field: 'prompts',
      value: prompts.map((p: Prompt) => (p.id === updated.id ? updated : p)),
    });
  };

  const handleCancelModal = () => {
    // Remove if it was a brand-new template (no description or content)
    if (selectedTemplate) {
      const existing = promptsRef.current.find((p: Prompt) => p.id === selectedTemplate.id);
      if (existing && !existing.description && !existing.content) {
        const updatedPrompts = promptsRef.current.filter((p: Prompt) => p.id !== selectedTemplate.id);
        homeDispatch({ field: 'prompts', value: updatedPrompts });
        savePrompts(updatedPrompts);
      }
    }
    setShowModal(false);
    setSelectedTemplate(null);
  };

  const canEditTemplate = (p: Prompt) => !p.data?.noEdit;

  const renderSection = (label: string, items: Prompt[]) => {
    if (items.length === 0) return null;
    return (
      <div key={label}>
        <SectionHeading label={label} count={items.length} />
        {items.map((p: Prompt) => (
          <TemplateRow
            key={p.id}
            icon={<IconTemplate size={18} style={{ color: 'var(--text-muted)' }} />}
            name={p.name}
            description={p.description}
            onClick={() => handleStartConversation(p)}
            onEdit={canEditTemplate(p) ? (e) => handleEditTemplate(e, p) : undefined}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full overflow-hidden text-neutral-900 dark:text-white">
      {/* Header — search + create button */}
      <div
        className="flex items-center justify-between pb-4 mb-2 flex-shrink-0 border-b"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <SearchInput value={search} onChange={setSearch} placeholder="Search templates…" />
        <button
          onClick={handleCreateTemplate}
          className="flex items-center gap-1.5 h-[34px] px-4 rounded-[8px] text-[13px] font-medium text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          <IconPlus size={14} />
          New Template
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-0 py-0">
        {!hasResults ? (
          <EmptyState
            message={search ? 'No templates match your search' : 'No templates available'}
            onAction={!search ? handleCreateTemplate : undefined}
            actionLabel="Create your first template"
          />
        ) : (
          <>
            {renderSection('Quick Actions', grouped.quickActions)}
            {renderSection('System Instructions', grouped.systemInstructions)}
            {renderSection('Your Templates', grouped.yourTemplates)}
          </>
        )}
      </div>

      {/* Prompt Modal */}
      {showModal && selectedTemplate && (
        <PromptModal
          prompt={selectedTemplate}
          onCancel={handleCancelModal}
          onSave={() => {
            setShowModal(false);
            setSelectedTemplate(null);
          }}
          onUpdatePrompt={handleUpdatePrompt}
        />
      )}
    </div>
  );
};

export default PromptTemplatesSection;
export { PromptTemplatesSection };
