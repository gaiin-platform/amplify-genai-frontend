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
  IconFolder,
  IconFolderPlus,
  IconFolderMinus,
  IconChevronLeft,
} from '@tabler/icons-react';
import HomeContext from '@/pages/api/home/home.context';
import { Conversation } from '@/types/chat';
import { ConfirmDialog } from '@/components/NewUI/shared/ConfirmDialog';
import { NewUIShareModal } from '@/components/NewUI/chat/NewUIShareModal';
import { PINNED_TAG } from '@/components/NewUI/shared/chatFilters';
import { getUserChatFolders } from '@/components/NewUI/shared/chatFolderHelpers';

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
  const [showShareModal, setShowShareModal] = useState(false);

  // ── Inline rename state ─────────────────────────────────────────────────────
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  // ── Move-to-folder submenu state ────────────────────────────────────────────
  const [menuView, setMenuView] = useState<'main' | 'move'>('main');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const newFolderInputRef = useRef<HTMLInputElement>(null);

  // Position for the portalled fixed menu — captured from the dots button on open
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);

  // Estimated menu height:
  // py-[6px]=12 + 4×h-[34px]=136 + divider≈9 + delete h-[34px]=34 = ~191px
  const MENU_ESTIMATED_HEIGHT = 200;
  const MENU_MIN_WIDTH = 200;

  const dotsButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const {
    handleUpdateConversation,
    handleCreateFolder,
    state: { conversations, folders },
    dispatch,
  } = useContext(HomeContext);

  const userChatFolders = getUserChatFolders(folders);

  // Pin state: primary check is the __pinned__ tag (survives remoteForConversationHistory
  // for cloud conversations). Legacy data.pinned / top-level cast kept for backwards compat.
  // TODO: add `pinned?: boolean` to Conversation type in types/chat.ts
  const isPinned =
    !!conversation.tags?.includes(PINNED_TAG) ||
    !!(conversation.data?.pinned) ||
    !!(conversation as any).pinned;

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
      closeMenu();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isMenuOpen]);

  // ── Close menu on Escape ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isMenuOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeMenu();
        dotsButtonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isMenuOpen]);

  // ── Close menu on scroll ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isMenuOpen) return;
    const handler = () => closeMenu();
    window.addEventListener('scroll', handler, true);
    return () => window.removeEventListener('scroll', handler, true);
  }, [isMenuOpen]);

  // ── Open / toggle menu ──────────────────────────────────────────────────────
  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMenuOpen) { closeMenu(); return; }
    if (dotsButtonRef.current) {
      const rect = dotsButtonRef.current.getBoundingClientRect();
      const GAP = 4;
      const SCREEN_PADDING = 8;

      // ── Vertical: prefer below; flip above if not enough room ──────────────
      const spaceBelow = window.innerHeight - rect.bottom - GAP;
      let top: number;
      if (spaceBelow >= MENU_ESTIMATED_HEIGHT) {
        top = rect.bottom + GAP;
      } else {
        // Open upward; clamp so it never disappears above the top edge either
        top = Math.max(SCREEN_PADDING, rect.top - MENU_ESTIMATED_HEIGHT - GAP);
      }

      // ── Horizontal: keep the right edge within the viewport ────────────────
      // `right` is CSS right offset (distance from viewport's right edge).
      // Clamp so the left edge (= innerWidth − right − minWidth) stays ≥ 8px.
      const rawRight = window.innerWidth - rect.right;
      const right = Math.min(rawRight, window.innerWidth - MENU_MIN_WIDTH - SCREEN_PADDING);

      setMenuPos({ top, right: Math.max(0, right) });
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
    // Store pin state as a tag rather than in conversation.data, because
    // remoteForConversationHistory() strips the data field for cloud-stored
    // conversations — meaning a data.pinned write is immediately discarded when
    // handleUpdateConversation dispatches the updated conversations array.
    // The `tags` field IS preserved by remoteForConversationHistory, so toggling
    // PINNED_TAG here survives the dispatch and the sidebar re-renders correctly.
    const currentTags = (conversation.tags ?? []).filter((t: string) => t !== PINNED_TAG);
    const newTags = isPinned ? currentTags : [...currentTags, PINNED_TAG];

    // Optimistic update: immediately reflect the new tags in the conversations
    // list so the sidebar re-renders without waiting for the async server fetch
    // inside handleUpdateConversation.
    const optimisticConversations = conversations.map((c) =>
      c.id === conversation.id ? { ...c, tags: newTags } : c
    );
    dispatch({ field: 'conversations', value: optimisticConversations });

    // Still call handleUpdateConversation to persist the change server-side.
    handleUpdateConversation(conversation, { key: 'tags', value: newTags });
  };

  // ── Share ───────────────────────────────────────────────────────────────────
  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Close the three-dot menu first (wiki §9 rule 20 — one modal at a time),
    // then open the new-UI share modal.
    setIsMenuOpen(false);
    setShowShareModal(true);
  };

  // ── Move to folder ──────────────────────────────────────────────────────────
  const closeMenu = () => {
    setIsMenuOpen(false);
    setMenuView('main');
    setIsCreatingFolder(false);
    setNewFolderName('');
  };

  const openMoveView = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuView('move');
  };

  const assignFolder = (folderId: string | null) => {
    handleUpdateConversation(conversation, { key: 'folderId', value: folderId });
    closeMenu();
  };

  useEffect(() => {
    if (isCreatingFolder && newFolderInputRef.current) newFolderInputRef.current.focus();
  }, [isCreatingFolder]);

  const commitNewFolder = () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) { setIsCreatingFolder(false); return; }
    const folder = handleCreateFolder(trimmed, 'chat');
    assignFolder(folder.id);
  };

  const handleNewFolderKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); commitNewFolder(); }
    if (e.key === 'Escape') { e.preventDefault(); setIsCreatingFolder(false); setNewFolderName(''); }
  };

  const menuItemCls =
    'w-full flex items-center gap-2 px-3 h-[34px] text-[14px] ' +
    'text-[--text-secondary] hover:bg-[--bg-hover] hover:text-[--text-primary] transition-colors';

  // ── Portalled dropdown ──────────────────────────────────────────────────────
  const dropdown =
    isMenuOpen && menuPos ? (
      <div
        ref={menuRef}
        style={{ position: 'fixed', top: menuPos.top, right: menuPos.right, zIndex: 9999, minWidth: MENU_MIN_WIDTH }}
        className="bg-[--bg-raised] border border-[--border-subtle] rounded-[--radius-panel] shadow-[0_8px_24px_rgba(0,0,0,0.3)] py-[6px] max-h-[280px] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {menuView === 'main' ? (
          <>
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

            {/* Move to folder */}
            <button onClick={openMoveView} className={menuItemCls}>
              <IconFolder size={14} />
              Move to folder
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
          </>
        ) : (
          <>
            {/* Back to main menu */}
            <button onClick={() => setMenuView('main')} className={menuItemCls}>
              <IconChevronLeft size={14} />
              Move to folder
            </button>

            <div className="h-px bg-[--border-subtle] mx-2 my-1" />

            {/* Remove from current folder */}
            {conversation.folderId && (
              <button onClick={() => assignFolder(null)} className={menuItemCls}>
                <IconFolderMinus size={14} />
                No folder
              </button>
            )}

            {/* Existing folders */}
            {userChatFolders.map((f) => (
              <button
                key={f.id}
                onClick={() => assignFolder(f.id)}
                className={menuItemCls}
                disabled={conversation.folderId === f.id}
              >
                <IconFolder size={14} />
                <span className="flex-1 min-w-0 truncate text-left">{f.name}</span>
                {conversation.folderId === f.id && <span className="text-[11px] text-[--text-muted]">Current</span>}
              </button>
            ))}

            {/* New folder */}
            {isCreatingFolder ? (
              <div className="flex items-center gap-2 px-3 h-[34px]">
                <IconFolderPlus size={14} className="flex-shrink-0 text-[--text-muted]" />
                <input
                  ref={newFolderInputRef}
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={handleNewFolderKeyDown}
                  onBlur={commitNewFolder}
                  placeholder="Folder name"
                  className="flex-1 min-w-0 h-[24px] text-[14px] text-[--text-primary] bg-transparent outline-none border-b border-[--accent]"
                  spellCheck={false}
                />
              </div>
            ) : (
              <button onClick={() => setIsCreatingFolder(true)} className={menuItemCls}>
                <IconFolderPlus size={14} />
                New folder
              </button>
            )}
          </>
        )}
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
          : isMenuOpen || isRenaming || isHovered
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
            w-full flex items-center gap-[8px] h-[32px] pl-[10px] rounded-[8px] text-left
            ${isHovered || isMenuOpen ? 'pr-[34px]' : 'pr-[8px]'}
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--text-secondary]
            ${isSelected || isHovered || isMenuOpen ? 'text-[--text-primary]' : 'text-[--text-secondary]'}
          `}
        >
          {/* min-w-0 is required: without it a flex-1 item cannot shrink below its
              content width, so overflow/truncate never fires. truncate = overflow-hidden
              + whitespace-nowrap + text-overflow:ellipsis (all three must be co-located). */}
          <span className="flex-1 min-w-0 text-[14px] font-normal leading-[20px] truncate">
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

      {/* Share modal — portalled to document.body so it sits above the sidebar */}
      {showShareModal && typeof document !== 'undefined'
        ? ReactDOM.createPortal(
            <NewUIShareModal
              conversationId={conversation.id}
              conversationTitle={conversation.name}
              onClose={() => setShowShareModal(false)}
            />,
            document.body
          )
        : null}
    </div>
  );
};

export default ConversationRow;
