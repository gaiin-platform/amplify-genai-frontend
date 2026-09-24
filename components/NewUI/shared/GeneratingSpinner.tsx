/**
 * GeneratingSpinner — minimal SVG arc spinner shown in the sidebar while a
 * chat response is being generated.
 *
 * Appearance (per spec):
 *   - ~12px diameter, ~1.5px stroke width, rounded linecap
 *   - ~270° filled arc, ~90° gap — no filled center, no track ring
 *   - currentColor: place inside a text-[--text-muted] container so the spinner
 *     is muted gray on both light and dark themes without any hard-coded hex.
 *
 * Motion:
 *   - One full rotation every 0.9 s, linear (constant speed, no easing).
 *   - Arc length stays constant; only the rotation angle changes.
 *   - prefers-reduced-motion: the rotation slows to 3 s rather than stopping,
 *     preserving the "something is happening" signal at a gentler pace.
 *   - The CSS animation is defined in styles/globals.css (.nui-generating-spinner)
 *     so that a single @keyframes block is shared across all instances.
 *
 * Accessibility:
 *   - role="status" + aria-label="Generating response" (visible to screen readers).
 *   - aria-hidden is intentionally NOT set: the spinner IS the status announcement.
 *     Call-sites in the sidebar wrap it in a visually positioned div; that div
 *     should be aria-hidden only if a separate live region announces the state.
 */
import React from 'react';

interface GeneratingSpinnerProps {
  /** Diameter in px. Defaults to 12 to match the sidebar row spec. */
  size?: number;
}

export const GeneratingSpinner: React.FC<GeneratingSpinnerProps> = ({ size = 12 }) => {
  // Geometry: leave a small margin inside the viewBox for the stroke.
  const r = size * 0.375;          // 4.5 at size=12 — stroke fits without clipping
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const arcLen = circ * 0.75;     // 270° dash
  const gapLen = circ * 0.25;     // 90° gap
  const sw = size * 0.125;        // 1.5px at size=12

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      role="status"
      aria-label="Generating response"
      className="nui-generating-spinner flex-shrink-0"
      style={{ display: 'block' }}
    >
      <circle
        cx={cx}
        cy={cy}
        r={r}
        stroke="currentColor"
        strokeWidth={sw}
        strokeLinecap="round"
        strokeDasharray={`${arcLen.toFixed(2)} ${gapLen.toFixed(2)}`}
      />
    </svg>
  );
};

export default GeneratingSpinner;
