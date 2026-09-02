/**
 * SortableHeader — a column header that doubles as a sort toggle.
 *
 * Used by list views that sort client-side (Library, Chats). The caller owns the
 * sort state; this component only renders the label plus a direction affordance:
 *   active column   → chevron, rotated 180° when ascending
 *   inactive column → dimmed up/down selector icon
 *
 * Props:
 *   label      — visible column label (also used in the aria-label)
 *   sortKey    — the key this header sorts by
 *   activeKey  — the currently active sort key
 *   direction  — current direction of the active sort
 *   onSort     — called with sortKey on click (caller decides toggle semantics)
 */
import React from 'react';
import { IconChevronDown, IconSelector } from '@tabler/icons-react';

interface SortableHeaderProps<K extends string = string> {
    label: string;
    sortKey: K;
    activeKey: K;
    direction: 'asc' | 'desc';
    onSort: (key: K) => void;
    className?: string;
}

export function SortableHeader<K extends string = string>({
    label,
    sortKey,
    activeKey,
    direction,
    onSort,
    className = '',
}: SortableHeaderProps<K>) {
    const isActive = activeKey === sortKey;

    return (
        <button
            type="button"
            onClick={() => onSort(sortKey)}
            className={`inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider transition-colors hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--text-secondary] rounded-[4px] ${className}`}
            style={{ color: isActive ? 'var(--text-secondary)' : 'var(--text-muted)' }}
            aria-label={
                `Sort by ${label}` +
                (isActive
                    ? `, currently ${direction === 'asc' ? 'ascending' : 'descending'}`
                    : '')
            }
        >
            {label}
            {isActive ? (
                <IconChevronDown
                    size={12}
                    className="transition-transform duration-150 motion-reduce:transition-none"
                    style={{ transform: direction === 'asc' ? 'rotate(180deg)' : undefined }}
                />
            ) : (
                <IconSelector size={12} className="opacity-50" />
            )}
        </button>
    );
}

export default SortableHeader;
