/**
 * SidebarSection — a labelled section heading (e.g. "Pinned", "Recents").
 * Sentence-case, no uppercase, --text-muted at 12px.
 * Optional right slot for sort/filter icon.
 */
import React from 'react';

interface SidebarSectionProps {
  label: string;
  rightSlot?: React.ReactNode;
  className?: string;
}

export const SidebarSection: React.FC<SidebarSectionProps> = ({
  label,
  rightSlot,
  className = '',
}) => (
  <div
    className={`flex items-center justify-between px-[10px] pt-[18px] pb-[4px] ${className}`}
  >
    <span className="text-[12px] font-normal text-[--text-muted] leading-none select-none">
      {label}
    </span>
    {rightSlot && (
      <span className="flex-shrink-0 text-[--text-muted] opacity-0 group-hover:opacity-100 transition-opacity">
        {rightSlot}
      </span>
    )}
  </div>
);

export default SidebarSection;
