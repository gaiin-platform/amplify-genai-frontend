/**
 * SegmentedControl — reusable segmented/tab control.
 * Used in the sidebar (Home/Code) and composer (Chat/Cowork).
 * The active thumb slides via translateX transition.
 *
 * Props:
 *   items     — array of { id, label, icon? }
 *   value     — current active id
 *   onChange  — callback with new id
 *   size      — 'sm' (34px, sidebar) | 'xs' (28px, composer)
 */
import React from 'react';

export interface SegmentItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface SegmentedControlProps {
  items: SegmentItem[];
  value: string;
  onChange: (id: string) => void;
  size?: 'sm' | 'xs';
  className?: string;
}

export const SegmentedControl: React.FC<SegmentedControlProps> = ({
  items,
  value,
  onChange,
  size = 'sm',
  className = '',
}) => {
  const activeIndex = items.findIndex((i) => i.id === value);
  const trackH = size === 'sm' ? 'h-[34px]' : 'h-[28px]';
  const labelSize = size === 'sm' ? 'text-[13px]' : 'text-[12px]';

  return (
    <div
      role="tablist"
      className={`relative flex w-full ${trackH} rounded-[10px] border border-[--border-subtle] bg-[--bg-sidebar] p-[3px] ${className}`}
    >
      {/* Sliding thumb */}
      <div
        className="absolute top-[3px] h-[calc(100%-6px)] rounded-[8px] bg-[--bg-active] transition-transform duration-150 ease-out"
        style={{
          width: `calc(${100 / items.length}% - 6px / ${items.length})`,
          transform: `translateX(calc(${activeIndex} * (100% + ${6 / items.length}px)))`,
          left: '3px',
        }}
        aria-hidden="true"
      />
      {items.map((item) => (
        <button
          key={item.id}
          role="tab"
          aria-selected={item.id === value}
          onClick={() => onChange(item.id)}
          className={`
            relative z-10 flex flex-1 items-center justify-center gap-1
            ${labelSize} font-medium
            transition-colors duration-100
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--text-secondary] focus-visible:ring-offset-1
            ${item.id === value ? 'text-[--text-primary]' : 'text-[--text-secondary] hover:text-[--text-primary]'}
          `}
        >
          {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
          {item.label}
        </button>
      ))}
    </div>
  );
};

export default SegmentedControl;
