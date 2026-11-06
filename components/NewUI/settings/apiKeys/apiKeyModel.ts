/**
 * apiKeyModel — React-free vocabulary for Settings → API Access.
 *
 * Everything the card, the create form and the tests need to agree on:
 *   - what the backend accepts for each editable field (`/apiKeys/keys/update`)
 *   - who may edit / rotate / deactivate a key
 *   - the edit draft: building it from a key, diffing it into the `updates`
 *     payload (only what changed), validating it
 *
 * Backend facts this encodes (amplify-lambda-api/service/core.py):
 *   - `update_api_key` accepts several fields per key in ONE request and applies them in a
 *     single `update_item`, so a key's save is atomic — there is no partial per-field failure.
 *   - It only updates keys the caller OWNS that are ACTIVE and NOT EXPIRED. `is_expired` is
 *     `date <= now` against a midnight-UTC date, so "today" is already expired.
 *   - `full_access` is a stored sentinel, NOT shorthand for the other types: every authz check
 *     is `<type> in accessTypes or "full_access" in accessTypes`. Full access ⇒ send exactly
 *     `["full_access"]`.
 *   - `expirationDate: null` is allowed (no expiration).
 *   - Rotation overwrites the stored hash in one write: the old key stops working immediately.
 *
 * No React imports.
 */

import type { ApiKey } from '@/types/apikeys';
import type { Account } from '@/types/accounts';
import { noRateLimit, PeriodType, RateLimit, UNLIMITED } from '@/types/rateLimit';

// ── Access types ─────────────────────────────────────────────────────────────

export const FULL_ACCESS = 'full_access';

/** The access types the UI offers today (same list the create form always used). */
export const KNOWN_ACCESS_TYPES = [
  'assistants',
  'chat',
  'file_upload',
  'share',
  'dual_embedding',
] as const;

/** 'file_upload' → 'File upload'; 'full_access' → 'Full access'. */
export const formatAccessType = (type: string): string => {
  const words = String(type).replace(/_/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/**
 * Stored access types as a flat, de-duplicated string list. The legacy editor saved
 * `[["full_access"]]` (an array inside an array), so tolerate any nesting and junk.
 */
export const normalizeAccessTypes = (raw: unknown): string[] => {
  const out: string[] = [];
  const walk = (value: unknown) => {
    if (Array.isArray(value)) value.forEach(walk);
    else if (typeof value === 'string' && value.trim() && !out.includes(value)) out.push(value);
  };
  walk(raw);
  return out;
};

export const hasFullAccess = (types: string[]): boolean => types.includes(FULL_ACCESS);

/** Chips for view mode: "Full access" alone, otherwise each specific type. */
export const accessChips = (raw: unknown): string[] => {
  const types = normalizeAccessTypes(raw);
  if (hasFullAccess(types)) return [formatAccessType(FULL_ACCESS)];
  return types.map(formatAccessType);
};

// ── Dates & permissions ──────────────────────────────────────────────────────

/** Same test the backend uses: a 'YYYY-MM-DD' date at midnight UTC is expired once `<= now`. */
export const isKeyExpired = (date: string | null | undefined, now: Date = new Date()): boolean => {
  if (!date) return false;
  const t = new Date(date).getTime();
  return Number.isFinite(t) && t <= now.getTime();
};

const ymd = (y: number, m: number, d: number) =>
  `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/**
 * Earliest date an expiration may be set to. It must still be in the future by the backend's
 * clock (midnight UTC `<= now` ⇒ expired), so take the later of "tomorrow" in the user's
 * timezone and "tomorrow" in UTC.
 */
export const minExpirationDate = (now: Date = new Date()): string => {
  const local = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const utc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const localStr = ymd(local.getFullYear(), local.getMonth() + 1, local.getDate());
  const utcStr = ymd(utc.getUTCFullYear(), utc.getUTCMonth() + 1, utc.getUTCDate());
  return localStr > utcStr ? localStr : utcStr;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const isValidDateString = (value: string): boolean =>
  DATE_RE.test(value) && Number.isFinite(new Date(`${value}T00:00:00Z`).getTime());

export type EditBlockReason = 'delegated' | 'inactive' | 'expired' | null;

/** Why this user cannot edit the key (null ⇒ they can). Mirrors the backend's screening. */
export const editBlockReason = (
  key: ApiKey,
  userId: string | null | undefined,
  now: Date = new Date(),
): EditBlockReason => {
  if (!userId || key.owner !== userId) return 'delegated';
  // Expired first: the backend flips expired keys to active=false, so they'd otherwise read as "inactive".
  if (isKeyExpired(key.expirationDate, now)) return 'expired';
  if (!key.active) return 'inactive';
  return null;
};

export const canEditKey = (key: ApiKey, userId: string | null | undefined, now?: Date) =>
  editBlockReason(key, userId, now) === null;

/**
 * Rotation rules from `rotate_api_key`: active, not expired; a delegated key is rotated by its
 * delegate only, a normal key by its owner only. System-managed keys (`purpose`) are not
 * user-rotatable.
 */
export const canRotateKey = (
  key: ApiKey,
  userId: string | null | undefined,
  now: Date = new Date(),
): boolean => {
  if (!userId || !key.active || isKeyExpired(key.expirationDate, now)) return false;
  if (key.delegate) return key.delegate === userId;
  return key.owner === userId && !key.purpose;
};

// ── Rate limit ───────────────────────────────────────────────────────────────

/**
 * Rate-limit period choices for the dropdown: shortest period to longest, with friendly labels.
 * `value` is what is stored / sent (unchanged); only `label` is display text.
 */
export const RATE_PERIOD_OPTIONS: ReadonlyArray<{ value: PeriodType; label: string }> = [
  { value: 'Unlimited', label: 'Unlimited' },
  { value: 'Hourly', label: 'Per hour' },
  { value: 'Daily', label: 'Per day' },
  { value: 'Monthly', label: 'Per month' },
  { value: 'Total', label: 'Total (lifetime)' },
];

/** "Unlimited" or "$5.00 / Daily". Tolerates a missing rate limit. */
export const describeRateLimit = (limit: RateLimit | null | undefined): string => {
  if (!limit || limit.rate === null || limit.rate === undefined || limit.period === UNLIMITED) {
    return 'Unlimited';
  }
  return `$${Number(limit.rate).toFixed(2)} / ${limit.period}`;
};

/** Parse "$5", "5.5", "12.34". `null` for blank / non-numeric / negative. */
export const parseRateAmount = (text: string): number | null => {
  const cleaned = String(text ?? '').replace(/[$,\s]/g, '');
  if (!cleaned || !/^\d*\.?\d+$|^\d+\.$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
};

export const buildRateLimit = (period: PeriodType, amount: string): RateLimit => {
  if (period === UNLIMITED) return { ...noRateLimit };
  return { period, rate: parseRateAmount(amount) ?? 0 };
};

// ── Edit draft ───────────────────────────────────────────────────────────────

export interface ApiKeyDraft {
  accountId: string;
  /** '' when there is no expiration. */
  expirationDate: string;
  noExpiration: boolean;
  ratePeriod: PeriodType;
  rateAmount: string;
  fullAccess: boolean;
  /** Specific types offered (known + any extra the key already has) and whether each is on. */
  access: Record<string, boolean>;
}

/** The specific access types shown as checkboxes: the known ones, then any unfamiliar ones the key has. */
export const accessOptionsFor = (stored: unknown): string[] => {
  const extras = normalizeAccessTypes(stored).filter(
    (t) => t !== FULL_ACCESS && !(KNOWN_ACCESS_TYPES as readonly string[]).includes(t),
  );
  return [...KNOWN_ACCESS_TYPES, ...extras];
};

/** A blank draft for the create form: no expiration, unlimited, Full access (the long-standing default). */
export const emptyDraft = (accountId: string): ApiKeyDraft => ({
  accountId,
  expirationDate: '',
  noExpiration: true,
  ratePeriod: UNLIMITED,
  rateAmount: '',
  fullAccess: true,
  access: Object.fromEntries(KNOWN_ACCESS_TYPES.map((t) => [t, true])),
});

export const draftFromKey = (key: ApiKey): ApiKeyDraft => {
  const types = normalizeAccessTypes(key.accessTypes);
  const fullAccess = hasFullAccess(types);
  const access: Record<string, boolean> = {};
  accessOptionsFor(types).forEach((t) => {
    // With Full access every type is implied, so show them all on (and disabled).
    access[t] = fullAccess || types.includes(t);
  });
  const rate = key.rateLimit;
  const hasRate = !!rate && rate.period !== UNLIMITED && rate.rate !== null && rate.rate !== undefined;
  return {
    accountId: key.account?.id ?? '',
    expirationDate: key.expirationDate ?? '',
    noExpiration: !key.expirationDate,
    ratePeriod: (hasRate ? rate.period : UNLIMITED) as PeriodType,
    rateAmount: hasRate ? Number(rate.rate).toFixed(2) : '',
    fullAccess,
    access,
  };
};

/** Tick/untick Full access. Ticking implies (and visually checks) everything; unticking clears
 *  the individual boxes so the user chooses deliberately — mirrors the create form. */
export const setFullAccess = (draft: ApiKeyDraft, checked: boolean): ApiKeyDraft => ({
  ...draft,
  fullAccess: checked,
  access: Object.fromEntries(Object.keys(draft.access).map((t) => [t, checked])),
});

export const toggleAccessType = (draft: ApiKeyDraft, type: string): ApiKeyDraft => {
  if (draft.fullAccess) return draft; // disabled while Full access is on
  return { ...draft, access: { ...draft.access, [type]: !draft.access[type] } };
};

/** A sensible expiration to offer when the user turns "No expiration" off. */
export const DEFAULT_EXPIRATION_DAYS = 90;

export const defaultExpirationDate = (now: Date = new Date(), days: number = DEFAULT_EXPIRATION_DAYS): string => {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
  const str = ymd(d.getFullYear(), d.getMonth() + 1, d.getDate());
  const min = minExpirationDate(now);
  return str < min ? min : str;
};

/**
 * Toggle "No expiration". Turning it OFF keeps a still-valid date the draft already has,
 * otherwise offers the default (so the field is never left blank or stale).
 */
export const setNoExpiration = (
  draft: ApiKeyDraft,
  noExpiration: boolean,
  now: Date = new Date(),
): ApiKeyDraft => {
  if (noExpiration) return { ...draft, noExpiration: true };
  const keep = draft.expirationDate && draft.expirationDate >= minExpirationDate(now);
  return { ...draft, noExpiration: false, expirationDate: keep ? draft.expirationDate : defaultExpirationDate(now) };
};

/** The access types a draft would save. */
export const draftAccessTypes = (draft: ApiKeyDraft): string[] =>
  draft.fullAccess ? [FULL_ACCESS] : Object.keys(draft.access).filter((t) => draft.access[t]);

export interface ApiKeyUpdates {
  account?: Account;
  rateLimit?: RateLimit;
  expirationDate?: string | null;
  accessTypes?: string[];
}

const sameSet = (a: string[], b: string[]) =>
  a.length === b.length && a.every((x) => b.includes(x));

/**
 * The `updates` object for `/keys/update` — ONLY the fields that differ from the key.
 * `accounts` resolves the chosen id back to the full Account object the API expects.
 */
export const diffDraft = (key: ApiKey, draft: ApiKeyDraft, accounts: Account[]): ApiKeyUpdates => {
  const updates: ApiKeyUpdates = {};

  if (draft.accountId && draft.accountId !== (key.account?.id ?? '')) {
    const next = accounts.find((a) => a.id === draft.accountId);
    if (next) updates.account = next;
  }

  const original = draftFromKey(key);
  const nextExpiration = draft.noExpiration ? null : draft.expirationDate || null;
  const prevExpiration = key.expirationDate || null;
  if (nextExpiration !== prevExpiration) updates.expirationDate = nextExpiration;

  const nextRate = buildRateLimit(draft.ratePeriod, draft.rateAmount);
  const prevRate = buildRateLimit(original.ratePeriod, original.rateAmount);
  if (nextRate.period !== prevRate.period || nextRate.rate !== prevRate.rate) {
    updates.rateLimit = nextRate;
  }

  const nextTypes = draftAccessTypes(draft);
  const prevTypes = hasFullAccess(normalizeAccessTypes(key.accessTypes))
    ? [FULL_ACCESS]
    : normalizeAccessTypes(key.accessTypes);
  if (!sameSet(nextTypes, prevTypes)) updates.accessTypes = nextTypes;

  return updates;
};

export const isDraftDirty = (key: ApiKey, draft: ApiKeyDraft, accounts: Account[]): boolean =>
  Object.keys(diffDraft(key, draft, accounts)).length > 0;

export type DraftErrors = Partial<Record<'account' | 'expirationDate' | 'rateLimit' | 'accessTypes', string>>;

/**
 * Field errors. Only fields the user actually changed are checked, so an untouched legacy value
 * can never block a save of something else.
 */
export const validateDraft = (
  key: ApiKey,
  draft: ApiKeyDraft,
  accounts: Account[],
  now: Date = new Date(),
): DraftErrors => {
  const errors: DraftErrors = {};
  const updates = diffDraft(key, draft, accounts);

  // "Date" mode with no date picked is incomplete whether or not the stored value changed.
  if (!draft.noExpiration) {
    if (!draft.expirationDate) errors.expirationDate = 'Choose a date, or select “No expiration”.';
    else if (!isValidDateString(draft.expirationDate)) errors.expirationDate = 'Enter a valid date.';
    else if ('expirationDate' in updates && draft.expirationDate < minExpirationDate(now)) {
      errors.expirationDate = 'Expiration must be after today.';
    }
  }

  if ('rateLimit' in updates && draft.ratePeriod !== UNLIMITED) {
    const amount = parseRateAmount(draft.rateAmount);
    if (amount === null || amount <= 0) errors.rateLimit = 'Enter an amount greater than $0.00.';
  }

  if ('accessTypes' in updates && !draft.fullAccess && draftAccessTypes(draft).length === 0) {
    errors.accessTypes = 'Select at least one access type, or Full access.';
  }

  return errors;
};

// ── Create form ──────────────────────────────────────────────────────────────

export interface CreateKeyInput {
  name: string;
  accountSelected: boolean;
  ratePeriod: PeriodType;
  rateAmount: string;
  includeExpiration: boolean;
  expirationDate: string;
  fullAccess: boolean;
  selectedTypes: string[];
}

export interface CreateFormState {
  name: string;
  description: string;
  delegate: string[];
  systemUse: boolean;
  draft: ApiKeyDraft;
}

/** Has anything been entered or changed since the form was freshly opened? */
export const isCreateFormDirty = (form: CreateFormState, defaultAccountId: string): boolean =>
  form.name !== '' ||
  form.description !== '' ||
  form.delegate.length > 0 ||
  form.systemUse ||
  JSON.stringify(form.draft) !== JSON.stringify(emptyDraft(defaultAccountId));

export const validateCreate = (input: CreateKeyInput, now: Date = new Date()) => {
  const errors: Partial<Record<'name' | 'account' | 'rateLimit' | 'expirationDate' | 'accessTypes', string>> = {};
  if (!input.name.trim()) errors.name = 'Give the key a name.';
  if (!input.accountSelected) errors.account = 'Add a billing account first.';
  if (input.ratePeriod !== UNLIMITED) {
    const amount = parseRateAmount(input.rateAmount);
    if (amount === null || amount <= 0) errors.rateLimit = 'Enter an amount greater than $0.00.';
  }
  if (input.includeExpiration) {
    if (!isValidDateString(input.expirationDate)) errors.expirationDate = 'Choose a date.';
    else if (input.expirationDate < minExpirationDate(now)) {
      errors.expirationDate = 'Expiration must be after today.';
    }
  }
  if (!input.fullAccess && input.selectedTypes.length === 0) {
    errors.accessTypes = 'Select at least one access type, or Full access.';
  }
  return errors;
};

// ── Costs ────────────────────────────────────────────────────────────────────

/** MTD entries are `{accountInfo: "<account>#<api_owner_id>", totalCost}`. */
export const mtdCostForKey = (
  mtd: { accounts?: Array<{ accountInfo?: string; totalCost?: number }> } | null | undefined,
  key: Pick<ApiKey, 'api_owner_id'>,
): number | null => {
  if (!mtd?.accounts) return null;
  const hit = mtd.accounts.find((acc) => {
    const [, keyId] = String(acc.accountInfo ?? '').split('#');
    return keyId === key.api_owner_id;
  });
  return hit && typeof hit.totalCost === 'number' ? hit.totalCost : null;
};

// ── List filtering ───────────────────────────────────────────────────────────

export type KeyStatusFilter = 'All' | 'Active' | 'Inactive';
export type KeySort = 'status' | 'name' | 'lastAccessed' | 'expiration';

export interface KeyListFilter {
  search: string;
  status: KeyStatusFilter;
  sort: KeySort;
  /** Only used for the owner list; 'All' disables it. */
  purpose?: string;
}

export const filterAndSortKeys = (keys: ApiKey[], f: KeyListFilter): ApiKey[] => {
  let result = [...keys];
  const q = f.search.trim().toLowerCase();
  if (q) result = result.filter((k) => k.applicationName?.toLowerCase().includes(q));
  if (f.status === 'Active') result = result.filter((k) => keyStatus(k) === 'active');
  else if (f.status === 'Inactive') result = result.filter((k) => keyStatus(k) !== 'active');
  if (f.purpose && f.purpose !== 'All') result = result.filter((k) => (k.purpose || '') === f.purpose);

  const time = (v: string | null | undefined, empty: number) => (v ? new Date(v).getTime() : empty);
  result.sort((a, b) => {
    if (f.sort === 'lastAccessed') return time(b.lastAccessed, 0) - time(a.lastAccessed, 0);
    if (f.sort === 'expiration') {
      const ta = time(a.expirationDate, Infinity);
      const tb = time(b.expirationDate, Infinity);
      return ta === tb ? 0 : ta < tb ? -1 : 1;
    }
    if (f.sort === 'status') {
      // Active keys first, then everything else; each group by name.
      const rank = (k: ApiKey) => (keyStatus(k) === 'active' ? 0 : 1);
      const byRank = rank(a) - rank(b);
      if (byRank !== 0) return byRank;
    }
    return (a.applicationName || '').localeCompare(b.applicationName || '');
  });
  return result;
};

/** "agent_tools" → "Agent Tools"; empty purpose → "General". */
export const formatPurpose = (purpose: string): string =>
  purpose === '' ? 'General' : purpose.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

// ── Status ───────────────────────────────────────────────────────────────────

export type KeyStatus = 'active' | 'expired' | 'inactive';

/**
 * One status per key. The backend has no "expired" flag: `/keys/get` flips expired keys to
 * `active=false` on fetch, so an expired key arrives as inactive WITH a past expirationDate,
 * while a manually deactivated key is inactive with no past date. A key that expired since the
 * list was fetched still says `active=true`. So the DATE decides "expired", regardless of `active`.
 * (A key deactivated by hand and later past its date reads as expired — the data can't tell.)
 */
export const keyStatus = (key: Pick<ApiKey, 'active' | 'expirationDate'>, now: Date = new Date()): KeyStatus => {
  if (isKeyExpired(key.expirationDate, now)) return 'expired';
  return key.active ? 'active' : 'inactive';
};

// ── Display helpers ──────────────────────────────────────────────────────────

export const UNTITLED_KEY = 'Untitled key';

export const hasKeyName = (key: Pick<ApiKey, 'applicationName'>): boolean =>
  typeof key.applicationName === 'string' && key.applicationName.trim().length > 0;

/** Plain-text name for dialogs / aria-labels. */
export const keyDisplayName = (key: Pick<ApiKey, 'applicationName'>): string =>
  hasKeyName(key) ? key.applicationName.trim() : UNTITLED_KEY;

/** "Research — a-1": the one account format, used in view mode, edit mode and the create form. */
export const formatAccount = (account: Pick<Account, 'id' | 'name'> | null | undefined): string => {
  if (!account) return 'No account';
  const name = String(account.name ?? '').trim();
  const id = String(account.id ?? '').trim();
  if (name && id && name !== id) return `${name} — ${id}`;
  return name || id || 'No account';
};

/** `createdAt` is returned by the list but missing from the (read-only) ApiKey type. */
export const getCreatedAt = (key: unknown): string | null => {
  const v = (key as { createdAt?: unknown } | null)?.createdAt;
  return typeof v === 'string' && v.trim() ? v : null;
};

const toTime = (iso: unknown): number => (typeof iso === 'string' ? new Date(iso).getTime() : NaN);

/** "Oct 16, 2026, 4:58 PM CDT" — full timestamp with time zone, never seconds. */
export const formatTimestamp = (iso: string | null | undefined, timeZone?: string): string => {
  const t = toTime(iso);
  if (!Number.isFinite(t)) return '';
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
    ...(timeZone ? { timeZone } : null),
  }).format(new Date(t));
};

/** "just now", "5 minutes ago", "4 days ago", "3 months ago". */
export const formatRelativeAge = (iso: string | null | undefined, now: Date = new Date()): string => {
  const t = toTime(iso);
  if (!Number.isFinite(t)) return '';
  const sec = Math.max(0, (now.getTime() - t) / 1000);
  const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'} ago`;
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return unit(min, 'minute');
  const hr = Math.floor(min / 60);
  if (hr < 24) return unit(hr, 'hour');
  const day = Math.floor(hr / 24);
  if (day < 30) return unit(day, 'day');
  if (day < 365) return unit(Math.floor(day / 30), 'month');
  return unit(Math.floor(day / 365), 'year');
};

/**
 * Has this key been used? `lastAccessed` is set equal to `createdAt` when a key is created and is
 * only advanced by the chat path, so "missing or identical to createdAt" means no recorded use.
 */
export const neverUsed = (key: Pick<ApiKey, 'lastAccessed'>, createdAt: string | null): boolean => {
  const last = key.lastAccessed;
  if (!last || !Number.isFinite(toTime(last))) return true;
  return createdAt !== null && last === createdAt;
};

export interface LastUsedInfo {
  /** "Last used 4 days ago" | "Never used" */
  label: string;
  /** Tooltip: the full timestamp, or why it says never. */
  title: string;
  never: boolean;
}

export const describeLastUsed = (key: Pick<ApiKey, 'lastAccessed'>, now: Date = new Date()): LastUsedInfo => {
  const created = getCreatedAt(key);
  if (neverUsed(key, created)) {
    return { label: 'Never used', title: 'No activity has been recorded for this key yet.', never: true };
  }
  return {
    label: `Last used ${formatRelativeAge(key.lastAccessed, now)}`,
    title: formatTimestamp(key.lastAccessed),
    never: false,
  };
};
