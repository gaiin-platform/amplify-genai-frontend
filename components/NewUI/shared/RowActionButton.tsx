/**
 * RowActionButton — the 28×28 square icon button revealed on hover at the end of
 * a list row (Edit / Share / Duplicate / Delete …).
 *
 * Distinct from `IconButton`, which is a round chrome button: this one is a
 * rounded square with the `--bg-active` hover used by the row action clusters.
 * Always pass `aria-label` (an icon-only button needs an accessible name);
 * `title` defaults to it so sighted users get the same text as a tooltip.
 */
import React from 'react';

interface RowActionButtonProps {
    'aria-label': string;
    onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
    children: React.ReactNode;
    /** Tooltip; defaults to the aria-label. */
    title?: string;
    /** Destructive action — hover tints the icon with `--text-error`. */
    danger?: boolean;
    disabled?: boolean;
}

export const RowActionButton: React.FC<RowActionButtonProps> = ({
    'aria-label': ariaLabel,
    onClick,
    children,
    title,
    danger = false,
    disabled,
}) => (
    <button
        type="button"
        aria-label={ariaLabel}
        title={title ?? ariaLabel}
        onClick={onClick}
        disabled={disabled}
        className={`flex items-center justify-center h-[28px] w-[28px] rounded-[6px] flex-shrink-0 text-[--text-muted] hover:bg-[--bg-active] transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent] ${
            danger ? 'hover:text-[--text-error]' : 'hover:text-[--text-primary]'
        }`}
    >
        {children}
    </button>
);

export default RowActionButton;
