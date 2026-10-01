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
} from '@tabler/icons-react';

import { ConfirmDialog } from '@/components/NewUI/shared/ConfirmDialog';
import { InfoTooltip } from '@/components/NewUI/shared/InfoTooltip';
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

    </div>
  );
};

// ---------------------------------------------------------------------------
// Instruction Row
// ---------------------------------------------------------------------------

interface InstructionRowProps {
  instruction: CustomInstruction | null;
  isActive: boolean;
  onActivate: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

const InstructionRow: React.FC<InstructionRowProps> = ({
  instruction,
  isActive,
  onActivate,
  onEdit,
  onDelete,
}) => {
  const [hovered, setHovered] = useState(false);
  const isNone = instruction === null;
  const optionName = instruction?.name ?? 'None';
  const description = instruction?.content ?? 'No custom instructions applied';
  const inputId = `custom-instruction-${instruction?.id ?? 'none'}`;

  return (
    <div
      className="group flex items-center gap-3 rounded-[var(--radius-row)] border px-3 py-2.5 transition-colors duration-100"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderColor: isActive ? 'var(--accent)' : 'transparent',
        background: hovered
          ? (isActive
            ? 'color-mix(in srgb, var(--accent) 14%, var(--bg-hover))'
            : 'var(--bg-hover)')
          : (isActive
            ? 'color-mix(in srgb, var(--accent) 8%, var(--bg-raised))'
            : 'transparent'),
        transition: 'background 0.12s, border-color 0.12s',
      }}
    >
      <label
        htmlFor={inputId}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-[6px] focus-within:outline-none"
      >
        <input
          id={inputId}
          type="radio"
          name="custom-instruction-active"
          value={instruction?.id ?? ''}
          checked={isActive}
          onChange={onActivate}
          className="h-4 w-4 shrink-0 cursor-pointer appearance-none rounded-full border-[1.5px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent] focus-visible:ring-offset-2"
          style={{
            borderColor: isActive ? 'var(--accent)' : 'var(--text-secondary)',
            background: isActive
              ? 'radial-gradient(circle, var(--accent-fg) 0 30%, var(--accent) 34% 100%)'
              : 'var(--bg-raised)',
            boxSizing: 'border-box',
          }}
          aria-describedby={`${inputId}-description`}
        />

        <span className="min-w-0 flex-1">
          <span
            className="flex min-w-0 items-center gap-2"
            style={{
              fontSize: '14px',
              fontWeight: isActive ? 600 : (isNone ? 400 : 500),
              color: isNone ? 'var(--text-secondary)' : 'var(--text-primary)',
            }}
          >
            <span className="truncate">{optionName}</span>
            {isActive && (
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
              >
                Active
              </span>
            )}
          </span>
          <span
            id={`${inputId}-description`}
            className="mt-0.5 block text-[12px] leading-[1.45]"
            style={{
              color: 'var(--text-muted)',
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 2,
              overflow: 'hidden',
            }}
          >
            {description}
          </span>
        </span>
      </label>

      {instruction && (
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          {onEdit && (
            <ActionButton onClick={onEdit} label="Edit" title="Edit">
              <IconPencil size={15} stroke={1.5} />
            </ActionButton>
          )}
          {onDelete && (
            <ActionButton onClick={onDelete} label="Delete" title="Delete" danger>
              <IconTrash size={15} stroke={1.5} />
            </ActionButton>
          )}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Tiny action button (hover/focus icon buttons inside a row)
// ---------------------------------------------------------------------------

interface ActionButtonProps {
  onClick: () => void;
  label: string;
  title?: string;
  danger?: boolean;
  children: React.ReactNode;
}

const ActionButton: React.FC<ActionButtonProps> = ({ onClick, label, title, danger, children }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    title={title ?? label}
    className="flex h-7 w-7 items-center justify-center rounded-[6px] border-0 bg-transparent p-0 transition-colors hover:bg-[--bg-raised] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent] focus-visible:ring-offset-1"
    style={{ color: danger ? 'var(--text-error)' : 'var(--text-muted)' }}
  >
    {children}
  </button>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Custom Instructions
              </h3>
              <InfoTooltip
                ariaLabel="About custom instructions"
                maxWidth={320}
                text="The active instruction is added to the system prompt for new standard conversations, helping tailor responses to your preferences. Template and assistant conversations use their own prompts; the active instruction is not automatically added to them. Select None to turn off the active instruction."
              />
            </div>
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
        <div>
          <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-2">
            <legend className="sr-only">Active custom instruction — choose one</legend>
            <InstructionRow
              instruction={null}
              isActive={activeId === null}
              onActivate={() => handleActivate(null)}
            />

            {instructions.map((instruction) => (
              <InstructionRow
                key={instruction.id}
                instruction={instruction}
                isActive={activeId === instruction.id}
                onActivate={() => handleActivate(instruction.id)}
                onEdit={() => setEditTarget(instruction.id)}
                onDelete={() => setDeleteTarget(instruction)}
              />
            ))}
          </fieldset>

          {instructions.length === 0 && (
            <EmptyState onNew={() => setEditTarget('new')} />
          )}
        </div>
      </div>

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
