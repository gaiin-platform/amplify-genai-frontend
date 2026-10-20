/**
 * Button class strings for the API Access section. Tokens only (light + dark), a visible
 * keyboard-focus ring, and a disabled state — so every button in the section matches.
 */
const base =
  'inline-flex items-center justify-center gap-1.5 h-[34px] px-3.5 rounded-[8px] text-[13px] font-medium whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent] disabled:opacity-50 disabled:pointer-events-none';

export const btnPrimary = `${base} bg-[--accent] text-[--accent-fg] hover:opacity-90`;
export const btnSecondary = `${base} border border-[--border-subtle] bg-[--bg-app] text-[--text-primary] hover:bg-[--bg-hover]`;
export const btnGhostDanger = `${base} text-[--text-error] hover:bg-[--bg-hover]`;
