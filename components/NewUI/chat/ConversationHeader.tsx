/**
 * ConversationHeader — spec §3 compliant 52px sticky header for the conversation view.
 *
 * Left:  conversation title as menu trigger (rename, share, delete) + assistant chip
 * Right: Share button (filled, --bg-active)
 *
 * Rendered by ConversationViewShell as an overlay on top of Chat.tsx's own header
 * (which is hidden via CSS). Zero Chat.tsx logic changes.
 */
import React, { useContext, useEffect, useRef, useState } from 'react';
import {
  IconChevronDown,
  IconPencil,
  IconShare,
  IconTrash,
  IconSparkles,
} from '@tabler/icons-react';
import HomeContext from '@/pages/api/home/home.context';
import { DEFAULT_ASSISTANT } from '@/types/assistant';
import { ConfirmDialog } from '@/components/NewUI/shared/ConfirmDialog';

export const ConversationHeader: React.FC = () => {
  const {
    state: { selectedConversation, selectedAssistant, lightMode },
    handleUpdateConversation,
  } = useContext(HomeContext);

  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const title = selectedConversation?.name ?? 'New Conversation';
  const hasAssistant =
    selectedAssistant && selectedAssistant.id !== DEFAULT_ASSISTANT.id;
  const assistantName = hasAssistant ? selectedAssistant.definition?.name : null;

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        !menuRef.current?.contains(e.target as Node) &&
        !triggerRef.current?.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  // Focus rename input on open
  useEffect(() => {
    if (renaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renaming]);

  const handleRenameCommit = () => {
    if (selectedConversation && renameValue.trim()) {
      handleUpdateConversation(selectedConversation, {
        key: 'name',
        value: renameValue.trim(),
      });
    }
    setRenaming(false);
    setMenuOpen(false);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleRenameCommit();
    if (e.key === 'Escape') {
      setRenaming(false);
      setMenuOpen(false);
    }
  };

  const handleDelete = () => {
    setMenuOpen(false);
    // Show confirmation before dispatching the irreversible delete event
    setConfirmDeleteOpen(true);
  };

  const confirmDelete = () => {
    setConfirmDeleteOpen(false);
    // Dispatch the existing clear/delete event that Chat.tsx listens to
    window.dispatchEvent(new Event('deleteConversation'));
  };

  const handleShare = () => {
    setMenuOpen(false);
    // Trigger the existing Share dialog in Chat.tsx
    const shareBtn = document.getElementById('shareChatUpper') as HTMLButtonElement | null;
    shareBtn?.click();
  };

  // Menu item style
  const menuItemCls =
    'w-full flex items-center gap-2.5 px-3 h-[34px] text-[14px] rounded-[8px] ' +
    'text-[--text-secondary] hover:bg-[--bg-hover] hover:text-[--text-primary] transition-colors text-left';

  return (
    <div
      className="new-ui-header"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 52,
        zIndex: 30,
        background: 'var(--bg-app)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px 0 24px',
        pointerEvents: 'auto',
      }}
    >
      {/* ── Left: title trigger ── */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {renaming ? (
          <input
            ref={renameInputRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={handleRenameKeyDown}
            onBlur={handleRenameCommit}
            className="text-[15px] font-[500] bg-transparent border-b border-[--border-subtle] outline-none text-[--text-primary] max-w-[40ch]"
            style={{ lineHeight: 1.4 }}
          />
        ) : (
          <button
            ref={triggerRef}
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-1 rounded-[8px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[--text-secondary]"
            style={{
              padding: '3px 8px',
              margin: '0 -8px',
              background: menuOpen ? 'var(--bg-hover)' : 'transparent',
              maxWidth: '40ch',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
            onMouseLeave={(e) => {
              if (!menuOpen) (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
          >
            <span
              className="text-[15px] font-[500] text-[--text-primary] truncate"
              style={{ maxWidth: '40ch' }}
              title={title}
            >
              {title}
            </span>
            <IconChevronDown
              size={14}
              className="flex-shrink-0 transition-transform duration-150"
              style={{
                color: 'var(--text-muted)',
                transform: menuOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              }}
            />
          </button>
        )}

        {/* Assistant chip */}
        {hasAssistant && assistantName && (
          <div
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] text-[12px] flex-shrink-0"
            style={{
              background: 'var(--bg-raised)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <IconSparkles size={13} style={{ color: 'var(--accent)' }} />
            <span className="truncate max-w-[20ch]">{assistantName}</span>
          </div>
        )}
      </div>

      {/* ── Right: Share button (spec §9: label only, no icon) ── */}
      <div className="flex items-center gap-2.5 flex-shrink-0">
        <button
          type="button"
          onClick={handleShare}
          className="flex items-center justify-center rounded-[8px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[--text-secondary]"
          style={{
            height: 30,
            padding: '0 14px',
            background: 'var(--bg-active)',
            fontSize: '13.5px',
            fontWeight: 500,
            color: 'var(--text-primary)',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#45443F'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-active)'; }}
        >
          Share
        </button>
      </div>

      {/* ── Title dropdown menu ── */}
      {menuOpen && !renaming && (
        <div
          ref={menuRef}
          role="menu"
          className="absolute top-[calc(100%+4px)] left-6 w-[240px] rounded-[12px] py-[6px] shadow-[0_12px_32px_rgba(0,0,0,0.4)] border border-[--border-subtle] z-50"
          style={{ background: 'var(--bg-raised)' }}
        >
          <button
            role="menuitem"
            className={menuItemCls}
            onClick={() => {
              setRenameValue(title);
              setRenaming(true);
              setMenuOpen(false);
            }}
          >
            <IconPencil size={15} />
            Rename
          </button>
          <button
            role="menuitem"
            className={menuItemCls}
            onClick={handleShare}
          >
            <IconShare size={15} />
            Share
          </button>
          <div className="h-px bg-[--border-subtle] mx-2 my-1" />
          <button
            role="menuitem"
            className={`${menuItemCls} text-red-400 hover:text-red-300`}
            onClick={handleDelete}
          >
            <IconTrash size={15} />
            Delete
          </button>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        isOpen={confirmDeleteOpen}
        title="Delete conversation?"
        message={
          <>
            Are you sure you want to delete{' '}
            <strong style={{ color: 'var(--text-primary)' }}>
              {title}
            </strong>
            ? This cannot be undone.
          </>
        }
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </div>
  );
};

export default ConversationHeader;
