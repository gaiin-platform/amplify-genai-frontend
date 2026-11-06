/**
 * Shared geometry for the New-UI composer card (new-chat screen and the
 * open-conversation dock). Keep these in one place so both inputs stay in sync.
 */

/**
 * The single inset for everything inside the composer card: top, left and right
 * padding. The attachment cards, the text line and the toolbar's ⊕ button all
 * start this far from the card's inner border edge, so they share one left edge.
 */
export const COMPOSER_INSET = 16; // px

/** Bottom padding — smaller than the inset because the toolbar buttons carry their own box. */
export const COMPOSER_INSET_BOTTOM = 12; // px

const COMPOSER_BORDER = 1; // px per side
/** Height of one editor line: text-[16px] leading-[1.5]. */
export const EDITOR_LINE_PX = 24;
/** Lines of editing room kept when the card is squeezed by a short window. */
export const EDITOR_FLOOR_LINES = 3;
/** Toolbar row (34/36px) plus its top margin (12/10px). */
const TOOLBAR_BLOCK_PX = 46;

/** Card chrome + toolbar: everything in the card except the rail and the text area. */
export const COMPOSER_CHROME_PX =
  2 * COMPOSER_BORDER + COMPOSER_INSET + COMPOSER_INSET_BOTTOM + TOOLBAR_BLOCK_PX;

/**
 * The editor's squeeze floor: up to EDITOR_FLOOR_LINES lines, but never more
 * than the text actually occupies. An empty/one-line editor therefore has no
 * floor above its own height — it adds no empty space between the text and the
 * controls row — while a long draft still keeps ~3 lines visible.
 */
export function editorFloorHeight(editorNaturalPx: number): number {
  return Math.min(Math.max(editorNaturalPx, EDITOR_LINE_PX), EDITOR_FLOOR_LINES * EDITOR_LINE_PX);
}

/**
 * Minimum card height while attachments are shown: chrome + the full-height
 * attachment row + the editor floor + toolbar, so the parts can never be
 * squeezed into overlapping (the pane scrolls instead).
 */
export function composerCardMinHeight(railPx: number, editorNaturalPx: number): number {
  return COMPOSER_CHROME_PX + railPx + editorFloorHeight(editorNaturalPx);
}
