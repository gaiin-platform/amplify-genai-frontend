/**
 * ApiKeysIntro — the page-level description under the "API Access" title (no card: it must not
 * compete with the Create / Your API keys cards below it).
 *
 * One muted sentence, a billing-account callout ONLY when the user has none, then one row of
 * links: "API documentation ↗" and a collapsed-by-default "About key types" disclosure whose
 * panel shows the three key types as small side-by-side cards (they stack on narrow widths).
 *
 * "A key is shown only once" is deliberately not here — the rotate confirm and the
 * `shared/OneTimeSecretReveal` callout say it at the moment it matters.
 *
 * Location: components/NewUI/settings/apiKeys/ApiKeysIntro.tsx
 */

import React, { FC, useId, useState } from 'react';
import { IconExternalLink } from '@tabler/icons-react';
import { DisclosureChevron } from '@/components/NewUI/shared/DisclosureChevron';
import { InfoCallout } from '@/components/NewUI/shared/InfoCallout';

export const API_RESOURCES_URL = 'https://www.vanderbilt.edu/agi/platforms/resources/';
/** Id of the callout, so the disabled "Create key" button can point at it. */
export const BILLING_CALLOUT_ID = 'nui-api-billing-callout';

export const KEY_TYPES = [
  {
    id: 'personal',
    title: 'Personal',
    description: 'Acts on your behalf, with access to your data and permissions.',
  },
  {
    id: 'system',
    title: 'System',
    description: 'Runs independently of any user account, with its own permissions. Good for automation.',
  },
  {
    id: 'delegate',
    title: 'Delegate',
    description: "A personal key for another Amplify user, billed to you. You can't see it; they rotate it to get theirs.",
  },
] as const;

// Same treatment as "Learn more about MCP" on the MCP Servers page.
const linkClass =
  'inline-flex items-center gap-1 underline rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]';
const linkStyle: React.CSSProperties = {
  color: 'var(--text-primary)',
  fontSize: 13,
  background: 'none',
  border: 0,
  padding: 0,
  cursor: 'pointer',
};

export interface ApiKeysIntroProps {
  /** False ⇒ show the "you need a billing account" callout. */
  hasBillingAccount: boolean;
  onOpenAccountSettings: () => void;
}

export const ApiKeysIntro: FC<ApiKeysIntroProps> = ({ hasBillingAccount, onOpenAccountSettings }) => {
  const [typesOpen, setTypesOpen] = useState(false);
  const panelId = useId();

  return (
    <div>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--text-secondary)', maxWidth: 720 }}>
        API keys let your scripts and apps call Amplify on your behalf. Usage is billed to the account you choose.
      </p>

      {!hasBillingAccount && (
        <div style={{ maxWidth: 720 }}>
          <InfoCallout id={BILLING_CALLOUT_ID} marginTop={12}>
            You need a billing account before you can create a key.{' '}
            <button type="button" onClick={onOpenAccountSettings} className={linkClass} style={linkStyle}>
              Add one in Account settings
            </button>
          </InfoCallout>
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 16px', marginTop: 12 }}>
        <a href={API_RESOURCES_URL} target="_blank" rel="noopener noreferrer" className={linkClass} style={linkStyle}>
          API documentation <IconExternalLink size={13} aria-hidden="true" />
        </a>
        <button
          type="button"
          aria-expanded={typesOpen}
          aria-controls={panelId}
          onClick={() => setTypesOpen((open) => !open)}
          className={linkClass}
          style={linkStyle}
        >
          About key types <DisclosureChevron open={typesOpen} />
        </button>
      </div>

      {typesOpen && (
        <ul
          id={panelId}
          aria-label="Key types"
          style={{
            listStyle: 'none',
            margin: '12px 0 0',
            padding: 0,
            display: 'grid',
            // Three columns when there is room (~3 × 200px + gaps); otherwise they wrap and stack.
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 10,
          }}
        >
          {KEY_TYPES.map((type) => (
            <li
              key={type.id}
              style={{
                padding: 12,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 10,
              }}
            >
              <h4 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{type.title}</h4>
              <p style={{ margin: '4px 0 0', fontSize: 12.5, lineHeight: 1.45, color: 'var(--text-secondary)' }}>
                {type.description}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ApiKeysIntro;
