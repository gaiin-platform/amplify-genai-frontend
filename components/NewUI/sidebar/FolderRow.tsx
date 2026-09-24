/**
 * FolderRow — a collapsible chat folder in the new sidebar.
 *
 * Header row: caret, folder icon, name (or inline rename input), chat count.
 * Hover reveals rename/delete icon buttons (mirrors ConversationRow's hover
 * pattern, but as plain icons rather than a dropdown — a folder row only has
 * two actions, so a menu would be overkill).
 *
 * Deleting a chat folder deletes the chats inside it too (existing backend
 * behavior in handleDeleteFolder — this component just makes that explicit
 * in the confirm dialog rather than surprising the user).
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  IconChevronRight,
  IconChevronDown,
  IconFolder,
  IconPencil,
  IconTrash,
  IconPin,
  IconPinnedOff,
  IconPinFilled,
} from '@tabler/icons-react';
import { Conversation } from '@/types/chat';
import { FolderInterface } from '@/types/folder';
import { ConfirmDialog } from '@/components/NewUI/shared/ConfirmDialog';
import { ConversationRow } from './ConversationRow';

interface FolderRowProps {
  folder: FolderInterface;
  conversations: Conversation[];
  isOpen: boolean;
  onToggle: () => void;
  selectedConversationId?: string;
  onSelectConversation: (c: Conversation) => void;
  onDeleteConversation: (c: Conversation) => void;
  onRenameFolder: (folderId: string, name: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onPinFolder: (folderId: string) => void;
  /** Opens straight into rename mode — used right after creating a new folder. */
  startInRename?: boolean;
  /**
   * ID of the conversation that is currently generating a response, if any.
   * Passed through to ConversationRow so the spinner appears on the right row.
   */
  generatingConversationId?: string;
}

export const FolderRow: React.FC<FolderRowProps> = ({
  folder,
  conversations,
  isOpen,
  onToggle,
  selectedConversationId,
  onSelectConversation,
  onDeleteConversation,
  onRenameFolder,
  onDeleteFolder,
  onPinFolder,
  startInRename,
  generatingConversationId,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isRenaming, setIsRenaming] = useState(!!startInRename);
  const [renameValue, setRenameValue] = useState(startInRename ? folder.name : '');
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);

  const startRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRenameValue(folder.name);
    setIsRenaming(true);
  };

  const commitRename = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== folder.name) onRenameFolder(folder.id, trimmed);
    setIsRenaming(false);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
    if (e.key === 'Escape') { e.preventDefault(); setIsRenaming(false); }
  };

  return (
    <div>
      <div
        className={`relative rounded-[8px] ${isHovered ? 'bg-[--bg-hover]' : ''}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {isRenaming ? (
          <div className="flex items-center gap-[8px] h-[32px] pl-[10px] pr-[10px]">
            <IconFolder size={15} className="flex-shrink-0 text-[--text-muted]" />
            <input
              ref={renameInputRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={handleRenameKeyDown}
              onBlur={commitRename}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 min-w-0 h-[24px] text-[14px] text-[--text-primary] bg-transparent outline-none border-b border-[--accent]"
              spellCheck={false}
            />
          </div>
        ) : (
          <button
            onClick={onToggle}
            title={isOpen ? 'Collapse folder' : 'Expand folder'}
            className={`
              w-full flex items-center gap-[8px] h-[32px] pl-[6px] rounded-[8px] text-left
              ${isHovered ? 'pr-[82px]' : 'pr-[8px]'}
              text-[--text-secondary] hover:text-[--text-primary]
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--text-secondary]
            `}
          >
            {isOpen
              ? <IconChevronDown size={13} className="flex-shrink-0" />
              : <IconChevronRight size={13} className="flex-shrink-0" />}
            <IconFolder size={15} className="flex-shrink-0" />
            <span className="flex-1 min-w-0 text-[14px] font-normal leading-[20px] truncate">
              {folder.name}
            </span>
            {folder.pinned && !isHovered && (
              <IconPinFilled size={12} className="flex-shrink-0 text-[--accent]" />
            )}
            <span className="flex-shrink-0 text-[12px] text-[--text-muted]">
              {conversations.length}
            </span>
          </button>
        )}

        {!isRenaming && isHovered && (
          <div className="absolute right-[4px] top-0 h-full flex items-center gap-[2px]">
            <button
              onClick={(e) => { e.stopPropagation(); onPinFolder(folder.id); }}
              title={folder.pinned ? 'Unpin folder' : 'Pin folder'}
              aria-label={folder.pinned ? 'Unpin folder' : 'Pin folder'}
              className="w-6 h-6 flex items-center justify-center rounded-[6px] text-[--text-muted] hover:text-[--text-primary] hover:bg-[--bg-active] transition-colors"
            >
              {folder.pinned ? <IconPinnedOff size={13} /> : <IconPin size={13} />}
            </button>
            <button
              onClick={startRename}
              title="Rename folder"
              aria-label="Rename folder"
              className="w-6 h-6 flex items-center justify-center rounded-[6px] text-[--text-muted] hover:text-[--text-primary] hover:bg-[--bg-active] transition-colors"
            >
              <IconPencil size={13} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmDeleteOpen(true); }}
              title="Delete folder"
              aria-label="Delete folder"
              className="w-6 h-6 flex items-center justify-center rounded-[6px] text-[--text-muted] hover:text-red-400 hover:bg-[--bg-active] transition-colors"
            >
              <IconTrash size={13} />
            </button>
          </div>
        )}
      </div>

      {isOpen && conversations.length > 0 && (
        <div className="flex flex-col gap-[2px] pl-[20px]">
          {conversations.map((c) => (
            <ConversationRow
              key={c.id}
              conversation={c}
              isSelected={selectedConversationId === c.id}
              isGenerating={generatingConversationId === c.id}
              onSelect={() => onSelectConversation(c)}
              onDelete={() => onDeleteConversation(c)}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDeleteOpen}
        title="Delete folder"
        message={
          conversations.length > 0 ? (
            <>
              Delete <strong style={{ color: 'var(--text-primary)' }}>{folder.name}</strong>? This
              will also delete the {conversations.length} chat{conversations.length === 1 ? '' : 's'}{' '}
              inside it. This cannot be undone.
            </>
          ) : (
            <>
              Delete <strong style={{ color: 'var(--text-primary)' }}>{folder.name}</strong>? This
              cannot be undone.
            </>
          )
        }
        confirmLabel="Delete"
        onConfirm={() => { setConfirmDeleteOpen(false); onDeleteFolder(folder.id); }}
        onCancel={() => setConfirmDeleteOpen(false)}
        variant="danger"
      />
    </div>
  );
};

export default FolderRow;
