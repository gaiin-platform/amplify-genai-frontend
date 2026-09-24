/**
 * ToggleSwitch — REUSABLE pill-shaped on/off switch.
 *
 * Design spec:
 *   - 44×24px track, fully rounded (border-radius: 9999px)
 *   - Off: track fills with --text-muted (neutral gray); knob rests flush-left (3px inset)
 *   - On:  track fills with --accent; knob slides to right edge (translateX(20px))
 *   - Knob: 18px circle, white (#ffffff), flat — no shadow, no gradient
 *   - Transition: 150ms ease on both track color and knob position, simultaneous
 *   - Keyboard: Space / Enter toggles; role="switch" + aria-checked for screen readers
 *   - Focus: visible ring (2px --accent offset-1) on keyboard focus only
 *   - Clicking anywhere on the track OR an associated label/row toggles state
 *
 * Usage:
 *   <ToggleSwitch checked={val} onChange={setVal} aria-label="Enable feature" />
 *
 *   To make a label clickable, wrap row in an onClick or use aria-labelledby:
 *   <div onClick={() => onChange(!checked)} style={{ cursor: 'pointer' }}>
 *     <span id="lbl-foo">Label</span>
 *     <ToggleSwitch checked={checked} onChange={onChange} aria-labelledby="lbl-foo" />
 *   </div>
 */

import React from 'react';

export interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
  disabled?: boolean;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  checked,
  onChange,
  id,
  disabled = false,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
}) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (!disabled) onChange(!checked);
    }
  };

  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledby}
      disabled={disabled}
      onClick={(e) => {
        // Prevent double-toggle when ToggleSwitch is nested inside a row div that also has onClick
        e.stopPropagation();
        if (!disabled) onChange(!checked);
      }}
      onKeyDown={handleKeyDown}
      className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent] focus-visible:ring-offset-1"
      style={{
        position: 'relative',
        display: 'inline-block',
        width: '44px',
        height: '24px',
        borderRadius: '9999px',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        padding: 0,
        flexShrink: 0,
        verticalAlign: 'middle',
        // Track color: accent when on, neutral gray when off.
        // --text-muted: #6E6E6E light / #9E9C96 dark — adequate contrast with white knob.
        backgroundColor: checked ? 'var(--accent)' : 'var(--text-muted)',
        opacity: disabled ? 0.5 : 1,
        transition: 'background-color 150ms ease',
      }}
    >
      {/* Knob — flat white circle, slides between left and right inset positions */}
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '3px',
          left: '3px',
          width: '18px',
          height: '18px',
          borderRadius: '9999px',
          backgroundColor: '#ffffff',
          // translateX(20) = track(44) - knob(18) - leftInset(3) - rightInset(3)
          transform: checked ? 'translateX(20px)' : 'translateX(0)',
          transition: 'transform 150ms ease',
          pointerEvents: 'none',
        }}
      />
    </button>
  );
};

export default ToggleSwitch;
