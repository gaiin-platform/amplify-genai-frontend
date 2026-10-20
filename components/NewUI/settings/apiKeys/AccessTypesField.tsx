/**
 * AccessTypesField — the "Access types" checkbox grid shared by the card's edit mode and the
 * create form.
 *
 * "Full access" is a stored sentinel (`full_access`), not shorthand: backend checks are
 * `type in accessTypes or "full_access" in accessTypes`. So ticking it checks and disables the
 * individual boxes, unticking it re-enables them (cleared, so the choice is deliberate).
 *
 * Location: components/NewUI/settings/apiKeys/AccessTypesField.tsx
 */

import React, { FC } from 'react';
import { CheckboxControl, FieldError } from '@/components/NewUI/shared/FormControls';
import { FULL_ACCESS, formatAccessType } from './apiKeyModel';

export interface AccessTypesFieldProps {
  /** Unique prefix for element ids. */
  idPrefix: string;
  /** Id for the Full access checkbox (focus target for validation). */
  fullAccessId?: string;
  fullAccess: boolean;
  access: Record<string, boolean>;
  disabled?: boolean;
  error?: string;
  onFullAccessChange: (checked: boolean) => void;
  onToggle: (type: string) => void;
}

export const AccessTypesField: FC<AccessTypesFieldProps> = ({
  idPrefix,
  fullAccessId,
  fullAccess,
  access,
  disabled = false,
  error,
  onFullAccessChange,
  onToggle,
}) => {
  const fullId = fullAccessId ?? `${idPrefix}-full`;
  return (
    <fieldset style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
      <legend style={{ fontSize: 12, color: 'var(--text-muted)', padding: 0, marginBottom: 4 }}>Access types</legend>
      <div
        style={{
          display: 'grid',
          // Fixed-width columns (not 1fr) so items sit in tidy columns instead of spreading apart.
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 220px))',
          gap: '10px 16px',
          paddingTop: 4,
        }}
      >
        <CheckboxControl
          id={fullId}
          label={<strong style={{ fontWeight: 600 }}>{formatAccessType(FULL_ACCESS)}</strong>}
          checked={fullAccess}
          disabled={disabled}
          aria-describedby={`${idPrefix}-help`}
          onChange={onFullAccessChange}
        />
        {Object.keys(access).map((type) => (
          <CheckboxControl
            key={type}
            id={`${idPrefix}-${type}`}
            label={formatAccessType(type)}
            checked={access[type]}
            disabled={fullAccess || disabled}
            onChange={() => onToggle(type)}
          />
        ))}
      </div>
      <p id={`${idPrefix}-help`} style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
        Full access grants every access type, including any added later.
      </p>
      <FieldError id={`${idPrefix}-err`}>{error}</FieldError>
    </fieldset>
  );
};

export default AccessTypesField;
