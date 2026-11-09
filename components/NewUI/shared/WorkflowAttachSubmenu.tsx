import React, { useMemo, useState } from 'react';
import { IconCheck, IconGitBranch, IconSearch, IconX } from '@tabler/icons-react';
import type { AstWorkflow } from '@/types/assistantWorkflows';
import type { ConversationWorkflow } from './conversationWorkflow';

interface WorkflowAttachSubmenuProps {
  templates: AstWorkflow[];
  selected: ConversationWorkflow | null;
  onSelect: (workflow: ConversationWorkflow | null) => void;
  /** Closes the whole menu (after a pick, or on Done). */
  onClose?: () => void;
}

/** Right-hand panel listing the user's workflows; picking one attaches it to the conversation. */
export const WorkflowAttachSubmenu: React.FC<WorkflowAttachSubmenuProps> = ({ templates, selected, onSelect, onClose }) => {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return templates;
    return templates.filter((t) => t.name.toLowerCase().includes(term) || t.description?.toLowerCase().includes(term));
  }, [search, templates]);

  return (
    <div
      role="menu"
      aria-label="Add workflow"
      data-new-ui-shell="true"
      style={{
        width: 320,
        background: 'var(--bg-raised)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 12,
        boxShadow: '0 12px 32px rgba(0,0,0,.5)',
        overflow: 'hidden',
        color: 'var(--text-primary)',
      }}
    >
      <div style={{ padding: 10, borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <IconGitBranch size={16} style={{ color: 'var(--accent)' }} />
            <span>Workflows</span>
          </div>
          <button
            type="button"
            onClick={() => onSelect(null)}
            disabled={!selected}
            aria-label="Remove attached workflow"
            className="flex items-center justify-center rounded-[6px]"
            style={{ color: selected ? 'var(--text-secondary)' : 'var(--text-muted)', width: 24, height: 24 }}
          >
            <IconX size={14} />
          </button>
        </div>
        <div className="relative">
          <IconSearch size={14} style={{ position: 'absolute', left: 9, top: 9, color: 'var(--text-muted)' }} />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search workflows…"
            aria-label="Search workflows"
            className="w-full rounded-[7px]"
            style={{ height: 32, padding: '0 9px 0 28px', background: 'var(--bg-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', outline: 'none', fontSize: 13 }}
          />
        </div>
      </div>

      <div style={{ maxHeight: 270, overflowY: 'auto', padding: 6 }}>
        {filtered.length === 0 && (
          <div style={{ padding: 18, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No matching workflows.</div>
        )}
        {filtered.map((workflow) => {
          const isSelected = selected?.templateId === workflow.templateId;
          return (
            <button
              key={workflow.templateId}
              type="button"
              role="menuitemradio"
              aria-checked={isSelected}
              // Picking the attached one again detaches it, as in the classic picker.
              onClick={() => onSelect(isSelected ? null : { templateId: workflow.templateId, name: workflow.name })}
              className="w-full flex items-start gap-2 rounded-[8px] text-left"
              style={{ padding: '8px 7px', background: isSelected ? 'var(--bg-active)' : 'transparent', color: 'var(--text-primary)' }}
            >
              <span className="flex items-center justify-center rounded-full mt-[1px]" style={{ width: 17, height: 17, border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border-subtle)'}`, background: isSelected ? 'var(--accent)' : 'transparent', color: 'var(--accent-fg)', flexShrink: 0 }}>
                {isSelected && <IconCheck size={12} />}
              </span>
              <span style={{ minWidth: 0 }}>
                <span className="block truncate" style={{ fontSize: 13 }}>{workflow.name}</span>
                {workflow.description && <span className="block truncate" style={{ color: 'var(--text-muted)', fontSize: 12 }}>{workflow.description}</span>}
              </span>
            </button>
          );
        })}
      </div>

      {onClose && (
        <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '8px 10px', display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Done</button>
        </div>
      )}
    </div>
  );
};
