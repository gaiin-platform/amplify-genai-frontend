/**
 * Colour coding for the layered-assistant tree, shared by the outline and the map so a level looks the
 * same in both. Colour is a *second* cue: parents vs assistants are also told apart by icon/shape, and
 * the selected row by its ring, so nothing depends on hue alone.
 *
 * The four hues are the old builder's (purple → blue → green → rose), darkened just enough to carry a
 * white icon at AA contrast on both themes, and cycle past depth 3. Tints use `color-mix` so they sit
 * correctly on either the light or the dark surface.
 *
 * No React imports.
 */

export const DEPTH_COLORS = ['#7c3aed', '#2563eb', '#047857', '#e11d48'] as const;

export const SELECTED_COLOR = '#f59e0b';

export const depthColor = (depth: number): string =>
    DEPTH_COLORS[((depth % DEPTH_COLORS.length) + DEPTH_COLORS.length) % DEPTH_COLORS.length];

/** `color` at `percent`% over a transparent background. */
export const tint = (color: string, percent: number): string =>
    `color-mix(in srgb, ${color} ${percent}%, transparent)`;
