/**
 * ConversationRow — a single recent-chat row in the new sidebar.
 * 32px height, truncates title at sidebar edge.
 * On hover: reveals a ⋯ button for rename/pin/share/delete.
 *
 * Three-dot menu (top → bottom):
 *   Rename    — inline input replaces the row title; Enter/blur commits, Escape cancels
 *   Pin/Unpin — toggles conversation.data.pinned via handleUpdateConversation
 *               TODO: add `pinned?: boolean` to the canonical Conversation type
 *   Share     — clicks #shareChatUpper (same mechanism as ConversationHeader.tsx)
 *   Delete    — shows ConfirmDialog before calling onDelete (destructive, red, below divider)
 *
 * Dropdown is rendered via ReactDOM.createPortal into document.body at position:fixed,
 * so it is never clipped by overflow:hidden ancestors (SidebarSection collapse body,
 * sidebar scroll container). Dismisses on click-outside or Escape (not mouse-leave),
 * which prevents the menu from closing while the pointer moves toward menu items.
 *
 * Row background lives on the outer div (not the button) so CSS :hover covers the full
 * row area including the absolutely-positioned dots overlay — no React-timing flash.
 */
import React, { useState, useContext, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import {
  IconDots,
  IconPin,
  IconPinnedOff,
  IconShare,
  IconTrash,
  IconEdit,
} from '@tabler/icons-react';
import HomeContext from '@/pages/api/home/home.context';
import { Conversation } from '@/types/chat';
import { ConfirmDialog } from '@/components/NewUI/shared/ConfirmDialog';

interface ConversationRowProps {
  conversation: Conversation;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  /** Optional legacy callback — inline rename is now self-contained. */
  onRename?: () => void;
}

export const ConversationRow: React.FC<ConversationRowProps> = ({
  conversation,
  isSelected,
  onSelect,
  onDelete,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  // ── Inline rename state ─────────────────────────────────────────────────────
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Position for the portalled fixed menu — captured from the dots button on open
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);

  const dotsButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const { handleUpdateConversation } = useContext(HomeContext);

  // Pin state: check both data.pinned (new storage) and top-level cast (legacy)
  // TODO: add `pinned?: boolean` to Conversation type in types/chat.ts
  const isPinned = !!(conversation.data?.pinned) || !!(conversation as any).pinned;

  // ── Focus + select all when rename input appears ────────────────────────────
  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);

  // ── Close menu on click outside ─────────────────────────────────────────────
  useEffect(() => {
    if (!isMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current?.contains(e.target as Node) ||
        dotsButtonRef.current?.contains(e.target as Node)
      ) return;
      setIsMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isMenuOpen]);

  // ── Close menu on Escape ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isMenuOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMenuOpen(false);
        dotsButtonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isMenuOpen]);

  // ── Close menu on scroll ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isMenuOpen) return;
    const handler = () => setIsMenuOpen(false);
    window.addEventListener('scroll', handler, true);
    return () => window.removeEventListener('scroll', handler, true);
  }, [isMenuOpen]);

  // ── Open / toggle menu ──────────────────────────────────────────────────────
  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMenuOpen) { setIsMenuOpen(false); return; }
    if (dotsButtonRef.current) {
      const rect = dotsButtonRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setIsMenuOpen(true);
  };

  // ── Rename ──────────────────────────────────────────────────────────────────
  const startRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen(false);
    setRenameValue(conversation.name || '');
    setIsRenaming(true);
  };

  const commitRename = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== conversation.name) {
      handleUpdateConversation(conversation, { key: 'name', value: trimmed });
    }
    setIsRenaming(false);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
    if (e.key === 'Escape') { e.preventDefault(); setIsRenaming(false); }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen(false);
    setConfirmDeleteOpen(true);
  };

  // ── Pin ─────────────────────────────────────────────────────────────────────
  const handlePin = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen(false);
    // Store in conversation.data.pinned (the existing untyped bag).
    // TODO: once `pinned?: boolean` is added to the Conversation type, use
    //   handleUpdateConversation(conversation, { key: 'pinned', value: !isPinned })
    handleUpdateConversation(conversation, {
      key: 'data',
      value: { ...conversation.data, pinned: !isPinned },
    });
  };

  // ── Share ───────────────────────────────────────────────────────────────────
  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen(false);
    // Select this conversation first (in case it is not currently open),
    // then click the share button that Chat.tsx renders — identical mechanism
    // to ConversationHeader.tsx handleShare.
    onSelect();
    setTimeout(() => {
      const shareBtn = document.getElementById('shareChatUpper') as HTMLButtonElement | null;
      shareBtn?.click();
    }, 50);
  };

  const menuItemCls =
    'w-full flex items-center gap-2 px-3 h-[34px] text-[14px] ' +
    'text-[--text-secondary] hover:bg-[--bg-hover] hover:text-[--text-primary] transition-colors';

  // ── Portalled dropdown ──────────────────────────────────────────────────────
  const dropdown =
    isMenuOpen && menuPos ? (
      <div
        ref={menuRef}
        style={{ position: 'fixed', top: menuPos.top, right: menuPos.right, zIndex: 9999, minWidth: 160 }}
        className="bg-[--bg-raised] border border-[--border-subtle] rounded-[--radius-panel] shadow-[0_8px_24px_rgba(0,0,0,0.3)] py-[6px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Rename */}
        <button onClick={startRename} className={menuItemCls}>
          <IconEdit size={14} />
          Rename
        </button>

        {/* Pin / Unpin */}
        <button onClick={handlePin} className={menuItemCls}>
          {isPinned ? <IconPinnedOff size={14} /> : <IconPin size={14} />}
          {isPinned ? 'Unpin' : 'Pin'}
        </button>

        {/* Share */}
        <button onClick={handleShare} className={menuItemCls}>
          <IconShare size={14} />
          Share
        </button>

        {/* Divider before destructive action */}
        <div className="h-px bg-[--border-subtle] mx-2 my-1" />

        {/* Delete */}
        <button
          onClick={handleDelete}
          className="w-full flex items-center gap-2 px-3 h-[34px] text-[14px] text-red-400 hover:bg-[--bg-hover] hover:text-red-300 transition-colors"
        >
          <IconTrash size={14} />
          Delete
        </button>
      </div>
    ) : null;

  return (
    <div
      // Background lives on the outer div so CSS :hover fires for the full row area
      // (including the absolutely-positioned dots overlay), eliminating the React
      // timing gap that caused the gradient-first flash.
      // isMenuOpen / isRenaming keep the highlight when the pointer has left the row.
      className={`
        relative rounded-[8px]
        ${isSelected
          ? 'bg-[--bg-active]'
          : isMenuOpen || isRenaming
            ? 'bg-[--bg-hover]'
            : 'hover:bg-[--bg-hover]'
        }
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* ── Inline rename input (replaces the row button while active) ── */}
      {isRenaming ? (
        <input
          ref={renameInputRef}
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={handleRenameKeyDown}
          onBlur={commitRename}
          onClick={(e) => e.stopPropagation()}
          className="w-full h-[32px] pl-[10px] pr-[10px] text-[14px] font-normal leading-[20px] text-[--text-primary] bg-transparent rounded-[8px] outline-none border border-[--accent]"
          spellCheck={false}
        />
      ) : (
        <button
          onClick={onSelect}
          title={conversation.name}
          className={`
            w-full flex items-center gap-[8px] h-[32px] pl-[10px] pr-[8px] rounded-[8px] text-left
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--text-secondary]
            ${isSelected || isHovered || isMenuOpen ? 'text-[--text-primary]' : 'text-[--text-secondary]'}
          `}
        >
          <span className="flex-1 text-[14px] font-normal leading-[20px] overflow-hidden whitespace-nowrap">
            {conversation.name || 'New Conversation'}
          </span>
        </button>
      )}

      {/* ── Hover action: ⋯ menu button with gradient fade — hidden while renaming ── */}
      {!isRenaming && (isHovered || isMenuOpen) && (
        <div
          className={`
            absolute right-0 top-0 h-full flex items-center pr-[6px]
            before:content-[''] before:absolute before:right-full before:top-0 before:h-full before:w-[32px]
            before:bg-gradient-to-r
            ${isSelected
              ? 'before:from-transparent before:to-[--bg-active]'
              : 'before:from-transparent before:to-[--bg-hover]'
            }
          `}
        >
          <button
            ref={dotsButtonRef}
            onClick={handleMenuClick}
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
            className="relative z-10 w-6 h-6 flex items-center justify-center rounded-[6px] text-[--text-muted] hover:text-[--text-primary] transition-colors duration-100"
            title="More options"
          >
            <IconDots size={14} />
          </button>
        </div>
      )}

      {/* Portalled dropdown */}
      {isMenuOpen && typeof document !== 'undefined'
        ? ReactDOM.createPortal(dropdown, document.body)
        : null}

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        isOpen={confirmDeleteOpen}
        title="Delete conversation?"
        message={
          <>
            Are you sure you want to delete{' '}
            <strong style={{ color: 'var(--text-primary)' }}>
              {conversation.name || 'this conversation'}
            </strong>
            ? This cannot be undone.
          </>
        }
        confirmLabel="Delete"
        onConfirm={() => { setConfirmDeleteOpen(false); onDelete(); }}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </div>
  );
};

export default ConversationRow;
