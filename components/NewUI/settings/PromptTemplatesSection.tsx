/**
 * PromptTemplatesSection — Settings → Customize → Prompt Templates
 *
 * Two-tab layout matching ChatsListView:
 *   - "My Templates" — user's own templates with Edit / Share / Delete hover actions
 *   - "Shared with Me" — items received via the share service that contain prompts
 *
 * Sharing reuses NewUIShareModal with promptId/promptName props.
 * Delete uses ConfirmDialog for safety.
 * "Shared with Me" lazy-loads via getSharedItems() on first tab activation,
 * same pattern as ChatsListView. Opening a shared item imports its prompts.
 */

import React, { useContext, useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  IconTemplate,
  IconPlus,
  IconSearch,
  IconRobot,
  IconPencil,
  IconTrash,
  IconShare,
  IconLoader2,
  IconAlertCircle,
} from '@tabler/icons-react';
import { createPortal } from 'react-dom';
import HomeContext from '@/pages/api/home/home.context';
import { Prompt } from '@/types/prompt';
import { ShareItem, ExportFormatV4 } from '@/types/export';
import { FolderInterface } from '@/types/folder';
import { createEmptyPrompt, savePrompts } from '@/utils/app/prompts';
import { startConversationWithTemplate } from '@/components/NewUI/shared/promptConversation';
import { importData } from '@/utils/app/importExport';
import { saveFolders } from '@/utils/app/folders';
import { saveConversations } from '@/utils/app/conversation';
import { isAssistant } from '@/utils/app/assistants';
import { DefaultModels } from '@/types/model';
import { getSharedItems, loadSharedItem } from '@/services/shareService';
import { NewUIPromptCreationModal } from '@/components/NewUI/views/NewUIPromptCreationModal';
import { NewUIShareModal } from '@/components/NewUI/chat/NewUIShareModal';
import { ConfirmDialog } from '@/components/NewUI/shared/ConfirmDialog';
import { SegmentedControl } from '@/components/NewUI/shared/SegmentedControl';
import { promptTemplateVariables } from '@/components/NewUI/shared/PromptTemplateDialog';
import { openPromptTemplateDialog } from '@/components/NewUI/shared/PromptTemplateDialogHost';

// ── Tabs ─────────────────────────────────────────────────────────────────────

const TAB_ITEMS = [
  { id: 'mine', label: 'My Templates' },
  { id: 'shared', label: 'Shared with Me' },
];
type TemplateTab = 'mine' | 'shared';

// ── Helpers ───────────────────────────────────────────────────────────────────

const relativeDate = (ts: number | string): string => {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

// ── Skeleton row ─────────────────────────────────────────────────────────────

const SkeletonRow: React.FC = () => (
  <div
    className="flex items-center gap-3 px-3 h-[52px] rounded-[8px] motion-safe:animate-pulse motion-reduce:animate-none"
    aria-hidden="true"
  >
    <div className="w-10 h-10 rounded-[8px] flex-shrink-0" style={{ background: 'var(--bg-raised)' }} />
    <div className="flex-1 space-y-1.5">
      <div className="h-3 rounded" style={{ background: 'var(--bg-raised)', width: '60%' }} />
      <div className="h-2.5 rounded" style={{ background: 'var(--bg-raised)', width: '40%' }} />
    </div>
  </div>
);

// ── Section heading ───────────────────────────────────────────────────────────

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
        style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-muted)' }}
      >
        {count}
      </span>
    )}
  </div>
);

// ── Empty state ───────────────────────────────────────────────────────────────

const EmptyState: React.FC<{
  message: string;
  subMessage?: string;
  onAction?: () => void;
  actionLabel?: string;
  icon?: React.ReactNode;
}> = ({ message, subMessage, onAction, actionLabel, icon }) => (
  <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
    <div className="mb-4 opacity-20" style={{ color: 'var(--text-muted)' }}>
      {icon ?? <IconRobot size={32} />}
    </div>
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
        className="mt-4 flex items-center gap-1.5 h-[34px] px-4 rounded-[8px] text-[13px] font-medium transition-opacity hover:opacity-90"
        style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
      >
        <IconPlus size={14} />
        {actionLabel}
      </button>
    )}
  </div>
);

// ── My-template row ───────────────────────────────────────────────────────────

interface TemplateRowProps {
  icon?: React.ReactNode;
  name: string;
  description?: string;
  canEdit?: boolean;
  onClick: () => void;
  onEdit?: (e: React.MouseEvent) => void;
  onShare?: (e: React.MouseEvent) => void;
  onDelete?: (e: React.MouseEvent) => void;
}

const TemplateRow: React.FC<TemplateRowProps> = ({
  icon,
  name,
  description,
  canEdit,
  onClick,
  onEdit,
  onShare,
  onDelete,
}) => {
  const [hovered, setHovered] = useState(false);

  const iconBtn = (
    label: string,
    Icon: React.ElementType,
    handler: ((e: React.MouseEvent) => void) | undefined,
    danger = false,
  ) => {
    if (!handler) return null;
    return (
      <button
        onClick={handler}
        aria-label={label}
        title={label}
        className="flex items-center justify-center w-7 h-7 rounded-[6px] transition-colors"
        style={{ color: danger ? 'var(--text-error)' : 'var(--text-muted)' }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-active)';
          (e.currentTarget as HTMLElement).style.color = danger
            ? 'var(--text-error)'
            : 'var(--text-primary)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
          (e.currentTarget as HTMLElement).style.color = danger
            ? 'var(--text-error)'
            : 'var(--text-muted)';
        }}
      >
        <Icon size={14} />
      </button>
    );
  };

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
        <p className="text-[14px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>
          {name}
        </p>
        {description && (
          <p className="text-[12px] truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {description}
          </p>
        )}
      </div>

      {/* Hover actions */}
      {hovered && (
        <div
          className="flex items-center gap-0.5 flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {canEdit !== false && iconBtn('Edit', IconPencil, onEdit)}
          {iconBtn('Share', IconShare, onShare)}
          {iconBtn('Delete', IconTrash, onDelete, true)}
        </div>
      )}
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

const PromptTemplatesSection: React.FC = () => {
  const {
    state: { prompts, statsService, availableModels, featureFlags, conversations, folders },
    dispatch: homeDispatch,
    handleNewConversation,
    getDefaultModel,
  } = useContext(HomeContext);

  const promptsRef = useRef(prompts);
  useEffect(() => { promptsRef.current = prompts; }, [prompts]);

  // ── Search + tab ────────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<TemplateTab>('mine');

  // ── Edit modal state ────────────────────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Prompt | null>(null);

  // ── Share modal state ───────────────────────────────────────────────────
  const [shareTarget, setShareTarget] = useState<Prompt | null>(null);

  // ── Delete confirm state ────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<Prompt | null>(null);

  // ── Shared-with-me state ────────────────────────────────────────────────
  const [sharedItems, setSharedItems] = useState<ShareItem[] | null>(null);
  const [sharedLoading, setSharedLoading] = useState(false);
  const [sharedError, setSharedError] = useState<string | null>(null);
  const [openingKey, setOpeningKey] = useState<string | null>(null);

  // ── Visibility filter ───────────────────────────────────────────────────
  const isVisible = (p: Prompt) => featureFlags.overrideInvisiblePrompts || !p.data?.hidden;

  const allTemplates = useMemo(
    () => prompts.filter((p: Prompt) => !isAssistant(p) && isVisible(p)),
    [prompts, featureFlags.overrideInvisiblePrompts],
  );

  const filteredMine = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allTemplates
      .filter(
        (p: Prompt) =>
          p.folderId !== 'amplify_helpers' &&
          p.type !== 'root_prompt' &&
          (!q ||
            p.name.toLowerCase().includes(q) ||
            (p.description && p.description.toLowerCase().includes(q))),
      )
      .sort((a: Prompt, b: Prompt) => a.name.localeCompare(b.name));
  }, [allTemplates, search]);

  // ── Lazy-load shared items ──────────────────────────────────────────────
  const fetchSharedItems = useCallback(async () => {
    setSharedLoading(true);
    setSharedError(null);
    try {
      const result = await getSharedItems();
      if (result.success) {
        const items = (result.items as ShareItem[]).sort(
          (a, b) => new Date(b.sharedAt).getTime() - new Date(a.sharedAt).getTime(),
        );
        setSharedItems(items);
      } else {
        setSharedError('Could not load shared items. Please try again.');
        setSharedItems([]);
      }
    } catch {
      setSharedError('Could not load shared items. Please try again.');
      setSharedItems([]);
    } finally {
      setSharedLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'shared' && sharedItems === null && !sharedLoading) {
      fetchSharedItems();
    }
  }, [activeTab, sharedItems, sharedLoading, fetchSharedItems]);

  const filteredShared = useMemo(() => {
    if (!sharedItems) return [];
    const q = search.trim().toLowerCase();
    if (!q) return sharedItems;
    return sharedItems.filter((item) => item.note.toLowerCase().includes(q));
  }, [sharedItems, search]);

  // ── Open a shared item — import its prompts ─────────────────────────────
  const handleOpenSharedItem = async (item: ShareItem) => {
    setOpeningKey(item.key);
    setSharedError(null);
    try {
      const result = await loadSharedItem(item.key);
      if (!result.success) {
        setSharedError('Could not open this item — it may have been deleted.');
        return;
      }
      const sharedData: ExportFormatV4 = JSON.parse(result.item);

      const defaultModel = getDefaultModel(DefaultModels.DEFAULT);

      const merged = importData(sharedData, conversations, promptsRef.current, folders, defaultModel);
      homeDispatch({ field: 'conversations', value: merged.history });
      saveConversations(merged.history);
      homeDispatch({ field: 'folders', value: merged.folders });
      saveFolders(merged.folders);
      homeDispatch({ field: 'prompts', value: merged.prompts });
      savePrompts(merged.prompts);
    } catch {
      setSharedError('An unexpected error occurred. Please try again.');
    } finally {
      setOpeningKey(null);
    }
  };

  // ── Template actions ────────────────────────────────────────────────────
  const closeSettings = () => window.dispatchEvent(new Event('closeNewUISettings'));

  const handleUseTemplate = (p: Prompt) => {
    if (promptTemplateVariables(p).length > 0) {
      openPromptTemplateDialog(p);
      closeSettings();
      return;
    }
    statsService.startConversationEvent(p);
    startConversationWithTemplate(handleNewConversation, promptsRef.current, p, availableModels);
    homeDispatch({ field: 'page', value: 'chat' });
    closeSettings();
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

  const handleShareTemplate = (e: React.MouseEvent, p: Prompt) => {
    e.stopPropagation();
    setShareTarget(p);
  };

  const handleDeleteTemplate = (e: React.MouseEvent, p: Prompt) => {
    e.stopPropagation();
    setDeleteTarget(p);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const updated = promptsRef.current.filter((p: Prompt) => p.id !== deleteTarget.id);
    homeDispatch({ field: 'prompts', value: updated });
    savePrompts(updated);
    setDeleteTarget(null);
  };

  const handleUpdatePrompt = (updated: Prompt) => {
    homeDispatch({
      field: 'prompts',
      value: prompts.map((p: Prompt) => (p.id === updated.id ? updated : p)),
    });
  };

  const handleCancelModal = () => {
    if (selectedTemplate) {
      const existing = promptsRef.current.find((p: Prompt) => p.id === selectedTemplate.id);
      if (existing && !existing.description && !existing.content) {
        const updated = promptsRef.current.filter((p: Prompt) => p.id !== selectedTemplate.id);
        homeDispatch({ field: 'prompts', value: updated });
        savePrompts(updated);
      }
    }
    setShowModal(false);
    setSelectedTemplate(null);
  };

  const canEditTemplate = (p: Prompt) => !p.data?.noEdit;

  // ── Edit modal — early-return (§2 rule) ────────────────────────────────
  if (showModal && selectedTemplate) {
    return (
      <NewUIPromptCreationModal
        prompt={selectedTemplate}
        onCancel={handleCancelModal}
        onSave={() => {
          setShowModal(false);
          setSelectedTemplate(null);
        }}
        onUpdatePrompt={handleUpdatePrompt}
      />
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden text-neutral-900 dark:text-white">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between pb-4 mb-2 flex-shrink-0 border-b"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        {/* Search */}
        <div className="relative">
          <IconSearch
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--text-muted)' }}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={activeTab === 'mine' ? 'Search templates…' : 'Search shared…'}
            className="h-[34px] pl-9 pr-3 rounded-[8px] text-[13px] border focus:outline-none w-[200px] transition-colors"
            style={{
              backgroundColor: 'var(--bg-raised)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
          />
        </div>

        {activeTab === 'mine' && (
          <button
            onClick={handleCreateTemplate}
            className="flex items-center gap-1.5 h-[34px] px-4 rounded-[8px] text-[13px] font-medium transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
          >
            <IconPlus size={14} />
            New Template
          </button>
        )}
      </div>

      {/* ── Tab strip ─────────────────────────────────────────────────────── */}
      <div className="pb-3 flex-shrink-0">
        <SegmentedControl
          items={TAB_ITEMS}
          value={activeTab}
          onChange={(id) => {
            setActiveTab(id as TemplateTab);
            setSearch('');
          }}
          size="sm"
          aria-label="Template view filter"
        />
      </div>

      {/* ── My Templates tab ──────────────────────────────────────────────── */}
      {activeTab === 'mine' && (
        <div className="flex-1 overflow-y-auto py-0">
          {filteredMine.length === 0 ? (
            <EmptyState
              message={search ? 'No templates match your search' : 'No templates yet'}
              onAction={!search ? handleCreateTemplate : undefined}
              actionLabel="Create your first template"
            />
          ) : (
            <div>
              <SectionHeading label="Your Templates" count={filteredMine.length} />
              {filteredMine.map((p: Prompt) => (
                <TemplateRow
                  key={p.id}
                  icon={<IconTemplate size={18} style={{ color: 'var(--text-muted)' }} />}
                  name={p.name}
                  description={p.description}
                  canEdit={canEditTemplate(p)}
                  onClick={() => handleUseTemplate(p)}
                  onEdit={canEditTemplate(p) ? (e) => handleEditTemplate(e, p) : undefined}
                  onShare={(e) => handleShareTemplate(e, p)}
                  onDelete={(e) => handleDeleteTemplate(e, p)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Shared with Me tab ────────────────────────────────────────────── */}
      {activeTab === 'shared' && (
        <div className="flex-1 overflow-y-auto py-0">
          {/* Error */}
          {sharedError && (
            <div
              className="flex items-center gap-2 px-4 py-3 mb-3 rounded-[8px] border"
              style={{ background: 'var(--bg-raised)', borderColor: 'var(--border-subtle)' }}
            >
              <IconAlertCircle size={16} className="flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
              <span className="text-[13px] flex-1" style={{ color: 'var(--text-secondary)' }}>
                {sharedError}
              </span>
              <button
                onClick={() => { setSharedItems(null); setSharedError(null); }}
                className="text-[13px] font-medium hover:opacity-80 transition-opacity flex-shrink-0"
                style={{ color: 'var(--accent)' }}
              >
                Retry
              </button>
            </div>
          )}

          {/* Loading */}
          {sharedLoading && (
            <div className="flex flex-col">
              {[1, 2, 3].map((n) => <SkeletonRow key={n} />)}
            </div>
          )}

          {/* Empty */}
          {!sharedLoading && !sharedError && sharedItems !== null && filteredShared.length === 0 && (
            <EmptyState
              message={search ? 'No shared items match your search' : 'Nothing shared with you yet'}
              subMessage={!search ? 'When someone shares a template with you, it will appear here.' : undefined}
              icon={<IconShare size={32} />}
            />
          )}

          {/* Shared rows */}
          {!sharedLoading && filteredShared.length > 0 && (
            <div>
              <SectionHeading label="Shared with You" count={filteredShared.length} />
              {filteredShared.map((item) => {
                const isOpening = openingKey === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => !isOpening && handleOpenSharedItem(item)}
                    disabled={!!openingKey}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2.5 rounded-[8px] text-left
                      transition-colors duration-100 focus-visible:outline-none
                      focus-visible:ring-2 focus-visible:ring-[--text-secondary]
                      ${openingKey ? 'opacity-60 cursor-default' : 'cursor-pointer'}
                    `}
                    style={{ backgroundColor: isOpening ? 'var(--bg-hover)' : 'transparent' }}
                    onMouseEnter={(e) => {
                      if (!openingKey) e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    {/* Icon */}
                    <div
                      className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-[8px]"
                      style={{ backgroundColor: 'var(--bg-raised)' }}
                    >
                      <IconShare size={18} style={{ color: 'var(--text-muted)' }} />
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                        {item.note || 'Untitled share'}
                      </p>
                      <p className="text-[12px] truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        Shared {relativeDate(item.sharedAt)}
                      </p>
                    </div>

                    {/* Open badge */}
                    <span
                      className="flex-shrink-0 flex items-center gap-1 h-[26px] px-3 rounded-[6px] text-[12px] font-medium"
                      style={{
                        background: 'var(--bg-raised)',
                        color: isOpening ? 'var(--text-muted)' : 'var(--text-secondary)',
                      }}
                      aria-hidden="true"
                    >
                      {isOpening ? (
                        <IconLoader2 size={12} className="motion-safe:animate-spin motion-reduce:animate-none" />
                      ) : 'Import →'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Share modal ────────────────────────────────────────────────────── */}
      {shareTarget && typeof document !== 'undefined' && createPortal(
        <div
          /* data-new-ui-shell opts this portalled surface into the blue new-UI
             scrollbar rules in globals.css. Without it the body[data-chat-palette]
             thumb colour (orange by default) wins — conversation-view.css is
             @imported before those palette rules, so its [data-new-ui] blue rule
             loses the equal-specificity tie on source order. */
          data-new-ui-shell="true"
          className="text-neutral-900 dark:text-white"
          style={{ position: 'fixed', inset: 0, zIndex: 10003 }}
        >
          <NewUIShareModal
            promptId={shareTarget.id}
            promptName={shareTarget.name}
            onClose={() => setShareTarget(null)}
          />
        </div>,
        document.body,
      )}

      {/* ── Delete confirm dialog ───────────────────────────────────────────── */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete template"
        message={deleteTarget ? `Are you sure you want to delete "${deleteTarget.name}"? This cannot be undone.` : ''}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default PromptTemplatesSection;
export { PromptTemplatesSection };
