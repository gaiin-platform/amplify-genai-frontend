/**
 * FormControls — the new UI's standard text input, select and checkbox.
 *
 * One look for every settings form: 36px tall, 1px --border-subtle, 8px radius, --bg-app
 * fill, 13px text, a visible keyboard-focus ring, an error border + `aria-invalid`, and a
 * real chevron on selects (the native arrow is hidden so it renders the same everywhere).
 * Colours are theme tokens only, so light and dark both work.
 *
 * Location: components/NewUI/shared/FormControls.tsx
 */

import React, { CSSProperties, forwardRef } from 'react';
import { IconChevronDown } from '@tabler/icons-react';

export const CONTROL_HEIGHT = 36;

const FOCUS_RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent] disabled:opacity-60 disabled:cursor-not-allowed';

const baseControl = (invalid?: boolean): CSSProperties => ({
  width: '100%',
  height: CONTROL_HEIGHT,
  boxSizing: 'border-box',
  background: 'var(--bg-app)',
  border: `1px solid ${invalid ? 'var(--text-error)' : 'var(--border-subtle)'}`,
  borderRadius: 8,
  padding: '0 10px',
  fontSize: 13,
  color: 'var(--text-primary)',
});

const prefersDark = () =>
  typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

export type TextControlProps = React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean };

export const TextControl = forwardRef<HTMLInputElement, TextControlProps>(
  ({ invalid, style, className = '', type = 'text', ...rest }, ref) => (
    <input
      ref={ref}
      type={type}
      aria-invalid={invalid || undefined}
      className={`${FOCUS_RING} ${className}`}
      style={{
        ...baseControl(invalid),
        // Native date picker glyph/popup must follow the app theme, not the OS.
        ...(type === 'date' ? { colorScheme: prefersDark() ? 'dark' : 'light' } : null),
        ...style,
      }}
      {...rest}
    />
  ),
);
TextControl.displayName = 'TextControl';

export type TextAreaControlProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
};

export const TextAreaControl = forwardRef<HTMLTextAreaElement, TextAreaControlProps>(
  ({ invalid, style, className = '', ...rest }, ref) => (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={`${FOCUS_RING} ${className}`}
      style={{ ...baseControl(invalid), height: 'auto', padding: '8px 10px', resize: 'vertical', ...style }}
      {...rest}
    />
  ),
);
TextAreaControl.displayName = 'TextAreaControl';

export type SelectControlProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  invalid?: boolean;
};

export const SelectControl = forwardRef<HTMLSelectElement, SelectControlProps>(
  ({ invalid, style, className = '', children, ...rest }, ref) => (
    <div style={{ position: 'relative', width: '100%' }}>
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={`${FOCUS_RING} ${className}`}
        style={{
          ...baseControl(invalid),
          appearance: 'none',
          WebkitAppearance: 'none',
          MozAppearance: 'none',
          paddingRight: 30,
          cursor: 'pointer',
          ...style,
        }}
        {...rest}
      >
        {children}
      </select>
      <IconChevronDown
        size={16}
        aria-hidden="true"
        style={{
          position: 'absolute',
          right: 10,
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--text-muted)',
          pointerEvents: 'none',
        }}
      />
    </div>
  ),
);
SelectControl.displayName = 'SelectControl';

export interface CheckboxControlProps {
  id: string;
  label: React.ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  'aria-describedby'?: string;
}

export const CheckboxControl: React.FC<CheckboxControlProps> = ({
  id,
  label,
  checked,
  onChange,
  disabled = false,
  'aria-describedby': describedBy,
}) => (
  <label
    htmlFor={id}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      fontSize: 13,
      color: disabled ? 'var(--text-muted)' : 'var(--text-primary)',
      cursor: disabled ? 'default' : 'pointer',
      minHeight: 24,
    }}
  >
    <input
      id={id}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      aria-describedby={describedBy}
      onChange={(e) => onChange(e.target.checked)}
      className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{ width: 16, height: 16, margin: 0, accentColor: 'var(--accent)' }}
    />
    {label}
  </label>
);

/** A label + control + inline error, so every form field is announced and laid out the same. */
export const FieldError: React.FC<{ id: string; children?: React.ReactNode }> = ({ id, children }) =>
  children ? (
    <p id={id} role="alert" style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-error)' }}>
      {children}
    </p>
  ) : null;
