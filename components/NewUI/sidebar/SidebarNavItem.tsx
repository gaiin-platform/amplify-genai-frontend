/**
 * SidebarNavItem — a single nav row in the new unified sidebar.
 * States: rest, hover, active, focused.
 * Uses <Link> semantics but fires onClick for in-app routing.
 */
import React from 'react';

interface SidebarNavItemProps {
  icon: React.ReactNode;
  label: string;
  isActive?: boolean;
  onClick: () => void;
  /** Right-side badge or extra content */
  rightSlot?: React.ReactNode;
}

export const SidebarNavItem: React.FC<SidebarNavItemProps> = ({
  icon,
  label,
  isActive = false,
  onClick,
  rightSlot,
}) => {
  return (
    <button
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
      className={`
        group w-full flex items-center gap-[10px] rounded-[8px]
        h-[36px] px-[10px] text-left
        transition-colors duration-100
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--text-secondary] focus-visible:ring-offset-2
        ${
          isActive
            ? 'bg-[--bg-active] text-[--text-primary]'
            : 'text-[--text-secondary] hover:bg-[--bg-hover] hover:text-[--text-primary]'
        }
      `}
    >
      <span
        className={`flex-shrink-0 flex items-center transition-opacity ${
          isActive ? 'opacity-100' : 'opacity-75 group-hover:opacity-100'
        }`}
      >
        {icon}
      </span>
      <span className="flex-1 truncate text-[14px] font-normal leading-[20px]">
        {label}
      </span>
      {rightSlot && <span className="flex-shrink-0">{rightSlot}</span>}
    </button>
  );
};

export default SidebarNavItem;
