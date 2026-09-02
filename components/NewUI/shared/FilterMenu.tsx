/**
 * FilterMenu — toolbar filter button + popover of radio groups.
 *
 * Purely presentational: the caller owns the selected values and decides what the
 * options mean. Every group is a single-select (radio) group, so native
 * `<input type="radio">` gives us arrow-key navigation and `aria-checked` for free.
 *
 * A group whose value differs from `defaults[group.id]` counts as "active" — the
 * count drives the badge on the trigger and enables "Clear all".
 *
 * Props:
 *   groups   — [{ id, label, options: [{ id, label }] }]
 *   value    — groupId -> optionId (controlled)
 *   defaults — groupId -> optionId, the "no filter" state
 *   onChange — called with the complete next value map
 *   label    — trigger text (default 'Filter')
 *   align    — popover edge alignment (default 'right')
 */
import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { IconFilter } from '@tabler/icons-react';

export interface FilterOption {
    id: string;
    label: string;
}

export interface FilterGroupSpec {
    id: string;
    label: string;
    options: FilterOption[];
}

interface FilterMenuProps {
    groups: FilterGroupSpec[];
    value: Record<string, string>;
    defaults: Record<string, string>;
    onChange: (next: Record<string, string>) => void;
    label?: string;
    align?: 'left' | 'right';
    className?: string;
}

export const FilterMenu: React.FC<FilterMenuProps> = ({
    groups,
    value,
    defaults,
    onChange,
    label = 'Filter',
    align = 'right',
    className = '',
}) => {
    const [open, setOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const uid = useId();

    const activeCount = groups.reduce((n, g) => {
        const current = value[g.id] ?? defaults[g.id];
        return current !== defaults[g.id] ? n + 1 : n;
    }, 0);

    const close = useCallback((restoreFocus = true) => {
        setOpen(false);
        if (restoreFocus) triggerRef.current?.focus();
    }, []);

    // Close on outside pointer-down and on Escape
    useEffect(() => {
        if (!open) return;

        const onPointerDown = (e: MouseEvent) => {
            if (
                !panelRef.current?.contains(e.target as Node) &&
                !triggerRef.current?.contains(e.target as Node)
            ) {
                close(false);
            }
        };
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                close();
            }
        };

        document.addEventListener('mousedown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('mousedown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [open, close]);

    // Move focus into the panel when it opens
    useEffect(() => {
        if (!open) return;
        const t = setTimeout(() => {
            const first = panelRef.current?.querySelector<HTMLInputElement>(
                'input[type="radio"]:checked, input[type="radio"]'
            );
            first?.focus();
        }, 0);
        return () => clearTimeout(t);
    }, [open]);

    if (groups.length === 0) return null;

    const select = (groupId: string, optionId: string) => {
        onChange({ ...value, [groupId]: optionId });
    };

    return (
        <div className={`relative ${className}`}>
            <button
                ref={triggerRef}
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-haspopup="true"
                aria-expanded={open}
                aria-label={
                    activeCount > 0
                        ? `${label} — ${activeCount} active. Open filter options`
                        : `Open ${label.toLowerCase()} options`
                }
                className={`
          flex items-center gap-1.5 h-[34px] px-3 rounded-[8px] text-[13px]
          bg-[--bg-raised] border text-[--text-secondary]
          hover:bg-[--bg-hover] hover:text-[--text-primary]
          transition-colors
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--text-secondary]
        `}
                style={{
                    borderColor: activeCount > 0 ? 'var(--accent)' : 'var(--border-subtle)',
                    color: activeCount > 0 ? 'var(--text-primary)' : undefined,
                }}
            >
                <IconFilter size={14} />
                {label}
                {activeCount > 0 && (
                    <span
                        className="ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[11px] font-semibold"
                        style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
                    >
                        {activeCount}
                    </span>
                )}
            </button>

            {open && (
                <div
                    ref={panelRef}
                    role="dialog"
                    aria-label={`${label} options`}
                    className={`
            absolute top-[calc(100%+6px)] z-40 w-[240px] p-3
            rounded-[10px] border shadow-lg
            origin-top motion-safe:animate-[fadeIn_120ms_ease-out]
            ${align === 'right' ? 'right-0' : 'left-0'}
          `}
                    style={{
                        backgroundColor: 'var(--bg-raised)',
                        borderColor: 'var(--border-subtle)',
                    }}
                >
                    {groups.map((group, gi) => (
                        <div
                            key={group.id}
                            role="radiogroup"
                            aria-label={group.label}
                            className={gi > 0 ? 'mt-3 pt-3 border-t' : ''}
                            style={gi > 0 ? { borderColor: 'var(--border-subtle)' } : undefined}
                        >
                            <p
                                className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider"
                                style={{ color: 'var(--text-muted)' }}
                            >
                                {group.label}
                            </p>
                            {group.options.map((option) => {
                                const checked = (value[group.id] ?? defaults[group.id]) === option.id;
                                return (
                                    <label
                                        key={option.id}
                                        className="flex items-center gap-2 px-1.5 py-1 rounded-[6px] cursor-pointer transition-colors"
                                        style={{ color: 'var(--text-secondary)' }}
                                        onMouseEnter={(e) => {
                                            (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)';
                                        }}
                                        onMouseLeave={(e) => {
                                            (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                                        }}
                                    >
                                        <input
                                            type="radio"
                                            name={`${uid}-${group.id}`}
                                            value={option.id}
                                            checked={checked}
                                            onChange={() => select(group.id, option.id)}
                                            className="h-[13px] w-[13px] cursor-pointer"
                                            style={{ accentColor: 'var(--accent)' }}
                                        />
                                        <span className="text-[13px]">{option.label}</span>
                                    </label>
                                );
                            })}
                        </div>
                    ))}

                    <div
                        className="mt-3 pt-2.5 border-t flex justify-end"
                        style={{ borderColor: 'var(--border-subtle)' }}
                    >
                        <button
                            type="button"
                            onClick={() => onChange({ ...defaults })}
                            disabled={activeCount === 0}
                            className="text-[12px] font-medium px-2 py-1 rounded-[6px] transition-opacity disabled:opacity-40 disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--text-secondary]"
                            style={{ color: 'var(--accent)' }}
                        >
                            Clear all
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FilterMenu;
