/**
 * Tests for settings/apiKeys/apiKeyModel.ts — the rules behind Settings → API Access:
 * what a save sends, who may edit/rotate, and the Full access semantics.
 */

import { describe, it, expect } from 'vitest';
import {
  accessChips,
  buildRateLimit,
  canEditKey,
  canRotateKey,
  describeRateLimit,
  diffDraft,
  draftAccessTypes,
  draftFromKey,
  editBlockReason,
  isDraftDirty,
  isKeyExpired,
  minExpirationDate,
  mtdCostForKey,
  normalizeAccessTypes,
  parseRateAmount,
  setFullAccess,
  setNoExpiration,
  toggleAccessType,
  validateCreate,
  validateDraft,
} from '@/components/NewUI/settings/apiKeys/apiKeyModel';

const NOW = new Date('2026-10-20T15:00:00Z');

const accounts = [
  { id: 'a-1', name: 'Research', rateLimit: { period: 'Unlimited', rate: null } },
  { id: 'a-2', name: 'Teaching', rateLimit: { period: 'Monthly', rate: 50 } },
] as any[];

const makeKey = (over: Record<string, unknown> = {}): any => ({
  api_owner_id: 'me/ownerKey/1',
  owner: 'me',
  delegate: null,
  applicationName: 'Test',
  applicationDescription: '',
  account: accounts[0],
  rateLimit: { period: 'Unlimited', rate: null },
  active: true,
  expirationDate: null,
  accessTypes: ['full_access'],
  systemId: null,
  lastAccessed: '2026-10-16T21:58:12Z',
  ...over,
});

describe('access types', () => {
  it('flattens the legacy nested [["full_access"]] shape', () => {
    expect(normalizeAccessTypes([['full_access']])).toEqual(['full_access']);
    expect(normalizeAccessTypes(['chat', ['chat', 'share'], 3, null, ''])).toEqual(['chat', 'share']);
    expect(normalizeAccessTypes(undefined)).toEqual([]);
  });

  it('shows only a "Full access" chip when full access is on', () => {
    expect(accessChips(['full_access', 'chat'])).toEqual(['Full access']);
    expect(accessChips(['chat', 'file_upload'])).toEqual(['Chat', 'File upload']);
  });
});

describe('Full access semantics', () => {
  it('seeds from the key, with every type shown on (and implied) under full access', () => {
    const d = draftFromKey(makeKey());
    expect(d.fullAccess).toBe(true);
    expect(Object.values(d.access).every(Boolean)).toBe(true);
  });

  it('seeds specific types faithfully — not "all on" like the legacy editor did', () => {
    const d = draftFromKey(makeKey({ accessTypes: ['chat', 'share'] }));
    expect(d.fullAccess).toBe(false);
    expect(d.access).toMatchObject({ chat: true, share: true, assistants: false, file_upload: false });
  });

  it('ticking Full access checks everything; the others cannot be toggled while it is on', () => {
    let d = draftFromKey(makeKey({ accessTypes: ['chat'] }));
    d = setFullAccess(d, true);
    expect(Object.values(d.access).every(Boolean)).toBe(true);
    expect(toggleAccessType(d, 'chat')).toBe(d);
    expect(draftAccessTypes(d)).toEqual(['full_access']);
  });

  it('unticking Full access clears the individual boxes and re-enables them', () => {
    let d = setFullAccess(draftFromKey(makeKey()), false);
    expect(Object.values(d.access).some(Boolean)).toBe(false);
    d = toggleAccessType(d, 'chat');
    expect(draftAccessTypes(d)).toEqual(['chat']);
  });

  it('keeps access types it does not know about instead of silently dropping them', () => {
    const key = makeKey({ accessTypes: ['api_key', 'chat'] });
    const d = draftFromKey(key);
    expect(Object.keys(d.access)).toContain('api_key');
    expect(draftAccessTypes(d)).toEqual(expect.arrayContaining(['api_key', 'chat']));
  });

  it('requires at least one type once the user changes them', () => {
    const key = makeKey();
    const d = setFullAccess(draftFromKey(key), false);
    expect(validateDraft(key, d, accounts, NOW).accessTypes).toBeTruthy();
  });
});

describe('diffDraft — only what changed is sent', () => {
  it('is empty and not dirty for an untouched draft', () => {
    const key = makeKey({ accessTypes: ['chat', 'share'], expirationDate: '2027-01-01' });
    const d = draftFromKey(key);
    expect(diffDraft(key, d, accounts)).toEqual({});
    expect(isDraftDirty(key, d, accounts)).toBe(false);
  });

  it('is not dirty when the same types are re-ordered or stored in the legacy nested shape', () => {
    const key = makeKey({ accessTypes: [['share', 'chat']] });
    const d = draftFromKey(key);
    expect(isDraftDirty(key, d, accounts)).toBe(false);
  });

  it('sends the full Account object when the account changes', () => {
    const key = makeKey();
    const d = { ...draftFromKey(key), accountId: 'a-2' };
    expect(diffDraft(key, d, accounts)).toEqual({ account: accounts[1] });
  });

  it('sends null to clear an expiration, and a date to set one', () => {
    const key = makeKey({ expirationDate: '2027-01-01' });
    expect(diffDraft(key, setNoExpiration(draftFromKey(key), true), accounts)).toEqual({ expirationDate: null });
    const none = makeKey();
    const d = { ...draftFromKey(none), noExpiration: false, expirationDate: '2027-06-30' };
    expect(diffDraft(none, d, accounts)).toEqual({ expirationDate: '2027-06-30' });
  });

  it('builds rateLimit objects the API expects', () => {
    const key = makeKey();
    const d = { ...draftFromKey(key), ratePeriod: 'Daily' as const, rateAmount: '$12.5' };
    expect(diffDraft(key, d, accounts)).toEqual({ rateLimit: { period: 'Daily', rate: 12.5 } });
    const limited = makeKey({ rateLimit: { period: 'Daily', rate: 12.5 } });
    const back = { ...draftFromKey(limited), ratePeriod: 'Unlimited' as const };
    expect(diffDraft(limited, back, accounts)).toEqual({ rateLimit: { period: 'Unlimited', rate: null } });
  });

  it('sends access types as one flat array', () => {
    const key = makeKey();
    const d = toggleAccessType(setFullAccess(draftFromKey(key), false), 'chat');
    expect(diffDraft(key, d, accounts)).toEqual({ accessTypes: ['chat'] });
  });

  it('batches several changed fields into one updates object', () => {
    const key = makeKey();
    const d = {
      ...draftFromKey(key),
      accountId: 'a-2',
      ratePeriod: 'Monthly' as const,
      rateAmount: '5',
    };
    expect(Object.keys(diffDraft(key, d, accounts)).sort()).toEqual(['account', 'rateLimit']);
  });
});

describe('validation', () => {
  it('rejects a past or same-day expiration and accepts a future one', () => {
    const key = makeKey();
    const base = { ...draftFromKey(key), noExpiration: false };
    expect(validateDraft(key, { ...base, expirationDate: '2026-10-19' }, accounts, NOW).expirationDate).toBeTruthy();
    // today is already "expired" by the backend's clock
    expect(validateDraft(key, { ...base, expirationDate: '2026-10-20' }, accounts, NOW).expirationDate).toBeTruthy();
    expect(validateDraft(key, { ...base, expirationDate: '2026-10-21' }, accounts, NOW).expirationDate).toBeUndefined();
  });

  it('requires a date when "No expiration" is off', () => {
    const key = makeKey();
    const d = { ...draftFromKey(key), noExpiration: false, expirationDate: '' };
    expect(validateDraft(key, d, accounts, NOW).expirationDate).toBeTruthy();
  });

  it('requires a positive rate amount for a limited period', () => {
    const key = makeKey();
    const d = { ...draftFromKey(key), ratePeriod: 'Daily' as const, rateAmount: '' };
    expect(validateDraft(key, d, accounts, NOW).rateLimit).toBeTruthy();
    expect(validateDraft(key, { ...d, rateAmount: '0' }, accounts, NOW).rateLimit).toBeTruthy();
    expect(validateDraft(key, { ...d, rateAmount: '3' }, accounts, NOW).rateLimit).toBeUndefined();
  });

  it('does not let an untouched legacy value block saving something else', () => {
    // a key that was created with a $0 daily limit
    const key = makeKey({ rateLimit: { period: 'Daily', rate: 0 }, accessTypes: ['chat'] });
    const d = { ...draftFromKey(key), accountId: 'a-2' };
    expect(validateDraft(key, d, accounts, NOW)).toEqual({});
  });
});

describe('minExpirationDate', () => {
  it('is tomorrow when the local and UTC dates agree', () => {
    expect(minExpirationDate(new Date(2026, 9, 20, 12, 0, 0))).toMatch(/^2026-10-2[12]$/);
  });
  it('never returns a date the backend would already consider expired', () => {
    const min = minExpirationDate(NOW);
    expect(isKeyExpired(min, NOW)).toBe(false);
    expect(min > '2026-10-20').toBe(true);
  });
});

describe('permissions', () => {
  it('lets the owner edit an active, unexpired key', () => {
    expect(canEditKey(makeKey(), 'me', NOW)).toBe(true);
  });
  it('explains why not', () => {
    expect(editBlockReason(makeKey(), 'someone-else', NOW)).toBe('delegated');
    expect(editBlockReason(makeKey({ active: false }), 'me', NOW)).toBe('inactive');
    expect(editBlockReason(makeKey({ expirationDate: '2026-10-01' }), 'me', NOW)).toBe('expired');
  });
  it('rotates per the backend: delegate rotates delegated keys, owner rotates their own', () => {
    expect(canRotateKey(makeKey(), 'me', NOW)).toBe(true);
    expect(canRotateKey(makeKey({ delegate: 'you' }), 'me', NOW)).toBe(false);
    expect(canRotateKey(makeKey({ delegate: 'you' }), 'you', NOW)).toBe(true);
    expect(canRotateKey(makeKey({ active: false }), 'me', NOW)).toBe(false);
    expect(canRotateKey(makeKey({ expirationDate: '2026-10-01' }), 'me', NOW)).toBe(false);
    expect(canRotateKey(makeKey({ purpose: 'agents' }), 'me', NOW)).toBe(false);
  });
});

describe('formatting helpers', () => {
  it('describes rate limits', () => {
    expect(describeRateLimit({ period: 'Unlimited', rate: null })).toBe('Unlimited');
    expect(describeRateLimit({ period: 'Daily', rate: 5 })).toBe('$5.00 / Daily');
    expect(describeRateLimit(undefined)).toBe('Unlimited');
  });
  it('parses amounts', () => {
    expect(parseRateAmount('$1,234.5')).toBe(1234.5);
    expect(parseRateAmount('abc')).toBeNull();
    expect(parseRateAmount('')).toBeNull();
    expect(parseRateAmount('-3')).toBeNull();
    expect(buildRateLimit('Unlimited', '99')).toEqual({ period: 'Unlimited', rate: null });
  });
  it('matches MTD cost by the id after #', () => {
    const mtd = { accounts: [{ accountInfo: 'acct#me/ownerKey/1', totalCost: 1.72 }] };
    expect(mtdCostForKey(mtd, makeKey())).toBe(1.72);
    expect(mtdCostForKey(mtd, makeKey({ api_owner_id: 'x' }))).toBeNull();
    expect(mtdCostForKey(null, makeKey())).toBeNull();
  });
});

describe('validateCreate', () => {
  const ok = {
    name: 'App', accountSelected: true, ratePeriod: 'Unlimited' as const, rateAmount: '',
    includeExpiration: false, expirationDate: '', fullAccess: true, selectedTypes: [],
  };
  it('accepts the defaults with a name', () => expect(validateCreate(ok, NOW)).toEqual({}));
  it('flags each problem', () => {
    const e = validateCreate({
      ...ok, name: ' ', accountSelected: false, ratePeriod: 'Daily', includeExpiration: true,
      expirationDate: '2020-01-01', fullAccess: false,
    }, NOW);
    expect(Object.keys(e).sort()).toEqual(['accessTypes', 'account', 'expirationDate', 'name', 'rateLimit']);
  });
});

import { emptyDraft, filterAndSortKeys, formatPurpose } from '@/components/NewUI/settings/apiKeys/apiKeyModel';

describe('emptyDraft', () => {
  it('matches the create form defaults: Full access, unlimited, no expiration', () => {
    const d = emptyDraft('a-1');
    expect(d).toMatchObject({ accountId: 'a-1', noExpiration: true, fullAccess: true, ratePeriod: 'Unlimited' });
    expect(draftAccessTypes(d)).toEqual(['full_access']);
  });
});

describe('filterAndSortKeys', () => {
  const keys = [
    makeKey({ api_owner_id: '1', applicationName: 'Zeta', lastAccessed: '2026-10-01T00:00:00Z', expirationDate: '2027-01-01' }),
    makeKey({ api_owner_id: '2', applicationName: 'alpha', active: false, lastAccessed: '2026-10-10T00:00:00Z', expirationDate: null }),
    makeKey({ api_owner_id: '3', applicationName: 'Mid', purpose: 'agent_tools', lastAccessed: null, expirationDate: '2026-12-01' }),
  ];
  const base = { search: '', status: 'All' as const, sort: 'name' as const };
  const ids = (ks: any[]) => ks.map((k) => k.api_owner_id);

  it('sorts by name (case-insensitive), last accessed (newest first), expiration (soonest, none last)', () => {
    expect(ids(filterAndSortKeys(keys, base))).toEqual(['2', '3', '1']);
    expect(ids(filterAndSortKeys(keys, { ...base, sort: 'lastAccessed' }))).toEqual(['2', '1', '3']);
    expect(ids(filterAndSortKeys(keys, { ...base, sort: 'expiration' }))).toEqual(['3', '1', '2']);
  });
  it('filters by search, status and purpose', () => {
    expect(ids(filterAndSortKeys(keys, { ...base, search: 'ZET' }))).toEqual(['1']);
    expect(ids(filterAndSortKeys(keys, { ...base, status: 'Inactive' }))).toEqual(['2']);
    expect(ids(filterAndSortKeys(keys, { ...base, purpose: 'agent_tools' }))).toEqual(['3']);
  });
  it('formats purposes', () => {
    expect(formatPurpose('')).toBe('General');
    expect(formatPurpose('agent_tools')).toBe('Agent Tools');
  });
});

import {
  DEFAULT_EXPIRATION_DAYS,
  defaultExpirationDate,
  describeLastUsed,
  formatAccount,
  formatRelativeAge,
  formatTimestamp,
  keyDisplayName,
  keyStatus,
  neverUsed,
} from '@/components/NewUI/settings/apiKeys/apiKeyModel';

describe('keyStatus — expired vs inactive', () => {
  it('derives "expired" from the date, whatever the active flag says', () => {
    expect(keyStatus({ active: true, expirationDate: '2026-10-01' }, NOW)).toBe('expired');
    // the backend flips expired keys to active=false on fetch — still expired, not "inactive"
    expect(keyStatus({ active: false, expirationDate: '2026-10-01' }, NOW)).toBe('expired');
  });
  it('is inactive only when deactivated with no past expiration', () => {
    expect(keyStatus({ active: false, expirationDate: null }, NOW)).toBe('inactive');
    expect(keyStatus({ active: false, expirationDate: '2027-01-01' }, NOW)).toBe('inactive');
  });
  it('is active otherwise', () => {
    expect(keyStatus({ active: true, expirationDate: null }, NOW)).toBe('active');
    expect(keyStatus({ active: true, expirationDate: '2027-01-01' }, NOW)).toBe('active');
  });
  it('reports "expired" (not "inactive") as the reason an expired key cannot be edited', () => {
    expect(editBlockReason(makeKey({ active: false, expirationDate: '2026-10-01' }), 'me', NOW)).toBe('expired');
  });
});

describe('default sort — active first, then by name', () => {
  const ks = [
    makeKey({ api_owner_id: 'a', applicationName: 'Alpha', active: false }),
    makeKey({ api_owner_id: 'b', applicationName: 'Zulu' }),
    makeKey({ api_owner_id: 'c', applicationName: 'Bravo', expirationDate: '2020-01-01', active: false }),
    makeKey({ api_owner_id: 'd', applicationName: 'Mike' }),
  ];
  const base = { search: '', status: 'All' as const };
  it('lists active keys first (by name), then the rest (by name)', () => {
    expect(filterAndSortKeys(ks, { ...base, sort: 'status' }).map((k) => k.api_owner_id)).toEqual(['d', 'b', 'a', 'c']);
  });
  it('an explicit sort ignores status grouping', () => {
    expect(filterAndSortKeys(ks, { ...base, sort: 'name' }).map((k) => k.api_owner_id)).toEqual(['a', 'c', 'd', 'b']);
  });
  it('the Inactive filter includes expired keys; Active excludes them', () => {
    expect(filterAndSortKeys(ks, { ...base, sort: 'name', status: 'Inactive' }).map((k) => k.api_owner_id)).toEqual(['a', 'c']);
    expect(filterAndSortKeys(ks, { ...base, sort: 'name', status: 'Active' }).map((k) => k.api_owner_id)).toEqual(['d', 'b']);
  });
});

describe('display helpers', () => {
  it('names an unnamed key', () => {
    expect(keyDisplayName({ applicationName: '  ' } as any)).toBe('Untitled key');
    expect(keyDisplayName({ applicationName: ' Bot ' } as any)).toBe('Bot');
    expect(keyDisplayName({} as any)).toBe('Untitled key');
  });
  it('formats an account the same way everywhere', () => {
    expect(formatAccount({ id: 'COA-1', name: 'Test COA' })).toBe('Test COA — COA-1');
    expect(formatAccount({ id: 'x', name: 'x' })).toBe('x');
    expect(formatAccount(null)).toBe('No account');
  });
  it('formats relative ages', () => {
    const at = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
    expect(formatRelativeAge(at(10_000), NOW)).toBe('just now');
    expect(formatRelativeAge(at(5 * 60_000), NOW)).toBe('5 minutes ago');
    expect(formatRelativeAge(at(60 * 60_000), NOW)).toBe('1 hour ago');
    expect(formatRelativeAge(at(4 * 86_400_000), NOW)).toBe('4 days ago');
    expect(formatRelativeAge(at(65 * 86_400_000), NOW)).toBe('2 months ago');
    expect(formatRelativeAge(at(800 * 86_400_000), NOW)).toBe('2 years ago');
    expect(formatRelativeAge('garbage', NOW)).toBe('');
    expect(formatRelativeAge(new Date(NOW.getTime() + 5000).toISOString(), NOW)).toBe('just now');
  });
  it('formats a timestamp with a time zone and no seconds', () => {
    const t = formatTimestamp('2026-10-16T21:58:12Z', 'America/Chicago');
    expect(t).toBe('Oct 16, 2026, 4:58 PM CDT');
    expect(formatTimestamp(null)).toBe('');
  });
  it('parses the backend\'s microsecond ISO strings', () => {
    expect(formatTimestamp('2026-10-16T21:58:12.123456+00:00', 'UTC')).toBe('Oct 16, 2026, 9:58 PM UTC');
  });
});

describe('"Never used"', () => {
  it('is missing lastAccessed, or lastAccessed identical to createdAt (it is initialised to it)', () => {
    expect(neverUsed({ lastAccessed: '' } as any, null)).toBe(true);
    expect(neverUsed({ lastAccessed: 'nonsense' } as any, null)).toBe(true);
    expect(neverUsed({ lastAccessed: '2026-10-01T00:00:00+00:00' } as any, '2026-10-01T00:00:00+00:00')).toBe(true);
    expect(neverUsed({ lastAccessed: '2026-10-02T00:00:00Z' } as any, '2026-10-01T00:00:00+00:00')).toBe(false);
  });
  it('describeLastUsed gives a label and a tooltip', () => {
    const used = describeLastUsed({ lastAccessed: new Date(NOW.getTime() - 4 * 86_400_000).toISOString() } as any, NOW);
    expect(used).toMatchObject({ label: 'Last used 4 days ago', never: false });
    expect(used.title).toMatch(/\d{4}, \d{1,2}:\d{2} (AM|PM)/);
    expect(describeLastUsed({ lastAccessed: undefined } as any, NOW)).toMatchObject({ label: 'Never used', never: true });
  });
});

describe('no-expiration toggle', () => {
  it('offers a date 90 days out when "No expiration" is turned off with nothing to keep', () => {
    const d = draftFromKey(makeKey());
    const on = setNoExpiration(d, false, NOW);
    expect(on.noExpiration).toBe(false);
    expect(on.expirationDate).toBe(defaultExpirationDate(NOW));
    expect(DEFAULT_EXPIRATION_DAYS).toBe(90);
    const days = (new Date(on.expirationDate).getTime() - new Date('2026-10-20').getTime()) / 86_400_000;
    expect(Math.round(days)).toBe(90);
    expect(on.expirationDate >= minExpirationDate(NOW)).toBe(true);
  });
  it('keeps a still-valid date the draft already has, and never leaves a stale one blank', () => {
    const d = { ...draftFromKey(makeKey({ expirationDate: '2027-03-01' })), noExpiration: true };
    expect(setNoExpiration(d, false, NOW).expirationDate).toBe('2027-03-01');
    const past = { ...d, expirationDate: '2020-01-01' };
    expect(setNoExpiration(past, false, NOW).expirationDate).toBe(defaultExpirationDate(NOW));
  });
  it('turning it on keeps the draft otherwise intact and saves null', () => {
    const key = makeKey({ expirationDate: '2027-03-01' });
    const d = setNoExpiration(setNoExpiration(draftFromKey(key), true, NOW), false, NOW);
    expect(diffDraft(key, d, accounts)).toEqual({});
    expect(diffDraft(key, setNoExpiration(draftFromKey(key), true, NOW), accounts)).toEqual({ expirationDate: null });
  });
});

import { RATE_PERIOD_OPTIONS } from '@/components/NewUI/settings/apiKeys/apiKeyModel';
import { periodTypes } from '@/types/rateLimit';

describe('RATE_PERIOD_OPTIONS (rate-limit dropdown)', () => {
  it('reads shortest period to longest, with friendly labels', () => {
    expect(RATE_PERIOD_OPTIONS.map((o) => o.label)).toEqual([
      'Unlimited', 'Per hour', 'Per day', 'Per month', 'Total (lifetime)',
    ]);
  });
  it('keeps the stored values unchanged, and offers every period the API knows', () => {
    expect(RATE_PERIOD_OPTIONS.map((o) => o.value)).toEqual(['Unlimited', 'Hourly', 'Daily', 'Monthly', 'Total']);
    expect([...RATE_PERIOD_OPTIONS.map((o) => o.value)].sort()).toEqual([...periodTypes].sort());
  });
});

import { isCreateFormDirty, setFullAccess as setFull, setNoExpiration as setNoExp } from '@/components/NewUI/settings/apiKeys/apiKeyModel';

describe('isCreateFormDirty — confirm before discarding the create form', () => {
  const blank = () => ({ name: '', description: '', delegate: [] as string[], systemUse: false, draft: emptyDraft('a-1') });
  it('is clean when freshly opened', () => expect(isCreateFormDirty(blank(), 'a-1')).toBe(false));
  it('is dirty once anything is typed or chosen', () => {
    expect(isCreateFormDirty({ ...blank(), name: 'x' }, 'a-1')).toBe(true);
    expect(isCreateFormDirty({ ...blank(), description: 'x' }, 'a-1')).toBe(true);
    expect(isCreateFormDirty({ ...blank(), delegate: ['a@b.edu'] }, 'a-1')).toBe(true);
    expect(isCreateFormDirty({ ...blank(), systemUse: true }, 'a-1')).toBe(true);
    const f = blank();
    expect(isCreateFormDirty({ ...f, draft: { ...f.draft, accountId: 'a-2' } }, 'a-1')).toBe(true);
    expect(isCreateFormDirty({ ...f, draft: { ...f.draft, ratePeriod: 'Daily' } }, 'a-1')).toBe(true);
    expect(isCreateFormDirty({ ...f, draft: setFull(f.draft, false) }, 'a-1')).toBe(true);
    expect(isCreateFormDirty({ ...f, draft: setNoExp(f.draft, false, NOW) }, 'a-1')).toBe(true);
  });
  it('is clean again if the user puts everything back', () => {
    const f = blank();
    const back = setFull(setFull(f.draft, false), true);
    expect(isCreateFormDirty({ ...f, draft: back }, 'a-1')).toBe(false);
  });
});
