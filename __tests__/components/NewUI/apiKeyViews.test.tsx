/**
 * Static-markup tests for the API Access views: the card's read-only details grid and the
 * shown-once key callout. (Interactive behaviour — edit/save/rotate — is covered by the model
 * tests; these pin the redesign's visible contract.)
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import HomeContext from '@/components/Home/home.context';
import { ApiKeyCard } from '@/components/NewUI/settings/apiKeys/ApiKeyCard';
import { OneTimeSecretReveal } from '@/components/NewUI/shared/OneTimeSecretReveal';

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

const account = { id: 'a-1', name: 'Research', rateLimit: { period: 'Unlimited', rate: null } };
const key = (over: Record<string, unknown> = {}): any => ({
  api_owner_id: 'me/ownerKey/1',
  owner: 'me',
  delegate: null,
  applicationName: 'Max Test',
  applicationDescription: '',
  account,
  rateLimit: { period: 'Unlimited', rate: null },
  active: true,
  expirationDate: null,
  accessTypes: ['full_access'],
  systemId: null,
  lastAccessed: '2026-10-16T21:58:12Z',
  ...over,
});

const render = (apiKey: any, props: Record<string, unknown> = {}) =>
  renderToStaticMarkup(
    <HomeContext.Provider value={{ state: { statsService: {} } } as any}>
      <ApiKeyCard
        apiKey={apiKey}
        userId="me"
        accounts={[account] as any}
        mtdCost={1.72}
        onUpdated={() => undefined}
        onDeactivated={() => undefined}
        onRotated={() => undefined}
        onGuardChange={() => undefined}
        defaultOpen
        {...props}
      />
    </HomeContext.Provider>,
  );

describe('ApiKeyCard — header', () => {
  const html = render(key());
  it('has no orphan leading bullet and shows cost as muted meta, not on the title', () => {
    expect(html).not.toMatch(/>\s*•/);
    expect(html).toContain('$1.72 this month');
    expect(html).not.toContain('MTD:');
  });
  it('makes the whole row one aria-expanded toggle, with a hover state', () => {
    expect(html).toMatch(/<button[^>]*aria-expanded="true"[^>]*aria-controls=/);
    expect(html).toContain('hover:bg-[--bg-hover]');
    // the status pill lives inside that button, not beside it
    expect(html.indexOf('>Active<')).toBeGreaterThan(html.indexOf('aria-expanded'));
  });
  it('shows "Untitled key" in muted italic when the key has no name', () => {
    const h = render(key({ applicationName: '   ' }));
    expect(h).toContain('>Untitled key<');
    expect(h).toContain('font-style:italic');
    expect(h).toContain('aria-label="API key Untitled key"');
    expect(render(key())).not.toContain('Untitled key');
  });
  it('has no person icon', () => {
    expect(html).not.toContain('tabler-icon-user"');
  });
  it('shows exactly one status pill: Active / Expired (warning) / Inactive (gray)', () => {
    expect(html).toContain('>Active<');
    const expiredHtml = render(key({ expirationDate: '2026-01-01', active: false }));
    expect(expiredHtml).toContain('>Expired<');
    expect(expiredHtml).toContain('var(--warning-border)');
    expect(expiredHtml).not.toContain('>Inactive<');
    const inactive = render(key({ active: false }));
    expect(inactive).toContain('>Inactive<');
    expect(inactive).not.toContain('>Expired<');
    // expired by date even though the list still says active
    expect(render(key({ expirationDate: '2026-01-01', active: true }))).toContain('>Expired<');
  });
  it('no longer prints the expiry (or any red text) in the meta line', () => {
    const h = render(key({ expirationDate: '2026-01-01', active: false }));
    expect(h).not.toContain('var(--text-error)');
    expect(h).not.toMatch(/Expired Jan/);
  });
  it('shows relative last-used time (no seconds) with the full timestamp as a tooltip', () => {
    const h = render(key({ lastAccessed: '2026-10-16T21:58:12Z', createdAt: '2026-10-01T00:00:00Z' }));
    expect(h).toMatch(/Last used \d+ (day|month|year)s? ago/);
    expect(h).toMatch(/title="[A-Z][a-z]{2} \d{1,2}, \d{4}, \d{1,2}:\d{2} (AM|PM) [A-Z]/);
    expect(h).not.toMatch(/\d:\d{2}:\d{2}/);
  });
  it('says "Never used" when lastAccessed is missing or still equals createdAt', () => {
    expect(render(key({ lastAccessed: undefined }))).toContain('Never used');
    const same = '2026-10-01T00:00:00+00:00';
    expect(render(key({ lastAccessed: same, createdAt: same }))).toContain('Never used');
  });
  it('shows the delegate as neutral meta text, truncated with the full address as a tooltip', () => {
    const email = 'a.very.long.delegate.address.name@some-department.example.edu';
    const d = render(key({ delegate: email }), { delegateLabel: email });
    expect(d).toContain('Delegate:');
    expect(d).toContain(`title="${email}"`);
    expect(d).toContain('text-overflow:ellipsis');
    expect(d).not.toMatch(/amber|orange|yellow/i);
  });
});

describe('ApiKeyCard — view mode', () => {
  const html = render(key());
  it('uses muted labels without colons and "No expiration" instead of N/A', () => {
    for (const label of ['Account', 'Expiration', 'Rate limit', 'Access types']) {
      expect(html).toContain(`>${label}</dt>`);
    }
    expect(html).not.toMatch(/>(Account|Expiration|Rate limit|Access types):</);
    expect(html).toContain('No expiration');
    expect(html).not.toContain('N/A');
  });
  it('shows only a "Full access" chip under full access', () => {
    expect(html).toContain('Full access');
    expect(html).not.toContain('File upload');
  });
  it('shows individual chips otherwise', () => {
    const h = render(key({ accessTypes: ['chat', 'file_upload'] }));
    expect(h).toContain('>Chat<');
    expect(h).toContain('>File upload<');
  });
  it('shows an always-visible, labelled Edit button only to someone who can edit', () => {
    expect(html).toContain('aria-label="Edit details for Max Test"');
    expect(html).not.toContain('Save changes');
    const viewer = render(key({ owner: 'someone' }), { ownerLabel: 'someone' });
    expect(viewer).not.toContain('Edit details for');
    expect(viewer).toContain('only the key owner can edit');
    expect(render(key({ active: false }))).not.toContain('Edit details for');
    expect(render(key({ active: false }))).toContain('Deactivated keys can&#x27;t be edited or reactivated');
    expect(render(key({ expirationDate: '2026-01-01', active: false }))).toContain('This key has expired');
  });
  it('puts Edit beside the first row of fields — not in its own row above them', () => {
    const editAt = html.indexOf('Edit details for');
    expect(editAt).toBeGreaterThan(html.indexOf('>Account</dt>'));
    expect(html).not.toContain('Editing — changes apply');
  });
  it('formats the account as "Name — id" and adds Created / Last used fields', () => {
    expect(html).toContain('Research — a-1');
    const h = render(key({ createdAt: '2026-10-01T12:00:00Z' }));
    expect(h).toContain('>Created</dt>');
    expect(h).toContain('>Last used</dt>');
    expect(h).toMatch(/Oct [12], 2026, \d{1,2}:\d{2} (AM|PM)/);
    expect(render(key({ lastAccessed: undefined }))).toContain('Never used');
  });
  it('shows the expiration in the details, with "Expired" in the warning colour', () => {
    const h = render(key({ expirationDate: '2026-01-01', active: false }));
    expect(h).toContain('Jan 1, 2026');
    expect(h).toContain('· Expired');
    expect(h).toContain('var(--warning-fg)');
  });
  it('offers Deactivate (but never Reactivate) and hides Rotate for keys that cannot be used', () => {
    expect(html).toContain('Deactivate key');
    expect(html).toContain('Rotate key');
    expect(html).not.toMatch(/Reactivate key/);
    for (const unusable of [key({ active: false }), key({ expirationDate: '2026-01-01', active: false }), key({ expirationDate: '2026-01-01' })]) {
      const h = render(unusable);
      expect(h).not.toContain('Rotate key');
      expect(h).not.toContain('Deactivate key');
    }
  });
  it('has the new key-section copy and a Rotate key button', () => {
    expect(html).toContain('keys are only shown once, when created or rotated');
    expect(html).toContain('Rotate key');
    expect(html).not.toContain('Rotate API Key');
  });
});

describe('OneTimeSecretReveal', () => {
  const html = renderToStaticMarkup(
    <OneTimeSecretReveal secret="amp-v1-SECRET" copied={false} onCopied={() => undefined} onDone={() => undefined} />,
  );
  it('is a calm callout with the new copy', () => {
    expect(html).toContain('Copy your new API key');
    expect(html).toContain('var(--warning-bg)');
    expect(html).toContain("This key won&#x27;t be shown again. Store it somewhere secure, like a password manager.");
  });
  it('shows the key in a read-only field with a labelled Copy button and a Done button', () => {
    expect(html).toMatch(/<input[^>]*readonly=""[^>]*value="amp-v1-SECRET"/);
    expect(html).toContain('aria-label="New API key"');
    expect(html).toContain('>Copy<');
    expect(html).toContain('>Done<');
    expect(html).not.toMatch(/text-green|#[0-9a-f]{3,6}.*green/i);
  });
  it('has a polite live region for "Copied"', () => {
    expect(html).toContain('aria-live="polite"');
  });
});
