/**
 * SidebarSection — a labelled section heading (e.g. "Pinned", "Recents").
 * Sentence-case, no uppercase, --text-muted at 12px.
 * Optional right slot for sort/filter icons, kept right-aligned.
 *
 * Optional collapse/expand (fully backward-compatible — existing callers that
 * do not pass these new props continue to work identically):
 *
 *   isCollapsible  — when true, the label and the chevron immediately after it
 *                    form one button that toggles the collapsed/expanded state.
 *                    The chevron rotates: down = expanded, right = collapsed.
 *   storageKey     — localStorage key for persisting collapsed state across
 *                    reloads; when absent, state is local and non-persisted
 *   children       — when provided, rendered inside the collapsible body
 *
 * Transition is gated by Tailwind `motion-safe:` variants which map to
 * @media (prefers-reduced-motion: no-preference) — per wiki §9 rule 17.
 * When reduced motion is preferred, max-height changes instantly (no transition).
 */
import React, { useState } from 'react';
import { IconChevronDown } from '@tabler/icons-react';

interface SidebarSectionProps {
  label: string;
  rightSlot?: React.ReactNode;
  className?: string;
  /**
   * When true, a chevron icon is shown at the right of the heading row.
   * Clicking anywhere on the heading toggles collapsed/expanded.
   */
  isCollapsible?: boolean;
  /**
   * localStorage key for persisting collapsed state across reloads.
   * `"true"` = collapsed, anything else = expanded (default).
   * Only meaningful when isCollapsible is true.
   */
  storageKey?: string;
  /** Content rendered inside the collapsible body. */
  children?: React.ReactNode;
}

export const SidebarSection: React.FC<SidebarSectionProps> = ({
  label,
  rightSlot,
  className = '',
  isCollapsible = false,
  storageKey,
  children,
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (!isCollapsible || typeof window === 'undefined') return false;
    if (storageKey) {
      return localStorage.getItem(storageKey) === 'true';
    }
    return false;
  });

  const handleToggle = () => {
    if (!isCollapsible) return;
    const next = !isCollapsed;
    setIsCollapsed(next);
    if (storageKey && typeof window !== 'undefined') {
      localStorage.setItem(storageKey, String(next));
    }
  };

  return (
    <div className={className}>
      {/* ── Heading row — label + chevron toggle on the left, icons on the right ── */}
      <div className="flex items-center justify-between px-[10px] pt-[18px] pb-[4px]">
        {isCollapsible ? (
          <button
            type="button"
            onClick={handleToggle}
            aria-expanded={!isCollapsed}
            aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${label} section`}
            className="flex items-center gap-1 min-w-0 rounded-[4px] text-[--text-muted] hover:text-[--text-primary] transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--text-secondary]"
          >
            <span className="text-[12px] font-normal leading-none select-none truncate">
              {label}
            </span>
            <IconChevronDown
              size={14}
              aria-hidden="true"
              className="flex-shrink-0 motion-safe:transition-transform motion-safe:duration-150"
              style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
            />
          </button>
        ) : (
          <span className="text-[12px] font-normal text-[--text-muted] leading-none select-none truncate">
            {label}
          </span>
        )}

        {/* Right slot — icon buttons, always right-aligned */}
        {rightSlot && (
          <div className="flex items-center gap-1 flex-shrink-0 text-[--text-muted]">
            {rightSlot}
          </div>
        )}
      </div>

      {/* ── Collapsible body — only rendered when children are provided ──
          max-height transition is gated by motion-safe: (prefers-reduced-motion: no-preference).
          max-height: 2000px covers any realistic sidebar section content height
          while keeping the transition snappy (200ms ease-out). */}
      {children !== undefined && (
        <div
          className="overflow-hidden motion-safe:transition-[max-height] motion-safe:duration-200 motion-safe:ease-out"
          style={{ maxHeight: isCollapsed ? '0px' : '2000px' }}
        >
          {children}
        </div>
      )}
    </div>
  );
};

export default SidebarSection;
