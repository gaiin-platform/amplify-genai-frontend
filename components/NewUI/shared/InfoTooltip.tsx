import React, { useId, useState } from 'react';
import { IconInfoCircle } from '@tabler/icons-react';
import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  useFloating,
} from '@floating-ui/react';

export interface InfoTooltipProps {
  /** The explanatory copy shown beside the information icon. */
  text: string;
  /** Accessible name for the icon button. */
  ariaLabel?: string;
  /** Maximum tooltip width in pixels. */
  maxWidth?: number;
}

/** Small, reusable information affordance for concise supplementary help. */
export const InfoTooltip: React.FC<InfoTooltipProps> = ({
  text,
  ariaLabel = 'More information',
  maxWidth = 280,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const isOpen = isHovered || isFocused;
  const tooltipId = useId();
  const { refs, x, y, strategy } = useFloating({
    open: isOpen,
    placement: 'top',
    strategy: 'fixed',
    middleware: [offset(6), flip({ padding: 8 }), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  return (
    <span className="inline-flex items-center">
      <button
        ref={refs.setReference}
        type="button"
        aria-label={ariaLabel}
        aria-describedby={isOpen ? tooltipId : undefined}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className="inline-flex items-center justify-center rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{
          padding: 2,
          border: 0,
          background: 'transparent',
          color: 'var(--text-muted)',
          cursor: 'help',
          outlineColor: 'var(--accent)',
        }}
      >
        <IconInfoCircle size={15} aria-hidden="true" />
      </button>
      {isOpen && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            id={tooltipId}
            role="tooltip"
            data-new-ui-shell="true"
            style={{
              position: strategy,
              top: y ?? 0,
              left: x ?? 0,
              visibility: x == null ? 'hidden' : 'visible',
              zIndex: 10002,
              width: `min(${maxWidth}px, calc(100vw - 24px))`,
              padding: '8px 12px',
              border: '1px solid var(--border-subtle)',
              borderRadius: 8,
              background: 'var(--bg-raised)',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
              color: 'var(--text-secondary)',
              fontSize: 12.5,
              lineHeight: 1.45,
              whiteSpace: 'normal',
              pointerEvents: 'none',
            }}
          >
            {text}
          </div>
        </FloatingPortal>
      )}
    </span>
  );
};

export default InfoTooltip;
