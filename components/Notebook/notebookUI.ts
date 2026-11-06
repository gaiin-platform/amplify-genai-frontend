/**
 * Shared token-based className constants for components/Notebook/*.
 *
 * Replaces the button/badge/card class strings that used to be redefined
 * (with drift) in nearly every Notebook file — hardcoded gray/purple Tailwind
 * utilities and hex literals like #2b2c36. These use the New UI design
 * tokens from styles/globals.css instead (--bg-raised, --text-*, --accent,
 * --border-subtle, --radius-*), which are defined globally so they apply
 * here the same way they do under components/NewUI/.
 *
 * No React import — mirrors the React-free vocabulary modules under
 * components/NewUI/shared/ (see docs/NEW_UI_GUIDE.md §4).
 */

export const cardClass =
    'flex flex-col gap-6 rounded-[--radius-panel] border border-[--border-subtle] bg-[--bg-raised] py-6 shadow-sm';

// Recipe copied exactly from NewAssistantsView's "+ New Assistant" button
// (components/NewUI/views/NewAssistantsView.tsx) — h-[34px], rounded-[8px],
// text-[13px], no shadow, transition-opacity/hover:opacity-90, same --accent
// CSS variable. Notebook's primary buttons must render pixel-identical to it.
export const primaryButtonClass =
    'inline-flex h-[34px] items-center justify-center gap-1.5 rounded-[8px] bg-[--accent] px-4 text-[13px] font-medium text-[--accent-fg] transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-50';

export const primaryButtonSmClass =
    'inline-flex h-8 items-center justify-center gap-1.5 rounded-[8px] bg-[--accent] px-3 text-[13px] font-medium text-[--accent-fg] transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-50';

export const outlineButtonClass =
    'inline-flex h-[34px] items-center justify-center gap-1.5 rounded-[8px] border border-[--border-subtle] bg-transparent px-4 text-[13px] font-medium text-[--text-primary] transition-colors hover:bg-[--bg-hover] disabled:pointer-events-none disabled:opacity-50';

export const outlineSmButtonClass =
    'inline-flex h-8 items-center justify-center gap-1.5 rounded-[8px] border border-[--border-subtle] bg-transparent px-3 text-[13px] font-medium text-[--text-primary] transition-colors hover:bg-[--bg-hover] disabled:pointer-events-none disabled:opacity-50';

export const secondaryBadgeClass =
    'inline-flex items-center rounded-[--radius-row] bg-[--bg-active] px-2 py-0.5 text-xs font-medium text-[--text-muted]';

export const outlineBadgeClass =
    'inline-flex items-center rounded-[--radius-row] border border-[--border-subtle] px-2 py-0.5 text-xs font-medium text-[--text-secondary]';
