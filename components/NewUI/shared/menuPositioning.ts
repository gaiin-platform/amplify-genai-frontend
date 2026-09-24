/**
 * menuPositioning — shared Floating UI configuration for NESTED menu panels
 * (level-2 / level-3 submenus) in the new UI.
 *
 * WHY THIS EXISTS
 * Submenus used to be positioned with `position: absolute; top: <measured>;
 * left: calc(100% + 6px)`. That is not viewport-aware: on a narrow window, or
 * when the composer sits near the right edge, the submenu ran off-screen and
 * got clipped with no fallback. Floating UI's flip/shift solve it properly.
 *
 * THE STACK
 *   placement:  'right-start'         — default: open to the right of the row
 *   offset(4)                         — small gap from the trigger row
 *   flip({ crossAxis: false, fallbackPlacements: [...] })
 *       flip() alone only tries the OPPOSITE placement on the main axis, so the
 *       explicit fallback list is what gives us full edge coverage:
 *         left-start   → no room right, open to the left of the trigger
 *         bottom-start → no room either side, drop below the trigger row
 *         top-start    → no room below, rise above it
 *
 *       `crossAxis: false` IS LOAD-BEARING FOR TALL PANELS. With flip's default
 *       `crossAxis: true`, the alignment-side overflows (top/bottom for a
 *       right/left placement) are folded into the "does this placement fit?"
 *       test. A tall panel anchored near the bottom of the window therefore
 *       "fails" at right-start, AND at left-start, AND at every fallback —
 *       because all of them overflow the bottom edge. flip then falls through to
 *       its tie-break, which sorts by cross-axis overflow / total overflow and
 *       happily returns a placement that is clipped HORIZONTALLY, since a large
 *       vertical overflow dominates the comparison.
 *
 *       That is exactly why "More models" (up to 420px tall) used to get cut off
 *       while "Effort" (~230px, fits vertically) always flipped correctly — the
 *       short panel only ever had the left/right question to answer.
 *
 *       With `crossAxis: false`, flip answers ONLY "which side?" and leaves the
 *       vertical fit to shift(), which is the middleware built for it.
 *   shift({ padding: 8 })             — slides along the alignment axis (y, for a
 *                                       right/left placement) to keep the panel
 *                                       fully on screen, 8px viewport inset
 *
 * WHY `strategy: 'absolute'` (the Floating UI default) AND NOT `'fixed'`
 * Submenu panels stay DOM children of the primary floating panel. That is load-
 * bearing: `useDismiss` decides "outside press" by DOM containment, so panels
 * rendered inside the primary panel keep the menu open when clicked. The Skills
 * submenu's checkbox rows depend on this (they toggle without closing the menu).
 * Portalling them out would make every checkbox click dismiss the whole menu.
 * The primary panel is `position: fixed`, so it is the offsetParent and absolute
 * positioning resolves against it — while flip/shift still measure the viewport.
 *
 * NOTE: this changes positioning MECHANISM only. Panel dimensions, colours,
 * radii, shadows, and content are untouched.
 */
import React from 'react';
import { flip, offset, shift } from '@floating-ui/react';
import type { Placement } from '@floating-ui/react';

export const SUBMENU_PLACEMENT: Placement = 'right-start';

/**
 * Fresh middleware array per call. Floating UI deep-compares middleware
 * (functions by source string), so passing a new array each render is safe and
 * does not cause update loops.
 *
 * Also used by the hover-preview cards in ./InfoFloatCard (with a wider gap) —
 * they sit beside a row and need exactly the same "pick the side that fits, then
 * slide vertically" behaviour. Sharing it means the crossAxis reasoning above
 * only has to be right once.
 *
 * @param offsetPx gap between the trigger row and the panel
 */
export const submenuMiddleware = (offsetPx: number = 4) => [
  offset(offsetPx),
  flip({
    // See the header note — without this, tall panels pick a horizontally
    // clipped side because vertical overflow poisons the fit test.
    crossAxis: false,
    fallbackPlacements: ['left-start', 'bottom-start', 'top-start'],
  }),
  shift({ padding: 8 }),
];

export interface SubmenuFloatingState {
  x: number | null;
  y: number | null;
  strategy: 'absolute' | 'fixed';
}

/**
 * Inline style for a submenu wrapper positioned by `useFloating`.
 * Hidden until the first `computePosition` resolves so it never flashes at 0,0.
 *
 * @param animation keyframe name used by the owning menu (each menu defines its
 *                  own enter animation; positioning must not change the look).
 */
export const submenuStyle = (
  f: SubmenuFloatingState,
  animation: string,
): React.CSSProperties => ({
  position: f.strategy,
  top: f.y ?? 0,
  left: f.x ?? 0,
  visibility: f.x == null ? 'hidden' : 'visible',
  zIndex: 10000,
  animation: `${animation} 120ms ease forwards`,
  transformOrigin: 'left top',
});
