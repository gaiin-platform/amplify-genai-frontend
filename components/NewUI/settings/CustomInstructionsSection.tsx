/**
 * CustomInstructionsSection — Settings → Customize → Custom Instructions
 *
 * Lets users create, edit, delete, and select a "active" custom instruction
 * that will be appended to the system prompt of every new blank conversation.
 *
 * Pattern follows PromptTemplatesSection: list rows with hover Edit/Delete
 * actions, early-return for the edit form, ConfirmDialog for deletes.
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  IconPlus,
  IconPencil,
  IconTrash,
  IconNotes,
  IconCheck,
} from '@tabler/icons-react';

import { ConfirmDialog } from '@/components/NewUI/shared/ConfirmDialog';
import {
  CustomInstruction,
  CustomInstructionsStore,
  loadStore,
  createInstruction,
  updateInstruction,
  deleteInstruction,
  setActiveInstruction,
} from '@/components/NewUI/shared/customInstructions';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_NAME = 80;
const MAX_CONTENT = 4000;

// ---------------------------------------------------------------------------
// Instruction Editor (inline FC — reused for create and edit)
// ---------------------------------------------------------------------------

interface InstructionEditorProps {
  initial: { name: string; content: string };
  onSave: (name: string, content: string) => void;
  onCancel: () => void;
  isNew: boolean;
}

const InstructionEditor: React.FC<InstructionEditorProps> = ({
  initial,
  onSave,
  onCancel,
  isNew,
}) => {
  const [name, setName] = useState(initial.name);
  const [content, setContent] = useState(initial.content);
  const nameRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const handleSave = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      nameRef.current?.focus();
      return;
    }
    onSave(trimmedName, content);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onCancel();
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      }}
      onKeyDown={handleKeyDown}
    >
      {/* Back button + heading */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button
          onClick={onCancel}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            fontSize: '13px',
            padding: '4px 0',
          }}
          aria-label="Back to list"
        >
          ← Back
        </button>
        <span
          style={{
            fontSize: '15px',
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}
        >
          {isNew ? 'New Instruction' : 'Edit Instruction'}
        </span>
      </div>

      {/* Editor card */}
      <div
        style={{
          background: 'var(--bg-raised)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-panel, 12px)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        {/* Name */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label
            htmlFor="ci-name"
            style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}
          >
            Name
          </label>
          <input
            id="ci-name"
            ref={nameRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, MAX_NAME))}
            placeholder="e.g. Software Engineer"
            maxLength={MAX_NAME}
            style={{
              width: '100%',
              height: '38px',
              background: 'var(--bg-app)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '0 12px',
              fontSize: '14px',
              color: 'var(--text-primary)',
              outline: 'none',
              boxSizing: 'border-box',
            }}
            onFocus={(e) => {
              (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--accent)';
            }}
            onBlur={(e) => {
              (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--border-subtle)';
            }}
          />
        </div>

        {/* Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label
            htmlFor="ci-content"
            style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}
          >
            Instructions
          </label>
          <textarea
            id="ci-content"
            value={content}
            onChange={(e) => setContent(e.target.value.slice(0, MAX_CONTENT))}
            placeholder="e.g. I'm a software engineer working on React and TypeScript. Prefer concise explanations with code examples. Always use TypeScript syntax."
            rows={8}
            style={{
              width: '100%',
              background: 'var(--bg-app)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '10px 12px',
              fontSize: '14px',
              color: 'var(--text-primary)',
              lineHeight: '1.6',
              resize: 'vertical',
              outline: 'none',
              fontFamily: 'Inter, sans-serif',
              boxSizing: 'border-box',
            }}
            onFocus={(e) => {
              (e.currentTarget as HTMLTextAreaElement).style.borderColor = 'var(--accent)';
            }}
            onBlur={(e) => {
              (e.currentTarget as HTMLTextAreaElement).style.borderColor = 'var(--border-subtle)';
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {content.length} / {MAX_CONTENT}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button
            onClick={onCancel}
            style={{
              height: '34px',
              padding: '0 16px',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            style={{
              height: '34px',
              padding: '0 18px',
              borderRadius: '8px',
              border: 'none',
              background: name.trim() ? 'var(--accent)' : 'var(--bg-active)',
              color: name.trim() ? 'var(--accent-fg)' : 'var(--text-muted)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: name.trim() ? 'pointer' : 'not-allowed',
              transition: 'background 0.12s',
            }}
          >
            {isNew ? 'Create' : 'Save'}
          </button>
        </div>
      </div>

      {/* How it works card */}
      <HowItWorksCard />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Instruction Row
// ---------------------------------------------------------------------------

interface InstructionRowProps {
  instruction: CustomInstruction;
  isActive: boolean;
  onActivate: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const InstructionRow: React.FC<InstructionRowProps> = ({
  instruction,
  isActive,
  onActivate,
  onEdit,
  onDelete,
}) => {
  const [hovered, setHovered] = useState(false);

  const preview = instruction.content.length > 90
    ? instruction.content.slice(0, 90).trimEnd() + '…'
    : instruction.content;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 12px',
        borderRadius: '8px',
        borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
        background: hovered ? 'var(--bg-hover)' : 'transparent',
        cursor: 'pointer',
        transition: 'background 0.08s',
        paddingLeft: isActive ? '10px' : '10px',
        position: 'relative',
      }}
      onClick={onActivate}
      role="button"
      tabIndex={0}
      aria-pressed={isActive}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onActivate(); } }}
    >
      {/* Radio indicator */}
      <div
        style={{
          flexShrink: 0,
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          border: isActive ? '4px solid var(--accent)' : '1.5px solid var(--border-subtle)',
          background: 'transparent',
          transition: 'border 0.1s',
          boxSizing: 'border-box',
        }}
        aria-hidden="true"
      />

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '14px',
            fontWeight: isActive ? 500 : 400,
            color: 'var(--text-primary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {instruction.name}
        </div>
        {preview && (
          <div
            style={{
              fontSize: '12px',
              color: 'var(--text-muted)',
              marginTop: '1px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {preview}
          </div>
        )}
      </div>

      {/* Hover actions */}
      {hovered && (
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          <ActionButton onClick={onEdit} label="Edit" title="Edit">
            <IconPencil size={15} stroke={1.5} />
          </ActionButton>
          <ActionButton onClick={onDelete} label="Delete" title="Delete" danger>
            <IconTrash size={15} stroke={1.5} />
          </ActionButton>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Tiny action button (hover icon buttons inside a row)
// ---------------------------------------------------------------------------

interface ActionButtonProps {
  onClick: () => void;
  label: string;
  title?: string;
  danger?: boolean;
  children: React.ReactNode;
}

const ActionButton: React.FC<ActionButtonProps> = ({ onClick, label, title, danger, children }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={title ?? label}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '28px',
        height: '28px',
        borderRadius: '6px',
        border: 'none',
        background: hovered
          ? (danger ? 'rgba(239,68,68,0.12)' : 'var(--bg-raised)')
          : 'transparent',
        color: hovered
          ? (danger ? 'var(--text-error)' : 'var(--text-primary)')
          : 'var(--text-muted)',
        cursor: 'pointer',
        transition: 'background 0.08s, color 0.08s',
        padding: 0,
      }}
    >
      {children}
    </button>
  );
};

// ---------------------------------------------------------------------------
// "None" row
// ---------------------------------------------------------------------------

const NoneRow: React.FC<{ isActive: boolean; onClick: () => void }> = ({ isActive, onClick }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-pressed={isActive}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 12px',
        borderRadius: '8px',
        borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
        background: hovered ? 'var(--bg-hover)' : 'transparent',
        cursor: 'pointer',
        transition: 'background 0.08s',
      }}
    >
      {/* Radio indicator */}
      <div
        style={{
          flexShrink: 0,
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          border: isActive ? '4px solid var(--accent)' : '1.5px solid var(--border-subtle)',
          background: 'transparent',
          transition: 'border 0.1s',
          boxSizing: 'border-box',
        }}
        aria-hidden="true"
      />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '14px', fontWeight: isActive ? 500 : 400, color: 'var(--text-primary)' }}>
          None
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '1px' }}>
          No custom instructions applied
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// How it works card (shared between list and editor views)
// ---------------------------------------------------------------------------

const HowItWorksCard: React.FC = () => (
  <div
    style={{
      background: 'var(--bg-raised)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-panel, 12px)',
      padding: '20px',
    }}
  >
    <h3 style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: 600, marginBottom: '4px' }}>
      How it works
    </h3>
    <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.7', marginBottom: '12px' }}>
      The active custom instruction is appended to the system prompt of every new blank conversation, helping Amplify understand your context and preferences without repeating them each time.
    </p>
    <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.8' }}>
      <li>Select "None" to disable custom instructions at any time</li>
      <li>Templates and assistant conversations use their own system prompts</li>
      <li>Instructions are stored locally in your browser</li>
    </ul>
  </div>
);

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------

const EmptyState: React.FC<{ onNew: () => void }> = ({ onNew }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
      gap: '12px',
    }}
  >
    <div
      style={{
        width: '44px',
        height: '44px',
        borderRadius: '12px',
        background: 'var(--bg-raised)',
        border: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-muted)',
      }}
    >
      <IconNotes size={22} stroke={1.4} />
    </div>
    <div style={{ textAlign: 'center' }}>
      <p style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 500, margin: '0 0 4px' }}>
        No custom instructions yet
      </p>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
        Create one to set your preferences for every conversation.
      </p>
    </div>
    <button
      onClick={onNew}
      style={{
        marginTop: '4px',
        height: '34px',
        padding: '0 16px',
        borderRadius: '8px',
        border: 'none',
        background: 'var(--accent)',
        color: 'var(--accent-fg)',
        fontSize: '13px',
        fontWeight: 500,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}
    >
      <IconPlus size={15} stroke={2} />
      New Instruction
    </button>
  </div>
);

// ---------------------------------------------------------------------------
// Main Section
// ---------------------------------------------------------------------------

// editTarget: null = list view; 'new' = creating; string = editing by id
type EditTarget = null | 'new' | string;

export const CustomInstructionsSection: React.FC = () => {
  const [store, setStore] = useState<CustomInstructionsStore>(() => loadStore());
  const [editTarget, setEditTarget] = useState<EditTarget>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomInstruction | null>(null);

  const refresh = useCallback((updated: CustomInstructionsStore) => {
    setStore(updated);
  }, []);

  // ── Early return: editor view ──────────────────────────────────────────────
  if (editTarget !== null) {
    const isNew = editTarget === 'new';
    const editing = isNew
      ? undefined
      : store.instructions.find((i) => i.id === editTarget);

    const handleSave = (name: string, content: string) => {
      if (isNew) {
        const updated = createInstruction(name, content, true);
        refresh(updated);
      } else if (editing) {
        const updated = updateInstruction(editing.id, { name, content });
        refresh(updated);
      }
      setEditTarget(null);
    };

    return (
      <InstructionEditor
        initial={{ name: editing?.name ?? '', content: editing?.content ?? '' }}
        onSave={handleSave}
        onCancel={() => setEditTarget(null)}
        isNew={isNew}
      />
    );
  }

  // ── List view ──────────────────────────────────────────────────────────────

  const handleActivate = (id: string | null) => {
    const updated = setActiveInstruction(id);
    refresh(updated);
  };

  const handleDelete = (instruction: CustomInstruction) => {
    const updated = deleteInstruction(instruction.id);
    refresh(updated);
    setDeleteTarget(null);
  };

  const { instructions, activeId } = store;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Main card */}
      <div
        style={{
          background: 'var(--bg-raised)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-panel, 12px)',
          overflow: 'hidden',
        }}
      >
        {/* Card header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 16px 14px',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              Custom Instructions
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              {instructions.length === 0
                ? 'None created yet'
                : `${instructions.length} instruction${instructions.length === 1 ? '' : 's'} · ${activeId ? `"${instructions.find(i => i.id === activeId)?.name ?? ''}" active` : 'none active'}`}
            </p>
          </div>
          <button
            onClick={() => setEditTarget('new')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              height: '32px',
              padding: '0 12px',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--accent)',
              color: 'var(--accent-fg)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <IconPlus size={14} stroke={2} />
            New
          </button>
        </div>

        {/* List body */}
        <div style={{ padding: '8px' }}>
          {/* None row — always first */}
          <NoneRow
            isActive={activeId === null}
            onClick={() => handleActivate(null)}
          />

          {instructions.length === 0 ? (
            <EmptyState onNew={() => setEditTarget('new')} />
          ) : (
            instructions.map((instruction) => (
              <InstructionRow
                key={instruction.id}
                instruction={instruction}
                isActive={activeId === instruction.id}
                onActivate={() => handleActivate(instruction.id)}
                onEdit={() => setEditTarget(instruction.id)}
                onDelete={() => setDeleteTarget(instruction)}
              />
            ))
          )}
        </div>
      </div>

      {/* How it works */}
      <HowItWorksCard />

      {/* Delete confirm dialog */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Delete instruction"
        message={
          <>
            Delete{' '}
            <strong style={{ color: 'var(--text-primary)' }}>
              {deleteTarget?.name}
            </strong>
            ? This cannot be undone.
            {deleteTarget && activeId === deleteTarget.id && (
              <span style={{ display: 'block', marginTop: '6px', color: 'var(--text-muted)', fontSize: '13px' }}>
                This is your active instruction — it will be deactivated.
              </span>
            )}
          </>
        }
        confirmLabel="Delete"
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
        variant="danger"
      />
    </div>
  );
};

export default CustomInstructionsSection;
