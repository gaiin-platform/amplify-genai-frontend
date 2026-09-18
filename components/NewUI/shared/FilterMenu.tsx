/**
 * FilterMenu — filter trigger + popover of radio groups.
 *
 * Purely presentational: the caller owns the selected values and decides what the
 * options mean. Every group is a single-select (radio) group, so native
 * `<input type="radio">` gives us arrow-key navigation and `aria-checked` for free.
 *
 * A group whose value differs from `defaults[group.id]` counts as "active" — the
 * count drives the badge (toolbar variant) or dot (icon variant) on the trigger,
 * and enables "Clear all".
 *
 * The panel is portalled to <body> and positioned from the trigger's bounding
 * rect, so it is never clipped by a scrolling/overflow-hidden ancestor (the
 * sidebar Recents list is both).
 *
 * Props:
 *   groups   — [{ id, label, options: [{ id, label }] }]
 *   value    — groupId -> optionId (controlled)
 *   defaults — groupId -> optionId, the "no filter" state
 *   onChange — called with the complete next value map
 *   variant  — 'toolbar' (labelled 34px button) | 'icon' (28px ghost icon button)
 *   icon     — trigger glyph for the icon variant
 *   align    — which trigger edge the panel lines up with (default 'right')
 */
import React, {
    useCallback,
    useEffect,
    useId,
    useLayoutEffect,
    useRef,
    useState,
} from 'react';
import ReactDOM from 'react-dom';
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
    variant?: 'toolbar' | 'icon';
    icon?: React.ReactNode;
    align?: 'left' | 'right';
    className?: string;
}

const PANEL_WIDTH = 240;
const VIEWPORT_MARGIN = 8;

// useLayoutEffect logs a warning when a component is server-rendered; positioning
// only ever matters in the browser, so fall back to useEffect on the server.
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export const FilterMenu: React.FC<FilterMenuProps> = ({
    groups,
    value,
    defaults,
    onChange,
    label = 'Filter',
    variant = 'toolbar',
    icon,
    align = 'right',
    className = '',
}) => {
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
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

    // Position the portalled panel from the trigger rect, clamped to the viewport.
    const updatePosition = useCallback(() => {
        const rect = triggerRef.current?.getBoundingClientRect();
        if (!rect) return;

        const left = Math.max(
            VIEWPORT_MARGIN,
            Math.min(
                align === 'right' ? rect.right - PANEL_WIDTH : rect.left,
                window.innerWidth - PANEL_WIDTH - VIEWPORT_MARGIN
            )
        );

        const panelHeight = panelRef.current?.offsetHeight ?? 0;
        let top = rect.bottom + 6;
        if (panelHeight > 0 && top + panelHeight > window.innerHeight - VIEWPORT_MARGIN) {
            // Prefer flipping above the trigger; fall back to clamping.
            const above = rect.top - 6 - panelHeight;
            top = above >= VIEWPORT_MARGIN
                ? above
                : Math.max(VIEWPORT_MARGIN, window.innerHeight - panelHeight - VIEWPORT_MARGIN);
        }

        setPos({ top, left });
    }, [align]);

    useIsomorphicLayoutEffect(() => {
        if (open) updatePosition();
    }, [open, updatePosition, groups]);

    // Keep the panel anchored while the page/sidebar scrolls or the window resizes
    useEffect(() => {
        if (!open) return;
        const onReflow = () => updatePosition();
        window.addEventListener('resize', onReflow);
        window.addEventListener('scroll', onReflow, true);
        return () => {
            window.removeEventListener('resize', onReflow);
            window.removeEventListener('scroll', onReflow, true);
        };
    }, [open, updatePosition]);

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

    const triggerAriaLabel =
        activeCount > 0
            ? `${label} — ${activeCount} active. Open filter options`
            : `Open ${label.toLowerCase()} options`;

    const panel = (
        <div
            ref={panelRef}
            role="dialog"
            aria-label={`${label} options`}
            className="fixed z-[60] p-3 rounded-[10px] border shadow-lg overflow-y-auto origin-top motion-safe:animate-[fadeIn_120ms_ease-out]"
            style={{
                top: pos?.top ?? -9999,
                left: pos?.left ?? -9999,
                width: PANEL_WIDTH,
                maxHeight: `calc(100vh - ${VIEWPORT_MARGIN * 2}px)`,
                backgroundColor: 'var(--bg-raised)',
                borderColor: 'var(--border-subtle)',
                visibility: pos ? 'visible' : 'hidden',
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
    );

    return (
        <>
            {variant === 'icon' ? (
                <button
                    ref={triggerRef}
                    type="button"
                    onClick={() => setOpen((o) => !o)}
                    title={label}
                    aria-haspopup="true"
                    aria-expanded={open}
                    aria-label={triggerAriaLabel}
                    className={`
            relative w-7 h-7 flex items-center justify-center rounded-full flex-shrink-0
            hover:bg-[--bg-hover] transition-colors duration-100
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--text-secondary] focus-visible:ring-offset-2
            ${activeCount > 0 ? 'text-[--accent]' : 'text-[--text-muted] hover:text-[--text-primary]'}
            ${className}
          `}
                >
                    {icon ?? <IconFilter size={13} />}
                    {activeCount > 0 && (
                        <span
                            aria-hidden="true"
                            className="absolute top-[3px] right-[3px] w-[5px] h-[5px] rounded-full"
                            style={{ backgroundColor: 'var(--accent)' }}
                        />
                    )}
                </button>
            ) : (
                <button
                    ref={triggerRef}
                    type="button"
                    onClick={() => setOpen((o) => !o)}
                    aria-haspopup="true"
                    aria-expanded={open}
                    aria-label={triggerAriaLabel}
                    className={`
            flex items-center gap-1.5 h-[34px] px-3 rounded-[8px] text-[13px]
            bg-[--bg-raised] border text-[--text-secondary]
            hover:bg-[--bg-hover] hover:text-[--text-primary]
            transition-colors
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--text-secondary]
            ${className}
          `}
                    style={{
                        borderColor: activeCount > 0 ? 'var(--accent)' : 'var(--border-subtle)',
                        color: activeCount > 0 ? 'var(--text-primary)' : undefined,
                    }}
                >
                    {icon ?? <IconFilter size={14} />}
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
            )}

            {open && typeof document !== 'undefined'
                ? ReactDOM.createPortal(panel, document.body)
                : null}
        </>
    );
};

export default FilterMenu;
