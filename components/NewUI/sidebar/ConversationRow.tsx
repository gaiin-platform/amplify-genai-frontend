/**
 * ConversationRow — a single recent-chat row in the new sidebar.
 * 32px height, truncates title at sidebar edge.
 * On hover: reveals a ⋯ button for rename/pin/delete.
 */
import React, { useState, useContext } from 'react';
import { IconDots, IconPinned, IconPinnedOff, IconTrash, IconEdit } from '@tabler/icons-react';
import HomeContext from '@/pages/api/home/home.context';
import { Conversation } from '@/types/chat';

interface ConversationRowProps {
  conversation: Conversation;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename?: () => void;
}

export const ConversationRow: React.FC<ConversationRowProps> = ({
  conversation,
  isSelected,
  onSelect,
  onDelete,
  onRename,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen((prev) => !prev);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen(false);
    onDelete();
  };

  const handleRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen(false);
    onRename?.();
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); setIsMenuOpen(false); }}
    >
      <button
        onClick={onSelect}
        title={conversation.name}
        className={`
          w-full flex items-center gap-[8px] h-[32px] pl-[10px] pr-[8px] rounded-[8px] text-left
          transition-colors duration-100
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--text-secondary]
          ${
            isSelected
              ? 'bg-[--bg-active] text-[--text-primary]'
              : 'text-[--text-secondary] hover:bg-[--bg-hover] hover:text-[--text-primary]'
          }
        `}
      >
        <span className="flex-1 text-[14px] font-normal leading-[20px] overflow-hidden whitespace-nowrap">
          {conversation.name || 'New Conversation'}
        </span>
      </button>

      {/* Hover action: ⋯ menu button with gradient fade */}
      {(isHovered || isMenuOpen) && (
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
            onClick={handleMenuClick}
            className={`
              relative z-10 w-6 h-6 flex items-center justify-center rounded-[6px]
              text-[--text-muted] hover:text-[--text-primary] hover:bg-[--bg-raised]
              transition-colors duration-100
            `}
            title="More options"
          >
            <IconDots size={14} />
          </button>
        </div>
      )}

      {/* Dropdown menu */}
      {isMenuOpen && (
        <div
          className={`
            absolute right-[6px] top-[calc(100%+4px)] z-50 min-w-[160px]
            bg-[--bg-raised] border border-[--border-subtle]
            rounded-[--radius-panel] shadow-[0_8px_24px_rgba(0,0,0,0.3)]
            py-[6px]
          `}
          onClick={(e) => e.stopPropagation()}
        >
          {onRename && (
            <button
              onClick={handleRename}
              className="w-full flex items-center gap-2 px-3 h-[34px] text-[14px] text-[--text-secondary] hover:bg-[--bg-hover] hover:text-[--text-primary] transition-colors"
            >
              <IconEdit size={14} />
              Rename
            </button>
          )}
          <button
            onClick={handleDelete}
            className="w-full flex items-center gap-2 px-3 h-[34px] text-[14px] text-[--text-secondary] hover:bg-[--bg-hover] hover:text-[--text-primary] transition-colors"
          >
            <IconTrash size={14} />
            Delete
          </button>
        </div>
      )}
    </div>
  );
};

export default ConversationRow;
