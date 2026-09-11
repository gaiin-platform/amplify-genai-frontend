/**
 * SidebarHeader — top row of the new sidebar.
 * Height 48px: [amplify-logo.png Amplify wordmark] [collapse button] [search button]
 */
import React from 'react';
import Image from 'next/image';
import { IconLayoutSidebarLeftCollapse, IconSearch } from '@tabler/icons-react';
import { IconButton } from '@/components/NewUI/shared/IconButton';

interface SidebarHeaderProps {
  onCollapse: () => void;
  onSearch?: () => void;
  onLogoClick?: () => void;
}

export const SidebarHeader: React.FC<SidebarHeaderProps> = ({
  onCollapse,
  onSearch,
  onLogoClick,
}) => {
  return (
    <div className="flex items-center justify-between h-[48px] px-[14px] flex-shrink-0">
      {/* Wordmark */}
      <button
        onClick={onLogoClick}
        className="flex items-center gap-2 select-none rounded-[6px] px-1 -mx-1 hover:bg-[--bg-hover] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]"
        aria-label="New chat"
        title="New chat"
        type="button"
      >
        <Image src="/amplify-logo.png" alt="Amplify" width={24} height={24} style={{ borderRadius: 4 }} />
        <span
          className="text-[20px] text-[--text-primary] tracking-[-0.01em]"
          style={{ fontFamily: '"Newsreader", "Georgia", serif', fontWeight: 400 }}
        >
          Amplify
        </span>
      </button>

      {/* Right actions */}
      <div className="flex items-center gap-1">
        {onSearch && (
          <IconButton onClick={onSearch} title="Search (⌘K)" aria-label="Search conversations">
            <IconSearch size={16} />
          </IconButton>
        )}
        <IconButton onClick={onCollapse} title="Collapse sidebar" aria-label="Collapse sidebar">
          <IconLayoutSidebarLeftCollapse size={16} />
        </IconButton>
      </div>
    </div>
  );
};

export default SidebarHeader;
