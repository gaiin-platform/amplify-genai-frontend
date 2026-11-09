/**
 * InfoCallout — the quiet "good to know" note: an info icon beside a short paragraph, on a
 * `--bg-raised` panel with a subtle border. Neutral, not a warning — use the `--warning-*`
 * tokens for cautions. `--bg-raised` is a visible step from both `--bg-app` and the
 * `--bg-elevated` settings cards in light and dark mode.
 *
 * Renders a plain `<div>`; pass `role="status"` when it appears in response to user action.
 */
import React from 'react';
import { IconInfoCircle } from '@tabler/icons-react';

interface InfoCalloutProps {
  children: React.ReactNode;
  /** Top margin in px. Defaults to 0; the parent usually owns spacing. */
  marginTop?: number;
  id?: string;
  role?: 'status';
}

export const InfoCallout: React.FC<InfoCalloutProps> = ({ children, marginTop = 0, id, role }) => (
  <div
    id={id}
    role={role}
    style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
      marginTop,
      padding: 12,
      borderRadius: 8,
      background: 'var(--bg-raised)',
      border: '1px solid var(--border-subtle)',
      color: 'var(--text-secondary)',
      fontSize: 13,
      lineHeight: '20px',
      textAlign: 'left',
    }}
  >
    {/* 16px icon centred on the first 20px line */}
    <IconInfoCircle size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2, color: 'var(--text-muted)' }} />
    <p style={{ margin: 0, minWidth: 0 }}>{children}</p>
  </div>
);

export default InfoCallout;
