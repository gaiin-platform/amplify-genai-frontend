/**
 * Badge — small pill label, e.g. "Labs" or "New".
 */
import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ children, className = '' }) => (
  <span
    className={`
      inline-flex items-center gap-0.5 rounded px-[6px] py-[2px]
      text-[11px] font-medium leading-none
      bg-[--bg-active] text-[--text-muted]
      ${className}
    `}
  >
    {children}
  </span>
);

export default Badge;
