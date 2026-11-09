/**
 * DisclosureChevron — the one expand/collapse affordance for disclosures.
 *
 * A small chevron that points right when closed and down when open. It is a
 * glyph only: the surrounding element must be a real <button> carrying
 * `aria-expanded` (and an accessible name), so this renders `aria-hidden`.
 *
 * Rotation is a CSS transition defined in styles/conversation-view.css
 * (`.nui-disclosure-chevron`) with a prefers-reduced-motion override.
 * Colour is `currentColor`.
 */
import React from 'react';
import { IconChevronRight } from '@tabler/icons-react';

interface DisclosureChevronProps {
  open: boolean;
  /** Icon size in px. Defaults to 14. */
  size?: number;
  className?: string;
}

export const DisclosureChevron: React.FC<DisclosureChevronProps> = ({ open, size = 14, className }) => (
  <span
    className={`nui-disclosure-chevron${className ? ` ${className}` : ''}`}
    data-open={open ? 'true' : 'false'}
    aria-hidden="true"
  >
    <IconChevronRight size={size} stroke={2} />
  </span>
);

export default DisclosureChevron;
