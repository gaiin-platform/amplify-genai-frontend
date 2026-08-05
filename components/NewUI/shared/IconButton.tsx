/**
 * IconButton — 28×28 round icon button used in the new sidebar header.
 * Shows a circular hover background and supports tooltip via title.
 */
import React from 'react';

interface IconButtonProps {
  onClick?: () => void;
  title?: string;
  className?: string;
  children: React.ReactNode;
  /** Make it a larger 32×32 button */
  size?: 'sm' | 'md';
  active?: boolean;
}

export const IconButton: React.FC<IconButtonProps> = ({
  onClick,
  title,
  className = '',
  children,
  size = 'sm',
  active = false,
}) => {
  const dim = size === 'md' ? 'w-8 h-8' : 'w-7 h-7';
  return (
    <button
      onClick={onClick}
      title={title}
      className={`
        ${dim} flex items-center justify-center rounded-full flex-shrink-0
        text-[--text-muted] hover:text-[--text-primary]
        hover:bg-[--bg-hover]
        transition-colors duration-100
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--text-secondary] focus-visible:ring-offset-2
        ${active ? 'text-[--text-primary] bg-[--bg-active]' : ''}
        ${className}
      `}
    >
      {children}
    </button>
  );
};

export default IconButton;
