/**
 * SidebarSection — a labelled section heading (e.g. "Pinned", "Recents").
 * Sentence-case, no uppercase, --text-muted at 12px.
 * Optional right slot for sort/filter icon.
 *
 * Optional collapse/expand (fully backward-compatible — existing callers that
 * do not pass these new props continue to work identically):
 *
 *   isCollapsible  — when true, renders a chevron and clicking the heading row
 *                    toggles the collapsed/expanded state
 *   storageKey     — localStorage key for persisting collapsed state across
 *                    reloads; when absent, state is local and non-persisted
 *   children       — when provided, rendered inside the collapsible body
 *
 * Transition is gated by Tailwind `motion-safe:` variants which map to
 * @media (prefers-reduced-motion: no-preference) — per wiki §9 rule 17.
 * When reduced motion is preferred, max-height changes instantly (no transition).
 */
import React, { useState } from 'react';
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react';

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
      {/* ── Heading row — clickable when isCollapsible ── */}
      <div
        className={`flex items-center justify-between px-[10px] pt-[18px] pb-[4px]${isCollapsible ? ' cursor-pointer' : ''}`}
        onClick={isCollapsible ? handleToggle : undefined}
        // Accessibility: treat heading as a button when collapsible
        role={isCollapsible ? 'button' : undefined}
        aria-expanded={isCollapsible ? !isCollapsed : undefined}
        aria-label={isCollapsible ? `${isCollapsed ? 'Expand' : 'Collapse'} ${label} section` : undefined}
        tabIndex={isCollapsible ? 0 : undefined}
        onKeyDown={
          isCollapsible
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleToggle();
                }
              }
            : undefined
        }
      >
        <span className="text-[12px] font-normal text-[--text-muted] leading-none select-none">
          {label}
        </span>

        <div className="flex items-center gap-1">
          {/* Right slot — stop propagation so inner buttons don't trigger toggle */}
          {rightSlot && (
            <span
              className="flex-shrink-0 text-[--text-muted]"
              onClick={(e) => isCollapsible && e.stopPropagation()}
            >
              {rightSlot}
            </span>
          )}

          {/* Chevron — only when collapsible */}
          {isCollapsible && (
            isCollapsed
              ? <IconChevronRight
                  size={14}
                  style={{ color: 'var(--text-muted)', flexShrink: 0 }}
                  aria-hidden="true"
                />
              : <IconChevronDown
                  size={14}
                  style={{ color: 'var(--text-muted)', flexShrink: 0 }}
                  aria-hidden="true"
                />
          )}
        </div>
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
