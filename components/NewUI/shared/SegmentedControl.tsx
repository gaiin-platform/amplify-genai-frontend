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
  /** Accessible label for the tablist. Defaults to the item labels joined. */
  'aria-label'?: string;
}

/** The track's inner padding on every side (matches `p-[3px]` and the thumb's `top-[3px]`). */
export const TRACK_PADDING_PX = 3;

/**
 * Size and position of the sliding highlight.
 *
 * The thumb is absolutely positioned inside the track's padding box (width W) starting at
 * `TRACK_PADDING_PX`, and the segments share the content box (W − 2·padding) equally. So each
 * segment — and the thumb — is `(W − 2·padding) / n` wide, and moving one segment over is
 * exactly one thumb width: `translateX(index · 100%)`. (An extra per-step offset makes the
 * highlight drift toward the right edge: "All" ends up inset 3px, the last segment ~0px.)
 */
export function segmentThumbStyle(count: number, index: number): { width: string; transform: string; opacity?: number } {
  const n = Math.max(1, count);
  return {
    width: `calc((100% - ${TRACK_PADDING_PX * 2}px) / ${n})`,
    transform: `translateX(${Math.max(0, index) * 100}%)`,
    // No matching segment: show no highlight rather than parking it on the first one.
    ...(index < 0 ? { opacity: 0 } : null),
  };
}

export const SegmentedControl: React.FC<SegmentedControlProps> = ({
  items,
  value,
  onChange,
  size = 'sm',
  className = '',
  'aria-label': ariaLabel,
}) => {
  const activeIndex = items.findIndex((i) => i.id === value);
  const trackH = size === 'sm' ? 'h-[34px]' : 'h-[28px]';
  const labelSize = size === 'sm' ? 'text-[13px]' : 'text-[12px]';
  const defaultLabel = items.map((i) => i.label).join(' / ');

  return (
    <div
      role="tablist"
      aria-label={ariaLabel ?? defaultLabel}
      className={`relative flex w-full ${trackH} rounded-[10px] border border-[--border-subtle] bg-[--bg-sidebar] p-[3px] ${className}`}
    >
      {/* Sliding thumb */}
      <div
        className="absolute top-[3px] h-[calc(100%-6px)] rounded-[8px] bg-[--bg-active] transition-transform duration-150 ease-out"
        style={{ ...segmentThumbStyle(items.length, activeIndex), left: `${TRACK_PADDING_PX}px` }}
        aria-hidden="true"
      />
      {items.map((item) => (
        <button
          key={item.id}
          // Without this a segment inside a <form> is a submit button, so
          // switching tabs would submit the form.
          type="button"
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
